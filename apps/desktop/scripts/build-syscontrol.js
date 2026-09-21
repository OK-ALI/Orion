const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const desktopRoot = path.resolve(__dirname, "..");
const binDir = path.join(desktopRoot, "bin");
const sourceFile = path.join(desktopRoot, "src", "main", "smartConnect", "SysControl.cs");
const targetExe = path.join(binDir, "orion-syscontrol.exe");

if (process.platform !== "win32") {
  console.log("[build-syscontrol] Non-Windows platform; skipping native syscontrol build.");
  process.exit(0);
}

const cscPaths = [
  "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
  "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe",
];

const csc = cscPaths.find((p) => fs.existsSync(p));
if (!csc) {
  console.error("[build-syscontrol] csc.exe not found on system.");
  process.exit(1);
}

function normalizeFingerprint(value) {
  return String(value || "").replace(/[:\s]/g, "");
}

function signReleaseHelperIfRequested() {
  if (process.env.ORION_WINDOWS_SIGN_SYSCONTROL !== "1") return;

  const thumbprint = normalizeFingerprint(process.env.ORION_WINDOWS_SIGN_CERT_SHA1).toUpperCase();
  const expectedSha256 = normalizeFingerprint(process.env.ORION_WINDOWS_SIGN_CERT_SHA256).toLowerCase();

  if (!/^[0-9A-F]{40}$/.test(thumbprint)) {
    console.error("[build-syscontrol] Approved Windows signing certificate SHA-1 was not supplied.");
    process.exit(1);
  }
  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
    console.error("[build-syscontrol] Approved Windows signing certificate SHA-256 was not supplied.");
    process.exit(1);
  }

  // Keep release-critical PowerShell out of an inline -Command string. A
  // temporary script avoids shell-quoting ambiguity around paths/fingerprints.
  const signScript = path.join(
    os.tmpdir(),
    `orion-sign-syscontrol-${process.pid}-${Date.now()}.ps1`,
  );

  const script = String.raw`param(
  [Parameter(Mandatory = $true)][string]$TargetPath,
  [Parameter(Mandatory = $true)][string]$Thumbprint,
  [Parameter(Mandatory = $true)][string]$ExpectedSha256
)

$ErrorActionPreference = "Stop"
$normalizedThumbprint = ($Thumbprint -replace "[:\s]", "").ToUpperInvariant()
$normalizedSha256 = ($ExpectedSha256 -replace "[:\s]", "").ToLowerInvariant()
$codeSigningOid = "1.3.6.1.5.5.7.3.3"

function Get-CertificateSha256($Certificate) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash($Certificate.RawData)
    return (([BitConverter]::ToString($bytes)) -replace "-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-CertificateEkuOids($Certificate) {
  $ekuExtension = $Certificate.Extensions |
    Where-Object { $_.Oid.Value -eq "2.5.29.37" } |
    Select-Object -First 1
  if (-not $ekuExtension) { return @() }

  $parsedEku = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($ekuExtension, $ekuExtension.Critical)
  return @($parsedEku.EnhancedKeyUsages | ForEach-Object { $_.Value })
}

if (-not (Test-Path -LiteralPath $TargetPath -PathType Leaf)) {
  throw "SysControl helper does not exist: $TargetPath"
}

$certificate = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Thumbprint.ToUpperInvariant() -eq $normalizedThumbprint } |
  Select-Object -First 1

if (-not $certificate) {
  throw "Approved Orion Windows signing certificate is missing from CurrentUser\\My."
}
if (-not $certificate.HasPrivateKey) {
  throw "Approved Orion Windows signing certificate has no private key."
}
if ($certificate.Subject -ne $certificate.Issuer) {
  throw "Configured Orion signing certificate is not the approved self-signed identity."
}
if ((Get-CertificateSha256 $certificate) -ne $normalizedSha256) {
  throw "Orion Windows signing certificate SHA-256 does not match the pinned identity."
}
if ((Get-Date) -lt $certificate.NotBefore -or (Get-Date) -gt $certificate.NotAfter) {
  throw "Orion Windows signing certificate is outside its validity period."
}
$eku = @(Get-CertificateEkuOids $certificate)
if ($eku.Count -gt 0 -and -not ($eku -contains $codeSigningOid)) {
  throw "Orion Windows signing certificate is not valid for code signing."
}

$signed = Set-AuthenticodeSignature -FilePath $TargetPath -Certificate $certificate -HashAlgorithm SHA256

if ($signed.Status -ne "Valid") {
  throw "Signing orion-syscontrol.exe did not produce a valid Authenticode signature: $($signed.Status)"
}

$verified = Get-AuthenticodeSignature -LiteralPath $TargetPath
if ($verified.Status -ne "Valid" -or -not $verified.SignerCertificate) {
  throw "Signed orion-syscontrol.exe failed immediate Authenticode verification."
}
if ((Get-CertificateSha256 $verified.SignerCertificate) -ne $normalizedSha256) {
  throw "Signed orion-syscontrol.exe has the wrong signer identity."
}

Write-Host "[build-syscontrol] Authenticode signature verified for orion-syscontrol.exe."
`;

  fs.writeFileSync(signScript, script, { encoding: "utf8", flag: "wx" });
  try {
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        signScript,
        "-TargetPath",
        targetExe,
        "-Thumbprint",
        thumbprint,
        "-ExpectedSha256",
        expectedSha256,
      ],
      { stdio: "inherit", windowsHide: true },
    );

    if (result.error) {
      console.error("[build-syscontrol] Unable to start Windows signing process:", result.error.message);
      process.exit(1);
    }
    if (result.status !== 0) {
      console.error("[build-syscontrol] SysControl signing failed with code", result.status);
      process.exit(result.status || 1);
    }
  } finally {
    try {
      fs.rmSync(signScript, { force: true });
    } catch {
      // The release verifier still fails closed if the helper is not signed.
    }
  }
}

fs.mkdirSync(binDir, { recursive: true });

console.log("[build-syscontrol] Compiling", sourceFile, "->", targetExe);
const result = spawnSync(csc, [
  "/r:System.Management.dll",
  "/nologo",
  `/out:${targetExe}`,
  sourceFile,
], {
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("[build-syscontrol] Compilation failed with code", result.status);
  process.exit(result.status || 1);
}

console.log("[build-syscontrol] Successfully built orion-syscontrol.exe");
signReleaseHelperIfRequested();
