const crypto = require("node:crypto");

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const PROFILE_FILE_PREFIX = "orion-portable-profile-v3-";
const MAX_PROFILE_BYTES = 2 * 1024 * 1024;
const READ_SNAPSHOT_ATTEMPTS = 3;
const READ_SNAPSHOT_RETRY_DELAY_MS = 150;

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function profileFileName(profileKey) {
  const key = String(profileKey || "").trim();
  if (!key) throw codedError("GOOGLE_DRIVE_PROFILE_ARGUMENT_INVALID", "Portable profile key is required.");
  const digest = crypto.createHash("sha256").update(key, "utf8").digest("hex").slice(0, 32);
  return `${PROFILE_FILE_PREFIX}${digest}.json`;
}

function revisionTag(metadata) {
  const etag = String(metadata?.etag || "").trim();
  if (etag && !etag.startsWith("W/")) return `etag:${etag}`;
  const version = String(metadata?.version || "").trim();
  if (!version) throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", "Portable profile metadata has no revision token.");
  return `version:${version}`;
}

async function responseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function responseJson(response, code = "GOOGLE_DRIVE_PROFILE_INVALID") {
  const body = await responseText(response);
  try {
    return JSON.parse(body);
  } catch {
    throw codedError(code, "Google Drive returned unreadable portable profile metadata.");
  }
}

async function requireOk(response, code, message) {
  if (response?.ok) return response;
  const status = Number(response?.status) || 0;
  throw codedError(code, `${message}${status ? ` (HTTP ${status})` : ""}`);
}

function encode(value) {
  return encodeURIComponent(String(value));
}

async function findProfileFiles(driveRequest, profileKey) {
  const fileName = profileFileName(profileKey);
  const query = `name = '${fileName}' and trashed = false`;
  const url = `${DRIVE_API}/files?spaces=appDataFolder&q=${encode(query)}&fields=${encode("files(id)")}&pageSize=10`;
  const response = await driveRequest(url);
  await requireOk(response, "GOOGLE_DRIVE_PROFILE_IO_FAILED", "Failed to locate the portable profile");
  const body = await responseJson(response);
  const files = Array.isArray(body?.files) ? body.files : [];
  return files.map((file) => String(file?.id || "").trim()).filter(Boolean);
}

async function fetchMetadata(driveRequest, fileId) {
  const fields = encode("id,modifiedTime,version");
  const response = await driveRequest(`${DRIVE_API}/files/${encode(fileId)}?fields=${fields}`);
  await requireOk(response, "GOOGLE_DRIVE_PROFILE_IO_FAILED", "Failed to read portable profile metadata");
  const body = await responseJson(response);
  const id = String(body?.id || "").trim();
  const version = String(body?.version || "").trim();
  if (!id || !version) {
    throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", "Portable profile metadata is incomplete.");
  }
  const modified = Date.parse(String(body?.modifiedTime || ""));
  return {
    id,
    version,
    modifiedAt: Number.isFinite(modified) ? modified : null,
    etag: String(response.headers?.get?.("etag") || "").trim() || null,
  };
}

async function downloadProfile(driveRequest, fileId) {
  const response = await driveRequest(`${DRIVE_API}/files/${encode(fileId)}?alt=media`);
  await requireOk(response, "GOOGLE_DRIVE_PROFILE_IO_FAILED", "Failed to read the portable profile");
  const body = await responseText(response);
  if (Buffer.byteLength(body, "utf8") > MAX_PROFILE_BYTES) {
    throw codedError("GOOGLE_DRIVE_PROFILE_TOO_LARGE", "Portable profile exceeds the supported size.");
  }
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not-object");
  } catch {
    throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", "Portable profile is not a JSON object.");
  }
  return body;
}

