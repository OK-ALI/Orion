package com.okali.orion.playback

import android.net.Uri
import android.os.StatFs
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.HttpURLConnection
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URL
import java.security.MessageDigest
import java.util.LinkedHashMap
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.min

/**
 * In-memory, native-only download request-context broker.
 *
 * Raw URLs, request headers, cookies and authorization material never cross the
 * React bridge and are never persisted. JavaScript can only bind an opaque,
 * preflighted candidate to a job id. Future native transfer code must resolve
 * requests through [resolveForJob], which accepts only the selected root or
 * descendants discovered from an authorized manifest.
 */
internal object OrionDownloadRequestContextBroker {
  private const val EVENT_NAME = "OrionDownloadCandidate"
  private const val DIAGNOSTIC_TAG = "OrionP102Candidate"
  private const val DEFAULT_CONTEXT_TTL_MS = 30L * 60L * 1000L
  private const val CONNECT_TIMEOUT_MS = 6_000
  private const val READ_TIMEOUT_MS = 6_000
  private const val MAX_MANIFEST_BYTES = 256 * 1024
  private const val MAX_PREFLIGHT_DESCENDANTS = 512
  private const val MAX_HLS_PLAYLIST_DESCENT = 4
  private const val MAX_JOB_AUTHORIZED_URLS = 20_000
  private const val MAX_CONTEXTS = 24
  private const val MAX_OPAQUE_PROBES_PER_SESSION = 36
  private const val MAX_OBSERVED_REQUESTS_PER_SESSION = 256

  private val executor = Executors.newFixedThreadPool(2)
  private val contexts = LinkedHashMap<String, CapturedContext>()
  private val candidateByFingerprint = mutableMapOf<String, String>()
  private val physicalTraceKeys = linkedSetOf<String>()
  private val opaqueProbeCounts = mutableMapOf<String, Int>()
  private val observedRequestMaterial = mutableMapOf<String, LinkedHashMap<String, CapturedRequestMaterial>>()

  fun observeRequest(
    reactContext: ReactContext,
    request: WebResourceRequest,
    sourceId: String,
    sessionId: String,
    providerClass: String?,
    downloadCaptureEnabled: Boolean,
    allowedMediaOrigins: List<String>,
    observationChannel: String = "webview",
  ) {
    tracePhysicalOnce(
      key = "$sessionId:$observationChannel:${if (request.isForMainFrame) "main" else "subresource"}",
      message = buildString {
        append("stage=observer")
        append(" channel=").append(observationChannel.take(24))
        append(" source=").append(sourceId.take(40))
        append(" capture=").append(downloadCaptureEnabled)
        append(" frame=").append(if (request.isForMainFrame) "main" else "subresource")
        append(" method=").append(request.method?.uppercase(Locale.US)?.take(12) ?: "unknown")
      },
    )
    if (!downloadCaptureEnabled || request.isForMainFrame) return
    val uri = request.url ?: return
    val scheme = uri.scheme?.lowercase(Locale.US)
    if (scheme != "http" && scheme != "https") {
      tracePhysicalOnce(
        key = "$sessionId:scheme-rejected",
        message = "stage=scheme-rejected source=${sourceId.take(40)}",
      )
      return
    }
    val method = request.method?.uppercase(Locale.US).orEmpty()
    if (method.isNotEmpty() && method != "GET") {
      tracePhysicalOnce(
        key = "$sessionId:method-rejected",
        message = "stage=method-rejected source=${sourceId.take(40)} method=${method.take(12)}",
      )
      return
    }
    var opaqueProbe = false
    val rawUrl = uri.toString()
    rememberObservedRequest(sessionId, rawUrl, request.requestHeaders)

    val manifestKind = classifyObservedRoot(uri, request.requestHeaders) ?: run {
      if (!shouldProbeOpaqueRoot(uri, request.requestHeaders, allowedMediaOrigins, sessionId)) {
        tracePhysicalOnce(
          key = "$sessionId:shape-rejected",
          message = "stage=shape-rejected source=${sourceId.take(40)}",
        )
        return
      }
      opaqueProbe = true
      "extensionless"
    }
    tracePhysicalOnce(
      key = "$sessionId:classified:$manifestKind",
      message = "stage=classified source=${sourceId.take(40)} kind=$manifestKind",
    )

    val fingerprint = sha256("$sessionId\n$sourceId\n$rawUrl")
    val candidateId: String
    val context: CapturedContext
    synchronized(this) {
      cleanupExpiredLocked(System.currentTimeMillis())
      val existingId = candidateByFingerprint[fingerprint]
      if (existingId != null && contexts.containsKey(existingId)) return
      if (opaqueProbe) {
        val used = opaqueProbeCounts[sessionId] ?: 0
        if (used >= MAX_OPAQUE_PROBES_PER_SESSION) return
        opaqueProbeCounts[sessionId] = used + 1
        tracePhysicalOnce(
          key = "$sessionId:opaque-probe",
          message = "stage=opaque-probe budget=$MAX_OPAQUE_PROBES_PER_SESSION",
        )
      }
      candidateId = "mob-${fingerprint.take(24)}"
      val requestContextId = UUID.randomUUID().toString()
      val capturedAt = System.currentTimeMillis()
      val expiry = classifyExpiry(uri, request.requestHeaders, capturedAt)
      context = CapturedContext(
        candidateId = candidateId,
        requestContextId = requestContextId,
        sourceId = sourceId,
        sessionId = sessionId,
        providerClass = providerClass?.take(40),
        rawUrl = rawUrl,
        requestHeaders = request.requestHeaders.toMap(),
        cookieHeader = captureCookie(rawUrl, request.requestHeaders),
        observedManifestKind = manifestKind,
        expiry = expiry.kind,
        expiresAt = expiry.expiresAt,
        capturedAt = capturedAt,
        allowedOrigins = buildAllowedOrigins(rawUrl, allowedMediaOrigins),
        opaqueProbe = opaqueProbe,
      )
      contexts[candidateId] = context
      candidateByFingerprint[fingerprint] = candidateId
      trimLocked()
    }

    executor.execute { preflightAndEmit(reactContext, context) }
  }

