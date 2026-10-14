package expo.modules.orionglimpse

internal object GlimpsePalette {
  fun colors(pixels: IntArray): List<String>? {
    val buckets = HashMap<Int, Double>()
    for (pixel in pixels) {
      val r = (pixel shr 16) and 255; val g = (pixel shr 8) and 255; val b = pixel and 255
      val max = maxOf(r, g, b); val min = minOf(r, g, b)
      val luminance = (max + min) / 2.0
      val saturation = if (max == 0) 0.0 else (max - min).toDouble() / max
      if (luminance < 16 || luminance > 242 || saturation < 0.09) continue
      fun quantize(v: Int) = minOf(255, ((v + 16) / 32) * 32)
      val key = (quantize(r) shl 16) or (quantize(g) shl 8) or quantize(b)
      buckets[key] = (buckets[key] ?: 0.0) + 1 + saturation * 3
    }
    val ranked = buckets.entries.sortedWith(compareByDescending<Map.Entry<Int, Double>> { it.value }.thenBy { it.key })
    if (ranked.isEmpty()) return null
    val first = ranked.first().key
    val second = ranked.firstOrNull { entry ->
      fun channel(v: Int, shift: Int) = (v shr shift) and 255
      listOf(16, 8, 0).sumOf { kotlin.math.abs(channel(first, it) - channel(entry.key, it)) } > 100
    }?.key ?: first
    return listOf(first, second).map { "#%06x".format(it) }
  }
}
