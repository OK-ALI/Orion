"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOTS = ["app", "src"];
const HARD_LIMIT = 2200;
const TARGET_LIMIT = 800;
const OVERSIZED_ALLOWLIST = new Set([
  "app/(tabs)/connect.tsx",
  "app/(tabs)/discover.tsx",
  "app/media/[id].tsx",
]);

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}

for (const root of SOURCE_ROOTS) walk(path.join(ROOT, root));

let failed = false;
const warnings = [];
for (const file of files) {
  const relative = path.relative(ROOT, file).replaceAll("\\", "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
  if (lines > HARD_LIMIT) {
    console.error(`${relative}: ${lines} lines exceeds hard mobile ceiling ${HARD_LIMIT}`);
    failed = true;
  } else if (lines > TARGET_LIMIT && !OVERSIZED_ALLOWLIST.has(relative)) {
    console.error(`${relative}: ${lines} lines exceeds target ${TARGET_LIMIT} without an allowlist entry`);
    failed = true;
  } else if (lines > TARGET_LIMIT) {
    warnings.push(`${relative}: ${lines} lines remains on the temporary refactor allowlist`);
  }
}

for (const warning of warnings) console.warn(warning);
if (failed) process.exit(1);
console.log(`Mobile source-size check passed for ${files.length} files.`);
