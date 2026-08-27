package com.okali.orion.playback

internal data class BoundTransferContext(
  val jobId: String,
  val candidateId: String,
  val requestContextId: String,
  val sourceId: String,
  val transferKind: String,
  val resumable: Boolean,
  val requiredBytes: Long?,
  val expiresAt: Long?,
  val root: AuthorizedRequest,
)

internal object OrionDownloadTransferRuntime {
  private val contexts = mutableMapOf<String, BoundTransferContext>()

  @Synchronized
  fun bind(candidateId: String, jobId: String): BoundTransferContext? {
    contexts[jobId]?.let { existing ->
      if (existing.candidateId == candidateId) return existing
      return null
    }
    val bound = OrionDownloadRequestContextBroker.bindRequestContext(candidateId, jobId) ?: return null
    val seed = OrionDownloadRequestContextBroker.resolveRootForJob(jobId, bound.requestContextId, candidateId) ?: return null
    val context = BoundTransferContext(
      jobId = jobId,
      candidateId = candidateId,
      requestContextId = bound.requestContextId,
      sourceId = seed.sourceId,
      transferKind = seed.resolvedKind,
      resumable = seed.resumable,
      requiredBytes = seed.requiredBytes,
      expiresAt = bound.expiresAt,
      root = seed.request,
    )
    contexts[jobId] = context
    return context
  }

  @Synchronized
  fun get(jobId: String): BoundTransferContext? = contexts[jobId]

  @Synchronized
  fun ensure(candidateId: String, jobId: String): BoundTransferContext? = contexts[jobId] ?: bind(candidateId, jobId)

  @Synchronized
  fun release(jobId: String) {
    contexts.remove(jobId)
    OrionDownloadRequestContextBroker.releaseJob(jobId)
    OrionDownloadSubtitleRuntime.release(jobId)
  }
}

internal object OrionDownloadTransferEngine {
  private const val BUFFER_SIZE = 64 * 1024
  private const val MAX_FRAGMENT_CONCURRENCY = 4
  private const val MIN_FREE_RESERVE_BYTES = 32L * 1024L * 1024L

  fun runJob(context: android.content.Context, jobId: String) {
    OrionDownloadJobStore.initialize(context)
    val job = OrionDownloadJobStore.getJob(jobId) ?: return
    if (job.optString("state") in setOf("completed", "cancelled", "unsupported", "protected")) return
    if (runVerifiedLocalFinalization(context, jobId)) return
    if (OrionDownloadJobStore.getJob(jobId)?.optString("state") == "cancelled") return
    val candidateId = job.optString("candidateId")
    val bound = OrionDownloadTransferRuntime.ensure(candidateId, jobId)
    if (bound == null) {
      OrionDownloadJobStore.markActionRequired(
        jobId,
        "request-context-refresh-required",
        "Open the title and start playback again to refresh the download source.",
      )
      return
    }

    when (bound.transferKind) {
      "direct" -> OrionDownloadJobStore.markActionRequired(jobId, "direct-retired", "Mobile downloads now require an HLS or DASH stream. Try another source.")
      "hls" -> runHls(context, job, bound)
      "dash" -> runDash(context, job, bound)
      else -> OrionDownloadJobStore.markActionRequired(
        jobId,
        "unsupported-transfer-kind",
        "This source did not expose a supported download method.",
      )
    }
  }

  fun hasCompleteLocalFinalization(context: android.content.Context, jobId: String): Boolean {
    val plan = OrionDownloadJobStore.finalizationPlan(jobId) ?: return false
    val count = plan.optInt("fragmentCount", 0)
    val roles = plan.optJSONArray("roles") ?: return false
    if (count <= 0 || count != roles.length()) return false
    val partialDir = java.io.File(context.filesDir, "orion-downloads/partial/$jobId-fragments")
    for (index in 0 until count) {
      val file = fragmentFile(partialDir, index)
      if (!file.isFile || file.length() <= 0L) return false
      if (plan.optBoolean("sealed", false)) {
        val proof = plan.optJSONArray("fragments")?.optJSONObject(index) ?: return false
        if (proof.optInt("index", -1) != index || proof.optLong("sizeBytes", -1L) != file.length()) return false
      }
    }
    val selectedCount = OrionDownloadJobStore.getJob(jobId)?.optJSONArray("selectedSubtitleAssetIds")?.length() ?: 0
    return OrionDownloadSubtitleRuntime.hasLocalSelection(context, jobId, selectedCount)
  }

  private fun runVerifiedLocalFinalization(context: android.content.Context, jobId: String): Boolean {
    if (!hasCompleteLocalFinalization(context, jobId)) return false
    val job = OrionDownloadJobStore.getJob(jobId) ?: return false
    val plan = OrionDownloadJobStore.finalizationPlan(jobId) ?: return false
    val kind = plan.optString("kind").takeIf { it == "hls" || it == "dash" } ?: return false
    val roleJson = plan.optJSONArray("roles") ?: return false
    val roles = (0 until roleJson.length()).map { roleJson.optString(it).take(24) }
    val partialDir = java.io.File(context.filesDir, "orion-downloads/partial/$jobId-fragments")
    val proofs = if (plan.optBoolean("sealed", false)) proofsFromPlan(plan.optJSONArray("fragments")) else roles.mapIndexedNotNull { index, role ->
      OrionDownloadFinalizationManifest.proof(fragmentFile(partialDir, index), index, role)
    }
    if (proofs.size != roles.size) {
      OrionDownloadJobStore.markFailed(jobId, "local-fragments-invalid", "Required local media fragments are missing or corrupt.", retryable = false)
      return true
    }
    val validation = if (plan.optBoolean("sealed", false)) OrionDownloadFinalizationManifest.validate(partialDir, proofs)
    else OrionLocalManifestValidation.Valid(proofs.fold(0L) { total, proof -> if (total > Long.MAX_VALUE - proof.sizeBytes) Long.MAX_VALUE else total + proof.sizeBytes })
    if (validation !is OrionLocalManifestValidation.Valid) {
      OrionDownloadJobStore.markFailed(jobId, "local-fragments-invalid", "Required local media fragments are missing or corrupt.", retryable = false)
      return true
    }
    val selectedCount = job.optJSONArray("selectedSubtitleAssetIds")?.length() ?: 0
    val subtitleProofs = if (plan.optBoolean("sealed", false)) proofsFromPlan(plan.optJSONArray("subtitles")) else OrionDownloadSubtitleRuntime.localProofs(context, jobId)
    if (subtitleProofs.size != selectedCount || !OrionDownloadSubtitleRuntime.validateLocalProofs(context, jobId, subtitleProofs)) {
      OrionDownloadJobStore.markFailed(jobId, "local-finalization-subtitles-invalid", "Selected local subtitle files are missing or corrupt.", retryable = false)
      return true
    }
    if (!plan.optBoolean("sealed", false)) OrionDownloadJobStore.sealFinalizationPlan(jobId, kind, proofs, subtitleProofs)
    val verifiedBytes = validation.totalBytes
    OrionDownloadJobStore.clearControl(jobId)
    OrionDownloadJobStore.setProgress(jobId, verifiedBytes, verifiedBytes, roles.size, roles.size, null, 0L)
    OrionDownloadJobStore.setState(jobId, "finalizing")
    val generation = OrionDownloadJobStore.executionGeneration(jobId) ?: return true
    val completed = finalizeFragmented(context, job, partialDir, verifiedBytes, kind, roles, generation)
    if (completed) {
      OrionDownloadRecoveryScheduler.cancel(context, jobId)
      OrionDownloadTransferRuntime.release(jobId)
    }
    return true
  }

