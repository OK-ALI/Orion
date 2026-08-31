package com.okali.orion.playback

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.provider.DocumentsContract
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.OutputStream
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject

internal data class OrionFinalizedArtifactProof(
  val file: File,
  val relativeLocator: String,
  val sizeBytes: Long,
  val sha256: String,
  val contentUri: Uri,
  val mediaVerification: OrionFinalizedMediaVerification,
)

internal sealed class OrionFinalizedArtifactSettlement {
  data class Verified(val proof: OrionFinalizedArtifactProof) : OrionFinalizedArtifactSettlement()
  data class Failed(
    val code: String,
    val message: String,
    val retryable: Boolean,
  ) : OrionFinalizedArtifactSettlement()
}

internal data class OrionFinalizedDocumentProof(
  val contentUri: Uri,
  val targetId: String,
  val displayName: String,
  val sizeBytes: Long,
  val sha256: String,
  val mediaVerification: OrionFinalizedMediaVerification,
)

internal sealed class OrionFinalizedDocumentSettlement {
  data class Verified(val proof: OrionFinalizedDocumentProof) : OrionFinalizedDocumentSettlement()
  data class Failed(val code: String, val message: String, val retryable: Boolean, val actionRequired: Boolean = false) : OrionFinalizedDocumentSettlement()
  data object Cancelled : OrionFinalizedDocumentSettlement()
}

internal data class OrionFinalizedSubtitleDocumentProof(
  val trackId: String,
  val contentUri: Uri,
  val targetId: String,
  val displayName: String,
  val mimeType: String,
  val sizeBytes: Long,
  val sha256: String,
)

internal sealed class OrionFinalizedSubtitleDocumentSettlement {
  data class Verified(val proofs: List<OrionFinalizedSubtitleDocumentProof>) : OrionFinalizedSubtitleDocumentSettlement()
  data class Failed(val code: String, val message: String, val retryable: Boolean, val actionRequired: Boolean = false) : OrionFinalizedSubtitleDocumentSettlement()
  data object Cancelled : OrionFinalizedSubtitleDocumentSettlement()
}

/** Pure deterministic contracts used by production settlement and JVM tests. */
internal object OrionFinalizedArtifactPolicy {
  const val VERIFICATION_VERSION = 2
  private val JOB_ID = Regex("^[A-Za-z0-9._:-]{1,120}$")

  data class OutputEntry(val name: String, val isFile: Boolean, val sizeBytes: Long)

  fun finalizedOutput(entries: List<OutputEntry>): String? {
    if (entries.size != 1) return null
    val entry = entries.single()
    return entry.name.takeIf {
      entry.isFile && entry.sizeBytes > 0L && it.equals("media.mp4", ignoreCase = false)
    }
  }

  fun relativeLocator(jobId: String): String? =
    jobId.takeIf { JOB_ID.matches(it) }?.let { "$it.mp4" }

  fun finalDisplayName(
    title: String?,
    year: Int?,
    seriesTitle: String?,
    season: Int?,
    episode: Int?,
    episodeTitle: String?,
  ): String {
    val primary = seriesTitle?.trim().takeUnless { it.isNullOrBlank() }
      ?: title?.trim().takeUnless { it.isNullOrBlank() }
      ?: "Orion Download"
    val raw = if (season != null && season >= 0 && episode != null && episode >= 0) {
      buildString {
        append(primary)
        append(" - S")
        append(season.toString().padStart(2, '0'))
        append('E')
        append(episode.toString().padStart(2, '0'))
        episodeTitle?.trim()?.takeIf { it.isNotBlank() }?.let { append(" - ").append(it) }
      }
    } else {
      primary + (year?.takeIf { it in 1878..9999 }?.let { " ($it)" } ?: "")
    }
    return OrionSafDocumentNamePolicy.sanitize("$raw.mp4", "Orion Download.mp4")
  }

  fun metadataText(value: Any?): String? = (value as? String)
    ?.replace(Regex("[\\u0000-\\u001f\\u007f]"), "")
    ?.trim()
    ?.takeIf { it.isNotBlank() && !it.equals("null", true) && !it.equals("undefined", true) }

  fun subtitleDisplayName(
    mediaDisplayName: String,
    language: String?,
    provider: String?,
    format: String,
    languageCollision: Boolean,
  ): String? {
    val extension = format.lowercase().takeIf { it in setOf("srt", "vtt", "ass") } ?: return null
    val stem = mediaDisplayName.removeSuffix(".mp4").removeSuffix(".MP4").trim()
      .ifBlank { "Orion Download" }
    val languageTag = language.orEmpty().lowercase().replace(Regex("[^a-z0-9-]"), "").take(12).ifBlank { "und" }
    val providerTag = provider.orEmpty().lowercase().takeIf { it in setOf("subdl", "wyzie") }
    val identity = if (languageCollision && providerTag != null) ".$providerTag" else ""
    val suffix = ".$extension"
    return OrionSafDocumentNamePolicy.sanitizePreservingExtension(
      "$stem.$languageTag$identity$suffix",
      "Orion Download.$languageTag$identity$suffix",
      suffix,
    )
  }

  fun durableProofMatches(
    expectedSizeBytes: Long,
    actualSizeBytes: Long,
    sha256: String,
    descriptorSizeBytes: Long,
    verificationOk: Boolean,
  ): Boolean = expectedSizeBytes > 0L &&
    actualSizeBytes == expectedSizeBytes &&
    descriptorSizeBytes == actualSizeBytes &&
    sha256.matches(Regex("^[a-f0-9]{64}$")) &&
    verificationOk

  fun documentProofMatches(
    expectedSizeBytes: Long,
    streamedSizeBytes: Long,
    metadataSizeBytes: Long?,
    sourceSha256: String,
    documentSha256: String,
    descriptorAccessible: Boolean,
    verificationOk: Boolean,
  ): Boolean = expectedSizeBytes > 0L && streamedSizeBytes == expectedSizeBytes &&
    (metadataSizeBytes == null || metadataSizeBytes == expectedSizeBytes) &&
    sourceSha256.matches(Regex("^[a-f0-9]{64}$")) && sourceSha256 == documentSha256 &&
    descriptorAccessible && verificationOk

  fun verificationStampMatches(
    verificationVersion: Int,
    verifiedByteCount: Long,
    expectedSizeBytes: Long,
    sha256: String,
  ): Boolean = verificationVersion == VERIFICATION_VERSION &&
    expectedSizeBytes > 0L &&
    verifiedByteCount == expectedSizeBytes &&
    sha256.matches(Regex("^[a-f0-9]{64}$"))
}

/**
 * Sole owner of a new Orion Library yt-dlp artifact from durable settlement
 * through FileProvider proof. Nothing may be persisted as Verified before this
 * owner returns [OrionFinalizedArtifactSettlement.Verified].
 */
internal object OrionFinalizedArtifactOwner {
  private const val HASH_BUFFER_BYTES = 1024 * 1024
  private const val TAG = "OrionFinalizedMedia"

  private sealed class DocumentWriteResult {
    data class Success(
      val sha256: String,
      val bytesWritten: Long,
      val mode: OrionSafPublicationWritePolicy.Mode,
      val syncOutcome: OrionSafPublicationWritePolicy.SyncOutcome,
      val closeOutcome: OrionSafPublicationWritePolicy.CloseOutcome,
    ) : DocumentWriteResult()
    data class Failed(
      val stage: String,
      val mode: OrionSafPublicationWritePolicy.Mode?,
      val bytesWritten: Long,
      val exceptionClass: String,
    ) : DocumentWriteResult()
    data object Cancelled : DocumentWriteResult()
  }

