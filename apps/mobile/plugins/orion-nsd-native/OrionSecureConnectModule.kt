package com.okali.orion.smartconnect

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import okio.ByteString
import org.json.JSONObject
import java.net.InetAddress
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec
import java.security.cert.X509Certificate
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

/** Pinned HTTPS/WSS and Android-Keystore identity for Smart Connect v3. */
class OrionSecureConnectModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val preferences = context.getSharedPreferences("orion_smart_connect_v3", Context.MODE_PRIVATE)
  private var socket: WebSocket? = null
  private var socketFingerprint: String? = null
  private val alias = "orion_smart_connect_device_v3"

  override fun getName() = "OrionSecureConnect"

  @ReactMethod
  fun getIdentity(promise: Promise) {
    try {
      val pair = keyPair()
      var deviceId = preferences.getString("device_id", null)
      if (deviceId.isNullOrBlank()) {
        deviceId = "mobile-${UUID.randomUUID()}"
        preferences.edit().putString("device_id", deviceId).apply()
      }
      val result = Arguments.createMap()
      result.putString("deviceId", deviceId)
      result.putString("publicKey", Base64.encodeToString(pair.public.encoded, Base64.NO_WRAP))
      result.putString("algorithm", "ECDSA_P256_SHA256")
      promise.resolve(result)
    } catch (error: Exception) { promise.reject("IDENTITY_FAILED", error) }
  }

  @ReactMethod
  fun sign(value: String, promise: Promise) {
    try {
      val signature = Signature.getInstance("SHA256withECDSA")
      signature.initSign(keyPair().private)
      signature.update(value.toByteArray(Charsets.UTF_8))
      promise.resolve(Base64.encodeToString(signature.sign(), Base64.NO_WRAP))
    } catch (error: Exception) { promise.reject("SIGNING_FAILED", error) }
  }

  @ReactMethod
  fun verify(publicKey: String, value: String, signatureValue: String, promise: Promise) {
    try {
      val key = KeyFactory.getInstance("EC").generatePublic(
        X509EncodedKeySpec(Base64.decode(publicKey, Base64.DEFAULT))
      )
      val verifier = Signature.getInstance("SHA256withECDSA")
      verifier.initVerify(key)
      verifier.update(value.toByteArray(Charsets.UTF_8))
      promise.resolve(verifier.verify(Base64.decode(signatureValue, Base64.DEFAULT)))
    } catch (error: Exception) { promise.reject("VERIFY_FAILED", error) }
  }

  @ReactMethod
  fun request(host: String, port: Double, fingerprint: String?, path: String, method: String, body: String?, promise: Promise) {
    if (!privateHost(host)) { promise.reject("PUBLIC_ADDRESS_REJECTED", "Smart Connect requires a private LAN address."); return }
    val client = try { pinnedClient(fingerprint) } catch (error: Exception) { promise.reject("TLS_SETUP_FAILED", error); return }
    val url = "https://${host}:${port.toInt()}${if (path.startsWith('/')) path else "/$path"}"
    val media = "application/json; charset=utf-8".toMediaTypeOrNull()
    val requestBody = if (method.uppercase() == "GET") null else (body ?: "{}").toRequestBody(media)
    val request = Request.Builder().url(url).method(method.uppercase(), requestBody).build()
    client.newCall(request).enqueue(object : Callback {
      override fun onFailure(call: Call, error: java.io.IOException) { promise.reject("SECURE_REQUEST_FAILED", error) }
      override fun onResponse(call: Call, response: Response) {
        response.use {
          val map = Arguments.createMap()
          map.putInt("status", response.code)
          map.putString("body", response.body?.string() ?: "{}")
          map.putString("fingerprint", certificateFingerprint(response.handshake?.peerCertificates?.firstOrNull() as? X509Certificate))
          promise.resolve(map)
        }
      }
    })
  }

  @ReactMethod
  fun openSocket(host: String, port: Double, fingerprint: String, ticket: String, deviceId: String, promise: Promise) {
    if (!privateHost(host)) { promise.reject("PUBLIC_ADDRESS_REJECTED", "Smart Connect requires a private LAN address."); return }
    closeSocketInternal()
    socketFingerprint = normalizeFingerprint(fingerprint)
    val request = Request.Builder()
      .url("wss://${host}:${port.toInt()}/api/socket")
      .header("X-Orion-Ticket", ticket)
      .header("X-Orion-Device", deviceId)
      .build()
    socket = pinnedClient(fingerprint).newWebSocket(request, object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        emit("orionSmartConnectOpen", Arguments.createMap().apply { putBoolean("open", true) })
        promise.resolve(true)
      }
      override fun onMessage(webSocket: WebSocket, text: String) {
        emit("orionSmartConnectMessage", Arguments.createMap().apply { putString("data", text) })
      }
      override fun onMessage(webSocket: WebSocket, bytes: ByteString) = onMessage(webSocket, bytes.utf8())
      override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, reason) }
      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        socket = null
        emit("orionSmartConnectClosed", Arguments.createMap().apply { putInt("code", code); putString("reason", reason) })
      }
      override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) {
        socket = null
        emit("orionSmartConnectFailure", Arguments.createMap().apply { putString("code", "WSS_FAILED"); putString("message", error.message ?: "Secure socket failed") })
        if (response == null) promise.reject("WSS_FAILED", error)
      }
    })
  }

  @ReactMethod fun sendSocket(payload: String, promise: Promise) { promise.resolve(socket?.send(payload) == true) }
  @ReactMethod fun sendRealtimeSocket(payload: String, promise: Promise) { promise.resolve(socket?.send(payload) == true) }
  @ReactMethod fun sendRealtimeSocketFireAndForget(payload: String) { socket?.send(payload) }
  @ReactMethod fun closeSocket(promise: Promise) { closeSocketInternal(); promise.resolve(null) }
  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Double) = Unit

  private fun closeSocketInternal() { socket?.close(1000, "Client closed"); socket = null }

  private fun keyPair(): java.security.KeyPair {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val privateKey = store.getKey(alias, null) as? java.security.PrivateKey
    val publicKey = store.getCertificate(alias)?.publicKey
    if (privateKey != null && publicKey != null) return java.security.KeyPair(publicKey, privateKey)
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
    generator.initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
      .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256).build())
    return generator.generateKeyPair()
  }

  private fun pinnedClient(fingerprint: String?): OkHttpClient {
    val expected = normalizeFingerprint(fingerprint)
    val trust = object : X509TrustManager {
      override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
      override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
      override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
        if (chain.isEmpty()) throw java.security.cert.CertificateException("Missing Desktop certificate")
        val observed = certificateFingerprint(chain[0])
        if (expected.isNotEmpty() && observed != expected) throw java.security.cert.CertificateException("Desktop certificate changed")
      }
    }
    val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf<TrustManager>(trust), null) }
    return OkHttpClient.Builder()
      .sslSocketFactory(ssl.socketFactory, trust)
      .hostnameVerifier { _, session ->
        val certificate = session.peerCertificates.firstOrNull() as? X509Certificate
        expected.isEmpty() || certificateFingerprint(certificate) == expected
      }
      .connectTimeout(3, TimeUnit.SECONDS).readTimeout(5, TimeUnit.SECONDS).build()
  }

  private fun privateHost(host: String): Boolean = try {
    val address = InetAddress.getByName(host).address
    (address.size == 4 && ((address[0].toInt() and 255) == 10
      || ((address[0].toInt() and 255) == 172 && (address[1].toInt() and 255) in 16..31)
      || ((address[0].toInt() and 255) == 192 && (address[1].toInt() and 255) == 168)))
  } catch (_: Exception) { false }

  private fun normalizeFingerprint(value: String?): String = value.orEmpty().lowercase().replace(Regex("[^0-9a-f]"), "")
  private fun certificateFingerprint(certificate: X509Certificate?): String = certificate?.let {
    MessageDigest.getInstance("SHA-256").digest(it.encoded).joinToString("") { byte -> "%02x".format(byte) }
  } ?: ""
  private fun emit(name: String, payload: Any) {
    if (context.hasActiveReactInstance()) context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload)
  }
}
