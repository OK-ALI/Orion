# Orion Mobile v4 product polish — internal device qualification

## Bundled v4 notes physical follow-up — 14 October 2026

Phase4af was permanently signed and installed with install -r, preserving the application ID, first-install time and CE/DE data identities. It remains internal 3.2.1 (59); the production preview gate stays closed. The read-only /release-notes-test route renders exactly the bundled v4 document through the existing native dialog only when the build-scoped internal flag is enabled, otherwise redirecting to Home without reading notes. It neither modifies update state nor checks for updates. Twenty product/privacy checks, TypeScript, source-size (296 files), and the preservation gate (2,605 frozen files; two navigation additions; 25 exact integrations; 111 additions) passed before the build.

On the actual phone, v4 notes opened offline, their body scrolled while header/footer bounds remained fixed, and font scale 1.6 stayed readable. A temporary density-280 layout simulation exercised the 720dp dialog width limit; this is not a hardware-tablet claim. The official HTTPS link handed off to the installed GitHub app, returning to Orion retained the notes dialog, and Android Back closed it to Settings. Original font scale 1.0, override density 560, Wi-Fi and mobile data were restored. The previously recorded Samsung TalkBack focus/Back checks apply to the unchanged native dialog shell; spoken audio was not recorded. The actual final-version upgrade remains a later gate.

## Official-inbox qualification — 14 October 2026

The real Android → production Worker → Brevo → official.orion.feedback@gmail.com path passed. The explicitly selected official Gmail connection contains exactly four unique qualification emails: Problem, follow-up, feature and general. Structured subjects/bodies, Settings/Annoying fields, original Feedback-ID link and usefulness text match. The Problem has screenshot.jpg (17,991 bytes), orion-diagnostics.zip (467 bytes) and the supplied Reply-To. The recipient opened the ZIP and reported zero events; Gmail does not support ZIP extraction, so no unsupported attachment fetch was attempted. Reports filter recent events to the selected area: after normal Settings navigation, the actual device Included information dialog showed one real Settings event. No artificial event was added; the own unsent preview draft was discarded.

The retry recovered the same Feedback ID without another provider call or duplicate inbox email. History retains four unique receipts across cold restart. Feature/general supplied no reply address or attachments; Brevo adds its verified sender as a default Reply-To and rewrites the free sender address to its brevosend.com domain. Those transport defaults are distinguished from user-supplied reply addresses. The sanitized evidence record contains no diagnostic JSON, raw payloads, credentials or attachment bytes.

Feedback delivery is qualified for phase4ae. AniLink incoming continuity and the final Mobile release gates remain open; this is not a final v4 seal. Earlier pending-inbox statements below are historical and superseded by this qualification.

## Qualification cleanup and presentation checks — 14 October 2026

The final normal-rate Worker deployment is **59b32e72-d13c-4060-8093-d309efdc2523**. The temporary ten-send code and Cloudflare variable were removed before 05:00 Pakistan time. The five/network/day, 100/global/day and six/minute controls are restored. All existing secret names, public sender/recipient values and SQLite namespaces were checked afterward; no secret value was retrieved or replaced. A cleanup-only authoritative variable upload was guarded against unrelated dashboard variables, and the source keep_vars:true policy was restored. Safe endpoint checks return 405/400 without sending mail. Twenty Worker tests and TypeScript pass.

Native Release Notes opened offline and Android Back closed it while Last checked stayed identical. At font scale 1.6, the header, content and close action remained readable without overlap. Samsung TalkBack showed an actual focus indicator and Back returned to Update; speech audio was not recorded. Original accessibility enabled state 0 and the original empty service setting were verified restored. The installed 3.2.1 bundled notes fit the dialog, so these snapshots do not claim overflow scrolling of the longer final 4.0 notes or hardware-tablet qualification.

The Welcome Feedback illustration, report types, IDs/History copy and safe-diagnostics introduction rendered with both network connections disabled, after the existing Orion section and before the Final Chapter. Its product copy promises a final major feature release with maintenance/feedback improvements still possible. The only final actions remained Explore Glimpse and Continue to Orion. Deliberate Continue dismissal persisted across a cold restart in the bounded internal qualification namespace; the real Welcome marker was not modified and the actual final version upgrade remains a later gate. Original font/network/accessibility settings were restored.

