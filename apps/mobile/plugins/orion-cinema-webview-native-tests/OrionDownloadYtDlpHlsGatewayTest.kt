package com.okali.orion.playback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionDownloadYtDlpHlsGatewayTest {
  @Test
  fun mediaPlaylistPreservesStructureAndHidesProviderUris() {
    val providerBase =
      "https://media.example.test/path/main.m3u8"

    val body =
      """
      #EXTM3U
      #EXT-X-VERSION:7
      #EXT-X-TARGETDURATION:6
      #EXT-X-MAP:URI="init.mp4"
      #EXTINF:6.0,
      segment-1.m4s
      #EXTINF:6.0,
      https://cdn.example.test/segment-2.m4s
      #EXT-X-ENDLIST
      """.trimIndent()

    val routed =
      mutableListOf<String>()

    val rewritten =
      OrionDownloadYtDlpHlsGateway
        .rewriteMediaPlaylist(
          providerBase,
          body,
        ) { providerUrl ->
          routed.add(providerUrl)

          "http://127.0.0.1:45678/" +
            "opaque-${routed.size}.bin"
        }

    assertNotNull(rewritten)

    val text =
      requireNotNull(rewritten)

    assertTrue(
      text.contains(
        "#EXT-X-MAP:URI=\"http://127.0.0.1:45678/opaque-1.bin\"",
      ),
    )

    assertTrue(
      text.contains(
        "http://127.0.0.1:45678/opaque-2.bin",
      ),
    )

    assertTrue(
      text.contains(
        "http://127.0.0.1:45678/opaque-3.bin",
      ),
    )

    assertTrue(
      text.contains(
        "#EXT-X-TARGETDURATION:6",
      ),
    )

    assertTrue(
      text.contains(
        "#EXT-X-ENDLIST",
      ),
    )

    assertFalse(
      text.contains(
        "media.example.test",
      ),
    )

    assertFalse(
      text.contains(
        "cdn.example.test",
      ),
    )

    assertTrue(
      routed.contains(
        "https://media.example.test/path/init.mp4",
      ),
    )

    assertTrue(
      routed.contains(
        "https://media.example.test/path/segment-1.m4s",
      ),
    )

    assertTrue(
      routed.contains(
        "https://cdn.example.test/segment-2.m4s",
      ),
    )
  }

  @Test
  fun selectedMasterKeepsOnlyChosenVideoAndAudioCoordinates() {
    val base =
      "https://provider.example.test/master.m3u8"

    val body =
      """
      #EXTM3U
      #EXT-X-VERSION:6
      #EXT-X-INDEPENDENT-SEGMENTS
      #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="eng",NAME="English",DEFAULT=YES,URI="audio-en.m3u8"
      #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="alt",NAME="Alt",URI="audio-alt.m3u8"
      #EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,AUDIO="eng"
      low.m3u8
      #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,AUDIO="eng"
      high.m3u8
      """.trimIndent()

    val selected =
      OrionHlsMasterSelection(
        videoPlaylistUrl =
          "https://provider.example.test/high.m3u8",
        audioPlaylistUrl =
          "https://provider.example.test/audio-en.m3u8",
      )

    val rewritten =
      OrionDownloadYtDlpHlsGateway
        .rewriteSelectedMaster(
          baseUrl = base,
          body = body,
          selected = selected,
          localVideoUrl =
            "http://127.0.0.1:40001/video.m3u8",
          localAudioUrl =
            "http://127.0.0.1:40001/audio.m3u8",
        )

    assertNotNull(rewritten)

    val text =
      requireNotNull(rewritten)

    assertTrue(
      text.contains(
        "#EXT-X-VERSION:6",
      ),
    )

    assertTrue(
      text.contains(
        "BANDWIDTH=5000000",
      ),
    )

    assertTrue(
      text.contains(
        "http://127.0.0.1:40001/video.m3u8",
      ),
    )

    assertTrue(
      text.contains(
        "URI=\"http://127.0.0.1:40001/audio.m3u8\"",
      ),
    )

    assertFalse(
      text.contains(
        "low.m3u8",
      ),
    )

    assertFalse(
      text.contains(
        "audio-alt.m3u8",
      ),
    )

    assertFalse(
      text.contains(
        "provider.example.test",
      ),
    )
  }

  @Test
  fun unsupportedMediaShapesFailClosed() {
    assertNull(
      OrionDownloadYtDlpHlsGateway
        .rewriteMediaPlaylist(
          "https://provider.example.test/media.m3u8",
          """
          #EXTM3U
          #EXT-X-KEY:METHOD=AES-128,URI="key.bin"
          #EXTINF:4,
          one.ts
          #EXT-X-ENDLIST
          """.trimIndent(),
        ) {
          "http://127.0.0.1:1/x"
        },
    )

    assertNull(
      OrionDownloadYtDlpHlsGateway
        .rewriteMediaPlaylist(
          "https://provider.example.test/media.m3u8",
          """
          #EXTM3U
          #EXT-X-BYTERANGE:100@0
          segment.ts
          #EXT-X-ENDLIST
          """.trimIndent(),
        ) {
          "http://127.0.0.1:1/x"
        },
    )
  }
}
