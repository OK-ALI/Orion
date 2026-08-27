package com.okali.orion.playback

import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.File

internal data class OrionFinalizedTrackProbe(
  val kind: String,
  val sampleCount: Long,
  val durationUs: Long,
  val width: Int = 0,
  val height: Int = 0,
  val largestSampleBytes: Long = 0L,
)

internal data class OrionFinalizedMediaVerification(
  val ok: Boolean,
  val code: String,
  val message: String,
  val sizeBytes: Long = 0L,
  val durationUs: Long = 0L,
)

/** Pure acceptance policy shared by production probing and executable JVM tests. */
internal object OrionFinalizedMediaPolicy {
  private const val MAX_MEDIA_DURATION_US = 30L * 24L * 60L * 60L * 1_000_000L
  private const val MAX_SAMPLE_BYTES = 128L * 1024L * 1024L

  fun hasIsoBmffFileType(prefix: ByteArray, fileSize: Long): Boolean {
    if (fileSize < 16L || prefix.size < 12) return false
    for (typeOffset in 4..prefix.size - 8) {
      if (prefix[typeOffset] != 'f'.code.toByte() || prefix[typeOffset + 1] != 't'.code.toByte()
        || prefix[typeOffset + 2] != 'y'.code.toByte() || prefix[typeOffset + 3] != 'p'.code.toByte()) continue
      val boxStart = typeOffset - 4
      val declaredSize = ((prefix[boxStart].toLong() and 0xffL) shl 24) or
        ((prefix[boxStart + 1].toLong() and 0xffL) shl 16) or
        ((prefix[boxStart + 2].toLong() and 0xffL) shl 8) or
        (prefix[boxStart + 3].toLong() and 0xffL)
      if (declaredSize >= 16L && boxStart.toLong() + declaredSize <= fileSize) return true
    }
    return false
  }

  fun evaluate(fileName: String, fileSize: Long, tracks: List<OrionFinalizedTrackProbe>, requireAudio: Boolean): OrionFinalizedMediaVerification {
    if (!fileName.endsWith(".mp4", ignoreCase = true) || fileSize <= 0L) {
      return failure("yt-dlp-media-container-invalid", "The completed download is not a finalized MP4.")
    }
    val video = tracks.filter { it.kind == "video" }
    val audio = tracks.filter { it.kind == "audio" }
    if (video.isEmpty()) return failure("yt-dlp-media-video-missing", "The finalized MP4 does not contain a playable video track.")
    if (requireAudio && audio.isEmpty()) return failure("yt-dlp-media-audio-missing", "The finalized MP4 does not contain its expected audio track.")
    if (video.any { it.width <= 0 || it.height <= 0 }) {
      return failure("yt-dlp-media-dimensions-invalid", "The finalized MP4 has invalid video dimensions.")
    }
    if (tracks.any { it.sampleCount <= 0L || it.durationUs <= 0L || it.durationUs > MAX_MEDIA_DURATION_US }) {
      return failure("yt-dlp-media-duration-invalid", "The finalized MP4 has an invalid media timeline.")
    }
    if (tracks.any { it.largestSampleBytes <= 0L || it.largestSampleBytes > MAX_SAMPLE_BYTES }) {
      return failure("yt-dlp-media-samples-invalid", "The finalized MP4 has invalid encoded samples.")
    }
    return OrionFinalizedMediaVerification(
      ok = true,
      code = "verified",
      message = "Verified finalized MP4.",
      sizeBytes = fileSize,
      durationUs = tracks.maxOf { it.durationUs },
    )
  }

  private fun failure(code: String, message: String) = OrionFinalizedMediaVerification(false, code, message)
}

/** Payload-free MediaExtractor verification performed before a yt-dlp file becomes Verified. */
internal object OrionFinalizedMediaVerifier {
  private const val MAX_TRACKS = 32
  private const val MAX_SAMPLES = 2_000_000L
  private const val CONTAINER_PREFIX_BYTES = 64 * 1024

