# Downloader architecture

`src/main/downloader` separates capture, preflight, browser request context, the scoped HLS proxy, managed tools, output paths, persistence, subtitle assets, and process tracking.

The renderer receives an opaque candidate identifier and redacted metadata. Preflight rejects expired, unreachable, invalid, and DRM-protected manifests. Ordinary AES-128 HLS remains supported.

The managed strategy order is direct `yt-dlp` with captured browser context, Electron-session proxy fallback, then a narrowly compatible provider profile. The loopback proxy uses a per-job secret and only permits the captured URL and descendants discovered in its playlists.

Capture is scoped by `CaptureSession` rather than a global candidate list. Sessions bind title, episode, source, and player contents; summaries expose only opaque IDs and redacted metadata. HLS, DASH, direct video, and MIME-based extensionless responses are classified, while browser-only and DRM playback remain unsupported.

The v1.0.7/v1.0.8 download arrays remain readable. Records normalize to Download Record v3 with additive byte, ETA, retry, and update metrics. Active records recovered after restart become paused/interrupted records and can resume with their existing partial files.
