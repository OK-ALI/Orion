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
    "preparing" -> "Preparing offline video"
    "remuxing" -> "Preparing offline video"
    "verifying-output" -> "Checking saved video"
    "publishing-media" -> "Saving to Orion Library"
    "confirming-publication" -> "Confirming saved video"
    "publishing-subtitles" -> "Saving subtitles"
    else -> "Finishing download"
  }

  fun stateLabel(state: String): String = when (state) {
    "queued" -> "Queued"
    "preflighting" -> "Checking download"
    "downloading" -> "Downloading"
    "paused" -> "Paused"
    "recovering" -> "Waiting to retry"
    "verifying" -> "Checking download"
    "completed" -> "Completed"
    "storage-blocked" -> "Storage space needed"
    "action-required" -> "Needs your attention"
    "failed" -> "Download couldn't finish"
    else -> "Preparing download"
  }

  fun presentation(state: String, stage: String?): OrionDownloadNotificationPresentation {
    if (state == "finalizing") {
      val label = finalizationStageLabel(stage)
      return OrionDownloadNotificationPresentation(label, label, indeterminate = true, showTransferMetrics = false)
    }
    if (state == "recovering") {
      return OrionDownloadNotificationPresentation(
        "Waiting to retry",
        "The connection was interrupted. Orion will retry automatically.",
        indeterminate = true,
        showTransferMetrics = false,
      )
    }
    val label = stateLabel(state)
    return OrionDownloadNotificationPresentation(label, label, indeterminate = false, showTransferMetrics = true)
  }
}
