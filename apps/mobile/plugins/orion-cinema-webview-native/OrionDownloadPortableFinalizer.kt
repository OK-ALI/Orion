package com.okali.orion.playback

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.StatFs
import java.io.File
import java.nio.ByteBuffer
import org.json.JSONArray
import org.json.JSONObject

internal data class OrionPortableFinalizeOutcome(
  val ok: Boolean,
  val locatorValue: String? = null,
  val mediaBytes: Long = 0L,
  val sidecarBytes: Long = 0L,
  val tracks: JSONArray = JSONArray(),
  val failureCode: String? = null,
  val failureMessage: String? = null,
  val retryable: Boolean = false,
  val actionRequired: Boolean = false,
)

/**
 * Native-only portable finalizer for already verified finite HLS/DASH fragments.
 *
 * It never receives provider URLs or request credentials. The fragment engine
 * supplies local verified bytes only. MediaExtractor + MediaMuxer perform a
 * bounded remux into a validated MP4 before anything is written through SAF.
 */
internal object OrionDownloadPortableFinalizer {
  private const val MIN_FREE_RESERVE_BYTES = 32L * 1024L * 1024L
  private const val MAX_SAMPLE_BYTES = 16 * 1024 * 1024

  private data class TrackPlan(
    val source: File,
    val inputTrack: Int,
    val format: MediaFormat,
    val mime: String,
    val language: String?,
  )

  fun finalizeToDeviceStorage(
    context: Context,
    job: JSONObject,
    partialDir: File,
    fragments: List<OrionFragmentRequest>,
    verifiedBytes: Long,
    fileName: String,
    subtitleDirectory: File? = null,
    subtitleEntries: JSONArray = JSONArray(),
    subtitleTracks: JSONArray = JSONArray(),
  ): OrionPortableFinalizeOutcome {
    val targetId = job.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
    val target = OrionDownloadStorageRegistry.describe(context, targetId)
      ?: return actionRequired(
        "storage-destination-unavailable",
        "Choose the Device Storage folder again and retry finalization.",
      )
    if (!target.writable || !target.persistedPermission) {
      return actionRequired(
        "storage-destination-unavailable",
        "Choose the Device Storage folder again and retry finalization.",
      )
    }

    val targetFree = OrionDownloadStorageRegistry.freeBytes(context, targetId)
    val subtitleBytes = subtitleEntryBytes(subtitleEntries)
    if (targetFree != null && targetFree < verifiedBytes + subtitleBytes + MIN_FREE_RESERVE_BYTES) {
      return actionRequired(
        "storage-insufficient",
        "Device Storage does not have enough free space to finalize this download.",
      )
    }

    val scratchRequired = verifiedBytes
      .coerceAtMost(Long.MAX_VALUE / 2L)
      .times(2L)
      .plus(MIN_FREE_RESERVE_BYTES)
    if (StatFs(context.cacheDir.absolutePath).availableBytes < scratchRequired) {
      return actionRequired(
        "finalization-space-insufficient",
        "Orion needs more temporary device space to create the portable file.",
      )
    }

    val jobId = job.optString("jobId")
    val scratch = File(context.cacheDir, "orion-downloads/portable/$jobId")
    if (scratch.exists()) scratch.deleteRecursively()
    scratch.mkdirs()

    val videoSource = File(scratch, "video-source.bin")
    val audioSource = File(scratch, "audio-source.bin")
    val output = File(scratch, "portable.mp4")

    return try {
      if (!concatenateRole(partialDir, fragments, "video", videoSource)) {
        unsupported("portable-video-missing", "This stream does not expose a portable video track.")
      } else {
        val hasSeparateAudio = fragments.any { it.role == "audio" || it.role == "audio-init" }
        if (hasSeparateAudio && !concatenateRole(partialDir, fragments, "audio", audioSource)) {
          return unsupported("portable-audio-missing", "This stream does not expose its required audio track safely.")
        }

        val plans = collectTracks(videoSource, if (hasSeparateAudio) audioSource else null)
        val videoTracks = plans.count { it.mime.startsWith("video/") }
        val audioTracks = plans.count { it.mime.startsWith("audio/") }
        if (videoTracks == 0) {
          return unsupported("portable-video-unsupported", "This stream cannot be remuxed into a portable video file on this device.")
        }
        if (hasSeparateAudio && audioTracks == 0) {
          return unsupported("portable-audio-unsupported", "This stream's audio cannot be preserved in a portable file on this device.")
        }

        val audioMetadata = remux(output, plans)
          ?: return unsupported("portable-remux-unsupported", "This stream cannot be safely remuxed into a portable MP4 on this device.")
        if (!verifyOutput(output, requireAudio = hasSeparateAudio)) {
          return unsupported("portable-output-invalid", "Orion could not verify the finalized portable file.")
        }

        val uri = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", fileName)
          ?: return actionRequired(
            "storage-destination-unavailable",
            "Choose the Device Storage folder again and retry finalization.",
          )
        val written = try {
          context.contentResolver.openOutputStream(uri, "w")?.use { sink ->
            output.inputStream().use { source ->
              copyCounted(source, sink)
            }
          } ?: -1L
        } catch (_: Throwable) {
          -1L
        }
        if (written <= 0L || written != output.length() || !verifyPublishedBytes(context, uri, written)) {
          OrionDownloadStorageRegistry.deleteDocument(context, uri)
          return failed(
            "finalization-write-failed",
            "Orion could not write the completed portable file to Device Storage.",
            retryable = true,
          )
        }

        val sidecars = publishSubtitleSidecars(
          context = context,
          targetId = targetId,
          mediaFileName = fileName,
          subtitleDirectory = subtitleDirectory,
          subtitleEntries = subtitleEntries,
        )
        if (!sidecars.ok) {
          OrionDownloadStorageRegistry.deleteDocument(context, uri)
          sidecars.createdUris.forEach { created -> OrionDownloadStorageRegistry.deleteDocument(context, created) }
          return failed(
            "subtitle-finalization-write-failed",
            "Orion could not preserve the selected subtitle files in Device Storage.",
            retryable = true,
          )
        }

        val tracks = JSONArray()
        for (index in 0 until audioMetadata.length()) audioMetadata.optJSONObject(index)?.let { tracks.put(JSONObject(it.toString())) }
        for (index in 0 until subtitleTracks.length()) subtitleTracks.optJSONObject(index)?.let { tracks.put(JSONObject(it.toString())) }
        OrionPortableFinalizeOutcome(
          ok = true,
          locatorValue = uri.toString(),
          mediaBytes = written,
          sidecarBytes = sidecars.bytes,
          tracks = tracks,
        )
      }
    } catch (_: Throwable) {
      unsupported("portable-remux-unsupported", "This stream cannot be safely finalized as a portable file on this device.")
    } finally {
      scratch.deleteRecursively()
    }
  }

