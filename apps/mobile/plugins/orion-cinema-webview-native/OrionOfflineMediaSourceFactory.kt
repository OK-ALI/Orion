package com.okali.orion.playback

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MergingMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import java.io.EOFException
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

internal data class OrionOfflineMediaSourceBuild(
  val mediaSource: MediaSource,
  val subtitles: List<OrionOfflinePlayerSubtitle>,
)

/** Builds one-period Media3 sources directly over exact Orion-owned bytes. */
@OptIn(UnstableApi::class)
internal object OrionOfflineMediaSourceFactory {
  fun build(context: Context, asset: OrionOfflinePlayerAsset): OrionOfflineMediaSourceBuild? {
    if (asset.mediaDocument != null || asset.mediaFile != null) return null
    val subtitleConfigurations = asset.subtitles.map { subtitle ->
      val mime = when (subtitle.format) {
        "vtt" -> MimeTypes.TEXT_VTT
        "srt" -> MimeTypes.APPLICATION_SUBRIP
        "ass" -> MimeTypes.TEXT_SSA
        else -> return null
      }
      val uri = subtitle.document?.uri ?: subtitle.file?.let(Uri::fromFile) ?: return null
      MediaItem.SubtitleConfiguration.Builder(uri)
        .setId(subtitle.id)
        .setLabel(subtitle.label)
        .setLanguage(subtitle.language)
        .setMimeType(mime)
        .setSelectionFlags(if (subtitle.isDefault) C.SELECTION_FLAG_DEFAULT else 0)
        .build()
    }

    val streams = linkedMapOf<String, List<OrionOfflinePlayerPart>>()
    val videoUri = Uri.Builder()
      .scheme("orion-offline")
      .authority("asset")
      .appendPath(asset.assetId)
      .appendPath("video")
      .build()
    streams[videoUri.toString()] = asset.videoParts
    val audioUri = if (asset.audioParts.isNotEmpty()) {
      Uri.Builder()
        .scheme("orion-offline")
        .authority("asset")
        .appendPath(asset.assetId)
        .appendPath("audio")
        .build()
        .also { uri -> streams[uri.toString()] = asset.audioParts }
    } else null
    if (streams.values.any { it.isEmpty() }) return null

    val fragmentFactory = OrionOfflineFragmentDataSourceFactory(streams)
    // Unknown orion-offline:// URIs are handled by the exact-fragment source;
    // validated file:// subtitle URIs stay on Media3's normal local data source.
    val routedFactory = DefaultDataSource.Factory(context, fragmentFactory)
    fun progressive(uri: Uri, id: String): MediaSource = ProgressiveMediaSource.Factory(fragmentFactory)
      .createMediaSource(MediaItem.Builder().setMediaId(id).setUri(uri).build())

    val videoItem = MediaItem.Builder()
      .setMediaId("orion-offline-video")
      .setUri(videoUri)
      .setSubtitleConfigurations(subtitleConfigurations)
      .build()
    // Media3 1.9 DefaultMediaSourceFactory parses side-loaded subtitles during
    // extraction by default; do not opt back into legacy subtitle decoding.
    var source: MediaSource = DefaultMediaSourceFactory(routedFactory)
      .createMediaSource(videoItem)
    if (audioUri != null) {
      source = MergingMediaSource(
        OrionOfflineMediaSourcePolicy.ADJUST_SEPARATE_AV_PERIOD_TIME_OFFSETS,
        OrionOfflineMediaSourcePolicy.CLIP_SEPARATE_AV_DURATIONS,
        source,
        progressive(audioUri, "orion-offline-audio"),
      )
    }
    return OrionOfflineMediaSourceBuild(source, asset.subtitles)
  }
}

@OptIn(UnstableApi::class)
private class OrionOfflineFragmentDataSourceFactory(
  private val streams: Map<String, List<OrionOfflinePlayerPart>>,
) : DataSource.Factory {
  override fun createDataSource(): DataSource = OrionOfflineFragmentDataSource(streams)
}

@OptIn(UnstableApi::class)
private class OrionOfflineFragmentDataSource(
  private val streams: Map<String, List<OrionOfflinePlayerPart>>,
) : BaseDataSource(false) {
  private var uri: Uri? = null
  private var parts: List<OrionOfflinePlayerPart> = emptyList()
  private var partIndex = 0
  private var partOffset = 0L
  private var remaining = 0L
  private var active: RandomAccessFile? = null
  private var opened = false

  @Throws(IOException::class)
  override fun open(dataSpec: DataSpec): Long {
    close()
    transferInitializing(dataSpec)
    val selected = streams[dataSpec.uri.toString()] ?: throw IOException("offline-source-uri-invalid")
    val totalSize = selected.fold(0L) { total, part ->
      try { java.lang.Math.addExact(total, part.file.length()) } catch (_: ArithmeticException) { throw IOException("offline-source-size-overflow") }
    }
    if (dataSpec.position < 0L || dataSpec.position > totalSize) throw EOFException("offline-source-position-invalid")
    uri = dataSpec.uri
    parts = selected
    var cursor = dataSpec.position
    partIndex = 0
    while (partIndex < parts.size && cursor >= parts[partIndex].file.length()) {
      cursor -= parts[partIndex].file.length()
      partIndex += 1
    }
    partOffset = cursor
    val available = totalSize - dataSpec.position
    remaining = if (dataSpec.length == C.LENGTH_UNSET.toLong()) available else minOf(available, dataSpec.length)
    opened = true
    transferStarted(dataSpec)
    return remaining
  }

  @Throws(IOException::class)
  override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
    if (length == 0) return 0
    if (!opened || remaining <= 0L) return C.RESULT_END_OF_INPUT
    while (partIndex < parts.size) {
      val part = parts[partIndex]
      val file = part.file
      if (!file.isFile || file.length() <= 0L) throw IOException("offline-fragment-unavailable:${part.fragmentIndex}")
      if (partOffset >= file.length()) {
        active?.close()
        active = null
        partIndex += 1
        partOffset = 0L
        continue
      }
      val handle = active ?: RandomAccessFile(file, "r").also { active = it }
      handle.seek(partOffset)
      val requested = minOf(length.toLong(), remaining, file.length() - partOffset).toInt()
      val read = handle.read(buffer, offset, requested)
      if (read <= 0) throw EOFException("offline-fragment-short-read:${part.fragmentIndex}")
      partOffset += read.toLong()
      remaining -= read.toLong()
      bytesTransferred(read)
      return read
    }
    return C.RESULT_END_OF_INPUT
  }

  override fun getUri(): Uri? = uri

  override fun close() {
    try { active?.close() } catch (_: Throwable) {}
    active = null
    parts = emptyList()
    uri = null
    remaining = 0L
    if (opened) {
      opened = false
      transferEnded()
    }
  }
}
