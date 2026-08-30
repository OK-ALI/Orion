package com.okali.orion.playback

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.TextUtils
import android.view.Gravity
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.FileInputStream
import java.io.InputStream
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

data class OrionFinalizedPlayerProgress(
  val assetId: String,
  val state: String,
  val playing: Boolean,
  val positionMs: Long,
  val durationMs: Long,
  val presentation: String,
  val code: String? = null,
  val message: String? = null,
)

class OrionPlayerActivity : Activity(), TextureView.SurfaceTextureListener {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val resolver = Executors.newSingleThreadExecutor()
  private lateinit var textureView: TextureView
  private lateinit var titleView: TextView
  private lateinit var playPauseView: TextView
  private lateinit var positionView: TextView
  private lateinit var seekBar: SeekBar
  private lateinit var presentationView: TextView
  private lateinit var subtitleButton: TextView
  private lateinit var subtitleView: TextView
  private lateinit var chrome: View
  private lateinit var selectorOverlay: FrameLayout
  private var mediaPlayer: MediaPlayer? = null
  private var renderSurface: Surface? = null
  private var prepared = false
  private var completed = false
  private var released = false
  private var resumeAfterPause = false
  private var seekingByUser = false
  private var trackingSeekBar = false
  private var hostResumed = false
  private var playerGeneration = 0L
  private var seekGeneration = 0L
  private var pendingSeek: OrionMediaPlayerSeekPolicy.Request? = null
  private var seekConfirmationRunnable: Runnable? = null
  private var videoWidth = 0
  private var videoHeight = 0
  private var presentation = "fit"
  private var subtitleTracks: List<PreparedSubtitle> = emptyList()
  private var selectedSubtitleIndex = -1
  private var lastSubtitleText: String? = null
  private var requestedAssetId = ""
  private var accentColor = Color.rgb(229, 9, 20)
  private var onAccentColor = Color.WHITE
  private var contentTextColor = Color.rgb(244, 241, 246)
  private var secondaryTextColor = Color.rgb(181, 174, 186)
  private var chromeFillColor = 0xC7030308.toInt()
  private var controlFillColor = 0xD9191622.toInt()
  private var panelFillColor = Color.rgb(16, 14, 23)
  private var borderColor = 0x1AFFFFFF
  private var chromeTextColor = Color.WHITE
  private var reducedMotion = false
  private var safeInsetLeft = 0
  private var safeInsetTop = 0
  private var safeInsetRight = 0
  private var safeInsetBottom = 0
  private var buffering = false
  private var lastProgressPublishedAt = 0L

  private val progressTicker = object : Runnable {
    override fun run() {
      if (released || !prepared) return
      updateProgress()
      if (!released && prepared) mainHandler.postDelayed(this, 250L)
    }
  }

  private val hideChromeRunnable = Runnable { hideChrome() }
  private val seekTimeoutRunnable = Runnable { finishPendingSeekFromTimeout() }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    enterImmersiveMode()
    applyPresentationThemeFromIntent()
    buildUi()

    val assetId = intent.getStringExtra(EXTRA_ASSET_ID).orEmpty().trim()
    requestedAssetId = assetId
    val initialPositionMs = intent.getLongExtra(EXTRA_INITIAL_POSITION_MS, 0L).coerceAtLeast(0L)
    presentation = intent.getStringExtra(EXTRA_PRESENTATION).orEmpty().lowercase()
      .takeIf { it in setOf("fit", "fill", "stretch") } ?: "fit"
    titleView.text = intent.getStringExtra(EXTRA_TITLE).orEmpty().trim().ifBlank { "Orion Player" }
    updatePresentationLabel()

    if (!assetId.matches(Regex("^[A-Za-z0-9._:-]{1,140}$"))) {
      fail("orion-player-asset-invalid", "Offline download identity is invalid.")
      return
    }
    publishProgress("preparing", force = true)

