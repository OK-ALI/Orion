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
    assertEquals("Creating portable MP4", presentation.headline)
    assertEquals("Creating portable MP4", presentation.detail)
    assertTrue(presentation.indeterminate)
    assertFalse(presentation.showTransferMetrics)
  }

  @Test
  fun everyFinalizationStageHasTruthfulText() {
    assertEquals("Preparing media", OrionDownloadNotificationContract.finalizationStageLabel("preparing"))
    assertEquals("Checking MP4", OrionDownloadNotificationContract.finalizationStageLabel("verifying-output"))
    assertEquals("Saving to Device Storage", OrionDownloadNotificationContract.finalizationStageLabel("publishing-media"))
    assertEquals("Preserving subtitles", OrionDownloadNotificationContract.finalizationStageLabel("publishing-subtitles"))
  }

  @Test
  fun transferStateRetainsTransferPresentation() {
    val presentation = OrionDownloadNotificationContract.presentation("downloading", null)
    assertEquals("Downloading", presentation.headline)
    assertFalse(presentation.indeterminate)
    assertTrue(presentation.showTransferMetrics)
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
