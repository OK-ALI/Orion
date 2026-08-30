package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionMediaPlayerSeekPolicyTest {
  @Test
  fun api26UsesSyncFirstAndClosestOnlyForFallback() {
    assertEquals(
      OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC,
      OrionMediaPlayerSeekPolicy.mode(26, OrionMediaPlayerSeekPolicy.Attempt.PRIMARY),
    )
    assertEquals(
      OrionMediaPlayerSeekPolicy.Mode.CLOSEST,
      OrionMediaPlayerSeekPolicy.mode(26, OrionMediaPlayerSeekPolicy.Attempt.FALLBACK),
    )
    assertEquals(
      OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC,
      OrionMediaPlayerSeekPolicy.mode(35, OrionMediaPlayerSeekPolicy.Attempt.PRIMARY),
    )
  }

  @Test
  fun api24And25KeepTheLegacyModeForBothBoundedAttempts() {
    for (apiLevel in listOf(24, 25)) {
      assertEquals(
        OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC,
        OrionMediaPlayerSeekPolicy.mode(apiLevel, OrionMediaPlayerSeekPolicy.Attempt.PRIMARY),
      )
      assertEquals(
        OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC,
        OrionMediaPlayerSeekPolicy.mode(apiLevel, OrionMediaPlayerSeekPolicy.Attempt.FALLBACK),
      )
    }
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
  fun oneAbsoluteDeadlineIsRetainedByTheFallback() {
    val request = request(startUptimeMs = 1_000L)
    assertEquals(11_000L, request.deadlineUptimeMs)
    assertEquals(9_500L, OrionMediaPlayerSeekPolicy.remainingMs(request, 1_500L))
    val fallback = OrionMediaPlayerSeekPolicy.withFallback(request)
    assertEquals(request.generation, fallback.generation)
    assertEquals(request.targetMs, fallback.targetMs)
    assertEquals(request.deadlineUptimeMs, fallback.deadlineUptimeMs)
    assertEquals(OrionMediaPlayerSeekPolicy.Attempt.FALLBACK, fallback.attempt)
    assertEquals(Long.MAX_VALUE, OrionMediaPlayerSeekPolicy.deadline(Long.MAX_VALUE - 1L))
  }

  @Test
  fun samsungStylePrimaryResultSettlesWithoutFallback() {
    val request = request(targetMs = 60_000L)
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.SETTLED,
      OrionMediaPlayerSeekPolicy.completion(request, 59_500L, 120_000L, 2_000L),
    )
  }

  @Test
  fun redmiStyleZeroRequestsExactlyOneClosestFallback() {
    val request = request(targetMs = 60_000L)
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.FALLBACK,
      OrionMediaPlayerSeekPolicy.completion(request, 0L, 120_000L, 2_000L),
    )
    val fallback = OrionMediaPlayerSeekPolicy.withFallback(request)
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.SETTLED,
      OrionMediaPlayerSeekPolicy.completion(fallback, 60_000L, 120_000L, 3_000L),
    )
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.AWAIT_TIMEOUT,
      OrionMediaPlayerSeekPolicy.completion(fallback, 0L, 120_000L, 3_000L),
    )
    assertEquals(
      OrionMediaPlayerSeekPolicy.Completion.TIMED_OUT,
      OrionMediaPlayerSeekPolicy.completion(fallback, 0L, 120_000L, fallback.deadlineUptimeMs),
    )
  }

  @Test
  fun issuedAttemptMustMatchTransactionAttemptAndPlayerGenerations() {
    val primary = request(generation = 7L, playerGeneration = 11L)
    val issuedPrimary = OrionMediaPlayerSeekPolicy.issued(primary)
    assertTrue(OrionMediaPlayerSeekPolicy.acceptsCallback(issuedPrimary, 11L))
    assertFalse(OrionMediaPlayerSeekPolicy.acceptsCallback(issuedPrimary, 12L))
    assertTrue(OrionMediaPlayerSeekPolicy.matchesAttempt(primary, issuedPrimary))
    assertFalse(OrionMediaPlayerSeekPolicy.matchesAttempt(primary.copy(generation = 8L), issuedPrimary))
    assertFalse(
      OrionMediaPlayerSeekPolicy.matchesAttempt(
        OrionMediaPlayerSeekPolicy.withFallback(primary),
        issuedPrimary,
      ),
    )
  }

  @Test
  fun pendingTargetOwnsPresentationOnlyUntilTransactionEnds() {
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
  fun explicitPlaybackIntentCanChangeWithoutChangingSeekIdentity() {
    val playing = request(playWhenSettled = true)
    val paused = OrionMediaPlayerSeekPolicy.withPlayIntent(playing, false)
    assertFalse(paused.playWhenSettled)
    assertEquals(playing.targetMs, paused.targetMs)
    assertEquals(playing.generation, paused.generation)
    assertEquals(playing.playerGeneration, paused.playerGeneration)
    assertEquals(playing.deadlineUptimeMs, paused.deadlineUptimeMs)
    assertEquals(playing.attempt, paused.attempt)
    assertTrue(OrionMediaPlayerSeekPolicy.withPlayIntent(paused, true).playWhenSettled)
  }

  private fun request(
    generation: Long = 1L,
    playerGeneration: Long = 1L,
    targetMs: Long = 30_000L,
    playWhenSettled: Boolean = true,
    startUptimeMs: Long = 1_000L,
  ) = OrionMediaPlayerSeekPolicy.Request(
    generation = generation,
    playerGeneration = playerGeneration,
    targetMs = targetMs,
    playWhenSettled = playWhenSettled,
    deadlineUptimeMs = OrionMediaPlayerSeekPolicy.deadline(startUptimeMs),
  )
}