  private sealed class DocumentInfoReadiness {
    data class Ready(val info: OrionDownloadStorageRegistry.DocumentInfo) : DocumentInfoReadiness()
    data object Failed : DocumentInfoReadiness()
    data object Cancelled : DocumentInfoReadiness()
  }

  private enum class DescriptorReadiness { READY, FAILED, CANCELLED }

  private data class DocumentCopyProof(val sha256: String, val bytesWritten: Long)

  private class DocumentWriteStageException(
    val stage: String,
    val bytesWritten: Long,
    cause: Throwable? = null,
  ) : Exception(stage, cause)

  fun stagingOutput(directory: File): File? {
    val files = directory.listFiles().orEmpty().filter { it.isFile }
    val name = OrionFinalizedArtifactPolicy.finalizedOutput(files.map {
      OrionFinalizedArtifactPolicy.OutputEntry(it.name, it.isFile, it.length())
    }) ?: return null
    return File(directory, name).takeIf {
      OrionDownloadOwnershipPolicy.canonicalContained(directory, it)
    }
  }

  fun finalFile(context: Context, jobId: String): File? {
    val relative = OrionFinalizedArtifactPolicy.relativeLocator(jobId) ?: return null
    val root = File(context.filesDir, "orion-downloads/library")
    val target = File(root, relative)
    return target.takeIf { OrionDownloadOwnershipPolicy.canonicalContained(root, it) }
  }

