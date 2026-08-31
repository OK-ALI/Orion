package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionMediaPlayerSeekPolicyTest {
  @Test
  fun apiModesPreserveModernPrimaryAndLegacyCompatibility() {
    assertEquals(OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC, mode(26, OrionMediaPlayerSeekPolicy.Attempt.PRIMARY))
    assertEquals(OrionMediaPlayerSeekPolicy.Mode.CLOSEST, mode(26, OrionMediaPlayerSeekPolicy.Attempt.FALLBACK))
    for (api in listOf(24, 25)) {
      assertEquals(OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC, mode(api, OrionMediaPlayerSeekPolicy.Attempt.PRIMARY))
      assertEquals(OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC, mode(api, OrionMediaPlayerSeekPolicy.Attempt.FALLBACK))
    }
  }

  @Test
  fun targetArithmeticAndOneAbsoluteDeadlineRemainBounded() {
    assertEquals(0L, OrionMediaPlayerSeekPolicy.targetMs(100_000L, 0))
    assertEquals(50_000L, OrionMediaPlayerSeekPolicy.targetMs(100_000L, 500))
    assertEquals(99_999L, OrionMediaPlayerSeekPolicy.targetMs(100_000L, 1_000))
    assertEquals(Long.MAX_VALUE - 1L, OrionMediaPlayerSeekPolicy.targetMs(Long.MAX_VALUE, 1_000))
    val primary = request(startUptimeMs = 1_000L)
    val fallback = OrionMediaPlayerSeekPolicy.withFallback(primary)
    assertEquals(11_000L, primary.deadlineUptimeMs)
    assertEquals(primary.deadlineUptimeMs, fallback.deadlineUptimeMs)
    assertEquals(Long.MAX_VALUE, OrionMediaPlayerSeekPolicy.deadline(Long.MAX_VALUE - 1L))
  }

  @Test
  fun callbackPositionWithoutFrameEvidenceNeverSettlesOrFallsBackImmediately() {
    val request = request(targetMs = 60_000L)
    var observation = observation(request, callbackUptimeMs = 2_000L, frameGeneration = 5L)
    var result = observe(request, observation, 60_000L, 2_100L, 5L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
    observation = result.observation
    result = observe(request, observation, 0L, 2_200L, 5L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
  }

  @Test
  fun delayedFrameAndTwoNearSamplesSettle() {
    val request = request(targetMs = 60_000L)
    var observation = observation(request, callbackUptimeMs = 2_000L, frameGeneration = 5L)
    var result = observe(request, observation, 59_200L, 2_100L, 6L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
    observation = result.observation
    result = observe(request, observation, 59_500L, 2_200L, 7L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.SETTLE, result.decision)
  }

  @Test
  fun preCallbackFrameCannotSatisfyPostCallbackRenderEvidence() {
    val request = request(targetMs = 60_000L)
    var observation = observation(
      request,
      callbackUptimeMs = 2_000L,
      frameGeneration = 6L,
      issuedFrameGeneration = 5L,
    )
    var result = observe(request, observation, 59_500L, 2_100L, 6L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
    observation = result.observation
    result = observe(request, observation, 60_000L, 2_200L, 6L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)

    observation = result.observation
    result = observe(request, observation, 59_500L, 2_300L, 7L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
    observation = result.observation
    result = observe(request, observation, 60_000L, 2_400L, 7L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.SETTLE, result.decision)
  }

  @Test
  fun stableFarPrimarySamplesTriggerExactlyOneFallback() {
    val primary = request(targetMs = 60_000L)
    var observation = observation(primary, callbackUptimeMs = 2_000L, frameGeneration = 5L)
    var result = observe(primary, observation, 0L, 2_100L, 6L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
    observation = result.observation
    result = observe(primary, observation, 100L, 2_200L, 7L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.FALLBACK, result.decision)

    val fallback = OrionMediaPlayerSeekPolicy.withFallback(primary)
    observation = observation(fallback, callbackUptimeMs = 2_300L, frameGeneration = 7L)
    result = observe(fallback, observation, 0L, 4_000L, 8L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.WAIT, result.decision)
  }

  @Test
  fun primaryWithoutConvergenceFallsBackAfterBoundedWait() {
    val request = request(targetMs = 60_000L)
    val observation = observation(request, callbackUptimeMs = 2_000L, frameGeneration = 5L)
    val result = observe(request, observation, 0L, 3_500L, 5L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.FALLBACK, result.decision)
  }

  @Test
  fun fallbackConvergesOrTimesOutWithoutThirdAttempt() {
    val fallback = OrionMediaPlayerSeekPolicy.withFallback(request(targetMs = 60_000L))
    var observation = observation(fallback, callbackUptimeMs = 3_000L, frameGeneration = 8L)
    var result = observe(fallback, observation, 59_500L, 3_100L, 9L)
    observation = result.observation
    result = observe(fallback, observation, 60_000L, 3_200L, 10L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.SETTLE, result.decision)

    observation = observation(fallback, callbackUptimeMs = 3_000L, frameGeneration = 8L)
    result = observe(fallback, observation, 0L, fallback.deadlineUptimeMs, 10L)
    assertEquals(OrionMediaPlayerSeekPolicy.Decision.TIMED_OUT, result.decision)
  }

  @Test
  fun issuedAttemptFencesPlayerTransactionAttemptAndSurfaceGeneration() {
    val primary = request(generation = 7L, playerGeneration = 11L)
    val issued = OrionMediaPlayerSeekPolicy.issued(primary, 2_000L, 13L)
    assertEquals(13L, issued.issuedSurfaceFrameGeneration)
    assertTrue(OrionMediaPlayerSeekPolicy.acceptsCallback(issued, 11L))
    assertFalse(OrionMediaPlayerSeekPolicy.acceptsCallback(issued, 12L))
    assertTrue(OrionMediaPlayerSeekPolicy.matchesAttempt(primary, issued))
    assertFalse(OrionMediaPlayerSeekPolicy.matchesAttempt(primary.copy(generation = 8L), issued))
    assertFalse(OrionMediaPlayerSeekPolicy.matchesAttempt(OrionMediaPlayerSeekPolicy.withFallback(primary), issued))
  }

  @Test
  fun presentationIntentResumeStartOverAndNearEndStayExplicit() {
    assertEquals(60_000L, OrionMediaPlayerSeekPolicy.displayPosition(0L, 60_000L))
    assertEquals(12_000L, OrionMediaPlayerSeekPolicy.displayPosition(12_000L, null))
    assertEquals(0L, OrionMediaPlayerSeekPolicy.targetMs(120_000L, 0))
    assertEquals(30_000L, OrionMediaPlayerSeekPolicy.targetMs(120_000L, 250))
    assertEquals(119_999L, OrionMediaPlayerSeekPolicy.targetMs(120_000L, 1_000))
    val playing = request(playWhenSettled = true)
    val paused = OrionMediaPlayerSeekPolicy.withPlayIntent(playing, false)
    assertFalse(paused.playWhenSettled)
    assertEquals(playing.generation, paused.generation)
    assertEquals(playing.deadlineUptimeMs, paused.deadlineUptimeMs)
  }

  private fun mode(api: Int, attempt: OrionMediaPlayerSeekPolicy.Attempt) =
    OrionMediaPlayerSeekPolicy.mode(api, attempt)

  private fun request(
    generation: Long = 1L,
    playerGeneration: Long = 1L,
    targetMs: Long = 30_000L,
    playWhenSettled: Boolean = true,
    startUptimeMs: Long = 1_000L,
  ) = OrionMediaPlayerSeekPolicy.Request(
    generation,
    playerGeneration,
    targetMs,
    playWhenSettled,
    OrionMediaPlayerSeekPolicy.deadline(startUptimeMs),
  )

  private fun observation(
    request: OrionMediaPlayerSeekPolicy.Request,
    callbackUptimeMs: Long,
    frameGeneration: Long,
    issuedFrameGeneration: Long = frameGeneration,
  ) = OrionMediaPlayerSeekPolicy.beginObservation(
    OrionMediaPlayerSeekPolicy.issued(request, callbackUptimeMs - 100L, issuedFrameGeneration),
    callbackUptimeMs,
    frameGeneration,
  )

  private fun observe(
    request: OrionMediaPlayerSeekPolicy.Request,
    observation: OrionMediaPlayerSeekPolicy.Observation,
    positionMs: Long,
    nowUptimeMs: Long,
    frameGeneration: Long,
  ) = OrionMediaPlayerSeekPolicy.observe(
    request,
    observation,
    positionMs,
    120_000L,
    nowUptimeMs,
    frameGeneration,
  )
}
