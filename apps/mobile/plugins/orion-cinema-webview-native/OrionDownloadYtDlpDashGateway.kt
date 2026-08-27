package com.okali.orion.playback

import java.io.ByteArrayInputStream
import java.io.StringWriter
import javax.xml.parsers.DocumentBuilderFactory
import javax.xml.transform.OutputKeys
import javax.xml.transform.TransformerFactory
import javax.xml.transform.dom.DOMSource
import javax.xml.transform.stream.StreamResult
import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.Node

internal data class OrionYtDlpDashGatewayEntry(
  val rootUrl: String,
)

/**
 * Prepares a bounded static DASH source for yt-dlp without exposing provider URLs.
 *
 * The existing fragment planner remains authoritative for representation
 * selection and concrete segment expansion. This owner preserves the selected
 * source MPD metadata while replacing network-bearing segment references with
 * opaque job-scoped loopback routes.
 */
internal object OrionDownloadYtDlpDashGateway {
  private val SAFE_METADATA_CHILDREN =
    setOf(
      "Accessibility",
      "AudioChannelConfiguration",
      "ContentComponent",
      "EssentialProperty",
      "FramePacking",
      "InbandEventStream",
      "Label",
      "Role",
      "SupplementalProperty",
    )

  private val SEGMENT_TIMING_ATTRIBUTES =
    setOf(
      "availabilityTimeComplete",
      "availabilityTimeOffset",
      "duration",
      "presentationTimeOffset",
      "startNumber",
      "timescale",
    )

  fun prepare(
    bound: BoundTransferContext,
    requestedQuality: String,
    session: OrionDownloadYtDlpGatewaySession,
  ): OrionYtDlpDashGatewayEntry? {
    if (
      bound.transferKind != "dash" ||
      !session.owns(bound.jobId)
    ) {
      return null
    }

    val rootUrl =
      bound.root.url

    val body =
      OrionDownloadAuthorizedHttp.fetchText(
        bound,
        rootUrl,
        rootUrl,
      ) ?: return null

    val selection =
      OrionDownloadFragmentPlanner
        .selectDashRepresentations(
          body,
          requestedQuality,
        )
        ?: return null

    val plan =
      OrionDownloadFragmentPlanner.parseDash(
        rootUrl,
        body,
        requestedQuality,
      )

    if (
      plan.issueCode != null ||
      plan.fragments.isEmpty()
    ) {
      return null
    }

    val rewritten =
      rewriteSelectedMpd(
        body = body,
        selection = selection,
        fragments = plan.fragments,
      ) { fragment ->
        session.registerProvider(
          bound = bound,
          parentUrl = rootUrl,
          childUrl = fragment.url,
          rangeStart = fragment.rangeStart,
          rangeEndInclusive =
            fragment.rangeEndInclusive,
        )
      } ?: return null

    val localRoot =
      session.registerManifest(
        "dash",
        rewritten,
      ) ?: return null

    return OrionYtDlpDashGatewayEntry(
      rootUrl = localRoot,
    )
  }

