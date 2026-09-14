# WAVEN v1 Master Plan — Codebase Audit, Android Product Roadmap, Orion Cloud, Offline, and Distribution

- **Status:** Single authoritative WAVEN v1 audit and implementation plan
- **Prepared:** 2026-09-14
- **Product:** WAVEN — *Where Music Lives.*
- **Source of truth:** Local Orion workspace at `C:\Projects\Orion - A Multiverse of Stories`
- **Dedicated branch:** `waven/v1`

## 1. Decision summary

WAVEN should initially align with Orion Mobile's proven Expo/React Native generation. The new workspace therefore pins Expo `57.0.19`, React Native `0.86.3`, React `19.2.3`, Expo Router `57.0.18`, and the observed Android SDK/Kotlin baseline instead of initializing against whatever Expo version is newest.

WAVEN is an Android-first sibling app in the existing npm monorepo at `apps/waven`. It has its own application identity and blue design tokens, but it uses the same repository toolchain and may consume `@orion/shared` through the existing Metro monorepo configuration.

There must be no separate **WAVEN Cloud**. WAVEN will participate in **Orion Cloud** by reusing the same Google subject identity, backend-neutral `CloudProfileStore` boundary, PortableProfile envelope, Google Drive `appDataFolder` transport, conditional-write semantics, and conflict-safety rules. Music data requires new WAVEN-specific namespaces; Cinema namespaces must not be overloaded.

The supplied icon has been copied unchanged into `apps/waven/assets/icon.png`. It is the current reference/application icon, not a redesigned derivative.
Offline behavior is a first-class product mode and is intentionally separate from downloadable media. Direct-distribution builds are expected to gain a WAVEN in-app updater based on a future read-only audit of Orion Mobile's current updater, with GitHub Preview/Prerelease artifacts and same-signature physical update acceptance.

The current milestone remains **CODE/TEST ONLY**. Expo Go, a WAVEN development build, and a permanently signed distributed candidate are distinct future evidence tiers; success in one must never be promoted into another.

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

No phase beyond Phase 1 is authorized by this plan amendment. Every phase requires its own explicit implementation authorization and evidence at the stated tier.

### Phase 0 — Evidence and version baseline (evidence complete; audit ACK accepted)

1. **Goal:** Freeze Orion Mobile, Music Planet, Orion Cloud, and workspace evidence.
2. **Scope:** root manifests/workflows; `apps/mobile`; Music Planet; shared PortableProfile and Cloud adapters.
3. **Deliverable:** sections 3–12 of this master plan and exact baseline tests.
4. **Backend:** Google identity plus Drive `appDataFolder` confirmed.
5. **Risk:** generated Android is ignored; evidence must be refreshed when durable inputs change.
6. **Validation classification:** **CODE / AUTOMATED TEST EVIDENCE**.
7. **Exit:** exact matrix and no-unplanned-upgrade decision recorded.
8. **Out of scope:** dependency changes, live account access, implementation.

### Phase 1 — WAVEN project foundation (automated gate passed; physical ACK pending)

1. **Goal:** Provide a clean Android-first Expo workspace in the monorepo.
2. **Scope/files:** `apps/waven/{package.json,app.json,eas.json,metro.config.js,tsconfig.json,app,src,assets,tests}` and lockfile registration.
3. **Reuse:** Orion Mobile versions and Metro/TypeScript/EAS patterns; `@orion/shared`; brand heading grammar.
4. **New code:** independent app identity, tokens, foundation screen, boundaries, and tests.
5. **Backend:** none contacted.
6. **UI/native:** supplied icon and black/silver/blue foundation. Confirm Expo 57 Hermes/New Architecture output in the first reviewed native generation.
7. **Validation classification:** completed **CODE / AUTOMATED TEST EVIDENCE**; foundation UI is **EXPO GO SUITABLE** later, but no Expo Go evidence exists yet.
8. **Recorded evidence:** TypeScript pass; 4/4 foundation tests; Expo Doctor 20/20; web export with 1,115 modules.
9. **Not established:** Android, Expo Go, development client, playback, Cloud, offline, signing, updater, or release acceptance.
10. **Exit:** npm recognizes `@orion/waven`; checks pass without upgrading Orion.
11. **Dependencies:** Phase 0.
12. **Out of scope:** providers, playback, Orion Cloud writes, production signing.

### Phase 2 — Shared Orion Cloud Android adapter extraction (not authorized)

1. **Goal:** Parameterize existing ecosystem behavior without redesigning Orion Cloud.
2. **Likely files:** shared Cloud contracts; a shared/parameterized Android plugin; adapted sources from Orion Mobile Google identity/Drive plugins.
3. **Reuse:** subject identity, native-only token vault, Drive transport, stable read, conditional write, read-back, error codes.
4. **New code:** app-neutral module/package generation, shared transaction coordination, compatibility tests.
5. **Backend:** existing Google ecosystem; any Android OAuth client remains part of Orion Cloud, not a new identity system.
6. **Risks:** hard-coded Orion names, package/signature registration, module collision, token regression.
7. **Validation classification:** **DEVELOPMENT BUILD REQUIRED**; **DISTRIBUTED RELEASE ACCEPTANCE REQUIRED** before release.
8. **Tests:** plugin idempotence, generated-native diff, Android compile, identity equivalence, sign-in/authorize/read/revoke/sign-out/offline on device, Orion Mobile regression.
9. **Exit:** one parameterized adapter serves Orion Mobile and WAVEN; no token crosses JavaScript.
10. **Dependencies:** Phase 1.
11. **Out of scope:** WAVEN music namespaces and automatic sync.

### Phase 3 — Shared music domain and provider contracts (not authorized)

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

### Phase 4 — Android playback core (not authorized)

