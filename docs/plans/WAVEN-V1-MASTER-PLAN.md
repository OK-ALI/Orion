# WAVEN v1 Master Plan — Codebase Audit, Android Product Roadmap, Orion Cloud, Offline, and Distribution

- **Status:** Single authoritative WAVEN v1 audit and implementation plan
- **Prepared:** 2026-09-14
- **Product:** WAVEN — *Where Music Lives.*
- **Source of truth:** Local WAVEN workspace at `C:\Projects\WAVEN-v1`; Orion workspace evidence is reference-only unless a later phase explicitly authorizes Orion changes.
- **Dedicated branch:** `waven/v1`

## 1. Decision summary

WAVEN should initially align with Orion Mobile's proven Expo/React Native generation. The new workspace therefore pins Expo `57.0.19`, React Native `0.86.3`, React `19.2.3`, Expo Router `57.0.18`, and the observed Android SDK/Kotlin baseline instead of initializing against whatever Expo version is newest.

WAVEN is an Android-first sibling app in the existing npm monorepo at `apps/waven`. It has its own application identity and blue design tokens, but it uses the same repository toolchain and may consume `@orion/shared` through the existing Metro monorepo configuration.

There must be no separate **WAVEN Cloud**. WAVEN will participate in **Orion Cloud** by reusing the same Google subject identity, backend-neutral `CloudProfileStore` boundary, PortableProfile envelope, Google Drive `appDataFolder` transport, conditional-write semantics, and conflict-safety rules. Music data requires new WAVEN-specific namespaces; Cinema namespaces must not be overloaded.

The supplied icon has been copied unchanged into `apps/waven/assets/icon.png`. It is the current reference/application icon, not a redesigned derivative.
Offline behavior is a first-class product mode and is intentionally separate from downloadable media. Direct-distribution builds are expected to gain a WAVEN in-app updater based on a future read-only audit of Orion Mobile's current updater, with GitHub Preview/Prerelease artifacts and same-signature physical update acceptance.

Current accepted completion status is **Phases 0–7 complete; Phase 8 ACCEPTED WITH DOCUMENTED RESIDUALS; 68% overall**. [Phase 6 Completion ACK](../audits/WAVEN-PHASE-6-COMPLETION-ACK-2026-10-01.md) and [Phase 7 Completion ACK](../audits/WAVEN-PHASE-7-COMPLETION-ACK-2026-10-02.md) remain independent and unchanged; together accepted Phases 0–7 contribute 60%. Phase 8 earns its fixed **8%** under [ACK-P08-2026-10-19](../audits/WAVEN-PHASE-8-COMPLETION-ACK-2026-10-19.md), normalized `ACCEPTED`, and the explicit owner amendment `AMEND-P08-2026-10-19` / `EXC-P08-2026-10-19` in section 15.5. Unresolved performance remains **KNOWN ACCEPTED RISKS**; missing physical fixtures remain **UNTESTED / OWNER EXCEPTION**, not PASS. Signed-distribution requirements remain outstanding. Phase 9 and every later phase remain unauthorized. Earlier dated slice records retain their historical boundaries. V8.5 development stops after closeout. COMMIT NO; PUSH NO; MERGE NO; TAG NO; RELEASE NO.

## 2. Instruction and evidence boundary

The original master-task document and the later Offline/Expo Go/Updater roadmap amendments were treated as planning inputs, distinct from the user's direct request to maintain one complete WAVEN v1 master plan. Their compatible product requirements are consolidated here; repository implementation remains authoritative wherever reference prose and code disagree.

This file is the **only authoritative WAVEN v1 audit and roadmap**. Its historical filename is retained so existing references do not create a second source of truth. Any detached draft, amendment text, or earlier summary is non-authoritative after its requirements are incorporated here.

No external service assumptions were introduced. No Orion dependency was upgraded, no Music Planet branding was changed, and no separate authentication or cloud system was created.

## 3. Workspace safety baseline

| Item | Observed value | Evidence |
|---|---|---|
| Repository root | `C:/Projects/Orion - A Multiverse of Stories` | `git rev-parse --show-toplevel` |
| Branch | `codex/orion-v3-p11-reliable-connect` | `git branch --show-current` |
| HEAD before WAVEN changes | `2c479f70f50e8e2e428ddce743ba60763143eece` | `git rev-parse HEAD` |
| Existing worktree changes | `package-lock.json` modified; `apps/tv/` untracked | `git status --short --branch` |
| Monorepo | npm workspaces: `packages/*`, `apps/*` | `package.json`; `package-lock.json` lockfile v3 |
| Existing apps | `apps/desktop`, `apps/mobile`, `apps/tv` | local directory inventory |
| Shared package | `packages/shared` as `@orion/shared` | `packages/shared/package.json` |

The existing lockfile and TV work are user-owned changes. They must not be cleaned, reset, or overwritten. The WAVEN workspace uses the existing `apps/*` glob, so the root workspace declaration does not need editing.

Important reproducibility fact: `apps/mobile/android` is locally generated and ignored by `apps/mobile/.gitignore`; it has zero tracked files. Tracked `app.json`, package manifests, config plugins, and the npm lock are the durable inputs. Native versions below were verified from the current generated project and installed React Native packages and must be captured explicitly for WAVEN.

## 4. Exact Orion Mobile version baseline

### 4.1 Core framework and toolchain

| Layer | Declared/observed baseline | Exact currently installed/active value | Evidence |
|---|---:|---:|---|
| Expo SDK/package | `~57.0.19` | `57.0.19` | `apps/mobile/package.json:13`; installed package |
| React Native | `0.86.3` | `0.86.3` | `apps/mobile/package.json:36` |
| React | `^19.2.3` plus root override | `19.2.3` | `apps/mobile/package.json:34`; root `package.json` |
| React DOM | `^19.2.3` plus root override | `19.2.3` | `apps/mobile/package.json`; root `package.json` |
| Expo Router | `~57.0.18` | `57.0.18` | `apps/mobile/package.json:27`; `main` is `expo-router/entry` at line 4 |
| TypeScript | `~6.0.3` | `6.0.3` | `apps/mobile/package.json:50`; app-local installed package |
| Package manager | npm, lockfile v3 | local npm `11.11.0` | root `package-lock.json` |
| CI Node.js | `22` | Node 22 in all three root workflows | `.github/workflows/{test,release-check,windows-build}.yml` |
| Inspected local Node.js | not repository-pinned | `v24.14.1` | `node --version` |
| Gradle wrapper | local generated baseline | `9.3.1` | `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties:3`; `gradlew --version` |
| Android Gradle Plugin | React Native catalog | `8.12.0` | installed `react-native/gradle/libs.versions.toml:9` |
| Kotlin Gradle plugin | React Native catalog | `2.1.20` | installed `react-native/gradle/libs.versions.toml:32` |
| Gradle embedded Kotlin | Gradle implementation detail | `2.2.21` | `gradlew --version`; not the app Kotlin plugin |
| compileSdk | React Native/Expo root ext | `36` | installed RN catalog; generated `app/build.gradle:116` consumes it |
| targetSdk | React Native/Expo root ext | `36` | installed RN catalog; generated `app/build.gradle:122` consumes it |
| minSdk | React Native/Expo root ext | `24` | installed RN catalog; generated `app/build.gradle:121` consumes it |
| Android build tools | React Native catalog | `36.0.0` | installed RN catalog |
| NDK | React Native catalog | `27.1.12297006` | installed RN catalog |
| Java/JDK runtime | current build host | Microsoft OpenJDK `17.0.19` | `java -version`; Gradle launcher/daemon output |
| Architecture | enabled | React Native New Architecture | `apps/mobile/android/gradle.properties` |
| JavaScript engine | enabled | Hermes | `apps/mobile/android/gradle.properties` |

Node is not fully disciplined at the repository root: there is no root `engines`, `.nvmrc`, or `packageManager` declaration. CI Node 22 is the strongest committed assumption; local Node 24 proves only this machine's current environment. A future repository-wide toolchain-hardening change should be separate from WAVEN creation.

### 4.2 Direct Expo modules and React Native packages

The exact installed Mobile set relevant to WAVEN compatibility is:

| Package | Installed |
|---|---:|
| `@expo/metro-runtime` | `57.0.15` |
| `@expo/vector-icons` | `15.1.1` |
| `expo-asset` | `57.0.16` |
| `expo-audio` | `57.0.4` |
| `expo-blur` | `57.0.2` |
| `expo-brightness` | `57.0.1` |
| `expo-build-properties` | `57.0.16` |
| `expo-camera` | `57.0.4` |
| `expo-constants` | `57.0.17` |
| `expo-device` | `57.0.1` |
| `expo-file-system` | `57.0.6` |
| `expo-font` | `57.0.3` |
| `expo-linear-gradient` | `57.0.1` |
| `expo-linking` | `57.0.9` |
| `expo-notifications` | `57.0.16` |
| `expo-router` | `57.0.18` |
| `expo-screen-orientation` | `57.0.2` |
| `expo-secure-store` | `57.0.3` |
| `expo-splash-screen` | `57.0.8` |
| `expo-status-bar` | `57.0.1` |
| `expo-updates` | `57.0.21` |
| `expo-video` | `57.0.3` |
| `@react-native-community/netinfo` | `12.0.1` |
| `react-native-gesture-handler` | `2.32.0` |
| `react-native-mmkv` | `4.3.2` |
| `react-native-reanimated` | `4.5.1` |
| `react-native-safe-area-context` | `5.7.0` |
| `react-native-screens` | `4.26.2` |
| `react-native-volume-manager` | `2.0.8` |
| `react-native-web` | `0.21.2` |
| `react-native-webview` | `13.16.1` |
| `react-native-worklets` | `0.10.1` |

WAVEN's initial package uses exact versions for its selected subset. It intentionally does not inherit Camera, Cinema WebView, video, updater, brightness, notifications, or volume-manager dependencies before a WAVEN feature proves the need.

### 4.3 Configuration baseline

- **Metro:** `apps/mobile/metro.config.js` uses Expo's default config, watches the monorepo root, and resolves project-local then root `node_modules`. WAVEN mirrors this behavior.
- **Babel:** Orion Mobile has no `babel.config.*`; Expo's current default transform path is used. WAVEN also has no custom Babel configuration.
- **TypeScript:** `apps/mobile/tsconfig.json` extends `expo/tsconfig.base`, enables `strict`, and excludes `dist` and `node_modules`. WAVEN mirrors it.
- **EAS:** `apps/mobile/eas.json` requires EAS CLI `>=21.0.2`, uses remote app-version sourcing, and defines internal development, internal APK preview, and production auto-increment profiles. WAVEN mirrors the profile shape but has no invented EAS project ID.
- **Updates:** Orion Mobile currently has updates disabled with a fixed native runtime `orion-mobile-native-r1`. WAVEN begins disabled with its own `waven-native-r1` runtime boundary.
- **Native generation:** `android/` and `ios/` are ignored. Any future `expo prebuild` result is derived output and must be diffed/audited before acceptance.

### 4.4 Orion Mobile config plugins and native plugins

Tracked Expo/config plugins in `apps/mobile/app.json:26-65`:

- Standard: `expo-router`, `expo-status-bar`, `expo-asset`, `expo-font`, `expo-splash-screen`, `expo-camera`, `expo-notifications`, `expo-video`, and `expo-build-properties`.
- Custom: `withOrionNsd`, `withOrionCinemaWebView`, `withOrionGoogleIdentity`, `withOrionGoogleDriveAuthorization`, and `withOrionUpdates`.

The generated `MainApplication.kt:28-35` manually registers:

- `OrionGoogleIdentityPackage`
- `OrionGoogleDriveAuthorizationPackage` (also exposes the profile store)
- `OrionUpdatePackage`
- `OrionCinemaWebViewPackage`
- `OrionNsdPackage`

The Cinema plugin also injects WorkManager `2.10.1`, Media3 ExoPlayer/UI `1.9.0`, and pinned yt-dlp Android/FFmpeg commits. Google identity injects AndroidX Credentials `1.6.0`, credentials Play Services auth `1.6.0`, and Google ID `1.2.0`. Drive authorization injects Play Services Auth `21.6.0`.

These plugins are materially coupled to Orion package names, module names, Cinema permissions, generated native sources, and release/update behavior. They must not be copied wholesale into WAVEN.

## 5. Version selection recommendation

### Adopt now

WAVEN begins on the exact Orion Mobile generation:

- Expo `57.0.19`
- React Native `0.86.3`
- React/React DOM `19.2.3`
- Expo Router `57.0.18`
- TypeScript `6.0.3`
- React Native New Architecture and Hermes
- compileSdk/targetSdk `36`, minSdk `24`, build tools `36.0.0`
- Kotlin plugin `2.1.20`
- Gradle/AGP expectation `9.3.1`/`8.12.0` when native output is generated from the same locked dependency tree
- JDK 17 for Android work

This minimizes uncertainty across `@orion/shared`, Metro workspace resolution, Reanimated/Worklets, MMKV v4/Nitro, Expo Router, and the future Cloud native bridge.

### Do not upgrade now

No newer Expo SDK benefit is demonstrated by local evidence that outweighs the compatibility cost. A different generation would immediately require revalidation of:

- React Native New Architecture compatibility;
- Reanimated/Worklets and MMKV Nitro bindings;
- background audio and MediaSession choices;
- every extracted Orion Cloud config/native plugin;
- Android Gradle Plugin, Gradle, Kotlin, Java, SDK, and generated manifest output;
- Metro monorepo source-package resolution;
- potential Desktop/shared TypeScript compatibility;
- clean install and in-place update behavior on physical Android devices.

A later upgrade proposal must name a blocked WAVEN capability or a security/support requirement, show the dependency matrix, provide a generated native diff, run a clean-room install, and state the impact on shared code. Orion Mobile must never be upgraded as a side effect.

## 6. WAVEN workspace foundation

The initial workspace is organized as:

```text
apps/waven/
├── app/                         Expo Router entry points
├── assets/                      WAVEN-owned icon/brand assets
├── src/
│   ├── components/brand/        reusable brand presentation
│   ├── domain/                  platform-neutral music contracts
│   ├── features/                account/cloud/discovery/library/playback/search boundaries
│   ├── infrastructure/          provider, persistence, cloud, native adapters
│   └── theme/                   black/silver/blue tokens
├── tests/                       foundation and future behavior tests
├── app.json
├── eas.json
├── metro.config.js
├── package.json
├── tsconfig.json
└── README.md
```

Initial independent identity:

- npm workspace: `@orion/waven`
- app name/slug/scheme: `WAVEN` / `waven` / `waven`
- Android application ID: `com.okali.waven`
- foundation version: `0.1.0`, Android versionCode `1`

The workspace includes only a foundation screen, design tokens, split-accent heading primitive, structure notes, and baseline tests. Playback, providers, Orion Cloud writes, EAS registration, signing, and Desktop branding changes are intentionally absent.

### Icon record

- Source: supplied PNG
- Copied destination: `apps/waven/assets/icon.png`
- Dimensions: `1254 × 1254`
- Pixel format: 24-bit RGB PNG; no alpha channel
- SHA-256: `669485AE5ADBA70759324E002749D8D9DA31F04843726C16C31F81569A0029A7`

The exact source is used for the current icon and splash. Before release, Android adaptive-icon masking must be checked on multiple launcher shapes. If separate transparent foreground/monochrome assets are needed, they must be derived as production assets without redesigning the mark and reviewed visually at launcher sizes.

## 7. Music Planet compatibility boundary

Music Planet is active code: Desktop startup calls `music.register()` in `apps/desktop/src/main/bootstrap.js:554`. Its durable boundary is Electron main-process music services plus renderer UI, not `@orion/shared`.

Key evidence:

- Active bundled providers are Local/Core, YouTube Music, LRCLib, and Spotify Charts (`apps/desktop/src/main/music/index.js:17-20`; `plugins/catalog.js:1-6`).
- Other provider source files such as Saavn, MusicBrainz, and ListenBrainz exist but are not registered by the active plugin catalog; treat them as inactive/legacy until a live registration path is proven.
- The local library uses Node's `DatabaseSync` and `music-library.sqlite` under Electron `userData` (`database.js:17-19`).
- Queue and history are persisted through music IPC and the SQLite-backed state layer (`musicConstants.cjs:58-61`; `database.js:240-248,298`).
- Provider fan-out uses `Promise.allSettled` with an 8-second default timeout and health recording (`providers/requestBroker.js:1-24`).
- Stream selection uses provider ordering, candidate discovery, short-lived candidate grants, just-in-time resolution, and a protected `orion-music://` media grant (`streamResolver.js:32-161`; `playback/tokenRegistry.js`).
- Renderer playback is an HTML `<audio>` element; Web Audio analysis feeds visual reactivity (`AudioEngine.jsx:27-42,197`; `musicVisualEngine.js`).
- Queue ownership and transition policy live in React state in `MusicProvider.jsx`, with debounced persistence through Electron IPC (`MusicProvider.jsx:76-134`).
- Music Planet code contains no current PortableProfile/Orion Cloud integration. Music history, favorites, playlists, and queue are currently Desktop-local.

Compatibility consequence: provider contracts, normalized models, queue policy, metadata mapping, and conflict-free data concepts are candidates for extraction. Electron IPC, Node SQLite, filesystem scanning, child-process yt-dlp, custom protocol serving, DOM audio/Web Audio, and renderer UI must not be imported into Android.
### 7.1 Music Planet UX/UI inheritance contract

Music Planet is WAVEN's primary product-experience reference. WAVEN should feel like the focused Android expression of the same listening world, not like an unrelated generic Expo starter. Inheritance means preserving product intent, information hierarchy, playback states, and interaction semantics while implementing them with native mobile components and WAVEN's own brand tokens.

Source evidence:

- `MusicPlanet.jsx:378-385` composes the experience as Intro, Now Playing, Library, Albums, Artists, Playlists, Favorites, and Sources. `MusicRoutes.jsx:3-24` adds Search, Settings, Artist, Album, and full Now Playing routes.
- `MusicPlayerBar.jsx:260-365` establishes the listening-control hierarchy: shuffle/previous/play-next/repeat, buffered and played progress, favorite, volume, source, lyrics, queue, overflow actions, retry, and stop/clear.
- `MusicProvider.jsx:76-134,280-318` owns one queue, history, repeat/shuffle policy, and debounced persistence; the Now Playing experience consumes that same listening core rather than creating a second player.
- `MusicTrackList.jsx:29-83` defines readable track hierarchy, current-track state, unavailable/offline explanation, play-next, queue, radio, playlist, and favorite actions.
- `QueuePanel.jsx:6-24` exposes listening order, current-item emphasis, reordering, removal, and clear-upcoming behavior.
- `LyricsPanel.jsx:5-21` covers no-track, loading, error/retry, unavailable, synchronized active-line, and plain-lyrics states.
- `musicThemeTokens.js:12-31` combines stable scene tokens with artwork-derived color. `MusicPlanetSceneEngine.jsx:93-155` reduces visual complexity according to preferences and performance budget.

| Music Planet quality | WAVEN inheritance decision | Android translation |
|---|---|---|
| Premium dark, immersive listening stage | **PRESERVE** | Use WAVEN black/silver/blue tokens, controlled gradients, restrained glass surfaces, and artwork-led atmosphere. Do not copy Music Planet's current purple accent as WAVEN's default. |
| Intro -> listening -> collection -> discovery narrative | **ADAPT** | Use a mobile information architecture with a home feed and native tab/stack navigation; retain the same conceptual destinations without copying the long desktop scroll literally. |
| Artwork-driven palette and resilient fallback artwork | **PRESERVE/ADAPT** | Extract deterministic palette/fallback rules and accessibility contrast constraints; render them with React Native image, gradient, and token primitives. WAVEN blue remains the fallback brand accent. |
| One playback owner shared by mini and full player | **PRESERVE** | A single Android playback/session service and one observable queue state must drive the persistent mini-player and full Now Playing screen. |
| Transport hierarchy, buffered/played progress, queue, lyrics, source selection, favorite, retry | **PRESERVE** | Keep feature parity and state semantics. Present secondary surfaces as accessible bottom sheets or routes sized for touch. |
| Synced/plain lyrics with active-line emphasis and complete loading/error/empty states | **PRESERVE** | Implement with virtualized native text, automatic scroll that respects user interaction, screen-reader labels, and reduced-motion behavior. |
| Track rows with current/unavailable state and contextual actions | **PRESERVE** | Use touch targets, long-press/overflow menus, explicit offline explanations, and Android accessibility actions. |
| Search suggestions, recent searches, artist/album detail, library/favorites/playlists/sources/settings | **PRESERVE/ADAPT** | Keep the destination set and search behavior; map it to Expo Router routes and mobile-native headers. |
| Queue drag-and-drop | **ADAPT** | Use long-press native reordering plus Move Up/Move Down accessibility actions; never make dragging the only control. |
| Floating, draggable, resizable, snap/lock desktop player | **DO NOT COPY** | Replace with a persistent bottom mini-player and a full-screen Now Playing route. |
| Hover, custom cursor, desktop keyboard shortcuts, Escape behavior | **DO NOT COPY** | Use touch feedback, optional haptics, Android Back, hardware-media buttons, and accessible focus/keyboard behavior where devices provide it. |
| CSS variables, DOM overlays, HTML `<audio>`, Web Audio analyser | **REIMPLEMENT** | Use typed React Native tokens, native overlays, the Android playback stack, MediaSession, and only bounded native analysis data if the chosen engine exposes it safely. |
| Three.js/audio-reactive scene effects | **DEFER** | They are not foundation requirements. Reintroduce only after playback, battery, thermals, reduced-motion, and low-end-device budgets pass. |

UX/UI acceptance rule: a WAVEN screen may differ in layout from Desktop Music Planet, but it must retain the corresponding user goal, state model, recovery path, and visual hierarchy. Desktop-only affordances must not be copied when they weaken touch, accessibility, background playback, or Android lifecycle behavior.

## 8. Orion Cloud current architecture

### 8.1 What Orion Cloud is today

The implemented global account/synchronization layer is:

```text
Google identity (subject/account ID)
        |
Google Drive authorization: drive.appdata
        |
CloudProfileStore contract
        |
PortableProfileV3 JSON in Google Drive appDataFolder
        |
domain policies: My List / Watched / History + Progress
        |
account-scoped local storage and verified checkpoints
```

There is no evidence of Firebase, Supabase, a bespoke Orion account server, or a separate central schema database in the current portable-profile path.

### 8.2 Authentication and global identity

Mobile uses Android Credential Manager with `GetSignInWithGoogleOption`. `OrionGoogleIdentityModule.kt:66-83` maps `google.uniqueId` to `accountId`, returns profile fields, and deliberately withholds the Google ID token from JavaScript. `AccountContext.tsx:73-86` creates the persisted Orion account snapshot.

Desktop uses Google OAuth authorization-code flow with PKCE and a local loopback callback (`googleAuthIpc.js:171-198,624-764`). It fetches Google `userinfo`; the `sub` is the identity used to authorize PortableProfile writes (`portableProfileIpc.js:38-45`). Mobile `uniqueId` and Desktop `sub` are expected to represent the same Google subject, and this equivalence must be verified on a development account before WAVEN's Orion Cloud writes are enabled.

### 8.3 Backend provider and cloud data model

`packages/shared/src/api/cloudProfileStore.ts:3-47` defines a backend-neutral read/write boundary with opaque revision tags and conflict results. The active backends are Google Drive transports:

- Mobile native Kotlin calls Drive REST APIs and keeps bearer tokens below the React Native bridge (`OrionGoogleDriveProfileStoreModule.kt:25-46`).
- Desktop Electron main process calls Drive and exposes only constrained read/write IPC to the renderer (`portableProfileIpc.js`; `portableProfileCloudStore.js`).

The cloud file is hidden in Google Drive `appDataFolder`. The profile key is SHA-256 hashed into an `orion-portable-profile-v3-<digest>.json` name on Mobile (`OrionGoogleDriveProfileStoreModule.kt:257-301`) and the same naming contract exists on Desktop (`portableProfileStore.js`). The payload limit is 2 MiB.

PortableProfileV3 (`packages/shared/src/types/portableProfile.ts:9-74`) contains:

- opaque `profileId`;
- envelope `revision`, `createdAt`, `updatedAt`;
- namespaces;
- per-namespace revisions/timestamps;
- per-record revisions, `updatedAt`, `updatedBy`, tombstone `deletedAt`, and JSON value.

Known namespaces today are `myList`, `history`, `watched`, `progress`, and `preferences`. Unknown namespaces are retained as opaque JSON (`portableProfile.ts:53-61,235-269`), and current domain builders spread the base namespaces before replacing their own domain. This is the compatibility mechanism WAVEN can extend.

### 8.4 Session and credential lifecycle

Mobile:

- saves only the normalized account profile snapshot through `expo-secure-store` under `orion.mobile.account.session.v1` (`accountSessionStore.ts:5,39-59`);
- keeps the Drive OAuth access token native-only and in memory (`OrionGoogleDriveAuthorizationModule.kt:21-41,262-264`);
- silently reacquires an authorized token after process restart through Google Play Services (`OrionGoogleDriveAuthorizationModule.kt:103-134`);
- clears the local session, native token cache, and Credential Manager state on sign-out while retaining the local library (`AccountContext.tsx:100-140`).

Desktop:

