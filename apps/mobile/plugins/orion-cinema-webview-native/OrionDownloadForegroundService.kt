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
        OrionDownloadNotifications.notify(applicationContext, OrionDownloadJobStore.publicJob(jobId))
        return START_NOT_STICKY
      }
      ACTION_CANCEL -> {
        OrionDownloadJobStore.requestControl(jobId, "cancel")
        OrionDownloadNotifications.notify(applicationContext, OrionDownloadJobStore.publicJob(jobId))
        return START_NOT_STICKY
      }
      ACTION_RESUME -> OrionDownloadJobStore.clearControl(jobId)
    }

    val current = OrionDownloadJobStore.publicJob(jobId)
    startForeground(OrionDownloadNotifications.notificationId(), OrionDownloadNotifications.foreground(applicationContext, current))

    if (activeJobs.add(jobId)) {
      executor.execute {
        try {
          OrionDownloadTransferEngine.runJob(applicationContext, jobId)
        } finally {
          activeJobs.remove(jobId)
          if (activeJobs.isEmpty()) {
            OrionDownloadNotifications.cancel(applicationContext)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
          }
        }
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    executor.shutdownNow()
    super.onDestroy()
  }

  companion object {
    const val EXTRA_JOB_ID = "jobId"
    const val ACTION_START = "com.okali.orion.download.START"
    const val ACTION_RESUME = "com.okali.orion.download.RESUME"
    const val ACTION_PAUSE = "com.okali.orion.download.PAUSE"
    const val ACTION_CANCEL = "com.okali.orion.download.CANCEL"

    fun start(context: Context, jobId: String, recovery: Boolean = false) {
      val intent = Intent(context, OrionDownloadForegroundService::class.java).apply {
        action = if (recovery) ACTION_RESUME else ACTION_START
        putExtra(EXTRA_JOB_ID, jobId)
      }
      ContextCompat.startForegroundService(context, intent)
    }
  }
}
