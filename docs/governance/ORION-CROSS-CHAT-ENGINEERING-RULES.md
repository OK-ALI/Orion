# Orion — Cross-Chat Engineering Rules

**Project:** Orion — A Multiverse of Stories
**Applies to:** Desktop, Mobile, Cinema, Music Planet, Smart Connect, Downloader/Playback, Search/Discovery, Cross-Platform work, and future Orion subsystems
**Purpose:** Preserve engineering discipline across separate ChatGPT/Codex conversations and prevent regressions caused by context loss.

---

# 1. Core project principle

Each Orion chat is a **specialized engineering session**, not an isolated project.

Chats may focus on different subsystems, but they all operate on the same Orion product and must preserve the same architectural contracts, locks, validation standards, and audit history.

The local Orion workspace is the authoritative implementation state.

**Do not reconstruct Orion from memory when the workspace or subsystem audit can be inspected.**

---

# 2. Local workspace is authoritative

Primary Windows project root:

`C:\Projects\Orion - A Multiverse of Stories`

Desktop:

`C:\Projects\Orion - A Multiverse of Stories\apps\desktop`

Mobile:

`C:\Projects\Orion - A Multiverse of Stories\apps\mobile`

Rules:

- Never silently restore files from GitHub.
- Never assume GitHub is newer than the user's local workspace.
- Never overwrite validated local changes just because remote history looks cleaner.
- Inspect the actual current workspace before producing a repair.
- If a ZIP is provided by the user, treat it as the current handoff snapshot unless explicitly told otherwise.

---

# 3. Lock discipline

A subsystem marked **LOCKED** is not casually editable.

Locked means the area has passed the required combination of:

- implementation review,
- focused tests,
- full gates,
- production build,
- E2E where applicable,
- and physical validation.

Reopen a locked area only for:

1. a proven regression,
2. an important product requirement,
3. a proven accessibility defect,
4. a proven performance defect,
5. an explicit architecture migration,
6. or a cross-platform requirement that genuinely requires changing the owner.

Do not perform speculative cleanup inside locked areas.

---

# 4. Shared-owner rule

Use this diagnostic rule:

**shared defect → shared owner → global repair**
**page-specific defect → page composition repair**

Do not copy the same CSS or logic antidote across several pages.

Before patching a repeated defect, locate the actual owner:

- shared component,
- shared hook,
- shared store,
- shared stylesheet,
- shared protocol,
- shared backend service,
- or shared navigation owner.

This rule prevented repeated screenshot-by-screenshot patching during Desktop stabilization and must remain permanent.

---

# 5. Audit-first rule

Before declaring a subsystem complete:

1. Compare the result against the roadmap or phase contract.
2. Confirm locked boundaries were not accidentally reopened.
3. Confirm tests/build/E2E evidence exists.
4. Confirm physical behavior where the feature is user-facing.
5. Record known non-blockers.
6. Update or create the subsystem audit.
7. Only then mark the phase/subsystem LOCKED.

For Mobile Phase 8 specifically:

- perform an explicit audit at the end of **every P8.x subphase**,
- compare against the Phase 8 roadmap and locked boundaries,
- and at **P8.7 perform a full Phase 8 cross-platform audit**.

**Do not declare Phase 8 locked unless every contract is evidenced by code, tests, build, and physical validation.**

---

# 6. Canonical subsystem audit model

Every locked Orion subsystem should have its own audit.

Recommended locations:

`apps\desktop\docs\audits\ORION-DESKTOP-CORE-AUDIT.md`
`apps\desktop\docs\audits\ORION-CINEMA-AUDIT.md`
`apps\desktop\docs\audits\ORION-MUSIC-PLANET-AUDIT.md`
`apps\desktop\docs\audits\ORION-SMART-CONNECT-AUDIT.md`
`apps\desktop\docs\audits\ORION-DOWNLOADER-PLAYBACK-AUDIT.md`
`apps\desktop\docs\audits\ORION-SEARCH-DISCOVERY-AUDIT.md`

The master Desktop audit:

`apps\desktop\docs\audits\ORION-DESKTOP-V3-AUDIT.md`

