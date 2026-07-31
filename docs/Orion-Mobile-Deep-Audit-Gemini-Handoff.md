# Orion Mobile — Deep Audit and Implementation Handoff for Gemini 3.6 Flash

**Audit date:** July 23, 2026  
**Workspace:** `C:\Projects\Orion - A Multiverse of Stories`  
**Audience:** Gemini 3.6 Flash working on Orion Mobile  
**Status:** Internal alpha. Do not make a public mobile release from the current state.

## 1. Purpose of this document

This document is a code-confirmed handoff for completing Orion Mobile safely. It separates:

- what is already implemented and usable;
- what is present only as UI, placeholder, or dead code;
- release-blocking defects;
- the required build, security, architecture, and test work;
- the order in which the work should happen.

Do not treat older mobile specifications as implementation truth. Several claims in `docs/orion_mobile_specs.md` and `docs/Orion_Mobile_implementation_plan` are aspirational or stale.

## 2. Current workspace layout

The repository is being migrated to a monorepo:

```text
orion/
├── apps/
│   ├── desktop/                 # Electron + React app, moved from repository root
│   └── mobile/                  # Expo + React Native app
├── packages/
│   └── shared/                  # TypeScript tokens, types, TMDB/AniList client, sources
├── docs/
├── package.json                 # Workspace root; intentionally has no app start scripts
└── turbo.json
```

Important migration state:

- The old root desktop files are currently marked deleted in Git while `apps/desktop` is newly added/untracked.
- Do **not** mix a desktop migration cleanup with mobile feature work unless the migration is first isolated, verified, and committed.
- The root workspace has no `start` or `build` scripts. Use workspace commands:

```powershell
npm.cmd run --workspace @orion/desktop start
npm.cmd run --workspace @orion/mobile start
```

## 3. Verified technical baseline

### Mobile stack

- Expo SDK 57 / React Native 0.86 / React 19.
- Expo Router with file-based routes.
- TypeScript in strict mode.
- `react-native-mmkv` storage adapter for the shared metadata clients.
- `expo-video`, `react-native-webview`, `expo-camera`, `expo-screen-orientation`, `expo-brightness`, `react-native-volume-manager`.
- Shared package: tokens, basic media types, TMDB and AniList API clients, Cinema source registry.
- Android native project exists locally but is ignored by Git as generated Expo output.

### Current routes

```text
app/
├── _layout.tsx
├── (tabs)/
│   ├── index.tsx                # Home
│   ├── discover.tsx             # Search + discovery filters
│   ├── downloads.tsx            # Explicitly locked placeholder
│   └── connect.tsx              # Orion Connect remote/pairing UI
├── media/[id].tsx               # Movie/TV details
├── person/[id].tsx              # Person metadata/credits
└── player/[id].tsx              # Fullscreen embed player
```

### What is genuinely present

| Area | Evidence-backed state |
|---|---|
| TMDB browse/search/details | Implemented using `@orion/shared/api` |
| Home and discovery UI | Implemented |
| Movie/TV detail and episodes | Implemented foundation |
| Person page | Implemented foundation |
| Embedded provider playback | Implemented through `react-native-webview` |
| Source picker UI | Implemented, but status is static and not runtime-validated |
| Desktop Smart Connect HTTP server | Exists in Desktop and is registered at startup |
| QR/PIN/IP Connect UI | Implemented visually and sends HTTP requests |
| Shared tokens/source registry | Implemented foundation |

### What is not implemented or not connected

| Area | Actual state |
|---|---|
| Native resolved-stream player | Dead/unconnected code |
| Reliable stream extraction | Dead/unconnected `StreamExtractor` component |
| Runtime source health | Not implemented on mobile |
| Evidence-based buffering detection | Not implemented; timer simulation is used |
| Downloads | Locked UI only; no native downloader |
| Offline playback | Not working end-to-end |
| Subtitle picker/attachment | API helper exists, but is unconnected to UI/player |
| Google sign-in | Not implemented on mobile |
| Supabase | Not installed or implemented |
| Cloud sync, backup, history sync | Not implemented |
| Watchlist/favorites persistence | Not implemented as a mobile product feature |
| Music Planet | Not included in mobile scope/current app |
| Mobile settings | Not included |
| Chromecast / AirPlay | Not included |
| mDNS/Zeroconf discovery | Not included |
| Desktop download streaming/handoff | Not included |
| OTA updates | Not included; local Android manifest disables Expo Updates |
| Mobile automated tests | None found |

