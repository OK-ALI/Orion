package com.okali.orion.playback

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import java.security.MessageDigest

internal object OrionSafDocumentNamePolicy {
  private const val MAX_CODE_POINTS = 120
  private const val MP4_EXTENSION = ".mp4"

  fun sanitize(value: String, fallback: String = "Orion download"): String {
    val fallbackName = normalize(fallback).ifBlank { "Orion download" }
    val candidate = normalize(value).ifBlank { fallbackName }
    val preserveMp4 = candidate.endsWith(MP4_EXTENSION, ignoreCase = true)
    val suffix = if (preserveMp4) MP4_EXTENSION else ""
    val rawStem = if (preserveMp4) candidate.dropLast(MP4_EXTENSION.length) else candidate
    val fallbackStem = if (fallbackName.endsWith(MP4_EXTENSION, ignoreCase = true)) {
      fallbackName.dropLast(MP4_EXTENSION.length)
    } else fallbackName
    val stem = rawStem.trimEnd('.', ' ').ifBlank {
      fallbackStem.trimEnd('.', ' ').ifBlank { "Orion download" }
    }
    val maximumStemCodePoints = MAX_CODE_POINTS - suffix.codePointCount(0, suffix.length)
    val boundedStem = if (stem.codePointCount(0, stem.length) > maximumStemCodePoints) {
      stem.substring(0, stem.offsetByCodePoints(0, maximumStemCodePoints))
    } else stem
    return boundedStem.trimEnd('.', ' ').ifBlank { "Orion download" } + suffix
  }

  private fun normalize(value: String): String = value
    .replace(Regex("[\\/:*?\"<>|\\u0000-\\u001f]"), "_")
    .replace(Regex("\\s+"), " ")
    .trim()
}

internal object OrionDocumentProbePolicy {
  enum class DescriptorOutcome { OPENED, MISSING, UNAVAILABLE }

  sealed class Result {
    data class Verified(val sizeBytes: Long) : Result()
    data object Missing : Result()
    data object Unavailable : Result()
  }

  fun classify(
    metadataRowPresent: Boolean,
    metadataSizeBytes: Long?,
    descriptorOutcome: DescriptorOutcome,
    descriptorSizeBytes: Long?,
  ): Result {
    if (!metadataRowPresent || descriptorOutcome == DescriptorOutcome.MISSING) return Result.Missing
    if (descriptorOutcome != DescriptorOutcome.OPENED) return Result.Unavailable
    val metadataSize = metadataSizeBytes?.takeIf { it >= 0L }
    val descriptorSize = descriptorSizeBytes?.takeIf { it >= 0L }
    if (metadataSize != null && descriptorSize != null && metadataSize != descriptorSize) return Result.Unavailable
    return Result.Verified(metadataSize ?: descriptorSize ?: return Result.Unavailable)
  }
}

internal object OrionDownloadStorageRegistry {
  private const val PREFS = "orion_download_storage_v1"
  private const val PREFIX = "target."

  data class StorageTarget(
    val targetId: String,
    val displayName: String,
    val writable: Boolean,
    val persistedPermission: Boolean,
  )

  data class DocumentInfo(
    val uri: Uri,
    val displayName: String,
    val mimeType: String?,
    val sizeBytes: Long?,
    val flags: Int,
  )

  sealed class DocumentProbe {
    data class Verified(val sizeBytes: Long) : DocumentProbe()
    data object Missing : DocumentProbe()
    data object Unavailable : DocumentProbe()
  }

  sealed class DocumentDeleteResult {
    data object Deleted : DocumentDeleteResult()
    data object AlreadyMissing : DocumentDeleteResult()
    data object Unavailable : DocumentDeleteResult()
  }

  fun registerTree(context: Context, uri: Uri, grantedFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION): StorageTarget? {
    if (uri.scheme != "content" || !DocumentsContract.isTreeUri(uri)) return null
    val resolver = context.contentResolver
    val flags = grantedFlags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    if (flags and Intent.FLAG_GRANT_READ_URI_PERMISSION == 0 || flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION == 0) return null
    try {
      resolver.takePersistableUriPermission(uri, flags)
    } catch (_: SecurityException) {
      return null
    }
    val handle = "saf-${sha256(uri.toString()).take(20)}"
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(PREFIX + handle, uri.toString())
      .apply()
    return describe(context, handle)
  }