Rule:

**Subsystem chats produce evidence.
Subsystem audits preserve evidence.
The V3 audit summarizes subsystem audits.**

Do not update V3 from chat memory alone when a subsystem audit exists.

---

# 7. Audit contents

A canonical subsystem audit should contain:

- final lock state,
- scope,
- major defects found,
- root causes,
- architecture/ownership decisions,
- important files or owners,
- locked boundaries,
- focused tests,
- full gate results,
- build results,
- E2E results,
- physical validation,
- known non-blockers,
- reopen rules,
- post-lock amendment template,
- exact summary entry that the master V3 audit should inherit.

Future changes to a locked subsystem should be added as a **dated post-lock amendment**, not by erasing the original stabilization history.

---

# 8. Candidate ZIP workflow

There are two different ZIP workflows.

## User-created input ZIPs

When the user packages workspace files for analysis, the ZIP stays in the project root:

`C:\Projects\Orion - A Multiverse of Stories\`

ZIP entries must be project-root-relative.

When requesting a fresh ZIP, always name the **exact file/folder paths** needed.

Do not ask vaguely for "the relevant files".

## Assistant-created repair/candidate ZIPs

Candidate ZIPs downloaded by the user are stored in:

`C:\Users\aliwa\Downloads\desktop-repair-candidates\`

Apply candidates into:

`C:\Projects\Orion - A Multiverse of Stories`

All future apply commands should automatically reference the candidate folder.

Do not ask the user to manually locate the candidate again.

---

# 9. Exact-path handoff rule

Whenever requesting a ZIP or additional files, list exact paths.

Example:

`apps\desktop\src\renderer\features\music\MusicPlanet.jsx`

not:

`MusicPlanet files`

This is mandatory for Orion handoffs.

---

# 10. Terminal command presentation rule

Meaningful command blocks must be organized and copy-paste ready for Windows PowerShell.

Template:

```powershell
Write-Host "`n============================================================" -ForegroundColor <Color>
Write-Host "[ORION <PHASE>] <PURPOSE>" -ForegroundColor <Color>
Write-Host "============================================================" -ForegroundColor <Color>

cd "<exact working directory>"

<commands>