  private data class SubtitlePublishOutcome(
    val ok: Boolean,
    val bytes: Long = 0L,
    val createdUris: List<android.net.Uri> = emptyList(),
  )

  private fun subtitleEntryBytes(entries: JSONArray): Long {
    var total = 0L
    for (index in 0 until entries.length()) {
      total += entries.optJSONObject(index)?.optLong("size", 0L)?.coerceAtLeast(0L) ?: 0L
    }
    return total
  }

  private fun publishSubtitleSidecars(
    context: Context,
    targetId: String,
    mediaFileName: String,
    subtitleDirectory: File?,
    subtitleEntries: JSONArray,
  ): SubtitlePublishOutcome {
    if (subtitleEntries.length() == 0) return SubtitlePublishOutcome(ok = true)
    if (subtitleDirectory == null || !subtitleDirectory.isDirectory) return SubtitlePublishOutcome(ok = false)
    val baseName = mediaFileName.removeSuffix(".mp4")
    val created = mutableListOf<android.net.Uri>()
    var bytes = 0L
    for (index in 0 until subtitleEntries.length()) {
      val entry = subtitleEntries.optJSONObject(index) ?: continue
      val relativeName = entry.optString("name").substringAfterLast('/').take(100)
      if (relativeName.isBlank()) continue
      val source = File(subtitleDirectory, relativeName)
      if (!source.isFile || source.length() <= 0L) return SubtitlePublishOutcome(false, bytes, created)
      val format = relativeName.substringAfterLast('.', "vtt").lowercase().takeIf { it in setOf("vtt", "srt", "ass") } ?: "vtt"
      val language = entry.optString("language", "und").replace(Regex("[^A-Za-z0-9_-]"), "").take(12).ifBlank { "und" }
      val targetName = "$baseName.$language.${index + 1}.$format"
      val mime = when (format) {
        "srt" -> "application/x-subrip"
        "ass" -> "text/x-ssa"
        else -> "text/vtt"
      }
      val uri = OrionDownloadStorageRegistry.createDocument(context, targetId, mime, targetName)
        ?: return SubtitlePublishOutcome(false, bytes, created)
      created += uri
      val written = try {
        context.contentResolver.openOutputStream(uri, "w")?.use { sink ->
          source.inputStream().use { input -> copyCounted(input, sink) }
        } ?: -1L
      } catch (_: Throwable) { -1L }
      if (written != source.length() || written <= 0L || !verifyPublishedBytes(context, uri, written)) {
        return SubtitlePublishOutcome(false, bytes, created)
      }
      bytes += written
    }
    return SubtitlePublishOutcome(true, bytes, created)
  }

