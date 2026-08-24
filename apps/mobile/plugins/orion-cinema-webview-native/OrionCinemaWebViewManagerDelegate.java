package com.okali.orion.playback;

import androidx.annotation.Nullable;

import com.facebook.react.viewmanagers.RNCWebViewManagerDelegate;
import com.reactnativecommunity.webview.RNCWebViewWrapper;

/**
 * Fabric-aware extension of the generated React Native WebView delegate.
 *
 * Java is intentional here: subclassing the generated delegate anonymously in
 * Kotlin creates a JVM bridge collision between receiveCommand and
 * javaCompat_receiveCommand. This delegate adds only Orion's custom prop and
 * leaves every stock WebView prop/command on the generated path.
 */
final class OrionCinemaWebViewManagerDelegate
    extends RNCWebViewManagerDelegate<RNCWebViewWrapper, OrionCinemaWebViewManager> {

  private final OrionCinemaWebViewManager orionManager;

  OrionCinemaWebViewManagerDelegate(OrionCinemaWebViewManager manager) {
    super(manager);
    orionManager = manager;
  }

  @Override
  public void setProperty(RNCWebViewWrapper view, String propName, @Nullable Object value) {
    if ("orionShieldSession".equals(propName)) {
      orionManager.setOrionShieldSession(view, value instanceof String ? (String) value : null);
      return;
    }
    super.setProperty(view, propName, value);
  }
}
