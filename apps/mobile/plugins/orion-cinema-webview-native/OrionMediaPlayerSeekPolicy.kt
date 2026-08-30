package com.okali.orion.playback

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Pure seek arithmetic/state decisions used by the finalized MediaPlayer activity. */
internal object OrionMediaPlayerSeekPolicy {
  const val SEEK_TIMEOUT_MS = 10_000L
  const val SEEK_CONFIRMATION_DELAY_MS = 150L

  enum class Mode { LEGACY_PREVIOUS_SYNC, CLOSEST_SYNC, CLOSEST }
  enum class Attempt { PRIMARY, FALLBACK }
  enum class Completion { SETTLED, FALLBACK, AWAIT_TIMEOUT, TIMED_OUT }

  data class Request(
    val generation: Long,
    val playerGeneration: Long,
    val targetMs: Long,
    val playWhenSettled: Boolean,
    val deadlineUptimeMs: Long,
    val attempt: Attempt = Attempt.PRIMARY,
  )

  data class IssuedAttempt(
    val generation: Long,
    val playerGeneration: Long,
    val attempt: Attempt,
  )

  fun mode(apiLevel: Int, attempt: Attempt): Mode = when {
    apiLevel < 26 -> Mode.LEGACY_PREVIOUS_SYNC
    attempt == Attempt.PRIMARY -> Mode.CLOSEST_SYNC
    else -> Mode.CLOSEST
  }

  fun deadline(startUptimeMs: Long): Long =
    if (startUptimeMs > Long.MAX_VALUE - SEEK_TIMEOUT_MS) Long.MAX_VALUE
    else startUptimeMs + SEEK_TIMEOUT_MS

  fun remainingMs(request: Request, nowUptimeMs: Long): Long =
    (request.deadlineUptimeMs - nowUptimeMs).coerceAtLeast(0L)

  fun targetMs(durationMs: Long, progress: Int, progressMax: Int = 1_000): Long {
    if (durationMs <= 0L || progressMax <= 0) return 0L
    val boundedProgress = progress.coerceIn(0, progressMax).toLong()
    val whole = (durationMs / progressMax) * boundedProgress
    val remainder = ((durationMs % progressMax) * boundedProgress) / progressMax
    return (whole + remainder).coerceIn(0L, max(0L, durationMs - 1L))
  }

  fun issued(request: Request): IssuedAttempt = IssuedAttempt(
    generation = request.generation,
    playerGeneration = request.playerGeneration,
    attempt = request.attempt,
  )

  fun acceptsCallback(issued: IssuedAttempt, activePlayerGeneration: Long): Boolean =
    issued.playerGeneration == activePlayerGeneration

  fun matchesAttempt(request: Request, issued: IssuedAttempt): Boolean =
    request.generation == issued.generation &&
      request.playerGeneration == issued.playerGeneration &&
      request.attempt == issued.attempt

  fun withPlayIntent(request: Request, playWhenSettled: Boolean): Request =
    request.copy(playWhenSettled = playWhenSettled)

  fun completion(
    request: Request,
    actualPositionMs: Long,
    durationMs: Long,
    nowUptimeMs: Long,
  ): Completion {
    val tolerance = min(10_000L, max(3_000L, durationMs / 200L))
    if (abs(actualPositionMs - request.targetMs) <= tolerance) return Completion.SETTLED
    if (remainingMs(request, nowUptimeMs) == 0L) return Completion.TIMED_OUT
    return if (request.attempt == Attempt.PRIMARY) Completion.FALLBACK else Completion.AWAIT_TIMEOUT
  }

  fun displayPosition(actualPositionMs: Long, pendingTargetMs: Long?): Long =
    (pendingTargetMs ?: actualPositionMs).coerceAtLeast(0L)

  fun withFallback(request: Request): Request = request.copy(attempt = Attempt.FALLBACK)
}
