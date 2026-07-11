const { app, ipcMain, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { secureStoreGet, secureStoreSet } = require("./storageIpc");

// Scopes: profile, email, openid, hidden appData folder for syncing, and drive.file for media locker
const SCOPES = ["openid", "profile", "email", "https://www.googleapis.com/auth/drive.appdata", "https://www.googleapis.com/auth/drive.file"];


function getAuthResponsePage(isSuccess, title, message, detailText) {
  const iconColor = isSuccess ? "#48c774" : "#f14668";
  const titleClass = isSuccess ? "title-success" : "title-error";
  const iconSvg = isSuccess 
    ? `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} - Orion</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', -apple-system, sans-serif;
        background: #06060c;
        color: #ffffff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
      }
      
      .card {
        position: relative;
        z-index: 10;
        max-width: 480px;
        width: 90%;
        background: rgba(18, 18, 28, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 48px 40px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.15);
        text-align: center;
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      .brand {
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 3px;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        margin-bottom: 32px;
      }
      
      .icon-wrap {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: rgba(${isSuccess ? "72, 199, 116" : "241, 70, 104"}, 0.1);
        border: 1px solid rgba(${isSuccess ? "72, 199, 116" : "241, 70, 104"}, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 28px;
        color: ${iconColor};
        box-shadow: 0 0 24px rgba(${isSuccess ? "72, 199, 116" : "241, 70, 104"}, 0.15);
      }
      
      .status-icon {
        width: 32px;
        height: 32px;
      }
      
      h1 {
        font-family: 'Outfit', sans-serif;
        font-size: 26px;
        font-weight: 800;
        margin: 0 0 16px;
        letter-spacing: -0.5px;
      }
      
      .title-success {
        background: linear-gradient(135deg, #48c774 0%, #10b981 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .title-error {
        background: linear-gradient(135deg, #f14668 0%, #ef4444 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      p {
        font-size: 15px;
        line-height: 1.6;
        color: #b5b5c9;
        margin: 0 0 16px;
      }
      
      .detail {
        font-size: 13px;
        color: #8a8a9e;
        margin-bottom: 24px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 8px 12px;
        word-break: break-all;
      }
      
      .hint {
        font-size: 12px;
        color: #5b5b7b;
        margin-top: 32px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">Orion X Music Planet</div>
      <div class="icon-wrap">
        ${iconSvg}
      </div>
      <h1 class="${titleClass}">${title}</h1>
      <p>${message}</p>
      ${detailText ? `<div class="detail">${detailText}</div>` : ''}
      <div class="hint">
        ${isSuccess ? "You can safely close this browser tab." : "Please return to Orion and try again."}
      </div>
    </div>
  </body>
</html>
  `;
}

let activeAuthServer = null;
let activeAuthResolve = null;

function getEnvValue(name) {
  if (process.env[name]) return process.env[name].trim();
  try {
    const envPath = path.join(app.getAppPath(), ".env");
    if (fs.existsSync(envPath)) {
      const envText = fs.readFileSync(envPath, "utf8");
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = envText.match(new RegExp(`^${escapedName}\\s*=\\s*(.+)$`, "m"));
      if (match) {
        return String(match[1]).trim().replace(/^(["'])(.*)\1$/, "$2");
      }
    }
  } catch {}
  return "";
}

function getGoogleConfig() {
  // Orion ships one Desktop OAuth client. A desktop application is a public
  // client, so authorization uses PKCE rather than treating a bundled secret
  // as proof of the application's identity.
  const storedId = secureStoreGet("google_client_id");
  const storedSecret = secureStoreGet("google_client_secret");
  const bundledId = getEnvValue("ORION_GOOGLE_CLIENT_ID");
  const bundledSecret = getEnvValue("ORION_GOOGLE_CLIENT_SECRET");
  const clientId = bundledId || storedId;
  const clientSecret = bundledSecret || storedSecret || "";

  return {
    clientId,
    clientSecret,
    usesPkce: true,
    source: bundledId ? "env" : (storedId ? "legacy-user" : "missing"),
  };
}

function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function createOauthState() {
  return crypto.randomBytes(24).toString("base64url");
}

async function fetchUserProfile(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google API returned status ${res.status} while fetching profile.`);
  }
  return await res.json();
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  // Retain compatibility with tokens created by older configurable clients.
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  secureStoreSet("google_access_token", data.access_token);
  return data.access_token;
}

async function googleDriveRequest(url, options = {}) {
  let accessToken = secureStoreGet("google_access_token");
  if (!accessToken) {
    throw new Error("Not signed in to Google.");
  }

  const reqOptions = {
    ...options,
    headers: { ...(options.headers || {}), "Authorization": `Bearer ${accessToken}` }
  };

  let res = await fetch(url, reqOptions);
  
  if (res.status === 401) {
    const { clientId, clientSecret } = getGoogleConfig();
    const refreshToken = secureStoreGet("google_refresh_token");
    if (clientId && refreshToken) {
      try {
        const newAccessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
        reqOptions.headers["Authorization"] = `Bearer ${newAccessToken}`;
        res = await fetch(url, reqOptions);
      } catch (err) {
        ["google_access_token", "google_refresh_token", "google_profile"].forEach(k => secureStoreSet(k, null));
        throw new Error("Google connection expired. Please sign in again.");
      }
    } else {
      throw new Error("Google access expired and cannot be auto-refreshed.");
    }
  }

  return res;
}

async function findSyncFileId() {
  const query = encodeURIComponent("name = 'orion-sync-manifest.json' and 'appDataFolder' in parents");
  const res = await googleDriveRequest(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to check sync file on Google Drive: ${res.status} - ${errText}`);
  }
  const searchResult = await res.json();
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }
  return null;
}

const MIME_TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
};

