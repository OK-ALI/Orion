package com.okali.orion.playback

internal object OrionDownloadAuthorizedHttp {
  private const val CONNECT_TIMEOUT_MS = 15_000
  private const val READ_TIMEOUT_MS = 20_000
  private const val MAX_MANIFEST_BYTES = 2 * 1024 * 1024

  fun fetchText(
    bound: BoundTransferContext,
    parentUrl: String,
    childUrl: String,
  ): String? {
    var request =
      if (childUrl == bound.root.url) {
        bound.root
      } else {
        authorizedChild(bound, parentUrl, childUrl) ?: return null
      }

    repeat(4) {
      val connection = openRequest(request, null, null)

      try {
        val status = connection.responseCode

        if (status in 300..399) {
          val location =
            connection.getHeaderField("Location")
              ?: return null

          val redirectUrl =
            try {
              java.net.URL(
                java.net.URL(request.url),
                location,
              ).toExternalForm()
            } catch (_: Throwable) {
              return null
            }

          request =
            authorizedChild(
              bound,
              request.url,
              redirectUrl,
            ) ?: return null

          return@repeat
        }

        if (status !in 200..299) {
          return null
        }

        val stream =
          try {
            connection.inputStream
          } catch (_: Throwable) {
            connection.errorStream
          } ?: return null

        return stream.use { input ->
          val output =
            java.io.ByteArrayOutputStream()

          val buffer =
            ByteArray(8192)

          var remaining =
            MAX_MANIFEST_BYTES

          while (remaining > 0) {
            val read =
              input.read(
                buffer,
                0,
                kotlin.math.min(
                  buffer.size,
                  remaining,
                ),
              )

            if (read <= 0) {
              break
            }

            output.write(
              buffer,
              0,
              read,
            )

            remaining -= read
          }

          output.toString(
            Charsets.UTF_8.name(),
          )
        }
      } finally {
        try {
          connection.disconnect()
        } catch (_: Throwable) {
        }
      }
    }

    return null
  }

  fun authorizedChild(
    bound: BoundTransferContext,
    parentUrl: String,
    childUrl: String,
  ): AuthorizedRequest? {
    OrionDownloadRequestContextBroker.resolveForJob(
      bound.jobId,
      bound.requestContextId,
      bound.candidateId,
      childUrl,
    )?.let {
      return it
    }

    if (
      !OrionDownloadRequestContextBroker.authorizeDiscoveredDescendant(
        bound.jobId,
        bound.requestContextId,
        bound.candidateId,
        parentUrl,
        childUrl,
      )
    ) {
      return null
    }

    return OrionDownloadRequestContextBroker.resolveForJob(
      bound.jobId,
      bound.requestContextId,
      bound.candidateId,
      childUrl,
    )
  }

  fun openFollowingRedirects(
    bound: BoundTransferContext,
    parentUrl: String,
    childUrl: String,
    rangeStart: Long?,
    rangeEndInclusive: Long?,
  ): java.net.HttpURLConnection? {
    var request =
      if (childUrl == bound.root.url) {
        bound.root
      } else {
        authorizedChild(
          bound,
          parentUrl,
          childUrl,
        ) ?: return null
      }

    repeat(4) {
      val connection =
        try {
          openRequest(
            request,
            rangeStart,
            rangeEndInclusive,
          )
        } catch (_: Throwable) {
          return null
        }

      val status =
        try {
          connection.responseCode
        } catch (_: Throwable) {
          try {
            connection.disconnect()
          } catch (_: Throwable) {
          }

          return null
        }

      if (status !in 300..399) {
        return connection
      }

      val location =
        connection.getHeaderField(
          "Location",
        )

      if (location.isNullOrBlank()) {
        try {
          connection.disconnect()
        } catch (_: Throwable) {
        }

        return null
      }

      val redirectUrl =
        try {
          java.net.URL(
            java.net.URL(request.url),
            location,
          ).toExternalForm()
        } catch (_: Throwable) {
          try {
            connection.disconnect()
          } catch (_: Throwable) {
          }

          return null
        }

      try {
        connection.disconnect()
      } catch (_: Throwable) {
      }

      request =
        authorizedChild(
          bound,
          request.url,
          redirectUrl,
        ) ?: return null
    }

    return null
  }
  fun openRequest(
    request: AuthorizedRequest,
    rangeStart: Long?,
    rangeEndInclusive: Long?,
  ): java.net.HttpURLConnection {
    val connection =
      java.net.URL(request.url)
        .openConnection() as java.net.HttpURLConnection

    connection.instanceFollowRedirects = false
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.useCaches = false
    connection.requestMethod = "GET"

    request.headers.forEach { (name, value) ->
      if (replayHeader(name)) {
        connection.setRequestProperty(
          name,
          value,
        )
      }
    }

    if (!request.cookieHeader.isNullOrBlank()) {
      connection.setRequestProperty(
        "Cookie",
        request.cookieHeader,
      )
    }

    if (rangeStart != null) {
      val range =
        if (rangeEndInclusive != null) {
          "bytes=$rangeStart-$rangeEndInclusive"
        } else {
          "bytes=$rangeStart-"
        }

      connection.setRequestProperty(
        "Range",
        range,
      )
    }

    return connection
  }

  private fun replayHeader(name: String): Boolean =
    when (
      name.lowercase(
        java.util.Locale.US,
      )
    ) {
      "host",
      "content-length",
      "connection",
      "range",
      "cookie",
      "accept-encoding" -> false
      else -> true
    }
}