## 4. Audit results

### 4.1 Build and dependency health — release blocker

The strict TypeScript check currently fails with **32 errors**.

Representative failures:

- `Tabs` receives unsupported `sceneContainerStyle`.
- Invalid Ionicons names are referenced.
- Shared token names such as `radii['2xl']` do not exist.
- `StyleSheet.absoluteFillObject` conflicts with current type declarations in several files.
- Discovery assigns `string` to the `movie | tv` media type contract.
- Person cards use `profile_path` on a media-only type.
- Subtitle code imports a token that is not exported.
- Source sheet expects a `name` field missing from the source contract.

`expo-doctor` reports five failures:

1. Non-standard Metro `disableHierarchicalLookup` configuration.
2. `expo-modules-core` is installed directly.
3. `react-native-worklets` is missing, although Reanimated requires it. This can crash native builds.
4. Two React/React DOM versions exist across the monorepo (mobile React 19 and root/desktop React 18).
5. Expo SDK packages are out of alignment with the installed SDK version.

The app can still produce a web bundle because Expo does not make strict TypeScript errors fatal by default. That bundle is **13.58 MiB across 74 files**, including a 2.9 MiB JavaScript bundle and many unnecessary font assets. A successful Metro bundle is not release validation.

### 4.2 Android and release configuration — release blocker

The locally generated Android project has these risks:

- Release builds use the public Android debug signing key.
- `versionCode` is fixed at `1` and `versionName` is `2.0.0`.
- APK output is hard-coded to `Orion-v2.0.apk`.
- Only the `arm64-v8a` ABI is built; 32-bit devices and conventional emulators are excluded.
- The project-wide app configuration, mobile package version, and desktop/root versions disagree:

| Location | Version |
|---|---:|
| Root workspace | 2.0.1 |
| Desktop package | 2.0.1 |
| Mobile package | 1.0.0 |
| Expo `app.json` | 2.0.0 |

- `app.json` forces portrait orientation, while the player attempts to force landscape.
- The Android folder is ignored by Git. Its local manifest currently includes cleartext networking and permissions, but an EAS/prebuild regeneration can differ unless the configuration is represented in `app.json` and config plugins.

Required rule: use EAS-managed release signing or a protected release keystore. Never distribute an APK signed with the debug key.

### 4.3 Orion Connect — critical security blocker

Desktop server: `apps/desktop/src/main/ipc/smartConnectIpc.js`.

Current behavior:

- Listens on `0.0.0.0:8924`.
- Permits all origins through wildcard CORS.
- `GET /api/status` returns the active pairing PIN.
- Pairing accepts a universal `quick_pair` fallback.
- `POST /api/command` marks an unpaired caller as paired and executes its command.
- The mobile client stores only IP and a boolean “paired” state, not a cryptographic per-device credential.
- Traffic uses plain HTTP.

This means another device on the same LAN can learn the PIN or send remote commands. Do not expose Connect in a public build before replacing the protocol.

Required protocol replacement:

```text
User explicitly enables Connect on Desktop
    ↓
Desktop creates random short-lived challenge and QR payload
    ↓
Mobile scans QR and proves challenge once
    ↓
Desktop issues random per-device secret / token
    ↓
Mobile stores token in Expo SecureStore
    ↓
Every status, command, handoff, and unpair request requires Authorization token
```

Additional requirements:

- Never return PINs/tokens in a status endpoint or error message.
- Remove `quick_pair` completely.
- Require a valid token before every command.
- Add payload-size limits, command allowlists, validation, request rate limits, and device revocation.
- Keep the server disabled until the user explicitly enables it.
- Prefer local TLS when practical; if HTTP remains for LAN compatibility, bind carefully and clearly disclose the trusted-network requirement.
- Persist only non-sensitive device metadata in MMKV. Store secrets in `expo-secure-store`.

