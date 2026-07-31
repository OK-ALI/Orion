const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const excluded = new Set([".git", "dist", "node_modules", "release", "references"]);
const extensions = new Set([".js", ".jsx", ".cjs", ".json", ".md", ".yml", ".yaml"]);
const findings = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.startsWith(".env")) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (extensions.has(path.extname(entry.name))) inspect(absolute);
  }
}

function inspect(file) {
  const text = fs.readFileSync(file, "utf8");
  const rules = [
    /VITE_TMDB_READ_TOKEN\s*=\s*eyJ[A-Za-z0-9._-]{40,}/,
    /ORION_(?:WYZIE|SUBDL)_API_KEY\s*=\s*(?!\$\{)[A-Za-z0-9._-]{12,}/,
    /wyzie-[A-Za-z0-9_-]{20,}/,
  ];
  if (rules.some((rule) => rule.test(text))) {
    findings.push(path.relative(root, file).replace(/\\/g, "/"));
  }
}

walk(root);
if (findings.length) {
  console.error(`Potential credentials found in: ${findings.join(", ")}`);
  process.exit(1);
}
console.log("Secret scan passed.");
