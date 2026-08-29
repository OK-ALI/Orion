package com.okali.orion.playback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Assert.assertEquals
import org.junit.Test

class OrionDownloadNotificationContractTest {
  private fun job(id: String, state: String, createdAt: Long) = OrionDownloadNotificationJob(id, state, createdAt)

  @Test
  fun finalizationIsIndeterminateAndStageOriented() {
    val presentation = OrionDownloadNotificationContract.presentation("finalizing", "remuxing")
    assertEquals("Preparing offline video", presentation.headline)
    assertEquals("Preparing offline video", presentation.detail)
    assertTrue(presentation.indeterminate)
    assertFalse(presentation.showTransferMetrics)
  }

  @Test
  fun everyFinalizationStageHasTruthfulText() {
    assertEquals("Preparing offline video", OrionDownloadNotificationContract.finalizationStageLabel("preparing"))
    assertEquals("Checking saved video", OrionDownloadNotificationContract.finalizationStageLabel("verifying-output"))
    assertEquals("Saving to Orion Library", OrionDownloadNotificationContract.finalizationStageLabel("publishing-media"))
    assertEquals("Saving subtitles", OrionDownloadNotificationContract.finalizationStageLabel("publishing-subtitles"))
  }

  @Test
  fun transferStateRetainsTransferPresentation() {
    val presentation = OrionDownloadNotificationContract.presentation("downloading", null)
    assertEquals("Downloading", presentation.headline)
    assertFalse(presentation.indeterminate)
    assertTrue(presentation.showTransferMetrics)
  }

  @Test
  fun recoveryPresentationExplainsAutomaticRetryWithoutStaleTransferMetrics() {
    val presentation = OrionDownloadNotificationContract.presentation("recovering", null)
    assertEquals("Waiting to retry", presentation.headline)
    assertEquals("The connection was interrupted. Orion will retry automatically.", presentation.detail)
    assertTrue(presentation.indeterminate)
    assertFalse(presentation.showTransferMetrics)
  }

  @Test
  fun customerStateLabelsMatchFailureAndAttentionLanguage() {
    assertEquals("Storage space needed", OrionDownloadNotificationContract.stateLabel("storage-blocked"))
    assertEquals("Needs your attention", OrionDownloadNotificationContract.stateLabel("action-required"))
    assertEquals("Download couldn't finish", OrionDownloadNotificationContract.stateLabel("failed"))
    assertEquals("Checking download", OrionDownloadNotificationContract.stateLabel("verifying"))
  }

  @Test
  fun executingWorkBeatsQueuedAndPausedWork() {
    val jobs = listOf(
      job("queued", "queued", 1L),
      job("paused", "paused", 0L),
      job("download", "downloading", 3L),
      job("finalizer", "finalizing", 4L),
    )
    assertEquals("finalizer", OrionDownloadNotificationContract.primaryJob(jobs)?.jobId)
    assertEquals(listOf("finalizer", "download", "queued", "paused"), OrionDownloadNotificationContract.survivingJobs(jobs).map { it.jobId })
  }

  @Test
  fun samePriorityUsesOldestCreationThenJobId() {
    val jobs = listOf(
      job("z", "downloading", 20L),
      job("b", "downloading", 10L),
      job("a", "downloading", 10L),
    )
    assertEquals(listOf("a", "b", "z"), OrionDownloadNotificationContract.survivingJobs(jobs).map { it.jobId })
  }

  @Test
  fun terminalCallbacksCannotReclaimOwnership() {
    val cancelledSecondary = listOf(job("primary", "finalizing", 1L), job("secondary", "cancelled", 2L))
    assertEquals("primary", OrionDownloadNotificationContract.primaryJob(cancelledSecondary)?.jobId)
    val completedPrimary = listOf(job("primary", "completed", 1L), job("secondary", "queued", 2L))
    assertEquals("secondary", OrionDownloadNotificationContract.primaryJob(completedPrimary)?.jobId)
    assertNull(OrionDownloadNotificationContract.primaryJob(listOf(job("done", "completed", 1L), job("cancel", "cancelled", 2L))))
  }
}
