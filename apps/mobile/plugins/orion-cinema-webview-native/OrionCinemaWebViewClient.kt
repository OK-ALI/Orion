package com.okali.orion.playback

import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.SafeBrowsingResponse
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.webkit.WebView
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.reactnativecommunity.webview.RNCWebViewClient
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.Locale
import java.lang.ref.WeakReference

/**
 * Native, Cinema-only request classifier. It deliberately never exports a
 * request URL, headers, cookies, signed media location or credentials.
 */
class OrionCinemaWebViewClient(
  private val reactContext: ReactContext,
  private val nativeViewTag: Int,
  private val onPageSettled: ((WebView) -> Unit)? = null,
) : RNCWebViewClient() {
  @Volatile private var manifest: ShieldManifest? = null
  private val pendingCounts = mutableMapOf<String, Int>()
  private val pendingClassifications = mutableMapOf<String, Int>()
  private val reportedRoutineEvidence = mutableSetOf<String>()
  private var latestDecision: ShieldDecision? = null
  private var flushScheduled = false
  private var nativeSequence = 0L
  private var lastP102ManifestTraceKey: String? = null
  private var diagnosticRows = 0
  private var diagnosticGeneration = 0
  private var pendingSourceDiagnostic: JSONObject? = null
  private var diagnosticPoll: Runnable? = null
  private var diagnosticPollView: WeakReference<WebView>? = null
  private val wrapperSourceLoad = OrionWrapperSourceLoad()

  init {
    OrionCinemaServiceWorkerDownloadObserver.ensureInstalled()
  }

  fun setShieldManifest(serialized: String?) {
    val previousSessionId = manifest?.sessionId
    val previousSourceId = manifest?.sourceId
    val next = ShieldManifest.parse(serialized)
    if (previousSessionId != next?.sessionId || previousSourceId != next?.sourceId) wrapperSourceLoad.invalidate()
    if (previousSessionId != next?.sessionId) {
      cancelDiagnosticPoll()
      diagnosticRows = 0
    }
    manifest = next
    if (previousSessionId != null && previousSessionId != next?.sessionId) {
      OrionDownloadRequestContextBroker.stopCaptureSession(previousSessionId, revoke = next == null)
      OrionCinemaServiceWorkerDownloadObserver.deactivate(previousSessionId)
    }
    if (next != null) OrionDownloadRequestContextBroker.setCaptureSession(
      next.sourceId, next.sessionId, next.downloadCaptureEnabled, next.downloadAllowed,
    )
    if (next?.downloadCaptureEnabled == true) {
      OrionCinemaServiceWorkerDownloadObserver.activate(reactContext, next)
    } else if (next != null) {
      OrionCinemaServiceWorkerDownloadObserver.deactivate(next.sessionId)
    }
    val current = next ?: return
    val traceKey = "${current.sessionId}:${current.sourceId}:${current.downloadCaptureEnabled}"
    if (lastP102ManifestTraceKey != traceKey) {
      lastP102ManifestTraceKey = traceKey
      Log.i(
        "OrionP102Trace",
        "stage=manifest source=${current.sourceId.take(40)} capture=${current.downloadCaptureEnabled} mediaOrigins=${current.mediaOrigins.size}",
      )
    }
    pendingSourceDiagnostic?.let { traceDiagnostic("wrapper-source", it) }
    pendingSourceDiagnostic = null
  }

  fun dispose() {
    wrapperSourceLoad.clear()
    cancelDiagnosticPoll()
    pendingSourceDiagnostic = null
    manifest?.sessionId?.let { OrionDownloadRequestContextBroker.stopCaptureSession(it) }
    manifest?.sessionId?.let(OrionCinemaServiceWorkerDownloadObserver::deactivate)
    manifest = null
  }

  fun recordPopupBlocked(view: WebView) {
    emit(view, ShieldDecision("blocked", "popup", "native-popup-deny"))
  }

  override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
    val decision = classify(request.url, request.isForMainFrame, isPopup = false)
    traceNavigationDiagnostic("wrapper-navigation-request", request.url, decision, request.isForMainFrame)
    emit(view, decision)
    return if (decision.decision == "blocked" && request.isForMainFrame) true else super.shouldOverrideUrlLoading(view, request)
  }

  override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
    val decision = classify(Uri.parse(url), isMainFrame = true, isPopup = false)
    traceNavigationDiagnostic("wrapper-navigation-legacy", Uri.parse(url), decision, null)
    emit(view, decision)
    return if (decision.decision == "blocked") true else super.shouldOverrideUrlLoading(view, url)
  }

  override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
    val owner = manifest
    if (owner != null && wrapperSourceLoad.consume(owner.sourceId, owner.sessionId, request.url.toString(),
      request.isForMainFrame, SystemClock.uptimeMillis())) {
      val owned = ShieldDecision("allow", "navigation", "owned-wrapper-html")
      traceNavigationDiagnostic("wrapper-intercept-request", request.url, owned, request.isForMainFrame)
      // Internal app HTML is navigation only; never submit it to request/media capture.
      return null
    }
    val decision = classify(request.url, request.isForMainFrame, isPopup = false)
    if (diagnosticEnabled() && safePublicWatchUrl(request.url.toString()) != null) {
      traceNavigationDiagnostic("wrapper-watch-request", request.url, decision, request.isForMainFrame)
    } else if (request.isForMainFrame || decision.decision == "blocked") {
      traceNavigationDiagnostic("wrapper-intercept-request", request.url, decision, request.isForMainFrame)
    }
    emit(view, decision)
    val current = manifest
    if (decision.decision != "blocked" && current != null) {
      OrionDownloadRequestContextBroker.observeRequest(
        reactContext = reactContext,
        request = request,
        sourceId = current.sourceId,
        sessionId = current.sessionId,
        providerClass = current.providerClass,
        downloadCaptureEnabled = current.downloadCaptureEnabled,
        allowedMediaOrigins = current.mediaOrigins,
        observationChannel = "webview",
      )
    }
    return if (decision.decision == "blocked") emptyBlockedResponse() else null
  }

  @Deprecated("Deprecated in Android")
  override fun shouldInterceptRequest(view: WebView, url: String): WebResourceResponse? {
    val decision = classify(Uri.parse(url), isMainFrame = false, isPopup = false)
    if (decision.decision == "blocked") {
      traceNavigationDiagnostic("wrapper-intercept-legacy", Uri.parse(url), decision, null)
    }
    emit(view, decision)
    return if (decision.decision == "blocked") emptyBlockedResponse() else null
  }

  override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
    cancelDiagnosticPoll()
    traceDiagnostic("wrapper-page-start", JSONObject().put("origin", diagnosticOrigin(Uri.parse(url))))
    resetEvidence()
    emit(view, ShieldDecision("active", "native-session", null))
    super.onPageStarted(view, url, favicon)
  }

  override fun onPageFinished(view: WebView, url: String) {
    wrapperSourceLoad.clear()
    cancelDiagnosticPoll()
    traceDiagnostic("wrapper-page-finish", JSONObject().put("origin", diagnosticOrigin(Uri.parse(url)))
      .put("blank", url == "about:blank"))
    sampleWrapperDiagnostic(view, "wrapper-dom-before-injection")
    super.onPageFinished(view, url)
    startDiagnosticPoll(view)
    onPageSettled?.invoke(view)
  }

  override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
    traceDiagnostic("wrapper-network-error", JSONObject().put("origin", diagnosticOrigin(request.url))
      .put("mainFrame", request.isForMainFrame).put("code", error.errorCode))
    super.onReceivedError(view, request, error)
  }

  override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
    traceDiagnostic("wrapper-http-error", JSONObject().put("origin", diagnosticOrigin(request.url))
      .put("mainFrame", request.isForMainFrame).put("status", response.statusCode))
    super.onReceivedHttpError(view, request, response)
  }

  /** Diagnostics only: stock source loading, navigation and error dispatch remain authoritative. */
  fun recordSourceTransactionDiagnostic(view: WebView, phase: String) {
    if (phase !in listOf("before", "after") || !diagnosticEnabled()) return
    val url = view.url
    traceDiagnostic("wrapper-source-transaction", JSONObject().put("phase", phase)
      .put("origin", diagnosticOrigin(Uri.parse(url.orEmpty()))).put("blank", url == null || url == "about:blank"))
  }

  fun recordSourceDiagnostic(source: ReadableMap?) {
    if (manifest != null && !diagnosticEnabled()) return
    try {
      val html = if (source?.hasKey("html") == true) source.getString("html") else null
      val summary = JSONObject().put("hasHtml", html != null)
        .put("wrapperBase", source?.hasKey("baseUrl") == true && source.getString("baseUrl") == "https://orion.local/player/")
        .put("hasFrameMarker", html?.contains("id=\"orion-provider-frame\"") == true)
      if (html != null && html.length <= 131072) {
        val src = Regex("<iframe\\b(?=[^>]*\\bid=\"orion-provider-frame\")[^>]*\\bsrc=\"([^\"]{1,1024})\"").find(html)?.groupValues?.get(1)
        val publicUrl = safePublicWatchUrl(src?.replace("&amp;", "&"))
        summary.put("publicWatchUrl", publicUrl ?: JSONObject.NULL)
      }
      if (manifest == null) pendingSourceDiagnostic = summary else traceDiagnostic("wrapper-source", summary)
    } catch (_: Throwable) {} // Tracing must never alter the stock source contract.
  }

  fun stageWrapperSource(source: ReadableMap?) {
    wrapperSourceLoad.clear()
    try {
      if (source == null || source.hasKey("uri") || !source.hasKey("html") || !source.hasKey("baseUrl")) return
      val html = source.getString("html") ?: return
      if (html.length > 131072 || !html.contains("id=\"orion-provider-frame\"")) return
      val bytes = html.toByteArray(Charsets.UTF_8)
      if (bytes.size > 131072) return
      wrapperSourceLoad.stage(source.getString("baseUrl"), Base64.encodeToString(bytes, Base64.NO_WRAP))
    } catch (_: Exception) { wrapperSourceLoad.clear() }
  }

  fun armWrapperSource() {
    val current = manifest ?: return
    if (wrapperSourceLoad.arm(current.sourceId, current.sessionId, current.allowedNavigationOrigins, SystemClock.uptimeMillis())) {
      traceDiagnostic("wrapper-owned-load-armed", JSONObject().put("origin", "wrapper"))
    }
  }

  fun recordConsoleDiagnostic(message: ConsoleMessage) {
    if (!diagnosticEnabled()) return
    val text = message.message().take(8192)
    val category = when {
      text.contains("Content Security Policy", true) || text.contains("frame-ancestors", true) -> "csp"
      text.contains("Mixed Content", true) -> "mixed-content"
      text.contains("NotAllowedError") -> "media-permission"
      text.contains("Uncaught TypeError") -> "javascript-type"
      text.contains("Uncaught ReferenceError") -> "javascript-reference"
      text.contains("Uncaught SyntaxError") -> "javascript-syntax"
      text.contains("net::ERR_") -> "network"
      else -> return
    }
    traceDiagnostic("wrapper-console-error", JSONObject().put("category", category))
  }

  private fun diagnosticEnabled(): Boolean = manifest?.let {
    it.sourceId in listOf("anilink", "aniembed") && it.downloadCaptureEnabled && !it.downloadAllowed
  } == true

  private fun diagnosticOrigin(uri: Uri): String = when {
    uri.scheme == "https" && uri.encodedAuthority == "orion.local" -> "wrapper"
    uri.scheme == "https" && uri.encodedAuthority == "anilink.cc" -> "provider"
    manifest?.sourceId == "aniembed" && uri.scheme == "https" && uri.encodedAuthority == "aniembed.se" -> "provider"
    else -> "other"
  }

  private fun traceNavigationDiagnostic(stage: String, uri: Uri, decision: ShieldDecision, mainFrame: Boolean?) {
    if (!diagnosticEnabled()) return
    val scheme = uri.scheme?.lowercase(Locale.US)
    traceDiagnostic(stage, JSONObject().put("origin", diagnosticOrigin(uri))
      .put("scheme", if (scheme in listOf("https", "http", "about", "data", "blob", "file")) scheme else "other")
      .put("mainFrame", mainFrame ?: JSONObject.NULL).put("decision", decision.decision)
      .put("classification", decision.classification)
      .put("rule", when (decision.ruleId) { "scheme-deny", "hostless-deny", "owned-wrapper-html" -> decision.ruleId
        null -> "absent"; else -> "classified" }))
  }

  private fun safePublicWatchUrl(value: String?): String? {
    if (value == null || value.length > 512 || !value.matches(Regex(
      "https://anilink\\.cc/watch/[1-9][0-9]{0,8}/[1-9][0-9]{0,8}\\?(?:variant=(?:sub|dub)|(?:autoplay|autonext)=(?:true|false)|start=[0-9]{1,9})(?:&(?:variant=(?:sub|dub)|(?:autoplay|autonext)=(?:true|false)|start=[0-9]{1,9}))*"
    ))) return null
    return try {
      val uri = Uri.parse(value)
      if (uri.getQueryParameter("variant") !in listOf("sub", "dub") ||
        uri.queryParameterNames.any { uri.getQueryParameters(it).size != 1 }) null else value
    } catch (_: Throwable) { null }
  }

  private fun traceDiagnostic(stage: String, fields: JSONObject) {
    if (!diagnosticEnabled()) return
    synchronized(this) {
      if (diagnosticRows >= 96) return
      val row = JSONObject().put("stage", stage).put("source", manifest?.sourceId)
        .put("sequence", ++diagnosticRows).put("nativeViewTag", nativeViewTag).put("fields", fields)
      Log.i("OrionP102Trace", row.toString())
    }
  }

  private fun cancelDiagnosticPoll() {
    diagnosticGeneration++
    diagnosticPoll?.let { diagnosticPollView?.get()?.removeCallbacks(it) }
    diagnosticPoll = null
    diagnosticPollView = null
  }

  private fun sampleWrapperDiagnostic(view: WebView, stage: String) {
    if (!diagnosticEnabled()) return
    val generation = diagnosticGeneration
    val session = manifest?.sessionId
    view.evaluateJavascript(WRAPPER_DIAGNOSTIC_SCRIPT) { raw ->
      if (generation != diagnosticGeneration || session != manifest?.sessionId || !diagnosticEnabled()) return@evaluateJavascript
      try {
        val text = JSONArray("[$raw]").optString(0)
        if (text.length > 4096) return@evaluateJavascript
        val observed = JSONObject(text)
        val safe = JSONObject()
        if (manifest?.sourceId == "aniembed" && observed.optString("documentOrigin") == "provider"
          && observed.opt("selectedBridge") == true) {
          observed.optJSONObject("media")?.let { safe.put("media", sanitizeMediaDiagnostic(it)) }
        }
        for (key in listOf("frameCount", "bodyChildren", "rows")) {
          val value = observed.opt(key)
          if (value is Number && value.toInt() in 0..64) safe.put(key, value.toInt())
        }
        for (key in listOf("frameConnected", "bridgePresent", "selectedBridge", "hasFrameMarker", "documentBlank")) {
          if (observed.opt(key) is Boolean) safe.put(key, observed.getBoolean(key))
        }
        for (key in listOf("documentOrigin", "frameOrigin", "readyState")) {
          val value = observed.optString(key)
          if (value in listOf("wrapper", "provider", "other", "absent", "loading", "interactive", "complete")) safe.put(key, value)
        }
        val scheme = observed.optString("documentScheme")
        if (scheme in listOf("https", "http", "about", "data", "blob", "file", "other")) safe.put("documentScheme", scheme)
        val contentType = observed.optString("contentType")
        if (contentType in listOf("html", "plain", "xhtml", "other")) safe.put("contentType", contentType)
        safe.put("publicWatchUrl", safePublicWatchUrl(observed.optString("publicWatchUrl")) ?: JSONObject.NULL)
        for ((key, names) in listOf("events" to DIAGNOSTIC_EVENTS, "counts" to DIAGNOSTIC_REASONS)) {
          val counts = JSONObject()
          for (name in names) {
            val value = observed.optJSONObject(key)?.opt(name)
            if (value is Number && value.toInt() in 0..64) counts.put(name, value.toInt())
          }
          safe.put(key, counts)
        }
        for ((key, names) in listOf("firstEvent" to DIAGNOSTIC_EVENTS, "firstReason" to DIAGNOSTIC_REASONS, "lastReason" to DIAGNOSTIC_REASONS)) {
          val value = observed.optString(key)
          safe.put(key, if (value in names) value else JSONObject.NULL)
        }
        traceDiagnostic(stage, safe)
      } catch (_: Throwable) {} // Provider data never controls logging shape or playback.
    }
  }

  private fun startDiagnosticPoll(view: WebView) {
    if (!diagnosticEnabled()) return
    val generation = diagnosticGeneration
    val weakView = WeakReference(view)
    var samples = 0
    val poll = object : Runnable {
      override fun run() {
        val currentView = weakView.get() ?: return
        if (generation != diagnosticGeneration || !diagnosticEnabled() || !currentView.isAttachedToWindow) return
        sampleWrapperDiagnostic(currentView, "wrapper-dom-after-injection")
        if (++samples < 8) currentView.postDelayed(this, 5000L)
        else if (manifest?.sourceId == "aniembed" && samples < 20) currentView.postDelayed(this, 5000L)
      }
    }
    diagnosticPoll = poll
    diagnosticPollView = weakView
    view.post(poll)
  }

  /** P102 numbers/categories only; provider values cannot become request or playback commands. */
  private fun sanitizeMediaDiagnostic(input: JSONObject): JSONObject {
    val safe = JSONObject()
    fun number(from: JSONObject, into: JSONObject, key: String, max: Double) {
      val value = from.opt(key)
      if (value is Number && value.toDouble().isFinite() && value.toDouble() in 0.0..max) into.put(key, value)
    }
    for (key in listOf("firstId", "firstChanges", "hostSeekRequests")) number(input, safe, key, 64.0)
    number(input, safe, "lastHostTarget", 86400.0)
    for ((key, limit) in listOf("videos" to 4, "history" to 6)) {
      val rows = JSONArray()
      val source = input.optJSONArray(key)
      for (i in 0 until minOf(limit, source?.length() ?: 0)) {
        val entry = source?.optJSONObject(i) ?: continue
        val row = JSONObject()
        for ((name, max) in listOf("id" to 64.0, "time" to 86400.0, "duration" to 86400.0,
          "ready" to 4.0, "network" to 3.0, "error" to 4.0, "width" to 8192.0, "height" to 8192.0)) number(entry, row, name, max)
        for (name in listOf("paused", "seeking", "connected")) if (entry.opt(name) is Boolean) row.put(name, entry.getBoolean(name))
        val event = entry.optString("event")
        if (event in MEDIA_DIAGNOSTIC_EVENTS) row.put("event", event)
        rows.put(row)
      }
      safe.put(key, rows)
    }
    val events = JSONObject()
    input.optJSONObject("events")?.let { for (name in MEDIA_DIAGNOSTIC_EVENTS) number(it, events, name, 64.0) }
    return safe.put("events", events)
  }

  override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
    emit(view, ShieldDecision("rule-failure", "renderer-termination", null))
    return super.onRenderProcessGone(view, detail)
  }

  override fun onSafeBrowsingHit(view: WebView, request: WebResourceRequest, threatType: Int, callback: SafeBrowsingResponse) {
    emit(view, ShieldDecision("blocked", "unsafe-navigation", "safe-browsing"))
    callback.backToSafety(true)
  }

  private fun emptyBlockedResponse(): WebResourceResponse = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
    WebResourceResponse("text/plain", "utf-8", 204, "No Content", emptyMap(), ByteArrayInputStream(ByteArray(0)))
  } else {
    WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
  }

  private fun classify(uri: Uri?, isMainFrame: Boolean, isPopup: Boolean): ShieldDecision {
    val current = manifest ?: return ShieldDecision("allow", "inactive", null)
    val scheme = uri?.scheme?.lowercase(Locale.US).orEmpty()
    val raw = uri?.toString().orEmpty()
    if (raw == "about:blank") return ShieldDecision("allow", "navigation", null)
    if (scheme != "http" && scheme != "https") {
      return ShieldDecision("blocked", "unsafe-navigation", "scheme-deny")
    }
    val host = uri?.host?.lowercase(Locale.US).orEmpty()
    if (host.isEmpty()) return ShieldDecision("blocked", "unsafe-navigation", "hostless-deny")
    val knownOrigin = current.allowedNavigationOrigins.any { originMatches(it, uri) }
    if (isPopup || (isMainFrame && !knownOrigin)) return ShieldDecision("blocked", "unsafe-navigation", null)
    if (current.requiredOrigins.any { originMatches(it, uri) }) return ShieldDecision("required-dependency", "required", null)
    if (current.mediaOrigins.any { originMatches(it, uri) }) return ShieldDecision("observed-media", "media", null)
    if (current.artworkOrigins.any { originMatches(it, uri) }) return ShieldDecision("allow", "artwork", null)
    if (current.subtitleOrigins.any { originMatches(it, uri) }) return ShieldDecision("observed-subtitle", "subtitle", null)
    val classifiedRule = current.rules.firstOrNull { hostMatches(it, host) }
    if (classifiedRule != null) {
      // Observation mode preserves playback compatibility; only device-validated
      // enforce manifests may block subresources.
      if (current.mode == "enforce" && classifiedRule.action == "block") return ShieldDecision("blocked", classifiedRule.kind, classifiedRule.id)
      return ShieldDecision("unknown", classifiedRule.kind, classifiedRule.id)
    }
    if (isSubtitlePath(uri?.path)) return ShieldDecision("observed-subtitle", "subtitle", null)
    if (isMediaPath(uri?.path)) return ShieldDecision("observed-media", "media", null)
    if (isArtworkPath(uri?.path)) return ShieldDecision("allow", "artwork", null)
    return ShieldDecision("unknown", "unknown", null)
  }

  private fun emit(view: WebView, decision: ShieldDecision) {
    // HLS players can issue hundreds of media and artwork requests per minute.
    // React needs proof that observation is working, not a live request meter.
    // Report routine redacted evidence once per page and keep exact aggregation only for
    // actual blocks/failures so shielding cannot starve provider bootstrap.
    synchronized(this) {
      val alwaysReport = decision.decision == "blocked" || decision.decision == "rule-failure"
      val routineKey = when (decision.decision) {
        "active", "required-dependency", "observed-media", "observed-subtitle" -> decision.decision
        else -> null
      }
      if (!alwaysReport) {
        if (routineKey == null || !reportedRoutineEvidence.add(routineKey)) return
      }
      pendingCounts[decision.decision] = (pendingCounts[decision.decision] ?: 0) + 1
      pendingClassifications[decision.classification] =
        (pendingClassifications[decision.classification] ?: 0) + 1
      latestDecision = decision
      if (flushScheduled) return
      flushScheduled = true
    }
    view.post {
      view.postDelayed({
        val counts: Map<String, Int>
        val classifications: Map<String, Int>
        val latest: ShieldDecision?
        synchronized(this) {
          counts = pendingCounts.toMap()
          pendingCounts.clear()
          classifications = pendingClassifications.toMap()
          pendingClassifications.clear()
          latest = latestDecision
          latestDecision = null
          flushScheduled = false
        }
        val payload = JSONObject().put("kind", "orion-shield")
          .put("decision", latest?.decision ?: "unknown")
          .put("classification", latest?.classification ?: "unknown")
          .put("counts", JSONObject(counts))
          .put("classifications", JSONObject(classifications))
        if (latest?.ruleId != null) payload.put("ruleId", latest?.ruleId)
        payload.put("sourceId", manifest?.sourceId ?: "")
          .put("sessionId", manifest?.sessionId ?: "")
          .put("sequence", ++nativeSequence)
          .put("nativeViewTag", nativeViewTag)
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("OrionShieldEvidence", payload.toString())
        val script = "window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(${JSONObject.quote(payload.toString())});true;"
        view.evaluateJavascript(script, null)
      }, 750L)
    }
  }

  private fun resetEvidence() {
    synchronized(this) {
      pendingCounts.clear()
      pendingClassifications.clear()
      reportedRoutineEvidence.clear()
      latestDecision = null
      // A previously posted flush may still run, but it will find an empty
      // snapshot. Keeping its scheduled flag prevents duplicate callbacks.
    }
  }

  private fun originMatches(origin: String, uri: Uri?): Boolean = try {
    val approved = Uri.parse(origin)
    approved.scheme.equals(uri?.scheme, true) && approved.host.equals(uri?.host, true) && approved.port == uri?.port
  } catch (_: Exception) { false }

  private fun hostMatches(rule: ShieldRule, host: String): Boolean =
    host == rule.hostPattern || (rule.includeSubdomains && host.endsWith(".${rule.hostPattern}"))
  private fun isMediaPath(path: String?): Boolean = path?.contains(Regex("\\.(m3u8|mpd|m4s|ts|mp4|webm)(\\?|$)", RegexOption.IGNORE_CASE)) == true
  private fun isSubtitlePath(path: String?): Boolean = path?.contains(Regex("\\.(vtt|srt|ass|ssa)(\\?|$)", RegexOption.IGNORE_CASE)) == true
  private fun isArtworkPath(path: String?): Boolean = path?.contains(Regex("\\.(avif|gif|jpe?g|png|webp)(\\?|$)", RegexOption.IGNORE_CASE)) == true
}