**Official-inbox verification passed. Feedback delivery is qualified; AniLink incoming continuity remains an open release gate. No public release or final identity transition is claimed.**


## Current qualification update — 14 October 2026

The existing Production Worker **orion-feedback** is deployed. Its current tested source version is **2476217d-39ba-498e-b6d8-aab23e03c23b**, recorded with runtime-source hashes in test-results/feedback-physical-qualification.json. The existing BREVO_API_KEY was never read, requested or replaced; FEEDBACK_HMAC_SECRET was generated securely only after its absence was verified. SQLite RECEIPTS and BUDGET plus IP_LIMIT were applied through Wrangler. No paid-plan upgrade or additional Worker was created. Workers Free was confirmed by the user; the billing API denied read access, while the live namespace API confirmed SQLite compatibility.

The installed permanently signed **phase4ae** internal APK is 3.2.1 (59), package com.okali.orion, SHA-256 a953c3328e20e7e03ac80e4ef61d2a705fec05eef564e65f53ebb9bfe73307b6. It points to the real Production /v1/feedback endpoint. Data-preserving install and the original signer were verified. It is not a final v4 APK or release checkpoint.

Physical Android sends returned four distinct server IDs: Problem ORN-FB-6BABD5E0133447CD8A2125F6, follow-up ORN-FB-F1C7309B01F842E19D0BF0BC, Feature ORN-FB-B0878E32161E4CB2BC1C5A64, General ORN-FB-2A52F82D63464186AD167F72. All four survived a real cold restart and occur once in native History. The internal first-acknowledgement-loss hook discarded a validated accepted response; Try Again recovered the same Problem ID, and sanitized live events showed no second provider submission. Send another report and a follow-up from the actual History entry were exercised. Earlier offline failure and cold draft/screenshot persistence remain recorded. The user explicitly confirmed removing the earlier failed test draft; its disappearance is not attributed to a persistence regression.

Two live transport defects were repaired: a redirect-handling exception, then Brevo's definite attachment-format rejection. Outgoing requests now use manual redirects, never forwarding the API key to a redirect target. The unchanged diagnostics JSON is carried inside **orion-diagnostics.zip**, containing only **orion-diagnostics.json**; **screenshot.jpg** remains the optional JPEG attachment. ZIP bytes passed an independent .NET reader check. Definite provider rejections return their own daily-budget reservation; accepted or ambiguous requests retain it. Ambiguous pending requests are never automatically resent.

Twenty Worker runtime tests and nineteen Mobile product/privacy tests pass. Operational tracing accepts only generated IDs, fixed allowlisted codes and numeric HTTP status. No report body, user email, screenshot, diagnostic content, authentication information, exception text or secret is logged. Persistent Worker observability and Wrangler disk logging remain disabled.

The user specifically authorized a temporary network allowance of ten sends until **05:00 Pakistan time on 14 October 2026**; it automatically reverts to five afterward. The global 100/day budget and six/minute throttle are unchanged. Remove this temporary qualification variable/code before a final backend checkpoint. Wi-Fi is restored; cellular had no usable connection and is not claimed as qualified.

**Official-inbox verification passed; Feedback physical end-to-end delivery is qualified.** Provider acceptance does not prove recipient delivery. The separate AniLink incoming-continuity release gate remains open. No final identity transition, seal, tag, merge or publication has occurred. The user authorized a documented data-preserving internal 3.2.1 to 4.0.0 upgrade test because no second device running public 3.2.0 exists; the exact public upgrade must not be claimed as physically tested.

The records below describe earlier qualification phases and their state at that time; this update supersedes their earlier current-state statements.


Locked preservation authority: `32ea4f75d8ff64975f44507672ad07db477efaf9`.
Branch: `codex/orion-v4-mobile-glimpse`. Source HEAD is still the locked authority; the worktree contains uncommitted additive work. The APK manifest records SHA-256 for each runtime input, so HEAD alone is not presented as the complete built source.

## Bounded dependencies and final presentation