  fun bindRequestContext(candidateId: String, jobId: String): BoundContextResult? {
    val cleanJobId = jobId.trim().takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,120}$")) } ?: return null
    synchronized(this) {
      cleanupExpiredLocked(System.currentTimeMillis())
      val context = contexts[candidateId] ?: return null
      if (context.preflightState != "ready" || !context.requestContextReady) return null
      if (context.boundJobId != null && context.boundJobId != cleanJobId) return null
      context.boundJobId = cleanJobId
      return BoundContextResult(context.requestContextId, context.expiresAt)
    }
  }

  fun releaseSession(sessionId: String) {
    synchronized(this) {
      opaqueProbeCounts.remove(sessionId)
      val observed = observedRequestMaterial.remove(sessionId)
      // The player may close immediately after startJob binds a candidate.
      // Freeze only this session's bounded, exact observations for bound jobs.
      // A late WebView callback must not add trust after session release.
      val snapshot = observed?.mapValues { (_, material) ->
        CapturedRequestMaterial(material.headers.toMap(), material.cookieHeader)
      } ?: emptyMap()
      contexts.values.filter { it.sessionId == sessionId && it.boundJobId != null }
        .forEach {
          it.boundObservedRequestMaterial = snapshot
          it.sessionReleased = true
        }
      val remove = contexts.values
        .filter { it.sessionId == sessionId && it.boundJobId == null }
        .map { it.candidateId }
      remove.forEach(::removeLocked)
    }
  }

  fun releaseJob(jobId: String) {
    synchronized(this) {
      val remove = contexts.values.filter { it.boundJobId == jobId }.map { it.candidateId }
      remove.forEach(::removeLocked)
    }
  }

  /** Native-only root handoff for P10.3. Raw request material never crosses React. */
  internal fun resolveRootForJob(
    jobId: String,
    requestContextId: String,
    candidateId: String,
  ): AuthorizedTransferSeed? {
    synchronized(this) {
      cleanupExpiredLocked(System.currentTimeMillis())
      val context = contexts[candidateId] ?: return null
      if (context.boundJobId != jobId || context.requestContextId != requestContextId) return null
      if (context.preflightState != "ready" || !context.requestContextReady) return null
      val normalized = normalizeHttpUrl(context.rawUrl) ?: return null
      if (!isSafePublicHttpUrl(normalized)) return null
      if (!context.authorizedUrls.contains(normalized)) return null
      return AuthorizedTransferSeed(
        sourceId = context.sourceId,
        resolvedKind = context.resolvedKind,
        resumable = context.resumable,
        requiredBytes = context.requiredBytes,
        request = authorizedRequestFor(context, normalized),
      )
    }
  }

  /** Native-only authorization gate for P10.3 transfer execution. */
  internal fun resolveForJob(
    jobId: String,
    requestContextId: String,
    candidateId: String,
    rawUrl: String,
  ): AuthorizedRequest? {
    synchronized(this) {
      cleanupExpiredLocked(System.currentTimeMillis())
      val context = contexts[candidateId] ?: return null
      if (context.boundJobId != jobId || context.requestContextId != requestContextId) return null
      val normalized = normalizeHttpUrl(rawUrl) ?: return null
      if (!isSafePublicHttpUrl(normalized)) return null
      if (!context.authorizedUrls.contains(normalized)) return null
      return authorizedRequestFor(context, normalized)
    }
  }

  /**
   * Native transfer code may extend the exact allowlist only from an already
   * authorized manifest and only to a destination explicitly discovered by
   * that manifest. Cross-origin descendants must also belong to a provider-
   * approved or session-observed origin; public DNS alone grants no trust.
   * Credentials are scoped to the exact observed child request.
   */
  internal fun authorizeDiscoveredDescendant(
    jobId: String,
    requestContextId: String,
    candidateId: String,
    parentUrl: String,
    childUrl: String,
  ): Boolean {
    synchronized(this) {
      val context = contexts[candidateId] ?: return false
      if (context.boundJobId != jobId || context.requestContextId != requestContextId) return false
      val parent = normalizeHttpUrl(parentUrl) ?: return false
      if (!context.authorizedUrls.contains(parent)) return false
      val child = resolveHttpUrl(parent, childUrl) ?: return false
      if (!descendantAllowed(context, child)) return false
      if (context.authorizedUrls.size >= MAX_JOB_AUTHORIZED_URLS) return false
      context.authorizedUrls.add(child)
      return true
    }
  }

  /** Redirects have no manifest-reference proof: require an approved origin or exact observation. */
  internal fun authorizeRedirectForJob(
    jobId: String,
    requestContextId: String,
    candidateId: String,
    parentUrl: String,
    redirectUrl: String,
  ): Boolean {
    synchronized(this) {
      val context = contexts[candidateId] ?: return false
      if (context.boundJobId != jobId || context.requestContextId != requestContextId) return false
      val parent = normalizeHttpUrl(parentUrl) ?: return false
      if (!context.authorizedUrls.contains(parent)) return false
      val destination = resolveHttpUrl(parent, redirectUrl) ?: return false
      if (!redirectAllowed(context, destination)) return false
      if (context.authorizedUrls.size >= MAX_JOB_AUTHORIZED_URLS) return false
      context.authorizedUrls.add(destination)
      return true
    }
  }

  private fun preflightAndEmit(reactContext: ReactContext, context: CapturedContext) {
    val now = System.currentTimeMillis()
    if (context.expiry == "expired" || (context.expiresAt != null && context.expiresAt!! <= now)) {
      finishAndEmit(
        reactContext,
        context,
        state = "expired",
        reachability = "unknown",
        resolvedKind = resolvedKindForObserved(context.observedManifestKind),
        protection = "unknown",
        requiredBytes = null,
        reasonCode = "candidate-expired",
        reason = "The captured media request has expired. Play the title again to refresh it.",
      )
      return
    }

    try {
      val result = performPreflight(context)
      if (context.opaqueProbe && result.resolvedKind !in setOf("hls", "dash")) {
        synchronized(this) { removeLocked(context.candidateId) }
        tracePhysicalOnce(
          key = "${context.sessionId}:opaque-rejected",
          message = "stage=opaque-rejected source=${context.sourceId.take(40)}",
        )
        return
      }
      val freeBytes = orionLibraryFreeBytes(reactContext)
      var state = result.state
      var reasonCode = result.reasonCode
      var reason = result.reason
      if (state == "ready" && result.requiredBytes != null && freeBytes != null && result.requiredBytes > freeBytes) {
        state = "action-required"
        reasonCode = "storage-insufficient"
        reason = "Orion Library does not currently have enough free space for this media."
      }
      finishAndEmit(
        reactContext,
        context,
        state = state,
        reachability = result.reachability,
        resolvedKind = result.resolvedKind,
        protection = result.protection,
        requiredBytes = result.requiredBytes,
        reasonCode = reasonCode,
        reason = reason,
        resumable = result.resumable,
        descendants = result.descendants,
        freeBytes = freeBytes,
      )
    } catch (_: Throwable) {
      finishAndEmit(
        reactContext,
        context,
        state = "unreachable",
        reachability = "unreachable",
        resolvedKind = resolvedKindForObserved(context.observedManifestKind),
        protection = "unknown",
        requiredBytes = null,
        reasonCode = "preflight-unreachable",
        reason = "Orion could not verify this media request. Try playback again or choose another source.",
      )
    }
  }

  private fun performPreflight(context: CapturedContext): PreflightResult {
    if (!isSafePublicHttpUrl(context.rawUrl)) {
      return PreflightResult.actionRequired("media-origin-not-public", "The media destination is outside Orion's public-network boundary.")
    }
    val connection = openConnection(context, context.rawUrl)
    try {
      val status = connection.responseCode
      if (status in 300..399) {
        val location = connection.getHeaderField("Location")
        val redirect = location?.let { resolveHttpUrl(context.rawUrl, it) }
        if (redirect == null || !redirectAllowed(context, redirect)) {
          return PreflightResult.actionRequired("redirect-not-authorized", "The media request redirects outside its approved source boundary.")
        }
        connection.disconnect()
        return performPreflightAt(context, redirect)
      }
      return inspectResponse(context, connection, status, context.rawUrl)
    } finally {
      try { connection.disconnect() } catch (_: Throwable) {}
    }
  }

  private fun performPreflightAt(context: CapturedContext, safeRedirectUrl: String): PreflightResult {
    val connection = openConnection(context, safeRedirectUrl)
    return try {
      inspectResponse(context, connection, connection.responseCode, safeRedirectUrl)
    } finally {
      try { connection.disconnect() } catch (_: Throwable) {}
    }
  }

  private fun inspectResponse(
    context: CapturedContext,
    connection: HttpURLConnection,
    status: Int,
    effectiveUrl: String,
  ): PreflightResult {
    if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) {
      return if (context.expiry == "time-bounded" || context.expiry == "session") {
        PreflightResult.expired("request-context-rejected", "The provider rejected the captured session. Play the title again to refresh it.")
      } else {
        PreflightResult.actionRequired("request-context-rejected", "The provider requires refreshed playback authorization.")
      }
    }
    if (status !in 200..299) {
      return PreflightResult.unreachable("http-unavailable", "The selected media request is not currently reachable.")
    }

    val contentType = connection.contentType?.substringBefore(';')?.trim()?.lowercase(Locale.US).orEmpty()
    var resolvedKind = resolveKind(context.observedManifestKind, contentType, null)
    var body: String? = null
    var sampledBytes: ByteArray? = null
    if (resolvedKind == "hls" || resolvedKind == "dash" || context.observedManifestKind == "extensionless") {
      sampledBytes = readBoundedBytes(connection, MAX_MANIFEST_BYTES)
      body = sampledBytes.toString(Charsets.UTF_8)
      resolvedKind = resolveKind(context.observedManifestKind, contentType, body)
    }

    if (resolvedKind == "unknown") {
      return PreflightResult.unsupported("unsupported-media-shape", "This source did not expose a supported direct, HLS, or DASH media shape.")
    }
    if (resolvedKind == "hls" && body?.let(OrionDownloadFragmentPlanner::isHlsPlaylistBody) != true) {
      return PreflightResult.unsupported("invalid-hls-manifest", "The captured HLS response is not a valid playlist.")
    }
    if (resolvedKind == "dash" && body?.contains(Regex("<MPD(?:\\s|>)", RegexOption.IGNORE_CASE)) != true) {
      return PreflightResult.unsupported("invalid-dash-manifest", "The captured DASH response is not a valid manifest.")
    }

    val protection = detectProtection(resolvedKind, body)
    if (protection == "protected") {
      return PreflightResult.protected(resolvedKind, "protected-media", "This source uses protected media that Orion cannot download.")
    }

    val discovery = when (resolvedKind) {
      "hls" -> discoverHlsDescendants(effectiveUrl, body.orEmpty(), context)
      "dash" -> discoverDashDescendants(effectiveUrl, body.orEmpty(), context)
      else -> DescendantDiscovery(emptySet(), 0)
    }
    if (discovery.deniedCount > 0) {
      return PreflightResult(
        state = "action-required",
        reachability = "reachable",
        resolvedKind = resolvedKind,
        protection = if (protection == "unknown") "unknown" else "clear",
        requiredBytes = null,
        resumable = false,
        descendants = emptySet(),
        reasonCode = "descendant-origin-not-approved",
        reason = "The manifest references media outside this source's approved request boundary.",
      )
    }
    val mediaProbe = if (resolvedKind == "direct" && sampledBytes != null) {
      probeDirectSample(effectiveUrl, contentType, sampledBytes)
    } else {
      probeFirstMedia(context, resolvedKind, effectiveUrl, body.orEmpty(), connection)
    }
    if (mediaProbe.code != null) {
      if (mediaProbe.code == "unsupported-direct-container" || mediaProbe.code == "invalid-media") {
        return PreflightResult.unsupported(mediaProbe.code, mediaProbe.reason ?: "This direct media response is not supported for offline playback.")
      }
      return PreflightResult(
        state = if (mediaProbe.code == "request-context-rejected") "expired" else "unreachable",
        reachability = "unreachable",
        resolvedKind = resolvedKind,
        protection = if (protection == "unknown") "unknown" else "clear",
        requiredBytes = null,
        resumable = false,
        descendants = emptySet(),
        reasonCode = mediaProbe.code,
        reason = mediaProbe.reason,
      )
    }
    val descendants = discovery.allowed + mediaProbe.urls
    val requiredBytes = if (resolvedKind == "direct") contentLength(connection) else null
    val resumable = resolvedKind == "hls" || resolvedKind == "dash" ||
      connection.getHeaderField("Accept-Ranges")?.contains("bytes", ignoreCase = true) == true

    return PreflightResult(
      state = "ready",
      reachability = "reachable",
      resolvedKind = resolvedKind,
      protection = if (protection == "unknown") "unknown" else "clear",
      requiredBytes = requiredBytes,
      resumable = resumable,
      descendants = descendants,
      reasonCode = null,
      reason = null,
    )
  }

  private data class MediaProbe(
    val urls: Set<String> = emptySet(),
    val code: String? = null,
    val reason: String? = null,
  )

  private fun probeDirectSample(rawUrl: String, contentType: String, bytes: ByteArray): MediaProbe {
    if (bytes.isEmpty()) return MediaProbe(code = "empty-media", reason = "The source returned no media bytes.")
    val prefix = bytes.copyOfRange(0, min(bytes.size, 256)).toString(Charsets.UTF_8).trimStart()
    if (contentType.contains("text/html") || contentType.contains("application/json") || prefix.startsWith("<html", true) || prefix.startsWith("{") || prefix.startsWith("[")) {
      return MediaProbe(code = "invalid-media", reason = "The source returned a page or data response instead of direct video media.")
    }
    val path = try { URL(rawUrl).path.lowercase(Locale.US) } catch (_: Throwable) { "" }
    val declaredMp4 = contentType in setOf("video/mp4", "video/x-m4v") || path.endsWith(".mp4") || path.endsWith(".m4v")
    val isoBmff = bytes.size >= 12 && bytes[4] == 'f'.code.toByte() && bytes[5] == 't'.code.toByte() && bytes[6] == 'y'.code.toByte() && bytes[7] == 'p'.code.toByte()
    if (!declaredMp4 && !isoBmff) {
      return MediaProbe(code = "unsupported-direct-container", reason = "This source exposed direct media, but not an MP4-compatible stream Orion can finalize safely.")
    }
    return MediaProbe()
  }

  private fun probeFirstMedia(
    context: CapturedContext,
    kind: String,
    rootUrl: String,
    manifest: String,
    directConnection: HttpURLConnection,
  ): MediaProbe {
    if (kind == "direct") {
      val type = directConnection.contentType?.substringBefore(';')?.trim()?.lowercase(Locale.US).orEmpty()
      return probeDirectSample(rootUrl, type, readBoundedBytes(directConnection, 4096))
    }
    if (kind == "hls") return probeFirstHlsMedia(context, rootUrl, manifest)

    val urls = linkedSetOf<String>()
    val plan = OrionDownloadFragmentPlanner.parseDash(rootUrl, manifest, "best")
    val mediaFragments = plan.fragments.filterNot { it.role.endsWith("-init") }
    if (plan.issueCode != null || mediaFragments.isEmpty()) {
      return MediaProbe(code = plan.issueCode ?: "media-child-missing", reason = "This source did not expose downloadable media fragments.")
    }
    val samples = linkedSetOf<OrionFragmentRequest>()
    samples.add(mediaFragments.first())
    if (mediaFragments.size > 1) samples.add(mediaFragments[mediaFragments.size / 2])
    for (sample in samples) {
      if (!descendantAllowed(context, sample.url)) {
        return MediaProbe(code = "descendant-origin-not-approved", reason = "The media request left the approved source boundary.")
      }
      urls.add(sample.url)
      // Playback requests HLS/DASH fragments with a normal GET. A synthetic
      // byte range can be rejected by a healthy media CDN, so bound only the
      // response body while retaining media-shape validation.
      val media = probeChild(context, sample.url, 4096, false, mediaBytes = true)
      if (media.code != null) return MediaProbe(code = media.code, reason = media.reason)
    }
    return MediaProbe(urls)
  }

  private fun probeFirstHlsMedia(
    context: CapturedContext,
    rootUrl: String,
    manifest: String,
  ): MediaProbe {
    val urls = linkedSetOf<String>()
    var playlistUrl = rootUrl
    var playlistBody = manifest

    repeat(MAX_HLS_PLAYLIST_DESCENT) { depth ->
      val master = OrionDownloadFragmentPlanner.selectHlsMaster(playlistUrl, playlistBody, "best")
      if (master != null) {
        val mediaUrl = master.videoPlaylistUrl
        if (!descendantAllowed(context, mediaUrl)) {
          return MediaProbe(code = "descendant-origin-not-approved", reason = "The media request left the approved source boundary.")
        }
        urls.add(mediaUrl)
        val playlist = probeChild(context, mediaUrl, MAX_MANIFEST_BYTES, false)
        if (playlist.code != null) return MediaProbe(code = playlist.code, reason = playlist.reason)
        val body = playlist.bytes.toString(Charsets.UTF_8)
        if (!OrionDownloadFragmentPlanner.isHlsPlaylistBody(body)) {
          return MediaProbe(code = "hls-child-not-playlist", reason = "The selected HLS variant did not return a media playlist.")
        }
        playlistUrl = mediaUrl
        playlistBody = body
        return@repeat
      }

      val plan = OrionDownloadFragmentPlanner.parseHlsMedia(playlistUrl, playlistBody, "video", allowAes128 = true)
      if (plan.issueCode != null || plan.mediaFragmentCount <= 0) {
        return MediaProbe(code = plan.issueCode ?: "media-child-missing", reason = "This source did not expose downloadable media fragments.")
      }
      for (keyUrl in plan.keyUrls) {
        if (!descendantAllowed(context, keyUrl)) {
          return MediaProbe(code = "descendant-origin-not-approved", reason = "The media key left the approved source boundary.")
        }
        val key = probeChild(context, keyUrl, 17, false)
        if (key.code != null) return MediaProbe(code = key.code, reason = key.reason)
        if (key.bytes.size != 16) {
          return MediaProbe(code = "hls-key-invalid", reason = "The source did not return a valid media key.")
        }
        urls.add(keyUrl)
      }

      val fragment = plan.firstMediaFragment()?.url
        ?: return MediaProbe(code = "media-child-missing", reason = "This source did not expose downloadable media fragments.")
      if (!descendantAllowed(context, fragment)) {
        return MediaProbe(code = "descendant-origin-not-approved", reason = "The media request left the approved source boundary.")
      }
      urls.add(fragment)
      val media = probeChild(context, fragment, 4096, false, mediaBytes = true)
      if (media.code != null) return MediaProbe(code = media.code, reason = media.reason)

      if (!isHlsPlaylistProbe(media)) {
        val mediaFragments = plan.fragments.filterNot { it.role.endsWith("-init") }
        if (mediaFragments.size > 1) {
          val representative = mediaFragments[mediaFragments.size / 2]
          if (!descendantAllowed(context, representative.url)) {
            return MediaProbe(code = "descendant-origin-not-approved", reason = "The representative media request left the approved source boundary.")
          }
          urls.add(representative.url)
          val representativeProbe = probeChild(context, representative.url, 4096, false, mediaBytes = true)
          if (representativeProbe.code != null) return MediaProbe(code = representativeProbe.code, reason = representativeProbe.reason)
          if (isHlsPlaylistProbe(representativeProbe)) {
            return MediaProbe(code = "hls-media-shape-unstable", reason = "The HLS stream changed back into a playlist while Orion verified its media segments.")
          }
        }
        return MediaProbe(urls)
      }

      if (depth == MAX_HLS_PLAYLIST_DESCENT - 1) {
        return MediaProbe(code = "hls-nested-playlist-limit", reason = "The HLS stream nested too many playlist layers.")
      }
      val nested = probeChild(context, fragment, MAX_MANIFEST_BYTES, false)
      if (nested.code != null) return MediaProbe(code = nested.code, reason = nested.reason)
      val nestedBody = nested.bytes.toString(Charsets.UTF_8)
      if (!OrionDownloadFragmentPlanner.isHlsPlaylistBody(nestedBody)) {
        return MediaProbe(code = "hls-child-not-playlist", reason = "The HLS child changed shape while Orion verified it.")
      }
      playlistUrl = fragment
      playlistBody = nestedBody
    }

    return MediaProbe(code = "hls-nested-playlist-limit", reason = "The HLS stream nested too many playlist layers.")
  }

  private data class ChildProbe(
    val bytes: ByteArray = byteArrayOf(),
    val contentType: String = "",
    val code: String? = null,
    val reason: String? = null,
  )

  private fun probeChild(context: CapturedContext, rawUrl: String, maxBytes: Int, ranged: Boolean, mediaBytes: Boolean = false): ChildProbe {
    var url = rawUrl
    repeat(4) {
      if (!descendantAllowed(context, url)) {
        return ChildProbe(code = "descendant-origin-not-approved", reason = "The media request left the approved source boundary.")
      }
      val request = authorizedRequestFor(context, url)
      val connection = OrionDownloadAuthorizedHttp.openRequest(request, if (ranged) 0 else null, if (ranged) 4095 else null)
      connection.connectTimeout = CONNECT_TIMEOUT_MS
      connection.readTimeout = READ_TIMEOUT_MS
      try {
        val status = connection.responseCode
        if (status in 300..399) {
          url = connection.getHeaderField("Location")?.let { resolveHttpUrl(url, it) }
            ?: return ChildProbe(code = "media-redirect-invalid", reason = "The media request redirected to an invalid location.")
          if (!redirectAllowed(context, url)) {
            return ChildProbe(code = "descendant-origin-not-approved", reason = "The media redirect left the approved source boundary.")
          }
          return@repeat
        }
        if (status == 401 || status == 403) {
          return ChildProbe(code = "request-context-rejected", reason = "The source rejected the media request. Play it again or choose another source.")
        }
        if (status !in 200..299) {
          return ChildProbe(code = "media-child-unavailable", reason = "The source did not return its first media request.")
        }
        val bytes = connection.inputStream.use { input ->
          val output = java.io.ByteArrayOutputStream()
          val buffer = ByteArray(4096)
          while (output.size() < maxBytes) {
            val read = input.read(buffer, 0, min(buffer.size, maxBytes - output.size()))
            if (read <= 0) break
            output.write(buffer, 0, read)
          }
          output.toByteArray()
        }
        if (bytes.isEmpty()) return ChildProbe(code = "empty-media", reason = "The source returned no media bytes.")
        val type = connection.contentType.orEmpty().lowercase(Locale.US)
        if (mediaBytes && (type.contains("text/html") || type.contains("application/json") || bytes.toString(Charsets.UTF_8).trimStart().startsWith("<html", true))) {
          return ChildProbe(code = "invalid-media", reason = "The source returned a page instead of media bytes.")
        }
        return ChildProbe(bytes = bytes, contentType = type)
      } finally {
        connection.disconnect()
      }
    }
    return ChildProbe(code = "media-redirect-limit", reason = "The media request redirected too many times.")
  }

  private fun isHlsPlaylistProbe(probe: ChildProbe): Boolean =
    probe.contentType.contains("mpegurl", ignoreCase = true)
      || OrionDownloadFragmentPlanner.isHlsPlaylistBody(probe.bytes.toString(Charsets.UTF_8))

  private fun openConnection(context: CapturedContext, rawUrl: String): HttpURLConnection {
    val request = authorizedRequestFor(context, rawUrl)
    // Preflight uses a normal bounded GET so Content-Length remains the full
    // direct object size instead of becoming a synthetic 1-byte range length.
    val connection = OrionDownloadAuthorizedHttp.openRequest(request, null, null)
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    return connection
  }

  private fun finishAndEmit(
    reactContext: ReactContext,
    context: CapturedContext,
    state: String,
    reachability: String,
    resolvedKind: String,
    protection: String,
    requiredBytes: Long?,
    reasonCode: String?,
    reason: String?,
    resumable: Boolean = false,
    descendants: Set<String> = emptySet(),
    freeBytes: Long? = orionLibraryFreeBytes(reactContext),
  ) {
    val checkedAt = System.currentTimeMillis()
    synchronized(this) {
      val current = contexts[context.candidateId] ?: return
      if (current.requestContextId != context.requestContextId) return
      current.preflightState = state
      current.resolvedKind = resolvedKind
      current.protection = protection
      current.requestContextReady = state == "ready"
      current.resumable = resumable
      current.requiredBytes = requiredBytes
      current.authorizedUrls.clear()
      if (state == "ready") {
        normalizeHttpUrl(context.rawUrl)?.let(current.authorizedUrls::add)
        descendants.take(MAX_PREFLIGHT_DESCENDANTS).forEach(current.authorizedUrls::add)
      }
    }

    val ready = state == "ready" && context.downloadAllowed
    val deviceStorageReady = ready && resolvedKind in setOf("hls", "dash")
    val deviceReason = when {
      !context.downloadAllowed -> "This provider is not enabled for Mobile downloads."
      state != "ready" -> reason ?: "This candidate is not ready to download."
      resolvedKind !in setOf("hls", "dash") -> "Device Storage requires a ready HLS or DASH stream that Orion can finalize safely."
      else -> null
    }
    val preflight = Arguments.createMap().apply {
      putInt("schemaVersion", 1)
      putString("candidateId", context.candidateId)
      putString("state", state)
      putString("reachability", reachability)
      putString("resolvedManifestKind", resolvedKind)
      putString("expiry", context.expiry)
      putString("protection", protection)
      putBoolean("requestContextReady", ready)
      putInt("descendantCount", descendants.size)
      if (requiredBytes == null) putNull("requiredBytes") else putDouble("requiredBytes", requiredBytes.toDouble())
      putString("storageRequirement", if (requiredBytes == null) "unknown" else "known")
      if (freeBytes == null) putNull("orionLibraryFreeBytes") else putDouble("orionLibraryFreeBytes", freeBytes.toDouble())
      if (reasonCode == null) putNull("reasonCode") else putString("reasonCode", reasonCode)
      if (reason == null) putNull("reason") else putString("reason", reason.take(180))
      putDouble("checkedAt", checkedAt.toDouble())
    }
    val payload = Arguments.createMap().apply {
      putInt("schemaVersion", 1)
      putString("candidateId", context.candidateId)
      putString("playbackSessionId", context.sessionId)
      putString("requestContextId", context.requestContextId)
      putString("sourceId", context.sourceId)
      if (context.providerClass == null) putNull("providerClass") else putString("providerClass", context.providerClass)
      putString("manifestKind", context.observedManifestKind)
      putString("expiry", context.expiry)
      putString("protection", protection)
      putArray("availableQualities", Arguments.createArray().apply { pushString("best") })
      putMap("capabilities", Arguments.createMap().apply {
        putBoolean("orionLibrary", ready)
        putBoolean("deviceStorage", deviceStorageReady)
        putBoolean("resumable", ready && resumable)
        putBoolean("subtitles", false)
        putBoolean("audioSelection", false)
        if (deviceReason == null) putNull("deviceStorageBlockedReason") else putString("deviceStorageBlockedReason", deviceReason.take(180))
      })
      putMap("preflight", preflight)
      putDouble("capturedAt", context.capturedAt.toDouble())
    }
    Log.i(
      DIAGNOSTIC_TAG,
      buildString {
        append("source=").append(context.sourceId.take(40))
        append(" provider=").append(context.providerClass?.take(40) ?: "unknown")
        append(" observed=").append(context.observedManifestKind)
        append(" resolved=").append(resolvedKind)
        append(" state=").append(state)
        append(" reachability=").append(reachability)
        append(" protection=").append(protection)
        append(" expiry=").append(context.expiry)
        append(" descendants=").append(min(descendants.size, MAX_PREFLIGHT_DESCENDANTS))
        append(" contextReady=").append(ready)
        append(" storage=").append(if (requiredBytes == null) "unknown" else "known")
        append(" reason=").append(reasonCode?.take(48) ?: "none")
      },
    )

    reactContext.runOnUiQueueThread {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, payload)
    }
  }

  private fun tracePhysicalOnce(key: String, message: String) {
    val shouldLog = synchronized(this) {
      if (physicalTraceKeys.size >= 96) physicalTraceKeys.clear()
      physicalTraceKeys.add(key)
    }
    if (shouldLog) Log.i("OrionP102Trace", message.take(220))
  }

  private fun classifyObservedRoot(uri: Uri, headers: Map<String, String>): String? {
    val path = uri.path.orEmpty().lowercase(Locale.US)
    if (path.matches(Regex(".*\\.(m3u8)(?:$|/).*"))) return "hls"
    if (path.matches(Regex(".*\\.(mpd)(?:$|/).*"))) return "dash"
    if (path.matches(Regex(".*\\.(mp4|webm|mkv|m4v|mov)(?:$|/).*"))) return "direct"
    if (path.matches(Regex(".*\\.(m4s|ts|aac|m4a|mp3|vtt|srt|ass|ssa)(?:$|/).*"))) return null
    val accept = headerValue(headers, "accept").lowercase(Locale.US)
    if (accept.contains("mpegurl") || accept.contains("dash+xml") || accept.contains("video/") || accept.contains("application/octet-stream")) {
      return "extensionless"
    }
    val hint = "${uri.lastPathSegment.orEmpty()}?${uri.query.orEmpty()}".lowercase(Locale.US)
    if (listOf("manifest", "playlist", "master", "playback", "stream", "video", "media", "source").any(hint::contains)) return "extensionless"
    return null
  }

  /**
   * Android WebView does not expose a response-header observer equivalent to
   * Electron's onHeadersReceived. For active playback only, Orion therefore
   * performs a bounded native preflight of opaque XHR/media requests that the
   * provider itself issued. Non-media responses are discarded natively and
   * never become React candidates.
   */
  private fun shouldProbeOpaqueRoot(
    uri: Uri,
    headers: Map<String, String>,
    allowedMediaOrigins: List<String>,
    sessionId: String,
  ): Boolean {
    val path = uri.path.orEmpty().lowercase(Locale.US)
    if (path.matches(Regex(".*\\.(?:js|mjs|css|json|html?|xml|wasm|map|ico|avif|gif|jpe?g|png|webp|svg|woff2?|ttf|otf|eot|m4s|ts|aac|m4a|mp3|vtt|srt|ass|ssa)(?:$|/).*"))) return false

    val accept = headerValue(headers, "accept").lowercase(Locale.US)
    if (accept.contains("text/html") || accept.contains("javascript") || accept.contains("text/css") || accept.contains("image/") || accept.contains("font/")) return false

    val destination = headerValue(headers, "sec-fetch-dest").lowercase(Locale.US)
    if (destination in setOf("document", "iframe", "image", "script", "style", "font")) return false

    val requestOrigin = originOf(uri.toString())
    val approvedMediaOrigin = requestOrigin != null && allowedMediaOrigins.mapNotNull(::normalizeOrigin).contains(requestOrigin)
    val dynamicFetch = destination.isBlank() || destination in setOf("empty", "video", "audio")
    if (!approvedMediaOrigin && !dynamicFetch) return false

    return true
  }

  private fun headerValue(headers: Map<String, String>, name: String): String =
    headers.entries.firstOrNull { it.key.equals(name, true) }?.value.orEmpty()

  private fun resolveKind(observed: String, contentType: String, body: String?): String {
    if (observed != "extensionless") return resolvedKindForObserved(observed)
    if (contentType.contains("mpegurl") || body?.contains("#EXTM3U", true) == true) return "hls"
    if (contentType.contains("dash+xml") || body?.contains(Regex("<MPD(?:\\s|>)", RegexOption.IGNORE_CASE)) == true) return "dash"
    if (contentType.startsWith("video/") || contentType == "application/octet-stream") return "direct"
    return "unknown"
  }

  private fun resolvedKindForObserved(observed: String): String = when (observed) {
    "direct", "hls", "dash" -> observed
    else -> "unknown"
  }

  private fun detectProtection(kind: String, body: String?): String {
    if (body.isNullOrBlank()) return if (kind == "direct") "clear" else "unknown"
    if (kind == "hls") {
      if (body.contains(Regex("#EXT-X-KEY:[^\\n]*(METHOD=SAMPLE-AES|KEYFORMAT=\\\"(?!identity))", RegexOption.IGNORE_CASE))) return "protected"
      return "clear"
    }
    if (kind == "dash") {
      if (body.contains(Regex("<ContentProtection(?:\\s|>)", RegexOption.IGNORE_CASE))) return "protected"
      return "clear"
    }
    return "unknown"
  }

  private fun discoverHlsDescendants(baseUrl: String, body: String, context: CapturedContext): DescendantDiscovery {
    val found = linkedSetOf<String>()
    var denied = 0
    body.lineSequence().forEach { rawLine ->
      if (found.size >= MAX_PREFLIGHT_DESCENDANTS) return@forEach
      val line = rawLine.trim()
      if (line.isEmpty()) return@forEach
      if (!line.startsWith("#")) denied += addDescendant(baseUrl, line, context, found)
      Regex("URI=\"([^\"]+)\"", RegexOption.IGNORE_CASE).findAll(line).forEach { match ->
        if (found.size < MAX_PREFLIGHT_DESCENDANTS) denied += addDescendant(baseUrl, match.groupValues[1], context, found)
      }
    }
    return DescendantDiscovery(found, denied)
  }

  private fun discoverDashDescendants(baseUrl: String, body: String, context: CapturedContext): DescendantDiscovery {
    val found = linkedSetOf<String>()
    var denied = 0
    Regex("<BaseURL[^>]*>([^<]+)</BaseURL>", RegexOption.IGNORE_CASE).findAll(body).forEach { match ->
      if (found.size < MAX_PREFLIGHT_DESCENDANTS) denied += addDescendant(baseUrl, match.groupValues[1].trim(), context, found)
    }
    Regex("(?:media|initialization|sourceURL)=\"([^\"]+)\"", RegexOption.IGNORE_CASE).findAll(body).forEach { match ->
      val value = match.groupValues[1]
      if (!value.contains('$') && found.size < MAX_PREFLIGHT_DESCENDANTS) denied += addDescendant(baseUrl, value, context, found)
    }
    return DescendantDiscovery(found, denied)
  }

  /** Returns 1 only when a manifest child fails the trusted public-origin boundary. */
  private fun addDescendant(baseUrl: String, child: String, context: CapturedContext, target: MutableSet<String>): Int {
    val resolved = resolveHttpUrl(baseUrl, child) ?: return 0
    if (!descendantAllowed(context, resolved)) return 1
    target.add(resolved)
    return 0
  }


  private fun rememberObservedRequest(sessionId: String, rawUrl: String, headers: Map<String, String>) {
    val normalized = normalizeHttpUrl(rawUrl) ?: return
    val requestCookie = headers.entries.firstOrNull { it.key.equals("cookie", true) }?.value?.takeIf { it.isNotBlank() }
    val material = CapturedRequestMaterial(headers.toMap(), requestCookie)
    synchronized(this) {
      val requests = observedRequestMaterial.getOrPut(sessionId) { LinkedHashMap() }
      requests.remove(normalized)
      requests[normalized] = material
      while (requests.size > MAX_OBSERVED_REQUESTS_PER_SESSION) {
        val oldest = requests.keys.firstOrNull() ?: break
        requests.remove(oldest)
      }
    }
  }

  private fun authorizedRequestFor(context: CapturedContext, normalized: String): AuthorizedRequest {
    val activeObserved = activeObservedFor(context)
    val observed = OrionBoundObservationPolicy.selectExact(
      activeObserved,
      context.boundObservedRequestMaterial,
      normalized,
    )
    if (observed != null) {
      return AuthorizedRequest(
        normalized,
        observed.headers.toMap(),
        observed.cookieHeader ?: captureCookie(normalized, observed.headers),
      )
    }
    val sameOrigin = originOf(normalized) == originOf(context.rawUrl)
    if (sameOrigin) {
      return AuthorizedRequest(normalized, context.requestHeaders.toMap(), context.cookieHeader)
    }

    // A discovered CDN child may never have been requested at this exact URL,
    // but playback can already have proven the request profile for that origin.
    // Reuse only non-credential browser headers from that exact observed origin;
    // cookies are resolved again for the destination URL and Authorization is
    // never inherited across URLs.
    val observedOrigin = OrionBoundObservationPolicy.selectOrigin(
      activeObserved,
      context.boundObservedRequestMaterial,
      normalized,
    )
    if (observedOrigin != null) {
      return AuthorizedRequest(
        normalized,
        safeObservedOriginHeaders(observedOrigin.headers),
        captureCookie(normalized, emptyMap()),
      )
    }

    return AuthorizedRequest(
      normalized,
      safeCrossOriginHeaders(context.requestHeaders),
      captureCookie(normalized, emptyMap()),
    )
  }

  internal fun safeObservedOriginHeaders(headers: Map<String, String>): Map<String, String> {
    val safe = linkedMapOf<String, String>()
    headers.forEach { (name, value) ->
      when (name.lowercase(Locale.US)) {
        "accept", "accept-language", "user-agent" -> cleanHeaderValue(value)?.let { safe[name] = it }
        "origin" -> sanitizeOrigin(value)?.let { safe[name] = it }
        "referer" -> sanitizeObservedReferer(value)?.let { safe[name] = it }
      }
    }
    return safe
  }

  internal fun safeCrossOriginHeaders(headers: Map<String, String>): Map<String, String> {
    val safe = linkedMapOf<String, String>()
    headers.forEach { (name, value) ->
      when (name.lowercase(Locale.US)) {
        "accept", "accept-language", "user-agent" -> safe[name] = value
        "referer" -> sanitizeReferer(value)?.let { safe[name] = it }
      }
    }
    return safe
  }

  private fun cleanHeaderValue(raw: String): String? =
    raw.takeIf { it.isNotBlank() && !it.contains('\r') && !it.contains('\n') }?.trim()?.take(4096)

  private fun sanitizeOrigin(raw: String): String? = try {
    val url = URL(raw)
    if (url.protocol != "http" && url.protocol != "https") null
    else buildString {
      append(url.protocol.lowercase(Locale.US)).append("://").append(url.host.lowercase(Locale.US))
      if (url.port > 0 && url.port != url.defaultPort) append(':').append(url.port)
    }
  } catch (_: Throwable) { null }

  private fun sanitizeObservedReferer(raw: String): String? = try {
    val url = URL(raw)
    sanitizeOrigin(raw)?.let { origin ->
      val file = url.file.takeIf { it.isNotBlank() } ?: "/"
      cleanHeaderValue("$origin$file")
    }
  } catch (_: Throwable) { null }

  private fun sanitizeReferer(raw: String): String? = sanitizeOrigin(raw)?.let { "$it/" }

  private fun descendantAllowed(context: CapturedContext, rawUrl: String): Boolean =
    trustedDescendantDestination(
      context.allowedOrigins,
      observedUrlsFor(context),
      rawUrl,
    )

  private fun redirectAllowed(context: CapturedContext, rawUrl: String): Boolean =
    trustedRedirectDestination(
      context.allowedOrigins,
      observedUrlsFor(context),
      rawUrl,
    )

  private fun observedUrlsFor(context: CapturedContext): Set<String> =
    OrionBoundObservationPolicy.trustedUrls(
      activeObservedFor(context),
      context.boundObservedRequestMaterial,
    )

  private fun activeObservedFor(context: CapturedContext): Map<String, CapturedRequestMaterial>? =
    if (context.sessionReleased) null else observedRequestMaterial[context.sessionId]

  internal fun trustedDescendantDestination(
    allowedOrigins: Set<String>,
    observedUrls: Set<String>,
    rawUrl: String,
  ): Boolean {
    val origin = originOf(rawUrl) ?: return false
    return (allowedOrigins.contains(origin) || observedUrls.any { originOf(it) == origin }) &&
      isSafePublicHttpUrl(rawUrl)
  }

  internal fun trustedRedirectDestination(
    allowedOrigins: Set<String>,
    observedUrls: Set<String>,
    rawUrl: String,
  ): Boolean {
    val origin = originOf(rawUrl) ?: return false
    return (allowedOrigins.contains(origin) || observedUrls.contains(rawUrl)) &&
      isSafePublicHttpUrl(rawUrl)
  }

  private fun isSafePublicHttpUrl(rawUrl: String): Boolean {
    val origin = originOf(rawUrl) ?: return false
    val safe = try {
      val url = URL(rawUrl)
      val host = url.host?.trim()?.lowercase(Locale.US).orEmpty()
      if (host.isEmpty() || host == "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) false
      else {
        val addresses = InetAddress.getAllByName(host)
        addresses.isNotEmpty() && addresses.all { !isPrivateAddress(it) }
      }
    } catch (_: Throwable) { false }
    return safe
  }

  private fun isPrivateAddress(address: InetAddress): Boolean {
    if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress || address.isSiteLocalAddress || address.isMulticastAddress) return true
    if (address is Inet6Address) {
      val bytes = address.address
      if (bytes.isNotEmpty() && (bytes[0].toInt() and 0xfe) == 0xfc) return true
    }
    val bytes = address.address
    if (bytes.size == 4) {
      val first = bytes[0].toInt() and 0xff
      val second = bytes[1].toInt() and 0xff
      if (first == 100 && second in 64..127) return true
      if (first == 198 && second in 18..19) return true
    }
    return false
  }

  private fun buildAllowedOrigins(rootUrl: String, allowedMediaOrigins: List<String>): Set<String> {
    val origins = linkedSetOf<String>()
    originOf(rootUrl)?.let(origins::add)
    allowedMediaOrigins.mapNotNull(::normalizeOrigin).forEach(origins::add)
    return origins
  }

  private fun normalizeOrigin(raw: String): String? = try {
    val url = URL(raw)
    if (url.protocol != "http" && url.protocol != "https") null
    else "${url.protocol.lowercase(Locale.US)}://${url.authority.lowercase(Locale.US)}"
  } catch (_: Throwable) { null }

  private fun originOf(rawUrl: String): String? = try {
    val url = URL(rawUrl)
    "${url.protocol.lowercase(Locale.US)}://${url.authority.lowercase(Locale.US)}"
  } catch (_: Throwable) { null }

  private fun normalizeHttpUrl(rawUrl: String): String? = try {
    val url = URL(rawUrl)
    if (url.protocol != "http" && url.protocol != "https") null else url.toExternalForm()
  } catch (_: Throwable) { null }

  private fun resolveHttpUrl(baseUrl: String, child: String): String? = try {
    val url = URL(URL(baseUrl), child)
    if (url.protocol != "http" && url.protocol != "https") null else url.toExternalForm()
  } catch (_: Throwable) { null }

  private fun captureCookie(rawUrl: String, headers: Map<String, String>): String? {
    val requestCookie = headers.entries.firstOrNull { it.key.equals("cookie", true) }?.value
    return requestCookie?.takeIf { it.isNotBlank() } ?: try {
      CookieManager.getInstance().getCookie(rawUrl)?.takeIf { it.isNotBlank() }
    } catch (_: Throwable) { null }
  }

  private fun classifyExpiry(uri: Uri, headers: Map<String, String>, now: Long): ExpiryResult {
    val queryNames = try { uri.queryParameterNames } catch (_: Throwable) { emptySet<String>() }
    for (name in queryNames) {
      val lower = name.lowercase(Locale.US)
      if (lower in setOf("expires", "expire", "expiry", "exp")) {
        val raw = uri.getQueryParameter(name)?.toLongOrNull() ?: continue
        val millis = if (raw < 10_000_000_000L) raw * 1000L else raw
        return if (millis <= now) ExpiryResult("expired", millis) else ExpiryResult("time-bounded", millis)
      }
    }
    val signed = queryNames.any {
      val key = it.lowercase(Locale.US)
      key.contains("token") || key.contains("signature") || key == "sig" || key.contains("policy") || key.contains("key")
    }
    val hasAuthorization = headers.keys.any { it.equals("authorization", true) }
    val hasCookie = headers.keys.any { it.equals("cookie", true) }
    return if (signed || hasAuthorization || hasCookie) ExpiryResult("session", null) else ExpiryResult("stable", null)
  }

  private fun contentLength(connection: HttpURLConnection): Long? {
    val length = connection.getHeaderFieldLong("Content-Length", -1L)
    return length.takeIf { it > 0L }
  }

  private fun readBoundedBytes(connection: HttpURLConnection, maxBytes: Int): ByteArray {
    val stream = try { connection.inputStream } catch (_: Throwable) { connection.errorStream } ?: return byteArrayOf()
    return stream.use { input ->
      val buffer = ByteArray(8192)
      val output = java.io.ByteArrayOutputStream()
      var remaining = maxBytes
      while (remaining > 0) {
        val read = input.read(buffer, 0, min(buffer.size, remaining))
        if (read <= 0) break
        output.write(buffer, 0, read)
        remaining -= read
      }
      output.toByteArray()
    }
  }

  private fun readBoundedText(connection: HttpURLConnection, maxBytes: Int): String =
    readBoundedBytes(connection, maxBytes).toString(Charsets.UTF_8)

  private fun orionLibraryFreeBytes(reactContext: ReactContext): Long? = try {
    StatFs(reactContext.filesDir.absolutePath).availableBytes
  } catch (_: Throwable) { null }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { byte -> "%02x".format(byte) }

  private fun cleanupExpiredLocked(now: Long) {
    val remove = contexts.values.filter { context ->
      val deadline = context.expiresAt ?: (context.capturedAt + DEFAULT_CONTEXT_TTL_MS)
      deadline <= now
    }.map { it.candidateId }
    remove.forEach(::removeLocked)
  }

  private fun trimLocked() {
    while (contexts.size > MAX_CONTEXTS) {
      val candidateId = contexts.entries.firstOrNull { it.value.boundJobId == null }?.key ?: break
      removeLocked(candidateId)
    }
  }

  private fun removeLocked(candidateId: String) {
    val removed = contexts.remove(candidateId) ?: return
    candidateByFingerprint.entries.removeAll { it.value == removed.candidateId }
  }
}