private object OrionCinemaServiceWorkerDownloadObserver {
  private data class ActiveCapture(
    val reactContext: WeakReference<ReactContext>,
    val manifest: ShieldManifest,
  )

  @Volatile private var activeCapture: ActiveCapture? = null
  @Volatile private var installAttempted = false

  fun ensureInstalled() {
    if (installAttempted) return
    synchronized(this) {
      if (installAttempted) return
      installAttempted = true
      try {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE) ||
          !WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)
        ) return
        val controller = ServiceWorkerControllerCompat.getInstance()
        if (WebViewFeature.isFeatureSupported(WebViewFeature.COOKIE_INTERCEPT)) {
          controller.serviceWorkerWebSettings.setIncludeCookiesOnShouldInterceptRequestEnabled(true)
        }
        controller.setServiceWorkerClient(object : ServiceWorkerClientCompat() {
          override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
            val capture = activeCapture ?: return null
            val current = capture.manifest
            val context = capture.reactContext.get() ?: return null
            OrionDownloadRequestContextBroker.observeRequest(
              reactContext = context,
              request = request,
              sourceId = current.sourceId,
              sessionId = current.sessionId,
              providerClass = current.providerClass,
              downloadCaptureEnabled = current.downloadCaptureEnabled,
              allowedMediaOrigins = current.mediaOrigins,
              observationChannel = "service-worker",
            )
            // Observation only. Provider/service-worker networking remains authoritative.
            return null
          }
        })
      } catch (_: Throwable) {
        // Older/broken WebView providers must keep playback functional.
      }
    }
  }

  fun activate(reactContext: ReactContext, manifest: ShieldManifest) {
    if (!manifest.downloadCaptureEnabled || manifest.sessionId.isBlank()) return
    ensureInstalled()
    activeCapture = ActiveCapture(WeakReference(reactContext), manifest)
  }

  fun deactivate(sessionId: String) {
    val current = activeCapture ?: return
    if (current.manifest.sessionId == sessionId) activeCapture = null
  }
}

