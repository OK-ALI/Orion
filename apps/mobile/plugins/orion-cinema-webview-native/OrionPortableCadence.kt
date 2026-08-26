package com.okali.orion.playback

/**
 * Pure timestamp policy used by the native portable finalizer.
 *
 * Samples remain in extractor/decode order for muxing. Sorting is used only to
 * validate their presentation cadence and to place explicit media fragments on
 * one continuous output timeline.
 */
internal object OrionPortableCadence {
  const val MAX_SAMPLES_PER_FRAGMENT = 20_000
  const val MAX_OUTPUT_SAMPLES = 2_000_000
  const val MAX_REORDER_US = 1_000_000L
  const val MIN_VIDEO_STEP_US = 4_000L
  const val MAX_VIDEO_STEP_US = 125_000L
  const val MAX_PRESENTATION_GAP_US = 250_000L
  const val MAX_AV_DRIFT_US = 5_000_000L

  enum class Kind { VIDEO, AUDIO }

  data class Analysis(
    val sampleCount: Int,
    val minTimeUs: Long,
    val maxTimeUs: Long,
    val representativeStepUs: Long,
    val maxPresentationGapUs: Long,
    val reordered: Boolean,
  ) {
    val durationUs: Long
      get() = maxTimeUs - minTimeUs
  }

  data class Timeline(
    val offsetUs: Long,
    val minTimeUs: Long,
    val maxTimeUs: Long,
    val representativeStepUs: Long,
  )

  data class Placement(
    val offsetUs: Long,
    val minTimeUs: Long,
    val maxTimeUs: Long,
    val rebased: Boolean,
    val next: Timeline,
  )

  fun analyze(
    timestampsUs: LongArray,
    kind: Kind,
    fallbackStepUs: Long,
    maxSamples: Int = MAX_SAMPLES_PER_FRAGMENT,
  ): Analysis? {
    if (timestampsUs.isEmpty() || timestampsUs.size > maxSamples) return null

    var reordered = false
    for (index in 1 until timestampsUs.size) {
      val previous = timestampsUs[index - 1]
      val current = timestampsUs[index]
      if (current < previous) {
        reordered = true
        val excursion = safeSubtract(previous, current) ?: return null
        if (excursion > MAX_REORDER_US) return null
      }
    }

    val ordered = timestampsUs.copyOf()
    java.util.Arrays.sort(ordered)
    val minTimeUs = ordered.first()
    val maxTimeUs = ordered.last()
    val fallback = fallbackStepUs.coerceAtLeast(1L)
    if (ordered.size == 1) {
      if (kind == Kind.VIDEO && fallback !in MIN_VIDEO_STEP_US..MAX_VIDEO_STEP_US) return null
      return Analysis(1, minTimeUs, maxTimeUs, fallback, 0L, reordered)
    }

    val deltas = LongArray(ordered.size - 1)
    var maxGapUs = 0L
    for (index in 1 until ordered.size) {
      val delta = safeSubtract(ordered[index], ordered[index - 1]) ?: return null
      if (delta <= 0L) return null
      deltas[index - 1] = delta
      if (delta > maxGapUs) maxGapUs = delta
    }

    val representativeStepUs = median(deltas)
    if (kind == Kind.VIDEO) {
      if (representativeStepUs !in MIN_VIDEO_STEP_US..MAX_VIDEO_STEP_US) return null
      val minimumDeltaUs = maxOf(1_000L, representativeStepUs / 8L)
      val maximumDeltaUs = minOf(
        MAX_PRESENTATION_GAP_US,
        maxOf(100_000L, safeMultiply(representativeStepUs, 4L) ?: return null),
      )
      if (deltas.any { it < minimumDeltaUs || it > maximumDeltaUs }) return null
    } else {
      val maximumDeltaUs = minOf(
        MAX_PRESENTATION_GAP_US,
        maxOf(100_000L, safeMultiply(maxOf(representativeStepUs, fallback), 4L) ?: return null),
      )
      if (deltas.any { it > maximumDeltaUs }) return null
    }

    return Analysis(
      sampleCount = timestampsUs.size,
      minTimeUs = minTimeUs,
      maxTimeUs = maxTimeUs,
      representativeStepUs = representativeStepUs,
      maxPresentationGapUs = maxGapUs,
      reordered = reordered,
    )
  }

