package com.okali.orion.playback

import androidx.annotation.NonNull
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper
import java.util.WeakHashMap

/** Narrow opt-in manager used only by shielded Cinema playback WebViews. */
class OrionCinemaWebViewManager : RNCWebViewManager() {
  private val clients = WeakHashMap<RNCWebViewWrapper, OrionCinemaWebViewClient>()

  override fun getName(): String = "OrionCinemaWebView"

  override fun addEventEmitters(@NonNull reactContext: ThemedReactContext, viewWrapper: RNCWebViewWrapper) {
    val client = OrionCinemaWebViewClient()
    clients[viewWrapper] = client
    val webView = viewWrapper.webView
    webView.settings.setSupportMultipleWindows(false)
    webView.settings.javaScriptCanOpenWindowsAutomatically = false
    webView.setWebViewClient(client)
    webView.setWebChromeClient(OrionCinemaWebChromeClient(webView, client))
  }

  @ReactProp(name = "orionShieldSession")
  fun setOrionShieldSession(viewWrapper: RNCWebViewWrapper, serializedManifest: String?) {
    clients[viewWrapper]?.setShieldManifest(serializedManifest)
    viewWrapper.webView.settings.setSupportMultipleWindows(false)
    viewWrapper.webView.settings.javaScriptCanOpenWindowsAutomatically = false
  }
}
