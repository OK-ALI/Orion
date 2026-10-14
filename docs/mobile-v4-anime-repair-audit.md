# Mobile v4 Anime identity and provider gate

## Deep AniLink inspection and fresh-Anime entry repair — 14 October 2026

Current inspection uses the published AniLink watch HTML, client and official embed/player-event/Continue Watching docs. The provider accepts the explicit start parameter but documents only host ready, analytics-consent and server-selection commands. Its published source-recovery callback can capture a zero-position snapshot before the incoming start is applied. The subsequent can-play callback prioritizes that recovery snapshot and returns without applying the still-pending start. A bounded, network-free evaluation of those exact published callbacks seeks to 209 on a clean startup but makes no positive seek after a simulated first-source failure. This reproducer is source evidence, not a physical playback pass or proof that every failure has an exclusively external cause. A fresh standalone browser control and its one retry both returned stream-source-unavailable with playback-protection failure. No proxy, cross-origin iframe injection, invented seek command, source/security weakening or broad Player rewrite was used.

The separate fresh-Anime check found a Mobile entry race for Anime films: an unhinted film can expose General before the canonical Anime lookup finishes. Home and online Detail now add only an advisory animeHint for catalog items recognized by Orion's existing isAnimeContent interface. Player passes that hint to the dedicated Anime hook; known Anime films wait for canonical proof before any provider surface is mounted. An unhinted film recognized as Anime also enters checking while identity resolution is pending. Ordinary films retain immediate General entry, explicit/saved General intent remains primary, and disabled offline/download-resolution paths make no Anime lookup. The hint is never sufficient to activate a provider or invent season/episode fields. Existing fresh episodic Anime already defaults to AniEmbed Sub and remains unchanged.

Bounded dependencies: Home and online Media Detail add one optional route field using a shared Mobile helper; all other actions, layout, defaults and offline routes remain intact. Player adds the optional route field and hook input only. useAnimeSource changes only the Anime-film identity waiting phase. The exact preservation transforms enumerate those additions, with no wildcard allowance for existing Home/Detail files. The internal build manifest now hashes both entry callers and the new helper, and computes dirtySource from Git instead of the older hardcoded true flag. Package/version/signing and production exposure remain unchanged. Ninety-seven focused original Home/Detail/Anime checks pass, including exact ordinary-film route payloads, offline assets, theme/layout behavior, false hints, same-title transitions and saved/manual General intent. The full Mobile suite has 1,607 tests: 1,602 pass and only the same five exact locked-baseline Download failures remain. Both typechecks, source-size (298 files) and preservation pass: 2,601 frozen files, two navigation additions, 29 exact integrations, 113 additions. Two original UI test fixtures now expose the real public isAnimeContent function; no original assertion was removed or relaxed. Those exact fixture additions and new regression blocks are enumerated by preservation. Physical work remains blocked on the missing USB device; no v4 identity, provider qualification or release is claimed.

### Provider repair boundary

The source-only recovery reproducer is in test-results/anilink-deep/recovery-proof.json, evaluated from the current published client asset 1myuvnmgjvgil.js. The clean callback requests seek 209; first-source recovery requests no positive seek and leaves the incoming 209 pending. This does not claim a runtime seek succeeded, physical playback, or an exclusively external explanation for every failure. The compliant upstream correction is to preserve the pending incoming start during startup source recovery, while retaining actual viewer position for later server switches and clearing incoming intent only after it is applied. Such a change belongs to AniLink's player; Orion has no documented host seek command. Official references: https://anilink.cc/docs/embed-parameters, https://anilink.cc/docs/player-events, https://anilink.cc/docs/continue-watching. No maintainer message was sent.

The no-Orion standalone control at watch/20958/2?variant=sub&start=209&autoplay=true&muted=true&autonext=false and its single reload both reached stream-source-unavailable with playback-access renewal failure. A full provider pass still needs fresh real Android samples. The dynamically verified fresh-title control is Dan Da Dan, TMDb 240411 S1E1 → AniList 171018 E1; it is a qualification input, not a production mapping table.

