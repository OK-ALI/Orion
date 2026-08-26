package com.okali.orion.playback

/** Pure commit decision used by the durable store to close Cancel/finalizer races. */
internal object OrionDownloadExecutionFence {
  fun canCommit(
    expectedGeneration: Long,
    currentGeneration: Long,
    state: String,
    control: String,
  ): Boolean = expectedGeneration == currentGeneration && state != "cancelled" && state != "completed" && control != "cancel"
}
