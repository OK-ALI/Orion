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
  private val ioExecutor = Executors.newSingleThreadExecutor()
  private val snapshotListener: (JSONObject) -> Unit = { snapshot -> emitSnapshot(snapshot) }
  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_STORAGE_TREE) return
      val promise = storagePromise
      storagePromise = null
      if (promise == null) return
      if (resultCode != Activity.RESULT_OK || data?.data == null) {
        promise.resolve(Arguments.createMap().apply { putBoolean("ok", false) })
        return
      }
      val target = OrionDownloadStorageRegistry.registerTree(reactContext, data.data!!)
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
      if (destination == "device-storage") {
        val targetId = job.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
        val target = OrionDownloadStorageRegistry.describe(reactContext, targetId)
        if (target == null || !target.writable || !target.persistedPermission) {
          OrionDownloadTransferRuntime.release(jobId)
          promise.reject("DOWNLOAD_STORAGE_TARGET_REQUIRED", "Choose the Device Storage folder again before starting this download.")
          return
        }
        val freeBytes = OrionDownloadStorageRegistry.freeBytes(reactContext, targetId)
        if (freeBytes != null && freeBytes < MIN_FREE_RESERVE_BYTES) {
          OrionDownloadTransferRuntime.release(jobId)
          promise.reject("DOWNLOAD_STORAGE_INSUFFICIENT", "Device Storage does not have enough free space to start this download.")
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
    OrionDownloadJobStore.requestControl(jobId.trim(), "pause")
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
  fun locateAsset(assetId: String, promise: Promise) {
    ioExecutor.execute {
      try { promise.resolve(toWritableMap(OrionDownloadArtifactManager.open(reactContext, assetId.trim(), locate = true))) }
      catch (_: Throwable) { promise.reject("DOWNLOAD_LOCATE_FAILED", "Orion could not locate this download.") }
    }
  }

  @ReactMethod
  fun chooseDeviceStorageTarget(promise: Promise) {
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
    private const val REQUEST_STORAGE_TREE = 45103
    private const val MIN_FREE_RESERVE_BYTES = 32L * 1024L * 1024L
  }
}