async function readStableProfileSnapshot(driveRequest, fileId, options = {}) {
  const delay = typeof options.delay === "function"
    ? options.delay
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 0; attempt < READ_SNAPSHOT_ATTEMPTS; attempt += 1) {
    const before = await fetchMetadata(driveRequest, fileId);
    const profileJson = await downloadProfile(driveRequest, fileId);
    const after = await fetchMetadata(driveRequest, fileId);
    if (revisionTag(before) === revisionTag(after)) {
      return { metadata: after, profileJson };
    }
    if (attempt < READ_SNAPSHOT_ATTEMPTS - 1) {
      await delay(READ_SNAPSHOT_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw codedError("GOOGLE_DRIVE_PROFILE_TEMPORARY", "Portable profile changed while Orion was reading it.");
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPortableJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPortableJsonValue);
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(isPortableJsonValue);
}

function isPortableRecordNamespace(value) {
  if (!isPlainObject(value) || value.schemaVersion !== 1
    || !isNonNegativeInteger(value.revision) || !isFiniteTimestamp(value.updatedAt)
    || !isPlainObject(value.records)) return false;
  return Object.entries(value.records).every(([key, record]) => {
    if (!key || !isPlainObject(record) || !isPositiveInteger(record.revision)
      || !isFiniteTimestamp(record.updatedAt)
      || typeof record.updatedBy !== "string" || !record.updatedBy.trim()) return false;
    if (record.deletedAt === null) return isPortableJsonValue(record.value);
    return isFiniteTimestamp(record.deletedAt) && record.value === null;
  });
}

function parsePortableProfileJsonV3(profileJson) {
  const body = String(profileJson || "");
  if (Buffer.byteLength(body, "utf8") > MAX_PROFILE_BYTES) {
    throw codedError("GOOGLE_DRIVE_PROFILE_TOO_LARGE", "Portable profile exceeds the supported size.");
  }
  let parsed;
  try { parsed = JSON.parse(body); } catch {
    throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", "Portable profile is not valid JSON.");
  }
  if (!isPlainObject(parsed) || parsed.schemaVersion !== 3
    || typeof parsed.profileId !== "string" || !parsed.profileId.trim()
    || !isNonNegativeInteger(parsed.revision)
    || !isFiniteTimestamp(parsed.createdAt) || !isFiniteTimestamp(parsed.updatedAt)
    || !isPlainObject(parsed.namespaces)) {
    throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", "Portable profile failed the V3 envelope contract.");
  }
  const known = new Set(["myList", "history", "watched", "progress", "preferences"]);
  for (const [name, namespace] of Object.entries(parsed.namespaces)) {
    if (known.has(name) ? !isPortableRecordNamespace(namespace) : !isPortableJsonValue(namespace)) {
      throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", `Portable profile namespace ${name} is invalid.`);
    }
  }
  return { body, parsed };
}

function validateProfileJson(profileJson) {
  return parsePortableProfileJsonV3(profileJson).body;
}

function createPortableProfileReader({ driveRequest, delay } = {}) {
  if (typeof driveRequest !== "function") throw new TypeError("driveRequest is required");
  return async function readPortableProfile(profileKey) {
    const matches = await findProfileFiles(driveRequest, profileKey);
    if (matches.length > 1) {
      throw codedError("GOOGLE_DRIVE_PROFILE_DUPLICATE", "More than one Orion portable profile exists for this key.");
    }
    if (matches.length === 0) {
      return { state: "missing", revisionTag: null };
    }

    const snapshot = await readStableProfileSnapshot(driveRequest, matches[0], { delay });
    return {
      state: "found",
      profileJson: snapshot.profileJson,
      revisionTag: revisionTag(snapshot.metadata),
      remoteModifiedAt: snapshot.metadata.modifiedAt,
    };
  };
}

function createPortableProfileWriter({ driveRequest } = {}) {
  if (typeof driveRequest !== "function") throw new TypeError("driveRequest is required");
  return async function writePortableProfile(profileKey, profileJson, expectedRevisionTag) {
    const body = validateProfileJson(profileJson);
    const expected = expectedRevisionTag == null ? null : String(expectedRevisionTag).trim();
    if (expectedRevisionTag != null && !expected) {
      throw codedError("GOOGLE_DRIVE_PROFILE_ARGUMENT_INVALID", "Expected revision tag is invalid.");
    }

    const matches = await findProfileFiles(driveRequest, profileKey);
    if (matches.length > 1) {
      throw codedError("GOOGLE_DRIVE_PROFILE_DUPLICATE", "More than one Orion portable profile exists for this key.");
    }

    if (expected === null) {
      if (matches.length !== 0) {
        const metadata = await fetchMetadata(driveRequest, matches[0]);
        return { state: "conflict", revisionTag: revisionTag(metadata) };
      }
      const boundary = `orion_profile_${crypto.randomBytes(12).toString("hex")}`;
      const metadata = {
        name: profileFileName(profileKey),
        parents: ["appDataFolder"],
        mimeType: "application/json",
      };
      const multipart = [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n`,
        `--${boundary}--`,
      ].join("");
      const createResponse = await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encode("id")}`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipart,
      });
      await requireOk(createResponse, "GOOGLE_DRIVE_PROFILE_IO_FAILED", "Failed to create the portable profile");
      const created = await responseJson(createResponse);
      const createdId = String(created?.id || "").trim();
      if (!createdId) throw codedError("GOOGLE_DRIVE_PROFILE_INVALID", "Created portable profile has no Drive file id.");
      const afterMatches = await findProfileFiles(driveRequest, profileKey);
      if (afterMatches.length !== 1 || afterMatches[0] !== createdId) {
        throw codedError("GOOGLE_DRIVE_PROFILE_DUPLICATE", "Portable profile creation could not be verified uniquely.");
      }
      const after = await fetchMetadata(driveRequest, createdId);
      return { state: "written", revisionTag: revisionTag(after), remoteModifiedAt: after.modifiedAt };
    }

    if (matches.length === 0) return { state: "conflict", revisionTag: null };
    const fileId = matches[0];
    const before = await fetchMetadata(driveRequest, fileId);
    const currentTag = revisionTag(before);
    if (currentTag !== expected) return { state: "conflict", revisionTag: currentTag };
    if (!currentTag.startsWith("etag:")) {
      throw codedError(
        "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE",
        "Google Drive did not provide a strong conditional-write token. Orion refused to overwrite the portable profile.",
      );
    }

    const ifMatch = currentTag.slice("etag:".length);
    const updateResponse = await driveRequest(`${DRIVE_UPLOAD_API}/files/${encode(fileId)}?uploadType=media`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "If-Match": ifMatch,
      },
      body,
    });
    if (updateResponse?.status === 404 || updateResponse?.status === 412) {
      let latestTag = null;
      try {
        const latestMatches = await findProfileFiles(driveRequest, profileKey);
        if (latestMatches.length === 1) latestTag = revisionTag(await fetchMetadata(driveRequest, latestMatches[0]));
      } catch {}
      return { state: "conflict", revisionTag: latestTag };
    }
    await requireOk(updateResponse, "GOOGLE_DRIVE_PROFILE_IO_FAILED", "Failed to update the portable profile");
    const afterMatches = await findProfileFiles(driveRequest, profileKey);
    if (afterMatches.length !== 1 || afterMatches[0] !== fileId) {
      throw codedError("GOOGLE_DRIVE_PROFILE_DUPLICATE", "Portable profile update could not be verified uniquely.");
    }
    const after = await fetchMetadata(driveRequest, fileId);
    return { state: "written", revisionTag: revisionTag(after), remoteModifiedAt: after.modifiedAt };
  };
}

module.exports = {
  MAX_PROFILE_BYTES,
  PROFILE_FILE_PREFIX,
  createPortableProfileReader,
  createPortableProfileWriter,
  profileFileName,
  revisionTag,
  parsePortableProfileJsonV3,
};
