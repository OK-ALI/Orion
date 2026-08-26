package com.okali.orion.playback

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.zip.ZipInputStream
import org.json.JSONArray
import org.json.JSONObject

internal data class OrionPreparedSubtitleResult(
  val tracks: JSONArray = JSONArray(),
  val bundleEntries: JSONArray = JSONArray(),
  val bytes: Long = 0L,
)

/**
 * Ephemeral provider URL handoff + durable URL-free selected-subtitle staging.
 * Provider URLs live only in this process map. Once selected bytes are staged,
 * recovery and finalization need only local files and a bounded local manifest.
 */
internal object OrionDownloadSubtitleRuntime {
  private const val CONNECT_TIMEOUT_MS = 15_000
  private const val READ_TIMEOUT_MS = 20_000
  private const val MAX_SOURCE_BYTES = 5L * 1024L * 1024L
  private const val MAX_EXTRACTED_BYTES = 10L * 1024L * 1024L
  private const val MAX_ZIP_ENTRIES = 64
  private val sources = mutableMapOf<String, JSONArray>()

  @Synchronized
  fun register(jobId: String, input: JSONArray?, selectedIds: JSONArray?) {
    if (jobId.isBlank() || input == null || selectedIds == null) return
    val selected = linkedSetOf<String>()
    for (index in 0 until selectedIds.length()) cleanId(selectedIds.optString(index))?.let(selected::add)
    val safe = JSONArray()
    for (index in 0 until input.length()) {
      if (safe.length() >= 2) break
      val source = input.optJSONObject(index) ?: continue
      val id = cleanId(source.optString("id")) ?: continue
      if (!selected.contains(id)) continue
      val provider = source.optString("provider").takeIf { it == "subdl" || it == "wyzie" } ?: continue
      val url = cleanText(source.optString("url"), 1600) ?: continue
      val parsed = try { URI(url) } catch (_: Throwable) { null } ?: continue
      if (parsed.scheme != "https" || parsed.host.isNullOrBlank()) continue
      val language = cleanText(source.optString("language"), 12) ?: "und"
      val label = cleanText(source.optString("label"), 120) ?: "${language.uppercase()} subtitle"
      val format = source.optString("format").takeIf { it in setOf("vtt", "srt", "ass", "unknown") } ?: "unknown"
      safe.put(JSONObject()
        .put("id", id)
        .put("provider", provider)
        .put("language", language)
        .put("label", label)
        .put("format", format)
        .put("url", url))
    }
    if (safe.length() > 0) sources[jobId] = safe
  }

  @Synchronized
  fun release(jobId: String) {
    sources.remove(jobId)
  }

  fun prepare(context: Context, jobId: String) {
    val root = stagingRoot(context, jobId)
    val manifest = File(root, "selection.json")
    if (manifest.isFile && manifest.length() > 0L) {
      release(jobId)
      return
    }
    val captured = synchronized(this) { sources[jobId]?.let { JSONArray(it.toString()) } } ?: return
    if (root.exists()) root.deleteRecursively()
    root.mkdirs()
    val entries = JSONArray()
    for (index in 0 until captured.length()) {
      val source = captured.optJSONObject(index) ?: continue
      val prepared = prepareOne(root, source, index) ?: continue
      entries.put(prepared)
    }
    if (entries.length() > 0) {
      try {
        manifest.writeText(JSONObject().put("schemaVersion", 1).put("entries", entries).toString(), Charsets.UTF_8)
      } catch (_: Throwable) {
        root.deleteRecursively()
      }
    } else {
      root.deleteRecursively()
    }
    release(jobId)
  }

