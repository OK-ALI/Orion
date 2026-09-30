package com.okali.orion.playback

import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.util.Log
import android.webkit.SafeBrowsingResponse
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import com.facebook.react.bridge.ReactContext
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
  private val wrapperDiagnosticKeys = mutableSetOf<String>()

  init {
    OrionCinemaServiceWorkerDownloadObserver.ensureInstalled()
  }

  fun setShieldManifest(serialized: String?) {
    val previousSessionId = manifest?.sessionId
    val next = ShieldManifest.parse(serialized)
    if (manifest?.sessionId != next?.sessionId || manifest?.sourceId != next?.sourceId) {
      synchronized(wrapperDiagnosticKeys) { wrapperDiagnosticKeys.clear() }
    }
    manifest = next
    if (previousSessionId != null && previousSessionId != next?.sessionId) {
      OrionCinemaServiceWorkerDownloadObserver.deactivate(previousSessionId)
    }
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
  }

  fun dispose() {
    manifest?.sessionId?.let(OrionCinemaServiceWorkerDownloadObserver::deactivate)
    manifest = null
  }

  fun recordPopupBlocked(view: WebView) {
    emit(view, ShieldDecision("blocked", "popup", "native-popup-deny"))
  }

  override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
    val decision = classify(request.url, request.isForMainFrame, isPopup = false)
    traceWrapperFrame("navigation", request.url, request.isForMainFrame, null, decision.decision)
    emit(view, decision)
    return if (decision.decision == "blocked" && request.isForMainFrame) true else super.shouldOverrideUrlLoading(view, request)
  }

  override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
    val decision = classify(Uri.parse(url), isMainFrame = true, isPopup = false)
    traceWrapperFrame("navigation-legacy", Uri.parse(url), null, null, decision.decision)
    emit(view, decision)
    return if (decision.decision == "blocked") true else super.shouldOverrideUrlLoading(view, url)
  }

  override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
    val decision = classify(request.url, request.isForMainFrame, isPopup = false)
    if (manifest?.wrapperDiagnosticOrigins != null) {
      val destination = request.requestHeaders.entries.firstOrNull { it.key.equals("sec-fetch-dest", true) }?.value
      traceWrapperFrame("request", request.url, request.isForMainFrame, destination, decision.decision)
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
    traceWrapperFrame("request-legacy", Uri.parse(url), null, null, decision.decision)
    emit(view, decision)
    return if (decision.decision == "blocked") emptyBlockedResponse() else null
  }

  override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
    traceWrapperFrame("page-started", Uri.parse(url), true, null, "lifecycle")
    resetEvidence()
    emit(view, ShieldDecision("active", "native-session", null))
    super.onPageStarted(view, url, favicon)
  }

  override fun onPageFinished(view: WebView, url: String) {
    traceWrapperFrame("page-finished", Uri.parse(url), true, null, "lifecycle")
    super.onPageFinished(view, url)
    onPageSettled?.invoke(view)
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

  /** Observation only: diagnostic origins never participate in classify or broker authorization. */
  private fun traceWrapperFrame(stage: String, uri: Uri?, isMainFrame: Boolean?, destination: String?, decision: String) {
    val current = manifest ?: return
    val providerOrigins = current.wrapperDiagnosticOrigins ?: return
    val origin = providerOrigins.firstOrNull { originMatches(it, uri) }
      ?: if (originMatches("https://orion.local", uri) && current.allowedNavigationOrigins.contains("https://orion.local")) "https://orion.local" else "other"
    val provider = providerOrigins.contains(origin)
    val frameHint = destination?.lowercase(Locale.US)
    val category = when {
      isMainFrame == true && origin == "https://orion.local" -> "top-level-wrapper"
      isMainFrame == true -> "top-level-other"
      isMainFrame == null -> "frame-unknown"
      provider && stage == "navigation" -> "provider-subframe-navigation"
      provider && frameHint in setOf("iframe", "frame", "document") -> "provider-subframe-request"
      frameHint in setOf("iframe", "frame", "document") -> "other-subframe-request"
      frameHint == null || frameHint.isEmpty() -> "subresource-unclassified"
      else -> "ordinary-subresource-request"
    }
    val key = "$stage:$category:$origin:$decision"
    synchronized(wrapperDiagnosticKeys) {
      if (wrapperDiagnosticKeys.size >= 32 || !wrapperDiagnosticKeys.add(key)) return
    }
    val source = current.sourceId.replace(Regex("[^a-z0-9-]"), "").take(40)
    Log.i("OrionP102Trace", "stage=wrapper-native-$stage source=$source category=$category origin=$origin decision=$decision")
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
  val mode: String,
  val allowedNavigationOrigins: List<String>,
  val requiredOrigins: List<String>,
  val mediaOrigins: List<String>,
  val artworkOrigins: List<String>,
  val subtitleOrigins: List<String>,
  val rules: List<ShieldRule>,
  val wrapperDiagnosticOrigins: List<String>?,
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
          json.optString("mode", "observe"),
          strings("allowedNavigationOrigins"),
          strings("requiredOrigins"),
          strings("mediaOrigins"),
          strings("artworkOrigins"),
          strings("subtitleOrigins"),
          rules,
          if (json.has("wrapperDiagnosticOrigins")) strings("wrapperDiagnosticOrigins").filter { origin ->
            try {
              val uri = Uri.parse(origin)
              origin.length <= 200 && uri.scheme == "https" && !uri.host.isNullOrBlank()
                && uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.isNullOrEmpty()
            } catch (_: Exception) { false }
          }.take(8) else null,
        )
      }
    } catch (_: Exception) { null }
  }
}

private data class ShieldDecision(val decision: String, val classification: String, val ruleId: String?)
