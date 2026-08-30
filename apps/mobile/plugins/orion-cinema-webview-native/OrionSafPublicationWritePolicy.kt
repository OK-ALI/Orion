package com.okali.orion.playback

/** Pure compatibility decisions shared by SAF publication and JVM tests. */
internal object OrionSafPublicationWritePolicy {
  enum class Mode { SEEKABLE_RWT, EXCLUSIVE_W }
  enum class SyncOutcome { SYNCED, FAILED, UNSUPPORTED }

  fun shouldFallbackToExclusive(seekableDescriptorOpened: Boolean, bytesWritten: Long): Boolean =
    !seekableDescriptorOpened && bytesWritten == 0L

  fun acceptsAfterDeepVerification(syncOutcome: SyncOutcome, deepVerificationPassed: Boolean): Boolean =
    deepVerificationPassed && syncOutcome in SyncOutcome.entries

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
