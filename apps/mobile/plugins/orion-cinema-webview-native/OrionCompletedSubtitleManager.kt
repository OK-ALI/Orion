package com.okali.orion.playback

import android.content.Context
import android.net.Uri
import android.util.AtomicFile
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** Post-completion sidecars use the same owned-artifact record as finalization. */
internal object OrionCompletedSubtitleManager {
  private const val MAX_BYTES = 10L * 1024L * 1024L
  private val idPattern = Regex("^[A-Za-z0-9._:-]{1,140}$")

  fun recover(context: Context) {
    val assets = OrionDownloadJobStore.ownershipAssets()
    for (index in 0 until assets.length()) {
      val asset = assets.optJSONObject(index) ?: continue
      val journal = asset.optJSONObject("_subtitleMutation") ?: continue
      if (journal.optString("kind") == "add") rollbackAdd(context, asset, journal)
      else if (journal.optString("kind") == "remove") finishRemove(context, asset, journal)
    }
  }

  fun add(context: Context, assetId: String, token: String, source: JSONObject): JSONObject {
    recover(context)
    OrionDownloadArtifactManager.reconcile(context, setOf(assetId))
    val asset = authorizedAsset(assetId, token) ?: return failed("The saved download changed. Refresh it and try again.")
    if (!eligible(asset)) return failed("This download cannot be safely updated right now.")
    val subtitles = subtitles(asset)
    if (subtitles.size >= 2) return failed("A download can have at most two saved subtitles.")
    val trackId = source.optString("id").takeIf { it.matches(idPattern) }
      ?: return failed("The selected subtitle is invalid.")
    if (subtitles.any { it.optString("id") == trackId }) return failed("This subtitle is already saved.")

    val mutationId = UUID.randomUUID().toString().replace("-", "")
    val handoffId = "managed-$mutationId"
    val staging = File(context.cacheDir, "orion-downloads/subtitle-management/$mutationId")
    val selected = JSONArray().put(trackId)
    OrionDownloadSubtitleRuntime.register(handoffId, JSONArray().put(source), selected)
    try {
      OrionDownloadSubtitleRuntime.prepare(context, handoffId)
      val prepared = OrionDownloadSubtitleRuntime.finalizeInto(context, handoffId, staging)
      val track = prepared.tracks.optJSONObject(0)
      val entry = prepared.bundleEntries.optJSONObject(0)
      val relative = entry?.optString("name").orEmpty()
      val local = File(staging, relative)
      if (prepared.tracks.length() != 1 || prepared.bundleEntries.length() != 1 ||
        track?.optString("id") != trackId || !relative.matches(Regex("^subtitles/[A-Za-z0-9._-]{1,120}$")) ||
        !local.isFile || local.length() !in 1..MAX_BYTES || entry.optLong("size", -1L) != local.length()
      ) return failed("Orion could not verify the selected subtitle bytes.")
      val text = try { local.readText(Charsets.UTF_8) } catch (_: Throwable) { return failed("The selected subtitle cannot be read safely.") }
      if (text.isBlank() || text.indexOf('\u0000') >= 0) return failed("The selected subtitle is not usable text.")
      val format = local.extension.lowercase().takeIf { it in setOf("vtt", "srt", "ass") }
        ?: return failed("The subtitle format is unsupported.")
      track.put("default", subtitles.isEmpty())
      val journal = JSONObject().put("id", mutationId).put("assetId", assetId).put("kind", "add")
        .put("trackId", trackId).put("token", token)
      val target = target(context, asset, mutationId, format) ?: return failed("The saved video's folder is unavailable.")
      journal.put("locatorKind", target.kind).put("locatorValue", target.value)
      if (target.kind == "content-uri") {
        journal.put("targetId", target.targetId).put("documentName", target.documentName)
      }
      if (!OrionDownloadJobStore.beginSubtitleMutation(assetId, token, journal)) {
        return failed("The saved download changed. Refresh it and try again.")
      }
      val published = publish(context, local, target, journal)
      if (published == null) {
        rollbackAdd(context, asset, journal)
        return failed("Orion could not publish the subtitle beside the saved video.")
      }
      val replacement = JSONObject(asset.toString()).apply { remove("_subtitleMutation") }
      val tracks = JSONArray(replacement.optJSONArray("tracks")?.toString() ?: "[]").put(track)
      val artifacts = JSONArray(replacement.optJSONArray("_artifacts")?.toString() ?: "[]")
      val now = System.currentTimeMillis()
      val artifact = JSONObject().put("schemaVersion", 1)
        .put("artifactId", "$assetId:subtitle:${mutationId.take(12)}")
        .put("role", "subtitle").put("displayName", published.displayName)
        .put("mimeType", mime(format)).put("expectedSizeBytes", local.length())
        .put("observedSizeBytes", local.length()).put("availability", "verified")
        .put("lastCheckedAt", now).put("_trackId", trackId)
        .put("_contentSha256", published.sha256)
        .put("_locator", JSONObject().put("kind", target.kind).put("value", published.value))
      artifacts.put(artifact)
      replacement.put("tracks", tracks).put("_artifacts", artifacts)
      if (isFragment(asset) && !editFragmentIndex(context, asset, trackId, published.relativeName, local.length(), track.optString("language"), source.optString("provider"), add = true, replacement)) {
        rollbackAdd(context, asset, journal)
        return failed("Orion could not update the offline subtitle index.")
      }
      replacement.put("verifiedSizeBytes", totalExpected(artifacts))
      if (!OrionDownloadJobStore.completeSubtitleMutation(assetId, mutationId, token, replacement)) {
        rollbackAdd(context, asset, journal)
        return failed("Orion could not save the subtitle association.")
      }
      return success("Subtitle saved beside the video.")
    } finally {
      OrionDownloadSubtitleRuntime.cleanup(context, handoffId)
      staging.deleteRecursively()
    }
  }

