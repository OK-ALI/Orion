import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from "react-native";
import type {
  NativePlaybackQueueItem,
  PlaybackRecoveryState,
  PlaybackSnapshot,
  ResolvedPlaybackSource,
} from "../contracts";

type NativePlaybackBridge = {
  replaceQueue(
    items: NativePlaybackQueueItem[],
    startIndex: number,
    startPositionMs: number,
    playWhenReady: boolean,
  ): Promise<PlaybackSnapshot>;
  resolveQueueItem(
    queueId: string,
    source: ResolvedPlaybackSource,
  ): Promise<PlaybackSnapshot>;
  play(): Promise<PlaybackSnapshot>;
  pause(): Promise<PlaybackSnapshot>;
  next(): Promise<PlaybackSnapshot>;
  previous(): Promise<PlaybackSnapshot>;
  seekTo(positionMs: number): Promise<PlaybackSnapshot>;
  setRepeatMode(mode: "off" | "one" | "all"): Promise<PlaybackSnapshot>;
  setShuffleEnabled(enabled: boolean): Promise<PlaybackSnapshot>;
  getSnapshot(): Promise<PlaybackSnapshot>;
  getRecoveryStateJson(): Promise<string | null>;
  stop(): Promise<PlaybackSnapshot>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

function requireAndroidBridge(): NativePlaybackBridge {
  if (Platform.OS !== "android") {
    throw new Error("WAVEN Phase 4 native playback is Android-only.");
  }
  const bridge = NativeModules.WavenPlayback as NativePlaybackBridge | undefined;
  if (!bridge) {
    throw new Error(
      "WavenPlayback native module is unavailable. Use a WAVEN development build; Expo Go is not sufficient.",
    );
  }
  return bridge;
}

export const WAVEN_PLAYBACK_EVENT = "WavenPlaybackState";

export async function replaceNativeQueue(
  items: readonly NativePlaybackQueueItem[],
  options?: {
    startIndex?: number;
    startPositionMs?: number;
    playWhenReady?: boolean;
  },
): Promise<PlaybackSnapshot> {
  return requireAndroidBridge().replaceQueue(
    [...items],
    options?.startIndex ?? 0,
    options?.startPositionMs ?? 0,
    options?.playWhenReady ?? false,
  );
}

export async function resolveNativeQueueItem(
  queueId: string,
  source: ResolvedPlaybackSource,
): Promise<PlaybackSnapshot> {
  return requireAndroidBridge().resolveQueueItem(queueId, source);
}

export async function getPersistedPlaybackRecoveryState(): Promise<PlaybackRecoveryState | null> {
  const raw = await requireAndroidBridge().getRecoveryStateJson();
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Partial<PlaybackRecoveryState>;
  if (
    parsed.version !== 1 ||
    !Array.isArray(parsed.queue) ||
    typeof parsed.currentIndex !== "number" ||
    typeof parsed.positionMs !== "number" ||
    typeof parsed.savedAtMs !== "number"
  ) {
    throw new Error("WAVEN playback recovery state is invalid.");
  }

  return parsed as PlaybackRecoveryState;
}

export const nativePlayback = {
  play: () => requireAndroidBridge().play(),
  pause: () => requireAndroidBridge().pause(),
  next: () => requireAndroidBridge().next(),
  previous: () => requireAndroidBridge().previous(),
  seekTo: (positionMs: number) => requireAndroidBridge().seekTo(positionMs),
  setRepeatMode: (mode: "off" | "one" | "all") =>
    requireAndroidBridge().setRepeatMode(mode),
  setShuffleEnabled: (enabled: boolean) =>
    requireAndroidBridge().setShuffleEnabled(enabled),
  getSnapshot: () => requireAndroidBridge().getSnapshot(),
  stop: () => requireAndroidBridge().stop(),
};

export function subscribeNativePlayback(
  listener: (snapshot: PlaybackSnapshot) => void,
): EmitterSubscription {
  const activeBridge = requireAndroidBridge();
  return new NativeEventEmitter(activeBridge as never).addListener(
    WAVEN_PLAYBACK_EVENT,
    listener,
  );
}
