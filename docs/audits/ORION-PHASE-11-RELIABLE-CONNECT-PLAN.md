# Phase 11 - Reliable Orion Connect

Status: P11.1 IN PROGRESS. The user reported the physical baseline; installed identities and measured latency remain unverified in this task. No Phase 11 completion credit.

Approved scope: user-approved implementation plan, 2026-09-05.

Starting checkpoint: `fa2dfee005c8e35bd98c3f8d9bccc514af6490d1`.

Branch: `codex/orion-v3-p11-reliable-connect`.

## 1. Starting point and scope

Phases 0-10 are accepted at their recorded boundaries. Phase 10A is locked at `f8611c6d18738f4d187b5d1e19fdf1c4766bf4c6`, with completion audit `fa2dfee005c8e35bd98c3f8d9bccc514af6490d1`. Desktop starts at 2.2.17 and Mobile source at 2.2.16 / Android code50. The Phase 10A manual-upgrade exception remains separate from Connect work.

The Master Audit explicitly transferred failed physical Connect outcomes from Phase 4 to V3-P11-002 through V3-P11-009. Phase 4's secure foundation remains accepted. The Master Audit's version table is historical; its existing local changes must be preserved.

Deliver the existing remote hub for Windows Desktop and Android: reliable startup Play, truthful playback context, bounded low-latency input, correct control across player surfaces, Desktop-authoritative source selection, basic Music Planet playback controls, multiple trusted phones with one active controller, and a compact theme-aware arrow with a subtle halo and no movement trail.

Excluded: phone-to-Desktop title launching, casting, cloud/internet relay, media transfer, Mobile Music browsing, player-engine replacement and Orion 3.0 release qualification.

## 2. Architecture and interface decisions

### Secure foundation and compatibility

Keep protocol v3, pinned WSS, device-bound identity, replay protection, acknowledgements, pairing, discovery and revocation. Extend shared contracts additively with negotiated capabilities. Older clients retain compatible controls and receive explicit errors for unsupported actions. Never expose pairing secrets, arbitrary webContents IDs, provider URLs or private media request data to the remote UI or diagnostics.

### Playback ownership and command outcomes

- Derive context from live playback owners rather than route alone. Preserve genuine mini/pop-out playback after navigation; clear stopped/destroyed sessions.
- Route remote Home/Back through the normal navigation and handoff handlers.
- Bind commands to session, source and owner revision. Fence stale queries and cancel pending actions on source change, teardown or controller takeover.
- Explicit Play uses a cancellable 5-second readiness window, 6-second Desktop deadline and 7-second Mobile deadline. Ordinary command deadlines remain 1.8 seconds on Desktop and 2.2 seconds on Mobile.
- Actual media-target control readiness, not WebView existence or timing alone, permits Play. Success requires confirmation. No synthetic clicks or execution of expired Play intents.
- Reuse the current Music provider/engine for Now Playing, play/pause, previous/next, seek when supported, volume and mute. Do not create another Music queue or playback owner.

### Bounded input

- Retain Mobile latest-position scheduling and 24/30/40 Hz adaptation.
- Use one ordered outbound dispatcher and assign sequences at dispatch. Coalesce pointer positions, accumulate scroll deltas and preserve reliable-command ordering.
- Expose native socket queue pressure and send failure. Keep one pending pointer position, bounded scroll accumulation and at most 32 pending reliable commands. Overflow returns an explicit busy result.
- Coalesce pointer movement again before Desktop renderer IPC. Scrolling must not consume the reliable-control rate budget.
- Clicks carry coordinates and target revision, independent of the previous rendered cursor position.

### Desktop pointer-surface owner

- Main owns a registry for ordinary pages, embedded players, mini-player, pop-out, fullscreen and local playback against existing windows/webContents.
- Main validates targets and maps coordinates. Mobile receives opaque surface identities only.
- Display the arrow through a local transparent, non-focusable, click-through overlay. Route input to the registered underlying surface, honoring Orion controls above embedded content.
- Track move, resize, zoom, DPI and player handoffs. Invalidate stale coordinates and hide on teardown, disconnect, takeover or loss of the relevant window.
- Keep control inside Orion. Only explicit Focus Desktop may foreground the selected window; pointer movement never steals another application's focus. Electron input injection requires the containing BrowserWindow to be focused.

### Remote hub

