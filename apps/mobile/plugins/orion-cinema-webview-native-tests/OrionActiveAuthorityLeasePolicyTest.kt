package com.okali.orion.playback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionActiveAuthorityLeasePolicyTest {
  @Test fun activeHlsAndDashCanContinuePastCandidateTtlWithAuthorizedUse() {
    val afterThirtyMinutes = 31L * 60L * 1000L
    for (kind in listOf("hls", "dash")) {
      val lease = OrionActiveAuthorityLeasePolicy.renewedUntil(afterThirtyMinutes, null, kind, true, true)!!
      assertTrue(OrionActiveAuthorityLeasePolicy.valid(afterThirtyMinutes, null, kind, "job", lease, true))
      assertFalse(OrionActiveAuthorityLeasePolicy.valid(lease, null, kind, "job", lease, true))
    }
  }

  @Test fun unboundExpiredCancelledAndDeadProcessContextsCannotContinue() {
    val lease = OrionActiveAuthorityLeasePolicy.renewedUntil(100L, null, "hls", true, true)!!
    assertFalse(OrionActiveAuthorityLeasePolicy.valid(101L, null, "hls", null, lease, true))
    assertFalse(OrionActiveAuthorityLeasePolicy.valid(101L, null, "hls", "job", lease, false))
    assertNull(OrionActiveAuthorityLeasePolicy.renewedUntil(101L, null, "hls", false, true))
    assertNull(OrionActiveAuthorityLeasePolicy.renewedUntil(101L, null, "hls", true, false))
    assertNull(OrionActiveAuthorityLeasePolicy.renewedUntil(101L, null, "direct", true, true))
  }

  @Test fun explicitSignedExpiryRemainsHard() {
    assertNull(OrionActiveAuthorityLeasePolicy.renewedUntil(101L, 100L, "hls", true, true))
    assertFalse(OrionActiveAuthorityLeasePolicy.valid(101L, 100L, "hls", "job", 1000L, true))
  }
}
