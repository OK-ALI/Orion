package com.okali.orion.playback

import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.LayoutInflater
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
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
internal class OrionFinalizedPlayerView(
  private val reactContext: ThemedReactContext,
) : FrameLayout(reactContext), Player.Listener, AnalyticsListener, LifecycleEventListener,
  OrionFinalizedMediaSourceObserver, SurfaceHolder.Callback {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val resolver = Executors.newSingleThreadExecutor()
  private val generation = AtomicLong(0L)
  private val player = ExoPlayer.Builder(reactContext).build()
  private val playerView = inflatePlayerView().apply {
    useController = false
    setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
    setShutterBackgroundColor(Color.BLACK)
    setBackgroundColor(Color.BLACK)
    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    player = this@OrionFinalizedPlayerView.player
  }
  private val videoSurface = playerView.videoSurfaceView as? SurfaceView
  private var assetId: String? = null
  private var initialPositionMs = 0L
  private var preparedAsset: OrionOfflinePlayerAsset? = null
  private var evidence = OrionFinalizedPlayerEvidence()
  private var released = false
  private var lastState = "preparing"
  private var lastStage = "idle"
  private var lastErrorCategory: String? = null
  private var resumeAfterHostResume = false
  private var attachStartedAtMs = 0L
  private var prepareStartedAtMs = 0L
  private var firstFrameDeadlineStartedAtMs = 0L
  private var trackDeadlineStartedAtMs = 0L

  private val progressTicker = object : Runnable {
    override fun run() {
      if (released) return
      emitPlaybackState(lastState)
      mainHandler.postDelayed(this, 500L)
    }
  }

  private fun inflatePlayerView(): PlayerView {
    val resourceId = resources.getIdentifier("orion_finalized_player_view", "layout", reactContext.packageName)
    require(resourceId != 0) { "finalized-player-layout-missing" }
    return LayoutInflater.from(reactContext).inflate(resourceId, this, false) as PlayerView
  }

  init {
    setBackgroundColor(Color.BLACK)
    clipChildren = true
    clipToPadding = true
    addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    videoSurface?.apply {
      setZOrderOnTop(false)
      setZOrderMediaOverlay(false)
      holder.addCallback(this@OrionFinalizedPlayerView)
    }
    player.addListener(this)
    player.addAnalyticsListener(this)
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

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attachStartedAtMs = SystemClock.elapsedRealtime()
    evidence = evidence.copy(attached = true, viewWidth = width, viewHeight = height)
    stage("native-view-attached")
    scheduleLayoutDeadline(generation.get())
  }

  override fun onDetachedFromWindow() {
    resumeAfterHostResume = player.isPlaying
    player.pause()
    evidence = evidence.copy(attached = false)
    stage("native-view-detached")
    super.onDetachedFromWindow()
  }

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    evidence = evidence.copy(viewWidth = width, viewHeight = height)
    stage("native-view-size")
    maybeStartFirstFrameDeadline(generation.get())
  }

  override fun surfaceCreated(holder: SurfaceHolder) {
    val frame = holder.surfaceFrame
    evidence = evidence.copy(
      surfaceAvailable = holder.surface?.isValid == true,
      surfaceWidth = frame.width(),
      surfaceHeight = frame.height(),
    )
    stage("video-surface-created")
    maybeStartFirstFrameDeadline(generation.get())
  }

  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
    evidence = evidence.copy(
      surfaceAvailable = holder.surface?.isValid == true,
      surfaceWidth = width,
      surfaceHeight = height,
    )
    stage("video-surface-changed")
    maybeStartFirstFrameDeadline(generation.get())
  }

  override fun surfaceDestroyed(holder: SurfaceHolder) {
    evidence = evidence.copy(surfaceAvailable = false, surfaceWidth = 0, surfaceHeight = 0)
    stage("video-surface-destroyed")
  }

  private fun prepare() {
    val requestedAssetId = assetId
    val currentGeneration = generation.incrementAndGet()
    preparedAsset = null
    player.stop()
    player.clearMediaItems()
    lastState = "preparing"
    lastErrorCategory = null
    prepareStartedAtMs = SystemClock.elapsedRealtime()
    firstFrameDeadlineStartedAtMs = 0L
    trackDeadlineStartedAtMs = 0L
    evidence = OrionFinalizedPlayerPolicy.resetForRetry(
      evidence.copy(
        attached = isAttachedToWindow,
        viewWidth = width,
        viewHeight = height,
        surfaceAvailable = videoSurface?.holder?.surface?.isValid == true,
        surfaceWidth = videoSurface?.holder?.surfaceFrame?.width() ?: 0,
        surfaceHeight = videoSurface?.holder?.surfaceFrame?.height() ?: 0,
      ),
    )
    emitPlaybackState("preparing")
    stage("asset-validation")
    schedulePreparationDeadline(currentGeneration)
    scheduleLayoutDeadline(currentGeneration)
    if (requestedAssetId.isNullOrBlank()) {
      fail("asset-id", "finalized-asset-id-missing", "Finalized download identity is missing.", "authority")
      return
    }
    resolver.execute {
      val resolution = try {
        OrionDownloadArtifactManager.resolveFinalizedPlayerAsset(reactContext, requestedAssetId)
      } catch (_: Throwable) {
        OrionOfflinePlayerResolution(
          stage = "asset-validation",
          code = "finalized-asset-validation-failed",
          message = "Orion could not validate this finalized download.",
        )
      }
      reactContext.runOnUiQueueThread {
        if (!accepts(currentGeneration, requestedAssetId)) return@runOnUiQueueThread
        val asset = resolution.asset
        if (asset == null) {
          fail(
            resolution.stage,
            resolution.code ?: "finalized-asset-invalid",
            resolution.message ?: "Orion could not open this finalized download.",
            "authority",
          )
          return@runOnUiQueueThread
        }
        val build = try { OrionFinalizedMediaSourceFactory.build(reactContext, asset, this) } catch (_: Throwable) { null }
        if (build == null) {
          fail("media-source", "finalized-media-source-invalid", "Orion could not prepare this finalized download.", "source")
          return@runOnUiQueueThread
        }
        if (playerView.player !== player || videoSurface == null) {
          fail("video-surface", "finalized-player-surface-contract-invalid", "Orion could not attach the video surface.", "surface")
          return@runOnUiQueueThread
        }
        preparedAsset = asset
        stage("media-source-ready")
        emitSubtitleTracks()
        player.setMediaSource(build.mediaSource)
        player.prepare()
        if (initialPositionMs > 0L) player.seekTo(initialPositionMs)
        player.playWhenReady = true
        stage("player-preparing")
      }
    }
  }

  override fun onDescriptorOpened(role: String, position: Long, length: Long) {
    reactContext.runOnUiQueueThread {
      if (released) return@runOnUiQueueThread
      stage(if (role == "media") "media-descriptor-open" else "subtitle-descriptor-open")
    }
  }

  override fun onPlaybackStateChanged(playbackState: Int) {
    lastState = when (playbackState) {
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> if (player.isPlaying) "playing" else "ready"
      Player.STATE_ENDED -> "ended"
      else -> "preparing"
    }
    if (playbackState == Player.STATE_READY) {
      evidence = evidence.copy(playerReady = true)
      stage("player-ready")
      scheduleTrackDeadline(generation.get(), assetId)
      maybeStartFirstFrameDeadline(generation.get())
    }
    emitPlaybackState(lastState)
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    if (player.playbackState == Player.STATE_READY) lastState = if (isPlaying) "playing" else "paused"
    emitPlaybackState(lastState)
  }

  override fun onTracksChanged(tracks: Tracks) {
    evidence = evidence.copy(
      videoTrackCount = tracks.groups.count { it.type == C.TRACK_TYPE_VIDEO && it.isSupported },
      audioTrackCount = tracks.groups.count { it.type == C.TRACK_TYPE_AUDIO && it.isSupported },
    )
    stage("track-discovery")
    emitSubtitleTracks()
    maybeStartFirstFrameDeadline(generation.get())
  }

  override fun onVideoDecoderInitialized(
    eventTime: AnalyticsListener.EventTime,
    decoderName: String,
    initializationDurationMs: Long,
  ) {
    evidence = evidence.copy(videoDecoderInitialized = true)
    stage("video-decoder-initialized")
  }

  override fun onAudioDecoderInitialized(
    eventTime: AnalyticsListener.EventTime,
    decoderName: String,
    initializationDurationMs: Long,
  ) {
    evidence = evidence.copy(audioDecoderInitialized = true)
    stage("audio-decoder-initialized")
  }

  override fun onVideoSizeChanged(videoSize: VideoSize) {
    stage("video-size-discovered")
  }

  override fun onRenderedFirstFrame() {
    evidence = evidence.copy(firstFrameRendered = true)
    stage("first-frame-rendered")
    emitPlaybackState(lastState)
  }

  override fun onPlayerError(error: PlaybackException) {
    val category = when {
      error.errorCodeName.contains("DECOD", ignoreCase = true) -> "decoder"
      error.errorCodeName.contains("IO_", ignoreCase = true) || error.errorCodeName.contains("PARS", ignoreCase = true) -> "source"
      else -> "playback"
    }
    fail("media3-prepare", "finalized-media3-$category", "This finalized download could not be played.", category)
  }

  private fun maybeStartFirstFrameDeadline(expectedGeneration: Long) {
    if (!OrionFinalizedPlayerPolicy.readyForFirstFrameDeadline(evidence) || firstFrameDeadlineStartedAtMs > 0L) return
    firstFrameDeadlineStartedAtMs = SystemClock.elapsedRealtime()
    mainHandler.postDelayed({
      if (!accepts(expectedGeneration, assetId)) return@postDelayed
      OrionFinalizedPlayerPolicy.firstFrameDeadlineFailure(
        SystemClock.elapsedRealtime() - firstFrameDeadlineStartedAtMs,
        evidence,
      )?.let { fail(it.stage, it.code, it.message, it.category) }
    }, OrionFinalizedPlayerPolicy.FIRST_FRAME_TIMEOUT_MS)
  }

  private fun scheduleLayoutDeadline(expectedGeneration: Long) {
    if (attachStartedAtMs <= 0L) attachStartedAtMs = SystemClock.elapsedRealtime()
    mainHandler.postDelayed({
      if (!accepts(expectedGeneration, assetId)) return@postDelayed
      OrionFinalizedPlayerPolicy.layoutDeadlineFailure(
        SystemClock.elapsedRealtime() - attachStartedAtMs,
        evidence,
      )?.let { fail(it.stage, it.code, it.message, it.category) }
    }, OrionFinalizedPlayerPolicy.LAYOUT_TIMEOUT_MS)
  }

  private fun schedulePreparationDeadline(expectedGeneration: Long) {
    mainHandler.postDelayed({
      if (!accepts(expectedGeneration, assetId)) return@postDelayed
      OrionFinalizedPlayerPolicy.preparationDeadlineFailure(
        SystemClock.elapsedRealtime() - prepareStartedAtMs,
        evidence,
      )?.let { fail(it.stage, it.code, it.message, it.category) }
    }, OrionFinalizedPlayerPolicy.PREPARATION_TIMEOUT_MS)
  }

  private fun scheduleTrackDeadline(expectedGeneration: Long, requestedAssetId: String?) {
    if (trackDeadlineStartedAtMs > 0L) return
    trackDeadlineStartedAtMs = SystemClock.elapsedRealtime()
    mainHandler.postDelayed({
      if (!accepts(expectedGeneration, requestedAssetId)) return@postDelayed
      OrionFinalizedPlayerPolicy.trackDeadlineFailure(
        SystemClock.elapsedRealtime() - trackDeadlineStartedAtMs,
        evidence,
      )?.let { fail(it.stage, it.code, it.message, it.category) }
    }, OrionFinalizedPlayerPolicy.TRACK_DISCOVERY_TIMEOUT_MS)
  }

  private fun accepts(expectedGeneration: Long, requestedAssetId: String?): Boolean =
    !released && OrionFinalizedPlayerPolicy.acceptsGeneration(expectedGeneration, generation.get()) && assetId == requestedAssetId

  private fun fail(stage: String, code: String, message: String, category: String) {
    if (lastState == "failed") return
    lastState = "failed"
    lastErrorCategory = category.take(80)
    player.pause()
    diagnostic(stage, category)
    emitPlaybackState("failed", code, message, stage)
  }

  override fun onHostResume() {
    if (OrionFinalizedPlayerPolicy.shouldResumeAfterHostResume(resumeAfterHostResume, released)) player.play()
    resumeAfterHostResume = false
  }

  override fun onHostPause() {
    resumeAfterHostResume = player.isPlaying
    player.pause()
  }

  override fun onHostDestroy() = release()

  private fun stage(next: String) {
    lastStage = next.take(80)
    diagnostic(lastStage, null)
    emitPlaybackState(lastState, stage = lastStage)
  }

  private fun diagnostic(stage: String, category: String?) {
    val payload = JSONObject()
      .put("stage", stage.take(80))
      .put("category", category?.take(80) ?: JSONObject.NULL)
      .put("viewWidth", evidence.viewWidth)
      .put("viewHeight", evidence.viewHeight)
      .put("surfaceAvailable", evidence.surfaceAvailable)
      .put("surfaceWidth", evidence.surfaceWidth)
      .put("surfaceHeight", evidence.surfaceHeight)
      .put("videoTrackCount", evidence.videoTrackCount)
      .put("audioTrackCount", evidence.audioTrackCount)
      .put("videoDecoderInitialized", evidence.videoDecoderInitialized)
      .put("audioDecoderInitialized", evidence.audioDecoderInitialized)
      .put("firstFrameRendered", evidence.firstFrameRendered)
    Log.i("OrionFinalizedPlayer", payload.toString())
  }

  private fun emitPlaybackState(
    state: String,
    code: String? = null,
    message: String? = null,
    stage: String? = null,
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
      putString("stage", (stage ?: lastStage).take(80))
      if (lastErrorCategory != null) putString("errorCategory", lastErrorCategory) else putNull("errorCategory")
      putInt("viewWidth", evidence.viewWidth)
      putInt("viewHeight", evidence.viewHeight)
      putBoolean("surfaceAvailable", evidence.surfaceAvailable)
      putInt("surfaceWidth", evidence.surfaceWidth)
      putInt("surfaceHeight", evidence.surfaceHeight)
      putInt("videoTrackCount", evidence.videoTrackCount)
      putInt("audioTrackCount", evidence.audioTrackCount)
      putBoolean("videoDecoderInitialized", evidence.videoDecoderInitialized)
      putBoolean("audioDecoderInitialized", evidence.audioDecoderInitialized)
      putBoolean("firstFrameRendered", evidence.firstFrameRendered)
    }
    emit("topOrionFinalizedPlaybackState", map)
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
    emit("topOrionFinalizedSubtitleTracks", map)
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
    mainHandler.removeCallbacksAndMessages(null)
    resolver.shutdownNow()
    reactContext.removeLifecycleEventListener(this)
    videoSurface?.holder?.removeCallback(this)
    player.removeAnalyticsListener(this)
    player.removeListener(this)
    playerView.player = null
    player.release()
  }
}
