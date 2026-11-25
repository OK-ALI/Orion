# Pinned source extractor

`yt-dlp-2026.08.19` is the unmodified official Python zipimport executable from
[yt-dlp's immutable 2026.08.19 release](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19).

SHA-256: `1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6`.
Verified against the release asset digest and official SHA2-256SUMS.

The pinned Android wrapper otherwise embeds yt-dlp 2025.11.12. Its Android VR
client returned sources that failed after the first MiB on the physical Samsung.
Upstream removed that client on August 18, 2026. This asset provides the supported
VisionOS client while retaining the existing wrapper/Python/native generation.
It is installed from the APK into that wrapper's app-private no-backup code path,
with SHA-256 verification before atomic replacement. No runtime network update,
media download, FFmpeg dependency, credentials or additional player is introduced.

yt-dlp itself is Unlicense; this zipimport artifact also contains ISC/MIT code.
The accompanying upstream license notices must be retained with the asset.
