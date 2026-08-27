package com.okali.orion.playback

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Locale

internal data class OrionYtDlpProgress(
  val percent: Double?,
  val bytesDownloaded: Long,
  val totalBytes: Long?,
  val bytesPerSecond: Long?,
  val etaSeconds: Long?,
)

/** Converts yt-dlp's stdout-only callback into Orion's truthful transfer contract. */
internal object OrionYtDlpProgressParser {
  const val TEMPLATE_PREFIX = "orion-progress:"
  const val PROGRESS_TEMPLATE =
    "download:${TEMPLATE_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress._percent_str)s"

  private val defaultProgress = Regex(
    """(?i)^\s*\[download]\s+(\d+(?:\.\d+)?)%\s+of\s+(?:~\s*)?(\d+(?:\.\d+)?)\s*([kmgtpe]?i?b)(?:\s+at\s+(\d+(?:\.\d+)?)\s*([kmgtpe]?i?b)/s)?(?:\s+ETA\s+([0-9:]+|unknown))?.*$""",
  )

  fun parse(rawLine: String?, callbackPercent: Float, callbackEtaSeconds: Long): OrionYtDlpProgress? {
    val line = rawLine?.trim().orEmpty()
    if (line.isEmpty()) return null
    return parseTemplate(line, callbackPercent, callbackEtaSeconds)
      ?: parseDefault(line, callbackPercent, callbackEtaSeconds)
  }

  private fun parseTemplate(line: String, callbackPercent: Float, callbackEtaSeconds: Long): OrionYtDlpProgress? {
    val marker = line.indexOf(TEMPLATE_PREFIX)
    if (marker < 0) return null
    val fields = line.substring(marker + TEMPLATE_PREFIX.length).split('|')
    if (fields.size != 6) return null
    val downloaded = nonNegativeLong(fields[0]) ?: 0L
    val total = nonNegativeLong(fields[1]) ?: nonNegativeLong(fields[2])
    val speed = nonNegativeLong(fields[3])
    val eta = nonNegativeLong(fields[4]) ?: callbackEtaSeconds.takeIf { it >= 0L }
    val percent = percent(fields[5]) ?: callbackPercent.takeIf { it.isFinite() && it >= 0f }?.toDouble()
    if (downloaded <= 0L && total == null && speed == null && percent == null) return null
    return OrionYtDlpProgress(
      percent = percent?.coerceIn(0.0, 100.0),
      bytesDownloaded = downloaded,
      totalBytes = total?.takeIf { it > 0L },
      bytesPerSecond = speed?.takeIf { it > 0L },
      etaSeconds = eta,
    )
  }

  private fun parseDefault(line: String, callbackPercent: Float, callbackEtaSeconds: Long): OrionYtDlpProgress? {
    val match = defaultProgress.matchEntire(line) ?: return null
    val parsedPercent = percent(match.groupValues[1])
      ?: callbackPercent.takeIf { it.isFinite() && it >= 0f }?.toDouble()
      ?: return null
    val total = byteCount(match.groupValues[2], match.groupValues[3]) ?: return null
    val downloaded = try {
      BigDecimal.valueOf(total)
        .multiply(BigDecimal.valueOf(parsedPercent))
        .divide(BigDecimal.valueOf(100L), 0, RoundingMode.HALF_UP)
        .longValueExact()
        .coerceIn(0L, total)
    } catch (_: Throwable) {
      0L
    }
    val speed = if (match.groupValues[4].isBlank()) null
      else byteCount(match.groupValues[4], match.groupValues[5])?.takeIf { it > 0L }
    val eta = durationSeconds(match.groupValues[6])
      ?: callbackEtaSeconds.takeIf { it >= 0L }
    return OrionYtDlpProgress(
      percent = parsedPercent.coerceIn(0.0, 100.0),
      bytesDownloaded = downloaded,
      totalBytes = total.takeIf { it > 0L },
      bytesPerSecond = speed,
      etaSeconds = eta,
    )
  }

  private fun nonNegativeLong(raw: String): Long? {
    val clean = raw.trim()
    if (clean.isEmpty() || clean.equals("NA", true) || clean.equals("none", true)) return null
    return clean.toBigDecimalOrNull()
      ?.takeIf { it.signum() >= 0 }
      ?.setScale(0, RoundingMode.HALF_UP)
      ?.runCatching { longValueExact() }
      ?.getOrNull()
  }

  private fun percent(raw: String): Double? = raw
    .trim()
    .removeSuffix("%")
    .trim()
    .toDoubleOrNull()
    ?.takeIf { it.isFinite() && it in 0.0..100.0 }

  private fun byteCount(rawValue: String, rawUnit: String): Long? {
    val value = rawValue.trim().toBigDecimalOrNull()?.takeIf { it.signum() >= 0 } ?: return null
    val unit = rawUnit.trim().lowercase(Locale.US)
    val binary = unit.endsWith("ib")
    val exponent = when (unit.firstOrNull()) {
      'k' -> 1
      'm' -> 2
      'g' -> 3
      't' -> 4
      'p' -> 5
      'e' -> 6
      'b' -> 0
      else -> return null
    }
    return try {
      val multiplier = BigDecimal.valueOf(if (binary) 1024L else 1000L).pow(exponent)
      value.multiply(multiplier).setScale(0, RoundingMode.HALF_UP).longValueExact()
    } catch (_: Throwable) {
      null
    }
  }

  private fun durationSeconds(raw: String): Long? {
    val clean = raw.trim()
    if (clean.isEmpty() || clean.equals("unknown", true) || clean.equals("NA", true)) return null
    val parts = clean.split(':')
    if (parts.isEmpty() || parts.size > 3 || parts.any { it.toLongOrNull() == null }) return null
    return try {
      parts.fold(0L) { total, part -> Math.addExact(Math.multiplyExact(total, 60L), part.toLong()) }
    } catch (_: Throwable) {
      null
    }
  }
}
