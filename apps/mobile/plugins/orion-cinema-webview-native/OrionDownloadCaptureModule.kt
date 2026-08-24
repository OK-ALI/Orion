package com.okali.orion.playback

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Opaque React bridge for lifecycle/binding only. It never accepts or returns a URL. */
class OrionDownloadCaptureModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "OrionDownloadCapture"

  @ReactMethod
  fun bindRequestContext(candidateId: String, jobId: String, promise: Promise) {
    val result = OrionDownloadRequestContextBroker.bindRequestContext(candidateId.trim(), jobId.trim())
    if (result == null) {
      promise.resolve(Arguments.createMap().apply { putBoolean("ok", false) })
      return
    }
    promise.resolve(Arguments.createMap().apply {
      putBoolean("ok", true)
      putString("requestContextId", result.requestContextId)
      if (result.expiresAt == null) putNull("expiresAt") else putDouble("expiresAt", result.expiresAt.toDouble())
    })
  }

  @ReactMethod
  fun releaseSession(sessionId: String) {
    OrionDownloadRequestContextBroker.releaseSession(sessionId.trim())
  }

  @ReactMethod
  fun releaseJobContext(jobId: String) {
    OrionDownloadRequestContextBroker.releaseJob(jobId.trim())
  }
}
