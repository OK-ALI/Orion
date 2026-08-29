package com.okali.orion.playback

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

internal object OrionDownloadRecoveryPolicy {
  fun shouldRemainIdle(state: String, control: String): Boolean =
    state in setOf("completed", "cancelled", "unsupported", "protected", "paused") ||
      control == "pause"
}

class OrionDownloadRecoveryWorker(
  appContext: Context,
  workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
  override fun doWork(): Result {
    OrionDownloadJobStore.initialize(applicationContext)
    val jobId = inputData.getString(KEY_JOB_ID)?.trim().orEmpty()
    if (jobId.isBlank()) return Result.failure()
    val job = OrionDownloadJobStore.getJob(jobId) ?: return Result.success()
    val state = job.optString("state")
    val control = job.optString("_control", "run")
    if (OrionDownloadRecoveryPolicy.shouldRemainIdle(state, control)) return Result.success()
    if (OrionDownloadTransferEngine.hasCompleteLocalFinalization(applicationContext, jobId) ||
      OrionDownloadTransferEngine.hasCompleteLocalYtDlpFinalization(applicationContext, jobId)
    ) {
      return try {
        OrionDownloadForegroundService.start(applicationContext, jobId, recovery = true)
        Result.success()
      } catch (_: Throwable) {
        Result.retry()
      }
    }
    val candidateId = job.optString("candidateId")
    val runtime = OrionDownloadTransferRuntime.ensure(candidateId, jobId)
    if (runtime == null) {
      OrionDownloadJobStore.markActionRequired(
        jobId,
        "request-context-refresh-required",
        "Open the title and start playback again to refresh the download source.",
      )
      return Result.success()
    }
    return try {
      OrionDownloadForegroundService.start(applicationContext, jobId, recovery = true)
      Result.success()
    } catch (_: Throwable) {
      Result.retry()
    }
  }

  companion object {
    const val KEY_JOB_ID = "jobId"
  }
}

internal object OrionDownloadRecoveryScheduler {
  private const val PREFIX = "orion-download-recovery-"

  fun schedule(context: Context, jobId: String, delayMinutes: Long = 15L, localOnly: Boolean = false) {
    val constraints = Constraints.Builder()
      .setRequiresBatteryNotLow(true)
      .setRequiresStorageNotLow(true)
      .apply { if (!localOnly) setRequiredNetworkType(NetworkType.CONNECTED) }
      .build()
    val request = OneTimeWorkRequestBuilder<OrionDownloadRecoveryWorker>()
      .setInputData(workDataOf(OrionDownloadRecoveryWorker.KEY_JOB_ID to jobId))
      .setInitialDelay(delayMinutes.coerceAtLeast(1L), TimeUnit.MINUTES)
      .setConstraints(constraints)
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30L, TimeUnit.SECONDS)
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork(PREFIX + jobId, ExistingWorkPolicy.REPLACE, request)
  }

  fun cancel(context: Context, jobId: String) {
    WorkManager.getInstance(context).cancelUniqueWork(PREFIX + jobId)
  }
}
