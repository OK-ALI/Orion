package com.okali.waven.playback

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WavenPlaybackPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(WavenPlaybackModule(context))

  override fun createViewManagers(
    context: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
