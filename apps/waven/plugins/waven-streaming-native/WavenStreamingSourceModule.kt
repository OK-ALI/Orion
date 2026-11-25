package com.okali.waven.streaming

import android.net.Uri
import android.os.SystemClock
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.net.HttpURLConnection
import java.net.URL
import java.io.File
import java.security.MessageDigest

/** Source extraction only. Media3 remains the sole playback/session owner. */
class WavenStreamingSourceModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private val cancellationExecutor = Executors.newSingleThreadExecutor()
  private val handler = Handler(Looper.getMainLooper())
  private data class Request(val promise: Promise, val finished: AtomicBoolean = AtomicBoolean(false), @Volatile var connection: HttpURLConnection? = null)
  private val requests = ConcurrentHashMap<String, Request>()
  @Volatile private var lastStage = "idle"
  @Volatile private var lastFailure = "none"
  @Volatile private var lastClient = "unknown"
  @Volatile private var lastDocumentBytes = -1L
  @Volatile private var continuationChecked = false
  private var extractorReady = false
  private var extractorRuntimeReady = false
  private val extractorVersion = "2026.08.19"
  private val extractorHash = "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"
  override fun getName() = "WavenStreamingSource"

  private fun phase8ValidationOnly(): Boolean =
    context.applicationContext.packageName == "com.okali.waven.phase8validation"

  /** Strict package guard and two allowlists prevent logging credentials/media identifiers. */
  @ReactMethod fun traceValidation(event: String, detail: String, durationMs: Double, count: Double) {
    if (!phase8ValidationOnly()) return
    val events = setOf("connectivity", "provider", "probe", "recovery", "queue_wait", "remote_work", "new_releases", "category", "play", "handoff", "source")
    if (event !in events) return
    val group = "(?:metadata|dashboard|discovery|stream|charts|other)"
    val accepted = when (event) {
      "connectivity" -> Regex("^(?:ONLINE|OFFLINE|RECOVERING|DEGRADED):(?:paused|internet|providers|cloud|pending|metadata|ready)$").matches(detail) || Regex("^transport:(?:wifi|cellular|ethernet|bluetooth|vpn|none|unknown|other)$").matches(detail)
      "provider", "probe" -> Regex("^$group:(?:up|down)$").matches(detail)
      "queue_wait", "remote_work" -> Regex("^$group$").matches(detail)
      "source" -> Regex("^$group:(?:ok|timeout|auth|rate|failure|offline|cancelled)$").matches(detail)
      "recovery" -> detail in setOf("incomplete", "complete", "metadata:begin", "metadata:done", "metadata:failed", "metadata:cancelled", "pending_releases", "pending_charts")
      "new_releases" -> detail in setOf("begin", "cache", "cancelled", "failed", "ready", "empty", "error_count", "pending")
      "category" -> detail in setOf("cache", "begin", "cancelled", "failed", "ready", "empty")
      "play" -> detail in setOf("begin", "source_ready", "failed")
      "handoff" -> detail == "complete"
      else -> false
    }
    if (!accepted) return
    val safeDuration = if (durationMs.isFinite()) durationMs.toLong().coerceIn(0L, 120_000L) else 0L
    val safeCount = if (count.isFinite()) count.toInt().coerceIn(0, 999) else 0
    Log.i("WAVEN_P08_DIAG", "event=$event detail=$detail ms=$safeDuration count=$safeCount")
  }

  private fun nativeTrace(stage: String, durationMs: Long = 0L) {
    if (phase8ValidationOnly()) Log.i("WAVEN_P08_DIAG", "event=native detail=$stage ms=${durationMs.coerceIn(0L, 120_000L)} count=0")
  }

  @ReactMethod
  fun resolve(videoId: String, requestId: String, promise: Promise) {
    if (!Regex("^[A-Za-z0-9_-]{11}$").matches(videoId) || !Regex("^[A-Za-z0-9_-]{1,96}$").matches(requestId)) {
      promise.reject("WAVEN_SOURCE_INVALID", "This song has no supported playback identity."); return
    }
    val requestedAt = SystemClock.elapsedRealtime()
    val request = Request(promise)
    if (requests.size >= 4) { promise.reject("WAVEN_SOURCE_PENDING", "Source resolution is busy. Try again shortly."); return }
    if (requests.putIfAbsent(requestId, request) != null) { promise.reject("WAVEN_SOURCE_PENDING", "Source resolution is already active."); return }
    val timeout = Runnable { finishFailure(requestId, request, "WAVEN_SOURCE_TIMEOUT", "Audio source resolution timed out. Try again.") }
    handler.postDelayed(timeout, 40_000L)
    executor.execute {
      try {
        if (request.finished.get()) return@execute
        nativeTrace("executor_wait", SystemClock.elapsedRealtime() - requestedAt)
        lastStage = "initialize"; lastFailure = "none"; continuationChecked = false
        val initAt = SystemClock.elapsedRealtime()
        ensureExtractorRuntimeReady()
        nativeTrace("init", SystemClock.elapsedRealtime() - initAt)
        if (request.finished.get()) return@execute
        val command = YoutubeDLRequest("https://music.youtube.com/watch?v=$videoId")
          .addOption("--dump-single-json").addOption("--skip-download").addOption("--no-playlist")
          .addOption("--no-warnings").addOption("--no-cache-dir").addOption("--no-check-formats")
          .addOption("--socket-timeout", "12").addOption("--retries", "1")
          .addOption("--extractor-args", "youtube:player_client=visionos")
          .addOption("--format", "bestaudio[ext=m4a]/bestaudio")
        lastStage = "extract"
        val extractAt = SystemClock.elapsedRealtime()
        val response = YoutubeDL.getInstance().execute(command, requestId, false) { _, _, _ -> }
        nativeTrace("extract", SystemClock.elapsedRealtime() - extractAt)
        if (request.finished.get()) return@execute
        if (response.exitCode != 0) throw IllegalStateException("source-resolution-failed")
        lastStage = "parse"
        val data = JSONObject(response.out)
        if (data.optString("id") != videoId) throw IllegalStateException("source-identity-mismatch")
        val selected = data.optJSONArray("requested_downloads")?.optJSONObject(0) ?: data
        val source = Uri.parse(selected.optString("url"))
        lastClient = source.getQueryParameter("c") ?: "unknown"
        val host = source.host.orEmpty().lowercase()
        if (source.scheme != "https" || source.userInfo != null || !(host.endsWith(".googlevideo.com") || host == "googlevideo.com")) throw IllegalStateException("source-invalid")
        val expiry = source.getQueryParameter("expire")?.toLongOrNull()?.times(1000) ?: (System.currentTimeMillis() + 15 * 60_000L)
        if (expiry <= System.currentTimeMillis() + 30_000L) throw IllegalStateException("source-expired")
        val allowedHeaders = mutableMapOf<String, String>()
        val rawHeaders = selected.optJSONObject("http_headers") ?: data.optJSONObject("http_headers")
        for (name in listOf("User-Agent", "Referer", "Origin")) {
          val value = rawHeaders?.optString(name).orEmpty()
          if (value.isNotBlank() && !value.contains('\n') && !value.contains('\r')) allowedHeaders[name] = value
        }
        lastStage = "probe"
        if (request.finished.get()) return@execute
        val probeAt = SystemClock.elapsedRealtime()
        val connection = URL(source.toString()).openConnection() as HttpURLConnection
        request.connection = connection
        if (request.finished.get()) { connection.disconnect(); return@execute }
        try {
          connection.connectTimeout = 8_000; connection.readTimeout = 8_000
          connection.setRequestProperty("Range", "bytes=0-15")
          allowedHeaders.forEach { (name, value) -> connection.setRequestProperty(name, value) }
          if (connection.responseCode !in setOf(200, 206)) throw IllegalStateException("source-http-${connection.responseCode}")
          lastDocumentBytes = connection.getHeaderField("Content-Range")?.substringAfterLast('/')?.toLongOrNull() ?: source.getQueryParameter("clen")?.toLongOrNull() ?: -1L
          connection.inputStream.use { if (it.read(ByteArray(16)) <= 0) throw IllegalStateException("source-empty") }
        } finally { connection.disconnect(); request.connection = null; nativeTrace("probe_prefix", SystemClock.elapsedRealtime() - probeAt) }
        if (request.finished.get()) return@execute
        // Reject the free-prefix-only response before a song replaces the user's queue.
        val total = lastDocumentBytes
        if (total <= 0) throw IllegalStateException("source-length-unavailable")
        if (total > 1024 * 1024) {
          val continuationAt = SystemClock.elapsedRealtime()
          val continuation = URL(source.toString()).openConnection() as HttpURLConnection
          request.connection = continuation
          if (request.finished.get()) { continuation.disconnect(); return@execute }
          try {
            continuation.connectTimeout = 8_000; continuation.readTimeout = 8_000
            continuation.setRequestProperty("Range", "bytes=1048576-${minOf(total - 1, 2097151)}")
            allowedHeaders.forEach { (name, value) -> continuation.setRequestProperty(name, value) }
            if (continuation.responseCode !in setOf(200, 206)) throw IllegalStateException("source-http-${continuation.responseCode}")
            continuation.inputStream.use { if (it.read(ByteArray(16)) <= 0) throw IllegalStateException("source-empty") }
            continuationChecked = true
          } finally { continuation.disconnect(); request.connection = null; nativeTrace("probe_later", SystemClock.elapsedRealtime() - continuationAt) }
        }
        if (request.finished.get()) return@execute
        val result = Arguments.createMap().apply {
          putString("uri", source.toString()); putDouble("expiresAtMs", expiry.toDouble())
          putString("mimeType", if (selected.optString("ext") == "m4a") "audio/mp4" else "audio/webm")
          val headers = Arguments.createMap()
          allowedHeaders.forEach { (name, value) -> headers.putString(name, value) }
          putMap("headers", headers)
        }
        lastStage = "resolved"
        nativeTrace("resolved", SystemClock.elapsedRealtime() - requestedAt)
        if (request.finished.compareAndSet(false, true)) promise.resolve(result)
      } catch (error: Throwable) {
        // Classify locally; raw extractor stderr, media URLs and headers never cross JS/logs.
        val detail = error.message.orEmpty().lowercase()
        lastFailure = when {
          detail.contains("not a bot") || detail.contains("po token") -> "provider-challenge"
          detail.contains("sign in") || detail.contains("login") -> "authentication-required"
          detail.contains("source-http-403") -> "source-forbidden"
          detail.contains("no video formats") || detail.contains("requested format") -> "no-audio-format"
          detail.contains("timed out") || detail.contains("unable to download") -> "provider-network"
          else -> "source-unavailable"
        }
        nativeTrace("failure_" + lastFailure, SystemClock.elapsedRealtime() - requestedAt)
        if (request.finished.compareAndSet(false, true)) promise.reject("WAVEN_SOURCE_UNAVAILABLE", "This song's audio source is unavailable. Try another song or retry.")
      } finally { request.connection?.disconnect(); handler.removeCallbacks(timeout); requests.remove(requestId, request) }
    }
  }
  /** Opportunistically prepare the bundled offline extractor before the first user tap.
   * Runs only on the existing single-thread source executor. No network or media playback. */
  @ReactMethod fun warmUp(promise: Promise) {
    executor.execute {
      val warmStart = SystemClock.elapsedRealtime()
      try { ensureExtractorRuntimeReady(); nativeTrace("warmup_ok", SystemClock.elapsedRealtime() - warmStart); promise.resolve(true) }
      catch (_: Throwable) { nativeTrace("warmup_failed", SystemClock.elapsedRealtime() - warmStart); promise.reject("WAVEN_SOURCE_WARMUP_FAILED", "Playback preparation is unavailable.") }
    }
  }
  private fun ensureExtractorRuntimeReady() {
    if (extractorRuntimeReady) return
    installBundledExtractor()
    YoutubeDL.getInstance().init(context.applicationContext)
    extractorRuntimeReady = true
  }
  /** Offline, hash-pinned code asset. No automatic updater or network code download. */
  private fun installBundledExtractor() {
    if (extractorReady) return
    val directory = File(File(context.noBackupFilesDir, YoutubeDL.baseName), YoutubeDL.ytdlpDirName)
    if (!directory.isDirectory && !directory.mkdirs()) throw IllegalStateException("source-runtime-unavailable")
    val target = File(directory, YoutubeDL.ytdlpBin)
    fun hash(file: File): String {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().use { stream ->
        val buffer = ByteArray(8192)
        while (true) { val read = stream.read(buffer); if (read < 0) break; digest.update(buffer, 0, read) }
      }
      return digest.digest().joinToString("") { "%02x".format(it) }
    }
    if (!target.isFile || hash(target) != extractorHash) {
      val temporary = File(directory, "yt-dlp.waven-new")
      context.assets.open("waven-source/yt-dlp-$extractorVersion").use { source -> temporary.outputStream().use { source.copyTo(it) } }
      if (hash(temporary) != extractorHash || !temporary.renameTo(target)) throw IllegalStateException("source-runtime-integrity")
    }
    extractorReady = true
  }
  private fun finishFailure(id: String, request: Request, code: String, message: String) {
    if (request.finished.compareAndSet(false, true)) {
      // Release a cancelled prefix/later-range probe before the next selected song.
      // Keep both access checks; never reuse a failed or signed source lease.
      requests.remove(id, request)
      request.promise.reject(code, message)
      // The deadline callback runs on Android's main looper. Never disconnect
      // sockets or destroy an extractor process on that thread.
      try { cancellationExecutor.execute {
        try { request.connection?.disconnect() } catch (_: Throwable) { }
        try { YoutubeDL.getInstance().destroyProcessById(id) } catch (_: Throwable) { }
      } } catch (_: java.util.concurrent.RejectedExecutionException) { /* Module already invalidated. */ }
    }
  }
  @ReactMethod fun cancel(requestId: String) { requests[requestId]?.let { finishFailure(requestId, it, "WAVEN_SOURCE_CANCELLED", "Source resolution cancelled.") } }
  @ReactMethod fun getDiagnostics(promise: Promise) { promise.resolve(Arguments.createMap().apply { putString("stage", lastStage); putString("failure", lastFailure); putString("client", lastClient); putString("extractorVersion", if (extractorReady) extractorVersion else "uninitialized"); putDouble("documentBytes", lastDocumentBytes.toDouble()); putBoolean("continuationChecked", continuationChecked) }) }
  override fun invalidate() {
    requests.forEach { (id, request) -> finishFailure(id, request, "WAVEN_SOURCE_CANCELLED", "Source resolution cancelled.") }
    executor.shutdownNow(); cancellationExecutor.shutdown(); super.invalidate()
  }
}
