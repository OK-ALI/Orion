package com.okali.orion.playback

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest

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

  private fun descriptorSize(context: Context, uri: Uri): Long? = try {
    context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
      val declared = descriptor.length
      val stat = descriptor.parcelFileDescriptor.statSize
      when {
        declared >= 0L -> declared
        stat >= 0L -> stat
        else -> null
      }
    }
  } catch (_: Throwable) { null }

  private fun failed(code: String, message: String, retryable: Boolean) =
    OrionFinalizedArtifactSettlement.Failed(code, message, retryable)
}
