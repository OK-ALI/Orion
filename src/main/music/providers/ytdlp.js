const { execFile } = require("child_process");
const tools = require("../../downloader/tools");

function run(binary, args, timeout = 25_000) {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message || "").split(/\r?\n/).find(Boolean);
        reject(new Error(detail || "yt-dlp could not resolve this track."));
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

async function binaryPath() {
  const status = await tools.getStatus();
  if (!status?.ytDlp?.ok || !status.ytDlp.path) {
    throw new Error("Music streaming tools are not installed. Install the Orion downloader tools, then retry.");
  }
  return status.ytDlp.path;
}

function safeCandidate(entry) {
  const id = String(entry?.id || "");
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  const thumbnail = entry.thumbnail || entry.thumbnails?.at(-1)?.url || null;
  return {
    id, providerId: "ytdlp-streaming", title: entry.title || "Unknown result",
    artistName: entry.channel || entry.uploader || "", durationMs: Number(entry.duration) > 0 ? Math.round(entry.duration * 1000) : null,
    thumbnail, artworkUrl: thumbnail,
  };
}

function createYtDlpStreamingProvider() {
  return {
    id: "ytdlp-streaming", kind: "streaming", name: "YouTube (yt-dlp)",
    capabilities: ["candidateSearch", "justInTimeResolution", "streamRefresh", "manualCandidates"],
    async searchForTrack(track) {
      const binary = await binaryPath();
      const query = [track.artistName, track.title, track.albumTitle].filter(Boolean).join(" - ");
      const output = await run(binary, [
        `ytsearch6:${query}`, "--dump-single-json", "--flat-playlist", "--skip-download", "--no-warnings",
      ]);
      const payload = JSON.parse(output);
      return (payload.entries || []).map(safeCandidate).filter(Boolean);
    },
    async resolveCandidate(candidate) {
      const binary = await binaryPath();
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(String(candidate.id || ""))) throw new Error("Invalid audio candidate.");
      const output = await run(binary, [
        `https://www.youtube.com/watch?v=${candidate.id}`, "--dump-single-json", "--skip-download",
        "--format", "bestaudio[ext=m4a]/bestaudio/best", "--no-playlist", "--no-warnings",
      ], 35_000);
      const payload = JSON.parse(output);
      const selected = payload.requested_downloads?.[0] || payload;
      if (!selected?.url || !/^https?:\/\//i.test(selected.url)) throw new Error("The selected audio candidate did not return a playable stream.");
      return {
        kind: "remote", url: selected.url,
        headers: selected.http_headers || payload.http_headers || {},
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      };
    },
  };
}

module.exports = { binaryPath, createYtDlpStreamingProvider, run, safeCandidate };
