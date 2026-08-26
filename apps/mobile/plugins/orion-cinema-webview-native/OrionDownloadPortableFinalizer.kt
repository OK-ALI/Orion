package com.okali.orion.playback

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaDataSource
import android.media.MediaMuxer
import android.os.Build
import android.os.StatFs
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import org.json.JSONArray
import org.json.JSONObject

internal data class OrionPublishedArtifact(
  val uri: android.net.Uri,
  val role: String,
  val displayName: String,
  val mimeType: String,
  val sizeBytes: Long,
)

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
  val cancelled: Boolean = false,
  val publishedUris: List<android.net.Uri> = emptyList(),
  val publishedArtifacts: List<OrionPublishedArtifact> = emptyList(),
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
  private const val MAX_LEARNED_SAMPLE_STEP_US = 250_000L
  private const val PUBLISHED_VERIFY_PROBE_BYTES = 64 * 1024
  private const val MEDIA_COPY_BUFFER_BYTES = 1024 * 1024

  private data class SegmentInput(
    val media: File,
    val initialization: File?,
  )

  private data class RoleSource(
    val role: String,
    val segments: List<SegmentInput>,
  )

  private data class TrackPlan(
    val source: RoleSource,
    val mimeOrdinal: Int,
    val format: MediaFormat,
    val mime: String,
    val language: String?,
  )

  private data class TrackWriteStats(
    val mime: String,
    val sampleCount: Long,
    val minTimeUs: Long,
    val maxTimeUs: Long,
    val sampleDigest: String,
  ) {
    val durationUs: Long
      get() = if (sampleCount > 1L && maxTimeUs >= minTimeUs) maxTimeUs - minTimeUs else 0L
  }

  private data class RemuxResult(
    val audioMetadata: JSONArray,
    val stats: List<TrackWriteStats>,
    val diagnostics: RemuxDiagnostics,
  )

  private data class RemuxDiagnostics(
    val segmentCount: Int,
    val extractorOpenCount: Int,
    val fragmentInspectMs: Long,
    val muxWriteMs: Long,
    val sampleBufferAllocations: Int,
  )

  private data class RemuxAttempt(
    val result: RemuxResult? = null,
    val failureCode: String? = null,
  )

  private data class TrackCopyOutcome(
    val stats: TrackWriteStats? = null,
    val failureCode: String? = null,
  )

  fun finalizeToDeviceStorage(
    context: Context,
    job: JSONObject,
    partialDir: File,
    roles: List<String>,
    verifiedBytes: Long,
    fileName: String,
    subtitleDirectory: File? = null,
    subtitleEntries: JSONArray = JSONArray(),
    subtitleTracks: JSONArray = JSONArray(),
    generation: Long? = null,
  ): OrionPortableFinalizeOutcome {
    val jobId = job.optString("jobId")
    if (isCancelled(jobId)) return cancelled()
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

    val scratchRequired = if (verifiedBytes > Long.MAX_VALUE - MIN_FREE_RESERVE_BYTES) Long.MAX_VALUE
      else verifiedBytes + MIN_FREE_RESERVE_BYTES
    if (StatFs(context.cacheDir.absolutePath).availableBytes < scratchRequired) {
      return actionRequired(
        "finalization-space-insufficient",
        "Orion needs more temporary device space to create the portable file.",
      )
    }

    val scratch = File(context.cacheDir, "orion-downloads/portable/$jobId")
    if (scratch.exists()) scratch.deleteRecursively()
    scratch.mkdirs()

    val output = File(scratch, "portable.mp4")
    val phaseStartedAt = SystemClock.elapsedRealtime()
    var inspectMs = 0L
    var muxMs = 0L
    var verifyMs = 0L
    var publishMs = 0L
    var subtitleMs = 0L

    return try {
      OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "preparing", generation)
      val videoSource = collectRoleSource(partialDir, roles, "video")
      if (videoSource == null) {
        unsupported("portable-video-missing", "This stream does not expose a portable video track.")
      } else {
        val expectsSeparateAudio = roles.any { it == "audio" || it == "audio-init" }
        val audioSource = collectRoleSource(partialDir, roles, "audio")
        if (expectsSeparateAudio && audioSource == null) {
          return unsupported("portable-audio-missing", "This stream does not expose its required audio track safely.")
        }

        val inspectStartedAt = SystemClock.elapsedRealtime()
        val plans = try {
          collectTracks(videoSource, audioSource)
        } catch (_: Throwable) {
          return failed("portable-track-inspection-failed", "Orion could not inspect the downloaded media tracks for finalization.", retryable = true)
        }
        inspectMs = SystemClock.elapsedRealtime() - inspectStartedAt
        val videoTracks = plans.count { it.mime.startsWith("video/") }
        val audioTracks = plans.count { it.mime.startsWith("audio/") }
        if (videoTracks == 0) {
          return unsupported("portable-video-unsupported", "This stream cannot be remuxed into a portable video file on this device.")
        }
        if (expectsSeparateAudio && audioTracks == 0) {
          return unsupported("portable-audio-unsupported", "This stream's audio cannot be preserved in a portable file on this device.")
        }

        OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "remuxing", generation)
        val muxStartedAt = SystemClock.elapsedRealtime()
        val remuxAttempt = remux(output, plans, jobId)
        muxMs = SystemClock.elapsedRealtime() - muxStartedAt
        val remuxed = remuxAttempt.result ?: run {
          if (isCancelled(jobId)) return cancelled()
          return when (remuxAttempt.failureCode) {
            "portable-video-cadence-invalid" -> failed(
              "portable-video-cadence-invalid",
              "This stream's video timing cannot be made into a safe portable MP4.",
              retryable = false,
            )
            "portable-audio-timeline-invalid" -> failed(
              "portable-audio-timeline-invalid",
              "This stream's audio timing cannot be preserved safely in a portable MP4.",
              retryable = false,
            )
            "portable-fragment-format-changed" -> failed(
              "portable-fragment-format-changed",
              "This stream changes media format between fragments and cannot be finalized safely.",
              retryable = false,
            )
            else -> failed(
              "portable-remux-track-write-failed",
              "Orion could not safely write the downloaded media timeline into a portable MP4.",
              retryable = true,
            )
          }
        }
        if (isCancelled(jobId)) return cancelled()
        OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "verifying-output", generation)
        val verifyStartedAt = SystemClock.elapsedRealtime()
        if (!verifyOutput(output, plans, remuxed.stats)) {
          return failed("portable-output-verification-failed", "Orion created the portable file but its media tracks did not pass verification.", retryable = true)
        }
        verifyMs = SystemClock.elapsedRealtime() - verifyStartedAt

        if (isCancelled(jobId)) return cancelled()
        OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "publishing-media", generation)
        val uri = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", fileName)
          ?: return actionRequired(
            "storage-destination-unavailable",
            "Choose the Device Storage folder again and retry finalization.",
          )
        val publishStartedAt = SystemClock.elapsedRealtime()
        val written = try {
          context.contentResolver.openOutputStream(uri, "w")?.use { sink ->
            output.inputStream().use { source ->
              copyCounted(source, sink, jobId)
            }
          } ?: -1L
        } catch (_: Throwable) {
          -1L
        }
        if (isCancelled(jobId)) {
          OrionDownloadStorageRegistry.deleteDocument(context, uri)
          return cancelled()
        }
        OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "confirming-publication", generation)
        if (written <= 0L || written != output.length() || !verifyPublishedBytes(context, uri, output, written)) {
          OrionDownloadStorageRegistry.deleteDocument(context, uri)
          return failed(
            "finalization-write-failed",
            "Orion could not write the completed portable file to Device Storage.",
            retryable = true,
          )
        }
        publishMs = SystemClock.elapsedRealtime() - publishStartedAt

        OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "publishing-subtitles", generation)
        val subtitleStartedAt = SystemClock.elapsedRealtime()
        val sidecars = publishSubtitleSidecars(
          context = context,
          jobId = jobId,
          targetId = targetId,
          mediaFileName = fileName,
          subtitleDirectory = subtitleDirectory,
          subtitleEntries = subtitleEntries,
        )
        if (isCancelled(jobId)) {
          OrionDownloadStorageRegistry.deleteDocument(context, uri)
          sidecars.createdUris.forEach { created -> OrionDownloadStorageRegistry.deleteDocument(context, created) }
          return cancelled()
        }
        if (!sidecars.ok) {
          OrionDownloadStorageRegistry.deleteDocument(context, uri)
          sidecars.createdUris.forEach { created -> OrionDownloadStorageRegistry.deleteDocument(context, created) }
          return failed(
            "subtitle-finalization-write-failed",
            "Orion could not preserve the selected subtitle files in Device Storage.",
            retryable = true,
          )
        }
        subtitleMs = SystemClock.elapsedRealtime() - subtitleStartedAt

        val tracks = JSONArray()
        for (index in 0 until remuxed.audioMetadata.length()) remuxed.audioMetadata.optJSONObject(index)?.let { tracks.put(JSONObject(it.toString())) }
        for (index in 0 until subtitleTracks.length()) subtitleTracks.optJSONObject(index)?.let { tracks.put(JSONObject(it.toString())) }
        Log.i(
          "OrionPortableFinalize",
          "job=${jobId.take(24)} inspectMs=$inspectMs fragmentInspectMs=${remuxed.diagnostics.fragmentInspectMs} muxWriteMs=${remuxed.diagnostics.muxWriteMs} muxMs=$muxMs verifyMs=$verifyMs publishMs=$publishMs subtitleMs=$subtitleMs segments=${remuxed.diagnostics.segmentCount} samples=${remuxed.stats.sumOf { it.sampleCount }} extractorOpens=${remuxed.diagnostics.extractorOpenCount + plans.map { it.source }.distinct().size + 1} sampleBufferAllocations=${remuxed.diagnostics.sampleBufferAllocations} mediaBytes=$written totalMs=${SystemClock.elapsedRealtime() - phaseStartedAt}",
        )
        OrionPortableFinalizeOutcome(
          ok = true,
          locatorValue = uri.toString(),
          mediaBytes = written,
          sidecarBytes = sidecars.bytes,
          tracks = tracks,
          publishedUris = listOf(uri) + sidecars.createdUris,
          publishedArtifacts = listOf(OrionPublishedArtifact(uri, "primary", fileName, "video/mp4", written)) + sidecars.artifacts,
        )
      }
    } catch (_: Throwable) {
      failed("portable-finalization-exception", "Orion could not complete the portable finalization stage on this device.", retryable = true)
    } finally {
      scratch.deleteRecursively()
    }
  }

  private data class SubtitlePublishOutcome(
    val ok: Boolean,
    val bytes: Long = 0L,
    val createdUris: List<android.net.Uri> = emptyList(),
    val artifacts: List<OrionPublishedArtifact> = emptyList(),
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
    jobId: String,
    targetId: String,
    mediaFileName: String,
    subtitleDirectory: File?,
    subtitleEntries: JSONArray,
  ): SubtitlePublishOutcome {
    if (subtitleEntries.length() == 0) return SubtitlePublishOutcome(ok = true)
    if (subtitleDirectory == null || !subtitleDirectory.isDirectory) return SubtitlePublishOutcome(ok = false)
    val baseName = mediaFileName.removeSuffix(".mp4")
    val created = mutableListOf<android.net.Uri>()
    val artifacts = mutableListOf<OrionPublishedArtifact>()
    var bytes = 0L
    for (index in 0 until subtitleEntries.length()) {
      val entry = subtitleEntries.optJSONObject(index) ?: continue
      val relativeName = entry.optString("name").substringAfterLast('/').take(100)
      if (relativeName.isBlank()) continue
      val source = File(subtitleDirectory, relativeName)
      if (!source.isFile || source.length() <= 0L) return SubtitlePublishOutcome(false, bytes, created, artifacts)
      val format = relativeName.substringAfterLast('.', "vtt").lowercase().takeIf { it in setOf("vtt", "srt", "ass") } ?: "vtt"
      val language = entry.optString("language", "und").replace(Regex("[^A-Za-z0-9_-]"), "").take(12).ifBlank { "und" }
      val targetName = "$baseName.$language.${index + 1}.$format"
      val mime = when (format) {
        "srt" -> "application/x-subrip"
        "ass" -> "text/x-ssa"
        else -> "text/vtt"
      }
      val uri = OrionDownloadStorageRegistry.createDocument(context, targetId, mime, targetName)
        ?: return SubtitlePublishOutcome(false, bytes, created, artifacts)
      created += uri
      val written = try {
        context.contentResolver.openOutputStream(uri, "w")?.use { sink ->
          source.inputStream().use { input -> copyCounted(input, sink, jobId) }
        } ?: -1L
      } catch (_: Throwable) { -1L }
      if (written != source.length() || written <= 0L || !verifyPublishedBytes(context, uri, source, written)) {
        return SubtitlePublishOutcome(false, bytes, created, artifacts)
      }
      bytes += written
      artifacts += OrionPublishedArtifact(uri, "subtitle", targetName, mime, written)
    }
    return SubtitlePublishOutcome(true, bytes, created, artifacts)
  }

  private fun verifyPublishedBytes(
    context: Context,
    uri: android.net.Uri,
    source: File,
    expected: Long,
  ): Boolean {
    if (expected <= 0L || !source.isFile || source.length() != expected) return false

    // Most SAF providers expose the committed document size immediately. When they do,
    // confirm that metadata and a bounded byte-for-byte prefix instead of re-reading a
    // multi-gigabyte movie end to end. Providers without reliable size metadata retain
    // the previous full-count fallback.
    val reportedSize = OrionDownloadStorageRegistry.documentSize(context, uri)
    if (reportedSize == expected && verifyPublishedPrefix(context, uri, source)) return true
    return verifyPublishedBytesByCounting(context, uri, expected)
  }

  private fun verifyPublishedPrefix(context: Context, uri: android.net.Uri, source: File): Boolean {
    val probeBytes = minOf(PUBLISHED_VERIFY_PROBE_BYTES.toLong(), source.length()).toInt()
    if (probeBytes <= 0) return false
    return try {
      source.inputStream().use { local ->
        context.contentResolver.openInputStream(uri)?.use { published ->
          val localBuffer = ByteArray(probeBytes)
          val publishedBuffer = ByteArray(probeBytes)
          readExactly(local, localBuffer) && readExactly(published, publishedBuffer) && localBuffer.contentEquals(publishedBuffer)
        } ?: false
      }
    } catch (_: Throwable) {
      false
    }
  }

  private fun readExactly(input: java.io.InputStream, buffer: ByteArray): Boolean {
    var offset = 0
    while (offset < buffer.size) {
      val read = input.read(buffer, offset, buffer.size - offset)
      if (read < 0) return false
      if (read == 0) continue
      offset += read
    }
    return true
  }

  private fun verifyPublishedBytesByCounting(context: Context, uri: android.net.Uri, expected: Long): Boolean {
    return try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        val buffer = ByteArray(MEDIA_COPY_BUFFER_BYTES)
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

  private fun collectRoleSource(partialDir: File, roles: List<String>, role: String): RoleSource? {
    var initialization: File? = null
    val segments = mutableListOf<SegmentInput>()
    for (index in roles.indices) {
      val fragmentRole = roles[index]
      if (fragmentRole != role && fragmentRole != "$role-init") continue
      val file = File(partialDir, fragmentName(index))
      if (!file.isFile || file.length() <= 0L) return null
      if (fragmentRole == "$role-init") initialization = file
      else segments += SegmentInput(media = file, initialization = initialization)
    }
    return segments.takeIf { it.isNotEmpty() }?.let { RoleSource(role, it) }
  }

  private fun collectTracks(videoSource: RoleSource, audioSource: RoleSource?): List<TrackPlan> {
    val plans = mutableListOf<TrackPlan>()
    plans += tracksFrom(videoSource) { mime ->
      if (audioSource == null) mime.startsWith("video/") || mime.startsWith("audio/")
      else mime.startsWith("video/")
    }
    if (audioSource != null) plans += tracksFrom(audioSource) { mime -> mime.startsWith("audio/") }
    return plans
  }

  private fun tracksFrom(
    source: RoleSource,
    accept: (String) -> Boolean,
  ): List<TrackPlan> {
    return withExtractor(source.segments.first()) { extractor ->
      val ordinals = mutableMapOf<String, Int>()
      buildList {
        for (index in 0 until extractor.trackCount) {
          val format = extractor.getTrackFormat(index)
          val mime = format.getString(MediaFormat.KEY_MIME).orEmpty()
          val ordinal = ordinals[mime] ?: 0
          ordinals[mime] = ordinal + 1
          if (!accept(mime)) continue
          val language = if (format.containsKey(MediaFormat.KEY_LANGUAGE)) {
            format.getString(MediaFormat.KEY_LANGUAGE)?.take(12)
          } else null
          add(TrackPlan(source, ordinal, format, mime, language))
        }
      }
    } ?: emptyList()
  }

  private class TrackAccumulator(
    val plan: TrackPlan,
    val outputTrack: Int,
    val kind: OrionPortableCadence.Kind,
    val invalidTimelineCode: String,
    val fallbackStepUs: Long,
  ) {
    var timeline: OrionPortableCadence.Timeline? = null
    var sampleCount: Long = 0L
    var minTimeUs: Long = Long.MAX_VALUE
    var maxTimeUs: Long = Long.MIN_VALUE
    val ledger = OrionPortableSampleLedger()
  }

  private data class SegmentPlacement(
    val accumulator: TrackAccumulator,
    val offsetUs: Long,
    val expectedSamples: Int,
    val minTimeUs: Long,
    val maxTimeUs: Long,
    val nextTimeline: OrionPortableCadence.Timeline,
  )

  private fun remux(
    output: File,
    plans: List<TrackPlan>,
    jobId: String,
  ): RemuxAttempt {
    if (output.exists()) output.delete()
    val muxer = try {
      MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    } catch (_: Throwable) {
      return RemuxAttempt(failureCode = "portable-remux-track-write-failed")
    }
    var completed = false
    var segmentCount = 0
    var extractorOpenCount = 0
    var fragmentInspectMs = 0L
    var muxWriteMs = 0L
    return try {
      val videoPlan = plans.firstOrNull { it.mime.startsWith("video/") }
      if (videoPlan != null && videoPlan.format.containsKey(MediaFormat.KEY_ROTATION)) {
        val rotation = try { videoPlan.format.getInteger(MediaFormat.KEY_ROTATION) } catch (_: Throwable) { 0 }
        if (rotation in setOf(0, 90, 180, 270)) muxer.setOrientationHint(rotation)
      }

      val outputTracks = plans.map { plan -> muxer.addTrack(plan.format) }
      muxer.start()
      val sampleBuffer = ByteBuffer.allocateDirect(MAX_SAMPLE_BYTES)
      val accumulators = plans.mapIndexed { index, plan ->
        val kind = if (plan.mime.startsWith("video/")) OrionPortableCadence.Kind.VIDEO else OrionPortableCadence.Kind.AUDIO
        TrackAccumulator(
          plan = plan,
          outputTrack = outputTracks[index],
          kind = kind,
          invalidTimelineCode = if (kind == OrionPortableCadence.Kind.VIDEO) "portable-video-cadence-invalid" else "portable-audio-timeline-invalid",
          fallbackStepUs = nominalSampleStepUs(plan),
        )
      }
      for (source in plans.map { it.source }.distinct()) {
        val sourceTracks = accumulators.filter { it.plan.source == source }
        for (segment in source.segments) {
          segmentCount += 1
          if (isCancelled(jobId)) return RemuxAttempt(failureCode = "portable-remux-track-write-failed")
          val segmentInspectStartedAt = SystemClock.elapsedRealtime()
          extractorOpenCount += 1
          val timestamps = inspectSegmentTracks(segment, sourceTracks)
            ?: return RemuxAttempt(failureCode = "portable-fragment-format-changed")
          fragmentInspectMs += SystemClock.elapsedRealtime() - segmentInspectStartedAt
          val placements = mutableListOf<SegmentPlacement>()
          for (accumulator in sourceTracks) {
            val values = timestamps[accumulator] ?: return RemuxAttempt(failureCode = "portable-fragment-format-changed")
            val analysis = OrionPortableCadence.analyze(values, accumulator.kind, accumulator.fallbackStepUs)
              ?: return RemuxAttempt(failureCode = accumulator.invalidTimelineCode)
            if (accumulator.kind == OrionPortableCadence.Kind.VIDEO && analysis.reordered && Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
              return RemuxAttempt(failureCode = accumulator.invalidTimelineCode)
            }
            val placement = OrionPortableCadence.place(analysis, accumulator.timeline)
              ?: return RemuxAttempt(failureCode = accumulator.invalidTimelineCode)
            placements += SegmentPlacement(
              accumulator,
              placement.offsetUs,
              analysis.sampleCount,
              placement.minTimeUs,
              placement.maxTimeUs,
              placement.next,
            )
          }
          val segmentWriteStartedAt = SystemClock.elapsedRealtime()
          extractorOpenCount += 1
          if (!writeSegmentTracks(segment, placements, muxer, sampleBuffer, jobId)) {
            return RemuxAttempt(failureCode = "portable-remux-track-write-failed")
          }
          muxWriteMs += SystemClock.elapsedRealtime() - segmentWriteStartedAt
          placements.forEach { placement ->
            val accumulator = placement.accumulator
            accumulator.sampleCount += placement.expectedSamples.toLong()
            accumulator.minTimeUs = minOf(accumulator.minTimeUs, placement.minTimeUs)
            accumulator.maxTimeUs = maxOf(accumulator.maxTimeUs, placement.maxTimeUs)
            accumulator.timeline = placement.nextTimeline
          }
        }
      }
      val stats = accumulators.map { accumulator ->
        if (accumulator.sampleCount <= 0L || accumulator.minTimeUs == Long.MAX_VALUE || accumulator.maxTimeUs == Long.MIN_VALUE) {
          return RemuxAttempt(failureCode = "portable-remux-track-write-failed")
        }
        val summary = accumulator.ledger.finish() ?: return RemuxAttempt(failureCode = "portable-remux-track-write-failed")
        if (summary.sampleCount != accumulator.sampleCount || summary.minTimeUs != accumulator.minTimeUs || summary.maxTimeUs != accumulator.maxTimeUs) {
          return RemuxAttempt(failureCode = "portable-remux-track-write-failed")
        }
        TrackWriteStats(accumulator.plan.mime, accumulator.sampleCount, accumulator.minTimeUs, accumulator.maxTimeUs, summary.digest)
      }
      muxer.stop()
      completed = true

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
      RemuxAttempt(result = RemuxResult(
        audioMetadata = audio,
        stats = stats,
        diagnostics = RemuxDiagnostics(segmentCount, extractorOpenCount, fragmentInspectMs, muxWriteMs, sampleBufferAllocations = 1),
      ))
    } catch (_: Throwable) {
      RemuxAttempt(failureCode = "portable-remux-track-write-failed")
    } finally {
      try { muxer.release() } catch (_: Throwable) {}
      if (!completed || !output.isFile || output.length() <= 0L) output.delete()
    }
  }

  private fun inspectSegmentTracks(
    segment: SegmentInput,
    accumulators: List<TrackAccumulator>,
  ): Map<TrackAccumulator, LongArray>? = withExtractor(segment) { extractor ->
    val byTrack = linkedMapOf<Int, TrackAccumulator>()
    val values = linkedMapOf<TrackAccumulator, OrionBoundedLongCollector>()
    for (accumulator in accumulators) {
      val inputTrack = findTrack(extractor, accumulator.plan) ?: return@withExtractor null
      if (byTrack.put(inputTrack, accumulator) != null) return@withExtractor null
      values[accumulator] = OrionBoundedLongCollector(OrionPortableCadence.MAX_SAMPLES_PER_FRAGMENT)
      extractor.selectTrack(inputTrack)
    }
    while (extractor.sampleTrackIndex >= 0) {
      val accumulator = byTrack[extractor.sampleTrackIndex] ?: return@withExtractor null
      val buffer = values[accumulator] ?: return@withExtractor null
      if (!buffer.add(extractor.sampleTime)) return@withExtractor null
      if (!extractor.advance()) break
    }
    buildMap {
      for (accumulator in accumulators) {
        val timestamps = values.getValue(accumulator).toLongArray()
        if (timestamps.isEmpty()) return@withExtractor null
        put(accumulator, timestamps)
      }
    }
  }

  private fun writeSegmentTracks(
    segment: SegmentInput,
    placements: List<SegmentPlacement>,
    muxer: MediaMuxer,
    buffer: ByteBuffer,
    jobId: String,
  ): Boolean = withExtractor(segment) { extractor ->
      val byTrack = linkedMapOf<Int, SegmentPlacement>()
      val counts = linkedMapOf<TrackAccumulator, Int>()
      for (placement in placements) {
        val inputTrack = findTrack(extractor, placement.accumulator.plan) ?: return@withExtractor false
        if (byTrack.put(inputTrack, placement) != null) return@withExtractor false
        counts[placement.accumulator] = 0
        extractor.selectTrack(inputTrack)
      }
      val info = MediaCodec.BufferInfo()
      while (extractor.sampleTrackIndex >= 0) {
        if (isCancelled(jobId)) return@withExtractor false
        val placement = byTrack[extractor.sampleTrackIndex] ?: return@withExtractor false
        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size <= 0 || size > MAX_SAMPLE_BYTES) return@withExtractor false
        val outputTimeUs = OrionPortableCadence.applyOffset(extractor.sampleTime, placement.offsetUs) ?: return@withExtractor false
        info.set(0, size, outputTimeUs, extractor.sampleFlags)
        muxer.writeSampleData(placement.accumulator.outputTrack, buffer, info)
        if (!placement.accumulator.ledger.add(outputTimeUs, size.toLong())) return@withExtractor false
        counts[placement.accumulator] = (counts[placement.accumulator] ?: 0) + 1
        if (!extractor.advance()) break
      }
      placements.all { counts[it.accumulator] == it.expectedSamples }
    } ?: false

  private fun <T> withExtractor(segment: SegmentInput, block: (MediaExtractor) -> T): T? {
    val extractor = MediaExtractor()
    var composite: CompositeMediaDataSource? = null
    return try {
      val initialization = segment.initialization
      if (initialization == null) extractor.setDataSource(segment.media.absolutePath)
      else {
        composite = CompositeMediaDataSource(initialization, segment.media)
        extractor.setDataSource(composite)
      }
      block(extractor)
    } catch (_: Throwable) {
      null
    } finally {
      extractor.release()
      try { composite?.close() } catch (_: Throwable) {}
    }
  }

  private class CompositeMediaDataSource(initialization: File, media: File) : MediaDataSource() {
    private val initializationFile = RandomAccessFile(initialization, "r")
    private val mediaFile = RandomAccessFile(media, "r")
    private val initializationSize = initializationFile.length()
    private val totalSize = initializationSize + mediaFile.length()

    override fun readAt(position: Long, buffer: ByteArray, offset: Int, size: Int): Int {
      if (position < 0L || size < 0 || offset < 0 || offset + size > buffer.size) return -1
      if (position >= totalSize) return -1
      var remaining = minOf(size.toLong(), totalSize - position).toInt()
      var written = 0
      var cursor = position
      while (remaining > 0) {
        val active = if (cursor < initializationSize) initializationFile else mediaFile
        val localPosition = if (cursor < initializationSize) cursor else cursor - initializationSize
        val boundary = if (cursor < initializationSize) initializationSize - cursor else totalSize - cursor
        val requested = minOf(remaining.toLong(), boundary).toInt()
        active.seek(localPosition)
        val read = active.read(buffer, offset + written, requested)
        if (read <= 0) break
        written += read
        remaining -= read
        cursor += read.toLong()
      }
      return if (written > 0) written else -1
    }

    override fun getSize(): Long = totalSize

    override fun close() {
      try { initializationFile.close() } finally { mediaFile.close() }
    }
  }

  private fun findTrack(extractor: MediaExtractor, plan: TrackPlan): Int? {
    var ordinal = 0
    for (index in 0 until extractor.trackCount) {
      val format = extractor.getTrackFormat(index)
      val mime = format.getString(MediaFormat.KEY_MIME).orEmpty()
      if (mime != plan.mime) continue
      if (ordinal == plan.mimeOrdinal) {
        return index.takeIf { compatibleTrackFormat(plan.format, format, plan.mime) }
      }
      ordinal += 1
    }
    return null
  }

  private fun compatibleTrackFormat(expected: MediaFormat, actual: MediaFormat, mime: String): Boolean {
    if (actual.getString(MediaFormat.KEY_MIME).orEmpty() != mime) return false
    val coreFormatMatches = when {
      mime.startsWith("video/") ->
        sameIntegerFormatValue(expected, actual, MediaFormat.KEY_WIDTH) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_HEIGHT) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_FRAME_RATE) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_PROFILE) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_LEVEL) &&
          orientationDegrees(expected) == orientationDegrees(actual)
      mime.startsWith("audio/") ->
        sameIntegerFormatValue(expected, actual, MediaFormat.KEY_SAMPLE_RATE) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_CHANNEL_COUNT) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_AAC_PROFILE) &&
          sameIntegerFormatValue(expected, actual, MediaFormat.KEY_PROFILE)
      else -> false
    }
    return coreFormatMatches && sameCodecSpecificData(expected, actual)
  }

  private fun nominalSampleStepUs(plan: TrackPlan): Long {
    if (plan.mime.startsWith("video/")) {
      val frameRate = try {
        if (plan.format.containsKey(MediaFormat.KEY_FRAME_RATE)) plan.format.getInteger(MediaFormat.KEY_FRAME_RATE) else 0
      } catch (_: Throwable) { 0 }
      if (frameRate in 1..240) {
        return (1_000_000L / frameRate.toLong()).coerceIn(1L, MAX_LEARNED_SAMPLE_STEP_US)
      }
      return 41_667L
    }

    if (plan.mime.startsWith("audio/")) {
      val sampleRate = try {
        if (plan.format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) plan.format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 0
      } catch (_: Throwable) { 0 }
      if (sampleRate in 8_000..384_000) {
        return ((1_024L * 1_000_000L) / sampleRate.toLong()).coerceIn(1L, MAX_LEARNED_SAMPLE_STEP_US)
      }
      return 20_000L
    }

    return 1L
  }

  private fun verifyOutput(
    file: File,
    plans: List<TrackPlan>,
    expectedStats: List<TrackWriteStats>,
  ): Boolean {
    if (!file.isFile || file.length() <= 0L) return false
    if (plans.isEmpty() || expectedStats.size != plans.size) return false

    val scanner = MediaExtractor()
    val ledgers = plans.map { OrionPortableSampleLedger() }
    try {
      scanner.setDataSource(file.absolutePath)
      if (scanner.trackCount != plans.size) return false
      for (index in plans.indices) {
        val expectedPlan = plans[index]
        val expectedStatsForTrack = expectedStats[index]
        val actual = scanner.getTrackFormat(index)

        if (actual.getString(MediaFormat.KEY_MIME).orEmpty() != expectedPlan.mime) return false
        if (expectedStatsForTrack.sampleCount < 2L || expectedStatsForTrack.durationUs <= 0L) return false
        if (expectedStatsForTrack.sampleCount > OrionPortableCadence.MAX_OUTPUT_SAMPLES.toLong()) return false

        if (expectedPlan.mime.startsWith("video/")) {
          if (!sameIntegerFormatValue(expectedPlan.format, actual, MediaFormat.KEY_WIDTH)) return false
          if (!sameIntegerFormatValue(expectedPlan.format, actual, MediaFormat.KEY_HEIGHT)) return false
          if (orientationDegrees(expectedPlan.format) != orientationDegrees(actual)) return false
        }

        val declaredDurationUs = mediaDurationUs(actual) ?: return false
        val durationToleranceUs = maxOf(
          2_000_000L,
          minOf(OrionPortableCadence.MAX_AV_DRIFT_US, expectedStatsForTrack.durationUs / 100L),
        )
        if (!differenceWithin(declaredDurationUs, expectedStatsForTrack.durationUs, durationToleranceUs)) return false
        scanner.selectTrack(index)
      }

      while (scanner.sampleTrackIndex >= 0) {
        val trackIndex = scanner.sampleTrackIndex
        if (trackIndex !in plans.indices) return false
        val sampleSize = scanner.sampleSize
        if (sampleSize <= 0L || sampleSize > MAX_SAMPLE_BYTES.toLong()) return false
        if (!ledgers[trackIndex].add(scanner.sampleTime, sampleSize)) return false
        if (!scanner.advance()) break
      }
    } catch (_: Throwable) {
      return false
    } finally {
      scanner.release()
    }

    val videoDurationsUs = mutableListOf<Long>()
    val audioDurationsUs = mutableListOf<Long>()
    for (index in plans.indices) {
      val expectedPlan = plans[index]
      val expectedStatsForTrack = expectedStats[index]
      val actual = ledgers[index].finish() ?: return false
      if (actual.sampleCount != expectedStatsForTrack.sampleCount) return false
      if (actual.digest != expectedStatsForTrack.sampleDigest) return false
      if (!differenceWithin(actual.minTimeUs, expectedStatsForTrack.minTimeUs, 2_000L)) return false
      if (!differenceWithin(actual.maxTimeUs, expectedStatsForTrack.maxTimeUs, 2_000L)) return false
      val durationUs = actual.maxTimeUs - actual.minTimeUs
      when {
        expectedPlan.mime.startsWith("video/") -> videoDurationsUs += durationUs
        expectedPlan.mime.startsWith("audio/") -> audioDurationsUs += durationUs
      }
    }

    if (videoDurationsUs.isEmpty()) return false

    // If the inspected source exposed audio, the portable result must preserve usable
    // audio with approximately the same timeline as the video. This also covers
    // muxed HLS where audio is not represented by a separate fragment role.
    if (plans.any { it.mime.startsWith("audio/") }) {
      if (audioDurationsUs.isEmpty()) return false
      val videoDurationUs = videoDurationsUs.max()
      val audioDurationUs = audioDurationsUs.max()
      if (!OrionPortableCadence.withinAvDrift(videoDurationUs, audioDurationUs)) return false
    }

    return true
  }

  private fun differenceWithin(left: Long, right: Long, tolerance: Long): Boolean {
    if (tolerance < 0L) return false
    val difference = try {
      java.lang.Math.subtractExact(left, right)
    } catch (_: ArithmeticException) {
      return false
    }
    if (difference == Long.MIN_VALUE) return false
    return kotlin.math.abs(difference) <= tolerance
  }

  private fun mediaDurationUs(format: MediaFormat): Long? {
    if (!format.containsKey(MediaFormat.KEY_DURATION)) return null
    return try {
      format.getLong(MediaFormat.KEY_DURATION).takeIf { it > 0L }
    } catch (_: Throwable) {
      null
    }
  }

  private fun sameIntegerFormatValue(expected: MediaFormat, actual: MediaFormat, key: String): Boolean {
    if (!expected.containsKey(key)) return true
    if (!actual.containsKey(key)) return false
    return try {
      expected.getInteger(key) == actual.getInteger(key)
    } catch (_: Throwable) {
      false
    }
  }

  private fun orientationDegrees(format: MediaFormat): Int {
    val degrees = try {
      if (format.containsKey(MediaFormat.KEY_ROTATION)) format.getInteger(MediaFormat.KEY_ROTATION) else 0
    } catch (_: Throwable) {
      0
    }
    return degrees.takeIf { it in setOf(0, 90, 180, 270) } ?: 0
  }

  private fun sameCodecSpecificData(expected: MediaFormat, actual: MediaFormat): Boolean {
    for (key in listOf("csd-0", "csd-1", "csd-2")) {
      val expectedBuffer = try {
        if (expected.containsKey(key)) expected.getByteBuffer(key)?.duplicate() else null
      } catch (_: Throwable) {
        return false
      }
      val actualBuffer = try {
        if (actual.containsKey(key)) actual.getByteBuffer(key)?.duplicate() else null
      } catch (_: Throwable) {
        return false
      }
      if ((expectedBuffer == null) != (actualBuffer == null)) return false
      if (expectedBuffer == null || actualBuffer == null) continue
      if (expectedBuffer.remaining() != actualBuffer.remaining()) return false
      while (expectedBuffer.hasRemaining()) {
        if (expectedBuffer.get() != actualBuffer.get()) return false
      }
    }
    return true
  }

  private fun isCancelled(jobId: String): Boolean = jobId.isNotBlank() && (
    OrionDownloadJobStore.control(jobId) == "cancel" || OrionDownloadJobStore.getJob(jobId)?.optString("state") == "cancelled"
  )

  private fun copyCounted(input: java.io.InputStream, output: java.io.OutputStream, jobId: String): Long {
    val buffer = ByteArray(MEDIA_COPY_BUFFER_BYTES)
    var total = 0L
    while (true) {
      if (isCancelled(jobId)) throw java.io.InterruptedIOException("Download finalization cancelled")
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

  private fun cancelled() = OrionPortableFinalizeOutcome(ok = false, cancelled = true)
}
