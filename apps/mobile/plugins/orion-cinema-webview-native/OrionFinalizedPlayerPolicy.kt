package com.okali.orion.playback

internal data class OrionFinalizedPlayerEvidence(
  val attached: Boolean = false,
  val viewWidth: Int = 0,
  val viewHeight: Int = 0,
  val surfaceAvailable: Boolean = false,
  val surfaceWidth: Int = 0,
  val surfaceHeight: Int = 0,
  val playerReady: Boolean = false,
  val videoTrackCount: Int = 0,
  val audioTrackCount: Int = 0,
  val videoDecoderInitialized: Boolean = false,
  val audioDecoderInitialized: Boolean = false,
  val firstFrameRendered: Boolean = false,
)

internal data class OrionFinalizedPlayerFailure(
  val stage: String,
  val code: String,
  val category: String,
  val message: String,
)

/** Pure deadline and evidence policy used by the finalized native player. */
internal object OrionFinalizedPlayerPolicy {
  const val LAYOUT_TIMEOUT_MS = 3_000L
  const val TRACK_DISCOVERY_TIMEOUT_MS = 3_000L
  const val PREPARATION_TIMEOUT_MS = 30_000L
  const val FIRST_FRAME_TIMEOUT_MS = 10_000L

  fun acceptsGeneration(expected: Long, observed: Long): Boolean = expected == observed

  fun resetForRetry(current: OrionFinalizedPlayerEvidence): OrionFinalizedPlayerEvidence =
    OrionFinalizedPlayerEvidence(
      attached = current.attached,
      viewWidth = current.viewWidth,
      viewHeight = current.viewHeight,
      surfaceAvailable = current.surfaceAvailable,
      surfaceWidth = current.surfaceWidth,
      surfaceHeight = current.surfaceHeight,
    )

  fun hasRenderableSurface(evidence: OrionFinalizedPlayerEvidence): Boolean =
    evidence.attached && evidence.viewWidth > 0 && evidence.viewHeight > 0 &&
      evidence.surfaceAvailable && evidence.surfaceWidth > 0 && evidence.surfaceHeight > 0

  fun hasRequiredTracks(evidence: OrionFinalizedPlayerEvidence): Boolean =
    evidence.videoTrackCount > 0 && evidence.audioTrackCount > 0

  fun readyForFirstFrameDeadline(evidence: OrionFinalizedPlayerEvidence): Boolean =
    evidence.playerReady && hasRequiredTracks(evidence) && hasRenderableSurface(evidence) &&
      !evidence.firstFrameRendered

  fun layoutDeadlineFailure(elapsedMs: Long, evidence: OrionFinalizedPlayerEvidence): OrionFinalizedPlayerFailure? =
    if (elapsedMs >= LAYOUT_TIMEOUT_MS && !hasRenderableSurface(evidence)) {
      OrionFinalizedPlayerFailure(
        stage = "video-surface",
        code = "finalized-video-surface-unavailable",
        category = "surface",
        message = "Orion could not create a visible video surface.",
      )
    } else null

  fun preparationDeadlineFailure(elapsedMs: Long, evidence: OrionFinalizedPlayerEvidence): OrionFinalizedPlayerFailure? =
    if (elapsedMs >= PREPARATION_TIMEOUT_MS && !evidence.playerReady) {
      OrionFinalizedPlayerFailure(
        stage = "player-prepare",
        code = "finalized-player-prepare-timeout",
        category = "preparation",
        message = "The finalized download took too long to prepare.",
      )
    } else null

  fun trackFailure(evidence: OrionFinalizedPlayerEvidence): OrionFinalizedPlayerFailure? = when {
    evidence.videoTrackCount <= 0 -> OrionFinalizedPlayerFailure(
      "track-discovery",
      "finalized-video-track-missing",
      "tracks",
      "The finalized download has no playable video track.",
    )
    evidence.audioTrackCount <= 0 -> OrionFinalizedPlayerFailure(
      "track-discovery",
      "finalized-audio-track-missing",
      "tracks",
      "The finalized download has no playable audio track.",
    )
    else -> null
  }

  fun trackDeadlineFailure(elapsedMs: Long, evidence: OrionFinalizedPlayerEvidence): OrionFinalizedPlayerFailure? =
    if (elapsedMs >= TRACK_DISCOVERY_TIMEOUT_MS && evidence.playerReady) trackFailure(evidence) else null

  fun firstFrameDeadlineFailure(elapsedMs: Long, evidence: OrionFinalizedPlayerEvidence): OrionFinalizedPlayerFailure? =
    if (elapsedMs < FIRST_FRAME_TIMEOUT_MS || !readyForFirstFrameDeadline(evidence)) null else when {
      !evidence.videoDecoderInitialized -> OrionFinalizedPlayerFailure(
        "decoder-initialization",
        "finalized-video-decoder-not-initialized",
        "decoder",
        "Orion could not initialize the video decoder.",
      )
      !evidence.audioDecoderInitialized -> OrionFinalizedPlayerFailure(
        "decoder-initialization",
        "finalized-audio-decoder-not-initialized",
        "decoder",
        "Orion could not initialize the audio decoder.",
      )
      else -> OrionFinalizedPlayerFailure(
        stage = "first-frame",
        code = "finalized-first-frame-timeout",
        category = "render",
        message = "Playback prepared, but Orion could not render the first video frame.",
      )
    }

  fun shouldResumeAfterHostResume(wasPlayingBeforePause: Boolean, released: Boolean): Boolean =
    wasPlayingBeforePause && !released
}
