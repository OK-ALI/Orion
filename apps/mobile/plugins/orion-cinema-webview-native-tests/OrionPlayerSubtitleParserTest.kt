package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OrionPlayerSubtitleParserTest {
  @Test
  fun parsesVttSrtAndAssWithoutLeakingMarkup() {
    val samples = listOf(
      "vtt" to "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello <b>Orion</b>",
      "srt" to "1\n00:00:01,000 --> 00:00:03,000\nHello <i>Orion</i>",
      "ass" to "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello {\\i1}Orion",
    )
    for ((format, content) in samples) {
      val cues = OrionPlayerSubtitleParser.parse(format, content)
      assertEquals(1, cues.size)
      assertEquals("Hello Orion", cues.single().text)
      assertEquals("Hello Orion", OrionPlayerSubtitleParser.activeCue(cues, 2_000L)?.text)
      assertNull(OrionPlayerSubtitleParser.activeCue(cues, 4_000L))
    }
  }

  @Test
  fun invalidOrOversizedTimelineEntriesAreIgnored() {
    val cues = OrionPlayerSubtitleParser.parse(
      "srt",
      "1\n00:00:03,000 --> 00:00:01,000\nBad\n\n2\n00:00:01,000 --> 00:00:02,000\nGood",
    )
    assertEquals(listOf("Good"), cues.map { it.text })
  }
}
