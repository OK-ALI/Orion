package com.okali.orion.playback

import android.os.Message
import android.webkit.WebView
import com.reactnativecommunity.webview.RNCWebChromeClient
import com.reactnativecommunity.webview.RNCWebView

/** Cinema-only Chrome client: retain RNC fullscreen/media support, deny popups. */
class OrionCinemaWebChromeClient(
  webView: RNCWebView,
  private val cinemaClient: OrionCinemaWebViewClient,
) : RNCWebChromeClient(webView) {
  override fun onCreateWindow(
    view: WebView,
    isDialog: Boolean,
    isUserGesture: Boolean,
    resultMsg: Message,
  ): Boolean {
    cinemaClient.recordPopupBlocked(view)
    return false
  }
}
