# Orion Mobile v4.1.0 infrastructure checkpoint

2026-11-03. Development backup only; application implementation remains on hold. The accepted production baseline is Mobile v4.0.0, commit `5d5e893f8be951020015aa658dfe1a67d8c0b16d`.

## Approved changes

- A: complete the explicit native copy manifest with three existing classes and two existing tests; add strict manifest coverage.
- B: normalize CRLF only inside four Download test source selectors. Preserve original assertions and raw generated-source equality.
- C: add an independent Mobile identity map/checker without changing the Desktop/combined map or release workflows. Mobile remains4.0.0/code60.
- D: use pinned test-only Robolectric and a real owned-job fixture; retain missing-job denial and production transfer fences.
- Approved D follow-up: wait for each of two progress callbacks using CountDownLatch, bounded to five seconds. Preserve all original assertions, expected values, production events and teardown; no sleeps or runtime changes.

## Validation

| Gate | Result |
| --- | --- |
| Fresh Android generation and byte-for-byte source copy | PASS: 52 native sources,22 tests,one resource |
| Gateway tests after callback correction | PASS: 4/4 |
| Complete native Kotlin/JVM suite | PASS: 164/164, zero skips |
| Independent forced repeat of complete native suite | PASS: 164/164, zero skips |
| Fresh native Kotlin compilation | PASS: debug variant; no production-equivalence claim |
| Robolectric dependency isolation | PASS: test runtime only; absent from debug/release runtime graphs |
| Mobile/shared TypeScript | PASS |
| Complete existing Mobile suite | FAIL: 1,618/1,620; old frozen preservation gate and historical Gradle fingerprint |
| New Mobile identity check | PASS |
| Legacy combined release map | FAIL: retained older Mobile3.2.1/code59 expectations |
| Original-signed new production build | BLOCKED: original signing credentials/configuration unavailable; production verification unresolved |
| Physical Samsung, owner UI acceptance and actual updater qualification | NOT RUN; remain mandatory future gates |

The previous native run's 163/164 progress assertion failure is resolved by the separately approved callback-wait test correction. This does not resolve historical production verification. Normal native test execution uses no logging shim, test filtering for the complete suite, disabled assertions or force-success mechanism.

The historical v4.0.0 generated Gradle fingerprint remains unchanged:

`0df69eef3e0aee7ff94596f7a37c25943fb978037b845ec855aa541c38d2b8ba`

The original Glimpse preservation checks, signing authority, updater trust, production services, Desktop, shared package and release workflows remain unchanged. Deterministic development-profile and strict development-preservation proposals remain local review artifacts; neither is installed or trusted. The README modernization also remains outside this backup checkpoint pending its publishing boundary.

This checkpoint must not be described as a green complete infrastructure baseline or release qualification. No product feature, version bump, installation, protected-branch merge, release tag or production deployment is included.