- stores access/refresh tokens and profile in the Electron main process through `secureStoreSet`;
- encrypts with Electron `safeStorage` when available (`storageIpc.js:30-55`);
- falls back to base64 if OS encryption is unavailable, which is a security weakness to retain in the risk register, not a pattern for WAVEN;
- refreshes once after a 401 and clears tokens if refresh fails (`googleAuthIpc.js:235-265`).

### 8.5 Local storage, offline behavior, retry, and conflicts

- Android library data and sync checkpoints use MMKV v4 in the app-private directory (`storageAdapter.ts:28-55`). Web uses localStorage; memory fallback is test/development-only.
- Local data is split into local and Google-account scopes. The Google scope key is `google:<encoded accountId>` (`libraryProfileStorage.ts:37-69`). Migration copies and verifies local data before marking an account-scoped profile ready (`libraryProfileStorage.ts:154-175,213-260`).
- Sync pauses when network reachability is false and leaves local data unchanged (`MyListSteadyStateSync.tsx:171-189`).
- Mobile checks remote changes on local/account/network/policy changes, foreground activation, and a staggered 20-second active-app heartbeat (`portableProfileAutoSyncHeartbeat.ts:1-63`; `MyListSteadyStateSync.tsx:542-576`).
- A native read takes metadata, downloads the body, re-reads metadata, and retries up to three times if the revision changes (`OrionGoogleDriveProfileStoreModule.kt:345-363`).
- A successful write is semantically read back with delays of 0, 250, 750, and 1500 ms before a checkpoint is accepted (`cloudProfileReadBackVerification.ts:5-34`).
- Writes use optimistic concurrency. The caller supplies a fresh opaque revision tag; native Drive update uses a strong `If-Match`; HTTP 412 becomes a conflict instead of overwrite (`OrionGoogleDriveProfileStoreModule.kt:182-239,401-425`).
- If local and cloud My List both changed since the last checkpoint, automatic sync stops and requests explicit review (`MyListSteadyStateSync.tsx:307-317`). Pulls re-read and re-check the local signature before replacing local state (`MyListSteadyStateSync.tsx:402-446`).
- There is no broad exponential retry loop for arbitrary Drive failures. Transient recovery comes from stable-read retries, post-write read-back retries, the foreground heartbeat, and later user/manual attempts.

### 8.6 Logout and deletion behavior

Mobile offers two distinct actions:

- **Disconnect Orion Cloud** revokes the Drive app-data scope and retains local library data (`AccountSettingsContent.tsx:127-140,280-299`).
- **Disconnect Google** clears the local account session/token cache/Credential Manager state and retains local data (`AccountContext.tsx:100-140`; `AccountSettingsContent.tsx:302-324`).

Desktop logout clears stored tokens/profile (`googleAuthIpc.js:426-435`). No current production path deletes the PortableProfileV3 Drive document or deletes the user's Google account. WAVEN must use the same language and behavior unless an explicit ecosystem-wide account/data-deletion design is approved.

### 8.7 Desktop versus Mobile

| Concern | Desktop | Mobile |
|---|---|---|
| Identity flow | Browser OAuth code + PKCE + loopback | Android Credential Manager Google ID |
| Drive grant | Combined OAuth scopes include `drive.appdata` and `drive.file` | Separate Play Services authorization for only `drive.appdata` |
| Token persistence | Access/refresh tokens in Electron secure-store file | Access token native-only, memory-only; reacquired after restart |
| Cloud transport | Electron main-process fetch | Kotlin native `HttpURLConnection` on one IO executor |
| Renderer/JS exposure | profile JSON and revision tags through constrained IPC | profile JSON and revision tags through RN bridge |
| Local data | Desktop application stores/SQLite/localStorage depending domain | MMKV app-private storage and Expo SecureStore for account snapshot |
| Conflict model | Shared PortableProfile semantics and conditional Drive writes | Same contract plus mobile UI/policy adapters |
| Legacy paths | old `orion-sync-manifest.json` and Drive media-locker IPC still exist and are fenced/separate | no equivalent legacy manifest/media-locker path in the profile adapter |

## 9. One real Orion Cloud sync operation traced end to end

Scenario: the signed-in Android user's local My List changes, the last checkpoint proves the cloud copy has not changed, and Orion safely pushes the local change.

1. Google sign-in returns a Google subject as `accountId` without exposing the ID token (`OrionGoogleIdentityModule.kt:66-83`).
2. `AccountContext` persists the normalized account snapshot in SecureStore (`AccountContext.tsx:73-86`; `accountSessionStore.ts:52-55`).
3. `LibraryProfileProvider` binds the library to the matching account-scoped MMKV adapter and declares it cloud-eligible only when profile IDs match (`LibraryProfileContext.tsx:39-56,114-150`).
4. `MyListSteadyStateSyncProvider` derives a portable preview and deterministic local signature from library state (`MyListSteadyStateSync.tsx:61-110`).
5. The reconciler rejects unsafe items, offline state, missing native authorization, or a mismatched account before touching cloud data (`MyListSteadyStateSync.tsx:135-197`).
6. `runPortableProfileCloudTransaction(profile.accountId, ...)` serializes My List, Watched, and Viewing Activity transactions sharing the same document (`portableProfileCloudTransactionCoordinator.ts:11-41`; call at `MyListSteadyStateSync.tsx:222`).
7. Play Services verifies `drive.appdata` authorization and refreshes the native-only access token when already granted (`MyListSteadyStateSync.tsx:230-239`; `OrionGoogleDriveAuthorizationModule.kt:103-134`).
8. `GoogleDriveCloudProfileStore.read` calls the native profile store, parses JSON, and validates PortableProfileV3 (`googleDriveCloudProfileStore.ts:113-158`).
9. Native code hashes the profile key, lists `appDataFolder`, refuses duplicate files, and returns a metadata/body snapshot whose revision stayed stable (`OrionGoogleDriveProfileStoreModule.kt:81-119,257-363`).
10. My List code confirms the remote `profileId`, validates the namespace, and compares local/cloud signatures to the last MMKV checkpoint (`MyListSteadyStateSync.tsx:249-317`; `myListSyncCheckpoint.ts:1-61`).
11. With local changed and cloud unchanged, the domain builder creates a candidate that updates only `myList` while preserving other/unknown namespaces (`MyListSteadyStateSync.tsx:320-345`; `portableMyList.ts:279,342-343`).
12. `store.write` sends the candidate with the fresh remote revision tag (`MyListSteadyStateSync.tsx:343-346`; `googleDriveCloudProfileStore.ts:160-187`).
13. Native code refuses a missing/mismatched file or revision and performs a strong `If-Match` update; 412 returns `conflict` (`OrionGoogleDriveProfileStoreModule.kt:160-239,401-425`).
14. JavaScript repeatedly reads the cloud copy until the My List namespace semantically matches the candidate; only then does it save a new verified checkpoint (`MyListSteadyStateSync.tsx:356-398`; `cloudProfileReadBackVerification.ts:23-34`).
15. Later local changes, foreground activation, or the 20-second heartbeat begin a fresh read/decide/write cycle using a new Drive revision tag (`MyListSteadyStateSync.tsx:542-576`).

This is an implementation trace, not a live production-account network test. No user credentials or tokens were accessed during the audit.

## 10. Orion Cloud component classification for WAVEN

| Component | Classification | WAVEN treatment |
|---|---|---|
| Google subject as ecosystem account ID | **REUSE** | Same account identity across Orion and WAVEN; verify Mobile `uniqueId` equals Desktop `sub`. |
| `CloudProfileStore` interface | **REUSE** | Consume unchanged from `@orion/shared/api`. |
| PortableProfileV3 envelope, revisions, timestamps, tombstones | **EXTEND** | Preserve schema behavior and add explicit WAVEN namespace contracts. |
| Unknown-namespace round-trip rule | **REUSE** | Mandatory compatibility invariant for mixed Orion/WAVEN client generations. |
| Google Drive `appDataFolder` backend | **SHARE** | Same hidden profile document and profile key; no second cloud document ecosystem by default. |
| Mobile Google identity native plugin | **ADAPT** | Extract/parameterize hard-coded Orion package/module/build text before WAVEN use. |
| Mobile Drive authorization/profile-store plugin | **ADAPT** | Share transport and token isolation through an app-neutral local plugin package. |
| Desktop Drive transport | **SHARE** (contract) | Preserve behavior; Node/Electron implementation stays Desktop-only. |
| Per-profile cloud transaction coordinator | **SHARE** | Move platform-neutral serialization into `@orion/shared` or a cloud package. |
| Stable read, conditional write, semantic read-back | **REUSE** | Non-negotiable safety semantics. |
| MMKV storage adapter | **ADAPT** | Reuse package generation; use WAVEN-specific instance/keys and account scopes. |
| Expo SecureStore account snapshot | **ADAPT** | Reuse lifecycle pattern with ecosystem-neutral key/version migration. |
| My List/Watched/Viewing Activity policies | **NOT APPLICABLE** | Cinema data remains Orion-specific; reuse only tested policy patterns. |
| WAVEN favorites, playlists, listening history, playback state, preferences | **WAVEN-SPECIFIC** | Define new schemas, merge rules, retention, privacy, and size budgets. |
| Legacy `orion-sync-manifest.json` | **NOT APPLICABLE** | Do not build WAVEN on the fenced legacy path. |
| Desktop Drive media locker (`drive.file`) | **NOT APPLICABLE** initially | Do not imply music upload/storage without a product/legal/backend decision. |
| Account/data deletion | **EXTEND** ecosystem-wide | Current code supports disconnect/revoke, not cloud-document/account deletion. Do not implement WAVEN-only semantics. |

## 11. Recommended WAVEN participation in Orion Cloud

### 11.1 Shared architecture

Create a reusable local package boundary before Cloud feature work, for example:

```text
packages/orion-cloud/
  identity contracts
  PortableProfile transaction coordinator
  checkpoint/read-back utilities
  error taxonomy and redaction

packages/orion-cloud-expo-plugin/  (or a parameterized plugin under packages/)
  Google identity Android bridge
  Drive authorization Android bridge
  Drive appDataFolder profile transport
```

The package name is illustrative; a later implementation task should select it consistently with repository conventions. The essential decision is one shared implementation, not copied `withWavenGoogle...` forks.

### 11.2 WAVEN namespaces

Reserve unambiguous music namespaces rather than reusing Cinema names:

- `wavenFavorites`
- `wavenPlaylists`
- `wavenListeningHistory`
- `wavenPlaybackState`
- `wavenPreferences`

Before any write, add schemas/normalizers/builders and tests under `packages/shared/src/types` and `packages/shared/src/api`. Each domain builder must spread the complete base namespace object and replace only its own namespace. Old Orion clients must round-trip new namespaces byte-for-byte as opaque JSON.

Do not sync ephemeral provider URLs, signed/expiring streams, cookies, OAuth tokens, local file paths, downloaded media, artwork binaries, or native queue handles. Sync stable provider references and user intent only when the provider identity is portable and legal to retain.

### 11.3 Account and device behavior

- WAVEN sign-in uses the ecosystem Google subject and its own local display/session snapshot.
- Orion Cloud consent in WAVEN requests only `drive.appdata` unless a later approved feature requires another scope.
- Local-only use remains supported when signed out or offline.
- Account switching must bind a distinct local profile before any sync and must never expose one account's music library to another.
- `updatedBy` should become a privacy-safe device-install identifier or an explicitly defined writer ID if WAVEN requires device-level diagnostics; current Mobile writes often use account ID, which does not identify the device.
- Logout keeps local data. Cloud disconnect revokes access but does not delete data. Any delete-my-data feature must be defined across Orion and WAVEN together.

## 12. Security and privacy requirements

- Never place secrets, access tokens, refresh tokens, cookies, provider credentials, or signing material in Expo public variables, JavaScript logs, PortableProfile, or checked-in configuration.
- Keep Android ID and Drive access tokens native-only. Only normalized profile fields, validated PortableProfile JSON, and opaque revision tags may cross the bridge.
- Validate the ID token/audience architecture before treating the subject as authenticated server-side identity. Current Mobile code extracts Credential Manager fields locally and has no independent Orion backend verification step.
- Retain the least-privilege `drive.appdata` scope. Do not copy Desktop's broader `drive.file` media-locker scope into WAVEN.
- Use app-private MMKV for non-secret library data and Expo SecureStore for the session snapshot. Decide whether sensitive listening history requires encrypted MMKV or a different at-rest policy before enabling Cloud sync.
- Redact URLs, tokens, email addresses, provider headers, and payload content from diagnostics. Log stable error codes and domain names only, following `reportGoogleDriveCloudFailure`.
- Keep the 2 MiB profile ceiling visible in schema budgets. Large music histories/playlists need retention, compaction, or a later backend decision rather than silently exceeding it.
- Review account export/deletion, listening-history privacy, analytics consent, and provider terms before distributed acceptance.

## 13. Offline experience and connectivity resilience requirements

Offline is an intentional WAVEN application mode, not a generic error state and not a synonym for downloaded media.

### 13.1 Offline awareness versus downloads

- **Offline awareness** governs how every screen, provider request, queue operation, playback transition, local mutation, and Orion Cloud action behaves without usable connectivity.
- **Downloads/offline media** governs which audio has been intentionally and lawfully stored on the device.
- A remote track is not offline-capable merely because its metadata or an expired stream URL is cached.
- Phase 8 owns connectivity resilience. Phase 11 retains conditional download/media storage work.

### 13.2 Required Orion Mobile offline audit

Before WAVEN offline implementation, perform a read-only trace of current Orion Mobile behavior using local code evidence. Determine its NetInfo/network provider, reachability logic, state owner, subscriptions, app-lifecycle behavior, provider availability, retries, recovery, cache behavior, UI indicators, error taxonomy, Cloud pause/resume, pending local operations, and downloaded/local-library handling.

Trace one real code path end to end:

`ONLINE → connectivity lost → app recognizes loss → remote work adapts/suspends → local features remain usable → connectivity returns → provider/network state revalidates → pending work resumes`

Classify each discovered component as **REUSE**, **ADAPT**, **SHARE**, **REIMPLEMENT**, or **NOT APPLICABLE**. Cinema-specific assumptions must not be copied into WAVEN.

### 13.3 Authoritative connectivity model

WAVEN must expose one lifecycle-aware connectivity service consumed by all features:

| State | Meaning | Required behavior |
|---|---|---|
| `ONLINE` | Usable internet and required services are available. | Normal network and Cloud operations. |
| `OFFLINE` | No usable internet is available. | Pause remote work, retain local operation and pending intent. |
| `RECOVERING` | Transport returned; WAVEN is revalidating internet, providers, Cloud, and pending work. | Sequence recovery and suppress request storms. |
| `DEGRADED` / provider unavailable | Internet works, but one or more music services are unavailable or unhealthy. | Keep healthy/local capabilities active and explain the limited provider. |

Wi-Fi state alone is not connectivity truth: mobile data or another transport may still provide usable internet. Screens must not invent independent offline booleans.

### 13.4 Required offline behavior

When WAVEN becomes `OFFLINE`, it should:

- recognize loss promptly without tight polling;
- preserve navigation, scroll position, current listening context, queue, Library, favorites, playlists, history, and preferences;
- keep downloaded/local tracks playable and continue already-buffered/local playback where the native engine can do so safely;
- identify tracks requiring network resolution before the user reaches a dead end;
- suppress repeated provider calls and raw transport errors;
- use cached metadata/artwork and intentional cached Home/Library surfaces;
- present explicit offline states for Search, fresh discovery/charts, uncached artist/album detail, uncached lyrics, new stream resolution, and Cloud refresh;
- pause Orion Cloud reads/writes without discarding supported local mutations;
- durably retain pending synchronization intent where required;
- avoid blank full-screen failures when meaningful local content remains.

### 13.5 Reconnect and recovery sequence

Recovery must be ordered rather than fanning out every pending request at once:

`connectivity detected → RECOVERING → verify usable internet → revalidate provider health → restore network services → resume Orion Cloud → reconcile supported queued mutations → refresh stale data by policy → re-resolve playback only when necessary → ONLINE`

Recovery must preserve the current screen, navigation stack, queue, playback, scroll position, and local data where technically possible. Dedupe keys, serialized Cloud transactions, cancellation, backoff, and freshness rules must prevent duplicate calls, duplicate Cloud writes, duplicate playlist/favorite/history events, and network-flapping corruption.

### 13.6 Offline UX

Use WAVEN's premium black/silver/blue language: restrained status indicators, local/download availability badges, explanatory disabled actions, cached surfaces, and temporary recovery messaging. Do not use red for ordinary disconnection; reserve it for actual failure or destructive states. Offline and recovery announcements must work with TalkBack, large text, and reduced motion.

### 13.7 Orion Cloud while offline

There is no WAVEN Cloud. While offline, local state remains authoritative for the local device, Cloud work pauses safely, and supported mutations remain durable. On reconnect, WAVEN must re-read remote state where required, retain optimistic concurrency and semantic read-back verification, preserve conflict review, isolate account switching, and never let stale remote state silently replace newer local state.

### 13.8 Required connectivity validation matrix

Later development-build and release-candidate testing must cover: normal Wi-Fi; Wi-Fi disabled while mobile data remains usable; no alternate network; airplane mode; loss during browsing, Search, album/artist loading, playback, and next-item resolution; reconnect during playback; repeated flapping; background/relaunch/process kill while offline; reconnect after process restart; offline favorite/playlist mutations; Cloud reconnect; provider outage with internet still working; cached artwork; local/downloaded playback if supported; and `ONLINE → OFFLINE → RECOVERING → ONLINE`.

Expo Go may validate visual state transitions only when dependencies permit. It cannot establish native lifecycle, playback, Cloud bridge, or release acceptance.

## 14. Phased implementation roadmap

Phases 0–7 are accepted. Phase 6's search-to-play exit was implemented and physically validated under the owner's conditional closure authorization. Phase 7 was authorized under `AUTH-P07-2026-10-01` and is now accepted under `ACK-P07-2026-10-02`; Phase 8 is ACCEPTED WITH DOCUMENTED RESIDUALS under `ACK-P08-2026-10-19` and the explicit exception in section 15.5, after authorization `AUTH-P08-2026-10-02`. Phase 9 and every later phase require separate authorization. Historical records remain intact. Current accounting is governed by section 15.

### Phase 0 — Evidence and version baseline (evidence complete; audit ACK accepted)

1. **Goal:** Freeze Orion Mobile, Music Planet, Orion Cloud, and workspace evidence.
2. **Scope:** root manifests/workflows; `apps/mobile`; Music Planet; shared PortableProfile and Cloud adapters.
3. **Deliverable:** sections 3–12 of this master plan and exact baseline tests.
4. **Backend:** Google identity plus Drive `appDataFolder` confirmed.
5. **Risk:** generated Android is ignored; evidence must be refreshed when durable inputs change.
6. **Validation classification:** **CODE / AUTOMATED TEST EVIDENCE**.
7. **Exit:** exact matrix and no-unplanned-upgrade decision recorded.
8. **Out of scope:** dependency changes, live account access, implementation.

### Phase 1 — WAVEN project foundation (complete; ACK accepted)

1. **Goal:** Provide a clean Android-first Expo workspace in the monorepo.
2. **Scope/files:** `apps/waven/{package.json,app.json,eas.json,metro.config.js,tsconfig.json,app,src,assets,tests}` and lockfile registration.
3. **Reuse:** Orion Mobile versions and Metro/TypeScript/EAS patterns; `@orion/shared`; brand heading grammar.
4. **New code:** independent app identity, tokens, foundation screen, boundaries, and tests.
5. **Backend:** none contacted.
6. **UI/native:** supplied icon and black/silver/blue foundation. Confirm Expo 57 Hermes/New Architecture output in the first reviewed native generation.
7. **Validation classification:** completed **CODE / AUTOMATED TEST EVIDENCE** and **EXPO GO DEVELOPMENT EVIDENCE**.
8. **Recorded evidence:** TypeScript passes; 4/4 foundation tests pass; web export succeeds with 1,115 modules; the recorded foundation baseline previously passed Expo Doctor 20/20. A current online Expo Doctor recheck reports 19/20 because Expo's remote SDK metadata now recommends newer SDK 57 patch versions for 11 Expo packages; all other checks pass and no dependency upgrade is authorized because WAVEN intentionally remains on the proven Orion Mobile generation.
9. **Physical evidence:** Samsung Galaxy S24 Ultra (`SM-S928B/DS`), Android 16 / One UI 8.5, Expo Go client `57.0.9` with SDK 57 support. Initial launch, foundation rendering, reload, and background/resume all pass. This establishes Phase 1 Expo Go physical evidence only; development-client/native-build, playback, Orion Cloud, offline, signing, updater, and release acceptance remain unestablished.
10. **Exit:** npm recognizes `@orion/waven`; the foundation builds and renders physically without upgrading Orion or the locked WAVEN dependency generation.
11. **Dependencies:** Phase 0.
12. **Out of scope:** providers, playback, Orion Cloud writes, production signing.

#### Phase 1 Completion ACK — `ACK-P01-2026-09-14`

