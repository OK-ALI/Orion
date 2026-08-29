package com.okali.orion.playback

internal data class OrionPlayerSubtitleCue(
  val startMs: Long,
  val endMs: Long,
  val text: String,
)

internal object OrionPlayerSubtitleParser {
  private const val MAX_CUES = 20_000
  private const val MAX_CUE_TEXT = 600
  private const val MAX_TIMELINE_MS = 30L * 24L * 60L * 60L * 1_000L
  private val blockTiming = Regex("""(\d{1,3}:\d{2}(?::\d{2})?[.,]\d{2,3})\s*-->\s*(\d{1,3}:\d{2}(?::\d{2})?[.,]\d{2,3})""")

  fun parse(format: String, content: String): List<OrionPlayerSubtitleCue> {
    val cues = if (format.equals("ass", ignoreCase = true)) parseAss(content) else parseBlocks(content)
    return cues.sortedWith(compareBy<OrionPlayerSubtitleCue> { it.startMs }.thenBy { it.endMs })
  }

  fun activeCue(cues: List<OrionPlayerSubtitleCue>, positionMs: Long): OrionPlayerSubtitleCue? {
    if (positionMs < 0L || cues.isEmpty()) return null
    var low = 0
    var high = cues.lastIndex
    var candidate = -1
    while (low <= high) {
      val middle = (low + high).ushr(1)
      if (cues[middle].startMs <= positionMs) {
        candidate = middle
        low = middle + 1
      } else high = middle - 1
    }
    var index = candidate
    while (index >= 0 && cues[index].startMs <= positionMs) {
      if (positionMs < cues[index].endMs) return cues[index]
      if (candidate - index > 8) break
      index -= 1
    }
    return null
  }

  private fun parseBlocks(content: String): List<OrionPlayerSubtitleCue> {
    val cues = mutableListOf<OrionPlayerSubtitleCue>()
    val normalized = content.removePrefix("\uFEFF").replace("\r\n", "\n").replace('\r', '\n')
    for (block in normalized.split(Regex("\n{2,}"))) {
      val lines = block.split('\n')
      val timingIndex = lines.indexOfFirst { blockTiming.containsMatchIn(it) }
      if (timingIndex < 0) continue
      val match = blockTiming.find(lines[timingIndex]) ?: continue
      appendCue(
        cues,
        clockMs(match.groupValues[1]),
        clockMs(match.groupValues[2]),
        lines.drop(timingIndex + 1).joinToString("\n"),
      )
      if (cues.size >= MAX_CUES) break
    }
    return cues
  }

  private fun parseAss(content: String): List<OrionPlayerSubtitleCue> {
    val cues = mutableListOf<OrionPlayerSubtitleCue>()
    var inEvents = false
    var fields = listOf("layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text")
    val normalized = content.removePrefix("\uFEFF").replace("\r\n", "\n").replace('\r', '\n')
    for (raw in normalized.split('\n')) {
      val line = raw.trim()
      if (line.equals("[Events]", ignoreCase = true)) {
        inEvents = true
        continue
      }
      if (line.startsWith("[")) {
        inEvents = false
        continue
      }
      if (!inEvents) continue
      if (line.startsWith("Format:", ignoreCase = true)) {
        fields = line.substringAfter(':').split(',').map { it.trim().lowercase() }
        continue
      }
      if (!line.startsWith("Dialogue:", ignoreCase = true)) continue
      val values = splitAssDialogue(line.substringAfter(':').trim(), fields.size)
      val startIndex = fields.indexOf("start")
      val endIndex = fields.indexOf("end")
      val textIndex = fields.indexOf("text")
      if (startIndex < 0 || endIndex < 0 || textIndex < 0 ||
        startIndex >= values.size || endIndex >= values.size || textIndex >= values.size
      ) continue
      appendCue(cues, clockMs(values[startIndex]), clockMs(values[endIndex]), values[textIndex])
      if (cues.size >= MAX_CUES) break
    }
    return cues
  }

  private fun splitAssDialogue(value: String, fieldCount: Int): List<String> {
    val fields = mutableListOf<String>()
    var rest = value
    for (index in 1 until fieldCount) {
      val separator = rest.indexOf(',')
      if (separator < 0) break
      fields += rest.substring(0, separator)
      rest = rest.substring(separator + 1)
    }
    fields += rest
    return fields
  }

  private fun clockMs(value: String): Long? {
    val parts = value.trim().replace(',', '.').split(':').toMutableList()
    if (parts.size !in 2..3) return null
    val seconds = parts.removeAt(parts.lastIndex).toDoubleOrNull() ?: return null
    val minutes = parts.removeAt(parts.lastIndex).toLongOrNull() ?: return null
    val hours = if (parts.isNotEmpty()) parts.removeAt(parts.lastIndex).toLongOrNull() ?: return null else 0L
    if (hours < 0L || minutes !in 0L..59L || seconds < 0.0 || seconds >= 60.0) return null
    val total = ((hours * 3_600L + minutes * 60L) * 1_000.0 + seconds * 1_000.0).toLong()
    return total.takeIf { it in 0L..MAX_TIMELINE_MS }
  }

  private fun cleanText(value: String): String = value
    .replace(Regex("""\{\\[^}]*\}"""), "")
    .replace(Regex("<[^>]*>"), "")
    .replace("\\N", "\n")
    .replace("\\n", "\n")
    .replace("&nbsp;", " ", ignoreCase = true)
    .replace("&amp;", "&", ignoreCase = true)
    .replace("&lt;", "<", ignoreCase = true)
    .replace("&gt;", ">", ignoreCase = true)
    .replace(Regex("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]"), "")
    .trim()
    .take(MAX_CUE_TEXT)

  private fun appendCue(cues: MutableList<OrionPlayerSubtitleCue>, start: Long?, end: Long?, text: String) {
    if (cues.size >= MAX_CUES || start == null || end == null || end <= start) return
    val clean = cleanText(text)
    if (clean.isNotEmpty()) cues += OrionPlayerSubtitleCue(start, end, clean)
  }
}
