# WAVEN

**Where Music Lives.**

WAVEN is the standalone Android-first music product in the Orion monorepo. This initial workspace establishes only a disciplined, testable foundation. It does not rename Desktop Music Planet, upgrade Orion Mobile, copy Cinema-native modules, or create a separate cloud identity.

## Baseline

- Expo 57.0.19
- React Native 0.86.3
- React 19.2.3
- Expo Router 57.0.18
- TypeScript 6.0.3
- Android compileSdk/targetSdk 36, minSdk 24
- Kotlin Gradle plugin 2.1.20
- New Architecture and Hermes inherited from the proven Orion Mobile generation

The root npm workspace and package lock remain authoritative. Dependency generations may change only through a documented compatibility review covering Orion Mobile, `@orion/shared`, config plugins, native plugins, Metro, TypeScript, and physical Android validation.
## Music Planet UX/UI reference

Desktop Music Planet is WAVEN's product-experience reference. WAVEN inherits its listening hierarchy, artwork-led atmosphere, unified queue/player state, mini-to-full-player continuity, search and collection destinations, track actions, queue/source/lyrics surfaces, and complete loading/offline/error recovery states.

The implementation is intentionally mobile-native: the desktop long-scroll planet becomes a home feed plus tab/stack routes; floating drag/snap/resize controls become a persistent mini-player and full Now Playing screen; queue reordering uses touch and accessibility actions; and CSS, DOM audio, Web Audio, hover, cursor, and Three.js behavior are not copied into Android. WAVEN applies its own black, silver, and blue brand tokens while retaining Music Planet's product intent.

## Structure

- `app/` — Expo Router entry points.
- `assets/` — WAVEN-owned brand and application assets.
- `src/components/` — reusable presentation primitives.
- `src/domain/` — platform-neutral music contracts and policies.
- `src/features/` — product capabilities grouped by domain.
- `src/infrastructure/` — providers, persistence, cloud, and native adapters.
- `src/theme/` — WAVEN black/silver/blue design tokens.
- `tests/` — foundation and future behavior tests.

## Commands

From the repository root:

```powershell
npm run typecheck --workspace @orion/waven
npm test --workspace @orion/waven
npm run check:expo --workspace @orion/waven
npm run build:web --workspace @orion/waven
```

Android native folders are generated and ignored, matching Orion Mobile. Do not run a clean prebuild or upgrade the Expo dependency set without first recording and reviewing the resulting Gradle, AGP, Kotlin, SDK, Java, manifest, and native-module diff.

## Orion Cloud boundary

WAVEN will use Orion Cloud. It will share the Google subject identity, backend-neutral cloud profile interface, PortableProfile envelope, conditional-write semantics, and unknown-namespace preservation. Music-specific namespaces and merge policies must be added explicitly; current Cinema namespaces must not be repurposed.

The initial workspace does not copy Orion Mobile's hard-coded Google native plugins. Those plugins must first be parameterized or extracted into a shared Orion Cloud Android adapter so WAVEN can reuse the system without duplicating credentials, module identities, or package-specific native code.
