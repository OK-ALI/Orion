package com.okali.orion.playback

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
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
  private var mediaPlayer: MediaPlayer? = null
  private var renderSurface: Surface? = null
  private var prepared = false
  private var completed = false
  private var released = false
  private var resumeAfterPause = false
  private var seekingByUser = false
  private var videoWidth = 0
  private var videoHeight = 0
  private var presentation = "fit"
  private var subtitleTracks: List<PreparedSubtitle> = emptyList()
  private var selectedSubtitleIndex = -1
  private var lastSubtitleText: String? = null
  private var requestedAssetId = ""
  private var buffering = false
  private var lastProgressPublishedAt = 0L

  private val progressTicker = object : Runnable {
    override fun run() {
      if (released) return
      updateProgress()
      mainHandler.postDelayed(this, 250L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    enterImmersiveMode()
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
    enterImmersiveMode()
    val player = mediaPlayer
    if (prepared && resumeAfterPause && player != null && !player.isPlaying) {
      try { player.start() } catch (_: Throwable) { Unit }
    }
    resumeAfterPause = false
    if (prepared) publishProgress(currentPlaybackState(), force = true)
  }

  override fun onPause() {
    val player = mediaPlayer
    resumeAfterPause = prepared && try { player?.isPlaying == true } catch (_: Throwable) { false }
    if (resumeAfterPause) {
      try { player?.pause() } catch (_: Throwable) { Unit }
    }
    if (prepared && !completed && !isFinishing) publishProgress("paused", force = true)
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
      if (target > 0L) it.seekTo(target.toInt())
      it.start()
      playPauseView.text = "Pause"
      updateProgress()
      publishProgress("playing", force = true)
    }
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
      fail("orion-player-media-error-$what-$extra", "Android could not play this verified MP4.")
      true
    }

    try {
      configureVerifiedDataSource(player, asset)
      renderSurface?.let(player::setSurface)
      player.prepareAsync()
      mainHandler.removeCallbacks(progressTicker)
      mainHandler.post(progressTicker)
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
      setOnClickListener { chrome.visibility = if (chrome.visibility == View.VISIBLE) View.INVISIBLE else View.VISIBLE }
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
      setBackgroundColor(0x66000000)
    }
    val back = button("‹").apply {
      textSize = 34f
      setOnClickListener { finishWithPlaybackResult() }
    }
    titleView = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 16f
      setPadding(dp(12), 0, 0, 0)
      maxLines = 1
    }
    top.addView(back, LinearLayout.LayoutParams(dp(48), dp(48)))
    top.addView(titleView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

    val bottom = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(10), dp(20), dp(14))
      setBackgroundColor(0x88000000.toInt())
    }
    seekBar = SeekBar(this).apply {
      max = 1000
      setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
        override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
          if (!fromUser) return
          val duration = safeDuration(mediaPlayer)
          positionView.text = "${formatTime(duration * progress / 1000L)} / ${formatTime(duration)}"
        }
        override fun onStartTrackingTouch(seekBar: SeekBar?) {
          seekingByUser = true
          publishProgress("seeking", force = true)
        }
        override fun onStopTrackingTouch(seekBar: SeekBar?) {
          val player = mediaPlayer ?: return
          val duration = safeDuration(player)
          val target = duration * (seekBar?.progress ?: 0) / 1000L
          try { player.seekTo(target.toInt()) } catch (_: Throwable) { Unit }
          seekingByUser = false
          publishProgress(currentPlaybackState(), force = true)
        }
      })
    }
    bottom.addView(seekBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(34)))

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    playPauseView = button("Play").apply {
      setOnClickListener {
        val player = mediaPlayer ?: return@setOnClickListener
        if (!prepared) return@setOnClickListener
        try {
          if (player.isPlaying) {
            player.pause()
            text = "Play"
            publishProgress("paused", force = true)
          } else {
            if (completed) {
              completed = false
              player.seekTo(0)
            }
            player.start()
            text = "Pause"
            publishProgress("playing", force = true)
          }
        } catch (_: Throwable) { Unit }
      }
    }
    positionView = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 13f
      text = "0:00 / 0:00"
      setPadding(dp(10), 0, dp(10), 0)
    }
    presentationView = button("Fit").apply {
      setOnClickListener {
        presentation = when (presentation) {
          "fit" -> "fill"
          "fill" -> "stretch"
          else -> "fit"
        }
        updatePresentationLabel()
        applyVideoTransform()
        publishProgress(currentPlaybackState(), force = true)
      }
    }
    subtitleButton = button("Subtitles Off").apply {
      setOnClickListener {
        if (subtitleTracks.isEmpty()) return@setOnClickListener
        selectedSubtitleIndex = if (selectedSubtitleIndex >= subtitleTracks.lastIndex) -1 else selectedSubtitleIndex + 1
        lastSubtitleText = null
        subtitleView.visibility = View.GONE
        updateSubtitleButton()
      }
    }
    controls.addView(playPauseView, LinearLayout.LayoutParams(dp(86), dp(42)))
    controls.addView(positionView, LinearLayout.LayoutParams(0, dp(42), 1f))
    controls.addView(presentationView, LinearLayout.LayoutParams(dp(84), dp(42)))
    controls.addView(subtitleButton, LinearLayout.LayoutParams(dp(150), dp(42)))
    bottom.addView(controls)

    subtitleView = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 18f
      gravity = Gravity.CENTER
      setPadding(dp(10), dp(4), dp(10), dp(4))
      setBackgroundColor(0xC6000000.toInt())
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
    setContentView(root)
  }

  private fun updateProgress() {
    val player = mediaPlayer ?: return
    val position = safePosition(player)
    val duration = safeDuration(player)
    if (!seekingByUser && duration > 0L) {
      seekBar.progress = ((position.toDouble() / duration.toDouble()) * 1000.0).toInt().coerceIn(0, 1000)
      positionView.text = "${formatTime(position)} / ${formatTime(duration)}"
    }
    if (prepared) playPauseView.text = if (try { player.isPlaying } catch (_: Throwable) { false }) "Pause" else if (completed) "Replay" else "Play"
    updateSubtitle(position)
    publishProgress(currentPlaybackState())
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
        positionMs = safePosition(player),
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
    subtitleButton.text = subtitleTracks.getOrNull(selectedSubtitleIndex)?.label?.let { "CC $it" } ?: "Subtitles Off"
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
    presentationView.text = when (presentation) {
      "fill" -> "Fill"
      "stretch" -> "Stretch"
      else -> "Fit"
    }
  }

  private fun button(label: String) = TextView(this).apply {
    text = label
    setTextColor(Color.WHITE)
    textSize = 14f
    gravity = Gravity.CENTER
    isClickable = true
    isFocusable = true
    setBackgroundColor(0x22000000)
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
    prepared = false
    try { mediaPlayer?.setSurface(null) } catch (_: Throwable) { Unit }
    try { mediaPlayer?.release() } catch (_: Throwable) { Unit }
    mediaPlayer = null
  }

  private fun safePosition(player: MediaPlayer?): Long = try {
    player?.currentPosition?.toLong()?.coerceAtLeast(0L) ?: 0L
  } catch (_: Throwable) { 0L }

  private fun safeDuration(player: MediaPlayer?): Long = try {
    player?.duration?.toLong()?.coerceAtLeast(0L) ?: 0L
  } catch (_: Throwable) { 0L }

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

    const val RESULT_POSITION_MS = "orion.player.result.positionMs"
    const val RESULT_DURATION_MS = "orion.player.result.durationMs"
    const val RESULT_COMPLETED = "orion.player.result.completed"
    const val RESULT_PRESENTATION = "orion.player.result.presentation"
    const val RESULT_CODE = "orion.player.result.code"
    const val RESULT_MESSAGE = "orion.player.result.message"

    private const val MAX_SUBTITLE_CHARS = 10 * 1024 * 1024
    private const val PROGRESS_EVENT_INTERVAL_MS = 1_000L
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
    ): Intent = Intent(context, OrionPlayerActivity::class.java).apply {
      putExtra(EXTRA_ASSET_ID, assetId)
      putExtra(EXTRA_INITIAL_POSITION_MS, initialPositionMs.coerceAtLeast(0L))
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_PRESENTATION, presentation)
    }
  }
}
