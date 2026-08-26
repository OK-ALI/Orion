package com.okali.orion.playback

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

internal object OrionDownloadJobStore {
  private const val PREFS = "orion_download_jobs_v1"
  private const val KEY_STATE = "state"
  private val listeners = linkedSetOf<(JSONObject) -> Unit>()
  private var appContext: Context? = null

  internal data class ArtifactManagementCommit(
    val removedAssetIds: Set<String>,
    val rejectedAssetIds: Set<String>,
  )

  @Synchronized
  fun initialize(context: Context) {
    appContext = context.applicationContext
    val state = readStateLocked()
    if (state.optInt("schemaVersion", 0) != 1) persistLocked(emptyState())
    else {
      var changed = migrateOwnedArtifactsLocked(state)
      val retiredDirectJobs = retireDirectExperimentalArtifactsLocked(state)
      if (retiredDirectJobs.isNotEmpty()) {
        changed = true
        deleteRetiredDirectFilesLocked(context.applicationContext, retiredDirectJobs)
      }
      if (changed) persistLocked(state)
    }
  }

  @Synchronized
  fun addListener(listener: (JSONObject) -> Unit) {
    listeners.add(listener)
  }

  @Synchronized
  fun removeListener(listener: (JSONObject) -> Unit) {
    listeners.remove(listener)
  }

  @Synchronized
  fun snapshot(): JSONObject = publicSnapshotLocked(readStateLocked())