  fun settleToUserFolder(
    context: Context,
    jobId: String,
    generation: Long,
    source: File,
    targetId: String,
    media: JSONObject,
    requireAudio: Boolean,
  ): OrionFinalizedDocumentSettlement {
    if (OrionFinalizedArtifactPolicy.relativeLocator(jobId) == null) {
      return documentFailed("finalized-artifact-job-invalid", "The finalized download identity is invalid.", false)
    }
    val target = OrionDownloadStorageRegistry.describe(context, targetId)
      ?: return documentFailed("storage-destination-unavailable", "Choose the Orion Library storage folder again and retry finalization.", true, true)
    if (!target.writable || !target.persistedPermission) {
      return documentFailed("storage-destination-unavailable", "Choose the Orion Library storage folder again and retry finalization.", true, true)
    }
    val finalName = OrionFinalizedArtifactPolicy.finalDisplayName(
      title = OrionFinalizedArtifactPolicy.metadataText(media.opt("title")),
      year = media.opt("year").takeUnless { it == null || it == JSONObject.NULL }?.toString()?.toIntOrNull(),
      seriesTitle = OrionFinalizedArtifactPolicy.metadataText(media.opt("seriesTitle")),
      season = media.opt("season").takeUnless { it == null || it == JSONObject.NULL }?.toString()?.toIntOrNull(),
      episode = media.opt("episode").takeUnless { it == null || it == JSONObject.NULL }?.toString()?.toIntOrNull(),
      episodeTitle = OrionFinalizedArtifactPolicy.metadataText(media.opt("episodeTitle")),
    )

    recoverPendingDocument(context, jobId, generation, targetId, requireAudio)?.let { recovered ->
      if (recovered is OrionFinalizedDocumentSettlement.Verified) return recovered
      if (recovered is OrionFinalizedDocumentSettlement.Failed && recovered.actionRequired) return recovered
    }

    if (!source.isFile || source.length() <= 0L) {
      return documentFailed("finalized-artifact-source-missing", "The finalized download source is missing.", false)
    }
    val expectedBytes = source.length()
    val destinationFreeBytes = OrionDownloadStorageRegistry.freeBytes(context, targetId)
    if (OrionSafPhysicalStoragePolicy.isConclusiveInsufficient(expectedBytes, destinationFreeBytes)) {
      return documentFailed(
        "storage-destination-insufficient",
        "The selected storage folder does not have enough free space for this completed download. Free up space and retry finalization.",
        true,
        true,
      )
    }

    if (!canContinue(jobId, generation)) return OrionFinalizedDocumentSettlement.Cancelled
    val temporaryName = "Orion-${jobId.takeLast(8)}.partial.mp4"
    var document = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", temporaryName)
      ?: return documentFailed("finalized-artifact-document-create-failed", "Orion could not create the final media document in the selected folder.", true, true)
    if (!journal(context, jobId, generation, targetId, document, finalName, temporaryName, "created")) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }
    var info = when (val readiness = awaitDocumentInfo(context, document, null) { canContinue(jobId, generation) }) {
      is DocumentInfoReadiness.Ready -> readiness.info
      DocumentInfoReadiness.Cancelled -> {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
      DocumentInfoReadiness.Failed -> return cleanupFailedPublication(
        context,
        jobId,
        generation,
        document,
        "finalized-artifact-document-unavailable",
        "Orion could not inspect the new media document.",
      )
    }
    if (!journal(context, jobId, generation, targetId, document, finalName, info.displayName, "inspected")) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }
    val canRename = info.flags and DocumentsContract.Document.FLAG_SUPPORTS_RENAME != 0
    if (!canRename) {
      when (cleanupDocument(context, document)) {
        OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> return documentFailed(
          "finalized-artifact-cleanup-unavailable",
          "Orion could not safely clean up a temporary document in the selected folder.",
          true,
          true,
        )
        else -> Unit
      }
      OrionDownloadJobStore.clearPendingPublication(jobId, generation)
      document = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", finalName)
        ?: return documentFailed("finalized-artifact-document-create-failed", "Orion could not create the final media document in the selected folder.", true, true)
      if (!journal(context, jobId, generation, targetId, document, finalName, finalName, "created-final")) {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
      info = when (val readiness = awaitDocumentInfo(context, document, null) { canContinue(jobId, generation) }) {
        is DocumentInfoReadiness.Ready -> readiness.info
        DocumentInfoReadiness.Cancelled -> {
          cleanupDocument(context, document)
          return OrionFinalizedDocumentSettlement.Cancelled
        }
        DocumentInfoReadiness.Failed -> return cleanupFailedPublication(
          context,
          jobId,
          generation,
          document,
          "finalized-artifact-document-unavailable",
          "Orion could not inspect the final media document.",
        )
      }
      if (!journal(context, jobId, generation, targetId, document, finalName, info.displayName, "inspected-final")) {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
    }

    val write = writeDocument(context, document, source, expectedBytes) { canContinue(jobId, generation) }
    var written = when (write) {
      DocumentWriteResult.Cancelled -> {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
      is DocumentWriteResult.Failed -> return cleanupFailedPublication(
        context,
        jobId,
        generation,
        document,
        "finalized-artifact-${OrionSafPublicationWritePolicy.failureCode(write.stage)}",
        publicationFailureMessage(write.stage),
      )
      is DocumentWriteResult.Success -> write
    }
    var sourceDigest = written.sha256
    info = when (val readiness = awaitDocumentInfo(context, document, expectedBytes) { canContinue(jobId, generation) }) {
      is DocumentInfoReadiness.Ready -> readiness.info
      DocumentInfoReadiness.Cancelled -> {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
      DocumentInfoReadiness.Failed -> return cleanupFailedPublication(
        context,
        jobId,
        generation,
        document,
        "finalized-artifact-document-unavailable",
        "Orion could not reopen the completed media document.",
      )
    }
    val copiedStage = when {
      written.syncOutcome == OrionSafPublicationWritePolicy.SyncOutcome.FAILED ||
        written.closeOutcome == OrionSafPublicationWritePolicy.CloseOutcome.FAILED -> "copied-durability-deferred"
      written.mode == OrionSafPublicationWritePolicy.Mode.EXCLUSIVE_W -> "copied-exclusive"
      else -> "copied"
    }
    if (!journal(context, jobId, generation, targetId, document, finalName, info.displayName, copiedStage, expectedBytes, sourceDigest)) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }

    if (canRename) {
      val renamed = OrionDownloadStorageRegistry.renameDocument(context, document, finalName)
      if (renamed == null) {
        logSafTransition(null, "rename-failed", SystemClock.elapsedRealtime(), expectedBytes, null)
        when (cleanupDocument(context, document)) {
          OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> return documentFailed(
            "finalized-artifact-cleanup-unavailable",
            "Orion could not safely remove the temporary media document after a rename failure.",
            true,
            true,
          )
          else -> Unit
        }
        OrionDownloadJobStore.clearPendingPublication(jobId, generation)
        document = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", finalName)
          ?: return documentFailed(
            "finalized-artifact-document-create-failed",
            "Orion could not create the final media document after the storage provider rejected rename.",
            true,
            true,
          )
        if (!journal(context, jobId, generation, targetId, document, finalName, finalName, "rename-fallback-created")) {
          cleanupDocument(context, document)
          return OrionFinalizedDocumentSettlement.Cancelled
        }
        info = when (val readiness = awaitDocumentInfo(context, document, null) { canContinue(jobId, generation) }) {
          is DocumentInfoReadiness.Ready -> readiness.info
          DocumentInfoReadiness.Cancelled -> {
            cleanupDocument(context, document)
            return OrionFinalizedDocumentSettlement.Cancelled
          }
          DocumentInfoReadiness.Failed -> return cleanupFailedPublication(
            context,
            jobId,
            generation,
            document,
            "finalized-artifact-document-unavailable",
            "Orion could not inspect the replacement media document.",
          )
        }
        written = when (val fallbackWrite = writeDocument(
          context,
          document,
          source,
          expectedBytes,
        ) { canContinue(jobId, generation) }) {
          DocumentWriteResult.Cancelled -> {
            cleanupDocument(context, document)
            return OrionFinalizedDocumentSettlement.Cancelled
          }
          is DocumentWriteResult.Failed -> return cleanupFailedPublication(
            context,
            jobId,
            generation,
            document,
            "finalized-artifact-${OrionSafPublicationWritePolicy.failureCode(fallbackWrite.stage)}",
            publicationFailureMessage(fallbackWrite.stage),
          )
          is DocumentWriteResult.Success -> fallbackWrite
        }
        sourceDigest = written.sha256
        info = when (val readiness = awaitDocumentInfo(context, document, expectedBytes) { canContinue(jobId, generation) }) {
          is DocumentInfoReadiness.Ready -> readiness.info
          DocumentInfoReadiness.Cancelled -> {
            cleanupDocument(context, document)
            return OrionFinalizedDocumentSettlement.Cancelled
          }
          DocumentInfoReadiness.Failed -> return cleanupFailedPublication(
            context,
            jobId,
            generation,
            document,
            "finalized-artifact-document-unavailable",
            "Orion could not reopen the replacement media document.",
          )
        }
        if (!journal(
            context,
            jobId,
            generation,
            targetId,
            document,
            finalName,
            info.displayName,
            "rename-fallback-copied",
            expectedBytes,
            sourceDigest,
          )
        ) {
          cleanupDocument(context, document)
          return OrionFinalizedDocumentSettlement.Cancelled
        }
      } else {
        document = renamed
        if (!journal(context, jobId, generation, targetId, document, finalName, finalName, "renamed")) {
          cleanupDocument(context, document)
          return OrionFinalizedDocumentSettlement.Cancelled
        }
        info = when (val readiness = awaitDocumentInfo(context, document, expectedBytes) { canContinue(jobId, generation) }) {
          is DocumentInfoReadiness.Ready -> readiness.info
          DocumentInfoReadiness.Cancelled -> {
            cleanupDocument(context, document)
            return OrionFinalizedDocumentSettlement.Cancelled
          }
          DocumentInfoReadiness.Failed -> return cleanupFailedPublication(
            context,
            jobId,
            generation,
            document,
            "finalized-artifact-document-unavailable",
            "Orion could not inspect the renamed media document.",
          )
        }
        if (!journal(context, jobId, generation, targetId, document, finalName, info.displayName, "renamed-inspected", expectedBytes, sourceDigest)) {
          cleanupDocument(context, document)
          return OrionFinalizedDocumentSettlement.Cancelled
        }
      }
    }

    if (!canContinue(jobId, generation)) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }
    when (awaitReadableDescriptor(context, document, expectedBytes) { canContinue(jobId, generation) }) {
      DescriptorReadiness.READY -> Unit
      DescriptorReadiness.CANCELLED -> {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
      DescriptorReadiness.FAILED -> return cleanupFailedPublication(
        context,
        jobId,
        generation,
        document,
        "finalized-artifact-descriptor-unavailable",
        "Orion could not reopen the completed media document for verification.",
      )
    }
    val settlement = verifyDocument(
      context,
      document,
      targetId,
      info.displayName,
      expectedBytes,
      sourceDigest,
      requireAudio,
    )
    if (!canContinue(jobId, generation)) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }
    if (settlement !is OrionFinalizedDocumentSettlement.Verified) {
      return when (cleanupDocument(context, document)) {
        OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> documentFailed(
          "finalized-artifact-cleanup-unavailable",
          "Orion could not safely remove a publication that failed final verification.",
          true,
          true,
        )
        else -> {
          OrionDownloadJobStore.clearPendingPublication(jobId, generation)
          settlement
        }
      }
    }
    if (!OrionSafPublicationWritePolicy.acceptsAfterDeepVerification(
        written.syncOutcome,
        written.closeOutcome,
        true,
      )
    ) {
      return cleanupFailedPublication(
        context,
        jobId,
        generation,
        document,
        "finalized-artifact-proof-mismatch",
        "The final media document did not satisfy Orion's publication proof.",
      )
    }
    return settlement
  }

  fun publishSubtitlesToUserFolder(
    context: Context,
    jobId: String,
    generation: Long,
    targetId: String,
    mediaDisplayName: String,
    subtitleDirectory: File,
    entries: JSONArray,
  ): OrionFinalizedSubtitleDocumentSettlement {
    if (entries.length() == 0) return OrionFinalizedSubtitleDocumentSettlement.Verified(emptyList())
    if (entries.length() > 2 || OrionDownloadStorageRegistry.describe(context, targetId) == null) {
      return subtitleFailed("subtitle-publication-target-unavailable", "Choose the Orion Library storage folder again before publishing subtitles.", true, true)
    }
    if (!cleanupPendingSubtitlePublications(context, jobId)) {
      return subtitleFailed("subtitle-publication-cleanup-unavailable", "Orion could not safely clean up an earlier subtitle publication.", true, true)
    }
    val root = try { subtitleDirectory.canonicalFile } catch (_: Throwable) {
      return subtitleFailed("subtitle-publication-source-invalid", "Selected subtitle staging could not be resolved.", false)
    }
    val languages = (0 until entries.length()).mapNotNull { index ->
      entries.optJSONObject(index)?.optString("language")?.lowercase()?.takeIf { it.isNotBlank() }
    }
    val languageCounts = languages.groupingBy { it }.eachCount()
    val pending = JSONArray()
    val proofs = mutableListOf<OrionFinalizedSubtitleDocumentProof>()

    for (index in 0 until entries.length()) {
      if (!canContinue(jobId, generation)) {
        cleanupPendingSubtitlePublications(context, jobId)
        return OrionFinalizedSubtitleDocumentSettlement.Cancelled
      }
      val entry = entries.optJSONObject(index)
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-metadata-invalid", "Selected subtitle metadata is incomplete.", false)
      val trackId = entry.optString("id").takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,100}$")) }
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-metadata-invalid", "Selected subtitle metadata is incomplete.", false)
      val relative = entry.optString("name").takeIf { it.matches(Regex("^subtitles/[A-Za-z0-9._-]{1,120}$")) }
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-source-invalid", "Selected subtitle staging is invalid.", false)
      val source = try { File(subtitleDirectory, relative).canonicalFile } catch (_: Throwable) { null }
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-source-invalid", "Selected subtitle staging is invalid.", false)
      val expectedBytes = entry.optLong("size", -1L)
      if (!OrionDownloadOwnershipPolicy.canonicalContained(root, source) || !source.isFile ||
        expectedBytes <= 0L || expectedBytes > 10L * 1024L * 1024L || source.length() != expectedBytes
      ) return subtitlePublicationFailure(context, jobId, "subtitle-publication-source-invalid", "Selected subtitle staging is missing or inconsistent.", false)
      val format = source.extension.lowercase().takeIf { it in setOf("srt", "vtt", "ass") }
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-format-invalid", "Selected subtitle format is unsupported.", false)
      val language = entry.optString("language").lowercase().replace(Regex("[^a-z0-9-]"), "").take(12).ifBlank { "und" }
      val provider = entry.optString("provider").takeIf { it in setOf("subdl", "wyzie") }
      val intendedName = OrionFinalizedArtifactPolicy.subtitleDisplayName(
        mediaDisplayName,
        language,
        provider,
        format,
        (languageCounts[language] ?: 0) > 1,
      ) ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-name-invalid", "Orion could not derive a safe subtitle filename.", false)
      val mimeType = when (format) {
        "srt" -> "application/x-subrip"
        "ass" -> "text/x-ssa"
        else -> "text/vtt"
      }
      val document = OrionDownloadStorageRegistry.createDocument(context, targetId, mimeType, intendedName)
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-create-failed", "Orion could not create a selected subtitle beside the media file.", true, true)
      val journal = JSONObject()
        .put("trackId", trackId)
        .put("targetId", targetId)
        .put("uri", document.toString())
        .put("intendedDisplayName", intendedName)
        .put("actualDisplayName", intendedName)
        .put("mimeType", mimeType)
        .put("sizeBytes", expectedBytes)
        .put("stage", "created")
      pending.put(journal)
      if (!OrionDownloadJobStore.setPendingSubtitlePublications(jobId, generation, pending)) {
        OrionDownloadStorageRegistry.deleteDocument(context, document)
        cleanupPendingSubtitlePublications(context, jobId)
        return OrionFinalizedSubtitleDocumentSettlement.Cancelled
      }
      val written = when (val write = writeDocument(context, document, source, expectedBytes) { canContinue(jobId, generation) }) {
        DocumentWriteResult.Cancelled -> {
          cleanupPendingSubtitlePublications(context, jobId)
          return OrionFinalizedSubtitleDocumentSettlement.Cancelled
        }
        is DocumentWriteResult.Failed -> return subtitlePublicationFailure(
          context,
          jobId,
          "subtitle-publication-${OrionSafPublicationWritePolicy.failureCode(write.stage)}",
          "Orion could not publish a selected subtitle.",
          true,
          true,
        )
        is DocumentWriteResult.Success -> write
      }
      val sourceDigest = written.sha256
      val info = OrionDownloadStorageRegistry.documentInfo(context, document)
        ?: return subtitlePublicationFailure(context, jobId, "subtitle-publication-document-unavailable", "Orion could not inspect a published subtitle.", true, true)
      val destinationDigest = sha256(context, document)
      val probe = OrionDownloadStorageRegistry.probeDocument(context, document)
      if (destinationDigest == null || destinationDigest.second != expectedBytes ||
        !destinationDigest.first.equals(sourceDigest, true) ||
        probe !is OrionDownloadStorageRegistry.DocumentProbe.Verified || probe.sizeBytes != expectedBytes
      ) return subtitlePublicationFailure(context, jobId, "subtitle-publication-proof-mismatch", "A published subtitle did not match its verified source.", false)
      journal
        .put("actualDisplayName", info.displayName)
        .put("sha256", destinationDigest.first)
        .put("stage", "verified")
      if (!OrionDownloadJobStore.setPendingSubtitlePublications(jobId, generation, pending)) {
        cleanupPendingSubtitlePublications(context, jobId)
        return OrionFinalizedSubtitleDocumentSettlement.Cancelled
      }
      proofs += OrionFinalizedSubtitleDocumentProof(
        trackId = trackId,
        contentUri = document,
        targetId = targetId,
        displayName = info.displayName,
        mimeType = mimeType,
        sizeBytes = expectedBytes,
        sha256 = destinationDigest.first,
      )
    }
    return OrionFinalizedSubtitleDocumentSettlement.Verified(proofs)
  }