async function findOrCreateLockerFolderId() {
  const query = encodeURIComponent("name = 'Orion Media Locker' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const res = await googleDriveRequest(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to query locker folder: ${res.status} - ${errText}`);
  }
  const searchResult = await res.json();
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }

  // Create locker folder
  const createRes = await googleDriveRequest("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Orion Media Locker",
      mimeType: "application/vnd.google-apps.folder"
    })
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Orion Media Locker folder: ${createRes.status} - ${errText}`);
  }
  const folder = await createRes.json();
  return folder.id;
}

async function getOrCreateFolderId(name, parentId) {
  const query = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const res = await googleDriveRequest(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to query folder '${name}': ${res.status} - ${errText}`);
  }
  const searchResult = await res.json();
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }

  // Create folder
  const createRes = await googleDriveRequest("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    })
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create folder '${name}': ${createRes.status} - ${errText}`);
  }
  const folder = await createRes.json();
  return folder.id;
}

async function getOrCreatePathFolderId(lockerFolderId, metadata) {
  if (!metadata || !metadata.mediaType) {
    return lockerFolderId;
  }

  if (metadata.mediaType === "tv") {
    // 1. Series folder
    const seriesFolderId = await getOrCreateFolderId("Series", lockerFolderId);
    
    // 2. Show folder (e.g. "Super Dragon Ball Heroes (2018)")
    const showName = (metadata.name || "Unknown Series").replace(/\s+S\d+\s*E\d+.*$/i, "");
    const showFolderId = await getOrCreateFolderId(showName, seriesFolderId);
    
    // 3. Season folder (e.g. "Season 01")
    const seasonNum = String(metadata.season || 1).padStart(2, "0");
    const seasonFolderName = `Season ${seasonNum}`;
    const seasonFolderId = await getOrCreateFolderId(seasonFolderName, showFolderId);
    
    return seasonFolderId;
  } else if (metadata.mediaType === "movie") {
    // 1. Movies folder
    const moviesFolderId = await getOrCreateFolderId("Movies", lockerFolderId);
    
    // 2. Movie folder
    const movieName = metadata.name || "Unknown Movie";
    const movieFolderId = await getOrCreateFolderId(movieName, moviesFolderId);
    
    return movieFolderId;
  }

  return lockerFolderId;
}

function register() {
  ipcMain.handle("google-auth:get-client-config", () => {
    const config = getGoogleConfig();
    return {
      clientId: config.clientId ? config.clientId.slice(0, 12) + "••••••••" : "",
      hasClientSecret: false,
      usesPkce: true,
      source: config.source,
    };
  });

  ipcMain.handle("google-auth:set-client-config", (_, { clientId, clientSecret }) => {
    try {
      secureStoreSet("google_client_id", clientId || null);
      // Compatibility-only: the bundled Desktop client authenticates with PKCE.
      if (clientSecret === null) secureStoreSet("google_client_secret", null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:get-profile", async () => {
    try {
      const profileStr = secureStoreGet("google_profile");
      if (!profileStr) return { ok: true, profile: null };

      const profile = JSON.parse(profileStr);
      
      let accessToken = secureStoreGet("google_access_token");
      if (!accessToken) return { ok: true, profile: null };

      return { ok: true, profile };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:logout", () => {
    try {
      secureStoreSet("google_access_token", null);
      secureStoreSet("google_refresh_token", null);
      secureStoreSet("google_profile", null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:cancel-login", () => {
    if (activeAuthServer) {
      try {
        activeAuthServer.close();
      } catch {}
      activeAuthServer = null;
    }
    if (activeAuthResolve) {
      activeAuthResolve({ ok: false, error: "Authentication cancelled." });
      activeAuthResolve = null;
    }
    return { ok: true };
  });

  ipcMain.handle("google-auth:upload-sync", async (_, data) => {
    try {
      const fileId = await findSyncFileId();
      
      if (fileId) {
        const updateRes = await googleDriveRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });
        if (!updateRes.ok) {
          const errText = await updateRes.text();
          throw new Error(`Failed to update cloud sync file: ${updateRes.status} - ${errText}`);
        }
        return { ok: true };
      } else {
        const boundary = "orion_sync_boundary";
        const metadata = {
          name: "orion-sync-manifest.json",
          parents: ["appDataFolder"]
        };
        const body = [
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n`,
          `--${boundary}--`
        ].join("");

        const createRes = await googleDriveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body
        });
        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`Failed to create cloud sync file: ${createRes.status} - ${errText}`);
        }
        return { ok: true };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:download-sync", async () => {
    try {
      const fileId = await findSyncFileId();
      if (!fileId) {
        return { ok: true, data: null };
      }
      
      const contentRes = await googleDriveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      if (!contentRes.ok) {
        const errText = await contentRes.text();
        throw new Error(`Failed to download cloud sync file content: ${contentRes.status} - ${errText}`);
      }
      const data = await contentRes.json();

      const metaRes = await googleDriveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`);
      if (!metaRes.ok) {
        const errText = await metaRes.text();
        throw new Error(`Failed to download cloud sync file metadata: ${metaRes.status} - ${errText}`);
      }
      const metadata = await metaRes.json();

      return { ok: true, data, modifiedTime: metadata.modifiedTime };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:get-storage-quota", async () => {
    try {
      const res = await googleDriveRequest("https://www.googleapis.com/drive/v3/about?fields=storageQuota");
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to fetch storage quota: ${res.status} - ${errText}`);
      }
      const data = await res.json();
      return { ok: true, quota: data.storageQuota };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:upload-media-file", async (_, { filePath, name, metadata }) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Local file not found: ${filePath}`);
      }
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || "video/mp4";

      const lockerFolderId = await findOrCreateLockerFolderId();
      const folderId = await getOrCreatePathFolderId(lockerFolderId, metadata);

      // Initiate Resumable Upload
      const initiateRes = await googleDriveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(fileSize)
        },
        body: JSON.stringify({
          name: name || path.basename(filePath),
          parents: [folderId]
        })
      });

      if (!initiateRes.ok) {
        const errText = await initiateRes.text();
        throw new Error(`Failed to initiate resumable upload session: ${initiateRes.status} - ${errText}`);
      }

      const sessionUrl = initiateRes.headers.get("Location");
      if (!sessionUrl) {
        throw new Error("Resumable upload session location header is missing.");
      }

      // Stream upload content
      const fileStream = fs.createReadStream(filePath);
      const uploadRes = await googleDriveRequest(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
          "Content-Length": String(fileSize)
        },
        body: fileStream,
        duplex: "half"
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload write failed: ${uploadRes.status} - ${errText}`);
      }

      const fileData = await uploadRes.json();
      return { ok: true, fileId: fileData.id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:delete-media-file", async (_, fileId) => {
    try {
      const res = await googleDriveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE"
      });
      if (!res.ok && res.status !== 404) {
        const errText = await res.text();
        throw new Error(`Failed to delete media from Drive: ${res.status} - ${errText}`);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("google-auth:login", async () => {
    if (activeAuthServer) {
      try {
        activeAuthServer.close();
      } catch {}
      activeAuthServer = null;
    }
    if (activeAuthResolve) {
      activeAuthResolve({ ok: false, error: "Authentication restarted." });
      activeAuthResolve = null;
    }

    const { clientId, clientSecret } = getGoogleConfig();
    if (!clientId) {
      return { ok: false, error: "Google sign-in is unavailable in this build. Please contact Orion support." };
    }
    const { verifier, challenge } = createPkcePair();
    const expectedState = createOauthState();

    return new Promise((resolve) => {
      let serverClosed = false;
      activeAuthResolve = resolve;

      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");
        if (url.pathname === "/favicon.ico") {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        const returnedState = url.searchParams.get("state");

        if (code && returnedState === expectedState) {
          clearTimeout(timeoutId);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(getAuthResponsePage(
            true, 
            "Authentication Successful!", 
            "Orion has successfully connected to your Google account.",
            "You can close this tab and return to the Orion application."
          ));
          
          if (!serverClosed) {
            serverClosed = true;
            server.close();
          }
          if (activeAuthServer === server) activeAuthServer = null;

          try {
            const body = new URLSearchParams({
              code,
              client_id: clientId,
              redirect_uri: `http://127.0.0.1:${port}`,
              grant_type: "authorization_code",
              code_verifier: verifier,
            });
            // Orion's current centrally managed OAuth client is a confidential
            // client and requires its bundled secret. Desktop clients can omit
            // it; both flows retain PKCE and state verification.
            if (clientSecret) body.set("client_secret", clientSecret);

            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body.toString(),
            });

            if (!tokenRes.ok) {
              const tokenErr = await tokenRes.text();
              throw new Error(`Token request failed: ${tokenRes.status} - ${tokenErr}`);
            }

            const tokenData = await tokenRes.json();
            
            secureStoreSet("google_access_token", tokenData.access_token);
            if (tokenData.refresh_token) {
              secureStoreSet("google_refresh_token", tokenData.refresh_token);
            }
            if (clientId) {
              secureStoreSet("google_client_id", clientId);
            }
            const profile = await fetchUserProfile(tokenData.access_token);
            secureStoreSet("google_profile", JSON.stringify(profile));

            if (activeAuthResolve === resolve) {
              resolve({ ok: true, profile });
              activeAuthResolve = null;
            }
          } catch (e) {
            if (activeAuthResolve === resolve) {
              resolve({ ok: false, error: e.message });
              activeAuthResolve = null;
            }
          }
        } else {
          clearTimeout(timeoutId);
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(getAuthResponsePage(
            false,
            "Authentication Failed",
            "Orion could not connect to your Google account.",
            err || (code ? "The sign-in response could not be verified. Please try again." : "No authorization code received")
          ));
          
          if (!serverClosed) {
            serverClosed = true;
            server.close();
          }
          if (activeAuthServer === server) activeAuthServer = null;
          if (activeAuthResolve === resolve) {
            resolve({ ok: false, error: err || "No authorization code received" });
            activeAuthResolve = null;
          }
        }
      });

      activeAuthServer = server;

      const timeoutId = setTimeout(() => {
        if (!serverClosed) {
          serverClosed = true;
          try {
            server.close();
          } catch {}
          if (activeAuthServer === server) activeAuthServer = null;
          if (activeAuthResolve === resolve) {
            resolve({ ok: false, error: "Authentication timed out. Please try again." });
            activeAuthResolve = null;
          }
        }
      }, 180000);

      let port = 0;
      server.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}`;
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent(SCOPES.join(" "))}&` +
          `access_type=offline&` +
          `prompt=consent&` +
          `state=${encodeURIComponent(expectedState)}&` +
          `code_challenge=${encodeURIComponent(challenge)}&` +
          `code_challenge_method=S256`;

        shell.openExternal(authUrl);
      });

      server.on("error", (e) => {
        clearTimeout(timeoutId);
        if (activeAuthServer === server) activeAuthServer = null;
        if (activeAuthResolve === resolve) {
          resolve({ ok: false, error: `Failed to spin up local loopback server: ${e.message}` });
          activeAuthResolve = null;
        }
      });
    });
  });
}

module.exports = {
  register,
  getGoogleConfig,
  refreshAccessToken,
  googleDriveRequest,
};
