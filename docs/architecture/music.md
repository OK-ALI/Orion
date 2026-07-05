# Music Planet architecture

Music Planet is an isolated Orion world built on the existing Electron/React boundary. It does not modify Cinema stream resolution or downloader behavior.

## Provider host

Orion uses clean-room capability contracts matching the mature provider separation studied in Nuclear:

- metadata
- streaming
- lyrics
- dashboard
- playlists
- discovery

Selectable provider kinds retain one active provider. Dashboard and playlist providers can contribute concurrently. A metadata provider may require a paired streaming provider. Entities keep provider-specific references after normalized results are deduplicated.

Playback uses two phases: candidate discovery and just-in-time stream resolution. Expiring service URLs, credentials, and local file paths remain in the main process. The renderer receives only an expiring `orion-music://` grant with byte-range support.

The v2.0 provider host accepts compiled first-party adapters only. Runtime plugins, unsigned packages, arbitrary custom CSS, MCP control, and dynamic code evaluation remain disabled until a utility-process permission model is implemented.

Curated Music plugins are manifest-backed packages bundled with Orion. Installation toggles provider ownership and capabilities in the SQLite-backed plugin state; it does not download or evaluate JavaScript. Disabling or removing a package unregisters its providers immediately, while Orion Music Core remains locked. The dedicated Plugins surface owns catalog, permission review and lifecycle actions; Sources owns provider health, configuration and routing.

OmniSource queries enabled metadata providers concurrently, merges normalized entities, retains every provider reference and ranks exact matches before partial matches. Provider failures remain isolated and appear as partial-result diagnostics.

The renderer does not register providers or fabricate catalog entries. Search, details, artwork, lyrics and playback always cross the preload boundary into the main-process provider host.

## Storage

`music-library.sqlite` stores indexed metadata, queue recovery, playlists, favorites and history. WAL mode keeps reads responsive during scans. Local paths remain private columns and are removed from renderer contracts. Folder watchers update changed files incrementally; full scans yield regularly to avoid starving the Electron main loop.

Credentials use Electron `safeStorage`. Generated caches, signed URLs, credentials and machine-specific paths are excluded from portable backups.

## Playback ownership

`PlaybackCoordinator` permits one audible owner: Cinema video or Music. Starting Music pauses the current story while retaining its session. Starting a story pauses Music while retaining its queue. Windows media commands are routed to the active owner.

## Resonance visual boundary

Music keeps one HTML audio element. A reusable Web Audio analyser observes that element and publishes normalized frequency frames through an imperative renderer-side bus. Canvas consumers draw the Listening Orbit, waveform timelines and Observatory without placing high-frequency data in React state.

The analyser follows Orion's existing performance tier and stops under hidden, paused, buffering, reduced-motion and battery-constrained conditions. Failure to initialize visual analysis never blocks playback.

Embedded and approved remote artwork is resized and cached by the main process. Renderer components receive only opaque `orion-music://` artwork grants. Artwork palettes influence Music semantic tokens but never replace the active Orion theme or its readable foreground colors.

## Licensing boundary

Nuclear is an architecture reference only. Orion does not copy its AGPL source, plugin loader, SDK, UI, or runtime code. Orion's provider host and adapters are original GPL-3.0 implementation work.