  fun cleanupPendingSubtitlePublications(context: Context, jobId: String): Boolean {
    val pending = OrionDownloadJobStore.getJob(jobId)?.optJSONArray("_pendingSubtitlePublications") ?: return true
    var complete = true
    for (index in 0 until pending.length()) {
      val raw = pending.optJSONObject(index)?.optString("uri").orEmpty()
      val uri = try { Uri.parse(raw).takeIf { it.scheme == "content" } } catch (_: Throwable) { null }
      if (uri == null || OrionDownloadStorageRegistry.deleteDocument(context, uri) == OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable) {
        complete = false
      }
    }
    if (complete) OrionDownloadJobStore.clearPendingSubtitlePublications(jobId)
    return complete
  }

  private fun subtitlePublicationFailure(
    context: Context,
    jobId: String,
    code: String,
    message: String,
    retryable: Boolean,
    actionRequired: Boolean = false,
  ): OrionFinalizedSubtitleDocumentSettlement {
    val cleaned = cleanupPendingSubtitlePublications(context, jobId)
    return if (cleaned) subtitleFailed(code, message, retryable, actionRequired) else
      subtitleFailed("subtitle-publication-cleanup-unavailable", "Orion could not safely remove an incomplete subtitle publication.", true, true)
  }

  private fun subtitleFailed(code: String, message: String, retryable: Boolean, actionRequired: Boolean = false) =
    OrionFinalizedSubtitleDocumentSettlement.Failed(code, message, retryable, actionRequired)

