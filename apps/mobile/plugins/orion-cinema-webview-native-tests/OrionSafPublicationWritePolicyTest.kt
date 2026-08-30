package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionSafPublicationWritePolicyTest {
  @Test
  fun oldProviderDescriptorFailureFallsBackOnlyBeforeWriting() {
    assertTrue(OrionSafPublicationWritePolicy.shouldFallbackToExclusive(false, 0L))
    assertFalse(OrionSafPublicationWritePolicy.shouldFallbackToExclusive(false, 1L))
    assertFalse(OrionSafPublicationWritePolicy.shouldFallbackToExclusive(true, 0L))
  }

  @Test
  fun syncFailureRequiresAndCanNeverReplaceDeepVerification() {
    assertFalse(OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(
      OrionSafPublicationWritePolicy.SyncOutcome.SYNCED, false,
    ))
    assertFalse(OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(
      OrionSafPublicationWritePolicy.SyncOutcome.FAILED, false,
    ))
    assertTrue(OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(
      OrionSafPublicationWritePolicy.SyncOutcome.FAILED, true,
    ))
    assertTrue(OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(
      OrionSafPublicationWritePolicy.SyncOutcome.UNSUPPORTED, true,
    ))
  }

  @Test
  fun publicationFailuresRemainStageSpecificAndSanitized() {
    assertEquals("descriptor-open-failed", OrionSafPublicationWritePolicy.failureCode("descriptor-open"))
    assertEquals("source-read-failed", OrionSafPublicationWritePolicy.failureCode("source-read"))
    assertEquals("copy-write-failed", OrionSafPublicationWritePolicy.failureCode("document-write"))
    assertEquals("flush-failed", OrionSafPublicationWritePolicy.failureCode("flush"))
    assertEquals("copy-size-mismatch", OrionSafPublicationWritePolicy.failureCode("copy-size"))
    assertEquals("copy-failed", OrionSafPublicationWritePolicy.failureCode("provider-secret"))
  }
}