- **Phase:** 1 — WAVEN project foundation.
- **Weight:** 6%.
- **Decision:** `ACCEPTED`.
- **Decision date:** 2026-09-14.
- **Reviewer/owner:** WAVEN project owner.
- **Validated implementation ref:** branch `waven/v1`, commit `ea506630028ca17f3f075a6b9cdae0876b5697fd` (`docs(waven): clarify Orion Cloud terminology`).
- **Dependency-lock identity:** root `package-lock.json` SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`.
- **WAVEN package identity:** `apps/waven/package.json` SHA-256 `B53EA1D5C9B055A515EEEE12861F1C0A13E3A0A396E079B6B3BB0E33E771C29C`; package `@orion/waven`; app package ID `com.okali.waven`; foundation version `0.1.0`, Android versionCode `1`.
- **Master-plan pre-ACK identity:** SHA-256 `479CDB5512AF7EBC61A7C1DADB042EA91C91E88AE357C302A808E33DD84B8748`.
- **Automated evidence:** TypeScript PASS; foundation tests PASS `4/4`; web export PASS with `1,115` modules bundled; npm workspace recognition PASS. The recorded baseline Expo Doctor run passed `20/20`; current online revalidation is `19/20` solely because Expo's remote compatibility metadata now recommends newer SDK 57 patch versions for 11 Expo packages.
- **Dependency-drift disposition:** accepted as a non-blocking validation waiver for Phase 1. WAVEN remains on the exact proven Orion Mobile SDK generation (`Expo 57.0.19`, React Native `0.86.3`, Expo Router `57.0.18`) rather than performing an unplanned patch upgrade during foundation acceptance.
- **Physical matrix:** executed 2026-09-14 on Samsung Galaxy S24 Ultra (`SM-S928B/DS`), Android 16, One UI 8.5, Expo Go `57.0.9`, supported SDK 57. Unique device identifiers such as serial number and IMEIs are intentionally not recorded.
- **Physical scenarios:** initial Expo Go launch PASS; black/silver/blue foundation render PASS; safe-area/layout presentation PASS; Expo Go reload PASS; background → foreground resume PASS; WAVEN remained rendered and usable after resume.
- **Observed development warnings:** one React development warning stated that a state update occurred before a component mounted; no WAVEN crash or failing WAVEN source stack was established. After background/resume, Expo Go also displayed `Cannot connect to Expo CLI` from its development HMR/LogBox path; dismissing it returned to the intact WAVEN screen. These warnings are retained as development-runtime observations and must not be relabeled as native-build or release evidence.
- **Signing/artifact:** not applicable to this Phase 1 Expo Go gate. No signed APK, development-client artifact, updater path, or distributed release acceptance is claimed.
- **Residual risks / deferred proof:** generated Android/Hermes/New Architecture output remains to be reviewed at the first native-generation checkpoint; permanent signing is not configured; Orion Cloud, playback, offline behavior, background audio, MediaSession, updater behavior, and distributed acceptance remain outside Phase 1.
- **UX observation:** the official black-background WAVEN launcher icon remains unchanged; a transparent in-app presentation mark is deferred to the WAVEN design-system work.
- **Acceptance conclusion:** all Phase 1 foundation exit requirements and the required compatible Expo Go physical gate are satisfied. Phase 1 earns its full 6% weight. This ACK does not authorize Phase 2.

### Phase 2 — Shared Orion Cloud Android adapter extraction (complete; ACK accepted)

#### Phase 2 Implementation Authorization - `AUTH-P02-2026-09-14`

- **Decision:** `AUTHORIZED` for Phase 2 implementation only.
- **Authorization date:** 2026-09-14.
- **Authorized start ref:** branch `waven/v1`, commit `87f352dcd9c0a72cca9478fcda158498587266bd` (`docs(waven): accept phase 1 foundation`).
- **Phase 2 source audit:** completed read-only before authorization. Orion reference source was audited at commit `2c479f70f50e8e2e428ddce743ba60763143eece`.
- **Orion source handoff identity:** `WAVEN-P2-SOURCE-HANDOFF-1.zip`, SHA-256 `DCE21352308047F5EDCB1C8662FC3D9C0210D495163F1DD2697CC0D3BFCFD741`.
- **WAVEN implementation handoff identity:** `WAVEN-P2-WORKSPACE-HANDOFF-1.zip`, SHA-256 `A1507453C1786C7CED584CDF62500D6B86DB4AE667BF7DACAEB392AD8AE96C17`.
- **Implementation sequence:** P2.1 structural extraction with no live Cloud access; P2.2 WAVEN native wiring and read-only visibility proof; P2.3 controlled physical identity/Drive lifecycle only after the preservation gate permits mutation.
- **Cloud Data Preservation Gate:** no live Orion Cloud mutation is allowed during structural extraction. `PortableProfileV3` schema meaning, existing V3 fields, known namespace semantics, unknown namespace round-tripping, tombstones, stable reads, optimistic concurrency, strong conditional writes, read-back verification, profile-key identity, and bounded error behavior must remain unchanged.
- **Native credential invariant:** Google access, refresh, and ID tokens must not cross into JavaScript. Existing native-only token handling is preserved.
- **Existing profile identity:** `orion-primary-profile-v3` and the deterministic `orion-portable-profile-v3-*` Drive file identity must not be renamed or silently replaced.
- **Read-only visibility gate:** before WAVEN is permitted to create or update a primary Orion Cloud profile, a physical WAVEN development build must authenticate the intended account and prove read-only visibility of the intended existing Orion Cloud profile. If that profile is unexpectedly missing, duplicated, inaccessible, or isolated behind a different app-data identity, STOP. WAVEN must not create a replacement profile or perform a write.
- **Controlled-write gate:** any later Phase 2 Cloud mutation requires a recorded preimage/revision, explicit expected delta, conditional write, read-back verification, Orion Mobile regression, and rollback/recovery procedure. Existing production Orion Cloud data must never be used as an uncontrolled mutation target.
- **Historical completion accounting at authorization:** authorization itself earned no percentage. Phase 2 later completed its required gate and was accepted under `ACK-P02-2026-09-14` below.
- **Historical downstream state at authorization:** Phase 3 and later phases were still unauthorized at this Phase 2 authorization checkpoint. Later owner decisions are recorded in their own phase blocks below.

1. **Goal:** Parameterize existing ecosystem behavior without redesigning Orion Cloud.
2. **Likely files:** shared Cloud contracts; a shared/parameterized Android plugin; adapted sources from Orion Mobile Google identity/Drive plugins.
3. **Reuse:** subject identity, native-only token vault, Drive transport, stable read, conditional write, read-back verification, profile-key identity, error codes, and existing PortableProfileV3 preservation semantics.
4. **New code:** app-neutral shared Android module/plugin generation, compatibility wiring, transaction coordination where required, and extraction/regression tests.
5. **Backend:** existing Google ecosystem; any Android OAuth client remains part of Orion Cloud, not a new identity system.
6. **Risks:** hard-coded Orion Mobile assumptions, package/signature registration, module collision, OAuth/app-data identity isolation, accidental shadow-profile creation, token regression, and altered concurrency semantics.
7. **Validation classification:** **DEVELOPMENT BUILD REQUIRED**; **DISTRIBUTED RELEASE ACCEPTANCE REQUIRED** before release.
8. **Tests:** plugin idempotence, generated-native diff, Android compile, Orion Mobile behavior equivalence, identity equivalence, sign-in/authorize/read/revoke/sign-out/offline on device, read-only existing-profile visibility before any WAVEN write, controlled expected-delta write/read-back only after that gate passes, and Orion Mobile regression after Cloud interaction.
9. **Exit:** one shared Orion Cloud Android adapter serves Orion Mobile and WAVEN; no token crosses JavaScript; WAVEN has proven access to the intended Orion Cloud identity without creating a duplicate or shadow profile; existing Orion Mobile Cloud behavior remains regression-green.
10. **Dependencies:** Phase 1.
11. **Out of scope:** WAVEN music namespaces, automatic music sync, PortableProfile schema migration, and unrelated Orion Mobile native systems.

#### Phase 2 Completion ACK — `ACK-P02-2026-09-14`

- **Phase:** 2 — Shared Orion Cloud Android adapter extraction.
- **Weight:** 8%.
- **Decision:** `ACCEPTED`.
- **Decision date:** 2026-09-14.
- **Reviewer/owner:** WAVEN project owner.
- **Validated implementation ref:** branch `waven/v1`, commit `1256d5afeb0decefdd4afb6a2c4ff99d65c1cd8f` (`feat(waven): add controlled Orion Cloud preservation gate`).
- **Dependency-lock identity:** root `package-lock.json` SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`.
- **Validation classification:** development-device/native Orion Cloud validation. Distributed release reacceptance remains required before release and is not claimed by this ACK.
- **Automated evidence:** shared adapter extraction, WAVEN native wiring, lifecycle/recovery, read-only preservation, and controlled-write safety gates passed during Phase 2. The retained Phase 2 regression set was subsequently observed green as `20/20` pre-existing P2 tests when Phase 3.1 began.
- **Physical/device evidence:** accepted on Samsung Galaxy S24 Ultra family hardware running Android 16/API 36. WAVEN authenticated the intended Orion Cloud account, reached the existing `orion-primary-profile-v3` identity through the shared native Google/Drive path, exercised the required authorize/read/revoke/sign-out/offline/recovery lifecycle, and did not create a duplicate/shadow profile. OAuth/access/refresh/ID tokens remained outside JavaScript.
- **Controlled Orion Cloud mutation evidence:** exactly one live, content-identical no-op write was explicitly authorized for Phase 2. It preserved exact payload bytes, SHA-256, byte length, PortableProfileV3 revision, namespaces, and conflict-safe conditional-write/read-back semantics. That authorization was one-time only and is exhausted; no second live Orion Cloud write is authorized by this ACK or by any later phase unless the owner explicitly approves a new mutation.
- **Scope boundary:** no WAVEN music namespace synchronization was enabled; Phase 2 established the shared ecosystem adapter only.
- **Acceptance conclusion:** Phase 2 exit requirements were accepted at the development-device boundary. Phase 2 earns its full 8% weight. This historical ACK does not itself authorize Phase 3.

### Phase 3 — Shared music domain and provider contracts (complete; ACK accepted)

1. **Goal:** Extract only platform-neutral behavior from Music Planet.
2. **Likely files:** shared music types/package plus evidence from models, registry, broker, resolver, queue utilities, and tests.
3. **Reuse:** stable IDs, normalized models, capability/error/ranking contracts, queue transition policy.
4. **New code:** TypeScript contracts, Android-safe provider boundary, fixtures and redaction.
5. **Backend:** only evidence-backed active providers; terms/product review remains a release gate.
6. **Risks:** Node/Electron assumptions, response drift, expiring URLs, inactive sources mistaken for active.
7. **Validation classification:** primarily **CODE / AUTOMATED TEST EVIDENCE**; JavaScript-only provider harnesses may be **EXPO GO SUITABLE** after capability verification.
8. **Exit:** Desktop parity tests and WAVEN consumers agree; no raw URL/secret persistence.
9. **Dependencies:** Phase 1; may proceed alongside Phase 2 only after separate authorization.
10. **Out of scope:** native playback and provider expansion.

#### Phase 3 Completion ACK — `ACK-P03-2026-09-14`

- **Phase:** 3 — Shared music domain and provider contracts.
- **Weight:** 8%.
- **Decision:** `ACCEPTED`.
- **Decision date:** 2026-09-14.
- **Reviewer/owner:** WAVEN project owner.
- **Authorization-history reconciliation:** Phase 3 was separately authorized and completed in the prior development session, but no durable `AUTH-P03-*` token was committed to this plan. This reconciliation does not invent a retroactive authorization token.
- **Validated implementation ref:** branch `waven/v1`, commit `dbfbbec83becbbea453820cea69b9e5387916ee9` (`feat(shared): add music provider registry contract`).
- **Implementation checkpoints:** P3.1 `e0f0aa1e3d7d0bda559207671315db4a933a42eb`; P3.2 `036869f10a4fb584870b8f7c3dad6728def7b563`; P3.3/final `dbfbbec83becbbea453820cea69b9e5387916ee9`.
- **Dependency-lock identity:** root `package-lock.json` SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`.
- **Automated evidence:** P3.1 `25/25` tests PASS; P3.2 `29/29` PASS; P3.3 `33/33` PASS. `@orion/shared` typecheck and WAVEN typecheck passed at each implementation checkpoint.
- **Contract result:** `@orion/shared/music` became the shared owner for normalized music entities, provider descriptors, executable capability contracts, and provider-registry/selection state. `MusicStreamingCapability<TResolved = unknown>` intentionally remained generic so Phase 4 could own the concrete Android playback-source boundary.
- **Provider parity evidence:** the extracted contracts matched the evidence-backed active Music Planet set: Local/Core, YouTube Music, LRCLib, and Spotify Charts. Inactive/legacy source files were not promoted merely because they existed.
- **Security/scope boundary:** application-facing registry snapshots remain descriptor-only; credentials/private configuration are not exposed; raw playback URL persistence, native playback, provider expansion, Orion Cloud music sync, Desktop Electron/Node implementation, and unrelated protected areas remained outside Phase 3.
- **Physical-tier disposition:** Phase 3 is platform-neutral contract work. No separate Android native playback/device claim is made here; the owner accepted code/automated contract parity plus active-provider evidence as the Phase 3 completion boundary. Native playback integration was intentionally deferred to Phase 4.
- **Protected boundaries:** `apps/desktop`, `apps/mobile`, `packages/shared/orion-cloud-android`, and `apps/waven/src/infrastructure/orionCloud` remained unchanged through Phase 3.
- **Acceptance conclusion:** Phase 3 earns its full 8% weight. Accepted WAVEN v1 completion became 26% at this checkpoint.

### Phase 4 — Android playback core (complete; ACK accepted)

1. **Goal:** Build reliable playback before feature-heavy UI.
2. **Scope:** background native audio owner, MediaSession, notification/lock-screen controls, audio focus, headset/Bluetooth commands, lifecycle recovery, queue persistence, JIT source resolution.
3. **Reuse:** queue/navigation policy and stable provider references; never DOM audio/Web Audio.
4. **Risks:** engine choice, OEM restrictions, battery, foreground-service policy, stream expiry.
5. **Validation classification:** **DEVELOPMENT BUILD REQUIRED** for the Phase 4 ACK; **DISTRIBUTED RELEASE REACCEPTANCE REQUIRED** before release.
6. **Tests:** interruptions, background/lock screen, process recovery, media buttons, network loss, 30-minute physical soak.
7. **Exit:** correct queue/player state through backgrounding, interruption, and recovery on representative devices.
8. **Dependencies:** Phase 3; a native need may trigger a documented version review, never an automatic Expo upgrade.
9. **Out of scope:** downloads, visualizer, final player polish.

#### Phase 4 Implementation Authorization — `AUTH-P04-2026-09-14`

- **Decision:** `AUTHORIZED` for Phase 4 implementation only.
- **Authorization date:** 2026-09-14.
- **Reviewer/owner:** WAVEN project owner.
- **Authorized start ref:** branch `waven/v1`, commit `dbfbbec83becbbea453820cea69b9e5387916ee9` (`feat(shared): add music provider registry contract`).
- **Locked architectural boundary:** one WAVEN-owned Android Media3 `MediaSessionService` is the authoritative player/session owner; UI/JS controls it through the native controller boundary. Resolved URI/header leases remain ephemeral and raw provider playback URLs are never persisted. Expo Audio does not own WAVEN playback.
- **Cloud boundary:** Phase 4 requires no Orion Cloud write and does not inherit Phase 2's exhausted one-time mutation authorization.
- **Scope boundary:** authorization covered the native playback core and minimum validation harness only. It did not authorize final player UI, downloads, general offline architecture, WAVEN Orion Cloud music namespaces, or Phase 5.

#### Phase 4 Completion ACK — `ACK-P04-2026-09-14`

- **Phase:** 4 — Android playback core.
- **Weight:** 12%.
- **Decision:** `ACCEPTED`.
- **Decision date:** 2026-09-14.
- **Reviewer/owner:** WAVEN project owner.
- **Final validated implementation ref:** branch `waven/v1`, commit `9eb6738ed7fbf83f269d7feefabbd4b4ed447515` (`test(waven): add self-contained playback validation carrier`).
- **Implementation chain:** P4.1 `a794b1d7250bfcc8a72c24ab98555fbd87593c77` (Media3 playback spine); P4.2 `4ea37c68d06167a461b0e3c8d365add6674eb4fb` (recovery/state); P4.3 `64b6025e4bba086786b67f6f17f3044a0c6cd690` (validation harness); P4.3a `dd08847f781405d6e4f31ea3d07bce4abce8af93` (New Architecture module registration repair); P4.3b `9eb6738ed7fbf83f269d7feefabbd4b4ed447515` (self-contained physical-validation carrier).
- **Dependency-lock identity:** root `package-lock.json` SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`. No automatic framework/toolchain upgrade occurred.
- **Automated/native evidence:** P4.2 retained typecheck and `45/45` tests PASS; P4.3 retained typecheck and `50/50` tests PASS plus fresh Android generation/Media3/native compile; P4.3a source gate passed typecheck and `54/54` tests. P4.3b's bounded source gate passed before its carrier build; this record intentionally does not invent an exact final test count that was not preserved in the handoff evidence. Native Android generation/compile gates proved the single Media3 owner, MediaSessionService, foreground media playback configuration, recovery integration, and Android SDK 36 compatibility.
- **Validation artifact:** `WAVEN-P04-P43B-STANDALONE-64b6025.apk`, 54,724,571 bytes, SHA-256 `D536CED9D13A6EBB141A3F7BF8EB2462B445D6E0BF46026F813A9C2D0ACA79FA`, package `com.okali.waven`. It embeds the Hermes/JS bundle and the explicit physical-validation flag. APK signature verification passed. The filename retains an earlier short SHA because the carrier was built before the later P4.3a/P4.3b checkpoint commits while containing those working-tree repairs. This is development-device validation, not permanently signed distributed release acceptance.
- **App/version disposition:** Phase 4 did not introduce a release-version milestone; the foundation application identity remains `@orion/waven`, package `com.okali.waven`, version `0.1.0`, Android versionCode `1`. Permanent release signing and release-version policy remain Phase 12 work.
- **Physical matrix:** executed 2026-09-14 on Samsung Galaxy S24 Ultra family hardware (`SM-S928B` / `SM-S928B/DS`), Android 16/API 36. Unique device identifiers are intentionally not recorded.
- **Native bridge / source resolution:** self-contained launch reached the real `WavenPlayback` native module and Media3 service. Stable two-item queue loading, `source-unresolved`, HTTP/network taxonomy, JIT source resolution, real duration/state reporting, and audible playback all passed.
- **Playback/session scenarios:** play/pause, next/previous, exact ±15,000 ms seeking, background playback, foreground return, Android notification controls/metadata/progress, lock-screen controls/metadata, MediaSession transport, and Recents-swipe survival all passed. Swiping the WAVEN Activity away left playback and the media notification alive, proving service ownership independent of the UI task.
- **Audio routing/focus scenarios:** permanent media-focus loss yielded and stayed paused; a transient alarm paused WAVEN and automatic resume succeeded after dismissal. Galaxy Buds 2 Pro routing plus Bluetooth play/pause/next/previous passed. Disconnect/becoming-noisy automatically paused without blasting audio through the phone speaker.
- **Recovery/persistence evidence:** stable queue IDs, current index, position, repeat/shuffle, prior play intent, timestamp, and schema were persisted. Diagnostic recovery payload SHA-256 was `DB7F17EE76C39247971EF888F51FD3BDEAAFFEAE245690938A8599D0BFFB7C85`. Raw URLs, headers, resolved-source data, MIME, and ephemeral lease data were absent. Force-stop/process-death recovery restored stable queue/index/position paused with no autoplay and required fresh JIT source resolution.
- **Network/error recovery:** loss of usable network eventually produced a recoverable `network` error with retry semantics. After Wi-Fi returned, playback resumed using the still-valid in-memory lease without persisting that lease across process death.
- **Queue/state controls:** repeat-one and shuffle state changes passed. Stop/clear returned an empty queue, null current item, zero position, and idle state while retaining player preference state as designed.
- **Soak evidence and owner disposition:** the roadmap's original test target above remains a 30-minute physical soak. The actual continuous real-world soak performed was approximately 15 minutes and included background use, app switching, an alarm interruption/resume, WhatsApp/video use, and Galaxy Buds routing without crash, dead session, or lost queue/player state. The owner explicitly declined to rewrite the historical 30-minute target and accepted this approximately 15-minute run, together with the comprehensive scenario matrix above, as the final Phase 4 soak evidence. This ACK does **not** claim that a 30-minute soak occurred.
- **Final physical snapshot:** `error: null`, `buffering: false`, `playing: false`, `repeatMode: one`, `shuffleEnabled: false`, duration `372715` ms, both harness tracks intact, current index `0`, current queue ID `p43-harness-track-a`, position `15363` ms, state `paused`.
- **Residual/release boundary:** the Phase 4 harness/URI/raw-state UI is validation scaffolding, not final WAVEN product UI. Permanent signing, GitHub Preview/Prerelease distribution, clean install/in-place update, and distributed playback reacceptance remain Phase 12 release work.
- **Acceptance conclusion:** the owner accepts the Phase 4 development-device exit boundary. Phase 4 earns its full 12% weight, raising authoritative WAVEN v1 completion from 26% to **38%**. This ACK does not authorize Phase 5.

### Phase 5 — WAVEN design system and navigation (complete; Completion ACK accepted)

1. **Goal:** Deliver Music Planet product intent as a native Android-first WAVEN shell.
2. **Scope:** typed theme tokens, Expo Router groups/layouts, safe area, reusable surfaces, empty/loading/error states, accessibility and reduced motion.
3. **Reuse:** proven Orion Mobile primitives and the Music Planet UX/UI inheritance contract.
4. **New code:** WAVEN black/silver/blue components, native home feed/tabs/stacks, mini-player shell.
5. **Validation classification:** **EXPO GO SUITABLE** for supported UI/JS; later development/release regression remains required.
6. **Tests:** screenshots, responsive layout, TalkBack semantics, large text, contrast, reduced motion, low-end performance.
7. **Exit:** reusable components meet accessibility and performance budgets.
8. **Dependencies:** Phase 1; integrates with Phase 4.
9. **Out of scope:** production playback and final immersive player.

#### Phase 5 Implementation Authorization — `AUTH-P05-2026-09-14`

- **Decision:** `AUTHORIZED` for Phase 5 implementation only.
- **Authorization date:** 2026-09-14.
- **Reviewer/owner:** WAVEN project owner.
- **Authorized start ref:** branch `waven/v1`, commit `3bf3a96df462a01f0773192e970f2f80629094a1` (`docs(waven): reconcile phase 2-4 acceptance`).
- **Completion accounting:** authorization earns no percentage. WAVEN v1 remains **38% complete** until Phase 5 is implemented, validated, and accepted under a separate Completion ACK.
- **Independent visual identity:** WAVEN owns its own black, silver, and WAVEN-blue design language. Orion is an ecosystem-quality reference only and does not supply WAVEN UI layouts, typography, colors, components, or visual tokens.
- **Music Planet inheritance boundary:** Desktop Music Planet remains the primary product-experience ancestor for listening hierarchy, artwork importance, one-player continuity, queue/lyrics/source relationships, state handling, and collection semantics. Desktop sidebar geometry, orbital/cosmic presentation, purple palette, hover/cursor behavior, Electron/DOM/CSS architecture, floating/resizable controls, and Desktop-specific interaction mechanics are not copied.
- **Primary mobile shell:** the Phase 5 shell direction is `Home · Search · Library`. Now Playing is reached through the persistent player and is not a fourth primary tab. Profile/Settings remain outside primary navigation; provider/source management remains secondary rather than occupying a primary tab.
- **Brand presentation:** WAVEN branding is restrained and centered. The preferred wordmark treatment keeps `WAVEN` centered with the `V` carrying WAVEN blue. WAVEN blue remains the interaction/accent color; artwork-derived colors may later influence atmosphere but do not replace WAVEN blue as the UI state color.
- **Startup and sign-in experience:** Phase 5 owns WAVEN's startup presentation and authentication UX: native splash visual treatment, a short responsive WAVEN launch/handoff animation, startup/loading states, welcome/sign-in presentation, Google Sign-In surface and interaction states, accessibility, and the transition into the main application shell. The operating-system splash must remain lightweight and fast; richer motion belongs to the in-app handoff and must not become a mandatory long intro on repeated launches. Phase 5 reuses the already-established Google identity/Orion Cloud authentication plumbing and does not duplicate credentials, native identity modules, or create a second authentication architecture. WAVEN-specific Orion Cloud music synchronization remains Phase 9 scope.
- **Fallback artwork direction:** Phase 5 must establish one coherent WAVEN-owned fallback-art system for missing artwork, using restrained WAVEN identity rather than unrelated synthetic album covers. The same fallback language must be reusable across cards, lists, mini-player, later full-player, lock-screen, and media-notification metadata surfaces.
- **Motion-system requirement:** motion is a Phase 5 foundation requirement rather than deferred polish. WAVEN motion is prioritized as `interaction > spatial > atmosphere`. Phase 5 may establish press/touch feedback, navigation continuity, mini-player expansion foundations, player-state microinteractions, haptics where supported, playing indicators, sheet transitions, and a WAVEN waveform-style playback progress/seek presentation driven by playback position. Real audio-analysis/reactive waveform behavior remains deferred to the later immersive-player phase.
- **Reduced-motion/performance rule:** essential interaction feedback and navigation continuity take priority over decorative atmosphere. Reduced Motion must receive simplified fades/state changes. Battery-saver, thermal-constrained, and lower-capability devices may suppress atmospheric animation while preserving responsiveness and playback control.
- **Responsive-first requirement:** WAVEN must not be designed around the owner's Galaxy S24 Ultra dimensions. Phase 5 must support compact, standard, and large Android phones through density-independent/adaptive layout rules, safe areas, display scaling, large text, gesture navigation, 3-button navigation, unusual aspect ratios, and sensible foldable/tablet behavior. The S24 Ultra is a physical validation device, not a layout template.
- **P4 playback boundary:** the validated Media3 `MediaSessionService` remains the sole authoritative playback owner. Phase 5 UI may consume/control that owner through the existing native boundary but must not create a second player, duplicate queue ownership, persist raw playback URLs, or redesign the validated P4 service architecture.
- **Notification boundary:** Phase 5 may define WAVEN artwork/fallback/icon presentation and future notification-settings UX, but it must not reopen the validated P4 Android media-notification/lock-screen ownership merely for cosmetic reasons.
- **Phase 5 implementation scope:** typed design/layout/motion tokens, responsive application shell, Expo Router structure, safe-area handling, reusable surfaces/components, loading/empty/error patterns, accessibility semantics, Home/Search/Library destination shells, persistent mini-player shell, coherent fallback artwork, and motion foundations.
- **Deferred functional scope:** production Search/provider integration remains Phase 6; Library persistence/favorites/playlists/history ownership remains Phase 7; offline/connectivity architecture remains Phase 8; WAVEN Orion Cloud music namespaces remain Phase 9; final immersive player, lyrics, artwork atmosphere, and richer audio-reactive experiences remain Phase 10; downloads remain Phase 11.
- **Dependency and ecosystem boundary:** this authorization does not approve an Expo/React Native/dependency upgrade, Orion Cloud mutation, Desktop Music Planet modification, Orion Mobile modification, or unrelated protected-area change.
- **Validation approach:** Phase 5 will be intentionally iterative: `implement → run → physically inspect → discuss → refine → lock the slice → continue`. Visual or interaction details may be revised whenever physical use exposes awkward, confusing, static, inaccessible, or insufficiently responsive behavior. Direction is frozen; individual pixels and interaction details are evidence-responsive.
- **Phase boundary:** this authorization covers Phase 5 only and does not authorize Phase 6 or any later phase.


#### Phase 5.1 Published Checkpoint — UI shell foundation

