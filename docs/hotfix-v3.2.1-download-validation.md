# Orion v3.2.1 download hotfix validation

## Reproduction evidence and limits

| Platform | Acceptance title | Reported source | Observed production stage | What is still unknown |
| --- | --- | --- | --- | --- |
| Desktop | See You on Venus (2023) | VixSrc (reported, not screenshot-proven) | Transfer ended at 0% with an empty file and exit 1. The supplied screenshot does not expose the HTTP request that failed. | Whether the root, first segment, authorization context, or a later transfer request failed. The original `orion_dl_*.log` was not available. |
| Mobile | Dr. House S2E1 | VixSrc (reported) | User-reported failed download. The current native broker could mark a root manifest ready without fetching its first media child. | Exact HTTP response and stage on the attached phone. Its installed app remains v3.2.0 (versionCode 58), not this hotfix. |

These are acceptance cases, not evidence of a single-provider outage. No live provider success or failure is claimed by fixture tests.

## Repaired boundaries

- Desktop and Mobile now require actual first media bytes after HLS/DASH root discovery; Desktop direct-video preflight requires non-empty video bytes. Empty media, invalid media, HTTP rejection, and network failures do not become ready states.
- Desktop carries observed child request context only within its capture session. Unknown cross-origin children do not receive root credentials; non-public media destinations are rejected. Candidate selection and transfer start are bound to the capture session, source, title, and exact episode.
- Download-only recovery is limited to the selected source and two eligible alternatives, with a 30-second capture/preflight window for each attempt. Manual-only sources require consent, and source-specific warnings remain. The transfer still requires a separate user Start download action.
- Movie and TV download-only playback stops on failure. Stale source candidates are discarded on capture changes, and download-only resolution does not create viewing history or progress.
- VidKing is removed from active source and playback behavior. Only retired-ID normalization remains for old saved settings.

## Automated evidence

- Desktop `npm run check`: Node tests, renderer tests, source-size, bindings, IPC, secrets, theme, cycles, and Vite build passed.
- Mobile `npm run check`: TypeScript, JavaScript tests, source-size, Expo Doctor, and web export passed.
- Android `:app:compileDebugKotlin` and `:app:testDebugUnitTest` passed (118 native unit tests, zero failures).
- `npm run release:check-map` passed for 3.2.1 / Android versionCode 59. Native runtime identity remains `orion-mobile-native-r2`.
- Deterministic tests cover root-success/child-failure, empty media, DASH initialization, private destination denial, observed child headers, source-attempt bounds and consent, stale session rejection, and Dr. House S2E1 identity.

## Physical acceptance still required before release

1. On Desktop v3.2.1, reproduce See You on Venus (2023) with VixSrc. Capture the safe diagnostic stage and HTTP status without sharing signed URLs or cookies. Confirm a verified download, or record the precise failure and manually review an eligible fallback source.
2. On the Android phone, validate Dr. House S2E1 on an appropriately signed v3.2.1 build. Check root and first media request, exact S2E1 identity, fallback/consent, pause/resume, final artifact, and storage permissions. Do not replace the currently installed signed v3.2.0 app with a debug-signed build without a safe upgrade plan.
3. Run a small provider matrix on both platforms: root success with child denial, expired context, empty child, cross-origin child, and a successful fallback. Verify Download never writes History, watched state, progress, or playback analytics.
4. Complete the separate v3.2.1 physical release qualification with exact artifacts and signer evidence. All gates in `config/release-qualification-3.2.1.json` remain false until validated; no tag or release artifact has been created by this hotfix checkpoint.
