const { app, ipcMain, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");
const { compareVersions, verifyReleaseEnvelope } = require("./releaseEnvelope");
const {
  normalizeSha256,
  verifyDownloadedUpdate,
} = require("./integrity");

const ALLOWED_FORMATS = new Set(["exe", "deb", "pacman", "dmg", "dmg_arm64", "appimage"]);
const ALLOWED_REDIRECT_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);
const OFFICIAL_RELEASE_PATH = "/ok-ali/orion/releases/download/";
const TRANSACTION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let activeUpdate = null;

function updateDirectory() {
  return path.join(app.getPath("userData"), "updates");
}

function transactionPath() {
  return path.join(updateDirectory(), "transaction-v2.json");
}

function readTransaction() {
  try {
    const value = JSON.parse(fs.readFileSync(transactionPath(), "utf8"));
    return value && value.schemaVersion === 2 ? value : null;
  } catch {
    return null;
  }
}

function writeTransaction(value) {
  fs.mkdirSync(updateDirectory(), { recursive: true });
  const target = transactionPath();
  const temporary = target + ".part";
  fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 2, ...value }), "utf8");
  fs.renameSync(temporary, target);
}

function removeFile(filePath) {
  if (!filePath) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch {}
}

function removeTransaction() {
  removeFile(transactionPath());
}

function updateFailure(message, kind = "network") {
  const error = new Error(message);
  error.updateFailure = kind;
  return error;
}

function reconcileTransaction() {
  const current = readTransaction();
  if (!current) return null;
  const now = Date.now();
  if (!Number.isFinite(current.updatedAt) || now - current.updatedAt > TRANSACTION_MAX_AGE_MS) {
    removeFile(current.partialPath);
    removeFile(current.filePath);
    removeFile(transactionPath());
    return null;
  }
  if (current.targetVersion && compareVersions(app.getVersion(), current.targetVersion) >= 0) {
    removeFile(current.partialPath);
    removeFile(current.filePath);
    const complete = {
      ...current,
      phase: "complete",
      currentVersion: app.getVersion(),
      updatedAt: now,
    };
    writeTransaction(complete);
    return complete;
  }
  if (current.phase === "installing") {
    const failed = {
      ...current,
      phase: "failed",
      message: "Orion couldn't finish the update. Try again.",
      updatedAt: now,
    };
    writeTransaction(failed);
    return failed;
  }
  return current;
}

function sendProgress(getMainWindow, payload) {
  const mainWindow = getMainWindow?.();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-progress", payload);
  }
}

function validateDownloadUrl(value, initial) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("Orion updates require a secure connection.");
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_REDIRECT_HOSTS.has(host)) throw new Error("The update source could not be verified.");
  const pathname = parsed.pathname.toLowerCase();
  const allowedPath = host === "github.com"
    ? pathname.startsWith(OFFICIAL_RELEASE_PATH)
    : pathname.startsWith("/github-production-release-asset/")
      || pathname.startsWith("/github-production-release-asset-")
      || pathname.startsWith("/github-production-repository-file/");
  if (!allowedPath || (initial && host !== "github.com")) {
    throw new Error("The update source could not be verified.");
  }
  return parsed;
}

function extensionFor(format) {
  if (format === "exe") return ".exe";
  if (format === "deb") return ".deb";
  if (format === "pacman") return ".pacman";
  if (format === "dmg" || format === "dmg_arm64") return ".dmg";
  return ".AppImage";
}

function safeTargetVersion(value) {
  const normalized = String(value || "").replace(/^v/i, "");
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)
    ? normalized
    : "next";
}