  fun finalizeInto(context: Context, jobId: String, finalDir: File): OrionPreparedSubtitleResult {
    val root = stagingRoot(context, jobId)
    val manifest = readManifest(root) ?: return OrionPreparedSubtitleResult()
    val entries = manifest.optJSONArray("entries") ?: return OrionPreparedSubtitleResult()
    val subtitleDir = File(finalDir, "subtitles")
    subtitleDir.mkdirs()
    val tracks = JSONArray()
    val bundleEntries = JSONArray()
    var bytes = 0L
    for (index in 0 until entries.length()) {
      val entry = entries.optJSONObject(index) ?: continue
      val fileName = cleanFileName(entry.optString("fileName")) ?: continue
      val source = File(root, fileName)
      if (!source.isFile || source.length() <= 0L || source.length() > MAX_EXTRACTED_BYTES) continue
      val destination = File(subtitleDir, "subtitle-${index.toString().padStart(2, '0')}.${fileName.substringAfterLast('.', "srt")}")
      try {
        source.inputStream().use { input -> destination.outputStream().use { output -> input.copyTo(output) } }
      } catch (_: Throwable) {
        destination.delete()
        continue
      }
      if (!destination.isFile || destination.length() != source.length()) continue
      val id = cleanId(entry.optString("id")) ?: continue
      val provider = entry.optString("provider").takeIf { it == "subdl" || it == "wyzie" } ?: continue
      val language = cleanText(entry.optString("language"), 12) ?: "und"
      val label = cleanText(entry.optString("label"), 120) ?: "${language.uppercase()} subtitle"
      val format = destination.extension.lowercase().takeIf { it in setOf("vtt", "srt", "ass") } ?: "srt"
      tracks.put(JSONObject()
        .put("id", id)
        .put("kind", "subtitle")
        .put("language", language)
        .put("label", label)
        .put("format", format)
        .put("default", tracks.length() == 0))
      bundleEntries.put(JSONObject()
        .put("id", id)
        .put("provider", provider)
        .put("language", language)
        .put("name", "subtitles/${destination.name}")
        .put("size", destination.length()))
      bytes += destination.length()
    }
    if (tracks.length() == 0) subtitleDir.deleteRecursively()
    return OrionPreparedSubtitleResult(tracks, bundleEntries, bytes)
  }

  fun cleanup(context: Context, jobId: String) {
    release(jobId)
    try { stagingRoot(context, jobId).deleteRecursively() } catch (_: Throwable) {}
  }

  fun localProofs(context: Context, jobId: String): List<OrionLocalArtifactProof> {
    val root = stagingRoot(context, jobId)
    val entries = readManifest(root)?.optJSONArray("entries") ?: return emptyList()
    val proofs = mutableListOf<OrionLocalArtifactProof>()
    for (index in 0 until entries.length()) {
      val entry = entries.optJSONObject(index) ?: return emptyList()
      val fileName = cleanFileName(entry.optString("fileName")) ?: return emptyList()
      val proof = OrionDownloadFinalizationManifest.proof(File(root, fileName), index, "subtitle") ?: return emptyList()
      if (entry.optLong("size", -1L) != proof.sizeBytes) return emptyList()
      proofs.add(proof)
    }
    return proofs
  }

  fun validateLocalProofs(context: Context, jobId: String, proofs: List<OrionLocalArtifactProof>): Boolean {
    val root = stagingRoot(context, jobId)
    val entries = readManifest(root)?.optJSONArray("entries") ?: return proofs.isEmpty()
    if (entries.length() != proofs.size) return false
    for (proof in proofs) {
      val entry = entries.optJSONObject(proof.index) ?: return false
      val fileName = cleanFileName(entry.optString("fileName")) ?: return false
      if (!OrionDownloadFinalizationManifest.validateFile(File(root, fileName), proof)) return false
    }
    return true
  }

  fun hasLocalSelection(context: Context, jobId: String, expectedCount: Int): Boolean {
    if (expectedCount <= 0) return true
    val root = stagingRoot(context, jobId)
    val entries = readManifest(root)?.optJSONArray("entries") ?: return false
    if (entries.length() != expectedCount) return false
    for (index in 0 until entries.length()) {
      val entry = entries.optJSONObject(index) ?: return false
      val fileName = cleanFileName(entry.optString("fileName")) ?: return false
      val file = File(root, fileName)
      if (!file.isFile || file.length() <= 0L || file.length() != entry.optLong("size", -1L)) return false
    }
    return true
  }

  private fun prepareOne(root: File, source: JSONObject, index: Int): JSONObject? {
    val provider = source.optString("provider")
    val url = source.optString("url")
    val id = cleanId(source.optString("id")) ?: return null
    val payload = File(root, "source-$index.part")
    if (!downloadBounded(url, payload)) return null
    val output = if (provider == "subdl") {
      extractFirstSubtitle(payload, root, index)
    } else {
      val format = source.optString("format").takeIf { it in setOf("vtt", "srt", "ass") } ?: run {
        payload.delete()
        return null
      }
      val file = File(root, "selected-$index.$format")
      if (!payload.renameTo(file)) {
        try { payload.copyTo(file, overwrite = true); payload.delete() } catch (_: Throwable) { return null }
      }
      file
    } ?: run { payload.delete(); return null }
    payload.delete()
    if (!output.isFile || output.length() <= 0L || output.length() > MAX_EXTRACTED_BYTES) {
      output.delete()
      return null
    }
    return JSONObject()
      .put("id", id)
      .put("provider", provider)
      .put("language", cleanText(source.optString("language"), 12) ?: "und")
      .put("label", cleanText(source.optString("label"), 120) ?: "Subtitle")
      .put("fileName", output.name)
      .put("size", output.length())
  }

