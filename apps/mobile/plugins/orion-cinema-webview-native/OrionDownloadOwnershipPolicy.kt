package com.okali.orion.playback

import java.io.File

internal enum class OrionArtifactAvailability(val wire: String) {
  CHECKING("checking"),
  VERIFIED("verified"),
  MISSING("missing"),
  UNAVAILABLE("unavailable");

  companion object {
    fun fromWire(value: String): OrionArtifactAvailability = entries.firstOrNull { it.wire == value } ?: CHECKING
  }
}

internal data class OrionOwnedArtifactState(
  val assetId: String,
  val artifactId: String,
  val role: String,
  val availability: OrionArtifactAvailability,
  val observedBytes: Long?,
)

internal enum class OrionArtifactDeleteResult { DELETED, ALREADY_MISSING, UNAVAILABLE }

internal enum class OrionArtifactDeleteDisposition { DELETED, ALREADY_MISSING, UNAVAILABLE }

internal enum class OrionAssetManagementDisposition(val wire: String) {
  PHYSICALLY_DELETED("physically-deleted"),
  ALREADY_MISSING("already-missing"),
  REMOVED_FROM_ORION("removed-from-orion"),
  RETAINED_UNAVAILABLE("retained-unavailable"),
  RETAINED_FAILED("retained-failed"),
}

internal data class OrionArtifactDeleteDecision(
  val disposition: OrionArtifactDeleteDisposition,
  val reclaimedBytes: Long,
)

internal data class OrionDownloadManagementSelection(
  val assetId: String,
  val managementToken: String,
)

internal data class OrionDownloadSelectionAuthorization(
  val approvedAssetIds: Set<String>,
  val rejectedAssetIds: Set<String>,
)

/** Pure production policy shared by the store, reconciliation manager and JVM tests. */
internal object OrionDownloadOwnershipPolicy {
  private val activeDuplicateStates = setOf(
    "queued", "preflighting", "downloading", "paused", "recovering", "verifying", "finalizing",
    "storage-blocked", "action-required", "expired",
  )

  fun blocksDuplicate(jobState: String, primaryAvailability: OrionArtifactAvailability?): Boolean = when {
    jobState in activeDuplicateStates -> true
    jobState != "completed" -> false
    primaryAvailability == OrionArtifactAvailability.MISSING -> false
    else -> true
  }

  fun authorizeSelection(
    requested: Iterable<OrionDownloadManagementSelection>,
    currentTokens: Map<String, String>,
  ): OrionDownloadSelectionAuthorization {
    val approved = linkedSetOf<String>()
    val rejected = linkedSetOf<String>()
    val grouped = requested.filter { it.assetId.isNotBlank() }.groupBy { it.assetId }
    for ((assetId, selections) in grouped) {
      val requestedTokens = selections.map { it.managementToken }.toSet()
      val current = currentTokens[assetId]
      if (requestedTokens.size == 1 && requestedTokens.first().matches(Regex("^[a-f0-9]{64}$")) && current == requestedTokens.first()) {
        approved.add(assetId)
      } else {
        rejected.add(assetId)
      }
    }
    return OrionDownloadSelectionAuthorization(approved, rejected)
  }

  fun completed(primaryAvailability: OrionArtifactAvailability?): Boolean =
    primaryAvailability == OrionArtifactAvailability.VERIFIED

  fun classifyProbe(exists: Boolean, conclusiveMissing: Boolean, permissionAvailable: Boolean): OrionArtifactAvailability = when {
    exists -> OrionArtifactAvailability.VERIFIED
    conclusiveMissing -> OrionArtifactAvailability.MISSING
    !permissionAvailable -> OrionArtifactAvailability.UNAVAILABLE
    else -> OrionArtifactAvailability.UNAVAILABLE
  }

  fun decideArtifactDeletion(
    artifact: OrionOwnedArtifactState,
    deleteExact: () -> OrionArtifactDeleteResult,
  ): OrionArtifactDeleteDecision {
    if (artifact.availability == OrionArtifactAvailability.MISSING) {
      return OrionArtifactDeleteDecision(OrionArtifactDeleteDisposition.ALREADY_MISSING, 0L)
    }
    return when (deleteExact()) {
      OrionArtifactDeleteResult.DELETED -> OrionArtifactDeleteDecision(
        OrionArtifactDeleteDisposition.DELETED,
        if (artifact.availability == OrionArtifactAvailability.VERIFIED) artifact.observedBytes?.coerceAtLeast(0L) ?: 0L else 0L,
      )
      OrionArtifactDeleteResult.ALREADY_MISSING ->
        OrionArtifactDeleteDecision(OrionArtifactDeleteDisposition.ALREADY_MISSING, 0L)
      OrionArtifactDeleteResult.UNAVAILABLE ->
        OrionArtifactDeleteDecision(OrionArtifactDeleteDisposition.UNAVAILABLE, 0L)
    }
  }

  fun classifyDeleteFailure(conclusiveMissing: Boolean, accessUnavailable: Boolean): OrionArtifactDeleteResult =
    if (conclusiveMissing && !accessUnavailable) OrionArtifactDeleteResult.ALREADY_MISSING
    else OrionArtifactDeleteResult.UNAVAILABLE

  fun assetDeletionDisposition(decisions: Iterable<OrionArtifactDeleteDecision>): OrionAssetManagementDisposition {
    val values = decisions.toList()
    return when {
      values.isEmpty() -> OrionAssetManagementDisposition.RETAINED_FAILED
      values.any { it.disposition == OrionArtifactDeleteDisposition.UNAVAILABLE } -> OrionAssetManagementDisposition.RETAINED_UNAVAILABLE
      values.any { it.disposition == OrionArtifactDeleteDisposition.DELETED } -> OrionAssetManagementDisposition.PHYSICALLY_DELETED
      else -> OrionAssetManagementDisposition.ALREADY_MISSING
    }
  }

  fun canRemoveUnavailableRecord(primaryAvailability: OrionArtifactAvailability?): Boolean =
    primaryAvailability == OrionArtifactAvailability.UNAVAILABLE

  fun canRemoveAsset(dispositions: Iterable<OrionArtifactDeleteDisposition>): Boolean {
    val values = dispositions.toList()
    return values.isNotEmpty() && values.all { it != OrionArtifactDeleteDisposition.UNAVAILABLE }
  }

  fun storedBytes(artifacts: Iterable<OrionOwnedArtifactState>): Long = artifacts.fold(0L) { total, artifact ->
    if (artifact.availability == OrionArtifactAvailability.VERIFIED) safeAdd(total, artifact.observedBytes ?: 0L) else total
  }

  fun canonicalContained(root: File, target: File): Boolean = try {
    val canonicalRoot = root.canonicalFile
    val canonicalTarget = target.canonicalFile
    canonicalTarget == canonicalRoot || canonicalTarget.toPath().startsWith(canonicalRoot.toPath())
  } catch (_: Throwable) {
    false
  }

  private fun safeAdd(left: Long, right: Long): Long = when {
    right <= 0L -> left
    left > Long.MAX_VALUE - right -> Long.MAX_VALUE
    else -> left + right
  }
}