  private fun verifyPublishedBytes(context: Context, uri: android.net.Uri, expected: Long): Boolean {
    if (expected <= 0L) return false
    return try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          if (read == 0) continue
          total += read
          if (total > expected) return@use false
        }
        total == expected
      } ?: false
    } catch (_: Throwable) { false }
  }

  private fun concatenateRole(
    partialDir: File,
    fragments: List<OrionFragmentRequest>,
    role: String,
    destination: File,
  ): Boolean {
    val indexes = fragments.indices.filter { index ->
      val fragmentRole = fragments[index].role
      fragmentRole == role || fragmentRole == "$role-init"
    }
    if (indexes.isEmpty()) return false
    destination.outputStream().buffered().use { output ->
      for (index in indexes) {
        val input = File(partialDir, fragmentName(index))
        if (!input.isFile || input.length() <= 0L) return false
        input.inputStream().buffered().use { source -> source.copyTo(output) }
      }
    }
    return destination.isFile && destination.length() > 0L
  }

  private fun collectTracks(videoSource: File, audioSource: File?): List<TrackPlan> {
    val plans = mutableListOf<TrackPlan>()
    plans += tracksFrom(videoSource) { mime ->
      if (audioSource == null) mime.startsWith("video/") || mime.startsWith("audio/")
      else mime.startsWith("video/")
    }
    if (audioSource != null) {
      plans += tracksFrom(audioSource) { mime -> mime.startsWith("audio/") }
    }
    return plans
  }

  private fun tracksFrom(source: File, accept: (String) -> Boolean): List<TrackPlan> {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(source.absolutePath)
      buildList {
        for (index in 0 until extractor.trackCount) {
          val format = extractor.getTrackFormat(index)
          val mime = format.getString(MediaFormat.KEY_MIME).orEmpty()
          if (!accept(mime)) continue
          val language = if (format.containsKey(MediaFormat.KEY_LANGUAGE)) {
            format.getString(MediaFormat.KEY_LANGUAGE)?.take(12)
          } else null
          add(TrackPlan(source, index, format, mime, language))
        }
      }
    } finally {
      extractor.release()
    }
  }

  private fun remux(output: File, plans: List<TrackPlan>): JSONArray? {
    if (output.exists()) output.delete()
    val muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val outputTracks = mutableListOf<Int>()
    return try {
      for (plan in plans) outputTracks += muxer.addTrack(plan.format)
      muxer.start()
      for (index in plans.indices) {
        if (!copyTrack(plans[index], muxer, outputTracks[index])) return null
      }
      muxer.stop()

      val audio = JSONArray()
      plans.filter { it.mime.startsWith("audio/") }.forEachIndexed { index, plan ->
        audio.put(JSONObject()
          .put("id", "audio-${index + 1}")
          .put("kind", "audio")
          .put("language", plan.language ?: JSONObject.NULL)
          .put("label", plan.language?.uppercase()?.let { "$it audio" } ?: "Audio")
          .put("format", plan.mime.substringAfter('/', plan.mime).take(40))
          .put("default", index == 0))
      }
      audio
    } catch (_: Throwable) {
      null
    } finally {
      try { muxer.release() } catch (_: Throwable) {}
      if (!output.isFile || output.length() <= 0L) output.delete()
    }
  }

  private fun copyTrack(plan: TrackPlan, muxer: MediaMuxer, outputTrack: Int): Boolean {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(plan.source.absolutePath)
      extractor.selectTrack(plan.inputTrack)
      var buffer = ByteBuffer.allocate(MAX_SAMPLE_BYTES)
      val info = MediaCodec.BufferInfo()
      var lastTimeUs = Long.MIN_VALUE
      while (true) {
        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break
        val timeUs = extractor.sampleTime
        if (timeUs < 0L || timeUs < lastTimeUs) return false
        if (size > MAX_SAMPLE_BYTES) return false
        info.set(0, size, timeUs, extractor.sampleFlags)
        muxer.writeSampleData(outputTrack, buffer, info)
        lastTimeUs = timeUs
        if (!extractor.advance()) break
      }
      lastTimeUs != Long.MIN_VALUE
    } catch (_: Throwable) {
      false
    } finally {
      extractor.release()
    }
  }

  private fun verifyOutput(file: File, requireAudio: Boolean): Boolean {
    if (!file.isFile || file.length() <= 0L) return false
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(file.absolutePath)
      var video = 0
      var audio = 0
      for (index in 0 until extractor.trackCount) {
        val mime = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME).orEmpty()
        if (mime.startsWith("video/")) video += 1
        if (mime.startsWith("audio/")) audio += 1
      }
      video > 0 && (!requireAudio || audio > 0)
    } catch (_: Throwable) {
      false
    } finally {
      extractor.release()
    }
  }

  private fun copyCounted(input: java.io.InputStream, output: java.io.OutputStream): Long {
    val buffer = ByteArray(64 * 1024)
    var total = 0L
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      if (read == 0) continue
      output.write(buffer, 0, read)
      total += read
    }
    output.flush()
    return total
  }

  private fun fragmentName(index: Int): String = "f${index.toString().padStart(6, '0')}.bin"

  private fun unsupported(code: String, message: String) = OrionPortableFinalizeOutcome(
    ok = false,
    failureCode = code,
    failureMessage = message,
    actionRequired = true,
  )

  private fun actionRequired(code: String, message: String) = OrionPortableFinalizeOutcome(
    ok = false,
    failureCode = code,
    failureMessage = message,
    actionRequired = true,
  )

  private fun failed(code: String, message: String, retryable: Boolean) = OrionPortableFinalizeOutcome(
    ok = false,
    failureCode = code,
    failureMessage = message,
    retryable = retryable,
  )
}
