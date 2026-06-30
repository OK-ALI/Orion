# Player architecture

Movie and TV pages are thin feature entry points. Their controller hooks own orchestration while focused hooks own webview lifecycle, progress, failover, episode mapping, and download actions.

The main process owns player sessions, PiP/pop-out windows, and AllManga network resolution. The renderer owns presentation and user intent. Player teardown must navigate or destroy webviews before releasing renderer state so Chromium processes and streams do not survive navigation unexpectedly.

Playback is represented as one logical session across embedded, mini, pop-out, and local modes. Handoffs snapshot time, duration, pause, mute, volume, media identity, source, and episode context before changing ownership. The destination prepares silently, then the origin pauses and the prepared destination assumes ownership so only one mode owns audio.

Completed downloads are opened through opaque `orion-media://` grants. The main process validates the download record, streams ranges from the approved file, and exposes approved sidecar subtitles without providing a general filesystem server.

Dynamic ambient glow is sampled in the main process with `capturePage()`. Frames are resized for analysis and discarded; only two derived color values cross into React. Sampling pauses while inactive, hidden, or minimized; battery power uses a slower adaptive interval. Reduced Motion and the Off profile disable it entirely.
