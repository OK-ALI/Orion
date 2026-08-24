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
  private const val MAX_DESCENDANTS = 512
  private const val MAX_CONTEXTS = 24

  private val executor = Executors.newFixedThreadPool(2)
  private val contexts = LinkedHashMap<String, CapturedContext>()
  private val candidateByFingerprint = mutableMapOf<String, String>()

  fun observeRequest(
    reactContext: ReactContext,
    request: WebResourceRequest,
    sourceId: String,
    sessionId: String,
    providerClass: String?,
    downloadCaptureEnabled: Boolean,
    allowedMediaOrigins: List<String>,
  ) {
    if (!downloadCaptureEnabled || request.isForMainFrame) return
    val uri = request.url ?: return
    val scheme = uri.scheme?.lowercase(Locale.US)
    if (scheme != "http" && scheme != "https") return
    val manifestKind = classifyObservedRoot(uri, request.requestHeaders) ?: return
    val method = request.method?.uppercase(Locale.US).orEmpty()
    if (method.isNotEmpty() && method != "GET") return

    val rawUrl = uri.toString()
    val fingerprint = sha256("$sessionId\n$sourceId\n$rawUrl")
    val candidateId: String
    val context: CapturedContext
    synchronized(this) {
      cleanupExpiredLocked(System.currentTimeMillis())
      val existingId = candidateByFingerprint[fingerprint]
      if (existingId != null && contexts.containsKey(existingId)) return
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

  /** Native-only authorization gate for future P10.3 transfer execution. */
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
      if (!context.authorizedUrls.contains(normalized)) return null
      return AuthorizedRequest(
        url = normalized,
        headers = context.requestHeaders.toMap(),
        cookieHeader = context.cookieHeader,
      )
    }
  }

  /**
   * Native transfer code may extend the exact allowlist only from an already
   * authorized manifest and only to an origin admitted by that capture.
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
      if (!originAllowed(context, child)) return false
      if (context.authorizedUrls.size >= MAX_DESCENDANTS + 1) return false
      context.authorizedUrls.add(child)
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
    val connection = openConnection(context, context.rawUrl)
    try {
      val status = connection.responseCode
      if (status in 300..399) {
        val location = connection.getHeaderField("Location")
        val redirect = location?.let { resolveHttpUrl(context.rawUrl, it) }
        if (redirect == null || !originAllowed(context, redirect)) {
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
    if (resolvedKind == "hls" || resolvedKind == "dash" || context.observedManifestKind == "extensionless") {
      body = readBoundedText(connection, MAX_MANIFEST_BYTES)
      resolvedKind = resolveKind(context.observedManifestKind, contentType, body)
    }

    if (resolvedKind == "unknown") {
      return PreflightResult.unsupported("unsupported-media-shape", "This source did not expose a supported direct, HLS, or DASH media shape.")
    }
    if (resolvedKind == "hls" && body?.contains("#EXTM3U", ignoreCase = true) != true) {
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
    val descendants = discovery.allowed
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

  private fun openConnection(context: CapturedContext, rawUrl: String): HttpURLConnection {
    val connection = URL(rawUrl).openConnection() as HttpURLConnection
    connection.instanceFollowRedirects = false
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.useCaches = false
    connection.requestMethod = "GET"
    context.requestHeaders.forEach { (name, value) ->
      if (shouldReplayHeader(name)) connection.setRequestProperty(name, value)
    }
    if (!context.cookieHeader.isNullOrBlank()) connection.setRequestProperty("Cookie", context.cookieHeader)
    if (context.observedManifestKind == "direct") connection.setRequestProperty("Range", "bytes=0-0")
    return connection
  }

  private fun shouldReplayHeader(name: String): Boolean = when (name.lowercase(Locale.US)) {
    "host", "content-length", "connection", "range", "cookie", "accept-encoding" -> false
    else -> true
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
      current.authorizedUrls.clear()
      if (state == "ready") {
        normalizeHttpUrl(context.rawUrl)?.let(current.authorizedUrls::add)
        descendants.take(MAX_DESCENDANTS).forEach(current.authorizedUrls::add)
      }
    }

    val ready = state == "ready" && context.downloadAllowed
    val deviceReason = when {
      !context.downloadAllowed -> "This provider is not enabled for Mobile downloads."
      state != "ready" -> reason ?: "This candidate is not ready to download."
      else -> "Device Storage remains unavailable until scoped-storage destination validation is complete."
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
        putBoolean("deviceStorage", false)
        putBoolean("resumable", ready && resumable)
        putBoolean("subtitles", false)
        putBoolean("audioSelection", false)
        putString("deviceStorageBlockedReason", deviceReason.take(180))
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
        append(" descendants=").append(min(descendants.size, MAX_DESCENDANTS))
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

  private fun classifyObservedRoot(uri: Uri, headers: Map<String, String>): String? {
    val path = uri.path.orEmpty().lowercase(Locale.US)
    if (path.matches(Regex(".*\\.(m3u8)(?:$|/).*"))) return "hls"
    if (path.matches(Regex(".*\\.(mpd)(?:$|/).*"))) return "dash"
    if (path.matches(Regex(".*\\.(mp4|webm|mkv|m4v|mov)(?:$|/).*"))) return "direct"
    if (path.matches(Regex(".*\\.(m4s|ts|aac|m4a|mp3|vtt|srt|ass|ssa)(?:$|/).*"))) return null
    val accept = headers.entries.firstOrNull { it.key.equals("accept", true) }?.value?.lowercase(Locale.US).orEmpty()
    if (accept.contains("mpegurl") || accept.contains("dash+xml") || accept.contains("video/") || accept.contains("application/octet-stream")) {
      return "extensionless"
    }
    val hint = "${uri.lastPathSegment.orEmpty()}?${uri.query.orEmpty()}".lowercase(Locale.US)
    if (listOf("manifest", "playlist", "master", "stream", "video").any(hint::contains)) return "extensionless"
    return null
  }

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
      if (found.size >= MAX_DESCENDANTS) return@forEach
      val line = rawLine.trim()
      if (line.isEmpty()) return@forEach
      if (!line.startsWith("#")) denied += addDescendant(baseUrl, line, context, found)
      Regex("URI=\"([^\"]+)\"", RegexOption.IGNORE_CASE).findAll(line).forEach { match ->
        if (found.size < MAX_DESCENDANTS) denied += addDescendant(baseUrl, match.groupValues[1], context, found)
      }
    }
    return DescendantDiscovery(found, denied)
  }

  private fun discoverDashDescendants(baseUrl: String, body: String, context: CapturedContext): DescendantDiscovery {
    val found = linkedSetOf<String>()
    var denied = 0
    Regex("<BaseURL[^>]*>([^<]+)</BaseURL>", RegexOption.IGNORE_CASE).findAll(body).forEach { match ->
      if (found.size < MAX_DESCENDANTS) denied += addDescendant(baseUrl, match.groupValues[1].trim(), context, found)
    }
    Regex("(?:media|initialization|sourceURL)=\"([^\"]+)\"", RegexOption.IGNORE_CASE).findAll(body).forEach { match ->
      val value = match.groupValues[1]
      if (!value.contains('$') && found.size < MAX_DESCENDANTS) denied += addDescendant(baseUrl, value, context, found)
    }
    return DescendantDiscovery(found, denied)
  }

  /** Returns 1 only when a valid HTTP child is denied by the approved-origin boundary. */
  private fun addDescendant(baseUrl: String, child: String, context: CapturedContext, target: MutableSet<String>): Int {
    val resolved = resolveHttpUrl(baseUrl, child) ?: return 0
    if (!originAllowed(context, resolved)) return 1
    target.add(resolved)
    return 0
  }


  private fun originAllowed(context: CapturedContext, rawUrl: String): Boolean {
    val origin = originOf(rawUrl) ?: return false
    return context.allowedOrigins.contains(origin)
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

  private fun readBoundedText(connection: HttpURLConnection, maxBytes: Int): String {
    val stream = try { connection.inputStream } catch (_: Throwable) { connection.errorStream } ?: return ""
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
      output.toString(Charsets.UTF_8.name())
    }
  }

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
private data class DescendantDiscovery(val allowed: Set<String>, val deniedCount: Int)
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
  val authorizedUrls: MutableSet<String> = linkedSetOf(),
  var boundJobId: String? = null,
  var preflightState: String = "checking",
  var resolvedKind: String = "unknown",
  var protection: String = "unknown",
  var requestContextReady: Boolean = false,
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