- **Checkpoint:** `5db4d4f01b597d746389ed7f8e766a532df411ed` (`feat(waven): establish phase 5.1 UI shell foundation`).
- **Parent:** `343a5aef9cc5ae589b344ffac251f40c3c84c681` (Phase 5 authorization checkpoint).
- **Publication:** local and `origin/waven/v1` SHA equality independently verified on 2026-09-15.
- **Committed boundary:** exact 19-file P5.1 slice; working tree clean after commit/publication; root `package-lock.json` remained SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`.
- **Automated evidence:** TypeScript PASS; WAVEN automated suite PASS `64/64`; cached diff whitespace validation PASS.
- **Physical UI evidence:** Samsung Galaxy S24 Ultra family device through Expo Go. Persistent black navigation substrate kept route transitions dark; the prior white/washed route flash did not return. The centered WA[V]EN + smaller *Where Music Lives* lockup, animated rounded bottom-navigation selection pill, active icon/label motion, and restrained dark route fade were accepted as the current direction.
- **Home-state clarification:** the P5.1 Home is a truthful first-run / zero-data shell, not the permanent populated Home. The `Start Listening` surface must retire or transform as real history, discovery, library, and playback state arrive in their owning phases. This rule is recorded in `docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md`.
- **Phase accounting:** this checkpoint does **not** complete Phase 5 and earns no partial percentage. Overall WAVEN v1 completion remains **38%** pending a separate Phase 5 Completion ACK.
- **Next bounded Phase 5 slice:** P5.2 owns WAVEN startup/entry/sign-in presentation using the existing Google identity plumbing. It must not create a second authentication system, perform Orion Cloud music synchronization, authorize a new Orion Cloud write, or enter Phase 6 scope.

#### Phase 5.2 Rev4H Visual/Material Checkpoint — historical intermediate record

- **Checkpoint state:** the current P5.2 working boundary remains uncommitted on top of P5.1 checkpoint `5db4d4f01b597d746389ed7f8e766a532df411ed`; no P5.2 commit or push is claimed by this documentation record.
- **Physical device:** Samsung Galaxy S24 Ultra family hardware through Expo Go for the JS/UI/local-state evidence tier.
- **Entry visual acceptance:** Revision 4C is the accepted Entry visual direction. The cinematic near-full-width irregular blue/silver living waveform, moved-down WA[V]EN lockup, atmospheric black treatment, and existing action hierarchy are approved.
- **Atmosphere acceptance:** Revision 4D is physically accepted. One root-owned WAVEN Atmospheric Canvas continues behind Home/Search/Library content and floating bottom navigation while the black root substrate preserves route-transition safety.
- **Local continuation evidence:** **Continue locally** works physically. Its SecureStore-backed local entry session survives a full Expo Go/app relaunch, and relaunch skips Entry and lands directly on Home.
- **Expo Go Google fallback evidence:** the Google action returns the controlled **“Google Sign-In is not configured for this build.”** message without crashing. This is accepted fallback behavior only; it is not native Google identity acceptance.
- **Home hierarchy lock:** Revision 4F is physically accepted and locked as the current Reference-02 hierarchy: Home identity → dominant artwork-led music surface → Recently Played → Explore → Your Music.
- **Material lock:** Revision 4G is physically accepted and locked as the current restrained WAVEN Glass direction. Revision 4H is physically accepted and locked as the hero-material polish that removes the visible horizontal blue tint band and lets the shared Atmospheric Canvas provide environmental blue.
- **Visual checkpoint disposition:** the Rev4H Home presentation is approved. The current Home material language should not receive arbitrary micro-polish; later functional integration may justify only targeted repairs for newly exposed product issues.
- **Latest technical gate before this documentation reconciliation:** TypeScript PASS; WAVEN automated suite PASS `75/75`; HEAD unchanged at the P5.1 checkpoint; package-lock unchanged at SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`; exact 11-file dirty boundary preserved; no Cloud activity and no playback change. The earlier `74/75` Rev4H run was traced to the stale Rev4G `glassBottomTint` assertion and repaired as a one-file test-contract reconciliation before the final `75/75` pass.
- **Native identity still pending:** real Google identity/sign-in still requires a compatible WAVEN native/development build and physical acceptance. Expo Go cannot establish this evidence tier.
- **Scope protection:** P5.2 identity presentation reuses the existing native Google identity architecture and does not authorize Drive music work, Orion Cloud music reads/writes, a second live no-op write, token exposure to JavaScript, a second authentication architecture, or WAVEN music synchronization.
- **Phase accounting:** P5.2 remains **IN PROGRESS**; Phase 5 remains **IN PROGRESS** with no Completion ACK; authoritative WAVEN v1 completion stays **38%**; Phase 6 remains **NOT AUTHORIZED**.

#### Phase 5.2 Published Completion Checkpoint — entry/sign-in stabilization

- **Checkpoint:** `1dab4ec40e1e93f4d411fcb9ab809b1c78599c3c` (`fix(waven): stabilize phase 5.2 entry handoff`), published after the Rev4H intermediate visual record.
- **Native identity evidence:** on the physical Samsung Galaxy S24 Ultra, a WAVEN native/development candidate completed the real Google account chooser and returned directly into Home through the existing Google identity plumbing.
- **Boundary:** identity presentation stores only WAVEN local entry/display session state. No Google Drive profile read/write, no Orion Cloud music namespace, no second authentication architecture, and no JavaScript OAuth-token exposure were introduced.
- **Evidence classification:** native/development identity acceptance is complete for Phase 5. Permanently signed distributed identity acceptance is **not** claimed here and remains a later release-path gate.
- **Historical-note rule:** the preceding Rev4H section is retained as the accurate state of that earlier intermediate checkpoint; its “native identity pending” statement is superseded by this completion record.

#### Phase 5.3 Published Checkpoint — persistent Mini Player shell

- **Checkpoint:** `3f3cf303375acd11f65169efe839d9247a040b4d` (`feat(waven): add persistent mini player shell`).
- **Accepted behavior:** one compact persistent player observes and controls the existing Phase 4 Media3 owner, presents native metadata, Play/Pause, continuous progress, buffering/error presentation, fallback artwork, and Reduced Motion-safe state transitions.
- **Ownership:** no second audio engine, queue owner, provider layer, Library persistence, offline architecture, or Cloud synchronization was introduced.
- **Physical evidence:** development/native physical validation accepted progress synchronization, Play/Pause, route persistence, and the compact-player presentation. Production-signed acceptance is not claimed.

#### Phase 5.4 Published Checkpoint — accessibility and responsive hardening

- **Checkpoint:** `353301c45acd30aed9f25533724e16ccdb5245a8` (`feat(waven): complete phase 5.4 accessibility hardening`).
- **Automated gate:** TypeScript PASS and WAVEN suite PASS `109/109` at the final P5.4H boundary.
- **Physical lock:** Samsung Galaxy S24 Ultra validation accepted large-text recovery, TalkBack semantics/focus/interactions, true 48dp targets for the audited controls, Android Back history, gesture and 3-button navigation safe areas, continuous title marquee, Reduced Motion behavior, Search placeholder contrast, and the current large-phone geometry.
- **Responsive evidence:** deterministic viewport coverage spans compact through tablet-like widths without claiming fake physical devices.
- **Rotation clarification:** deterministic direct WAVEN launch preserved the user's rotation lock. A prior global Auto Rotate change was traced to the ADB `monkey` launch mechanism, which is no longer used for WAVEN physical acceptance.

#### Phase 5.5A Published Checkpoint — product language and interaction continuity

- **Checkpoint:** `0d949a8aad1863f3dd8bfbc5e0d132f526714079` (`feat(waven): polish phase 5.5 entry and interaction surfaces`).
- **Automated gate:** TypeScript PASS and full WAVEN suite PASS `112/112`.
- **Physical lock:** Samsung Galaxy S24 Ultra accepted product-facing language cleanup, removal of redundant Entry guidance, the atmospheric Entry → Home handoff, WAVEN-black selected/interactive surfaces with blue retained as accent/edge/icon/identity, and the updated Bottom Navigation/Mini Player interaction treatment.
- **Candidate evidence:** physical debug/native candidate SHA-256 `F088E186B12B43B08D6F130AD0ADCC769474B40B8E2C57BB4245DE9B0BE08834`; Auto Rotate remained `0 → 0`; ADB `monkey` was not used.
- **Boundary:** this remains Phase 5 presentation/motion work only. No Phase 6 provider/search implementation, Phase 7 persistence, Phase 8 offline state machine, Phase 9 music sync, or Phase 10 immersive-player scope is authorized.

#### Phase 5.5B Published Closure Checkpoint — Phase 5 closure accepted

- **Checkpoint:** `68d55a57456ace75cd87ab6fdf702aec246409b5` (`chore(waven): complete phase 5 closure audit`), published and remote-verified on 2026-09-16.
- **Closure audit result:** the complete Phase 5 UI/source surface and both canonical WAVEN documents were reviewed after P5.5A. No additional broad visual redesign was required.
- **Search truthfulness:** the pre-Phase-6 Search shell now describes typed input as `YOUR SEARCH · <scope>` rather than claiming that a provider request is already `SEARCHING`.
- **Touch geometry:** Clear Search now uses the same real 48dp minimum target rule established during P5.4 accessibility hardening.
- **Documentation reconciliation:** the master plan and UI/UX contract now preserve the published P5.2–P5.5A evidence chain, native Google development-path acceptance, and the physically accepted WAVEN-black interaction-surface / blue-accent material rule.
- **Automated gate:** TypeScript PASS; full WAVEN suite PASS `116/116`.
- **Physical gate:** Samsung Galaxy S24 Ultra (`SM-S928B`), Android 16/API 36. The final P5.5B native/debug candidate SHA-256 `FD0B3074CC5EA3CFB3ABBC2EC927F53E91771502C7D01C3E27FEDAB876B2BC47` physically passed Search truthfulness and Clear Search touch/alignment review. Auto Rotate remained `0 → 0`, existing app data was preserved, and ADB `monkey` was not used.
- **Physical evidence package:** `WAVEN-P05-P55B-PHYSICAL-PASS-20260916-040535.zip`, SHA-256 `5F84E6240988A9AEB1947EC0F9FDA666EF5D8299D4F2C8CF8940288C05068D68`.
- **Release boundary:** this checkpoint is development/native Phase 5 acceptance only. Permanently signed distribution, clean install/in-place update, updater acceptance, and release-signing continuity remain Phase 12.

#### Phase 5 Completion ACK — `ACK-P05-2026-09-16`

- **Phase:** 5 — WAVEN design system and navigation.
- **Weight:** 7%.
- **Decision:** `ACCEPTED`.
- **Decision date:** 2026-09-16.
- **Reviewer/owner:** WAVEN project owner.
- **Final validated implementation ref:** branch `waven/v1`, commit `68d55a57456ace75cd87ab6fdf702aec246409b5` (`chore(waven): complete phase 5 closure audit`).
- **Implementation chain:** P5.1 `5db4d4f01b597d746389ed7f8e766a532df411ed` (UI shell foundation); P5.2 `1dab4ec40e1e93f4d411fcb9ab809b1c78599c3c` (entry/sign-in stabilization); P5.3 `3f3cf303375acd11f65169efe839d9247a040b4d` (persistent Mini Player); P5.4 `353301c45acd30aed9f25533724e16ccdb5245a8` (accessibility/responsive hardening); P5.5A `0d949a8aad1863f3dd8bfbc5e0d132f526714079` (product language, Entry handoff, black interaction surfaces); P5.5B `68d55a57456ace75cd87ab6fdf702aec246409b5` (closure audit, Search truthfulness, documentation reconciliation).
- **Dependency-lock identity:** root `package-lock.json` SHA-256 `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`. No Expo/React Native/toolchain or dependency upgrade occurred during Phase 5 closure.
- **Validation classification:** Phase 5 UI/JS work used Expo Go-compatible evidence where appropriate and WAVEN native/development builds for identity, playback-connected Mini Player, and final physical acceptance. These tiers are not promoted into permanently signed distributed acceptance.
- **Application identity:** package `com.okali.waven`, application version `0.1.0`, Android versionCode `1`. Phase 5 introduced no release-version milestone or permanent signing baseline.
- **Final automated evidence:** TypeScript PASS and full WAVEN automated suite PASS `116/116` at the final P5.5B boundary.
- **Physical matrix:** accepted on Samsung Galaxy S24 Ultra family hardware (`SM-S928B`), Android 16/API 36, across the Phase 5 iterative validation sequence. Physical coverage included first-run Entry and real Google chooser handoff, Home/Search/Library shell/navigation, Mini Player presentation/control/progress, TalkBack semantics/focus, large text, real touch targets, Android Back history, gesture and Samsung 3-button safe areas, Reduced Motion, continuous title marquee, responsive geometry, Search contrast, product-language cleanup, Entry → Home atmospheric continuity, WAVEN-black selected/interactive surfaces with blue accents, truthful pre-Phase-6 Search presentation, and final Clear Search 48dp geometry.
- **Artifact evidence:** P5.5A candidate SHA-256 `F088E186B12B43B08D6F130AD0ADCC769474B40B8E2C57BB4245DE9B0BE08834`; final P5.5B candidate SHA-256 `FD0B3074CC5EA3CFB3ABBC2EC927F53E91771502C7D01C3E27FEDAB876B2BC47`. Both are development/debug physical-validation artifacts, not permanently signed release artifacts.
- **Cloud/offline boundary:** Phase 5 performed no WAVEN music synchronization, introduced no music Cloud namespace, consumed no new Cloud write authorization, and did not pull Phase 8 offline architecture forward. Existing Google identity plumbing was reused only for identity presentation.
- **Clean-install/update disposition:** not a Phase 5 exit requirement. Permanent signing, GitHub Preview/Prerelease distribution, clean install, in-place update, updater behavior, and distributed reacceptance remain Phase 12.
- **Residual/deferred scope:** provider-backed Search/Discovery/Details remain Phase 6; Library persistence/favorites/playlists/history remain Phase 7; offline/connectivity behavior remains Phase 8; WAVEN music domains in Orion Cloud remain Phase 9; immersive Full Player/lyrics/artwork atmosphere remain Phase 10; downloads/reliability remain Phase 11.
- **Acceptance conclusion:** the owner accepts the complete Phase 5 development-device UI/accessibility/motion boundary. Phase 5 earns its full 7% weight, raising authoritative WAVEN v1 completion from 38% to **45%**. This ACK does **not** authorize Phase 6.

### Phase 6 — Search, discovery, and detail experiences (complete; Completion ACK accepted)

#### Phase 6 Completion ACK — `ACK-P06-2026-10-01`

Phase 6 — Search, discovery, and details; fixed weight **7%**; decision **ACCEPTED**, 2026-10-01; reviewer/owner **WAVEN project owner**. [The durable ACK](../audits/WAVEN-PHASE-6-COMPLETION-ACK-2026-10-01.md) records the original signed metadata/reveal evidence and additional development-device product playback evidence. The owner's instruction to hold closure until search-to-play was implemented and physically validated is satisfied: actual Search → Play song completed `lacy`, and `vampire` completed with Mini Player pause/fresh-source resume. Phase 6 earns 7%, raising completion from 45% to **52%**. SOUR/EP limitations remain accepted. COMMIT NO; PUSH NO.

#### Phase 6 Authorization — `AUTH-P06-2026-09-16`

- **Decision:** `AUTHORIZED`.
- **Decision date:** 2026-09-16.
- **Authorized by:** WAVEN project owner.
- **Starting ref:** branch `waven/v1`, commit `385172a2791f04474262fd7ce31682bd34e9b665` (`docs(waven): accept phase 5 completion`).
- **Starting completion:** **45%**. Authorization starts work but earns no Phase 6 percentage before a later Completion ACK.
- **Authorized scope:** Search, Home/Discovery, artist and album detail experiences, provider-backed pagination/cancellation/caching, attribution, provider health/degraded presentation, and the bounded search-to-play handoff defined below.
- **Required reuse:** shared Phase 3 music contracts/provider registry and the single Phase 4 Media3 playback owner. Phase 6 must not create a second player, duplicate shared music contracts, or expose raw playback URLs/secrets to product UI.
- **Provider boundary:** use only provider-supported capabilities. YouTube Music may supply active metadata/discovery where the existing provider contract supports it; Spotify Charts remains metadata/chart context only unless a later explicit capability change is separately approved.
- **Cloud/persistence boundary:** no WAVEN music namespace writes, no Orion Cloud music synchronization, no Phase 7 Library persistence, no Phase 8 offline state-machine ownership, and no downloadable-media work are authorized by this record.
- **Dependency/toolchain boundary:** no Expo/React Native/toolchain/dependency upgrade is authorized. The pinned WAVEN baseline and package-lock identity remain unchanged unless a separately inspected blocker proves a change necessary.
- **Validation boundary:** pure JS/UI slices may use Expo Go-compatible evidence where appropriate; native provider/network/cache or playback-integration acceptance uses a WAVEN development build. Distributed signed acceptance remains Phase 12.
- **Later phases:** Phase 7 and every later phase remain **NOT AUTHORIZED**.

#### P6.1 Provider runtime foundation

P6.1 begins Phase 6 with the smallest runtime slice that can be reused by Search and Home/Discovery without pulling later phases forward.

- **YouTube Music metadata/dashboard adapter:** WAVEN receives a React Native-compatible, fetch-based adaptation of the published Desktop YouTube Music metadata and dashboard behavior. The slice supports catalog search, continuation, query suggestions, and provider-curated dashboard sections. It deliberately excludes Desktop yt-dlp/stream-resolution machinery, direct playback URLs, and a second audio engine.
- **Provider request broker:** WAVEN owns an application-side request broker with bounded timeout, cancellation, sanitized failure text, and provider-health classification. The broker follows the proven Desktop broker/health concepts while remaining independent of Electron, Desktop persistence, and provider-preference storage.
- **Discovery runtime:** one WAVEN runtime composes the shared Phase 3 `MusicMetadataProvider`, `MusicDashboardProvider`, entity, descriptor, and health contracts instead of duplicating the music domain. It merges exact provider identities without inventing personalized ranking.
- **Persistence/Cloud boundary:** P6.1 stores no provider preference, search history, Library state, or music Cloud data. Phase 7 persistence, Phase 8 connectivity ownership, and Phase 9 Orion Cloud music synchronization remain outside this slice.
- **Playback boundary:** P6.1 does not resolve streams and does not change the single Phase 4 Media3 owner.
- **UI boundary:** P6.1 does not yet replace the truthful Phase 5 Search shell with live results. `P6.2` owns the first product Search wiring, visible loading/result/empty/error states, and bounded physical validation of real metadata requests.
- **Accounting:** Phase 6 still has no Completion ACK and earns 0%. Current authoritative WAVEN v1 completion remains **45%**.

#### P6.2 Provider-backed Search presentation

P6.2 connects the existing Phase 5 Search surface to the P6.1 discovery runtime without changing playback ownership or pulling later persistence phases forward.

- **Published foundation:** P6.1 is checkpointed and published at `fa2ec829a989b7e0edb93aa61821da49b63d03c0` (`feat(waven): establish phase 6.1 provider runtime`).
- **Live metadata Search:** queries of at least two characters are debounced before calling the shared-runtime-backed YouTube Music metadata provider. In-flight work is cancelled when the query changes or the screen effect is replaced.
- **Truthful product states:** Search presents bounded loading, provider-backed result, selected-scope empty, partial-provider, and generic unavailable/retry states. It does not expose raw provider errors, transport URLs, secrets, or implementation diagnostics.
- **Scope behavior:** Songs, Artists, Albums, and Playlists remain the existing accessible scope controls. A single provider response is projected into the selected scope locally, avoiding a redundant network request when only the scope changes.
- **Artwork and provider presentation:** provider artwork is shown when available with the existing deterministic WAVEN artwork fallback on missing/failed images. The underlying metadata-provider brand stays internal and is not shown on WAVEN product surfaces; Search uses WAVEN-neutral loading, empty, error, and result presentation.
- **Interaction boundary:** P6.2 result rows are deliberately informational. Artist/album detail routing, pagination, suggestions, caching, and the search-to-play handoff remain later Phase 6 slices rather than being simulated here.
- **Playback/Cloud/persistence boundary:** no second player, no stream resolution, no WAVEN music Cloud write/sync, no search-history persistence, and no Phase 7 Library persistence are introduced.
- **Validation boundary:** automated TypeScript/full-suite validation is required before checkpointing. Because this slice is fetch/UI-only, its first physical product check is Expo Go suitable; later native playback handoff still requires the development-build tier.
- **P6.2 physical-review correction:** the first Expo Go review confirmed real provider-backed Songs/Artists/Albums results, scope switching, artwork, and truthful empty-state behavior. It exposed two corrections: upstream provider branding must not appear in WAVEN UI, and list-item playlist page types must remain Playlists rather than falling through to the generic Album normalization path. The first revalidation confirmed both corrections, then exposed one remaining catalog-classification leak: an unknown/profile browse entity could still fall through the generic Album path. P6.2 therefore admits Albums only when the provider explicitly marks an album page or supplies the established `MPRE*` album browse identity; unknown/profile browse entities are discarded instead of mislabeled.
- **Accounting:** P6.2 implementation does not itself award Phase 6 percentage. Authoritative WAVEN v1 completion remains **45%** pending the eventual Phase 6 Completion ACK.

#### P6.3 Provider-backed Home / Discovery presentation

P6.3 is the smallest coherent next Phase 6 slice supported by the published P6.1 dashboard runtime and the accepted Phase 5 Home hierarchy. It connects real dashboard metadata to Home without entering detail, pagination, caching, persistence, or playback scope.

- **Home hierarchy:** preserve the locked Home identity → dominant hero → Recently Played → Explore → Your Music structure. The first-run hero remains an honest Search invitation, Recently Played remains truthfully empty until its later owner exists, and Your Music remains the existing Library shortcut.
- **Provider-backed discovery:** Home calls the existing `wavenDiscoveryRuntime.getDashboard()` path with `AbortController` cancellation. WAVEN owns a **WAVEN-owned stable core Home composition** of **Songs**, **Artists**, **Albums**, and **Playlists** rather than allowing IP/region-dependent dashboard omissions to change the page structure. Real dashboard/catalog entities remain first choice; a missing core lane is backfilled only with a category-directed public discovery query and strict type filtering. Exact provider section titles and attribution are intentionally not rendered on the WAVEN product surface, and exact catalog items may still vary with provider availability.
- **Truthful states:** Home exposes restrained loading, ready, empty, partial/degraded, unavailable, and retry presentation. Raw transport/provider errors, provider names, URLs, secrets, and implementation diagnostics remain hidden.
- **Artwork, icons, and identity:** real artwork is used for real music entities when available, with deterministic WAVEN fallback only for missing/failed entity artwork. Semantic destinations/actions use purpose-built WAVEN icons instead of fallback media artwork; the Songs / Artists / Albums Explore shortcuts follow this rule. Duplicate entities are collapsed by stable provider-owned identity before presentation; no fabricated recommendation labels, listening claims, or provider stats are introduced.
- **Interaction boundary:** P6.3 discovery cards are informational. The existing Explore category shortcuts still route to Search, but artist/album detail routing, search pagination/suggestions, caching, and search-to-play remain later Phase 6 slices.
- **Playback/Cloud/persistence boundary:** no stream resolution, no Media3 ownership change, no second player, no WAVEN music Cloud write/sync, no search/history persistence, no Phase 7 Library ownership, and no Phase 8 offline state ownership are introduced.
- **Validation boundary:** this slice is fetch/UI-only and remains Expo Go suitable for its first physical product check. Native playback behavior is not claimed by that evidence tier.
- **P6.3 physical-review correction:** the first Expo Go Home review confirmed provider-backed discovery rendering, artwork, truthful Recently Played, WAVEN-neutral presentation, and the preserved Home hierarchy, but exposed an artist-classification leak: generic YouTube `UC*` channel browse identities could be promoted to WAVEN Artists even when the provider did not explicitly mark an artist page. P6.3 therefore admits an Artist entity only when the metadata page type is explicitly `MUSIC_PAGE_TYPE_ARTIST`; a `UC*` browse ID alone is not sufficient product semantics.
- **P6.3 second physical-review correction:** revalidation showed that the provider can explicitly mark semantically noisy channel identities such as broad song-collection channels as `MUSIC_PAGE_TYPE_ARTIST` when they originate from the generic `Top songs` fallback search. P6.3 first suppressed Artists from that broad fallback. The later stable-Home correction supersedes the whole-Home `Top songs` fallback entirely: missing lanes now use category-directed queries plus strict type filtering, so Artist discovery is artist-directed evidence rather than a side effect of a song query.
- **P6.3 dashboard diagnostic correction:** the sealed physical diagnostic against `FEmusic_home` returned HTTP 200 with two real `musicCarouselShelfRenderer` shelves (`Indian Music` and `Ghazal & Sufi Essentials`) containing 20 recognized `MUSIC_PAGE_TYPE_PLAYLIST` items. The provider parser correctly classified every item as a Playlist, but `collectCatalogSections()` considered only tracks/albums/artists as usable candidates, so it incorrectly reported zero usable shelves and dropped into the generic `Top songs` fallback. P6.3 therefore treats provider-curated Playlist shelves as valid dashboard discovery and Home can project them into a neutral **Playlists** group. At that repair checkpoint the broad fallback remained a last-resort path rather than replacing a valid playlist-only dashboard; the later stable-Home correction below retires that whole-Home fallback entirely.
- **P6.3 stable-Home + semantic-icon correction:** repeated Expo Go Home re-entry showed that anonymous provider discovery results can reshuffle while WAVEN is running, so provider variability may influence which items are returned but must not own WAVEN's page composition. The attempted VPN comparison is not accepted as region evidence because the VPN did not route Expo Go traffic. P6.3 therefore keeps dashboard/catalog shelves when present, fills only missing Songs/Artists/Albums/Playlists lanes through type-directed public discovery, and removes the generic `Top songs` whole-Home fallback. Explore category tiles also stop using `WavenArtworkFallback`; navigation destinations use dedicated WAVEN semantic icons, while artwork and deterministic fallback artwork are reserved for real music entities. The Songs destination uses explicit paired-note geometry with restrained blue integrated into the second note rather than a font glyph or detached blue marker.
- **P6.3 artist-source + track-classification diagnostic correction:** sealed read-only diagnostics showed that `popular artists` returned 30 renderers but only one explicit `MUSIC_PAGE_TYPE_ARTIST` entity, while `top music artists` returned three explicit Artists and `top artists` added another distinct explicit Artist without requiring generic `UC*` promotion. The same diagnostics confirmed that current `videoId`-first normalization could misclassify explicit `Episode` / `Podcast` rows and `MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE` entities as Songs. P6.3 therefore uses `top music artists` plus bounded `top artists` secondary sourcing for a missing Artists lane, deduplicates those results by stable identity, and rejects explicit non-music semantics before `videoId` track promotion. Legitimate music-video rows remain eligible.
- **Editorial Home labels:** the stable four-type discovery lanes are implementation plumbing, not the final Home information architecture. In the current non-personalized P6.3 UI they render as **Popular Now**, **Popular Artists**, **Popular Albums**, and **Popular Playlists** while preserving the locked Reference-02 geometry, WAVEN Glass, Atmospheric Canvas, hero, Recently Played, Explore, Your Music, and floating navigation. **Trending Now** remains reserved for a later Phase 6 slice with a verified trend/chart signal; P6.3 must not imply chart ranking from generic discovery. Explore remains the explicit Songs / Artists / Albums destination row.
- **P6.3 visual-hierarchy correction:** physical review of the editorial-label checkpoint found that the product-facing discovery shelves still read as oversized grid blocks while the finalized Reference-02 Home uses a denser repeated media-card rhythm. P6.3 therefore adopts the Reference-02 media-card composition itself rather than borrowing only spacing: substantial rounded artwork sits inside one restrained WAVEN glass card with title + one-line metadata below it, the card body has a stable vertical footprint, horizontal gaps are tightened, and the rail deliberately exposes continuation instead of behaving like a fixed three-column grid. Artwork is not simply shrunk. Popular Now / Artists / Albums / Playlists share that shell and the same primary heading hierarchy as Recently Played and Explore, with restrained WAVEN-blue emphasis on the semantic word of multi-word headings. Explore stays icon-led because it is navigation, but its cards inherit the same glass/radius rhythm; Songs receives a cleaner note + WAVEN signal glyph, Artists receives an artist/human + signal glyph rather than a microphone or generic account mark, and Explore's single-word title uses a small waveform/signal mark instead of a detached dot. Recently Played keeps a truthful empty state but inherits the same glass/card family so later real history can flow directly into the shared media-rail language. No nonfunctional play affordance is introduced. This correction is presentation-only: no provider, classifier, playback, detail-navigation, persistence, Cloud, or Phase 7 scope is added.
- **P6.3 Home-integrity + physical-polish correction:** a sealed diagnostic proved that the former `Popular Now` lane was generic search relevance rather than a current ranking signal, and physical revalidation then proved the repaired live chart lane plus the in-memory Home snapshot across Home → Search/Library → Back. P6.3 keeps that evidence-backed chart/session-cache architecture and closes the remaining misses without widening scope: `Popular Now` remains chart-backed with truthful `Discover Now` fallback; unranked lanes remain **Featured Artists / Albums / Playlists**; explicit Refresh bypasses the session cache for that request only and later ordinary Home mounts return to the refreshed snapshot; degraded-ready Home gains a real Refresh action; media cards keep substantial artwork but place artwork/title/metadata in one explicit centered content column with symmetric shell gutters and a slightly tighter vertical body, while the rail itself remains aligned to the Home content gutter; and Explore icons are redrawn from stable View geometry with no nested inner tile, font-glyph dependency, detached identity dot, or artist-mask artifact. No playback, detail navigation, Phase 7 persistence, Cloud, or offline ownership is introduced.
- **P6.3 selective WAVEN Glass refinement:** after the V2 geometry seal, Home receives a bounded material pass using only the existing Expo/RN stack. Media cards keep crisp artwork and gain the light glass tier: translucent near-black shell, very restrained WAVEN-blue tint, quiet inner edge, and refined top edge. Explore, Recently Played empty state, Home discovery states, and Your Music use the medium utility-glass tier. The hero and chart/session-cache/provider behavior remain unchanged. No `expo-blur`, `BlurView`, dependency upgrade, playback/detail behavior, persistence, Cloud, or later-phase ownership is added.
- **P6.3 final atmospheric micro-polish:** the final physical visual pass keeps the accepted hero and selective-glass hierarchy while translating the supplied background reference into WAVEN-native cyan/blue, navy, and cool-silver atmospheric fields. The Songs shortcut is reduced to one simple geometric note, Artists/Albums remain unchanged, media artwork scale remains fixed, card vertical rhythm tightens slightly, and the horizontal rail exposes more of the third card without changing its leading alignment or entity semantics.
- **P6.3 Completion ACK — 2026-09-17:** **ACCEPTED / LOCKED at the current evidence boundary.** Physical Expo Go review on the project test phone accepted the final Home visual system: WAVEN atmospheric background, restrained selective glass, centered Reference-02 media-card family, increased continuation peek, final Songs/Artists/Albums shortcut icon grammar, truthful chart-backed **Popular Now** with **Discover Now** fallback, and the existing **Featured Artists / Featured Albums / Featured Playlists** labels. The earlier physical Home → Search/Library → Back check remains the accepted evidence for one-session Home snapshot continuity; the final atmospheric pass did not alter chart or cache behavior. TypeScript validation and the complete WAVEN automated suite are green at **141/141** for this accepted revision. Expo Go evidence closes this fetch/UI P6.3 slice only; it does not claim native playback, signed-distribution, or release-path acceptance.
- **Accounting:** P6.3 Completion ACK does not award Phase 6 percentage by itself. Authoritative WAVEN v1 completion remains **45%** pending the eventual Phase 6 Completion ACK. Phase 7 and every later phase remain **NOT AUTHORIZED**.


