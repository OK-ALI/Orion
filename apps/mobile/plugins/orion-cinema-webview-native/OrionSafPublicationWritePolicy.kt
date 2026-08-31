package com.okali.orion.playback

/** Pure compatibility decisions shared by SAF publication and JVM tests. */
internal object OrionSafPublicationWritePolicy {
  const val READINESS_LIMIT_MS = 3_000L
  val READINESS_DELAYS_MS = longArrayOf(100L, 200L, 400L, 800L, 1_500L)

  enum class Mode { EXCLUSIVE_W, SEEKABLE_RWT }
  enum class SyncOutcome { SYNCED, FAILED, UNSUPPORTED }
  enum class CloseOutcome { CLOSED, FAILED }
  enum class ReadinessProbe { READY, TRANSIENT_NOT_READY, DEFINITIVE_FAILURE }
  enum class ReadinessDecision { READY, RETRY, FAILED, CANCELLED }

  fun shouldFallbackToSeekable(exclusiveStreamOpened: Boolean, bytesWritten: Long): Boolean =
    !exclusiveStreamOpened && bytesWritten == 0L

  fun readinessDelayMs(attempt: Int): Long? = READINESS_DELAYS_MS.getOrNull(attempt)

  fun readinessDecision(
    probe: ReadinessProbe,
    canContinue: Boolean,
    hasRemainingDelay: Boolean,
  ): ReadinessDecision = when {
    !canContinue -> ReadinessDecision.CANCELLED
    probe == ReadinessProbe.READY -> ReadinessDecision.READY
    probe == ReadinessProbe.DEFINITIVE_FAILURE -> ReadinessDecision.FAILED
    hasRemainingDelay -> ReadinessDecision.RETRY
    else -> ReadinessDecision.FAILED
  }

  fun metadataProbe(observedBytes: Long?, expectedBytes: Long?): ReadinessProbe = when {
    expectedBytes == null -> ReadinessProbe.READY
    observedBytes == null -> ReadinessProbe.READY
    observedBytes == expectedBytes -> ReadinessProbe.READY
    else -> ReadinessProbe.TRANSIENT_NOT_READY
  }

  fun descriptorProbe(
    descriptorOpened: Boolean,
    statSize: Long?,
    expectedBytes: Long,
    permissionDenied: Boolean = false,
  ): ReadinessProbe = when {
    permissionDenied -> ReadinessProbe.DEFINITIVE_FAILURE
    !descriptorOpened -> ReadinessProbe.TRANSIENT_NOT_READY
    statSize == null || statSize < 0L || statSize == expectedBytes -> ReadinessProbe.READY
    else -> ReadinessProbe.TRANSIENT_NOT_READY
  }

  fun acceptsAfterDeepVerification(
    syncOutcome: SyncOutcome,
    closeOutcome: CloseOutcome,
    deepVerificationPassed: Boolean,
  ): Boolean = deepVerificationPassed &&
    syncOutcome in SyncOutcome.entries && closeOutcome in CloseOutcome.entries

  fun failureCode(stage: String): String = when (stage) {
    "descriptor-open" -> "descriptor-open-failed"
    "source-read" -> "source-read-failed"
    "document-write" -> "copy-write-failed"
    "flush" -> "flush-failed"
    "close" -> "close-failed"
    "copy-size" -> "copy-size-mismatch"
    else -> "copy-failed"
  }
}
