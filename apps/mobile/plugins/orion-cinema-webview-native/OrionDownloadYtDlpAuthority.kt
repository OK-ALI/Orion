package com.okali.orion.playback

import java.util.Locale

/**
 * Broker-backed authority envelope for the native yt-dlp boundary.
 *
 * The envelope intentionally contains no cookies, Authorization header, Referer,
 * Origin or arbitrary provider headers. Those values are request-scoped by
 * OrionDownloadRequestContextBroker and must never become process-wide yt-dlp
 * options. HLS/DASH still require a future broker-enforced network interception
 * layer before production execution can be enabled.
 */
internal data class OrionYtDlpAuthority(
  val jobId: String,
  val rootUrl: String,
  val transferKind: String,
  val safeGlobalHeaders: Map<String, String>,
  val scopedCredentialsRequired: Boolean,
  val networkEnforcementRequired: Boolean,
)

internal object OrionDownloadYtDlpAuthorityBroker {
  private val GLOBAL_SAFE_HEADER_NAMES = setOf(
    "accept",
    "accept-language",
    "user-agent",
  )

  fun issue(bound: BoundTransferContext): OrionYtDlpAuthority? {
    if (bound.transferKind !in setOf("hls", "dash")) return null
    val request = OrionDownloadRequestContextBroker.resolveForJob(
      bound.jobId,
      bound.requestContextId,
      bound.candidateId,
      bound.root.url,
    ) ?: return null
    if (request.url != bound.root.url) return null

    val safeHeaders = linkedMapOf<String, String>()
    request.headers.forEach { (name, value) ->
      if (name.lowercase(Locale.US) in GLOBAL_SAFE_HEADER_NAMES) {
        safeHeaders[name] = value
      }
    }
    val scopedCredentialsRequired =
      !request.cookieHeader.isNullOrBlank() ||
        request.headers.keys.any { it.lowercase(Locale.US) !in GLOBAL_SAFE_HEADER_NAMES }

    return OrionYtDlpAuthority(
      jobId = bound.jobId,
      rootUrl = request.url,
      transferKind = bound.transferKind,
      safeGlobalHeaders = safeHeaders.toMap(),
      scopedCredentialsRequired = scopedCredentialsRequired,
      networkEnforcementRequired = true,
    )
  }
}
