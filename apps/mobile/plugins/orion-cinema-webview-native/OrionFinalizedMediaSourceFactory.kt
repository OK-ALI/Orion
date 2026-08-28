package com.okali.orion.playback

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
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
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import java.io.EOFException
import java.io.FileInputStream
import java.io.IOException

internal data class OrionFinalizedMediaSourceBuild(
  val mediaSource: MediaSource,
  val subtitles: List<OrionOfflinePlayerSubtitle>,
)

internal interface OrionFinalizedMediaSourceObserver {
  fun onDescriptorOpened(role: String, position: Long, length: Long)

  companion object {
    val NONE = object : OrionFinalizedMediaSourceObserver {
      override fun onDescriptorOpened(role: String, position: Long, length: Long) = Unit
    }
  }
}

private data class OrionFinalizedDocumentSource(
  val sizeBytes: Long,
  val role: String,
)

/** Finalized MP4 authority. Fragment streams are deliberately rejected. */
@OptIn(UnstableApi::class)
internal object OrionFinalizedMediaSourceFactory {
  fun build(
    context: Context,
    asset: OrionOfflinePlayerAsset,
    observer: OrionFinalizedMediaSourceObserver = OrionFinalizedMediaSourceObserver.NONE,
  ): OrionFinalizedMediaSourceBuild? {
    if (asset.videoParts.isNotEmpty() || asset.audioParts.isNotEmpty()) return null
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
      if (asset.mediaFile != null) return null
      val documents = linkedMapOf(
        mediaDocument.uri.toString() to OrionFinalizedDocumentSource(mediaDocument.sizeBytes, "media"),
      )
      asset.subtitles.mapNotNull { it.document }.forEach {
        documents[it.uri.toString()] = OrionFinalizedDocumentSource(it.sizeBytes, "subtitle")
      }
      val item = MediaItem.Builder()
        .setMediaId("orion-finalized-saf-document")
        .setUri(mediaDocument.uri)
        .setMimeType(MimeTypes.VIDEO_MP4)
        .setSubtitleConfigurations(subtitleConfigurations)
        .build()
      // For video/mp4 DefaultMediaSourceFactory delegates the primary item to
      // ProgressiveMediaSource while retaining Media3's modern subtitle parser.
      val factory = OrionFinalizedDocumentRoutingDataSourceFactory(context, documents, observer)
      return OrionFinalizedMediaSourceBuild(
        DefaultMediaSourceFactory(factory).createMediaSource(item),
        asset.subtitles,
      )
    }

    val mediaFile = asset.mediaFile ?: return null
    if (!mediaFile.isFile || mediaFile.length() <= 0L) return null
    val item = MediaItem.Builder()
      .setMediaId("orion-finalized-private-file")
      .setUri(Uri.fromFile(mediaFile))
      .setMimeType(MimeTypes.VIDEO_MP4)
      .setSubtitleConfigurations(subtitleConfigurations)
      .build()
    return OrionFinalizedMediaSourceBuild(
      DefaultMediaSourceFactory(DefaultDataSource.Factory(context)).createMediaSource(item),
      asset.subtitles,
    )
  }
}

@OptIn(UnstableApi::class)
private class OrionFinalizedDocumentRoutingDataSourceFactory(
  private val context: Context,
  private val documents: Map<String, OrionFinalizedDocumentSource>,
  private val observer: OrionFinalizedMediaSourceObserver,
) : DataSource.Factory {
  override fun createDataSource(): DataSource = OrionFinalizedDocumentRoutingDataSource(context, documents, observer)
}

@OptIn(UnstableApi::class)
private class OrionFinalizedDocumentRoutingDataSource(
  context: Context,
  private val documents: Map<String, OrionFinalizedDocumentSource>,
  private val observer: OrionFinalizedMediaSourceObserver,
) : DataSource {
  private val context = context.applicationContext
  private val listeners = mutableListOf<TransferListener>()
  private var active: DataSource? = null

  override fun addTransferListener(transferListener: TransferListener) {
    listeners += transferListener
  }

  override fun open(dataSpec: DataSpec): Long {
    check(active == null) { "finalized-document-source-already-open" }
    val selected = if (documents.containsKey(dataSpec.uri.toString())) {
      OrionFinalizedDocumentDataSource(context, documents, observer)
    } else {
      DefaultDataSource.Factory(context).createDataSource()
    }
    listeners.forEach(selected::addTransferListener)
    active = selected
    return try {
      selected.open(dataSpec)
    } catch (error: Throwable) {
      try { selected.close() } catch (_: Throwable) {}
      active = null
      throw error
    }
  }

  override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
    active?.read(buffer, offset, length) ?: throw IOException("finalized-document-source-not-open")

  override fun getUri(): Uri? = active?.uri

  override fun getResponseHeaders(): Map<String, List<String>> = active?.responseHeaders ?: emptyMap()

  override fun close() {
    val selected = active
    active = null
    selected?.close()
  }
}

/** Exact, size-bounded and seekable SAF reader for finalized media and sidecars. */
@OptIn(UnstableApi::class)
private class OrionFinalizedDocumentDataSource(
  private val context: Context,
  private val documents: Map<String, OrionFinalizedDocumentSource>,
  private val observer: OrionFinalizedMediaSourceObserver,
) : BaseDataSource(false) {
  private var openedUri: Uri? = null
  private var descriptor: ParcelFileDescriptor? = null
  private var input: FileInputStream? = null
  private var remaining = 0L
  private var opened = false

  override fun open(dataSpec: DataSpec): Long {
    close()
    transferInitializing(dataSpec)
    val source = documents[dataSpec.uri.toString()]?.takeIf { it.sizeBytes > 0L }
      ?: throw IOException("finalized-document-uri-not-owned")
    if (dataSpec.position < 0L || dataSpec.position > source.sizeBytes) {
      throw EOFException("finalized-document-position-invalid")
    }
    val pfd = try {
      context.contentResolver.openFileDescriptor(dataSpec.uri, "r")
    } catch (error: Throwable) {
      throw IOException("finalized-document-descriptor-unavailable", error)
    } ?: throw IOException("finalized-document-descriptor-unavailable")
    val stream = FileInputStream(pfd.fileDescriptor)
    try {
      val statSize = pfd.statSize
      if (statSize >= 0L && statSize != source.sizeBytes) throw IOException("finalized-document-size-mismatch")
      val available = source.sizeBytes - dataSpec.position
      if (dataSpec.length != C.LENGTH_UNSET.toLong() && dataSpec.length > available) {
        throw EOFException("finalized-document-range-invalid")
      }
      stream.channel.position(dataSpec.position)
      remaining = if (dataSpec.length == C.LENGTH_UNSET.toLong()) available else dataSpec.length
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
    observer.onDescriptorOpened(source.role, dataSpec.position, remaining)
    return remaining
  }

  override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
    if (length == 0) return 0
    if (!opened || remaining <= 0L) return C.RESULT_END_OF_INPUT
    val count = input?.read(buffer, offset, minOf(length.toLong(), remaining).toInt())
      ?: throw IOException("finalized-document-source-not-open")
    if (count < 0) throw EOFException("finalized-document-short-read")
    remaining -= count.toLong()
    bytesTransferred(count)
    return count
  }

  override fun getUri(): Uri? = openedUri

  override fun close() {
    openedUri = null
    try { input?.close() } catch (_: Throwable) {}
    input = null
    try { descriptor?.close() } catch (_: Throwable) {}
    descriptor = null
    remaining = 0L
    if (opened) {
      opened = false
      transferEnded()
    }
  }
}
