package com.okali.orion.smartconnect

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

class OrionNsdModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
  private var listener: NsdManager.DiscoveryListener? = null
  private var multicastLock: WifiManager.MulticastLock? = null
  private var discoveryPromise: Promise? = null
  private val results = ConcurrentHashMap<String, NsdServiceInfo>()
  private val resolving = AtomicBoolean(false)
  private val pendingResolutions = ConcurrentLinkedQueue<NsdServiceInfo>()

  override fun getName() = "OrionNsdDiscovery"

  @ReactMethod
  fun discover(timeoutMs: Double, promise: Promise) {
    stopInternal(false)
    results.clear()
    pendingResolutions.clear()
    discoveryPromise = promise
    acquireMulticastLock()
    val active = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(serviceType: String) = Unit
      override fun onServiceLost(serviceInfo: NsdServiceInfo) { results.remove(serviceInfo.serviceName) }
      override fun onServiceFound(serviceInfo: NsdServiceInfo) {
        if (serviceInfo.serviceType.contains("_orion-connect._tcp")) {
          pendingResolutions.offer(serviceInfo)
          resolveNext()
        }
      }
      override fun onDiscoveryStopped(serviceType: String) = Unit
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) { finish("NSD_START_$errorCode") }
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) { finish(null) }
    }
    listener = active
    try {
      nsdManager.discoverServices("_orion-connect._tcp.", NsdManager.PROTOCOL_DNS_SD, active)
      android.os.Handler(context.mainLooper).postDelayed({ finish(null) }, timeoutMs.toLong().coerceIn(800L, 12_000L))
    } catch (error: Exception) {
      finish(error.javaClass.simpleName)
    }
  }

  @ReactMethod
  fun stopDiscovery(promise: Promise) {
    stopInternal(true)
    promise.resolve(null)
  }

  private fun resolveNext() {
    if (!resolving.compareAndSet(false, true)) return
    val serviceInfo = pendingResolutions.poll()
    if (serviceInfo == null) {
      resolving.set(false)
      return
    }
    nsdManager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
      override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
        resolving.set(false)
        resolveNext()
      }
      override fun onServiceResolved(info: NsdServiceInfo) {
        results[info.serviceName] = info
        resolving.set(false)
        resolveNext()
      }
    })
  }

  private fun finish(errorCode: String?) {
    val promise = discoveryPromise ?: return
    discoveryPromise = null
    val items = Arguments.createArray()
    results.values.forEach { info ->
      val host = info.host?.hostAddress ?: return@forEach
      val map = Arguments.createMap()
      map.putString("instanceId", attribute(info, "instanceId") ?: info.serviceName)
      map.putString("displayName", info.serviceName)
      map.putString("host", host)
      map.putInt("port", info.port)
      map.putInt("protocolVersion", attribute(info, "version")?.toIntOrNull() ?: 0)
      map.putString("certificateFingerprint", attribute(info, "fingerprint") ?: "")
      items.pushMap(map)
    }
    stopInternal(false)
    val response = Arguments.createMap()
    response.putArray("results", items)
    if (errorCode != null) response.putString("errorCode", errorCode)
    promise.resolve(response)
  }

  private fun attribute(info: NsdServiceInfo, key: String): String? = try {
    info.attributes[key]?.toString(Charsets.UTF_8)
  } catch (_: Exception) { null }

  private fun acquireMulticastLock() {
    try {
      val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      multicastLock = wifi.createMulticastLock("orion-smart-connect-discovery").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Exception) { multicastLock = null }
  }

  private fun stopInternal(resolvePending: Boolean) {
    listener?.let { active -> try { nsdManager.stopServiceDiscovery(active) } catch (_: Exception) {} }
    listener = null
    try { if (multicastLock?.isHeld == true) multicastLock?.release() } catch (_: Exception) {}
    multicastLock = null
    if (resolvePending) {
      discoveryPromise?.resolve(Arguments.createMap().apply { putArray("results", Arguments.createArray()) })
      discoveryPromise = null
    }
  }
}
