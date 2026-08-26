package com.okali.orion.playback

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class OrionCinemaWebViewPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(
    OrionPlayerSystemUiModule(reactContext),
    OrionDownloadCaptureModule(reactContext),
    OrionDownloadEngineModule(reactContext),
  )
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = listOf(
    OrionCinemaWebViewManager(),
    OrionOfflinePlayerViewManager(),
  )
}
