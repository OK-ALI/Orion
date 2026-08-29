package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class OrionFinalizedArtifactPolicyTest {
  private val digest = "a".repeat(64)

  @Test
  fun jsonNullSeriesTitleCannotOverrideTheRealMovieTitle() {
    assertNull(OrionFinalizedArtifactPolicy.metadataText(JSONObject.NULL))
    assertNull(OrionFinalizedArtifactPolicy.metadataText("null"))
    assertNull(OrionFinalizedArtifactPolicy.metadataText("undefined"))
    assertEquals("Grand Theft Auto VI An Extended Look", OrionFinalizedArtifactPolicy.metadataText(" Grand Theft Auto VI An Extended Look "))
    assertEquals(
      "Grand Theft Auto VI An Extended Look (2026).mp4",
      OrionFinalizedArtifactPolicy.finalDisplayName(
        title = "Grand Theft Auto VI An Extended Look",
        year = 2026,
        seriesTitle = OrionFinalizedArtifactPolicy.metadataText(JSONObject.NULL),
        season = null,
        episode = null,
        episodeTitle = null,
      ),
    )
  }

  @Test
  fun subtitleNamesUseTheFinalMediaStemAndLanguageBeforeProviderCollisionIdentity() {
    assertEquals(
      "Grand Theft Auto VI An Extended Look (2026).en.srt",
      OrionFinalizedArtifactPolicy.subtitleDisplayName(
        "Grand Theft Auto VI An Extended Look (2026).mp4", "en", "subdl", "srt", false,
      ),
    )
    assertEquals(
      "Grand Theft Auto VI An Extended Look (2026).en.wyzie.vtt",
      OrionFinalizedArtifactPolicy.subtitleDisplayName(
        "Grand Theft Auto VI An Extended Look (2026).mp4", "en", "wyzie", "vtt", true,
      ),
    )
    assertNull(OrionFinalizedArtifactPolicy.subtitleDisplayName("Movie.mp4", "en", "subdl", "txt", false))
  }

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

  @Test
  fun userFolderProofBindsSourceDestinationMetadataDescriptorAndVerifier() {
    assertTrue(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 42L, 42L, digest, digest, true, true))
    assertTrue(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 42L, null, digest, digest, true, true))
    assertFalse(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 41L, 42L, digest, digest, true, true))
    assertFalse(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 42L, 41L, digest, digest, true, true))
    assertFalse(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 42L, 42L, digest, "b".repeat(64), true, true))
    assertFalse(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 42L, 42L, digest, digest, false, true))
    assertFalse(OrionFinalizedArtifactPolicy.documentProofMatches(42L, 42L, 42L, digest, digest, true, false))
  }

  @Test
  fun humanVisibleNamesPreserveIdentityAndRemainBounded() {
    assertEquals(
      "Arrival (2016).mp4",
      OrionFinalizedArtifactPolicy.finalDisplayName("Arrival", 2016, null, null, null, null),
    )
    assertEquals(
      "Reacher - S02E03 - Picture Says a Thousand Words.mp4",
      OrionFinalizedArtifactPolicy.finalDisplayName(
        "Reacher",
        null,
        "Reacher",
        2,
        3,
        "Picture Says a Thousand Words",
      ),
    )
    val sanitized = OrionFinalizedArtifactPolicy.finalDisplayName("Bad:/Name", null, null, null, null, null)
    assertEquals("Bad__Name.mp4", sanitized)
    assertTrue(OrionFinalizedArtifactPolicy.finalDisplayName("x".repeat(400), null, null, null, null, null).length <= 120)
    assertEquals(
      "🎬".repeat(116) + ".mp4",
      OrionFinalizedArtifactPolicy.finalDisplayName("🎬".repeat(200), null, null, null, null, null),
    )
  }

  @Test
  fun actualSafSanitizerPreservesSupplementaryUnicodeAndMp4Suffix() {
    val sanitized = OrionSafDocumentNamePolicy.sanitize("🎬".repeat(200) + ".mp4", "Orion Download.mp4")
    assertEquals("🎬".repeat(116) + ".mp4", sanitized)
    assertEquals(120, sanitized.codePointCount(0, sanitized.length))
    assertFalse(hasBrokenSurrogatePair(sanitized))
    assertEquals("Bad__Name.mp4", OrionSafDocumentNamePolicy.sanitize(" Bad:/Name.mp4 "))
    assertEquals("Orion Download.mp4", OrionSafDocumentNamePolicy.sanitize("   ", "Orion Download.mp4"))
  }

  @Test
  fun documentProbeRequiresDescriptorAccessAndConsistentKnownSizes() {
    assertEquals(
      OrionDocumentProbePolicy.Result.Verified(42L),
      OrionDocumentProbePolicy.classify(true, 42L, OrionDocumentProbePolicy.DescriptorOutcome.OPENED, 42L),
    )
    assertEquals(
      OrionDocumentProbePolicy.Result.Verified(42L),
      OrionDocumentProbePolicy.classify(true, 42L, OrionDocumentProbePolicy.DescriptorOutcome.OPENED, null),
    )
    assertEquals(
      OrionDocumentProbePolicy.Result.Verified(42L),
      OrionDocumentProbePolicy.classify(true, null, OrionDocumentProbePolicy.DescriptorOutcome.OPENED, 42L),
    )
    assertSame(
      OrionDocumentProbePolicy.Result.Unavailable,
      OrionDocumentProbePolicy.classify(true, 42L, OrionDocumentProbePolicy.DescriptorOutcome.UNAVAILABLE, null),
    )
    assertSame(
      OrionDocumentProbePolicy.Result.Unavailable,
      OrionDocumentProbePolicy.classify(true, 42L, OrionDocumentProbePolicy.DescriptorOutcome.OPENED, 41L),
    )
    assertSame(
      OrionDocumentProbePolicy.Result.Unavailable,
      OrionDocumentProbePolicy.classify(true, null, OrionDocumentProbePolicy.DescriptorOutcome.OPENED, null),
    )
    assertSame(
      OrionDocumentProbePolicy.Result.Missing,
      OrionDocumentProbePolicy.classify(true, 42L, OrionDocumentProbePolicy.DescriptorOutcome.MISSING, null),
    )
    assertSame(
      OrionDocumentProbePolicy.Result.Missing,
      OrionDocumentProbePolicy.classify(false, null, OrionDocumentProbePolicy.DescriptorOutcome.OPENED, 42L),
    )
  }

  @Test
  fun integrityCadenceDeepChecksTargetedStaleAndUnstampedArtifacts() {
    val hour = 60L * 60L * 1000L
    val now = 10L * 24L * hour

    assertTrue(OrionArtifactIntegrityPolicy.requiresDigestVerification(
      targeted = true,
      stampValid = true,
      integrityCheckedAt = now - hour,
      legacyLastCheckedAt = now - hour,
      now = now,
    ))
    assertTrue(OrionArtifactIntegrityPolicy.requiresDigestVerification(
      targeted = false,
      stampValid = false,
      integrityCheckedAt = now - hour,
      legacyLastCheckedAt = now - hour,
      now = now,
    ))
    assertTrue(OrionArtifactIntegrityPolicy.requiresDigestVerification(
      targeted = false,
      stampValid = true,
      integrityCheckedAt = now - OrionArtifactIntegrityPolicy.FULL_DIGEST_RECHECK_INTERVAL_MS,
      legacyLastCheckedAt = now - hour,
      now = now,
    ))
    assertFalse(OrionArtifactIntegrityPolicy.requiresDigestVerification(
      targeted = false,
      stampValid = true,
      integrityCheckedAt = now - hour,
      legacyLastCheckedAt = now - (48L * hour),
      now = now,
    ))
  }

  @Test
  fun legacyLastCheckedTimeBootstrapsPrivateIntegrityCadenceOnce() {
    assertEquals(42L, OrionArtifactIntegrityPolicy.previousIntegrityCheckedAt(-1L, 42L))
    assertEquals(84L, OrionArtifactIntegrityPolicy.previousIntegrityCheckedAt(84L, 42L))
    assertNull(OrionArtifactIntegrityPolicy.previousIntegrityCheckedAt(-1L, -1L))
  }

  private fun hasBrokenSurrogatePair(value: String): Boolean {
    for (index in value.indices) {
      val char = value[index]
      if (char.isHighSurrogate() && (index + 1 >= value.length || !value[index + 1].isLowSurrogate())) return true
      if (char.isLowSurrogate() && (index == 0 || !value[index - 1].isHighSurrogate())) return true
    }
    return false
  }
}
