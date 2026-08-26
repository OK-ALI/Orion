package com.okali.orion.playback

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionPortableCadenceTest {
  private val frame = 41_667L

  @Test
  fun bFramePresentationOrderSurvivesUniformPlacement() {
    val timestamps = longArrayOf(0L, frame * 3L, frame, frame * 2L, frame * 6L, frame * 4L, frame * 5L)
    val analysis = assertNotNullValue(OrionPortableCadence.analyze(timestamps, OrionPortableCadence.Kind.VIDEO, frame))
    assertTrue(analysis.reordered)
    val placement = assertNotNullValue(OrionPortableCadence.place(analysis, null))
    val output = timestamps.map { assertNotNullValue(OrionPortableCadence.applyOffset(it, placement.offsetUs)) }.toLongArray()
    assertArrayEquals(timestamps, output)
    assertTrue(output[2] < output[1])
  }

  @Test
  fun naturallyContinuousFragmentsKeepOneOffset() {
    val first = analyze(longArrayOf(0L, frame, frame * 2L))
    val firstPlacement = assertNotNullValue(OrionPortableCadence.place(first, null))
    val second = analyze(longArrayOf(frame * 3L, frame * 4L, frame * 5L))
    val secondPlacement = assertNotNullValue(OrionPortableCadence.place(second, firstPlacement.next))
    assertFalse(secondPlacement.rebased)
    assertEquals(firstPlacement.offsetUs, secondPlacement.offsetUs)
  }

  @Test
  fun boundaryInsideCadenceEnvelopeRemainsUntouched() {
    val firstPlacement = assertNotNullValue(OrionPortableCadence.place(analyze(longArrayOf(0L, frame, frame * 2L)), null))
    val boundary = firstPlacement.maxTimeUs + maxOf(1_000L, frame / 8L)
    val second = analyze(longArrayOf(boundary, boundary + frame, boundary + frame * 2L))
    val secondPlacement = assertNotNullValue(OrionPortableCadence.place(second, firstPlacement.next))
    assertFalse(secondPlacement.rebased)
    assertEquals(firstPlacement.offsetUs, secondPlacement.offsetUs)
  }

  @Test
  fun fragmentLocalResetGetsOneUniformRebase() {
    val firstPlacement = assertNotNullValue(OrionPortableCadence.place(analyze(longArrayOf(0L, frame, frame * 2L)), null))
    val local = longArrayOf(0L, frame * 2L, frame)
    val localAnalysis = analyze(local)
    val secondPlacement = assertNotNullValue(OrionPortableCadence.place(localAnalysis, firstPlacement.next))
    assertTrue(secondPlacement.rebased)
    val output = local.map { assertNotNullValue(OrionPortableCadence.applyOffset(it, secondPlacement.offsetUs)) }
    assertEquals(local[1] - local[0], output[1] - output[0])
    assertEquals(local[2] - local[1], output[2] - output[1])
    assertTrue(output.min() > firstPlacement.maxTimeUs)
  }

  @Test
  fun legitimateVariableFrameRateDeltasArePreserved() {
    val timestamps = longArrayOf(0L, 33_000L, 75_000L, 116_000L, 166_000L)
    val analysis = assertNotNullValue(OrionPortableCadence.analyze(timestamps, OrionPortableCadence.Kind.VIDEO, frame))
    val placement = assertNotNullValue(OrionPortableCadence.place(analysis, null))
    val output = timestamps.map { assertNotNullValue(OrionPortableCadence.applyOffset(it, placement.offsetUs)) }.toLongArray()
    assertArrayEquals(presentationDeltas(timestamps), presentationDeltas(output))
  }

  @Test
  fun oneMicrosecondClustersFailEvenWhenAverageLooksPlausible() {
    val clustered = longArrayOf(0L, 125_000L, 125_001L, 125_002L, 250_000L, 250_001L, 250_002L)
    assertNull(OrionPortableCadence.analyze(clustered, OrionPortableCadence.Kind.VIDEO, frame))
  }

  @Test
  fun duplicatesSlideshowGapsAndDeepReorderFail() {
    assertNull(OrionPortableCadence.analyze(longArrayOf(0L, frame, frame), OrionPortableCadence.Kind.VIDEO, frame))
    assertNull(OrionPortableCadence.analyze(longArrayOf(0L, frame, 400_000L), OrionPortableCadence.Kind.VIDEO, frame))
    assertNull(OrionPortableCadence.analyze(longArrayOf(1_100_001L, 0L, frame), OrionPortableCadence.Kind.VIDEO, frame))
  }

  @Test
  fun analysisAndPlacementRemainBounded() {
    assertNull(OrionPortableCadence.analyze(LongArray(20_001) { it.toLong() * frame }, OrionPortableCadence.Kind.VIDEO, frame))
    val overflow = analyze(longArrayOf(Long.MAX_VALUE - frame, Long.MAX_VALUE))
    assertNull(OrionPortableCadence.place(overflow, OrionPortableCadence.Timeline(0L, 0L, Long.MAX_VALUE, frame)))
  }

  @Test
  fun audioTimelineIsIndependentAndAvDriftIsBounded() {
    val audioStep = 21_333L
    val first = assertNotNullValue(OrionPortableCadence.analyze(longArrayOf(500_000L, 521_333L, 542_666L), OrionPortableCadence.Kind.AUDIO, audioStep))
    val placement = assertNotNullValue(OrionPortableCadence.place(first, null))
    assertEquals(0L, placement.minTimeUs)
    assertTrue(OrionPortableCadence.withinAvDrift(6_000_000L, 10_999_999L))
    assertFalse(OrionPortableCadence.withinAvDrift(6_000_000L, 11_000_001L))
  }

  @Test
  fun streamingSampleLedgerMatchesOnlyTheExactTimelineAndSizes() {
    val expected = OrionPortableSampleLedger().apply {
      assertTrue(add(0L, 1_024L))
      assertTrue(add(frame, 2_048L))
      assertTrue(add(frame * 2L, 1_536L))
    }.finish()
    val same = OrionPortableSampleLedger().apply {
      add(0L, 1_024L)
      add(frame, 2_048L)
      add(frame * 2L, 1_536L)
    }.finish()
    val changed = OrionPortableSampleLedger().apply {
      add(0L, 1_024L)
      add(frame + 1L, 2_048L)
      add(frame * 2L, 1_536L)
    }.finish()
    assertEquals(expected, same)
    assertFalse(expected?.digest == changed?.digest)
  }

  @Test
  fun boundedTimestampCollectorGrowsAndRejectsOverflow() {
    val collector = OrionBoundedLongCollector(maximumSize = 5, initialCapacity = 1)
    repeat(5) { index -> assertTrue(collector.add(index.toLong() * frame)) }
    assertFalse(collector.add(5L * frame))
    assertArrayEquals(LongArray(5) { it.toLong() * frame }, collector.toLongArray())
  }

  private fun analyze(values: LongArray): OrionPortableCadence.Analysis = assertNotNullValue(
    OrionPortableCadence.analyze(values, OrionPortableCadence.Kind.VIDEO, frame),
  )

  private fun <T : Any> assertNotNullValue(value: T?): T {
    assertNotNull(value)
    return value!!
  }

  private fun presentationDeltas(timestamps: LongArray): LongArray {
    return LongArray(timestamps.size - 1) { index -> timestamps[index + 1] - timestamps[index] }
  }
}
