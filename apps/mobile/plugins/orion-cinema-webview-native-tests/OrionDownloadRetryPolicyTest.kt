package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class OrionDownloadRetryPolicyTest {
  @Test
  fun sealedLocalFragmentsValidateWithoutUrls() {
    val directory = Files.createTempDirectory("orion-local-retry").toFile()
    try {
      val first = File(directory, "f000000.bin").apply { writeBytes(byteArrayOf(1, 2, 3)) }
      val second = File(directory, "f000001.bin").apply { writeBytes(byteArrayOf(4, 5, 6, 7)) }
      val proofs = listOf(
        OrionDownloadFinalizationManifest.proof(first, 0, "media")!!,
        OrionDownloadFinalizationManifest.proof(second, 1, "media")!!,
      )
      val result = OrionDownloadFinalizationManifest.validate(directory, proofs)
      assertTrue(result is OrionLocalManifestValidation.Valid)
      assertEquals(7L, (result as OrionLocalManifestValidation.Valid).totalBytes)
      assertFalse(proofs.joinToString().contains("http", ignoreCase = true))
    } finally {
      directory.deleteRecursively()
    }
  }

  @Test
  fun missingAndCorruptFragmentsFailTruthfully() {
    val directory = Files.createTempDirectory("orion-corrupt-retry").toFile()
    try {
      val file = File(directory, "f000000.bin").apply { writeBytes(byteArrayOf(8, 9, 10)) }
      val proof = OrionDownloadFinalizationManifest.proof(file, 0, "media")!!
      file.writeBytes(byteArrayOf(8, 9, 11))
      assertEquals("local-finalization-fragment-corrupt", (OrionDownloadFinalizationManifest.validate(directory, listOf(proof)) as OrionLocalManifestValidation.Invalid).code)
      file.delete()
      assertEquals("local-finalization-fragment-missing", (OrionDownloadFinalizationManifest.validate(directory, listOf(proof)) as OrionLocalManifestValidation.Invalid).code)
    } finally {
      directory.deleteRecursively()
    }
  }

  @Test
  fun stagedSubtitleProofIsPreservedAndVerifiedIndependently() {
    val directory = Files.createTempDirectory("orion-subtitle-retry").toFile()
    try {
      val subtitle = File(directory, "selected-en.srt").apply { writeText("1\n00:00:00,000 --> 00:00:01,000\nHello\n") }
      val proof = OrionDownloadFinalizationManifest.proof(subtitle, 0, "subtitle")!!
      assertTrue(OrionDownloadFinalizationManifest.validateFile(subtitle, proof))
      subtitle.appendText("changed")
      assertFalse(OrionDownloadFinalizationManifest.validateFile(subtitle, proof))
    } finally {
      directory.deleteRecursively()
    }
  }
}
