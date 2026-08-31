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
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.SeekBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.FileInputStream
import java.io.InputStream
import java.util.concurrent.Executors
import kotlin.math.abs
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
  private lateinit var rewindView: TextView
  private lateinit var playPauseView: TextView
  private lateinit var forwardView: TextView
  private lateinit var positionView: TextView
  private lateinit var seekBar: SeekBar
  private lateinit var speedView: TextView
  private lateinit var audioView: TextView
  private lateinit var presentationView: TextView
  private lateinit var subtitleButton: TextView
  private lateinit var lockView: TextView
  private lateinit var unlockView: TextView
  private lateinit var subtitleView: TextView
  private lateinit var seekPreviewView: TextView
  private lateinit var gestureFeedbackView: TextView
  private lateinit var playbackStatusOverlay: LinearLayout
  private lateinit var playbackStatusSpinner: ProgressBar
  private lateinit var playbackStatusText: TextView
  private lateinit var audioManager: AudioManager
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
  private var issuedSeek: OrionMediaPlayerSeekPolicy.IssuedAttempt? = null
  private var seekObservation: OrionMediaPlayerSeekPolicy.Observation? = null
  private var seekObservationRunnable: Runnable? = null
  private var surfaceFrameGeneration = 0L
  private var videoWidth = 0
  private var videoHeight = 0
  private var presentation = "fit"
  private var playbackSpeed = 1.0f
  private var audioTracks: List<EmbeddedAudioTrack> = emptyList()
  private var selectedAudioTrackIndex = -1
  private var controlsLocked = false
  private var verticalGestureMode: String? = null
  private var gestureStartBrightness = 0.5f
  private var gestureStartVolume = 0
  private var subtitleTracks: List<PreparedSubtitle> = emptyList()
  private var selectedSubtitleIndex = -1
  private var subtitleTextSize = "medium"
  private var subtitleBackground = "medium"
  private var subtitlePosition = "standard"
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
  private var chromeControlsVisible = true
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
  private val hideUnlockRunnable = Runnable { hideUnlockAffordance() }
  private val hideGestureFeedbackRunnable = Runnable { hideGestureFeedback() }
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
    if (controlsLocked) {
      setControlsLocked(false)
      return
    }
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

  override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {
    if (surfaceFrameGeneration < Long.MAX_VALUE) surfaceFrameGeneration += 1L
  }

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
      refreshAudioTracks(it)
      val duration = safeDuration(it)
      val target = initialPositionMs.coerceIn(0L, max(0L, duration - 1L))
      mainHandler.removeCallbacks(progressTicker)
      mainHandler.post(progressTicker)
      if (playbackSpeed != 1.0f) applyPlaybackSpeed(it, playbackSpeed)
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
          updatePlaybackStatus()
          publishProgress("buffering", force = true)
        }
        MediaPlayer.MEDIA_INFO_BUFFERING_END -> {
          buffering = false
          updatePlaybackStatus()
          publishProgress(currentPlaybackState(), force = true)
        }
      }
      false
    }
    player.setOnErrorListener { _, what, extra ->
      prepared = false
      buffering = false
      hidePlaybackStatus()
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
    audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.BLACK)
      isClickable = true
      setOnClickListener {
        if (controlsLocked) {
          showUnlockAffordance()
          return@setOnClickListener
        }
        if (::chrome.isInitialized && chrome.visibility == View.VISIBLE && chrome.alpha > 0.5f) {
          hideChrome()
        } else {
          showChrome()
        }
      }
    }
    val tapGestureDetector = GestureDetector(
      this,
      object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(event: MotionEvent): Boolean {
          verticalGestureMode = null
          gestureStartBrightness = currentWindowBrightness()
          gestureStartVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
          return true
        }

        override fun onSingleTapConfirmed(event: MotionEvent): Boolean {
          root.performClick()
          return true
        }

        override fun onScroll(
          downEvent: MotionEvent?,
          event: MotionEvent,
          distanceX: Float,
          distanceY: Float,
        ): Boolean {
          if (controlsLocked) {
            showUnlockAffordance()
            return true
          }
          val start = downEvent ?: return false
          val totalX = event.x - start.x
          val totalY = event.y - start.y
          if (verticalGestureMode == null) {
            if (abs(totalY) < dp(VERTICAL_GESTURE_START_DP).toFloat()) return false
            if (abs(totalY) <= abs(totalX) * 1.15f) return false
            verticalGestureMode = if (start.x < root.width / 2f) "brightness" else "volume"
          }
          val verticalFraction = ((start.y - event.y) / max(1, root.height).toFloat()) * 1.15f
          when (verticalGestureMode) {
            "brightness" -> applyBrightnessGesture(verticalFraction)
            "volume" -> applyVolumeGesture(verticalFraction)
          }
          return true
        }

        override fun onDoubleTap(event: MotionEvent): Boolean {
          if (controlsLocked) {
            showUnlockAffordance()
            return true
          }
          val player = mediaPlayer ?: return true
          if (!prepared) return true
          val offsetMs = if (event.x < root.width / 2f) -DOUBLE_TAP_SEEK_MS else DOUBLE_TAP_SEEK_MS
          seekByOffset(player, offsetMs)
          return true
        }
      },
    )
    root.setOnTouchListener { _, event -> tapGestureDetector.onTouchEvent(event) }

    textureView = TextureView(this).apply {
      surfaceTextureListener = this@OrionPlayerActivity
      isOpaque = true
    }
    root.addView(textureView, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
      Gravity.CENTER,
    ))

    // Keep the decoded TextureView pristine. The cinematic chrome uses only
    // translucent gradient scrims so Android 9 and newer devices share one
    // safe presentation path without frame capture or video-surface effects.
    val top = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16), dp(10), dp(16), dp(18))
      background = cinematicChromeScrim(top = true)
    }
    val back = button("‹").apply {
      textSize = 30f
      setPadding(0, 0, 0, dp(2))
      background = roundedBackground(
        alphaColor(panelFillColor, 104),
        alphaColor(contentTextColor, 38),
        14,
      )
      contentDescription = "Back"
      setOnClickListener { finishWithPlaybackResult() }
    }
    titleView = TextView(this).apply {
      setTextColor(chromeTextColor)
      textSize = 15.5f
      setTypeface(typeface, Typeface.BOLD)
      setPadding(dp(10), 0, dp(10), 0)
      setShadowLayer(4f, 0f, 1f, alphaColor(Color.BLACK, 220))
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
    }
    val offlineBadge = TextView(this).apply {
      text = "ORION OFFLINE"
      setTextColor(alphaColor(accentColor, 232))
      textSize = 9f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(dp(9), 0, dp(9), 0)
      background = roundedBackground(
        alphaColor(panelFillColor, 112),
        alphaColor(accentColor, 92),
        14,
      )
      elevation = dp(1).toFloat()
      contentDescription = "Orion offline playback"
    }
    top.addView(back, LinearLayout.LayoutParams(dp(44), dp(44)))
    top.addView(titleView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    top.addView(offlineBadge, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      dp(28),
    ))

    val bottom = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(18), dp(4), dp(18), dp(12))
      background = cinematicChromeScrim(top = false)
    }
    seekPreviewView = TextView(this).apply {
      setTextColor(contentTextColor)
      textSize = 12f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(dp(10), dp(5), dp(10), dp(5))
      background = roundedBackground(
        alphaColor(panelFillColor, 196),
        alphaColor(contentTextColor, 42),
        12,
      )
      visibility = View.GONE
      elevation = dp(3).toFloat()
      contentDescription = "Seek preview"
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
          val target = duration * progress / 1000L
          positionView.text = "${formatTime(target)} / ${formatTime(duration)}"
          showSeekPreview(progress, target)
        }
        override fun onStartTrackingTouch(seekBar: SeekBar?) {
          trackingSeekBar = true
          seekingByUser = true
          val duration = safeDuration(mediaPlayer)
          val progress = seekBar?.progress ?: 0
          showSeekPreview(progress, duration * progress / 1000L)
          showChrome(autoHide = false)
          publishProgress("seeking", force = true)
        }
        override fun onStopTrackingTouch(seekBar: SeekBar?) {
          trackingSeekBar = false
          hideSeekPreview()
          val player = mediaPlayer ?: return
          val duration = safeDuration(player)
          val target = OrionMediaPlayerSeekPolicy.targetMs(duration, seekBar?.progress ?: 0)
          val playWhenSettled = pendingSeek?.playWhenSettled
            ?: try { player.isPlaying } catch (_: Throwable) { false }
          requestSeek(player, target, playWhenSettled = playWhenSettled)
        }
      })
    }
    bottom.addView(seekBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(38)))

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(0, dp(2), 0, dp(4))
    }
    rewindView = button("↶ 10").apply {
      textSize = 14f
      contentDescription = "Rewind 10 seconds"
      setOnClickListener {
        val player = mediaPlayer ?: return@setOnClickListener
        if (!prepared) return@setOnClickListener
        seekByOffset(player, -TRANSPORT_SEEK_MS)
      }
    }
    playPauseView = button("Play", primary = true).apply {
      textSize = 14f
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
      textSize = 12.5f
      setTypeface(typeface, Typeface.BOLD)
      text = "0:00 / 0:00"
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(2), 0, dp(10), 0)
      setShadowLayer(4f, 0f, 1f, alphaColor(Color.BLACK, 220))
    }
    forwardView = button("10 ↷").apply {
      textSize = 14f
      contentDescription = "Forward 10 seconds"
      setOnClickListener {
        val player = mediaPlayer ?: return@setOnClickListener
        if (!prepared) return@setOnClickListener
        seekByOffset(player, TRANSPORT_SEEK_MS)
      }
    }
    speedView = button("1×").apply {
      contentDescription = "Playback speed: 1 times"
      isEnabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
      alpha = if (isEnabled) 1f else 0.45f
      setOnClickListener {
        if (!prepared || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@setOnClickListener
        showPlaybackSpeedSelector()
      }
    }
    audioView = button("Audio").apply {
      contentDescription = "Audio track unavailable"
      isEnabled = false
      alpha = 0.45f
      setOnClickListener {
        if (!prepared || audioTracks.size <= 1) return@setOnClickListener
        showAudioTrackSelector()
      }
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
    lockView = button("Lock").apply {
      contentDescription = "Lock player controls"
      setOnClickListener { setControlsLocked(true) }
    }
    controls.addView(rewindView, LinearLayout.LayoutParams(dp(82), dp(40)).apply {
      rightMargin = dp(10)
    })
    controls.addView(playPauseView, LinearLayout.LayoutParams(dp(88), dp(40)).apply {
      rightMargin = dp(10)
    })
    controls.addView(forwardView, LinearLayout.LayoutParams(dp(82), dp(40)))
    val secondaryControls = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    secondaryControls.addView(positionView, LinearLayout.LayoutParams(0, dp(40), 1f))
    secondaryControls.addView(speedView, LinearLayout.LayoutParams(dp(66), dp(40)).apply {
      leftMargin = dp(8)
      rightMargin = dp(8)
    })
    secondaryControls.addView(audioView, LinearLayout.LayoutParams(dp(82), dp(40)).apply {
      rightMargin = dp(8)
    })
    secondaryControls.addView(presentationView, LinearLayout.LayoutParams(dp(76), dp(40)).apply {
      rightMargin = dp(8)
    })
    secondaryControls.addView(subtitleButton, LinearLayout.LayoutParams(dp(70), dp(40)).apply {
      rightMargin = dp(8)
    })
    secondaryControls.addView(lockView, LinearLayout.LayoutParams(dp(68), dp(40)))
    bottom.addView(secondaryControls)

    subtitleView = TextView(this).apply {
      setTextColor(contentTextColor)
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(6), dp(12), dp(6))
      visibility = View.GONE
      maxLines = 4
    }
    root.addView(subtitleView, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
      Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
    ).apply {
      bottomMargin = dp(subtitleBottomMarginDp())
      leftMargin = dp(24)
      rightMargin = dp(24)
    })
    applySubtitleAppearance()

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
      addView(controls, FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER,
      ))
    }
    root.addView(chrome, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    ))

    root.addView(seekPreviewView, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      dp(36),
      Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
    ).apply {
      bottomMargin = dp(SEEK_PREVIEW_BOTTOM_MARGIN_DP)
    })

    playbackStatusSpinner = ProgressBar(this).apply {
      isIndeterminate = true
      indeterminateTintList = ColorStateList.valueOf(accentColor)
    }
    playbackStatusText = TextView(this).apply {
      setTextColor(contentTextColor)
      textSize = 12.5f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(8), 0, 0, 0)
    }
    playbackStatusOverlay = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(8), dp(14), dp(8))
      background = roundedBackground(
        alphaColor(panelFillColor, 164),
        alphaColor(contentTextColor, 34),
        16,
      )
      visibility = View.GONE
      elevation = dp(4).toFloat()
      addView(playbackStatusSpinner, LinearLayout.LayoutParams(dp(22), dp(22)))
      addView(playbackStatusText, LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
      ))
    }
    root.addView(playbackStatusOverlay, FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      dp(46),
      Gravity.CENTER,
    ))

    gestureFeedbackView = TextView(this).apply {
      setTextColor(contentTextColor)
      textSize = 13f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(dp(12), 0, dp(12), 0)
      background = roundedBackground(
        alphaColor(panelFillColor, 178),
        alphaColor(contentTextColor, 38),
        16,
      )
      visibility = View.GONE
      alpha = 0f
      elevation = dp(4).toFloat()
    }
    root.addView(gestureFeedbackView, FrameLayout.LayoutParams(
      dp(164),
      dp(46),
      Gravity.CENTER,
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

    unlockView = button("Unlock").apply {
      visibility = View.GONE
      alpha = 0f
      contentDescription = "Unlock player controls"
      setOnClickListener { setControlsLocked(false) }
    }
    root.addView(unlockView, FrameLayout.LayoutParams(
      dp(112),
      dp(44),
      Gravity.CENTER,
    ))

    root.setOnApplyWindowInsetsListener { _, insets ->
      val resolvedInsets = resolveSafeInsets(insets)
      safeInsetLeft = resolvedInsets.left
      safeInsetTop = resolvedInsets.top
      safeInsetRight = resolvedInsets.right
      safeInsetBottom = resolvedInsets.bottom

      top.setPadding(
        dp(16) + safeInsetLeft,
        dp(10) + safeInsetTop,
        dp(16) + safeInsetRight,
        dp(18),
      )
      bottom.setPadding(
        dp(18) + safeInsetLeft,
        dp(4),
        dp(18) + safeInsetRight,
        dp(12) + safeInsetBottom,
      )
      updateSubtitleGeometry()
      (seekPreviewView.layoutParams as? FrameLayout.LayoutParams)?.let { params ->
        params.bottomMargin = dp(SEEK_PREVIEW_BOTTOM_MARGIN_DP) + safeInsetBottom
        seekPreviewView.layoutParams = params
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
    updatePlayPausePresentation(player)
    // Subtitle timing remains tied to the decoder's confirmed position. Only
    // the seek/progress presentation is pinned to the requested target while
    // an OEM MediaPlayer is still settling an asynchronous seek.
    updateSubtitle(actualPosition)
    updatePlaybackStatus()
    publishProgress(currentPlaybackState())
  }

  private fun showSeekPreview(progress: Int, targetMs: Long) {
    if (!::seekPreviewView.isInitialized || !::seekBar.isInitialized) return
    seekPreviewView.text = formatTime(targetMs)
    seekPreviewView.visibility = View.VISIBLE
    seekPreviewView.post {
      val parent = seekPreviewView.parent as? View ?: return@post
      val usableTrackWidth = max(1, seekBar.width - seekBar.paddingLeft - seekBar.paddingRight)
      val thumbCenter = seekBar.x + seekBar.paddingLeft + usableTrackWidth * (progress.coerceIn(0, 1000) / 1000f)
      val minX = (safeInsetLeft + dp(8)).toFloat()
      val maxX = max(minX, parent.width - safeInsetRight - dp(8) - seekPreviewView.width.toFloat())
      seekPreviewView.x = (thumbCenter - seekPreviewView.width / 2f).coerceIn(minX, maxX)
    }
  }

  private fun hideSeekPreview() {
    if (::seekPreviewView.isInitialized) seekPreviewView.visibility = View.GONE
  }

  private fun updatePlaybackStatus() {
    if (!::playbackStatusOverlay.isInitialized) return
    val request = pendingSeek
    val seekingLongEnough = request != null &&
      OrionMediaPlayerSeekPolicy.remainingMs(request, SystemClock.elapsedRealtime()) <=
        OrionMediaPlayerSeekPolicy.SEEK_TIMEOUT_MS - SEEKING_STATUS_DELAY_MS
    val label = when {
      buffering -> "Buffering…"
      seekingLongEnough -> "Seeking…"
      else -> null
    }
    if (label == null) {
      hidePlaybackStatus()
      return
    }
    playbackStatusText.text = label
    playbackStatusOverlay.visibility = View.VISIBLE
  }

  private fun hidePlaybackStatus() {
    if (::playbackStatusOverlay.isInitialized) playbackStatusOverlay.visibility = View.GONE
  }

  private fun currentWindowBrightness(): Float {
    val windowValue = window.attributes.screenBrightness
    if (windowValue >= 0f) return windowValue.coerceIn(MIN_WINDOW_BRIGHTNESS, 1f)
    val systemValue = try {
      Settings.System.getInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128)
    } catch (_: Throwable) {
      128
    }
    return (systemValue / 255f).coerceIn(MIN_WINDOW_BRIGHTNESS, 1f)
  }

  private fun applyBrightnessGesture(verticalFraction: Float) {
    val brightness = (gestureStartBrightness + verticalFraction)
      .coerceIn(MIN_WINDOW_BRIGHTNESS, 1f)
    val attributes = window.attributes
    attributes.screenBrightness = brightness
    window.attributes = attributes
    showGestureFeedback("Brightness", (brightness * 100f).toInt())
  }

  private fun applyVolumeGesture(verticalFraction: Float) {
    val maxVolume = max(1, audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC))
    val delta = (verticalFraction * maxVolume).toInt()
    val target = (gestureStartVolume + delta).coerceIn(0, maxVolume)
    if (target != audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)) {
      audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
    }
    val percent = ((target.toFloat() / maxVolume.toFloat()) * 100f).toInt()
    showGestureFeedback(if (target == 0) "Muted" else "Volume", percent)
  }

  private fun showGestureFeedback(label: String, percent: Int) {
    if (!::gestureFeedbackView.isInitialized) return
    mainHandler.removeCallbacks(hideGestureFeedbackRunnable)
    gestureFeedbackView.animate().cancel()
    gestureFeedbackView.text = "$label ${percent.coerceIn(0, 100)}%"
    gestureFeedbackView.visibility = View.VISIBLE
    if (reducedMotion) {
      gestureFeedbackView.alpha = 1f
    } else {
      gestureFeedbackView.animate().alpha(1f).setDuration(CHROME_FADE_MS).start()
    }
    mainHandler.postDelayed(hideGestureFeedbackRunnable, GESTURE_FEEDBACK_HIDE_MS)
  }

  private fun hideGestureFeedback() {
    mainHandler.removeCallbacks(hideGestureFeedbackRunnable)
    if (!::gestureFeedbackView.isInitialized) return
    gestureFeedbackView.animate().cancel()
    if (reducedMotion) {
      gestureFeedbackView.alpha = 0f
      gestureFeedbackView.visibility = View.GONE
      return
    }
    gestureFeedbackView.animate()
      .alpha(0f)
      .setDuration(CHROME_FADE_MS)
      .withEndAction {
        if (::gestureFeedbackView.isInitialized && gestureFeedbackView.alpha <= 0.01f) {
          gestureFeedbackView.visibility = View.GONE
        }
      }
      .start()
  }

  private fun updatePlayPausePresentation(player: MediaPlayer) {
    val pendingPlayIntent = pendingSeek?.playWhenSettled
    playPauseView.text = when {
      pendingPlayIntent != null -> if (pendingPlayIntent) "Pause" else "Play"
      try { player.isPlaying } catch (_: Throwable) { false } -> "Pause"
      completed -> "Replay"
      else -> "Play"
    }
  }

  private fun togglePlaybackDuringPendingSeek(player: MediaPlayer): Boolean {
    val request = pendingSeek ?: return false
    val playWhenSettled = !request.playWhenSettled
    pendingSeek = OrionMediaPlayerSeekPolicy.withPlayIntent(request, playWhenSettled)
    resumeAfterPause = false
    if (!playWhenSettled) {
      try { if (player.isPlaying) player.pause() } catch (_: Throwable) { Unit }
    }
    updatePlayPausePresentation(player)
    publishProgress("seeking", force = true)
    showChrome(autoHide = false)
    return true
  }

  private fun seekByOffset(player: MediaPlayer, offsetMs: Long) {
    if (!prepared || player !== mediaPlayer) return
    val duration = safeDuration(player)
    if (duration <= 0L) return
    val basePosition = pendingSeek?.targetMs ?: safePosition(player)
    val target = (basePosition + offsetMs).coerceIn(0L, max(0L, duration - 1L))
    val playWhenSettled = pendingSeek?.playWhenSettled
      ?: try { player.isPlaying } catch (_: Throwable) { false }
    showChrome(autoHide = false)
    requestSeek(player, target, playWhenSettled = playWhenSettled)
  }

  private fun requestSeek(player: MediaPlayer, targetMs: Long, playWhenSettled: Boolean) {
    if (!prepared || player !== mediaPlayer) return
    val duration = safeDuration(player)
    val boundedTarget = targetMs.coerceIn(0L, max(0L, duration - 1L))
    val now = SystemClock.elapsedRealtime()
    seekGeneration += 1L
    pendingSeek = OrionMediaPlayerSeekPolicy.Request(
      generation = seekGeneration,
      playerGeneration = playerGeneration,
      targetMs = boundedTarget,
      playWhenSettled = playWhenSettled,
      deadlineUptimeMs = OrionMediaPlayerSeekPolicy.deadline(now),
    )
    seekingByUser = true
    completed = false
    resumeAfterPause = false
    cancelSeekObservation()
    mainHandler.removeCallbacks(seekTimeoutRunnable)
    mainHandler.postDelayed(seekTimeoutRunnable, OrionMediaPlayerSeekPolicy.SEEK_TIMEOUT_MS)
    try { if (player.isPlaying) player.pause() } catch (_: Throwable) { Unit }
    logSeekTransition("request", now, boundedTarget - safePosition(player))
    updateProgress()
    issuePendingSeek(player)
  }

  private fun issuePendingSeek(player: MediaPlayer) {
    val request = pendingSeek ?: return
    if (issuedSeek != null) return
    if (OrionMediaPlayerSeekPolicy.remainingMs(request, SystemClock.elapsedRealtime()) == 0L) {
      finishPendingSeek(timedOut = true)
      return
    }
    cancelSeekObservation()
    val now = SystemClock.elapsedRealtime()
    val issued = OrionMediaPlayerSeekPolicy.issued(request, now, surfaceFrameGeneration)
    issuedSeek = issued
    try {
      when (OrionMediaPlayerSeekPolicy.mode(Build.VERSION.SDK_INT, request.attempt)) {
        OrionMediaPlayerSeekPolicy.Mode.CLOSEST_SYNC ->
          player.seekTo(request.targetMs, MediaPlayer.SEEK_CLOSEST_SYNC)
        OrionMediaPlayerSeekPolicy.Mode.CLOSEST ->
          player.seekTo(request.targetMs, MediaPlayer.SEEK_CLOSEST)
        OrionMediaPlayerSeekPolicy.Mode.LEGACY_PREVIOUS_SYNC ->
          player.seekTo(request.targetMs.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
      }
      logSeekTransition("issued-${request.attempt.name.lowercase()}", now, request.targetMs - safePosition(player))
      publishProgress("seeking", force = true)
    } catch (_: Throwable) {
      if (issuedSeek == issued) issuedSeek = null
      logSeekTransition("issue-failed", now, request.targetMs - safePosition(player))
      finishPendingSeek(timedOut = true)
    }
  }

  private fun handleSeekComplete(player: MediaPlayer) {
    val issued = issuedSeek ?: return
    if (player !== mediaPlayer || !OrionMediaPlayerSeekPolicy.acceptsCallback(issued, playerGeneration)) {
      logSeekTransition("stale-callback", SystemClock.elapsedRealtime(), 0L)
      return
    }
    issuedSeek = null
    val request = pendingSeek ?: return
    if (!OrionMediaPlayerSeekPolicy.matchesAttempt(request, issued)) {
      logSeekTransition("superseded-callback", SystemClock.elapsedRealtime(), request.targetMs - safePosition(player))
      issuePendingSeek(player)
      return
    }
    seekObservation = OrionMediaPlayerSeekPolicy.beginObservation(
      issued,
      SystemClock.elapsedRealtime(),
      surfaceFrameGeneration,
    )
    logSeekTransition("callback-${request.attempt.name.lowercase()}", SystemClock.elapsedRealtime(), request.targetMs - safePosition(player))
    scheduleSeekObservation(player, request)
  }

  private fun scheduleSeekObservation(
    player: MediaPlayer,
    request: OrionMediaPlayerSeekPolicy.Request,
  ) {
    seekObservationRunnable?.let(mainHandler::removeCallbacks)
    val expectedSeekGeneration = request.generation
    val expectedPlayerGeneration = request.playerGeneration
    val expectedAttempt = request.attempt
    val observationPoll = Runnable {
      seekObservationRunnable = null
      val active = pendingSeek ?: return@Runnable
      if (
        active.generation != expectedSeekGeneration ||
        active.playerGeneration != expectedPlayerGeneration ||
        active.attempt != expectedAttempt ||
        player !== mediaPlayer ||
        playerGeneration != expectedPlayerGeneration
      ) {
        return@Runnable
      }
      val observation = seekObservation ?: return@Runnable
      val now = SystemClock.elapsedRealtime()
      val actual = safePosition(player)
      val result = OrionMediaPlayerSeekPolicy.observe(
        active,
        observation,
        actual,
        safeDuration(player),
        now,
        surfaceFrameGeneration,
      )
      seekObservation = result.observation
      when (result.decision) {
        OrionMediaPlayerSeekPolicy.Decision.SETTLE -> {
          logSeekTransition("settled-${active.attempt.name.lowercase()}", now, active.targetMs - actual)
          finishPendingSeek(timedOut = false)
        }
        OrionMediaPlayerSeekPolicy.Decision.FALLBACK -> {
          logSeekTransition("fallback", now, active.targetMs - actual)
          cancelSeekObservation()
          pendingSeek = OrionMediaPlayerSeekPolicy.withFallback(active)
          issuePendingSeek(player)
        }
        OrionMediaPlayerSeekPolicy.Decision.WAIT -> scheduleSeekObservation(player, active)
        OrionMediaPlayerSeekPolicy.Decision.TIMED_OUT -> finishPendingSeek(timedOut = true)
      }
    }
    seekObservationRunnable = observationPoll
    mainHandler.postDelayed(observationPoll, OrionMediaPlayerSeekPolicy.OBSERVATION_INTERVAL_MS)
  }

  private fun cancelSeekObservation() {
    seekObservationRunnable?.let(mainHandler::removeCallbacks)
    seekObservationRunnable = null
    seekObservation = null
  }

  private fun finishPendingSeekFromTimeout() {
    if (pendingSeek == null) return
    finishPendingSeek(timedOut = true)
  }

  private fun finishPendingSeek(timedOut: Boolean) {
    val request = pendingSeek ?: return
    val player = mediaPlayer
    if (timedOut) logSeekTransition("timeout", SystemClock.elapsedRealtime(), request.targetMs - safePosition(player))
    cancelSeekObservation()
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

  private fun logSeekTransition(event: String, nowUptimeMs: Long, deltaMs: Long) {
    val active = pendingSeek
    val elapsed = active?.let {
      OrionMediaPlayerSeekPolicy.SEEK_TIMEOUT_MS -
        OrionMediaPlayerSeekPolicy.remainingMs(it, nowUptimeMs)
    } ?: 0L
    val elapsedBucket = ((elapsed.coerceAtLeast(0L) / 250L).coerceAtMost(40L) * 250L)
    val magnitude = kotlin.math.abs(deltaMs)
    val deltaBucket = when {
      magnitude < 1_000L -> "<1s"
      magnitude < 3_000L -> "<3s"
      magnitude < 10_000L -> "<10s"
      else -> ">=10s"
    }
    Log.d("OrionPlayerSeek", "event=${event.take(40)} elapsedBucketMs=$elapsedBucket deltaBucket=$deltaBucket")
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

  private fun refreshAudioTracks(player: MediaPlayer) {
    val discovered = mutableListOf<EmbeddedAudioTrack>()
    try {
      var audioOrdinal = 0
      player.trackInfo.forEachIndexed { mediaTrackIndex, trackInfo ->
        if (trackInfo.trackType != MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO) return@forEachIndexed
        val label = friendlyAudioTrackLabel(
          language = try { trackInfo.language.orEmpty() } catch (_: Throwable) { "" },
          ordinal = audioOrdinal,
        )
        discovered += EmbeddedAudioTrack(
          mediaTrackIndex = mediaTrackIndex,
          label = label,
        )
        audioOrdinal += 1
      }
    } catch (_: Throwable) {
      discovered.clear()
    }
    audioTracks = discovered
    selectedAudioTrackIndex = try {
      player.getSelectedTrack(MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO)
    } catch (_: Throwable) {
      -1
    }
    if (selectedAudioTrackIndex < 0 && audioTracks.isNotEmpty()) {
      selectedAudioTrackIndex = audioTracks.first().mediaTrackIndex
    }
    updateAudioButton()
  }

  private fun friendlyAudioTrackLabel(language: String, ordinal: Int): String {
    val normalized = language.trim().lowercase()
    val languageName = when (normalized) {
      "en", "eng", "english" -> "English"
      "ur", "urd", "urdu" -> "Urdu"
      "ko", "kor", "korean" -> "Korean"
      "ja", "jpn", "japanese" -> "Japanese"
      "zh", "zho", "chi", "chinese" -> "Chinese"
      "ar", "ara", "arabic" -> "Arabic"
      "hi", "hin", "hindi" -> "Hindi"
      "es", "spa", "spanish" -> "Spanish"
      "fr", "fra", "fre", "french" -> "French"
      "de", "deu", "ger", "german" -> "German"
      "it", "ita", "italian" -> "Italian"
      "pt", "por", "portuguese" -> "Portuguese"
      "tr", "tur", "turkish" -> "Turkish"
      "ru", "rus", "russian" -> "Russian"
      "fa", "fas", "per", "persian", "farsi" -> "Persian"
      "", "und" -> null
      else -> language.trim().takeIf { it.length <= 24 }
    }
    val suffix = "Audio ${ordinal + 1}"
    return languageName?.let { "$it · $suffix" } ?: suffix
  }

  private fun updateAudioButton() {
    if (!::audioView.isInitialized) return
    val available = prepared && audioTracks.size > 1
    audioView.isEnabled = available
    audioView.alpha = if (available) 1f else 0.45f
    val selected = audioTracks.firstOrNull {
      it.mediaTrackIndex == selectedAudioTrackIndex
    }
    audioView.text = "Audio"
    audioView.contentDescription = when {
      audioTracks.isEmpty() -> "Audio track unavailable"
      audioTracks.size == 1 -> "Audio track: ${audioTracks.first().label}"
      selected != null -> "Audio track: ${selected.label}. Activate to choose another track."
      else -> "Audio tracks available. Activate to choose a track."
    }
  }

  private fun showAudioTrackSelector() {
    val player = mediaPlayer ?: return
    if (!prepared || audioTracks.size <= 1) return
    showChoicePanel(
      title = "Audio",
      detail = "Choose an embedded audio track.",
      choices = audioTracks.map { track ->
        track.mediaTrackIndex.toString() to track.label
      },
      selectedValue = selectedAudioTrackIndex.toString(),
    ) { value ->
      val requestedTrackIndex = value.toIntOrNull() ?: return@showChoicePanel
      if (audioTracks.none { it.mediaTrackIndex == requestedTrackIndex }) return@showChoicePanel
      try {
        player.selectTrack(requestedTrackIndex)
        selectedAudioTrackIndex = try {
          player.getSelectedTrack(MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO)
        } catch (_: Throwable) {
          requestedTrackIndex
        }
        if (selectedAudioTrackIndex < 0) selectedAudioTrackIndex = requestedTrackIndex
        updateAudioButton()
        audioView.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_SELECTED)
      } catch (_: Throwable) {
        Toast.makeText(this, "Audio track could not be changed", Toast.LENGTH_SHORT).show()
      }
    }
  }

  private fun applyPlaybackSpeed(player: MediaPlayer, speed: Float): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return speed == 1.0f
    val wasPlaying = try { player.isPlaying } catch (_: Throwable) { false }
    return try {
      val params = player.playbackParams
        .setSpeed(speed.coerceIn(0.5f, 2.0f))
        .setPitch(1.0f)
      player.playbackParams = params
      if (!wasPlaying) {
        try { if (player.isPlaying) player.pause() } catch (_: Throwable) { Unit }
      }
      true
    } catch (_: Throwable) {
      if (!wasPlaying) {
        try { if (player.isPlaying) player.pause() } catch (_: Throwable) { Unit }
      }
      false
    }
  }

  private fun updatePlaybackSpeedLabel() {
    val label = playbackSpeedLabel(playbackSpeed)
    speedView.text = label
    speedView.contentDescription = "Playback speed: $label"
  }

  private fun playbackSpeedLabel(speed: Float): String {
    val plain = if (speed % 1.0f == 0.0f) {
      speed.toInt().toString()
    } else {
      speed.toString().trimEnd('0').trimEnd('.')
    }
    return "$plain×"
  }

  private fun showPlaybackSpeedSelector() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val choices = listOf(
      "0.5" to "0.5×",
      "0.75" to "0.75×",
      "1.0" to "1×",
      "1.25" to "1.25×",
      "1.5" to "1.5×",
      "1.75" to "1.75×",
      "2.0" to "2×",
    )
    showChoicePanel(
      title = "Playback speed",
      detail = "Choose how fast the video plays.",
      choices = choices,
      selectedValue = playbackSpeed.toString(),
    ) { value ->
      val nextSpeed = value.toFloatOrNull()?.coerceIn(0.5f, 2.0f) ?: return@showChoicePanel
      val player = mediaPlayer ?: return@showChoicePanel
      if (!prepared) return@showChoicePanel
      if (!applyPlaybackSpeed(player, nextSpeed)) {
        Toast.makeText(this, "Playback speed is unavailable", Toast.LENGTH_SHORT).show()
        return@showChoicePanel
      }
      playbackSpeed = nextSpeed
      updatePlaybackSpeedLabel()
      speedView.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_SELECTED)
      publishProgress(currentPlaybackState(), force = true)
    }
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
    choices += SUBTITLE_APPEARANCE_VALUE to "Subtitle appearance"
    showChoicePanel(
      title = "Subtitles",
      detail = "Choose a subtitle track or adjust its appearance.",
      choices = choices,
      selectedValue = selectedSubtitleIndex.toString(),
    ) { value ->
      if (value == SUBTITLE_APPEARANCE_VALUE) {
        mainHandler.post { showSubtitleAppearanceSelector() }
        return@showChoicePanel
      }
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

  private fun showSubtitleAppearanceSelector() {
    showChoicePanel(
      title = "Subtitle appearance",
      detail = "Adjust text size, background strength, or vertical position.",
      choices = listOf(
        "size" to "Text size · ${subtitleTextSize.replaceFirstChar { it.uppercase() }}",
        "background" to "Background · ${subtitleBackground.replaceFirstChar { it.uppercase() }}",
        "position" to "Position · ${subtitlePosition.replaceFirstChar { it.uppercase() }}",
      ),
      selectedValue = "",
    ) { value ->
      mainHandler.post {
        when (value) {
          "size" -> showSubtitleSizeSelector()
          "background" -> showSubtitleBackgroundSelector()
          "position" -> showSubtitlePositionSelector()
        }
      }
    }
  }

  private fun showSubtitleSizeSelector() {
    showChoicePanel(
      title = "Subtitle text size",
      detail = "Choose how large subtitles appear.",
      choices = listOf(
        "small" to "Small",
        "medium" to "Medium",
        "large" to "Large",
      ),
      selectedValue = subtitleTextSize,
    ) { value ->
      if (value !in setOf("small", "medium", "large")) return@showChoicePanel
      subtitleTextSize = value
      applySubtitleAppearance()
    }
  }

  private fun showSubtitleBackgroundSelector() {
    showChoicePanel(
      title = "Subtitle background",
      detail = "Choose how strongly the subtitle panel separates text from the video.",
      choices = listOf(
        "low" to "Low",
        "medium" to "Medium",
        "high" to "High",
      ),
      selectedValue = subtitleBackground,
    ) { value ->
      if (value !in setOf("low", "medium", "high")) return@showChoicePanel
      subtitleBackground = value
      applySubtitleAppearance()
    }
  }

  private fun showSubtitlePositionSelector() {
    showChoicePanel(
      title = "Subtitle position",
      detail = "Choose the subtitle height above the bottom edge.",
      choices = listOf(
        "low" to "Low",
        "standard" to "Standard",
        "high" to "High",
      ),
      selectedValue = subtitlePosition,
    ) { value ->
      if (value !in setOf("low", "standard", "high")) return@showChoicePanel
      subtitlePosition = value
      applySubtitleAppearance()
    }
  }

  private fun subtitleBottomMarginDp(): Int = if (chromeControlsVisible) {
    when (subtitlePosition) {
      "low" -> 100
      "high" -> 148
      else -> 116
    }
  } else {
    when (subtitlePosition) {
      "low" -> 32
      "high" -> 84
      else -> 52
    }
  }

  private fun updateSubtitleGeometry() {
    if (!::subtitleView.isInitialized) return
    (subtitleView.layoutParams as? FrameLayout.LayoutParams)?.let { params ->
      params.bottomMargin = dp(subtitleBottomMarginDp()) + safeInsetBottom
      params.leftMargin = dp(24) + safeInsetLeft
      params.rightMargin = dp(24) + safeInsetRight
      subtitleView.layoutParams = params
    }
  }

  private fun setChromeControlsVisible(visible: Boolean) {
    if (chromeControlsVisible == visible) return
    chromeControlsVisible = visible
    updateSubtitleGeometry()
  }

  private fun applySubtitleAppearance() {
    if (!::subtitleView.isInitialized) return
    subtitleView.textSize = when (subtitleTextSize) {
      "small" -> 14f
      "large" -> 20f
      else -> 17f
    }
    val backgroundAlpha = when (subtitleBackground) {
      "low" -> 126
      "high" -> 238
      else -> 188
    }
    subtitleView.background = roundedBackground(
      alphaColor(panelFillColor, backgroundAlpha),
      borderColor,
      10,
    )
    updateSubtitleGeometry()
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
    if (controlsLocked || !::selectorOverlay.isInitialized) return
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
    if (controlsLocked) {
      showUnlockAffordance()
    } else {
      showChrome()
    }
  }

  private fun setControlsLocked(locked: Boolean) {
    if (controlsLocked == locked) {
      if (locked) showUnlockAffordance() else showChrome()
      return
    }
    controlsLocked = locked
    mainHandler.removeCallbacks(hideChromeRunnable)
    mainHandler.removeCallbacks(hideUnlockRunnable)
    if (::selectorOverlay.isInitialized && selectorOverlay.visibility == View.VISIBLE) {
      selectorOverlay.visibility = View.GONE
      selectorOverlay.removeAllViews()
    }
    if (locked) {
      hideSeekPreview()
      hideGestureFeedback()
      verticalGestureMode = null
      if (::chrome.isInitialized) {
        chrome.animate().cancel()
        chrome.alpha = 0f
        chrome.visibility = View.INVISIBLE
        setChromeControlsVisible(false)
      }
      showUnlockAffordance()
      unlockView.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED)
    } else {
      hideUnlockAffordance()
      showChrome()
      lockView.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_SELECTED)
    }
  }

  private fun showUnlockAffordance() {
    if (!controlsLocked || !::unlockView.isInitialized) return
    mainHandler.removeCallbacks(hideUnlockRunnable)
    unlockView.animate().cancel()
    unlockView.visibility = View.VISIBLE
    if (reducedMotion) {
      unlockView.alpha = 1f
    } else {
      unlockView.animate()
        .alpha(1f)
        .setDuration(CHROME_FADE_MS)
        .start()
    }
    mainHandler.postDelayed(hideUnlockRunnable, UNLOCK_AUTO_HIDE_MS)
  }

  private fun hideUnlockAffordance() {
    mainHandler.removeCallbacks(hideUnlockRunnable)
    if (!::unlockView.isInitialized) return
    unlockView.animate().cancel()
    if (reducedMotion) {
      unlockView.alpha = 0f
      unlockView.visibility = View.GONE
      return
    }
    unlockView.animate()
      .alpha(0f)
      .setDuration(CHROME_FADE_MS)
      .withEndAction {
        if (::unlockView.isInitialized && unlockView.alpha <= 0.01f) {
          unlockView.visibility = View.GONE
        }
      }
      .start()
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
    if (controlsLocked || !prepared || seekingByUser) return false
    return try { mediaPlayer?.isPlaying == true } catch (_: Throwable) { false }
  }

  private fun showChrome(autoHide: Boolean = true) {
    mainHandler.removeCallbacks(hideChromeRunnable)
    if (controlsLocked) {
      showUnlockAffordance()
      return
    }
    if (!::chrome.isInitialized) return
    chrome.animate().cancel()
    setChromeControlsVisible(true)
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
    if (controlsLocked || !::chrome.isInitialized || !shouldAutoHideChrome()) return
    chrome.animate().cancel()
    if (reducedMotion) {
      chrome.alpha = 0f
      chrome.visibility = View.INVISIBLE
      setChromeControlsVisible(false)
      return
    }
    chrome.animate()
      .alpha(0f)
      .setDuration(CHROME_FADE_MS)
      .withEndAction {
        if (::chrome.isInitialized && shouldAutoHideChrome() && chrome.alpha <= 0.01f) {
          chrome.visibility = View.INVISIBLE
          setChromeControlsVisible(false)
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

  private fun cinematicChromeScrim(top: Boolean): GradientDrawable {
    val colors = if (top) {
      intArrayOf(
        alphaColor(chromeFillColor, 184),
        alphaColor(chromeFillColor, 118),
        Color.TRANSPARENT,
      )
    } else {
      intArrayOf(
        Color.TRANSPARENT,
        alphaColor(chromeFillColor, 112),
        alphaColor(chromeFillColor, 188),
      )
    }
    return GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, colors)
  }

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
    setTextColor(contentTextColor)
    textSize = 13f
    setTypeface(typeface, Typeface.BOLD)
    gravity = Gravity.CENTER
    isClickable = true
    isFocusable = true
    setPadding(dp(10), 0, dp(10), 0)
    elevation = dp(1).toFloat()
    background = if (primary) {
      roundedBackground(
        alphaColor(accentColor, 48),
        alphaColor(accentColor, 154),
        14,
      )
    } else {
      roundedBackground(
        alphaColor(panelFillColor, 108),
        alphaColor(contentTextColor, 36),
        14,
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
    mainHandler.removeCallbacks(hideGestureFeedbackRunnable)
    hideSeekPreview()
    hidePlaybackStatus()
    hideGestureFeedback()
    mainHandler.removeCallbacks(hideUnlockRunnable)
    cancelSeekObservation()
    pendingSeek = null
    issuedSeek = null
    trackingSeekBar = false
    seekingByUser = false
    playerGeneration += 1L
    prepared = false
    audioTracks = emptyList()
    selectedAudioTrackIndex = -1
    updateAudioButton()
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

  private data class EmbeddedAudioTrack(
    val mediaTrackIndex: Int,
    val label: String,
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
    private const val UNLOCK_AUTO_HIDE_MS = 1_800L
    private const val GESTURE_FEEDBACK_HIDE_MS = 900L
    private const val SEEKING_STATUS_DELAY_MS = 350L
    private const val SEEK_PREVIEW_BOTTOM_MARGIN_DP = 116
    private const val VERTICAL_GESTURE_START_DP = 18
    private const val MIN_WINDOW_BRIGHTNESS = 0.05f
    private const val TRANSPORT_SEEK_MS = 10_000L
    private const val DOUBLE_TAP_SEEK_MS = 10_000L
    private const val SUBTITLE_APPEARANCE_VALUE = "__appearance__"
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
