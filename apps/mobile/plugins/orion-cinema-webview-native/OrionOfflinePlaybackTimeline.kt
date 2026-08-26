package com.okali.orion.playback

/**
 * Pure, bounded timing policy for decoder-facing offline fragment playlists.
 *
 * Unlike [OrionPortableCadence], this policy never places or rewrites sample
 * timestamps. Each fragment is described independently so decoder-playable
 * reorder, duplicate PTS, VFR cadence, and segment-local discontinuities do
 * not inherit MediaMuxer's stricter portable-output contract.
 */
internal object OrionOfflinePlaybackTimeline {
  const val MAX_SAMPLES_PER_SEGMENT = 20_000
  const val MAX_SAMPLE_BYTES = 16L * 1024L * 1024L
  const val MAX_TAIL_STEP_US = 1_000_000L
  const val MAX_SEGMENT_DURATION_US = 6L * 60L * 60L * 1_000_000L
  const val MAX_PRESENTATION_DURATION_US = 30L * 24L * 60L * 60L * 1_000_000L

  private const val MIN_AV_DRIFT_US = 30L * 1_000_000L
  private const val MAX_AV_DRIFT_US = 5L * 60L * 1_000_000L

  data class Analysis(
    val sampleCount: Int,
    val minTimeUs: Long,
    val maxTimeUs: Long,
    val representativeStepUs: Long,
    val durationUs: Long,
    val reordered: Boolean,
    val hasDuplicatePresentationTimes: Boolean,
  )

  fun analyze(
    timestampsUs: LongArray,
    sampleSizes: LongArray,
    fallbackStepUs: Long,
    maxSamples: Int = MAX_SAMPLES_PER_SEGMENT,
  ): Analysis? {
    if (
      timestampsUs.isEmpty() ||
      timestampsUs.size != sampleSizes.size ||
      maxSamples !in 1..MAX_SAMPLES_PER_SEGMENT ||
      timestampsUs.size > maxSamples ||
      fallbackStepUs <= 0L
    ) return null
    if (sampleSizes.any { it !in 1L..MAX_SAMPLE_BYTES }) return null

    var reordered = false
    for (index in 1 until timestampsUs.size) {
      if (timestampsUs[index] < timestampsUs[index - 1]) reordered = true
    }

    val ordered = timestampsUs.copyOf()
    java.util.Arrays.sort(ordered)
    val minTimeUs = ordered.first()
    val maxTimeUs = ordered.last()
    val spanUs = safeSubtract(maxTimeUs, minTimeUs) ?: return null
    if (spanUs > MAX_SEGMENT_DURATION_US) return null

    val positiveDeltas = LongArray((ordered.size - 1).coerceAtLeast(0))
    var positiveDeltaCount = 0
    var hasDuplicates = false
    for (index in 1 until ordered.size) {
      val delta = safeSubtract(ordered[index], ordered[index - 1]) ?: return null
      when {
        delta < 0L -> return null
        delta == 0L -> hasDuplicates = true
        else -> positiveDeltas[positiveDeltaCount++] = delta
      }
    }

    val boundedFallbackUs = fallbackStepUs.coerceAtMost(MAX_TAIL_STEP_US)
    val representativeStepUs = if (positiveDeltaCount > 0) {
      median(positiveDeltas, positiveDeltaCount).coerceAtMost(MAX_TAIL_STEP_US)
    } else boundedFallbackUs
    if (representativeStepUs <= 0L) return null

    val durationUs = if (spanUs == 0L) {
      safeMultiply(boundedFallbackUs, timestampsUs.size.toLong())
    } else {
      safeAdd(spanUs, representativeStepUs)
    } ?: return null
    if (durationUs !in 1L..MAX_SEGMENT_DURATION_US) return null

    return Analysis(
      sampleCount = timestampsUs.size,
      minTimeUs = minTimeUs,
      maxTimeUs = maxTimeUs,
      representativeStepUs = representativeStepUs,
      durationUs = durationUs,
      reordered = reordered,
      hasDuplicatePresentationTimes = hasDuplicates,
    )
  }

  fun totalDurationUs(segmentDurationsUs: LongArray): Long? {
    if (segmentDurationsUs.isEmpty()) return null
    var total = 0L
    for (durationUs in segmentDurationsUs) {
      if (durationUs !in 1L..MAX_SEGMENT_DURATION_US) return null
      total = safeAdd(total, durationUs) ?: return null
      if (total > MAX_PRESENTATION_DURATION_US) return null
    }
    return total.takeIf { it > 0L }
  }

  fun withinAvDrift(videoDurationUs: Long, audioDurationUs: Long): Boolean {
    if (
      videoDurationUs !in 1L..MAX_PRESENTATION_DURATION_US ||
      audioDurationUs !in 1L..MAX_PRESENTATION_DURATION_US
    ) return false
    val longer = maxOf(videoDurationUs, audioDurationUs)
    val shorter = minOf(videoDurationUs, audioDurationUs)
    val difference = safeSubtract(longer, shorter) ?: return false
    val proportionalAllowance = longer / 10L
    val allowance = maxOf(MIN_AV_DRIFT_US, proportionalAllowance).coerceAtMost(MAX_AV_DRIFT_US)
    return difference <= allowance
  }

  private fun median(values: LongArray, size: Int): Long {
    java.util.Arrays.sort(values, 0, size)
    val middle = size / 2
    if (size % 2 == 1) return values[middle]
    val left = values[middle - 1]
    val right = values[middle]
    return left + ((right - left) / 2L)
  }

  private fun safeAdd(left: Long, right: Long): Long? = try {
    java.lang.Math.addExact(left, right)
  } catch (_: ArithmeticException) {
    null
  }

  private fun safeSubtract(left: Long, right: Long): Long? = try {
    java.lang.Math.subtractExact(left, right)
  } catch (_: ArithmeticException) {
    null
  }

  private fun safeMultiply(left: Long, right: Long): Long? = try {
    java.lang.Math.multiplyExact(left, right)
  } catch (_: ArithmeticException) {
    null
  }
}
