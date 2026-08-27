package com.okali.orion.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionDownloadYtDlpDashGatewayTest {
  @Test
  fun selectsSourceRepresentationsAndRewritesTemplateMpdToOpaqueRoutes() {
    val body =
      """
      <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT8S" minBufferTime="PT1S">
        <Period id="p0">
          <AdaptationSet id="video" contentType="video" mimeType="video/mp4" segmentAlignment="true">
            <Representation id="v-low" bandwidth="800000" width="640" height="360" codecs="avc1.4d401e">
              <SegmentTemplate initialization="low-init.mp4" media="low-${'$'}Number${'$'}.m4s" duration="4" timescale="1" startNumber="1"/>
            </Representation>
            <Representation id="v-high" bandwidth="5000000" width="1920" height="1080" codecs="avc1.640028">
              <SegmentTemplate initialization="high-init.mp4" media="high-${'$'}Number${'$'}.m4s" duration="4" timescale="1" startNumber="1"/>
            </Representation>
          </AdaptationSet>
          <AdaptationSet id="audio" contentType="audio" mimeType="audio/mp4">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
            <Representation id="a-main" bandwidth="128000" codecs="mp4a.40.2">
              <SegmentTemplate initialization="audio-init.mp4" media="audio-${'$'}Number${'$'}.m4s" duration="4" timescale="1" startNumber="1"/>
            </Representation>
          </AdaptationSet>
        </Period>
      </MPD>
      """.trimIndent()

    val selection =
      requireNotNull(
        OrionDownloadFragmentPlanner
          .selectDashRepresentations(
            body,
            "1080p",
          ),
      )

    assertEquals(
      0,
      selection.video?.adaptationIndex,
    )

    assertEquals(
      1,
      selection.video?.representationIndex,
    )

    assertEquals(
      1,
      selection.audio?.adaptationIndex,
    )

    val plan =
      OrionDownloadFragmentPlanner.parseDash(
        "https://provider.example.test/master.mpd",
        body,
        "1080p",
      )

    assertNull(plan.issueCode)
    assertTrue(plan.fragments.isNotEmpty())

    val routed =
      mutableListOf<OrionFragmentRequest>()

    val rewritten =
      OrionDownloadYtDlpDashGateway
        .rewriteSelectedMpd(
          body = body,
          selection = selection,
          fragments = plan.fragments,
        ) { fragment ->
          routed.add(fragment)

          "http://127.0.0.1:48123/opaque/" +
            routed.size +
            ".bin"
        }

    assertNotNull(rewritten)

    val text =
      requireNotNull(rewritten)

    assertTrue(text.contains("v-high"))
    assertFalse(text.contains("v-low"))
    assertTrue(text.contains("a-main"))
    assertTrue(text.contains("avc1.640028"))
    assertTrue(text.contains("mp4a.40.2"))
    assertTrue(text.contains("SegmentList"))
    assertTrue(text.contains("http://127.0.0.1:48123/opaque/"))
    assertFalse(text.contains("provider.example.test"))
    assertFalse(text.contains("high-init.mp4"))
    assertFalse(text.contains("high-${'$'}Number"))
    assertFalse(text.contains("audio-${'$'}Number"))
    assertTrue(routed.any { it.role == "video-init" })
    assertTrue(routed.count { it.role == "video" } == 2)
    assertTrue(routed.any { it.role == "audio-init" })
    assertTrue(routed.count { it.role == "audio" } == 2)
  }

  @Test
  fun segmentListRangesBecomeRouteOwnedAndProviderCoordinatesDisappear() {
    val body =
      """
      <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT4S">
        <Period>
          <AdaptationSet contentType="video" mimeType="video/mp4">
            <Representation id="v1" bandwidth="1000000" width="1280" height="720">
              <BaseURL>https://cdn.example.test/</BaseURL>
              <SegmentList duration="2" timescale="1">
                <Initialization sourceURL="video.mp4" range="0-999"/>
                <SegmentURL media="video.mp4" mediaRange="1000-1999"/>
                <SegmentURL media="video.mp4" mediaRange="2000-2999"/>
              </SegmentList>
            </Representation>
          </AdaptationSet>
        </Period>
      </MPD>
      """.trimIndent()

    val selection =
      requireNotNull(
        OrionDownloadFragmentPlanner
          .selectDashRepresentations(
            body,
            "720p",
          ),
      )

    val plan =
      OrionDownloadFragmentPlanner.parseDash(
        "https://provider.example.test/master.mpd",
        body,
        "720p",
      )

    assertNull(plan.issueCode)

    val rewritten =
      OrionDownloadYtDlpDashGateway
        .rewriteSelectedMpd(
          body = body,
          selection = selection,
          fragments = plan.fragments,
        ) { fragment ->
          "http://127.0.0.1:49000/r/" +
            fragment.role +
            "-" +
            (fragment.rangeStart ?: 0L) +
            ".bin"
        }

    assertNotNull(rewritten)

    val text =
      requireNotNull(rewritten)

    assertFalse(text.contains("cdn.example.test"))
    assertFalse(text.contains("provider.example.test"))
    assertFalse(text.contains("mediaRange"))
    assertFalse(text.contains(" range="))
    assertTrue(text.contains("SegmentURL"))
    assertTrue(
      plan.fragments.any {
        it.rangeStart == 1000L &&
        it.rangeEndInclusive == 1999L
      },
    )
  }

  @Test
  fun dynamicAndProtectedMpdFailClosed() {
    val selection =
      OrionDashSelection(
        video =
          OrionDashRepresentationCoordinate(
            0,
            0,
          ),
        audio = null,
      )

    val fragments =
      listOf(
        OrionFragmentRequest(
          "https://provider.example.test/one.m4s",
          "video",
        ),
      )

    assertNull(
      OrionDownloadYtDlpDashGateway
        .rewriteSelectedMpd(
          """
          <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="dynamic">
            <Period>
              <AdaptationSet contentType="video">
                <Representation id="v"/>
              </AdaptationSet>
            </Period>
          </MPD>
          """.trimIndent(),
          selection,
          fragments,
        ) {
          "http://127.0.0.1:1/x"
        },
    )

    assertNull(
      OrionDownloadYtDlpDashGateway
        .rewriteSelectedMpd(
          """
          <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static">
            <Period>
              <AdaptationSet contentType="video">
                <ContentProtection schemeIdUri="urn:uuid:test"/>
                <Representation id="v"/>
              </AdaptationSet>
            </Period>
          </MPD>
          """.trimIndent(),
          selection,
          fragments,
        ) {
          "http://127.0.0.1:1/x"
        },
    )
  }
}