  fun describe(context: Context, handle: String): StorageTarget? {
    val uri = resolveTreeUri(context, handle) ?: return null
    val persisted = context.contentResolver.persistedUriPermissions.any {
      it.uri == uri && it.isReadPermission && it.isWritePermission
    }
    if (!persisted) return null
    val parent = try {
      DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
    } catch (_: Throwable) { return null }
    val projection = arrayOf(
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_FLAGS,
    )
    val metadata = try {
      context.contentResolver.query(parent, projection, null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) null else Triple(
          cursor.getString(0).orEmpty(),
          cursor.getString(1).orEmpty(),
          if (cursor.isNull(2)) 0 else cursor.getInt(2),
        )
      }
    } catch (_: Throwable) { null } ?: return null
    if (metadata.second != DocumentsContract.Document.MIME_TYPE_DIR ||
      metadata.third and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE == 0
    ) return null
    val fallbackName = try { DocumentsContract.getTreeDocumentId(uri) } catch (_: Throwable) { "" }
    val displayName = metadata.first.trim().takeIf { it.isNotBlank() }
      ?: fallbackName.substringAfter(':', fallbackName).trim('/').substringAfterLast('/').takeIf { it.isNotBlank() }
      ?: "Selected folder"
    return StorageTarget(handle, displayName.take(80), true, true)
  }

  fun resolveTreeUri(context: Context, handle: String): Uri? {
    if (!handle.matches(Regex("^saf-[a-f0-9]{20}$"))) return null
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(PREFIX + handle, null)
      ?: return null
    return try { Uri.parse(raw) } catch (_: Throwable) { null }
  }

  fun createDocument(context: Context, handle: String, mimeType: String, fileName: String): Uri? {
    val tree = resolveTreeUri(context, handle) ?: return null
    return try {
      val docId = DocumentsContract.getTreeDocumentId(tree)
      val parent = DocumentsContract.buildDocumentUriUsingTree(tree, docId)
      DocumentsContract.createDocument(
        context.contentResolver,
        parent,
        mimeType.ifBlank { "application/octet-stream" },
        OrionSafDocumentNamePolicy.sanitize(fileName),
      )
    } catch (_: Throwable) {
      null
    }
  }

  fun deleteDocument(context: Context, uri: Uri): DocumentDeleteResult {
    if (uri.scheme != "content") return DocumentDeleteResult.Unavailable
    return try {
      if (DocumentsContract.deleteDocument(context.contentResolver, uri)) DocumentDeleteResult.Deleted
      else classifyFailedDelete(context, uri)
    } catch (_: java.io.FileNotFoundException) {
      DocumentDeleteResult.AlreadyMissing
    } catch (_: SecurityException) {
      DocumentDeleteResult.Unavailable
    } catch (_: Throwable) {
      classifyFailedDelete(context, uri)
    }
  }

  fun documentInfo(context: Context, uri: Uri): DocumentInfo? {
    if (uri.scheme != "content") return null
    val projection = arrayOf(
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      OpenableColumns.SIZE,
      DocumentsContract.Document.COLUMN_FLAGS,
    )
    return try {
      context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        DocumentInfo(
          uri = uri,
          displayName = cursor.getString(0).orEmpty().take(120),
          mimeType = cursor.getString(1)?.takeIf { it.isNotBlank() },
          sizeBytes = if (cursor.isNull(2)) null else cursor.getLong(2).takeIf { it >= 0L },
          flags = if (cursor.isNull(3)) 0 else cursor.getInt(3),
        )
      }
    } catch (_: Throwable) { null }
  }

  fun renameDocument(context: Context, uri: Uri, displayName: String): Uri? {
    val info = documentInfo(context, uri) ?: return null
    if (info.flags and DocumentsContract.Document.FLAG_SUPPORTS_RENAME == 0) return null
    return try {
      DocumentsContract.renameDocument(context.contentResolver, uri, OrionSafDocumentNamePolicy.sanitize(displayName))
    } catch (_: Throwable) { null }
  }

  fun documentSize(context: Context, uri: Uri): Long? {
    if (uri.scheme != "content") return null
    val resolver = context.contentResolver
    val queried = try {
      resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst() || cursor.isNull(0)) null else cursor.getLong(0).takeIf { it > 0L }
      }
    } catch (_: Throwable) {
      null
    }
    if (queried != null) return queried
    return try {
      resolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        descriptor.statSize.takeIf { it > 0L }
      }
    } catch (_: Throwable) {
      null
    }
  }

  fun probeDocument(context: Context, uri: Uri): DocumentProbe {
    if (uri.scheme != "content") return DocumentProbe.Unavailable
    val resolver = context.contentResolver
    val metadataSize = try {
      val cursor = resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
        ?: return DocumentProbe.Unavailable
      cursor.use {
        if (!it.moveToFirst()) return documentProbe(OrionDocumentProbePolicy.classify(
          metadataRowPresent = false,
          metadataSizeBytes = null,
          descriptorOutcome = OrionDocumentProbePolicy.DescriptorOutcome.UNAVAILABLE,
          descriptorSizeBytes = null,
        ))
        if (it.isNull(0)) null else it.getLong(0).takeIf { size -> size >= 0L }
      }
    } catch (_: java.io.FileNotFoundException) {
      return documentProbe(OrionDocumentProbePolicy.classify(
        true,
        null,
        OrionDocumentProbePolicy.DescriptorOutcome.MISSING,
        null,
      ))
    } catch (_: SecurityException) {
      return documentProbe(OrionDocumentProbePolicy.classify(
        true,
        null,
        OrionDocumentProbePolicy.DescriptorOutcome.UNAVAILABLE,
        null,
      ))
    } catch (_: Throwable) {
      return DocumentProbe.Unavailable
    }
    val descriptorSize = try {
      val descriptor = resolver.openFileDescriptor(uri, "r") ?: return documentProbe(
        OrionDocumentProbePolicy.classify(
          true,
          metadataSize,
          OrionDocumentProbePolicy.DescriptorOutcome.UNAVAILABLE,
          null,
        ),
      )
      descriptor.use { it.statSize.takeIf { size -> size >= 0L } }
    } catch (_: java.io.FileNotFoundException) {
      return documentProbe(OrionDocumentProbePolicy.classify(
        true,
        metadataSize,
        OrionDocumentProbePolicy.DescriptorOutcome.MISSING,
        null,
      ))
    } catch (_: SecurityException) {
      return documentProbe(OrionDocumentProbePolicy.classify(
        true,
        metadataSize,
        OrionDocumentProbePolicy.DescriptorOutcome.UNAVAILABLE,
        null,
      ))
    } catch (_: Throwable) {
      return DocumentProbe.Unavailable
    }
    return documentProbe(OrionDocumentProbePolicy.classify(
      metadataRowPresent = true,
      metadataSizeBytes = metadataSize,
      descriptorOutcome = OrionDocumentProbePolicy.DescriptorOutcome.OPENED,
      descriptorSizeBytes = descriptorSize,
    ))
  }

  private fun documentProbe(result: OrionDocumentProbePolicy.Result): DocumentProbe = when (result) {
    is OrionDocumentProbePolicy.Result.Verified -> DocumentProbe.Verified(result.sizeBytes)
    OrionDocumentProbePolicy.Result.Missing -> DocumentProbe.Missing
    OrionDocumentProbePolicy.Result.Unavailable -> DocumentProbe.Unavailable
  }

  private fun classifyFailedDelete(context: Context, uri: Uri): DocumentDeleteResult =
    when (OrionDownloadOwnershipPolicy.classifyDeleteFailure(
      conclusiveMissing = probeDocument(context, uri) == DocumentProbe.Missing,
      accessUnavailable = false,
    )) {
      OrionArtifactDeleteResult.ALREADY_MISSING -> DocumentDeleteResult.AlreadyMissing
      else -> DocumentDeleteResult.Unavailable
    }

  fun freeBytes(context: Context, handle: String): Long? {
    val tree = resolveTreeUri(context, handle) ?: return null
    val docId = try { DocumentsContract.getTreeDocumentId(tree) } catch (_: Throwable) { return null }
    if (!docId.startsWith("primary:")) return null
    return try {
      StatFs(Environment.getExternalStorageDirectory().absolutePath).availableBytes
    } catch (_: Throwable) {
      null
    }
  }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { byte -> "%02x".format(byte) }
}
