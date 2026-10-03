package com.okali.orion.playback

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

/** Release-visible, bounded public catalog diagnostics. No playback authority. */
class OrionAnimeIdentityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "OrionAnimeIdentity"
  private val sequences = linkedMapOf<Long, Long>()
  private var highestAttempt = 0L

  @ReactMethod
  @Synchronized
  fun logEvent(payload: String) {
    if (payload.length > 4096) return
    try {
      val input = JSONObject(payload)
      val stage = input.optString("stage")
      val attempt = number(input, "attempt") ?: return
      val sequence = number(input, "sequence") ?: return
      if (stage !in STAGES || attempt < 1 || sequence !in 1L..64L || attempt < highestAttempt - 7) return
      if (sequence <= (sequences[attempt] ?: 0)) return
      if (stage == "decision" && (input.optString("reason") !in REASONS || input.optString("outcome") !in OUTCOMES)) return
      val safe = JSONObject().put("stage", stage).put("attempt", attempt).put("sequence", sequence)
      for (key in NUMBERS) number(input, key)?.let { safe.put(key, it) }
      for (key in FLAGS) (input.opt(key) as? Boolean)?.let { safe.put(key, it) }
      val tmdbId = input.optString("tmdbId")
      if (tmdbId.matches(Regex("\\d{1,16}"))) safe.put("tmdbId", tmdbId)
      enumField(input, safe, "mediaType", setOf("movie", "tv"))
      enumField(input, safe, "variant", setOf("sub", "dub"))
      enumField(input, safe, "outcome", OUTCOMES)
      enumField(input, safe, "reason", REASONS)
      enumField(input, safe, "scope", setOf("search", "relation", "base", "season"))
      enumField(input, safe, "format", setOf("TV", "TV_SHORT", "ONA", "MOVIE", "OVA", "SPECIAL", "MUSIC", "UNKNOWN"))
      val query = input.optString("query")
      if (query.matches(Regex("[\\p{L}\\p{N} ]{1,100}"))) safe.put("query", query)
      highestAttempt = maxOf(highestAttempt, attempt)
      sequences[attempt] = sequence
      while (sequences.size > 8) sequences.remove(sequences.keys.first())
      Log.i("OrionAnimeIdentity", safe.toString())
    } catch (_: Exception) {
      // Never log raw input/exception text or interrupt catalog resolution.
    }
  }

  private fun number(input: JSONObject, key: String): Long? {
    val value = input.opt(key) as? Number ?: return null
    val double = value.toDouble()
    if (!double.isFinite() || double < 0 || double > 1_000_000_000 || double != value.toLong().toDouble()) return null
    return value.toLong()
  }

  private fun enumField(input: JSONObject, safe: JSONObject, key: String, allowed: Set<String>) {
    val value = input.optString(key)
    if (value in allowed) safe.put(key, value)
  }

  companion object {
    private val STAGES = setOf("request", "catalog", "lookup", "candidate", "decision")
    private val OUTCOMES = setOf("accepted", "rejected")
    private val NUMBERS = setOf("season", "episode", "year", "seasonYear", "episodes", "anilistId", "candidates", "responseCharacters", "depth")
    private val FLAGS = setOf("cached", "titleMatch", "yearMatch", "formatMatch", "countMatch", "dateMatch", "episodeInRange")
    private val REASONS = setOf(
      "verified", "invalid-tmdb-id", "missing-metadata", "metadata-id-mismatch", "non-anime",
      "unsupported-media", "missing-season", "missing-episode",
      "tmdb-season-lookup-failed", "season-number-mismatch", "missing-episode-list",
      "episode-not-released", "noncontiguous-episodes", "missing-titles", "invalid-catalog-year",
      "invalid-season-year", "missing-episode-count", "unsupported-numbering", "episode-out-of-range",
      "no-candidates", "candidate-title-mismatch", "candidate-year-mismatch", "candidate-format-mismatch",
      "ambiguous-base-candidates", "candidate-season-year-mismatch", "candidate-episode-count-mismatch",
      "sequel-relation-unresolved", "season-entry-unresolved", "ambiguous-candidates", "lookup-missing-title",
      "lookup-network-failed", "lookup-http-rejected", "lookup-graphql-failed", "lookup-malformed-response",
      "lookup-response-too-large", "lookup-incomplete-search", "lookup-cancelled", "lookup-timeout",
      "lookup-relation-limit", "lookup-relation-incomplete", "selection-failed",
    )
  }
}