  fun verify(file: File, requireAudio: Boolean): OrionFinalizedMediaVerification {
    if (!file.isFile || file.length() <= 0L || !file.extension.equals("mp4", true)) {
      return OrionFinalizedMediaPolicy.evaluate(file.name, file.length(), emptyList(), requireAudio)
    }
    val prefix = try {
      val bytes = ByteArray(minOf(file.length(), CONTAINER_PREFIX_BYTES.toLong()).toInt())
      file.inputStream().use { input ->
        var offset = 0
        while (offset < bytes.size) {
          val count = input.read(bytes, offset, bytes.size - offset)
          if (count < 0) break
          offset += count
        }
        if (offset == bytes.size) bytes else bytes.copyOf(offset)
      }
    } catch (_: Throwable) { ByteArray(0) }
    if (!OrionFinalizedMediaPolicy.hasIsoBmffFileType(prefix, file.length())) {
      return OrionFinalizedMediaVerification(false, "yt-dlp-media-container-invalid", "The completed download is not a finalized MP4 container.")
    }
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(file.absolutePath)
      if (extractor.trackCount !in 1..MAX_TRACKS) {
        return OrionFinalizedMediaVerification(false, "yt-dlp-media-container-invalid", "The finalized MP4 has an invalid track inventory.")
      }
      val selected = linkedMapOf<Int, MutableProbe>()
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME).orEmpty().lowercase()
        val kind = when {
          mime.startsWith("video/") -> "video"
          mime.startsWith("audio/") -> "audio"
          else -> null
        } ?: continue
        val declaredDuration = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
        val width = if (kind == "video" && format.containsKey(MediaFormat.KEY_WIDTH)) format.getInteger(MediaFormat.KEY_WIDTH) else 0
        val height = if (kind == "video" && format.containsKey(MediaFormat.KEY_HEIGHT)) format.getInteger(MediaFormat.KEY_HEIGHT) else 0
        selected[index] = MutableProbe(kind, declaredDuration, width, height)
        extractor.selectTrack(index)
      }
      if (selected.isEmpty()) {
        return OrionFinalizedMediaVerification(false, "yt-dlp-media-container-invalid", "The finalized MP4 contains no inspectable media tracks.")
      }
      var totalSamples = 0L
      while (extractor.sampleTrackIndex >= 0) {
        val track = selected[extractor.sampleTrackIndex]
        if (track != null) {
          val sampleSize = extractor.sampleSize
          val sampleTime = extractor.sampleTime
          // Valid MP4 edit lists and reordered presentation timelines may expose
          // negative starting PTS. Verification measures the bounded span; it must
          // not reject otherwise valid encoded samples solely for that offset.
          if (sampleSize <= 0L) {
            return OrionFinalizedMediaVerification(false, "yt-dlp-media-samples-invalid", "The finalized MP4 has invalid encoded samples.")
          }
          track.count += 1L
          track.minimumTimeUs = minOf(track.minimumTimeUs, sampleTime)
          track.maximumTimeUs = maxOf(track.maximumTimeUs, sampleTime)
          track.largestSampleBytes = maxOf(track.largestSampleBytes, sampleSize)
          totalSamples += 1L
          if (totalSamples > MAX_SAMPLES) {
            return OrionFinalizedMediaVerification(false, "yt-dlp-media-samples-invalid", "The finalized MP4 exceeds Orion's bounded sample inventory.")
          }
        }
        if (!extractor.advance()) break
      }
      val probes = selected.values.map { probe ->
        val span = if (probe.minimumTimeUs == Long.MAX_VALUE || probe.maximumTimeUs <= probe.minimumTimeUs) 0L
          else probe.maximumTimeUs - probe.minimumTimeUs
        OrionFinalizedTrackProbe(
          kind = probe.kind,
          sampleCount = probe.count,
          durationUs = maxOf(probe.declaredDurationUs, span),
          width = probe.width,
          height = probe.height,
          largestSampleBytes = probe.largestSampleBytes,
        )
      }
      OrionFinalizedMediaPolicy.evaluate(file.name, file.length(), probes, requireAudio)
    } catch (_: Throwable) {
      OrionFinalizedMediaVerification(false, "yt-dlp-media-probe-failed", "Orion could not validate the finalized MP4 container.")
    } finally {
      try { extractor.release() } catch (_: Throwable) {}
    }
  }

  private data class MutableProbe(
    val kind: String,
    val declaredDurationUs: Long,
    val width: Int,
    val height: Int,
    var count: Long = 0L,
    var minimumTimeUs: Long = Long.MAX_VALUE,
    var maximumTimeUs: Long = Long.MIN_VALUE,
    var largestSampleBytes: Long = 0L,
  )
}
