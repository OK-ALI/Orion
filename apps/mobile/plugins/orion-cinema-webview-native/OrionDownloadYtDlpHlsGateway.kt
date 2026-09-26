package com.okali.orion.playback

import android.util.Log
import java.net.URL
import java.util.Locale

internal data class OrionYtDlpHlsGatewayEntry(
  val rootUrl: String,
)

/**
 * Prepares a VOD HLS source for yt-dlp without exposing provider URLs.
 *
 * Existing Orion quality selection remains authoritative. Selected provider
 * playlists are fetched through OrionDownloadAuthorizedHttp, media playlist
 * structure is preserved, and every network-bearing media URI becomes an
 * opaque job-scoped loopback provider route.
 */
internal object OrionDownloadYtDlpHlsGateway {
  private const val MAX_NESTED_MEDIA_PLAYLISTS = 4

  private data class ResolvedMediaPlaylist(
    val url: String,
    val body: String,
    val plan: OrionHlsMediaPlan,
  )
  private val URI_ATTRIBUTE =
    Regex(
      """URI="([^"]+)"""",
      RegexOption.IGNORE_CASE,
    )

  private val METHOD_ATTRIBUTE =
    Regex(
      """(?:^|,)METHOD=([^,]+)""",
      RegexOption.IGNORE_CASE,
    )
  private val KEYFORMAT_ATTRIBUTE =
    Regex(
      """(?:^|,)KEYFORMAT=(?:"([^"]+)"|([^,]+))""",
      RegexOption.IGNORE_CASE,
    )

  fun prepare(
    bound: BoundTransferContext,
    requestedQuality: String,
    session: OrionDownloadYtDlpGatewaySession,
  ): OrionYtDlpHlsGatewayEntry? {
    if (
      bound.transferKind != "hls" ||
      !session.owns(bound.jobId)
    ) {
      return null
    }

    val rootUrl =
      bound.root.url

    fun route(parentUrl: String, childUrl: String, isKey: Boolean = false): String? =
      session.registerProvider(
        bound = bound,
        parentUrl = parentUrl,
        childUrl = childUrl,
        rangeStart = null,
        rangeEndInclusive = null,
        isKey = isKey,
        // FFmpeg's HLS demuxer rejects opaque .bin media URLs at its
        // allowed_segment_extensions gate before it performs any HTTP request.
        // Keep provider coordinates opaque while giving media routes an HLS-safe
        // local suffix. The bytes are still content-probed by FFmpeg.
        routeSuffix = if (isKey) "bin" else "ts",
      )

    val rootBody =
      OrionDownloadAuthorizedHttp.fetchText(
        bound,
        rootUrl,
        rootUrl,
      ) ?: return null

    if (
      !OrionDownloadFragmentPlanner.isHlsPlaylistBody(rootBody)
    ) {
      return null
    }

    val selected =
      OrionDownloadFragmentPlanner.selectHlsMaster(
        rootUrl,
        rootBody,
        requestedQuality,
      )

    if (selected == null) {
      val resolved =
        resolveNestedMediaPlaylist(
          bound = bound,
          startUrl = rootUrl,
          startBody = rootBody,
          role = "video",
        ) ?: return null

      val rewritten =
        rewriteMediaPlaylist(
          resolved.url,
          resolved.body,
          { childUrl -> route(resolved.url, childUrl) },
          { keyUrl -> route(resolved.url, keyUrl, isKey = true) },
        ) ?: return null

      val localRoot =
        session.registerManifest(
          "hls",
          rewritten,
        ) ?: return null

      return OrionYtDlpHlsGatewayEntry(
        rootUrl = localRoot,
      )
    }

    val videoBody =
      OrionDownloadAuthorizedHttp.fetchText(
        bound,
        rootUrl,
        selected.videoPlaylistUrl,
      ) ?: return null

    val resolvedVideo =
      resolveNestedMediaPlaylist(
        bound = bound,
        startUrl = selected.videoPlaylistUrl,
        startBody = videoBody,
        role = "video",
      ) ?: return null

    val rewrittenVideo =
      rewriteMediaPlaylist(
        resolvedVideo.url,
        resolvedVideo.body,
        { childUrl -> route(resolvedVideo.url, childUrl) },
        { keyUrl -> route(resolvedVideo.url, keyUrl, isKey = true) },
      ) ?: return null

    val localVideo =
      session.registerManifest(
        "hls",
        rewrittenVideo,
      ) ?: return null

    val localAudio =
      selected.audioPlaylistUrl
        ?.let { audioUrl ->
          val audioBody =
            OrionDownloadAuthorizedHttp.fetchText(
              bound,
              rootUrl,
              audioUrl,
            ) ?: return null

          val resolvedAudio =
            resolveNestedMediaPlaylist(
              bound = bound,
              startUrl = audioUrl,
              startBody = audioBody,
              role = "audio",
            ) ?: return null

          val rewrittenAudio =
            rewriteMediaPlaylist(
              resolvedAudio.url,
              resolvedAudio.body,
              { childUrl -> route(resolvedAudio.url, childUrl) },
              { keyUrl -> route(resolvedAudio.url, keyUrl, isKey = true) },
            ) ?: return null

          session.registerManifest(
            "hls",
            rewrittenAudio,
          ) ?: return null
        }

    val rewrittenMaster =
      rewriteSelectedMaster(
        baseUrl = rootUrl,
        body = rootBody,
        selected = selected,
        localVideoUrl = localVideo,
        localAudioUrl = localAudio,
      ) ?: return null

    val localRoot =
      session.registerManifest(
        "hls",
        rewrittenMaster,
      ) ?: return null

    return OrionYtDlpHlsGatewayEntry(
      rootUrl = localRoot,
    )
  }

