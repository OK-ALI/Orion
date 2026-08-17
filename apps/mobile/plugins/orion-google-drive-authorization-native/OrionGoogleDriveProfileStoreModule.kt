package com.okali.orion.cloud

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

/**
 * Native Google Drive appDataFolder transport for PortableProfileV3.
 *
 * The OAuth bearer token never crosses the React Native bridge. JavaScript
 * supplies only an account email, opaque profile key, validated JSON document,
 * and opaque revision tag.
 */
class OrionGoogleDriveProfileStoreModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val DRIVE_API = "https://www.googleapis.com/drive/v3"
    private const val DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
    private const val PROFILE_FILE_PREFIX = "orion-portable-profile-v3-"
    private const val PROFILE_MIME_TYPE = "application/json"
    private const val MAX_PROFILE_BYTES = 2 * 1024 * 1024
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 25_000
    private const val READ_SNAPSHOT_ATTEMPTS = 3
    private const val READ_SNAPSHOT_RETRY_DELAY_MS = 150L
  }

  private data class StableProfileSnapshot(
    val metadata: DriveFile,
    val profileJson: String,
  )

  private data class DriveFile(
    val id: String,
    val version: String,
    val modifiedAt: Long?,
    val etag: String?,
  ) {
    fun revisionTag(): String =
      if (!etag.isNullOrBlank() && !etag.startsWith("W/")) "etag:$etag" else "version:$version"
  }

  private class DriveHttpException(
    val status: Int,
    val responseBody: String,
  ) : RuntimeException("Google Drive request failed with HTTP $status")

  private val ioExecutor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "OrionGoogleDriveProfileStore"

  @ReactMethod
  fun readPortableProfile(accountEmail: String, profileKey: String, promise: Promise) {
    val email = accountEmail.trim()
    val key = profileKey.trim()
    if (email.isEmpty() || key.isEmpty()) {
      promise.reject("GOOGLE_DRIVE_PROFILE_ARGUMENT_INVALID", "A Google account and profile key are required.")
      return
    }

    ioExecutor.execute {
      try {
        val token = requireToken(email)
        val matches = findProfileFiles(token, key)
        if (matches.size > 1) {
          promise.reject("GOOGLE_DRIVE_PROFILE_DUPLICATE", "More than one Orion cloud profile exists for this key.")
          return@execute
        }
        if (matches.isEmpty()) {
          val response = Arguments.createMap().apply {
            putString("state", "missing")
            putNull("revisionTag")
          }
          promise.resolve(response)
          return@execute
        }

        val snapshot = readStableProfileSnapshot(token, matches.first())
        // Parse once natively so malformed transport data cannot masquerade as
        // a successful profile read. PortableProfileV3 validation still lives
        // in the backend-neutral TypeScript boundary.
        JSONObject(snapshot.profileJson)

        val response = Arguments.createMap().apply {
          putString("state", "found")
          putString("profileJson", snapshot.profileJson)
          putString("revisionTag", snapshot.metadata.revisionTag())
          snapshot.metadata.modifiedAt?.let { putDouble("remoteModifiedAt", it.toDouble()) } ?: putNull("remoteModifiedAt")
        }
        promise.resolve(response)
      } catch (error: Throwable) {
        rejectPromise(promise, error)
      }
    }
  }

  @ReactMethod
  fun writePortableProfile(
    accountEmail: String,
    profileKey: String,
    profileJson: String,
    expectedRevisionTag: String?,
    promise: Promise,
  ) {
    val email = accountEmail.trim()
    val key = profileKey.trim()
    if (email.isEmpty() || key.isEmpty()) {
      promise.reject("GOOGLE_DRIVE_PROFILE_ARGUMENT_INVALID", "A Google account and profile key are required.")
      return
    }

    val payload = profileJson.trim()
    val payloadBytes = payload.toByteArray(Charsets.UTF_8)
    if (payload.isEmpty() || payloadBytes.size > MAX_PROFILE_BYTES) {
      promise.reject("GOOGLE_DRIVE_PROFILE_INVALID", "The Orion cloud profile payload is invalid or too large.")
      return
    }
    try {
      JSONObject(payload)
    } catch (_: Throwable) {
      promise.reject("GOOGLE_DRIVE_PROFILE_INVALID", "The Orion cloud profile payload is not valid JSON.")
      return
    }

    ioExecutor.execute {
      try {
        val token = requireToken(email)
        val matches = findProfileFiles(token, key)
        if (matches.size > 1) {
          promise.reject("GOOGLE_DRIVE_PROFILE_DUPLICATE", "More than one Orion cloud profile exists for this key.")
          return@execute
        }

        if (expectedRevisionTag == null) {
          if (matches.isNotEmpty()) {
            val current = fetchMetadata(token, matches.first())
            promise.resolve(conflictResult(current.revisionTag()))
            return@execute
          }

          val createdId = createProfile(token, key, payloadBytes)
          val created = fetchMetadata(token, createdId)
          promise.resolve(writtenResult(created))
          return@execute
        }

        if (matches.isEmpty()) {
          promise.resolve(conflictResult(null))
          return@execute
        }

        val current = fetchMetadata(token, matches.first())
        if (current.revisionTag() != expectedRevisionTag) {
          promise.resolve(conflictResult(current.revisionTag()))
          return@execute
        }

        try {
          updateProfile(token, current, payloadBytes, expectedRevisionTag)
        } catch (error: DriveHttpException) {
          if (error.status == 412) {
            val latest = try {
              fetchMetadata(token, current.id).revisionTag()
            } catch (_: Throwable) {
              null
            }
            promise.resolve(conflictResult(latest))
            return@execute
          }
          throw error
        }

        val updated = fetchMetadata(token, current.id)
        promise.resolve(writtenResult(updated))
      } catch (error: Throwable) {
        rejectPromise(promise, error)
      }
    }
  }

  private fun requireToken(accountEmail: String): String =
    OrionGoogleDriveTokenVault.tokenFor(accountEmail)
      ?: throw IllegalStateException("GOOGLE_DRIVE_REAUTH_REQUIRED")

  private fun profileFileName(profileKey: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
      .digest(profileKey.toByteArray(Charsets.UTF_8))
      .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
      .take(32)
    return "$PROFILE_FILE_PREFIX$digest.json"
  }

  private fun findProfileFiles(token: String, profileKey: String): List<String> {
    val fileName = profileFileName(profileKey)
    val query = "name = '$fileName' and trashed = false"
    val url = URL(
      "$DRIVE_API/files?spaces=appDataFolder" +
        "&q=${urlEncode(query)}" +
        "&fields=${urlEncode("files(id)")}" +
        "&pageSize=10",
    )
    val response = executeRequest(url, "GET", token)
    val files = JSONObject(response.body).optJSONArray("files") ?: JSONArray()
    return buildList {
      for (index in 0 until files.length()) {
        val id = files.optJSONObject(index)?.optString("id")?.trim().orEmpty()
        if (id.isNotEmpty()) add(id)
      }
    }
  }

  private fun fetchMetadata(token: String, fileId: String): DriveFile {
    val fields = urlEncode("id,modifiedTime,version")
    val response = executeRequest(URL("$DRIVE_API/files/${urlEncode(fileId)}?fields=$fields"), "GET", token)
    val body = JSONObject(response.body)
    val id = body.optString("id").trim()
    val version = body.optString("version").trim()
    if (id.isEmpty() || version.isEmpty()) {
      throw IllegalStateException("GOOGLE_DRIVE_PROFILE_METADATA_INVALID")
    }
    return DriveFile(
      id = id,
      version = version,
      modifiedAt = parseDriveTime(body.optString("modifiedTime")),
      etag = response.etag,
    )
  }

  private fun downloadProfile(token: String, fileId: String): String {
    val response = executeRequest(URL("$DRIVE_API/files/${urlEncode(fileId)}?alt=media"), "GET", token)
    if (response.body.toByteArray(Charsets.UTF_8).size > MAX_PROFILE_BYTES) {
      throw IllegalStateException("GOOGLE_DRIVE_PROFILE_TOO_LARGE")
    }
    return response.body
  }


  /**
   * Returns a profile body paired with a revision tag that stayed stable across
   * the download. This prevents JavaScript from receiving metadata from one
   * Drive revision and a body from another when a write lands concurrently.
   */
  private fun readStableProfileSnapshot(token: String, fileId: String): StableProfileSnapshot {
    repeat(READ_SNAPSHOT_ATTEMPTS) { attempt ->
      val before = fetchMetadata(token, fileId)
      val profileJson = downloadProfile(token, fileId)
      val after = fetchMetadata(token, fileId)
      if (before.revisionTag() == after.revisionTag()) {
        return StableProfileSnapshot(after, profileJson)
      }
      if (attempt < READ_SNAPSHOT_ATTEMPTS - 1) {
        Thread.sleep(READ_SNAPSHOT_RETRY_DELAY_MS * (attempt + 1L))
      }
    }
    throw IllegalStateException("GOOGLE_DRIVE_PROFILE_SNAPSHOT_UNSTABLE")
  }

  private fun createProfile(token: String, profileKey: String, payload: ByteArray): String {
    val boundary = "orion-${UUID.randomUUID()}"
    val metadata = JSONObject().apply {
      put("name", profileFileName(profileKey))
      put("mimeType", PROFILE_MIME_TYPE)
      put("parents", JSONArray().put("appDataFolder"))
    }.toString()

    val prefix = buildString {
      append("--$boundary\r\n")
      append("Content-Type: application/json; charset=UTF-8\r\n\r\n")
      append(metadata)
      append("\r\n--$boundary\r\n")
      append("Content-Type: $PROFILE_MIME_TYPE; charset=UTF-8\r\n\r\n")
    }.toByteArray(Charsets.UTF_8)
    val suffix = "\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8)
    val body = ByteArray(prefix.size + payload.size + suffix.size)
    prefix.copyInto(body, 0)
    payload.copyInto(body, prefix.size)
    suffix.copyInto(body, prefix.size + payload.size)

    val fields = urlEncode("id")
    val response = executeRequest(
      URL("$DRIVE_UPLOAD_API/files?uploadType=multipart&fields=$fields"),
      "POST",
      token,
      body,
      "multipart/related; boundary=$boundary",
    )
    val id = JSONObject(response.body).optString("id").trim()
    if (id.isEmpty()) throw IllegalStateException("GOOGLE_DRIVE_PROFILE_CREATE_INVALID")
    return id
  }

  private fun updateProfile(
    token: String,
    current: DriveFile,
    payload: ByteArray,
    expectedRevisionTag: String,
  ) {
    val fields = urlEncode("id,modifiedTime,version")
    val headers = mutableMapOf("X-HTTP-Method-Override" to "PATCH")
    // Prefer an HTTP ETag as the opaque revision token. If Drive does not
    // provide one on this device/API response, the monotonically increasing
    // Drive file version remains the conservative compare-before-write token.
    if (expectedRevisionTag.startsWith("etag:")) {
      headers["If-Match"] = expectedRevisionTag.removePrefix("etag:")
    }

    executeRequest(
      URL("$DRIVE_UPLOAD_API/files/${urlEncode(current.id)}?uploadType=media&fields=$fields"),
      "POST",
      token,
      payload,
      PROFILE_MIME_TYPE,
      headers,
    )
  }

  private data class HttpResponse(
    val status: Int,
    val body: String,
    val etag: String?,
  )

  private fun executeRequest(
    url: URL,
    method: String,
    token: String,
    body: ByteArray? = null,
    contentType: String? = null,
    extraHeaders: Map<String, String> = emptyMap(),
  ): HttpResponse {
    val connection = (url.openConnection() as HttpsURLConnection).apply {
      requestMethod = method
      connectTimeout = CONNECT_TIMEOUT_MS
      readTimeout = READ_TIMEOUT_MS
      useCaches = false
      setRequestProperty("Authorization", "Bearer $token")
      setRequestProperty("Accept", "application/json")
      setRequestProperty("Cache-Control", "no-cache")
      setRequestProperty("Pragma", "no-cache")
      extraHeaders.forEach { (key, value) -> setRequestProperty(key, value) }
      if (body != null) {
        doOutput = true
        setRequestProperty("Content-Type", contentType ?: PROFILE_MIME_TYPE)
        setFixedLengthStreamingMode(body.size)
      }
    }

    try {
      if (body != null) {
        connection.outputStream.use { output -> output.write(body) }
      }
      val status = connection.responseCode
      val responseBody = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
      val response = HttpResponse(status, responseBody, connection.getHeaderField("ETag")?.trim())
      if (status !in 200..299) throw DriveHttpException(status, responseBody)
      return response
    } finally {
      connection.disconnect()
    }
  }

  private fun readBody(stream: InputStream?): String {
    if (stream == null) return ""
    return BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { reader ->
      buildString {
        val buffer = CharArray(8_192)
        while (true) {
          val count = reader.read(buffer)
          if (count < 0) break
          append(buffer, 0, count)
          if (length > MAX_PROFILE_BYTES * 2) {
            throw IllegalStateException("GOOGLE_DRIVE_RESPONSE_TOO_LARGE")
          }
        }
      }
    }
  }

  private fun writtenResult(file: DriveFile) = Arguments.createMap().apply {
    putString("state", "written")
    putString("revisionTag", file.revisionTag())
    file.modifiedAt?.let { putDouble("remoteModifiedAt", it.toDouble()) } ?: putNull("remoteModifiedAt")
  }

  private fun conflictResult(revisionTag: String?) = Arguments.createMap().apply {
    putString("state", "conflict")
    if (revisionTag == null) putNull("revisionTag") else putString("revisionTag", revisionTag)
  }

  private fun rejectPromise(promise: Promise, error: Throwable) {
    if (error is DriveHttpException) {
      val code = when (error.status) {
        401 -> "GOOGLE_DRIVE_REAUTH_REQUIRED"
        403 -> "GOOGLE_DRIVE_PROFILE_FORBIDDEN"
        404 -> "GOOGLE_DRIVE_PROFILE_NOT_FOUND"
        412 -> "GOOGLE_DRIVE_PROFILE_CONFLICT"
        429 -> "GOOGLE_DRIVE_PROFILE_RATE_LIMITED"
        in 500..599 -> "GOOGLE_DRIVE_PROFILE_TEMPORARY"
        else -> "GOOGLE_DRIVE_PROFILE_HTTP_ERROR"
      }
      promise.reject(code, "Google Drive profile storage returned HTTP ${error.status}.")
      return
    }

    val code = when (error.message) {
      "GOOGLE_DRIVE_REAUTH_REQUIRED" -> "GOOGLE_DRIVE_REAUTH_REQUIRED"
      "GOOGLE_DRIVE_PROFILE_TOO_LARGE" -> "GOOGLE_DRIVE_PROFILE_TOO_LARGE"
      "GOOGLE_DRIVE_RESPONSE_TOO_LARGE" -> "GOOGLE_DRIVE_PROFILE_TOO_LARGE"
      "GOOGLE_DRIVE_PROFILE_METADATA_INVALID" -> "GOOGLE_DRIVE_PROFILE_INVALID"
      "GOOGLE_DRIVE_PROFILE_CREATE_INVALID" -> "GOOGLE_DRIVE_PROFILE_INVALID"
      "GOOGLE_DRIVE_PROFILE_SNAPSHOT_UNSTABLE" -> "GOOGLE_DRIVE_PROFILE_TEMPORARY"
      else -> "GOOGLE_DRIVE_PROFILE_IO_FAILED"
    }
    promise.reject(code, "Google Drive profile storage could not finish.")
  }

  private fun parseDriveTime(value: String): Long? {
    if (value.isBlank()) return null
    val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX")
    for (pattern in patterns) {
      try {
        val formatter = SimpleDateFormat(pattern, Locale.US).apply {
          timeZone = TimeZone.getTimeZone("UTC")
          isLenient = false
        }
        return formatter.parse(value)?.time
      } catch (_: Throwable) {
        // Try the next RFC3339 shape.
      }
    }
    return null
  }

  private fun urlEncode(value: String): String = URLEncoder.encode(value, "UTF-8")
    .replace("+", "%20")

  override fun invalidate() {
    ioExecutor.shutdownNow()
    super.invalidate()
  }
}
