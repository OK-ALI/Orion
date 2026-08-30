package com.okali.orion.updates

import android.Manifest
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class OrionUpdateModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val PRODUCTION_SIGNER_SHA256 = "4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd"
    private const val EVENT_NAME = "OrionUpdateState"
    private const val MAX_REDIRECTS = 5
    private const val MIME_APK = "application/vnd.android.package-archive"
  }

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "OrionUpdates"

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  @Suppress("DEPRECATION")
  private fun signingFlags(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES
    } else {
      PackageManager.GET_SIGNATURES
    }

  @Suppress("DEPRECATION")
  private fun installedPackageInfo(): PackageInfo =
    reactContext.packageManager.getPackageInfo(
      reactContext.packageName,
      signingFlags() or PackageManager.GET_PERMISSIONS,
    )

  @Suppress("DEPRECATION")
  private fun archivePackageInfo(file: File): PackageInfo? {
    val packageManager = reactContext.packageManager
    val modern = packageManager.getPackageArchiveInfo(file.absolutePath, signingFlags())
      ?: return null
    if (
      Build.VERSION.SDK_INT < Build.VERSION_CODES.P ||
      !modern.signingInfo?.apkContentsSigners.isNullOrEmpty()
    ) {
      return modern
    }
    // Android 9/10 vendor PackageManager builds can parse an APK archive while
    // leaving signingInfo empty for GET_SIGNING_CERTIFICATES. Reparse the same
    // already hash-verified APK with the legacy signature flag, then subject
    // that certificate to the exact same permanent/current signer checks.
    return packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNATURES)
      ?: modern
  }

  @Suppress("DEPRECATION")
  private fun signerSha256(info: PackageInfo): String? {
    val modernSignature = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      info.signingInfo?.apkContentsSigners?.firstOrNull()
    } else {
      null
    }
    val signature = modernSignature ?: info.signatures?.firstOrNull() ?: return null
    return sha256(signature.toByteArray())
  }

  @Suppress("DEPRECATION")
  private fun versionCode(info: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

  private fun sha256(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256")
      .digest(bytes)
      .joinToString("") { byte -> "%02x".format(byte) }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(128 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun normalizeSha256(value: String?): String =
    value.orEmpty().replace(":", "").trim().lowercase().takeIf {
      it.matches(Regex("^[a-f0-9]{64}$"))
    }.orEmpty()

  private fun requestInstallPackagesDeclared(info: PackageInfo = installedPackageInfo()): Boolean =
    info.requestedPermissions?.contains(Manifest.permission.REQUEST_INSTALL_PACKAGES) == true

  private fun canRequestPackageInstalls(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || reactContext.packageManager.canRequestPackageInstalls()

  private fun currentSignerSha256(): String? = signerSha256(installedPackageInfo())

  private fun environmentMap() = Arguments.createMap().apply {
    val info = installedPackageInfo()
    val signer = signerSha256(info)
    putString("source", "direct")
    putString("packageName", reactContext.packageName)
    putDouble("versionCode", versionCode(info).toDouble())
    putString("signerSha256", signer)
    putBoolean("productionSignerMatched", signer == PRODUCTION_SIGNER_SHA256)
    putBoolean("requestInstallPackagesDeclared", requestInstallPackagesDeclared(info))
    putBoolean("canRequestPackageInstalls", canRequestPackageInstalls())
  }

  @ReactMethod
  fun getEnvironment(promise: Promise) {
    try {
      promise.resolve(environmentMap())
    } catch (error: Throwable) {
      promise.reject("UPDATE_ENVIRONMENT_FAILED", "Unable to inspect the Orion update environment.", error)
    }
  }

  @ReactMethod
  fun openDirectInstallPermissionSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(true)
        return
      }
      val intent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${reactContext.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("UPDATE_PERMISSION_SETTINGS_FAILED", "Unable to open Android install-source settings.", error)
    }
  }

  @ReactMethod
  fun installDirectApk(
    url: String,
    assetName: String,
    expectedSize: Double,
    expectedSha256: String,
    expectedSignerSha256: String,
    promise: Promise,
  ) {
    val currentSigner = currentSignerSha256()
    if (currentSigner != PRODUCTION_SIGNER_SHA256) {
      promise.reject("DIRECT_UPDATE_UNTRUSTED_BUILD", "Direct updates require a production-signed Orion build.")
      return
    }

    if (!requestInstallPackagesDeclared()) {
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", false)
        putString("code", "direct-build-required")
      })
      return
    }

    if (!canRequestPackageInstalls()) {
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", false)
        putString("code", "permission-required")
      })
      return
    }

    val size = expectedSize.toLong()
    val expectedDigest = normalizeSha256(expectedSha256)
    val expectedSigner = normalizeSha256(expectedSignerSha256)
    if (size <= 0L || expectedDigest.isEmpty()) {
      promise.reject("DIRECT_UPDATE_INTEGRITY_REQUIRED", "Verified APK size and SHA-256 are required.")
      return
    }
    if (expectedSigner != PRODUCTION_SIGNER_SHA256) {
      promise.reject("DIRECT_UPDATE_SIGNER_REJECTED", "The published APK signer does not match Orion's production identity.")
      return
    }
    if (!assetName.lowercase().endsWith(".apk") || assetName.contains('/') || assetName.contains('\\')) {
      promise.reject("DIRECT_UPDATE_ASSET_INVALID", "The published Android installer name is invalid.")
      return
    }

    executor.execute {
      val updateDirectory = File(reactContext.cacheDir, "orion-updates")
      val apkFile = File(updateDirectory, "orion-update.apk")
      try {
        updateDirectory.mkdirs()
        if (apkFile.exists()) apkFile.delete()
        emitState("downloading", progress = 0.0)
        downloadTrustedApk(url, apkFile)

        emitState("verifying", progress = 1.0)
        if (apkFile.length() != size) {
          throw IllegalStateException("Downloaded APK size does not match the published integrity record.")
        }
        if (sha256(apkFile) != expectedDigest) {
          throw IllegalStateException("Downloaded APK SHA-256 verification failed.")
        }

        val candidate = archivePackageInfo(apkFile)
          ?: throw IllegalStateException("Android could not inspect the downloaded Orion APK.")
        if (candidate.packageName != reactContext.packageName) {
          throw IllegalStateException("Downloaded APK package identity does not match Orion.")
        }
        if (versionCode(candidate) <= versionCode(installedPackageInfo())) {
          throw IllegalStateException("Downloaded APK is not newer than the installed Orion build.")
        }

        val candidateSigner = signerSha256(candidate)
          ?: throw IllegalStateException("Downloaded APK signing identity is unavailable.")
        if (candidateSigner != expectedSigner || candidateSigner != currentSigner) {
          throw IllegalStateException("Downloaded APK signing identity verification failed.")
        }

        val uri = FileProvider.getUriForFile(
          reactContext,
          "${reactContext.packageName}.orion-updates",
          apkFile,
        )
        val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
          setDataAndType(uri, MIME_APK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          if (reactContext.currentActivity == null) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        emitState("installing", progress = 1.0)
        val activity = reactContext.currentActivity
        if (activity != null) activity.startActivity(intent) else reactContext.startActivity(intent)
        promise.resolve(Arguments.createMap().apply {
          putBoolean("ok", true)
          putString("state", "installing")
        })
      } catch (error: Throwable) {
        try { apkFile.delete() } catch (_: Throwable) {}
        emitState("failed", error = error.message ?: "Direct update failed.")
        promise.reject("DIRECT_UPDATE_FAILED", error.message ?: "Direct update failed.", error)
      }
    }
  }

  private fun downloadTrustedApk(initialUrl: String, destination: File) {
    var current = URL(initialUrl)
    repeat(MAX_REDIRECTS + 1) { depth ->
      validateDownloadUrl(current, initial = depth == 0)
      val connection = (current.openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 8_000
        readTimeout = 30_000
        setRequestProperty("User-Agent", "Orion-Mobile-Updater")
        setRequestProperty("Accept", MIME_APK)
      }
      val status = connection.responseCode
      if (status in 300..399) {
        val location = connection.getHeaderField("Location")
          ?: throw IllegalStateException("GitHub update redirect did not include a destination.")
        connection.disconnect()
        current = URL(current, location)
        return@repeat
      }
      if (status != HttpURLConnection.HTTP_OK) {
        connection.disconnect()
        throw IllegalStateException("GitHub update download returned HTTP $status.")
      }

      val total = connection.contentLengthLong
      var downloaded = 0L
      connection.inputStream.use { input ->
        FileOutputStream(destination).use { output ->
          val buffer = ByteArray(128 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            output.write(buffer, 0, read)
            downloaded += read
            emitState(
              state = "downloading",
              progress = if (total > 0L) downloaded.toDouble() / total.toDouble() else null,
              bytesDownloaded = downloaded,
              totalBytes = total.takeIf { it > 0L },
            )
          }
        }
      }
      connection.disconnect()
      return
    }
    throw IllegalStateException("GitHub update download exceeded the redirect limit.")
  }

  private fun validateDownloadUrl(url: URL, initial: Boolean) {
    if (url.protocol.lowercase() != "https") {
      throw IllegalStateException("Orion updates require HTTPS.")
    }
    val host = url.host.lowercase()
    val allowedHosts = setOf(
      "github.com",
      "objects.githubusercontent.com",
      "release-assets.githubusercontent.com",
    )
    if (host !in allowedHosts) {
      throw IllegalStateException("Orion update redirected to an untrusted host.")
    }
    if (initial && (
      host != "github.com" ||
      !url.path.lowercase().startsWith("/ok-ali/orion/releases/download/")
    )) {
      throw IllegalStateException("Orion direct updates must originate from the official GitHub release path.")
    }
  }

  private fun emitState(
    state: String,
    progress: Double? = null,
    bytesDownloaded: Long? = null,
    totalBytes: Long? = null,
    error: String? = null,
  ) {
    val payload = Arguments.createMap().apply {
      putString("state", state)
      if (progress != null) putDouble("progress", progress.coerceIn(0.0, 1.0))
      if (bytesDownloaded != null) putDouble("bytesDownloaded", bytesDownloaded.toDouble())
      if (totalBytes != null) putDouble("totalBytes", totalBytes.toDouble())
      if (error != null) putString("error", error)
    }
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, payload)
    } catch (_: Throwable) {}
  }

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }
}
