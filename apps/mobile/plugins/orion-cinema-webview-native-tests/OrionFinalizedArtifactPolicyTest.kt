package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionFinalizedArtifactPolicyTest {
  private val digest = "a".repeat(64)

  @Test
  fun acceptsOnlyTheExactDeterministicYtDlpOutput() {
    assertEquals(
      "media.mp4",
      OrionFinalizedArtifactPolicy.finalizedOutput(
        listOf(OrionFinalizedArtifactPolicy.OutputEntry("media.mp4", true, 42L)),
      ),
    )
    assertNull(OrionFinalizedArtifactPolicy.finalizedOutput(emptyList()))
    assertNull(OrionFinalizedArtifactPolicy.finalizedOutput(
      listOf(OrionFinalizedArtifactPolicy.OutputEntry("title.mp4", true, 42L)),
    ))
    assertNull(OrionFinalizedArtifactPolicy.finalizedOutput(listOf(
      OrionFinalizedArtifactPolicy.OutputEntry("media.mp4", true, 42L),
      OrionFinalizedArtifactPolicy.OutputEntry("media.f137.mp4", true, 12L),
    )))
    assertNull(OrionFinalizedArtifactPolicy.finalizedOutput(
      listOf(OrionFinalizedArtifactPolicy.OutputEntry("media.mp4.part", true, 42L)),
    ))
  }

  @Test
  fun derivesOnlyCanonicalJobRelativeMp4Locators() {
    assertEquals("mobdl-safe_1.mp4", OrionFinalizedArtifactPolicy.relativeLocator("mobdl-safe_1"))
    assertNull(OrionFinalizedArtifactPolicy.relativeLocator("../escape"))
    assertNull(OrionFinalizedArtifactPolicy.relativeLocator(""))
  }

  @Test
  fun durableProofRequiresExactSizeDigestDescriptorAndMediaVerification() {
    assertTrue(OrionFinalizedArtifactPolicy.durableProofMatches(42L, 42L, digest, 42L, true))
    assertFalse(OrionFinalizedArtifactPolicy.durableProofMatches(42L, 41L, digest, 41L, true))
    assertFalse(OrionFinalizedArtifactPolicy.durableProofMatches(42L, 42L, "bad", 42L, true))
    assertFalse(OrionFinalizedArtifactPolicy.durableProofMatches(42L, 42L, digest, 41L, true))
    assertFalse(OrionFinalizedArtifactPolicy.durableProofMatches(42L, 42L, digest, 42L, false))
  }

  @Test
  fun privateVerificationStampBindsVersionBytesAndDigest() {
    assertTrue(OrionFinalizedArtifactPolicy.verificationStampMatches(2, 42L, 42L, digest))
    assertFalse(OrionFinalizedArtifactPolicy.verificationStampMatches(1, 42L, 42L, digest))
    assertFalse(OrionFinalizedArtifactPolicy.verificationStampMatches(2, 41L, 42L, digest))
    assertFalse(OrionFinalizedArtifactPolicy.verificationStampMatches(2, 42L, 42L, "bad"))
  }
}