  fun cancelJob(context: android.content.Context, jobId: String) {
    val job = OrionDownloadJobStore.getJob(jobId) ?: return
    if (job.optString("state") == "completed") return
    OrionDownloadJobStore.cancelAndFence(jobId) ?: return
    OrionDownloadRecoveryScheduler.cancel(context, jobId)
    OrionDownloadTransferRuntime.release(jobId)
    try { java.io.File(context.filesDir, "orion-downloads/partial/$jobId-fragments").deleteRecursively() } catch (_: Throwable) {}
    try { java.io.File(context.filesDir, "orion-downloads/partial/$jobId.part").delete() } catch (_: Throwable) {}
    try { java.io.File(context.cacheDir, "orion-downloads/device-finalize/$jobId").deleteRecursively() } catch (_: Throwable) {}
    try { java.io.File(context.cacheDir, "orion-downloads/portable/$jobId").deleteRecursively() } catch (_: Throwable) {}
    OrionDownloadSubtitleRuntime.cleanup(context, jobId)
    OrionDownloadNotifications.reconcile(context)
  }

  private fun runHls(
    context: android.content.Context,
    job: org.json.JSONObject,
    bound: BoundTransferContext,
  ) {
    val jobId = job.optString("jobId")
    val rootBody = OrionDownloadAuthorizedHttp.fetchText(bound, bound.root.url, bound.root.url)
    if (rootBody == null || !rootBody.contains("#EXTM3U", ignoreCase = true)) {
      OrionDownloadJobStore.markFailed(jobId, "hls-manifest-unavailable", "Orion could not read the selected HLS playlist.", retryable = true)
      return
    }
    val quality = job.optString("requestedQuality", "best")
    val master = OrionDownloadFragmentPlanner.selectHlsMaster(bound.root.url, rootBody, quality)
    val fragments = mutableListOf<OrionFragmentRequest>()
    if (master == null) {
      val media = OrionDownloadFragmentPlanner.parseHlsMedia(bound.root.url, rootBody, "video")
      if (!acceptHlsPlan(jobId, media)) return
      fragments.addAll(media.fragments)
    } else {
      val videoBody = OrionDownloadAuthorizedHttp.fetchText(bound, bound.root.url, master.videoPlaylistUrl)
      if (videoBody == null) {
        OrionDownloadJobStore.markFailed(jobId, "hls-variant-unavailable", "Orion could not read the selected HLS quality playlist.", retryable = true)
        return
      }
      val video = OrionDownloadFragmentPlanner.parseHlsMedia(master.videoPlaylistUrl, videoBody, "video")
      if (!acceptHlsPlan(jobId, video)) return
      fragments.addAll(video.fragments)

      master.audioPlaylistUrl?.let { audioUrl ->
        val audioBody = OrionDownloadAuthorizedHttp.fetchText(bound, bound.root.url, audioUrl)
        if (audioBody == null) {
          OrionDownloadJobStore.markFailed(jobId, "hls-audio-unavailable", "Orion could not read the selected HLS audio playlist.", retryable = true)
          return
        }
        val audio = OrionDownloadFragmentPlanner.parseHlsMedia(audioUrl, audioBody, "audio")
        if (!acceptHlsPlan(jobId, audio)) return
        fragments.addAll(audio.fragments)
      }
    }
    if (fragments.isEmpty()) {
      OrionDownloadJobStore.markFailed(jobId, "hls-fragments-missing", "The selected HLS stream did not expose downloadable media fragments.", retryable = false)
      return
    }
    runFragmentPlan(context, job, bound, "hls", fragments)
  }

  private fun acceptHlsPlan(jobId: String, plan: OrionHlsMediaPlan): Boolean {
    if (plan.issueCode != null) {
      val message = when (plan.issueCode) {
        "hls-byterange-not-active" -> "This HLS source uses byte-range segments that need a later compatibility path."
        "hls-encryption-not-active" -> "This HLS source uses encrypted segments that Orion is not enabling in this candidate."
        else -> "This HLS source needs a download compatibility path that is not active yet."
      }
      OrionDownloadJobStore.markActionRequired(jobId, plan.issueCode, message)
      return false
    }
    if (!plan.endList) {
      OrionDownloadJobStore.markActionRequired(jobId, "hls-live-refresh-not-active", "This HLS playlist is still changing. Orion will add bounded playlist refresh before accepting it for offline download.")
      return false
    }
    return true
  }

