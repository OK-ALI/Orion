package com.okali.orion.playback

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.content.ContextCompat
import java.util.Collections
import java.util.concurrent.Executors

class OrionDownloadForegroundService : Service() {
  private val executor = Executors.newSingleThreadExecutor()
  private val queuedExplicitResumes = Collections.synchronizedSet(mutableSetOf<String>())

  override fun onCreate() {
    super.onCreate()
    OrionDownloadJobStore.initialize(applicationContext)
    OrionDownloadNotifications.ensureChannel(applicationContext)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val jobId = intent?.getStringExtra(EXTRA_JOB_ID)?.trim().orEmpty()
    if (jobId.isBlank()) {
      stopSelf(startId)
      return START_NOT_STICKY
    }

    when (intent?.action) {
      ACTION_PAUSE -> {
        OrionDownloadForegroundRecoveryCoordinator.cancel(jobId)
        OrionDownloadJobStore.requestControl(jobId, "pause")
        OrionDownloadJobStore.setState(jobId, "paused")
        OrionDownloadRecoveryScheduler.cancel(applicationContext, jobId)
        if (!OrionDownloadYtDlpRuntime.isLiveHls(jobId)) {
          try { OrionDownloadYtDlpRuntime.stop(jobId) } catch (_: Throwable) {}
        }
        OrionDownloadNotifications.reconcile(applicationContext)
        return START_NOT_STICKY
      }
      ACTION_CANCEL -> {
        OrionDownloadForegroundRecoveryCoordinator.cancel(jobId)
        OrionDownloadTransferEngine.cancelJob(applicationContext, jobId)
        return START_NOT_STICKY
      }
      ACTION_RESUME -> {
        val liveHls = activeJobs.contains(jobId) && OrionDownloadYtDlpRuntime.isLiveHls(jobId)
        if (liveHls) {
          prepareLiveHlsResume(jobId)
          OrionDownloadNotifications.reconcile(applicationContext)
          return START_NOT_STICKY
        }

        val pausedJob = OrionDownloadJobStore.getJob(jobId)
        if (hasRetainedPausedHlsProgress(pausedJob)) {
          OrionDownloadJobStore.markActionRequired(
            jobId,
            "paused-session-ended",
            "This paused download can’t continue after Orion was closed. Restart the download to begin again.",
          )
          OrionDownloadNotifications.reconcile(applicationContext)
          return START_NOT_STICKY
        }

        if (activeJobs.contains(jobId)) {
          // Non-HLS executions still unwind before an explicit Resume is
          // serialized behind the previous run.
          OrionDownloadJobStore.requestControl(jobId, "pause")
          OrionDownloadJobStore.setState(jobId, "paused")
          OrionDownloadRecoveryScheduler.cancel(applicationContext, jobId)
          try { OrionDownloadYtDlpRuntime.stop(jobId) } catch (_: Throwable) {}
        } else {
          prepareExplicitResume(jobId)
        }
      }
      ACTION_RECOVER -> {
        val recoveryJob = OrionDownloadJobStore.getJob(jobId) ?: return START_NOT_STICKY
        if (OrionDownloadRecoveryPolicy.shouldRemainIdle(
            recoveryJob.optString("state"),
            recoveryJob.optString("_control", "run"),
          )
        ) {
          OrionDownloadNotifications.reconcile(applicationContext)
          return START_NOT_STICKY
        }
      }
    }

    startForeground(OrionDownloadNotifications.notificationId(), OrionDownloadNotifications.foreground(applicationContext))

    if (activeJobs.add(jobId)) {
      enqueueRun(jobId)
    } else if (intent?.action == ACTION_RESUME && queuedExplicitResumes.add(jobId)) {
      // Pause can finish asynchronously after its process is killed. Because this
      // executor is single-threaded, an explicit Resume queued here runs only
      // after the old execution releases activeJobs instead of being dropped.
      executor.execute {
        queuedExplicitResumes.remove(jobId)
        prepareExplicitResume(jobId)
        if (activeJobs.add(jobId)) enqueueRunInline(jobId)
      }
    }
    return START_NOT_STICKY
  }

  private fun hasRetainedPausedHlsProgress(job: org.json.JSONObject?): Boolean {
    if (job == null || job.optString("state") != "paused" || job.optString("_transferKind") != "hls") return false
    val progress = job.optJSONObject("progress") ?: return false
    return progress.optLong("bytesDownloaded", 0L) > 0L ||
      progress.optInt("completedFragments", 0) > 0
  }

  private fun prepareLiveHlsResume(jobId: String) {
    OrionDownloadRecoveryScheduler.cancel(applicationContext, jobId)
    OrionDownloadJobStore.clearControl(jobId)
    OrionDownloadJobStore.markResuming(jobId, "explicit-resume-resuming")
  }

  private fun prepareExplicitResume(jobId: String) {
    OrionDownloadJobStore.clearControl(jobId)
    OrionDownloadJobStore.setState(jobId, "recovering")
    OrionDownloadJobStore.markResuming(jobId, "explicit-resume-resuming")
    OrionDownloadRecoveryScheduler.schedule(applicationContext, jobId)
  }

  private fun enqueueRun(jobId: String) {
    executor.execute { enqueueRunInline(jobId) }
  }

  private fun enqueueRunInline(jobId: String) {
    try {
      OrionDownloadTransferEngine.runJob(applicationContext, jobId)
    } finally {
      activeJobs.remove(jobId)
      OrionDownloadForegroundRecoveryCoordinator.afterExecution(applicationContext, jobId)
      if (!OrionDownloadNotifications.reconcile(applicationContext)) {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
  }

  override fun onDestroy() {
    executor.shutdownNow()
    super.onDestroy()
  }

  companion object {
    // Process-local ownership survives Service recreation, but not process death.
    private val activeJobs = Collections.synchronizedSet(mutableSetOf<String>())

    fun hasActiveExecution(jobId: String): Boolean = activeJobs.contains(jobId)

    const val EXTRA_JOB_ID = "jobId"
    const val ACTION_START = "com.okali.orion.download.START"
    const val ACTION_RESUME = "com.okali.orion.download.RESUME"
    const val ACTION_RECOVER = "com.okali.orion.download.RECOVER"
    const val ACTION_PAUSE = "com.okali.orion.download.PAUSE"
    const val ACTION_CANCEL = "com.okali.orion.download.CANCEL"

    fun start(context: Context, jobId: String, recovery: Boolean = false) {
      val intent = Intent(context, OrionDownloadForegroundService::class.java).apply {
        action = if (recovery) ACTION_RECOVER else ACTION_START
        putExtra(EXTRA_JOB_ID, jobId)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun resume(context: Context, jobId: String) {
      val intent = Intent(context, OrionDownloadForegroundService::class.java).apply {
        action = ACTION_RESUME
        putExtra(EXTRA_JOB_ID, jobId)
      }
      ContextCompat.startForegroundService(context, intent)
    }
  }
}