  fun remove(context: Context, assetId: String, token: String, trackId: String): JSONObject {
    recover(context)
    OrionDownloadArtifactManager.reconcile(context, setOf(assetId))
    val asset = authorizedAsset(assetId, token) ?: return failed("The saved download changed. Refresh it and try again.")
    if (!eligible(asset)) return failed("This download cannot be safely updated right now.")
    val track = subtitles(asset).firstOrNull { it.optString("id") == trackId }
      ?: return failed("This subtitle is no longer associated with the download.")
    val artifact = ownedSubtitle(asset, trackId) ?: return failed("The subtitle's exact owned file could not be identified.")
    val locator = artifact.optJSONObject("_locator") ?: return failed("The saved subtitle locator is invalid.")
    val kind = locator.optString("kind")
    if (kind !in setOf("content-uri", "managed-relative")) return failed("The saved subtitle locator is unsupported.")
    val mutationId = UUID.randomUUID().toString().replace("-", "")
    val journal = JSONObject().put("id", mutationId).put("kind", "remove")
      .put("trackId", track.optString("id")).put("token", token)
      .put("locatorKind", kind).put("locatorValue", locator.optString("value"))
    if (!OrionDownloadJobStore.beginSubtitleMutation(assetId, token, journal)) {
      return failed("The saved download changed. Refresh it and try again.")
    }
    return if (finishRemove(context, asset, journal)) success("Subtitle removed from the saved video.")
    else failed("Orion could not confirm removal of the exact saved subtitle. Retry after reconnecting its folder.")
  }

  private fun finishRemove(context: Context, asset: JSONObject, journal: JSONObject): Boolean {
    val assetId = asset.optString("assetId")
    val trackId = journal.optString("trackId")
    val artifact = ownedSubtitle(asset, trackId) ?: return false
    val locator = artifact.optJSONObject("_locator") ?: return false
    if (locator.optString("kind") != journal.optString("locatorKind") ||
      locator.optString("value") != journal.optString("locatorValue")) return false
    if (!deleteExact(context, asset, journal)) return false
    val replacement = JSONObject(asset.toString()).apply { remove("_subtitleMutation") }
    val tracks = JSONArray()
    val oldTracks = asset.optJSONArray("tracks") ?: JSONArray()
    for (index in 0 until oldTracks.length()) oldTracks.optJSONObject(index)?.let { track ->
      if (!(track.optString("kind") == "subtitle" && track.optString("id") == trackId)) tracks.put(track)
    }
    val artifacts = JSONArray()
    val oldArtifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
    for (index in 0 until oldArtifacts.length()) oldArtifacts.optJSONObject(index)?.let { item ->
      if (item.optString("artifactId") != artifact.optString("artifactId")) artifacts.put(item)
    }
    replacement.put("tracks", tracks).put("_artifacts", artifacts)
    if (isFragment(asset) && !editFragmentIndex(context, asset, trackId, "", 0L, "", "", add = false, replacement)) return false
    replacement.put("verifiedSizeBytes", totalExpected(artifacts))
    return OrionDownloadJobStore.completeSubtitleMutation(assetId, journal.optString("id"), journal.optString("token"), replacement)
  }