  fun place(analysis: Analysis, previous: Timeline?): Placement? {
    if (previous == null) {
      val offsetUs = safeNegate(analysis.minTimeUs) ?: return null
      val minTimeUs = safeAdd(analysis.minTimeUs, offsetUs) ?: return null
      val maxTimeUs = safeAdd(analysis.maxTimeUs, offsetUs) ?: return null
      return Placement(
        offsetUs = offsetUs,
        minTimeUs = minTimeUs,
        maxTimeUs = maxTimeUs,
        rebased = offsetUs != 0L,
        next = Timeline(offsetUs, minTimeUs, maxTimeUs, analysis.representativeStepUs),
      )
    }

    val bridgeStepUs = median(longArrayOf(previous.representativeStepUs, analysis.representativeStepUs))
      .coerceAtLeast(1L)
    val naturalMinUs = safeAdd(analysis.minTimeUs, previous.offsetUs) ?: return null
    val naturalMaxUs = safeAdd(analysis.maxTimeUs, previous.offsetUs) ?: return null
    val naturalGapUs = safeSubtract(naturalMinUs, previous.maxTimeUs) ?: return null
    val minimumBoundaryGapUs = maxOf(1_000L, bridgeStepUs / 8L)
    val maximumBoundaryGapUs = minOf(
      MAX_PRESENTATION_GAP_US,
      maxOf(100_000L, safeMultiply(bridgeStepUs, 4L) ?: return null),
    )

    val preserve = naturalGapUs in minimumBoundaryGapUs..maximumBoundaryGapUs
    val offsetUs: Long
    val minTimeUs: Long
    val maxTimeUs: Long
    if (preserve) {
      offsetUs = previous.offsetUs
      minTimeUs = naturalMinUs
      maxTimeUs = naturalMaxUs
    } else {
      val expectedMinUs = safeAdd(previous.maxTimeUs, bridgeStepUs) ?: return null
      offsetUs = safeSubtract(expectedMinUs, analysis.minTimeUs) ?: return null
      minTimeUs = expectedMinUs
      maxTimeUs = safeAdd(analysis.maxTimeUs, offsetUs) ?: return null
    }

    if (minTimeUs <= previous.maxTimeUs || maxTimeUs < minTimeUs) return null
    return Placement(
      offsetUs = offsetUs,
      minTimeUs = minTimeUs,
      maxTimeUs = maxTimeUs,
      rebased = !preserve,
      next = Timeline(offsetUs, minTimeUs, maxTimeUs, analysis.representativeStepUs),
    )
  }

  fun applyOffset(timestampUs: Long, offsetUs: Long): Long? = safeAdd(timestampUs, offsetUs)

  fun withinAvDrift(videoDurationUs: Long, audioDurationUs: Long): Boolean {
    if (videoDurationUs <= 0L || audioDurationUs <= 0L) return false
    val driftUs = if (videoDurationUs >= audioDurationUs) {
      safeSubtract(videoDurationUs, audioDurationUs)
    } else {
      safeSubtract(audioDurationUs, videoDurationUs)
    } ?: return false
    return driftUs <= MAX_AV_DRIFT_US
  }

  private fun median(values: LongArray): Long {
    val ordered = values.copyOf()
    java.util.Arrays.sort(ordered)
    val middle = ordered.size / 2
    if (ordered.size % 2 == 1) return ordered[middle]
    val left = ordered[middle - 1]
    val right = ordered[middle]
    return left + ((right - left) / 2L)
  }

  private fun safeAdd(left: Long, right: Long): Long? {
    if (right > 0L && left > Long.MAX_VALUE - right) return null
    if (right < 0L && left < Long.MIN_VALUE - right) return null
    return left + right
  }

  private fun safeSubtract(left: Long, right: Long): Long? {
    if (right == Long.MIN_VALUE) return if (left >= 0L) null else left - right
    return safeAdd(left, -right)
  }

  private fun safeNegate(value: Long): Long? = if (value == Long.MIN_VALUE) null else -value

  private fun safeMultiply(left: Long, right: Long): Long? {
    if (left == 0L || right == 0L) return 0L
    if (left > 0L && right > 0L && left > Long.MAX_VALUE / right) return null
    if (left < 0L || right < 0L) return null
    return left * right
  }
}
