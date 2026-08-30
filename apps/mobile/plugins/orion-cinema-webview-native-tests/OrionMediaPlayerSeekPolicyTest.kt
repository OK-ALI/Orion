package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionMediaPlayerSeekPolicyTest {
  @Test
  fun api26UsesClosestSyncAndOlderSupportedAndroidUsesLegacySeek() {
    assertEquals(OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC, OrionMediaPlayerSeekPolicy.mode(24))
    assertEquals(OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC, OrionMediaPlayerSeekPolicy.mode(25))
    assertEquals(OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC, OrionMediaPlayerSeekPolicy.mode(26))
    assertEquals(OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC, OrionMediaPlayerSeekPolicy.mode(35))
  }

  @Test
  fun targetArithmeticIsBoundedAndOverflowSafe() {
    assertEquals(0L, OrionMediaPlayerSeekPolicy.targetMs(100_000L, 0))
    assertEquals(50_000L, OrionMediaPlayerSeekPolicy.targetMs(100_000L, 500))
    assertEquals(99_999L, OrionMediaPlayerSeekPolicy.targetMs(100_000L, 1_000))
    assertEquals(Long.MAX_VALUE - 1L, OrionMediaPlayerSeekPolicy.targetMs(Long.MAX_VALUE, 1_000))
    assertEquals(0L, OrionMediaPlayerSeekPolicy.targetMs(0L, 500))
  }

  @Test
  fun callbackMustBelongToTheCurrentPlayerGeneration() {
    val request = request(playerGeneration = 7L)
    assertTrue(OrionMediaPlayerSeekPolicy.acceptsCallback(request, 7L))
    assertFalse(OrionMediaPlayerSeekPolicy.acceptsCallback(request, 8L))
  }

  @Test
  fun distantEarlyCallbackReissuesOnceThenWaitsInsteadOfAcceptingAFalseZeroPosition() {
    val request = request(targetMs = 60_000L)
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.REISSUE,
      OrionMediaPlayerSeekPolicy.completion(request, 0L, 120_000L),
    )
    val reissued = OrionMediaPlayerSeekPolicy.reissued(request)
    assertEquals(1, reissued.reissues)
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.AWAIT_TIMEOUT,
      OrionMediaPlayerSeekPolicy.completion(reissued, 0L, 120_000L),
    )
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.SETTLED,
      OrionMediaPlayerSeekPolicy.completion(reissued, 60_000L, 120_000L),
    )
  }

  @Test
  fun pendingSeekTargetOwnsProgressPresentationUntilAndroidSettles() {
    assertEquals(
      60_000L,
      OrionMediaPlayerSeekPolicy.displayPosition(actualPositionMs = 0L, pendingTargetMs = 60_000L),
    )
    assertEquals(
      12_000L,
      OrionMediaPlayerSeekPolicy.displayPosition(actualPositionMs = 12_000L, pendingTargetMs = null),
    )
    assertEquals(
      0L,
      OrionMediaPlayerSeekPolicy.displayPosition(actualPositionMs = -1L, pendingTargetMs = null),
    )
    assertEquals(150L, OrionMediaPlayerSeekPolicy.SEEK_CONFIRMATION_DELAY_MS)
  }

  @Test
  fun resumeStartOverNearEndAndPauseIntentRemainExplicit() {
    assertEquals(30_000L, OrionMediaPlayerSeekPolicy.targetMs(120_000L, 250))
    assertEquals(0L, OrionMediaPlayerSeekPolicy.targetMs(120_000L, 0))
    assertEquals(119_999L, OrionMediaPlayerSeekPolicy.targetMs(120_000L, 1_000))
    assertTrue(request(playWhenSettled = true).playWhenSettled)
    assertFalse(request(playWhenSettled = false).playWhenSettled)
  }

  @Test
  fun explicitPlaybackIntentCanChangeWhileSeekIsPending() {
    val playing = request(playWhenSettled = true)
    val paused = OrionMediaPlayerSeekPolicy.withPlayIntent(playing, false)
    assertFalse(paused.playWhenSettled)
    assertEquals(playing.targetMs, paused.targetMs)
    assertEquals(playing.generation, paused.generation)
    assertEquals(playing.playerGeneration, paused.playerGeneration)
    assertEquals(playing.reissues, paused.reissues)
    assertTrue(OrionMediaPlayerSeekPolicy.withPlayIntent(paused, true).playWhenSettled)
  }

  private fun request(
    playerGeneration: Long = 1L,
    targetMs: Long = 30_000L,
    playWhenSettled: Boolean = true,
  ) = OrionMediaPlayerSeekPolicy.Request(
    generation = 1L,
    playerGeneration = playerGeneration,
    targetMs = targetMs,
    playWhenSettled = playWhenSettled,
  )
}
