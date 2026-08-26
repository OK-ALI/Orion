package com.okali.orion.playback

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Bounded native owner for reconciliation and ID-only download management. */
internal object OrionDownloadArtifactManager {
  private val reconciliationLock = Any()
  @Volatile private var reconciling = false

  fun reconcile(context: Context, assetIds: Set<String>? = null): JSONObject {
    synchronized(reconciliationLock) {
      if (reconciling) return OrionDownloadJobStore.snapshot()
      reconciling = true
    }
    return try {
      val assets = OrionDownloadJobStore.ownershipAssets(assetIds)
      val updates = JSONArray()
      val checkedAt = System.currentTimeMillis()
      for (assetIndex in 0 until assets.length()) {
        val asset = assets.optJSONObject(assetIndex) ?: continue
        val artifacts = asset.optJSONArray("_artifacts") ?: continue
        for (artifactIndex in 0 until artifacts.length()) {
          val artifact = artifacts.optJSONObject(artifactIndex) ?: continue
          val probe = probeArtifact(context, asset, artifact)
          updates.put(JSONObject()
            .put("artifactId", artifact.optString("artifactId"))
            .put("_locatorFingerprint", artifact.optJSONObject("_locator")?.toString() ?: "")
            .put("availability", probe.first.wire)
            .put("observedSizeBytes", probe.second ?: JSONObject.NULL)
            .put("lastCheckedAt", checkedAt))
        }
      }
      OrionDownloadJobStore.updateArtifactStates(updates)
      OrionDownloadJobStore.snapshot()
    } finally {
      synchronized(reconciliationLock) { reconciling = false }
    }
  }

  fun deleteSelected(context: Context, selections: List<OrionDownloadManagementSelection>): JSONObject {
    val ids = selections.map { it.assetId }.filter { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }.toSet()
    return deleteAssets(context, ids, expectedSelections = selections.filter { it.assetId in ids })
  }

  fun deleteAssets(
    context: Context,
    requestedIds: Set<String>,
    staleOnly: Boolean = false,
    expectedSelections: List<OrionDownloadManagementSelection>? = null,
  ): JSONObject {
    val ids = requestedIds.filter { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }.toSet()
    if (ids.isEmpty()) return result(ids)
    reconcile(context, ids)
    val currentAssets = OrionDownloadJobStore.ownershipAssets(ids)
    val currentTokens = linkedMapOf<String, String>()
    for (index in 0 until currentAssets.length()) {
      currentAssets.optJSONObject(index)?.let { asset ->
        asset.optString("assetId").takeIf { it.isNotBlank() }?.let { assetId ->
          currentTokens[assetId] = OrionDownloadJobStore.managementToken(asset)
        }
      }
    }
    val authorization = expectedSelections?.let { OrionDownloadOwnershipPolicy.authorizeSelection(it, currentTokens) }
    val authorizedIds = authorization?.approvedAssetIds ?: ids
    val assets = OrionDownloadJobStore.ownershipAssets(authorizedIds)
    val knownIds = linkedSetOf<String>()
    val retained = linkedSetOf<String>()
    val failures = JSONArray()
    val stateUpdates = JSONArray()
    val expectedOwnership = linkedMapOf<String, String>()
    val plannedDispositions = linkedMapOf<String, OrionAssetManagementDisposition>()
    val finalDispositions = linkedMapOf<String, OrionAssetManagementDisposition>()
    var reclaimed = 0L
    authorization?.rejectedAssetIds?.forEach { assetId ->
      knownIds.add(assetId)
      retained.add(assetId)
      finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
      val exists = currentTokens.containsKey(assetId)
      failures.put(failure(
        assetId,
        null,
        if (exists) "asset-selection-stale" else "asset-not-found",
        if (exists) "The selected download changed after confirmation. Orion kept it." else "Download record not found.",
      ))
    }
    for (assetIndex in 0 until assets.length()) {
      val asset = assets.optJSONObject(assetIndex) ?: continue
      val assetId = asset.optString("assetId")
      knownIds.add(assetId)
      val artifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
      val primary = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
      if (staleOnly && primary?.optString("availability") != "missing") {
        retained.add(assetId)
        finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        failures.put(failure(assetId, null, "artifact-not-missing", "Only a conclusively missing download can have its stale record removed."))
        continue
      }
      val decisions = mutableListOf<OrionArtifactDeleteDecision>()
      val ordered = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.sortedBy { if (it.optString("role") == "primary") 1 else 0 }
      for (artifact in ordered) {
        val artifactId = artifact.optString("artifactId")
        val state = OrionOwnedArtifactState(
          assetId = assetId,
          artifactId = artifactId,
          role = artifact.optString("role"),
          availability = OrionArtifactAvailability.fromWire(artifact.optString("availability")),
          observedBytes = if (artifact.isNull("observedSizeBytes")) null else artifact.optLong("observedSizeBytes").coerceAtLeast(0L),
        )
        val decision = OrionDownloadOwnershipPolicy.decideArtifactDeletion(state) { deleteArtifact(context, asset, artifact) }
        decisions.add(decision)
        reclaimed = safeAdd(reclaimed, decision.reclaimedBytes)
        if (decision.disposition != OrionArtifactDeleteDisposition.UNAVAILABLE) {
          stateUpdates.put(JSONObject()
            .put("artifactId", artifactId)
            .put("_locatorFingerprint", artifact.optJSONObject("_locator")?.toString() ?: "")
            .put("availability", "missing")
            .put("observedSizeBytes", JSONObject.NULL)
            .put("lastCheckedAt", System.currentTimeMillis()))
        } else {
          failures.put(failure(assetId, artifactId, "artifact-delete-unavailable", "Android could not confirm deletion of this exact Orion-owned artifact."))
        }
      }
      val disposition = OrionDownloadOwnershipPolicy.assetDeletionDisposition(decisions)
      if (OrionDownloadOwnershipPolicy.canRemoveAsset(decisions.map { it.disposition })) {
        expectedOwnership[assetId] = OrionDownloadJobStore.ownershipFingerprint(asset)
        plannedDispositions[assetId] = disposition
      } else {
        retained.add(assetId)
        finalDispositions[assetId] = disposition
      }
    }
    for (assetId in ids - knownIds) {
      retained.add(assetId)
      finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
      failures.put(failure(assetId, null, "asset-not-found", "Download record not found."))
    }
    val commit = OrionDownloadJobStore.applyArtifactManagement(stateUpdates, expectedOwnership)
    for ((assetId, disposition) in plannedDispositions) {
      if (commit.removedAssetIds.contains(assetId)) finalDispositions[assetId] = disposition
      else {
        retained.add(assetId)
        finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        failures.put(failure(assetId, null, "artifact-ownership-changed", "The tracked artifact changed while Android was handling it. Orion kept the record."))
      }
    }
    return result(ids, commit.removedAssetIds, retained, reclaimed, failures, outcomes(ids, finalDispositions))
  }