  internal fun rewriteMediaPlaylist(
    baseUrl: String,
    body: String,
    providerRoute: (String) -> String?,
  ): String? = rewriteMediaPlaylist(baseUrl, body, providerRoute, providerRoute)

  internal fun rewriteMediaPlaylist(
    baseUrl: String,
    body: String,
    providerRoute:
      (String) -> String?,
    keyRoute:
      (String) -> String?,
  ): String? {
    if (
      !OrionDownloadFragmentPlanner.isHlsPlaylistBody(body)
    ) {
      return null
    }

    val output =
      mutableListOf<String>()

    for (raw in body.lineSequence()) {
      val line =
        raw.trimEnd('\r').removePrefix("\uFEFF")

      val trimmed =
        line.trim()

      if (trimmed.isEmpty()) {
        output.add(line)
        continue
      }

      if (
        trimmed.startsWith(
          "#EXT-X-BYTERANGE",
          ignoreCase = true,
        ) ||
        trimmed.startsWith(
          "#EXT-X-PART:",
          ignoreCase = true,
        ) ||
        trimmed.startsWith(
          "#EXT-X-PRELOAD-HINT:",
          ignoreCase = true,
        ) ||
        trimmed.startsWith(
          "#EXT-X-RENDITION-REPORT:",
          ignoreCase = true,
        )
      ) {
        return null
      }

      if (
        trimmed.startsWith(
          "#EXT-X-KEY:",
          ignoreCase = true,
        )
      ) {
        val method =
          METHOD_ATTRIBUTE
            .find(
              trimmed.substringAfter(':'),
            )
            ?.groupValues
            ?.getOrNull(1)
            ?.trim()
            ?.uppercase(Locale.US)

        when (method) {
          "NONE" -> output.add(line)
          "AES-128" -> {
            val keyformat = KEYFORMAT_ATTRIBUTE.find(trimmed.substringAfter(':'))
              ?.let { it.groupValues[1].ifBlank { it.groupValues[2] }.trim() }
            if (keyformat != null && !keyformat.equals("identity", ignoreCase = true)) return null
            output.add(rewriteUriAttribute(baseUrl, line, keyRoute) ?: return null)
          }
          else -> return null
        }
        continue
      }

      if (
        trimmed.startsWith(
          "#EXT-X-MAP:",
          ignoreCase = true,
        )
      ) {
        val rewritten =
          rewriteUriAttribute(
            baseUrl,
            line,
            providerRoute,
          ) ?: return null

        output.add(rewritten)
        continue
      }

      if (trimmed.startsWith('#')) {
        output.add(line)
        continue
      }

      val providerUrl =
        resolveHttp(
          baseUrl,
          trimmed,
        ) ?: return null

      val localUrl =
        providerRoute(providerUrl)
          ?: return null

      output.add(localUrl)
    }

    if (
      output.none {
        it.trim().equals(
          "#EXT-X-ENDLIST",
          ignoreCase = true,
        )
      }
    ) {
      return null
    }

    return output
      .joinToString(
        separator = "\n",
        postfix = "\n",
      )
  }

