package com.okali.orion.playback

import java.io.ByteArrayInputStream
import java.net.URL
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.math.ceil
import org.w3c.dom.Element
import org.w3c.dom.Node

internal data class OrionFragmentRequest(
  val url: String,
  val role: String,
  val rangeStart: Long? = null,
  val rangeEndInclusive: Long? = null,
)

internal data class OrionHlsMasterSelection(
  val videoPlaylistUrl: String,
  val audioPlaylistUrl: String?,
)

internal data class OrionHlsMediaPlan(
  val fragments: List<OrionFragmentRequest>,
  val endList: Boolean,
  val issueCode: String? = null,
)

internal data class OrionDashPlan(
  val fragments: List<OrionFragmentRequest>,
  val issueCode: String? = null,
)

internal data class OrionDashRepresentationCoordinate(
  val adaptationIndex: Int,
  val representationIndex: Int,
)

internal data class OrionDashSelection(
  val video: OrionDashRepresentationCoordinate?,
  val audio: OrionDashRepresentationCoordinate?,
)

/** Pure native manifest planning. Raw network locations never cross React. */
internal object OrionDownloadFragmentPlanner {
  private const val MAX_PLANNED_FRAGMENTS = 20_000

  fun selectHlsMaster(
    baseUrl: String,
    body: String,
    requestedQuality: String,
  ): OrionHlsMasterSelection? {
    val lines = body.lineSequence().map(String::trim).filter(String::isNotEmpty).toList()
    val audioGroups = linkedMapOf<String, MutableList<Map<String, String>>>()
    lines.filter { it.startsWith("#EXT-X-MEDIA:", ignoreCase = true) }.forEach { line ->
      val attributes = parseAttributeList(line.substringAfter(':'))
      if (attributes["TYPE"]?.equals("AUDIO", ignoreCase = true) != true) return@forEach
      val groupId = attributes["GROUP-ID"] ?: return@forEach
      if (attributes["URI"].isNullOrBlank()) return@forEach
      audioGroups.getOrPut(groupId) { mutableListOf() }.add(attributes)
    }

    val variants = mutableListOf<HlsVariant>()
    var index = 0
    while (index < lines.size) {
      val line = lines[index]
      if (!line.startsWith("#EXT-X-STREAM-INF:", ignoreCase = true)) {
        index += 1
        continue
      }
      val attributes = parseAttributeList(line.substringAfter(':'))
      var uriIndex = index + 1
      while (uriIndex < lines.size && lines[uriIndex].startsWith('#')) uriIndex += 1
      if (uriIndex >= lines.size) break
      val resolved = resolve(baseUrl, lines[uriIndex])
      if (resolved != null) {
        val height = attributes["RESOLUTION"]?.substringAfter('x', "")?.toIntOrNull()
        val bandwidth = attributes["BANDWIDTH"]?.toLongOrNull() ?: 0L
        variants.add(HlsVariant(resolved, height, bandwidth, attributes["AUDIO"]))
      }
      index = uriIndex + 1
    }
    if (variants.isEmpty()) return null

    val selected = chooseVariant(variants, requestedQuality)
    val audio = selected.audioGroupId?.let { groupId ->
      val choices = audioGroups[groupId].orEmpty()
      val chosen = choices.firstOrNull { it["DEFAULT"]?.equals("YES", ignoreCase = true) == true }
        ?: choices.firstOrNull()
      chosen?.get("URI")?.let { resolve(baseUrl, it) }
    }
    return OrionHlsMasterSelection(selected.url, audio)
  }

  fun parseHlsMedia(baseUrl: String, body: String, role: String): OrionHlsMediaPlan {
    if (body.contains(Regex("#EXT-X-BYTERANGE", RegexOption.IGNORE_CASE)) ||
      body.lineSequence().any { line -> line.startsWith("#EXT-X-MAP:", true) && line.contains("BYTERANGE=", true) }) {
      return OrionHlsMediaPlan(emptyList(), body.contains("#EXT-X-ENDLIST", true), "hls-byterange-not-active")
    }
    val keyLines = body.lineSequence().map(String::trim).filter { it.startsWith("#EXT-X-KEY:", true) }.toList()
    if (keyLines.any { line ->
        val attrs = parseAttributeList(line.substringAfter(':'))
        val method = attrs["METHOD"]?.uppercase(Locale.US)
        method != null && method != "NONE"
      }) {
      return OrionHlsMediaPlan(emptyList(), body.contains("#EXT-X-ENDLIST", true), "hls-encryption-not-active")
    }

    val fragments = mutableListOf<OrionFragmentRequest>()
    val mapUri = body.lineSequence()
      .map(String::trim)
      .firstOrNull { it.startsWith("#EXT-X-MAP:", true) }
      ?.substringAfter(':')
      ?.let(::parseAttributeList)
      ?.get("URI")
      ?.let { resolve(baseUrl, it) }
    if (mapUri != null) fragments.add(OrionFragmentRequest(mapUri, "$role-init"))

    body.lineSequence().forEach { raw ->
      if (fragments.size >= MAX_PLANNED_FRAGMENTS) return@forEach
      val line = raw.trim()
      if (line.isEmpty() || line.startsWith('#')) return@forEach
      resolve(baseUrl, line)?.let { fragments.add(OrionFragmentRequest(it, role)) }
    }
    return OrionHlsMediaPlan(fragments, body.contains("#EXT-X-ENDLIST", true))
  }

