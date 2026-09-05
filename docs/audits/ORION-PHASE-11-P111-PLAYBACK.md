# Phase 11 P11.1 playback checkpoint

Date: 2026-09-06. Status: implementation in progress; physical acceptance pending. No Phase 11 completion credit.

## Implemented boundaries

- Mini-player handoff creates a replacement owner and attachment identity. Commands and telemetry use the replacement's live adapter; saved timing and destroyed embedded callbacks are not live control targets.
- Remote Home/Back use normal navigation and handoff handlers. Stop clears the playback owner; stale queries and late attachment callbacks cannot restore an old owner.
- Explicit Play checks actual media readiness for up to five seconds. Negotiated peers use a six-second Desktop deadline and seven-second Mobile ACK deadline. Older peers retain ordinary deadlines. Source/owner change, disconnect, teardown and expiry cancel the operation. Pending native media Play is paused on cancellation.
- Guest target selection records element/source identity and rejects replacement targets. Timing remains unknown when the provider cannot supply it.
- Music commands use the existing provider, queue and audio engine. Pause/volume/mute update provider state only after confirmation. Queue selection reports loading while its stream prepares. Stop invalidates a pending resolver so late resolution cannot restore playback context. Undeclared queue targets return a capability failure.

Controller takeover cancellation belongs to the P11.2 controller-ownership work and is not claimed here. Pointer scheduling, surface routing, overlay and cursor visual changes are not implemented by this checkpoint.

## Automated validation

Commands run from the repository root:

| Check | Result |
| --- | --- |
| `npm run test:node --workspace=@orion/desktop` | 151 passed |
| `npm run test:renderer --workspace=@orion/desktop` | 501 passed, one playlist UI test failed to find its button within its wait budget; this run preceded the final new Music tests |
| Isolated `MusicCollectionActions.test.jsx` rerun | All 8 passed; broad-run failure is retained rather than described as a clean full pass |
| Focused renderer run: musicPendingStop, playbackDispatch, remoteMusicSession, playbackOperation, systemPlaybackCommands, smartConnectTelemetry, AudioEngine | 34 passed across 7 files, after final playback edits |
| Mobile smartConnectProtocol, smartConnectTrustedPairing, smartConnectLiveTelemetry, smartConnectUnifiedRemote | 21 passed |
| `npm run typecheck --workspace=@orion/mobile` | Passed |
| `npm run check:bindings --workspace=@orion/desktop` | Passed for 350 source files |
| `npm run check:ipc --workspace=@orion/desktop` | Preserved 224 methods / 142 channels |
| `npm run build --workspace=@orion/desktop` | Passed; bundle-size warning remains |
| `npm run check:source-size --workspace=@orion/desktop` | Existing four failures remain: useTVController.js 907, useTVWebview.js 824, styles/components/part-01.css 811, part-03.css 807. Changed Connect IPC is within its limit after deadline helper extraction |

## Physical exit still required

Use a development pair containing these changes; the installed application has not been updated by the source build. Confirm exact Windows/Android identities before recording results. For the longer startup window, both sides must contain the capability negotiation change.

1. Pair, open a title and press Play during provider preparation; confirm success or a bounded failure, without late unexpected playback.
2. Navigate Home during playback, then pause/resume and stop the mini-player; confirm Mobile context follows the surviving owner and clears on stop.
3. Change source or stop while Play is pending; confirm the old command cannot start the replacement or restore the old title.
4. Exercise pop-out/local playback and Music play/pause, queue selection, seek, volume/mute and stop during a pending track lookup.

No physical case has passed in this task. ADB reported no attached device at this checkpoint; a request to connect the Android phone is pending. No signed candidate, installer, version bump or release was produced. The Desktop renderer build is available locally for development validation.

P11.2 addresses cursor latency through bounded ordered dispatch, socket pressure and pre-IPC movement coalescing; P11.3 addresses cursor operation across player surfaces. Both retain the execution plan's physical exit gates.
