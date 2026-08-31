package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionSafPublicationWritePolicyTest {
  @Test
  fun exclusiveOpenFailureFallsBackOnlyBeforeAnyWriteCanBegin() {
    assertTrue(OrionSafPublicationWritePolicy.shouldFallbackToSeekable(false, 0L))
    assertFalse(OrionSafPublicationWritePolicy.shouldFallbackToSeekable(false, 1L))
    assertFalse(OrionSafPublicationWritePolicy.shouldFallbackToSeekable(true, 0L))
  }

  @Test
  fun providerReadinessBudgetIsBoundedToThreeSeconds() {
    assertEquals(3_000L, OrionSafPublicationWritePolicy.READINESS_LIMIT_MS)
    assertEquals(3_000L, OrionSafPublicationWritePolicy.READINESS_DELAYS_MS.sum())
    assertEquals(100L, OrionSafPublicationWritePolicy.readinessDelayMs(0))
    assertEquals(1_500L, OrionSafPublicationWritePolicy.readinessDelayMs(4))
    assertNull(OrionSafPublicationWritePolicy.readinessDelayMs(5))
  }

  @Test
  fun delayedDescriptorSizeConvergesInsideBudget() {
    val expected = 1_024L
    val observed = listOf(0L, 512L, expected)
    val decisions = observed.mapIndexed { index, size ->
      OrionSafPublicationWritePolicy.readinessDecision(
        OrionSafPublicationWritePolicy.descriptorProbe(true, size, expected),
        canContinue = true,
        hasRemainingDelay = index < observed.lastIndex,
      )
    }
    assertEquals(
      listOf(
        OrionSafPublicationWritePolicy.ReadinessDecision.RETRY,
        OrionSafPublicationWritePolicy.ReadinessDecision.RETRY,
        OrionSafPublicationWritePolicy.ReadinessDecision.READY,
      ),
      decisions,
    )
  }

  @Test
  fun staleDescriptorSizeAtBudgetExhaustionFailsClosed() {
    val probe = OrionSafPublicationWritePolicy.descriptorProbe(true, 512L, 1_024L)
    assertEquals(
      OrionSafPublicationWritePolicy.ReadinessDecision.FAILED,
      OrionSafPublicationWritePolicy.readinessDecision(
        probe,
        canContinue = true,
        hasRemainingDelay = false,
      ),
    )
  }

  @Test
  fun unavailableMetadataSizeIsReadyForDeeperProof() {
    val probe = OrionSafPublicationWritePolicy.metadataProbe(null, 1_024L)
    assertEquals(OrionSafPublicationWritePolicy.ReadinessProbe.READY, probe)
    assertEquals(
      OrionSafPublicationWritePolicy.ReadinessDecision.READY,
      OrionSafPublicationWritePolicy.readinessDecision(
        probe,
        canContinue = true,
        hasRemainingDelay = true,
      ),
    )
  }

  @Test
  fun concreteZeroAndStaleMetadataSizesRetryInsideBudget() {
    for (observed in listOf(0L, 512L)) {
      val probe = OrionSafPublicationWritePolicy.metadataProbe(observed, 1_024L)
      assertEquals(OrionSafPublicationWritePolicy.ReadinessProbe.TRANSIENT_NOT_READY, probe)
      assertEquals(
        OrionSafPublicationWritePolicy.ReadinessDecision.RETRY,
        OrionSafPublicationWritePolicy.readinessDecision(
          probe,
          canContinue = true,
          hasRemainingDelay = true,
        ),
      )
    }
  }

  @Test
  fun concreteStaleMetadataSizeAtBudgetExhaustionFailsClosed() {
    val probe = OrionSafPublicationWritePolicy.metadataProbe(512L, 1_024L)
    assertEquals(
      OrionSafPublicationWritePolicy.ReadinessDecision.FAILED,
      OrionSafPublicationWritePolicy.readinessDecision(
        probe,
        canContinue = true,
        hasRemainingDelay = false,
      ),
    )
  }

  @Test
  fun exactExpectedMetadataSizeIsReady() {
    assertEquals(
      OrionSafPublicationWritePolicy.ReadinessProbe.READY,
      OrionSafPublicationWritePolicy.metadataProbe(1_024L, 1_024L),
    )
  }

  @Test
  fun readinessCancellationCannotBecomeStorageFailure() {
    assertEquals(
      OrionSafPublicationWritePolicy.ReadinessDecision.CANCELLED,
      OrionSafPublicationWritePolicy.readinessDecision(
        OrionSafPublicationWritePolicy.ReadinessProbe.TRANSIENT_NOT_READY,
        canContinue = false,
        hasRemainingDelay = true,
      ),
    )
  }

  @Test
  fun syncAndCloseFailuresCanNeverReplaceDeepDestinationVerification() {
    for (sync in OrionSafPublicationWritePolicy.SyncOutcome.entries) {
      for (close in OrionSafPublicationWritePolicy.CloseOutcome.entries) {
        assertFalse(OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(sync, close, false))
        assertTrue(OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(sync, close, true))
      }
    }
  }

  @Test
  fun publicationFailuresRemainStageSpecificAndSanitized() {
    assertEquals("descriptor-open-failed", OrionSafPublicationWritePolicy.failureCode("descriptor-open"))
    assertEquals("source-read-failed", OrionSafPublicationWritePolicy.failureCode("source-read"))
    assertEquals("copy-write-failed", OrionSafPublicationWritePolicy.failureCode("document-write"))
    assertEquals("flush-failed", OrionSafPublicationWritePolicy.failureCode("flush"))
    assertEquals("close-failed", OrionSafPublicationWritePolicy.failureCode("close"))
    assertEquals("copy-size-mismatch", OrionSafPublicationWritePolicy.failureCode("copy-size"))
    assertEquals("copy-failed", OrionSafPublicationWritePolicy.failureCode("provider-secret"))
  }
}