internal data class BoundContextResult(val requestContextId: String, val expiresAt: Long?)
internal data class AuthorizedRequest(val url: String, val headers: Map<String, String>, val cookieHeader: String?)
internal data class AuthorizedTransferSeed(
  val sourceId: String,
  val resolvedKind: String,
  val resumable: Boolean,
  val requiredBytes: Long?,
  val request: AuthorizedRequest,
)
private data class DescendantDiscovery(val allowed: Set<String>, val deniedCount: Int)
private data class CapturedRequestMaterial(val headers: Map<String, String>, val cookieHeader: String?)
/** Exact URL observations stay available only to their owning bound job after Player closes. */
internal object OrionBoundObservationPolicy {
  fun <T> selectExact(active: Map<String, T>?, bound: Map<String, T>, url: String): T? =
    active?.get(url) ?: bound[url]

  fun <T> selectOrigin(active: Map<String, T>?, bound: Map<String, T>, url: String): T? {
    val targetOrigin = origin(url) ?: return null
    return active?.entries?.lastOrNull { origin(it.key) == targetOrigin }?.value
      ?: bound.entries.lastOrNull { origin(it.key) == targetOrigin }?.value
  }

  fun <T> trustedUrls(active: Map<String, T>?, bound: Map<String, T>): Set<String> =
    active?.keys ?: bound.keys

