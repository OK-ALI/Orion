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
  private val activeJobs = Collections.synchronizedSet(mutableSetOf<String>())
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
        OrionDownloadJobStore.requestControl(jobId, "pause")
        OrionDownloadJobStore.setState(jobId, "paused")
        OrionDownloadRecoveryScheduler.cancel(applicationContext, jobId)
        try { OrionDownloadYtDlpRuntime.stop(jobId) } catch (_: Throwable) {}
        OrionDownloadNotifications.reconcile(applicationContext)
        return START_NOT_STICKY
      }
      ACTION_CANCEL -> {
        OrionDownloadTransferEngine.cancelJob(applicationContext, jobId)
        return START_NOT_STICKY
      }
      ACTION_RESUME -> {
        if (activeJobs.contains(jobId)) {
          // Keep the pause fence in place until the current execution has
          // actually unwound. Clearing it early can reclassify the killed
          // process as a failure and can drop a fast Resume behind activeJobs.
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

  private fun prepareExplicitResume(jobId: String) {
    OrionDownloadJobStore.clearControl(jobId)
    OrionDownloadJobStore.setState(jobId, "recovering")
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
