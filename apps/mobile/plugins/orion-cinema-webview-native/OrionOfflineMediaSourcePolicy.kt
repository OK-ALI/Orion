package com.okali.orion.playback

/** Pure role/order validation for legacy P10.4 Orion Library fragment bundles. */
internal object OrionOfflineMediaSourcePolicy {
  const val MAX_FRAGMENTS = 20_000
  const val ADJUST_SEPARATE_AV_PERIOD_TIME_OFFSETS = true
  const val CLIP_SEPARATE_AV_DURATIONS = true

  data class IndexedFragment(
    val index: Int,
    val name: String,
    val role: String,
    val sizeBytes: Long,
  )

  data class Plan(
    val sourceKind: String,
    val videoParts: List<IndexedFragment>,
    val audioParts: List<IndexedFragment>,
    val videoMediaCount: Int,
    val audioMediaCount: Int,
  )

  fun build(sourceKind: String, fragments: List<IndexedFragment>): Plan? {
    if (sourceKind !in setOf("hls", "dash") || fragments.size !in 1..MAX_FRAGMENTS) return null
    if (fragments.map { it.index } != fragments.indices.toList()) return null
    if (fragments.any {
        it.name != "f${it.index.toString().padStart(6, '0')}.bin" ||
          it.sizeBytes <= 0L ||
          it.role !in setOf("video", "video-init", "audio", "audio-init")
      }) return null

    val video = validateRole(fragments, "video") ?: return null
    val audio = validateRole(fragments, "audio") ?: return null
    if (video.second <= 0 || (audio.first.isNotEmpty() && audio.second <= 0)) return null
    return Plan(
      sourceKind = sourceKind,
      videoParts = video.first,
      audioParts = audio.first,
      videoMediaCount = video.second,
      audioMediaCount = audio.second,
    )
  }

  private fun validateRole(
    fragments: List<IndexedFragment>,
    role: String,
  ): Pair<List<IndexedFragment>, Int>? {
    val parts = fragments.filter { it.role == role || it.role == "$role-init" }
    var pendingInitialization = false
    var mediaCount = 0
    for (part in parts) {
      if (part.role == "$role-init") {
        if (pendingInitialization) return null
        pendingInitialization = true
      } else {
        pendingInitialization = false
        mediaCount += 1
      }
    }
    if (pendingInitialization) return null
    return parts to mediaCount
  }
}