  private fun recoverPendingDocument(
    context: Context,
    jobId: String,
    generation: Long,
    targetId: String,
    requireAudio: Boolean,
  ): OrionFinalizedDocumentSettlement? {
    val pending = OrionDownloadJobStore.getJob(jobId)?.optJSONObject("_pendingPublication") ?: return null
    val uri = try { Uri.parse(pending.optString("uri")) } catch (_: Throwable) { null } ?: return null
    if (uri.scheme != "content" || pending.optString("targetId") != targetId) return null
    val expectedBytes = pending.optLong("expectedSizeBytes", -1L)
    val expectedSha256 = pending.optString("expectedSha256")
    val info = OrionDownloadStorageRegistry.documentInfo(context, uri)
    if (info != null && expectedBytes > 0L && expectedSha256.matches(Regex("^[a-f0-9]{64}$"))) {
      val proof = verifyDocument(context, uri, targetId, info.displayName, expectedBytes, expectedSha256, requireAudio)
      if (proof is OrionFinalizedDocumentSettlement.Verified) {
        journal(context, jobId, generation, targetId, uri, pending.optString("intendedDisplayName"), info.displayName, "recovered", expectedBytes, expectedSha256)
        return proof
      }
    }
    return when (cleanupDocument(context, uri)) {
      OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> documentFailed(
        "finalized-artifact-cleanup-unavailable",
        "Orion could not verify or remove an incomplete publication from the selected folder.",
        true,
        true,
      )
      else -> {
        OrionDownloadJobStore.clearPendingPublication(jobId)
        null
      }
    }
  }

