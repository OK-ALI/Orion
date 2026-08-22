const crypto = require("crypto");
const fs = require("fs");
const { spawnSync } = require("child_process");

function normalizeSha256(value) {
  const normalized = String(value || "").replace(/:/g, "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : "";
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);

    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

function verifyWindowsAuthenticodeSigner(filePath) {
  if (process.platform !== "win32") {
    throw new Error("Windows Authenticode verification is unavailable on this platform.");
  }

  const command = [
    "& { param([string]$p)",
    "$sig = Get-AuthenticodeSignature -LiteralPath $p;",
    "if (-not $sig.SignerCertificate) { Write-Error 'No Authenticode signer certificate'; exit 3 };",
    "if ($sig.Status.ToString() -ne 'Valid') { Write-Error ('Authenticode status: ' + $sig.Status); exit 4 };",
    "$sha = [System.Security.Cryptography.SHA256]::Create();",
    "$bytes = $sha.ComputeHash($sig.SignerCertificate.RawData);",
    "$hash = ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant();",
    "Write-Output $hash;",
    "}",
  ].join(" ");

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command, filePath],
    {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
    },
  );

  if (result.error) {
    throw new Error(`Unable to verify Windows installer signature: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new Error(detail || "Windows installer signature is not valid.");
  }

  const digest = normalizeSha256(
    String(result.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1),
  );

  if (!digest) {
    throw new Error("Unable to read the Windows signer certificate fingerprint.");
  }

  return digest;
}

async function verifyDownloadedUpdate(
  {
    filePath,
    expectedSize,
    expectedSha256,
    expectedSignerSha256,
    format,
  },
  {
    signerVerifier = verifyWindowsAuthenticodeSigner,
  } = {},
) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Downloaded update artifact is missing.");
  }

  const size = Number(expectedSize);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Verified update size metadata is required before installation.");
  }

  const expectedDigest = normalizeSha256(expectedSha256);
  if (!expectedDigest) {
    throw new Error("Verified SHA-256 metadata is required before installation.");
  }

  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    throw new Error("Downloaded update artifact is not a file.");
  }

  if (stat.size !== size) {
    throw new Error(
      `Downloaded update size mismatch. Expected ${size} bytes, received ${stat.size}.`,
    );
  }

  const actualDigest = normalizeSha256(await sha256File(filePath));

  if (actualDigest !== expectedDigest) {
    throw new Error("Downloaded update SHA-256 verification failed.");
  }

  let signerSha256 = null;

  if (format === "exe") {
    const expectedSigner = normalizeSha256(expectedSignerSha256);

    if (!expectedSigner) {
      throw new Error(
        "Verified Windows signer metadata is required before automatic installation.",
      );
    }

    signerSha256 = normalizeSha256(
      await Promise.resolve(signerVerifier(filePath)),
    );

    if (!signerSha256 || signerSha256 !== expectedSigner) {
      throw new Error("Windows installer signing identity verification failed.");
    }
  }

  return {
    ok: true,
    size: stat.size,
    sha256: actualDigest,
    signerSha256,
  };
}

module.exports = {
  normalizeSha256,
  sha256File,
  verifyDownloadedUpdate,
  verifyWindowsAuthenticodeSigner,
};