package com.okali.orion.playback

import android.content.Context
import android.util.Log
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

internal sealed class OrionYtDlpOutcome {
  data class Completed(
    val files: List<File>,
    val elapsedMs: Long,
  ) : OrionYtDlpOutcome()

  data object Paused : OrionYtDlpOutcome()
  data object Cancelled : OrionYtDlpOutcome()

  data class Failed(
    val code: String,
    val retryable: Boolean,
  ) : OrionYtDlpOutcome()
}

/**
 * Native-only yt-dlp process boundary for P10.5.
 *
 * Candidate 3 requires an explicit broker-backed authority envelope instead of
 * a generic transfer context. HLS/DASH authority is fail-closed until Orion can
 * enforce the broker boundary across yt-dlp's internal network discovery.
 */
internal object OrionDownloadYtDlpRuntime {
  private const val SOCKET_TIMEOUT_SECONDS = 20
  private const val RETRIES = 3
  private const val FRAGMENT_RETRIES = 3
  private const val CONCURRENT_FRAGMENTS = 4
  private const val MAX_HEADER_NAME_LENGTH = 80
  private const val MAX_HEADER_VALUE_LENGTH = 8 * 1024
  private val activeJobs = ConcurrentHashMap.newKeySet<String>()

  fun executeHlsGateway(
    context: Context,
    jobId: String,
    bound: BoundTransferContext,
    requestedQuality: String,
    onMeasuredMediaProgress: (Long, Int, Int) -> Unit = { _, _, _ -> },
  ): OrionYtDlpOutcome {
    val cleanJobId =
      cleanJobId(jobId)
        ?: return OrionYtDlpOutcome.Failed(
          "yt-dlp-job-invalid",
          false,
        )

    if (
      bound.jobId != cleanJobId ||
      bound.transferKind != "hls"
    ) {
      return OrionYtDlpOutcome.Failed(
        "yt-dlp-hls-boundary-mismatch",
        false,
      )
    }

    when (
      OrionDownloadJobStore.control(
        cleanJobId,
      )
    ) {
      "pause" ->
        return OrionYtDlpOutcome.Paused

      "cancel" ->
        return OrionYtDlpOutcome.Cancelled
    }

    val providerAuthority =
      OrionDownloadYtDlpAuthorityBroker
        .issue(bound)
        ?: return OrionYtDlpOutcome.Failed(
          "yt-dlp-authority-unavailable",
          false,
        )

    val gateway =
      OrionDownloadYtDlpGatewaySession
        .start(cleanJobId, onMeasuredMediaProgress)
        ?: return OrionYtDlpOutcome.Failed(
          "yt-dlp-gateway-unavailable",
          true,
        )

    return try {
      val entry =
        OrionDownloadYtDlpHlsGateway
          .prepare(
            bound = bound,
            requestedQuality =
              requestedQuality,
            session = gateway,
          )
          ?: return OrionYtDlpOutcome.Failed(
            "yt-dlp-hls-gateway-prepare-failed",
            true,
          )

      when (
        OrionDownloadJobStore.control(
          cleanJobId,
        )
      ) {
        "pause" ->
          return OrionYtDlpOutcome.Paused

        "cancel" ->
          return OrionYtDlpOutcome.Cancelled
      }

      val executionAuthority =
        OrionDownloadYtDlpAuthorityBroker
          .enforceViaLoopbackGateway(
            authority =
              providerAuthority,
            localRootUrl =
              entry.rootUrl,
          )
          ?: return OrionYtDlpOutcome.Failed(
            "yt-dlp-gateway-authority-invalid",
            false,
          )

      execute(
        context = context,
        jobId = cleanJobId,
        authority =
          executionAuthority,
        // yt-dlp's percent/total may describe one fragment, not the episode.
        // Only the gateway's completed media routes drive HLS UI progress.
        onProgress = {},
      )
    } finally {
      gateway.close()
    }
  }
  fun executeDashGateway(
    context: Context,
    jobId: String,
    bound: BoundTransferContext,
    requestedQuality: String,
    onProgress: (OrionYtDlpProgress) -> Unit = {},
  ): OrionYtDlpOutcome {
    val cleanJobId =
      cleanJobId(jobId)
        ?: return OrionYtDlpOutcome.Failed(
          "yt-dlp-job-invalid",
          false,
        )

    if (
      bound.jobId != cleanJobId ||
      bound.transferKind != "dash"
    ) {
      return OrionYtDlpOutcome.Failed(
        "yt-dlp-dash-boundary-mismatch",
        false,
      )
    }

    when (
      OrionDownloadJobStore.control(
        cleanJobId,
      )
    ) {
      "pause" ->
        return OrionYtDlpOutcome.Paused

      "cancel" ->
        return OrionYtDlpOutcome.Cancelled
    }

    val providerAuthority =
      OrionDownloadYtDlpAuthorityBroker
        .issue(bound)
        ?: return OrionYtDlpOutcome.Failed(
          "yt-dlp-authority-unavailable",
          false,
        )

    val gateway =
      OrionDownloadYtDlpGatewaySession
        .start(cleanJobId)
        ?: return OrionYtDlpOutcome.Failed(
          "yt-dlp-gateway-unavailable",
          true,
        )

    return try {
      val entry =
        OrionDownloadYtDlpDashGateway
          .prepare(
            bound = bound,
            requestedQuality =
              requestedQuality,
            session = gateway,
          )
          ?: return OrionYtDlpOutcome.Failed(
            "yt-dlp-dash-gateway-prepare-failed",
            true,
          )

      when (
        OrionDownloadJobStore.control(
          cleanJobId,
        )
      ) {
        "pause" ->
          return OrionYtDlpOutcome.Paused

        "cancel" ->
          return OrionYtDlpOutcome.Cancelled
      }

      val executionAuthority =
        OrionDownloadYtDlpAuthorityBroker
          .enforceViaLoopbackGateway(
            authority =
              providerAuthority,
            localRootUrl =
              entry.rootUrl,
          )
          ?: return OrionYtDlpOutcome.Failed(
            "yt-dlp-gateway-authority-invalid",
            false,
          )

      execute(
        context = context,
        jobId = cleanJobId,
        authority =
          executionAuthority,
        onProgress =
          onProgress,
      )
    } finally {
      gateway.close()
    }
  }
  fun execute(
    context: Context,
    jobId: String,
    authority: OrionYtDlpAuthority,
    onProgress: (OrionYtDlpProgress) -> Unit = {},
  ): OrionYtDlpOutcome {
    val cleanJobId = cleanJobId(jobId) ?: return OrionYtDlpOutcome.Failed("yt-dlp-job-invalid", false)
    if (authority.jobId != cleanJobId) return OrionYtDlpOutcome.Failed("yt-dlp-authority-mismatch", false)
    if (authority.transferKind !in setOf("hls", "dash")) {
      return OrionYtDlpOutcome.Failed("yt-dlp-authority-kind-invalid", false)
    }
    val rootUrl = safeHttpUrl(authority.rootUrl) ?: return OrionYtDlpOutcome.Failed("yt-dlp-root-invalid", false)
    if (authority.scopedCredentialsRequired) {
      return OrionYtDlpOutcome.Failed("yt-dlp-scoped-credentials-required", false)
    }
    if (authority.networkEnforcementRequired) {
      return OrionYtDlpOutcome.Failed("yt-dlp-network-enforcement-required", false)
    }
    if (!activeJobs.add(cleanJobId)) return OrionYtDlpOutcome.Failed("yt-dlp-job-active", false)

    val workDir = stagingDir(context, cleanJobId)
    if (!workDir.exists() && !workDir.mkdirs()) {
      activeJobs.remove(cleanJobId)
      return OrionYtDlpOutcome.Failed("yt-dlp-staging-unavailable", true)
    }
    if (!workDir.isDirectory) {
      activeJobs.remove(cleanJobId)
      return OrionYtDlpOutcome.Failed("yt-dlp-staging-unavailable", true)
    }

    val processId = processId(cleanJobId)
    var executionPhase = "prepare"
    return try {
      val appContext = context.applicationContext

      executionPhase = "ffmpeg-init"
      FFmpeg.getInstance().init(appContext)

      executionPhase = "ytdlp-init"
      YoutubeDL.getInstance().init(appContext)

      Log.i(
        "OrionDownloadStage",
        "stage=yt-dlp runtime=${runtimeBinaryDiagnostic(appContext)}",
      )

      executionPhase = "request-build"
      val request = buildRequest(rootUrl, authority, workDir)

      executionPhase = "execute"
      Log.i(
        "OrionDownloadStage",
        "stage=yt-dlp phase=execute kind=${authority.transferKind} downloader=${if (authority.transferKind == "hls") "ffmpeg" else "default"}",
      )
      val response = YoutubeDL.getInstance().execute(request, processId, false) { percent, eta, line ->
        when (OrionDownloadJobStore.control(cleanJobId)) {
          "pause", "cancel" -> YoutubeDL.getInstance().destroyProcessById(processId)
          else -> OrionYtDlpProgressParser.parse(line, percent, eta)?.let(onProgress)
        }
      }

      executionPhase = "response"
      if (response.exitCode != 0) {
        Log.i("OrionDownloadStage", "stage=yt-dlp exit=${response.exitCode}")
        OrionYtDlpOutcome.Failed("yt-dlp-process-failed", true)
      } else {
        val output = OrionFinalizedArtifactOwner.stagingOutput(workDir)
        if (output == null) OrionYtDlpOutcome.Failed("yt-dlp-output-contract-invalid", false)
        else OrionYtDlpOutcome.Completed(listOf(output), response.elapsedTime.coerceAtLeast(0L))
      }
    } catch (_: YoutubeDL.CanceledException) {
      when (OrionDownloadJobStore.control(cleanJobId)) {
        "pause" -> OrionYtDlpOutcome.Paused
        "cancel" -> OrionYtDlpOutcome.Cancelled
        else -> OrionYtDlpOutcome.Failed("yt-dlp-process-cancelled", true)
      }
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
      OrionYtDlpOutcome.Failed("yt-dlp-process-interrupted", true)
    } catch (error: Throwable) {
      Log.i(
        "OrionDownloadStage",
        "stage=yt-dlp exception=${error.javaClass.simpleName.take(48)} cause=${error.cause?.javaClass?.simpleName?.take(48) ?: "none"} phase=$executionPhase reason=${diagnosticReason(error)} fingerprint=${diagnosticFingerprint(error)}",
      )
      OrionYtDlpOutcome.Failed("yt-dlp-runtime-failed", true)
    } finally {
      activeJobs.remove(cleanJobId)
    }
  }

