# WAVEN duplicate launcher audit — Samsung SM-S928B — 2026-10-02

**Device:** `SM-S928B`, serial `R5CWC2RYXZF`, Samsung Android 16/API 36. The owner's supplied screenshot showed three identical WAVEN icons under the **Personal** tab. ADB and APK inspection proved three separately installed application IDs, each with exactly one `MAIN` + `LAUNCHER` filter and no `activity-alias`. These were not three activities in the canonical app and were not caused by viewing the Work tab.

## Exact package and icon map

| Launcher label | Package / launch activity | Version | Build and signer SHA-256 | Personal user 0 before → after | Work user 10 |
|---|---|---|---|---|---|
| WAVEN | `com.okali.waven/.MainActivity` | `0.1.0` / code `1` | Signed production, `6C174A80E1BE09BFF78C3FA7A60356ACCF600F994E7137C7717C3BD04FA5B6F2` | Installed/enabled → installed/enabled; **sole visible icon** | Installed/enabled, untouched |
| WAVEN | `com.okali.waven.development/com.okali.waven.MainActivity` | `0.1.0` / code `1` | Phase 7 debug development build, `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C` | Installed/enabled → **installed/disabled for user 0**, private data retained | Installed/enabled, untouched |
| WAVEN | `com.okali.waven.sourcevalidation/com.okali.waven.MainActivity` | `0.1.0` / code `1` | Disposable clean-install debug build, same debug signer `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C` | Installed/enabled → **removed for user 0 only** | Installed/enabled, untouched |

All three were under `/data/app` and had `installerPackageName=null`; their personal UIDs were `10599`, `10339`, and `10354`, respectively. Work-profile UIDs were `1010599`, `1010339`, and `1010354`. `dumpsys package` showed `installed=true` for users 0 and 10 before cleanup. Only the two debug packages had `DEBUGGABLE` in `pkgFlags`. The Work profile is Android user 10 (`Orion`); no work-profile package or data was changed. The `pm list packages --user` and `cmd package query-activities --user` results distinguished installed package state from active launcher count.

The canonical source `apps/waven/app.json` declares `android.package=com.okali.waven`; generated `android/app/build.gradle` declares the same `applicationId`. The generated/source manifest has one `MainActivity` with one `MAIN` + `LAUNCHER` filter; APK XML inspection found one of each and zero aliases in every artifact. Temporary Gradle init scripts under `release/waven-phase7-20261001/` applied `.development` and `.sourcevalidation` **debug** application-ID suffixes for isolated Phase 7 and clean-install validation. Both reused the WAVEN label/icon, so installing them alongside the signed canonical package produced the three Personal icons. There is no current canonical source/config duplicate-launcher defect, and no source fix or regression test was needed.

## Data preservation and bounded cleanup

The authoritative Phase 7 **implementation and accepted physical state** are in the development package's app-private native MMKV, not in the older signed canonical production package. Before cleanup, `run-as com.okali.waven.development` showed `files/mmkv/waven.library` (32,768 bytes) and its CRC, plus the separate controlled `waven.library.validation` fixture. The hashes below matched **before and after** cleanup:

| Development private file | SHA-256 before = after |
|---|---|
| `files/mmkv/waven.library` | `678BF73F05DDCCC8DAB14DA025105F24EF71C57D616087DCCEA9DC5CD1529A87` |
| `files/mmkv/waven.library.crc` | `F8E81D0CDDFBD4509F86B66468C8A1DEC3CDC995D6581940C761ADFDF4A81CAE` |
| `files/mmkv/waven.library.validation` | `23079DB7465B6CB6FE4C56A0FED69D4C9B04635475323AD67F5CF42302C44D64` |
| `files/mmkv/waven.library.validation.crc` | `AD00654293C60B7AC0196958739A9C15203D03DD95DC1C1A269C70B59C8B68E5` |

The source-validation package was explicitly a disposable clean-install fixture; its own MMKV file was only 4,096 bytes, and the prior Phase 7 record attributed no accepted favorite/playlist/history state to it. After proof, `pm uninstall --user 0 com.okali.waven.sourcevalidation` removed **only its Personal installation**. The work-profile copy remains. No `adb uninstall` was used.

Samsung denied `pm disable-user --user 0` for the development **component** with `SecurityException`; that attempt changed nothing. `pm disable-user --user 0 com.okali.waven.development` then succeeded at the **personal package** level. It is reversible, leaves the development APK and data installed, and suppresses its personal launcher icon. The work-profile installation remains enabled. Neither `pm clear` nor uninstall/reinstall was used on the canonical or development package. The real Google session was not switched or cleared.

This is an important presentation boundary: the sole visible icon now opens the signed `com.okali.waven` package, which has a separate app-private data directory and predates the accepted Phase 7 development build. Its empty Recently Played view must **not** be interpreted as loss of the preserved development Library. Favorites, playlist order, and history remain in the development MMKV with identical hashes, but its UI is dormant while that personal package is disabled. To resume Phase 7 development UI later, `pm enable --user 0 com.okali.waven.development` will restore access **and a second launcher icon**. No cross-signature data migration or Phase 7 production release was attempted in this launcher audit.

## Final verification

- `cmd package query-activities --user 0 -a android.intent.action.MAIN -c android.intent.category.LAUNCHER` returned exactly **one** WAVEN component: `com.okali.waven/.MainActivity`. [Final Personal app-drawer capture](../../release/waven-launcher-audit-20261002/launcher-final.png) visibly shows one WAVEN icon.
- `am force-stop --user 0 com.okali.waven` followed by `am start -W --user 0 -n com.okali.waven/.MainActivity` returned `Status: ok`, `LaunchState: COLD`; `topResumedActivity` was the canonical component. [Canonical launch capture](../../release/waven-launcher-audit-20261002/canonical-final.png) shows the app rendering normally. It was left foreground.
- Canonical installed APK SHA-256 remained `82423FC09F8B168CBF3D5B9CE7B8D04B1886239E21C824D7FF990A3C0EDCAB19`; development installed APK remained `611256CB1274C89B2180A77C41E773C885C77427A12F86DB325D2477B51D8006`. Both match the exact previously inspected local artifacts. The clean-install APK remains available as a local artifact, SHA-256 `EF0B395341B1249FAF459D727649852C3FDB61082B010C3E7631B55A5694EB8E`.
- Final personal package state: canonical installed/enabled; development installed/disabled with MMKV hashes unchanged; sourcevalidation not installed. Final Work profile state: all three still installed/enabled, untouched. No canonical package data or Google identity was cleared.

**Source files changed for launcher issue:** none. **COMMIT = NO. PUSH = NO.** The separate Phase 7 ACK/ledger governance changes were verified before this audit and do not alter accepted Phase 6 evidence.
