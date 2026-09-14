package com.okali.waven.playback

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import org.json.JSONArray
import org.json.JSONObject

internal object WavenPlaybackContract {
  const val EVENT_NAME = "WavenPlaybackState"
  const val SOURCE_SCHEME = "waven-source"

  const val EXTRA_QUEUE_ID = "waven.queueId"
  const val EXTRA_SOURCE_URI = "waven.sourceUri"
  const val EXTRA_SOURCE_HEADERS = "waven.sourceHeaders"
  const val EXTRA_SOURCE_MIME_TYPE = "waven.sourceMimeType"
  const val EXTRA_SOURCE_EXPIRES_AT_MS = "waven.sourceExpiresAtMs"
  const val EXTRA_RECOVERY_ITEM_JSON = "waven.recoveryItemJson"

  data class SourceLease(
    val uri: Uri,
    val headers: Map<String, String>,
    val mimeType: String?,
    val expiresAtMs: Long?,
  ) {
    fun expired(nowMs: Long = System.currentTimeMillis()): Boolean =
      expiresAtMs != null && expiresAtMs > 0L && nowMs >= expiresAtMs
  }

  fun queueItems(items: ReadableArray): List<MediaItem> {
    val result = ArrayList<MediaItem>(items.size())
    for (index in 0 until items.size()) {
      val item = items.getMap(index)
        ?: throw IllegalArgumentException("Queue item at index $index is not an object.")
      result.add(queueItem(item))
    }
    return result
  }

  fun queueItem(item: ReadableMap): MediaItem {
    val recoveryJson = recoveryItemJson(item)
    val recovery = JSONObject(recoveryJson)
    val queueId = recovery.getString("queueId")
    val track = recovery.getJSONObject("track")

    val sourceExtras = Bundle().apply {
      putString(EXTRA_QUEUE_ID, queueId)
      item.getMap("resolvedSource")?.let { source ->
        putString(EXTRA_SOURCE_URI, requiredString(source, "uri"))
        putString(EXTRA_SOURCE_MIME_TYPE, optionalString(source, "mimeType"))
        if (
          source.hasKey("expiresAtMs") &&
          !source.isNull("expiresAtMs") &&
          source.getType("expiresAtMs") == ReadableType.Number
        ) {
          putLong(EXTRA_SOURCE_EXPIRES_AT_MS, source.getDouble("expiresAtMs").toLong())
        }
        source.getMap("headers")?.let { headers ->
          val headerBundle = Bundle()
          val iterator = headers.keySetIterator()
          while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (!headers.isNull(key) && headers.getType(key) == ReadableType.String) {
              headerBundle.putString(key, headers.getString(key))
            }
          }
          putBundle(EXTRA_SOURCE_HEADERS, headerBundle)
        }
      }
    }