## Fresh provider and preservation follow-up — 14 October 2026

Attack on Titan S2E2 AniLink Sub still failed to restore the actual saved 3:28 position on phase4ae. The explicit Retry reached another waiting surface; no verified restored target/forward settlement was recorded before leaving. The public watch response accepts start=209 as 209, and its current public parent-message handler accepts readiness, analytics consent and validated server selection, with no seek command. Its recovery callback can prioritize a zero-position server snapshot over a still-pending incoming start. That source inspection suggests a provider recovery defect, but is not a proven exclusively external root cause. No cross-origin iframe injection, proxy, security weakening or broad Player refactor was introduced to force a pass. The provider gate remains open.

Phase4af adds only a read-only, internal-gated native v4 notes route. The normal package/version remain com.okali.orion / 3.2.1 (59). Existing Downloads showed eight completed items and no needs-attention items; an existing downloaded film rendered actual frames with both networks disabled and later showed advancing 1:31 / 1:46:53 time in the native Orion offline player. Android Back restored portrait navigation. Networks, font and density were restored. Download source/tests and Desktop remain frozen. Feedback is qualified against the actual official inbox; native v4 notes scrolling/large-text/tablet-layout simulation are recorded separately.


## Current provider update — 14 October 2026

The current installed internal artifact is phase4ae, 3.2.1 (59), SHA-256 a953c3328e20e7e03ac80e4ef61d2a705fec05eef564e65f53ebb9bfe73307b6, with the permanent Orion signer and preserved app data. Phase4ad was installed and tested; earlier draft statements that it remained uninstalled are historical.

Additional real controls passed: Your Name AniLink Dub cold Resume targeted 211 seconds and settled at 214 with the Movie/Dub source affinity restored. Solo Leveling canonical S1E14 played on AniLink Dub as AniList 176496 episode 2; a real provider seek near the end and Orion's existing automatic Next Episode transition reached canonical S1E15, provider episode 3, with AniLink/Dub retained and advancing frames/time. General Avengers Endgame VixSrc resumed at its saved 2:25:08 target and advanced. This does not qualify the separate CineSrc film control that stayed loading earlier.

**The AniLink release gate remains open.** Attack on Titan S2E2 Sub played from zero but ignored its incoming resume, and the exact standalone player also started near zero. Attack S2E1 Dub advanced from zero but its cold incoming Resume failed. Beerus AniLink Sub still returned an immediate source error. These samples do not prove an exclusively external cause or full provider continuity qualification. The user authorized continuing Feedback while retaining this final gate.

The bounded Metro resolver now resolves only @orion/shared/api from this managed checkout, preserving all other upstream resolution and workspace paths; regression coverage proves that boundary. This prevents normal final builds from accidentally consuming the primary checkout's stale API through the reused dependency symlink. Twenty-five repair checks and the last full Mobile suite of 1,591 tests (1,586 passing, the same five inherited Download assertions) passed. No Download code/tests, Desktop or signing authority changed.

Production Feedback is deployed, wired in the internal APK and qualified against the real official inbox. No final v4 identity, seal, tag, merge or publication is claimed. Earlier records below describe their phase-time state and are superseded by this update.


This is an internal qualification record, not a release seal. The shared identity repair is implemented; the complete physical AniLink/AniEmbed gate remains open until all required playback/continuity cases pass. Feedback deployment has not started.

## Authority and bounded dependencies

Preservation authority and source HEAD: `32ea4f75d8ff64975f44507672ad07db477efaf9`. Branch: `codex/orion-v4-mobile-glimpse`, with uncommitted additive source. HEAD alone does not identify the dirty build; the internal artifact records runtime source SHA-256 inputs.

The dependency is the dedicated Anime verification/selection boundary. Both providers consume its verified AniList identity and provider episode. The qualified strict resolver remains the first path and returns the same result without supplemental requests for previously accepted mappings.

Intentional changes:

- Shared `animeLookup.ts`: optional explicit cache refresh on a failed identity/mapping. Default cached behavior stays intact.
- Mobile `animeIdentityRequest.ts`: dynamic movie identity without catalog season/episode; bounded supplemental episode proof after the original strict path fails; safe failure classes.
- Mobile `useAnimeSource.ts`: consume verified provider numbering and non-episodic identity, preserve abort/stale-response/manual-General guards, and isolate temporary film choices from TV choices.
- Mobile `AnimeSourceChoices.tsx`: media-shape capability and relevant failure copy, using the existing themed/accessibility source controls.
- Mobile `PlayerScreen.tsx`: consume proved provider numbering, restore film source affinity at the Anime boundary, and clear film/TV temporary choices independently. Existing logical catalog coordinates, completion, progress, orientation and source handoff owners stay intact.
- One existing source UI assertion follows the new disabled expression; its original behavioral checks remain.
- Mobile Library `sourceAffinity.ts`: one movie-only acceptance predicate for dedicated Anime sources. The existing profile-owned key, record format, timestamps, exclusions, variant validation and verified-evidence requirement stay intact. This dependency is necessary because the previous predicate rejected every film preference for the two Anime sources, losing Dub/source affinity after restart.
- Four additive Mobile modules: public evidence reader, episode proof, canonical repair, and Mobile film/flow capability.
- AniLink-only readiness budget: AniLink's publicly served watch client allows 90 seconds for server recovery. The existing common Anime 35-second deadline could destroy its surface during that recovery. `animeReadiness.ts` and `useAnimeReadiness.ts` gain an optional provider argument; `EmbedPlayerSurface.tsx` passes the existing source ID. AniLink gets a bounded 100-second startup window including page startup. AniEmbed/default remain 35 seconds, and immediate errors, terminal/stale guards, cancellation, navigation, URLs, security and telemetry ownership are preserved. The new timing build still requires its own physical check.
- Internal build resolver explicitly uses this worktree's shared API because the dependency directory is reused from the primary checkout. Production exposure/signing/version settings remain unchanged.

The temporary attempt to extend `mobileSources.ts` was removed after the full suite detected import isolation and legacy selection failures. That file is restored exactly to baseline. Download source/code/tests, shared provider adapters, the strict shared identity verifier, Desktop source, account/sync and provider iframe/shield/orientation implementations remain frozen. Film content-item capability is Mobile-only; shared/Desktop movie flags remain unchanged.

The exact reviewed transformations are in `apps/mobile/scripts/anime-repair-integrations.cjs` and verified by the preservation gate. Earlier Glimpse, Welcome and product-polish differences are explained by their existing audit files.

## Public metadata evidence

No title table or fixed production ID mapping was added. The following IDs are qualification inputs only:

| Canonical Orion input | Dynamic public result | Evidence |
| --- | --- | --- |
| Dragon Ball Super: Beerus, TMDb 312359 S1E1 | AniList 206814 E1 | TMDb plans 19 episodes; AniList is releasing with an unannounced total. Actual episode-1 airing evidence proves availability. The former null-count conversion to zero caused the shared rejection. |
| Dragon Ball Super, TMDb 62715 S1E1 | AniList 21175 E1 | Existing strict path remains accepted. |
| Solo Leveling, TMDb 127532 S1E13 | AniList 176496 E1 | TMDb groups 25 episodes into season 1; the second cour starts at canonical episode 13. No nonexistent TMDb season 2 is fabricated. |
| Attack on Titan, TMDb 1429 S2E1/E2 | AniList 20958 E1/E2 | Existing later-season relation proof remains accepted. |
| Your Name, TMDb 372058, movie | AniList 21519, movie | Dynamic format/title/year match; identity contains no season/episode. Both public players can represent the complete film as one provider content item. |

Supplemental proof requires exact root identity/premiere evidence and either unique actually aired episode evidence, complete chronological series counts, or complete explicitly linked cour boundaries. Ambiguity, unproven numbering, future episodes, incomplete graphs and network failure fail closed. Requests are cancellable, bounded in size, time, graph depth and node count. Upcoming catalog entries can resolve as metadata permits; unreleased episodes are not advertised as playable.

## Automated preservation