#### P6.4A Artist + Album detail foundation

P6.4A begins the authorized Detail portion of Phase 6 from the published and locked P6.3 checkpoint `0cc112ffa9b39ae23c5fa365b109e34dd5bb83d2`.

- **Provider detail capability:** the WAVEN YouTube Music metadata adapter adds bounded `getArtist()` and `getAlbum()` browse behavior through the already-shared Phase 3 detail contracts. Artist detail may use one bounded continuation to collect additional provider-returned Songs/Releases. The strict WAVEN Artist/Album classifier remains unchanged; permissive Desktop-only identity shortcuts are not imported.
- **Runtime ownership:** `WavenDiscoveryRuntime` resolves detail through the metadata provider that owns the seed entity source, using the existing provider request broker for timeout, cancellation, sanitized failures, and health recording. No second provider domain or playback owner is created.
- **Routing:** Search Artist/Album rows and Home Featured Artists/Featured Albums cards may open provider-neutral dynamic detail routes. Songs and Playlists remain informational until their separately authorized interactions exist. Provider IDs remain infrastructure route identity and are not displayed as WAVEN product branding.
- **Detail-family foundation:** Artist and Album routes inherit the locked WAVEN Atmospheric Canvas while primary bottom navigation stays hidden. They use one shared detail-shell/list grammar, real artwork with deterministic WAVEN fallback, 48dp Back/Retry actions, cancellation on route replacement/unmount, and generic product-safe error text.
- **Truthful content boundary:** Artist may show real Songs and Albums & Releases returned by the provider. Album may show real ordered Tracks plus artist and loaded track count where available. No fabricated biography, follower/rank/popularity claims, release date, appearances, or related-artist content is introduced.
- **Historical-test reconciliation:** the P6.3 test that originally prohibited Artist/Album navigation is narrowed to the behavior P6.3 actually owns: Home discovery still must not acquire playback, persistence, Cloud, or later-phase ownership. P6.4A may legitimately add detail routing without reopening P6.3.
- **Out of scope:** Follow/Favorite/Save/Add to Playlist, downloads, search-to-play handoff, stream resolution, raw playback URLs, Phase 7 Library/history persistence, Phase 8 offline ownership, Phase 9 Orion Cloud music sync, Phase 10 Full Player expansion, dependency upgrades, and release engineering.
- **Validation/accounting:** TypeScript plus the complete WAVEN automated suite must pass before checkpointing. This foundation does not itself earn Phase 6 percentage. Authoritative WAVEN v1 completion remains **45%** pending the eventual Phase 6 Completion ACK. Phase 7 and every later phase remain **NOT AUTHORIZED**.

1. **Goal:** Expose only provider-supported data through mobile-native UX.
2. **Scope:** Search, Home/Discovery, artist, album, pagination, cancellation, caching, attribution and health states.
3. **Reuse:** active YouTube Music metadata/dashboard, Spotify Charts metadata-only role, broker timeout/health concepts.
4. **Validation classification:** UI and pure JS flows may be **EXPO GO SUITABLE**; native networking/cache integration needs **DEVELOPMENT BUILD**; release flow needs distributed regression.
5. **Tests:** fixtures, response drift, pagination, cancellation, offline/degraded states, low-end performance.
6. **Exit:** search-to-play handoff works without exposing raw playback URLs or secrets.
7. **Dependencies:** Phases 3–5.
8. **Out of scope:** invented personalization or catalog rights.

### Phase 7 — Local Library, favorites, playlists, and listening history (accepted / complete)

#### Phase 7 Authorization — `AUTH-P07-2026-10-01`

- **Decision:** `AUTHORIZED`; decision date 2026-10-01; authorized by WAVEN project owner.
- **Starting ref:** branch `waven/v1`, sealed base `d5299eb672df6d3396247cf15935b6de2ba7e7f1`, uncommitted Phase 6 candidate identified by the `ACK-P06-2026-10-01` draft.
- **Starting completion / weight:** 45% pending Phase 6 exit reconciliation; proposed accepted total 52%; fixed Phase 7 weight 8%; earned 0% until accepted Completion ACK. Implementation authorization is explicit; section 15.4's dependency rule still governs eventual Phase 7 acceptance.
- **Scope:** the Phase 7 requirements below: one versioned local Library repository, favorites, ordered local playlists, bounded meaningful-playback history, history-backed Home Recently Played, local preferences, safe migration/corruption recovery and account isolation. Reuse shared music identities and the single native Media3 owner, including its existing stable queue-recovery record.
- **Storage boundary:** app-private MMKV already installed; no new dependency; anonymous `local` and canonical Google account-ID namespaces; no automatic movement of anonymous data into an account. No Cloud music sync, downloads, second player or Phase 8+ ownership.
- **Acceptance tier:** development-build physical persistence/restart/account-isolation/migration validation plus TypeScript, focused and full-suite gates. Permanent distribution signing is not required. The accepted Phase 6 release remains its own artifact.
- **Accounting / Git:** AUTHORIZED / IN PROGRESS, 0% earned. COMMIT NO; PUSH NO. Phase 8 and every later phase remain NOT AUTHORIZED.

#### Phase 7 implementation and validation checkpoint — 2026-10-01

Phase 6 dependency reconciliation is complete under `ACK-P06-2026-10-01`; current completion is **52%**. The starting 45% figure in the authorization above is historical. One app-private MMKV repository now owns schema-v2 favorites, ordered playlists, bounded meaningful-playback history and preferences, using shared canonical music entities and account-ID namespaces. Controlled native MMKV v1 migration/account-isolation evidence, real product favorite/playlist/history/restart evidence, and the physically inspected reference-adapted Library are recorded in [the durable implementation audit](../audits/WAVEN-PHASE-7-IMPLEMENTATION-VALIDATION-2026-10-01.md) and [UI reference classification](../audits/WAVEN-PHASE-7-UI-REFERENCES-2026-10-01.md). TypeScript PASS; focused 52/52 PASS; full suite 382/382 PASS. This is the requested meaningful implementation checkpoint, not a Phase 7 Completion ACK or owner acceptance attestation. Phase 7 remains **AUTHORIZED / IN PROGRESS**, earns **0%**, and Phase 8+ remains unauthorized.

#### Phase 7 Completion ACK — `ACK-P07-2026-10-02`

On 2026-10-02, the WAVEN project owner explicitly accepted the completed Phase 7 implementation and validation. The separate [durable Phase 7 Completion ACK](../audits/WAVEN-PHASE-7-COMPLETION-ACK-2026-10-02.md) records the development-build physical gate, source/artifact identities, automated results, and residual evidence. Phase 7 is **ACCEPTED / COMPLETE** and earns its fixed **8%**, advancing WAVEN v1 completion from **52% to 60%**. The owner accepts as documented limitations that a live switch between two real Google accounts was not exercised (distinct identities were validated against native MMKV), and that ten already-dirty baseline files have preserved hashes but no recoverable exact pre-change byte copies. No preimage/rollback evidence is fabricated. Phase 6's accepted evidence is unchanged; Phase 8 and later remain unauthorized. COMMIT NO; PUSH NO.

1. **Goal:** Establish versioned local-first ownership before Cloud sync.
2. **Scope:** local schemas/migrations, playlist ordering, favorites, history retention, preferences, queue recovery, corruption handling.
3. **Reuse:** Music Planet data behavior and backup normalization concepts, not Node SQLite.
4. **Validation classification:** model/UI work may be **EXPO GO SUITABLE**; production storage/lifecycle is **DEVELOPMENT BUILD REQUIRED**; migration acceptance is distributed when release-scoped.
5. **Tests:** migration, corruption recovery, large library, account isolation, process restart, uninstall/reinstall expectations.
6. **Exit:** local data is versioned, recoverable, bounded, and portable.
7. **Dependencies:** Phases 3–6.
8. **Out of scope:** Cloud enablement and media upload.

### Phase 8 — Offline awareness and connectivity resilience (accepted with documented residuals)

#### Phase 8 Authorization — `AUTH-P08-2026-10-02`

