package com.okali.orion.cloud

import android.util.Log
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
    private const val LOG_TAG = "OrionCloudProfile"
    private const val DRIVE_API = "https://www.googleapis.com/drive/v3"
    private const val DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
    private const val DRIVE_V2_API = "https://www.googleapis.com/drive/v2"
    private const val DRIVE_V2_UPLOAD_API = "https://www.googleapis.com/upload/drive/v2"
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

  private data class ConditionalMetadata(
    val id: String,
    val version: String,
    val etag: String,
  )

  private class DriveHttpException(
    val status: Int,
    val responseBody: String,
    val stage: String,
  ) : RuntimeException("Google Drive request failed with HTTP $status during $stage")

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
          throw IllegalStateException("GOOGLE_DRIVE_PROFILE_DUPLICATE")
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
          throw IllegalStateException("GOOGLE_DRIVE_PROFILE_DUPLICATE")
        }

        if (expectedRevisionTag == null) {
          if (matches.isNotEmpty()) {
            val current = fetchMetadata(token, matches.first())
            promise.resolve(conflictResult(current.revisionTag()))
            return@execute
          }

          val createdId = createProfile(token, key, payloadBytes)
          val afterMatches = findProfileFiles(token, key)
          if (afterMatches.size != 1 || afterMatches.first() != createdId) {
            throw IllegalStateException("GOOGLE_DRIVE_PROFILE_DUPLICATE")
          }
          val created = fetchMetadata(token, createdId)
          promise.resolve(writtenResult(created))
          return@execute
        }

        if (matches.isEmpty()) {
          promise.resolve(conflictResult(null))
          return@execute
        }

        val current = fetchMetadata(token, matches.first())
        val currentTag = current.revisionTag()
        var updateApi = DRIVE_UPLOAD_API
        var updateMethod = "POST"
        var usePatchOverride = true
        val strongIfMatch = when {
          expectedRevisionTag.startsWith("version:") -> {
            val expectedVersion = expectedRevisionTag.removePrefix("version:")
            if (current.version != expectedVersion) {
              promise.resolve(conflictResult(currentTag))
              return@execute
            }
            if (currentTag.startsWith("etag:")) {
              currentTag.removePrefix("etag:")
            } else {
              val conditional = fetchV2ConditionalMetadata(token, current.id)
              if (conditional.version != expectedVersion) {
                promise.resolve(conflictResult("version:${conditional.version}"))
                return@execute
              }
              updateApi = DRIVE_V2_UPLOAD_API
              updateMethod = "PUT"
              usePatchOverride = false
              conditional.etag
            }
          }
          expectedRevisionTag.startsWith("etag:") -> {
            if (currentTag != expectedRevisionTag) {
              promise.resolve(conflictResult(currentTag))
              return@execute
            }
            currentTag.removePrefix("etag:")
          }
          else -> throw IllegalArgumentException("GOOGLE_DRIVE_PROFILE_REVISION_INVALID")
        }

        try {
          updateProfile(
            token = token,
            current = current,
            payload = payloadBytes,
            updateApi = updateApi,
            updateMethod = updateMethod,
            usePatchOverride = usePatchOverride,
            strongIfMatch = strongIfMatch,
          )
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

        val afterMatches = findProfileFiles(token, key)
        if (afterMatches.size != 1 || afterMatches.first() != current.id) {
          throw IllegalStateException("GOOGLE_DRIVE_PROFILE_DUPLICATE")
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
    val matches = mutableListOf<String>()
    val seenPageTokens = mutableSetOf<String>()
    var pageToken: String? = null

    do {
      val params = mutableListOf(
        "spaces=appDataFolder",
        "fields=${urlEncode("nextPageToken,files(id,name)")}",
        "pageSize=100",
      )
      pageToken?.let { params += "pageToken=${urlEncode(it)}" }

      val response = executeRequest(
        URL("$DRIVE_API/files?${params.joinToString("&")}"),
        "GET",
        token,
        stage = "appdata-list",
      )
      val body = JSONObject(response.body)
      val files = body.optJSONArray("files") ?: JSONArray()
      for (index in 0 until files.length()) {
        val item = files.optJSONObject(index) ?: continue
        val id = item.optString("id").trim()
        val name = item.optString("name").trim()
        if (id.isNotEmpty() && name == fileName) matches.add(id)
      }

      val nextPageToken = body.optString("nextPageToken").trim().ifEmpty { null }
      if (nextPageToken != null && !seenPageTokens.add(nextPageToken)) {
        throw IllegalStateException("GOOGLE_DRIVE_PROFILE_LIST_UNSTABLE")
      }
      pageToken = nextPageToken
    } while (pageToken != null)

    return matches.distinct()
  }

  private fun fetchMetadata(token: String, fileId: String): DriveFile {
    val fields = urlEncode("id,modifiedTime,version")
    val response = executeRequest(URL("$DRIVE_API/files/${urlEncode(fileId)}?fields=$fields"), "GET", token, stage = "metadata")
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

  private fun fetchV2ConditionalMetadata(token: String, fileId: String): ConditionalMetadata {
    val fields = urlEncode("id,etag,version")
    val response = executeRequest(URL("$DRIVE_V2_API/files/${urlEncode(fileId)}?fields=$fields"), "GET", token, stage = "conditional-metadata")
    val body = JSONObject(response.body)
    val id = body.optString("id").trim()
    val version = body.optString("version").trim()
    val etag = body.optString("etag").trim()
    if (id != fileId || version.isEmpty()) {
      throw IllegalStateException("GOOGLE_DRIVE_PROFILE_METADATA_INVALID")
    }
    if (etag.isEmpty() || etag.startsWith("W/")) {
      throw IllegalStateException("GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE")
    }
    return ConditionalMetadata(id = id, version = version, etag = etag)
  }

  private fun downloadProfile(token: String, fileId: String): String {
    val response = executeRequest(URL("$DRIVE_API/files/${urlEncode(fileId)}?alt=media"), "GET", token, stage = "download")
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
      stage = "create",
    )
    val id = JSONObject(response.body).optString("id").trim()
    if (id.isEmpty()) throw IllegalStateException("GOOGLE_DRIVE_PROFILE_CREATE_INVALID")
    return id
  }

  private fun updateProfile(
    token: String,
    current: DriveFile,
    payload: ByteArray,
    updateApi: String,
    updateMethod: String,
    usePatchOverride: Boolean,
    strongIfMatch: String,
  ) {
    if (strongIfMatch.isBlank() || strongIfMatch.startsWith("W/")) {
      throw IllegalStateException("GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE")
    }
    val headers = mutableMapOf("If-Match" to strongIfMatch)
    if (usePatchOverride) headers["X-HTTP-Method-Override"] = "PATCH"
    val updateStage = if (updateApi == DRIVE_V2_UPLOAD_API) "update-v2" else "update-v3"

    // The v2 and v3 File resources use different modified-time field names
    // (modifiedDate vs modifiedTime). This response is intentionally ignored
    // because Orion performs a fresh v3 metadata read after the write, so do
    // not send a version-specific partial-response `fields` selector here.
    executeRequest(
      URL("$updateApi/files/${urlEncode(current.id)}?uploadType=media"),
      updateMethod,
      token,
      payload,
      PROFILE_MIME_TYPE,
      headers,
      stage = updateStage,
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
    stage: String,
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
      if (status !in 200..299) throw DriveHttpException(status, responseBody, stage)
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
      Log.w(LOG_TAG, "PortableProfileV3 transport failure code=$code http=${error.status} stage=${error.stage}")
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
      "GOOGLE_DRIVE_PROFILE_LIST_UNSTABLE" -> "GOOGLE_DRIVE_PROFILE_TEMPORARY"
      "GOOGLE_DRIVE_PROFILE_DUPLICATE" -> "GOOGLE_DRIVE_PROFILE_DUPLICATE"
      "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE" -> "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
      "GOOGLE_DRIVE_PROFILE_REVISION_INVALID" -> "GOOGLE_DRIVE_PROFILE_ARGUMENT_INVALID"
      else -> "GOOGLE_DRIVE_PROFILE_IO_FAILED"
    }
    Log.w(LOG_TAG, "PortableProfileV3 transport failure code=$code")
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