### 4.4 Playback and Cinema source behavior

Current player route: `apps/mobile/app/player/[id].tsx`.

Problems:

- The active path always mounts `EmbedVideoPlayer` with a `WebView`.
- `NativeVideoPlayer`, `StreamExtractor`, `extractedUrl`, and `useEmbedFallback` are currently not used by the route.
- “Offline” URIs are still sent through the embed path instead of `expo-video`.
- Buffering is cleared after a fixed four-second timer, whether or not video/audio really started.
- Watchdog failover uses `getNextNonAsyncSource`, which includes candidate/experimental sources without desktop runtime health, cooldown, or verified startup evidence.
- The Mobile source picker presents static labels such as “FAST” or “STABLE,” not real source health.
- The full-screen pressable overlay covers the WebView and can absorb player interactions.
- The mobile source request uses only TMDB IDs. Any source contract requiring IMDb IDs will fall back to TMDB IDs and can generate invalid URLs.
- The WebView ad suppression is heuristic, broad, and fragile. It is not equivalent to Desktop’s Electron session-level request rules.

Recommended decision: choose and complete one primary architecture.

1. **Embedded-provider route:** keep WebView playback, but add provider contracts, allowlisted navigation, source health, real playback evidence, safe manual switching, and honest limitations.
2. **Resolved-native route:** resolve a direct stream only through a controlled desktop relay or supported first-party/native backend, then play it with `expo-video`.

Do not present partially implemented direct extraction as production functionality.

### 4.5 Downloads and offline playback

The Downloads tab and Download modal are explicitly locked placeholders. That is correct for the UI, but there is dormant `downloadManager.ts` code that must not be trusted:

- It is browser/blob oriented rather than native filesystem based.
- It does not use Expo FileSystem or a native background task.
- Blob URLs vanish across app restarts.
- It has no HLS manifest/segment/key handling.
- It has no resumability, disk checks, concurrency control, pause, retry classification, or cleanup.
- It reports errors as completed downloads.

Required action now: keep Downloads disabled, remove misleading inactive engine code from reachable paths, and state “not available on mobile yet.”

Future mobile downloader needs a separate approved design based on native filesystem, platform background-transfer limits, provider authorization, encrypted/private metadata, resumable jobs, and explicit DRM exclusion.

### 4.6 Subtitles and credentials

`apps/mobile/src/services/subtitles.ts` has a subtitle search helper but it is not called by the player or UI.

It also includes fallback provider credentials in source code. Any `EXPO_PUBLIC_*` variable and any literal fallback is obtainable from a distributed Expo application.

Required action:

- Rotate currently exposed provider credentials.
- Remove literal fallback credentials.
- Do not treat `.env` as secure for mobile; build-time public variables are bundled.
- Let users configure their own keys, or use a protected authenticated backend broker with quotas.
- Only expose downloaded/generated subtitle URLs after validation, and add actual subtitle attachment support to `expo-video` only when the player architecture supports it.

TMDB’s read token can be bundled only if it is intentionally public and restricted; it is not a replacement for user authentication or secret storage.

### 4.7 Authentication, sync, backups, settings, and data ownership

No mobile Google OAuth, Supabase, or backup code is currently present. The existing documentation claims otherwise.

Before implementing feature sync, make a product decision:

- Use a shared authenticated backend for identity, watchlist, progress, playlists, settings, conflict resolution, and device records; or
- retain Desktop Google Drive backup as a desktop-only feature and clearly state Mobile is local-only.

For a unified Orion ecosystem, use a shared backend and a common schema. Do not put an OAuth client secret in the mobile app.

Suggested data scopes:

