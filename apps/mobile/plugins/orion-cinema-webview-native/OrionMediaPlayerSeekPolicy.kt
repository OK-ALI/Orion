package com.okali.orion.playback

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Pure seek arithmetic and observation decisions used by the finalized MediaPlayer activity. */
internal object OrionMediaPlayerSeekPolicy {
  const val SEEK_TIMEOUT_MS = 10_000L
  const val OBSERVATION_INTERVAL_MS = 100L
  const val PRIMARY_FALLBACK_WAIT_MS = 1_500L
  const val STABLE_FAR_DELTA_MS = 250L

  enum class Mode { LEGACY_PREVIOUS_SYNC, CLOSEST_SYNC, CLOSEST }
  enum class Attempt { PRIMARY, FALLBACK }
  enum class Decision { WAIT, SETTLE, FALLBACK, TIMED_OUT }

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
    val issuedUptimeMs: Long,
    val issuedSurfaceFrameGeneration: Long,
  )

  data class Observation(
    val callbackUptimeMs: Long,
    val callbackSurfaceFrameGeneration: Long,
    val consecutiveNearSamples: Int = 0,
    val lastFarPositionMs: Long? = null,
    val consecutiveStableFarSamples: Int = 0,
  )

  data class ObservationResult(val observation: Observation, val decision: Decision)

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

  fun toleranceMs(durationMs: Long): Long = min(3_000L, max(1_000L, durationMs / 1_000L))

  fun issued(request: Request, nowUptimeMs: Long, surfaceFrameGeneration: Long): IssuedAttempt = IssuedAttempt(
    generation = request.generation,
    playerGeneration = request.playerGeneration,
    attempt = request.attempt,
    issuedUptimeMs = nowUptimeMs,
    issuedSurfaceFrameGeneration = surfaceFrameGeneration,
  )

  fun beginObservation(
    issued: IssuedAttempt,
    callbackUptimeMs: Long,
    callbackSurfaceFrameGeneration: Long,
  ): Observation = Observation(
    callbackUptimeMs = callbackUptimeMs,
    callbackSurfaceFrameGeneration = callbackSurfaceFrameGeneration.coerceAtLeast(
      issued.issuedSurfaceFrameGeneration,
    ),
  )

  fun acceptsCallback(issued: IssuedAttempt, activePlayerGeneration: Long): Boolean =
    issued.playerGeneration == activePlayerGeneration

  fun matchesAttempt(request: Request, issued: IssuedAttempt): Boolean =
    request.generation == issued.generation &&
      request.playerGeneration == issued.playerGeneration &&
      request.attempt == issued.attempt

  fun withPlayIntent(request: Request, playWhenSettled: Boolean): Request =
    request.copy(playWhenSettled = playWhenSettled)

  fun observe(
    request: Request,
    observation: Observation,
    actualPositionMs: Long,
    durationMs: Long,
    nowUptimeMs: Long,
    surfaceFrameGeneration: Long,
  ): ObservationResult {
    if (remainingMs(request, nowUptimeMs) == 0L) {
      return ObservationResult(observation, Decision.TIMED_OUT)
    }
    val frameAdvanced = surfaceFrameGeneration > observation.callbackSurfaceFrameGeneration
    val near = abs(actualPositionMs - request.targetMs) <= toleranceMs(durationMs)
    val nearSamples = if (frameAdvanced && near) observation.consecutiveNearSamples + 1 else 0
    val stableFarSamples = if (frameAdvanced && !near) {
      if (observation.lastFarPositionMs != null &&
        abs(actualPositionMs - observation.lastFarPositionMs) <= STABLE_FAR_DELTA_MS
      ) observation.consecutiveStableFarSamples + 1 else 1
    } else 0
    val updated = observation.copy(
      consecutiveNearSamples = nearSamples,
      lastFarPositionMs = if (frameAdvanced && !near) actualPositionMs else null,
      consecutiveStableFarSamples = stableFarSamples,
    )
    if (nearSamples >= 2) return ObservationResult(updated, Decision.SETTLE)
    if (request.attempt == Attempt.PRIMARY &&
      (stableFarSamples >= 2 || nowUptimeMs - observation.callbackUptimeMs >= PRIMARY_FALLBACK_WAIT_MS)
    ) return ObservationResult(updated, Decision.FALLBACK)
    return ObservationResult(updated, Decision.WAIT)
  }

  fun displayPosition(actualPositionMs: Long, pendingTargetMs: Long?): Long =
    (pendingTargetMs ?: actualPositionMs).coerceAtLeast(0L)

  fun withFallback(request: Request): Request = request.copy(attempt = Attempt.FALLBACK)
}
