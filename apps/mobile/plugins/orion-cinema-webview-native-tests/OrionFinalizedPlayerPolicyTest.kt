package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionFinalizedPlayerPolicyTest {
  @Test
  fun requiresNonZeroAttachedViewAndSurface() {
    assertFalse(OrionFinalizedPlayerPolicy.hasRenderableSurface(readyEvidence(viewWidth = 0)))
    assertFalse(OrionFinalizedPlayerPolicy.hasRenderableSurface(readyEvidence(surfaceHeight = 0)))
    assertTrue(OrionFinalizedPlayerPolicy.hasRenderableSurface(readyEvidence()))
  }

  @Test
  fun layoutDeadlineClassifiesSurfaceFailure() {
    assertNull(OrionFinalizedPlayerPolicy.layoutDeadlineFailure(2_999L, OrionFinalizedPlayerEvidence()))
    val failure = OrionFinalizedPlayerPolicy.layoutDeadlineFailure(3_000L, OrionFinalizedPlayerEvidence())!!
    assertEquals("finalized-video-surface-unavailable", failure.code)
    assertEquals("surface", failure.category)
  }

  @Test
  fun preparationDeadlineIsIndependentOfRenderDeadline() {
    assertNull(OrionFinalizedPlayerPolicy.preparationDeadlineFailure(29_999L, OrionFinalizedPlayerEvidence()))
    assertEquals(
      "finalized-player-prepare-timeout",
      OrionFinalizedPlayerPolicy.preparationDeadlineFailure(30_000L, OrionFinalizedPlayerEvidence())?.code,
    )
    assertNull(OrionFinalizedPlayerPolicy.preparationDeadlineFailure(30_000L, readyEvidence()))
  }

  @Test
  fun finalizedMediaRequiresSupportedVideoAndAudioTracks() {
    assertEquals("finalized-video-track-missing", OrionFinalizedPlayerPolicy.trackFailure(readyEvidence(videoTrackCount = 0))?.code)
    assertEquals("finalized-audio-track-missing", OrionFinalizedPlayerPolicy.trackFailure(readyEvidence(audioTrackCount = 0))?.code)
    assertNull(OrionFinalizedPlayerPolicy.trackFailure(readyEvidence()))
  }

  @Test
  fun readyCallbackWaitsForBoundedTrackDiscovery() {
    val readyWithoutTracks = OrionFinalizedPlayerEvidence(playerReady = true)
    assertNull(OrionFinalizedPlayerPolicy.trackDeadlineFailure(2_999L, readyWithoutTracks))
    assertEquals(
      "finalized-video-track-missing",
      OrionFinalizedPlayerPolicy.trackDeadlineFailure(3_000L, readyWithoutTracks)?.code,
    )
  }

  @Test
  fun videoDecoderAbsenceIsDistinctFromRenderFailure() {
    val failure = OrionFinalizedPlayerPolicy.firstFrameDeadlineFailure(
      10_000L,
      readyEvidence(videoDecoderInitialized = false),
    )!!
    assertEquals("finalized-video-decoder-not-initialized", failure.code)
    assertEquals("decoder", failure.category)
  }

  @Test
  fun audioDecoderAbsenceIsDistinctFromRenderFailure() {
    val failure = OrionFinalizedPlayerPolicy.firstFrameDeadlineFailure(
      10_000L,
      readyEvidence(audioDecoderInitialized = false),
    )!!
    assertEquals("finalized-audio-decoder-not-initialized", failure.code)
  }

  @Test
  fun readyPlayerWithoutFirstFrameFailsAsRenderTimeout() {
    assertNull(OrionFinalizedPlayerPolicy.firstFrameDeadlineFailure(9_999L, readyEvidence()))
    val failure = OrionFinalizedPlayerPolicy.firstFrameDeadlineFailure(10_000L, readyEvidence())!!
    assertEquals("finalized-first-frame-timeout", failure.code)
    assertEquals("render", failure.category)
  }

  @Test
  fun renderedFirstFrameCancelsTheDeadline() {
    assertNull(OrionFinalizedPlayerPolicy.firstFrameDeadlineFailure(
      20_000L,
      readyEvidence(firstFrameRendered = true),
    ))
  }

  @Test
  fun staleGenerationCallbacksAreRejected() {
    assertTrue(OrionFinalizedPlayerPolicy.acceptsGeneration(7L, 7L))
    assertFalse(OrionFinalizedPlayerPolicy.acceptsGeneration(7L, 8L))
  }

  @Test
  fun retryPreservesCurrentSurfaceButClearsPlaybackEvidence() {
    val reset = OrionFinalizedPlayerPolicy.resetForRetry(readyEvidence(firstFrameRendered = true))
    assertTrue(OrionFinalizedPlayerPolicy.hasRenderableSurface(reset))
    assertFalse(reset.playerReady)
    assertEquals(0, reset.videoTrackCount)
    assertEquals(0, reset.audioTrackCount)
    assertFalse(reset.videoDecoderInitialized)
    assertFalse(reset.audioDecoderInitialized)
    assertFalse(reset.firstFrameRendered)
  }

  @Test
  fun hostResumeRestoresOnlyPriorPlayIntent() {
    assertTrue(OrionFinalizedPlayerPolicy.shouldResumeAfterHostResume(true, false))
    assertFalse(OrionFinalizedPlayerPolicy.shouldResumeAfterHostResume(false, false))
    assertFalse(OrionFinalizedPlayerPolicy.shouldResumeAfterHostResume(true, true))
  }

  private fun readyEvidence(
    viewWidth: Int = 1_920,
    surfaceHeight: Int = 1_080,
    videoTrackCount: Int = 1,
    audioTrackCount: Int = 1,
    videoDecoderInitialized: Boolean = true,
    audioDecoderInitialized: Boolean = true,
    firstFrameRendered: Boolean = false,
  ) = OrionFinalizedPlayerEvidence(
    attached = true,
    viewWidth = viewWidth,
    viewHeight = 1_080,
    surfaceAvailable = true,
    surfaceWidth = 1_920,
    surfaceHeight = surfaceHeight,
    playerReady = true,
    videoTrackCount = videoTrackCount,
    audioTrackCount = audioTrackCount,
    videoDecoderInitialized = videoDecoderInitialized,
    audioDecoderInitialized = audioDecoderInitialized,
    firstFrameRendered = firstFrameRendered,
  )
}
