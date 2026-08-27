package com.okali.orion.playback

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

    val rootBody =
      OrionDownloadAuthorizedHttp.fetchText(
        bound,
        rootUrl,
        rootUrl,
      ) ?: return null

    if (
      !rootBody.contains(
        "#EXTM3U",
        ignoreCase = true,
      )
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
      val plan =
        OrionDownloadFragmentPlanner.parseHlsMedia(
          rootUrl,
          rootBody,
          "video",
        )

      if (!acceptable(plan)) {
        return null
      }

      val rewritten =
        rewriteMediaPlaylist(
          rootUrl,
          rootBody,
        ) { childUrl ->
          session.registerProvider(
            bound = bound,
            parentUrl = rootUrl,
            childUrl = childUrl,
            rangeStart = null,
            rangeEndInclusive = null,
          )
        } ?: return null

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

    val videoPlan =
      OrionDownloadFragmentPlanner.parseHlsMedia(
        selected.videoPlaylistUrl,
        videoBody,
        "video",
      )

    if (!acceptable(videoPlan)) {
      return null
    }

    val rewrittenVideo =
      rewriteMediaPlaylist(
        selected.videoPlaylistUrl,
        videoBody,
      ) { childUrl ->
        session.registerProvider(
          bound = bound,
          parentUrl =
            selected.videoPlaylistUrl,
          childUrl = childUrl,
          rangeStart = null,
          rangeEndInclusive = null,
        )
      } ?: return null

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

          val audioPlan =
            OrionDownloadFragmentPlanner.parseHlsMedia(
              audioUrl,
              audioBody,
              "audio",
            )

          if (!acceptable(audioPlan)) {
            return null
          }

          val rewrittenAudio =
            rewriteMediaPlaylist(
              audioUrl,
              audioBody,
            ) { childUrl ->
              session.registerProvider(
                bound = bound,
                parentUrl = audioUrl,
                childUrl = childUrl,
                rangeStart = null,
                rangeEndInclusive = null,
              )
            } ?: return null

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
    providerRoute:
      (String) -> String?,
  ): String? {
    if (
      !body.contains(
        "#EXTM3U",
        ignoreCase = true,
      )
    ) {
      return null
    }

    val output =
      mutableListOf<String>()

    for (raw in body.lineSequence()) {
      val line =
        raw.trimEnd('\r')

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

        if (
          method != null &&
          method != "NONE"
        ) {
          return null
        }

        output.add(line)
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
          it.trimEnd('\r')
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

  private fun acceptable(
    plan: OrionHlsMediaPlan,
  ): Boolean =
    plan.issueCode == null &&
      plan.endList &&
      plan.fragments.isNotEmpty()

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
