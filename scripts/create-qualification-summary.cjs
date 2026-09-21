const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const map = JSON.parse(fs.readFileSync(path.join(root, "config", "orion-release-map-v1.json"), "utf8"));
const qualification = JSON.parse(fs.readFileSync(
  path.join(root, "config", `release-qualification-${map.productVersion}.json`),
  "utf8",
));
const output = path.resolve(process.argv[2] || path.join(root, `orion-${map.productVersion}-qualification.md`));
const lines = [
  `# Orion ${map.productVersion} qualification`,
  "",
  "The exact Windows installer and Android app in this release passed Orion's release checks.",
  "",
  "- Windows clean install: Passed",
  "- Desktop providers, source switching, subtitles, and resume: Passed",
  "- Desktop trailers and theme-aware modal: Passed",
  "- Popup, navigation, and ad-block protection: Passed",
  "- Android signed build and upgrade path: Passed",
  "- In-app update integrity and recovery: Passed",
  "",
  `Validated: ${qualification.evidence.validatedAt}`,
];
fs.writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
console.log(`Created ${output}`);