  private fun runDash(
    context: android.content.Context,
    job: org.json.JSONObject,
    bound: BoundTransferContext,
  ) {
    val jobId = job.optString("jobId")
    val rootBody = OrionDownloadAuthorizedHttp.fetchText(bound, bound.root.url, bound.root.url)
    if (rootBody == null || !rootBody.contains(Regex("<MPD(?:\\s|>)", RegexOption.IGNORE_CASE))) {
      OrionDownloadJobStore.markFailed(jobId, "dash-manifest-unavailable", "Orion could not read the selected DASH manifest.", retryable = true)
      return
    }
    val plan = OrionDownloadFragmentPlanner.parseDash(bound.root.url, rootBody, job.optString("requestedQuality", "best"))
    if (plan.issueCode != null) {
      OrionDownloadJobStore.markActionRequired(jobId, plan.issueCode, dashIssueMessage(plan.issueCode))
      return
    }
    if (plan.fragments.isEmpty()) {
      OrionDownloadJobStore.markFailed(jobId, "dash-fragments-missing", "The selected DASH stream did not expose downloadable media fragments.", retryable = false)
      return
    }
    runFragmentPlan(context, job, bound, "dash", plan.fragments)
  }

  private fun dashIssueMessage(code: String): String = when (code) {
    "dash-segmentbase-not-active" -> "This DASH source uses SegmentBase, which needs a later compatibility path."
    "dash-open-timeline-not-supported" -> "This DASH timeline is open-ended and cannot be finalized safely yet."
    "dash-fragment-limit" -> "This DASH stream exceeds Orion's bounded fragment plan."
    else -> "This DASH manifest shape is not safe to download with the current fragment engine."
  }

  private fun runFragmentPlan(
    context: android.content.Context,
    job: org.json.JSONObject,
    bound: BoundTransferContext,
    kind: String,
    fragments: List<OrionFragmentRequest>,
  ) {
    val jobId = job.optString("jobId")
    val partialDir = java.io.File(context.filesDir, "orion-downloads/partial/$jobId-fragments")
    partialDir.mkdirs()
    val roles = fragments.map { it.role.take(24) }
    OrionDownloadJobStore.setFinalizationPlan(jobId, kind, roles)
    OrionDownloadSubtitleRuntime.prepare(context, jobId)
    val selectedSubtitleCount = job.optJSONArray("selectedSubtitleAssetIds")?.length() ?: 0
    if (!OrionDownloadSubtitleRuntime.hasLocalSelection(context, jobId, selectedSubtitleCount)) {
      OrionDownloadJobStore.markActionRequired(jobId, "subtitle-staging-incomplete", "One or more selected subtitles could not be preserved. Choose subtitles again and restart the download.")
      return
    }
    val totalFragments = fragments.size
    val completed = java.util.concurrent.atomic.AtomicInteger(0)
    val bytes = java.util.concurrent.atomic.AtomicLong(0L)
    val proofs = java.util.concurrent.ConcurrentHashMap<Int, OrionLocalArtifactProof>()

    fragments.forEachIndexed { index, fragment ->
      val file = fragmentFile(partialDir, index)
      if (file.isFile && file.length() > 0L) {
        val proof = OrionDownloadFinalizationManifest.proof(file, index, fragment.role) ?: run {
          OrionDownloadJobStore.markFailed(jobId, "fragment-integrity-hash-failed", "One or more media fragments could not be verified.", retryable = true)
          return
        }
        proofs[index] = proof
        completed.incrementAndGet()
        bytes.addAndGet(file.length())
      }
    }
    OrionDownloadJobStore.clearControl(jobId)
    OrionDownloadJobStore.setState(jobId, "downloading")
    OrionDownloadJobStore.setProgress(jobId, bytes.get(), null, completed.get(), totalFragments, null, null)

    val pending = fragments.withIndex().filter { !fragmentFile(partialDir, it.index).let { file -> file.isFile && file.length() > 0L } }
    if (pending.isNotEmpty()) {
      val pool = java.util.concurrent.Executors.newFixedThreadPool(kotlin.math.min(MAX_FRAGMENT_CONCURRENCY, pending.size))
      val completion = java.util.concurrent.ExecutorCompletionService<FragmentOutcome>(pool)
      val startedAt = System.currentTimeMillis()
      var lastNotifyAt = 0L
      try {
        pending.forEach { indexed ->
          completion.submit(java.util.concurrent.Callable {
            downloadFragment(context, bound, jobId, partialDir, indexed.index, indexed.value)
          })
        }
        repeat(pending.size) {
          val outcome = try {
            completion.take().get()
          } catch (_: Throwable) {
            FragmentOutcome("failed", 0L, "fragment-transfer-failed")
          }
          if (outcome.status != "complete") {
            pool.shutdownNow()
            when (outcome.status) {
              "paused" -> {
                OrionDownloadJobStore.setState(jobId, "paused")
                OrionDownloadRecoveryScheduler.cancel(context, jobId)
              }
              "cancelled" -> {
                OrionDownloadJobStore.cancelAndFence(jobId)
                OrionDownloadRecoveryScheduler.cancel(context, jobId)
                partialDir.deleteRecursively()
                OrionDownloadTransferRuntime.release(jobId)
              }
              "context-rejected" -> OrionDownloadJobStore.markActionRequired(jobId, "request-context-rejected", "Open the title and start playback again to refresh the download source.")
              "storage-blocked" -> OrionDownloadJobStore.markStorageBlocked(jobId, "Orion needs more free device space to continue this download.")
              else -> {
                OrionDownloadJobStore.markRecovering(jobId, outcome.code ?: "fragment-transfer-failed", "Download paused while Orion retries the selected stream.")
                OrionDownloadRecoveryScheduler.schedule(context, jobId, delayMinutes = 1L)
              }
            }
            return
          }
          val done = completed.incrementAndGet()
          outcome.proof?.let { proofs[it.index] = it }
          val downloadedBytes = bytes.addAndGet(outcome.bytes)
          val elapsed = (System.currentTimeMillis() - startedAt).coerceAtLeast(1L)
          val speed = (downloadedBytes * 1000L / elapsed).coerceAtLeast(0L)
          val eta = if (done > 0 && speed > 0L) {
            val averageBytes = downloadedBytes / done
            ((totalFragments - done).coerceAtLeast(0) * averageBytes / speed).coerceAtLeast(0L)
          } else null
          OrionDownloadJobStore.setProgress(jobId, downloadedBytes, null, done, totalFragments, speed, eta)
          val now = System.currentTimeMillis()
          if (now - lastNotifyAt >= 750L || done == totalFragments) {
            OrionDownloadNotifications.reconcile(context)
            lastNotifyAt = now
          }
        }
      } finally {
        pool.shutdownNow()
      }
    }

    OrionDownloadJobStore.setState(jobId, "verifying")
    var verifiedBytes = 0L
    for (index in fragments.indices) {
      val file = fragmentFile(partialDir, index)
      if (!file.isFile || file.length() <= 0L) {
        OrionDownloadJobStore.markFailed(jobId, "fragment-integrity-missing", "One or more media fragments did not pass Orion's verification.", retryable = true)
        return
      }
      verifiedBytes += file.length()
    }
    val orderedProofs = (0 until totalFragments).mapNotNull(proofs::get)
    if (orderedProofs.size != totalFragments) {
      OrionDownloadJobStore.markFailed(jobId, "fragment-integrity-hash-failed", "One or more media fragments could not be verified.", retryable = true)
      return
    }
    val subtitleProofs = OrionDownloadSubtitleRuntime.localProofs(context, jobId)
    if (subtitleProofs.size != selectedSubtitleCount) {
      OrionDownloadJobStore.markFailed(jobId, "subtitle-integrity-failed", "One or more selected subtitles did not pass local verification.", retryable = false)
      return
    }
    OrionDownloadJobStore.sealFinalizationPlan(jobId, kind, orderedProofs, subtitleProofs)
    OrionDownloadRecoveryScheduler.schedule(context, jobId, delayMinutes = 1L, localOnly = true)
    OrionDownloadJobStore.setProgress(jobId, verifiedBytes, verifiedBytes, totalFragments, totalFragments, null, 0L)
    OrionDownloadJobStore.setState(jobId, "finalizing")
    val generation = OrionDownloadJobStore.executionGeneration(jobId) ?: return
    if (!finalizeFragmented(context, job, partialDir, verifiedBytes, kind, roles, generation)) return
    OrionDownloadRecoveryScheduler.cancel(context, jobId)
    OrionDownloadTransferRuntime.release(jobId)
  }

