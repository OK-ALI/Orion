package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionFinalizedMediaPolicyTest {
  @Test
  fun requiresAnIsoBmffFileTypeBoxInsteadOfTrustingTheExtension() {
    val mp4Prefix = byteArrayOf(
      0, 0, 0, 24, 'f'.code.toByte(), 't'.code.toByte(), 'y'.code.toByte(), 'p'.code.toByte(),
      'i'.code.toByte(), 's'.code.toByte(), 'o'.code.toByte(), 'm'.code.toByte(),
      0, 0, 2, 0, 'i'.code.toByte(), 's'.code.toByte(), 'o'.code.toByte(), 'm'.code.toByte(),
      'm'.code.toByte(), 'p'.code.toByte(), '4'.code.toByte(), '2'.code.toByte(),
    )
    assertTrue(OrionFinalizedMediaPolicy.hasIsoBmffFileType(mp4Prefix, mp4Prefix.size.toLong()))
    assertFalse(OrionFinalizedMediaPolicy.hasIsoBmffFileType(ByteArray(188) { 0x47.toByte() }, 188L))
  }

  private val video = OrionFinalizedTrackProbe("video", 1_440L, 60_000_000L, 1_920, 1_080, 2_000_000L)
  private val audio = OrionFinalizedTrackProbe("audio", 2_814L, 60_000_000L, largestSampleBytes = 8_192L)

  @Test
  fun acceptsFinalizedMp4WithPlayableVideoAndExpectedAudio() {
    val result = OrionFinalizedMediaPolicy.evaluate("media.mp4", 50_000_000L, listOf(video, audio), requireAudio = true)
    assertTrue(result.ok)
    assertEquals(60_000_000L, result.durationUs)
  }

  @Test
  fun rejectsSegmentsMissingTracksAndInvalidTimelines() {
    assertFalse(OrionFinalizedMediaPolicy.evaluate("segment.m4s", 10L, listOf(video, audio), true).ok)
    assertEquals("yt-dlp-media-video-missing", OrionFinalizedMediaPolicy.evaluate("media.mp4", 10L, listOf(audio), true).code)
    assertEquals("yt-dlp-media-audio-missing", OrionFinalizedMediaPolicy.evaluate("media.mp4", 10L, listOf(video), true).code)
    assertEquals(
      "yt-dlp-media-duration-invalid",
      OrionFinalizedMediaPolicy.evaluate("media.mp4", 10L, listOf(video.copy(durationUs = 0L), audio), true).code,
    )
  }

  @Test
  fun audioIsOptionalOnlyWhenTheCallingContractSaysSo() {
    assertTrue(OrionFinalizedMediaPolicy.evaluate("silent.mp4", 10L, listOf(video), requireAudio = false).ok)
  }
}
