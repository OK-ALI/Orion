# Phase 11 baseline

Recorded 2026-09-06. Stage status: user-reported reproduction available; installed identities and measured timing remain pending.

Source checkpoint: `fa2dfee005c8e35bd98c3f8d9bccc514af6490d1`, branch `codex/orion-v3-p11-reliable-connect`. Source manifests report Desktop 2.2.17 and Mobile 2.2.16 / Android code50. These are not verified installed-device identities.

The user reports successful pairing and regular player controls, failing/stuck mini-player controls, unusable remote cursor on player surfaces, and visible pointer lag. See [physical observations](evidence/p11-baseline/physical-observations.md). Screenshots from the earlier task were not inspected in this task.

The retained [focused baseline](evidence/p11-baseline/focused-tests.tap) records 26 passing checks. It is automated evidence, not a device acceptance result. Baseline command RTT and pointer render-confirmation RTT were not instrumented; there is no measured before/after improvement claim.

On 2026-09-06 the local Android SDK ADB executable was available. `adb devices -l` returned no attached devices. No running Orion/Electron process was returned by the process inspection. Physical P11.1 acceptance remains pending.

See [P11.1 implementation and validation](ORION-PHASE-11-P111-PLAYBACK.md) and the [execution plan](ORION-PHASE-11-RELIABLE-CONNECT-PLAN.md). Existing Master Audit and Mobile test edits remain outside this work's staging scope. No release or version changes have been made.