  private fun downloadFragment(
    context: android.content.Context,
    bound: BoundTransferContext,
    jobId: String,
    partialDir: java.io.File,
    index: Int,
    fragment: OrionFragmentRequest,
  ): FragmentOutcome {
    when (OrionDownloadJobStore.control(jobId)) {
      "pause" -> return FragmentOutcome("paused")
      "cancel" -> return FragmentOutcome("cancelled")
    }
    if (android.os.StatFs(context.filesDir.absolutePath).availableBytes < MIN_FREE_RESERVE_BYTES) {
      return FragmentOutcome("storage-blocked")
    }
    val request = OrionDownloadAuthorizedHttp.authorizedChild(bound, bound.root.url, fragment.url) ?: return FragmentOutcome("context-rejected")
    val part = java.io.File(partialDir, fragmentName(index) + ".part")
    val finalFile = fragmentFile(partialDir, index)
    if (part.exists()) part.delete()
    var connection: java.net.HttpURLConnection? = null
    return try {
      connection = OrionDownloadAuthorizedHttp.openRequest(request, fragment.rangeStart, fragment.rangeEndInclusive)
      val status = connection.responseCode
      if (status == java.net.HttpURLConnection.HTTP_UNAUTHORIZED || status == java.net.HttpURLConnection.HTTP_FORBIDDEN) {
        return FragmentOutcome("context-rejected")
      }
      val hasRange = fragment.rangeStart != null && fragment.rangeEndInclusive != null
      if (hasRange && status != java.net.HttpURLConnection.HTTP_PARTIAL) {
        return FragmentOutcome("failed", code = "fragment-range-unsupported")
      }
      if (!hasRange && status !in 200..299) {
        return FragmentOutcome("failed", code = "fragment-http-$status")
      }
      var written = 0L
      val digest = java.security.MessageDigest.getInstance("SHA-256")
      part.outputStream().buffered(BUFFER_SIZE).use { output ->
        connection.inputStream.use { input ->
          val buffer = ByteArray(BUFFER_SIZE)
          while (true) {
            when (OrionDownloadJobStore.control(jobId)) {
              "pause" -> return FragmentOutcome("paused")
              "cancel" -> return FragmentOutcome("cancelled")
            }
            val read = input.read(buffer)
            if (read < 0) break
            if (read == 0) continue
            output.write(buffer, 0, read)
            digest.update(buffer, 0, read)
            written += read
          }
        }
      }
      if (written <= 0L) return FragmentOutcome("failed", code = "fragment-empty")
      if (hasRange) {
        val expected = fragment.rangeEndInclusive!! - fragment.rangeStart!! + 1L
        if (status == java.net.HttpURLConnection.HTTP_PARTIAL && written != expected) return FragmentOutcome("failed", code = "fragment-range-size-mismatch")
      }
      if (finalFile.exists()) finalFile.delete()
      if (!part.renameTo(finalFile)) {
        part.copyTo(finalFile, overwrite = true)
        part.delete()
      }
      if (!finalFile.isFile || finalFile.length() != written) return FragmentOutcome("failed", code = "fragment-finalize-failed")
      val sha256 = digest.digest().joinToString("") { byte -> "%02x".format(byte) }
      FragmentOutcome("complete", written, proof = OrionLocalArtifactProof(index, fragment.role.take(24), written, sha256))
    } catch (_: java.io.IOException) {
      FragmentOutcome("failed", code = "fragment-network-interrupted")
    } catch (_: Throwable) {
      FragmentOutcome("failed", code = "fragment-transfer-failed")
    } finally {
      try { connection?.disconnect() } catch (_: Throwable) {}
      if (part.exists()) part.delete()
    }
  }