  fun selectDashRepresentations(
    body: String,
    requestedQuality: String,
  ): OrionDashSelection? {
    return try {
      val factory = secureDocumentBuilderFactory()
      val document =
        factory.newDocumentBuilder()
          .parse(
            ByteArrayInputStream(
              body.toByteArray(
                Charsets.UTF_8,
              ),
            ),
          )

      val mpd =
        document.documentElement
          ?: return null

      if (localName(mpd) != "MPD") {
        return null
      }

      val period =
        directChildren(
          mpd,
          "Period",
        ).firstOrNull()
          ?: return null

      val adaptationSets =
        directChildren(
          period,
          "AdaptationSet",
        )

      val videoSets =
        adaptationSets
          .filter {
            adaptationKind(it) ==
            "video"
          }

      val audioSets =
        adaptationSets
          .filter {
            adaptationKind(it) ==
            "audio"
          }

      fun coordinate(
        selected: Pair<Element, Element>?,
      ): OrionDashRepresentationCoordinate? {
        val pair =
          selected
            ?: return null

        val adaptationIndex =
          adaptationSets.indexOf(
            pair.first,
          )

        val representations =
          directChildren(
            pair.first,
            "Representation",
          )

        val representationIndex =
          representations.indexOf(
            pair.second,
          )

        if (
          adaptationIndex < 0 ||
          representationIndex < 0
        ) {
          return null
        }

        return OrionDashRepresentationCoordinate(
          adaptationIndex =
            adaptationIndex,
          representationIndex =
            representationIndex,
        )
      }

      val video =
        coordinate(
          chooseRepresentation(
            videoSets,
            requestedQuality,
            video = true,
          ),
        )

      val audio =
        coordinate(
          chooseRepresentation(
            audioSets,
            requestedQuality,
            video = false,
          ),
        )

      if (
        video == null &&
        audio == null
      ) {
        null
      } else {
        OrionDashSelection(
          video = video,
          audio = audio,
        )
      }
    } catch (_: Throwable) {
      null
    }
  }

  fun parseDash(
    baseUrl: String,
    body: String,
    requestedQuality: String,
  ): OrionDashPlan {
    return try {
      val factory = secureDocumentBuilderFactory()
      val document = factory.newDocumentBuilder().parse(ByteArrayInputStream(body.toByteArray(Charsets.UTF_8)))
      val mpd = document.documentElement ?: return OrionDashPlan(emptyList(), "dash-invalid-manifest")
      if (localName(mpd) != "MPD") return OrionDashPlan(emptyList(), "dash-invalid-manifest")
      val period = directChildren(mpd, "Period").firstOrNull() ?: return OrionDashPlan(emptyList(), "dash-period-missing")
      val totalDurationSeconds = parseIsoDurationSeconds(attribute(period, "duration"))
        ?: parseIsoDurationSeconds(attribute(mpd, "mediaPresentationDuration"))
      val mpdBase = nestedBase(baseUrl, mpd)
      val periodBase = nestedBase(mpdBase, period)
      val fragments = mutableListOf<OrionFragmentRequest>()

      val adaptationSets = directChildren(period, "AdaptationSet")
      val videoSets = adaptationSets.filter { adaptationKind(it) == "video" }
      val audioSets = adaptationSets.filter { adaptationKind(it) == "audio" }
      val selectedVideo = chooseRepresentation(videoSets, requestedQuality, video = true)
      val selectedAudio = chooseRepresentation(audioSets, requestedQuality, video = false)

      if (selectedVideo == null && selectedAudio == null) {
        return OrionDashPlan(emptyList(), "dash-representation-missing")
      }
      for ((adaptation, representation, role) in listOfNotNull(
        selectedVideo?.let { Triple(it.first, it.second, "video") },
        selectedAudio?.let { Triple(it.first, it.second, "audio") },
      )) {
        val adaptationBase = nestedBase(periodBase, adaptation)
        val representationBase = nestedBase(adaptationBase, representation)
        val planned = planDashRepresentation(
          representationBase,
          adaptation,
          representation,
          totalDurationSeconds,
          role,
        )
        if (planned.issueCode != null) return OrionDashPlan(emptyList(), planned.issueCode)
        fragments.addAll(planned.fragments)
        if (fragments.size > MAX_PLANNED_FRAGMENTS) return OrionDashPlan(emptyList(), "dash-fragment-limit")
      }
      if (fragments.isEmpty()) OrionDashPlan(emptyList(), "dash-segments-missing") else OrionDashPlan(fragments)
    } catch (_: Throwable) {
      OrionDashPlan(emptyList(), "dash-invalid-manifest")
    }
  }