  fun stop(jobId: String): Boolean {
    val clean = cleanJobId(jobId) ?: return false
    return YoutubeDL.getInstance().destroyProcessById(processId(clean))
  }

  fun stagingDir(context: Context, jobId: String): File =
    File(context.filesDir, "orion-downloads/partial/${cleanJobId(jobId) ?: "invalid"}-ytdlp")

  private fun buildRequest(rootUrl: String, authority: OrionYtDlpAuthority, workDir: File): YoutubeDLRequest {
    val request = YoutubeDLRequest(rootUrl)
      .addOption("--no-playlist")
      .addOption("--newline")
      .addOption("--progress-template", OrionYtDlpProgressParser.PROGRESS_TEMPLATE)
      .addOption("--continue")
      .addOption("--merge-output-format", "mp4")
      .addOption("--remux-video", "mp4")
      .addOption("--socket-timeout", SOCKET_TIMEOUT_SECONDS)
      .addOption("--retries", RETRIES)
      .addOption("--fragment-retries", FRAGMENT_RETRIES)
      .addOption("--concurrent-fragments", CONCURRENT_FRAGMENTS)
      .addOption("--restrict-filenames")
      .addOption("--output", File(workDir, "media.%(ext)s").absolutePath)

    // VOD HLS must be written by ffmpeg, not the native HLS concatenator.
    // Native HLS can leave MPEG-TS bytes under an .mp4 name, which Orion's
    // strict finalized-media verifier must reject. Keep this protocol-scoped
    // so DASH retains its existing downloader path.
    if (authority.transferKind == "hls") {
      request.addOption("--downloader", "m3u8:ffmpeg")
    }

    authority.safeGlobalHeaders.forEach { (name, value) ->
      val safeName = safeHeaderName(name) ?: return@forEach
      val safeValue = safeHeaderValue(value) ?: return@forEach
      request.addOption("--add-header", "$safeName:$safeValue")
    }
    return request
  }

