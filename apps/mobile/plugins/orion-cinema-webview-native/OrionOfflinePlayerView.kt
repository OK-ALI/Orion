package com.okali.orion.playback

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import org.json.JSONObject

@OptIn(UnstableApi::class)
internal class OrionOfflinePlayerView(
  private val reactContext: ThemedReactContext,
) : FrameLayout(reactContext), Player.Listener, LifecycleEventListener {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val resolver = Executors.newSingleThreadExecutor()
  private val generation = AtomicLong(0L)
  private val player = ExoPlayer.Builder(reactContext).build()
  private val playerView = PlayerView(reactContext).apply {
    useController = false
    setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    player = this@OrionOfflinePlayerView.player
  }
  private var assetId: String? = null
  private var initialPositionMs = 0L
  private var preparedAsset: OrionOfflinePlayerAsset? = null
  private var released = false
  private var lastState = "preparing"
  private var lastErrorCategory: String? = null

  private val progressTicker = object : Runnable {
    override fun run() {
      if (released) return
      emitPlaybackState(lastState)
      mainHandler.postDelayed(this, 500L)
    }
  }

  init {
    addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    player.addListener(this)
    reactContext.addLifecycleEventListener(this)
    mainHandler.post(progressTicker)
  }

  fun setAssetId(next: String?) {
    val clean = next?.trim()?.takeIf { it.isNotEmpty() }
    if (clean == assetId) return
    assetId = clean
    prepare()
  }

  fun setInitialPositionSeconds(seconds: Double) {
    initialPositionMs = (seconds.coerceAtLeast(0.0) * 1_000.0).toLong()
    if (player.playbackState == Player.STATE_READY && initialPositionMs > 0L) player.seekTo(initialPositionMs)
  }

  fun setPresentation(mode: String?) {
    playerView.resizeMode = when (mode) {
      "fill" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
      "stretch" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
      else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
    }
  }

  fun play() {
    if (player.playerError != null || player.playbackState == Player.STATE_IDLE) prepare() else player.play()
  }

  fun pause() = player.pause()

  fun seekTo(seconds: Double) {
    if (seconds.isFinite()) player.seekTo((seconds.coerceAtLeast(0.0) * 1_000.0).toLong())
  }

  fun retry() = prepare()

  fun selectSubtitle(id: String?) {
    val builder = player.trackSelectionParameters.buildUpon()
      .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, id.isNullOrBlank())
      .clearOverridesOfType(C.TRACK_TYPE_TEXT)
    if (!id.isNullOrBlank()) {
      var selected: TrackSelectionOverride? = null
      outer@ for (group in player.currentTracks.groups) {
        if (group.type != C.TRACK_TYPE_TEXT) continue
        for (trackIndex in 0 until group.length) {
          if (group.getTrackFormat(trackIndex).id == id) {
            selected = TrackSelectionOverride(group.mediaTrackGroup, trackIndex)
            break@outer
          }
        }
      }
      if (selected != null) builder.setOverrideForType(selected)
    }
    player.trackSelectionParameters = builder.build()
    emitSubtitleTracks()
  }

  private fun prepare() {
    val requestedAssetId = assetId
    val currentGeneration = generation.incrementAndGet()
    preparedAsset = null
    player.stop()
    player.clearMediaItems()
    lastState = "preparing"
    lastErrorCategory = null
    emitPlaybackState("preparing")
    diagnostic("asset-validation", null, null)
    if (requestedAssetId.isNullOrBlank()) {
      fail("asset-id", "offline-asset-id-missing", "Offline download identity is missing.", null)
      return
    }
    resolver.execute {
      val resolution = try {
        OrionDownloadArtifactManager.resolveOfflinePlayerAsset(reactContext, requestedAssetId)
      } catch (_: Throwable) {
        OrionOfflinePlayerResolution(
          stage = "asset-validation",
          code = "offline-asset-validation-failed",
          message = "Orion could not validate this offline download.",
        )
      }
      reactContext.runOnUiQueueThread {
        if (released || generation.get() != currentGeneration || assetId != requestedAssetId) return@runOnUiQueueThread
        val asset = resolution.asset
        if (asset == null) {
          fail(resolution.stage, resolution.code ?: "offline-asset-invalid", resolution.message ?: "Orion could not open this offline download.", resolution.failedFragmentIndex)
          return@runOnUiQueueThread
        }
        val build = try { OrionOfflineMediaSourceFactory.build(reactContext, asset) } catch (_: Throwable) { null }
        if (build == null) {
          fail("media-source", "offline-media-source-invalid", "Orion could not prepare this offline download.", null)
          return@runOnUiQueueThread
        }
        preparedAsset = asset
        diagnostic("media-source-ready", null, null)
        emitSubtitleTracks()
        player.setMediaSource(build.mediaSource)
        player.prepare()
        if (initialPositionMs > 0L) player.seekTo(initialPositionMs)
        player.playWhenReady = true
      }
    }
  }

  override fun onPlaybackStateChanged(playbackState: Int) {
    lastState = when (playbackState) {
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> if (player.isPlaying) "playing" else "ready"
      Player.STATE_ENDED -> "ended"
      else -> "preparing"
    }
    emitPlaybackState(lastState)
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    if (player.playbackState == Player.STATE_READY) lastState = if (isPlaying) "playing" else "paused"
    emitPlaybackState(lastState)
  }

  override fun onTracksChanged(tracks: Tracks) = emitSubtitleTracks()

  override fun onPlayerError(error: PlaybackException) {
    val category = when {
      error.errorCodeName.contains("DECOD", ignoreCase = true) -> "decoder"
      error.errorCodeName.contains("IO_", ignoreCase = true) || error.errorCodeName.contains("PARS", ignoreCase = true) -> "source"
      else -> "playback"
    }
    fail(
      "media3-prepare",
      "offline-media3-$category",
      "This offline download could not be played.",
      fragmentIndexFrom(error),
      category,
    )
  }

  private fun fragmentIndexFrom(error: Throwable): Int? {
    var current: Throwable? = error
    val pattern = Regex("offline-fragment-(?:unavailable|short-read):(\\d+)")
    repeat(6) {
      val match = pattern.find(current?.message.orEmpty())
      if (match != null) return match.groupValues[1].toIntOrNull()
      current = current?.cause
    }
    return null
  }

  private fun fail(
    stage: String,
    code: String,
    message: String,
    fragmentIndex: Int?,
    category: String = code,
  ) {
    lastState = "failed"
    lastErrorCategory = category.take(80)
    diagnostic(stage, category, fragmentIndex)
    emitPlaybackState("failed", code, message, stage, fragmentIndex)
  }

  override fun onHostResume() = Unit

  override fun onHostPause() {
    player.pause()
  }

  override fun onHostDestroy() {
    release()
  }

  private fun diagnostic(stage: String, category: String?, fragmentIndex: Int?) {
    val asset = preparedAsset
    val payload = JSONObject()
      .put("stage", stage.take(80))
      .put("sourceKind", asset?.sourceKind ?: JSONObject.NULL)
      .put("videoRoleCount", asset?.videoParts?.size ?: 0)
      .put("audioRoleCount", asset?.audioParts?.size ?: 0)
      .put("fragmentCount", asset?.fragmentCount ?: 0)
      .put("failedFragmentIndex", fragmentIndex ?: JSONObject.NULL)
      .put("category", category?.take(80) ?: JSONObject.NULL)
    Log.i("OrionOfflinePlayer", payload.toString())
  }

  private fun emitPlaybackState(
    state: String,
    code: String? = null,
    message: String? = null,
    stage: String? = null,
    fragmentIndex: Int? = null,
  ) {
    if (id == NO_ID) return
    val duration = player.duration.takeIf { it != C.TIME_UNSET && it >= 0L }
    val map = Arguments.createMap().apply {
      putString("state", state)
      putBoolean("playing", player.isPlaying)
      putDouble("positionSeconds", player.currentPosition.coerceAtLeast(0L).toDouble() / 1_000.0)
      if (duration != null) putDouble("durationSeconds", duration.toDouble() / 1_000.0) else putNull("durationSeconds")
      putDouble("bufferedPositionSeconds", player.bufferedPosition.coerceAtLeast(0L).toDouble() / 1_000.0)
      if (code != null) putString("code", code.take(100)) else putNull("code")
      if (message != null) putString("message", message.take(240)) else putNull("message")
      if (stage != null) putString("stage", stage.take(80)) else putNull("stage")
      if (fragmentIndex != null) putInt("failedFragmentIndex", fragmentIndex) else putNull("failedFragmentIndex")
      if (lastErrorCategory != null) putString("errorCategory", lastErrorCategory) else putNull("errorCategory")
    }
    emit("topOrionOfflinePlaybackState", map)
  }

  private fun emitSubtitleTracks() {
    if (id == NO_ID) return
    val tracks: WritableArray = Arguments.createArray()
    for (subtitle in preparedAsset?.subtitles.orEmpty()) {
      tracks.pushMap(Arguments.createMap().apply {
        putString("id", subtitle.id)
        putString("language", subtitle.language)
        putString("label", subtitle.label)
        putBoolean("selected", isSubtitleSelected(subtitle.id))
      })
    }
    val map: WritableMap = Arguments.createMap().apply { putArray("tracks", tracks) }
    emit("topOrionOfflineSubtitleTracks", map)
  }

  private fun isSubtitleSelected(id: String): Boolean = player.currentTracks.groups.any { group ->
    group.type == C.TRACK_TYPE_TEXT && (0 until group.length).any { index ->
      group.isTrackSelected(index) && group.getTrackFormat(index).id == id
    }
  }

  private fun emit(name: String, payload: WritableMap) {
    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, name, payload)
  }

  fun release() {
    if (released) return
    released = true
    generation.incrementAndGet()
    mainHandler.removeCallbacks(progressTicker)
    resolver.shutdownNow()
    reactContext.removeLifecycleEventListener(this)
    player.removeListener(this)
    player.release()
    playerView.player = null
  }
}
