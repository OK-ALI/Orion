package com.okali.waven.playback

import android.content.ComponentName
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.annotations.ReactModule
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.Executor

@OptIn(UnstableApi::class)
@ReactModule(name = WavenPlaybackModule.NAME)
class WavenPlaybackModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), Player.Listener {
  private val mainExecutor: Executor =
    androidx.core.content.ContextCompat.getMainExecutor(reactContext)

  private var controllerFuture: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null
  private var listenerCount = 0

  override fun getName(): String = NAME

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
  }

  @ReactMethod
  fun replaceQueue(
    items: ReadableArray,
    startIndex: Double,
    startPositionMs: Double,
    playWhenReady: Boolean,
    promise: Promise,
  ) = withController(promise) { active ->
    val mediaItems = WavenPlaybackContract.queueItems(items)
    if (mediaItems.isEmpty()) {
      active.clearMediaItems()
      promise.resolve(snapshot(active))
      return@withController
    }

    val boundedIndex = startIndex.toInt().coerceIn(0, mediaItems.lastIndex)
    active.setMediaItems(
      mediaItems,
      boundedIndex,
      startPositionMs.toLong().coerceAtLeast(0L),
    )
    active.prepare()
    active.playWhenReady = playWhenReady
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun resolveQueueItem(
    queueId: String,
    source: ReadableMap,
    promise: Promise,
  ) = withController(promise) { active ->
    val index = (0 until active.mediaItemCount)
      .firstOrNull { active.getMediaItemAt(it).mediaId == queueId }

    if (index == null) {
      promise.reject(
        "WAVEN_QUEUE_ITEM_MISSING",
        "Queue item '$queueId' is not present.",
      )
      return@withController
    }

    val existing = active.getMediaItemAt(index)
    val lease = WavenPlaybackContract.resolvedSource(source)
    WavenPlaybackService.registerSource(queueId, lease)

    val headersBundle = Bundle().apply {
      lease.headers.forEach { (key, value) -> putString(key, value) }
    }
    val extras = Bundle(existing.requestMetadata.extras ?: Bundle()).apply {
      putString(WavenPlaybackContract.EXTRA_QUEUE_ID, queueId)
      putString(WavenPlaybackContract.EXTRA_SOURCE_URI, lease.uri.toString())
      putBundle(WavenPlaybackContract.EXTRA_SOURCE_HEADERS, headersBundle)
      putString(WavenPlaybackContract.EXTRA_SOURCE_MIME_TYPE, lease.mimeType)
      if (lease.expiresAtMs != null) {
        putLong(WavenPlaybackContract.EXTRA_SOURCE_EXPIRES_AT_MS, lease.expiresAtMs)
      } else {
        remove(WavenPlaybackContract.EXTRA_SOURCE_EXPIRES_AT_MS)
      }
    }

    val replacement = existing.buildUpon()
      .setRequestMetadata(
        MediaItem.RequestMetadata.Builder()
          .setExtras(extras)
          .build(),
      )
      .build()

    active.replaceMediaItem(index, replacement)
    if (index == active.currentMediaItemIndex && active.playerError != null) {
      active.prepare()
    }
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun play(promise: Promise) = withController(promise) { active ->
    active.prepare()
    active.play()
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun pause(promise: Promise) = withController(promise) { active ->
    active.pause()
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun next(promise: Promise) = withController(promise) { active ->
    active.seekToNextMediaItem()
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun previous(promise: Promise) = withController(promise) { active ->
    active.seekToPreviousMediaItem()
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun seekTo(positionMs: Double, promise: Promise) =
    withController(promise) { active ->
      active.seekTo(positionMs.toLong().coerceAtLeast(0L))
      promise.resolve(snapshot(active))
    }

  @ReactMethod
  fun setRepeatMode(mode: String, promise: Promise) =
    withController(promise) { active ->
      active.repeatMode = when (mode) {
        "one" -> Player.REPEAT_MODE_ONE
        "all" -> Player.REPEAT_MODE_ALL
        else -> Player.REPEAT_MODE_OFF
      }
      promise.resolve(snapshot(active))
    }

  @ReactMethod
  fun setShuffleEnabled(enabled: Boolean, promise: Promise) =
    withController(promise) { active ->
      active.shuffleModeEnabled = enabled
      promise.resolve(snapshot(active))
    }

  @ReactMethod
  fun getSnapshot(promise: Promise) = withController(promise) { active ->
    promise.resolve(snapshot(active))
  }

  @ReactMethod
  fun getRecoveryStateJson(promise: Promise) {
    try {
      promise.resolve(WavenPlaybackRecoveryStore(reactContext).readRawJson())
    } catch (error: Throwable) {
      promise.reject("WAVEN_RECOVERY_READ_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) = withController(promise) { active ->
    active.pause()
    active.clearMediaItems()
    active.stop()
    promise.resolve(snapshot(active))
  }

  override fun onEvents(player: Player, events: Player.Events) {
    emitSnapshot(player)
  }

  override fun onPlayerError(error: PlaybackException) {
    emitSnapshot(controller ?: return)
  }

  private fun withController(
    promise: Promise,
    block: (MediaController) -> Unit,
  ) {
    val active = controller
    if (active != null) {
      try {
        block(active)
      } catch (error: Throwable) {
        promise.reject("WAVEN_PLAYBACK_COMMAND_FAILED", error.message, error)
      }
      return
    }

    val existingFuture = controllerFuture
    if (existingFuture != null) {
      existingFuture.addListener(
        {
          try {
            block(existingFuture.get())
          } catch (error: Throwable) {
            promise.reject("WAVEN_PLAYBACK_CONNECT_FAILED", error.message, error)
          }
        },
        mainExecutor,
      )
      return
    }

    val token = SessionToken(
      reactContext,
      ComponentName(reactContext, WavenPlaybackService::class.java),
    )
    val future = MediaController.Builder(reactContext, token).buildAsync()
    controllerFuture = future

    future.addListener(
      {
        try {
          val built = future.get()
          controller = built
          built.addListener(this)
          block(built)
        } catch (error: Throwable) {
          controllerFuture = null
          promise.reject("WAVEN_PLAYBACK_CONNECT_FAILED", error.message, error)
        }
      },
      mainExecutor,
    )
  }

  private fun snapshot(player: Player): com.facebook.react.bridge.WritableMap {
    val queue = Arguments.createArray()
    for (index in 0 until player.mediaItemCount) {
      queue.pushString(player.getMediaItemAt(index).mediaId)
    }

    val currentQueueId =
      if (player.currentMediaItemIndex in 0 until player.mediaItemCount) {
        player.getMediaItemAt(player.currentMediaItemIndex).mediaId
      } else {
        null
      }

    val currentError = player.playerError
    val errorMap = currentError?.let { playbackError(player, it) }

    return Arguments.createMap().apply {
      putString("state", playbackState(player, currentError))
      putArray("queueIds", queue)
      putString("currentQueueId", currentQueueId)
      putInt("currentIndex", player.currentMediaItemIndex.coerceAtLeast(0))
      putDouble("positionMs", player.currentPosition.coerceAtLeast(0L).toDouble())
      val duration = player.duration
      if (duration == C.TIME_UNSET) {
        putNull("durationMs")
      } else {
        putDouble("durationMs", duration.coerceAtLeast(0L).toDouble())
      }
      putBoolean("playing", player.isPlaying)
      putBoolean("buffering", player.playbackState == Player.STATE_BUFFERING)
      putString("repeatMode", WavenPlaybackService.repeatModeName(player.repeatMode))
      putBoolean("shuffleEnabled", player.shuffleModeEnabled)
      if (errorMap == null) putNull("error") else putMap("error", errorMap)
    }
  }

  private fun playbackState(
    player: Player,
    error: PlaybackException?,
  ): String {
    if (error != null) return "error"
    if (player.isPlaying) return "playing"
    return when (player.playbackState) {
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> if (player.playWhenReady) "ready" else "paused"
      Player.STATE_ENDED -> "ended"
      else -> "idle"
    }
  }

  private fun playbackError(
    player: Player,
    error: PlaybackException,
  ): com.facebook.react.bridge.WritableMap {
    val messages = generateSequence(error as Throwable?) { it.cause }
      .mapNotNull { it.message }
      .toList()
    val message = messages.firstOrNull() ?: "Playback failed."
    val causeText = messages.joinToString(" | ")
    val queueId =
      if (player.currentMediaItemIndex in 0 until player.mediaItemCount) {
        player.getMediaItemAt(player.currentMediaItemIndex).mediaId
      } else {
        null
      }

    val code = when {
      causeText.contains("WAVEN_SOURCE_UNRESOLVED") -> "source-unresolved"
      causeText.contains("WAVEN_SOURCE_EXPIRED") -> "source-expired"
      causeText.contains("WAVEN_SOURCE_INVALID") -> "source-invalid"
      error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
        error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ||
        error.errorCode == PlaybackException.ERROR_CODE_TIMEOUT -> "network"
      error.errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS ||
        error.errorCode == PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE -> "http"
      error.errorCode == PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND -> "not-found"
      error.errorCode == PlaybackException.ERROR_CODE_IO_NO_PERMISSION ||
        error.errorCode == PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED ||
        error.errorCode == PlaybackException.ERROR_CODE_PERMISSION_DENIED -> "permission"
      error.errorCode == PlaybackException.ERROR_CODE_AUTHENTICATION_EXPIRED -> "authentication"
      error.errorCode == PlaybackException.ERROR_CODE_NOT_AVAILABLE_IN_REGION ||
        error.errorCode == PlaybackException.ERROR_CODE_PARENTAL_CONTROL_RESTRICTED ||
        error.errorCode == PlaybackException.ERROR_CODE_PREMIUM_ACCOUNT_REQUIRED -> "restricted"
      error.errorCode in PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED..
        PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED -> "format"
      error.errorCode in PlaybackException.ERROR_CODE_DECODER_INIT_FAILED..
        PlaybackException.ERROR_CODE_DECODING_RESOURCES_RECLAIMED -> "decoder"
      else -> "unknown"
    }

    val retryAction = when (code) {
      "source-unresolved", "source-expired" -> "resolve-source"
      "network", "http" -> "retry"
      "authentication" -> "reauthenticate"
      else -> "none"
    }

    return Arguments.createMap().apply {
      putString("code", code)
      putString("message", message)
      putString("queueId", queueId)
      putBoolean("recoverable", retryAction != "none")
      putString("retryAction", retryAction)
    }
  }

  private fun emitSnapshot(player: Player) {
    if (listenerCount <= 0 || !reactContext.hasActiveReactInstance()) return
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(WavenPlaybackContract.EVENT_NAME, snapshot(player))
    } catch (_: Throwable) {
      // System playback remains native-owned even when the JS observer is gone.
    }
  }

  companion object {
    const val NAME = "WavenPlayback"
  }

  override fun invalidate() {
    controller?.removeListener(this)
    controller?.release()
    controller = null
    controllerFuture?.cancel(true)
    controllerFuture = null
    super.invalidate()
  }
}
