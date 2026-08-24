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
  }
}

internal object OrionDownloadTransferEngine {
  private const val CONNECT_TIMEOUT_MS = 15_000
  private const val READ_TIMEOUT_MS = 20_000
  private const val BUFFER_SIZE = 64 * 1024
  private const val MAX_FRAGMENT_CONCURRENCY = 4
  private const val MIN_FREE_RESERVE_BYTES = 32L * 1024L * 1024L
  private const val MAX_MANIFEST_BYTES = 2 * 1024 * 1024
  private const val MAX_SUBTITLE_BYTES = 5 * 1024 * 1024

  fun runJob(context: android.content.Context, jobId: String) {
    OrionDownloadJobStore.initialize(context)
    val job = OrionDownloadJobStore.getJob(jobId) ?: return
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

  private fun runHls(
    context: android.content.Context,
    job: org.json.JSONObject,
    bound: BoundTransferContext,
  ) {
    val jobId = job.optString("jobId")
    if (job.optString("destination") != "orion-library") {
      OrionDownloadJobStore.markActionRequired(jobId, "fragment-device-storage-not-finalizable", "This stream can currently be saved to Orion Library only.")
      return
    }
    val rootBody = fetchAuthorizedText(bound, bound.root.url, bound.root.url)
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
      val videoBody = fetchAuthorizedText(bound, bound.root.url, master.videoPlaylistUrl)
      if (videoBody == null) {
        OrionDownloadJobStore.markFailed(jobId, "hls-variant-unavailable", "Orion could not read the selected HLS quality playlist.", retryable = true)
        return
      }
      val video = OrionDownloadFragmentPlanner.parseHlsMedia(master.videoPlaylistUrl, videoBody, "video")
      if (!acceptHlsPlan(jobId, video)) return
      fragments.addAll(video.fragments)

      master.audioPlaylistUrl?.let { audioUrl ->
        val audioBody = fetchAuthorizedText(bound, bound.root.url, audioUrl)
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
    if (job.optString("destination") != "orion-library") {
      OrionDownloadJobStore.markActionRequired(jobId, "fragment-device-storage-not-finalizable", "This stream can currently be saved to Orion Library only.")
      return
    }
    val rootBody = fetchAuthorizedText(bound, bound.root.url, bound.root.url)
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
    val totalFragments = fragments.size
    val completed = java.util.concurrent.atomic.AtomicInteger(0)
    val bytes = java.util.concurrent.atomic.AtomicLong(0L)

    fragments.forEachIndexed { index, _ ->
      val file = fragmentFile(partialDir, index)
      if (file.isFile && file.length() > 0L) {
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
                OrionDownloadJobStore.markCancelled(jobId)
                OrionDownloadRecoveryScheduler.cancel(context, jobId)
                partialDir.deleteRecursively()
                OrionDownloadTransferRuntime.release(jobId)
              }
              "context-rejected" -> OrionDownloadJobStore.markActionRequired(jobId, "request-context-rejected", "Open the title and start playback again to refresh the download source.")
              "storage-blocked" -> OrionDownloadJobStore.markStorageBlocked(jobId, "Orion Library needs more free space to continue this download.")
              else -> {
                OrionDownloadJobStore.markRecovering(jobId, outcome.code ?: "fragment-transfer-failed", "Download paused while Orion retries the selected stream.")
                OrionDownloadRecoveryScheduler.schedule(context, jobId, delayMinutes = 1L)
              }
            }
            return
          }
          val done = completed.incrementAndGet()
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
            OrionDownloadNotifications.notify(context, OrionDownloadJobStore.publicJob(jobId))
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
    OrionDownloadJobStore.setProgress(jobId, verifiedBytes, verifiedBytes, totalFragments, totalFragments, null, 0L)
    OrionDownloadJobStore.setState(jobId, "finalizing")
    if (!finalizeFragmented(context, job, partialDir, verifiedBytes, kind, fragments)) return
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
    val request = authorizedChild(bound, bound.root.url, fragment.url) ?: return FragmentOutcome("context-rejected")
    val part = java.io.File(partialDir, fragmentName(index) + ".part")
    val finalFile = fragmentFile(partialDir, index)
    if (part.exists()) part.delete()
    var connection: java.net.HttpURLConnection? = null
    return try {
      connection = openRequest(request, fragment.rangeStart, fragment.rangeEndInclusive)
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
      FragmentOutcome("complete", written)
    } catch (_: java.io.IOException) {
      FragmentOutcome("failed", code = "fragment-network-interrupted")
    } catch (_: Throwable) {
      FragmentOutcome("failed", code = "fragment-transfer-failed")
    } finally {
      try { connection?.disconnect() } catch (_: Throwable) {}
      if (part.exists()) part.delete()
    }
  }

  private fun fetchAuthorizedText(bound: BoundTransferContext, parentUrl: String, childUrl: String): String? {
    var request = if (childUrl == bound.root.url) bound.root else authorizedChild(bound, parentUrl, childUrl) ?: return null
    repeat(4) {
      val connection = openRequest(request, null, null)
      try {
        val status = connection.responseCode
        if (status in 300..399) {
          val location = connection.getHeaderField("Location") ?: return null
          val redirectUrl = try { java.net.URL(java.net.URL(request.url), location).toExternalForm() } catch (_: Throwable) { return null }
          request = authorizedChild(bound, request.url, redirectUrl) ?: return null
          return@repeat
        }
        if (status !in 200..299) return null
        val stream = try { connection.inputStream } catch (_: Throwable) { connection.errorStream } ?: return null
        return stream.use { input ->
          val output = java.io.ByteArrayOutputStream()
          val buffer = ByteArray(8192)
          var remaining = MAX_MANIFEST_BYTES
          while (remaining > 0) {
            val read = input.read(buffer, 0, kotlin.math.min(buffer.size, remaining))
            if (read <= 0) break
            output.write(buffer, 0, read)
            remaining -= read
          }
          output.toString(Charsets.UTF_8.name())
        }
      } finally {
        try { connection.disconnect() } catch (_: Throwable) {}
      }
    }
    return null
  }

  private fun authorizedChild(bound: BoundTransferContext, parentUrl: String, childUrl: String): AuthorizedRequest? {
    OrionDownloadRequestContextBroker.resolveForJob(bound.jobId, bound.requestContextId, bound.candidateId, childUrl)?.let { return it }
    if (!OrionDownloadRequestContextBroker.authorizeDiscoveredDescendant(
        bound.jobId,
        bound.requestContextId,
        bound.candidateId,
        parentUrl,
        childUrl,
      )) return null
    return OrionDownloadRequestContextBroker.resolveForJob(bound.jobId, bound.requestContextId, bound.candidateId, childUrl)
  }

  private fun openRequest(request: AuthorizedRequest, rangeStart: Long?, rangeEndInclusive: Long?): java.net.HttpURLConnection {
    val connection = java.net.URL(request.url).openConnection() as java.net.HttpURLConnection
    connection.instanceFollowRedirects = false
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.useCaches = false
    connection.requestMethod = "GET"
    request.headers.forEach { (name, value) -> if (replayHeader(name)) connection.setRequestProperty(name, value) }
    if (!request.cookieHeader.isNullOrBlank()) connection.setRequestProperty("Cookie", request.cookieHeader)
    if (rangeStart != null && rangeEndInclusive != null) connection.setRequestProperty("Range", "bytes=$rangeStart-$rangeEndInclusive")
    return connection
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

    val connection = java.net.URL(request.url).openConnection() as java.net.HttpURLConnection
    try {
      connection.instanceFollowRedirects = false
      connection.connectTimeout = CONNECT_TIMEOUT_MS
      connection.readTimeout = READ_TIMEOUT_MS
      connection.useCaches = false
      connection.requestMethod = "GET"
      request.headers.forEach { (name, value) ->
        if (replayHeader(name)) connection.setRequestProperty(name, value)
      }
      if (!request.cookieHeader.isNullOrBlank()) connection.setRequestProperty("Cookie", request.cookieHeader)
      if (existing > 0L && bound.resumable) connection.setRequestProperty("Range", "bytes=$existing-")

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
              OrionDownloadNotifications.notify(context, OrionDownloadJobStore.publicJob(jobId))
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
    fragments: List<OrionFragmentRequest>,
  ): Boolean {
    val jobId = job.optString("jobId")
    val media = job.optJSONObject("media") ?: org.json.JSONObject()
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

    val subtitleResult = finalizeSelectedSubtitles(job, finalDir)
    val indexJson = org.json.JSONObject()
      .put("schemaVersion", 1)
      .put("kind", kind)
      .put("fragmentCount", fragments.size)
      .put("files", org.json.JSONArray())
      .put("subtitles", subtitleResult.bundleEntries)
    val files = indexJson.getJSONArray("files")
    fragments.forEachIndexed { index, fragment ->
      val file = java.io.File(finalDir, fragmentName(index))
      files.put(org.json.JSONObject()
        .put("name", file.name)
        .put("role", fragment.role.take(24))
        .put("size", file.length()))
    }
    try {
      java.io.File(finalDir, "orion-fragment-bundle.json").writeText(indexJson.toString(), Charsets.UTF_8)
    } catch (_: Throwable) {
      OrionDownloadJobStore.markFailed(jobId, "fragment-index-write-failed", "Orion could not finalize the offline stream index.", retryable = true)
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
      .put("tracks", subtitleResult.tracks)
      .put("sourceId", job.optString("_sourceId", "unknown"))
      .put("playInOrion", false)
      .put("externallyVisible", false)
      .put("verifiedAt", now)
    val offline = offlineEntry(job, media, assetId, now)
    OrionDownloadJobStore.markCompleted(jobId, asset, offline)
    OrionDownloadNotifications.notify(context, OrionDownloadJobStore.publicJob(jobId))
    return true
  }

  private fun finalizeSelectedSubtitles(job: org.json.JSONObject, finalDir: java.io.File): SubtitleFinalizeResult {
    val sources = job.optJSONArray("_subtitleSources") ?: org.json.JSONArray()
    if (sources.length() == 0) return SubtitleFinalizeResult(org.json.JSONArray(), org.json.JSONArray(), 0L)
    val subtitleDir = java.io.File(finalDir, "subtitles")
    subtitleDir.mkdirs()
    val tracks = org.json.JSONArray()
    val bundleEntries = org.json.JSONArray()
    var totalBytes = 0L
    for (index in 0 until kotlin.math.min(2, sources.length())) {
      val source = sources.optJSONObject(index) ?: continue
      val provider = source.optString("provider").takeIf { it == "subdl" || it == "wyzie" } ?: continue
      val url = source.optString("url")
      val id = source.optString("id").take(100)
      if (id.isBlank()) continue
      val parsed = try { java.net.URI(url) } catch (_: Throwable) { null } ?: continue
      if (parsed.scheme != "https" || parsed.host.isNullOrBlank()) continue
      val format = source.optString("format").takeIf { it in setOf("vtt", "srt", "ass") } ?: "vtt"
      val file = java.io.File(subtitleDir, "subtitle-${index.toString().padStart(2, '0')}.$format")
      val part = java.io.File(file.absolutePath + ".part")
      var connection: java.net.HttpURLConnection? = null
      try {
        val active = java.net.URL(url).openConnection() as java.net.HttpURLConnection
        connection = active
        active.instanceFollowRedirects = true
        active.connectTimeout = CONNECT_TIMEOUT_MS
        active.readTimeout = READ_TIMEOUT_MS
        active.useCaches = false
        active.requestMethod = "GET"
        val status = active.responseCode
        if (status !in 200..299 || active.url.protocol != "https") continue
        val declared = active.getHeaderFieldLong("Content-Length", -1L)
        if (declared > MAX_SUBTITLE_BYTES) continue
        var written = 0L
        part.outputStream().buffered(BUFFER_SIZE).use { output ->
          active.inputStream.use { input ->
            val buffer = ByteArray(16 * 1024)
            while (true) {
              val read = input.read(buffer)
              if (read < 0) break
              if (read == 0) continue
              written += read
              if (written > MAX_SUBTITLE_BYTES) throw java.io.IOException("Subtitle exceeds bounded size")
              output.write(buffer, 0, read)
            }
          }
        }
        if (written <= 0L) continue
        if (file.exists()) file.delete()
        if (!part.renameTo(file)) {
          part.inputStream().use { input -> file.outputStream().use { output -> input.copyTo(output) } }
          part.delete()
        }
        totalBytes += file.length()
        val language = source.optString("language", "und").take(12)
        val label = source.optString("label", "${language.uppercase()} subtitle").take(120)
        tracks.put(org.json.JSONObject()
          .put("id", id)
          .put("kind", "subtitle")
          .put("language", language)
          .put("label", label)
          .put("format", format)
          .put("default", tracks.length() == 0))
        bundleEntries.put(org.json.JSONObject()
          .put("id", id)
          .put("provider", provider)
          .put("language", language)
          .put("name", "subtitles/${file.name}")
          .put("size", file.length()))
      } catch (_: Throwable) {
        part.delete()
      } finally {
        try { connection?.disconnect() } catch (_: Throwable) {}
      }
    }
    if (tracks.length() == 0) subtitleDir.deleteRecursively()
    return SubtitleFinalizeResult(tracks, bundleEntries, totalBytes)
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
    OrionDownloadJobStore.markCompleted(jobId, asset, offline)
    OrionDownloadNotifications.notify(context, OrionDownloadJobStore.publicJob(jobId))
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

  private fun replayHeader(name: String): Boolean = when (name.lowercase(java.util.Locale.US)) {
    "host", "content-length", "connection", "range", "cookie", "accept-encoding" -> false
    else -> true
  }

  private fun safeFileName(media: org.json.JSONObject): String {
    val series = media.optString("seriesTitle").ifBlank { media.optString("title") }
    val season = if (media.isNull("season")) null else media.optInt("season")
    val episode = if (media.isNull("episode")) null else media.optInt("episode")
    val raw = if (season != null && episode != null) "$series S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}" else series
    return raw.replace(Regex("[\\/:*?\"<>|\\u0000-\\u001f]"), "_").replace(Regex("\\s+"), " ").trim().take(100).ifBlank { "Orion download" }
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
  )
}
