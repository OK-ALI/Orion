# Orion P8.4 Candidate 3-A — Desktop PortableProfileV3 Read Bridge Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Phase 8 cross-platform viewing-state synchronization prerequisite
**Audit date:** 2026-08-19
**Audit status:** **COMPLETE & LOCKED**
**Canonical Desktop baseline:** `359932d94a6ba2e4c7711bd7f7f4befc8ed5b280`
**Next phase:** P8.4 C3-B — Watched namespace machinery
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

P8.4 C3-A establishes the first controlled bridge from the stabilized Orion Desktop to the same PortableProfileV3 Google Drive profile already used by Orion Mobile.

This candidate is intentionally read-only.

It proves:

- Desktop and Mobile can reach the same PortableProfileV3 cloud document,
- Desktop can derive the same stable Google account identity used by the portable profile,
- the Desktop Drive bridge uses the Mobile-compatible appDataFolder filename contract,
- Drive revision tokens are exposed as opaque concurrency evidence,
- malformed, missing, duplicate, unstable, or identity-mismatched profiles fail closed,
- and the existing legacy Desktop Google backup remains separate and untouched.

C3-A does not synchronize Watched, History, Progress, or Continue Watching.

---

## 2. Controlled Desktop post-lock amendment

C3-A required a narrow extension to the stabilized Desktop Google/IPC boundary.

New owners:

- `apps\desktop\src\main\ipc\portableProfileStore.js`
- `apps\desktop\src\main\ipc\portableProfileIpc.js`
- `apps\desktop\src\preload\api\portableProfile.js`
- `apps\desktop\src\renderer\services\portableProfileProbe.js`
- `apps\desktop\src\renderer\features\settings\components\PortableProfileProbeCard.jsx`

Existing composition owners amended narrowly:

- `apps\desktop\src\main\bootstrap.js`
- `apps\desktop\src\preload\index.js`
- `apps\desktop\src\renderer\features\settings\sections\GeneralSettings.jsx`
- `apps\desktop\tests\fixtures\ipc-contract.json`

Tests:

- `apps\desktop\tests\unit\main\portableProfileStore.test.js`
- `apps\desktop\tests\unit\renderer\portableProfileProbe.test.js`

No Mobile implementation or shared PortableProfileV3 contract was modified.

---

## 3. Legacy Google backup boundary

The existing Desktop legacy cloud path remains unchanged:

`orion-sync-manifest.json`

Its viewing-state authority remains fenced under P8.4 C2.

C3-A introduces a separate read path for the PortableProfileV3 document used by Orion Mobile.

The legacy APIs remain:

- `google-auth:upload-sync`
- `google-auth:download-sync`

The new C3-A API is:

- preload method: `readPortableProfile`
- IPC channel: `portable-profile:read`

C3-A does not repurpose the legacy backup APIs.

---

## 4. Portable profile filename contract

Desktop now matches the existing Mobile appDataFolder naming algorithm.

For a PortableProfileV3 profile key:

1. trim the logical profile key,
2. SHA-256 hash the UTF-8 key,
3. retain the first 32 hexadecimal characters,
4. construct:

`orion-portable-profile-v3-<digest>.json`

This prevents Desktop from inventing a second cloud document identity.

---

## 5. Stable Drive read contract

The Desktop reader performs a bounded stable snapshot:

1. fetch Drive metadata,
2. read the profile body,
3. fetch Drive metadata again,
4. accept the snapshot only when the revision token remains stable.

Revision-token preference:

1. strong ETag when available,
2. Drive `version` fallback.

Duplicate matching profile files fail closed.

A changing document retries boundedly and then fails without mutation.

The profile size is bounded before acceptance.

---

## 6. Identity contract

Desktop uses the stable Google UserInfo subject identifier:

`googleProfile.sub`

PortableProfileV3 uses:

`profile.profileId`

C3-A permits the profile only when:

`googleProfile.sub === profile.profileId`

Email is not used as portable profile identity.

Missing stable subject identity blocks synchronization.

Identity mismatch blocks synchronization.

---

## 7. PortableProfileV3 validation

The renderer parses the read-only cloud JSON through the existing shared:

`normalizePortableProfileV3`

A malformed or structurally invalid cloud document is rejected.

No alternate Desktop interpretation of PortableProfileV3 was introduced.

---

## 8. Mutation boundary

C3-A is strictly read-only.

It does not:

- create PortableProfileV3,
- update PortableProfileV3,
- delete PortableProfileV3,
- migrate legacy cloud state,
- modify Watched,
- modify History,
- modify Progress,
- modify My List,
- modify Preferences,
- modify legacy `orion-sync-manifest.json`.

A missing PortableProfileV3 is evidence only. Desktop does not create one automatically.

---

## 9. Focused automated evidence

Main-process focused tests:

- Desktop filename matches Mobile SHA-256 appDataFolder contract
- missing profile returns `missing` without creation
- stable Mobile-compatible profile snapshot is returned
- duplicate profile files are refused
- strong ETag / Drive-version revision-token semantics are preserved

Result:

**5 / 5 PASS**

Renderer focused tests:

- matching Google subject identity is accepted
- identity mismatch fails closed
- missing profile remains read-only
- missing stable Desktop subject ID blocks synchronization

Result:

**4 / 4 PASS**

IPC contract after C3-A:

- **221 preload methods**
- **140 IPC channels**

---

## 10. Full Desktop evidence

C3-A full Desktop gate:

| Gate | Result |
|---|---|
| Source-size | 347 files passed |
| Renderer bindings | 301 files passed |
| IPC | 221 methods / 140 channels |
| Secrets | PASS |
| Theme colors | PASS |
| Circular dependencies | none |
| Node tests | 94 / 94 |
| Renderer tests | 50 files / 189 tests |
| Production build | PASS |

Known existing non-blocking warnings remained:

- Node SQLite experimental warning
- MiniPlayer React `act(...)` test warning
- Vite chunk-size warning

No warning was silenced by weakening a gate.

---

## 11. Physical cross-platform proof

Physical Desktop validation was performed against the same Google account used by Orion Mobile.

The Desktop Settings probe reported:

`PortableProfileV3 is visible and its Orion profile identity matches this Desktop Google account.`

Additional physical evidence:

- profile revision: `9`
- portable namespaces visible: `1`
- Drive revision token available: `yes`

This proves the Desktop OAuth/Drive path can see the same PortableProfileV3 universe and agrees with its stable Orion profile identity.

The probe remained read-only throughout validation.

**PHYSICAL PASS**

---

## 12. Locked boundaries audit

C3-A did not reopen or modify:

- Cinema behavior
- Music Planet behavior
- playback verification semantics
- Start Over / Not Started reset semantics
- Smart Connect
- downloader behavior
- Mobile implementation
- P8.3 My List synchronization semantics
- PortableProfileV3 schema
- portable viewing-state contracts
- legacy viewing-state cloud authority

The only locked Desktop amendment was the narrowly scoped read-only Google/IPC bridge required for Phase 8 cross-platform integration.

---

## 13. Final C3-A status

**P8.4 C3-A — COMPLETE & LOCKED**

C3-A proves the transport and identity bridge only.

It does not grant permission to activate broad viewing-state synchronization.

---

## 14. Next candidate

Next:

**P8.4 C3-B — Watched namespace machinery**

C3-B must establish:

- portable Watched namespace signatures,
- record/tombstone semantics,
- Desktop local Watched apply adapter,
- Mobile local Watched apply adapter,
- exact movie and exact TV episode truth,
- derived whole-series state remaining local,
- preservation of unrelated namespaces.

Automatic steady-state sync is not implied merely by C3-B.

Phase 8 remains **NOT LOCKED**.