private data class ShieldRule(
  val id: String,
  val kind: String,
  val hostPattern: String,
  val includeSubdomains: Boolean,
  val action: String,
)
private data class ShieldManifest(
  val sourceId: String,
  val sessionId: String,
  val providerClass: String?,
  val downloadCaptureEnabled: Boolean,
  val downloadAllowed: Boolean,
  val mode: String,
  val allowedNavigationOrigins: List<String>,
  val requiredOrigins: List<String>,
  val mediaOrigins: List<String>,
  val artworkOrigins: List<String>,
  val subtitleOrigins: List<String>,
  val rules: List<ShieldRule>,
) {
  companion object {
    fun parse(serialized: String?): ShieldManifest? = try {
      if (serialized.isNullOrBlank()) null else {
        val json = JSONObject(serialized)
        val strings = { name: String ->
          val array = json.optJSONArray(name) ?: JSONArray()
          (0 until array.length()).mapNotNull { index -> array.optString(index, null) }
        }
        val ruleArray = json.optJSONArray("rules") ?: JSONArray()
        val rules = (0 until ruleArray.length()).mapNotNull { index ->
          val rule = ruleArray.optJSONObject(index) ?: return@mapNotNull null
          val id = rule.optString("id")
          val host = rule.optString("hostPattern")
          if (id.isBlank() || host.isBlank()) null else ShieldRule(
            id,
            rule.optString("kind", "unknown"),
            host.lowercase(Locale.US),
            rule.optBoolean("includeSubdomains", false),
            rule.optString("action", "observe"),
          )
        }
        ShieldManifest(
          json.optString("sourceId", ""),
          json.optString("sessionId", ""),
          json.optString("providerClass", "").trim().takeIf { it.isNotEmpty() },
          json.optBoolean("downloadCaptureEnabled", false),
          json.opt("downloadAllowed") == true,
          json.optString("mode", "observe"),
          strings("allowedNavigationOrigins"),
          strings("requiredOrigins"),
          strings("mediaOrigins"),
          strings("artworkOrigins"),
          strings("subtitleOrigins"),
          rules,
        )
      }
    } catch (_: Exception) { null }
  }
}