- **Decision:** `AUTHORIZED / IN PROGRESS`; authorized by the WAVEN project owner on 2026-10-02 after explicit acceptance of the Phase 7 ACK and launcher/data distinction.
- **Starting ref/accounting:** branch `waven/v1`, HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1` plus accepted uncommitted local work; exact before hashes and all 107 dirty-source byte preimages are preserved under `release/waven-phase8-20261002/`. Accepted completion **60%**; fixed Phase 8 weight **8%**, earned **0%** pending its separate owner-accepted Completion ACK.
- **Scope/sequence:** read-only Orion Mobile offline trace and reuse classification; one lifecycle-aware WAVEN connectivity owner; provider/playback/Library/Search/Discovery/Cloud adapters; bounded cached metadata, pending intent and ordered recovery; proper accessible WAVEN product UI; automated/runtime and development-device matrix required below. See [the architecture audit](../audits/WAVEN-PHASE-8-ORION-OFFLINE-ARCHITECTURE-AUDIT-2026-10-02.md).
- **Frozen boundary:** accepted Phases 1–7, native Media3 queue/audio ownership, account-scoped Library, package identities and separate canonical/development data worlds. Retained development MMKV must not be cleared. Any temporary enablement for physical testing is restored afterward; no cross-package migration is authorized here.
- **Exclusions/tier:** no Cloud music enrollment/sync (Phase 9), immersive player/lyrics (Phase 10), downloads (Phase 11), or updater/distribution ownership (Phase 12). Phase 8's development-device acceptance is distinct from its required later signed-distribution regression in sections 14/16; no debug build is relabeled as release evidence.
- **Git/later scope:** COMMIT NO; PUSH NO. Phase 9 and every later phase remain NOT AUTHORIZED. The 2026-10-02 Phase 7/launcher decisions and their evidence remain intact.

1. **Goal:** Make WAVEN intentionally usable through loss, degradation, and recovery of connectivity.
2. **Scope/files:** Orion Mobile offline audit; `src/infrastructure/connectivity`; feature adapters for providers, playback, Library, Search/Discovery, Orion Cloud, pending mutations, lifecycle, and status UI.
3. **Existing Orion behavior reused:** only code-evidenced, classified connectivity/retry/cache/Cloud behavior from the future audit.
4. **New WAVEN code:** one authoritative state machine (`ONLINE`, `OFFLINE`, `RECOVERING`, `DEGRADED`), reachability checks, provider health, recovery coordinator, stale-data policy, pending-intent durability, dedupe/backoff, accessible indicators.
5. **Backend/provider implications:** suspend futile calls; preserve provider-specific degradation; revalidate before replay; never treat cached remote stream references as offline media.
6. **UI/native implications:** cached/local Library, offline queue, explicit Search/Discovery states, next-track availability, restrained messaging, navigation/playback continuity.
7. **Risks:** transport mistaken for reachability, request storms, duplicate mutations, stale overwrite, flapping, OEM lifecycle behavior, false offline/online classifications.
8. **Automated tests:** state transitions, debounce/backoff, lifecycle, stale cache, pending mutation durability, Cloud pause/resume, dedupe, provider outage, repeated flapping.
9. **Expo Go suitability:** suitable only for supported UI and pure JS state simulations; it cannot complete native/offline acceptance.
10. **Development-build physical tests:** the full connectivity matrix in section 13.8, including background/process recovery and native playback behavior.
11. **Distributed acceptance:** release-path regression for offline startup, local playback, mutations, Cloud recovery, and state preservation on the signed GitHub candidate.
12. **Exit criteria:** one state owner; Library works offline; offline-capable tracks play; network-only features explain limits; queue/navigation survive where possible; Cloud pauses safely; pending changes recover; reconnection is automatic and ordered; duplicates/flapping do not corrupt state; development-device evidence exists.
13. **Dependencies:** Phases 4 and 7, with Phase 6 integration; must precede WAVEN namespace enablement in Orion Cloud.
14. **Out of scope:** downloadable-media implementation, pretending remote streams are offline, DRM/catalog infrastructure, or release acceptance from Expo Go.

#### Phase 8 V8.5 implementation checkpoint — 2026-10-18

Phase 8 V8.5 checkpoint, 2026-10-18: bounded playback failure isolation, capability-aware recovery, accepted-release notification/generation protection, and native-driven active-row feedback are implemented. TypeScript PASS; focused 140/140 PASS; complete WAVEN suite 470/470 PASS, including 34 deterministic smoke/repair tests and mounted Home recovery. The isolated Android candidate and exact source/artifact evidence are documented in [the V8.5 report](../audits/WAVEN-V8.5-IMPLEMENTATION-VALIDATION-2026-10-18.md). The owner separately approved r2/r3 installation. Final r3 was installed and hash-verified; substantial physical playback, rapid switching, offline persistence, detail/Search recovery and final ONLINE passed. Protected packages and original network settings were verified unchanged/restored. Explicit manual cases and final owner acceptance remain pending as documented in the report. This is **not** a Completion ACK: Phase 8 remains **AUTHORIZED / IN PROGRESS**, earns **0%**, overall remains **60%**, and Phase 9 onward remains unauthorized. COMMIT NO; PUSH NO.

#### Phase 8 V8.5 R4 owner-review correction checkpoint — 2026-10-18

The owner explicitly did **not** accept R3. R3 source preimages, APK, sealed package, report and pending ACK remain preserved. R4 adds a four-bar native-driver Living Wave driven by identity-filtered Media3 presentation, static pause/Reduced Motion, distinct preparation/buffering/failure states, and per-track React subscriptions. The exact 7738 ms R3 queue wait was reviewed; it followed an already-active discovery operation, so no speculative scheduler change or speedup claim is made. TypeScript PASS; focused 149/149 PASS; full suite 480/480 PASS. The separately hashed R4 APK passes build, signature, native-component and alignment checks but is **NOT INSTALLED**; installation requires new owner approval. Physical motion, audible output and the remaining manual fixtures are pending as classified in [the R4 correction report](../audits/WAVEN-V8.5-R4-OWNER-REVIEW-CORRECTIONS-2026-10-18.md). This is **not** acceptance or a Completion ACK. Phase 8 remains **AUTHORIZED / IN PROGRESS**, earns **0%**, and overall remains **60%**. Phase 9+ remains unauthorized. COMMIT NO; PUSH NO; MERGE NO; TAG NO.

#### Phase 8 R4 physical review / R5 Living Wave cycle checkpoint — 2026-10-18

The owner authorized installation of exact R4. Physical evidence confirms four moving bars, native playback/pause/resume, owner-confirmed audible output, a genuine forbidden-source rejection followed by unrelated playback, and successful same-route retry. The owner also found a cycle-restart glitch; R4 is **not accepted**. [The physical report](../audits/WAVEN-V8.5-R4-PHYSICAL-VALIDATION-2026-10-18.md) records actual results. The bounded fractional-phase/periodic-motion correction [R5](../audits/WAVEN-V8.5-R5-LIVING-WAVE-CYCLE-2026-10-18.md) passes TypeScript, focused 152/152 and full 483/483 tests. The owner separately approved exact R5 SHA-256 `86C9B7B3FEE8DEC0F9B05BF70179F18D475A544826D8396E16C5729B2F9B8330`; it was installed only in Personal user 0's existing isolated validation package and hash-verified. The owner confirmed “Cycles look smooth now” after pause/resume. Physical Reduced Motion/static pause, resumed/background-return cycles, Artist/Album/Search/genre navigation, visible Home releases, Library cold-restart persistence and protected package/settings readback are recorded. Strict initially-empty same-screen Home recovery, supported multi-item skip and usable cellular fixtures remain manual; captured jank, memory growth and queue/discovery waits remain explicit limitations. Motion feedback is **not Phase 8 owner acceptance**. Prior evidence and accepted ACKs remain preserved. No Phase 8 Completion ACK is issued: Phase 8 stays **AUTHORIZED / IN PROGRESS**, earns **0%**, overall stays **60%**, and Phase 9+ remains unauthorized. COMMIT NO; PUSH NO; MERGE NO; TAG NO.

#### Phase 8 R6 discovery recovery repair checkpoint — 2026-10-18

The owner authorized bounded investigation/repair of discovery failure recovery and intrusive warnings. [The R6 review report](../audits/WAVEN-V8.5-R6-DISCOVERY-RECOVERY-2026-10-18.md) distinguishes the unavailable exact owner Jazz HTTP trigger from captured R5 discovery timeouts and reproduced stale-state defects. R6 adds current-category accepted-result subscriptions, genuine validation for pending cached reads, shared cancellable reads, generation-aware health, job-specific incomplete-recovery completion and restrained localized/compact warnings. The global FIFO and playback owner remain unchanged. TypeScript PASS; focused 172/172 PASS; full 503/503 PASS, including 20 new recovery tests and existing R5 Living Wave regressions. The owner separately approved exact r2 SHA-256 `13E192C878213EA822BB69E0CD695598CB1F591152F9D5F213217361604C095C`; it was installed only in Personal user 0's existing validation package and hash-verified. Physical Focus recovered on the same screen without CHECK/navigation before unrelated recovery finished; normal Jazz/Rock, playback during optional degradation, motion/static Reduced Motion/pause, background return and cold-restart Library persistence were observed. Raw motion helper failures and transition reconciliation, significant measured jank/memory, cached Home versus strict initially-empty recovery, and remaining unavailable physical fixtures remain explicit. Protected packages/network/settings were verified unchanged/restored; separate final evidence seal preserves prior archives. Accepted Phases 0–7 and R3/R4/R5 evidence remain preserved. No Completion ACK or owner acceptance: Phase 8 remains **AUTHORIZED / IN PROGRESS**, earns **0%**, overall **60%**. Phase 9+ remains unauthorized. COMMIT NO; PUSH NO; MERGE NO; TAG NO; RELEASE NO.

#### Phase 8 Completion ACK — `ACK-P08-2026-10-19`

On 2026-10-19 the owner explicitly accepted the current development milestone with residual risks and stopped extended optimization. [The separate Completion ACK](../audits/WAVEN-PHASE-8-COMPLETION-ACK-2026-10-19.md) records **ACCEPTED WITH DOCUMENTED RESIDUALS** (normalized `ACCEPTED`) under the previously recorded [EXC-P08-2026-10-19](../audits/WAVEN-PHASE-8-OWNER-EXCEPTION-2026-10-19.md) and section 15.5 amendment. Exact approved R8 F SHA-256 `6D777C09C5F2F7531FA761D78C9A9C7DF40F54EA8E8BB021C604164A76E4C47C` is restored after the already authorized adjacent R7/F comparison and verified in Personal user 0's existing validation package. Final Library1favorite/1playlist/12history and named playlist, native playback context, protected packages/Work, network/animation settings and accepted Phase 6/7 ACK integrity are preserved. Built F TypeScript PASS,237focused/538full PASS; final closeout TypeScript PASS,247focused/539full PASS with only governance/test assertions added. Performance findings remain **KNOWN ACCEPTED RISKS**, unavailable/incomplete physical fixtures **UNTESTED / OWNER EXCEPTION**; no false PASS or signed-distribution acceptance. Phase 8 earns its unchanged 8%, advancing overall **60%→68%**. Earlier dated 60%/in-progress checkpoints remain historical. No further optimization/candidate/installation or Phase 9/V8.6 work; V8.5 development stops. COMMIT NO; PUSH NO; MERGE NO; TAG NO; RELEASE NO.

### Phase 9 — WAVEN domains in Orion Cloud (not authorized)

1. **Goal:** Add music synchronization to the shared Orion Cloud profile safely.
2. **Scope:** WAVEN namespace schemas, mappings, size/retention budgets, merge/conflict rules, enrollment/review UI, offline pending operations.
3. **Reuse:** PortableProfileV3, Drive store, serialized transactions, signature/checkpoint/read-back patterns.
4. **Backend:** the same Drive `appDataFolder` document and global Google subject; no WAVEN Cloud.
5. **Validation classification:** **DEVELOPMENT BUILD REQUIRED** and **DISTRIBUTED RELEASE ACCEPTANCE REQUIRED**.
6. **Tests:** unknown-namespace preservation, Desktop↔WAVEN round trip, two-device conflict, offline edits/reconnect, account switch, revoke, duplicate/corrupt Cloud file.
7. **Exit:** no domain overwrites another; writes are semantically read back; offline intent and conflicts remain safe.
8. **Dependencies:** Phases 2, 7, and 8.
9. **Out of scope:** second identity/backend and media blobs.

### Phase 10 — Full player, lyrics, and controlled atmosphere (not authorized)

1. **Goal:** Deliver WAVEN's defining Music Planet-informed player on the stable native core.
2. **Scope:** mini/full-player continuity, queue, source selection, lyrics, palette, gestures, contrast, motion, all recovery states.
3. **Reuse:** LRCLib plain/synced contract, local LRC parsing concepts, artwork palette behavior, Music Planet interaction semantics.
4. **Validation classification:** UI states may be **EXPO GO SUITABLE**; playback integration is **DEVELOPMENT BUILD REQUIRED**; final behavior is distributed acceptance.
5. **Tests:** lyric timing/seek, rotation, large text/TalkBack, artwork extremes, transitions, reduced motion, lock-screen parity.
6. **Exit:** player is clear, responsive, and continuous across representative devices and lifecycle states.
7. **Dependencies:** Phases 4–9.
8. **Out of scope:** audio-reactive visuals unless a native engine exposes safe, efficient bounded analysis.

### Phase 11 — Downloads, reliability, and performance (not authorized)

1. **Goal:** Harden WAVEN and implement downloadable media only when technically and legally approved.
2. **Scope:** storage quotas, cleanup, integrity, resumability, cancellation, battery/data policy, cache boundaries, soak/performance diagnostics.
3. **Reuse:** Orion Cinema download code only as policy evidence; no Cinema implementation dependency.
4. **Backend/provider:** explicit download authorization, stable source, and rights/product approval are mandatory.
5. **Validation classification:** UI simulations may be **EXPO GO SUITABLE**; filesystem/download/playback needs **DEVELOPMENT BUILD**; durability requires **DISTRIBUTED RELEASE ACCEPTANCE**.
6. **Tests:** partial/corrupt media, low storage, cancellation, restart, airplane mode, quotas, cleanup, long playback soak, low/mid/high devices.
7. **Exit:** approved reliability and performance budgets pass without confusing cache with user-owned downloads.
8. **Dependencies:** Phases 4, 7, and 8 plus product/legal approval.
9. **Out of scope:** general offline awareness (Phase 8), unsupported offline streaming, DRM/catalog infrastructure.

### Phase 12 — Release engineering, WAVEN updater, and distributed acceptance (not authorized)

1. **Goal:** Produce a permanently signed, reproducible direct-distribution candidate and prove install/update behavior end to end.
2. **Scope:** versionName/versionCode policy; permanent signing; secure credential handling; artifact naming; SHA-256 and certificate/build evidence; GitHub Preview/Prerelease workflow and metadata; Orion Mobile updater audit; WAVEN updater discovery/download/progress/error/retry/installer flow; downgrade protection; clean install; same-signature update; migrations; Orion Cloud continuity; evidence collection and stable-promotion criteria.
3. **Reuse:** Orion updater components only after the read-only audit classifies each as **REUSE**, **ADAPT**, **REWRITE**, or **NOT APPLICABLE**.
4. **Backend:** production Google package/signature registration and provider readiness; GitHub release metadata for direct distribution.
5. **Validation classification:** updater end-to-end and release lock are **DISTRIBUTED RELEASE ACCEPTANCE REQUIRED**. A development build may test components but cannot satisfy acceptance.
6. **Tests:** section 17 architecture plus the complete section 18 physical matrix using the exact GitHub artifact family.
7. **Exit:** clean and in-place update paths pass; state/Cloud continuity is proven; evidence is approved before release lock.
8. **Dependencies:** all release-scope phases.
9. **Out of scope:** executing a release without explicit authorization; Orion Desktop rename.

### Phase 13 — Future Orion Desktop Music Planet → WAVEN migration (not authorized)

1. **Goal:** Adopt WAVEN brand/terminology in Desktop without changing proven backend/playback behavior.
2. **Scope:** Desktop routes/navigation, Music Planet UI/theme/icon terminology, package and update identity review.
3. **Reuse:** current Desktop engine and shared domain contracts.
4. **Validation classification:** Android Expo tiers are **NOT APPLICABLE**; require a dedicated Desktop code, runtime, update, visual, and accessibility matrix.
5. **Risks:** Orion shell leakage, provider/playback regression, package/update identity history.
6. **Exit:** functional parity with WAVEN identity and no Desktop regression.
7. **Dependencies:** mature WAVEN brand/system and separate authorization.
8. **Out of scope:** WAVEN v1 Android foundation and initial Android release.

## 15. Phase weighting, completion percentage, and ACK governance

### 15.1 Completion rule

WAVEN v1 progress is milestone-based, not an estimate of effort spent. Each Phase 0–12 has a fixed weight totaling **100%**. A phase contributes its full weight only when every exit criterion passes, its required physical-validation tier passes, its evidence is recorded, and its **Completion ACK** is `ACCEPTED`, subject solely to the explicit Phase 8 owner amendment in section 15.5. Partial implementation, code completion, Expo Go success, or a development build does not earn partial overall percentage.

Apart from the narrow owner-authorized Phase 8 development-milestone exception in section 15.5, the only physical-validation exception is a phase with no runtime/device surface, currently Phase 0. Such a phase may complete through an evidence-review ACK that explicitly records `Physical validation: NOT APPLICABLE`. Phase 8 physical validation is partial with documented owner exceptions, never NOT APPLICABLE. Phase 13 is post-v1 Desktop migration work and has a 0% WAVEN v1 weight; it still requires its own Desktop completion ACK.

**Overall WAVEN v1 completion formula:**

`Overall % = sum of weights for Phase 0–12 whose Completion ACK is ACCEPTED`

If later regression evidence invalidates an accepted phase, its ACK becomes `REOPENED`, its weight is removed from the total, and dependent phase ACKs must be reviewed. Percentages are never advanced merely because calendar time passed or work was started.

### 15.2 Authoritative phase ledger

| Phase | Deliverable | V1 weight | Required final validation before ACK | Current state | Completion ACK | Earned |
|---:|---|---:|---|---|---|---:|
| 0 | Evidence and version baseline | 4% | Code/evidence review; physical N/A | Evidence complete | `ACK-P00-2026-09-14` — ACCEPTED (audit-only) | 4% |
| 1 | WAVEN project foundation | 6% | Compatible Expo Go physical run or WAVEN development-build physical run, plus current automated checks | Automated and Expo Go physical evidence complete | `ACK-P01-2026-09-14` — ACCEPTED | 6% |
| 2 | Shared Orion Cloud Android adapter | 8% | Development-build physical identity/Drive lifecycle; later release regression | Complete; shared adapter and Cloud preservation gate accepted | `ACK-P02-2026-09-14` — ACCEPTED | 8% |
| 3 | Shared music domain/provider contracts | 8% | Contract parity at accepted scope; native playback integration deferred to Phase 4 | Complete; shared music contracts/provider registry accepted | `ACK-P03-2026-09-14` — ACCEPTED | 8% |
| 4 | Android playback core | 12% | Development-build physical playback/lifecycle/MediaSession soak; later release reacceptance | Complete; development-device playback matrix accepted | `ACK-P04-2026-09-14` — ACCEPTED | 12% |
| 5 | Design system and navigation | 7% | Expo Go-compatible physical UI/accessibility matrix or development-build equivalent | Complete; final closure checkpoint `68d55a57456ace75cd87ab6fdf702aec246409b5` published/remote-verified; native Google identity and Phase 5 UI/accessibility/motion matrix physically accepted on the WAVEN development/native path; distributed signed acceptance remains Phase 12 | `ACK-P05-2026-09-16` — ACCEPTED | 7% |
| 6 | Search, discovery, and details | 7% | Physical provider flow and working search-to-play exit; explicit evidence disposition | COMPLETE; product handoff implemented and physically validated | `ACK-P06-2026-10-01` — ACCEPTED | 7% |
| 7 | Local Library, favorites, playlists, history | 8% | Development-build physical persistence, restart, account isolation, and migration | COMPLETE; owner-accepted physical and automated evidence | `ACK-P07-2026-10-02` — ACCEPTED | 8% |
| 8 | Offline awareness and connectivity resilience | 8% | Development-build physical connectivity matrix in section 13.8; explicit development-milestone owner exception in section 15.5 | ACCEPTED WITH DOCUMENTED RESIDUALS | `ACK-P08-2026-10-19` — ACCEPTED under `EXC-P08-2026-10-19` | 8% |
| 9 | WAVEN domains in Orion Cloud | 9% | Development-build physical two-device/account/offline conflict matrix; later release reacceptance | Not started / not authorized | PENDING | 0% |
| 10 | Full player, lyrics, and atmosphere | 7% | Development-build physical player/lyrics/accessibility/lifecycle matrix | Not started / not authorized | PENDING | 0% |
| 11 | Downloads, reliability, and performance | 6% | Development-build physical storage/restart/soak matrix; distributed acceptance if downloads ship | Not started / not authorized | PENDING | 0% |
| 12 | Release engineering, updater, distributed acceptance | 10% | Permanently signed GitHub Preview/Prerelease; clean install and in-place update on physical matrix | Not started / not authorized | PENDING | 0% |
| 13 | Future Desktop Music Planet → WAVEN migration | 0% (post-v1) | Dedicated Desktop runtime/update/UX acceptance | Not started / not authorized | PENDING | 0% |

**Current authoritative WAVEN v1 completion: 68%.** Accepted Phases 0–7 contribute 60%; Phase 8 contributes its fixed 8% under `ACK-P08-2026-10-19` and the narrow prior owner exception `EXC-P08-2026-10-19` / section 15.5: `4% + 6% + 8% + 8% + 12% + 7% + 7% + 8% + 8% = 68%`. Phase 8 is **ACCEPTED WITH DOCUMENTED RESIDUALS**, not all-physical-gates PASS or signed-distribution acceptance. Phase 6/7 ACKs and the two accepted Phase 7 evidence limitations remain unchanged. Phase 9 and every later phase remain unauthorized and earn 0%. V8.5 development stops; remaining release gates stay required at their authorized stage.

### 15.3 Completion ACK record required for every phase

Each phase must end with a durable ACK block in this ledger or an adjacent evidence record containing:

- phase number, name, and fixed weight;
- exact Git commit/ref and dependency-lock identity;
- validation classification and required tier;
- build/artifact identifier, package ID, versionName/versionCode, and signing certificate when applicable;
- automated test report and exact pass/fail counts;
- physical device/API/OEM matrix and execution date;
- Expo Go version or development-build/release artifact identity, as applicable;
- scenario evidence, redacted logs, screenshots/video, defects, waivers, and residual risks;
- clean-install and in-place-update evidence when applicable;
- Orion Cloud/offline continuity evidence when applicable;
- reviewer/owner, ACK ID, decision date, and `ACCEPTED`, `REJECTED`, or `REOPENED` decision.

`ACCEPTED` ordinarily means all phase exit criteria and the required physical gate passed. Section 15.5 explicitly permits the Phase 8 development ACK to normalize to `ACCEPTED` with decision `ACCEPTED WITH DOCUMENTED RESIDUALS`; observed failures and untested fixtures remain distinct from owner acceptance. `REJECTED` leaves the phase incomplete. `REOPENED` withdraws previously earned percentage until regression evidence passes again. A technical test summary without the decision record is not a Completion ACK.

### 15.4 Dependency and release accounting

- Downstream work may begin only when separately authorized; starting it does not change overall percentage.
- A downstream phase cannot receive an ACK while a required dependency is unaccepted unless an explicit, documented exception explains the risk and owner.
- Phase 12 cannot be accepted until all release-scope Phase 1–11 ACKs are accepted or explicitly excluded from the candidate with documented scope.
- WAVEN v1 reaches **100%** only when Phase 0–12 contribute their full accepted weights and the exact signed distributed candidate passes the final physical gate.
- Stable promotion, if authorized, does not retroactively replace Preview/Prerelease acceptance evidence; both records remain traceable.
### 15.5 Phase 8 owner-authorized development closeout exception — `AMEND-P08-2026-10-19`

On 2026-10-19 the WAVEN project owner explicitly stopped extended R7/R8 optimization and accepted the current Phase 8 development milestone with documented residuals. The owner authorized recording the necessary formal exception/amendment before the Completion ACK. [EXC-P08-2026-10-19](../audits/WAVEN-PHASE-8-OWNER-EXCEPTION-2026-10-19.md) records that decision, the precise governance discrepancy, evidence classification and unchanged release obligations.

This is a narrow exception to sections 15.1/15.3 and Phase 8's complete development-device matrix requirement in section 13.8: after final approved F integrity/functional checks and automated evidence are recorded, its ACK may be `ACCEPTED WITH DOCUMENTED RESIDUALS` (normalized `ACCEPTED`), earning the unchanged fixed 8%. Unresolved performance is **KNOWN ACCEPTED RISKS**, never PASS. Unavailable or incomplete physical fixtures are **UNTESTED / OWNER EXCEPTION**, never PASS; historical and deterministic evidence retain their actual tiers. Phase 8 physical validation is partial with owner exceptions, not N/A. The separate ACK/ledger update is required before completion advances from 60% to 68%.

Only the already authorized adjacent R7/F comparison may finish, ending on approved F SHA-256 `6D777C09C5F2F7531FA761D78C9A9C7DF40F54EA8E8BB021C604164A76E4C47C`. No new optimization experiment/candidate, R8 G, R9, Phase 9/V8.6 work or other installation. Preserve Library/playback context, protected packages/Work, network/animation settings, all prior evidence and accepted Phase 0–7 contracts. COMMIT NO; PUSH NO; MERGE NO; TAG NO; RELEASE NO. V8.5 development stops after closeout.

The architecture, official phase names, all fixed weights, later-phase authorization requirements and signed-distribution gates in sections 16–18 remain unchanged. This is not a generic exception policy, release acceptance or waiver of the later applicable connectivity, clean-install/update, migration/account/Cloud, device/accessibility/soak/performance requirements. The owner's next-milestone interests require separate authorization and any necessary master-plan reconciliation; none starts here.

### 15.6 V8.6 owner-authorized enhancement milestone

- Amendment: `AMEND-V86-2026-11-25`
- Authorization: `AUTH-V86-2026-11-25`
- Decision: `AUTHORIZED`
- Milestone: V8.6 Settings, Appearance and Adaptive Experience.
- Starting baseline: accepted V8.5 R8 F.
- Additional roadmap weight: 0%.
- Current authoritative WAVEN v1 completion: 68%.

The owner authorizes V8.6 as a bounded post-Phase 8 enhancement milestone. This prospective authorization supersedes only the previous prohibition on starting V8.6. Historical Phase 8 decisions, evidence classifications, residual risks, fixed phase weights and release obligations remain unchanged.

The November 25 Alienware automated baseline reproduced TypeScript PASS, 247/247 focused tests and 539/539 full regression tests. The original PowerShell summary incorrectly classified the two test gates because it expected TAP output while Node emitted spec-reporter output. Raw logs establish zero failures, cancellations, skipped or todo tests. Fresh physical Android acceptance has not been performed.

#### V8.6 product requirements

- Preserve WAVEN NOIR: black, charcoal, silver and blue.
- Introduce WAVEN HIKARI: pearl white, azure and cyan.
- Introduce WAVEN HIKARI NIGHT: midnight navy, electric blue and cyan.
- No pink.
- Deliver complete original anime-inspired visual experiences through composition, environment, lighting, depth, typography, iconography, materials, transitions and interaction choreography.
- A palette or font substitution alone is insufficient.
- Preserve music-first usability, original WAVEN identity and accepted NOIR behavior.
- Use targeted external references, including Dribbble, under the existing reference acceptance protocol. Do not copy complete external screens or assets.
- Centralize dynamic semantic theme tokens and persistent appearance preferences.
- Follow System maps light to HIKARI and dark to HIKARI NIGHT. Manual selection persists when Follow System is disabled. NOIR remains independently selectable.
- Centralized Settings contains Appearance, Playback, Library, Connectivity, Notifications, Performance and About.
- Settings entry is a top-right control on Home, Search and Library, not a fourth primary navigation tab.
- Provide Jump to Section and an interactive Appearance Studio.
- Motion Intensity supports Subtle, Expressive and Reduced, while respecting system accessibility.
- Performance profiles support Auto, Battery Saver, Balanced and Enhanced.
- Auto may respond to rendering performance, memory pressure, thermal conditions and Android Power Saver, but not battery percentage, charging state or low-battery thresholds.
- Do not expose unsupported or unauthorized functionality as working settings.

#### Permanent interaction requirements

Preserve interaction motion above spatial motion above atmospheric motion. Protect input responsiveness, frame pacing, playback continuity, accessibility and data integrity.

Every major transition requires deliberate ownership, interruption and cancellation handling, responsive geometry, appropriate native/UI-thread execution, lifecycle cleanup and physical review.

The roadmap must retain interactive finger-tracked Mini Player to Full Player expansion and collapse, shared artwork continuity, coordinated player and lyrics transformations, seeking, queue interactions, track-change transitions and predictable Android Back.

Full-player implementation remains Phase 10-owned. V8.6 prepares compatible architecture without implementing unauthorized later-phase functionality.

#### Implementation sequence

- V8.6.0: Architecture and authorization.
- V8.6.1: Theme and preference foundation.
- V8.6.2: Three official theme identities.
- V8.6.3: Centralized Settings.
- V8.6.4: Appearance Studio.
- V8.6.5: Motion and transition integration.
- V8.6.6: Adaptive performance profiles.
- V8.6.7: Cross-screen consistency and refinement.
- V8.6.8: Automated, accessibility and performance validation.
- V8.6.9: Physical Android review and milestone closeout.

Each slice requires a bounded implementation contract and appropriate validation before acceptance.

#### Protected boundaries

Preserve the single native Media3 playback owner, accepted navigation and artwork ownership, scroll restoration, Library/account data, provider contracts, offline behavior, existing dependencies and Orion Desktop/Mobile isolation.

Phase 9 and all later numbered phases remain unauthorized. No generic extension of Phase 8 owner exceptions is granted. V8.6 requires independent acceptance evidence.

COMMIT NO; PUSH NO; MERGE NO; TAG NO; RELEASE NO.

## 16. Android development and validation model

The automated baseline plus three device/distribution tiers are distinct bodies of evidence. A feature can progress through several, but none may be relabeled as a stronger tier.

### 16.1 Code / automated test evidence

Includes typecheck, lint where applicable, unit/integration tests, Expo config validation, Expo Doctor, static checks, and web/export checks when useful. This remains a distinct evidence level and does not replace the device/distribution evidence recorded for later phases.

### 16.2 Tier 1 — Expo Go development testing

Purpose: fast physical feedback for capabilities actually present in the stock Expo Go runtime, such as layout, safe areas, navigation, typography, split-color headings, theme/artwork presentation, pure JS data flows, supported animations, accessible semantics, and Search/Home/Library presentation.

Rules:

- Confirm the installed Expo Go generation supports WAVEN's pinned Expo SDK before relying on it.
- Expo Go is development evidence only—not native dependency, background playback, MediaSession, Cloud bridge, updater, signing, or release evidence.
- Do not weaken production architecture merely to stay inside Expo Go.
- Do not upgrade WAVEN because Expo Go prefers a newer SDK.

### 16.3 Tier 2 — WAVEN development build / development client

Purpose: validate WAVEN's real native dependency graph: custom config/native modules, Google identity and Drive, Orion Cloud bridge, background playback, MediaSession, notifications, audio focus, headset/Bluetooth, lifecycle, storage/filesystem/downloads, native analysis if approved, and updater component integration.

A development build counts as **DEVELOPMENT DEVICE VALIDATION**, never final release acceptance. Review generated native output before locking it. Debug/development signing and adb installation cannot establish release-signed behavior.

### 16.4 Tier 3 — Signed distributed WAVEN candidate

Required production-path chain:

`source checkpoint → automated tests → release build → permanent signing identity → versioned artifact → verification → GitHub Preview/Prerelease → intended install/update path → physical Android device → acceptance evidence → checkpoint lock`

Expo Go, emulator results, debug/development APKs, development clients, unsigned local artifacts, source inspection, and unit tests cannot substitute for this tier.

### 16.5 Feature classification matrix

| Deliverable | Expo Go | Development build | Distributed candidate |
|---|---|---|---|
| Home/navigation/theme/artwork/accessibility UI | Suitable when runtime-compatible | Regression | Required before release |
| Pure JS provider/domain presentation | Conditional | Integration | Required before release |
| Native storage and lifecycle | Not sufficient | Required | Migration regression |
| Orion Cloud Google identity/Drive | Not suitable | Required | Required |
| Background playback/MediaSession/audio focus | Not suitable | Required | Required |
| Offline visual states | Suitable for simulation | Required for real connectivity/lifecycle | Required for release behavior |
| Downloads/filesystem | Not suitable | Required | Required if shipped |
| In-app updater | Not meaningful end to end | Component-only | Required |

### 16.6 Expo/React Native version discipline

Do not upgrade WAVEN because a newer SDK exists, Expo Go prefers it, a tutorial uses it, or a dependency advertises newer APIs. Any proposed generation change must document the benefit and evaluate Orion Mobile, WAVEN, `@orion/shared`, Metro, Expo Router, New Architecture, Hermes, Reanimated/Worklets, MMKV/Nitro, Cloud plugins, Google bridges, playback/MediaSession, Gradle, AGP, Kotlin, JDK, SDK levels, generated-native diff, signing, clean install, in-place update, and physical-device behavior. Orion Mobile must never be upgraded as a WAVEN side effect.

## 17. WAVEN in-app update and GitHub distribution architecture

Direct-distribution builds are expected to support a WAVEN-owned in-app update experience. This is a locked product direction, not current implementation evidence.

### 17.1 Required read-only Orion Mobile updater audit

Before design or implementation, trace current Orion Mobile code end to end and record:

- update-check entry point and trigger policy;
- GitHub/API usage, authentication/rate limits, release versus prerelease selection, and channel logic;
- version comparison, versionName/versionCode, downgrade protection, and eligibility;
- release metadata parsing plus APK asset/architecture/variant selection;
- download transport, progress, cancellation, retry/backoff, interrupted-download recovery, storage, cleanup, and limits;
- SHA-256/signature/integrity validation and failure handling;
- FileProvider/content URI, package installer handoff, install-source permission, same-package/same-signature behavior, and failed-install states;
- updater UI states, completion/relaunch, telemetry/log redaction, and state/schema migration behavior.

Classify each Orion component as **REUSE**, **ADAPT**, **REWRITE**, or **NOT APPLICABLE**. Do not assume a verbatim copy.

### 17.2 Target WAVEN update flow

`existing permanently signed WAVEN → eligible newer GitHub Preview/Prerelease → update details shown → correct APK downloaded → visible progress/cancel/retry/error → artifact verified → Android installer handoff → same-signature upgrade → relaunch on new version → local and Cloud-compatible state verified`

The updater must not accept arbitrary assets, silently downgrade, expose sensitive URLs/tokens in logs, or treat download completion as install success.

### 17.3 Preview/Prerelease channel

The future candidate flow is:

`implementation checkpoint → automated validation → release build → permanent signing → artifact inspection → hashes/certificate/build evidence → GitHub Preview/Prerelease → WAVEN intended updater/install path → physical validation → evidence review → checkpoint lock → optional stable promotion by explicit authorization`

The GitHub artifact family is acceptance truth. An unrelated local APK cannot substitute. Release metadata must identify versionName, versionCode, package ID, minimum supported updater/source version, ABI/variant if relevant, SHA-256, size, Git SHA, release notes, and known issues.

### 17.4 Clean install versus in-place update

Both are required and recorded separately:

- **Clean install:** install the exact signed candidate onto a device without WAVEN application state; validate first launch, permissions, identity/Cloud enrollment, local-only behavior, playback, offline behavior, and updater eligibility.
- **In-place update:** start from a previously distributed same-package/same-signature Preview, discover and install the new Preview through the intended path, then validate startup and all migrations/state.

For storage/schema changes, each release must name the oldest supported source version. Once a permanent signed baseline exists, later acceptance normally includes both the immediately previous Preview and that oldest supported schema source.

### 17.5 State and Orion Cloud continuity across updates

Validate that updates preserve or intentionally reacquire: Google subject association, secure account snapshot, Drive authorization, Orion Cloud checkpoints, WAVEN namespaces, Library, favorites, playlists, policy-bounded history, preferences, queue where promised, offline pending operations, account isolation, logout/disconnect semantics, and Cloud-compatible migrations. No pending local or Cloud operation may be silently lost.

## 18. Distributed physical acceptance gate

- **Minimum initial candidate:** `0.9.0-preview.1` or a higher explicitly approved prerelease. Foundation `0.1.0` is not eligible.
- **Artifacts:** a permanently release-signed universal APK for direct acceptance and, if store delivery remains planned, a release-signed AAB from the same commit/config. Record SHA-256, size, package ID, versionName/versionCode, signing-certificate SHA-256, Git SHA, Node/npm/JDK/Gradle/AGP/Kotlin/SDK versions, and build command.
- **GitHub:** publish the APK/AAB as applicable, manifest/checksums, release notes, known issues, and matrix in a GitHub Preview/Prerelease. Stable promotion requires separately approved acceptance.
- **Clean install:** required on each minimum-matrix device; validate launch/icon, permissions, account/Drive consent, Cloud enrollment, Search-to-play, playback/background controls, offline/local mode, logout, and update discovery policy.
- **In-place update:** required from the previous signed Preview and oldest supported schema; use the actual WAVEN update/install path and prove signature, migrations, Library/queue/history/preferences/checkpoints, OAuth/Cloud continuity, pending offline mutations, and relaunch.
- **Device/API coverage:** Android 10/API 29 or the lowest available device above minSdk; Android 12/13; Android 14; Android 15/16/API 36 where available; at least one low-memory device and two OEM families.
- **Playback/lifecycle:** wired/Bluetooth controls, audio focus/calls, screen lock, background, process kill/relaunch, network changes, long soak, and OEM restrictions.
- **Connectivity:** every scenario in section 13.8, including provider degradation distinct from offline and repeated flapping.
- **Cloud:** sign-in, Drive authorize/reacquire/revoke, account switch, Desktop↔WAVEN push/pull, two-sided conflict, offline mutation/reconnect, duplicate/corrupt file behavior, and namespace preservation.
- **Accessibility/performance:** TalkBack, large text, reduced motion, contrast, low-memory behavior, startup, frame pacing, battery, memory, and data usage.
- **Evidence before lock:** per-device install/update record; screenshots/video for visible flows; redacted structured logs; automated reports; performance/battery/memory results; Cloud fixtures; conflict/recovery proof; updater metadata and verification evidence; crash-free soak; accessibility and security/privacy reviews; explicit owner sign-off.

## 19. Risks, blockers, and open decisions

1. The root lockfile was already modified and TV is untracked. Preserve and review the combined diff before any commit.
2. Node is not pinned at repository root; CI uses 22 while the audited machine used 24.14.1.
3. Generated Android is ignored; native reproducibility depends on exact npm inputs and config-plugin output review.
4. Cloud plugins hard-code Orion names and cannot be copied as-is.
5. Mobile identity is a local Google subject/profile, not a server-verified Orion identity token.
6. Desktop secure storage's base64 fallback must not be reproduced on Android.
7. PortableProfile's 2 MiB limit requires strict namespace, retention, compaction, and history budgets.
8. `updatedBy` does not yet provide reliable privacy-safe device identity.
9. Ecosystem account/data deletion remains unresolved; current behavior is disconnect/revoke while retaining local/cloud data.
10. Music provider implementation is not proof of commercial rights, long-term API stability, or offline/download authorization.
11. The supplied icon lacks alpha; adaptive/monochrome launcher assets require later visual QA.
12. EAS project ID, permanent signing identity, OAuth package/signature registration, distribution details, analytics/crash provider, and privacy disclosure are unapproved.
13. Expo Go availability may drift independently of the pinned Expo generation; compatibility must be checked without forcing an upgrade.
14. Connectivity transport does not guarantee usable internet; false state transitions and flapping could duplicate provider/Cloud work.
15. Offline mutation retention, expiry, replay order, and user conflict messaging need domain-specific policies.
16. Android install-source permission, OEM installer behavior, GitHub API limits, interrupted APK downloads, artifact verification, and signing continuity are updater risks.
17. Losing the permanent signing key would break in-place updates; key custody and recovery policy must be approved before the first distributed baseline.
18. Rollback is constrained by Android versionCode and schema compatibility; it must never be implied without an explicit safe design.

## 20. Historical post-Phase-4 checkpoint (pre-P5 authorization)

> Historical note: this block preserves the state immediately after the Phase 4 ACK, before `AUTH-P05-2026-09-14`. Current Phase 5/P5.2 status is recorded in sections 14 and 15 above.

Phases 0–4 are accepted and the authoritative WAVEN v1 completion is **38%**. The canonical Phase 4 implementation/validation-carrier checkpoint is `9eb6738ed7fbf83f269d7feefabbd4b4ed447515`. The package-lock identity remains `1BF49DED104A676060C78A3B8803778AFF9FCF47F188D18AED48BC5BCA2B0E04`.

Phase 5 is **not authorized** by the Phase 4 ACK. Before any Phase 5 implementation, conduct the dedicated WAVEN UI/UX design-freeze discussion requested by the owner. That discussion should preserve the locked product direction: Music Planet as the primary experience ancestor rather than a Desktop layout template; phone-first black/silver/WAVEN-blue identity; a deliberate WAVEN motion system; mini-player/full-player continuity; touch/gesture/accessibility discipline; and layered artwork-informed atmosphere with reduced-motion, battery, thermal, and low-end fallbacks.

After that design direction is explicitly frozen, Phase 5 still requires a separate owner authorization before source changes begin. No Phase 5 work, Orion Cloud mutation, dependency upgrade, release publication, or Desktop Music Planet migration is implied by this documentation reconciliation.


#### P6.3 Home integrity correction

Physical validation and a read-only live diagnostic proved that the previous `Popular Now` lane was generated from the generic `popular songs` search and had zero exact/title overlap with the captured current global Spotify Top-50 and ListenBrainz weekly comparison sets. Therefore generic search relevance must not be represented as a popularity chart.

Bounded correction:
- adapt the already-proven public global Top-50 chart source into the WAVEN Phase-6 dashboard runtime ahead of general provider discovery;
- reserve **Popular Now** for the chart-backed track section and fall back truthfully to **Discover Now** if the chart source is unavailable;
- rename non-ranked discovery lanes to **Featured Artists**, **Featured Albums**, and **Featured Playlists** rather than fabricating ranked popularity;
- preserve the fetched Home dashboard in an in-memory app-session cache so Back navigation restores the same Home content; only explicit retry refreshes it;
- polish Reference-02 media-card inner padding, width/height rhythm, quieter edge treatment, and Songs/Artists semantic icons.

This remains Phase 6 discovery/caching/presentation work. It adds no Library/history persistence, playback implementation, Cloud writes, offline ownership, or Phase-7 scope. Authoritative WAVEN v1 completion remains **45%** and Phase 7+ remain **NOT AUTHORIZED**.


#### P6.3 final Home atmospheric micro-polish

- Inherit only the supplied reference image's broad atmospheric background composition, not its event/ticket UI or warm coral palette. WAVEN keeps a near-black base with broad cyan/blue, navy, and cool-silver light fields behind primary navigation surfaces.
- Keep the atmospheric fields soft, large-scale, and boundary-free so selective WAVEN Glass can pick up depth without obvious stripes or painted bands. Entry keeps its accepted atmosphere; the new reference translation applies to the primary WAVEN navigation canvas.
- Keep real music artwork crisp and above the atmospheric field. No blur dependency is introduced by this pass.
- Simplify the Explore Songs destination to one clean geometric music-note symbol. Preserve the accepted Artists and Albums icon designs.
- Tighten media-card vertical rhythm slightly while preserving artwork scale, centered artwork-width content columns, equal inner gutters, left-aligned metadata, and the Reference-02 editorial family.
- Narrow the media-card shell slightly so the horizontal rails reveal more of the third card while preserving deliberate leading alignment and next-card affordance.
- Freeze chart selection, provider/runtime behavior, Home session caching, Refresh semantics, playback, persistence, Orion Cloud, and Phase 7+ scope.

#### P6.4B/C Immersive Artist + Album detail visual repair

The first physical Expo Go review of the P6.4A detail routes proved that Artist/Album routing and provider-backed Album population work, but the initial shared detail shell was **visually rejected**. The runtime foundation remains valid; the first-pass large outer hero card and large enclosed track-list slab are not accepted product design.

P6.4B/C therefore performs a bounded presentation repair on top of P6.4A:

- Artist and Album remain one WAVEN Music Detail family but receive distinct hero personalities.
- Real artwork drives a hero-local blurred atmosphere using the existing React Native image/gradient stack. No new blur package or dependency is introduced.
- Crisp Artist portrait / Album artwork stays above the blurred field; the Back control floats over the hero with a real 48dp target.
- Artist uses provider-backed song/release counts, artwork-led song rows, and richer release rows when the provider returns that data.
- Album uses the real album artist + loaded track count and an open ordered track list with repeated placeholder `Unknown artist` metadata suppressed.
- Large outer hero/list cards are removed in favor of continuous editorial composition and quiet separators.
- Search/Home routing, provider detail runtime, cancellation, retry, health behavior, strict entity classification, P6.3 Home lock, playback ownership, persistence, Orion Cloud, offline ownership, and Phase 7+ boundaries remain unchanged.
- Physical Expo Go re-review is required for both one real Artist detail and one real Album detail before visual acceptance.

This repair does not award Phase 6 completion. Authoritative WAVEN v1 completion remains **45%** and Phase 7 and every later phase remain **NOT AUTHORIZED**.


#### P6.4D Entity Reveal + full-bleed detail motion

P6.4D is authorized inside the existing Phase 6 Artist/Album detail boundary after physical review identified navigation discontinuity in the P6.4B/C presentation. It does not reopen P6.3 and does not authorize later phases.

Implementation target:
- measure the tapped Artist/Album artwork at the moment of activation;
- animate that real artwork through one root-owned overlay into the detail hero;
- use the same transition owner from Home, Search, and Artist Albums & Releases;
- reverse the transition on Back when valid origin geometry is recoverable, otherwise fall back to ordinary Back;
- disable competing Artist/Album stack animation while the entity transition owns the handoff;
- replace the remaining floating hero-artwork card with a full-bleed artwork environment;
- retain built-in artwork blur/gradients only, no new blur or animation dependency;
- stage hero/copy/body reveal and use subtle detail-scroll parallax with Reduced Motion bypass;
- request a larger provider detail-header artwork variant without widening provider identity or rights assumptions;
- keep Album ordered tracks and Artist Songs truthful, while presenting Artist Albums & Releases as a horizontal artwork rail that may open the already-authorized Album detail route.

P6.4D remains presentation/routing refinement only. It does not own playback handoff, favorites, follow state, Library persistence, downloads, offline state, Orion Cloud music sync, Full Player, Lyrics, Queue, or any Phase 7+ behavior. Authoritative WAVEN v1 completion remains **45%**. Phase 7 and every later phase remain **NOT AUTHORIZED**.

#### P6.4D Transition Scene motion correction — 2026-09-18

V5 physical review remains **NOT ACCEPTED** for final motion quality. The next bounded repair replaces the mid-flight artwork overlay lifecycle with a root-owned Transition Scene while preserving the already-authorized P6.4D detail scope.

Required invariants:
- complete the forward source-artwork → full-bleed-hero visual transformation before `router.push()` becomes visible;
- restore the previous route underneath a fully-owned reverse Transition Scene before contraction begins;
- interpolate sharp-artwork cover scale/offset explicitly inside a clipping viewport so aspect-ratio changes do not cause repeated `cover` recropping;
- derive target hero geometry from the same responsive layout/safe-area contract as the real Artist/Album detail route;
- coordinate artwork atmosphere, gradients, kind/title copy and destination handoff on one master timeline;
- prefetch existing Phase 6 provider Artist/Album detail at tap time and reuse that in-flight result after route mount when available;
- preserve seed-artwork continuity through handoff and preload any higher-quality provider artwork before swapping;
- retain one UI/System Back controller, Reduced Motion, no competing detail Stack animation, no new dependency, and graceful origin fallback;
- keep content entrances restrained with short bounded stagger rather than serial row-by-row spectacle.

This correction remains Phase 6 presentation/routing work only. It does not authorize playback expansion, Library persistence, favorites, history ownership, offline state, downloads, Orion Cloud music sync, Full Player, Lyrics, Queue, or any Phase 7+ concern. Authoritative WAVEN v1 completion remains **45%** until an explicit Phase Completion ACK.

#### P6.4D Completion ACK — 2026-09-18

**ACCEPTED / LOCKED at the current Expo Go physical evidence boundary.** The final accepted implementation is the V8.1 Artist-mask choreography state layered on the V7/V7.1 Transition Scene and handoff corrections.

Accepted evidence and invariants:
- Artist and Album detail remain one full-bleed WAVEN detail family; Detail presentation itself is unchanged by the final Home-media refinement.
- Forward entity reveal completes the source-artwork → hero transformation before route navigation becomes visible; reverse restores the previous route beneath scene ownership, remeasures the returning origin, and crossfades the landing.
- Sharp-artwork crop interpolation remains explicit and UI-thread driven; seed artwork stays authoritative through handoff and any higher-quality artwork upgrade occurs only afterward.
- Hero copy, metadata, controls, provider-ready content, and loading presentation remain physically stable with Reduced Motion and Android system Back preserved.
- Home discovery media is artwork-first rather than card-shell-first. Artist origins are circular portraits with centered identity text; Album/Song/Playlist origins remain square or softly rounded artwork. The Artist mask uses a dedicated non-linear circle → hero → circle choreography so it opens before becoming oversized and restores circular identity progressively on reverse.
- The current `8`-item discovery-group cap is **not** accepted as a final product ceiling. It remains a bounded current presentation/runtime limit. Phase 6 already owns provider-backed pagination, caching, attribution/health, and deeper Search/Home discovery work; P6.3 explicitly records that its stable discovery lanes are implementation plumbing rather than the final Home information architecture. No cap expansion is required to seal P6.4D.
- The seal requires TypeScript PASS and the complete WAVEN automated suite at **165/165 PASS** on the real workspace.
- No dependency or package-lock change is introduced by this acceptance. No Phase 7+ ownership is authorized.

P6.4D is therefore sealed. This sub-slice does **not** create the Phase 6 Completion ACK and does not advance authoritative WAVEN v1 completion beyond **45%**. Remaining Phase 6 work proceeds under the existing `AUTH-P06-2026-09-16` boundary.

#### P6.5 Search Discovery + Suggestions — candidate 2026-09-19

P6.5 begins the remaining Phase 6 discovery-depth work from the clean P6.4D V8.1 seal checkpoint. This slice changes Search only; P6.3 Home, the Home hero, Library, P6.4D Detail/Transition Scene, playback ownership, Orion Cloud, dependencies, and every Phase 7+ boundary remain frozen.

Authorized candidate behavior:
- **Zero-query Search becomes a real discovery surface.** Before the user types, Search presents provider-backed Songs, Artists, Albums, and Playlists using the existing dashboard/runtime data rather than a decorative empty placeholder.
- **Real provider discovery sits above catalog browsing.** P6.5 reads the provider's live `FEmusic_moods_and_genres` surface, preserves each category's opaque browse params, and renders those provider-supplied mood and genre destinations as lightweight WAVEN chips. Selecting a chip browses `FEmusic_moods_and_genres_category` directly rather than converting the label into a synthetic text search.
- **New Releases and Charts are genuine discovery destinations.** New Releases uses the provider browse surface `FEmusic_new_releases`. Global Charts uses the existing region-neutral global chart source already proven in P6.3 instead of silently turning Search into a country/VPN-sensitive chart surface.
- **Search is the catalog-exploration owner.** Each zero-query group may expose up to 12 deduplicated provider entities in this bounded candidate, making Search materially deeper than the temporary eight-item Home presentation without redefining Home or claiming final pagination.
- **Artist identity stays circular.** Zero-query Artist artwork uses circular portrait treatment with centered names; Albums, Songs, and Playlists remain square or softly rounded artwork-first media. Artist/Album entities reuse the already-locked P6.4D reveal owner without changing Transition Scene internals.
- **Suggestions are provider-backed.** Queries of at least two characters use the already-implemented metadata-provider suggestion capability with a short independent debounce, AbortController cancellation, stale-request sequencing, provider-neutral copy, and no recent-search persistence.
- **Discovery retreats when intent becomes explicit.** Typing transitions Search from zero-query discovery into the existing scoped focused-search mode. Songs / Artists / Albums / Playlists scope controls remain focused-search controls rather than permanent zero-query navigation chrome.
- **Reference translation:** use the finalized Search references only for hierarchy/density ideas: top search field, discovery before query, circular creator identity, artwork-led catalog browsing, compact suggestion/result density. Do not copy yellow/pink skins, exact cards/navigation, or reference music data.
- **Truthfulness:** genre/mood labels shown by P6.5 come only from the provider-supplied discovery taxonomy and retain the provider's opaque category handles internally. WAVEN does not manufacture genre names, rankings, or personalized claims. Upstream provider names, diagnostics, raw transport URLs, and secrets remain hidden.
- **No later ownership:** no search-history persistence, favorites, saved Library state, Recently Played, Home Trending/New Releases redesign, stream resolution, search-to-play handoff, offline ownership, Cloud writes, or Phase 7+ behavior is introduced here.
- **Validation:** this initial Search discovery/suggestions candidate is pure JS/UI/provider-read presentation and is Expo Go suitable for physical review. It remains unaccepted until physical evidence is reviewed; no commit/push is authorized before acceptance.

This candidate does not award Phase 6 completion credit. Authoritative WAVEN v1 completion remains **45%** and Phase 7+ remain **NOT AUTHORIZED**.

#### P6.5 physical visual repair V3 — artwork-led discovery destinations

Physical Expo Go review of the automated-green V2.2 candidate accepted the Search architecture but rejected the discovery-chip presentation and the overly card-like focused Search rows. The supplied Orion Mobile Search/Discovery screenshot is accepted only as a hierarchy/shape reference for large two-column category destinations; WAVEN keeps its own atmosphere, typography, provider truthfulness, and music identity.

V3 visual repair rules:
- Replace the long mood/genre pill strip with **two-column artwork-led discovery destination cards**. `New Releases` and `Global Charts` remain genuine discovery destinations above the taxonomy.
- Prefer provider-returned **Genres** and **Moods & Moments** groups. WAVEN may reorder the live categories toward broadly useful music intents such as Pop, Hip-Hop, R&B, Rock, Chill, Focus, and Workout only when those labels actually exist in the provider response; no category label is invented.
- Genre cards attempt to derive artwork from the **real provider content behind that category**. Preview browse requests are bounded to two concurrent requests and the resulting category browse response is cached for the app session so tapping the card reuses the same response instead of refetching immediately.
- The provider's own navigation-button stripe color is retained as a truthful category accent. If no usable category artwork is available, the card uses that provider accent plus deterministic WAVEN fallback artwork rather than unrelated web imagery.
- Moods & Moments use the same destination-card family. They may remain on deterministic WAVEN artwork until real category artwork has been fetched; this is an honest visual fallback, not fabricated music metadata.
- Focused Search suggestions become compact open rows with separators rather than dark slabs. Search-result rows also lose the enclosing card shell so real artwork and metadata carry the hierarchy.
- The historical P5.5B `YOUR SEARCH · SCOPE` and quoted-query markers remain byte-shape compatible. P6.4D Artist/Album reveal behavior remains frozen.
- Home, the Home hero, Library, playback, Cloud, dependencies, and Phase 7+ remain unchanged. This visual repair does not alter the planned later Home Trending/New Releases restructuring.

V3 remains **P6.5 IN PROGRESS** pending a fresh Expo Go physical review. WAVEN remains **45%**. No commit or push is authorized by this repair.

#### P6.5 curated discovery artwork V3.2 — stable taxonomy + signed APK acceptance

V3.2 supersedes V3's provider-preview artwork experiment without changing the underlying provider browse ownership. The functional V2.2/V3.1 Search architecture remains intact; this repair owns only the curated discovery presentation, stable top-level taxonomy mapping, and the physical acceptance tier for this build.

- **16 WAVEN-owned discovery artworks are bundled as lossless PNG presentation masters.** Eight core genres (`Pop`, `Hip-Hop`, `R&B & Soul`, `Rock`, `Electronic`, `Indie / Alternative`, `Jazz`, `Classical`), six Moods & Moments (`Chill`, `Focus`, `Workout`, `Feel Good`, `Party`, `Sleep`), plus `New Releases` and `Global Charts` use the accepted local artwork pack. The accepted improved Electronic artwork replaces the rejected first Electronic draft. V3.4.6 may downsample these same accepted compositions to density-appropriate PNG dimensions to control Android decode pressure; visual content, crop intent, and WAVEN identity remain unchanged.
- **Stable, minimal core taxonomy.** The visible core genre/mood grid is WAVEN-curated, but a card is rendered only when the live provider exposes an exact matching category/alias and therefore a real opaque browse handle. Substring matching is forbidden so regional categories such as `Indian Pop`, `J-Pop`, `K-Pop`, or `Desi Hip-Hop` cannot impersonate the core `Pop` or `Hip-Hop` slots.
- **Real provider browse remains authoritative.** Curated artwork and canonical WAVEN labels change presentation only. Tapping a core genre/mood still passes the matched provider category object and opaque params into the existing category-browse runtime. No synthetic text-search fallback is introduced.
- **Card geometry is bounded.** Curated cards use a clipped 3:2 destination viewport with `resizeMode="cover"` and authoritative rounded overflow clipping. The 1536×1024 genre masters therefore fit at their native 3:2 ratio; square mood/discovery masters use a controlled center crop without stretching or overflow.
- **Provider-preview requests are removed from the zero-query grid.** V3.2 no longer issues category preview-browse calls just to decorate cards. The accepted local artwork pack owns those visuals, reducing needless discovery traffic while leaving category-content fetching to the actual tap.
- **Focused category hierarchy is quieter.** The generic `Explore your next sound` heading is hidden once a destination is open, leaving the selected discovery title as the clear owner; the explicit `Back` action returns to the discovery grid.
- **Home remained frozen through V3.2.1.** V3.3 later authorizes removal of the redundant Explore shortcut row only. The later Home Trending/New Releases restructuring, first-run hero behavior, Library, playback, Cloud, dependencies, and Phase 7+ ownership remain unchanged.
- **Validation tier is escalated for this build.** Expo Go is not accepted as P6.5 V3.2 physical evidence. Acceptance requires a real **signed APK physical acceptance** pass on Android, plus proof that the curated PNG assets are included by the native release packaging path. Expo may be reused for later fast UI iteration only when separately authorized.

V3.2 remains **P6.5 IN PROGRESS** until the signed APK is built, signature-verified, installed on a physical Android device, and the Search discovery/artwork/category flows are physically accepted. WAVEN remains **45%**. No commit or push is authorized before that acceptance.


#### P6.5 consolidated signed-build physical polish V3.3 — candidate 2026-09-19

V3.3 is a bounded consolidation candidate following permanent-signed V3.2 physical review and the automated-green V3.2.1 image-fit repair. It is intended to produce one next signed APK for device acceptance rather than validating each repair independently.

1. Preserve all 16 accepted discovery PNG masters and the V3.2.1 exact numeric 3:2 image-fit boundary. No artwork bytes, dependencies, provider taxonomy ownership, playback, Library, or Cloud behavior change.
2. Repair the observed P6.4D blink as a visual-ownership issue only. Transition overlay artwork must decode before source ownership changes; forward handoff waits for both stable destination geometry and a decoded destination hero; reverse overlay ownership crossfades while the real detail artwork remains visible until route pop. Existing P6.4D geometry, crop interpolation, mask/radius choreography, and route semantics remain locked.
3. Make successful Phase 6 metadata/discovery results session-warm. Home dashboard, Search dashboard/categories, opened category destinations, New Releases, Global Charts, and resolved Artist/Album details may be synchronously restored from in-memory session snapshots. Explicit user Retry/Refresh forces a new request. No disk persistence, history ownership, or invented personalization is introduced.
4. Remove the redundant Home Explore shortcut/icon row. The Home hero still links to Search, real provider-backed shelves remain in their existing order, and the later Home Trending/New Releases redesign remains deferred.
5. Promote the accepted split white/WAVEN-blue section-title treatment into a shared primary-page component and use it selectively in Search. Normalize Search discovery spacing so featured destinations, core genre/mood grids, focused browse, and catalog rails align to one consistent rhythm.
6. Automated gate remains TypeScript + exactly 170/170 tests. Physical acceptance requires a fresh non-debug APK signed by the permanent WAVEN certificate, 16/16 bundled discovery resource verification, and device screenshots/behavior review.
7. P6.5 remains **IN PROGRESS**. Authoritative WAVEN completion remains **45%**. Phase 7 and every later phase remain **NOT AUTHORIZED**. Commit and push remain prohibited until physical acceptance explicitly authorizes sealing.

### P6.5 V3.3.2 Typography Identity Polish — 2026-09-19

User-authorized physical polish adds a product-wide typography identity without advancing Phase 6 completion. Manrope becomes the functional UI family with real bundled 400/500/600/700/800 faces. Bebas Neue becomes the restrained WAVEN-blue display accent for prominent blue heading/brand words, while icons and ordinary small blue controls remain outside that rule. Major heading copy is normalized to intentional Title Case. Font packages are pinned and bundled locally; no runtime font network dependency is allowed. P6.4D motion, provider behavior, Library, playback, Orion Cloud, and Phase 7+ ownership remain unchanged. WAVEN remains **45%** until Phase 6 Completion ACK.


### P6.5 V3.3.3 Sora Typography Refinement — 2026-09-19

Physical review of V3.3.2 rejected the mixed Manrope/Bebas split-heading treatment as visually inconsistent. V3.3.3 keeps the accepted Manrope functional UI foundation, reserves Bebas Neue for the WAVEN wordmark only, and introduces locally bundled **Sora 700/800** for complete major display/section headings. WAVEN-blue words remain semantic color emphasis inside the same Sora family, at the same baseline/size/weight, with supplied Title Case preserved and no automatic uppercase conversion. Small labels, metadata, controls, navigation, taglines, and detail-kind labels remain Manrope. No discovery, artwork, provider, motion, playback, Library, Cloud, navigation-behavior, Phase 7+, or completion-percentage ownership changes are authorized. A permanent-signed in-place Android candidate plus physical visual review is required; WAVEN remains **45%**, P6.5 remains **IN PROGRESS**, Commit **NO**, Push **NO**.

## P6.5 V3.4.0 discovery hierarchy — 2026-09-19

V3.4.0 is a bounded information-architecture refinement after physical acceptance of the V3.3.3 typography system. Typography, artwork geometry, P6.4D entity-reveal motion, provider-neutral contracts, native Media3 ownership, Library behavior, Orion Cloud boundaries, portrait behavior, dependencies, and Phase 7+ ownership remain frozen.

- **Home becomes intentionally short:** **Hero → Recently Played → Trending Now → New Releases**. The former Featured Artists, Featured Albums, Featured Playlists, and Your Music / Open Your Library sections are removed from Home rather than duplicated beside dedicated Search and Library destinations.
- **Trending Now remains a chart claim.** Home reads only the already-proven region-neutral global chart discovery owner for this lane and renders it only when the exact chart section exists. Generic discovery relevance is never relabeled as trending.
- **New Releases is provider-backed.** Home uses the existing provider `FEmusic_new_releases` discovery owner and exposes one truthful release lane. The lane prefers Album results, then Tracks, then Playlists, and does not fabricate release metadata or substitute generic dashboard shelves.
- **Warm-session continuity remains Phase-6 ephemeral state.** Home reuses the existing Global Charts and New Releases session snapshots and explicit Refresh bypasses those snapshots only for that request.
- **Zero-query Search becomes taxonomy-first rather than catalog-heavy.** Its stable order is `Find Your Sound` → search field → `Browse by Genre` → compact horizontal `Moods & Moments`, then the landing page ends.
- **Genre remains primary discovery taxonomy.** The accepted two-column curated genre artwork grid stays intact and each visible card still requires an exact provider category match with the real opaque browse handle.
- **Moods & Moments becomes compact.** The accepted six mood artworks move from a large two-column wall into one horizontally scrolling compact destination rail, preserving the same provider-backed category destinations.
- **New Releases and Global Charts leave zero-query Search.** Their real runtime owners are retained because Home now owns those intents. Search does not duplicate those feature cards.
- **The generic zero-query `Browse Music` Songs / Artists / Albums / Playlists rails are removed.** Those content types remain available when the user opens a Genre/Mood destination and in typed Search, where intent is explicit.
- **Typed Search and suggestions are unchanged.** Songs / Artists / Albums / Playlists scope controls, provider-backed suggestions, loading/error/empty behavior, and Artist/Album P6.4D reveal routing remain intact.
- **No playback or persistence expansion.** Search-to-play remains later Phase 6 work; Recently Played still does not invent history; Library remains Phase 7-owned.

Validation requires TypeScript, the complete automated suite, a permanent-signed release APK, in-place physical update, portrait/rotation non-mutation, and physical review of Home, zero-query Search, focused Genre/Mood discovery, and typed Search regression.

Authoritative WAVEN v1 completion remains **45%**. P6.5 remains **IN PROGRESS**. Phase 7+ remain **NOT AUTHORIZED**. Commit: **NO**. Push: **NO**.


## P6.5 V3.4.1 discovery accuracy + Artist discovery — candidate 2026-09-20

V3.4.1 does not reopen the physically accepted V3.4.0 Home/Search hierarchy or the V3.3.3 typography system. It repairs the meaning and freshness of the provider-backed content feeding those surfaces.

- **Trending Now remains popularity-first.** WAVEN continues to accept the dedicated global Spotify chart section `waven-global-top-50` as the Home Trending source. Chart order is not reinterpreted as release order.
- **New Releases becomes release-first rather than video-first.** Explicit provider browse identity is authoritative over incidental play overlays. A card explicitly identified as an Album release remains an Album even when the provider also supplies a playable `videoId`; the same precedence applies to explicit Artist and Playlist identities. Explicit Episode/Podcast/non-music semantics remain rejected before Track promotion.
- **Canonical release scope is Singles/EPs/Albums plus track-only releases.** YouTube Music commonly represents Singles and EPs through its Album browse identity, so those canonical release entities are preferred. Track-only current releases remain eligible as bounded fill. Playlists are not New Releases.
- **Global discovery is deterministic and WAVEN-owned.** `FEmusic_new_releases` is queried through a fixed multi-market set rather than device locale, SIM region, VPN state, IP geography, or whichever country happens to route the request. The responses are normalized, deduplicated by release identity, and ranked primarily by provider release-surface position with cross-market presence as a secondary confidence signal.
- **Cross-shelf presentation is deduplicated.** Home normalizes title + artist identity so an exact release already visible in Trending is skipped from New Releases where another valid release is available.
- **Artists to Explore becomes a real Search discovery axis.** The compact circular Artist rail is inserted between Genre and Moods & Moments. Candidate names are derived dynamically from current New Releases and current Trending signals, resolved back through strict provider Artist entities, deduplicated by provider identity and normalized artist name, and supplemented only by bounded provider-backed artist discovery when necessary. No celebrity seed list is allowed.
- **Freshness is bounded without Phase 7 persistence.** Trending, New Releases, and Artists to Explore keep warm in-memory snapshots for 15 minutes. Stale snapshots are no longer treated as authoritative; explicit Refresh still bypasses the cache and cancellation remains owned by the existing provider-request flow.
- **Real-world sanity probes are acceptance evidence, not product logic.** Current releases across multiple regions and genres may be used during physical validation. No named artist, title, release, country preference, listening history, or user preference is hardcoded into WAVEN discovery.
- **No playback or persistence expansion.** V3.4.1 does not change Media3 ownership, Library persistence, Orion Cloud, downloads, provider secrets, raw playback URLs, or Phase 7 boundaries.
- **Completion remains unchanged.** Authoritative WAVEN v1 completion remains **45%** and Phase 7+ remain **NOT AUTHORIZED** until the Phase 6 Completion ACK.

## P6.5 V3.4.2 discovery determinism + canonical release quality — candidate 2026-09-20

V3.4.2 freezes the accepted V3.4.0/V3.4.1 visual hierarchy and hardens the data beneath it.

- **One-session discovery is authoritative once published.** Home follows `fetch → aggregate → classify → deduplicate → score → freeze snapshot → render`. Late provider work, duplicate mounts, or slower concurrent requests must not silently replace the visible Trending Now or New Releases snapshot. Only an explicit Refresh or a new app session may replace an already-published Home snapshot.
- **Freshness becomes an explicit refresh hint rather than an automatic visible replacement.** WAVEN may record when fast-changing discovery has aged past the 15-minute freshness hint, but stale age alone must not reshuffle a currently visible session snapshot.
- **Request generations prevent stale overwrite.** New Releases, Global Charts, and Artists to Explore track authoritative generations so an older request cannot publish after a newer explicit refresh. Concurrent ordinary requests converge on the first authoritative session snapshot instead of racing to replace it.
- **Trending Now remains chart-order authoritative.** The dedicated `waven-global-top-50` source remains the only Home Trending owner. The rail retains a larger truthful chart population when available and never mixes generic search results into chart rank.
- **New Releases prefers canonical music over video presentation.** Global release identity strips common `Official Music Video`, `MV`, lyric-video, visualizer, and audio wrapper text for deduplication. Canonical Album/Single/EP identities and ordinary Track releases rank ahead of video-shaped Track representations. If canonical and video representations resolve to the same normalized title + artist identity, the canonical representation wins.
- **Video-shaped results are bounded fallback, not equal-confidence releases.** Obvious MV/Official Video representations are pushed behind canonical release candidates and should appear only when a stronger canonical population is unavailable.
- **Deterministic release ordering is independent of network completion timing.** Ordering uses provider release-surface rank, canonical/video confidence, cross-market presence, entity type, normalized identity, and fixed market order as deterministic tie-breakers.
- **Artists to Explore uses stronger relevance scoring.** Current chart evidence and current release evidence are combined into a deterministic candidate score before strict Artist lookup. No hardcoded artist list is allowed.
- **Rail population is accuracy-first.** Home live rails target roughly **12–20 distinct high-confidence entities** where authoritative data supports them. WAVEN must show fewer rather than weaken classification, accept malformed duplicates, or fill with noisy video results.
- **Future Explore More contract is preserved, not implemented here.** Eligible live rails may later terminate with an **Explore More** / **See All** destination opening a dedicated live page that reuses the same classifier, ranking, dedupe, and snapshot identity as the preview rail. The full page will own provider-backed continuation/pagination and explicit Refresh. V3.4.2 does not add these pages yet.
- **No visual redesign or later-phase expansion.** Typography, card geometry, Artist rail geometry, Genre/Mood layout, P6.4D reveal ownership, Media3 playback, Library, Orion Cloud, and Phase 7+ remain frozen.

Acceptance requires TypeScript, the full automated suite including determinism/canonical-release regressions, permanent signing, in-place physical update, and on-device proof that Home rails remain unchanged without user refresh while New Releases is materially more canonical and better populated.

Authoritative WAVEN v1 completion remains **45%**. P6.5 remains **IN PROGRESS**. Phase 7+ remain **NOT AUTHORIZED**. Commit: **NO**. Push: **NO**.


## P6.5 V3.4.3 catalog identity + navigation reliability — 2026-09-20

V3.4.3 is the bounded physical-review repair after V3.4.2 proved stable Trending/session snapshots but exposed identity and navigation failures. It does not redesign Home/Search and does not advance Phase 6 accounting.

- **Canonical Artist identity outranks display text.** A normalized display name is a query signal, not canonical Artist identity. WAVEN preserves strict provider Artist browse/source identity from linked catalog metadata whenever available. Chart-derived artist names are resolved only when provider-linked track/album evidence identifies one decisive Artist source; ambiguous homonyms are skipped rather than first-picked. This is generic behavior with no hardcoded BTS, LISA/LiSA, ROSÉ/ROSE/The Rose, or celebrity exceptions.
- **Typed Search uses catalog evidence for relevance.** Diacritic/case normalization may improve matching, but it cannot collapse distinct Artist identities. Linked Artist evidence from returned tracks/albums boosts the owning Artist entity. Strong fan-made/AI-fan-song/unofficial/reaction/nightcore/8D noise is excluded from the bounded track surface, and equivalent canonical/video track forms deduplicate with the non-video canonical representation preferred.
- **New Releases becomes stricter rather than fuller.** The V3.4.2 fixed-market atomic merge, generation guard, session snapshot and deterministic ordering remain locked. Video-only MV/Official Video/lyric-video/visualizer track presentations and strong low-confidence noise are excluded from the Home New Releases track fill. Accuracy before quota remains authoritative: a shorter truthful rail is preferred to weak video filler.
- **Reverse reveal can no longer strand navigation.** Healthy P6.4D geometry, ownership and choreography remain unchanged. Anchor capture is bounded, UI Back and Android/system gesture Back still share one exit controller, and exit transitions have a bounded watchdog. If reverse measurement/visual handoff/landing cannot complete, WAVEN clears reveal ownership and commits the pending route exactly once so the user escapes instead of remaining on a blank/stuck detail scene.
- **Search navigation state is session-only.** WAVEN keeps typed query, Songs/Artists/Albums/Playlists scope, focused Genre/Mood destination, focused results/errors, suggestions, provider results and practical scroll position in an in-memory Search navigation snapshot. Opening Artist/Album detail from Search carries an explicit Search return target. Back restores the originating Search snapshot, and Android Back first unwinds Search checkpoints/focused state before default route history can leave Search. No disk persistence, recent-search history or Phase 7 ownership is introduced.
- **Restoration avoids unnecessary query churn.** A valid restored Search snapshot is rendered immediately instead of being cleared and refetched on the first restored effect cycle; subsequent user query changes use the existing cancellable provider request path normally.
- **Bottom navigation supports both tap and contained horizontal drag.** Existing tab taps and router history remain intact. A horizontal gesture claimed only on the bottom-navigation surface moves the selection pill across Home/Search/Library, commits through bounded distance/velocity thresholds, and snaps/cancels to the current tab when the gesture is terminated. Vertical page scrolling and the rest of the application are not converted into a global swipe pager. Reduced Motion keeps the same navigation semantics without decorative settling motion.
- **Validation probes are generic.** Regression coverage targets homonym collisions, canonical-ID evidence, canonical-vs-video/noisy track selection, reverse-reveal timeout recovery, Search state/back restoration and contained bottom-nav swipe semantics. Named artists observed during physical review are probes only, never product rules.
- **Frozen V3.4.2 wins stay frozen.** Trending remains chart-ranked, session discovery stays deterministic, rail geometry/population targets stay unchanged, Artists to Explore remains circular, Sora/Manrope/Bebas typography remains locked, and no dependency, playback, Library, Cloud, offline or Phase 7+ ownership expands.
- **Explore More remains deferred.** The previously documented future live full-page contract is preserved, but no Explore More page is implemented by V3.4.3. Its UX/design discussion begins only after this identity/navigation slice is physically approved.

P6.5 remains **IN PROGRESS**. WAVEN remains **45%**. Phase 7 and every later phase remain **NOT AUTHORIZED**. No commit or push is authorized before signed physical acceptance.

## P6.5 V3.4.4 reliability + catalog integrity — candidate 2026-09-20

V3.4.4 is the no-compromise physical-lab repair after V3.4.3 proved Search restoration and contained bottom-nav drag, but exposed a forward reveal deadlock, Artist-artwork loss, cross-scope Artist relevance gaps, video-shaped release leakage, focused-discovery artwork inconsistency, and reversed swipe semantics. The accepted information architecture and visual language remain frozen.

- **Entity reveal becomes one whole-transaction liveness contract.** Forward and reverse are both bounded. The existing P6.4D cinematic motion remains the healthy path, but source capture, transition-copy decode, destination readiness/geometry, navigation commit, landing handoff, reverse restoration, and completion may never keep route ownership indefinitely. A forward watchdog may abandon the cinematic handoff and commit the destination normally; a reverse watchdog may restore the source normally. Completion remains token-bound and exact-once so stale timers cannot finish a newer transaction. Reduced Motion completes navigation without waiting behind artwork decode.
- **Canonical Artist identity and artwork are merged, not traded against one another.** Provider Artist browse/source ID remains identity authority. Same-ID Artist evidence may contribute the best trustworthy profile/artwork URL, including linked catalog evidence, ordinary Artist Search evidence, and a bounded lightweight Artist-presentation browse. Canonical identity selection must never discard valid artwork merely because the identity hint itself had no thumbnail. Artists to Explore may enrich only the final bounded set that still lacks artwork; no name-only artwork merge is allowed.
- **Artist Search may use cross-scope canonical evidence.** Provider-linked Artist identities carried by canonical Track/Album results may enrich the Artist result set when they exactly support the normalized query. This closes the physical case where Songs strongly identified one Artist while the Artist scope omitted that same canonical entity. Distinct provider IDs remain distinct even when names normalize similarly; diacritic/case normalization affects relevance, not identity. No named celebrity exception is added.
- **Search separates Artist intent from title coincidence.** When the result set contains strong exact canonical Artist evidence, linked tracks/albums from that Artist receive a relevance boost while legitimate exact-title matches remain eligible. Plain text equality never becomes entity identity.
- **Media presentation is classified semantically across entity types.** MV/official-video, multilingual official-video labels, dance/performance/live video, lyric video, visualizer, fancam, fan/AI-fan, unofficial/reupload, and similar secondary presentations no longer depend on `Track` shape alone. Search dedupe and New Releases evaluate presentation quality independently of whether the provider renderer normalized as Track or Album/Single.
- **New Releases requires both canonical identity and canonical presentation.** Global fixed-market aggregation, deterministic ordering, request generations, and V3.4.2 session stability remain locked. A video-shaped Album/Single renderer cannot bypass quality filtering simply because it owns a canonical browse ID. Canonical non-secondary music wins equivalent-identity dedupe. A shorter rail remains correct when remaining candidates are weak; release dates are never invented.
- **Focused discovery artwork extraction is hardened without redesign.** Thumbnail lookup skips empty early branches, checks known renderer paths, may use a bounded nested thumbnail fallback, and prefers the largest usable provider thumbnail. This specifically targets the physical Rock-vs-Pop artwork disparity while preserving all accepted Genre/Mood geometry and local destination artwork.
- **Search Back history becomes semantic rather than mechanical.** Existing query/scope/focus/results/suggestions/scroll restoration stays in memory. Consecutive scope-only taps in the same query/focused context are coalesced so Android Back does not replay every Songs/Artists/Albums/Playlists tap; meaningful query/focus/detail-origin checkpoints remain restorable. This is still session navigation, not Phase 7 persistence.
- **Bottom-nav drag adopts pager semantics.** Tab order remains **Home → Search → Library**. **Swipe LEFT means next** (`Home → Search`, `Search → Library`) and **Swipe RIGHT means previous** (`Library → Search`, `Search → Home`). Finger delta and destination direction are therefore intentionally inverse, like pulling a horizontal page. End tabs do not wrap, short/cancelled drags snap back, vertical motion is not claimed, normal taps remain unchanged, and the selection pill moves toward the destination. Primary-tab route commits do not add a second route fade, avoiding the physical outgoing/incoming-page ghost seen in V3.4.3.
- **Regression coverage expands around the physical failures.** Tests cover forward/reverse reveal fail-safes and stale-token protection, Reduced Motion liveness, same-ID Artist artwork merge, cross-scope canonical Artist promotion, Artist-intent ranking, semantic video/noise classification, Album/Single New Releases filtering, thumbnail fallback, Search scope-checkpoint coalescing, pager-direction/no-wrap behavior, tap preservation, and primary-route no-ghost ownership.
- **Frozen wins stay frozen.** Trending remains chart-ranked, V3.4.2 discovery snapshots remain session-stable, current Home/Search hierarchy and rail population targets remain accuracy-first, Artists to Explore remains circular, typography/artwork geometry remain accepted, and the single Media3 playback owner plus Library/Cloud/offline phase boundaries do not change.
- **Explore More remains deferred.** The future live full-page contract remains in the Master Plan, but its UI/UX design and implementation resume only after V3.4.4 earns signed physical acceptance.

V3.4.4 does not authorize Phase 7 persistence, Cloud music mutation, another playback owner, dependency/toolchain upgrades, hardcoded artist/release exceptions, device/VPN/IP/SIM geography, commit, or push. P6.5 remains **IN PROGRESS**. WAVEN remains **45%**. Phase 7+ remain **NOT AUTHORIZED**.

## P6.5 V3.4.5 canonical presentation + atomic navigation — candidate 2026-09-22

V3.4.5 is the bounded repair for the signed V3.4.4 physical findings. The user-facing contract is atomic: **one deliberate tap → one complete Artist/Album detail transaction; one deliberate Back → the originating state**. Source measurement, prefetch, artwork decoding, reveal preparation, route commit, landing acknowledgement, and watchdog recovery are internal machinery and may never consume or replace that intent. Rapid duplicate taps coalesce into the active transaction, and a failed reverse reveal must skip animation and still complete the requested Back.

Canonical identity and presentation are now session-authoritative together. The presentation store is keyed by entity kind plus canonical provider identity, merges only same-ID evidence, preserves the best trustworthy artwork already seen, and allows later quality upgrades without real-art → fallback downgrade. The actual source card presentation seeds route/reveal continuity. Same-display-name Artists are never merged by name alone; distinct provider identities remain distinct and Search may disambiguate colliding names with truthful provider-identity evidence.

Home, Search, Artist detail, Album detail, New Releases, focused discovery, and provider output consume one shared canonical-presentation layer for media-wrapper classification, canonical/secondary equivalence dedupe, entity artwork normalization, and provider-ID presentation state. Songs excludes explicit secondary Video/performance forms; detail Songs do not repeat canonical music beside equivalent MV/lyric/video forms; New Releases prefers canonical music representation and excludes weak wrappers when no trustworthy canonical representation exists. Accuracy remains more important than quota.

Primary-tab page content owns an opaque copy of the accepted atmospheric surface so outgoing Home/Search/Library content cannot ghost through an incoming primary page during route commit; bottom-nav pill motion remains independently animated. Pager semantics remain **Swipe LEFT = next**, **Swipe RIGHT = previous**, with no wrap, short-drag cancellation, vertical-scroll separation, normal taps, and Android system-edge Back preserved. Search session restoration and the proven ROSÉ cross-scope behavior remain protected.

This candidate requires the full Windows source gate, `tsc --noEmit`, the complete **244/244** WAVEN test suite, a fresh Android **RELEASE** build, zipalign/signature verification with the permanent WAVEN signer, in-place installation on the physical Android device, cold launch, and owner physical review. Automated success is not acceptance. **Explore More remains deferred.** Authoritative WAVEN completion remains **45%**, P6.5 remains **IN PROGRESS**, Phase 7+ remain **NOT AUTHORIZED**, Commit **NO**, Push **NO**.



## P6.5 V3.4.6 artwork lifecycle + visual ownership hardening — candidate 2026-09-22

V3.4.6 is the bounded physical-lab repair after the permanently signed V3.4.5 candidate passed all automated gates but was rejected on-device because artwork that had already rendered successfully could later degrade to generic fallback after Artist/Album navigation. The repair preserves V3.4.5 atomic OPEN/BACK ownership and targets image lifecycle, decode pressure, and canonical presentation follow-up only.

- **Renderer failure is not canonical absence.** A transient React Native `Image.onError` is renderer evidence only. It may trigger one bounded remount/retry, but it may not erase provider/session artwork that WAVEN has already displayed successfully.
- **Session visual artwork leases span surfaces.** Track/Artist/Album/Playlist identity uses the same provider-keyed visual lease across source card, reveal overlay, detail hero, reverse reveal, restored origin, and compact playback presentation. Successful artwork remains authoritative for the session unless richer trustworthy artwork upgrades it.
- **Decorative hero layers cannot poison the hero.** Blur/background decode failure is non-authoritative. Only the foreground artwork participates in visual-ready ownership; the base image stays eligible while an optional higher-quality source may crossfade in.
- **Discovery artwork is memory-disciplined without redesign.** The 16 accepted WAVEN discovery compositions remain PNG and retain the accepted artwork/crop identity, but oversized 1536/1254-pixel presentation files are downsampled to density-appropriate 1024×683 landscape or 768×768 square masters. This reduces their aggregate decoded RGBA footprint from about 96 MiB to about 39 MiB before provider artwork/reveal layers are counted.
- **Canonical media classification gains provider-renderer evidence.** YouTube Music `musicVideoType`/video-style metadata is recorded below UI surfaces, while bounded title semantics additionally cover live-version/session/recording and `PLAY ▶` wrapper forms. Songs and New Releases consume the shared evidence rather than relying only on display-title regexes.
- **Physical acceptance remains mandatory.** The next permanently signed candidate must prove that real Artist/Album art survives OPEN/reveal/Back, unrelated Genre/Mood/Artist artwork does not collectively degrade after navigation, Album reveal preserves the source cover, Songs exclude secondary performance/video forms, and New Releases excludes or canonicalizes video/program wrappers.

V3.4.6 does not authorize Explore More, Phase 7 persistence, Cloud music sync/mutation, another playback owner, accepted UI/typography hierarchy redesign, hardcoded artist/release exceptions, geography coupling, commit, or push. P6.5 remains **IN PROGRESS** and WAVEN remains **45%** until signed physical acceptance.

## P6.5 V3.4.8 New Release signal -> canonical resolution — candidate 2026-09-23

V3.4.8 is the bounded repair after the permanently signed V3.4.7 candidate still omitted Home New Releases and a zero-mutation eight-market live diagnostic proved the anonymous `FEmusic_new_releases` surface currently resolves to a `Music videos` shelf dominated by `MUSIC_VIDEO_TYPE_OMV` rows with no canonical Album shelf. V3.4.7 was therefore correctly rejecting the provider presentation but had no canonical replacement path.

- **Freshness and presentation are separate owners.** The anonymous New Releases OMV feed is retained only as a fast-changing freshness signal. Raw OMV/video/view-count rows are never Home cards.
- **Signals are ranked globally before resolver work.** WAVEN deduplicates normalized title + Artist signals across the locked fixed markets (`US`, `GB`, `KR`, `JP`, `IN`, `BR`, `MX`, `DE`), preserving deterministic rank and cross-market evidence before any catalog search.
- **Canonical catalog resolution is bounded and dynamic.** Only the strongest bounded signals are searched back through YouTube Music metadata, with limited concurrency, cancellation propagation, and no artist/song-specific exceptions.
- **Strong equivalence is mandatory.** A candidate must match the signal title strongly and match Artist identity through canonical provider Artist linkage when available, otherwise through strict normalized Artist text equivalence. Secondary/video/performance and low-confidence candidates remain rejected by the shared canonical layer.
- **Future provider recovery remains compatible.** If YouTube Music later restores direct canonical Album/Track rows to the New Releases browse surface, those canonical rows continue to flow through the existing direct fixed-market merge and can coexist with resolved signals without requiring another architecture change.
- **Accuracy before quota remains locked.** A signal with no trustworthy canonical Song/Track or Album/Single match is excluded rather than displayed as its OMV source.
- **No scope drift.** V3.4.6 artwork lifecycle/visual ownership, V3.4.5 atomic navigation, V3.4.7 origin-state/Home-snapshot behavior, typography, Home hierarchy, playback ownership, Cloud boundaries, and fixed-market semantics remain frozen.

Physical acceptance requires Home New Releases to appear with canonical music entities, no raw OMV/video wrappers, same-session stability, and no regression to the already-proven artwork/navigation behavior. No named release from the external benchmark is mandatory; overlap is evidence of dynamic freshness, not a hardcoded requirement. P6.5 remains **IN PROGRESS**, WAVEN remains **45%**, and Phase 7+, commit, and push remain unauthorized until signed physical acceptance.
