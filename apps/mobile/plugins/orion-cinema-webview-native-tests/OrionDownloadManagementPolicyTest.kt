package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class OrionDownloadManagementPolicyTest {
  private val tokenA = "a".repeat(64)
  private val tokenB = "b".repeat(64)
  private val tokenC = "c".repeat(64)

  private fun artifact(
    id: String,
    availability: OrionArtifactAvailability,
    bytes: Long? = null,
    role: String = "primary",
  ) = OrionOwnedArtifactState("asset", id, role, availability, bytes)

  @Test
  fun reconciliationDistinguishesMissingFromUnavailable() {
    assertEquals(OrionArtifactAvailability.VERIFIED, OrionDownloadOwnershipPolicy.classifyProbe(true, false, true))
    assertEquals(OrionArtifactAvailability.MISSING, OrionDownloadOwnershipPolicy.classifyProbe(false, true, true))
    assertEquals(OrionArtifactAvailability.UNAVAILABLE, OrionDownloadOwnershipPolicy.classifyProbe(false, false, false))
    assertEquals(OrionArtifactAvailability.UNAVAILABLE, OrionDownloadOwnershipPolicy.classifyProbe(false, false, true))
  }

  @Test
  fun completedAndDuplicateDecisionsUsePrimaryAvailability() {
    assertTrue(OrionDownloadOwnershipPolicy.completed(OrionArtifactAvailability.VERIFIED))
    assertFalse(OrionDownloadOwnershipPolicy.completed(OrionArtifactAvailability.CHECKING))
    assertFalse(OrionDownloadOwnershipPolicy.completed(OrionArtifactAvailability.MISSING))
    assertTrue(OrionDownloadOwnershipPolicy.blocksDuplicate("completed", OrionArtifactAvailability.VERIFIED))
    assertTrue(OrionDownloadOwnershipPolicy.blocksDuplicate("completed", OrionArtifactAvailability.CHECKING))
    assertTrue(OrionDownloadOwnershipPolicy.blocksDuplicate("completed", OrionArtifactAvailability.UNAVAILABLE))
    assertFalse(OrionDownloadOwnershipPolicy.blocksDuplicate("completed", OrionArtifactAvailability.MISSING))
    assertTrue(OrionDownloadOwnershipPolicy.blocksDuplicate("downloading", OrionArtifactAvailability.MISSING))
  }

  @Test
  fun storedBytesIncludeOnlyVerifiedArtifactsAndSaturate() {
    val artifacts = listOf(
      OrionOwnedArtifactState("movie", "media", "primary", OrionArtifactAvailability.VERIFIED, 1_000L),
      OrionOwnedArtifactState("movie", "subtitle", "subtitle", OrionArtifactAvailability.VERIFIED, 125L),
      OrionOwnedArtifactState("episode", "missing", "primary", OrionArtifactAvailability.MISSING, 9_999L),
      OrionOwnedArtifactState("episode", "unavailable", "subtitle", OrionArtifactAvailability.UNAVAILABLE, 9_999L),
    )
    assertEquals(1_125L, OrionDownloadOwnershipPolicy.storedBytes(artifacts))
    assertEquals(Long.MAX_VALUE, OrionDownloadOwnershipPolicy.storedBytes(listOf(
      artifacts[0].copy(observedBytes = Long.MAX_VALUE),
      artifacts[1],
    )))
  }

  @Test
  fun partialDeletionRetainsCopyAndCompleteDeletionRemovesIt() {
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveAsset(emptyList()))
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveAsset(listOf(OrionArtifactDeleteDisposition.DELETED, OrionArtifactDeleteDisposition.UNAVAILABLE)))
    assertTrue(OrionDownloadOwnershipPolicy.canRemoveAsset(listOf(OrionArtifactDeleteDisposition.DELETED, OrionArtifactDeleteDisposition.ALREADY_MISSING)))
  }

  @Test
  fun existingArtifactDeletionReclaimsVerifiedBytes() {
    var calls = 0
    val decision = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("primary", OrionArtifactAvailability.VERIFIED, 4_096L)) {
      calls += 1
      OrionArtifactDeleteResult.DELETED
    }
    assertEquals(1, calls)
    assertEquals(OrionArtifactDeleteDisposition.DELETED, decision.disposition)
    assertEquals(4_096L, decision.reclaimedBytes)
    assertEquals(OrionAssetManagementDisposition.PHYSICALLY_DELETED, OrionDownloadOwnershipPolicy.assetDeletionDisposition(listOf(decision)))
  }

  @Test
  fun conclusivelyMissingArtifactSkipsIoAndRemovesWithoutReclaimedBytes() {
    var calls = 0
    val decision = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("primary", OrionArtifactAvailability.MISSING, 8_192L)) {
      calls += 1
      OrionArtifactDeleteResult.UNAVAILABLE
    }
    assertEquals(0, calls)
    assertEquals(OrionArtifactDeleteDisposition.ALREADY_MISSING, decision.disposition)
    assertEquals(0L, decision.reclaimedBytes)
    assertEquals(OrionAssetManagementDisposition.ALREADY_MISSING, OrionDownloadOwnershipPolicy.assetDeletionDisposition(listOf(decision)))
  }

  @Test
  fun explicitDeleteTimeNotFoundIsAlreadyMissing() {
    val decision = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("primary", OrionArtifactAvailability.UNAVAILABLE)) {
      OrionArtifactDeleteResult.ALREADY_MISSING
    }
    assertEquals(OrionArtifactDeleteDisposition.ALREADY_MISSING, decision.disposition)
    assertEquals(0L, decision.reclaimedBytes)
  }

  @Test
  fun failedDeleteRequiresConclusiveFollowUpAbsence() {
    assertEquals(OrionArtifactDeleteResult.ALREADY_MISSING, OrionDownloadOwnershipPolicy.classifyDeleteFailure(true, false))
    assertEquals(OrionArtifactDeleteResult.UNAVAILABLE, OrionDownloadOwnershipPolicy.classifyDeleteFailure(false, false))
    assertEquals(OrionArtifactDeleteResult.UNAVAILABLE, OrionDownloadOwnershipPolicy.classifyDeleteFailure(true, true))
  }

  @Test
  fun revokedOrIndeterminateAccessRetainsRecord() {
    val permissionRevoked = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("permission", OrionArtifactAvailability.UNAVAILABLE)) {
      OrionArtifactDeleteResult.UNAVAILABLE
    }
    val providerFailure = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("provider", OrionArtifactAvailability.VERIFIED, 200L)) {
      OrionArtifactDeleteResult.UNAVAILABLE
    }
    assertEquals(OrionArtifactDeleteDisposition.UNAVAILABLE, permissionRevoked.disposition)
    assertEquals(OrionArtifactDeleteDisposition.UNAVAILABLE, providerFailure.disposition)
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveAsset(listOf(permissionRevoked.disposition)))
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveAsset(listOf(providerFailure.disposition)))
  }

  @Test
  fun mixedBulkOutcomesRemainTruthful() {
    val deleted = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("deleted", OrionArtifactAvailability.VERIFIED, 500L)) { OrionArtifactDeleteResult.DELETED }
    val missing = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("missing", OrionArtifactAvailability.MISSING, 900L)) { OrionArtifactDeleteResult.UNAVAILABLE }
    val unavailable = OrionDownloadOwnershipPolicy.decideArtifactDeletion(artifact("unavailable", OrionArtifactAvailability.UNAVAILABLE)) { OrionArtifactDeleteResult.UNAVAILABLE }
    assertEquals(OrionAssetManagementDisposition.PHYSICALLY_DELETED, OrionDownloadOwnershipPolicy.assetDeletionDisposition(listOf(deleted)))
    assertEquals(OrionAssetManagementDisposition.ALREADY_MISSING, OrionDownloadOwnershipPolicy.assetDeletionDisposition(listOf(missing)))
    assertEquals(OrionAssetManagementDisposition.RETAINED_UNAVAILABLE, OrionDownloadOwnershipPolicy.assetDeletionDisposition(listOf(unavailable)))
    assertEquals(500L, listOf(deleted, missing, unavailable).sumOf { it.reclaimedBytes })
  }

  @Test
  fun removeFromOrionIsUnavailableOnlyAndDoesNotPerformDeletionIo() {
    assertTrue(OrionDownloadOwnershipPolicy.canRemoveUnavailableRecord(OrionArtifactAvailability.UNAVAILABLE))
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveUnavailableRecord(OrionArtifactAvailability.MISSING))
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveUnavailableRecord(OrionArtifactAvailability.VERIFIED))
    assertFalse(OrionDownloadOwnershipPolicy.canRemoveUnavailableRecord(OrionArtifactAvailability.CHECKING))
  }

  @Test
  fun onlyExplicitlyTrackedArtifactsReachDeletionIo() {
    val touched = mutableListOf<String>()
    val tracked = listOf(
      artifact("primary", OrionArtifactAvailability.VERIFIED, 100L),
      artifact("subtitle", OrionArtifactAvailability.VERIFIED, 10L, "subtitle"),
    )
    tracked.forEach { state ->
      OrionDownloadOwnershipPolicy.decideArtifactDeletion(state) {
        touched.add(state.artifactId)
        OrionArtifactDeleteResult.DELETED
      }
    }
    assertEquals(listOf("primary", "subtitle"), touched)
    assertFalse(touched.contains("unrelated-saf-file"))
  }

  @Test
  fun managedDeletionTargetsStayInsideOwnedRoot() {
    val root = Files.createTempDirectory("orion-owned-root").toFile()
    try {
      val movie = File(root, "movie.fragments/selected-subtitles/en.srt")
      assertTrue(OrionDownloadOwnershipPolicy.canonicalContained(root, movie))
      assertFalse(OrionDownloadOwnershipPolicy.canonicalContained(root, File(root, "../unrelated.mp4")))
      assertFalse(OrionDownloadOwnershipPolicy.canonicalContained(root, File(root.parentFile, "unrelated.mp4")))
    } finally {
      root.deleteRecursively()
    }
  }

  @Test
  fun selectedDeletionAuthorizesOnlyExactConfirmedAssets() {
    val current = mapOf("A" to tokenA, "B" to tokenB, "C" to tokenC)
    val one = OrionDownloadOwnershipPolicy.authorizeSelection(
      listOf(OrionDownloadManagementSelection("B", tokenB)),
      current,
    )
    assertEquals(setOf("B"), one.approvedAssetIds)
    assertTrue(one.rejectedAssetIds.isEmpty())

    val multiple = OrionDownloadOwnershipPolicy.authorizeSelection(
      listOf(OrionDownloadManagementSelection("A", tokenA), OrionDownloadManagementSelection("C", tokenC)),
      current,
    )
    assertEquals(setOf("A", "C"), multiple.approvedAssetIds)
    assertFalse(multiple.approvedAssetIds.contains("B"))
  }

  @Test
  fun emptyUnknownAndChangedSelectionsFailClosed() {
    val current = mapOf("episode-1-library" to tokenA, "episode-1-device" to tokenB, "episode-2-library" to tokenC)
    assertTrue(OrionDownloadOwnershipPolicy.authorizeSelection(emptyList(), current).approvedAssetIds.isEmpty())

    val authorization = OrionDownloadOwnershipPolicy.authorizeSelection(
      listOf(
        OrionDownloadManagementSelection("unknown", tokenA),
        OrionDownloadManagementSelection("episode-1-library", tokenB),
        OrionDownloadManagementSelection("episode-1-device", tokenB),
      ),
      current,
    )
    assertEquals(setOf("episode-1-device"), authorization.approvedAssetIds)
    assertEquals(setOf("unknown", "episode-1-library"), authorization.rejectedAssetIds)
    assertFalse(authorization.approvedAssetIds.contains("episode-2-library"))
  }

  @Test
  fun conflictingOrMalformedTokensNeverBroadenSelection() {
    val current = mapOf("B" to tokenB)
    val authorization = OrionDownloadOwnershipPolicy.authorizeSelection(
      listOf(
        OrionDownloadManagementSelection("B", tokenB),
        OrionDownloadManagementSelection("B", tokenC),
        OrionDownloadManagementSelection("C", "not-a-token"),
      ),
      current,
    )
    assertTrue(authorization.approvedAssetIds.isEmpty())
    assertEquals(setOf("B", "C"), authorization.rejectedAssetIds)
  }
}
