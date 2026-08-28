package com.okali.orion.playback

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
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
      title = media.optString("title").takeIf { it.isNotBlank() },
      year = media.opt("year").takeUnless { it == null || it == JSONObject.NULL }?.toString()?.toIntOrNull(),
      seriesTitle = media.optString("seriesTitle").takeIf { it.isNotBlank() },
      season = media.opt("season").takeUnless { it == null || it == JSONObject.NULL }?.toString()?.toIntOrNull(),
      episode = media.opt("episode").takeUnless { it == null || it == JSONObject.NULL }?.toString()?.toIntOrNull(),
      episodeTitle = media.optString("episodeTitle").takeIf { it.isNotBlank() },
    )

    recoverPendingDocument(context, jobId, generation, targetId, requireAudio)?.let { recovered ->
      if (recovered is OrionFinalizedDocumentSettlement.Verified) return recovered
      if (recovered is OrionFinalizedDocumentSettlement.Failed && recovered.actionRequired) return recovered
    }

    if (!source.isFile || source.length() <= 0L) {
      return documentFailed("finalized-artifact-source-missing", "The finalized download source is missing.", false)
    }

    if (!canContinue(jobId, generation)) return OrionFinalizedDocumentSettlement.Cancelled
    val temporaryName = "Orion-${jobId.takeLast(8)}.partial.mp4"
    var document = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", temporaryName)
      ?: return documentFailed("finalized-artifact-document-create-failed", "Orion could not create the final media document in the selected folder.", true, true)
    if (!journal(context, jobId, generation, targetId, document, finalName, temporaryName, "created")) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }
    var info = OrionDownloadStorageRegistry.documentInfo(context, document)
    if (info == null) {
      return cleanupFailedPublication(
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
      info = OrionDownloadStorageRegistry.documentInfo(context, document)
      if (info == null) {
        return cleanupFailedPublication(
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

    val expectedBytes = source.length()
    val sourceDigest = try {
      val digest = MessageDigest.getInstance("SHA-256")
      val descriptor = context.contentResolver.openFileDescriptor(document, "rwt")
        ?: throw java.io.IOException("provider-descriptor-null")
      descriptor.use { pfd ->
        FileInputStream(source).use { input ->
          FileOutputStream(pfd.fileDescriptor).use { output ->
            val buffer = ByteArray(HASH_BUFFER_BYTES)
            var copied = 0L
            while (true) {
              if (!canContinue(jobId, generation)) throw InterruptedException("cancelled")
              val count = input.read(buffer)
              if (count < 0) break
              if (count == 0) continue
              output.write(buffer, 0, count)
              digest.update(buffer, 0, count)
              copied = Math.addExact(copied, count.toLong())
            }
            output.flush()
            output.fd.sync()
            if (copied != expectedBytes) throw java.io.IOException("copy-size-mismatch")
          }
        }
      }
      digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    } catch (_: InterruptedException) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    } catch (_: Throwable) {
      cleanupDocument(context, document)
      return documentFailed("finalized-artifact-settlement-failed", "Orion could not copy the completed media into the selected folder.", true)
    }
    if (!journal(context, jobId, generation, targetId, document, finalName, info.displayName, "copied", expectedBytes, sourceDigest)) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
    }

    if (canRename) {
      val renamed = OrionDownloadStorageRegistry.renameDocument(context, document, finalName)
      if (renamed == null) {
        cleanupDocument(context, document)
        return documentFailed("finalized-artifact-rename-failed", "Orion could not give the completed media its final filename.", true, true)
      }
      document = renamed
      if (!journal(context, jobId, generation, targetId, document, finalName, finalName, "renamed")) {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
      info = OrionDownloadStorageRegistry.documentInfo(context, document)
        ?: return cleanupFailedPublication(
          context,
          jobId,
          generation,
          document,
          "finalized-artifact-document-unavailable",
          "Orion could not inspect the renamed media document.",
        )
      if (!journal(context, jobId, generation, targetId, document, finalName, info.displayName, "renamed-inspected", expectedBytes, sourceDigest)) {
        cleanupDocument(context, document)
        return OrionFinalizedDocumentSettlement.Cancelled
      }
    }

    if (!canContinue(jobId, generation)) {
      cleanupDocument(context, document)
      return OrionFinalizedDocumentSettlement.Cancelled
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
    return settlement
  }

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