  internal fun rewriteSelectedMaster(
    baseUrl: String,
    body: String,
    selected: OrionHlsMasterSelection,
    localVideoUrl: String,
    localAudioUrl: String?,
  ): String? {
    val lines =
      body.lineSequence()
        .map {
          it.trimEnd('\r').removePrefix("\uFEFF")
        }
        .toList()

    if (
      lines.none {
        it.trim().equals(
          "#EXTM3U",
          ignoreCase = true,
        )
      }
    ) {
      return null
    }

    var selectedStreamInfo:
      String? =
      null

    var index = 0

    while (index < lines.size) {
      val current =
        lines[index].trim()

      if (
        !current.startsWith(
          "#EXT-X-STREAM-INF:",
          ignoreCase = true,
        )
      ) {
        index += 1
        continue
      }

      var uriIndex =
        index + 1

      while (
        uriIndex < lines.size &&
        (
          lines[uriIndex].trim().isEmpty() ||
          lines[uriIndex]
            .trim()
            .startsWith('#')
        )
      ) {
        uriIndex += 1
      }

      if (uriIndex >= lines.size) {
        break
      }

      val candidate =
        resolveHttp(
          baseUrl,
          lines[uriIndex].trim(),
        )

      if (
        candidate ==
        selected.videoPlaylistUrl
      ) {
        selectedStreamInfo =
          lines[index]

        break
      }

      index =
        uriIndex + 1
    }

    val streamInfo =
      selectedStreamInfo
        ?: return null

    val output =
      mutableListOf<String>()

    lines.forEach { raw ->
      val trimmed =
        raw.trim()

      if (
        trimmed.equals(
          "#EXTM3U",
          ignoreCase = true,
        ) ||
        trimmed.startsWith(
          "#EXT-X-VERSION:",
          ignoreCase = true,
        ) ||
        trimmed.equals(
          "#EXT-X-INDEPENDENT-SEGMENTS",
          ignoreCase = true,
        ) ||
        trimmed.startsWith(
          "#EXT-X-START:",
          ignoreCase = true,
        )
      ) {
        if (raw !in output) {
          output.add(raw)
        }
      }
    }

    if (
      selected.audioPlaylistUrl != null
    ) {
      val localAudio =
        localAudioUrl
          ?: return null

      val selectedAudioLine =
        lines.firstOrNull { raw ->
          val trimmed =
            raw.trim()

          trimmed.startsWith(
            "#EXT-X-MEDIA:",
            ignoreCase = true,
          ) &&
          trimmed.contains(
            "TYPE=AUDIO",
            ignoreCase = true,
          ) &&
          uriAttributeResolvesTo(
            baseUrl,
            raw,
            selected.audioPlaylistUrl,
          )
        } ?: return null

      val rewrittenAudioLine =
        replaceUriAttribute(
          selectedAudioLine,
          localAudio,
        ) ?: return null

      output.add(
        rewrittenAudioLine,
      )
    } else {
      lines
        .filter { raw ->
          val trimmed =
            raw.trim()

          trimmed.startsWith(
            "#EXT-X-MEDIA:",
            ignoreCase = true,
          ) &&
          trimmed.contains(
            "TYPE=AUDIO",
            ignoreCase = true,
          ) &&
          URI_ATTRIBUTE
            .find(raw) == null
        }
        .forEach { raw ->
          output.add(raw)
        }
    }

    output.add(streamInfo)
    output.add(localVideoUrl)

    return output
      .joinToString(
        separator = "\n",
        postfix = "\n",
      )
  }

