package com.okali.orion.playback

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object OrionDownloadJobStore {
  private const val PREFS = "orion_download_jobs_v1"
  private const val KEY_STATE = "state"
  private val listeners = linkedSetOf<(JSONObject) -> Unit>()
  private var appContext: Context? = null

  @Synchronized
  fun initialize(context: Context) {
    appContext = context.applicationContext
    val state = readStateLocked()
    if (state.optInt("schemaVersion", 0) != 1) persistLocked(emptyState())
    else {
      val retiredDirectJobs = retireDirectExperimentalArtifactsLocked(state)
      if (retiredDirectJobs.isNotEmpty()) {
        persistLocked(state)
        deleteRetiredDirectFilesLocked(context.applicationContext, retiredDirectJobs)
      }
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
    val subtitleSources = sanitizeSubtitleSources(payload.optJSONArray("subtitleSources"), subtitles)
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
      .put("_groupKey", cleanText(payload.optString("groupKey"), 140) ?: mediaGroupKey(media))
      .put("_itemKey", cleanText(payload.optString("itemKey"), 180) ?: mediaItemKey(media))
      .put("_sourceId", transfer.sourceId.take(60))
      .put("_transferKind", transfer.transferKind)
      .put("_resumable", transfer.resumable)
      .put("_expectedBytes", transfer.requiredBytes ?: JSONObject.NULL)
      .put("_subtitleSources", subtitleSources)
      .put("_control", "run")

    val state = readStateLocked()
    val jobs = state.getJSONArray("jobs")
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
      if (stateName == "completed") {
        val progress = job.optJSONObject("progress") ?: emptyProgress()
        progress.put("percent", 100)
        job.put("progress", progress)
      }
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
      val progress = JSONObject()
        .put("bytesDownloaded", bytesDownloaded.coerceAtLeast(0L))
        .put("totalBytes", totalBytes ?: JSONObject.NULL)
        .put("completedFragments", completedFragments ?: JSONObject.NULL)
        .put("totalFragments", totalFragments ?: JSONObject.NULL)
        .put("percent", if (percent.isNaN()) JSONObject.NULL else percent)
        .put("bytesPerSecond", bytesPerSecond ?: JSONObject.NULL)
        .put("etaSeconds", etaSeconds ?: JSONObject.NULL)
      job.put("progress", progress)
      job.put("updatedAt", System.currentTimeMillis())
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
    mutateJobLocked(jobId, notify = false) { job -> job.put("_control", "run") }
  }

  @Synchronized
  fun control(jobId: String): String = getJob(jobId)?.optString("_control", "run") ?: "cancel"

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
    mutateJobLocked(jobId) { job ->
      job.put("state", "cancelled")
      job.put("failure", JSONObject.NULL)
      job.put("updatedAt", System.currentTimeMillis())
      job.remove("_subtitleSources")
    }
  }

  @Synchronized
  fun markCompleted(jobId: String, asset: JSONObject, offlineEntry: JSONObject) {
    val state = readStateLocked()
    val jobs = state.getJSONArray("jobs")
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      if (job.optString("jobId") != jobId) continue
      job.put("state", "completed")
      job.put("failure", JSONObject.NULL)
      job.put("completedAt", System.currentTimeMillis())
      job.put("updatedAt", System.currentTimeMillis())
      val progress = job.optJSONObject("progress") ?: emptyProgress()
      progress.put("percent", 100)
      job.put("progress", progress)
      job.put("_control", "run")
      job.remove("_subtitleSources")
      break
    }
    state.put("assets", upsertById(state.getJSONArray("assets"), asset, "assetId"))
    state.put("offlineEntries", mergeOfflineEntry(state.getJSONArray("offlineEntries"), offlineEntry))
    persistAndNotifyLocked(state)
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
    val jobs = JSONArray()
    val sourceJobs = state.optJSONArray("jobs") ?: JSONArray()
    for (index in 0 until sourceJobs.length()) sourceJobs.optJSONObject(index)?.let { jobs.put(publicJob(it)) }
    return JSONObject()
      .put("schemaVersion", 1)
      .put("jobs", jobs)
      .put("assets", JSONArray((state.optJSONArray("assets") ?: JSONArray()).toString()))
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

  private fun sanitizeSubtitleSources(input: JSONArray?, selectedIds: JSONArray): JSONArray {
    val output = JSONArray()
    if (input == null) return output
    val selected = linkedSetOf<String>()
    for (index in 0 until selectedIds.length()) cleanText(selectedIds.optString(index), 100)?.let(selected::add)
    for (index in 0 until input.length()) {
      if (output.length() >= 2) break
      val source = input.optJSONObject(index) ?: continue
      val id = cleanText(source.optString("id"), 100) ?: continue
      if (!selected.contains(id)) continue
      val provider = source.optString("provider").takeIf { it == "subdl" || it == "wyzie" } ?: continue
      val url = cleanText(source.optString("url"), 1200) ?: continue
      val safeUrl = try {
        val parsed = java.net.URI(url)
        parsed.scheme == "https" && !parsed.host.isNullOrBlank()
      } catch (_: Throwable) { false }
      if (!safeUrl) continue
      val language = cleanText(source.optString("language"), 12) ?: "und"
      val languageLabel = cleanText(source.optString("languageLabel"), 60) ?: language.uppercase()
      val label = cleanText(source.optString("label"), 120) ?: "$languageLabel subtitle"
      val format = source.optString("format").takeIf { it in setOf("vtt", "srt", "ass", "unknown") } ?: "unknown"
      output.put(JSONObject()
        .put("id", id)
        .put("provider", provider)
        .put("language", language)
        .put("languageLabel", languageLabel)
        .put("label", label)
        .put("format", format)
        .put("url", url))
    }
    return output
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

  private fun failure(code: String, message: String, retryable: Boolean, actionRequired: Boolean): JSONObject = JSONObject()
    .put("code", code.take(80))
    .put("message", message.take(220))
    .put("retryable", retryable)
    .put("actionRequired", actionRequired)

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
