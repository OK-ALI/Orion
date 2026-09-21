const crypto = require("crypto");
const fs = require("fs");
const { runWindowsVerification } = require("./windowsVerification");

const ORION_WINDOWS_RELEASE_SIGNER_SHA256 =
  "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5";

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

function validateWindowsAuthenticodeResult(raw, now = new Date()) {
  let result;
  try {
    result = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Windows installer signature could not be read.");
  }
  const signerSha256 = normalizeSha256(result?.signerSha256);
  if (signerSha256 !== ORION_WINDOWS_RELEASE_SIGNER_SHA256) {
    throw new Error("Windows installer signing identity verification failed.");
  }
  const notBefore = new Date(result.notBefore);
  const notAfter = new Date(result.notAfter);
  if (!Number.isFinite(notBefore.getTime()) || !Number.isFinite(notAfter.getTime())
    || now < notBefore || now > notAfter) {
    throw new Error("Windows installer signing certificate is outside its approved validity period.");
  }
  const eku = Array.isArray(result.enhancedKeyUsage) ? result.enhancedKeyUsage : [];
  if (eku.length && !eku.includes("1.3.6.1.5.5.7.3.3")) {
    throw new Error("Windows installer certificate is not approved for code signing.");
  }
  if (result.status === "Valid") return signerSha256;
  // Orion's pinned certificate is deliberately self-signed. On a clean machine
  // Windows can report NotTrusted because that exact publisher is not installed
  // in the machine trust store. The Ed25519 release envelope has already bound
  // the exact installer bytes, hash, version, URL, and signer fingerprint before
  // this check runs. Accept only that specific trust-chain condition for the exact
  // pinned self-signed certificate. UnknownError, HashMismatch, NotSigned, and all
  // other statuses remain hard failures.
  if (result.status === "NotTrusted" && result.selfSigned === true) return signerSha256;
  throw new Error(`Authenticode validation failed: ${String(result.status || "Unknown")}`);
}

function verifyWindowsAuthenticodeSigner(filePath) {
  if (process.platform !== "win32") {
    throw new Error("Windows Authenticode verification is unavailable on this platform.");
  }

  const command = [
    "$target = $env:ORION_TARGET_EXE;",
    "if (-not $target -or -not (Test-Path -LiteralPath $target)) { Write-Error 'Target file not found'; exit 2 };",
    "$sig = Get-AuthenticodeSignature -LiteralPath $target;",
    "if (-not $sig.SignerCertificate) { Write-Error 'No Authenticode signer certificate'; exit 3 };",
    "$sha = [System.Security.Cryptography.SHA256]::Create();",
    "$bytes = $sha.ComputeHash($sig.SignerCertificate.RawData);",
    "$hash = ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant();",
    "$ekuExtension = $sig.SignerCertificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | Select-Object -First 1;",
    "$eku = @();",
    "if ($ekuExtension) { $parsedEku = New-Object System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension $ekuExtension, $ekuExtension.Critical; $eku = @($parsedEku.EnhancedKeyUsages | ForEach-Object { $_.Value }) };",
    "$record = [ordered]@{ status = $sig.Status.ToString(); signerSha256 = $hash; notBefore = $sig.SignerCertificate.NotBefore.ToUniversalTime().ToString('o'); notAfter = $sig.SignerCertificate.NotAfter.ToUniversalTime().ToString('o'); selfSigned = ($sig.SignerCertificate.Subject -eq $sig.SignerCertificate.Issuer); enhancedKeyUsage = $eku };",
    "$record | ConvertTo-Json -Compress;",
  ].join(" ");

  const result = runWindowsVerification(command, { ORION_TARGET_EXE: filePath });

  if (result.error) {
    throw new Error(`Unable to verify Windows installer signature: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new Error(detail || "Windows installer signature is not valid.");
  }

  const record = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  return validateWindowsAuthenticodeResult(record);
}

function verifyWindowsProductMetadata(filePath, expectedVersion) {
  if (process.platform !== "win32") {
    throw new Error("Windows product verification is unavailable on this platform.");
  }
  const command = [
    "$target = $env:ORION_TARGET_EXE;",
    "$expected = $env:ORION_TARGET_VERSION;",
    "$info = (Get-Item -LiteralPath $target).VersionInfo;",
    "$product = [string]$info.ProductName;",
    "$version = [string]$info.ProductVersion;",
    "if ($product -notmatch '^Orion(?:\\s|$)') { Write-Error 'Unexpected Windows product identity'; exit 5 };",
    "$normalized = ($version -replace '[^0-9.].*$', '').Trim('.');",
    "if ($normalized -ne $expected) { Write-Error 'Unexpected Windows product version'; exit 6 };",
  ].join(" ");
  const result = runWindowsVerification(command, {
    ORION_TARGET_EXE: filePath, ORION_TARGET_VERSION: expectedVersion,
  });
  if (result.error || result.status !== 0) {
    throw new Error("Windows installer product identity verification failed.");
  }
  return true;
}

async function verifyDownloadedUpdate(
  {
    filePath,
    expectedSize,
    expectedSha256,
    expectedSignerSha256,
    expectedVersion,
    format,
  },
  {
    signerVerifier = verifyWindowsAuthenticodeSigner,
    productVerifier = verifyWindowsProductMetadata,
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
    if (expectedSigner !== ORION_WINDOWS_RELEASE_SIGNER_SHA256) {
      throw new Error("Windows update signing identity does not match Orion.");
    }

    signerSha256 = normalizeSha256(
      await Promise.resolve(signerVerifier(filePath)),
    );

    if (!signerSha256 || signerSha256 !== expectedSigner) {
      throw new Error("Windows installer signing identity verification failed.");
    }
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(expectedVersion || ""))) {
      throw new Error("Verified Windows product version metadata is required before automatic installation.");
    }
    await Promise.resolve(productVerifier(filePath, expectedVersion));
  }

  return {
    ok: true,
    size: stat.size,
    sha256: actualDigest,
    signerSha256,
  };
}

module.exports = {
  ORION_WINDOWS_RELEASE_SIGNER_SHA256,
  normalizeSha256,
  sha256File,
  verifyDownloadedUpdate,
  verifyWindowsAuthenticodeSigner,
  verifyWindowsProductMetadata,
  validateWindowsAuthenticodeResult,
};