| Data | Storage / sync policy |
|---|---|
| User profile, watchlist, progress, settings | Authenticated backend, conflict-aware sync |
| Pairing secret | SecureStore only, device-local |
| TMDB/AniList cache | MMKV/device cache; never backup as user data |
| Download files/paths | Device-local; metadata only if user opts in |
| Subtitle keys/provider secrets | SecureStore/device-local by default |
| Analytics/diagnostics | Opt-in, redacted, bounded retention |

### 4.8 UI, accessibility, and performance

Good foundations:

- Shared design tokens.
- Orion fonts and dark visual direction.
- Expo Router navigation.
- Glass/gradient components.
- Detail, cast, hero, and remote-control UI concepts.

Concerns:

- Large pages: `connect.tsx` is approximately 1,886 lines; `discover.tsx` is approximately 1,200 lines.
- Many raw colors and inline styles remain instead of semantic mobile tokens.
- No mobile Settings route to control theme, accessibility, quality, source preferences, privacy, or Connect.
- No verified screen-reader labels, focus order, dynamic type, reduced-motion, contrast, or tablet layouts.
- Many Google font files and full icon fonts are included in web output. Bundle only the weights/icons actually used where possible.
- The Connect screen polls Desktop every 1.5 seconds, which is unnecessarily aggressive for battery and LAN traffic.
- Sidebar “online” status calls TMDB every 10 seconds, confusing metadata availability with connectivity and consuming API quota.

Required UX policy:

- Use actual connectivity APIs and exponential backoff; do not use TMDB as a ping service.
- Use event-driven Connect updates (or a bounded interval only while the Connect screen is foregrounded).
- Split large screens into controller hooks, focused components, pure utilities, and tokenized styles.
- Add loading, offline, empty, partial-error, retry, and permission-denied states to every networked screen.

## 5. Correct implementation phases

### Phase 0 — Preserve the current state

- Do not delete the Desktop application during monorepo cleanup.
- Snapshot representative Desktop and Mobile profiles.
- Commit or checkpoint the repository migration separately.
- Add a root README explaining workspace commands.
- Keep package versions unchanged until release gates pass.

### Phase 1 — Make the workspace buildable

1. Align Expo SDK dependencies using `expo install --check` and only approved upgrades.
2. Add `react-native-worklets` at the Expo-compatible version.
3. Resolve the React/React DOM duplicate dependency layout without breaking Desktop React 18.
4. Revisit Metro overrides after validating shared-package resolution.
5. Fix all 32 strict TypeScript errors. Do not weaken TypeScript or add broad `any`/ignore directives.
6. Add scripts:

```json
{
  "typecheck": "tsc --noEmit",
  "doctor": "expo-doctor",
  "test": "...",
  "lint": "...",
  "export:web": "expo export --platform web"
}
```

7. Add Turbo tasks and CI for Desktop and Mobile independently.

Acceptance: `typecheck`, Expo Doctor, tests, and a production-compatible bundle all pass.

### Phase 2 — Secure and complete Orion Connect

1. Replace the insecure current HTTP pairing protocol.
2. Add a narrow desktop Connect service module with typed request/response contracts.
3. Use SecureStore for the per-device credential and MMKV for device metadata.
4. Add one-device/multi-device pairing list, revoke controls, expiration, and server toggle.
5. Add request authentication to status, command, handoff, and unpair.
6. Add Android local-network and cleartext configuration deliberately through Expo config, not ignored generated native files.
7. Add Android/iOS real-device pairing tests.

Acceptance: an unpaired LAN client cannot learn secrets, read playback state, or send a command.

### Phase 3 — Establish honest Cinema playback

1. Remove dead player paths or wire one selected architecture completely.
2. Implement playback evidence: loaded frame alone is not “playing”; require advancing time and/or media state.
3. Create mobile source-health records with freshness, cooldown, timeout, provider scope, and redacted diagnostics.
4. Keep experimental sources manual-only; never auto-fail over to them by default.
5. Resolve external IDs before URL construction where providers require IMDb.
6. Use strict WebView navigation/domain policy and avoid broad content-script assumptions.
7. Make orientation policy consistent with player behavior.

Acceptance: a test matrix of movies/TV/anime validates startup, pause, source switch, failure, retry, and orientation without a simulated success state.

