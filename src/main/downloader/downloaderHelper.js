// ── Downloader & Installer Helper Module ──────────────────────────────────────
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawn, execFile } = require("child_process");

/**
 * Downloads a file, follows redirects, tracks download progress,
 * and ensures partial files are deleted on failure.
 */
function downloadFile(url, destPath, label, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    // Ensure parent directories exist
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Clean up destination if it already exists
    if (fs.existsSync(destPath)) {
      try {
        fs.unlinkSync(destPath);
      } catch {}
    }

    let file = null;
    let currentRequest = null;
    let aborted = false;

    const cleanupAndReject = (err) => {
      aborted = true;
      if (currentRequest) {
        try {
          currentRequest.destroy();
        } catch {}
      }
      if (file) {
        try {
          file.close(() => {
            try {
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            } catch {}
          });
        } catch {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          } catch {}
        }
      }
      reject(err);
    };

    const get = (nextUrl, redirects = 0) => {
      if (aborted) return;
      if (redirects > 5) {
        cleanupAndReject(new Error(`${label} download failed: too many redirects`));
        return;
      }

      const lib = nextUrl.startsWith("https:") ? https : http;
      
      const req = lib.get(
        nextUrl,
        { headers: { "User-Agent": "Orion Downloader Setup" } },
        (res) => {
          if (aborted) return;

          // Handle redirects
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirected = new URL(res.headers.location, nextUrl).toString();
            res.resume();
            get(redirected, redirects + 1);
            return;
          }

          if (res.statusCode !== 200) {
            res.resume();
            cleanupAndReject(new Error(`${label} download failed: HTTP ${res.statusCode}`));
            return;
          }

          const totalBytes = parseInt(res.headers["content-length"], 10) || 0;
          let downloadedBytes = 0;

          file = fs.createWriteStream(destPath);
          file.on("error", (err) => cleanupAndReject(err));

          res.on("data", (chunk) => {
            if (aborted) return;
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              onProgress(progress);
            }
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close((err) => {
              if (err) {
                cleanupAndReject(err);
              } else {
                resolve();
              }
            });
          });
        }
      );

      currentRequest = req;

      req.on("error", (err) => {
        cleanupAndReject(err);
      });

      req.setTimeout(180000, () => {
        cleanupAndReject(new Error(`${label} download timed out`));
      });
    };

    get(url);
  });
}

/**
 * Runs PowerShell to extract the ffmpeg essentials archive.
 */
function extractFfmpeg(ffZip, toolDir) {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -LiteralPath '${ffZip.replace(/'/g, "''")}' -DestinationPath '${toolDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
    );

    let stderr = "";
    ps.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    ps.on("error", (err) => {
      reject(new Error(`PowerShell process error: ${err.message}`));
    });

    ps.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`PowerShell extraction failed with code ${code}. Error: ${stderr}`));
      }
    });
  });
}

/**
 * Helper to check execution status and version of binary candidates.
 */
function runBinary(candidate, args = [], timeout = 8000) {
  return new Promise((resolve) => {
    const child = execFile(candidate, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: error.message });
        return;
      }
      const firstLine = String(stdout || stderr || "").split(/\r?\n/).find(Boolean) || "Available";
      resolve({
        ok: true,
        path: candidate,
        version: firstLine.slice(0, 120),
      });
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * Searches candidates and verifies they execute properly.
 */
async function findWorkingBinary(candidates, args) {
  for (const candidate of candidates.filter(Boolean)) {
    const res = await runBinary(candidate, args);
    if (res.ok) {
      return res;
    }
  }
  return { ok: false, error: "Not found" };
}

module.exports = {
  downloadFile,
  extractFfmpeg,
  findWorkingBinary,
};