  private fun rollbackAdd(context: Context, asset: JSONObject, journal: JSONObject): Boolean {
    val current = OrionDownloadJobStore.ownershipAssets(setOf(asset.optString("assetId"))).optJSONObject(0) ?: return false
    if (current.optJSONObject("_subtitleMutation")?.optString("id") != journal.optString("id")) return true
    if (isFragment(asset) && !editFragmentIndex(context, asset, journal.optString("trackId"), "", 0L, "", "", add = false, null)) return false
    if (!deleteExact(context, asset, journal)) return false
    return OrionDownloadJobStore.clearSubtitleMutation(asset.optString("assetId"), journal.optString("id"))
  }

  private data class Target(val kind: String, val value: String, val relativeName: String,
    val targetId: String = "", val documentName: String = "")
  private data class Published(val value: String, val relativeName: String, val displayName: String, val sha256: String)

  private fun target(context: Context, asset: JSONObject, id: String, format: String): Target? {
    val jobId = asset.optString("jobId").takeIf { it.matches(idPattern) } ?: return null
    val root = File(context.filesDir, "orion-downloads/library")
    val primary = primary(asset) ?: return null
    val primaryLocator = primary.optJSONObject("_locator") ?: return null
    if (primaryLocator.optString("kind") == "managed-relative") {
      val fragment = isFragment(asset)
      val directory = File(root, if (fragment) "$jobId.fragments" else "$jobId.sidecars")
      val primaryFile = File(root, primaryLocator.optString("value"))
      if (!OrionDownloadOwnershipPolicy.canonicalContained(root, directory) ||
        !OrionDownloadOwnershipPolicy.canonicalContained(root, primaryFile) ||
        (fragment && !primaryFile.isDirectory) ||
        (!fragment && (!primaryFile.isFile || primaryFile.length() != primary.optLong("expectedSizeBytes", -1L)))) return null
      val relative = "subtitles/orion-$id.$format"
      val file = File(directory, relative)
      if (!OrionDownloadOwnershipPolicy.canonicalContained(root, file) || file.exists()) return null
      return Target("managed-relative", "${directory.name}/$relative", relative)
    }
    if (primaryLocator.optString("kind") != "content-uri") return null
    val targetId = asset.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
    if (OrionDownloadStorageRegistry.describe(context, targetId) == null) return null
    val primaryUri = parseUri(primaryLocator.optString("value")) ?: return null
    val probe = OrionDownloadStorageRegistry.probeDocument(context, primaryUri)
    if (probe !is OrionDownloadStorageRegistry.DocumentProbe.Verified ||
      probe.sizeBytes != primary.optLong("expectedSizeBytes", -1L)) return null
    val base = primary.optString("displayName").removeSuffix(".mp4")
      .replace(Regex("[^A-Za-z0-9._ -]"), "").trim().take(65).ifBlank { "Orion download" }
    val name = "$base.orion-$id.$format"
    if (OrionDownloadStorageRegistry.findDocumentsByName(context, targetId, name)?.isNotEmpty() != false) return null
    return Target("content-uri", "", "", targetId, name)
  }

  private fun publish(context: Context, source: File, target: Target, journal: JSONObject): Published? {
    val expected = source.length()
    val digest = sha256(source) ?: return null
    if (target.kind == "managed-relative") {
      val root = File(context.filesDir, "orion-downloads/library")
      val destination = File(root, target.value)
      if (!OrionDownloadOwnershipPolicy.canonicalContained(root, destination) || destination.exists()) return null
      destination.parentFile?.mkdirs()
      try { source.inputStream().use { input -> destination.outputStream().use { input.copyTo(it) } } } catch (_: Throwable) { destination.delete(); return null }
      if (destination.length() != expected || sha256(destination) != digest) { destination.delete(); return null }
      return Published(target.value, target.relativeName, destination.name, digest)
    }
    val uri = OrionDownloadStorageRegistry.createDocument(context, target.targetId, mime(source.extension), target.documentName) ?: return null
    journal.put("locatorValue", uri.toString())
    if (!OrionDownloadJobStore.updateSubtitleMutation(journalAssetId(journal), journal.optString("id"), journal)) {
      OrionDownloadStorageRegistry.deleteDocument(context, uri)
      return null
    }
    val info = OrionDownloadStorageRegistry.documentInfo(context, uri)
    if (info?.displayName != target.documentName ||
      (info.mimeType != null && info.mimeType != mime(source.extension))) return null
    val wrote = try {
      context.contentResolver.openFileDescriptor(uri, "rwt")?.use { descriptor ->
        FileOutputStream(descriptor.fileDescriptor).use { output ->
          val count = source.inputStream().use { it.copyTo(output) }
          output.flush()
          output.fd.sync()
          count
        }
      } ?: -1L
    } catch (_: Throwable) { -1L }
    if (wrote != expected) return null
    val observed = OrionDownloadStorageRegistry.probeDocument(context, uri)
    if (observed !is OrionDownloadStorageRegistry.DocumentProbe.Verified || observed.sizeBytes != expected || sha256(context, uri) != digest) return null
    return Published(uri.toString(), "", info.displayName, digest)
  }

