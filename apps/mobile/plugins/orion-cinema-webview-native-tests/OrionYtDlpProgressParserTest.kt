package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OrionYtDlpProgressParserTest {
  @Test
  fun parsesExactMachineProgressWithoutInventingMissingValues() {
    val parsed = OrionYtDlpProgressParser.parse(
      "orion-progress:448790528|1224065679|NA|5976883.2|126|36.7%",
      36.7f,
      126L,
    )!!
    assertEquals(448_790_528L, parsed.bytesDownloaded)
    assertEquals(1_224_065_679L, parsed.totalBytes)
    assertEquals(5_976_883L, parsed.bytesPerSecond)
    assertEquals(126L, parsed.etaSeconds)
    assertEquals(36.7, parsed.percent!!, 0.001)

    val unknown = OrionYtDlpProgressParser.parse(
      "orion-progress:0|NA|NA|NA|NA|0.0%",
      0f,
      -1L,
    )!!
    assertEquals(0L, unknown.bytesDownloaded)
    assertNull(unknown.totalBytes)
    assertNull(unknown.bytesPerSecond)
    assertNull(unknown.etaSeconds)
  }

  @Test
  fun adaptsStandardYtDlpProgressWithBinaryUnitsAndLongEta() {
    val parsed = OrionYtDlpProgressParser.parse(
      "[download]  50.0% of ~ 1.00GiB at 5.00MiB/s ETA 01:02:03",
      50f,
      3_723L,
    )!!
    assertEquals(536_870_912L, parsed.bytesDownloaded)
    assertEquals(1_073_741_824L, parsed.totalBytes)
    assertEquals(5_242_880L, parsed.bytesPerSecond)
    assertEquals(3_723L, parsed.etaSeconds)
  }

  @Test
  fun ignoresNonProgressOutputAndRejectsOverflow() {
    assertNull(OrionYtDlpProgressParser.parse("[Merger] Merging formats", 99f, 0L))
    assertNull(OrionYtDlpProgressParser.parse(
      "orion-progress:999999999999999999999|NA|NA|NA|NA|NA",
      -1f,
      -1L,
    ))
  }
}
