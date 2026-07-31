# Orion Mobile Stabilization Status

Updated: July 31, 2026

This document tracks the Android-first stabilization milestone. Older mobile
plans are retained as historical design input, not as verified feature claims.

## Implemented

### Project health

- Orion is organized as a workspace with `apps/desktop`, `apps/mobile`, and
  `packages/shared`.
- Expo, React Native, and React versions are aligned.
- Strict TypeScript, mobile unit tests, source-size checks, web export, and a
  debug-signed standalone Android build are available through package scripts.
- Shared contracts cover mobile playback, trailers, responsive layouts,
  themes, progress, shield verification, and Smart Connect.
- Provider subtitle keys are no longer read from public mobile environment
  variables. Optional user credentials use secure native storage. The TMDB
  application token remains bundled by product decision.

### Adaptive shell and themes

- Compact-phone, phone, tablet, and large-tablet breakpoints are defined.
- Phones use a drawer; tablets use an adaptive persistent sidebar.
- Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver, and Custom are
  available, persist locally, and support system-theme initialization.
- Reduced Motion and custom accent preferences persist.
- Network state is centralized and includes a measured TMDB latency probe.

### Media, trailers, and playback

- Media details use a responsive primary Watch action and secondary More
  sheet; dead source selection and fake download actions were removed.
- TV season and trailer metadata is lazy-loaded.
- Trailers have loading, ready, timeout, network, embed-rejected, retry,
  YouTube-app, and browser-fallback paths.
- Playback supports native local/offline media and provider WebView sessions
  under one session contract.
- The native HUD starts visible, hides only during confirmed playback, remains
  visible during loading/errors, and always exposes a reveal handle.
- Source selection is health-aware, resolves IMDb IDs where required, and
  skips providers in cooldown.
- Playback progress and history use versioned native persistence.

### Shield, subtitles, and downloads

- Embedded providers use provider-specific required origins.
- Shield reporting distinguishes verified, limited, disabled, dependency
  allowed, and rule-failure states.
- Blocked and allowed request counters are redacted.
- Provider subtitle requests and text-track resources are allowlisted.
- Optional SubDL credentials use SecureStore; Wyzie’s public endpoint remains
  available as a fallback.
- Downloads remain visible as an honest locked capability.
- Simulated progress, fake completion, and dormant extraction paths were
  removed.

### Smart Connect

- Pairing uses a random six-digit, single-use code with five-minute expiry,
  attempt limits, and lockout.
- QR payloads are generated locally in the desktop main process.
- Tokens use SecureStore on mobile and encrypted desktop storage when
  available.
- Commands use authenticated WebSockets, sequence numbers, acknowledgements,
  timeouts, heartbeats, and reconnect states.
- Pointer coordinates use one `{ x, y }` ratio contract, fixed gesture
  origins, clamping, throttling, and desktop acknowledgement.
- Desktop renders a real pointer overlay and can revoke paired devices.

## Validated

- Mobile strict TypeScript: pass.
- Smart Connect protocol unit tests: pass.
- Mobile source-size gate: pass with three temporary allowlist entries.
- Expo Doctor: 20/20 pass.
- Expo web export: pass.
- Android standalone test build: pass through
  `npm run build:android:standalone --workspace=apps/mobile`.
- The resulting `app-debug.apk` is debug-signed but embeds
  `assets/index.android.bundle`; it does not require Metro, USB, or local Wi-Fi.
- APK metadata and native contents are verified as version `2.0.1`
  (`versionCode` 2), ARM64.
- Desktop renderer tests: 135/135 pass.
- Desktop IPC compatibility: 214 preload methods and 133 channels preserved.
- Desktop renderer bindings, dependency cycles, and theme-literal baseline:
  pass.

## Remaining Release Gates

These require physical-device or live-provider validation:

- Test trailer playback and all external fallbacks on real Android devices.
- Verify embedded HUD reveal behavior in portrait and landscape.
- Verify provider allowlists, subtitle tracks, and shield evidence against
  live pages.
- Run the phone, tablet, font-scaling, and Reduced Motion device matrix.
- Exercise Smart Connect pairing, reconnect, timeout, revoke, keyboard input,
  and laser movement on a real LAN.
- Add Android end-to-end automation once stable device selectors are fixed.
- Complete token migration on remaining legacy Home, Discover, Library,
  Person, and detail sub-surfaces.
- Refactor temporary source-size allowlist files: `connect.tsx`,
  `discover.tsx`, and `media/[id].tsx`.
- Add Android-compatible local discovery; QR and manual IP are the supported
  current fallbacks.
- Complete external-subtitle selection when embedded tracks fail.

Google sign-in and cloud synchronization are intentionally deferred. Mobile
downloads remain deferred until a real native resumable engine exists.