  private fun journalAssetId(journal: JSONObject): String = journal.optString("assetId")

  private fun deleteExact(context: Context, asset: JSONObject, journal: JSONObject): Boolean {
    val kind = journal.optString("locatorKind")
    val value = journal.optString("locatorValue")
    if (kind == "managed-relative") {
      val root = File(context.filesDir, "orion-downloads/library")
      val file = File(root, value)
      val jobId = asset.optString("jobId").takeIf { it.matches(idPattern) } ?: return false
      val expected = Regex("^${Regex.escape(jobId)}\\.(?:sidecars|fragments)/subtitles/[A-Za-z0-9._-]{1,120}$")
      if (!value.matches(expected) || !OrionDownloadOwnershipPolicy.canonicalContained(root, file)) return false
      return !file.exists() || (file.isFile && file.delete())
    }
    if (kind != "content-uri") return false
    val uri = parseUri(value)
    if (uri != null) return OrionDownloadStorageRegistry.deleteDocument(context, uri) != OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable
    val targetId = journal.optString("targetId")
    val name = journal.optString("documentName")
    val marker = "orion-${journal.optString("id")}"
    if (!name.contains(".$marker.")) return false
    val matches = OrionDownloadStorageRegistry.findDocumentsByMarker(context, targetId, marker) ?: return false
    if (matches.size > 1) return false
    return matches.isEmpty() || OrionDownloadStorageRegistry.deleteDocument(context, matches[0]) != OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable
  }

  private fun editFragmentIndex(context: Context, asset: JSONObject, trackId: String, relative: String,
    size: Long, language: String, provider: String, add: Boolean, replacement: JSONObject?): Boolean {
    val jobId = asset.optString("jobId").takeIf { it.matches(idPattern) } ?: return false
    val root = File(context.filesDir, "orion-downloads/library")
    val directory = File(root, "$jobId.fragments")
    val indexFile = File(directory, "orion-fragment-bundle.json")
    if (!OrionDownloadOwnershipPolicy.canonicalContained(root, indexFile) || !indexFile.isFile || indexFile.length() !in 1..1_000_000) return false
    val atomic = AtomicFile(indexFile)
    val index = try { JSONObject(atomic.openRead().bufferedReader(Charsets.UTF_8).use { it.readText() }) } catch (_: Throwable) { return false }
    if (index.optInt("schemaVersion") != 1 || index.optString("kind") !in setOf("hls", "dash")) return false
    val existing = index.optJSONArray("subtitles") ?: JSONArray()
    val next = JSONArray()
    for (i in 0 until existing.length()) existing.optJSONObject(i)?.let { entry ->
      if (entry.optString("id") != trackId) next.put(entry)
    }
    if (add && next.length() != existing.length()) return false
    if (!add && next.length() == existing.length() && replacement == null) return true
    if (add) {
      if (relative != "subtitles/${File(relative).name}" || next.length() >= 2 || size !in 1..MAX_BYTES) return false
      next.put(JSONObject().put("id", trackId).put("provider", provider)
        .put("language", language).put("name", relative).put("size", size))
    }
    index.put("subtitles", next)
    val bytes = index.toString().toByteArray(Charsets.UTF_8)
    if (bytes.size > 1_000_000) return false
    var stream: java.io.FileOutputStream? = null
    try {
      stream = atomic.startWrite()
      stream.write(bytes)
      atomic.finishWrite(stream)
    } catch (_: Throwable) {
      stream?.let { atomic.failWrite(it) }
      return false
    }
    replacement?.optJSONArray("_artifacts")?.let { artifacts ->
      (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }
        .firstOrNull { it.optString("role") == "primary" }?.let { primary ->
          val files = index.optJSONArray("files") ?: JSONArray()
          val fragmentBytes = (0 until files.length()).fold(0L) { total, i ->
            val size = files.optJSONObject(i)?.optLong("size", 0L) ?: 0L
            if (total > Long.MAX_VALUE - size) Long.MAX_VALUE else total + size
          }
          val newSize = if (fragmentBytes > Long.MAX_VALUE - bytes.size) Long.MAX_VALUE else fragmentBytes + bytes.size
          primary.put("expectedSizeBytes", newSize).put("observedSizeBytes", newSize)
        }
    }
    return true
  }

