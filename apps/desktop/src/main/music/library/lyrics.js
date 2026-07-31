const fs = require("fs");
const path = require("path");

async function readSidecarLyrics(filePath) {
  const base = filePath.slice(0, -path.extname(filePath).length);
  for (const extension of [".lrc", ".txt"]) {
    try {
      const text = await fs.promises.readFile(`${base}${extension}`, "utf8");
      if (text.trim()) return text.replace(/^\uFEFF/, "");
    } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  return null;
}

function parseLyrics(text) {
  const value = String(text || "");
  const lines = [];
  for (const line of value.split(/\r?\n/)) {
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    if (!matches.length) continue;
    const content = line.replace(/\[[^\]]+\]/g, "").trim();
    matches.forEach((match) => lines.push({ time: Number(match[1]) * 60 + Number(match[2]), text: content }));
  }
  return lines.length ? { type: "synced", lines: lines.sort((a, b) => a.time - b.time), source: "local" }
    : value.trim() ? { type: "plain", text: value.trim(), source: "local" } : null;
}

module.exports = { parseLyrics, readSidecarLyrics };