  private fun runDirect(
    context: android.content.Context,
    job: org.json.JSONObject,
    bound: BoundTransferContext,
  ) {
    val jobId = job.optString("jobId")
    val destination = job.optString("destination")
    val partial = java.io.File(context.filesDir, "orion-downloads/partial/$jobId.part")
    partial.parentFile?.mkdirs()
    var existing = if (partial.isFile) partial.length().coerceAtLeast(0L) else 0L
    val request = bound.root

    val resumeStart = existing.takeIf { it > 0L && bound.resumable }
    val connection = OrionDownloadAuthorizedHttp.openRequest(request, resumeStart, null)
    try {

      val status = connection.responseCode
      if (status == java.net.HttpURLConnection.HTTP_UNAUTHORIZED || status == java.net.HttpURLConnection.HTTP_FORBIDDEN) {
        OrionDownloadJobStore.markActionRequired(jobId, "request-context-rejected", "Open the title and start playback again to refresh the download source.")
        return
      }
      if (status !in 200..299) {
        OrionDownloadJobStore.markFailed(jobId, "http-$status", "The selected source stopped responding during download.", retryable = true)
        return
      }

      if (existing > 0L && status != java.net.HttpURLConnection.HTTP_PARTIAL) {
        existing = 0L
        if (partial.exists()) partial.delete()
      }
      val contentLength = connection.getHeaderFieldLong("Content-Length", -1L).takeIf { it >= 0L }
      val total = when {
        status == java.net.HttpURLConnection.HTTP_PARTIAL && contentLength != null -> existing + contentLength
        contentLength != null -> contentLength
        bound.requiredBytes != null -> bound.requiredBytes
        else -> null
      }
      val free = android.os.StatFs(context.filesDir.absolutePath).availableBytes
      if (total != null && total - existing > free) {
        OrionDownloadJobStore.markStorageBlocked(jobId, "Orion Library does not have enough free space for this download.")
        return
      }

      OrionDownloadJobStore.clearControl(jobId)
      OrionDownloadJobStore.setState(jobId, "downloading")
      val started = System.currentTimeMillis()
      var downloaded = existing
      var lastReportAt = started
      var lastReportBytes = downloaded
      java.io.RandomAccessFile(partial, "rw").use { output ->
        output.seek(existing)
        connection.inputStream.use { input ->
          val buffer = ByteArray(BUFFER_SIZE)
          while (true) {
            when (OrionDownloadJobStore.control(jobId)) {
              "pause" -> {
                OrionDownloadJobStore.setState(jobId, "paused")
                OrionDownloadRecoveryScheduler.cancel(context, jobId)
                return
              }
              "cancel" -> {
                OrionDownloadJobStore.markCancelled(jobId)
                OrionDownloadRecoveryScheduler.cancel(context, jobId)
                partial.delete()
                OrionDownloadTransferRuntime.release(jobId)
                return
              }
            }
            val read = input.read(buffer)
            if (read < 0) break
            if (read == 0) continue
            output.write(buffer, 0, read)
            downloaded += read
            val now = System.currentTimeMillis()
            if (now - lastReportAt >= 750L) {
              val elapsed = (now - lastReportAt).coerceAtLeast(1L)
              val speed = ((downloaded - lastReportBytes) * 1000L / elapsed).coerceAtLeast(0L)
              val eta = if (total != null && speed > 0L) ((total - downloaded).coerceAtLeast(0L) / speed) else null
              OrionDownloadJobStore.setProgress(jobId, downloaded, total, null, null, speed, eta)
              OrionDownloadNotifications.reconcile(context)
              lastReportAt = now
              lastReportBytes = downloaded
            }
          }
        }
      }

      OrionDownloadJobStore.setProgress(jobId, downloaded, total ?: downloaded, null, null, null, 0L)
      OrionDownloadJobStore.setState(jobId, "verifying")
      if (!partial.isFile || partial.length() <= 0L || (total != null && partial.length() != total)) {
        OrionDownloadJobStore.markFailed(jobId, "integrity-size-mismatch", "The downloaded file did not pass Orion's size verification.", retryable = true)
        return
      }
      OrionDownloadJobStore.setState(jobId, "finalizing")
      finalizeDirect(context, job, partial, downloaded, destination)
      OrionDownloadRecoveryScheduler.cancel(context, jobId)
      OrionDownloadTransferRuntime.release(jobId)
    } catch (_: java.io.IOException) {
      OrionDownloadJobStore.markRecovering(jobId, "network-interrupted", "Download paused while Orion waits for the network.")
      OrionDownloadRecoveryScheduler.schedule(context, jobId, delayMinutes = 1L)
    } catch (_: Throwable) {
      OrionDownloadJobStore.markFailed(jobId, "transfer-failed", "Orion could not continue this download.", retryable = true)
    } finally {
      try { connection.disconnect() } catch (_: Throwable) {}
    }
  }

  private fun finalizeFragmented(
    context: android.content.Context,
    job: org.json.JSONObject,
    partialDir: java.io.File,
    verifiedBytes: Long,
    kind: String,
    roles: List<String>,
    generation: Long,
  ): Boolean {
    return if (job.optString("destination") == "device-storage") {
      finalizeFragmentedToDeviceStorage(context, job, partialDir, verifiedBytes, roles, generation)
    } else {
      finalizeFragmentedToOrionLibrary(context, job, partialDir, verifiedBytes, kind, roles, generation)
    }
  }