    return buildRecoveryMediaItem(recovery, recoveryJson)
      .buildUpon()
      .setRequestMetadata(
        MediaItem.RequestMetadata.Builder()
          .setExtras(sourceExtras)
          .build(),
      )
      .build()
  }

  fun recoveryMediaItem(recoveryJson: String): MediaItem {
    val recovery = JSONObject(recoveryJson)
    return buildRecoveryMediaItem(recovery, recoveryJson)
      .buildUpon()
      .setUri(sourcePlaceholder(recovery.getString("queueId")))
      .setRequestMetadata(MediaItem.RequestMetadata.Builder().build())
      .build()
  }

  fun recoveryJson(item: MediaItem): String? =
    item.mediaMetadata.extras?.getString(EXTRA_RECOVERY_ITEM_JSON)

  fun resolvedSource(source: ReadableMap): SourceLease {
    val uri = Uri.parse(requiredString(source, "uri"))
    val scheme = uri.scheme?.lowercase()
    if (scheme !in setOf("https", "http", "file", "content")) {
      throw IllegalArgumentException("Unsupported playback URI scheme: ${scheme ?: "none"}")
    }

    val headers = linkedMapOf<String, String>()
    source.getMap("headers")?.let { map ->
      val iterator = map.keySetIterator()
      while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        if (!map.isNull(key) && map.getType(key) == ReadableType.String) {
          headers[key] = map.getString(key).orEmpty()
        }
      }
    }

    val expiresAtMs =
      if (
        source.hasKey("expiresAtMs") &&
        !source.isNull("expiresAtMs") &&
        source.getType("expiresAtMs") == ReadableType.Number
      ) {
        source.getDouble("expiresAtMs").toLong()
      } else {
        null
      }

    return SourceLease(
      uri = uri,
      headers = headers,
      mimeType = optionalString(source, "mimeType"),
      expiresAtMs = expiresAtMs,
    )
  }

  fun sourcePlaceholder(queueId: String): Uri =
    Uri.Builder()
      .scheme(SOURCE_SCHEME)
      .authority("queue")
      .appendPath(queueId)
      .build()

  private fun buildRecoveryMediaItem(
    recovery: JSONObject,
    recoveryJson: String,
  ): MediaItem {
    val queueId = recovery.getString("queueId")
    val track = recovery.getJSONObject("track")
    val title = track.getString("title")
    val artist = track.getString("artistName")
    val albumTitle = track.optNullableString("albumTitle")
    val albumArtist = track.optNullableString("albumArtist")
    val artworkUrl = track.optNullableString("artworkUrl")
    val durationMs = track.optNullableLong("durationMs")

    val safeExtras = Bundle().apply {
      putString(EXTRA_RECOVERY_ITEM_JSON, recoveryJson)
    }

    val metadata = MediaMetadata.Builder()
      .setTitle(title)
      .setArtist(artist)
      .setAlbumTitle(albumTitle)
      .setAlbumArtist(albumArtist)
      .setExtras(safeExtras)
      .apply {
        durationMs?.takeIf { it >= 0L }?.let { setDurationMs(it) }
        if (!artworkUrl.isNullOrBlank()) {
          setArtworkUri(Uri.parse(artworkUrl))
        }
      }
      .build()

    return MediaItem.Builder()
      .setMediaId(queueId)
      .setMediaMetadata(metadata)
      .build()
  }

  private fun recoveryItemJson(item: ReadableMap): String {
    val queueId = requiredString(item, "queueId")
    val track = item.getMap("track")
      ?: throw IllegalArgumentException("Queue item '$queueId' is missing track metadata.")
    val streamingProvider = item.getMap("streamingProvider")
      ?: throw IllegalArgumentException("Queue item '$queueId' is missing streamingProvider.")
    val trackSource = track.getMap("source")
      ?: throw IllegalArgumentException("Queue item '$queueId' track is missing source.")

    val trackJson = JSONObject()
      .put("id", requiredString(track, "id"))
      .put("title", requiredString(track, "title"))
      .put("artistName", requiredString(track, "artistName"))
      .putNullable("albumTitle", optionalString(track, "albumTitle"))
      .putNullable("albumArtist", optionalString(track, "albumArtist"))
      .putNullable("durationMs", optionalLong(track, "durationMs"))
      .putNullable("artworkUrl", optionalString(track, "artworkUrl"))
      .putNullable("provider", optionalString(track, "provider"))
      .putNullable("providerTrackId", optionalString(track, "providerTrackId"))
      .put("source", sourceRefJson(trackSource))

    track.getArray("providerRefs")?.let { refs ->
      val providerRefs = JSONArray()
      for (index in 0 until refs.size()) {
        refs.getMap(index)?.let { providerRefs.put(sourceRefJson(it)) }
      }
      if (providerRefs.length() > 0) {
        trackJson.put("providerRefs", providerRefs)
      }
    }

    return JSONObject()
      .put("queueId", queueId)
      .put("track", trackJson)
      .put("streamingProvider", sourceRefJson(streamingProvider))
      .toString()
  }

  private fun sourceRefJson(map: ReadableMap): JSONObject =
    JSONObject()
      .put("provider", requiredString(map, "provider"))
      .put("id", requiredString(map, "id"))

  private fun requiredString(map: ReadableMap, key: String): String {
    if (!map.hasKey(key) || map.isNull(key) || map.getType(key) != ReadableType.String) {
      throw IllegalArgumentException("Missing required string '$key'.")
    }
    return map.getString(key)?.takeIf { it.isNotBlank() }
      ?: throw IllegalArgumentException("Required string '$key' is blank.")
  }

  private fun optionalString(map: ReadableMap, key: String): String? {
    if (!map.hasKey(key) || map.isNull(key) || map.getType(key) != ReadableType.String) {
      return null
    }
    return map.getString(key)?.takeIf { it.isNotBlank() }
  }

  private fun optionalLong(map: ReadableMap, key: String): Long? {
    if (!map.hasKey(key) || map.isNull(key) || map.getType(key) != ReadableType.Number) {
      return null
    }
    return map.getDouble(key).toLong()
  }

  private fun JSONObject.putNullable(key: String, value: Any?): JSONObject =
    put(key, value ?: JSONObject.NULL)

  private fun JSONObject.optNullableString(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotBlank() }

  private fun JSONObject.optNullableLong(key: String): Long? =
    if (!has(key) || isNull(key)) null else optLong(key)
}
