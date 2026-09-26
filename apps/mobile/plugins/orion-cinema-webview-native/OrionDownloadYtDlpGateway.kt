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
import android.util.Log
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

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
  private val onMediaProgress: (Long, Int, Int) -> Unit,
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
    val isKey: Boolean,
  ) : Route

  private data class Request(
    val method: String,
    val target: String,
    val rangeStart: Long?,
    val rangeEndInclusive: Long?,
    val rangeRequested: Boolean,
  )

  private val closed = AtomicBoolean(false)

  private val routes =
    ConcurrentHashMap<String, Route>()

  private val providerRouteCount = AtomicInteger(0)
  private val completedProviderBytes = ConcurrentHashMap<String, Long>()
  private val completedProviderByteCount = AtomicLong(0L)
  private val loopbackRequestCount = AtomicInteger(0)
  private val providerRequestCount = AtomicInteger(0)
  private val clientRangeRequestCount = AtomicInteger(0)
  private val provider2xxCount = AtomicInteger(0)
  private val provider4xxCount = AtomicInteger(0)
  private val provider5xxCount = AtomicInteger(0)
  private val mediaProgressLock = Any()

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
    isKey: Boolean = false,
    routeSuffix: String = "bin",
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
      routeSuffix,
      ProviderRoute(
        bound = bound,
        parentUrl = parentUrl,
        childUrl = childUrl,
        rangeStart = rangeStart,
        rangeEndInclusive = rangeEndInclusive,
        isKey = isKey,
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
        if (route is ProviderRoute && !route.isKey) providerRouteCount.incrementAndGet()
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

    Log.i(
      "OrionDownloadStage",
      "stage=yt-dlp-gateway outcome=summary requests=${loopbackRequestCount.get()} provider=${providerRequestCount.get()} ranges=${clientRangeRequestCount.get()} provider2xx=${provider2xxCount.get()} provider4xx=${provider4xxCount.get()} provider5xx=${provider5xxCount.get()} mediaRoutes=${providerRouteCount.get()} completedRoutes=${completedProviderBytes.size} bytes=${completedProviderByteCount.get()}",
    )

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

      loopbackRequestCount.incrementAndGet()
      if (request.rangeRequested) clientRangeRequestCount.incrementAndGet()

      when (route) {
        is StaticRoute ->
          writeStatic(
            output = output,
            route = route,
            headOnly =
              request.method == "HEAD",
            clientRangeStart = request.rangeStart,
            clientRangeEndInclusive = request.rangeEndInclusive,
            clientRangeRequested = request.rangeRequested,
          )

        is ProviderRoute ->
          writeProvider(
            output = output,
            route = route,
            routeKey = request.target,
            headOnly =
              request.method == "HEAD",
            clientRangeStart = request.rangeStart,
            clientRangeEndInclusive = request.rangeEndInclusive,
            clientRangeRequested = request.rangeRequested,
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
    var rangeStart: Long? = null
    var rangeEndInclusive: Long? = null
    var rangeRequested = false

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

      val separator = line.indexOf(':')
      if (separator <= 0) return null
      val name = line.substring(0, separator).trim()
      if (name.equals("Range", ignoreCase = true)) {
        if (rangeRequested) return null
        val parsed = parseClientRange(line.substring(separator + 1)) ?: return null
        rangeStart = parsed.first
        rangeEndInclusive = parsed.second
        rangeRequested = true
      }
    }

    return Request(
      method = method,
      target = target,
      rangeStart = rangeStart,
      rangeEndInclusive = rangeEndInclusive,
      rangeRequested = rangeRequested,
    )
  }

  private fun parseClientRange(raw: String): Pair<Long, Long?>? {
    val value = raw.trim()
    if (!value.startsWith("bytes=", ignoreCase = true)) return null
    val spec = value.substringAfter('=').trim()
    if (spec.isEmpty() || spec.contains(',')) return null
    val parts = spec.split('-', limit = 2)
    if (parts.size != 2 || parts[0].isBlank()) return null
    val start = parts[0].trim().toLongOrNull()?.takeIf { it >= 0L } ?: return null
    val endText = parts[1].trim()
    val end = if (endText.isEmpty()) null else endText.toLongOrNull()?.takeIf { it >= start } ?: return null
    return start to end
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
    routeKey: String,
    headOnly: Boolean,
    clientRangeStart: Long?,
    clientRangeEndInclusive: Long?,
    clientRangeRequested: Boolean,
  ) {
    providerRequestCount.incrementAndGet()

    // FFmpeg may probe or seek a loopback HLS media route with Range.
    // Preserve that range when this route represents the whole provider object;
    // otherwise the gateway can advertise byte ranges while silently serving
    // the whole object, which breaks the local HTTP contract seen by FFmpeg.
    val effectiveRangeStart =
      route.rangeStart ?: if (!route.isKey) clientRangeStart else null
    val effectiveRangeEndInclusive =
      route.rangeEndInclusive ?: if (!route.isKey && route.rangeStart == null) clientRangeEndInclusive else null

    if (clientRangeRequested && route.rangeStart == null && !route.isKey) {
      Log.i(
        "OrionDownloadStage",
        "stage=provider-route outcome=range-forwarded bounded=${clientRangeEndInclusive != null}",
      )
    }

    val connection =
      OrionDownloadAuthorizedHttp
        .openFollowingRedirects(
          bound = route.bound,
          parentUrl = route.parentUrl,
          childUrl = route.childUrl,
          rangeStart = effectiveRangeStart,
          rangeEndInclusive =
            effectiveRangeEndInclusive,
        )
        ?: run {
          Log.i("OrionDownloadStage", "stage=provider-route outcome=unavailable key=${route.isKey}")
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

      when (status) {
        in 200..299 -> provider2xxCount.incrementAndGet()
        in 400..499 -> provider4xxCount.incrementAndGet()
        in 500..599 -> provider5xxCount.incrementAndGet()
      }

      if (
        status !in 200..299 &&
        status !=
        HTTP_RANGE_NOT_SATISFIABLE
      ) {
        Log.i("OrionDownloadStage", "stage=provider-route status=$status key=${route.isKey}")
        writeEmpty(
          output,
          502,
          "Bad Gateway",
        )

        return
      }

      if (route.isKey) {
        if (status != HttpURLConnection.HTTP_OK) {
          writeEmpty(output, 502, "Bad Gateway")
          return
        }
        val key = try {
          connection.inputStream.use { input ->
            val bytes = ByteArrayOutputStream()
            val buffer = ByteArray(17)
            while (bytes.size() < 17) {
              val count = input.read(buffer, 0, 17 - bytes.size())
              if (count < 0) break
              if (count > 0) bytes.write(buffer, 0, count)
            }
            bytes.toByteArray()
          }
        } catch (_: Throwable) { null }
        if (key == null || key.size != 16) {
          Log.i("OrionDownloadStage", "stage=key-route outcome=invalid size=${key?.size ?: 0}")
          writeEmpty(output, 502, "Bad Gateway")
          return
        }
        writeHead(output, 200, "OK", linkedMapOf(
          "Content-Type" to "application/octet-stream",
          "Content-Length" to "16",
          "Cache-Control" to "no-store",
          "X-Content-Type-Options" to "nosniff",
          "Connection" to "close",
        ))
        if (!headOnly) output.write(key)
        output.flush()
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

      var deliveredBytes = 0L
      var reachedEnd = false
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

              if (read < 0) {
                reachedEnd = true
                break
              }
              if (read == 0) continue

              output.write(
                buffer,
                0,
                read,
              )
              deliveredBytes += read
            }
          }
        }
      }

      output.flush()
      if (reachedEnd && deliveredBytes > 0L &&
        (contentLength < 0L || deliveredBytes == contentLength)
      ) {
        synchronized(mediaProgressLock) {
          if (completedProviderBytes.putIfAbsent(routeKey, deliveredBytes) == null) {
            val bytes = completedProviderByteCount.addAndGet(deliveredBytes)
            onMediaProgress(bytes, completedProviderBytes.size, providerRouteCount.get())
          }
        }
      }
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
    clientRangeStart: Long?,
    clientRangeEndInclusive: Long?,
    clientRangeRequested: Boolean,
  ) {
    val bodySize = route.body.size.toLong()

    if (clientRangeRequested) {
      val start = clientRangeStart ?: run {
        writeEmpty(
          output = output,
          status = HTTP_RANGE_NOT_SATISFIABLE,
          reason = "Range Not Satisfiable",
          extraHeaders = mapOf(
            "Content-Range" to "bytes */$bodySize",
            "Accept-Ranges" to "bytes",
          ),
        )
        return
      }

      if (start >= bodySize) {
        Log.i(
          "OrionDownloadStage",
          "stage=static-route outcome=range-unsatisfied",
        )
        writeEmpty(
          output = output,
          status = HTTP_RANGE_NOT_SATISFIABLE,
          reason = "Range Not Satisfiable",
          extraHeaders = mapOf(
            "Content-Range" to "bytes */$bodySize",
            "Accept-Ranges" to "bytes",
          ),
        )
        return
      }

      val end =
        (clientRangeEndInclusive ?: (bodySize - 1L))
          .coerceAtMost(bodySize - 1L)
      val length = end - start + 1L

      val headers =
        linkedMapOf(
          "Content-Type" to route.contentType,
          "Content-Length" to length.toString(),
          "Content-Range" to "bytes $start-$end/$bodySize",
          "Accept-Ranges" to "bytes",
          "Cache-Control" to "no-store",
          "X-Content-Type-Options" to "nosniff",
          "Connection" to "close",
        )

      Log.i(
        "OrionDownloadStage",
        "stage=static-route outcome=range-served bounded=${clientRangeEndInclusive != null}",
      )

      writeHead(
        output = output,
        status = HttpURLConnection.HTTP_PARTIAL,
        reason = "Partial Content",
        headers = headers,
      )

      if (!headOnly) {
        output.write(
          route.body,
          start.toInt(),
          length.toInt(),
        )
      }

      output.flush()
      return
    }

    val headers =
      linkedMapOf(
        "Content-Type" to route.contentType,
        "Content-Length" to route.body.size.toString(),
        "Accept-Ranges" to "bytes",
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
      onMediaProgress: (Long, Int, Int) -> Unit = { _, _, _ -> },
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
          onMediaProgress = onMediaProgress,
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
