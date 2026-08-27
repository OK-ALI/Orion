package com.okali.orion.playback

import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionDownloadYtDlpGatewayTest {
  @Test
  fun servesOpaqueLoopbackManifestForGetAndHead() {
    val jobId =
      "job-secret-123"

    val session =
      requireNotNull(
        OrionDownloadYtDlpGatewaySession.start(
          jobId,
        ),
      )

    try {
      assertTrue(
        session.owns(jobId),
      )

      assertFalse(
        session.owns(
          "another-job",
        ),
      )

      assertTrue(
        session.localPort() > 0,
      )

      val manifest =
        "#EXTM3U\n#EXT-X-ENDLIST\n"

      val url =
        requireNotNull(
          session.registerManifest(
            "hls",
            manifest,
          ),
        )

      val parsed =
        URL(url)

      assertEquals(
        "http",
        parsed.protocol,
      )

      assertEquals(
        "127.0.0.1",
        parsed.host,
      )

      assertEquals(
        session.localPort(),
        parsed.port,
      )

      assertFalse(
        url.contains(
          jobId,
        ),
      )

      val get =
        parsed.openConnection()
          as HttpURLConnection

      get.connectTimeout = 2_000
      get.readTimeout = 2_000
      get.useCaches = false
      get.instanceFollowRedirects = false
      get.requestMethod = "GET"

      assertEquals(
        HttpURLConnection.HTTP_OK,
        get.responseCode,
      )

      assertTrue(
        get.contentType
          .startsWith(
            "application/vnd.apple.mpegurl",
          ),
      )

      assertEquals(
        manifest,
        get.inputStream
          .bufferedReader()
          .use { it.readText() },
      )

      get.disconnect()

      val head =
        parsed.openConnection()
          as HttpURLConnection

      head.connectTimeout = 2_000
      head.readTimeout = 2_000
      head.useCaches = false
      head.instanceFollowRedirects = false
      head.requestMethod = "HEAD"

      assertEquals(
        HttpURLConnection.HTTP_OK,
        head.responseCode,
      )

      assertEquals(
        manifest
          .toByteArray(
            Charsets.UTF_8,
          )
          .size
          .toLong(),
        head.contentLengthLong,
      )

      head.disconnect()

      val unknown =
        URL(
          url.replace(
            ".m3u8",
            ".mpd",
          ),
        ).openConnection()
          as HttpURLConnection

      unknown.connectTimeout = 2_000
      unknown.readTimeout = 2_000
      unknown.instanceFollowRedirects = false
      unknown.requestMethod = "GET"

      assertEquals(
        HttpURLConnection.HTTP_NOT_FOUND,
        unknown.responseCode,
      )

      unknown.disconnect()
    } finally {
      session.close()
    }

    assertTrue(
      session.isClosed(),
    )

    assertNull(
      session.registerManifest(
        "hls",
        "#EXTM3U\n",
      ),
    )
  }

  @Test
  fun opaqueProviderRouteStreamsThroughAuthorizedHttpOwner() {
    val provider =
      ServerSocket()

    provider.bind(
      InetSocketAddress(
        InetAddress.getByAddress(
          byteArrayOf(
            127,
            0,
            0,
            1,
          ),
        ),
        0,
      ),
    )

    val payload =
      "orion-provider-route-proof"
        .toByteArray(
          Charsets.UTF_8,
        )

    val providerThread =
      Thread {
        try {
          provider.accept().use { socket ->
            val input =
              socket.getInputStream()
                .bufferedReader()

            while (true) {
              val line =
                input.readLine()
                  ?: break

              if (line.isEmpty()) {
                break
              }
            }

            val output =
              socket.getOutputStream()

            val head =
              buildString {
                append(
                  "HTTP/1.1 200 OK\r\n",
                )

                append(
                  "Content-Type: video/mp4\r\n",
                )

                append(
                  "Content-Length: ",
                )

                append(
                  payload.size,
                )

                append(
                  "\r\n",
                )

                append(
                  "Accept-Ranges: bytes\r\n",
                )

                append(
                  "Connection: close\r\n",
                )

                append(
                  "\r\n",
                )
              }.toByteArray(
                Charsets.US_ASCII,
              )

            output.write(head)
            output.write(payload)
            output.flush()
          }
        } catch (_: Throwable) {
        }
      }.apply {
        isDaemon = true
        start()
      }

    val providerUrl =
      "http://127.0.0.1:${provider.localPort}/provider-media"

    val bound =
      BoundTransferContext(
        jobId = "job-provider-route",
        candidateId = "candidate-provider-route",
        requestContextId = "context-provider-route",
        sourceId = "test",
        transferKind = "hls",
        resumable = true,
        requiredBytes = null,
        expiresAt = null,
        root =
          AuthorizedRequest(
            url = providerUrl,
            headers =
              mapOf(
                "User-Agent" to
                "OrionGatewayTest",
              ),
            cookieHeader = null,
          ),
      )

    val session =
      requireNotNull(
        OrionDownloadYtDlpGatewaySession.start(
          bound.jobId,
        ),
      )

    try {
      assertNull(
        session.registerProvider(
          bound = bound.copy(
            jobId =
              "different-job",
          ),
          parentUrl = providerUrl,
          childUrl = providerUrl,
          rangeStart = null,
          rangeEndInclusive = null,
        ),
      )

      val gatewayUrl =
        requireNotNull(
          session.registerProvider(
            bound = bound,
            parentUrl = providerUrl,
            childUrl = providerUrl,
            rangeStart = null,
            rangeEndInclusive = null,
          ),
        )

      assertFalse(
        gatewayUrl.contains(
          providerUrl,
        ),
      )

      assertFalse(
        gatewayUrl.contains(
          "provider-media",
        ),
      )

      val connection =
        URL(gatewayUrl)
          .openConnection()
          as HttpURLConnection

      connection.connectTimeout =
        2_000

      connection.readTimeout =
        2_000

      connection.useCaches =
        false

      connection.instanceFollowRedirects =
        false

      connection.requestMethod =
        "GET"

      assertEquals(
        HttpURLConnection.HTTP_OK,
        connection.responseCode,
      )

      assertTrue(
        connection.contentType
          .startsWith(
            "video/mp4",
          ),
      )

      assertEquals(
        "bytes",
        connection.getHeaderField(
          "Accept-Ranges",
        ),
      )

      assertEquals(
        payload.toList(),
        connection.inputStream
          .use { it.readBytes() }
          .toList(),
      )

      connection.disconnect()
    } finally {
      session.close()

      try {
        provider.close()
      } catch (_: Throwable) {
      }

      providerThread.join(
        2_000,
      )
    }

    assertFalse(
      providerThread.isAlive,
    )
  }
  @Test
  fun rejectsInvalidOwnershipAndManifestKinds() {
    assertNull(
      OrionDownloadYtDlpGatewaySession.start(
        "invalid job id",
      ),
    )

    val session =
      requireNotNull(
        OrionDownloadYtDlpGatewaySession.start(
          "job-2",
        ),
      )

    try {
      assertNull(
        session.registerManifest(
          "video",
          "not-a-manifest",
        ),
      )

      assertNull(
        session.registerManifest(
          "hls",
          "",
        ),
      )

      assertTrue(
        session.owns(
          "job-2",
        ),
      )
    } finally {
      session.close()
    }
  }
}