- Sidebar: the existing connection-status footer now shares one card with Feedback. Status is an informative accessible region; Feedback is a separate button with at least a 44 dp target and a dividing line. Normal text uses two columns. Font scales above 1.3 expand the same card vertically, with no fixed height or overlapping copy. The main menu, Account card, connection state/latency calculation, Downloads availability and navigation handlers remain intact. This corrects the earlier implementation that placed Feedback in a second stacked card and reduced menu height.
- Feedback preview: “Included information” shows the problem report's current user-selected Minor, Annoying or Blocking severity. Submission already carried this value as report metadata; this addition makes the native preview accurately reflect it. No inferred severity, diagnostic schema expansion or backend engine change was needed.
- Settings Update: an Orion-native “View Release Notes” row opens a fixed adaptive native dialog with independently scrolling notes, native headings/paragraphs/bullets/emphasis and safe HTTPS links. Installed notes use local/bundled fallback. Opening/closing changes presentation state only. Existing update lifecycle, installation actions, rollout/channel handling and check state are retained. Only the obsolete inline presentation assertions were adjusted; updater behavior assertions remain.
- Welcome: a passive local Feedback illustration and introduction follows Still Orion and precedes The Final Chapter. It has no network/diagnostic initialization/history lookup and adds no dominant CTA. Final-major-feature-release wording allows later maintenance and feedback improvements. Existing one-time dismissal, startup boundary, motion/profile behavior and two final actions are preserved.
- Feedback: a native utility route with problem/idea/general reports, optional reply email, explicit optional screenshot selection, safe diagnostic preview, bounded local drafts/history and manual retry. No Google email is added automatically. Server IDs are shown only after confirmed provider acceptance. The current APK has no configured Feedback endpoint and truthfully preserves drafts instead of pretending to send.
- Evidence integration: optional bounded listeners consume the existing diagnostics and Anime identity trace. Observer exceptions cannot affect original state/writer behavior. Glimpse supplies sanitized canonical media/playback evidence. Player/provider/Download/Sync engines are unchanged. These listeners do not repair the separate Anime identity release blocker.

Exact reviewed baseline transforms are maintained in `apps/mobile/scripts/product-polish-integrations.cjs`; `check-glimpse-preservation.cjs` compares all other tracked files against the locked authority. Desktop, shared/root product files, signing authority and release identity remain frozen. Glimpse exposure remains a build-scoped internal Metro transform; the normal production source gate remains false.

## Validation

- Mobile TypeScript and source-size check passed (289 files).
- Glimpse/Welcome focused tests: 143 passed.
- Final full Mobile suite before the later existing-target-only backend update: 1,563 tests, 1,558 passed, five inherited Download source assertions failed. Log: test-results/product-polish-final-suite.log.
- Sidebar/presentation/privacy/existing-target focused tests after that update: 51 passed.
- Locked-source preservation passed with 2,617 frozen baseline files, two navigation additions and 13 exact reviewed integrations. The additional sidebar test integration only adds a font-size mock and moves the existing surface assertions to the new shared shell; every original behavior assertion is retained.
- Backend TypeScript and Wrangler dry-run passed; 14 fixture-only Worker runtime tests passed after adapting the existing Production target and sender variable names.

The five inherited Download source assertions are retained and visible; no Download code or tests were modified to make the suite green. They concern historical HLS pause/retry/completion source expectations. The preservation gate confirms the current Download implementation and assertions are unchanged from the authority. This is not a claim of completed physical Download qualification.

Worker tests use synthetic credentials and example.invalid addresses and block unexpected outbound calls. No real key is in a fixture and no real email has been sent.

## Internal physical APK

- Exact source HEAD: `32ea4f75d8ff64975f44507672ad07db477efaf9` (dirty runtime inputs individually hashed in artifact.json).
- Branch: `codex/orion-v4-mobile-glimpse`.
- Package: `com.okali.orion`; versionName: `3.2.1`; versionCode: `59`.
- APK SHA-256: `cb1816041bd9a00366cb27c2c63feb38826d3a108a817f88707302e51f153996`.
- Signer SHA-256: `4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd`.
- APK path: `C:\Users\aliwa\.codex\worktrees\orion-v4-mobile-glimpse\Orion-v3.2.1-MOBILE-FINAL-REPAIR\test-results\glimpse-physical\phase4y\orion-mobile-glimpse-internal-physical-test.apk`.
- Metadata: `test-results/glimpse-physical/phase4y/artifact.json`.
- Current Feedback endpoint: none; neither Production nor test.

