package com.okali.orion.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.okali.orion.MainActivity
import com.okali.orion.R
import org.json.JSONObject
import kotlin.math.roundToInt
import java.util.Locale

internal object OrionDownloadNotifications {
  const val CHANNEL_ID = "orion-downloads"
  private const val CHANNEL_NAME = "Orion downloads"
  private const val SUMMARY_NOTIFICATION_ID = 0x4f521030

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW).apply {
        description = "Active Orion download progress"
        setShowBadge(false)
      },
    )
  }

  fun foreground(context: Context): Notification = foreground(context, notificationJobs())

  private fun foreground(context: Context, jobs: List<JSONObject>): Notification {
    ensureChannel(context)
    val job = jobs.firstOrNull()
    val title = mediaTitle(job)
    val state = optionalText(job, "state") ?: "queued"
    val progress = job?.optJSONObject("progress")
    val percent = progress?.optDouble("percent", Double.NaN) ?: Double.NaN
    val stage = optionalText(progress, "finalizationStage")
    val presentation = OrionDownloadNotificationContract.presentation(state, stage)
    val indeterminate = presentation.indeterminate || percent.isNaN()
    val value = if (indeterminate) 0 else percent.coerceIn(0.0, 99.0).roundToInt()
    val headline = if (state == "finalizing") presentation.headline else progressHeadline(state, progress, value, indeterminate)
    val detail = if (presentation.showTransferMetrics) progressDetail(state, progress, value, indeterminate) else presentation.detail

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(if (jobs.size > 1) "Orion Downloads · ${jobs.size} active" else title)
      .setContentText(headline)
      .setContentIntent(openDownloadsIntent(context))
      .setOnlyAlertOnce(true)
      .setOngoing(jobs.isNotEmpty())
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setProgress(100, value, indeterminate)

    if (jobs.size > 1) {
      val now = System.currentTimeMillis()
      val style = NotificationCompat.InboxStyle()
        .setBigContentTitle("Orion Downloads · ${jobs.size} active")
      jobs.forEach { style.addLine(summaryLine(it, now)) }
      builder.setContentText("$title · $headline").setStyle(style).setNumber(jobs.size)
    } else {
      builder.setStyle(NotificationCompat.BigTextStyle().bigText(detail))
    }

    if (state == "finalizing") {
      longOrNull(progress, "finalizationStageStartedAt")?.takeIf { it > 0L }?.let { startedAt ->
        builder.setWhen(startedAt).setShowWhen(true).setUsesChronometer(true)
      }
    }

    val jobId = optionalText(job, "jobId").orEmpty()
    if (jobId.isNotBlank()) {
      when (state) {
        "queued", "preflighting", "downloading", "recovering" -> builder.addAction(
          0,
          "Pause",
          serviceAction(context, OrionDownloadForegroundService.ACTION_PAUSE, jobId, 1),
        )
        "paused" -> builder.addAction(
          0,
          "Resume",
          serviceAction(context, OrionDownloadForegroundService.ACTION_RESUME, jobId, 2),
        )
      }
      if (state !in setOf("completed", "cancelled")) {
        builder.addAction(
          0,
          "Cancel",
          serviceAction(context, OrionDownloadForegroundService.ACTION_CANCEL, jobId, 3),
        )
      }
    }
    return builder.build()
  }

  fun reconcile(context: Context): Boolean {
    val jobs = notificationJobs()
    val manager = context.getSystemService(NotificationManager::class.java) ?: return false
    if (jobs.isEmpty()) {
      manager.cancel(SUMMARY_NOTIFICATION_ID)
      return false
    }
    manager.notify(SUMMARY_NOTIFICATION_ID, foreground(context, jobs))
    return true
  }

  fun transitionFinalizationStage(context: Context, jobId: String, stage: String, generation: Long? = null) {
    OrionDownloadJobStore.setFinalizationStage(jobId, stage, generation)
    reconcile(context)
  }

  fun cancel(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    manager.cancel(SUMMARY_NOTIFICATION_ID)
  }

  fun notificationId(): Int = SUMMARY_NOTIFICATION_ID

  private fun notificationJobs(): List<JSONObject> {
    val jobs = OrionDownloadJobStore.snapshot().optJSONArray("jobs") ?: return emptyList()
    val byId = linkedMapOf<String, JSONObject>()
    val candidates = mutableListOf<OrionDownloadNotificationJob>()
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      val jobId = optionalText(job, "jobId") ?: continue
      byId[jobId] = job
      candidates += OrionDownloadNotificationJob(
        jobId = jobId,
        state = optionalText(job, "state").orEmpty(),
        createdAt = longOrNull(job, "createdAt") ?: Long.MAX_VALUE,
      )
    }
    return OrionDownloadNotificationContract.survivingJobs(candidates).mapNotNull { byId[it.jobId] }
  }

  private fun summaryLine(job: JSONObject, now: Long): String {
    val state = optionalText(job, "state") ?: "queued"
    val progress = job.optJSONObject("progress")
    val stage = optionalText(progress, "finalizationStage")
    val presentation = OrionDownloadNotificationContract.presentation(state, stage)
    val elapsed = if (state == "finalizing") {
      longOrNull(progress, "finalizationStageStartedAt")?.takeIf { it > 0L && now >= it }?.let {
        " · ${formatElapsed((now - it) / 1_000L)} elapsed"
      }.orEmpty()
    } else ""
    return "${mediaTitle(job)} · ${presentation.headline}$elapsed".take(180)
  }

  private fun openDownloadsIntent(context: Context): PendingIntent {
    val intent = Intent(context, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = android.net.Uri.parse("orion://downloads")
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    return PendingIntent.getActivity(
      context,
      0x1030,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun serviceAction(context: Context, action: String, jobId: String, salt: Int): PendingIntent {
    val intent = Intent(context, OrionDownloadForegroundService::class.java).apply {
      this.action = action
      putExtra(OrionDownloadForegroundService.EXTRA_JOB_ID, jobId)
    }
    return PendingIntent.getService(
      context,
      (jobId.hashCode() * 31) + salt,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun mediaTitle(job: JSONObject?): String {
    val media = job?.optJSONObject("media")
    val mediaType = optionalText(media, "mediaType")
    val title = optionalText(media, "title") ?: "Orion download"
    val series = optionalText(media, "seriesTitle") ?: title
    val season = optionalInteger(media, "season")
    val episode = optionalInteger(media, "episode")
    val year = optionalInteger(media, "year")
    return when {
      mediaType == "tv" && season != null && episode != null -> "$series · S$season E$episode"
      mediaType == "movie" && year != null -> "$title · $year"
      mediaType == "tv" -> series
      else -> title
    }.take(80)
  }

  private fun optionalInteger(json: JSONObject?, key: String): Int? {
    if (json == null || json.isNull(key)) return null
    val value = json.optInt(key, Int.MIN_VALUE)
    return value.takeIf { it >= 0 }
  }

  private fun optionalText(json: JSONObject?, key: String): String? {
    if (json == null || json.isNull(key)) return null
    return json.optString(key).trim().takeIf { it.isNotEmpty() && !it.equals("null", ignoreCase = true) }
  }

  private fun progressHeadline(state: String, progress: JSONObject?, value: Int, indeterminate: Boolean): String {
    val parts = mutableListOf(OrionDownloadNotificationContract.stateLabel(state))
    if (!indeterminate) parts.add("$value%")
    fragmentText(progress)?.let(parts::add)
    return parts.joinToString(" · ").take(120)
  }

  private fun progressDetail(state: String, progress: JSONObject?, value: Int, indeterminate: Boolean): String {
    val lines = mutableListOf(progressHeadline(state, progress, value, indeterminate))
    val transfer = mutableListOf<String>()
    val downloaded = longOrNull(progress, "bytesDownloaded")
    val total = longOrNull(progress, "totalBytes")
    if (downloaded != null && downloaded > 0L) {
      transfer.add(if (total != null && total > 0L) "${formatBytes(downloaded)} / ${formatBytes(total)}" else formatBytes(downloaded))
    }
    longOrNull(progress, "bytesPerSecond")?.takeIf { it > 0L }?.let { transfer.add("${formatBytes(it)}/s") }
    longOrNull(progress, "etaSeconds")?.takeIf { it >= 0L }?.let { transfer.add("${formatEta(it)} left") }
    if (transfer.isNotEmpty()) lines.add(transfer.joinToString(" · "))
    return lines.joinToString("\n").take(240)
  }

  private fun fragmentText(progress: JSONObject?): String? {
    val complete = longOrNull(progress, "completedFragments") ?: return null
    val total = longOrNull(progress, "totalFragments") ?: return null
    if (total <= 0L) return null
    return "$complete/$total fragments"
  }

  private fun longOrNull(json: JSONObject?, key: String): Long? {
    if (json == null || json.isNull(key)) return null
    val value = json.optDouble(key, Double.NaN)
    return if (value.isFinite() && value >= 0.0) value.toLong() else null
  }

  private fun formatBytes(bytes: Long): String {
    if (bytes < 1024L) return "$bytes B"
    val kib = bytes / 1024.0
    if (kib < 1024.0) return String.format(Locale.US, "%.1f KB", kib)
    val mib = kib / 1024.0
    if (mib < 1024.0) return String.format(Locale.US, "%.1f MB", mib)
    return String.format(Locale.US, "%.2f GB", mib / 1024.0)
  }

  private fun formatEta(seconds: Long): String = when {
    seconds < 60L -> "${seconds}s"
    seconds < 3600L -> "${seconds / 60L}m ${seconds % 60L}s"
    else -> "${seconds / 3600L}h ${(seconds % 3600L) / 60L}m"
  }

  private fun formatElapsed(seconds: Long): String = when {
    seconds < 60L -> "${seconds}s"
    seconds < 3600L -> "${seconds / 60L}m ${seconds % 60L}s"
    else -> "${seconds / 3600L}h ${(seconds % 3600L) / 60L}m"
  }

}
