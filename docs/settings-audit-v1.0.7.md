# Settings Audit — v1.0.7

## Connected and retained

| Group | Setting | Consumer |
|---|---|---|
| General | Version check / startup update check | GitHub release checker and startup banner |
| General | Bundled TMDB token / optional user override | All TMDB metadata requests |
| General | Metadata language | TMDB request language and cache refresh |
| Content | Rating country / maximum age | Home, library, Movie, and TV restrictions |
| Playback | Invidious instance | Trailer playback and failover |
| Playback | Watched threshold | Movie and episode completion tracking |
| Playback | Autoplay, countdown, and layout | Shared autoplay hook and TV player overlay |
| Playback | Anime intro skip | AllManga/AniSkip TV playback path |
| Subtitles | Enable, language, SubDL, and Wyzie | Download modal and completed-file subtitle manager |
| Downloads | Destination, quality, queue concurrency, fragment concurrency, tool health | Managed downloader |
| Notifications | Download completion and new episodes | Renderer notification handlers and startup episode check |
| Interface | Home rows, view mode, and start page | Home layout and initial app route |
| Interface | Theme, accent, player accent, font size | App theme, player URL options, and Electron zoom |
| Library | Sort and history tracking | Library and App history writes |
| Backup | Manual and scheduled backup | Storage IPC and startup scheduler |
| Storage | Cache, watch data, downloads, and reset | Electron sessions, download store, and local settings |

## Repaired for v1.0.7

- Active downloads now override ordinary close behavior and continue in the Windows tray.
- Saved close behavior is synchronized to the Electron main process after every launch.
- The missing tray balloon function is implemented.
- Compact card grid now changes shared media-card size tokens.
- Reduce animations now disables animations and transitions even when the OS preference is unchanged.
- Theme/accent live previews correctly revert when leaving after a later unsaved change.
- The missing Wyzie tutorial link was replaced with the live key-redeem page.
- Subtitle setup is explained directly in the download modal when no provider key is configured.

## Removed from the active UI

- Dynamic Ambient Glow was a visible toggle backed by an explicit no-op implementation. It is no longer presented as a working setting. Reintroduction is deferred until capture cost, cross-origin behavior, and playback stability are tested.
- The destructive active-download close modal is removed because close-to-tray is now the safe default while jobs run.

## Jump navigation

All ten rendered top-level groups have matching refs and jump entries: General, Content, Playback, Subtitles, Downloads, Notifications, Interface, Library, Backup, and Storage & Data. No top-level group is missing. Fine-grained sub-section targets and active-section highlighting are planned for the Settings refactor because several groups are now too large for a single jump target.
