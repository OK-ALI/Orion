package com.okali.orion.playback

import android.content.Context
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

internal data class OrionYtDlpProgress(
  val percent: Float,
  val etaSeconds: Long?,
)

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
        .start(cleanJobId)
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
        onProgress =
          onProgress,
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
    return try {
      val appContext = context.applicationContext
      FFmpeg.getInstance().init(appContext)
      YoutubeDL.getInstance().init(appContext)
      val request = buildRequest(rootUrl, authority, workDir)
      val response = YoutubeDL.getInstance().execute(request, processId, false) { percent, eta, _ ->
        when (OrionDownloadJobStore.control(cleanJobId)) {
          "pause", "cancel" -> YoutubeDL.getInstance().destroyProcessById(processId)
          else -> onProgress(OrionYtDlpProgress(
            percent = if (percent.isFinite()) percent.coerceIn(0f, 100f) else 0f,
            etaSeconds = eta.takeIf { it >= 0L },
          ))
        }
      }
      if (response.exitCode != 0) {
        OrionYtDlpOutcome.Failed("yt-dlp-process-failed", true)
      } else {
        val outputs = finalizedOutputs(workDir)
        if (outputs.isEmpty()) OrionYtDlpOutcome.Failed("yt-dlp-output-missing", false)
        else OrionYtDlpOutcome.Completed(outputs, response.elapsedTime.coerceAtLeast(0L))
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
    } catch (_: Throwable) {
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
      .addOption("--continue")
      .addOption("--merge-output-format", "mp4")
      .addOption("--remux-video", "mp4")
      .addOption("--socket-timeout", SOCKET_TIMEOUT_SECONDS)
      .addOption("--retries", RETRIES)
      .addOption("--fragment-retries", FRAGMENT_RETRIES)
      .addOption("--concurrent-fragments", CONCURRENT_FRAGMENTS)
      .addOption("--restrict-filenames")
      .addOption("--output", File(workDir, "media.%(ext)s").absolutePath)

    authority.safeGlobalHeaders.forEach { (name, value) ->
      val safeName = safeHeaderName(name) ?: return@forEach
      val safeValue = safeHeaderValue(value) ?: return@forEach
      request.addOption("--add-header", "$safeName:$safeValue")
    }
    return request
  }

  private fun finalizedOutputs(workDir: File): List<File> =
    workDir.listFiles().orEmpty()
      .filter { file ->
        file.isFile &&
          file.length() > 0L &&
          !file.name.endsWith(".part", true) &&
          !file.name.endsWith(".ytdl", true) &&
          OrionDownloadOwnershipPolicy.canonicalContained(workDir, file)
      }
      .sortedBy { it.name }

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
