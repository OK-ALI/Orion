package com.okali.orion.playback

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

class OrionDownloadEngineModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private var storagePromise: Promise? = null
  private var playerPromise: Promise? = null
  private val ioExecutor = Executors.newSingleThreadExecutor()
  private val snapshotListener: (JSONObject) -> Unit = { snapshot -> emitSnapshot(snapshot) }
  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode == REQUEST_ORION_PLAYER) {
        val promise = playerPromise
        playerPromise = null
        OrionPlayerActivity.setProgressListener(null)
        if (promise == null) return
        val result = Arguments.createMap().apply {
          putBoolean("ok", resultCode == Activity.RESULT_OK)
          putDouble("currentTime", (data?.getLongExtra(OrionPlayerActivity.RESULT_POSITION_MS, 0L) ?: 0L) / 1_000.0)
          putDouble("duration", (data?.getLongExtra(OrionPlayerActivity.RESULT_DURATION_MS, 0L) ?: 0L) / 1_000.0)
          putBoolean("completed", data?.getBooleanExtra(OrionPlayerActivity.RESULT_COMPLETED, false) == true)
          putString("presentation", data?.getStringExtra(OrionPlayerActivity.RESULT_PRESENTATION)?.takeIf { it in setOf("fit", "fill", "stretch") } ?: "fit")
          data?.getStringExtra(OrionPlayerActivity.RESULT_CODE)?.takeIf { it.isNotBlank() }?.let { putString("code", it) }
          data?.getStringExtra(OrionPlayerActivity.RESULT_MESSAGE)?.takeIf { it.isNotBlank() }?.let { putString("message", it) }
        }
        promise.resolve(result)
        return
      }
      if (requestCode != REQUEST_STORAGE_TREE) return
      val promise = storagePromise
      storagePromise = null
      if (promise == null) return
      if (resultCode != Activity.RESULT_OK || data?.data == null) {
        promise.resolve(Arguments.createMap().apply { putBoolean("ok", false) })
        return
      }
      val target = OrionDownloadStorageRegistry.registerTree(reactContext, data.data!!, data.flags)
      if (target == null) {
        promise.resolve(Arguments.createMap().apply { putBoolean("ok", false) })
        return
      }
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", true)
        putString("targetId", target.targetId)
        putString("displayName", target.displayName)
        putBoolean("writable", target.writable)
        putBoolean("persistedPermission", target.persistedPermission)
      })
    }
  }

  init {
    OrionDownloadJobStore.initialize(reactContext)
    OrionDownloadJobStore.addListener(snapshotListener)
    reactContext.addActivityEventListener(activityListener)
    ioExecutor.execute { OrionDownloadArtifactManager.reconcile(reactContext) }
  }

  override fun getName(): String = "OrionDownloadEngine"

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  @ReactMethod
  fun getSnapshot(promise: Promise) {
    promise.resolve(toWritableMap(OrionDownloadJobStore.snapshot()))
  }

  @ReactMethod
  fun startJob(payloadJson: String, promise: Promise) {
    ioExecutor.execute { startJobInternal(payloadJson, promise) }
  }

  private fun startJobInternal(payloadJson: String, promise: Promise) {
    try {
      val payload = JSONObject(payloadJson)
      val job = payload.optJSONObject("job") ?: run {
        promise.reject("DOWNLOAD_JOB_INVALID", "Download job payload is invalid.")
        return
      }
      val jobId = job.optString("jobId").trim()
      val candidateId = job.optString("candidateId").trim()
      val transfer = OrionDownloadTransferRuntime.bind(candidateId, jobId)
      if (transfer == null) {
        promise.reject("DOWNLOAD_SOURCE_REFRESH_REQUIRED", "The active playback source is no longer available. Open the player and try again.")
        return
      }
      if (transfer.transferKind != "hls" && transfer.transferKind != "dash") {
        OrionDownloadTransferRuntime.release(jobId)
        promise.reject("DOWNLOAD_FRAGMENT_SOURCE_REQUIRED", "Mobile downloads require a ready HLS or DASH stream. Try another source.")
        return
      }
      val destination = job.optString("destination")
      if (destination !in setOf("orion-library", "device-storage")) {
        OrionDownloadTransferRuntime.release(jobId)
        promise.reject("DOWNLOAD_DESTINATION_INVALID", "Choose a valid Orion download location.")
        return
      }
      OrionDownloadArtifactManager.reconcile(reactContext)
      if (android.os.StatFs(reactContext.filesDir.absolutePath).availableBytes < MIN_FREE_RESERVE_BYTES) {
        OrionDownloadTransferRuntime.release(jobId)
        promise.reject("DOWNLOAD_STORAGE_INSUFFICIENT", "Orion needs more free device space before this download can start.")
        return
      }
      val storageMode = job.optJSONObject("storageTarget")?.optString("mode").orEmpty()
      val userOwnedLibrary = destination == "orion-library" && storageMode == "user-folder"
      if (destination == "orion-library" && !userOwnedLibrary) {
        OrionDownloadTransferRuntime.release(jobId)
        promise.reject("DOWNLOAD_STORAGE_TARGET_REQUIRED", "Choose the Orion Library storage folder before starting this download.")
        return
      }
      if (destination == "device-storage" || userOwnedLibrary) {
        val targetId = job.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
        val target = OrionDownloadStorageRegistry.describe(reactContext, targetId)
        if (target == null || !target.writable || !target.persistedPermission) {
          OrionDownloadTransferRuntime.release(jobId)
          promise.reject("DOWNLOAD_STORAGE_TARGET_REQUIRED", if (userOwnedLibrary) "Choose the Orion Library storage folder again before starting this download." else "Choose the Device Storage folder again before starting this download.")
          return
        }
        val freeBytes = OrionDownloadStorageRegistry.freeBytes(reactContext, targetId)
        if (freeBytes != null && freeBytes < MIN_FREE_RESERVE_BYTES) {
          OrionDownloadTransferRuntime.release(jobId)
          promise.reject("DOWNLOAD_STORAGE_INSUFFICIENT", "The selected storage folder does not have enough free space to start this download.")
          return
        }
      }
      val created = OrionDownloadJobStore.createJob(payload, transfer)
      if (created == null) {
        OrionDownloadTransferRuntime.release(jobId)
        val itemKey = payload.optString("itemKey").trim()
        if (itemKey.isNotBlank() && OrionDownloadJobStore.blockingDuplicate(itemKey, destination) != null) {
          promise.reject("DOWNLOAD_DUPLICATE", "This title is already downloaded or active in the selected location.")
        } else {
          promise.reject("DOWNLOAD_JOB_INVALID", "Orion could not create this download job.")
        }
        return
      }
      OrionDownloadSubtitleRuntime.register(jobId, payload.optJSONArray("subtitleSources"), job.optJSONArray("selectedSubtitleAssetIds"))
      OrionDownloadRecoveryScheduler.schedule(reactContext, jobId)
      OrionDownloadForegroundService.start(reactContext, jobId)
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", true)
        putString("jobId", jobId)
      })
    } catch (_: Throwable) {
      promise.reject("DOWNLOAD_START_FAILED", "Orion could not start this download.")
    }
  }

  @ReactMethod
  fun pauseJob(jobId: String) {
    val clean = jobId.trim()
    if (clean.isBlank()) return
    OrionDownloadJobStore.requestControl(clean, "pause")
    OrionDownloadJobStore.setState(clean, "paused")
    OrionDownloadRecoveryScheduler.cancel(reactContext, clean)
  }

  @ReactMethod
  fun resumeJob(jobId: String, promise: Promise) {
    val clean = jobId.trim()
    val job = OrionDownloadJobStore.getJob(clean)
    if (job == null) {
      promise.reject("DOWNLOAD_JOB_NOT_FOUND", "Download job was not found.")
      return
    }
    if (OrionDownloadTransferEngine.hasCompleteLocalFinalization(reactContext, clean)) {
      OrionDownloadJobStore.clearControl(clean)
      OrionDownloadJobStore.setState(clean, "recovering")
      OrionDownloadForegroundService.start(reactContext, clean, recovery = true)
      promise.resolve(true)
      return
    }
    val candidateId = job.optString("candidateId")
    if (OrionDownloadTransferRuntime.ensure(candidateId, clean) == null) {
      OrionDownloadJobStore.markActionRequired(
        clean,
        "request-context-refresh-required",
        "Open the title and start playback again to refresh the download source.",
      )
      promise.reject("DOWNLOAD_SOURCE_REFRESH_REQUIRED", "Open the title and start playback again to refresh the download source.")
      return
    }
    OrionDownloadJobStore.clearControl(clean)
    OrionDownloadJobStore.setState(clean, "recovering")
    OrionDownloadRecoveryScheduler.schedule(reactContext, clean)
    OrionDownloadForegroundService.start(reactContext, clean, recovery = true)
    promise.resolve(true)
  }

  @ReactMethod
  fun retryJob(jobId: String, promise: Promise) {
    val clean = jobId.trim()
    OrionDownloadJobStore.incrementRetry(clean)
    resumeJob(clean, promise)
  }

  @ReactMethod
  fun retryAllJobs(promise: Promise) {
    val snapshot = OrionDownloadJobStore.snapshot()
    val jobs = snapshot.optJSONArray("jobs") ?: org.json.JSONArray()
    var restarted = 0
    var actionRequired = 0
    for (index in 0 until jobs.length()) {
      val job = jobs.optJSONObject(index) ?: continue
      val jobId = job.optString("jobId").trim()
      val state = job.optString("state")
      val failure = job.optJSONObject("failure")
      val retryable = failure?.optBoolean("retryable", false) == true
      if (jobId.isBlank() || !retryable || state !in setOf("failed", "recovering", "storage-blocked", "action-required", "expired")) continue

      val stored = OrionDownloadJobStore.getJob(jobId) ?: continue
      val candidateId = stored.optString("candidateId")
      OrionDownloadJobStore.incrementRetry(jobId)
      if (OrionDownloadTransferEngine.hasCompleteLocalFinalization(reactContext, jobId)) {
        OrionDownloadJobStore.clearControl(jobId)
        OrionDownloadJobStore.setState(jobId, "recovering")
        OrionDownloadForegroundService.start(reactContext, jobId, recovery = true)
        restarted += 1
        continue
      }
      if (OrionDownloadTransferRuntime.ensure(candidateId, jobId) == null) {
        OrionDownloadJobStore.markActionRequired(
          jobId,
          "request-context-refresh-required",
          "Open the title and start playback again to refresh the download source.",
        )
        actionRequired += 1
        continue
      }
      OrionDownloadJobStore.clearControl(jobId)
      OrionDownloadJobStore.setState(jobId, "recovering")
      OrionDownloadRecoveryScheduler.schedule(reactContext, jobId)
      OrionDownloadForegroundService.start(reactContext, jobId, recovery = true)
      restarted += 1
    }
    promise.resolve(Arguments.createMap().apply {
      putInt("restarted", restarted)
      putInt("actionRequired", actionRequired)
    })
  }

  @ReactMethod
  fun cancelJob(jobId: String) {
    val clean = jobId.trim()
    if (clean.isBlank()) return
    OrionDownloadTransferEngine.cancelJob(reactContext, clean)
  }

  @ReactMethod
  fun reconcileDownloads(promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.reconcile(reactContext))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_RECONCILIATION_FAILED", "Orion could not check saved downloads right now.") }
    }
  }

  @ReactMethod
  fun deleteAssets(selectionsJson: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.deleteSelected(reactContext, parseAssetSelections(selectionsJson)))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_DELETE_FAILED", "Orion could not finish deleting the selected downloads.") }
    }
  }

  @ReactMethod
  fun deleteAllDownloads(promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.deleteAll(reactContext))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_DELETE_ALL_FAILED", "Orion could not finish deleting all downloads.") }
    }
  }

  @ReactMethod
  fun removeStaleRecords(assetIdsJson: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.deleteAssets(reactContext, parseAssetIds(assetIdsJson), staleOnly = true))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_STALE_REMOVE_FAILED", "Orion could not remove the selected stale records.") }
    }
  }

  @ReactMethod
  fun removeUnavailableRecords(assetIdsJson: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.removeUnavailableRecords(reactContext, parseAssetIds(assetIdsJson)))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_UNAVAILABLE_REMOVE_FAILED", "Orion could not remove the selected unavailable records.") }
    }
  }

  @ReactMethod
  fun openAsset(assetId: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.open(reactContext, assetId.trim(), locate = false))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_OPEN_FAILED", "Orion could not open this download.") }
    }
  }

  @ReactMethod
  fun playAssetLocally(assetId: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.open(reactContext, assetId.trim(), locate = false))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_LOCAL_PLAYBACK_FAILED", "Orion could not open this download in another player.") }
    }
  }

  @ReactMethod
  fun launchFinalizedPlayer(
    assetId: String,
    initialPositionSeconds: Double,
    title: String?,
    presentation: String?,
    themeAccent: String?,
    themeOnAccent: String?,
    themeText: String?,
    themeTextSecondary: String?,
    themeMediaScrim: String?,
    themeSurface: String?,
    themeElevated: String?,
    themeBorder: String?,
    reducedMotion: Boolean,
    promise: Promise,
  ) {
    val clean = assetId.trim()
    if (!clean.matches(Regex("^[A-Za-z0-9._:-]{1,140}$"))) {
      promise.reject("ORION_PLAYER_ASSET_INVALID", "Offline download identity is invalid.")
      return
    }
    if (!initialPositionSeconds.isFinite() || initialPositionSeconds < 0.0) {
      promise.reject("ORION_PLAYER_POSITION_INVALID", "Offline playback position is invalid.")
      return
    }
    if (playerPromise != null) {
      promise.reject("ORION_PLAYER_BUSY", "Orion Player is already open.")
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("ORION_PLAYER_UNAVAILABLE", "Orion Player is unavailable right now.")
      return
    }
    val safePresentation = presentation?.trim()?.lowercase().takeIf { it in setOf("fit", "fill", "stretch") } ?: "fit"
    val safeThemeAccent = themeAccent.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{6}$")) }
      ?: "#E50914"
    val safeThemeOnAccent = themeOnAccent.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{6}$")) }
      ?: "#FFFFFF"
    val safeThemeText = themeText.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{6}$")) }
      ?: "#F4F1F6"
    val safeThemeTextSecondary = themeTextSecondary.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{6}$")) }
      ?: "#B5AEBA"
    val safeThemeMediaScrim = themeMediaScrim.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{8}$")) }
      ?: "#C7030308"
    val safeThemeSurface = themeSurface.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{6}$")) }
      ?: "#191622"
    val safeThemeElevated = themeElevated.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{6}$")) }
      ?: "#100E17"
    val safeThemeBorder = themeBorder.orEmpty()
      .trim()
      .uppercase()
      .takeIf { it.matches(Regex("^#[0-9A-F]{8}$")) }
      ?: "#1AFFFFFF"
    val safeTitle = title.orEmpty()
      .replace(Regex("[\\u0000-\\u001f\\u007f]"), "")
      .trim()
      .take(160)
    playerPromise = promise
    OrionPlayerActivity.setProgressListener { progress ->
      if (playerPromise != null && progress.assetId == clean) emitPlayerProgress(progress)
    }
    try {
      activity.startActivityForResult(
        OrionPlayerActivity.createIntent(
          activity,
          clean,
          (initialPositionSeconds * 1_000.0).toLong(),
          safeTitle,
          safePresentation,
          safeThemeAccent,
          safeThemeOnAccent,
          safeThemeText,
          safeThemeTextSecondary,
          safeThemeMediaScrim,
          safeThemeSurface,
          safeThemeElevated,
          safeThemeBorder,
          reducedMotion,
        ),
        REQUEST_ORION_PLAYER,
      )
    } catch (_: Throwable) {
      playerPromise = null
      OrionPlayerActivity.setProgressListener(null)
      promise.reject("ORION_PLAYER_LAUNCH_FAILED", "Orion could not open its native player.")
    }
  }

  @ReactMethod
  fun locateAsset(assetId: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.open(reactContext, assetId.trim(), locate = true))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_LOCATE_FAILED", "Orion could not locate this download.") }
    }
  }


  @ReactMethod
  fun resolveOfflinePlayback(assetId: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.resolveOfflinePlayback(reactContext, assetId))) }
      catch (_: Throwable) { promise.reject("OFFLINE_PLAYBACK_RESOLVE_FAILED", "Orion could not resolve this offline download.") }
    }
  }

  @ReactMethod
  fun classifyOfflinePlayback(assetId: String, promise: Promise) {
    ioExecutor.execute {
      try {
        val clean = assetId.trim()
        val finalized = OrionDownloadArtifactManager.resolveFinalizedPlayerAsset(reactContext, clean)
        val finalizedAsset = finalized.asset
        if (finalizedAsset != null) {
          promise.resolve(Arguments.createMap().apply {
            putInt("schemaVersion", 1)
            putBoolean("ok", true)
            putString("assetId", finalizedAsset.assetId)
            putString("sourceKind", "file")
            putInt("fragmentCount", 1)
          })
          return@execute
        }
        if (finalized.code != "finalized-player-source-invalid") {
          promise.resolve(Arguments.createMap().apply {
            putBoolean("ok", false)
            putString("assetId", clean)
            putString("code", finalized.code ?: "offline-playback-route-invalid")
            putString("message", finalized.message ?: "Orion could not classify this offline download.")
          })
          return@execute
        }

        val legacy = OrionDownloadArtifactManager.resolveOfflinePlayerAsset(reactContext, clean)
        val legacyAsset = legacy.asset
        if (legacyAsset == null) {
          promise.resolve(Arguments.createMap().apply {
            putBoolean("ok", false)
            putString("assetId", clean)
            putString("code", legacy.code ?: "offline-playback-route-invalid")
            putString("message", legacy.message ?: "Orion could not classify this offline download.")
          })
          return@execute
        }
        promise.resolve(Arguments.createMap().apply {
          putInt("schemaVersion", 1)
          putBoolean("ok", true)
          putString("assetId", legacyAsset.assetId)
          putString("sourceKind", legacyAsset.sourceKind)
          putInt("fragmentCount", legacyAsset.fragmentCount.coerceAtLeast(0))
        })
      } catch (_: Throwable) {
        promise.reject("OFFLINE_PLAYBACK_CLASSIFY_FAILED", "Orion could not classify this offline download.")
      }
    }
  }

  @ReactMethod
  fun chooseDeviceStorageTarget(promise: Promise) {
    chooseStorageTarget(promise)
  }

  @ReactMethod
  fun chooseLibraryStorageTarget(promise: Promise) {
    chooseStorageTarget(promise)
  }

  @ReactMethod
  fun validateLibraryStorageTarget(targetId: String, promise: Promise) {
    ioExecutor.execute {
      val target = OrionDownloadStorageRegistry.describe(reactContext, targetId.trim())
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", target != null)
        if (target != null) {
          putString("targetId", target.targetId)
          putString("displayName", target.displayName)
          putBoolean("writable", target.writable)
          putBoolean("persistedPermission", target.persistedPermission)
        }
      })
    }
  }

  private fun chooseStorageTarget(promise: Promise) {
    if (storagePromise != null) {
      promise.reject("DOWNLOAD_STORAGE_PICKER_BUSY", "A storage picker is already open.")
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("DOWNLOAD_STORAGE_PICKER_UNAVAILABLE", "Device Storage selection is unavailable right now.")
      return
    }
    storagePromise = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
    }
    try {
      activity.startActivityForResult(intent, REQUEST_STORAGE_TREE)
    } catch (_: Throwable) {
      storagePromise = null
      promise.reject("DOWNLOAD_STORAGE_PICKER_FAILED", "Orion could not open the Android folder picker.")
    }
  }

  override fun invalidate() {
    OrionDownloadJobStore.removeListener(snapshotListener)
    reactContext.removeActivityEventListener(activityListener)
    storagePromise = null
    playerPromise = null
    OrionPlayerActivity.setProgressListener(null)
    ioExecutor.shutdownNow()
    super.invalidate()
  }

  private fun emitSnapshot(snapshot: JSONObject) {
    if (!reactContext.hasActiveReactInstance()) return
    reactContext.runOnUiQueueThread {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, toWritableMap(snapshot))
    }
  }

  private fun emitPlayerProgress(progress: OrionFinalizedPlayerProgress) {
    if (!reactContext.hasActiveReactInstance()) return
    val event = Arguments.createMap().apply {
      putString("assetId", progress.assetId)
      putString("state", progress.state)
      putBoolean("playing", progress.playing)
      putDouble("currentTime", progress.positionMs.coerceAtLeast(0L) / 1_000.0)
      putDouble("duration", progress.durationMs.coerceAtLeast(0L) / 1_000.0)
      putString("presentation", progress.presentation)
      progress.code?.takeIf { it.isNotBlank() }?.let { putString("code", it.take(120)) }
      progress.message?.takeIf { it.isNotBlank() }?.let { putString("message", it.take(240)) }
    }
    reactContext.runOnUiQueueThread {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(PLAYER_PROGRESS_EVENT_NAME, event)
    }
  }

  private fun toWritableMap(value: JSONObject) = Arguments.makeNativeMap(jsonObjectToMap(value))

  private fun parseAssetIds(value: String): Set<String> = try {
    val input = org.json.JSONArray(value)
    val output = linkedSetOf<String>()
    for (index in 0 until input.length()) {
      input.optString(index).trim().takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }?.let(output::add)
    }
    output
  } catch (_: Throwable) { emptySet() }

  private fun parseAssetSelections(value: String): List<OrionDownloadManagementSelection> {
    return try {
      val input = JSONObject(value)
      if (input.optInt("schemaVersion", 0) != 1) emptyList()
      else {
        val selections = input.optJSONArray("selections") ?: JSONArray()
        buildList {
          for (index in 0 until selections.length()) {
            val selection = selections.optJSONObject(index) ?: continue
            val assetId = selection.optString("assetId").trim()
            if (!assetId.matches(Regex("^[A-Za-z0-9._:-]{1,140}$"))) continue
            add(OrionDownloadManagementSelection(assetId, selection.optString("managementToken").trim().take(128)))
          }
        }
      }
    } catch (_: Throwable) { emptyList() }
  }

  private fun jsonObjectToMap(value: JSONObject): Map<String, Any?> {
    val output = linkedMapOf<String, Any?>()
    val keys = value.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      output[key] = jsonValue(value.opt(key))
    }
    return output
  }

  private fun jsonValue(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> jsonObjectToMap(value)
    is org.json.JSONArray -> (0 until value.length()).map { index -> jsonValue(value.opt(index)) }
    is Boolean, is String, is Number -> value
    else -> value.toString()
  }

  companion object {
    private const val EVENT_NAME = "OrionDownloadEngineSnapshot"
    private const val PLAYER_PROGRESS_EVENT_NAME = "OrionFinalizedPlayerProgress"
    private const val REQUEST_STORAGE_TREE = 45103
    private const val REQUEST_ORION_PLAYER = 45104
    private const val MIN_FREE_RESERVE_BYTES = 32L * 1024L * 1024L
  }
}