  internal fun rewriteSelectedMpd(
    body: String,
    selection: OrionDashSelection,
    fragments: List<OrionFragmentRequest>,
    providerRoute:
      (OrionFragmentRequest) -> String?,
  ): String? {
    val source =
      parseDocument(body)
        ?: return null

    val mpd =
      source.documentElement
        ?: return null

    if (
      localName(mpd) != "MPD" ||
      attribute(mpd, "type")
        ?.equals(
          "dynamic",
          ignoreCase = true,
        ) == true
    ) {
      return null
    }

    if (
      source
        .getElementsByTagNameNS(
          "*",
          "ContentProtection",
        )
        .length > 0
    ) {
      return null
    }

    val period =
      directChildren(
        mpd,
        "Period",
      ).firstOrNull()
        ?: return null

    val adaptations =
      directChildren(
        period,
        "AdaptationSet",
      )

    val output =
      newDocument()
        ?: return null

    val outMpd =
      output.importNode(
        mpd,
        false,
      ) as? Element
        ?: return null

    removeNetworkAttributes(
      outMpd,
    )

    output.appendChild(outMpd)

    copySafeMetadataChildren(
      output,
      mpd,
      outMpd,
    )

    val outPeriod =
      output.importNode(
        period,
        false,
      ) as? Element
        ?: return null

    removeNetworkAttributes(
      outPeriod,
    )

    outMpd.appendChild(
      outPeriod,
    )

    copySafeMetadataChildren(
      output,
      period,
      outPeriod,
    )

    val coordinates =
      listOfNotNull(
        selection.video
          ?.let {
            Triple(
              it,
              "video",
              fragments.filter { fragment ->
                fragment.role ==
                "video" ||
                fragment.role ==
                "video-init"
              },
            )
          },
        selection.audio
          ?.let {
            Triple(
              it,
              "audio",
              fragments.filter { fragment ->
                fragment.role ==
                "audio" ||
                fragment.role ==
                "audio-init"
              },
            )
          },
      )

    if (coordinates.isEmpty()) {
      return null
    }

    for (
      (coordinate, role, roleFragments)
      in coordinates
    ) {
      val adaptation =
        adaptations.getOrNull(
          coordinate.adaptationIndex,
        ) ?: return null

      val representations =
        directChildren(
          adaptation,
          "Representation",
        )

      val representation =
        representations.getOrNull(
          coordinate.representationIndex,
        ) ?: return null

      if (roleFragments.none { it.role == role }) {
        return null
      }

      val outAdaptation =
        output.importNode(
          adaptation,
          false,
        ) as? Element
          ?: return null

      removeNetworkAttributes(
        outAdaptation,
      )

      outPeriod.appendChild(
        outAdaptation,
      )

      copySafeMetadataChildren(
        output,
        adaptation,
        outAdaptation,
      )

      val outRepresentation =
        output.importNode(
          representation,
          false,
        ) as? Element
          ?: return null

      removeNetworkAttributes(
        outRepresentation,
      )

      outAdaptation.appendChild(
        outRepresentation,
      )

      copySafeMetadataChildren(
        output,
        representation,
        outRepresentation,
      )

      val addressing =
        sourceAddressing(
          adaptation,
          representation,
        ) ?: return null

      val segmentList =
        buildSegmentList(
          output = output,
          addressing = addressing,
          fragments = roleFragments,
          role = role,
          providerRoute =
            providerRoute,
        ) ?: return null

      outRepresentation.appendChild(
        segmentList,
      )
    }

    val serialized =
      serialize(output)
        ?: return null

    if (
      containsProviderCoordinate(
        serialized,
      )
    ) {
      return null
    }

    return serialized
  }

  private data class SourceAddressing(
    val adaptationTemplate: Element?,
    val representationTemplate: Element?,
    val segmentList: Element?,
  )

  private fun sourceAddressing(
    adaptation: Element,
    representation: Element,
  ): SourceAddressing? {
    val representationList =
      directChildren(
        representation,
        "SegmentList",
      ).firstOrNull()

    val adaptationList =
      directChildren(
        adaptation,
        "SegmentList",
      ).firstOrNull()

    val segmentList =
      representationList
        ?: adaptationList

    if (segmentList != null) {
      return SourceAddressing(
        adaptationTemplate = null,
        representationTemplate = null,
        segmentList = segmentList,
      )
    }

    val adaptationTemplate =
      directChildren(
        adaptation,
        "SegmentTemplate",
      ).firstOrNull()

    val representationTemplate =
      directChildren(
        representation,
        "SegmentTemplate",
      ).firstOrNull()

    if (
      adaptationTemplate == null &&
      representationTemplate == null
    ) {
      return null
    }

    return SourceAddressing(
      adaptationTemplate =
        adaptationTemplate,
      representationTemplate =
        representationTemplate,
      segmentList = null,
    )
  }

