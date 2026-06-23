# Orion Downloading Diagnostics

Last updated: 2026-06-23

## What The Logs Show

Recent failed downloads wrote logs to `%TEMP%\orion_dl_*.log`.

Observed failures:

- `Toy Story (1995)` failed on `https://joe.goldweather.net/.../index.m3u8`
- `Toy Story 5 (2026)` failed on `https://files.anotherweather.com/video.m3u8?...`

Both failures reached `yt-dlp`, so the downloader tools are installed and spawn correctly. The actual failure is upstream HTTP 403:

```text
ERROR: [generic] Unable to download webpage: HTTP Error 403: Forbidden
ERROR: [generic] Got HTTP Error 403 caused by Cloudflare anti-bot challenge
```

## Cause

Orion was passing only the captured m3u8 URL to direct `yt-dlp`. Some streaming CDNs require the same browser request context that the Electron player used, such as:

- User-Agent
- Referer
- Origin
- Accept / language headers
- session cookies
- browser/TLS impersonation

Without that context, `yt-dlp` gets blocked even though the same stream plays inside Orion.

## Implemented Fixes

First, Orion captured HLS request context from the `persist:player` Electron session and passed it into direct `yt-dlp`.

That still failed on some hosts with HTTP 403, so Orion now uses a stronger fallback path:

- Capture request headers when the player requests `.m3u8` / `.vtt`.
- Send `{ url, requestHeaders, referrer, resourceType }` to the renderer instead of only the URL.
- Pass the captured context into `run-download`.
- Start a temporary local HLS proxy on `127.0.0.1` for the active download.
- Fetch protected upstream playlists and segments through Electron's `persist:player` session.
- Rewrite playlist segment URLs to the local proxy.
- Point `yt-dlp` at the local proxy URL instead of the protected CDN URL.
- Start `yt-dlp` with `--impersonate chrome` and replay useful headers through `--add-headers`.
- Keep app-managed `yt-dlp + ffmpeg`.

## Streambert Comparison

Streambert does not use plain direct `yt-dlp` for normal movie/TV downloads. It delegates to `vid-dl-cli-only` through a helper-folder/token flow:

```text
helper binary --cli <m3u8> -f "mp4 (with Audio)" -r best -b 320 -n <name> -d <downloadPath>
```

That helper may contain extra handling that plain `yt-dlp` does not provide.

## Next Test

After rebuilding/running Orion:

1. Open a movie or episode.
2. Start playback and wait until the download modal shows `Stream URL found`.
3. Start download.
4. If it fails, open the newest `%TEMP%\orion_dl_*.log`.

The new log should include:

```text
Using local HLS proxy: http://127.0.0.1:<port>/master.m3u8
```

If logs still show HTTP 403 after local proxying, the next options are:

- Bundle or app-manage a Streambert-style helper downloader.
- Prefer sources/CDNs whose m3u8 URLs are less protected for downloads.
