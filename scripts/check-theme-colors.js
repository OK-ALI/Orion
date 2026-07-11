const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve("src/renderer");
const TOKEN_FILES = new Set([
  path.resolve("src/renderer/styles/tokens.css"),
  path.resolve("src/renderer/shared/utils/appearance.js"),
]);
const STRICT_SURFACES = [
  path.resolve("src/renderer/styles/mini-player.css"),
  path.resolve("src/renderer/components/KeyboardShortcutsModal.jsx"),
  path.resolve("src/renderer/features/settings/groups/SystemIntegrationSettingsGroup.jsx"),
];
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(/gi;
const BASELINE_MAX = 786;
const MUSIC_ROOTS = [
  path.resolve("src/renderer/features/music"),
  path.resolve("src/renderer/styles/features/music"),
];
const FORBIDDEN_MUSIC_CYAN = /music-cyan|#(?:22d3ee|00dcff|00fa9a|2dd4bf|67e8f9)\b/i;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:css|js|jsx)$/.test(entry.name) ? [target] : [];
  });
}

let literalCount = 0;
for (const file of sourceFiles(ROOT)) {
  if (TOKEN_FILES.has(file)) continue;
  literalCount += fs.readFileSync(file, "utf8").match(COLOR_LITERAL)?.length || 0;
}

const strictFailures = STRICT_SURFACES.filter((file) => (
  new RegExp(COLOR_LITERAL.source, "i").test(fs.readFileSync(file, "utf8"))
));
const musicCyanFailures = MUSIC_ROOTS.flatMap(sourceFiles).filter((file) => FORBIDDEN_MUSIC_CYAN.test(fs.readFileSync(file, "utf8")));
if (strictFailures.length || musicCyanFailures.length || literalCount > BASELINE_MAX) {
  if (strictFailures.length) {
    console.error("Theme-sensitive literals found in token-only surfaces:");
    strictFailures.forEach((file) => console.error(`- ${path.relative(process.cwd(), file)}`));
  }
  if (musicCyanFailures.length) {
    console.error("Neutral Eclipse cyan values found in Music surfaces:");
    musicCyanFailures.forEach((file) => console.error(`- ${path.relative(process.cwd(), file)}`));
  }
  if (literalCount > BASELINE_MAX) {
    console.error(`Renderer color literals increased from the v1.0.10 baseline (${literalCount} > ${BASELINE_MAX}).`);
  }
  process.exit(1);
}

console.log(`Theme color check passed (${literalCount}/${BASELINE_MAX} legacy literals; strict surfaces use tokens).`);
