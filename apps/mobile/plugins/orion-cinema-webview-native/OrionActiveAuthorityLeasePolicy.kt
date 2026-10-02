package com.okali.orion.playback

/** Process-local idle lease for an exact, foreground-owned HLS/DASH request context. */
internal object OrionActiveAuthorityLeasePolicy {
  const val IDLE_MS = 2L * 60L * 1000L

  fun renewedUntil(now: Long, explicitExpiresAt: Long?, kind: String, exactBoundRequest: Boolean, foregroundOwned: Boolean): Long? =
    if (explicitExpiresAt == null && kind in setOf("hls", "dash") && exactBoundRequest && foregroundOwned)
      now + IDLE_MS else null

  fun valid(now: Long, explicitExpiresAt: Long?, kind: String, boundJobId: String?, leaseUntil: Long, foregroundOwned: Boolean): Boolean =
    explicitExpiresAt == null && kind in setOf("hls", "dash") && boundJobId != null && foregroundOwned && leaseUntil > now
}
