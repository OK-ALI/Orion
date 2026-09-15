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

Current accepted completion status is **Phases 0–4 complete at their recorded evidence tiers, 38% overall**. Phase 5 is **authorized and in progress** under `AUTH-P05-2026-09-14`; its P5.1 UI shell foundation is published at `5db4d4f01b597d746389ed7f8e766a532df411ed`, and its P5.2 Rev4H visual/material checkpoint is physically accepted while real native Google identity remains pending. P5.2 and Phase 5 are therefore still in progress, Phase 5 has no Completion ACK and earns **0%** so far, and Phase 6 remains unauthorized. Expo Go, WAVEN development-device evidence, and a permanently signed distributed candidate remain distinct evidence tiers; success in one must never be promoted into another.

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

Phases 0–4 are accepted at the evidence boundaries recorded below. Phase 5 is authorized and currently in progress under `AUTH-P05-2026-09-14`; Phase 6 and every later phase remain unauthorized and require their own explicit implementation authorization. This section was reconciled on 2026-09-15 to include the published P5.1 UI-shell checkpoint and the physically accepted P5.2 Rev4H visual/material checkpoint without changing completion accounting.

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

### Phase 5 — WAVEN design system and navigation (authorized; implementation in progress)

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

#### Phase 5.2 Rev4H Visual/Material Checkpoint — presentation accepted; P5.2 still in progress

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

### Phase 6 — Search, discovery, and detail experiences (not authorized)

1. **Goal:** Expose only provider-supported data through mobile-native UX.
2. **Scope:** Search, Home/Discovery, artist, album, pagination, cancellation, caching, attribution and health states.
3. **Reuse:** active YouTube Music metadata/dashboard, Spotify Charts metadata-only role, broker timeout/health concepts.
4. **Validation classification:** UI and pure JS flows may be **EXPO GO SUITABLE**; native networking/cache integration needs **DEVELOPMENT BUILD**; release flow needs distributed regression.
5. **Tests:** fixtures, response drift, pagination, cancellation, offline/degraded states, low-end performance.
6. **Exit:** search-to-play handoff works without exposing raw playback URLs or secrets.
7. **Dependencies:** Phases 3–5.
8. **Out of scope:** invented personalization or catalog rights.

### Phase 7 — Local Library, favorites, playlists, and listening history (not authorized)

1. **Goal:** Establish versioned local-first ownership before Cloud sync.
2. **Scope:** local schemas/migrations, playlist ordering, favorites, history retention, preferences, queue recovery, corruption handling.
3. **Reuse:** Music Planet data behavior and backup normalization concepts, not Node SQLite.
4. **Validation classification:** model/UI work may be **EXPO GO SUITABLE**; production storage/lifecycle is **DEVELOPMENT BUILD REQUIRED**; migration acceptance is distributed when release-scoped.
5. **Tests:** migration, corruption recovery, large library, account isolation, process restart, uninstall/reinstall expectations.
6. **Exit:** local data is versioned, recoverable, bounded, and portable.
7. **Dependencies:** Phases 3–6.
8. **Out of scope:** Cloud enablement and media upload.

### Phase 8 — Offline awareness and connectivity resilience (not authorized)

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

WAVEN v1 progress is milestone-based, not an estimate of effort spent. Each Phase 0–12 has a fixed weight totaling **100%**. A phase contributes its full weight only when every exit criterion passes, its required physical-validation tier passes, its evidence is recorded, and its **Completion ACK** is `ACCEPTED`. Partial implementation, code completion, Expo Go success, or a development build does not earn partial overall percentage.

The only physical-validation exception is a phase with no runtime/device surface, currently Phase 0. Such a phase may complete through an evidence-review ACK that explicitly records `Physical validation: NOT APPLICABLE`. Phase 13 is post-v1 Desktop migration work and has a 0% WAVEN v1 weight; it still requires its own Desktop completion ACK.

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
| 5 | Design system and navigation | 7% | Expo Go-compatible physical UI/accessibility matrix or development-build equivalent | AUTHORIZED / IN PROGRESS; P5.1 published/remote-verified at `5db4d4f01b597d746389ed7f8e766a532df411ed`; P5.2 Rev4H visual/material checkpoint physically accepted; native Google identity still pending | PENDING | 0% |
| 6 | Search, discovery, and details | 7% | Physical online/degraded/offline provider flow in the correct runtime | Not started / not authorized | PENDING | 0% |
| 7 | Local Library, favorites, playlists, history | 8% | Development-build physical persistence, restart, account isolation, and migration | Not started / not authorized | PENDING | 0% |
| 8 | Offline awareness and connectivity resilience | 8% | Development-build physical connectivity matrix in section 13.8 | Not started / not authorized | PENDING | 0% |
| 9 | WAVEN domains in Orion Cloud | 9% | Development-build physical two-device/account/offline conflict matrix; later release reacceptance | Not started / not authorized | PENDING | 0% |
| 10 | Full player, lyrics, and atmosphere | 7% | Development-build physical player/lyrics/accessibility/lifecycle matrix | Not started / not authorized | PENDING | 0% |
| 11 | Downloads, reliability, and performance | 6% | Development-build physical storage/restart/soak matrix; distributed acceptance if downloads ship | Not started / not authorized | PENDING | 0% |
| 12 | Release engineering, updater, distributed acceptance | 10% | Permanently signed GitHub Preview/Prerelease; clean install and in-place update on physical matrix | Not started / not authorized | PENDING | 0% |
| 13 | Future Desktop Music Planet → WAVEN migration | 0% (post-v1) | Dedicated Desktop runtime/update/UX acceptance | Not started / not authorized | PENDING | 0% |

**Current authoritative WAVEN v1 completion: 38%.** Phases 0–4 contribute `4% + 6% + 8% + 8% + 12% = 38%` through accepted Completion ACKs. Phase 5 is authorized and in progress but still earns 0% because no Phase 5 Completion ACK has been accepted. Phase 6 and every later phase remain unauthorized and earn 0% until separately authorized, implemented, validated, and accepted.

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

`ACCEPTED` means all phase exit criteria and the required physical gate passed. `REJECTED` leaves the phase incomplete. `REOPENED` withdraws previously earned percentage until regression evidence passes again. A technical test summary without the decision record is not a Completion ACK.

### 15.4 Dependency and release accounting

- Downstream work may begin only when separately authorized; starting it does not change overall percentage.
- A downstream phase cannot receive an ACK while a required dependency is unaccepted unless an explicit, documented exception explains the risk and owner.
- Phase 12 cannot be accepted until all release-scope Phase 1–11 ACKs are accepted or explicitly excluded from the candidate with documented scope.
- WAVEN v1 reaches **100%** only when Phase 0–12 contribute their full accepted weights and the exact signed distributed candidate passes the final physical gate.
- Stable promotion, if authorized, does not retroactively replace Preview/Prerelease acceptance evidence; both records remain traceable.
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