### Phase 4 — Authentication and common data

1. Decide and document the identity backend.
2. Implement mobile sign-in with PKCE and device-safe token storage.
3. Define versioned schemas for watchlist, history, playback progress, preferences, and device metadata.
4. Add offline queue/retry/conflict policy.
5. Connect Desktop and Mobile only after both use compatible contracts.

Acceptance: a user can sign in on two devices, change a watchlist/progress item offline and online, and recover predictably.

### Phase 5 — Deferred product features

- Native mobile downloads/offline library.
- Subtitle search/download/attachment.
- Desktop file relay and handoff.
- Casting.
- Music Planet for Mobile.
- OTA updates.
- mDNS discovery.
- User-facing settings and accessibility customization.

Each is a dedicated milestone, not a checkbox added to the initial mobile release.

## 6. Required test matrix

### Automated

- Shared source URL and ID-policy unit tests.
- Mobile state/storage unit tests.
- Connect request authentication/validation tests.
- Typecheck, lint, Expo Doctor, Android build, and Expo export checks.
- Component tests for Home, Discover, Details, Player, Connect, loading/error/offline states.
- E2E Android tests for navigation, QR/PIN pairing, and Connect revocation.

### Real-device validation

- Android arm64 physical phone.
- Android network changes: Wi-Fi, mobile data, offline, captive portal.
- Background/foreground recovery.
- Portrait and landscape playback.
- Brightness/volume gestures.
- QR camera permission denial/grant/revoke.
- Fresh install and upgrade install.
- Desktop/phone on same LAN and different network.
- Low battery and restricted-data modes.

### Security validation

- Unpaired device cannot fetch playback/status details or issue commands.
- Reused QR/PIN cannot pair after expiration.
- Revoked device token cannot reconnect.
- No token/PIN/stream URL/provider key appears in logs, alerts, analytics, or UI diagnostics.
- Mobile release bundle contains no private OAuth/client secrets.

## 7. Source-of-truth corrections for documentation

Update old documents to say:

- Mobile is an internal alpha.
- Standalone embedded Cinema playback is experimental.
- Downloads are unavailable on Mobile.
- Cloud sync, Google sign-in, Supabase, casting, desktop relay, mDNS, OTA updates, and Music Planet are not yet implemented.
- Orion Connect exists only as a development feature until the secure pairing redesign ships.

Remove mojibake from touched Markdown documents.

## 8. Non-negotiable implementation rules

- Do not expose credentials, provider tokens, OAuth secrets, raw file paths, or unredacted stream URLs to the renderer/mobile UI.
- Do not mark an unavailable or failed operation as completed.
- Do not implement a downloader by fetching protected HLS/WebView URLs directly on the device.
- Do not trust a LAN merely because it is private.
- Do not ship with TypeScript errors, debug signing, duplicated native runtime dependencies, or no device tests.
- Keep Desktop and Mobile contracts versioned in `packages/shared`; do not duplicate source logic in each app.
- Keep files below the established Orion limits. Split `connect.tsx` and `discover.tsx` before expanding them further.

## 9. Commands for development and verification

```powershell
# Desktop
npm.cmd run --workspace @orion/desktop start

# Mobile Metro server
npm.cmd run --workspace @orion/mobile start

# Mobile strict validation
npm.cmd exec tsc -- -p apps/mobile/tsconfig.json --noEmit

# Expo configuration/dependency validation
Set-Location apps/mobile
npm.cmd exec expo-doctor

# Web smoke bundle only; this is not an Android/iOS acceptance test
npm.cmd exec expo export -- --platform web
```

## 10. Final handoff verdict

Treat Orion Mobile as a promising product shell with meaningful metadata and UI work already completed. The next work must be stabilization and security—not more feature surface.

The recommended release target is a narrow **Mobile Foundation / Secure Connect beta**, only after Phases 0–3 pass. Downloads, cloud sync, Music Planet, casting, handoff, and broad ecosystem claims should stay deferred until their independent acceptance criteria are met.
