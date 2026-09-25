package com.okali.orion.playback

import android.view.GestureDetector
import android.util.Log
import android.view.MotionEvent
import android.view.View
import androidx.annotation.NonNull
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper
import org.json.JSONObject
import java.util.WeakHashMap

/** Narrow opt-in manager used only by shielded Cinema playback WebViews. */
class OrionCinemaWebViewManager : RNCWebViewManager() {
  companion object {
    private const val ORIGINAL_PRESENTATION = "provider"
    private const val ORIGINAL_LAYOUT_SETTLE_MS = 72L
    private const val ORIGINAL_SURFACE_LOG = "OrionOriginalSurface"
  }

  private val fabricDelegate = OrionCinemaWebViewManagerDelegate(this)

  private val clients = WeakHashMap<RNCWebViewWrapper, OrionCinemaWebViewClient>()
  private val tapIdentities = WeakHashMap<RNCWebViewWrapper, TapIdentity>()
  private val tapObservers = WeakHashMap<RNCWebViewWrapper, ConfirmedTapObserver>()
  private val presentationModes = WeakHashMap<RNCWebViewWrapper, String>()
  private val surfaceRecoveryGeneration = WeakHashMap<RNCWebViewWrapper, Int>()
  private val completedSurfaceRecovery = WeakHashMap<RNCWebViewWrapper, Int>()

  override fun getName(): String = "OrionCinemaWebView"

  override fun getDelegate(): ViewManagerDelegate<RNCWebViewWrapper> = fabricDelegate

  override fun addEventEmitters(@NonNull reactContext: ThemedReactContext, viewWrapper: RNCWebViewWrapper) {
    val client = OrionCinemaWebViewClient(reactContext, viewWrapper.id) {
      if (presentationModes[viewWrapper] == ORIGINAL_PRESENTATION) {
        armOriginalSurfaceRecovery(viewWrapper, "page-settled")
      }
    }
    clients[viewWrapper] = client
    val webView = viewWrapper.webView
    webView.settings.setSupportMultipleWindows(false)
    webView.settings.javaScriptCanOpenWindowsAutomatically = false
    try {
      if (WebViewFeature.isFeatureSupported(WebViewFeature.COOKIE_INTERCEPT)) {
        WebSettingsCompat.setCookiesIncludedInShouldInterceptRequest(webView.settings, true)
      }
    } catch (_: Throwable) {
      // Cookie interception is opportunistic and must never break provider playback.
    }
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

    val nextPresentation = parsePresentationMode(serializedManifest)
    val previousPresentation = presentationModes.put(viewWrapper, nextPresentation)
    if (previousPresentation != nextPresentation) {
      cancelPendingSurfaceRecovery(viewWrapper)
      if (nextPresentation == ORIGINAL_PRESENTATION) {
        armOriginalSurfaceRecovery(viewWrapper, "mode-transition")
      }
    }

    viewWrapper.webView.settings.setSupportMultipleWindows(false)
    viewWrapper.webView.settings.javaScriptCanOpenWindowsAutomatically = false
  }

  override fun onDropViewInstance(viewWrapper: RNCWebViewWrapper) {
    tapObservers.remove(viewWrapper)?.dispose()
    tapIdentities.remove(viewWrapper)
    presentationModes.remove(viewWrapper)
    surfaceRecoveryGeneration.remove(viewWrapper)
    completedSurfaceRecovery.remove(viewWrapper)
    clients.remove(viewWrapper)?.dispose()
    viewWrapper.webView.setOnTouchListener(null)
    super.onDropViewInstance(viewWrapper)
  }

  private fun cancelPendingSurfaceRecovery(viewWrapper: RNCWebViewWrapper) {
    surfaceRecoveryGeneration[viewWrapper] = (surfaceRecoveryGeneration[viewWrapper] ?: 0) + 1
  }

  private fun armOriginalSurfaceRecovery(viewWrapper: RNCWebViewWrapper, reason: String) {
    val generation = (surfaceRecoveryGeneration[viewWrapper] ?: 0) + 1
    surfaceRecoveryGeneration[viewWrapper] = generation
    val webView = viewWrapper.webView
    var layoutObserved = false
    val listener = object : View.OnLayoutChangeListener {
      override fun onLayoutChange(
        view: View,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
        oldLeft: Int,
        oldTop: Int,
        oldRight: Int,
        oldBottom: Int,
      ) {
        if (left == oldLeft && top == oldTop && right == oldRight && bottom == oldBottom) return
        layoutObserved = true
        webView.removeOnLayoutChangeListener(this)
        webView.postOnAnimation { recoverOriginalSurface(viewWrapper, generation, "$reason-layout") }
      }
    }
    webView.addOnLayoutChangeListener(listener)
    viewWrapper.requestLayout()
    webView.requestLayout()
    webView.postDelayed({
      webView.removeOnLayoutChangeListener(listener)
      if (!layoutObserved) recoverOriginalSurface(viewWrapper, generation, "$reason-settled")
    }, ORIGINAL_LAYOUT_SETTLE_MS)
  }

  private fun recoverOriginalSurface(viewWrapper: RNCWebViewWrapper, generation: Int, reason: String) {
    if (presentationModes[viewWrapper] != ORIGINAL_PRESENTATION) return
    if (surfaceRecoveryGeneration[viewWrapper] != generation) return
    if (completedSurfaceRecovery[viewWrapper] == generation) return
    val webView = viewWrapper.webView
    if (!webView.isAttachedToWindow || webView.width <= 0 || webView.height <= 0) return
    completedSurfaceRecovery[viewWrapper] = generation

    val beforeWidth = webView.width
    val beforeHeight = webView.height
    viewWrapper.requestLayout()
    webView.requestLayout()
    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
    webView.buildLayer()
    webView.invalidate()
    webView.postInvalidateOnAnimation()

    webView.postOnAnimation {
      if (presentationModes[viewWrapper] != ORIGINAL_PRESENTATION) return@postOnAnimation
      if (surfaceRecoveryGeneration[viewWrapper] != generation) return@postOnAnimation
      webView.setLayerType(View.LAYER_TYPE_NONE, null)
      viewWrapper.requestLayout()
      webView.requestLayout()
      viewWrapper.invalidate()
      webView.invalidate()
      webView.postInvalidateOnAnimation()
      Log.i(
        ORIGINAL_SURFACE_LOG,
        "reason=$reason before=${beforeWidth}x${beforeHeight} after=${webView.width}x${webView.height} attached=${webView.isAttachedToWindow} shown=${webView.isShown} layer=${webView.layerType}",
      )
    }
  }

  private fun parsePresentationMode(serializedManifest: String?): String {
    if (serializedManifest.isNullOrBlank()) return ORIGINAL_PRESENTATION
    return try {
      when (JSONObject(serializedManifest).optString("presentationMode")) {
        "fit" -> "fit"
        "fill" -> "fill"
        else -> ORIGINAL_PRESENTATION
      }
    } catch (_: Throwable) {
      ORIGINAL_PRESENTATION
    }
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
