const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, "tests", "fixtures", "ipc-contract.json"), "utf8"),
);
const preloadFiles = [path.join(root, "preload.js")];
const modularPreload = path.join(root, "src", "preload");

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(?:js|cjs)$/.test(entry.name)) preloadFiles.push(absolute);
  }
}
walk(modularPreload);

const source = preloadFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const api = [...source.matchAll(/^  ([A-Za-z0-9_]+):/gm)].map((match) => match[1]);
const channels = [
  ...new Set(
    [...source.matchAll(/ipcRenderer\.(?:invoke|send|on)\("([^"]+)"/g)].map(
      (match) => match[1],
    ),
  ),
].sort();

assert.deepEqual([...new Set(api)].sort(), [...fixture.preloadApi].sort(), "Preload API changed");
assert.deepEqual(channels, [...fixture.channels].sort(), "Preload IPC channels changed");
console.log(`IPC contract preserved: ${fixture.preloadApi.length} methods, ${channels.length} channels.`);