- Publish the existing Desktop eligible-source catalog and live health. Revalidate session/catalog revision before applying through the ordinary Desktop source-switch path.
- Preserve existing source ranking and continuity policy; do not promise seamless seeking where Desktop cannot provide it.
- Show connected Desktop, active controller, current playback owner, Connect command latency, reconnect status and reasons for unavailable controls.
- First authenticated controller gets control when none is active. Other connected phones observe until explicit takeover. Takeover invalidates old pending input.
- Retain trusted-device management, accessible D-pad and keyboard actions. Type into the declared eligible field only; protected inputs reject remote text.

## 3. Ordered stages and mandatory exits

| Stage | Deliverable | Exit evidence |
| --- | --- | --- |
| P11.0 | Branch, execution plan, exact owner baseline, automated baseline and current installed-device reproduction | Exact Windows/Android identities and recorded physical observations of deferred failures; redacted timing evidence or explicit not-instrumented status |
| P11.1 | Startup readiness/deadlines, navigation/context truth, stale-result cancellation, Music adapters | Physical Play, navigation away, mini continuation, stop and source-change cancellation |
| P11.2 | Ordered bounded dispatch, native pressure, pre-IPC coalescing, active-controller ownership | Sustained gestures with interleaved reliable controls and explicit takeover |
| P11.3 | Pointer-surface registry, overlay, mapping/input routing | Ordinary pages, embedded/fullscreen, mini/pop-out, local playback, handoffs and DPI checks |
| P11.4 | Source selection, companion/device status and six-theme cursor polish | Physical source switching, Music controls, accessibility and presentation checks |
| P11.5 | Affected broad gates, signed candidate pair, completion audit and lock | Installed production pair accepted; V3-P11-001 through V3-P11-009 reconciled with retained evidence |

Every stage ends with a recorded physical result before the next repair group begins. A failed case receives a narrow repair and repeats only that case plus affected regressions. Unit-test success is not physical acceptance. Pending cases remain pending; no implied approval or elapsed time can supply an observation.

## 4. Validation

Baseline tests include the existing 26 focused checks, several of which are source-pattern guards. Preserve those guards; add behavioral tests for new failure paths instead of treating source matching as runtime proof.

Required scenarios:

- Delayed readiness, unavailable/rejecting providers, deadline expiry and no late execution.
- Continuing mini/pop-out ownership versus actual teardown; stale async results cannot resurrect an old title.
- Pointer/scroll/reliable traffic, native send failure, duplicate/out-of-order envelopes, takeover and reconnect.
- Guest/overlay/fullscreen click accuracy, mixed DPI, resize and destruction.
- Source changes during selection, unavailable sources and preserved continuity policy.
- Music ownership and supported capabilities.
- Pairing, expiry, revocation, sleep/wake, Wi-Fi interruption, LAN without internet and older v3 compatibility.
- All six themes, Reduced Motion, large text, portrait/landscape and accessibility.

Initial physical targets on the representative same-LAN Windows/Android pair:

| Metric | Acceptance target |
| --- | --- |
| Ordinary acknowledged command RTT | Median <=80 ms; p95 <=250 ms; declared provider preparation excluded |
| Sampled pointer render-confirmation RTT | p95 <=150 ms using one clock; explicitly distinct from visual latency |
| Mixed-input stress | Two minutes of gestures and at least 50 reliable commands; no unexplained timeout, stuck Loading or catch-up backlog |
| Context/playback publication | Visible on Mobile within one second |
| Idle work | No unnecessary sustained high-frequency work |

Capture comparable before/after conditions. Investigate failures or obtain an explicit acceptance amendment; do not silently relax thresholds. Never subtract unsynchronized Desktop and Mobile wall clocks and call it measured one-way latency.

## 5. Release, data and documentation discipline

No version bump or release mutation during diagnosis. Allocate the next unused patch only at the signed-candidate gate. Preserve published tags, signing identities and all existing user data. Use the next genuine Desktop candidate to test the repaired updater from installed 2.2.17 where feasible, with its evidence separate from Connect acceptance.

Keep a standalone Phase 11 evidence record. Do not stage the modified Master Audit, protected Mobile test, or deferred P10A.3 inspection report. Master Audit reconciliation must later preserve existing edits and historical rows; this plan or scaffolding earns no weighted credit. Phase 12 remains the final release gate and Phase 11 does not authorize version 3.0.0.

Current evidence: [P11.0 baseline and reproduction record](ORION-PHASE-11-P110-BASELINE.md).