private data class ShieldDecision(val decision: String, val classification: String, val ruleId: String?)

private val DIAGNOSTIC_EVENTS = listOf("ready", "play", "pause", "progress", "ended", "error", "episodechange",
  "variantchange", "fullscreenchange", "markerschange", "serverschange", "autonext", "skip")
private val DIAGNOSTIC_REASONS = listOf("session", "topology", "origin", "frame-window", "frame-url", "frame-replaced",
  "terminal", "payload", "unsupported", "unchanged-identity", "identity", "accepted")
private val MEDIA_DIAGNOSTIC_EVENTS = listOf("attached", "sample", "playing", "pause", "waiting", "stalled",
  "seeking", "seeked", "ended", "error", "durationchange")

/** Parent DOM and fixed counters only; foreign URLs, provider payloads and HTML never leave the WebView. */
private val WRAPPER_DIAGNOSTIC_SCRIPT = """
(function() {
  function scheme(value) {
    try { var s = new URL(value).protocol.slice(0, -1); return ['https','http','about','data','blob','file'].includes(s) ? s : 'other'; }
    catch (_) { return 'other'; }
  }
  function origin(value) {
    try { var u = new URL(value); return u.origin === 'https://orion.local' ? 'wrapper'
      : u.origin === 'https://anilink.cc' ? 'provider' : 'other'; } catch (_) { return 'other'; }
  }
  function publicWatch(value) {
    if (typeof value !== 'string' || value.length > 512 || !/^https:\/\/anilink\.cc\/watch\/[1-9][0-9]{0,8}\/[1-9][0-9]{0,8}\?(?:variant=(?:sub|dub)|(?:autoplay|autonext)=(?:true|false)|start=[0-9]{1,9})(?:&(?:variant=(?:sub|dub)|(?:autoplay|autonext)=(?:true|false)|start=[0-9]{1,9}))*$/.test(value)) return null;
    try { var u = new URL(value); return ['sub', 'dub'].includes(u.searchParams.get('variant'))
      && Array.from(u.searchParams.keys()).every(function(k) { return u.searchParams.getAll(k).length === 1; }) ? value : null; }
    catch (_) { return null; }
  }
  function counts(input, names) {
    var safe = {}; names.forEach(function(name) {
      var n = input && input[name]; if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 64) safe[name] = n;
    }); return safe;
  }
  var frame = document.getElementById('orion-provider-frame'), owner = window.__orionPlaybackTelemetry;
  if (owner && owner.sourceId === 'aniembed' && window.location.origin === 'https://aniembed.se'
    && owner.diagnostics && typeof owner.diagnostics.snapshot === 'function') {
    return JSON.stringify({ documentOrigin: 'provider', readyState: document.readyState, documentScheme: 'https',
      contentType: 'html', documentBlank: false, bridgePresent: true, selectedBridge: true,
      media: owner.diagnostics.snapshot() });
  }
  var diag = owner && owner.sourceId === 'anilink' && owner.diagnostics;
  return JSON.stringify({ documentOrigin: origin(window.location.href), readyState: document.readyState,
    documentScheme: scheme(window.location.href), documentBlank: window.location.href === 'about:blank',
    contentType: document.contentType === 'text/html' ? 'html' : document.contentType === 'text/plain' ? 'plain'
      : document.contentType === 'application/xhtml+xml' ? 'xhtml' : 'other',
    frameCount: Math.min(64, document.querySelectorAll('iframe').length), bodyChildren: Math.min(64, document.body ? document.body.children.length : 0),
    hasFrameMarker: !!frame, frameConnected: !!(frame && frame.isConnected), frameOrigin: frame ? origin(frame.src) : 'absent',
    publicWatchUrl: frame ? publicWatch(frame.src) : null, bridgePresent: !!owner, selectedBridge: !!(owner && owner.sourceId === 'anilink'),
    rows: diag && Number.isInteger(diag.rows) && diag.rows >= 0 && diag.rows <= 64 ? diag.rows : 0,
    firstEvent: diag && ['ready','play','pause','progress','ended','error','episodechange','variantchange','fullscreenchange','markerschange','serverschange','autonext','skip'].includes(diag.firstEvent) ? diag.firstEvent : null,
    firstReason: diag && ['session','topology','origin','frame-window','frame-url','frame-replaced','terminal','payload','unsupported','unchanged-identity','identity','accepted'].includes(diag.firstReason) ? diag.firstReason : null,
    lastReason: diag && ['session','topology','origin','frame-window','frame-url','frame-replaced','terminal','payload','unsupported','unchanged-identity','identity','accepted'].includes(diag.last) ? diag.last : null,
    events: counts(diag && diag.events, ['ready','play','pause','progress','ended','error','episodechange','variantchange','fullscreenchange','markerschange','serverschange','autonext','skip']),
    counts: counts(diag && diag.counts, ['session','topology','origin','frame-window','frame-url','frame-replaced','terminal','payload','unsupported','unchanged-identity','identity','accepted']) });
})();
""".trimIndent()