Write-Host "`n============================================================" -ForegroundColor <Color>
Write-Host "[END ORION <PHASE>]" -ForegroundColor <Color>
Write-Host "============================================================`n" -ForegroundColor <Color>
```

Color convention:

- Cyan: apply / full gate / build / audit
- Yellow: focused diagnostic/test
- Magenta: E2E/runtime
- Green: artifact/path confirmation

Rules:

- one purpose per block,
- exact working directory,
- actual execution order,
- preserve logs,
- dependent stages say **If green, run:**,
- avoid giant mixed command blocks.

---

# 11. Source-size rule

If a source file approaches or exceeds the hard source-size limit:

**Do not increase the limit just to make the check pass.**

Split responsibility into:

- component,
- owner module,
- hook,
- helper,
- stylesheet,
- service,
- or another correct architectural boundary.

A source-size failure is an architecture signal.

This applies especially to large Music/Cinema stylesheets.

---

# 12. Build and E2E ordering

Production Electron E2E tests use the production build.

Correct order:

1. apply source change,
2. run focused tests,
3. run full gates,
4. build production `dist`,
5. run Electron E2E,
6. perform physical validation.

Do not run production E2E against stale `dist`.

A previous Music playlist-artwork E2E false failure was caused by exactly this ordering mistake.

---

# 13. Physical validation rule

Automated tests do not replace physical validation for user-facing Orion behavior.

Physical validation is mandatory for:

- visual composition,
- navigation,
- hover/focus behavior,
- responsive layouts,
- overlays,
- playback,
- gestures,
- mobile controls,
- theme behavior,
- pairing,
- real-device flows,
- and anything where actual user interaction can expose problems that DOM assertions miss.

If physical validation exposes a real defect after green automation:

- do not lock,
- diagnose the real owner,
- repair narrowly,
- rerun the necessary evidence.

---

# 14. Narrowest diagnostic first

When a failure appears:

1. reproduce the narrowest failing contract,
2. inspect the owner,
3. patch only the responsible layer,
4. run the focused test,
5. then run the full gate.

Do not immediately perform broad refactors.

---

# 15. Do not silence warnings dishonestly

Known examples:

- Vite >500 kB chunk warning,
- SQLite experimental warning,
- React test `act(...)` warnings.

If a warning is non-blocking, record it as backlog.

Do not change thresholds or disable warnings merely to make output look cleaner.

---

# 16. Mobile physical-validation rule

When Mobile reaches a standalone Android APK build and it is time for physical validation on the Samsung S24 Ultra, provide the exact ADB installation commands proactively.

Do not wait for the user to ask.

The physical Android device is part of the acceptance evidence.

---

# 17. Cross-platform ownership rule

Phase 8 connects Mobile and Desktop.

Before changing either side, determine where the contract is actually owned.

Examples:

- authentication,
- cloud state,
- Google Drive backup/sync architecture,
- pairing,
- remote control protocol,
- navigation context,
- portable state,
- shared identity.

Do not duplicate the same contract separately in Desktop and Mobile when it can be represented by a shared or explicit cross-platform contract.

If a Desktop change is required for a Mobile Phase 8 goal, first verify that the Desktop area is not locked or determine whether the cross-platform requirement justifies a controlled post-lock amendment.

---

# 18. Frozen-work rule

When a subsystem is intentionally frozen:

- do not continue opportunistic work in it,
- preserve the current handoff state,
- document why it is frozen,
- finish the blocking dependency,
- audit the dependency,
- then explicitly resume.

Mobile was frozen while Desktop stabilization was completed.

The freeze is not abandonment. It is an architecture sequencing decision.

---

# 19. Current Orion sequencing history

The important sequence is:

1. Orion Mobile was stabilized and locked through the earlier mobile phases.
2. Mobile Phase 8 began as the cross-platform phase.
3. Phase 8 work involved Desktop integration, including Google authentication and Google Drive architecture.
4. Desktop issues were discovered.
5. Mobile Phase 8 was intentionally frozen.
6. Desktop stabilization became the priority.
7. Cinema was stabilized first.
8. Music Planet was stabilized next.
9. Music Planet stabilization also uncovered and fixed backend/functional defects.
10. Cinema and Music Planet are producing canonical subsystem audits.
11. These subsystem audits will feed the Desktop V3 audit.
12. After the Desktop audit state is trustworthy, work returns to the frozen Mobile Phase 8 chat.
13. Phase 8 then continues from the existing locked Mobile baseline rather than restarting.

---

# 20. How a chat should resume inherited Orion work

When a chat receives this project after a pause:

1. Read the relevant subsystem audit.
2. Read the current handoff.
3. Inspect the current workspace.
4. State the current lock board.
5. Identify the exact active phase.
6. Identify frozen areas.
7. Confirm the next acceptance contract.
8. Continue from the last validated checkpoint.
9. Do not repeat already-locked work.
10. Do not invent a new roadmap unless the existing roadmap has a real gap.

---

# 21. Phase-end behavior

At the end of any meaningful Orion phase:

- state what changed,
- state what remained untouched,
- list tests,
- list build/E2E evidence,
- request physical validation if required,
- audit against roadmap,
- update canonical subsystem audit,
- mark the phase locked only after evidence is complete.

---

# 22. Post-lock amendment discipline

If a future feature touches a locked subsystem, append:

```md
## Post-Lock Amendment — YYYY-MM-DD

### Reason
Why was the locked subsystem reopened?

### Scope
What owners/files changed?

### Locked contracts affected
What previous guarantees were touched?

### Evidence
- focused tests:
- full gate:
- build:
- E2E:
- physical validation:

### Result
PASS / FAIL / PARTIAL

### New lock state
What is locked now?
```

---

# 23. Orion development posture

Do not optimize for "green output".

Optimize for:

- correct architecture,
- stable ownership,
- evidence,
- real-device behavior,
- maintainability,
- and continuity between chats.

The goal is not to finish a chat.

The goal is to leave Orion in a state the next chat can trust.
