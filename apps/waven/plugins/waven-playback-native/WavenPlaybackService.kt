package com.okali.waven.playback

import android.net.Uri
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

@OptIn(UnstableApi::class)
class WavenPlaybackService : MediaSessionService() {
  private var player: ExoPlayer? = null
  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()

    val upstream = DefaultDataSource.Factory(
      this,
      DefaultHttpDataSource.Factory()
        .setAllowCrossProtocolRedirects(true),
    )

    val resolvingFactory = ResolvingDataSource.Factory(
      upstream,
      object : ResolvingDataSource.Resolver {
        override fun resolveDataSpec(dataSpec: DataSpec): DataSpec {
          if (dataSpec.uri.scheme != WavenPlaybackContract.SOURCE_SCHEME) {
            return dataSpec
          }

          val queueId = dataSpec.uri.pathSegments.firstOrNull()
            ?: throw IOException("WAVEN_SOURCE_INVALID:missing-queue-id")
          val source = sourceLeases[queueId]
            ?: throw IOException("WAVEN_SOURCE_UNRESOLVED:$queueId")

          if (source.expired()) {
            throw IOException("WAVEN_SOURCE_EXPIRED:$queueId")
          }

          return dataSpec
            .withUri(source.uri)
            .withRequestHeaders(source.headers)
        }

        override fun resolveReportedUri(uri: Uri): Uri {
          if (uri.scheme != WavenPlaybackContract.SOURCE_SCHEME) {
            return uri
          }
          val queueId = uri.pathSegments.firstOrNull() ?: return uri
          return sourceLeases[queueId]?.uri ?: uri
        }
      },
    )

    val mediaSourceFactory = DefaultMediaSourceFactory(resolvingFactory)

    val activePlayer = ExoPlayer.Builder(this)
      .setMediaSourceFactory(mediaSourceFactory)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build(),
        true,
      )
      .setHandleAudioBecomingNoisy(true)
      .setWakeMode(C.WAKE_MODE_NETWORK)
      .build()

    player = activePlayer
    mediaSession = MediaSession.Builder(this, activePlayer)
      .setCallback(SessionCallback())
      .build()
  }

  override fun onGetSession(
    controllerInfo: MediaSession.ControllerInfo,
  ): MediaSession? = mediaSession

  override fun onTaskRemoved(rootIntent: android.content.Intent?) {
    if (player?.isPlaying != true) {
      stopSelf()
    }
  }

  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    player?.release()
    player = null
    sourceLeases.clear()
    super.onDestroy()
  }

  private inner class SessionCallback : MediaSession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult {
      val sameApp = controller.packageName == packageName
      return if (sameApp || controller.isTrusted) {
        MediaSession.ConnectionResult.AcceptedResultBuilder(session).build()
      } else {
        MediaSession.ConnectionResult.reject()
      }
    }

    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
    ): ListenableFuture<MutableList<MediaItem>> {
      val resolved = mediaItems.mapTo(ArrayList(mediaItems.size)) { item ->
        resolveMediaItem(item)
      }
      return Futures.immediateFuture(resolved)
    }
  }

  private fun resolveMediaItem(request: MediaItem): MediaItem {
    val queueId = request.mediaId.takeIf { it.isNotBlank() }
      ?: throw IllegalArgumentException("WAVEN queue item is missing mediaId.")

    val extras = request.requestMetadata.extras ?: Bundle()
    val sourceUri = extras.getString(WavenPlaybackContract.EXTRA_SOURCE_URI)

    if (!sourceUri.isNullOrBlank()) {
      val headerBundle = extras.getBundle(WavenPlaybackContract.EXTRA_SOURCE_HEADERS)
      val headers = linkedMapOf<String, String>()
      headerBundle?.keySet()?.forEach { key ->
        headerBundle.getString(key)?.let { value -> headers[key] = value }
      }

      val expiresAtMs =
        if (extras.containsKey(WavenPlaybackContract.EXTRA_SOURCE_EXPIRES_AT_MS)) {
          extras.getLong(WavenPlaybackContract.EXTRA_SOURCE_EXPIRES_AT_MS)
        } else {
          null
        }

      registerSource(
        queueId,
        WavenPlaybackContract.SourceLease(
          uri = Uri.parse(sourceUri),
          headers = headers,
          mimeType = extras.getString(WavenPlaybackContract.EXTRA_SOURCE_MIME_TYPE),
          expiresAtMs = expiresAtMs,
        ),
      )
    } else {
      unregisterSource(queueId)
    }

    val source = sourceLeases[queueId]

    return request.buildUpon()
      .setUri(
        Uri.Builder()
          .scheme(WavenPlaybackContract.SOURCE_SCHEME)
          .authority("queue")
          .appendPath(queueId)
          .build(),
      )
      .setRequestMetadata(MediaItem.RequestMetadata.Builder().build())
      .apply {
        source?.mimeType?.let { setMimeType(it) }
      }
      .build()
  }

  companion object {
    private val sourceLeases =
      ConcurrentHashMap<String, WavenPlaybackContract.SourceLease>()

    internal fun registerSource(
      queueId: String,
      source: WavenPlaybackContract.SourceLease,
    ) {
      sourceLeases[queueId] = source
    }

    internal fun unregisterSource(queueId: String) {
      sourceLeases.remove(queueId)
    }

    internal fun repeatModeName(mode: Int): String = when (mode) {
      Player.REPEAT_MODE_ONE -> "one"
      Player.REPEAT_MODE_ALL -> "all"
      else -> "off"
    }
  }
}