  private fun buildSegmentList(
    output: Document,
    addressing: SourceAddressing,
    fragments: List<OrionFragmentRequest>,
    role: String,
    providerRoute:
      (OrionFragmentRequest) -> String?,
  ): Element? {
    val segmentList =
      output.createElement(
        "SegmentList",
      )

    if (addressing.segmentList != null) {
      copyTimingAttributes(
        addressing.segmentList,
        segmentList,
      )

      directChildren(
        addressing.segmentList,
        "SegmentTimeline",
      ).firstOrNull()
        ?.let { timeline ->
          segmentList.appendChild(
            output.importNode(
              timeline,
              true,
            ),
          )
        }
    } else {
      val merged =
        linkedMapOf<String, String>()

      addressing.adaptationTemplate
        ?.let { template ->
          copyTimingAttributeValues(
            template,
            merged,
          )
        }

      addressing.representationTemplate
        ?.let { template ->
          copyTimingAttributeValues(
            template,
            merged,
          )
        }

      merged.forEach {
        (name, value) ->
        segmentList.setAttribute(
          name,
          value,
        )
      }

      val timeline =
        addressing.representationTemplate
          ?.let {
            directChildren(
              it,
              "SegmentTimeline",
            ).firstOrNull()
          }
          ?: addressing.adaptationTemplate
            ?.let {
              directChildren(
                it,
                "SegmentTimeline",
              ).firstOrNull()
            }

      timeline?.let {
        segmentList.appendChild(
          output.importNode(
            it,
            true,
          ),
        )
      }
    }

    val init =
      fragments.singleOrNull {
        it.role ==
        "$role-init"
      }

    if (
      fragments.count {
        it.role ==
        "$role-init"
      } > 1
    ) {
      return null
    }

    init?.let { fragment ->
      val local =
        providerRoute(fragment)
          ?: return null

      val node =
        output.createElement(
          "Initialization",
        )

      node.setAttribute(
        "sourceURL",
        local,
      )

      segmentList.appendChild(
        node,
      )
    }

    val media =
      fragments.filter {
        it.role == role
      }

    if (media.isEmpty()) {
      return null
    }

    for (fragment in media) {
      val local =
        providerRoute(fragment)
          ?: return null

      val node =
        output.createElement(
          "SegmentURL",
        )

      node.setAttribute(
        "media",
        local,
      )

      segmentList.appendChild(
        node,
      )
    }

    return segmentList
  }

  private fun copySafeMetadataChildren(
    output: Document,
    source: Element,
    target: Element,
  ) {
    val children =
      source.childNodes

    for (
      index in 0 until children.length
    ) {
      val node =
        children.item(index)

      if (
        node.nodeType !=
        Node.ELEMENT_NODE
      ) {
        continue
      }

      val element =
        node as Element

      if (
        localName(element) !in
        SAFE_METADATA_CHILDREN
      ) {
        continue
      }

      if (
        subtreeContainsNetworkAttribute(
          element,
        )
      ) {
        continue
      }

      target.appendChild(
        output.importNode(
          element,
          true,
        ),
      )
    }
  }

  private fun subtreeContainsNetworkAttribute(
    element: Element,
  ): Boolean {
    val attributes =
      element.attributes

    for (
      index in 0 until attributes.length
    ) {
      val attribute =
        attributes.item(index)

      val name =
        attribute.localName
          ?: attribute.nodeName
            .substringAfter(':')

      if (
        name.equals(
          "href",
          ignoreCase = true,
        ) ||
        name.equals(
          "sourceURL",
          ignoreCase = true,
        ) ||
        name.equals(
          "media",
          ignoreCase = true,
        )
      ) {
        return true
      }
    }

    val children =
      element.childNodes

    for (
      index in 0 until children.length
    ) {
      val child =
        children.item(index)

      if (
        child.nodeType ==
        Node.ELEMENT_NODE &&
        subtreeContainsNetworkAttribute(
          child as Element,
        )
      ) {
        return true
      }
    }

    return false
  }