  private fun verifyDocument(
    context: Context,
    uri: Uri,
    targetId: String,
    displayName: String,
    expectedBytes: Long,
    expectedSha256: String,
    requireAudio: Boolean,
  ): OrionFinalizedDocumentSettlement {
    val info = OrionDownloadStorageRegistry.documentInfo(context, uri)
      ?: return documentFailed("finalized-artifact-document-unavailable", "Orion could not reopen the completed media document.", true, true)
    if (info.mimeType != null && info.mimeType != "video/mp4") {
      return documentFailed("finalized-artifact-mime-invalid", "The selected storage provider did not preserve the MP4 media type.", false)
    }
    val hashed = sha256(context, uri)
      ?: return documentFailed("finalized-artifact-read-failed", "Orion could not read the complete media document from the selected folder.", true, true)
    if (hashed.second != expectedBytes || !hashed.first.equals(expectedSha256, true) ||
      (info.sizeBytes != null && info.sizeBytes != expectedBytes)
    ) {
      return documentFailed("finalized-artifact-proof-mismatch", "The final media document does not match the completed download.", false)
    }
    val descriptorAccessible = try {
      context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        val stat = descriptor.statSize
        stat < 0L || stat == expectedBytes
      } == true
    } catch (_: Throwable) { false }
    if (!descriptorAccessible) {
      return documentFailed("finalized-artifact-descriptor-unavailable", "Orion could not open the final media document for playback.", true, true)
    }
    val verification = OrionFinalizedMediaVerifier.verify(context, uri, displayName, expectedBytes, requireAudio)
    if (!verification.ok) return documentFailed(verification.code, verification.message, false)
    if (!OrionFinalizedArtifactPolicy.documentProofMatches(
        expectedBytes,
        hashed.second,
        info.sizeBytes,
        expectedSha256.lowercase(),
        hashed.first.lowercase(),
        descriptorAccessible,
        verification.ok,
      )) {
      return documentFailed("finalized-artifact-proof-mismatch", "The final media document does not match the completed download.", false)
    }
    return OrionFinalizedDocumentSettlement.Verified(
      OrionFinalizedDocumentProof(uri, targetId, displayName, expectedBytes, hashed.first, verification),
    )
  }

  private fun writeDocument(
    context: Context,
    document: Uri,
    source: File,
    expectedBytes: Long,
    canContinue: () -> Boolean,
  ): DocumentWriteResult {
    val startedAt = SystemClock.elapsedRealtime()
    var exclusiveOpenError: Throwable? = null
    val exclusive = try {
      context.contentResolver.openOutputStream(document, "w")
    } catch (error: Throwable) {
      exclusiveOpenError = error
      null
    }
    if (exclusive != null) {
      logSafTransition(OrionSafPublicationWritePolicy.Mode.EXCLUSIVE_W, "open", startedAt, 0L, null)
      return writeOwnedDocumentStream(
        exclusive,
        source,
        expectedBytes,
        OrionSafPublicationWritePolicy.Mode.EXCLUSIVE_W,
        startedAt,
        canContinue,
      ) { OrionSafPublicationWritePolicy.SyncOutcome.UNSUPPORTED }
    }
    logSafTransition(
      OrionSafPublicationWritePolicy.Mode.EXCLUSIVE_W,
      "open-failed",
      startedAt,
      0L,
      exclusiveOpenError,
    )
    if (!OrionSafPublicationWritePolicy.shouldFallbackToSeekable(false, 0L)) {
      return documentWriteFailure("descriptor-open", OrionSafPublicationWritePolicy.Mode.EXCLUSIVE_W, 0L, exclusiveOpenError)
    }

    var seekableOpenError: Throwable? = null
    val descriptor = try {
      context.contentResolver.openFileDescriptor(document, "rwt")
    } catch (error: Throwable) {
      seekableOpenError = error
      null
    } ?: return documentWriteFailure(
      "descriptor-open",
      OrionSafPublicationWritePolicy.Mode.SEEKABLE_RWT,
      0L,
      seekableOpenError,
    )
    val output = try {
      ParcelFileDescriptor.AutoCloseOutputStream(descriptor)
    } catch (error: Throwable) {
      try { descriptor.close() } catch (_: Throwable) { Unit }
      return documentWriteFailure(
        "descriptor-open",
        OrionSafPublicationWritePolicy.Mode.SEEKABLE_RWT,
        0L,
        error,
      )
    }
    logSafTransition(OrionSafPublicationWritePolicy.Mode.SEEKABLE_RWT, "open", startedAt, 0L, null)
    return writeOwnedDocumentStream(
      output,
      source,
      expectedBytes,
      OrionSafPublicationWritePolicy.Mode.SEEKABLE_RWT,
      startedAt,
      canContinue,
    ) {
      try {
        output.fd.sync()
        OrionSafPublicationWritePolicy.SyncOutcome.SYNCED
      } catch (_: Throwable) {
        OrionSafPublicationWritePolicy.SyncOutcome.FAILED
      }
    }
  }

  private fun writeOwnedDocumentStream(
    output: OutputStream,
    source: File,
    expectedBytes: Long,
    mode: OrionSafPublicationWritePolicy.Mode,
    startedAt: Long,
    canContinue: () -> Boolean,
    sync: () -> OrionSafPublicationWritePolicy.SyncOutcome,
  ): DocumentWriteResult {
    val result: DocumentWriteResult = try {
      val proof = writeDocumentBytes(source, expectedBytes, output, canContinue)
      logSafTransition(mode, "flush", startedAt, proof.bytesWritten, null)
      val syncOutcome = sync()
      logSafTransition(mode, "sync-${syncOutcome.name.lowercase()}", startedAt, proof.bytesWritten, null)
      DocumentWriteResult.Success(
        sha256 = proof.sha256,
        bytesWritten = proof.bytesWritten,
        mode = mode,
        syncOutcome = syncOutcome,
        closeOutcome = OrionSafPublicationWritePolicy.CloseOutcome.CLOSED,
      )
    } catch (_: InterruptedException) {
      DocumentWriteResult.Cancelled
    } catch (error: DocumentWriteStageException) {
      documentWriteFailure(error.stage, mode, error.bytesWritten, error.cause)
    } catch (error: Throwable) {
      documentWriteFailure("document-write", mode, 0L, error)
    }
    val closeOutcome = try {
      output.close()
      logSafTransition(mode, "close", startedAt, (result as? DocumentWriteResult.Success)?.bytesWritten ?: 0L, null)
      OrionSafPublicationWritePolicy.CloseOutcome.CLOSED
    } catch (error: Throwable) {
      logSafTransition(mode, "close-deferred", startedAt, (result as? DocumentWriteResult.Success)?.bytesWritten ?: 0L, error)
      OrionSafPublicationWritePolicy.CloseOutcome.FAILED
    }
    return if (result is DocumentWriteResult.Success) result.copy(closeOutcome = closeOutcome) else result
  }

  private fun writeDocumentBytes(
    source: File,
    expectedBytes: Long,
    output: OutputStream,
    canContinue: () -> Boolean,
  ): DocumentCopyProof {
    val digest = MessageDigest.getInstance("SHA-256")
    var copied = 0L
    val input = try { FileInputStream(source) } catch (error: Throwable) {
      throw DocumentWriteStageException("source-read", 0L, error)
    }
    input.use {
      val buffer = ByteArray(HASH_BUFFER_BYTES)
      while (true) {
        if (!canContinue()) throw InterruptedException("cancelled")
        val count = try { it.read(buffer) } catch (error: Throwable) {
          throw DocumentWriteStageException("source-read", copied, error)
        }
        if (count < 0) break
        if (count == 0) continue
        try { output.write(buffer, 0, count) } catch (error: Throwable) {
          throw DocumentWriteStageException("document-write", copied, error)
        }
        digest.update(buffer, 0, count)
        copied = try { Math.addExact(copied, count.toLong()) } catch (error: Throwable) {
          throw DocumentWriteStageException("copy-size", copied, error)
        }
      }
    }
    try { output.flush() } catch (error: Throwable) {
      throw DocumentWriteStageException("flush", copied, error)
    }
    if (copied != expectedBytes) throw DocumentWriteStageException("copy-size", copied)
    return DocumentCopyProof(
      sha256 = digest.digest().joinToString("") { byte -> "%02x".format(byte) },
      bytesWritten = copied,
    )
  }

  private fun documentWriteFailure(
    stage: String,
    mode: OrionSafPublicationWritePolicy.Mode?,
    bytesWritten: Long,
    error: Throwable?,
  ): DocumentWriteResult.Failed {
    logSafTransition(mode, stage, SystemClock.elapsedRealtime(), bytesWritten, error)
    return DocumentWriteResult.Failed(
      stage = stage,
      mode = mode,
      bytesWritten = bytesWritten.coerceAtLeast(0L),
      exceptionClass = error?.javaClass?.simpleName.orEmpty().take(60),
    )
  }

  private fun logSafTransition(
    mode: OrionSafPublicationWritePolicy.Mode?,
    stage: String,
    startedAt: Long,
    bytes: Long,
    error: Throwable?,
  ) {
    val elapsed = (SystemClock.elapsedRealtime() - startedAt).coerceAtLeast(0L)
    val elapsedBucket = when {
      elapsed < 100L -> "<100ms"
      elapsed < 500L -> "<500ms"
      elapsed < 3_000L -> "<3s"
      else -> ">=3s"
    }
    val byteBucket = when {
      bytes <= 0L -> "0"
      bytes < 1024L * 1024L -> "<1MiB"
      bytes < 100L * 1024L * 1024L -> "<100MiB"
      else -> ">=100MiB"
    }
    val exceptionClass = error?.javaClass?.simpleName.orEmpty().take(60).ifBlank { "none" }
    Log.d(
      TAG,
      "saf-publication mode=${mode?.name ?: "none"} stage=${stage.take(40)} elapsed=$elapsedBucket bytes=$byteBucket exception=$exceptionClass",
    )
  }

  private fun publicationFailureMessage(stage: String): String = when (stage) {
    "descriptor-open" -> "The selected storage provider would not open the completed media document for writing."
    "source-read" -> "Orion could not read the completed local media while publishing it."
    "flush" -> "The selected storage provider could not finish writing the completed media."
    "copy-size" -> "The selected storage provider wrote an incomplete media document."
    else -> "Orion could not copy the completed media into the selected folder."
  }

  private fun journal(
    context: Context,
    jobId: String,
    generation: Long,
    targetId: String,
    uri: Uri,
    intendedName: String,
    actualName: String,
    stage: String,
    expectedBytes: Long? = null,
    expectedSha256: String? = null,
  ): Boolean = OrionDownloadJobStore.setPendingPublication(jobId, generation, JSONObject()
    .put("kind", "saf-finalized-mp4")
    .put("targetId", targetId)
    .put("uri", uri.toString())
    .put("intendedDisplayName", intendedName.take(120))
    .put("actualDisplayName", actualName.take(120))
    .put("stage", stage.take(32))
    .put("expectedSizeBytes", expectedBytes ?: JSONObject.NULL)
    .put("expectedSha256", expectedSha256 ?: JSONObject.NULL)
    .put("updatedAt", System.currentTimeMillis()))

  private fun canContinue(jobId: String, generation: Long): Boolean {
    val job = OrionDownloadJobStore.getJob(jobId) ?: return false
    return job.optLong("_executionGeneration", -1L) == generation &&
      job.optString("state") != "cancelled" && job.optString("_control", "run") != "cancel"
  }

  private fun awaitDocumentInfo(
    context: Context,
    uri: Uri,
    expectedBytes: Long?,
    canContinue: () -> Boolean,
  ): DocumentInfoReadiness {
    val startedAt = SystemClock.elapsedRealtime()
    for (attempt in 0..OrionSafPublicationWritePolicy.READINESS_DELAYS_MS.size) {
      val info = OrionDownloadStorageRegistry.documentInfo(context, uri)
      val probe = info?.let {
        OrionSafPublicationWritePolicy.metadataProbe(it.sizeBytes, expectedBytes)
      } ?: OrionSafPublicationWritePolicy.ReadinessProbe.TRANSIENT_NOT_READY
      val delay = OrionSafPublicationWritePolicy.readinessDelayMs(attempt)
      when (OrionSafPublicationWritePolicy.readinessDecision(probe, canContinue(), delay != null)) {
        OrionSafPublicationWritePolicy.ReadinessDecision.READY -> {
          logSafTransition(null, "metadata-ready", startedAt, expectedBytes ?: 0L, null)
          return DocumentInfoReadiness.Ready(checkNotNull(info))
        }
        OrionSafPublicationWritePolicy.ReadinessDecision.CANCELLED -> {
          logSafTransition(null, "metadata-cancelled", startedAt, expectedBytes ?: 0L, null)
          return DocumentInfoReadiness.Cancelled
        }
        OrionSafPublicationWritePolicy.ReadinessDecision.FAILED -> {
          logSafTransition(null, "metadata-unavailable", startedAt, expectedBytes ?: 0L, null)
          return DocumentInfoReadiness.Failed
        }
        OrionSafPublicationWritePolicy.ReadinessDecision.RETRY -> Unit
      }
      try {
        Thread.sleep(checkNotNull(delay))
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
        return if (!canContinue()) DocumentInfoReadiness.Cancelled else DocumentInfoReadiness.Failed
      }
    }
    return DocumentInfoReadiness.Failed
  }

  private fun awaitReadableDescriptor(
    context: Context,
    uri: Uri,
    expectedBytes: Long,
    canContinue: () -> Boolean,
  ): DescriptorReadiness {
    fun probe(): OrionSafPublicationWritePolicy.ReadinessProbe {
      return try {
        val descriptor = context.contentResolver.openFileDescriptor(uri, "r")
          ?: return OrionSafPublicationWritePolicy.ReadinessProbe.TRANSIENT_NOT_READY
        descriptor.use {
          OrionSafPublicationWritePolicy.descriptorProbe(true, it.statSize, expectedBytes)
        }
      } catch (_: SecurityException) {
        OrionSafPublicationWritePolicy.descriptorProbe(false, null, expectedBytes, permissionDenied = true)
      } catch (_: java.io.FileNotFoundException) {
        OrionSafPublicationWritePolicy.ReadinessProbe.TRANSIENT_NOT_READY
      } catch (_: Throwable) {
        OrionSafPublicationWritePolicy.ReadinessProbe.TRANSIENT_NOT_READY
      }
    }
    val startedAt = SystemClock.elapsedRealtime()
    for (attempt in 0..OrionSafPublicationWritePolicy.READINESS_DELAYS_MS.size) {
      val probe = probe()
      val delay = OrionSafPublicationWritePolicy.readinessDelayMs(attempt)
      when (OrionSafPublicationWritePolicy.readinessDecision(probe, canContinue(), delay != null)) {
        OrionSafPublicationWritePolicy.ReadinessDecision.READY -> {
          logSafTransition(null, "descriptor-ready", startedAt, expectedBytes, null)
          return DescriptorReadiness.READY
        }
        OrionSafPublicationWritePolicy.ReadinessDecision.CANCELLED -> {
          logSafTransition(null, "descriptor-cancelled", startedAt, expectedBytes, null)
          return DescriptorReadiness.CANCELLED
        }
        OrionSafPublicationWritePolicy.ReadinessDecision.FAILED -> {
          logSafTransition(null, "descriptor-unavailable", startedAt, expectedBytes, null)
          return DescriptorReadiness.FAILED
        }
        OrionSafPublicationWritePolicy.ReadinessDecision.RETRY -> Unit
      }
      try {
        Thread.sleep(checkNotNull(delay))
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
        return if (!canContinue()) DescriptorReadiness.CANCELLED else DescriptorReadiness.FAILED
      }
    }
    return DescriptorReadiness.FAILED
  }

  private fun cleanupDocument(context: Context, uri: Uri) = OrionDownloadStorageRegistry.deleteDocument(context, uri)

  private fun cleanupFailedPublication(
    context: Context,
    jobId: String,
    generation: Long,
    uri: Uri,
    code: String,
    message: String,
  ): OrionFinalizedDocumentSettlement = when (cleanupDocument(context, uri)) {
    OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> documentFailed(
      "finalized-artifact-cleanup-unavailable",
      "Orion could not safely remove an unverified document from the selected folder.",
      true,
      true,
    )
    else -> {
      OrionDownloadJobStore.clearPendingPublication(jobId, generation)
      documentFailed(code, message, true, true)
    }
  }

  private fun sha256(context: Context, uri: Uri): Pair<String, Long>? {
    return try {
      val digest = MessageDigest.getInstance("SHA-256")
      var total = 0L
      val input = context.contentResolver.openInputStream(uri) ?: return null
      input.use {
        val buffer = ByteArray(HASH_BUFFER_BYTES)
        while (true) {
          val count = it.read(buffer)
          if (count < 0) break
          if (count == 0) continue
          digest.update(buffer, 0, count)
          total = Math.addExact(total, count.toLong())
        }
      }
      digest.digest().joinToString("") { byte -> "%02x".format(byte) } to total
    } catch (_: Throwable) {
      null
    }
  }

  private fun documentFailed(code: String, message: String, retryable: Boolean, actionRequired: Boolean = false) =
    OrionFinalizedDocumentSettlement.Failed(code, message, retryable, actionRequired)

  fun settle(
    context: Context,
    jobId: String,
    source: File,
    requireAudio: Boolean,
  ): OrionFinalizedArtifactSettlement {
    val relative = OrionFinalizedArtifactPolicy.relativeLocator(jobId)
      ?: return failed("finalized-artifact-job-invalid", "The finalized download identity is invalid.", false)
    val root = File(context.filesDir, "orion-downloads/library")
    if ((!root.exists() && !root.mkdirs()) || !root.isDirectory) {
      return failed("finalized-artifact-storage-unavailable", "Orion Library storage is unavailable.", true)
    }
    val target = File(root, relative)
    if (!OrionDownloadOwnershipPolicy.canonicalContained(root, target)) {
      return failed("finalized-artifact-path-invalid", "The finalized download path is invalid.", false)
    }

    val sourceCanonical = try { source.canonicalFile } catch (_: Throwable) { return failed(
      "finalized-artifact-source-invalid",
      "The finalized download source could not be resolved.",
      false,
    ) }
    val targetCanonical = try { target.canonicalFile } catch (_: Throwable) { return failed(
      "finalized-artifact-path-invalid",
      "The finalized download path could not be resolved.",
      false,
    ) }
    if (!sourceCanonical.isFile || sourceCanonical.length() <= 0L) {
      return failed("finalized-artifact-source-missing", "The finalized download source is missing.", false)
    }

    val expectedBytes = sourceCanonical.length()
    var copied = false
    if (sourceCanonical != targetCanonical) {
      if (targetCanonical.exists() && !targetCanonical.delete()) {
        return failed("finalized-artifact-replace-failed", "Orion could not replace an incomplete local artifact.", true)
      }
      if (!sourceCanonical.renameTo(targetCanonical)) {
        try {
          FileInputStream(sourceCanonical).use { input ->
            FileOutputStream(targetCanonical).use { output ->
              val buffer = ByteArray(HASH_BUFFER_BYTES)
              while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                if (count == 0) continue
                output.write(buffer, 0, count)
              }
              output.flush()
              output.fd.sync()
            }
          }
          copied = true
        } catch (_: Throwable) {
          targetCanonical.delete()
          return failed("finalized-artifact-settlement-failed", "Orion could not settle the completed media in Orion Library.", true)
        }
      }
    }

    if (!targetCanonical.isFile || targetCanonical.length() != expectedBytes) {
      targetCanonical.delete()
      return failed("finalized-artifact-size-mismatch", "The durable media file does not match the completed download.", true)
    }

    val digest = sha256(targetCanonical)
      ?: return failed("finalized-artifact-read-failed", "Orion could not read the complete durable media file.", true)
    val verification = OrionFinalizedMediaVerifier.verify(targetCanonical, requireAudio)
    if (!verification.ok) {
      targetCanonical.delete()
      return failed(verification.code, verification.message, false)
    }
    val uri = try {
      FileProvider.getUriForFile(context, "${context.packageName}.orion-downloads", targetCanonical)
    } catch (_: Throwable) {
      return failed("finalized-artifact-uri-unavailable", "Orion could not authorize the durable media file.", true)
    }
    val descriptorSize = descriptorSize(context, uri)
      ?: return failed("finalized-artifact-descriptor-unavailable", "Orion could not open the durable media file through its playback authority.", true)
    if (!OrionFinalizedArtifactPolicy.durableProofMatches(
        expectedBytes,
        targetCanonical.length(),
        digest,
        descriptorSize,
        verification.ok,
      )) {
      return failed("finalized-artifact-proof-mismatch", "The durable media file failed its ownership proof.", false)
    }
    if (copied) sourceCanonical.delete()
    return OrionFinalizedArtifactSettlement.Verified(
      OrionFinalizedArtifactProof(
        file = targetCanonical,
        relativeLocator = relative,
        sizeBytes = targetCanonical.length(),
        sha256 = digest,
        contentUri = uri,
        mediaVerification = verification,
      ),
    )
  }

  fun validate(
    context: Context,
    file: File,
    expectedSizeBytes: Long,
    expectedSha256: String?,
    requireAudio: Boolean,
  ): OrionFinalizedArtifactSettlement {
    if (!file.isFile) return failed("finalized-artifact-missing", "The downloaded media file is missing.", false)
    if (expectedSizeBytes <= 0L || file.length() != expectedSizeBytes) {
      return failed("finalized-artifact-integrity-invalid", "The downloaded media file size is inconsistent.", false)
    }
    val digest = sha256(file)
      ?: return failed("finalized-artifact-read-failed", "Orion could not read the complete downloaded media file.", true)
    if (!expectedSha256.isNullOrBlank() && !digest.equals(expectedSha256, ignoreCase = true)) {
      return failed("finalized-artifact-digest-mismatch", "The downloaded media file no longer matches its verified content.", false)
    }
    val verification = OrionFinalizedMediaVerifier.verify(file, requireAudio)
    if (!verification.ok) return failed(verification.code, verification.message, false)
    val uri = try {
      FileProvider.getUriForFile(context, "${context.packageName}.orion-downloads", file)
    } catch (_: Throwable) {
      return failed("finalized-artifact-uri-unavailable", "Orion could not authorize the downloaded media file.", true)
    }
    val descriptorSize = descriptorSize(context, uri)
      ?: return failed("finalized-artifact-descriptor-unavailable", "Orion could not open the downloaded media file through its playback authority.", true)
    if (!OrionFinalizedArtifactPolicy.durableProofMatches(
        expectedSizeBytes,
        file.length(),
        digest,
        descriptorSize,
        verification.ok,
      )) {
      return failed("finalized-artifact-proof-mismatch", "The downloaded media file failed its ownership proof.", false)
    }
    return OrionFinalizedArtifactSettlement.Verified(
      OrionFinalizedArtifactProof(
        file = file,
        relativeLocator = file.name,
        sizeBytes = file.length(),
        sha256 = digest,
        contentUri = uri,
        mediaVerification = verification,
      ),
    )
  }

  fun validateDocumentIntegrity(
    context: Context,
    uri: Uri,
    targetId: String,
    displayName: String,
    expectedSizeBytes: Long,
    expectedSha256: String?,
    requireAudio: Boolean,
  ): OrionFinalizedDocumentSettlement {
    if (uri.scheme != "content" || expectedSizeBytes <= 0L) {
      return documentFailed("finalized-artifact-document-unavailable", "Orion could not reopen the completed media document.", true, true)
    }
    val info = OrionDownloadStorageRegistry.documentInfo(context, uri)
      ?: return documentFailed("finalized-artifact-document-unavailable", "Orion could not reopen the completed media document.", true, true)
    if (info.mimeType != null && info.mimeType != "video/mp4" && info.mimeType != "application/octet-stream") {
      return documentFailed("finalized-artifact-mime-invalid", "The selected storage provider did not preserve the MP4 media type.", false)
    }
    val hashed = sha256(context, uri)
      ?: return documentFailed("finalized-artifact-read-failed", "Orion could not read the complete media document from the selected folder.", true, true)
    if (hashed.second != expectedSizeBytes || (info.sizeBytes != null && info.sizeBytes != expectedSizeBytes)) {
      return documentFailed("finalized-artifact-size-mismatch", "The final media document size no longer matches the completed download.", false)
    }
    if (!expectedSha256.isNullOrBlank() && !hashed.first.equals(expectedSha256, true)) {
      return documentFailed("finalized-artifact-digest-mismatch", "The final media document no longer matches its verified content.", false)
    }
    val descriptorAccessible = try {
      context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        val stat = descriptor.statSize
        stat < 0L || stat == expectedSizeBytes
      } ?: false
    } catch (_: Throwable) { false }
    if (!descriptorAccessible) {
      return documentFailed("finalized-artifact-descriptor-unavailable", "Orion could not open the final media document for playback.", true, true)
    }
    val verification = OrionFinalizedMediaVerifier.verify(context, uri, displayName, expectedSizeBytes, requireAudio)
    if (!verification.ok) return documentFailed(verification.code, verification.message, false)
    if (!OrionFinalizedArtifactPolicy.documentProofMatches(
        expectedSizeBytes,
        hashed.second,
        info.sizeBytes,
        (expectedSha256 ?: hashed.first).lowercase(),
        hashed.first,
        descriptorAccessible,
        verification.ok,
      )
    ) {
      return documentFailed("finalized-artifact-proof-mismatch", "The final media document does not match the completed download.", false)
    }
    return OrionFinalizedDocumentSettlement.Verified(
      OrionFinalizedDocumentProof(uri, targetId, displayName, expectedSizeBytes, hashed.first, verification),
    )
  }

  fun authorize(context: Context, file: File, expectedSizeBytes: Long): Uri? {
    if (!file.isFile || expectedSizeBytes <= 0L || file.length() != expectedSizeBytes) return null
    val uri = try {
      FileProvider.getUriForFile(context, "${context.packageName}.orion-downloads", file)
    } catch (_: Throwable) { return null }
    return uri.takeIf { descriptorSize(context, it) == expectedSizeBytes }
  }

  fun authorizeDocument(context: Context, uri: Uri, expectedSizeBytes: Long): Uri? {
    if (uri.scheme != "content" || expectedSizeBytes <= 0L) return null
    val info = OrionDownloadStorageRegistry.documentInfo(context, uri) ?: return null
    if (info.sizeBytes != null && info.sizeBytes != expectedSizeBytes) return null
    return try {
      context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        val stat = descriptor.statSize
        if (stat >= 0L && stat != expectedSizeBytes) null else uri
      }
    } catch (_: Throwable) { null }
  }

  fun cleanupPendingPublication(context: Context, jobId: String): Boolean {
    val pending = OrionDownloadJobStore.getJob(jobId)?.optJSONObject("_pendingPublication") ?: return true
    val uri = try { Uri.parse(pending.optString("uri")) } catch (_: Throwable) { null } ?: return false
    return when (cleanupDocument(context, uri)) {
      OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> false
      else -> {
        OrionDownloadJobStore.clearPendingPublication(jobId)
        true
      }
    }
  }

  private fun sha256(file: File): String? = try {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(HASH_BUFFER_BYTES)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        if (count > 0) digest.update(buffer, 0, count)
      }
    }
    digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  } catch (_: Throwable) { null }

  private fun descriptorSize(context: Context, uri: Uri): Long? {
    try {
      context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        descriptor.statSize.takeIf { it >= 0L }?.let { return it }
      }
    } catch (error: Throwable) {
      Log.w(TAG, "legacy-open-file-descriptor:${error.javaClass.simpleName.take(60)}")
    }
    return try {
      context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
        val declared = descriptor.length
        val stat = descriptor.parcelFileDescriptor.statSize
        when {
          declared >= 0L -> declared
          stat >= 0L -> stat
          else -> null
        }
      }
    } catch (error: Throwable) {
      Log.w(TAG, "legacy-open-asset-descriptor:${error.javaClass.simpleName.take(60)}")
      null
    }
  }

  private fun failed(code: String, message: String, retryable: Boolean) =
    OrionFinalizedArtifactSettlement.Failed(code, message, retryable)
}
