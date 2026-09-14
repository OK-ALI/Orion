# WAVEN Orion Cloud Phase 2.2 boundary

This directory contains WAVEN-side access to the shared Orion Cloud Android adapter.

Phase 2.2 is intentionally read-only for profile data:

- Google identity and Drive app-data authorization may be exercised in a physical Android development build.
- OAuth access, refresh, and ID tokens remain native and are never returned to JavaScript.
- The WAVEN read-only probe exposes only `readPortableProfile`.
- The probe always targets `orion-primary-profile-v3`.
- WAVEN has no profile create or write API in this checkpoint.
- If the existing Orion profile is missing, duplicated, invalid, or inaccessible, the preservation gate closes and testing stops.
- No WAVEN music namespace or automatic sync is authorized in Phase 2.

For physical validation, WAVEN must use an Android OAuth client for `com.okali.waven` registered in the same Orion Cloud Google project/consent application used by the ecosystem. A separate Android client is expected for the WAVEN package/signing identity. The physical read-only test determines whether the intended existing `appDataFolder` data is visible. A missing profile is a stop condition, never permission to create a replacement.