  private fun removeNetworkAttributes(
    element: Element,
  ) {
    val names =
      mutableListOf<String>()

    val attributes =
      element.attributes

    for (
      index in 0 until attributes.length
    ) {
      val attribute =
        attributes.item(index)

      val local =
        attribute.localName
          ?: attribute.nodeName
            .substringAfter(':')

      if (
        local.equals(
          "href",
          ignoreCase = true,
        ) ||
        local.equals(
          "sourceURL",
          ignoreCase = true,
        ) ||
        local.equals(
          "media",
          ignoreCase = true,
        )
      ) {
        names.add(
          attribute.nodeName,
        )
      }
    }

    names.forEach {
      element.removeAttribute(it)
    }
  }

  private fun copyTimingAttributes(
    source: Element,
    target: Element,
  ) {
    val values =
      linkedMapOf<String, String>()

    copyTimingAttributeValues(
      source,
      values,
    )

    values.forEach {
      (name, value) ->
      target.setAttribute(
        name,
        value,
      )
    }
  }

  private fun copyTimingAttributeValues(
    source: Element,
    target: MutableMap<String, String>,
  ) {
    for (name in SEGMENT_TIMING_ATTRIBUTES) {
      attribute(
        source,
        name,
      )?.let {
        target[name] = it
      }
    }
  }

  private fun containsProviderCoordinate(
    xml: String,
  ): Boolean {
    val providerUrls =
      Regex(
        """https?://[^"'<>\\s]+""",
        RegexOption.IGNORE_CASE,
      )
        .findAll(xml)
        .map { it.value }
        .toList()

    return providerUrls.any {
      !it.startsWith(
        "http://127.0.0.1:",
        ignoreCase = true,
      ) &&
      !it.startsWith(
        "https://www.w3.org/",
        ignoreCase = true,
      ) &&
      !it.startsWith(
        "http://www.w3.org/",
        ignoreCase = true,
      )
    }
  }

  private fun parseDocument(
    body: String,
  ): Document? =
    try {
      secureFactory()
        .newDocumentBuilder()
        .parse(
          ByteArrayInputStream(
            body.toByteArray(
              Charsets.UTF_8,
            ),
          ),
        )
    } catch (_: Throwable) {
      null
    }

  private fun newDocument(): Document? =
    try {
      secureFactory()
        .newDocumentBuilder()
        .newDocument()
    } catch (_: Throwable) {
      null
    }

  private fun secureFactory():
    DocumentBuilderFactory =
    DocumentBuilderFactory
      .newInstance()
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

  private fun serialize(
    document: Document,
  ): String? =
    try {
      val writer =
        StringWriter()

      val transformer =
        TransformerFactory
          .newInstance()
          .newTransformer()
          .apply {
            setOutputProperty(
              OutputKeys.OMIT_XML_DECLARATION,
              "no",
            )

            setOutputProperty(
              OutputKeys.ENCODING,
              "UTF-8",
            )

            setOutputProperty(
              OutputKeys.INDENT,
              "no",
            )
          }

      transformer.transform(
        DOMSource(document),
        StreamResult(writer),
      )

      writer.toString()
    } catch (_: Throwable) {
      null
    }

  private fun directChildren(
    parent: Element,
    expected: String,
  ): List<Element> {
    val output =
      mutableListOf<Element>()

    val children =
      parent.childNodes

    for (
      index in 0 until children.length
    ) {
      val node =
        children.item(index)

      if (
        node.nodeType ==
        Node.ELEMENT_NODE
      ) {
        val element =
          node as Element

        if (
          localName(element) ==
          expected
        ) {
          output.add(element)
        }
      }
    }

    return output
  }

  private fun localName(
    element: Element,
  ): String =
    element.localName
      ?: element.tagName
        .substringAfter(':')

  private fun attribute(
    element: Element,
    name: String,
  ): String? =
    element
      .getAttribute(name)
      .trim()
      .takeIf {
        it.isNotBlank()
      }
}