async function downloadUpdate({
  url,
  partialPath,
  expectedSize,
  signal,
  getMainWindow,
}) {
  let existing = 0;
  try {
    existing = fs.statSync(partialPath).size;
  } catch {}
  if (existing < 0 || existing >= expectedSize) {
    removeFile(partialPath);
    existing = 0;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const requestUrl = (requestValue, redirectDepth, resumeFrom) => {
      if (redirectDepth > 5) return finish(new Error("The update took an unexpected route."));
      let parsed;
      try {
        parsed = validateDownloadUrl(requestValue, redirectDepth === 0);
      } catch (error) {
        return finish(error);
      }
      const headers = {
        "User-Agent": "Orion-Updater",
        Accept: "application/octet-stream",
      };
      if (resumeFrom > 0) headers.Range = `bytes=${resumeFrom}-`;
      const request = https.get(parsed, { headers }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          let next;
          try {
            next = new URL(response.headers.location, parsed).toString();
          } catch {
            return finish(new Error("The update took an unexpected route."));
          }
          requestUrl(next, redirectDepth + 1, resumeFrom);
          return;
        }
        if (![200, 206].includes(response.statusCode)) {
          response.resume();
          return finish(updateFailure("Orion couldn't download the update. Try again."));
        }

        const append = resumeFrom > 0 && response.statusCode === 206;
        const downloadedBefore = append ? resumeFrom : 0;
        if (!append && resumeFrom > 0) removeFile(partialPath);
        const declared = Number(response.headers["content-length"] || 0);
        if (declared > 0 && downloadedBefore + declared > expectedSize) {
          response.destroy();
          return finish(updateFailure("We couldn't verify this update. Nothing was installed.", "verification"));
        }

        let downloaded = downloadedBefore;
        const output = fs.createWriteStream(partialPath, { flags: append ? "a" : "w" });
        const abort = () => {
          request.destroy();
          response.destroy();
          output.destroy();
          finish(updateFailure("Update cancelled.", "cancelled"));
        };
        signal.addEventListener("abort", abort, { once: true });
        response.on("data", (chunk) => {
          downloaded += chunk.length;
          if (downloaded > expectedSize) {
            request.destroy();
            response.destroy();
            output.destroy();
            finish(updateFailure("We couldn't verify this update. Nothing was installed.", "verification"));
            return;
          }
          if (!output.write(chunk)) {
            response.pause();
            output.once("drain", () => response.resume());
          }
          sendProgress(getMainWindow, {
            state: "downloading",
            percent: Math.min(100, Math.round((downloaded / expectedSize) * 100)),
            label: "Downloading…",
          });
        });
        response.on("end", () => output.end());
        response.on("error", (error) => finish(
          error?.updateFailure ? error : updateFailure("Orion couldn't finish the download. Try again."),
        ));
        output.on("error", (error) => finish(updateFailure(error?.message || "Orion couldn't finish the download. Try again.")));
        output.on("finish", () => {
          signal.removeEventListener("abort", abort);
          if (downloaded !== expectedSize) {
            finish(updateFailure("Orion couldn't finish the download. Try again."));
          } else {
            finish();
          }
        });
      });
      request.setTimeout(30_000, () => request.destroy(updateFailure("Orion couldn't finish the download. Try again.")));
      request.on("error", (error) => finish(
        error?.updateFailure ? error : updateFailure("Orion couldn't finish the download. Try again."),
      ));
      if (signal.aborted) request.destroy(updateFailure("Update cancelled.", "cancelled"));
    };
    requestUrl(url, 0, existing);
  });
}

function waitForSpawn(child) {
  return new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
}

async function launchInstaller(format, filePath) {
  if (format === "exe") {
    const child = spawn(filePath, [], { detached: true, stdio: "ignore" });
    await waitForSpawn(child);
    child.unref();
    return { exit: true };
  }
  if (format === "appimage") {
    fs.chmodSync(filePath, 0o755);
    const child = spawn(filePath, [], { detached: true, stdio: "ignore" });
    await waitForSpawn(child);
    child.unref();
    return { exit: true };
  }
  if (format === "dmg" || format === "dmg_arm64") {
    const child = spawn("hdiutil", ["attach", filePath], { detached: true, stdio: "ignore" });
    await waitForSpawn(child);
    child.unref();
    return { exit: false };
  }

  const launchers = format === "pacman"
    ? [
        { bin: "pkexec", args: ["pacman", "-U", "--noconfirm", filePath] },
        { bin: "pamac-installer", args: [filePath] },
      ]
    : [
        { bin: "pkexec", args: ["dpkg", "-i", filePath] },
        { bin: "pkexec", args: ["apt", "install", "-y", filePath] },
        { bin: "gdebi-gtk", args: [filePath] },
        { bin: "gdebi", args: ["-n", filePath] },
      ];
  for (const launcher of launchers) {
    const available = spawnSync("which", [launcher.bin], { encoding: "utf8" });
    if (available.status !== 0) continue;
    const child = spawn(launcher.bin, launcher.args, { detached: true, stdio: "ignore" });
    await waitForSpawn(child);
    child.unref();
    return { exit: true };
  }
  await shell.openPath(filePath);
  return { exit: false };
}