  private fun finalizeFragmentedToOrionLibrary(
    context: android.content.Context,
    job: org.json.JSONObject,
    partialDir: java.io.File,
    verifiedBytes: Long,
    kind: String,
    roles: List<String>,
    generation: Long,
  ): Boolean {
    val jobId = job.optString("jobId")
    val media = job.optJSONObject("media") ?: org.json.JSONObject()
    if (isCancellationRequested(jobId)) return false
    val completedRoot = java.io.File(context.filesDir, "orion-downloads/library")
    completedRoot.mkdirs()
    val finalDir = java.io.File(completedRoot, "$jobId.fragments")
    if (finalDir.exists()) finalDir.deleteRecursively()
    if (!partialDir.renameTo(finalDir)) {
      try {
        partialDir.copyRecursively(finalDir, overwrite = true)
        partialDir.deleteRecursively()
      } catch (_: Throwable) {
        OrionDownloadJobStore.markFailed(jobId, "fragment-finalization-failed", "Orion could not finalize the downloaded stream fragments.", retryable = true)
        return false
      }
    }

    if (isCancellationRequested(jobId)) {
      finalDir.deleteRecursively()
      OrionDownloadSubtitleRuntime.cleanup(context, jobId)
      return false
    }
    val subtitleResult = finalizeSelectedSubtitles(context, jobId, finalDir)
    val indexJson = org.json.JSONObject()
      .put("schemaVersion", 1)
      .put("kind", kind)
      .put("fragmentCount", roles.size)
      .put("files", org.json.JSONArray())
      .put("subtitles", subtitleResult.bundleEntries)
    val files = indexJson.getJSONArray("files")
    roles.forEachIndexed { index, role ->
      val file = java.io.File(finalDir, fragmentName(index))
      files.put(org.json.JSONObject()
        .put("name", file.name)
        .put("role", role.take(24))
        .put("size", file.length()))
    }
    try {
      java.io.File(finalDir, "orion-fragment-bundle.json").writeText(indexJson.toString(), Charsets.UTF_8)
    } catch (_: Throwable) {
      OrionDownloadJobStore.markFailed(jobId, "fragment-index-write-failed", "Orion could not finalize the offline stream index.", retryable = true)
      return false
    }

    if (isCancellationRequested(jobId)) {
      finalDir.deleteRecursively()
      OrionDownloadSubtitleRuntime.cleanup(context, jobId)
      return false
    }
    val assetId = "asset-$jobId"
    val now = System.currentTimeMillis()
    val asset = org.json.JSONObject()
      .put("schemaVersion", 1)
      .put("assetId", assetId)
      .put("jobId", jobId)
      .put("media", org.json.JSONObject(media.toString()))
      .put("destination", "orion-library")
      .put("storageTarget", org.json.JSONObject(job.optJSONObject("storageTarget")?.toString() ?: "{}"))
      .put("locator", org.json.JSONObject().put("kind", "managed").put("value", "orion-library:$jobId"))
      .put("container", "$kind-fragments")
      .put("mimeType", if (kind == "hls") "application/vnd.apple.mpegurl" else "application/dash+xml")
      .put("verifiedSizeBytes", verifiedBytes + subtitleResult.bytes)
      .put("sha256", org.json.JSONObject.NULL)
      .put("tracks", finalizedTracks(roles, subtitleResult.tracks))
      .put("sourceId", job.optString("_sourceId", "unknown"))
      .put("playInOrion", false)
      .put("externallyVisible", false)
      .put("verifiedAt", now)
      .put("_artifacts", managedOwnedArtifacts(assetId, jobId, media, finalDir, subtitleResult.bundleEntries, verifiedBytes, now))
    val offline = offlineEntry(job, media, assetId, now)
    if (!OrionDownloadJobStore.markCompleted(jobId, generation, asset, offline)) {
      finalDir.deleteRecursively()
      OrionDownloadSubtitleRuntime.cleanup(context, jobId)
      return false
    }
    OrionDownloadSubtitleRuntime.cleanup(context, jobId)
    OrionDownloadNotifications.reconcile(context)
    return true
  }

  private fun finalizeFragmentedToDeviceStorage(
    context: android.content.Context,
    job: org.json.JSONObject,
    partialDir: java.io.File,
    verifiedBytes: Long,
    roles: List<String>,
    generation: Long,
  ): Boolean {
    val jobId = job.optString("jobId")
    val media = job.optJSONObject("media") ?: org.json.JSONObject()
    val staging = java.io.File(context.cacheDir, "orion-downloads/device-finalize/$jobId")
    if (staging.exists()) staging.deleteRecursively()
    staging.mkdirs()
    OrionDownloadNotifications.transitionFinalizationStage(context, jobId, "preparing", generation)
    val subtitleResult = finalizeSelectedSubtitles(context, jobId, staging)
    val outcome = OrionDownloadPortableFinalizer.finalizeToDeviceStorage(
      context = context,
      job = job,
      partialDir = partialDir,
      roles = roles,
      verifiedBytes = verifiedBytes,
      fileName = safeFileName(media) + ".mp4",
      subtitleDirectory = java.io.File(staging, "subtitles"),
      subtitleEntries = subtitleResult.bundleEntries,
      subtitleTracks = subtitleResult.tracks,
      generation = generation,
    )
    staging.deleteRecursively()
    if (outcome.cancelled || isCancellationRequested(jobId)) {
      outcome.publishedUris.forEach { uri -> OrionDownloadStorageRegistry.deleteDocument(context, uri) }
      return false
    }
    if (!outcome.ok || outcome.locatorValue.isNullOrBlank()) {
      val code = outcome.failureCode ?: "portable-finalization-failed"
      val message = outcome.failureMessage ?: "Orion could not create a safe portable file for this stream."
      if (outcome.actionRequired) OrionDownloadJobStore.markActionRequired(jobId, code, message)
      else OrionDownloadJobStore.markFailed(jobId, code, message, retryable = outcome.retryable)
      return false
    }

    partialDir.deleteRecursively()
    val assetId = "asset-$jobId"
    val now = System.currentTimeMillis()
    val asset = org.json.JSONObject()
      .put("schemaVersion", 1)
      .put("assetId", assetId)
      .put("jobId", jobId)
      .put("media", org.json.JSONObject(media.toString()))
      .put("destination", "device-storage")
      .put("storageTarget", org.json.JSONObject(job.optJSONObject("storageTarget")?.toString() ?: "{}"))
      .put("locator", org.json.JSONObject().put("kind", "content-uri").put("value", outcome.locatorValue))
      .put("container", "mp4")
      .put("mimeType", "video/mp4")
      .put("verifiedSizeBytes", outcome.mediaBytes + outcome.sidecarBytes)
      .put("sha256", org.json.JSONObject.NULL)
      .put("tracks", outcome.tracks)
      .put("sourceId", job.optString("_sourceId", "unknown"))
      .put("playInOrion", true)
      .put("externallyVisible", true)
      .put("verifiedAt", now)
      .put("_artifacts", publishedOwnedArtifacts(assetId, outcome.publishedArtifacts, now))
    val offline = offlineEntry(job, media, assetId, now)
    if (isCancellationRequested(jobId)) {
      outcome.publishedUris.forEach { uri -> OrionDownloadStorageRegistry.deleteDocument(context, uri) }
      OrionDownloadSubtitleRuntime.cleanup(context, jobId)
      return false
    }
    if (!OrionDownloadJobStore.markCompleted(jobId, generation, asset, offline)) {
      outcome.publishedUris.forEach { uri -> OrionDownloadStorageRegistry.deleteDocument(context, uri) }
      OrionDownloadSubtitleRuntime.cleanup(context, jobId)
      return false
    }
    OrionDownloadSubtitleRuntime.cleanup(context, jobId)
    OrionDownloadNotifications.reconcile(context)
    return true
  }