The APK uses a production Hermes bundle, a non-debuggable native release build and the permanent Orion signer. It is an internal physical test artifact, not a release checkpoint or public artifact. No uninstall, data clear, signing change, version-code change, tag, GitHub Release or publication is authorized or performed.

## Physical evidence and limits

- Replacement install passed. Signer, source inputs, package/version and original app data IDs/first-install time were verified unchanged.
- Normal Home opened after install.
- phase4y-003-shared-footer: Settings fully visible at normal phone text; status and Feedback share a single compact footer, with separate non-overlapping accessible bounds.
- phase4y-004-shared-footer-large-font: font scale 1.6 expands the same footer into two separated areas with no clipped/overlapping footer copy. The existing menu accessibility fallback scrolls at that scale. Original font scale 1.0 was restored in a finally block.
- phase4y-005-feedback: shared footer Feedback button opens the native Feedback Center.
- phase4y-008-severity-annoying, phase4y-009-severity-blocking, phase4y-010-severity-minor: Included information shows each actual selected value; Android Back closes the preview.
- phase4y-011-feedback-clean: blank qualification draft cleared by normal Back, no feedback sent, and Orion returned to Home. No user draft existed when this blank test was started.
- These tests qualify presentation only. The current APK has no Feedback endpoint and no real end-to-end delivery is claimed.

Earlier phase4w/phase4x device evidence covered native release-notes presentation and Android Back without changing Last checked, Feedback forms and diagnostic privacy presentation, deliberately saved draft restart persistence, honest offline Send failure, corrected Send/FAB spacing, local empty history, and real explicit native screenshot decode/re-encode/preview/removal using an owned synthetic fixture. The fixture and qualification draft were removed; no user's Likes, library or app data were cleared.

Offline release-notes fallback has automated coverage. Earlier physical attempts did not reach the dialog and are not counted as a pass. Hardware tablet/TalkBack and the complete final v4 provider/continuity/Downloads matrix are not claimed by this early presentation smoke test. Actual public 3.2.0 → 4.0.0 upgrade semantics require the final public identity later; internal artifacts remain 3.2.1 (59).

## Secure backend deployment gate

The complete local infrastructure is under apps/mobile/feedback-backend. The user supplied an existing placeholder Worker, orion-feedback, and securely stored BREVO_API_KEY. The local config now targets that Worker and consumes the supplied BREVO_SENDER_EMAIL, BREVO_SENDER_NAME and FEEDBACK_RECIPIENT variable names/values. keep_vars is true; no stored key was read, requested or replaced.

Two SQLite Durable Object bindings are proposed: RECEIPTS → FeedbackReceipt and BUDGET → FeedbackBudget, with v1 new_sqlite_classes for both, plus IP_LIMIT at six requests/minute and a 100/day mail budget. Full exact configuration, free-tier analysis, migration checks and commands are in apps/mobile/feedback-backend/DEPLOYMENT-PLAN.md.

Local Wrangler is not authenticated. The live account's Workers Free status and placeholder binding/migration state are therefore not independently verified. FEEDBACK_HMAC_SECRET was not listed in the supplied external state; check its name after authentication and add it securely only if absent. The existing Brevo key must remain untouched. No Production deployment is performed until the plan and live checks are proven safe.

The Worker has no application log calls; observability is disabled. No API key, raw feedback body, email, image/base64, diagnostic JSON, authentication/session information or raw provider failure is logged.

The installed APK currently points to neither Production nor a test endpoint. After safe deployment, a bounded public endpoint configuration and another permanently signed internal build are required. Physical delivery must prove Orion Android → Production Worker → Brevo → official.orion.feedback@gmail.com. Provider acceptance or local mocks are not inbox delivery.

The separate attached Anime identity/provider functional release blocker remains open; this product-polish phase adds safe evidence only. No final v4 release qualification is asserted.