    resolver.execute {
      val resolution = try {
        OrionDownloadArtifactManager.resolveFinalizedPlayerAsset(applicationContext, assetId)
      } catch (_: Throwable) {
        OrionOfflinePlayerResolution(
          stage = "asset-validation",
          code = "orion-player-asset-validation-failed",
          message = "Orion could not validate this finalized download.",
        )
      }
      val asset = resolution.asset
      if (asset == null) {
        runOnUiThread {
          fail(
            resolution.code ?: "orion-player-asset-invalid",
            resolution.message ?: "Orion could not open this finalized download.",
          )
        }
        return@execute
      }
      val preparedSubtitles = asset.subtitles.mapNotNull { prepareSubtitle(it) }
      runOnUiThread {
        if (released) return@runOnUiThread
        subtitleTracks = preparedSubtitles
        selectedSubtitleIndex = preparedSubtitles.indexOfFirst { it.isDefault }
        updateSubtitleButton()
        openPlayer(asset, initialPositionMs)
      }
    }
  }

  override fun onResume() {
    super.onResume()
    hostResumed = true
    enterImmersiveMode()
    val player = mediaPlayer
    if (prepared && pendingSeek == null && resumeAfterPause && player != null && !player.isPlaying) {
      try { player.start() } catch (_: Throwable) { Unit }
      resumeAfterPause = false
    }
    if (prepared) {
      publishProgress(currentPlaybackState(), force = true)
      showChrome()
    }
  }

  override fun onPause() {
    hostResumed = false
    val player = mediaPlayer
    val playing = prepared && try { player?.isPlaying == true } catch (_: Throwable) { false }
    resumeAfterPause = playing || pendingSeek?.playWhenSettled == true
    if (playing) {
      try { player?.pause() } catch (_: Throwable) { Unit }
    }
    if (prepared && !completed && !isFinishing) publishProgress("paused", force = true)
    if (::chrome.isInitialized) showChrome(autoHide = false)
    super.onPause()
  }

  override fun onDestroy() {
    released = true
    mainHandler.removeCallbacksAndMessages(null)
    resolver.shutdownNow()
    releasePlayer()
    super.onDestroy()
  }

  @Deprecated("Deprecated in Android")
  override fun onBackPressed() {
    if (::selectorOverlay.isInitialized && selectorOverlay.visibility == View.VISIBLE) {
      dismissChoicePanel()
      return
    }
    finishWithPlaybackResult()
  }

  override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
    renderSurface?.release()
    renderSurface = Surface(surfaceTexture)
    mediaPlayer?.setSurface(renderSurface)
    applyVideoTransform()
  }

  override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
    applyVideoTransform()
  }

  override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
    mediaPlayer?.setSurface(null)
    renderSurface?.release()
    renderSurface = null
    return true
  }

  override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) = Unit

  private fun openPlayer(asset: OrionOfflinePlayerAsset, initialPositionMs: Long) {
    releasePlayer()
    playerGeneration += 1L
    val player = MediaPlayer()
    mediaPlayer = player
    player.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
        .build(),
    )
    player.setOnPreparedListener {
      prepared = true
      val duration = safeDuration(it)
      val target = initialPositionMs.coerceIn(0L, max(0L, duration - 1L))
      mainHandler.removeCallbacks(progressTicker)
      mainHandler.post(progressTicker)
      if (target > 0L) {
        requestSeek(it, target, playWhenSettled = true)
      } else {
        it.start()
        playPauseView.text = "Pause"
        updateProgress()
        publishProgress("playing", force = true)
        showChrome()
      }
    }
    player.setOnSeekCompleteListener { completedPlayer -> handleSeekComplete(completedPlayer) }
    player.setOnCompletionListener {
      completed = true
      playPauseView.text = "Replay"
      updateProgress()
      publishProgress("ended", force = true)
      finishWithPlaybackResult()
    }
    player.setOnVideoSizeChangedListener { _, width, height ->
      videoWidth = width
      videoHeight = height
      applyVideoTransform()
    }
    player.setOnInfoListener { _, what, _ ->
      when (what) {
        MediaPlayer.MEDIA_INFO_BUFFERING_START -> {
          buffering = true
          publishProgress("buffering", force = true)
        }
        MediaPlayer.MEDIA_INFO_BUFFERING_END -> {
          buffering = false
          publishProgress(currentPlaybackState(), force = true)
        }
      }
      false
    }
    player.setOnErrorListener { _, what, extra ->
      prepared = false
      buffering = false
      mainHandler.removeCallbacks(progressTicker)
      fail("orion-player-media-error-$what-$extra", "Android could not play this verified MP4.")
      true
    }

    try {
      configureVerifiedDataSource(player, asset)
      renderSurface?.let(player::setSurface)
      player.prepareAsync()
    } catch (_: Throwable) {
      fail("orion-player-data-source-failed", "Orion could not open the verified media descriptor.")
    }
  }

  private fun configureVerifiedDataSource(player: MediaPlayer, asset: OrionOfflinePlayerAsset) {
    val document = asset.mediaDocument
    val file = asset.mediaFile
    when {
      document != null -> {
        val afd = contentResolver.openAssetFileDescriptor(document.uri, "r")
          ?: throw IllegalStateException("Verified media document could not be opened.")
        afd.use {
          val length = if (it.length > 0L) it.length else document.sizeBytes
          if (length <= 0L || length != document.sizeBytes) {
            throw IllegalStateException("Verified media length changed before playback.")
          }
          player.setDataSource(it.fileDescriptor, it.startOffset.coerceAtLeast(0L), length)
        }
      }
      file != null -> {
        if (!file.isFile || file.length() <= 0L) throw IllegalStateException("Verified media file is missing.")
        FileInputStream(file).use {
          player.setDataSource(it.fd, 0L, file.length())
        }
      }
      else -> throw IllegalStateException("Finalized media descriptor is missing.")
    }
  }

  private fun buildUi() {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.BLACK)
      isClickable = true
      setOnClickListener {
        if (::chrome.isInitialized && chrome.visibility == View.VISIBLE && chrome.alpha > 0.5f) {
          hideChrome()
        } else {
          showChrome()
        }
      }
    }

    textureView = TextureView(this).apply {
      surfaceTextureListener = this@OrionPlayerActivity
      isOpaque = true
    }
    root.addView(textureView, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
      Gravity.CENTER,
    ))

    val top = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(18), dp(12), dp(18), dp(12))
      setBackgroundColor(chromeFillColor)
    }
    val back = button("‹").apply {
      textSize = 34f
      contentDescription = "Back"
      setOnClickListener { finishWithPlaybackResult() }
    }
    titleView = TextView(this).apply {
      setTextColor(chromeTextColor)
      textSize = 16f
      setTypeface(typeface, Typeface.BOLD)
      setPadding(dp(12), 0, dp(12), 0)
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
    }
    val offlineBadge = TextView(this).apply {
      text = "ORION OFFLINE"
      setTextColor(onAccentColor)
      textSize = 10f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(dp(10), 0, dp(10), 0)
      background = roundedBackground(
        accentColor,
        accentColor,
        12,
      )
      contentDescription = "Orion offline playback"
    }
    top.addView(back, LinearLayout.LayoutParams(dp(48), dp(48)))
    top.addView(titleView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    top.addView(offlineBadge, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      dp(30),
    ))

    val bottom = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(8), dp(20), dp(14))
      setBackgroundColor(chromeFillColor)
    }
    seekBar = SeekBar(this).apply {
      max = 1000
      progressTintList = ColorStateList.valueOf(accentColor)
      thumbTintList = ColorStateList.valueOf(accentColor)
      progressBackgroundTintList = ColorStateList.valueOf(alphaColor(chromeTextColor, 85))
      secondaryProgressTintList = ColorStateList.valueOf(alphaColor(accentColor, 105))
      setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
        override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
          if (!fromUser) return
          val duration = safeDuration(mediaPlayer)
          positionView.text = "${formatTime(duration * progress / 1000L)} / ${formatTime(duration)}"
        }
        override fun onStartTrackingTouch(seekBar: SeekBar?) {
          trackingSeekBar = true
          seekingByUser = true
          showChrome(autoHide = false)
          publishProgress("seeking", force = true)
        }
        override fun onStopTrackingTouch(seekBar: SeekBar?) {
          trackingSeekBar = false
          val player = mediaPlayer ?: return
          val duration = safeDuration(player)
          val target = OrionMediaPlayerSeekPolicy.targetMs(duration, seekBar?.progress ?: 0)
          val wasPlaying = try { player.isPlaying } catch (_: Throwable) { false }
          requestSeek(player, target, playWhenSettled = wasPlaying)
        }
      })
    }
    bottom.addView(seekBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(38)))

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    playPauseView = button("Play", primary = true).apply {
      contentDescription = "Play or pause"
      setOnClickListener {
        val player = mediaPlayer ?: return@setOnClickListener
        if (!prepared) return@setOnClickListener
        if (togglePlaybackDuringPendingSeek(player)) return@setOnClickListener
        try {
          if (player.isPlaying) {
            player.pause()
            text = "Play"
            publishProgress("paused", force = true)
            showChrome(autoHide = false)
          } else {
            if (completed) {
              completed = false
              requestSeek(player, 0L, playWhenSettled = true)
              return@setOnClickListener
            }
            player.start()
            text = "Pause"
            publishProgress("playing", force = true)
            showChrome()
          }
        } catch (_: Throwable) { Unit }
      }
    }
    positionView = TextView(this).apply {
      setTextColor(chromeTextColor)
      textSize = 13f
      setTypeface(typeface, Typeface.BOLD)
      text = "0:00 / 0:00"
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(10), 0, dp(10), 0)
    }
    presentationView = button("Fit").apply {
      setOnClickListener { showPresentationSelector() }
    }
    subtitleButton = button("CC Off").apply {
      contentDescription = "Subtitles off"
      setOnClickListener {
        if (subtitleTracks.isEmpty()) return@setOnClickListener
        showSubtitleSelector()
      }
    }
    controls.addView(playPauseView, LinearLayout.LayoutParams(dp(96), dp(42)).apply {
      rightMargin = dp(8)
    })
    controls.addView(positionView, LinearLayout.LayoutParams(0, dp(42), 1f))
    controls.addView(presentationView, LinearLayout.LayoutParams(dp(82), dp(42)).apply {
      leftMargin = dp(8)
      rightMargin = dp(8)
    })
    controls.addView(subtitleButton, LinearLayout.LayoutParams(dp(76), dp(42)))
    bottom.addView(controls)

    subtitleView = TextView(this).apply {
      setTextColor(contentTextColor)
      textSize = 17f
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(6), dp(12), dp(6))
      background = roundedBackground(
        alphaColor(panelFillColor, 238),
        borderColor,
        10,
      )
      visibility = View.GONE
      maxLines = 4
    }
    root.addView(subtitleView, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
      Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
    ).apply { bottomMargin = dp(106); leftMargin = dp(24); rightMargin = dp(24) })

    chrome = FrameLayout(this).apply {
      addView(top, FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP,
      ))
      addView(bottom, FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM,
      ))
    }
    root.addView(chrome, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    ))

    selectorOverlay = FrameLayout(this).apply {
      visibility = View.GONE
      isClickable = true
      isFocusable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      setOnClickListener { dismissChoicePanel() }
    }
    root.addView(selectorOverlay, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    ))

    root.setOnApplyWindowInsetsListener { _, insets ->
      val resolvedInsets = resolveSafeInsets(insets)
      safeInsetLeft = resolvedInsets.left
      safeInsetTop = resolvedInsets.top
      safeInsetRight = resolvedInsets.right
      safeInsetBottom = resolvedInsets.bottom

      top.setPadding(
        dp(18) + safeInsetLeft,
        dp(12) + safeInsetTop,
        dp(18) + safeInsetRight,
        dp(12),
      )
      bottom.setPadding(
        dp(20) + safeInsetLeft,
        dp(8),
        dp(20) + safeInsetRight,
        dp(14) + safeInsetBottom,
      )
      (subtitleView.layoutParams as? FrameLayout.LayoutParams)?.let { params ->
        params.bottomMargin = dp(106) + safeInsetBottom
        params.leftMargin = dp(24) + safeInsetLeft
        params.rightMargin = dp(24) + safeInsetRight
        subtitleView.layoutParams = params
      }
      subtitleView.maxWidth = max(
        dp(220),
        resources.displayMetrics.widthPixels - safeInsetLeft - safeInsetRight - dp(96),
      )
      insets
    }

    setContentView(root)
    root.requestApplyInsets()
  }

  private fun updateProgress() {
    if (!prepared) return
    val player = mediaPlayer ?: return
    val actualPosition = safePosition(player)
    val position = OrionMediaPlayerSeekPolicy.displayPosition(actualPosition, pendingSeek?.targetMs)
    val duration = safeDuration(player)
    if (!trackingSeekBar && duration > 0L) {
      seekBar.progress = ((position.toDouble() / duration.toDouble()) * 1000.0).toInt().coerceIn(0, 1000)
      positionView.text = "${formatTime(position)} / ${formatTime(duration)}"
    }
    if (prepared) playPauseView.text = if (try { player.isPlaying } catch (_: Throwable) { false }) "Pause" else if (completed) "Replay" else "Play"
    // Subtitle timing remains tied to the decoder's confirmed position. Only
    // the seek/progress presentation is pinned to the requested target while
    // an OEM MediaPlayer is still settling an asynchronous seek.
    updateSubtitle(actualPosition)
    publishProgress(currentPlaybackState())
  }

  private fun togglePlaybackDuringPendingSeek(player: MediaPlayer): Boolean {
    val request = pendingSeek ?: return false
    val playWhenSettled = !request.playWhenSettled
    pendingSeek = OrionMediaPlayerSeekPolicy.withPlayIntent(request, playWhenSettled)
    resumeAfterPause = false
    if (!playWhenSettled) {
      try { if (player.isPlaying) player.pause() } catch (_: Throwable) { Unit }
    }
    playPauseView.text = if (playWhenSettled) "Pause" else "Play"
    publishProgress("seeking", force = true)
    showChrome(autoHide = false)
    return true
  }

  private fun requestSeek(player: MediaPlayer, targetMs: Long, playWhenSettled: Boolean) {
    if (!prepared || player !== mediaPlayer) return
    val duration = safeDuration(player)
    val boundedTarget = targetMs.coerceIn(0L, max(0L, duration - 1L))
    seekGeneration += 1L
    pendingSeek = OrionMediaPlayerSeekPolicy.Request(
      generation = seekGeneration,
      playerGeneration = playerGeneration,
      targetMs = boundedTarget,
      playWhenSettled = playWhenSettled,
    )
    seekingByUser = true
    completed = false
    updateProgress()
    issuePendingSeek(player)
  }

  private fun issuePendingSeek(player: MediaPlayer) {
    val request = pendingSeek ?: return
    cancelSeekConfirmation()
    mainHandler.removeCallbacks(seekTimeoutRunnable)
    try {
      if (OrionMediaPlayerSeekPolicy.mode(Build.VERSION.SDK_INT) == OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC) {
        player.seekTo(request.targetMs, MediaPlayer.SEEK_CLOSEST_SYNC)
      } else {
        player.seekTo(request.targetMs.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
      }
      publishProgress("seeking", force = true)
      mainHandler.postDelayed(seekTimeoutRunnable, OrionMediaPlayerSeekPolicy.SEEK_TIMEOUT_MS)
    } catch (_: Throwable) {
      finishPendingSeek(timedOut = true)
    }
  }

  private fun handleSeekComplete(player: MediaPlayer) {
    val request = pendingSeek ?: return
    if (player !== mediaPlayer || !OrionMediaPlayerSeekPolicy.acceptsCallback(request, playerGeneration)) return
    scheduleSeekConfirmation(player, request)
  }

  private fun scheduleSeekConfirmation(
    player: MediaPlayer,
    request: OrionMediaPlayerSeekPolicy.Request,
  ) {
    cancelSeekConfirmation()
    val expectedSeekGeneration = request.generation
    val expectedPlayerGeneration = request.playerGeneration
    val confirmation = Runnable {
      seekConfirmationRunnable = null
      val active = pendingSeek ?: return@Runnable
      if (
        active.generation != expectedSeekGeneration ||
        active.playerGeneration != expectedPlayerGeneration ||
        player !== mediaPlayer ||
        !OrionMediaPlayerSeekPolicy.acceptsCallback(active, playerGeneration)
      ) {
        return@Runnable
      }
      when (
        OrionMediaPlayerSeekPolicy.completion(
          active,
          safePosition(player),
          safeDuration(player),
        )
      ) {
        OrionMediaPlayerSeekPolicy.Completion.SETTLED -> finishPendingSeek(timedOut = false)
        OrionMediaPlayerSeekPolicy.Completion.REISSUE -> {
          pendingSeek = OrionMediaPlayerSeekPolicy.reissued(active)
          issuePendingSeek(player)
        }
        OrionMediaPlayerSeekPolicy.Completion.AWAIT_TIMEOUT ->
          scheduleSeekConfirmation(player, active)
      }
    }
    seekConfirmationRunnable = confirmation
    mainHandler.postDelayed(confirmation, OrionMediaPlayerSeekPolicy.SEEK_CONFIRMATION_DELAY_MS)
  }

  private fun cancelSeekConfirmation() {
    seekConfirmationRunnable?.let(mainHandler::removeCallbacks)
    seekConfirmationRunnable = null
  }

  private fun finishPendingSeekFromTimeout() {
    val request = pendingSeek ?: return
    val player = mediaPlayer
    val settled = player != null &&
      prepared &&
      OrionMediaPlayerSeekPolicy.completion(
        request,
        safePosition(player),
        safeDuration(player),
      ) == OrionMediaPlayerSeekPolicy.Completion.SETTLED
    finishPendingSeek(timedOut = !settled)
  }

  private fun finishPendingSeek(timedOut: Boolean) {
    val request = pendingSeek ?: return
    val player = mediaPlayer
    cancelSeekConfirmation()
    mainHandler.removeCallbacks(seekTimeoutRunnable)
    pendingSeek = null
    seekingByUser = trackingSeekBar
    if (player != null && prepared && request.playWhenSettled) {
      if (hostResumed) {
        try { if (!player.isPlaying) player.start() } catch (_: Throwable) { Unit }
        resumeAfterPause = false
      } else {
        resumeAfterPause = true
      }
    }
    updateProgress()
    publishProgress(currentPlaybackState(), force = true)
    if (timedOut) Toast.makeText(this, "Couldn’t seek to that time", Toast.LENGTH_SHORT).show()
    showChrome()
  }

  private fun currentPlaybackState(): String = when {
    completed -> "ended"
    buffering -> "buffering"
    !prepared -> "preparing"
    seekingByUser -> "seeking"
    try { mediaPlayer?.isPlaying == true } catch (_: Throwable) { false } -> "playing"
    else -> "paused"
  }

  private fun publishProgress(
    state: String,
    force: Boolean = false,
    code: String? = null,
    message: String? = null,
  ) {
    if (requestedAssetId.isBlank()) return
    val now = SystemClock.elapsedRealtime()
    if (!force && now - lastProgressPublishedAt < PROGRESS_EVENT_INTERVAL_MS) return
    lastProgressPublishedAt = now
    val player = mediaPlayer
    emitProgress(
      OrionFinalizedPlayerProgress(
        assetId = requestedAssetId,
        state = state,
        playing = state == "playing",
        positionMs = OrionMediaPlayerSeekPolicy.displayPosition(
          safePosition(player),
          pendingSeek?.targetMs,
        ),
        durationMs = safeDuration(player),
        presentation = presentation,
        code = code,
        message = message,
      ),
    )
  }

  private fun updateSubtitle(positionMs: Long) {
    val track = subtitleTracks.getOrNull(selectedSubtitleIndex)
    val text = track?.let { OrionPlayerSubtitleParser.activeCue(it.cues, positionMs)?.text }
    if (text == lastSubtitleText) return
    lastSubtitleText = text
    subtitleView.text = text.orEmpty()
    subtitleView.visibility = if (text.isNullOrBlank()) View.GONE else View.VISIBLE
  }

  private fun prepareSubtitle(subtitle: OrionOfflinePlayerSubtitle): PreparedSubtitle? {
    val content = try {
      when {
        subtitle.document != null -> contentResolver.openInputStream(subtitle.document.uri)?.use(::readBoundedText)
        subtitle.file != null -> subtitle.file.inputStream().use(::readBoundedText)
        else -> null
      }
    } catch (_: Throwable) { null } ?: return null
    if (content.isBlank()) return null
    val cues = OrionPlayerSubtitleParser.parse(subtitle.format, content)
    if (cues.isEmpty()) return null
    return PreparedSubtitle(subtitle.id, subtitle.label, subtitle.isDefault, cues)
  }

  private fun readBoundedText(stream: InputStream): String? {
    val reader = stream.bufferedReader(Charsets.UTF_8)
    val output = StringBuilder()
    val buffer = CharArray(8_192)
    while (true) {
      val count = reader.read(buffer)
      if (count < 0) break
      output.append(buffer, 0, count)
      if (output.length > MAX_SUBTITLE_CHARS) return null
    }
    return output.toString().takeIf { '\u0000' !in it }
  }

  private fun updateSubtitleButton() {
    subtitleButton.isEnabled = subtitleTracks.isNotEmpty()
    subtitleButton.alpha = if (subtitleTracks.isNotEmpty()) 1f else 0.45f
    val track = subtitleTracks.getOrNull(selectedSubtitleIndex)
    val friendly = track?.let { friendlySubtitleLabel(it.label, selectedSubtitleIndex) }
    subtitleButton.text = friendly?.let(::compactSubtitleLabel) ?: "CC Off"
    subtitleButton.contentDescription = friendly
      ?.let { "Subtitles: $it. Activate to choose a subtitle track." }
      ?: "Subtitles off"
  }

  private fun friendlySubtitleLabel(label: String, index: Int): String {
    val cleaned = label
      .trim()
      .substringAfterLast('/')
      .substringAfterLast('\\')
      .replace(Regex("\\.(vtt|srt|ass|ssa)$", RegexOption.IGNORE_CASE), "")
      .replace(Regex("[._-]+"), " ")
      .replace(Regex("\\s+"), " ")
      .trim()
    val normalized = cleaned.lowercase()
    val languages = listOf(
      Regex("(^|[^a-z])(english|eng|en)([^a-z]|$)") to "English",
      Regex("(^|[^a-z])(urdu|urd|ur)([^a-z]|$)") to "Urdu",
      Regex("(^|[^a-z])(arabic|ara|ar)([^a-z]|$)") to "Arabic",
      Regex("(^|[^a-z])(spanish|spa|es)([^a-z]|$)") to "Spanish",
      Regex("(^|[^a-z])(french|fra|fre|fr)([^a-z]|$)") to "French",
      Regex("(^|[^a-z])(german|deu|ger|de)([^a-z]|$)") to "German",
      Regex("(^|[^a-z])(italian|ita|it)([^a-z]|$)") to "Italian",
      Regex("(^|[^a-z])(portuguese|por|pt)([^a-z]|$)") to "Portuguese",
      Regex("(^|[^a-z])(hindi|hin|hi)([^a-z]|$)") to "Hindi",
      Regex("(^|[^a-z])(korean|kor|ko)([^a-z]|$)") to "Korean",
      Regex("(^|[^a-z])(japanese|jpn|ja)([^a-z]|$)") to "Japanese",
      Regex("(^|[^a-z])(chinese|zho|chi|zh)([^a-z]|$)") to "Chinese",
      Regex("(^|[^a-z])(turkish|tur|tr)([^a-z]|$)") to "Turkish",
      Regex("(^|[^a-z])(russian|rus|ru)([^a-z]|$)") to "Russian",
      Regex("(^|[^a-z])(persian|farsi|fas|per|fa)([^a-z]|$)") to "Persian",
    )
    languages.firstOrNull { (pattern, _) -> pattern.containsMatchIn(normalized) }
      ?.let { return it.second }
    if (cleaned.isBlank() || cleaned.length > 40 || cleaned.matches(Regex("^[A-Fa-f0-9]{8,}$"))) {
      return "Subtitle ${index + 1}"
    }
    return cleaned.split(' ')
      .filter { it.isNotBlank() }
      .joinToString(" ") { word ->
        word.replaceFirstChar { character ->
          if (character.isLowerCase()) character.titlecase() else character.toString()
        }
      }
      .take(40)
  }

  private fun compactSubtitleLabel(label: String): String {
    return when (label.lowercase()) {
      "english" -> "CC EN"
      "urdu" -> "CC UR"
      "arabic" -> "CC AR"
      "spanish" -> "CC ES"
      "french" -> "CC FR"
      "german" -> "CC DE"
      "italian" -> "CC IT"
      "portuguese" -> "CC PT"
      "hindi" -> "CC HI"
      "korean" -> "CC KO"
      "japanese" -> "CC JA"
      "chinese" -> "CC ZH"
      "turkish" -> "CC TR"
      "russian" -> "CC RU"
      "persian" -> "CC FA"
      else -> "CC"
    }
  }

  private fun applyVideoTransform() {
    if (!::textureView.isInitialized || textureView.width <= 0 || textureView.height <= 0 || videoWidth <= 0 || videoHeight <= 0) return
    val viewWidth = textureView.width.toFloat()
    val viewHeight = textureView.height.toFloat()
    val widthScale = viewWidth / videoWidth.toFloat()
    val heightScale = viewHeight / videoHeight.toFloat()
    val matrix = Matrix()
    if (presentation != "stretch") {
      val scale = if (presentation == "fill") max(widthScale, heightScale) else min(widthScale, heightScale)
      val scaledWidth = videoWidth * scale
      val scaledHeight = videoHeight * scale
      matrix.setScale(scaledWidth / viewWidth, scaledHeight / viewHeight, viewWidth / 2f, viewHeight / 2f)
    }
    textureView.setTransform(matrix)
  }

  private fun updatePresentationLabel() {
    val label = when (presentation) {
      "fill" -> "Fill"
      "stretch" -> "Stretch"
      else -> "Fit"
    }
    presentationView.text = label
    presentationView.contentDescription = "Video sizing: $label. Activate to choose a sizing mode."
  }

  private fun showPresentationSelector() {
    showChoicePanel(
      title = "Video sizing",
      detail = "Choose how the video fills the screen.",
      choices = listOf(
        "fit" to "Fit",
        "fill" to "Fill",
        "stretch" to "Stretch",
      ),
      selectedValue = presentation,
    ) { value ->
      if (value != presentation) {
        presentation = value
        updatePresentationLabel()
        applyVideoTransform()
        publishProgress(currentPlaybackState(), force = true)
        presentationView.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_SELECTED)
      }
    }
  }

  private fun showSubtitleSelector() {
    val choices = mutableListOf("-1" to "Off")
    subtitleTracks.forEachIndexed { index, track ->
      choices += index.toString() to friendlySubtitleLabel(track.label, index)
    }
    showChoicePanel(
      title = "Subtitles",
      detail = "Choose an available subtitle track.",
      choices = choices,
      selectedValue = selectedSubtitleIndex.toString(),
    ) { value ->
      val nextIndex = value.toIntOrNull()
        ?.takeIf { it in -1..subtitleTracks.lastIndex }
        ?: -1
      selectedSubtitleIndex = nextIndex
      lastSubtitleText = null
      subtitleView.visibility = View.GONE
      updateSubtitleButton()
      subtitleButton.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_SELECTED)
    }
  }

  @Suppress("DEPRECATION")
  private fun resolveSafeInsets(insets: WindowInsets): PlayerSafeInsets {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val modern = insets.getInsets(
        WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout(),
      )
      return PlayerSafeInsets(
        left = modern.left,
        top = modern.top,
        right = modern.right,
        bottom = modern.bottom,
      )
    }

    val cutout = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) insets.displayCutout else null
    return PlayerSafeInsets(
      left = max(insets.systemWindowInsetLeft, cutout?.safeInsetLeft ?: 0),
      top = max(insets.systemWindowInsetTop, cutout?.safeInsetTop ?: 0),
      right = max(insets.systemWindowInsetRight, cutout?.safeInsetRight ?: 0),
      bottom = max(insets.systemWindowInsetBottom, cutout?.safeInsetBottom ?: 0),
    )
  }

  private fun showChoicePanel(
    title: String,
    detail: String,
    choices: List<Pair<String, String>>,
    selectedValue: String,
    onSelect: (String) -> Unit,
  ) {
    if (!::selectorOverlay.isInitialized) return
    mainHandler.removeCallbacks(hideChromeRunnable)
    showChrome(autoHide = false)
    selectorOverlay.removeAllViews()
    selectorOverlay.setBackgroundColor(alphaColor(chromeFillColor, 205))
    selectorOverlay.visibility = View.VISIBLE

    val panel = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(16), dp(16), dp(16), dp(16))
      background = roundedBackground(panelFillColor, borderColor, 16)
      isClickable = true
      setOnClickListener { }
      contentDescription = "$title options"
    }
    val heading = TextView(this).apply {
      text = title
      setTextColor(contentTextColor)
      textSize = 17f
      setTypeface(typeface, Typeface.BOLD)
      setPadding(dp(4), 0, dp(4), dp(6))
    }
    panel.addView(heading, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ))
    val helper = TextView(this).apply {
      text = detail
      setTextColor(secondaryTextColor)
      textSize = 12f
      setPadding(dp(4), 0, dp(4), dp(4))
      maxLines = 2
    }
    panel.addView(helper, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ))

    val optionList = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }
    choices.forEach { (value, label) ->
      val selected = value == selectedValue
      val row = TextView(this).apply {
        text = if (selected) "$label  Selected" else label
        setTextColor(if (selected) onAccentColor else contentTextColor)
        textSize = 14f
        setTypeface(typeface, Typeface.BOLD)
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(14), 0, dp(14), 0)
        isClickable = true
        isFocusable = true
        isSelected = selected
        contentDescription = if (selected) "$label, selected" else label
        background = if (selected) {
          roundedBackground(accentColor, accentColor, 12)
        } else {
          roundedBackground(controlFillColor, borderColor, 12)
        }
        setOnClickListener {
          onSelect(value)
          dismissChoicePanel()
        }
      }
      optionList.addView(row, LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        dp(48),
      ).apply { topMargin = dp(8) })
    }
    val scroll = ScrollView(this).apply {
      isFillViewport = false
      isVerticalScrollBarEnabled = choices.size > 5
      addView(optionList, ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
      ))
    }
    panel.addView(scroll, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      0,
      1f,
    ))

    val availableHeight = max(
      dp(220),
      resources.displayMetrics.heightPixels - safeInsetTop - safeInsetBottom - dp(48),
    )
    val desiredHeight = dp(96 + choices.size * 56)
    val panelHeight = min(desiredHeight, min(dp(440), availableHeight))
    selectorOverlay.addView(panel, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      panelHeight,
      Gravity.CENTER,
    ).apply {
      leftMargin = dp(32) + safeInsetLeft
      rightMargin = dp(32) + safeInsetRight
      topMargin = safeInsetTop
      bottomMargin = safeInsetBottom
    })
    selectorOverlay.requestFocus()
  }

  private fun dismissChoicePanel() {
    if (!::selectorOverlay.isInitialized || selectorOverlay.visibility != View.VISIBLE) return
    selectorOverlay.visibility = View.GONE
    selectorOverlay.removeAllViews()
    showChrome()
  }

  private fun applyPresentationThemeFromIntent() {
    accentColor = parseRgbExtra(EXTRA_THEME_ACCENT, Color.rgb(229, 9, 20))
    onAccentColor = parseRgbExtra(EXTRA_THEME_ON_ACCENT, Color.WHITE)
    contentTextColor = parseRgbExtra(EXTRA_THEME_TEXT, Color.rgb(244, 241, 246))
    secondaryTextColor = parseRgbExtra(EXTRA_THEME_TEXT_SECONDARY, Color.rgb(181, 174, 186))
    chromeFillColor = parseArgbExtra(EXTRA_THEME_MEDIA_SCRIM, 0xC7030308.toInt())
    val surface = parseRgbExtra(EXTRA_THEME_SURFACE, Color.rgb(25, 22, 34))
    controlFillColor = alphaColor(surface, 224)
    panelFillColor = parseRgbExtra(EXTRA_THEME_ELEVATED, Color.rgb(16, 14, 23))
    borderColor = parseArgbExtra(EXTRA_THEME_BORDER, 0x1AFFFFFF)
    chromeTextColor = contrastTextColor(chromeFillColor)
    reducedMotion = intent.getBooleanExtra(EXTRA_REDUCED_MOTION, false)
  }

  private fun parseRgbExtra(key: String, fallback: Int): Int {
    val value = intent.getStringExtra(key).orEmpty().trim()
    return if (value.matches(Regex("^#[0-9A-Fa-f]{6}$"))) {
      try { Color.parseColor(value) } catch (_: Throwable) { fallback }
    } else {
      fallback
    }
  }

  private fun parseArgbExtra(key: String, fallback: Int): Int {
    val value = intent.getStringExtra(key).orEmpty().trim()
    return if (value.matches(Regex("^#[0-9A-Fa-f]{8}$"))) {
      try { Color.parseColor(value) } catch (_: Throwable) { fallback }
    } else {
      fallback
    }
  }

  private fun contrastTextColor(background: Int): Int {
    val red = Color.red(background) / 255.0
    val green = Color.green(background) / 255.0
    val blue = Color.blue(background) / 255.0
    fun linear(channel: Double): Double =
      if (channel <= 0.04045) channel / 12.92 else Math.pow((channel + 0.055) / 1.055, 2.4)
    val luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    return if (luminance > 0.45) Color.BLACK else Color.WHITE
  }

  private fun shouldAutoHideChrome(): Boolean {
    if (!prepared || seekingByUser) return false
    return try { mediaPlayer?.isPlaying == true } catch (_: Throwable) { false }
  }

  private fun showChrome(autoHide: Boolean = true) {
    mainHandler.removeCallbacks(hideChromeRunnable)
    if (!::chrome.isInitialized) return
    chrome.animate().cancel()
    chrome.visibility = View.VISIBLE
    if (reducedMotion) {
      chrome.alpha = 1f
    } else {
      chrome.animate()
        .alpha(1f)
        .setDuration(CHROME_FADE_MS)
        .start()
    }
    if (autoHide && shouldAutoHideChrome()) {
      mainHandler.postDelayed(hideChromeRunnable, CHROME_AUTO_HIDE_MS)
    }
  }

  private fun hideChrome() {
    mainHandler.removeCallbacks(hideChromeRunnable)
    if (!::chrome.isInitialized || !shouldAutoHideChrome()) return
    chrome.animate().cancel()
    if (reducedMotion) {
      chrome.alpha = 0f
      chrome.visibility = View.INVISIBLE
      return
    }
    chrome.animate()
      .alpha(0f)
      .setDuration(CHROME_FADE_MS)
      .withEndAction {
        if (::chrome.isInitialized && shouldAutoHideChrome() && chrome.alpha <= 0.01f) {
          chrome.visibility = View.INVISIBLE
        }
      }
      .start()
  }

  private fun alphaColor(color: Int, alpha: Int): Int =
    Color.argb(
      alpha.coerceIn(0, 255),
      Color.red(color),
      Color.green(color),
      Color.blue(color),
    )

  private fun roundedBackground(
    fillColor: Int,
    strokeColor: Int,
    radiusDp: Int,
  ): GradientDrawable = GradientDrawable().apply {
    cornerRadius = dp(radiusDp).toFloat()
    setColor(fillColor)
    setStroke(dp(1), strokeColor)
  }

  private fun button(label: String, primary: Boolean = false) = TextView(this).apply {
    text = label
    setTextColor(if (primary) onAccentColor else contentTextColor)
    textSize = 13f
    setTypeface(typeface, Typeface.BOLD)
    gravity = Gravity.CENTER
    isClickable = true
    isFocusable = true
    setPadding(dp(10), 0, dp(10), 0)
    background = if (primary) {
      roundedBackground(accentColor, accentColor, 12)
    } else {
      roundedBackground(
        controlFillColor,
        alphaColor(accentColor, 120),
        12,
      )
    }
  }

  private fun finishWithPlaybackResult() {
    val player = mediaPlayer
    publishProgress(if (completed) "ended" else "paused", force = true)
    val data = Intent()
      .putExtra(RESULT_POSITION_MS, safePosition(player))
      .putExtra(RESULT_DURATION_MS, safeDuration(player))
      .putExtra(RESULT_COMPLETED, completed)
      .putExtra(RESULT_PRESENTATION, presentation)
    setResult(RESULT_OK, data)
    finish()
  }

  private fun fail(code: String, message: String) {
    if (isFinishing || released) return
    publishProgress("failed", force = true, code = code, message = message)
    val data = Intent()
      .putExtra(RESULT_POSITION_MS, safePosition(mediaPlayer))
      .putExtra(RESULT_DURATION_MS, safeDuration(mediaPlayer))
      .putExtra(RESULT_COMPLETED, false)
      .putExtra(RESULT_PRESENTATION, presentation)
      .putExtra(RESULT_CODE, code.take(120))
      .putExtra(RESULT_MESSAGE, message.take(240))
    setResult(RESULT_CANCELED, data)
    finish()
  }

  private fun releasePlayer() {
    mainHandler.removeCallbacks(progressTicker)
    mainHandler.removeCallbacks(seekTimeoutRunnable)
    cancelSeekConfirmation()
    pendingSeek = null
    trackingSeekBar = false
    seekingByUser = false
    playerGeneration += 1L
    prepared = false
    try { mediaPlayer?.setSurface(null) } catch (_: Throwable) { Unit }
    try { mediaPlayer?.release() } catch (_: Throwable) { Unit }
    mediaPlayer = null
  }

  private fun safePosition(player: MediaPlayer?): Long {
    if (!prepared || player == null) return 0L
    return try {
      player.currentPosition.toLong().coerceAtLeast(0L)
    } catch (_: Throwable) { 0L }
  }

  private fun safeDuration(player: MediaPlayer?): Long {
    if (!prepared || player == null) return 0L
    return try {
      player.duration.toLong().coerceAtLeast(0L)
    } catch (_: Throwable) { 0L }
  }

  private fun enterImmersiveMode() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  }

  private fun formatTime(milliseconds: Long): String {
    val totalSeconds = (milliseconds.coerceAtLeast(0L) / 1_000L)
    val seconds = totalSeconds % 60L
    val minutes = (totalSeconds / 60L) % 60L
    val hours = totalSeconds / 3_600L
    return if (hours > 0L) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private data class PlayerSafeInsets(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
  )

  private data class PreparedSubtitle(
    val id: String,
    val label: String,
    val isDefault: Boolean,
    val cues: List<OrionPlayerSubtitleCue>,
  )

  companion object {
    const val EXTRA_ASSET_ID = "orion.player.assetId"
    const val EXTRA_INITIAL_POSITION_MS = "orion.player.initialPositionMs"
    const val EXTRA_TITLE = "orion.player.title"
    const val EXTRA_PRESENTATION = "orion.player.presentation"
    const val EXTRA_THEME_ACCENT = "orion.player.theme.accent"
    const val EXTRA_THEME_ON_ACCENT = "orion.player.theme.onAccent"
    const val EXTRA_THEME_TEXT = "orion.player.theme.text"
    const val EXTRA_THEME_TEXT_SECONDARY = "orion.player.theme.textSecondary"
    const val EXTRA_THEME_MEDIA_SCRIM = "orion.player.theme.mediaScrim"
    const val EXTRA_THEME_SURFACE = "orion.player.theme.surface"
    const val EXTRA_THEME_ELEVATED = "orion.player.theme.elevated"
    const val EXTRA_THEME_BORDER = "orion.player.theme.border"
    const val EXTRA_REDUCED_MOTION = "orion.player.theme.reducedMotion"

    const val RESULT_POSITION_MS = "orion.player.result.positionMs"
    const val RESULT_DURATION_MS = "orion.player.result.durationMs"
    const val RESULT_COMPLETED = "orion.player.result.completed"
    const val RESULT_PRESENTATION = "orion.player.result.presentation"
    const val RESULT_CODE = "orion.player.result.code"
    const val RESULT_MESSAGE = "orion.player.result.message"

    private const val MAX_SUBTITLE_CHARS = 10 * 1024 * 1024
    private const val PROGRESS_EVENT_INTERVAL_MS = 1_000L
    private const val CHROME_AUTO_HIDE_MS = 2_800L
    private const val CHROME_FADE_MS = 180L
    @Volatile private var progressListener: ((OrionFinalizedPlayerProgress) -> Unit)? = null

    fun setProgressListener(listener: ((OrionFinalizedPlayerProgress) -> Unit)?) {
      progressListener = listener
    }

    private fun emitProgress(progress: OrionFinalizedPlayerProgress) {
      progressListener?.invoke(progress)
    }

    fun createIntent(
      context: Context,
      assetId: String,
      initialPositionMs: Long,
      title: String,
      presentation: String,
      themeAccent: String,
      themeOnAccent: String,
      themeText: String,
      themeTextSecondary: String,
      themeMediaScrim: String,
      themeSurface: String,
      themeElevated: String,
      themeBorder: String,
      reducedMotion: Boolean,
    ): Intent = Intent(context, OrionPlayerActivity::class.java).apply {
      putExtra(EXTRA_ASSET_ID, assetId)
      putExtra(EXTRA_INITIAL_POSITION_MS, initialPositionMs.coerceAtLeast(0L))
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_PRESENTATION, presentation)
      putExtra(EXTRA_THEME_ACCENT, themeAccent)
      putExtra(EXTRA_THEME_ON_ACCENT, themeOnAccent)
      putExtra(EXTRA_THEME_TEXT, themeText)
      putExtra(EXTRA_THEME_TEXT_SECONDARY, themeTextSecondary)
      putExtra(EXTRA_THEME_MEDIA_SCRIM, themeMediaScrim)
      putExtra(EXTRA_THEME_SURFACE, themeSurface)
      putExtra(EXTRA_THEME_ELEVATED, themeElevated)
      putExtra(EXTRA_THEME_BORDER, themeBorder)
      putExtra(EXTRA_REDUCED_MOTION, reducedMotion)
    }
  }
}
