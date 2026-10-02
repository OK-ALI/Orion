package com.okali.orion.playback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionFreshRebindNumberPolicyTest {
  @Test fun persistedSmallIntegersMatchSanitizedLongs() {
    assertFalse((1 as Any) == (1L as Any))
    assertTrue(OrionFreshRebindNumberPolicy.same(1, 1L))
    assertTrue(OrionFreshRebindNumberPolicy.same(4, 4L))
    assertTrue(OrionFreshRebindNumberPolicy.same(null, null))
  }

  @Test fun otherEpisodeAndNonIntegralValuesFailClosed() {
    assertFalse(OrionFreshRebindNumberPolicy.same(3, 4L))
    assertFalse(OrionFreshRebindNumberPolicy.same(null, 0L))
    assertFalse(OrionFreshRebindNumberPolicy.same("4", 4L))
    assertFalse(OrionFreshRebindNumberPolicy.same(4.5, 4L))
  }
}
