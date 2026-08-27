package com.okali.orion.playback

import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Cold job-scoped loopback transport substrate for yt-dlp.
 *
 * Candidate 5 exposes local manifest bytes plus opaque provider-backed routes.
 * Provider coordinates never appear in loopback paths and outbound requests
 * are opened only through OrionDownloadAuthorizedHttp.
 * There is still no yt-dlp production caller in this candidate.
 */
internal class OrionDownloadYtDlpGatewaySession private constructor(
  private val ownerJobId: String,
  private val server: ServerSocket,
  private val capability: String,
) : Closeable {
  private sealed interface Route

  private data class StaticRoute(
    val contentType: String,
    val body: ByteArray,
  ) : Route

  private data class ProviderRoute(
    val bound: BoundTransferContext,
    val parentUrl: String,
    val childUrl: String,
    val rangeStart: Long?,
    val rangeEndInclusive: Long?,
  ) : Route

  private data class Request(
    val method: String,
    val target: String,
  )

  private val closed = AtomicBoolean(false)

  private val routes =
    ConcurrentHashMap<String, Route>()

  private val activeSockets =
    ConcurrentHashMap.newKeySet<Socket>()

  private val activeProviderConnections =
    ConcurrentHashMap.newKeySet<HttpURLConnection>()

  private val clients =
    Executors.newFixedThreadPool(MAX_CLIENTS) { runnable ->
      Thread(
        runnable,
        "orion-ytdlp-gateway-client",
      ).apply {
        isDaemon = true
      }
    }

  private val acceptThread =
    Thread(
      { acceptLoop() },
      "orion-ytdlp-gateway-accept",
    ).apply {
      isDaemon = true
      start()
    }

  fun owns(jobId: String): Boolean =
    cleanJobId(jobId) == ownerJobId

  fun localPort(): Int =
    server.localPort

  fun isClosed(): Boolean =
    closed.get()

  /**
   * Registers only already-prepared local manifest bytes.
   *
   * No provider location enters this API.
   */
  fun registerManifest(
    kind: String,
    body: String,
  ): String? {
    if (closed.get()) {
      return null
    }

    val routeType =
      when (kind.lowercase(Locale.US)) {
        "hls" ->
          "m3u8" to "application/vnd.apple.mpegurl"

        "dash" ->
          "mpd" to "application/dash+xml"

        else ->
          return null
      }

    val bytes =
      body.toByteArray(
        StandardCharsets.UTF_8,
      )

    if (
      bytes.isEmpty() ||
      bytes.size > MAX_MANIFEST_BYTES
    ) {
      return null
    }

    val route =
      StaticRoute(
        contentType = routeType.second,
        body = bytes.copyOf(),
      )

    return registerRoute(
      routeType.first,
      route,
    )
  }

  /**
   * Registers a provider-backed route without exposing provider coordinates
   * through the loopback URL.
   *
   * Provider authorization is deliberately deferred to
   * OrionDownloadAuthorizedHttp when the opaque route is requested.
   */
  fun registerProvider(
    bound: BoundTransferContext,
    parentUrl: String,
    childUrl: String,
    rangeStart: Long?,
    rangeEndInclusive: Long?,
  ): String? {
    if (
      closed.get() ||
      !owns(bound.jobId)
    ) {
      return null
    }

    if (
      parentUrl.isBlank() ||
      childUrl.isBlank()
    ) {
      return null
    }

    if (
      rangeStart != null &&
      rangeStart < 0L
    ) {
      return null
    }

    if (
      rangeEndInclusive != null &&
      (
        rangeStart == null ||
        rangeEndInclusive < rangeStart
      )
    ) {
      return null
    }

    return registerRoute(
      "bin",
      ProviderRoute(
        bound = bound,
        parentUrl = parentUrl,
        childUrl = childUrl,
        rangeStart = rangeStart,
        rangeEndInclusive = rangeEndInclusive,
      ),
    )
  }

  private fun registerRoute(
    suffix: String,
    route: Route,
  ): String? {
    if (
      closed.get() ||
      !suffix.matches(
        Regex("^[a-z0-9]{1,8}$"),
      )
    ) {
      return null
    }

    repeat(ROUTE_REGISTRATION_ATTEMPTS) {
      val routeToken =
        randomToken(
          ROUTE_TOKEN_BYTES,
        )

      val path =
        "/$capability/$routeToken.$suffix"

      if (
        routes.putIfAbsent(
          path,
          route,
        ) == null
      ) {
        return buildUrl(path)
      }
    }

    return null
  }

  override fun close() {
    if (
      !closed.compareAndSet(
        false,
        true,
      )
    ) {
      return
    }

    routes.clear()

    try {
      server.close()
    } catch (_: Throwable) {
    }

    activeSockets
      .toList()
      .forEach { socket ->
        try {
          socket.close()
        } catch (_: Throwable) {
        }
      }

    activeSockets.clear()

    activeProviderConnections
      .toList()
      .forEach { connection ->
        try {
          connection.disconnect()
        } catch (_: Throwable) {
        }
      }

    activeProviderConnections.clear()

    clients.shutdownNow()

    if (
      Thread.currentThread() !==
      acceptThread
    ) {
      try {
        acceptThread.join(
          THREAD_JOIN_TIMEOUT_MS,
        )
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
      }
    }

    try {
      clients.awaitTermination(
        THREAD_JOIN_TIMEOUT_MS,
        TimeUnit.MILLISECONDS,
      )
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    }
  }

  private fun buildUrl(
    path: String,
  ): String =
    "http://127.0.0.1:${server.localPort}$path"

  private fun acceptLoop() {
    while (!closed.get()) {
      val socket =
        try {
          server.accept()
        } catch (_: SocketException) {
          if (closed.get()) {
            return
          }

          continue
        } catch (_: Throwable) {
          if (closed.get()) {
            return
          }

          continue
        }

      if (
        closed.get() ||
        !socket.inetAddress.isLoopbackAddress
      ) {
        try {
          socket.close()
        } catch (_: Throwable) {
        }

        continue
      }

      activeSockets.add(socket)

      try {
        clients.execute {
          handle(socket)
        }
      } catch (_: RejectedExecutionException) {
        activeSockets.remove(socket)

        try {
          socket.close()
        } catch (_: Throwable) {
        }
      }
    }
  }

  private fun handle(
    socket: Socket,
  ) {
    try {
      socket.soTimeout =
        CLIENT_READ_TIMEOUT_MS

      socket.tcpNoDelay =
        true

      val input =
        BufferedInputStream(
          socket.getInputStream(),
        )

      val output =
        BufferedOutputStream(
          socket.getOutputStream(),
        )

      val request =
        readRequest(input)
          ?: run {
            writeEmpty(
              output,
              400,
              "Bad Request",
            )

            return
          }

      if (
        request.method != "GET" &&
        request.method != "HEAD"
      ) {
        writeEmpty(
          output,
          405,
          "Method Not Allowed",
          mapOf(
            "Allow" to "GET, HEAD",
          ),
        )

        return
      }

      if (
        request.target.contains('?') ||
        request.target.contains('#')
      ) {
        writeEmpty(
          output,
          404,
          "Not Found",
        )

        return
      }

      val route =
        routes[request.target]
          ?: run {
            writeEmpty(
              output,
              404,
              "Not Found",
            )

            return
          }

      when (route) {
        is StaticRoute ->
          writeStatic(
            output = output,
            route = route,
            headOnly =
              request.method == "HEAD",
          )

        is ProviderRoute ->
          writeProvider(
            output = output,
            route = route,
            headOnly =
              request.method == "HEAD",
          )
      }
    } catch (_: Throwable) {
    } finally {
      activeSockets.remove(socket)

      try {
        socket.close()
      } catch (_: Throwable) {
      }
    }
  }

  private fun readRequest(
    input: BufferedInputStream,
  ): Request? {
    val requestLine =
      readAsciiLine(
        input,
        MAX_REQUEST_LINE_BYTES,
      ) ?: return null

    val parts =
      requestLine.split(' ')

    if (parts.size != 3) {
      return null
    }

    val method =
      parts[0]
        .uppercase(Locale.US)

    val target =
      parts[1]

    val version =
      parts[2]

    if (
      version != "HTTP/1.1" &&
      version != "HTTP/1.0"
    ) {
      return null
    }

    if (
      target.isBlank() ||
      target.length >
      MAX_REQUEST_TARGET_CHARS
    ) {
      return null
    }

    var headerBytes = 0

    while (true) {
      val line =
        readAsciiLine(
          input,
          MAX_HEADER_LINE_BYTES,
        ) ?: return null

      headerBytes +=
        line.length + 2

      if (
        headerBytes >
        MAX_HEADER_BYTES
      ) {
        return null
      }

      if (line.isEmpty()) {
        break
      }
    }

    return Request(
      method = method,
      target = target,
    )
  }

  private fun readAsciiLine(
    input: BufferedInputStream,
    maxBytes: Int,
  ): String? {
    val output =
      ByteArrayOutputStream()

    while (
      output.size() <=
      maxBytes
    ) {
      val value =
        input.read()

      if (value < 0) {
        return null
      }

      if (value == '\n'.code) {
        return output.toString(
          StandardCharsets.US_ASCII.name(),
        )
      }

      if (value != '\r'.code) {
        output.write(value)
      }
    }

    return null
  }

  private fun writeProvider(
    output: BufferedOutputStream,
    route: ProviderRoute,
    headOnly: Boolean,
  ) {
    val connection =
      OrionDownloadAuthorizedHttp
        .openFollowingRedirects(
          bound = route.bound,
          parentUrl = route.parentUrl,
          childUrl = route.childUrl,
          rangeStart = route.rangeStart,
          rangeEndInclusive =
            route.rangeEndInclusive,
        )
        ?: run {
          writeEmpty(
            output,
            502,
            "Bad Gateway",
          )

          return
        }

    activeProviderConnections.add(
      connection,
    )

    try {
      val status =
        connection.responseCode

      if (
        status !in 200..299 &&
        status !=
        HTTP_RANGE_NOT_SATISFIABLE
      ) {
        writeEmpty(
          output,
          502,
          "Bad Gateway",
        )

        return
      }

      val headers =
        linkedMapOf<String, String>()

      safeProviderHeader(
        connection.contentType,
      )?.let { value ->
        headers["Content-Type"] =
          value
      }

      val contentLength =
        connection.contentLengthLong

      if (contentLength >= 0L) {
        headers["Content-Length"] =
          contentLength.toString()
      }

      safeProviderHeader(
        connection.getHeaderField(
          "Content-Range",
        ),
      )?.let { value ->
        headers["Content-Range"] =
          value
      }

      if (
        connection
          .getHeaderField(
            "Accept-Ranges",
          )
          ?.equals(
            "bytes",
            ignoreCase = true,
          ) == true
      ) {
        headers["Accept-Ranges"] =
          "bytes"
      }

      headers["Cache-Control"] =
        "no-store"

      headers["X-Content-Type-Options"] =
        "nosniff"

      headers["Connection"] =
        "close"

      writeHead(
        output = output,
        status = status,
        reason =
          when (status) {
            HttpURLConnection.HTTP_OK ->
              "OK"

            HttpURLConnection.HTTP_PARTIAL ->
              "Partial Content"

            HTTP_RANGE_NOT_SATISFIABLE ->
              "Range Not Satisfiable"

            else ->
              "OK"
          },
        headers = headers,
      )

      if (
        !headOnly &&
        status in 200..299
      ) {
        val input =
          try {
            connection.inputStream
          } catch (_: Throwable) {
            connection.errorStream
          }

        if (input != null) {
          input.use { source ->
            val buffer =
              ByteArray(
                PROVIDER_BUFFER_SIZE,
              )

            while (!closed.get()) {
              val read =
                source.read(buffer)

              if (read <= 0) {
                break
              }

              output.write(
                buffer,
                0,
                read,
              )
            }
          }
        }
      }

      output.flush()
    } finally {
      activeProviderConnections.remove(
        connection,
      )

      try {
        connection.disconnect()
      } catch (_: Throwable) {
      }
    }
  }

  private fun safeProviderHeader(
    raw: String?,
  ): String? =
    raw
      ?.trim()
      ?.takeIf {
        it.isNotEmpty() &&
        it.length <=
        MAX_PROVIDER_HEADER_VALUE_CHARS &&
        !it.contains('\r') &&
        !it.contains('\n') &&
        !it.contains('\u0000')
      }
  private fun writeStatic(
    output: BufferedOutputStream,
    route: StaticRoute,
    headOnly: Boolean,
  ) {
    val headers =
      linkedMapOf(
        "Content-Type" to route.contentType,
        "Content-Length" to route.body.size.toString(),
        "Cache-Control" to "no-store",
        "X-Content-Type-Options" to "nosniff",
        "Connection" to "close",
      )

    writeHead(
      output,
      200,
      "OK",
      headers,
    )

    if (!headOnly) {
      output.write(
        route.body,
      )
    }

    output.flush()
  }

  private fun writeEmpty(
    output: BufferedOutputStream,
    status: Int,
    reason: String,
    extraHeaders: Map<String, String> =
      emptyMap(),
  ) {
    val headers =
      linkedMapOf(
        "Content-Length" to "0",
        "Cache-Control" to "no-store",
        "Connection" to "close",
      )

    headers.putAll(
      extraHeaders,
    )

    writeHead(
      output,
      status,
      reason,
      headers,
    )

    output.flush()
  }

  private fun writeHead(
    output: BufferedOutputStream,
    status: Int,
    reason: String,
    headers: Map<String, String>,
  ) {
    val builder =
      StringBuilder()
        .append("HTTP/1.1 ")
        .append(status)
        .append(' ')
        .append(reason)
        .append("\r\n")

    headers.forEach {
      (name, value) ->
      builder
        .append(name)
        .append(": ")
        .append(value)
        .append("\r\n")
    }

    builder.append("\r\n")

    output.write(
      builder
        .toString()
        .toByteArray(
          StandardCharsets.US_ASCII,
        ),
    )
  }

  internal companion object {
    private const val BACKLOG = 16
    private const val MAX_CLIENTS = 4
    private const val MAX_MANIFEST_BYTES = 2 * 1024 * 1024
    private const val MAX_REQUEST_LINE_BYTES = 4 * 1024
    private const val MAX_REQUEST_TARGET_CHARS = 512
    private const val MAX_HEADER_LINE_BYTES = 8 * 1024
    private const val MAX_HEADER_BYTES = 32 * 1024
    private const val CLIENT_READ_TIMEOUT_MS = 5_000
    private const val PROVIDER_BUFFER_SIZE = 64 * 1024
    private const val HTTP_RANGE_NOT_SATISFIABLE = 416
    private const val MAX_PROVIDER_HEADER_VALUE_CHARS = 512
    private const val THREAD_JOIN_TIMEOUT_MS = 1_000L
    private const val CAPABILITY_TOKEN_BYTES = 32
    private const val ROUTE_TOKEN_BYTES = 18
    private const val ROUTE_REGISTRATION_ATTEMPTS = 8

    private val RANDOM =
      SecureRandom()

    private const val HEX =
      "0123456789abcdef"

    fun start(
      jobId: String,
    ): OrionDownloadYtDlpGatewaySession? {
      val cleanJobId =
        cleanJobId(jobId)
          ?: return null

      val server =
        ServerSocket()

      return try {
        server.reuseAddress =
          false

        server.bind(
          InetSocketAddress(
            loopbackAddress(),
            0,
          ),
          BACKLOG,
        )

        OrionDownloadYtDlpGatewaySession(
          ownerJobId = cleanJobId,
          server = server,
          capability =
            randomToken(
              CAPABILITY_TOKEN_BYTES,
            ),
        )
      } catch (_: Throwable) {
        try {
          server.close()
        } catch (_: Throwable) {
        }

        null
      }
    }

    private fun loopbackAddress(): InetAddress =
      InetAddress.getByAddress(
        byteArrayOf(
          127,
          0,
          0,
          1,
        ),
      )

    private fun cleanJobId(
      raw: String,
    ): String? =
      raw.trim()
        .takeIf {
          it.matches(
            Regex(
              "^[A-Za-z0-9._:-]{1,120}$",
            ),
          )
        }

    private fun randomToken(
      byteCount: Int,
    ): String {
      val bytes =
        ByteArray(byteCount)

      RANDOM.nextBytes(bytes)

      val output =
        StringBuilder(
          byteCount * 2,
        )

      bytes.forEach { byte ->
        val value =
          byte.toInt() and 0xff

        output.append(
          HEX[value ushr 4],
        )

        output.append(
          HEX[value and 0x0f],
        )
      }

      return output.toString()
    }
  }
}