  fun removeUnavailableRecords(context: Context, requestedIds: Set<String>): JSONObject {
    val ids = requestedIds.filter { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }.toSet()
    if (ids.isEmpty()) return result(ids)
    reconcile(context, ids)
    val assets = OrionDownloadJobStore.ownershipAssets(ids)
    val knownIds = linkedSetOf<String>()
    val retained = linkedSetOf<String>()
    val failures = JSONArray()
    val expectedOwnership = linkedMapOf<String, String>()
    val dispositions = linkedMapOf<String, OrionAssetManagementDisposition>()
    for (assetIndex in 0 until assets.length()) {
      val asset = assets.optJSONObject(assetIndex) ?: continue
      val assetId = asset.optString("assetId")
      knownIds.add(assetId)
      val primary = ownedPrimary(asset)
      val availability = primary?.let { OrionArtifactAvailability.fromWire(it.optString("availability")) }
      if (OrionDownloadOwnershipPolicy.canRemoveUnavailableRecord(availability)) {
        expectedOwnership[assetId] = OrionDownloadJobStore.ownershipFingerprint(asset)
      } else {
        retained.add(assetId)
        dispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        val code = if (availability == OrionArtifactAvailability.MISSING) "artifact-is-missing" else "artifact-not-unavailable"
        val message = if (availability == OrionArtifactAvailability.MISSING) {
          "This artifact is conclusively missing. Use Delete to remove its stale record."
        } else {
          "Only an unavailable download can be removed from Orion without physical deletion."
        }
        failures.put(failure(assetId, primary?.optString("artifactId"), code, message))
      }
    }
    for (assetId in ids - knownIds) {
      retained.add(assetId)
      dispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
      failures.put(failure(assetId, null, "asset-not-found", "Download record not found."))
    }
    val commit = OrionDownloadJobStore.applyArtifactManagement(
      JSONArray(),
      expectedOwnership,
      OrionArtifactAvailability.UNAVAILABLE,
    )
    for (assetId in expectedOwnership.keys) {
      if (commit.removedAssetIds.contains(assetId)) dispositions[assetId] = OrionAssetManagementDisposition.REMOVED_FROM_ORION
      else {
        retained.add(assetId)
        dispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        failures.put(failure(assetId, null, "artifact-ownership-changed", "Artifact availability changed before Orion could remove the record."))
      }
    }
    return result(ids, commit.removedAssetIds, retained, 0L, failures, outcomes(ids, dispositions))
  }

