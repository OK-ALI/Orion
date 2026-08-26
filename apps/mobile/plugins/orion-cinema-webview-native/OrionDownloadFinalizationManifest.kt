package com.okali.orion.playback

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

internal data class OrionLocalArtifactProof(
  val index: Int,
  val role: String,
  val sizeBytes: Long,
  val sha256: String,
)

internal sealed class OrionLocalManifestValidation {
  data class Valid(val totalBytes: Long) : OrionLocalManifestValidation()
  data class Invalid(val code: String) : OrionLocalManifestValidation()
}

/** URL-free local integrity contract used by production retry and JVM tests. */
internal object OrionDownloadFinalizationManifest {
  private const val BUFFER_SIZE = 128 * 1024
  private val digestPattern = Regex("^[a-f0-9]{64}$")

  fun proof(file: File, index: Int, role: String): OrionLocalArtifactProof? {
    if (!file.isFile || file.length() <= 0L) return null
    val digest = sha256(file) ?: return null
    return OrionLocalArtifactProof(index, role.take(24), file.length(), digest)
  }

  fun validate(directory: File, proofs: List<OrionLocalArtifactProof>): OrionLocalManifestValidation {
    if (proofs.isEmpty() || proofs.size > 20_000) return OrionLocalManifestValidation.Invalid("local-finalization-plan-invalid")
    var total = 0L
    for ((expectedIndex, proof) in proofs.sortedBy { it.index }.withIndex()) {
      if (proof.index != expectedIndex || proof.role.isBlank() || proof.sizeBytes <= 0L || !digestPattern.matches(proof.sha256)) {
        return OrionLocalManifestValidation.Invalid("local-finalization-plan-invalid")
      }
      val file = File(directory, fragmentName(proof.index))
      if (!file.isFile) return OrionLocalManifestValidation.Invalid("local-finalization-fragment-missing")
      if (file.length() != proof.sizeBytes) return OrionLocalManifestValidation.Invalid("local-finalization-fragment-size-mismatch")
      if (sha256(file) != proof.sha256) return OrionLocalManifestValidation.Invalid("local-finalization-fragment-corrupt")
      total = if (total > Long.MAX_VALUE - proof.sizeBytes) Long.MAX_VALUE else total + proof.sizeBytes
    }
    return OrionLocalManifestValidation.Valid(total)
  }

  fun validateFile(file: File, proof: OrionLocalArtifactProof): Boolean =
    file.isFile && file.length() == proof.sizeBytes && digestPattern.matches(proof.sha256) && sha256(file) == proof.sha256

  fun sha256(file: File): String? = try {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).buffered(BUFFER_SIZE).use { input ->
      val buffer = ByteArray(BUFFER_SIZE)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        if (read > 0) digest.update(buffer, 0, read)
      }
    }
    digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  } catch (_: Throwable) {
    null
  }

  private fun fragmentName(index: Int): String = "f${index.toString().padStart(6, '0')}.bin"
}
