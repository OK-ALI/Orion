const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const allowlistPath = path.join(__dirname, "source-size-allowlist.json");
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const extensions = new Set([".js", ".jsx", ".css", ".cjs"]);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (extensions.has(path.extname(entry.name))) files.push(absolute);
  }
}

walk(path.join(root, "src"));
for (const entry of ["index.js", "preload.js"]) files.push(path.join(root, entry));

const failures = [];
for (const absolute of files) {
  const relative = path.relative(root, absolute).replace(/\\/g, "/");
  const lines = fs.readFileSync(absolute, "utf8").split(/\r?\n/).length;
  const exception = allowlist[relative];
  if (lines > 800 && !exception) failures.push(`${relative}: ${lines} lines (hard limit 800)`);
  if (exception && lines > exception.maxLines) {
    failures.push(`${relative}: ${lines} lines exceeds temporary ceiling ${exception.maxLines}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Source-size check passed for ${files.length} files.`);
