package com.okali.orion.playback

import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import androidx.annotation.NonNull
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper
import org.json.JSONObject
import java.util.WeakHashMap

/** Narrow opt-in manager used only by shielded Cinema playback WebViews. */
class OrionCinemaWebViewManager : RNCWebViewManager() {
  private val clients = WeakHashMap<RNCWebViewWrapper, OrionCinemaWebViewClient>()
  private val tapIdentities = WeakHashMap<RNCWebViewWrapper, TapIdentity>()
  private val tapObservers = WeakHashMap<RNCWebViewWrapper, ConfirmedTapObserver>()

  override fun getName(): String = "OrionCinemaWebView"

  override fun addEventEmitters(@NonNull reactContext: ThemedReactContext, viewWrapper: RNCWebViewWrapper) {
    val client = OrionCinemaWebViewClient(reactContext, viewWrapper.id)
    clients[viewWrapper] = client
    val webView = viewWrapper.webView
    webView.settings.setSupportMultipleWindows(false)
    webView.settings.javaScriptCanOpenWindowsAutomatically = false
    webView.setWebViewClient(client)
    webView.setWebChromeClient(OrionCinemaWebChromeClient(webView, client))
    val tapObserver = ConfirmedTapObserver(reactContext, viewWrapper.id) {
      tapIdentities[viewWrapper]
    }
    tapObservers[viewWrapper] = tapObserver
    webView.setOnTouchListener(tapObserver)
  }

  @ReactProp(name = "orionShieldSession")
  fun setOrionShieldSession(viewWrapper: RNCWebViewWrapper, serializedManifest: String?) {
    clients[viewWrapper]?.setShieldManifest(serializedManifest)
    val identity = parseTapIdentity(serializedManifest)
    if (identity == null) tapIdentities.remove(viewWrapper)
    else tapIdentities[viewWrapper] = identity
    viewWrapper.webView.settings.setSupportMultipleWindows(false)
    viewWrapper.webView.settings.javaScriptCanOpenWindowsAutomatically = false
  }

  override fun onDropViewInstance(viewWrapper: RNCWebViewWrapper) {
    tapObservers.remove(viewWrapper)?.dispose()
    tapIdentities.remove(viewWrapper)
    clients.remove(viewWrapper)
    viewWrapper.webView.setOnTouchListener(null)
    super.onDropViewInstance(viewWrapper)
  }

  private fun parseTapIdentity(serializedManifest: String?): TapIdentity? {
    if (serializedManifest.isNullOrBlank()) return null
    return try {
      val json = JSONObject(serializedManifest)
      val sessionId = json.optString("sessionId").trim()
      val sourceId = json.optString("sourceId").trim()
      if (sessionId.isEmpty() || sourceId.isEmpty()) null else TapIdentity(sessionId, sourceId)
    } catch (_: Throwable) {
      null
    }
  }
}

private data class TapIdentity(val sessionId: String, val sourceId: String)

/**
 * Observes a confirmed single tap without consuming the WebView's original
 * event. GestureDetector suppresses drags, long presses and double taps; the
 * pointer-count guard also excludes multi-touch gestures.
 */
private class ConfirmedTapObserver(
  private val reactContext: ThemedReactContext,
  private val nativeViewTag: Int,
  private val identityProvider: () -> TapIdentity?,
) : View.OnTouchListener {
  private var gestureIdentity: TapIdentity? = null
  private var multiTouchSeen = false
  private var sequence = 0L
  private var disposed = false
  private val detector = GestureDetector(
    reactContext,
    object : GestureDetector.SimpleOnGestureListener() {
      override fun onDown(event: MotionEvent): Boolean = true

      override fun onSingleTapConfirmed(event: MotionEvent): Boolean {
        if (disposed || multiTouchSeen) return false
        val identity = gestureIdentity ?: return false
        sequence += 1
        val payload = JSONObject()
          .put("sessionId", identity.sessionId)
          .put("sourceId", identity.sourceId)
          .put("sequence", sequence)
          .put("nativeViewTag", nativeViewTag)
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("OrionPlayerSingleTap", payload.toString())
        return false
      }
    },
  )

  override fun onTouch(view: View?, event: MotionEvent): Boolean {
    if (disposed) return false
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        multiTouchSeen = false
        gestureIdentity = identityProvider()
      }
      MotionEvent.ACTION_POINTER_DOWN -> multiTouchSeen = true
      MotionEvent.ACTION_CANCEL -> gestureIdentity = null
    }
    if (event.pointerCount > 1) multiTouchSeen = true
    detector.onTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_CANCEL) {
      gestureIdentity = null
    }
    // Observation must never consume the provider player's original touch.
    return false
  }

  fun dispose() {
    disposed = true
    gestureIdentity = null
  }
}