  private fun downloadBounded(url: String, destination: File): Boolean {
    var connection: HttpURLConnection? = null
    return try {
      val active = URL(url).openConnection() as HttpURLConnection
      connection = active
      active.instanceFollowRedirects = true
      active.connectTimeout = CONNECT_TIMEOUT_MS
      active.readTimeout = READ_TIMEOUT_MS
      active.useCaches = false
      active.requestMethod = "GET"
      active.setRequestProperty("User-Agent", "Orion")
      val status = active.responseCode
      if (status !in 200..299 || active.url.protocol != "https") return false
      val declared = active.getHeaderFieldLong("Content-Length", -1L)
      if (declared > MAX_SOURCE_BYTES) return false
      var written = 0L
      destination.outputStream().buffered().use { output ->
        active.inputStream.use { input ->
          val buffer = ByteArray(16 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (read == 0) continue
            written += read
            if (written > MAX_SOURCE_BYTES) throw java.io.IOException("Subtitle payload exceeds bound")
            output.write(buffer, 0, read)
          }
        }
      }
      written > 0L && destination.length() == written
    } catch (_: Throwable) {
      destination.delete()
      false
    } finally {
      try { connection?.disconnect() } catch (_: Throwable) {}
    }
  }

  private fun extractFirstSubtitle(zipFile: File, root: File, index: Int): File? {
    var entryCount = 0
    var extractedBytes = 0L
    return try {
      ZipInputStream(zipFile.inputStream().buffered()).use { zip ->
        while (true) {
          val entry = zip.nextEntry ?: break
          entryCount += 1
          if (entryCount > MAX_ZIP_ENTRIES) return null
          val safeName = safeZipEntryName(entry.name)
          if (!entry.isDirectory && safeName != null) {
            val ext = safeName.substringAfterLast('.', "").lowercase()
            if (ext in setOf("vtt", "srt", "ass", "ssa")) {
              val normalizedExt = if (ext == "ssa") "ass" else ext
              val output = File(root, "selected-$index.$normalizedExt")
              output.outputStream().buffered().use { sink ->
                val buffer = ByteArray(16 * 1024)
                while (true) {
                  val read = zip.read(buffer)
                  if (read < 0) break
                  if (read == 0) continue
                  extractedBytes += read
                  if (extractedBytes > MAX_EXTRACTED_BYTES) throw java.io.IOException("Subtitle archive exceeds bound")
                  sink.write(buffer, 0, read)
                }
              }
              return output.takeIf { it.isFile && it.length() > 0L }
            }
          }
          zip.closeEntry()
        }
      }
      null
    } catch (_: Throwable) {
      null
    }
  }

  private fun readManifest(root: File): JSONObject? = try {
    val file = File(root, "selection.json")
    if (!file.isFile || file.length() !in 1..(64L * 1024L)) null else JSONObject(file.readText(Charsets.UTF_8)).takeIf { it.optInt("schemaVersion") == 1 }
  } catch (_: Throwable) { null }

  private fun stagingRoot(context: Context, jobId: String) = File(context.filesDir, "orion-downloads/subtitles/${jobId.take(120)}")
  private fun cleanId(value: String): String? = value.trim().takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,100}$")) }
  private fun cleanText(value: String, max: Int): String? = value.replace(Regex("[\\u0000-\\u001f\\u007f]"), "").trim().take(max).takeIf { it.isNotBlank() }
  private fun cleanFileName(value: String): String? = value.takeIf { it.matches(Regex("^[A-Za-z0-9._-]{1,120}$")) }
  private fun safeZipEntryName(value: String): String? {
    val normalized = value.replace('\\', '/').trim()
    if (normalized.isBlank() || normalized.startsWith('/') || normalized.length > 240) return null
    if (normalized.split('/').any { it == ".." || it.isBlank() }) return null
    return normalized
  }
}
