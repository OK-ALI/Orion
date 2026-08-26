package com.okali.orion.playback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionDownloadCancellationFenceTest {
  @Test
  fun matchingLiveGenerationMayCommit() {
    assertTrue(OrionDownloadExecutionFence.canCommit(4L, 4L, "finalizing", "none"))
  }

  @Test
  fun cancellationWinsAgainstLateFinalizer() {
    assertFalse(OrionDownloadExecutionFence.canCommit(4L, 5L, "cancelled", "cancel"))
    assertFalse(OrionDownloadExecutionFence.canCommit(4L, 5L, "finalizing", "none"))
    assertFalse(OrionDownloadExecutionFence.canCommit(4L, 4L, "cancelled", "none"))
    assertFalse(OrionDownloadExecutionFence.canCommit(4L, 4L, "finalizing", "cancel"))
  }

  @Test
  fun completedAssetsCannotBeCommittedTwice() {
    assertFalse(OrionDownloadExecutionFence.canCommit(9L, 9L, "completed", "none"))
  }
}
