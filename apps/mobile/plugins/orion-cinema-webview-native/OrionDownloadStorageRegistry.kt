package com.okali.orion.playback

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import java.security.MessageDigest

internal object OrionDownloadStorageRegistry {
  private const val PREFS = "orion_download_storage_v1"
  private const val PREFIX = "target."

  data class StorageTarget(
    val targetId: String,
    val displayName: String,
    val writable: Boolean,
    val persistedPermission: Boolean,
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

  fun registerTree(context: Context, uri: Uri): StorageTarget? {
    if (uri.scheme != "content") return null
    val resolver = context.contentResolver
    val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
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
      it.uri == uri && it.isWritePermission
    }
    if (!persisted) return null
    val rawName = try { DocumentsContract.getTreeDocumentId(uri) } catch (_: Throwable) { "" }
    val displayName = rawName.substringAfter(':', rawName)
      .trim('/')
      .substringAfterLast('/')
      .takeIf { it.isNotBlank() }
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
        sanitizeFileName(fileName),
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
    return try {
      val resolver = context.contentResolver
      val queried = resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return DocumentProbe.Missing
        if (cursor.isNull(0)) null else cursor.getLong(0).coerceAtLeast(0L)
      }
      val size = queried ?: resolver.openFileDescriptor(uri, "r")?.use { descriptor -> descriptor.statSize.takeIf { it >= 0L } }
      if (size == null) DocumentProbe.Unavailable else DocumentProbe.Verified(size)
    } catch (_: java.io.FileNotFoundException) {
      DocumentProbe.Missing
    } catch (_: SecurityException) {
      DocumentProbe.Unavailable
    } catch (_: Throwable) {
      DocumentProbe.Unavailable
    }
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

  private fun sanitizeFileName(value: String): String {
    val cleaned = value
      .replace(Regex("[\\/:*?\"<>|\\u0000-\\u001f]"), "_")
      .replace(Regex("\\s+"), " ")
      .trim()
    return cleaned.take(120).ifBlank { "Orion download" }
  }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { byte -> "%02x".format(byte) }
}