  fun deleteAll(context: Context): JSONObject {
    val assets = OrionDownloadJobStore.ownershipAssets()
    val ids = linkedSetOf<String>()
    for (index in 0 until assets.length()) assets.optJSONObject(index)?.optString("assetId")?.takeIf { it.isNotBlank() }?.let(ids::add)
    return deleteAssets(context, ids)
  }

  fun open(context: Context, assetId: String, locate: Boolean): JSONObject {
    reconcile(context, setOf(assetId))
    val asset = OrionDownloadJobStore.ownershipAssets(setOf(assetId)).optJSONObject(0)
      ?: return actionResult(false, "asset-not-found", "Download not found.")
    val primary = ownedPrimary(asset) ?: return actionResult(false, "artifact-not-found", "Downloaded media is not tracked.")
    if (primary.optString("availability") != "verified") return actionResult(false, "artifact-not-verified", "This download is not currently available.")
    val locator = primary.optJSONObject("_locator") ?: return actionResult(false, "artifact-locator-missing", "This download cannot be opened.")
    if (locator.optString("kind") != "content-uri") return actionResult(false, "artifact-action-unsupported", "This download cannot be opened outside Orion.")
    val document = parseContentUri(locator.optString("value")) ?: return actionResult(false, "artifact-locator-invalid", "This download cannot be opened.")
    if (locate) {
      val targetId = asset.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
      val tree = OrionDownloadStorageRegistry.resolveTreeUri(context, targetId)
      if (tree != null && launch(context, tree, null)) return actionResult(true, null, null)
    }
    val mime = primary.optString("mimeType").takeIf { it.isNotBlank() && it != "null" } ?: asset.optString("mimeType", "video/mp4")
    return if (launch(context, document, mime)) actionResult(true, null, null)
    else actionResult(false, "artifact-action-unsupported", "No Android app can open this saved download.")
  }

  private fun probeArtifact(context: Context, asset: JSONObject, artifact: JSONObject): Pair<OrionArtifactAvailability, Long?> {
    val locator = artifact.optJSONObject("_locator") ?: return OrionArtifactAvailability.UNAVAILABLE to null
    return when (locator.optString("kind")) {
      "content-uri" -> when (val probe = OrionDownloadStorageRegistry.probeDocument(context, parseContentUri(locator.optString("value")) ?: return OrionArtifactAvailability.UNAVAILABLE to null)) {
        is OrionDownloadStorageRegistry.DocumentProbe.Verified -> OrionArtifactAvailability.VERIFIED to probe.sizeBytes
        OrionDownloadStorageRegistry.DocumentProbe.Missing -> OrionArtifactAvailability.MISSING to null
        OrionDownloadStorageRegistry.DocumentProbe.Unavailable -> OrionArtifactAvailability.UNAVAILABLE to null
      }
      "managed", "managed-relative" -> {
        val target = managedTarget(context, asset, artifact) ?: return OrionArtifactAvailability.UNAVAILABLE to null
        if (!target.exists()) OrionArtifactAvailability.MISSING to null
        else OrionArtifactAvailability.VERIFIED to managedSize(target, artifact.optString("role") == "primary")
      }
      else -> OrionArtifactAvailability.UNAVAILABLE to null
    }
  }

