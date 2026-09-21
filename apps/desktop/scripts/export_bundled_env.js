const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

app.setPath("userData", path.join(app.getPath("appData"), "orion"));

function cleanValue(value) {
  return String(value || "").trim();
}

function decryptStoredValue(store, key) {
  const encrypted = store?.[key];
  if (!encrypted) return "";
  const buffer = Buffer.from(encrypted, "base64");
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(buffer)
    : buffer.toString("utf8");
}

function readOptionalJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function readEnvFile(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};

  const result = {};
  for (const rawLine of fs.readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[name] = value;
  }
  return result;
}

function validateSingleLine(name, value, minimumLength = 1) {
  if (!value || value.length < minimumLength || /[\r\n]/.test(value)) {
    throw new Error(`${name} is missing or invalid`);
  }
}

app.whenReady().then(() => {
  const storePath = path.join(app.getPath("userData"), "secure-store.json");
  const outputPath = path.join(__dirname, "..", ".env");
  const releaseMode = process.argv.includes("--release");

  try {
    const store = readOptionalJson(storePath);
    const explicitReleaseSource = cleanValue(
      process.env.ORION_RELEASE_CONFIG_SOURCE_PATH,
    );
    const sourceEnv = readEnvFile(explicitReleaseSource);

    // Release precedence is explicit environment -> explicit ignored source .env
    // -> legacy encrypted local storage. This lets an isolated clean worktree
    // consume the release owner's existing ignored Desktop configuration without
    // copying unrelated/private provider credentials into the package.
    const token = cleanValue(
      process.env.VITE_TMDB_READ_TOKEN ||
        sourceEnv.VITE_TMDB_READ_TOKEN ||
        decryptStoredValue(store, "apikey"),
    );
    const googleClientId = cleanValue(
      process.env.ORION_GOOGLE_CLIENT_ID ||
        sourceEnv.ORION_GOOGLE_CLIENT_ID ||
        decryptStoredValue(store, "google_client_id"),
    );

    const wyzieApiKey = cleanValue(decryptStoredValue(store, "wyzieApiKey"));
    const subdlApiKey = cleanValue(decryptStoredValue(store, "subdlApiKey"));

    validateSingleLine("The Orion-managed TMDB token", token, 20);
    validateSingleLine("The managed Google OAuth client ID", googleClientId, 20);
    if (!googleClientId.endsWith(".apps.googleusercontent.com")) {
      throw new Error("The managed Google OAuth client ID has an unexpected format");
    }

    if (!releaseMode) {
      if (wyzieApiKey && (wyzieApiKey.length < 12 || /[\r\n]/.test(wyzieApiKey))) {
        throw new Error("The saved Wyzie API key is invalid");
      }
      if (subdlApiKey && (subdlApiKey.length < 8 || /[\r\n]/.test(subdlApiKey))) {
        throw new Error("The saved SubDL API key is invalid");
      }
    }

    const lines = [
      releaseMode
        ? "# Orion managed public-release configuration. Generated locally; never commit this file."
        : "# Orion local development configuration. Keep this file private.",
      `VITE_TMDB_READ_TOKEN=${token}`,
      `ORION_GOOGLE_CLIENT_ID=${googleClientId}`,
    ];

    // Release mode intentionally emits only public application configuration.
    // Never copy a Google client secret or private provider keys into a public
    // Desktop package even if the source .env contains them.
    if (!releaseMode && wyzieApiKey) {
      lines.push(`ORION_WYZIE_API_KEY=${wyzieApiKey}`);
    }
    if (!releaseMode && subdlApiKey) {
      lines.push(`ORION_SUBDL_API_KEY=${subdlApiKey}`);
    }

    lines.push("");
    fs.writeFileSync(outputPath, lines.join("\n"), {
      encoding: "utf8",
      mode: 0o600,
    });

    console.log(
      releaseMode
        ? "Created sanitized public release .env with Orion-managed TMDB and Google OAuth client configuration."
        : `Created private .env (TMDB: ${token.length} characters; Google OAuth client: configured; Wyzie: ${wyzieApiKey ? `${wyzieApiKey.length} characters` : "not found"}; SubDL: ${subdlApiKey ? `${subdlApiKey.length} characters` : "not found"}).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