  private fun origin(raw: String): String? = try {
    val url = URL(raw)
    if (url.protocol != "http" && url.protocol != "https") null
    else buildString {
      append(url.protocol.lowercase(Locale.US)).append("://").append(url.host.lowercase(Locale.US))
      if (url.port > 0 && url.port != url.defaultPort) append(':').append(url.port)
    }
  } catch (_: Throwable) { null }
}

private data class ExpiryResult(val kind: String, val expiresAt: Long?)
private data class CapturedContext(
  val candidateId: String,
  val requestContextId: String,
  val sourceId: String,
  val sessionId: String,
  val providerClass: String?,
  val rawUrl: String,
  val requestHeaders: Map<String, String>,
  val cookieHeader: String?,
  val observedManifestKind: String,
  val expiry: String,
  val expiresAt: Long?,
  val capturedAt: Long,
  val allowedOrigins: Set<String>,
  val opaqueProbe: Boolean = false,
  val authorizedUrls: MutableSet<String> = linkedSetOf(),
  var boundObservedRequestMaterial: Map<String, CapturedRequestMaterial> = emptyMap(),
  var sessionReleased: Boolean = false,
  var boundJobId: String? = null,
  var preflightState: String = "checking",
  var resolvedKind: String = "unknown",
  var protection: String = "unknown",
  var requestContextReady: Boolean = false,
  var resumable: Boolean = false,
  var requiredBytes: Long? = null,
  val downloadAllowed: Boolean = true,
)

private data class PreflightResult(
  val state: String,
  val reachability: String,
  val resolvedKind: String,
  val protection: String,
  val requiredBytes: Long?,
  val resumable: Boolean,
  val descendants: Set<String>,
  val reasonCode: String?,
  val reason: String?,
) {
  companion object {
    fun unsupported(code: String, reason: String) = PreflightResult("unsupported", "reachable", "unknown", "unknown", null, false, emptySet(), code, reason)
    fun protected(kind: String, code: String, reason: String) = PreflightResult("protected", "reachable", kind, "protected", null, false, emptySet(), code, reason)
    fun expired(code: String, reason: String) = PreflightResult("expired", "reachable", "unknown", "unknown", null, false, emptySet(), code, reason)
    fun unreachable(code: String, reason: String) = PreflightResult("unreachable", "unreachable", "unknown", "unknown", null, false, emptySet(), code, reason)
    fun actionRequired(code: String, reason: String) = PreflightResult("action-required", "reachable", "unknown", "unknown", null, false, emptySet(), code, reason)
  }
}