  private fun authorizedAsset(assetId: String, token: String): JSONObject? {
    if (!assetId.matches(idPattern) || !token.matches(Regex("^[a-f0-9]{64}$"))) return null
    val asset = OrionDownloadJobStore.ownershipAssets(setOf(assetId)).optJSONObject(0) ?: return null
    return asset.takeIf { !it.has("_subtitleMutation") && OrionDownloadJobStore.managementToken(it) == token }
  }

  private fun eligible(asset: JSONObject): Boolean = asset.optString("container") in setOf("mp4", "hls-fragments", "dash-fragments") &&
    asset.optJSONArray("_artifacts")?.let { artifacts ->
      (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }
        .firstOrNull { it.optString("role") == "primary" }?.optString("availability") == "verified"
    } == true

  private fun subtitles(asset: JSONObject): List<JSONObject> = asset.optJSONArray("tracks")?.let { tracks ->
    (0 until tracks.length()).mapNotNull { tracks.optJSONObject(it) }.filter { it.optString("kind") == "subtitle" }
  } ?: emptyList()

  private fun ownedSubtitle(asset: JSONObject, trackId: String): JSONObject? {
    val artifacts = asset.optJSONArray("_artifacts") ?: return null
    val candidates = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }
      .filter { it.optString("role") == "subtitle" }
    candidates.firstOrNull { it.optString("_trackId") == trackId }?.let { return it }
    val index = subtitles(asset).indexOfFirst { it.optString("id") == trackId }
    return if (index >= 0 && candidates.size == subtitles(asset).size) candidates.getOrNull(index) else null
  }

  private fun primary(asset: JSONObject): JSONObject? = asset.optJSONArray("_artifacts")?.let { artifacts ->
    (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
  }

  private fun isFragment(asset: JSONObject) = asset.optString("container") in setOf("hls-fragments", "dash-fragments")
  private fun totalExpected(artifacts: JSONArray): Long = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }
    .fold(0L) { total, artifact -> val bytes = artifact.optLong("expectedSizeBytes", 0L).coerceAtLeast(0L); if (total > Long.MAX_VALUE - bytes) Long.MAX_VALUE else total + bytes }
  private fun mime(format: String) = when (format) { "srt" -> "application/x-subrip"; "ass" -> "text/x-ssa"; else -> "text/vtt" }
  private fun parseUri(value: String): Uri? = try { Uri.parse(value).takeIf { it.scheme == "content" } } catch (_: Throwable) { null }
  private fun sha256(file: File): String? = try { file.inputStream().use { digest(it) } } catch (_: Throwable) { null }
  private fun sha256(context: Context, uri: Uri): String? = try {
    context.contentResolver.openInputStream(uri)?.use { input ->
      val hash = MessageDigest.getInstance("SHA-256")
      val bytes = ByteArray(8192)
      var total = 0L
      while (true) {
        val read = input.read(bytes)
        if (read < 0) break
        total += read
        if (total > MAX_BYTES) return null
        if (read > 0) hash.update(bytes, 0, read)
      }
      hash.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }
  } catch (_: Throwable) { null }
  private fun digest(input: java.io.InputStream): String {
    val hash = MessageDigest.getInstance("SHA-256")
    val bytes = ByteArray(8192)
    while (true) { val read = input.read(bytes); if (read < 0) break; if (read > 0) hash.update(bytes, 0, read) }
    return hash.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
  }
  private fun failed(message: String) = JSONObject().put("ok", false).put("message", message)
  private fun success(message: String) = JSONObject().put("ok", true).put("message", message)
}
