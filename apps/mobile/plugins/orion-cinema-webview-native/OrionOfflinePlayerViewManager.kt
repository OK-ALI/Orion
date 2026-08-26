package com.okali.orion.playback

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

internal class OrionOfflinePlayerViewManager : SimpleViewManager<OrionOfflinePlayerView>() {
  override fun getName(): String = "OrionOfflinePlayerView"

  override fun createViewInstance(reactContext: ThemedReactContext): OrionOfflinePlayerView =
    OrionOfflinePlayerView(reactContext)

  @ReactProp(name = "assetId")
  fun setAssetId(view: OrionOfflinePlayerView, assetId: String?) = view.setAssetId(assetId)

  @ReactProp(name = "initialPositionSeconds", defaultDouble = 0.0)
  fun setInitialPositionSeconds(view: OrionOfflinePlayerView, seconds: Double) = view.setInitialPositionSeconds(seconds)

  @ReactProp(name = "presentation")
  fun setPresentation(view: OrionOfflinePlayerView, presentation: String?) = view.setPresentation(presentation)

  override fun getCommandsMap(): Map<String, Int> = mapOf(
    "play" to COMMAND_PLAY,
    "pause" to COMMAND_PAUSE,
    "seek" to COMMAND_SEEK,
    "retry" to COMMAND_RETRY,
    "selectSubtitle" to COMMAND_SELECT_SUBTITLE,
  )

  override fun receiveCommand(view: OrionOfflinePlayerView, commandId: Int, args: ReadableArray?) {
    when (commandId) {
      COMMAND_PLAY -> view.play()
      COMMAND_PAUSE -> view.pause()
      COMMAND_SEEK -> view.seekTo(args?.getDouble(0) ?: 0.0)
      COMMAND_RETRY -> view.retry()
      COMMAND_SELECT_SUBTITLE -> view.selectSubtitle(args?.takeIf { it.size() > 0 && !it.isNull(0) }?.getString(0))
    }
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> = MapBuilder.of(
    "topOrionOfflinePlaybackState", MapBuilder.of("registrationName", "onPlaybackStateChange"),
    "topOrionOfflineSubtitleTracks", MapBuilder.of("registrationName", "onSubtitleTracksChange"),
  )

  override fun onDropViewInstance(view: OrionOfflinePlayerView) {
    view.release()
    super.onDropViewInstance(view)
  }

  companion object {
    private const val COMMAND_PLAY = 1
    private const val COMMAND_PAUSE = 2
    private const val COMMAND_SEEK = 3
    private const val COMMAND_RETRY = 4
    private const val COMMAND_SELECT_SUBTITLE = 5
  }
}
