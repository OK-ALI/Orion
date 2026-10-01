# Orion Mobile v3.2.1 provider matrix

This matrix records the current Mobile source contracts and qualification evidence. Descriptor download admission permits a manual, preflighted attempt; it does not mean a provider has passed physical download qualification. The runtime source of truth remains the shared descriptors and `mobileSources.ts`.

| Provider | Mobile playback | Manual download admission | Auto continuity | Qualification boundary |
| --- | --- | --- | --- | --- |
| VixSrc | Available | Yes | Yes; Mobile default | Accepted playback/download baseline. |
| VidSrc | Available manually | Yes | No | Accepted manual playback/download baseline. |
| VidSrc.ir | Available manually | Yes | No | Physically download-qualified; remains a candidate. |
| VidLink | Available manually | Yes | No | Gate A uninterrupted DASH/offline playback passed; Pause/Resume, real network recovery, and cleanup still need physical proof. |
| CineSrc | Available manually | Yes | No | Mixed HLS/direct source gate passed; physical download qualification pending. |
| VidNest | Available manually | No | No | Not preparation-qualified because descendant origin/request-context trust remains unresolved; no download admission. |
| 111Movies | Available manually | Yes in the existing descriptor | No | Frozen and not physically download-qualified. The existing manual choice is not an acceptance claim. |

Other registered sources are outside the visible Mobile choice list: Videasy and VsEmbed are retired on Mobile; AutoEmbed and SuperEmbed are quarantined; AllManga is async/anime-only; VidFast, Vidify, 2Embed, and VidSrc CC are disabled. Their shared descriptors remain unchanged. Cohort A (Mapple, Stellar, Chillflix, VidSrc.sh, VidAPI / VAPlayer) is deferred and absent from the active registry.

Mobile Auto remains VixSrc only. Every non-Auto source requires an explicit manual choice. A selected download still requires an exact playback session and media identity, native request-context binding, ready preflight, and final-media integrity verification. Health cooldown can temporarily remove a source from the manual download choice list without changing its descriptor.