  private fun finalizedTracks(
    roles: List<String>,
    subtitleTracks: org.json.JSONArray,
  ): org.json.JSONArray {
    val tracks = org.json.JSONArray()

    if (roles.any { role -> role == "audio" || role == "audio-init" }) {
      tracks.put(org.json.JSONObject()
        .put("id", "audio-default")
        .put("kind", "audio")
        .put("language", org.json.JSONObject.NULL)
        .put("label", "Audio")
        .put("format", org.json.JSONObject.NULL)
        .put("default", true))
    }

    for (index in 0 until subtitleTracks.length()) {
      subtitleTracks.optJSONObject(index)?.let { track ->
        tracks.put(org.json.JSONObject(track.toString()))
      }
    }

    return tracks
  }
  private fun isCancellationRequested(jobId: String): Boolean =
    OrionDownloadJobStore.control(jobId) == "cancel" || OrionDownloadJobStore.getJob(jobId)?.optString("state") == "cancelled"

  private fun finalizeSelectedSubtitles(
    context: android.content.Context,
    jobId: String,
    finalDir: java.io.File,
  ): SubtitleFinalizeResult {
    val prepared = OrionDownloadSubtitleRuntime.finalizeInto(context, jobId, finalDir)
    return SubtitleFinalizeResult(prepared.tracks, prepared.bundleEntries, prepared.bytes)
  }

  private fun finalizeDirect(
    context: android.content.Context,
    job: org.json.JSONObject,
    partial: java.io.File,
    verifiedBytes: Long,
    destination: String,
  ) {
    val jobId = job.optString("jobId")
    val media = job.optJSONObject("media") ?: org.json.JSONObject()
    val sourceId = job.optString("_sourceId", "unknown")
    val fileName = safeFileName(media) + ".mp4"
    val locatorKind: String
    val locatorValue: String
    var externallyVisible = false

    if (destination == "device-storage") {
      val targetId = job.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
      val uri = OrionDownloadStorageRegistry.createDocument(context, targetId, "video/mp4", fileName)
      if (uri == null) {
        OrionDownloadJobStore.markActionRequired(jobId, "storage-destination-unavailable", "Choose the Device Storage folder again and retry finalization.")
        return
      }
      try {
        context.contentResolver.openOutputStream(uri, "w")?.use { output ->
          partial.inputStream().use { input -> input.copyTo(output, BUFFER_SIZE) }
        } ?: throw java.io.IOException("No output stream")
      } catch (_: Throwable) {
        OrionDownloadJobStore.markFailed(jobId, "finalization-write-failed", "Orion could not write the completed file to Device Storage.", retryable = true)
        return
      }
      partial.delete()
      locatorKind = "content-uri"
      locatorValue = uri.toString()
      externallyVisible = true
    } else {
      val completedDir = java.io.File(context.filesDir, "orion-downloads/library")
      completedDir.mkdirs()
      val finalFile = java.io.File(completedDir, "$jobId.mp4")
      if (finalFile.exists()) finalFile.delete()
      if (!partial.renameTo(finalFile)) {
        try {
          partial.inputStream().use { input -> finalFile.outputStream().use { output -> input.copyTo(output, BUFFER_SIZE) } }
          partial.delete()
        } catch (_: Throwable) {
          OrionDownloadJobStore.markFailed(jobId, "finalization-write-failed", "Orion could not finalize this download.", retryable = true)
          return
        }
      }
      locatorKind = "managed"
      locatorValue = "orion-library:$jobId"
    }

    val assetId = "asset-$jobId"
    val now = System.currentTimeMillis()
    val asset = org.json.JSONObject()
      .put("schemaVersion", 1)
      .put("assetId", assetId)
      .put("jobId", jobId)
      .put("media", org.json.JSONObject(media.toString()))
      .put("destination", destination)
      .put("storageTarget", org.json.JSONObject(job.optJSONObject("storageTarget")?.toString() ?: "{}"))
      .put("locator", org.json.JSONObject().put("kind", locatorKind).put("value", locatorValue))
      .put("container", "mp4")
      .put("mimeType", "video/mp4")
      .put("verifiedSizeBytes", verifiedBytes)
      .put("sha256", org.json.JSONObject.NULL)
      .put("tracks", org.json.JSONArray())
      .put("sourceId", sourceId)
      .put("playInOrion", true)
      .put("externallyVisible", externallyVisible)
      .put("verifiedAt", now)
    val offline = offlineEntry(job, media, assetId, now)
    val generation = OrionDownloadJobStore.executionGeneration(jobId) ?: return
    OrionDownloadJobStore.markCompleted(jobId, generation, asset, offline)
    OrionDownloadNotifications.reconcile(context)
  }

  private fun offlineEntry(job: org.json.JSONObject, media: org.json.JSONObject, assetId: String, now: Long): org.json.JSONObject {
    return org.json.JSONObject()
      .put("schemaVersion", 1)
      .put("entryId", job.optString("_itemKey"))
      .put("groupKey", job.optString("_groupKey"))
      .put("media", org.json.JSONObject(media.toString()))
      .put("assetIds", org.json.JSONArray().put(assetId))
      .put("primaryAssetId", assetId)
      .put("title", media.optString("title"))
      .put("seriesTitle", if (media.isNull("seriesTitle")) org.json.JSONObject.NULL else media.opt("seriesTitle"))
      .put("episodeTitle", if (media.isNull("episodeTitle")) org.json.JSONObject.NULL else media.opt("episodeTitle"))
      .put("posterPath", if (media.isNull("posterPath")) org.json.JSONObject.NULL else media.opt("posterPath"))
      .put("backdropPath", if (media.isNull("backdropPath")) org.json.JSONObject.NULL else media.opt("backdropPath"))
      .put("updatedAt", now)
  }

