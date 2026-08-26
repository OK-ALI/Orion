package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionOfflineMediaSourcePolicyTest {
  @Test
  fun separateAvMergeAdjustsPeriodOffsetsAndClipsDurations() {
    assertTrue(OrionOfflineMediaSourcePolicy.ADJUST_SEPARATE_AV_PERIOD_TIME_OFFSETS)
    assertTrue(OrionOfflineMediaSourcePolicy.CLIP_SEPARATE_AV_DURATIONS)
  }

  @Test
  fun preservesExactVideoAndAudioByteOrderForFragmentedMedia() {
    val plan = assertNotNullValue(OrionOfflineMediaSourcePolicy.build("hls", listOf(
      fragment(0, "video-init"),
      fragment(1, "video"),
      fragment(2, "audio-init"),
      fragment(3, "audio"),
      fragment(4, "video"),
      fragment(5, "audio"),
    )))

    assertEquals(listOf(0, 1, 4), plan.videoParts.map { it.index })
    assertEquals(listOf(2, 3, 5), plan.audioParts.map { it.index })
    assertEquals(2, plan.videoMediaCount)
    assertEquals(2, plan.audioMediaCount)
  }

  @Test
  fun acceptsProgressiveSegmentRolesWithoutInitializationParts() {
    val plan = assertNotNullValue(OrionOfflineMediaSourcePolicy.build("dash", listOf(
      fragment(0, "video"),
      fragment(1, "audio"),
      fragment(2, "video"),
    )))

    assertEquals(listOf(0, 2), plan.videoParts.map { it.index })
    assertEquals(listOf(1), plan.audioParts.map { it.index })
  }

  @Test
  fun rejectsMalformedOwnershipOrRolePlans() {
    assertNull(OrionOfflineMediaSourcePolicy.build("unknown", listOf(fragment(0, "video"))))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", emptyList()))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(fragment(1, "video"))))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(
      fragment(0, "video-init"),
      fragment(1, "video-init"),
      fragment(2, "video"),
    )))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(fragment(0, "video-init"))))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(fragment(0, "audio"))))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(fragment(0, "video", size = 0L))))
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(
      OrionOfflineMediaSourcePolicy.IndexedFragment(0, "wrong.bin", "video", 1L),
    )))
  }

  @Test
  fun rejectsDanglingAudioInitializationAndUnboundedFragmentCounts() {
    assertNull(OrionOfflineMediaSourcePolicy.build("hls", listOf(
      fragment(0, "video"),
      fragment(1, "audio-init"),
    )))
    val tooMany = List(OrionOfflineMediaSourcePolicy.MAX_FRAGMENTS + 1) { index ->
      fragment(index, "video")
    }
    assertNull(OrionOfflineMediaSourcePolicy.build("dash", tooMany))
  }

  private fun fragment(index: Int, role: String, size: Long = 1_024L) =
    OrionOfflineMediaSourcePolicy.IndexedFragment(
      index = index,
      name = "f${index.toString().padStart(6, '0')}.bin",
      role = role,
      sizeBytes = size,
    )

  private fun <T : Any> assertNotNullValue(value: T?): T {
    assertNotNull(value)
    return value!!
  }
}
