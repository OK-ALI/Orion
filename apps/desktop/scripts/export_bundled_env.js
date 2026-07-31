const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

app.setPath("userData", path.join(app.getPath("appData"), "orion"));

function decryptStoredValue(store, key) {
  const encrypted = store[key];
  if (!encrypted) return "";
  const buffer = Buffer.from(encrypted, "base64");
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(buffer)
    : buffer.toString("utf8");
}

app.whenReady().then(() => {
  const storePath = path.join(app.getPath("userData"), "secure-store.json");
  const outputPath = path.join(__dirname, "..", ".env");
  try {
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const token = decryptStoredValue(store, "apikey");
    const wyzieApiKey = decryptStoredValue(store, "wyzieApiKey");
    const subdlApiKey = decryptStoredValue(store, "subdlApiKey");
    if (!token || token.length < 20 || /[\r\n]/.test(token)) {
      throw new Error("The saved TMDB token is invalid");
    }
    if (wyzieApiKey && (wyzieApiKey.length < 12 || /[\r\n]/.test(wyzieApiKey))) {
      throw new Error("The saved Wyzie API key is invalid");
    }
    if (subdlApiKey && (subdlApiKey.length < 8 || /[\r\n]/.test(subdlApiKey))) {
      throw new Error("The saved SubDL API key is invalid");
    }
    const lines = [
      "# Orion local development configuration. Keep this file private.",
      `VITE_TMDB_READ_TOKEN=${token}`,
    ];
    if (wyzieApiKey) {
      // Deliberately not VITE_: private provider keys must stay out of renderer bundles.
      lines.push(`ORION_WYZIE_API_KEY=${wyzieApiKey}`);
    }
    if (subdlApiKey) {
      lines.push(`ORION_SUBDL_API_KEY=${subdlApiKey}`);
    }
    lines.push("");
    fs.writeFileSync(
      outputPath,
      lines.join("\n"),
      { encoding: "utf8", mode: 0o600 },
    );
    console.log(
      `Created private .env (TMDB: ${token.length} characters; Wyzie: ${wyzieApiKey ? `${wyzieApiKey.length} characters` : "not found"}; SubDL: ${subdlApiKey ? `${subdlApiKey.length} characters` : "not found"}).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
