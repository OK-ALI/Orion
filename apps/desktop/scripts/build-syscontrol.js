const { spawnSync } = require("child_process");
const fs = require("fs");
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