  @Synchronized
  fun getJob(jobId: String): JSONObject? {
    val state = readStateLocked()
    migrateOwnedArtifactsLocked(state)
    val jobs = state.getJSONArray("jobs")
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("jobId") == jobId) return JSONObject(job.toString())
    }
    return null
  }

  @Synchronized
  fun createJob(payload: JSONObject, transfer: BoundTransferContext): JSONObject? {
    val input = payload.optJSONObject("job") ?: return null
    val jobId = cleanId(input.optString("jobId")) ?: return null
    val candidateId = cleanId(input.optString("candidateId")) ?: return null
    if (candidateId != transfer.candidateId || jobId != transfer.jobId) return null
    val media = sanitizeMedia(input.optJSONObject("media")) ?: return null
    val destination = input.optString("destination")
    if (destination != "orion-library" && destination != "device-storage") return null
    val storageTarget = sanitizeStorageTarget(input.optJSONObject("storageTarget"), destination) ?: return null
    val quality = input.optString("requestedQuality").takeIf { it in setOf("best", "1080p", "720p", "480p") } ?: "best"
    val subtitles = sanitizeStringArray(input.optJSONArray("selectedSubtitleAssetIds"))
    val groupKey = cleanText(payload.optString("groupKey"), 140) ?: mediaGroupKey(media)
    val itemKey = cleanText(payload.optString("itemKey"), 180) ?: mediaItemKey(media)
    val now = System.currentTimeMillis()

    val safe = JSONObject()
      .put("schemaVersion", 1)
      .put("jobId", jobId)
      .put("candidateId", candidateId)
      .put("media", media)
      .put("destination", destination)
      .put("storageTarget", storageTarget)
      .put("requestedQuality", quality)
      .put("selectedSubtitleAssetIds", subtitles)
      .put("state", "queued")
      .put("progress", emptyProgress())
      .put("retryCount", 0)
      .put("recoveryCount", 0)
      .put("failure", JSONObject.NULL)
      .put("createdAt", now)
      .put("updatedAt", now)
      .put("startedAt", JSONObject.NULL)
      .put("completedAt", JSONObject.NULL)
      .put("_groupKey", groupKey)
      .put("_itemKey", itemKey)
      .put("_sourceId", transfer.sourceId.take(60))
      .put("_transferKind", transfer.transferKind)
      .put("_resumable", transfer.resumable)
      .put("_expectedBytes", transfer.requiredBytes ?: JSONObject.NULL)
      .put("_control", "run")
      .put("_executionGeneration", 0L)

    val state = readStateLocked()
    migrateOwnedArtifactsLocked(state)
    val jobs = state.getJSONArray("jobs")
    for (index in 0 until jobs.length()) {
      val current = jobs.optJSONObject(index) ?: continue
      if (current.optString("jobId") == jobId) continue
      if (current.optString("_itemKey") != itemKey || current.optString("destination") != destination) continue
      val availability = primaryAvailabilityForJobLocked(state, current.optString("jobId"))
      if (OrionDownloadOwnershipPolicy.blocksDuplicate(current.optString("state"), availability)) return null
    }
    val next = JSONArray().put(safe)
    for (index in 0 until jobs.length()) {
      val current = jobs.optJSONObject(index) ?: continue
      if (current.optString("jobId") != jobId) next.put(current)
    }
    state.put("jobs", next)
    persistAndNotifyLocked(state)
    return publicJob(safe)
  }

  @Synchronized
  fun setState(jobId: String, stateName: String, failure: JSONObject? = null) {
    mutateJobLocked(jobId) { job ->
      val now = System.currentTimeMillis()
      job.put("state", stateName)
      job.put("updatedAt", now)
      if (stateName == "downloading" && job.isNull("startedAt")) job.put("startedAt", now)
      if (stateName == "completed") job.put("completedAt", now)
      if (failure == null) job.put("failure", JSONObject.NULL) else job.put("failure", sanitizeFailure(failure) ?: JSONObject.NULL)
      val progress = job.optJSONObject("progress") ?: emptyProgress()
      if (stateName != "finalizing") {
        progress.put("finalizationStage", JSONObject.NULL)
        progress.put("finalizationStageStartedAt", JSONObject.NULL)
      }
      if (stateName == "completed") progress.put("percent", 100)
      job.put("progress", progress)
    }
  }

  @Synchronized
  fun setProgress(
    jobId: String,
    bytesDownloaded: Long,
    totalBytes: Long?,
    completedFragments: Int?,
    totalFragments: Int?,
    bytesPerSecond: Long?,
    etaSeconds: Long?,
  ) {
    mutateJobLocked(jobId, notify = true) { job ->
      val complete = job.optString("state") == "completed"
      val percent = when {
        complete -> 100.0
        totalBytes != null && totalBytes > 0L -> (bytesDownloaded.toDouble() * 100.0 / totalBytes.toDouble()).coerceIn(0.0, 99.0)
        totalFragments != null && totalFragments > 0 && completedFragments != null -> (completedFragments.toDouble() * 100.0 / totalFragments.toDouble()).coerceIn(0.0, 99.0)
        else -> Double.NaN
      }
      val previousProgress = job.optJSONObject("progress")
      val previousStage = previousProgress?.opt("finalizationStage") ?: JSONObject.NULL
      val previousStageStartedAt = previousProgress?.opt("finalizationStageStartedAt") ?: JSONObject.NULL
      val progress = JSONObject()
        .put("bytesDownloaded", bytesDownloaded.coerceAtLeast(0L))
        .put("totalBytes", totalBytes ?: JSONObject.NULL)
        .put("completedFragments", completedFragments ?: JSONObject.NULL)
        .put("totalFragments", totalFragments ?: JSONObject.NULL)
        .put("percent", if (percent.isNaN()) JSONObject.NULL else percent)
        .put("bytesPerSecond", bytesPerSecond ?: JSONObject.NULL)
        .put("etaSeconds", etaSeconds ?: JSONObject.NULL)
        .put("finalizationStage", previousStage)
        .put("finalizationStageStartedAt", previousStageStartedAt)
      job.put("progress", progress)
      job.put("updatedAt", System.currentTimeMillis())
    }
  }

  @Synchronized
  fun setFinalizationStage(jobId: String, stage: String, expectedGeneration: Long? = null) {
    if (stage !in FINALIZATION_STAGES) return
    mutateJobLocked(jobId, notify = true) { job ->
      if (job.optString("state") != "finalizing" || job.optString("_control") == "cancel") return@mutateJobLocked
      if (expectedGeneration != null && job.optLong("_executionGeneration", 0L) != expectedGeneration) return@mutateJobLocked
      val progress = job.optJSONObject("progress") ?: emptyProgress()
      val now = System.currentTimeMillis()
      if (progress.optString("finalizationStage") != stage || progress.isNull("finalizationStageStartedAt")) {
        progress.put("finalizationStageStartedAt", now)
      }
      progress.put("finalizationStage", stage)
      progress.put("bytesPerSecond", JSONObject.NULL)
      progress.put("etaSeconds", JSONObject.NULL)
      job.put("progress", progress)
      job.put("updatedAt", now)
    }
  }

  @Synchronized
  fun requestControl(jobId: String, control: String) {
    mutateJobLocked(jobId) { job ->
      job.put("_control", control)
      job.put("updatedAt", System.currentTimeMillis())
    }
  }

  @Synchronized
  fun clearControl(jobId: String) {
    mutateJobLocked(jobId, notify = false) { job ->
      if (job.optString("state") != "cancelled") job.put("_control", "run")
    }
  }

  @Synchronized
  fun control(jobId: String): String = getJob(jobId)?.optString("_control", "run") ?: "cancel"

  @Synchronized
  fun setFinalizationPlan(jobId: String, kind: String, roles: List<String>) {
    if (kind !in setOf("hls", "dash") || roles.isEmpty() || roles.size > 20_000) return
    val safeRoles = JSONArray()
    roles.forEach { role ->
      val safe = cleanText(role, 24) ?: return@forEach
      safeRoles.put(safe)
    }
    if (safeRoles.length() != roles.size) return
    mutateJobLocked(jobId, notify = false) { job ->
      val current = job.optJSONObject("_finalizationPlan")
      if (current?.optBoolean("sealed", false) == true && current.optInt("fragmentCount") == roles.size) return@mutateJobLocked
      job.put("_finalizationPlan", JSONObject()
        .put("schemaVersion", 1)
        .put("kind", kind)
        .put("fragmentCount", safeRoles.length())
        .put("roles", safeRoles)
        .put("sealed", false)
        .put("fragments", JSONArray())
        .put("subtitles", JSONArray()))
    }
  }

  @Synchronized
  fun sealFinalizationPlan(
    jobId: String,
    kind: String,
    proofs: List<OrionLocalArtifactProof>,
    subtitleProofs: List<OrionLocalArtifactProof>,
  ) {
    if (kind !in setOf("hls", "dash") || proofs.isEmpty() || proofs.size > 20_000) return
    val fragments = JSONArray()
    proofs.sortedBy { it.index }.forEach { proof ->
      fragments.put(JSONObject()
        .put("index", proof.index)
        .put("role", proof.role.take(24))
        .put("sizeBytes", proof.sizeBytes)
        .put("sha256", proof.sha256))
    }
    val subtitles = JSONArray()
    subtitleProofs.sortedBy { it.index }.forEach { proof ->
      subtitles.put(JSONObject()
        .put("index", proof.index)
        .put("role", proof.role.take(24))
        .put("sizeBytes", proof.sizeBytes)
        .put("sha256", proof.sha256))
    }
    mutateJobLocked(jobId, notify = false) { job ->
      val roles = JSONArray()
      proofs.sortedBy { it.index }.forEach { roles.put(it.role.take(24)) }
      job.put("_finalizationPlan", JSONObject()
        .put("schemaVersion", 1)
        .put("kind", kind)
        .put("fragmentCount", proofs.size)
        .put("roles", roles)
        .put("sealed", true)
        .put("sealedAt", System.currentTimeMillis())
        .put("fragments", fragments)
        .put("subtitles", subtitles))
    }
  }

  @Synchronized
  fun finalizationPlan(jobId: String): JSONObject? = getJob(jobId)?.optJSONObject("_finalizationPlan")?.let { JSONObject(it.toString()) }

  @Synchronized
  fun executionGeneration(jobId: String): Long? {
    val job = getJob(jobId) ?: return null
    if (job.optString("state") in setOf("cancelled", "completed")) return null
    return job.optLong("_executionGeneration", 0L)
  }

  @Synchronized
  fun cancelAndFence(jobId: String): Long? {
    val state = readStateLocked()
    val jobs = state.optJSONArray("jobs") ?: return null
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("jobId") != jobId) continue
      if (job.optString("state") == "completed") return null
      if (job.optString("state") == "cancelled") return job.optLong("_executionGeneration", 0L)
      val generation = job.optLong("_executionGeneration", 0L) + 1L
      job.put("_executionGeneration", generation)
      job.put("_control", "cancel")
      job.put("state", "cancelled")
      job.put("failure", JSONObject.NULL)
      job.put("updatedAt", System.currentTimeMillis())
      val progress = job.optJSONObject("progress") ?: emptyProgress()
      progress.put("finalizationStage", JSONObject.NULL)
      progress.put("finalizationStageStartedAt", JSONObject.NULL)
      job.put("progress", progress)
      job.remove("_finalizationPlan")
      persistAndNotifyLocked(state)
      return generation
    }
    return null
  }

  @Synchronized
  fun ownershipAssets(assetIds: Set<String>? = null): JSONArray {
    val state = readStateLocked()
    migrateOwnedArtifactsLocked(state)
    val output = JSONArray()
    val assets = state.optJSONArray("assets") ?: JSONArray()
    for (index in 0 until assets.length()) {
      val asset = assets.optJSONObject(index) ?: continue
      if (assetIds != null && !assetIds.contains(asset.optString("assetId"))) continue
      output.put(JSONObject(asset.toString()))
    }
    return output
  }

  @Synchronized
  fun updateArtifactStates(updates: JSONArray) {
    if (updates.length() == 0) return
    val state = readStateLocked()
    val assets = state.optJSONArray("assets") ?: JSONArray()
    val byId = linkedMapOf<String, JSONObject>()
    for (index in 0 until updates.length()) {
      val update = updates.optJSONObject(index) ?: continue
      val id = cleanId(update.optString("artifactId")) ?: continue
      byId[id] = update
    }
    if (byId.isEmpty()) return
    var changed = false
    for (assetIndex in 0 until assets.length()) {
      val asset = assets.optJSONObject(assetIndex) ?: continue
      val artifacts = asset.optJSONArray("_artifacts") ?: continue
      for (artifactIndex in 0 until artifacts.length()) {
        val artifact = artifacts.optJSONObject(artifactIndex) ?: continue
        val update = byId[artifact.optString("artifactId")] ?: continue
        val fingerprint = update.optString("_locatorFingerprint")
        if (fingerprint.isNotEmpty() && artifact.optJSONObject("_locator")?.toString() != fingerprint) continue
        val availability = update.optString("availability").takeIf { it in ARTIFACT_AVAILABILITY } ?: continue
        artifact.put("availability", availability)
        artifact.put("observedSizeBytes", if (update.isNull("observedSizeBytes")) JSONObject.NULL else update.optLong("observedSizeBytes").coerceAtLeast(0L))
        artifact.put("lastCheckedAt", update.optLong("lastCheckedAt", System.currentTimeMillis()))
        changed = true
      }
    }
    if (changed) persistAndNotifyLocked(state)
  }

  fun ownershipFingerprint(asset: JSONObject): String {
    val artifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
    val parts = mutableListOf<String>()
    for (index in 0 until artifacts.length()) {
      val artifact = artifacts.optJSONObject(index) ?: continue
      parts.add(listOf(
        artifact.optString("artifactId"),
        artifact.optString("role"),
        artifact.optJSONObject("_locator")?.toString().orEmpty(),
      ).joinToString(":"))
    }
    return listOf(
      asset.optString("assetId"),
      asset.optString("jobId"),
      asset.optString("destination"),
      parts.sorted().joinToString("|"),
    ).joinToString("|")
  }

  fun managementToken(asset: JSONObject): String = MessageDigest.getInstance("SHA-256")
    .digest(ownershipFingerprint(asset).toByteArray(Charsets.UTF_8))
    .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

  @Synchronized
  fun applyArtifactManagement(
    updates: JSONArray,
    expectedOwnership: Map<String, String>,
    requiredPrimaryAvailability: OrionArtifactAvailability? = null,
  ): ArtifactManagementCommit {
    if (updates.length() == 0 && expectedOwnership.isEmpty()) {
      return ArtifactManagementCommit(emptySet(), emptySet())
    }
    val state = readStateLocked()
    migrateOwnedArtifactsLocked(state)
    val assets = state.optJSONArray("assets") ?: JSONArray()
    val updatesById = linkedMapOf<String, JSONObject>()
    for (index in 0 until updates.length()) {
      val update = updates.optJSONObject(index) ?: continue
      cleanId(update.optString("artifactId"))?.let { updatesById[it] = update }
    }
    var changed = false
    for (assetIndex in 0 until assets.length()) {
      val artifacts = assets.optJSONObject(assetIndex)?.optJSONArray("_artifacts") ?: continue
      for (artifactIndex in 0 until artifacts.length()) {
        val artifact = artifacts.optJSONObject(artifactIndex) ?: continue
        val update = updatesById[artifact.optString("artifactId")] ?: continue
        val fingerprint = update.optString("_locatorFingerprint")
        if (fingerprint.isNotEmpty() && artifact.optJSONObject("_locator")?.toString() != fingerprint) continue
        val availability = update.optString("availability").takeIf { it in ARTIFACT_AVAILABILITY } ?: continue
        artifact.put("availability", availability)
        artifact.put("observedSizeBytes", if (update.isNull("observedSizeBytes")) JSONObject.NULL else update.optLong("observedSizeBytes").coerceAtLeast(0L))
        artifact.put("lastCheckedAt", update.optLong("lastCheckedAt", System.currentTimeMillis()))
        changed = true
      }
    }

    val approved = linkedSetOf<String>()
    val rejected = linkedSetOf<String>()
    for ((assetId, fingerprint) in expectedOwnership) {
      val asset = (0 until assets.length()).mapNotNull { assets.optJSONObject(it) }.firstOrNull { it.optString("assetId") == assetId }
      if (asset == null || ownershipFingerprint(asset) != fingerprint) {
        rejected.add(assetId)
        continue
      }
      if (requiredPrimaryAvailability != null) {
        val artifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
        val primary = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
        if (OrionArtifactAvailability.fromWire(primary?.optString("availability").orEmpty()) != requiredPrimaryAvailability) {
          rejected.add(assetId)
          continue
        }
      }
      approved.add(assetId)
    }

    if (approved.isNotEmpty()) {
      val removedJobs = linkedSetOf<String>()
      val keptAssets = JSONArray()
      for (index in 0 until assets.length()) {
        val asset = assets.optJSONObject(index) ?: continue
        if (approved.contains(asset.optString("assetId"))) removedJobs.add(asset.optString("jobId")) else keptAssets.put(asset)
      }
      val keptJobs = JSONArray()
      val jobs = state.optJSONArray("jobs") ?: JSONArray()
      for (index in 0 until jobs.length()) {
        val job = jobs.optJSONObject(index) ?: continue
        if (!removedJobs.contains(job.optString("jobId"))) keptJobs.put(job)
      }
      state.put("assets", keptAssets)
      state.put("jobs", keptJobs)
      state.put("offlineEntries", removeAssetsFromOfflineEntries(state.optJSONArray("offlineEntries") ?: JSONArray(), approved, keptAssets))
      changed = true
    }
    if (changed) persistAndNotifyLocked(state)
    return ArtifactManagementCommit(approved, rejected)
  }

  @Synchronized
  fun removeAssets(assetIds: Set<String>) {
    if (assetIds.isEmpty()) return
    val state = readStateLocked()
    val assets = state.optJSONArray("assets") ?: JSONArray()
    val removedJobs = linkedSetOf<String>()
    val keptAssets = JSONArray()
    for (index in 0 until assets.length()) {
      val asset = assets.optJSONObject(index) ?: continue
      if (assetIds.contains(asset.optString("assetId"))) removedJobs.add(asset.optString("jobId")) else keptAssets.put(asset)
    }
    if (removedJobs.isEmpty()) return
    val keptJobs = JSONArray()
    val jobs = state.optJSONArray("jobs") ?: JSONArray()
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (!removedJobs.contains(job.optString("jobId"))) keptJobs.put(job)
    }
    state.put("assets", keptAssets)
    state.put("jobs", keptJobs)
    state.put("offlineEntries", removeAssetsFromOfflineEntries(state.optJSONArray("offlineEntries") ?: JSONArray(), assetIds, keptAssets))
    persistAndNotifyLocked(state)
  }

  @Synchronized
  fun blockingDuplicate(itemKey: String, destination: String): JSONObject? {
    val state = readStateLocked()
    migrateOwnedArtifactsLocked(state)
    val jobs = state.optJSONArray("jobs") ?: JSONArray()
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("_itemKey") != itemKey || job.optString("destination") != destination) continue
      val availability = primaryAvailabilityForJobLocked(state, job.optString("jobId"))
      if (OrionDownloadOwnershipPolicy.blocksDuplicate(job.optString("state"), availability)) {
        return publicJob(job)
      }
    }
    return null
  }

  @Synchronized
  fun hasActiveJobs(excludingJobId: String? = null): Boolean {
    val jobs = readStateLocked().optJSONArray("jobs") ?: JSONArray()
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (excludingJobId != null && job.optString("jobId") == excludingJobId) continue
      if (job.optString("state") in ACTIVE_EXECUTION_STATES) return true
    }
    return false
  }

  @Synchronized
  fun incrementRetry(jobId: String) {
    mutateJobLocked(jobId) { job ->
      job.put("retryCount", job.optInt("retryCount", 0) + 1)
      job.put("updatedAt", System.currentTimeMillis())
    }
  }

  @Synchronized
  fun markRecovering(jobId: String, code: String, message: String) {
    mutateJobLocked(jobId) { job ->
      job.put("state", "recovering")
      job.put("recoveryCount", job.optInt("recoveryCount", 0) + 1)
      job.put("failure", failure(code, message, retryable = true, actionRequired = false))
      job.put("updatedAt", System.currentTimeMillis())
    }
  }

  @Synchronized
  fun markActionRequired(jobId: String, code: String, message: String) {
    setState(jobId, "action-required", failure(code, message, retryable = true, actionRequired = true))
  }

  @Synchronized
  fun markStorageBlocked(jobId: String, message: String) {
    setState(jobId, "storage-blocked", failure("storage-insufficient", message, retryable = true, actionRequired = true))
  }

  @Synchronized
  fun markFailed(jobId: String, code: String, message: String, retryable: Boolean) {
    setState(jobId, "failed", failure(code, message, retryable = retryable, actionRequired = false))
  }

  @Synchronized
  fun markCancelled(jobId: String) {
    cancelAndFence(jobId)
  }

  @Synchronized
  fun markCompleted(jobId: String, expectedGeneration: Long, asset: JSONObject, offlineEntry: JSONObject): Boolean {
    val state = readStateLocked()
    val jobs = state.getJSONArray("jobs")
    var committed = false
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("jobId") != jobId) continue
      if (!OrionDownloadExecutionFence.canCommit(
          expectedGeneration,
          job.optLong("_executionGeneration", 0L),
          job.optString("state"),
          job.optString("_control", "run"),
        )) return false
      job.put("state", "completed")
      job.put("failure", JSONObject.NULL)
      job.put("completedAt", System.currentTimeMillis())
      job.put("updatedAt", System.currentTimeMillis())
      val progress = job.optJSONObject("progress") ?: emptyProgress()
      progress.put("percent", 100)
      progress.put("finalizationStage", JSONObject.NULL)
      progress.put("finalizationStageStartedAt", JSONObject.NULL)
      job.put("progress", progress)
      job.put("_control", "run")
      job.remove("_finalizationPlan")
      committed = true
      break
    }
    if (!committed) return false
    ensureOwnedArtifactsLocked(asset)
    state.put("assets", upsertById(state.getJSONArray("assets"), asset, "assetId"))
    state.put("offlineEntries", mergeOfflineEntry(state.getJSONArray("offlineEntries"), offlineEntry))
    persistAndNotifyLocked(state)
    return true
  }

  @Synchronized
  fun publicJob(jobId: String): JSONObject? = getJob(jobId)?.let(::publicJob)

  private fun mutateJobLocked(jobId: String, notify: Boolean = true, block: (JSONObject) -> Unit) {
    val state = readStateLocked()
    val jobs = state.getJSONArray("jobs")
    var changed = false
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("jobId") != jobId) continue
      block(job)
      changed = true
      break
    }
    if (!changed) return
    if (notify) persistAndNotifyLocked(state) else persistLocked(state)
  }

  private fun readStateLocked(): JSONObject {
    val context = appContext ?: return emptyState()
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, null)
    return try {
      val parsed = if (raw.isNullOrBlank()) emptyState() else JSONObject(raw)
      if (parsed.optInt("schemaVersion", 0) == 1) parsed else emptyState()
    } catch (_: Throwable) {
      emptyState()
    }
  }

  private fun persistLocked(state: JSONObject) {
    val context = appContext ?: return
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_STATE, state.toString()).apply()
  }

  private fun persistAndNotifyLocked(state: JSONObject) {
    persistLocked(state)
    val snapshot = publicSnapshotLocked(state)
    listeners.toList().forEach { listener ->
      try { listener(JSONObject(snapshot.toString())) } catch (_: Throwable) {}
    }
  }

  private fun publicSnapshotLocked(state: JSONObject): JSONObject {
    migrateOwnedArtifactsLocked(state)
    val jobs = JSONArray()
    val sourceJobs = state.optJSONArray("jobs") ?: JSONArray()
    for (index in 0 until sourceJobs.length()) sourceJobs.optJSONObject(index)?.let { jobs.put(publicJob(it)) }
    val assets = JSONArray()
    val sourceAssets = state.optJSONArray("assets") ?: JSONArray()
    for (index in 0 until sourceAssets.length()) sourceAssets.optJSONObject(index)?.let { assets.put(publicAsset(it)) }
    return JSONObject()
      .put("schemaVersion", 1)
      .put("jobs", jobs)
      .put("assets", assets)
      .put("offlineEntries", JSONArray((state.optJSONArray("offlineEntries") ?: JSONArray()).toString()))
      .put("updatedAt", System.currentTimeMillis())
  }

  private fun publicJob(job: JSONObject): JSONObject {
    val copy = JSONObject(job.toString())
    val remove = mutableListOf<String>()
    val keys = copy.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      if (key.startsWith("_")) remove.add(key)
    }
    remove.forEach(copy::remove)
    return copy
  }

  private fun publicAsset(asset: JSONObject): JSONObject {
    val copy = JSONObject(asset.toString())
    val assetId = copy.optString("assetId")
    val artifacts = copy.optJSONArray("_artifacts") ?: JSONArray()
    val publicArtifacts = JSONArray()
    var primaryAvailability = "checking"
    var verifiedBytes = 0L
    var canOpen = false
    var canLocate = false
    for (index in 0 until artifacts.length()) {
      val artifact = artifacts.optJSONObject(index) ?: continue
      val role = artifact.optString("role").takeIf { it == "primary" || it == "subtitle" } ?: continue
      val availability = artifact.optString("availability").takeIf { it in ARTIFACT_AVAILABILITY } ?: "checking"
      val locatorKind = artifact.optJSONObject("_locator")?.optString("kind").orEmpty()
      val observed = if (artifact.isNull("observedSizeBytes")) null else artifact.optLong("observedSizeBytes").coerceAtLeast(0L)
      if (availability == "verified" && observed != null) verifiedBytes = safeAddBytes(verifiedBytes, observed)
      val open = role == "primary" && availability == "verified" && locatorKind == "content-uri"
      val locate = role == "primary" && availability == "verified" && locatorKind == "content-uri" &&
        !asset.optJSONObject("storageTarget")?.optString("targetId").isNullOrBlank()
      if (role == "primary") {
        primaryAvailability = availability
        canOpen = open
        canLocate = locate
      }
      publicArtifacts.put(JSONObject()
        .put("schemaVersion", 1)
        .put("artifactId", artifact.optString("artifactId"))
        .put("role", role)
        .put("displayName", artifact.optString("displayName", if (role == "primary") "Downloaded media" else "Subtitle"))
        .put("mimeType", if (artifact.isNull("mimeType")) JSONObject.NULL else artifact.opt("mimeType"))
        .put("expectedSizeBytes", if (artifact.isNull("expectedSizeBytes")) JSONObject.NULL else artifact.optLong("expectedSizeBytes").coerceAtLeast(0L))
        .put("observedSizeBytes", observed ?: JSONObject.NULL)
        .put("availability", availability)
        .put("lastCheckedAt", if (artifact.isNull("lastCheckedAt")) JSONObject.NULL else artifact.optLong("lastCheckedAt"))
        .put("actions", JSONObject().put("open", open).put("locate", locate).put("delete", true)))
    }
    val privateKeys = mutableListOf<String>()
    val keys = copy.keys()
    while (keys.hasNext()) keys.next().takeIf { it.startsWith("_") }?.let(privateKeys::add)
    privateKeys.forEach(copy::remove)
    copy.put("locator", JSONObject().put("kind", "native-owned").put("value", assetId))
    copy.put("managementToken", managementToken(asset))
    copy.put("availability", primaryAvailability)
    copy.put("verifiedSizeBytes", verifiedBytes)
    copy.put("artifacts", publicArtifacts)
    copy.put("actions", JSONObject().put("open", canOpen).put("locate", canLocate).put("delete", true))
    return copy
  }

  private fun sanitizeMedia(input: JSONObject?): JSONObject? {
    input ?: return null
    if (input.optInt("schemaVersion", 0) != 1) return null
    val id: Any = when (val value = input.opt("id")) {
      is Number -> value
      is String -> value.takeIf { it.isNotBlank() } ?: return null
      else -> return null
    }
    val mediaType = input.optString("mediaType").takeIf { it == "movie" || it == "tv" } ?: return null
    val title = cleanText(input.optString("title"), 160) ?: return null
    val libraryKind = input.optString("libraryKind").takeIf { it in setOf("movie", "series", "anime") } ?: return null
    return JSONObject()
      .put("schemaVersion", 1)
      .put("id", id)
      .put("mediaType", mediaType)
      .put("title", title)
      .put("year", nullableNonNegative(input.opt("year")))
      .put("season", nullableNonNegative(input.opt("season")))
      .put("episode", nullableNonNegative(input.opt("episode")))
      .put("libraryKind", libraryKind)
      .put("seriesTitle", nullableText(input.opt("seriesTitle"), 160))
      .put("episodeTitle", nullableText(input.opt("episodeTitle"), 160))
      .put("posterPath", nullableText(input.opt("posterPath"), 220))
      .put("backdropPath", nullableText(input.opt("backdropPath"), 220))
  }

  private fun sanitizeStorageTarget(input: JSONObject?, destination: String): JSONObject? {
    input ?: return null
    if (input.optString("mode") != destination) return null
    val displayName = cleanText(input.optString("displayName"), 100) ?: return null
    val target = input.opt("targetId")
    val targetId = if (target == null || target == JSONObject.NULL) JSONObject.NULL else cleanText(target.toString(), 140) ?: return null
    return JSONObject()
      .put("mode", destination)
      .put("targetId", targetId)
      .put("displayName", displayName)
      .put("writable", input.optBoolean("writable", false))
      .put("persistedPermission", input.optBoolean("persistedPermission", false))
  }

  private fun sanitizeFailure(input: JSONObject): JSONObject? {
    val code = cleanText(input.optString("code"), 80) ?: return null
    val message = cleanText(input.optString("message"), 220) ?: return null
    return failure(code, message, input.optBoolean("retryable"), input.optBoolean("actionRequired"))
  }

  private fun sanitizeStringArray(input: JSONArray?): JSONArray {
    val output = JSONArray()
    val seen = linkedSetOf<String>()
    if (input == null) return output
    for (index in 0 until input.length()) {
      val value = cleanText(input.optString(index), 100) ?: continue
      if (seen.add(value)) output.put(value)
    }
    return output
  }

  private fun migrateOwnedArtifactsLocked(state: JSONObject): Boolean {
    val assets = state.optJSONArray("assets") ?: return false
    var changed = false
    for (index in 0 until assets.length()) {
      val asset = assets.optJSONObject(index) ?: continue
      val artifacts = asset.optJSONArray("_artifacts")
      if (artifacts != null && (0 until artifacts.length()).any { artifacts.optJSONObject(it)?.optString("role") == "primary" }) continue
      synthesizePrimaryArtifactLocked(asset, "checking")
      changed = true
    }
    return changed
  }

  private fun ensureOwnedArtifactsLocked(asset: JSONObject) {
    val artifacts = asset.optJSONArray("_artifacts")
    if (artifacts != null && (0 until artifacts.length()).any { artifacts.optJSONObject(it)?.optString("role") == "primary" }) return
    synthesizePrimaryArtifactLocked(asset, "verified")
  }

  private fun synthesizePrimaryArtifactLocked(asset: JSONObject, availability: String) {
    val assetId = cleanId(asset.optString("assetId")) ?: return
    val locator = asset.optJSONObject("locator") ?: return
    val locatorKind = locator.optString("kind").takeIf { it in setOf("managed", "content-uri", "file-uri") } ?: return
    val locatorValue = locator.optString("value").takeIf { it.isNotBlank() } ?: return
    val media = asset.optJSONObject("media") ?: JSONObject()
    val displayName = cleanText(media.optString("episodeTitle"), 160)
      ?: cleanText(media.optString("title"), 160)
      ?: "Downloaded media"
    val size = asset.optLong("verifiedSizeBytes", 0L).coerceAtLeast(0L)
    val primary = JSONObject()
      .put("schemaVersion", 1)
      .put("artifactId", "$assetId:primary")
      .put("role", "primary")
      .put("displayName", displayName)
      .put("mimeType", if (asset.isNull("mimeType")) JSONObject.NULL else asset.opt("mimeType"))
      .put("expectedSizeBytes", size)
      .put("observedSizeBytes", if (availability == "verified") size else JSONObject.NULL)
      .put("availability", availability)
      .put("lastCheckedAt", if (availability == "verified") System.currentTimeMillis() else JSONObject.NULL)
      .put("_locator", JSONObject().put("kind", locatorKind).put("value", locatorValue))
    val output = JSONArray().put(primary)
    val existing = asset.optJSONArray("_artifacts") ?: JSONArray()
    for (index in 0 until existing.length()) {
      val artifact = existing.optJSONObject(index) ?: continue
      if (artifact.optString("role") != "primary") output.put(artifact)
    }
    asset.put("_artifacts", output)
  }

  private fun primaryAvailabilityForJobLocked(state: JSONObject, jobId: String): OrionArtifactAvailability? {
    val assets = state.optJSONArray("assets") ?: return null
    for (index in 0 until assets.length()) {
      val asset = assets.optJSONObject(index) ?: continue
      if (asset.optString("jobId") != jobId) continue
      val artifacts = asset.optJSONArray("_artifacts") ?: continue
      for (artifactIndex in 0 until artifacts.length()) {
        val artifact = artifacts.optJSONObject(artifactIndex) ?: continue
        if (artifact.optString("role") == "primary") return OrionArtifactAvailability.fromWire(artifact.optString("availability"))
      }
    }
    return null
  }

  private fun removeAssetsFromOfflineEntries(entries: JSONArray, removedAssetIds: Set<String>, remainingAssets: JSONArray): JSONArray {
    val availabilityByAsset = linkedMapOf<String, String>()
    for (index in 0 until remainingAssets.length()) {
      val asset = remainingAssets.optJSONObject(index) ?: continue
      val artifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
      val primary = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
      availabilityByAsset[asset.optString("assetId")] = primary?.optString("availability", "checking") ?: "checking"
    }
    val output = JSONArray()
    for (index in 0 until entries.length()) {
      val entry = entries.optJSONObject(index) ?: continue
      val ids = entry.optJSONArray("assetIds") ?: JSONArray()
      val kept = mutableListOf<String>()
      for (assetIndex in 0 until ids.length()) {
        val id = ids.optString(assetIndex)
        if (!removedAssetIds.contains(id) && availabilityByAsset.containsKey(id)) kept.add(id)
      }
      if (kept.isEmpty()) continue
      val primary = kept.firstOrNull { availabilityByAsset[it] == "verified" }
        ?: kept.firstOrNull { availabilityByAsset[it] in setOf("checking", "unavailable") }
        ?: kept.first()
      entry.put("assetIds", JSONArray(kept))
      entry.put("primaryAssetId", primary)
      entry.put("updatedAt", System.currentTimeMillis())
      output.put(entry)
    }
    return output
  }

  private fun safeAddBytes(left: Long, right: Long): Long = when {
    right <= 0L -> left
    left > Long.MAX_VALUE - right -> Long.MAX_VALUE
    else -> left + right
  }


  private fun retireDirectExperimentalArtifactsLocked(state: JSONObject): Set<String> {
    val jobs = state.optJSONArray("jobs") ?: JSONArray()
    val removedJobs = linkedSetOf<String>()
    val keptJobs = JSONArray()
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("_transferKind") == "direct") cleanId(job.optString("jobId"))?.let(removedJobs::add)
      else keptJobs.put(job)
    }
    if (removedJobs.isEmpty()) return emptySet()

    val assets = state.optJSONArray("assets") ?: JSONArray()
    val removedAssets = linkedSetOf<String>()
    val keptAssets = JSONArray()
    for (index in 0 until assets.length()) {
      val asset = assets.optJSONObject(index) ?: continue
      if (removedJobs.contains(asset.optString("jobId"))) cleanId(asset.optString("assetId"))?.let(removedAssets::add)
      else keptAssets.put(asset)
    }

    val offlineEntries = state.optJSONArray("offlineEntries") ?: JSONArray()
    val keptOffline = JSONArray()
    for (index in 0 until offlineEntries.length()) {
      val entry = offlineEntries.optJSONObject(index) ?: continue
      val primary = entry.optString("primaryAssetId")
      val ids = entry.optJSONArray("assetIds") ?: JSONArray()
      var removed = removedAssets.contains(primary)
      for (assetIndex in 0 until ids.length()) if (removedAssets.contains(ids.optString(assetIndex))) removed = true
      if (!removed) keptOffline.put(entry)
    }
    state.put("jobs", keptJobs)
    state.put("assets", keptAssets)
    state.put("offlineEntries", keptOffline)
    return removedJobs
  }

  private fun deleteRetiredDirectFilesLocked(context: Context, jobIds: Set<String>) {
    val partialRoot = java.io.File(context.filesDir, "orion-downloads/partial")
    val libraryRoot = java.io.File(context.filesDir, "orion-downloads/library")
    jobIds.forEach { jobId ->
      try { java.io.File(partialRoot, "$jobId.part").delete() } catch (_: Throwable) {}
      try { java.io.File(libraryRoot, "$jobId.mp4").delete() } catch (_: Throwable) {}
    }
  }

  private fun mergeOfflineEntry(entries: JSONArray, incoming: JSONObject): JSONArray {
    val entryId = incoming.optString("entryId")
    val output = JSONArray()
    var merged = false
    for (index in 0 until entries.length()) {
      val current = entries.optJSONObject(index) ?: continue
      if (current.optString("entryId") != entryId) {
        output.put(current)
        continue
      }
      val assetIds = linkedSetOf<String>()
      val existingIds = current.optJSONArray("assetIds") ?: JSONArray()
      for (assetIndex in 0 until existingIds.length()) cleanText(existingIds.optString(assetIndex), 140)?.let(assetIds::add)
      val newIds = incoming.optJSONArray("assetIds") ?: JSONArray()
      for (assetIndex in 0 until newIds.length()) cleanText(newIds.optString(assetIndex), 140)?.let(assetIds::add)
      incoming.put("assetIds", JSONArray(assetIds.toList()))
      output.put(incoming)
      merged = true
    }
    if (!merged) output.put(incoming)
    return output
  }

  private fun upsertById(values: JSONArray, incoming: JSONObject, key: String): JSONArray {
    val id = incoming.optString(key)
    val output = JSONArray().put(incoming)
    for (index in 0 until values.length()) {
      val value = values.optJSONObject(index) ?: continue
      if (value.optString(key) != id) output.put(value)
    }
    return output
  }

  private fun emptyState(): JSONObject = JSONObject()
    .put("schemaVersion", 1)
    .put("jobs", JSONArray())
    .put("assets", JSONArray())
    .put("offlineEntries", JSONArray())

  private fun emptyProgress(): JSONObject = JSONObject()
    .put("bytesDownloaded", 0)
    .put("totalBytes", JSONObject.NULL)
    .put("completedFragments", JSONObject.NULL)
    .put("totalFragments", JSONObject.NULL)
    .put("percent", JSONObject.NULL)
    .put("bytesPerSecond", JSONObject.NULL)
    .put("etaSeconds", JSONObject.NULL)
    .put("finalizationStage", JSONObject.NULL)
    .put("finalizationStageStartedAt", JSONObject.NULL)

  private fun failure(code: String, message: String, retryable: Boolean, actionRequired: Boolean): JSONObject = JSONObject()
    .put("code", code.take(80))
    .put("message", message.take(220))
    .put("retryable", retryable)
    .put("actionRequired", actionRequired)

  private val FINALIZATION_STAGES = setOf(
    "preparing", "remuxing", "verifying-output", "publishing-media", "confirming-publication", "publishing-subtitles",
  )

  private val ARTIFACT_AVAILABILITY = setOf("checking", "verified", "missing", "unavailable")

  private val ACTIVE_EXECUTION_STATES = setOf(
    "queued", "preflighting", "downloading", "paused", "recovering", "verifying", "finalizing",
  )

  private val DUPLICATE_BLOCKING_STATES = setOf(
    "queued", "preflighting", "downloading", "paused", "recovering", "verifying", "finalizing",
    "storage-blocked", "action-required", "expired", "completed",
  )

  private fun cleanId(value: String): String? = value.trim().takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,120}$")) }
  private fun cleanText(value: String, max: Int): String? = value.replace(Regex("[\\u0000-\\u001f\\u007f]"), "").trim().take(max).takeIf { it.isNotBlank() }
  private fun nullableText(value: Any?, max: Int): Any = when (value) {
    null, JSONObject.NULL -> JSONObject.NULL
    else -> cleanText(value.toString(), max) ?: JSONObject.NULL
  }
  private fun nullableNonNegative(value: Any?): Any = when (value) {
    is Number -> value.toLong().coerceAtLeast(0L)
    else -> JSONObject.NULL
  }
  private fun mediaGroupKey(media: JSONObject): String = "${media.optString("libraryKind")}:${media.opt("id")}".take(140)
  private fun mediaItemKey(media: JSONObject): String {
    val group = mediaGroupKey(media)
    val season = if (media.isNull("season")) null else media.optInt("season")
    val episode = if (media.isNull("episode")) null else media.optInt("episode")
    return if (media.optString("mediaType") == "tv" && season != null && episode != null) "$group:s$season:e$episode" else group
  }
}