- Mobile TypeScript: pass.
- 246 focused checks pass after the AniLink timing follow-up, including original identity/readiness, source security, continuity, Next Episode, General escape and offline controls. The 24 new repair checks include late valid playback after 35 seconds, original/default expiry, immediate terminal errors and real hook cancellation on source change/disable/disposal.
- 143 Glimpse/Welcome checks: pass.
- Full Mobile suite: 1,588 tests, 1,583 pass, five inherited Download source assertions fail. The five failures are the same locked-baseline HLS assertion conflicts already recorded; no Download code or tests were changed to hide them.
- Source-size: 293 files pass.
- Locked-source preservation with the movie predicate and AniLink-only readiness follow-up: 2,607 frozen baseline files, two navigation additions, 23 exact reviewed integrations. No Desktop or signing changes.

The Anime-specific full-suite log is `test-results/anime-v4/final-mobile-suite.log`. Generic helper log names may have been reused by later phases; this phase must retain its own copy and artifact records.

## Physical evidence and limits

On R5CWC2RYXZF, permanently signed, non-debuggable internal APKs have demonstrated:

- Beerus identity accepted on both providers; AniEmbed Sub played with changing frames and verified advancing/persisted progress.
- Solo Leveling's canonical S1E13 maps to second-cour E1 on both providers. AniEmbed Dub played with verified advancing progress.
- Older Dragon Ball Super AniEmbed Sub restored the existing 5:22 position with a confirmed continuity settlement. AniLink Sub started from zero and later produced verified forward playback. Initial Dub and newer/cour attempts did not establish full qualification.
- Attack on Titan S2E1 identity/playback, native rotation, real provider seek-to-end, real Orion Next Episode transition to S2E2 with AniEmbed/Sub retained, and canonical S2E2 Continue Watching progress. Replay Last 30 from the actual Home Continue flow restored its target and settled with forward evidence, clearing the warning.
- Your Name used the actual Movie route with no season/episode fields, enabled native Anime source choices, AniEmbed playback and canonical Movie Continue Watching progress.
- Phase4ac: Your Name AniEmbed Dub replay advanced at its actual target. Native Back, data-preserving cold restart and real Home Resume restored AniEmbed Dub and the saved 2:54 target; settlement at 175 seconds confirmed it. Background/foreground returned to actual playback. Overlapping numeric film/TV IDs are covered by regression tests, not asserted from unrelated physical title IDs.
- Phase4ac: older Dragon Ball Super AniLink Dub played with verified forward progress. After a cold restart, a canonical route without a forced source restored AniLink Dub; Replay Last 30 from the saved 1:19 position targeted 49 seconds and settled at 52 seconds. This control is independently successful; it does not qualify other AniLink titles/variants.
- Native Back returned to Home and released the app orientation request (`SCREEN_ORIENTATION_UNSPECIFIED`). The phone's current system setting was rotation-locked to landscape; that system preference was not overwritten.

Open physical cases and external limits:

- AniLink's correctly mapped Beerus and second-cour attempts did not start; standalone public player checks also returned `stream-source-unavailable` for those tested inputs/variants. Identity acceptance is not playback qualification.
- AniLink Your Name selection accepted movie identity, but its incoming 12-second target did not settle. The corresponding standalone page also failed on that check. A no-start standalone film played earlier; the samples do not prove whether the difference is a parameter defect or variable provider availability.
- AniLink later-season Attack on Titan S2E2 Sub did not start or restore its 3:28 incoming target on phase4ac. Standalone manual playback without incoming start eventually advanced; a separate standalone check with the exact native autoplay/start=0 contract returned `stream-source-unavailable` and an access-renewal error. These samples do not isolate a parameter defect or prove an exclusively external cause. The source client's 90-second recovery budget led to the bounded timing follow-up; recheck native playback on that build before judging it.
- AniLink Your Name Sub also failed from zero on phase4ac. Film incoming continuity, newer title playback and remaining independently available variant controls remain open.
- Manual General escape through the real source picker remained available. Its Your Name CineSrc control selected the correct canonical Movie but stayed on loading artwork with no verified advancing time, so actual General film recovery is unproven in that check. General TV playback had passed earlier; no General implementation was changed.
- Final representative preservation and full physical provider qualification remain required for closing this phase. A background/foreground sample is not a complete hidden-audio lifecycle matrix.
- No speculative AniEmbed 0:45 flicker change was made. Opening, navigation or mock tests do not substitute for actual advancing playback.

