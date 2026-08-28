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
import androidx.media3.datasource.TransferListener
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MergingMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import java.io.EOFException
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.RandomAccessFile
import android.os.ParcelFileDescriptor

internal data class OrionOfflineMediaSourceBuild(
  val mediaSource: MediaSource,
  val subtitles: List<OrionOfflinePlayerSubtitle>,
)

/** Builds one-period Media3 sources directly over exact Orion-owned bytes. */
@OptIn(UnstableApi::class)
internal object OrionOfflineMediaSourceFactory {
  fun build(context: Context, asset: OrionOfflinePlayerAsset): OrionOfflineMediaSourceBuild? {
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

    val mediaDocument = asset.mediaDocument
    if (mediaDocument != null) {
      val documents = linkedMapOf(mediaDocument.uri.toString() to mediaDocument.sizeBytes)
      asset.subtitles.mapNotNull { it.document }.forEach { documents[it.uri.toString()] = it.sizeBytes }
      val item = MediaItem.Builder()
        .setMediaId("orion-offline-saf-document")
        .setUri(mediaDocument.uri)
        .setMimeType(MimeTypes.VIDEO_MP4)
        .setSubtitleConfigurations(subtitleConfigurations)
        .build()
      return OrionOfflineMediaSourceBuild(
        DefaultMediaSourceFactory(OrionOfflineDocumentRoutingDataSourceFactory(context, documents))
          .createMediaSource(item),
        asset.subtitles,
      )
    }

    val mediaFile = asset.mediaFile
    if (mediaFile != null) {
      if (!mediaFile.isFile || mediaFile.length() <= 0L) return null
      val item = MediaItem.Builder()
        .setMediaId("orion-offline-file")
        .setUri(Uri.fromFile(mediaFile))
        .setSubtitleConfigurations(subtitleConfigurations)
        .build()
      return OrionOfflineMediaSourceBuild(
        DefaultMediaSourceFactory(
          DefaultDataSource.Factory(context),
        ).createMediaSource(item),
        asset.subtitles,
      )
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
private class OrionOfflineDocumentRoutingDataSourceFactory(
  private val context: Context,
  private val documents: Map<String, Long>,
) : DataSource.Factory {
  override fun createDataSource(): DataSource = OrionOfflineDocumentRoutingDataSource(context, documents)
}

@OptIn(UnstableApi::class)
private class OrionOfflineDocumentRoutingDataSource(
  context: Context,
  private val documents: Map<String, Long>,
) : DataSource {
  private val context = context.applicationContext
  private val listeners = mutableListOf<TransferListener>()
  private var active: DataSource? = null

  override fun addTransferListener(transferListener: TransferListener) {
    listeners += transferListener
  }

  override fun open(dataSpec: DataSpec): Long {
    check(active == null) { "offline-document-source-already-open" }
    val selected = if (documents.containsKey(dataSpec.uri.toString())) {
      OrionOfflineDocumentDataSource(context, documents)
    } else {
      DefaultDataSource.Factory(context).createDataSource()
    }
    listeners.forEach(selected::addTransferListener)
    active = selected
    return try { selected.open(dataSpec) } catch (error: Throwable) {
      try { selected.close() } catch (_: Throwable) {}
      active = null
      throw error
    }
  }

  override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
    active?.read(buffer, offset, length) ?: throw IOException("offline-document-source-not-open")

  override fun getUri(): Uri? = active?.uri

  override fun getResponseHeaders(): Map<String, List<String>> = active?.responseHeaders ?: emptyMap()

  override fun close() {
    val selected = active
    active = null
    selected?.close()
  }
}

/** Descriptor-authoritative reader for exact, already-validated SAF documents. */
@OptIn(UnstableApi::class)
private class OrionOfflineDocumentDataSource(
  private val context: Context,
  private val documents: Map<String, Long>,
) : BaseDataSource(false) {
  private var openedUri: Uri? = null
  private var descriptor: ParcelFileDescriptor? = null
  private var input: FileInputStream? = null
  private var remaining = 0L
  private var opened = false

  override fun open(dataSpec: DataSpec): Long {
    close()
    transferInitializing(dataSpec)
    val expected = documents[dataSpec.uri.toString()]?.takeIf { it > 0L }
      ?: throw IOException("offline-document-uri-not-owned")
    if (dataSpec.position < 0L || dataSpec.position > expected) throw EOFException("offline-document-position-invalid")
    val pfd = try { context.contentResolver.openFileDescriptor(dataSpec.uri, "r") } catch (error: Throwable) {
      throw IOException("offline-document-descriptor-unavailable", error)
    } ?: throw IOException("offline-document-descriptor-unavailable")
    val stream = FileInputStream(pfd.fileDescriptor)
    try {
      val statSize = pfd.statSize
      if (statSize >= 0L && statSize != expected) throw IOException("offline-document-size-mismatch")
      stream.channel.position(dataSpec.position)
      val available = expected - dataSpec.position
      remaining = if (dataSpec.length == C.LENGTH_UNSET.toLong()) available else minOf(available, dataSpec.length)
    } catch (error: Throwable) {
      try { stream.close() } catch (_: Throwable) {}
      try { pfd.close() } catch (_: Throwable) {}
      throw error
    }
    descriptor = pfd
    input = stream
    openedUri = dataSpec.uri
    opened = true
    transferStarted(dataSpec)
    return remaining
  }

  override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
    if (length == 0) return 0
    if (!opened || remaining <= 0L) return C.RESULT_END_OF_INPUT
    val count = input?.read(buffer, offset, minOf(length.toLong(), remaining).toInt())
      ?: throw IOException("offline-document-source-not-open")
    if (count < 0) throw EOFException("offline-document-short-read")
    remaining -= count.toLong()
    bytesTransferred(count)
    return count
  }

  override fun getUri(): Uri? = openedUri

  override fun close() {
    openedUri = null
    try { input?.close() } finally {
      input = null
      try { descriptor?.close() } finally { descriptor = null }
    }
    if (opened) {
      opened = false
      transferEnded()
    }
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