  private fun planDashRepresentation(
    baseUrl: String,
    adaptation: Element,
    representation: Element,
    durationSeconds: Double?,
    role: String,
  ): OrionDashPlan {
    val representationId = attribute(representation, "id") ?: ""
    val bandwidth = attribute(representation, "bandwidth")?.toLongOrNull() ?: 0L
    val segmentList = directChildren(representation, "SegmentList").firstOrNull()
      ?: directChildren(adaptation, "SegmentList").firstOrNull()
    if (segmentList != null) {
      val output = mutableListOf<OrionFragmentRequest>()
      directChildren(segmentList, "Initialization").firstOrNull()?.let { init ->
        attribute(init, "sourceURL")?.let { source ->
          resolve(baseUrl, source)?.let { url ->
            val range = parseRange(attribute(init, "range"))
            output.add(OrionFragmentRequest(url, "$role-init", range.first, range.second))
          }
        }
      }
      directChildren(segmentList, "SegmentURL").forEach { segment ->
        val media = attribute(segment, "media") ?: return@forEach
        val url = resolve(baseUrl, media) ?: return@forEach
        val range = parseRange(attribute(segment, "mediaRange"))
        output.add(OrionFragmentRequest(url, role, range.first, range.second))
      }
      return if (output.isEmpty()) OrionDashPlan(emptyList(), "dash-segments-missing") else OrionDashPlan(output)
    }

    val adaptationTemplate = directChildren(adaptation, "SegmentTemplate").firstOrNull()
    val representationTemplate = directChildren(representation, "SegmentTemplate").firstOrNull()
    val template = representationTemplate ?: adaptationTemplate ?: return OrionDashPlan(emptyList(), "dash-segmentbase-not-active")
    val attributes = linkedMapOf<String, String>()
    adaptationTemplate?.attributes?.let { attrs -> for (index in 0 until attrs.length) attributes[attrs.item(index).nodeName] = attrs.item(index).nodeValue }
    representationTemplate?.attributes?.let { attrs -> for (index in 0 until attrs.length) attributes[attrs.item(index).nodeName] = attrs.item(index).nodeValue }
    val mediaTemplate = attributes["media"] ?: return OrionDashPlan(emptyList(), "dash-template-media-missing")
    val initTemplate = attributes["initialization"]
    val startNumber = attributes["startNumber"]?.toLongOrNull() ?: 1L
    val timescale = attributes["timescale"]?.toLongOrNull()?.takeIf { it > 0L } ?: 1L
    val output = mutableListOf<OrionFragmentRequest>()
    initTemplate?.let { templateText ->
      val path = expandTemplate(templateText, representationId, bandwidth, startNumber, 0L)
      resolve(baseUrl, path)?.let { output.add(OrionFragmentRequest(it, "$role-init")) }
    }

    val timeline = directChildren(template, "SegmentTimeline").firstOrNull()
      ?: adaptationTemplate?.let { directChildren(it, "SegmentTimeline").firstOrNull() }
    if (timeline != null) {
      val segments = directChildren(timeline, "S")
      var currentTime = 0L
      var number = startNumber
      for (index in segments.indices) {
        val segment = segments[index]
        val duration = attribute(segment, "d")?.toLongOrNull()?.takeIf { it > 0L }
          ?: return OrionDashPlan(emptyList(), "dash-timeline-invalid")
        attribute(segment, "t")?.toLongOrNull()?.let { currentTime = it }
        val repeat = attribute(segment, "r")?.toIntOrNull() ?: 0
        val count = when {
          repeat >= 0 -> repeat + 1
          repeat == -1 -> {
            val nextTime = segments.getOrNull(index + 1)?.let { attribute(it, "t")?.toLongOrNull() }
            val end = nextTime ?: durationSeconds?.let { (it * timescale).toLong() }
              ?: return OrionDashPlan(emptyList(), "dash-open-timeline-not-supported")
            ceil((end - currentTime).coerceAtLeast(0L).toDouble() / duration.toDouble()).toInt().coerceAtLeast(1)
          }
          else -> return OrionDashPlan(emptyList(), "dash-timeline-invalid")
        }
        repeat(count) {
          if (output.size >= MAX_PLANNED_FRAGMENTS) return OrionDashPlan(emptyList(), "dash-fragment-limit")
          val path = expandTemplate(mediaTemplate, representationId, bandwidth, number, currentTime)
          resolve(baseUrl, path)?.let { output.add(OrionFragmentRequest(it, role)) }
          currentTime += duration
          number += 1
        }
      }
      return OrionDashPlan(output)
    }

    val duration = attributes["duration"]?.toLongOrNull()?.takeIf { it > 0L }
      ?: return OrionDashPlan(emptyList(), "dash-template-duration-missing")
    val endNumber = attributes["endNumber"]?.toLongOrNull()
    val count = when {
      endNumber != null && endNumber >= startNumber -> (endNumber - startNumber + 1L).toInt()
      durationSeconds != null -> ceil(durationSeconds * timescale.toDouble() / duration.toDouble()).toInt()
      else -> return OrionDashPlan(emptyList(), "dash-duration-unknown")
    }.coerceIn(1, MAX_PLANNED_FRAGMENTS)
    for (offset in 0 until count) {
      val number = startNumber + offset
      val path = expandTemplate(mediaTemplate, representationId, bandwidth, number, offset.toLong() * duration)
      resolve(baseUrl, path)?.let { output.add(OrionFragmentRequest(it, role)) }
    }
    return OrionDashPlan(output)
  }

