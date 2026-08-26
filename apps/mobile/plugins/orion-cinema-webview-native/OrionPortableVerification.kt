package com.okali.orion.playback

import java.security.MessageDigest

internal data class OrionPortableSampleSummary(
  val sampleCount: Long,
  val minTimeUs: Long,
  val maxTimeUs: Long,
  val digest: String,
)

/** Streaming, payload-free proof that mux input and extractor output expose the same sample timeline. */
internal class OrionPortableSampleLedger {
  private val digest = MessageDigest.getInstance("SHA-256")
  private val encoded = ByteArray(16)
  private var count = 0L
  private var minimum = Long.MAX_VALUE
  private var maximum = Long.MIN_VALUE

  fun add(presentationTimeUs: Long, sampleSize: Long): Boolean {
    if (presentationTimeUs < 0L || sampleSize <= 0L) return false
    encodeLong(presentationTimeUs, 0)
    encodeLong(sampleSize, 8)
    digest.update(encoded)
    count += 1L
    minimum = minOf(minimum, presentationTimeUs)
    maximum = maxOf(maximum, presentationTimeUs)
    return true
  }

  fun finish(): OrionPortableSampleSummary? {
    if (count <= 0L || minimum == Long.MAX_VALUE || maximum == Long.MIN_VALUE) return null
    return OrionPortableSampleSummary(
      sampleCount = count,
      minTimeUs = minimum,
      maxTimeUs = maximum,
      digest = digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) },
    )
  }

  private fun encodeLong(value: Long, offset: Int) {
    for (index in 0 until 8) {
      encoded[offset + index] = (value ushr ((7 - index) * 8)).toByte()
    }
  }
}

/** Grows only as a fragment requires while retaining the hard cadence-analysis cap. */
internal class OrionBoundedLongCollector(
  private val maximumSize: Int,
  initialCapacity: Int = 256,
) {
  private var values = LongArray(minOf(maximumSize.coerceAtLeast(1), initialCapacity.coerceAtLeast(1)))
  private var size = 0

  fun add(value: Long): Boolean {
    if (size >= maximumSize) return false
    if (size == values.size) values = values.copyOf(minOf(maximumSize, values.size * 2))
    values[size] = value
    size += 1
    return true
  }

  fun toLongArray(): LongArray = values.copyOf(size)
}
