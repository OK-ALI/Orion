const { dialog, ipcMain, protocol, session } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { parseByteRange } = require("./localMediaRange");
const { googleDriveRequest } = require("../ipc/googleAuthIpc");

const grants = new Map();
let protocolRegistered = false;

const MIME = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
  ".mov": "video/quicktime", ".mkv": "video/x-matroska",
  ".vtt": "text/vtt; charset=utf-8", ".srt": "text/vtt; charset=utf-8",
};

function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: "orion-media",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  }]);
}

function grant(filePath, downloadId, transform = null) {
  const token = crypto.randomUUID();
  grants.set(token, { filePath: path.resolve(filePath), downloadId, transform, expiresAt: Date.now() + 21_600_000 });
  return `orion-media://asset/${token}`;
}

function grantDrive(driveFileId, downloadId) {
  const token = crypto.randomUUID();
  grants.set(token, { driveFileId, downloadId, expiresAt: Date.now() + 21_600_000 });
  return `orion-media://asset/${token}`;
}

function srtToVtt(value) {
  return `WEBVTT\n\n${String(value || "").replace(/^\uFEFF/, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`;
}

function errorResponse(status, message) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function serve(request) {
  let token = "";
  try { token = new URL(request.url).pathname.split("/").filter(Boolean)[0] || ""; } catch {}
  const item = grants.get(token);
  if (!item || item.expiresAt < Date.now()) {
    grants.delete(token);
    return errorResponse(404, "Media grant expired");
  }
  if (item.driveFileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${item.driveFileId}?alt=media`;
    const headers = {};
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }
    try {
      const driveRes = await googleDriveRequest(url, { headers });
      const responseHeaders = new Headers();
      for (const [key, val] of driveRes.headers.entries()) {
        responseHeaders.set(key, val);
      }
      responseHeaders.set("access-control-allow-origin", "*");
      return new Response(driveRes.body, {
        status: driveRes.status,
        statusText: driveRes.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return errorResponse(500, `Drive streaming proxy error: ${err.message}`);
    }
  }

  let stat;
  try { stat = await fs.promises.stat(item.filePath); } catch { return errorResponse(404, "File not found"); }
  if (!stat.isFile()) return errorResponse(404, "File not found");
  const ext = path.extname(item.filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  if (item.transform === "srt-vtt") {
    return new Response(srtToVtt(await fs.promises.readFile(item.filePath, "utf8")), {
      status: 200,
      headers: { "content-type": contentType, "access-control-allow-origin": "*" },
    });
  }
  const range = parseByteRange(request.headers.get("range"), stat.size);
  if (!range) return errorResponse(416, "Range not satisfiable");
  const { start, end, status } = range;
  const headers = {
    "accept-ranges": "bytes", "content-type": contentType,
    "content-length": String(end - start + 1), "access-control-allow-origin": "*",
  };
  if (status === 206) headers["content-range"] = `bytes ${start}-${end}/${stat.size}`;
  return new Response(Readable.toWeb(fs.createReadStream(item.filePath, { start, end })), { status, headers });
}

function register({ getDownloads, saveDownloads }) {
  if (!protocolRegistered) {
    protocol.handle("orion-media", serve);
    session.fromPartition("persist:player").protocol.handle("orion-media", serve);
    protocolRegistered = true;
  }
  ipcMain.handle("local-media:open", (_, downloadId) => {
    const download = getDownloads().find((item) => item.id === downloadId);
    if (!download) {
      return { ok: false, error: "The download record no longer exists." };
    }
    const localExists = download.filePath && fs.existsSync(download.filePath);
    if (!localExists && !download.driveFileId) {
      return { ok: false, error: "The downloaded file is missing locally and has no cloud backup." };
    }
    let url;
    if (localExists) {
      url = grant(download.filePath, download.id);
    } else {
      url = grantDrive(download.driveFileId, download.id);
    }
    const subtitles = (download.subtitlePaths || [])
      .filter((item) => item?.path && fs.existsSync(item.path))
      .map((item) => ({
        ...item,
        url: grant(item.path, download.id, path.extname(item.path).toLowerCase() === ".srt" ? "srt-vtt" : null),
      }));
    return {
      ok: true,
      url,
      subtitles,
      mediaType: download.mediaType,
      mediaId: download.tmdbId || download.mediaId,
      season: download.season || null,
      episode: download.episode || null,
      title: download.name,
      streamingMode: !localExists ? "drive" : "local",
    };
  });
  ipcMain.handle("local-media:repair", async (_, downloadId) => {
    const download = getDownloads().find((item) => item.id === downloadId);
    if (!download) return { ok: false, error: "The download record no longer exists." };
    const result = await dialog.showOpenDialog({
      title: `Locate ${download.name || "download"}`,
      properties: ["openFile"],
      filters: [{ name: "Video files", extensions: ["mp4", "m4v", "mkv", "webm", "mov"] }],
    });
    const selected = result.canceled ? null : result.filePaths[0];
    if (!selected || !fs.existsSync(selected)) return { ok: false, cancelled: true, error: "No replacement file was selected." };
    download.filePath = path.resolve(selected);
    download.updatedAt = Date.now();
    saveDownloads?.();
    return { ok: true };
  });
  ipcMain.handle("local-media:offload-file", async (_, downloadId) => {
    const download = getDownloads().find((item) => item.id === downloadId);
    if (download && download.filePath && fs.existsSync(download.filePath)) {
      try {
        fs.unlinkSync(download.filePath);
        download.filePath = null;
        download.updatedAt = Date.now();
        saveDownloads?.();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    return { ok: true };
  });
  ipcMain.handle("local-media:update-record", (_, downloadId, updates) => {
    const download = getDownloads().find((item) => item.id === downloadId);
    if (download) {
      Object.assign(download, updates);
      download.updatedAt = Date.now();
      saveDownloads?.();
      return { ok: true };
    }
    return { ok: false, error: "Download record not found." };
  });
}

function clear() { grants.clear(); }

module.exports = { clear, register, registerScheme, srtToVtt };