  private fun chooseRepresentation(
    sets: List<Element>,
    requestedQuality: String,
    video: Boolean,
  ): Pair<Element, Element>? {
    val candidates = mutableListOf<Pair<Element, Element>>()
    sets.forEach { adaptation -> directChildren(adaptation, "Representation").forEach { candidates.add(adaptation to it) } }
    if (candidates.isEmpty()) return null
    if (!video) return candidates.maxByOrNull { attribute(it.second, "bandwidth")?.toLongOrNull() ?: 0L }
    val maxHeight = qualityHeight(requestedQuality)
    val measured = candidates.map { candidate -> Triple(candidate, attribute(candidate.second, "height")?.toIntOrNull(), attribute(candidate.second, "bandwidth")?.toLongOrNull() ?: 0L) }
    if (maxHeight == null) return measured.maxWithOrNull(compareBy<Triple<Pair<Element, Element>, Int?, Long>> { it.second ?: -1 }.thenBy { it.third })?.first
    val within = measured.filter { it.second != null && it.second!! <= maxHeight }
    return (within.maxWithOrNull(compareBy<Triple<Pair<Element, Element>, Int?, Long>> { it.second ?: -1 }.thenBy { it.third })
      ?: measured.filter { it.second != null }.minByOrNull { it.second!! }
      ?: measured.maxByOrNull { it.third })?.first
  }

  private fun adaptationKind(adaptation: Element): String? {
    val content = attribute(adaptation, "contentType")?.lowercase(Locale.US)
    if (content == "video" || content == "audio") return content
    val mime = attribute(adaptation, "mimeType")?.lowercase(Locale.US)
      ?: directChildren(adaptation, "Representation").firstOrNull()?.let { attribute(it, "mimeType")?.lowercase(Locale.US) }
    return when {
      mime?.startsWith("video/") == true -> "video"
      mime?.startsWith("audio/") == true -> "audio"
      else -> null
    }
  }

  private fun nestedBase(parent: String, element: Element): String {
    val child = directChildren(element, "BaseURL").firstOrNull()?.textContent?.trim().orEmpty()
    return if (child.isBlank()) parent else resolve(parent, child) ?: parent
  }

  private fun secureDocumentBuilderFactory(): DocumentBuilderFactory =
    DocumentBuilderFactory.newInstance()
      .apply {
        isNamespaceAware = true
        isExpandEntityReferences = false

        try {
          isXIncludeAware = false
        } catch (_: Throwable) {
        }

        for (
          feature in
          listOf(
            "http://apache.org/xml/features/disallow-doctype-decl",
            "http://xml.org/sax/features/external-general-entities",
            "http://xml.org/sax/features/external-parameter-entities",
            "http://apache.org/xml/features/nonvalidating/load-external-dtd",
          )
        ) {
          try {
            setFeature(
              feature,
              feature ==
              "http://apache.org/xml/features/disallow-doctype-decl",
            )
          } catch (_: Throwable) {
          }
        }
      }

