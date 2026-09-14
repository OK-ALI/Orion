package com.okali.waven.playback

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import org.json.JSONArray
import org.json.JSONObject

internal class WavenPlaybackRecoveryStore(context: Context) {
  data class RestoredState(
    val mediaItems: List<MediaItem>,
    val currentIndex: Int,
    val positionMs: Long,
    val repeatMode: Int,
    val shuffleEnabled: Boolean,
    val wasPlayWhenReady: Boolean,
    val savedAtMs: Long,
  )

  private val preferences =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  fun save(player: Player) {
    if (player.mediaItemCount <= 0) {
      clear()
      return
    }

    val queue = JSONArray()
    for (index in 0 until player.mediaItemCount) {
      val recoveryJson = WavenPlaybackContract.recoveryJson(player.getMediaItemAt(index))
        ?: return
      queue.put(JSONObject(recoveryJson))
    }

    val state = JSONObject()
      .put("version", VERSION)
      .put("queue", queue)
      .put("currentIndex", player.currentMediaItemIndex.coerceAtLeast(0))
      .put("positionMs", player.currentPosition.coerceAtLeast(0L))
      .put("repeatMode", WavenPlaybackService.repeatModeName(player.repeatMode))
      .put("shuffleEnabled", player.shuffleModeEnabled)
      .put("wasPlayWhenReady", player.playWhenReady)
      .put("savedAtMs", System.currentTimeMillis())

    preferences.edit().putString(KEY_STATE, state.toString()).apply()
  }

  fun restore(): RestoredState? {
    val raw = readRawJson() ?: return null
    return try {
      val state = JSONObject(raw)
      if (state.optInt("version") != VERSION) {
        clear()
        return null
      }

      val queue = state.optJSONArray("queue") ?: return null
      if (queue.length() <= 0) {
        clear()
        return null
      }

      val mediaItems = ArrayList<MediaItem>(queue.length())
      for (index in 0 until queue.length()) {
        mediaItems.add(WavenPlaybackContract.recoveryMediaItem(queue.getJSONObject(index).toString()))
      }

      val currentIndex = state.optInt("currentIndex", 0).coerceIn(0, mediaItems.lastIndex)
      RestoredState(
        mediaItems = mediaItems,
        currentIndex = currentIndex,
        positionMs = state.optLong("positionMs", 0L).coerceAtLeast(0L),
        repeatMode = repeatMode(state.optString("repeatMode", "off")),
        shuffleEnabled = state.optBoolean("shuffleEnabled", false),
        wasPlayWhenReady = state.optBoolean("wasPlayWhenReady", false),
        savedAtMs = state.optLong("savedAtMs", 0L).coerceAtLeast(0L),
      )
    } catch (_: Throwable) {
      clear()
      null
    }
  }

  fun readRawJson(): String? =
    preferences.getString(KEY_STATE, null)?.takeIf { it.isNotBlank() }

  fun clear() {
    preferences.edit().remove(KEY_STATE).apply()
  }

  private fun repeatMode(value: String): Int = when (value) {
    "one" -> Player.REPEAT_MODE_ONE
    "all" -> Player.REPEAT_MODE_ALL
    else -> Player.REPEAT_MODE_OFF
  }

  companion object {
    private const val VERSION = 1
    private const val PREFERENCES_NAME = "waven.playback.recovery.v1"
    private const val KEY_STATE = "playback-state"
  }
}
