package com.okali.waven.playback

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

internal object WavenPlaybackContract {
  const val EVENT_NAME = "WavenPlaybackState"
  const val SOURCE_SCHEME = "waven-source"

  const val EXTRA_QUEUE_ID = "waven.queueId"
  const val EXTRA_SOURCE_URI = "waven.sourceUri"
  const val EXTRA_SOURCE_HEADERS = "waven.sourceHeaders"
  const val EXTRA_SOURCE_MIME_TYPE = "waven.sourceMimeType"
  const val EXTRA_SOURCE_EXPIRES_AT_MS = "waven.sourceExpiresAtMs"

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
    val queueId = requiredString(item, "queueId")
    val track = item.getMap("track")
      ?: throw IllegalArgumentException("Queue item '$queueId' is missing track metadata.")

    val title = requiredString(track, "title")
    val artist = requiredString(track, "artistName")
    val albumTitle = optionalString(track, "albumTitle")
    val artworkUrl = optionalString(track, "artworkUrl")

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

    val metadata = MediaMetadata.Builder()
      .setTitle(title)
      .setArtist(artist)
      .setAlbumTitle(albumTitle)
      .apply {
        if (!artworkUrl.isNullOrBlank()) {
          setArtworkUri(Uri.parse(artworkUrl))
        }
      }
      .build()

    return MediaItem.Builder()
      .setMediaId(queueId)
      .setMediaMetadata(metadata)
      .setRequestMetadata(
        MediaItem.RequestMetadata.Builder()
          .setExtras(sourceExtras)
          .build()
      )
      .build()
  }

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
}
