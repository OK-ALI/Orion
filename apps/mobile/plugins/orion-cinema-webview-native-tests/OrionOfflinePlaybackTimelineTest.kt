package com.okali.orion.playback

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionOfflinePlaybackTimelineTest {
  private val frame = 41_667L

  @Test
  fun acceptsReorderDuplicatesIrregularCadenceAndNegativeStartsWithoutMutation() {
    val timestamps = longArrayOf(-83_334L, 41_667L, -41_667L, -41_667L, 0L, 190_000L)
    val original = timestamps.copyOf()
    val analysis = assertNotNullValue(analyze(timestamps))

    assertTrue(analysis.reordered)
    assertTrue(analysis.hasDuplicatePresentationTimes)
    assertTrue(analysis.durationUs > 0L)
    assertArrayEquals(original, timestamps)
  }

  @Test
  fun collapsedPresentationTimesUseBoundedNominalDuration() {
    val analysis = assertNotNullValue(analyze(longArrayOf(5_000L, 5_000L, 5_000L)))
    assertEquals(frame * 3L, analysis.durationUs)
    assertEquals(frame, analysis.representativeStepUs)
  }

  @Test
  fun segmentLocalResetsAreAggregatedWithoutCrossSegmentPlacement() {
    val first = assertNotNullValue(analyze(longArrayOf(900_000L, 941_667L, 983_334L)))
    val reset = assertNotNullValue(analyze(longArrayOf(-41_667L, 0L, 41_667L)))
    assertEquals(
      first.durationUs + reset.durationUs,
      OrionOfflinePlaybackTimeline.totalDurationUs(longArrayOf(first.durationUs, reset.durationUs)),
    )
  }

  @Test
  fun rejectsMalformedOversizedUnboundedAndOverflowingInput() {
    assertNull(OrionOfflinePlaybackTimeline.analyze(longArrayOf(), longArrayOf(), frame))
    assertNull(OrionOfflinePlaybackTimeline.analyze(longArrayOf(0L), longArrayOf(0L), frame))
    assertNull(OrionOfflinePlaybackTimeline.analyze(
      longArrayOf(0L),
      longArrayOf(OrionOfflinePlaybackTimeline.MAX_SAMPLE_BYTES + 1L),
      frame,
    ))
    assertNull(OrionOfflinePlaybackTimeline.analyze(
      LongArray(OrionOfflinePlaybackTimeline.MAX_SAMPLES_PER_SEGMENT + 1) { it.toLong() },
      LongArray(OrionOfflinePlaybackTimeline.MAX_SAMPLES_PER_SEGMENT + 1) { 1L },
      frame,
    ))
    assertNull(OrionOfflinePlaybackTimeline.analyze(
      longArrayOf(0L),
      longArrayOf(1L),
      frame,
      maxSamples = OrionOfflinePlaybackTimeline.MAX_SAMPLES_PER_SEGMENT + 1,
    ))
    assertNull(analyze(longArrayOf(Long.MIN_VALUE, Long.MAX_VALUE)))
    assertNull(analyze(longArrayOf(0L, OrionOfflinePlaybackTimeline.MAX_SEGMENT_DURATION_US + 1L)))
    assertNull(OrionOfflinePlaybackTimeline.totalDurationUs(longArrayOf(
      OrionOfflinePlaybackTimeline.MAX_PRESENTATION_DURATION_US,
      1L,
    )))
  }

  @Test
  fun playbackAvDriftUsesItsOwnBoundedPlausibilityEnvelope() {
    val hour = 60L * 60L * 1_000_000L
    assertTrue(OrionOfflinePlaybackTimeline.withinAvDrift(hour, hour - 4L * 60L * 1_000_000L))
    assertFalse(OrionOfflinePlaybackTimeline.withinAvDrift(hour, hour - 6L * 60L * 1_000_000L))
  }

  private fun analyze(timestamps: LongArray): OrionOfflinePlaybackTimeline.Analysis? =
    OrionOfflinePlaybackTimeline.analyze(
      timestampsUs = timestamps,
      sampleSizes = LongArray(timestamps.size) { 1_024L },
      fallbackStepUs = frame,
    )

  private fun <T : Any> assertNotNullValue(value: T?): T {
    assertNotNull(value)
    return value!!
  }
}
