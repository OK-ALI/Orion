package com.okali.orion.playback

import java.net.URL
import java.util.Locale

/**
 * Broker-backed authority envelope for the native yt-dlp boundary.
 *
 * The envelope intentionally contains no cookies, Authorization header, Referer,
 * Origin or arbitrary provider headers. Those values are request-scoped by
 * OrionDownloadRequestContextBroker and must never become process-wide yt-dlp
 * options. Raw HLS/DASH provider authority remains fail-closed; only an Orion
 * loopback gateway may clear network enforcement for yt-dlp execution.
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

  /**
   * Converts a broker-issued provider authority into an execution authority
   * only after Orion has replaced provider networking with a strict local
   * loopback gateway.
   *
   * Provider credentials and global provider headers are deliberately removed.
   */
  fun enforceViaLoopbackGateway(
    authority: OrionYtDlpAuthority,
    localRootUrl: String,
  ): OrionYtDlpAuthority? {
    if (
      authority.transferKind !in
      setOf(
        "hls",
        "dash",
      ) ||
      !authority.networkEnforcementRequired
    ) {
      return null
    }

    val local =
      try {
        URL(localRootUrl)
      } catch (_: Throwable) {
        return null
      }

    if (
      local.protocol.lowercase(Locale.US) != "http" ||
      local.host != "127.0.0.1" ||
      local.port !in 1..65535 ||
      local.userInfo != null ||
      local.query != null ||
      local.ref != null ||
      !local.path.startsWith('/') ||
      local.path.length !in 2..512
    ) {
      return null
    }

    return authority.copy(
      rootUrl = local.toExternalForm(),
      safeGlobalHeaders = emptyMap(),
      scopedCredentialsRequired = false,
      networkEnforcementRequired = false,
    )
  }
}