Captured diagnostics are bounded existing allowlisted Anime identity and continuity lanes. Public provider contract excerpts were inspected separately. No credentials or feedback payloads were printed. After phase4ac, the original awake setting was restored to 0 and Orion was returned to Home. Font scale and user rotation preferences were not changed. The temporary standalone browser tab was closed.

## Internal artifact

The latest installed artifact at the time of this draft is phase4ac: package `com.okali.orion`, version `3.2.1` (59), APK SHA-256 `53a06c0464c1a6f3e94637cd106b4811f3fd17c92a59aede8ff1de3c4f344b70`, signer SHA-256 `4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd`.

Install used only `adb -s R5CWC2RYXZF install -r <APK>`. App ID, first-install time and CE/DE data identities were preserved. A newer internal build adds the AniLink readiness budget; replace this artifact section only after that build/install is verified.

The timing follow-up **phase4ad is built, not installed or physically qualified**. It has the same HEAD/branch/package/version/signer, APK SHA-256 `87dcc1c3faef6178092acdc718cdf3ca3ab5c40e2b6a6c2ad749793bc94d6a21`, and is archived at `test-results/glimpse-physical/phase4ad/orion-mobile-glimpse-internal-physical-test.apk` with its exact source-input manifest. TypeScript, 143 Glimpse/Welcome checks, source-size and preservation gates passed. Its physical test is pending phone availability; no device-use confirmation has arrived for the new session.

No version-code strategy change, signing change, tag, merge, GitHub publication, public v4 identity transition or final seal was performed. Normal production Glimpse exposure remains disabled. Feedback is still unwired in Mobile and its production placeholder Worker has not been mutated.


## Phase4ah Android follow-up — 14 October 2026

The phone reconnected and phase4ah installed in place with permanent signer and retained data. Fresh Dan Da Dan entered through its actual canonical Detail Watch action with no prior Resume, selected AniEmbed Sub and produced changing frames plus verified advancing progress to 65 seconds. Fresh Weathering with You likewise used its actual Movie Detail Watch action and selected AniEmbed Sub after dynamic TMDb 568160→AniList 106286 Movie verification; Retry then produced verified forward playback. No movie season/episode was fabricated and no General surface mounted for these verified controls.

Attack on Titan S2E2 AniLink Sub played from zero with verified progress. After a cold restart its actual saved 0:50 incoming Resume failed to settle and later played near zero. The existing explicit Retry created a new session and confirmed 50→52 seconds, followed by advancing progress. Your Name restored saved AniLink Dub on the Movie route and, after a cold restart, confirmed actual incoming Resume 71→73 seconds with continued progress. Beerus's dynamically verified AniList 206814 identity still reached a provider error on AniLink Sub. Its last immediate Retry was cancelled when leaving; it is not counted as a second completed failure or pass.

These results qualify fresh dedicated-provider priority and successful sampled recovery/film continuity; they do not establish reliable first-attempt AniLink startup/Resume for all controls. The published upstream recovery defect and unsupported host-seek boundary remain documented above. No provider proxy, challenge bypass, invented seek, cross-origin injection or shield weakening was introduced. The user was asked whether to retain this final blocker or explicitly accept the documented manual-source limitation; no waiver is inferred while that decision is pending. Android Back released the player; direct cold-link controls can leave to the launcher because they have no in-app Detail history. No claim of a new Back-button regression is made from an immediate transition capture.


14 October 2026: the user explicitly authorizes AniLink shipping as a documented manual source with the observed Resume/availability limitation. The earlier pending-waiver statement is superseded. Candidate/manual eligibility, unqualified playback status and download exclusion remain intact. Identity proof and source security are not weakened.
