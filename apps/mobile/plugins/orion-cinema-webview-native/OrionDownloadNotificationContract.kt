package com.okali.orion.playback

internal data class OrionDownloadNotificationPresentation(
  val headline: String,
  val detail: String,
  val indeterminate: Boolean,
  val showTransferMetrics: Boolean,
)

internal data class OrionDownloadNotificationJob(
  val jobId: String,
  val state: String,
  val createdAt: Long,
)

/** Android-free notification wording contract used by production and JVM tests. */
internal object OrionDownloadNotificationContract {
  private val activeStates = setOf(
    "queued", "preflighting", "downloading", "paused", "recovering", "verifying", "finalizing",
  )

  fun survivingJobs(jobs: Iterable<OrionDownloadNotificationJob>): List<OrionDownloadNotificationJob> =
    jobs.filter { it.jobId.isNotBlank() && it.state in activeStates }
      .sortedWith(compareBy<OrionDownloadNotificationJob>({ priority(it.state) }, { it.createdAt }, { it.jobId }))

  fun primaryJob(jobs: Iterable<OrionDownloadNotificationJob>): OrionDownloadNotificationJob? =
    survivingJobs(jobs).firstOrNull()

  private fun priority(state: String): Int = when (state) {
    "finalizing" -> 0
    "downloading" -> 1
    "verifying", "recovering", "preflighting" -> 2
    "queued" -> 3
    "paused" -> 4
    else -> Int.MAX_VALUE
  }

  fun finalizationStageLabel(stage: String?): String = when (stage) {
    "preparing" -> "Preparing media"
    "remuxing" -> "Creating portable MP4"
    "verifying-output" -> "Checking MP4"
    "publishing-media" -> "Saving to Device Storage"
    "confirming-publication" -> "Confirming saved file"
    "publishing-subtitles" -> "Preserving subtitles"
    else -> "Finalizing download"
  }

  fun presentation(state: String, stage: String?): OrionDownloadNotificationPresentation {
    if (state == "finalizing") {
      val label = finalizationStageLabel(stage)
      return OrionDownloadNotificationPresentation(label, label, indeterminate = true, showTransferMetrics = false)
    }
    val label = when (state) {
      "queued" -> "Queued"
      "preflighting" -> "Checking download"
      "downloading" -> "Downloading"
      "paused" -> "Paused"
      "recovering" -> "Recovering"
      "verifying" -> "Verifying"
      "completed" -> "Completed"
      "storage-blocked" -> "Storage needed"
      "action-required" -> "Action needed"
      "failed" -> "Download failed"
      else -> "Preparing download"
    }
    return OrionDownloadNotificationPresentation(label, label, indeterminate = false, showTransferMetrics = true)
  }
}