  private fun resolveNestedMediaPlaylist(
    bound: BoundTransferContext,
    startUrl: String,
    startBody: String,
    role: String,
  ): ResolvedMediaPlaylist? {
    var currentUrl = startUrl
    var currentBody = startBody

    repeat(MAX_NESTED_MEDIA_PLAYLISTS) { depth ->
      if (OrionDownloadFragmentPlanner.selectHlsMaster(currentUrl, currentBody, "best") != null) {
        Log.i("OrionDownloadStage", "stage=hls-gateway outcome=nested-master depth=$depth")
        return null
      }

      val plan = OrionDownloadFragmentPlanner.parseHlsMedia(
        currentUrl,
        currentBody,
        role,
        allowAes128 = true,
      )
      if (!acceptable(plan)) {
        Log.i(
          "OrionDownloadStage",
          "stage=hls-gateway outcome=plan-rejected issue=${plan.issueCode ?: "media-fragments-missing"} media=${plan.mediaFragmentCount} end=${plan.endList}",
        )
        return null
      }

      Log.i(
        "OrionDownloadStage",
        "stage=hls-gateway outcome=graph depth=$depth media=${plan.mediaFragmentCount} init=${plan.fragments.size - plan.mediaFragmentCount} keys=${plan.keyUrls.size}",
      )

      if (plan.mediaFragmentCount != 1) {
        return ResolvedMediaPlaylist(currentUrl, currentBody, plan)
      }

      val onlyMedia = plan.firstMediaFragment() ?: return null
      val possiblePlaylist = OrionDownloadAuthorizedHttp.fetchText(bound, currentUrl, onlyMedia.url)
        ?: return null
      if (!OrionDownloadFragmentPlanner.isHlsPlaylistBody(possiblePlaylist)) {
        return ResolvedMediaPlaylist(currentUrl, currentBody, plan)
      }
      if (depth == MAX_NESTED_MEDIA_PLAYLISTS - 1) {
        Log.i("OrionDownloadStage", "stage=hls-gateway outcome=nested-limit")
        return null
      }

      Log.i("OrionDownloadStage", "stage=hls-gateway outcome=descend depth=${depth + 1}")
      currentUrl = onlyMedia.url
      currentBody = possiblePlaylist
    }

    return null
  }

  private fun acceptable(
    plan: OrionHlsMediaPlan,
  ): Boolean =
    plan.issueCode == null &&
      plan.endList &&
      plan.mediaFragmentCount > 0

  private fun rewriteUriAttribute(
    baseUrl: String,
    line: String,
    providerRoute:
      (String) -> String?,
  ): String? {
    val match =
      URI_ATTRIBUTE.find(line)
        ?: return null

    val providerUrl =
      resolveHttp(
        baseUrl,
        match.groupValues[1],
      ) ?: return null

    val localUrl =
      providerRoute(providerUrl)
        ?: return null

    return line.replaceRange(
      match.range,
      """URI="$localUrl"""",
    )
  }

  private fun uriAttributeResolvesTo(
    baseUrl: String,
    line: String,
    targetUrl: String,
  ): Boolean {
    val match =
      URI_ATTRIBUTE.find(line)
        ?: return false

    return resolveHttp(
      baseUrl,
      match.groupValues[1],
    ) == targetUrl
  }

  private fun replaceUriAttribute(
    line: String,
    replacementUrl: String,
  ): String? {
    val match =
      URI_ATTRIBUTE.find(line)
        ?: return null

    return line.replaceRange(
      match.range,
      """URI="$replacementUrl"""",
    )
  }

  private fun resolveHttp(
    baseUrl: String,
    child: String,
  ): String? =
    try {
      val resolved =
        URL(
          URL(baseUrl),
          child,
        )

      if (
        resolved.protocol
          .lowercase(Locale.US) !in
        setOf(
          "http",
          "https",
        )
      ) {
        null
      } else {
        resolved.toExternalForm()
      }
    } catch (_: Throwable) {
      null
    }
}