  private fun fragmentName(index: Int): String = "f${index.toString().padStart(6, '0')}.bin"
  private fun fragmentFile(directory: java.io.File, index: Int): java.io.File = java.io.File(directory, fragmentName(index))

  private fun managedOwnedArtifacts(
    assetId: String,
    jobId: String,
    media: org.json.JSONObject,
    finalDir: java.io.File,
    subtitleEntries: org.json.JSONArray,
    fragmentBytes: Long,
    now: Long,
  ): org.json.JSONArray {
    val artifacts = org.json.JSONArray()
    val indexBytes = java.io.File(finalDir, "orion-fragment-bundle.json").length().coerceAtLeast(0L)
    val primaryBytes = if (fragmentBytes > Long.MAX_VALUE - indexBytes) Long.MAX_VALUE else fragmentBytes + indexBytes
    artifacts.put(ownedArtifact(
      artifactId = "$assetId:primary",
      role = "primary",
      displayName = safeFileName(media),
      mimeType = "application/vnd.orion.fragment-bundle",
      sizeBytes = primaryBytes,
      locatorKind = "managed-relative",
      locatorValue = "$jobId.fragments",
      now = now,
    ))
    for (index in 0 until subtitleEntries.length()) {
      val entry = subtitleEntries.optJSONObject(index) ?: continue
      val relative = entry.optString("name")
      if (!relative.matches(Regex("^subtitles/[A-Za-z0-9._-]{1,120}$"))) continue
      artifacts.put(ownedArtifact(
        artifactId = "$assetId:subtitle:$index",
        role = "subtitle",
        displayName = relative.substringAfterLast('/'),
        mimeType = subtitleMime(relative.substringAfterLast('.', "srt")),
        sizeBytes = entry.optLong("size", 0L).coerceAtLeast(0L),
        locatorKind = "managed-relative",
        locatorValue = "$jobId.fragments/$relative",
        now = now,
      ))
    }
    return artifacts
  }

  private fun publishedOwnedArtifacts(assetId: String, published: List<OrionPublishedArtifact>, now: Long): org.json.JSONArray {
    val artifacts = org.json.JSONArray()
    published.forEachIndexed { index, artifact ->
      artifacts.put(ownedArtifact(
        artifactId = if (artifact.role == "primary") "$assetId:primary" else "$assetId:subtitle:${index - 1}",
        role = artifact.role,
        displayName = artifact.displayName,
        mimeType = artifact.mimeType,
        sizeBytes = artifact.sizeBytes,
        locatorKind = "content-uri",
        locatorValue = artifact.uri.toString(),
        now = now,
      ))
    }
    return artifacts
  }

  private fun ownedArtifact(
    artifactId: String,
    role: String,
    displayName: String,
    mimeType: String,
    sizeBytes: Long,
    locatorKind: String,
    locatorValue: String,
    now: Long,
  ): org.json.JSONObject = org.json.JSONObject()
    .put("schemaVersion", 1)
    .put("artifactId", artifactId)
    .put("role", role)
    .put("displayName", displayName.take(140))
    .put("mimeType", mimeType)
    .put("expectedSizeBytes", sizeBytes.coerceAtLeast(0L))
    .put("observedSizeBytes", sizeBytes.coerceAtLeast(0L))
    .put("availability", "verified")
    .put("lastCheckedAt", now)
    .put("_locator", org.json.JSONObject().put("kind", locatorKind).put("value", locatorValue))

  private fun subtitleMime(format: String): String = when (format.lowercase()) {
    "srt" -> "application/x-subrip"
    "ass", "ssa" -> "text/x-ssa"
    else -> "text/vtt"
  }

  private fun proofsFromPlan(input: org.json.JSONArray?): List<OrionLocalArtifactProof> {
    input ?: return emptyList()
    val output = mutableListOf<OrionLocalArtifactProof>()
    for (index in 0 until input.length()) {
      val proof = input.optJSONObject(index) ?: return emptyList()
      val proofIndex = proof.optInt("index", -1)
      val role = proof.optString("role").take(24)
      val size = proof.optLong("sizeBytes", -1L)
      val sha256 = proof.optString("sha256")
      if (proofIndex < 0 || role.isBlank() || size <= 0L || !sha256.matches(Regex("^[a-f0-9]{64}$"))) return emptyList()
      output.add(OrionLocalArtifactProof(proofIndex, role, size, sha256))
    }
    return output.sortedBy { it.index }
  }

  private fun safeFileName(media: org.json.JSONObject): String {
    val series = safeMediaNamePart(media, "seriesTitle")
      ?: safeMediaNamePart(media, "title")
      ?: "Orion download"
    val season = if (media.isNull("season")) null else media.optInt("season")
    val episode = if (media.isNull("episode")) null else media.optInt("episode")
    val raw = if (season != null && episode != null) "$series S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}" else series
    return raw.replace(Regex("[\\/:*?\"<>|\\u0000-\\u001f]"), "_").replace(Regex("\\s+"), " ").trim().take(100).ifBlank { "Orion download" }
  }

  private fun safeMediaNamePart(media: org.json.JSONObject, key: String): String? {
    if (!media.has(key) || media.isNull(key)) return null
    val value = media.opt(key)
    if (value !is String) return null
    return value.trim().takeIf { it.isNotBlank() }
  }

  private data class SubtitleFinalizeResult(
    val tracks: org.json.JSONArray,
    val bundleEntries: org.json.JSONArray,
    val bytes: Long,
  )

  private data class FragmentOutcome(
    val status: String,
    val bytes: Long = 0L,
    val code: String? = null,
    val proof: OrionLocalArtifactProof? = null,
  )
}
