const crypto = require("node:crypto");

const DRIVE_API = "https://www.googleapis.com/drive/v3";
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

module.exports = {
  MAX_PROFILE_BYTES,
  PROFILE_FILE_PREFIX,
  createPortableProfileReader,
  profileFileName,
  revisionTag,
};