  private fun deleteArtifact(context: Context, asset: JSONObject, artifact: JSONObject): OrionArtifactDeleteResult {
    val locator = artifact.optJSONObject("_locator") ?: return OrionArtifactDeleteResult.UNAVAILABLE
    return when (locator.optString("kind")) {
      "content-uri" -> {
        val uri = parseContentUri(locator.optString("value")) ?: return OrionArtifactDeleteResult.UNAVAILABLE
        when (OrionDownloadStorageRegistry.deleteDocument(context, uri)) {
          OrionDownloadStorageRegistry.DocumentDeleteResult.Deleted -> OrionArtifactDeleteResult.DELETED
          OrionDownloadStorageRegistry.DocumentDeleteResult.AlreadyMissing -> OrionArtifactDeleteResult.ALREADY_MISSING
          OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> OrionArtifactDeleteResult.UNAVAILABLE
        }
      }
      "managed", "managed-relative" -> {
        val target = managedTarget(context, asset, artifact) ?: return OrionArtifactDeleteResult.UNAVAILABLE
        if (!target.exists()) OrionArtifactDeleteResult.ALREADY_MISSING
        else {
          val deleted = if (target.isDirectory) target.deleteRecursively() else target.delete()
          when {
            deleted -> OrionArtifactDeleteResult.DELETED
            !target.exists() -> OrionArtifactDeleteResult.ALREADY_MISSING
            else -> OrionArtifactDeleteResult.UNAVAILABLE
          }
        }
      }
      else -> OrionArtifactDeleteResult.UNAVAILABLE
    }
  }

  private fun managedTarget(context: Context, asset: JSONObject, artifact: JSONObject): File? {
    val root = File(context.filesDir, "orion-downloads/library")
    val locator = artifact.optJSONObject("_locator") ?: return null
    val raw = locator.optString("value")
    val relative = when (locator.optString("kind")) {
      "managed-relative" -> raw
      "managed" -> {
        val jobId = asset.optString("jobId").takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,120}$")) } ?: return null
        if (File(root, "$jobId.fragments").exists()) "$jobId.fragments" else "$jobId.mp4"
      }
      else -> return null
    }
    if (relative.isBlank() || File(relative).isAbsolute) return null
    val target = File(root, relative)
    return target.takeIf { OrionDownloadOwnershipPolicy.canonicalContained(root, it) }
  }

  private fun managedSize(target: File, primary: Boolean): Long {
    if (target.isFile) return target.length().coerceAtLeast(0L)
    val files = target.listFiles() ?: return 0L
    return files.fold(0L) { total, file ->
      if (file.isFile || !primary) safeAdd(total, if (file.isFile) file.length().coerceAtLeast(0L) else directorySize(file)) else total
    }
  }

  private fun directorySize(directory: File): Long = (directory.listFiles() ?: emptyArray()).fold(0L) { total, file ->
    safeAdd(total, if (file.isDirectory) directorySize(file) else file.length().coerceAtLeast(0L))
  }

  private fun ownedPrimary(asset: JSONObject): JSONObject? {
    val artifacts = asset.optJSONArray("_artifacts") ?: return null
    return (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
  }

  private fun launch(context: Context, uri: Uri, mimeType: String?): Boolean = try {
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, mimeType)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    if (intent.resolveActivity(context.packageManager) == null) false else {
      context.startActivity(intent)
      true
    }
  } catch (_: Throwable) { false }

  private fun parseContentUri(value: String): Uri? = try { Uri.parse(value).takeIf { it.scheme == "content" } } catch (_: Throwable) { null }

  private fun failure(assetId: String, artifactId: String?, code: String, message: String) = JSONObject()
    .put("assetId", assetId)
    .put("artifactId", artifactId ?: JSONObject.NULL)
    .put("code", code)
    .put("message", message)

  private fun result(
    requested: Set<String>,
    removed: Set<String> = emptySet(),
    retained: Set<String> = emptySet(),
    reclaimed: Long = 0L,
    failures: JSONArray = JSONArray(),
    outcomes: JSONArray = JSONArray(),
  ) = JSONObject()
    .put("schemaVersion", 1)
    .put("requestedAssetIds", JSONArray(requested.toList()))
    .put("deletedAssetIds", JSONArray(removed.toList()))
    .put("retainedAssetIds", JSONArray(retained.toList()))
    .put("reclaimedBytes", reclaimed)
    .put("failures", failures)
    .put("outcomes", outcomes)

  private fun outcomes(
    requested: Set<String>,
    dispositions: Map<String, OrionAssetManagementDisposition>,
  ): JSONArray {
    val output = JSONArray()
    for (assetId in requested) {
      val disposition = dispositions[assetId] ?: continue
      output.put(JSONObject().put("assetId", assetId).put("disposition", disposition.wire))
    }
    return output
  }

  private fun actionResult(ok: Boolean, code: String?, message: String?) = JSONObject()
    .put("ok", ok)
    .put("code", code ?: JSONObject.NULL)
    .put("message", message ?: JSONObject.NULL)

  private fun safeAdd(left: Long, right: Long): Long = if (right <= 0L) left else if (left > Long.MAX_VALUE - right) Long.MAX_VALUE else left + right
}