  private fun directChildren(parent: Element, expected: String): List<Element> {
    val output = mutableListOf<Element>()
    val children = parent.childNodes
    for (index in 0 until children.length) {
      val node = children.item(index)
      if (node.nodeType == Node.ELEMENT_NODE) {
        val element = node as Element
        if (localName(element) == expected) output.add(element)
      }
    }
    return output
  }

  private fun localName(element: Element): String = element.localName ?: element.tagName.substringAfter(':')
  private fun attribute(element: Element, name: String): String? = element.getAttribute(name).trim().takeIf { it.isNotBlank() }

  private fun parseRange(raw: String?): Pair<Long?, Long?> {
    if (raw.isNullOrBlank()) return null to null
    val parts = raw.split('-', limit = 2)
    val start = parts.getOrNull(0)?.toLongOrNull() ?: return null to null
    val end = parts.getOrNull(1)?.toLongOrNull() ?: return null to null
    return if (start >= 0L && end >= start) start to end else null to null
  }

  private fun expandTemplate(template: String, representationId: String, bandwidth: Long, number: Long, time: Long): String {
    var result = template.replace("$$", "\u0000")
    result = result.replace("\$RepresentationID\$", representationId)
    result = result.replace("\$Bandwidth\$", bandwidth.toString())
    result = replaceNumericTemplate(result, "Number", number)
    result = replaceNumericTemplate(result, "Time", time)
    return result.replace("\u0000", "$")
  }

  private fun replaceNumericTemplate(input: String, name: String, value: Long): String {
    val pattern = Regex("\\$$name(?:%0(\\d+)d)?\\$")
    return pattern.replace(input) { match ->
      val width = match.groupValues.getOrNull(1)?.toIntOrNull()
      if (width == null) value.toString() else value.toString().padStart(width, '0')
    }
  }

  private fun parseIsoDurationSeconds(raw: String?): Double? {
    if (raw.isNullOrBlank()) return null
    val match = Regex("^P(?:(\\d+(?:\\.\\d+)?)D)?(?:T(?:(\\d+(?:\\.\\d+)?)H)?(?:(\\d+(?:\\.\\d+)?)M)?(?:(\\d+(?:\\.\\d+)?)S)?)?$", RegexOption.IGNORE_CASE).matchEntire(raw.trim()) ?: return null
    val days = match.groupValues[1].toDoubleOrNull() ?: 0.0
    val hours = match.groupValues[2].toDoubleOrNull() ?: 0.0
    val minutes = match.groupValues[3].toDoubleOrNull() ?: 0.0
    val seconds = match.groupValues[4].toDoubleOrNull() ?: 0.0
    return days * 86_400.0 + hours * 3_600.0 + minutes * 60.0 + seconds
  }

  private fun parseAttributeList(raw: String): Map<String, String> {
    val output = linkedMapOf<String, String>()
    Regex("([A-Z0-9-]+)=(?:\\\"([^\\\"]*)\\\"|([^,]*))(?:,|$)", RegexOption.IGNORE_CASE).findAll(raw).forEach { match ->
      val value = match.groupValues[2].ifBlank { match.groupValues[3] }.trim()
      output[match.groupValues[1].uppercase(Locale.US)] = value
    }
    return output
  }

  private fun chooseVariant(variants: List<HlsVariant>, requestedQuality: String): HlsVariant {
    val maxHeight = qualityHeight(requestedQuality)
    if (maxHeight == null) return variants.maxWithOrNull(compareBy<HlsVariant> { it.height ?: -1 }.thenBy { it.bandwidth }) ?: variants.first()
    val within = variants.filter { it.height != null && it.height!! <= maxHeight }
    return within.maxWithOrNull(compareBy<HlsVariant> { it.height ?: -1 }.thenBy { it.bandwidth })
      ?: variants.filter { it.height != null }.minByOrNull { it.height!! }
      ?: variants.maxByOrNull { it.bandwidth }
      ?: variants.first()
  }

  private fun qualityHeight(value: String): Int? = when (value.lowercase(Locale.US)) {
    "1080p" -> 1080
    "720p" -> 720
    "480p" -> 480
    else -> null
  }

  private fun resolve(baseUrl: String, child: String): String? = try {
    val url = URL(URL(baseUrl), child.trim())
    if (url.protocol != "http" && url.protocol != "https") null else url.toExternalForm()
  } catch (_: Throwable) {
    null
  }

  private data class HlsVariant(
    val url: String,
    val height: Int?,
    val bandwidth: Long,
    val audioGroupId: String?,
  )
}