1. **Goal:** Build reliable playback before feature-heavy UI.
2. **Scope:** background native audio owner, MediaSession, notification/lock-screen controls, audio focus, headset/Bluetooth commands, lifecycle recovery, queue persistence, JIT source resolution.
3. **Reuse:** queue/navigation policy and stable provider references; never DOM audio/Web Audio.
4. **Risks:** engine choice, OEM restrictions, battery, foreground-service policy, stream expiry.
5. **Validation classification:** **DEVELOPMENT BUILD REQUIRED** and **DISTRIBUTED RELEASE ACCEPTANCE REQUIRED**.
6. **Tests:** interruptions, background/lock screen, process recovery, media buttons, network loss, 30-minute physical soak.
7. **Exit:** correct queue/player state through backgrounding, interruption, and recovery on representative devices.
8. **Dependencies:** Phase 3; a native need may trigger a documented version review, never an automatic Expo upgrade.
9. **Out of scope:** downloads, visualizer, final player polish.

### Phase 5 — WAVEN design system and navigation (not authorized)

1. **Goal:** Deliver Music Planet product intent as a native Android-first WAVEN shell.
2. **Scope:** typed theme tokens, Expo Router groups/layouts, safe area, reusable surfaces, empty/loading/error states, accessibility and reduced motion.
3. **Reuse:** proven Orion Mobile primitives and the Music Planet UX/UI inheritance contract.
4. **New code:** WAVEN black/silver/blue components, native home feed/tabs/stacks, mini-player shell.
5. **Validation classification:** **EXPO GO SUITABLE** for supported UI/JS; later development/release regression remains required.
6. **Tests:** screenshots, responsive layout, TalkBack semantics, large text, contrast, reduced motion, low-end performance.
7. **Exit:** reusable components meet accessibility and performance budgets.
8. **Dependencies:** Phase 1; integrates with Phase 4.
9. **Out of scope:** production playback and final immersive player.

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
| 1 | WAVEN project foundation | 6% | Compatible Expo Go physical run or WAVEN development-build physical run, plus current automated checks | Automated gate passed; physical pending | PENDING | 0% |
| 2 | Shared Orion Cloud Android adapter | 8% | Development-build physical identity/Drive lifecycle; later release regression | Not started / not authorized | PENDING | 0% |
| 3 | Shared music domain/provider contracts | 8% | Physical provider integration in the implementation runtime plus automated contract parity | Not started / not authorized | PENDING | 0% |
| 4 | Android playback core | 12% | Development-build physical playback/lifecycle/MediaSession soak; later release reacceptance | Not started / not authorized | PENDING | 0% |
| 5 | Design system and navigation | 7% | Expo Go-compatible physical UI/accessibility matrix or development-build equivalent | Not started / not authorized | PENDING | 0% |
| 6 | Search, discovery, and details | 7% | Physical online/degraded/offline provider flow in the correct runtime | Not started / not authorized | PENDING | 0% |
| 7 | Local Library, favorites, playlists, history | 8% | Development-build physical persistence, restart, account isolation, and migration | Not started / not authorized | PENDING | 0% |
| 8 | Offline awareness and connectivity resilience | 8% | Development-build physical connectivity matrix in section 13.8 | Not started / not authorized | PENDING | 0% |
| 9 | WAVEN domains in Orion Cloud | 9% | Development-build physical two-device/account/offline conflict matrix; later release reacceptance | Not started / not authorized | PENDING | 0% |
| 10 | Full player, lyrics, and atmosphere | 7% | Development-build physical player/lyrics/accessibility/lifecycle matrix | Not started / not authorized | PENDING | 0% |
| 11 | Downloads, reliability, and performance | 6% | Development-build physical storage/restart/soak matrix; distributed acceptance if downloads ship | Not started / not authorized | PENDING | 0% |
| 12 | Release engineering, updater, distributed acceptance | 10% | Permanently signed GitHub Preview/Prerelease; clean install and in-place update on physical matrix | Not started / not authorized | PENDING | 0% |
| 13 | Future Desktop Music Planet → WAVEN migration | 0% (post-v1) | Dedicated Desktop runtime/update/UX acceptance | Not started / not authorized | PENDING | 0% |

**Current authoritative WAVEN v1 completion: 4%.** Phase 1 has passed its automated gate but remains incomplete and earns 0% until physical validation and its Completion ACK are accepted. No later phase is authorized or complete.

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

Includes typecheck, lint where applicable, unit/integration tests, Expo config validation, Expo Doctor, static checks, and web/export checks when useful. This is the current WAVEN evidence level.

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

## 20. Recommended first implementation checkpoint

The next implementation checkpoint remains **Shared Orion Cloud Android Adapter Extraction**, but this documentation consolidation does **not** authorize it or any other phase.

Required outputs after explicit authorization:

1. one parameterized config/native package consumed by Orion Mobile regression and WAVEN development harnesses;
2. proof that Mobile `google.uniqueId` and Desktop `userinfo.sub` match for the same test account;
3. no token crossing into JavaScript;
4. read-only PortableProfileV3 access from WAVEN through the same `appDataFolder` file;
5. mixed-client unknown-namespace preservation tests;
6. reviewed generated-native diffs confirming Gradle `9.3.1`, AGP `8.12.0`, Kotlin `2.1.20`, SDK 36/36/24, and JDK 17 compatibility;
7. development-build device evidence for sign-in, consent, read, revoke, sign-out, offline, and recovery;
8. no WAVEN music namespace writes until the shared adapter and schemas pass review.

This checkpoint reduces the highest ecosystem risk while keeping Orion Mobile and WAVEN on one proven dependency generation. Phase 8 offline resilience is required before Phase 9 enables WAVEN namespace synchronization through Orion Cloud. Phase 12 later owns updater and signed distribution acceptance.
