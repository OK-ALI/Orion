const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Never resolve security cmdlets through inherited PowerShell 7/user module paths.
// Loading a 7.x module in Windows PowerShell 5.1 otherwise breaks verification.
function windowsVerificationOptions(extraEnv = {}) {
  const root = process.env.SystemRoot || process.env.WINDIR;
  if (!root || !path.win32.isAbsolute(root)) {
    throw new Error("Windows verification environment is unavailable.");
  }
  const directory = path.win32.join(root, "System32", "WindowsPowerShell", "v1.0");
  const env = Object.fromEntries(Object.entries(process.env).filter(
    ([key]) => !/^(PSModulePath|PSModuleAnalysisCachePath)$/i.test(key),
  ));
  return {
    executable: path.win32.join(directory, "powershell.exe"),
    options: {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      env: { ...env, ...extraEnv, PSModulePath: path.win32.join(directory, "Modules") },
    },
  };
}

function runWindowsVerification(command, env) {
  const { executable, options } = windowsVerificationOptions(env);
  return spawnSync(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference = 'Stop'; " + command,
  ], options);
}

module.exports = { runWindowsVerification, windowsVerificationOptions };