  private fun runtimeBinaryDiagnostic(context: Context): String {
    val nativeDir = File(context.applicationInfo.nativeLibraryDir)
    return "ffmpeg=${binaryState(File(nativeDir, "libffmpeg.so"))} python=${binaryState(File(nativeDir, "libpython.so"))}"
  }

  private fun binaryState(file: File): String = when {
    !file.isFile -> "missing"
    !file.canExecute() -> "not-executable"
    file.length() <= 0L -> "empty"
    else -> "ready"
  }

  private fun diagnosticReason(error: Throwable): String {
    if (error !is YoutubeDLException) return "runtime-${error.javaClass.simpleName.lowercase(Locale.US).take(32)}"
    val message = error.message.orEmpty().lowercase(Locale.US)
    return when {
      "ffmpeg" in message && ("not found" in message || "no such file" in message || "not installed" in message || "unable to find" in message) -> "ffmpeg-not-found"
      "ffprobe" in message && ("not found" in message || "no such file" in message) -> "ffprobe-not-found"
      "permission denied" in message -> "permission-denied"
      "no such file or directory" in message -> "file-not-found"
      "http error 403" in message || "403 forbidden" in message -> "http-403"
      "http error 401" in message || "401 unauthorized" in message -> "http-401"
      "timed out" in message || "timeout" in message -> "network-timeout"
      "connection refused" in message -> "connection-refused"
      "broken pipe" in message -> "broken-pipe"
      "unsupported url" in message -> "unsupported-url"
      "requested format is not available" in message -> "format-unavailable"
      "external downloader" in message && "fail" in message -> "external-downloader-failed"
      "invalid data found" in message -> "invalid-media"
      "unable to download" in message -> "download-failed"
      else -> "ytdlp-unclassified"
    }
  }

  private fun diagnosticFingerprint(error: Throwable): String {
    val message = error.message?.takeIf { it.isNotBlank() } ?: return "none"
    return sha256(message).take(16)
  }

  private fun safeHttpUrl(raw: String): String? = try {
    val url = URL(raw)
    if (url.protocol.lowercase(Locale.US) !in setOf("http", "https")) null else url.toExternalForm()
  } catch (_: Throwable) { null }

  private fun safeHeaderName(raw: String): String? = raw.trim()
    .takeIf { it.length in 1..MAX_HEADER_NAME_LENGTH }
    ?.takeIf { it.matches(Regex("^[A-Za-z0-9!#$%&'*+.^_`|~-]+$")) }

  private fun safeHeaderValue(raw: String?): String? = raw
    ?.takeIf { it.length <= MAX_HEADER_VALUE_LENGTH }
    ?.takeIf { !it.contains('\r') && !it.contains('\n') && !it.contains('\u0000') }
    ?.takeIf { it.isNotBlank() }

  private fun cleanJobId(raw: String): String? = raw.trim()
    .takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,120}$")) }

  private fun processId(jobId: String): String = "orionp105-${sha256(jobId).take(24)}"

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { byte -> "%02x".format(byte) }
}
