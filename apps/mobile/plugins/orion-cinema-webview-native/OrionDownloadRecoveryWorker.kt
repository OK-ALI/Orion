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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
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
    OrionDownloadForegroundRecoveryCoordinator.cancel(jobId)
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
      OrionDownloadJobStore.markResuming(jobId, "automatic-recovery-resuming")
      OrionDownloadForegroundService.start(applicationContext, jobId, recovery = true)
      Result.success()
    } catch (_: Throwable) {
      OrionDownloadJobStore.markRecovering(
        jobId,
        "recovery-start-interrupted",
        "Orion will retry when the connection is ready.",
      )
      Result.retry()
    }
  }

  companion object {
    const val KEY_JOB_ID = "jobId"
  }
}

internal object OrionDownloadForegroundRecoveryCoordinator {
  private val scheduler = Executors.newSingleThreadScheduledExecutor()
  private val pending = ConcurrentHashMap<String, ScheduledFuture<*>>()
  private val retryDelaysSeconds = intArrayOf(3, 5, 8)

  @Volatile
  private var foregroundNetworkAvailable = false

  fun onNetworkAvailabilityChanged(context: Context, available: Boolean) {
    foregroundNetworkAvailable = available
    if (!available) {
      val scheduledIds = pending.keys.toList()
      scheduledIds.forEach { jobId ->
        pending.remove(jobId)?.cancel(false)
        val job = OrionDownloadJobStore.getJob(jobId) ?: return@forEach
        if (job.optString("state") == "recovering") {
          OrionDownloadJobStore.markRecovering(
            jobId,
            "network-interrupted",
            "Orion will continue when the connection is ready.",
          )
        }
      }
      return
    }

    val jobs = OrionDownloadJobStore.snapshot().optJSONArray("jobs") ?: org.json.JSONArray()
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      val jobId = job.optString("jobId").trim()
      val state = job.optString("state")
      val failure = job.optJSONObject("failure")
      val retryable = failure?.optBoolean("retryable", false) == true
      val code = failure?.optString("code").orEmpty()
      if (
        jobId.isBlank() ||
        state != "recovering" ||
        !retryable ||
        code == "auto-retry-exhausted"
      ) {
        continue
      }
      val attempt = OrionDownloadJobStore.foregroundRetryAttempt(jobId) ?: 1
      schedule(context, jobId, attempt)
    }
  }

  fun cancel(jobId: String, clearAttempt: Boolean = true) {
    pending.remove(jobId)?.cancel(false)
    if (clearAttempt) OrionDownloadJobStore.clearForegroundRetry(jobId)
  }

  fun afterExecution(context: Context, jobId: String) {
    val job = OrionDownloadJobStore.getJob(jobId)
    if (job == null) {
      cancel(jobId)
      return
    }

    val attempt = OrionDownloadJobStore.foregroundRetryAttempt(jobId)
    val failure = job.optJSONObject("failure")
    val retryable = failure?.optBoolean("retryable", false) == true

    if (job.optString("state") != "recovering" || !retryable) {
      cancel(jobId)
      return
    }

    if (!foregroundNetworkAvailable) return

    val nextAttempt = if (attempt == null) 1 else attempt + 1
    if (nextAttempt > retryDelaysSeconds.size) {
      pending.remove(jobId)?.cancel(false)
      OrionDownloadRecoveryScheduler.cancel(context, jobId)
      OrionDownloadJobStore.markForegroundRetryExhausted(jobId)
      return
    }

    schedule(context, jobId, nextAttempt)
  }

  private fun schedule(context: Context, jobId: String, attempt: Int) {
    if (!foregroundNetworkAvailable) return
    if (attempt !in 1..retryDelaysSeconds.size) return
    if (pending.containsKey(jobId)) return

    val job = OrionDownloadJobStore.getJob(jobId) ?: return
    val failure = job.optJSONObject("failure")
    if (
      job.optString("state") != "recovering" ||
      failure?.optBoolean("retryable", false) != true ||
      failure?.optString("code").orEmpty() == "auto-retry-exhausted"
    ) {
      return
    }

    val delaySeconds = retryDelaysSeconds[attempt - 1]
    OrionDownloadJobStore.markForegroundRetryScheduled(jobId, attempt, delaySeconds)

    val appContext = context.applicationContext
    val future = scheduler.schedule(retryTask@{
      pending.remove(jobId)

      if (!foregroundNetworkAvailable) return@retryTask

      val current = OrionDownloadJobStore.getJob(jobId) ?: return@retryTask
      if (
        current.optString("state") != "recovering" ||
        current.optJSONObject("failure")?.optBoolean("retryable", false) != true
      ) {
        OrionDownloadJobStore.clearForegroundRetry(jobId)
        return@retryTask
      }

      val candidateId = current.optString("candidateId")
      if (OrionDownloadTransferRuntime.ensure(candidateId, jobId) == null) {
        OrionDownloadJobStore.clearForegroundRetry(jobId)
        OrionDownloadJobStore.markActionRequired(
          jobId,
          "request-context-refresh-required",
          "Open the title and start playback again to refresh the download source.",
        )
        return@retryTask
      }

      OrionDownloadRecoveryScheduler.cancel(appContext, jobId)
      OrionDownloadJobStore.markResuming(jobId, "automatic-recovery-resuming")

      try {
        OrionDownloadForegroundService.start(appContext, jobId, recovery = true)
      } catch (_: Throwable) {
        OrionDownloadJobStore.markRecovering(
          jobId,
          "recovery-start-interrupted",
          "Orion could not restart this download yet.",
        )
        afterExecution(appContext, jobId)
      }
    }, delaySeconds.toLong(), TimeUnit.SECONDS)

    pending[jobId] = future
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