function register(getMainWindow, { writeSecretMigration } = {}) {
  reconcileTransaction();

  ipcMain.handle("detect-update-format", () => {
    if (process.platform === "win32") return "exe";
    if (process.platform === "darwin") return "dmg";
    if (process.platform === "linux") {
      if (process.env.APPIMAGE) return "appimage";
      return spawnSync("which", ["pacman"], { encoding: "utf8" }).status === 0 ? "pacman" : "deb";
    }
    return null;
  });

  ipcMain.handle("get-update-transaction", () => reconcileTransaction());

  ipcMain.handle("acknowledge-update-transaction", () => {
    const transaction = reconcileTransaction();
    if (transaction?.phase !== "complete") return { ok: false };
    removeTransaction();
    return { ok: true };
  });

  ipcMain.handle("download-and-install-update", async (_, input = {}) => {
    if (activeUpdate) return { ok: false, state: "failed", error: "An update is already in progress." };
    const format = String(input.format || "").toLowerCase();
    if (!ALLOWED_FORMATS.has(format)) return { ok: false, state: "failed", error: "This update isn't available for your device." };
    const expectedSize = Number(input.expectedSize);
    const expectedSha256 = normalizeSha256(input.expectedSha256);
    const expectedSignerSha256 = normalizeSha256(input.expectedSignerSha256);
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || !expectedSha256) {
      return { ok: false, state: "failed", error: "We couldn't verify this update. Nothing was installed." };
    }
    if (format === "exe" && !expectedSignerSha256) {
      return { ok: false, state: "failed", error: "We couldn't verify this update. Nothing was installed." };
    }
    if (format === "exe") {
      try {
        verifyReleaseEnvelope(input, app.getVersion());
      } catch {
        return { ok: false, state: "failed", error: "We couldn't verify this update. Nothing was installed." };
      }
    }

    const targetVersion = safeTargetVersion(input.targetVersion);
    if (targetVersion === "next" || compareVersions(targetVersion, app.getVersion()) <= 0) {
      return { ok: false, state: "failed", error: "This update isn't newer than the installed version." };
    }
    const baseName = `orion-update-${targetVersion}${extensionFor(format)}`;
    fs.mkdirSync(updateDirectory(), { recursive: true });
    const filePath = path.join(updateDirectory(), baseName);
    const partialPath = filePath + ".part";
    const controller = new AbortController();
    activeUpdate = { controller, partialPath };
    writeTransaction({
      phase: "downloading",
      targetVersion,
      assetName: String(input.assetName || baseName),
      filePath,
      partialPath,
      expectedSize,
      expectedSha256,
      expectedSignerSha256,
      sourceUrl: input.url,
      format,
      updatedAt: Date.now(),
    });

    try {
      await downloadUpdate({
        url: input.url,
        partialPath,
        expectedSize,
        signal: controller.signal,
        getMainWindow,
      });
      removeFile(filePath);
      fs.renameSync(partialPath, filePath);
      sendProgress(getMainWindow, { state: "verifying", percent: 100, label: "Verifying…" });
      await verifyDownloadedUpdate({
        filePath,
        expectedSize,
        expectedSha256,
        expectedSignerSha256,
        expectedVersion: targetVersion,
        format,
      });
      writeTransaction({
        ...readTransaction(),
        phase: "installing",
        updatedAt: Date.now(),
      });
      sendProgress(getMainWindow, { state: "installing", percent: 100, label: "Installing…" });
      const launched = await launchInstaller(format, filePath);
      if (typeof writeSecretMigration === "function") writeSecretMigration();
      if (launched.exit) {
        app.isQuiting = true;
        setImmediate(() => app.exit(0));
      }
      return { ok: true, state: "installing" };
    } catch (error) {
      const cancelled = controller.signal.aborted || error?.updateFailure === "cancelled";
      const retryable = !cancelled
        && error?.updateFailure === "network"
        && fs.existsSync(partialPath);
      if (!retryable) removeFile(partialPath);
      if (readTransaction()?.phase !== "installing") removeFile(filePath);
      const message = cancelled
        ? "Update cancelled."
        : error?.message || "Orion couldn't finish the update. Try again.";
      if (cancelled) {
        removeFile(filePath);
        removeTransaction();
      } else {
        writeTransaction({
          ...readTransaction(),
          phase: "failed",
          message,
          retryable,
          updatedAt: Date.now(),
        });
      }
      return { ok: false, state: "failed", error: message };
    } finally {
      activeUpdate = null;
    }
  });

  ipcMain.handle("cancel-update", () => {
    activeUpdate?.controller.abort();
    return { ok: true };
  });
}

module.exports = {
  compareVersions,
  readTransaction,
  reconcileTransaction,
  register,
  updateFailure,
  validateDownloadUrl,
};
