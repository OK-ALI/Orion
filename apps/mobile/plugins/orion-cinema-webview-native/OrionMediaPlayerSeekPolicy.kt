package com.okali.orion.playback

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Pure seek arithmetic/state decisions used by the finalized MediaPlayer activity. */
internal object OrionMediaPlayerSeekPolicy {
  const val SEEK_TIMEOUT_MS = 10_000L
  const val MAX_REISSUES = 1

  enum class Mode { LEGACY_PREVIOUS_SYNC, CLOSEST_SYNC }
  enum class Completion { SETTLED, REISSUE }

  data class Request(
    val generation: Long,
    val playerGeneration: Long,
    val targetMs: Long,
    val playWhenSettled: Boolean,
    val reissues: Int = 0,
  )

  fun mode(apiLevel: Int): Mode = if (apiLevel >= 26) Mode.CLOSEST_SYNC else Mode.LEGACY_PREVIOUS_SYNC

  fun targetMs(durationMs: Long, progress: Int, progressMax: Int = 1_000): Long {
    if (durationMs <= 0L || progressMax <= 0) return 0L
    val boundedProgress = progress.coerceIn(0, progressMax).toLong()
    val whole = (durationMs / progressMax) * boundedProgress
    val remainder = ((durationMs % progressMax) * boundedProgress) / progressMax
    return (whole + remainder).coerceIn(0L, max(0L, durationMs - 1L))
  }

  fun acceptsCallback(request: Request, activePlayerGeneration: Long): Boolean =
    request.playerGeneration == activePlayerGeneration

  fun withPlayIntent(request: Request, playWhenSettled: Boolean): Request =
    request.copy(playWhenSettled = playWhenSettled)

  fun completion(request: Request, actualPositionMs: Long, durationMs: Long): Completion {
    val tolerance = min(10_000L, max(3_000L, durationMs / 200L))
    return if (abs(actualPositionMs - request.targetMs) <= tolerance || request.reissues >= MAX_REISSUES) {
      Completion.SETTLED
    } else {
      Completion.REISSUE
    }
  }

  fun reissued(request: Request): Request = request.copy(reissues = request.reissues + 1)
}
