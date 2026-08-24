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
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.Locale

/**
 * Native, Cinema-only request classifier. It deliberately never exports a
 * request URL, headers, cookies, signed media location or credentials.
 */
class OrionCinemaWebViewClient(
  private val reactContext: ReactContext,
  private val nativeViewTag: Int,
) : RNCWebViewClient() {
  private var manifest: ShieldManifest? = null
  private val pendingCounts = mutableMapOf<String, Int>()
  private val pendingClassifications = mutableMapOf<String, Int>()
  private val reportedRoutineEvidence = mutableSetOf<String>()
  private var latestDecision: ShieldDecision? = null
  private var flushScheduled = false
  private var nativeSequence = 0L
  private var lastP102ManifestTraceKey: String? = null

  fun setShieldManifest(serialized: String?) {
    manifest = ShieldManifest.parse(serialized)
    val current = manifest ?: return
    val traceKey = "${current.sessionId}:${current.sourceId}:${current.downloadCaptureEnabled}"
    if (lastP102ManifestTraceKey != traceKey) {
      lastP102ManifestTraceKey = traceKey
      Log.i(
        "OrionP102Trace",
        "stage=manifest source=${current.sourceId.take(40)} capture=${current.downloadCaptureEnabled} mediaOrigins=${current.mediaOrigins.size}",
      )
    }
  }

  fun recordPopupBlocked(view: WebView) {
    emit(view, ShieldDecision("blocked", "popup", "native-popup-deny"))
  }

  override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
    val decision = classify(request.url, request.isForMainFrame, isPopup = false)
    emit(view, decision)
    return if (decision.decision == "blocked" && request.isForMainFrame) true else super.shouldOverrideUrlLoading(view, request)
  }

  override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
    val decision = classify(Uri.parse(url), isMainFrame = true, isPopup = false)
    emit(view, decision)
    return if (decision.decision == "blocked") true else super.shouldOverrideUrlLoading(view, url)
  }

  override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
    val decision = classify(request.url, request.isForMainFrame, isPopup = false)
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
      )
    }
    return if (decision.decision == "blocked") emptyBlockedResponse() else null
  }

  @Deprecated("Deprecated in Android")
  override fun shouldInterceptRequest(view: WebView, url: String): WebResourceResponse? {
    val decision = classify(Uri.parse(url), isMainFrame = false, isPopup = false)
    emit(view, decision)
    return if (decision.decision == "blocked") emptyBlockedResponse() else null
  }

  override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
    resetEvidence()
    emit(view, ShieldDecision("active", "native-session", null))
    super.onPageStarted(view, url, favicon)
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
        )
      }
    } catch (_: Exception) { null }
  }
}

private data class ShieldDecision(val decision: String, val classification: String, val ruleId: String?)
