package com.okali.orion.playback

import java.security.MessageDigest

/** One stock HTML commit, never a general data-scheme or request-origin permission. */
internal class OrionWrapperSourceLoad {
  private data class Content(val digest: ByteArray, val length: Int)
  private data class Permit(val content: Content, val sourceId: String, val sessionId: String, val armedAt: Long)
  private var pending: Content? = null
  private var permit: Permit? = null

  @Synchronized fun stage(baseUrl: String?, encodedHtml: String?) {
    permit = null
    pending = if (baseUrl == BASE_URL && encodedHtml != null && encodedHtml.length in 1..MAX_ENCODED_LENGTH
      && encodedHtml.matches(Regex("[A-Za-z0-9+/]+={0,2}"))) Content(digest(encodedHtml), encodedHtml.length) else null
  }

  @Synchronized fun arm(sourceId: String, sessionId: String, navigationOrigins: List<String>, now: Long): Boolean {
    val content = pending ?: return false
    pending = null
    permit = null
    if (sourceId.isBlank() || sessionId.isBlank() || now < 0 || ORIGIN !in navigationOrigins) return false
    permit = Permit(content, sourceId, sessionId, now)
    return true
  }

  @Synchronized fun consume(sourceId: String, sessionId: String, url: String, mainFrame: Boolean, now: Long): Boolean {
    val current = permit ?: return false
    val elapsed = now - current.armedAt
    if (elapsed !in 0..MAX_COMMIT_AGE_MS) { permit = null; return false }
    if (!mainFrame || sourceId != current.sourceId || sessionId != current.sessionId) return false
    val prefix = DATA_PREFIXES.firstOrNull { url.startsWith(it) } ?: return false
    val length = url.length - prefix.length
    // Chromium may intercept its empty internal placeholder, with the app's HTML
    // carried separately in LoadUrlParams. Nonempty data must match the staged bytes.
    if (length != 0 && (length != current.content.length
      || !MessageDigest.isEqual(digest(url.substring(prefix.length)), current.content.digest))) return false
    permit = null
    return true
  }

  @Synchronized fun invalidate() { permit = null }
  @Synchronized fun clear() { pending = null; permit = null }

  private fun digest(value: String): ByteArray = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.US_ASCII))

  companion object {
    const val BASE_URL = "https://orion.local/player/"
    private const val ORIGIN = "https://orion.local"
    private const val MAX_ENCODED_LENGTH = 174764 // At most 128 KiB of app-owned HTML.
    private const val MAX_COMMIT_AGE_MS = 5000L
    private val DATA_PREFIXES = listOf("data:text/html;charset=utf-8;base64,", "data:text/html;base64,")
  }
}
