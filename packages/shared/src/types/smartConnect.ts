export const SMART_CONNECT_PROTOCOL_VERSION = 3 as const;

export type RemoteFocusedRole =
  | "none" | "button" | "link" | "text-input" | "search"
  | "media-control" | "protected-input";

export interface RemotePlaybackCapabilities {
  canPlayPause: boolean;
  canPlay: boolean;
  canPause: boolean;
  canSkipPrevious: boolean;
  canSkipNext: boolean;
  canSeek: boolean;
  canSetVolume: boolean;
  canSetSpeed: boolean;
  canToggleSubtitles: boolean;
  canToggleFullscreen: boolean;
  canTogglePip: boolean;
  canNavigate: boolean;
}

export type RemotePlaybackControlState =
  | "loading" | "ready" | "limited" | "unobservable" | "unavailable" | "failed";
export type RemotePlaybackControlStrategy =
  | "direct-video" | "provider-event" | "media-session" | "unavailable";

export interface RemotePlaybackControlTargetV1 {
  version: 1;
  sessionId: string;
  sourceId: string | null;
  sourceLabel: string;
  surface: RemoteUiContextV1["surface"];
  strategy: RemotePlaybackControlStrategy;
  readiness: RemotePlaybackControlState;
  capabilities: RemotePlaybackCapabilities;
  observedAt: number;
}

export interface SmartConnectPlaybackCommandResult {
  applied: boolean;
  appliedState?: "playing" | "paused" | "unchanged";
  sessionId: string | null;
  sourceId: string | null;
  readiness: RemotePlaybackControlState;
  failureCode?: string;
}

export interface AdaptivePointerPolicy {
  activeRateHz: 24 | 30 | 40;
  rttClass: "healthy" | "moderate" | "constrained";
  backpressure: "clear" | "elevated";
  coalescedUpdates: number;
  droppedUpdates: number;
}

export interface RemoteUiContextV1 {
  version: 1;
  route: string;
  surface: "browse" | "embedded-player" | "local-player" | "mini-player" | "popout" | "music" | "unknown";
  focusedRole: RemoteFocusedRole;
  canType: boolean;
  playbackOwner: "cinema" | "local-video" | "music" | "none";
  fullscreen: boolean;
  miniPlayer: boolean;
  popout: boolean;
  capabilities: RemotePlaybackCapabilities;
  controlTarget?: RemotePlaybackControlTargetV1;
  observedAt: number;
}

export interface SmartConnectPlaybackTelemetryV1 {
  version: 1;
  sessionId: string;
  sequence: number;
  title: string;
  mediaId: string | null;
  playbackKind: "cinema" | "local-video" | "music" | "none";
  sourceId: string | null;
  sourceLabel: string;
  surface: RemoteUiContextV1["surface"];
  controlState: RemotePlaybackControlState;
  controlStrategy: RemotePlaybackControlStrategy;
  currentTime: number | null;
  duration: number | null;
  bufferedTime: number | null;
  state: "playing" | "paused" | "buffering" | "ended" | "unobservable" | "idle";
  volume: number;
  muted: boolean;
  speed: number;
  canSeek: boolean;
  evidence: string;
  observedAt: number;
}

export interface SmartConnectTelemetryFreshness { ageMs: number; fresh: boolean }
export interface SmartConnectLatencySnapshot {
  latestRttMs: number | null;
  medianRttMs: number | null;
  p95RttMs: number | null;
  telemetryAgeMs: number | null;
  reconnectDurationMs: number | null;
}

export interface SmartConnectSecureIdentity {
  instanceId: string;
  certificateFingerprint: string;
  signingAlgorithm: "ECDSA_P256_SHA256";
  createdAt: number;
}
export interface SmartConnectVerificationPhrase { words: [string, string, string, string]; expiresAt: number }
export interface SmartConnectPairingTranscript {
  pairingId: string; desktopInstanceId: string; deviceId: string;
  certificateFingerprint: string; phrase: SmartConnectVerificationPhrase;
  desktopConfirmed: boolean; mobileConfirmed: boolean;
}
export interface SmartConnectSocketTicket { ticketId: string; deviceId: string; expiresAt: number }
export interface SmartConnectProtocolV3Envelope<T = unknown> {
  version: 3; type: "command" | "ack" | "context" | "telemetry" | "heartbeat" | "error";
  deviceId: string; connectionId: string; sequence: number; commandId?: string; payload: T;
}
export interface SmartConnectReplayWindow { lastSequence: number; rememberedCommandIds: string[]; updatedAt: number }
export interface SmartConnectNetworkPolicy {
  privateLanOnly: true; publicNetworkAllowedUntil: number | null; maxConnections: number;
  commandRatePerSecond: number;
}

export type SmartConnectDiscoveryMethod =
  | "saved"
  | "nsd"
  | "qr"
  | "direct-ip"
  | "subnet-fallback";

export type SmartConnectConnectionStateName =
  | "idle"
  | "discovering"
  | "pairing"
  | "connected"
  | "reconnecting"
  | "endpoint-lost"
  | "token-rejected"
  | "code-expired"
  | "locked-out"
  | "protocol-mismatch"
  | "failed";

export interface SmartConnectDiscoveryResult {
  instanceId: string;
  displayName: string;
  host: string;
  port: number;
  protocolVersion: number;
  method: SmartConnectDiscoveryMethod;
  certificateFingerprint: string;
}

export interface SmartConnectConnectionState {
  state: SmartConnectConnectionStateName;
  attempt: number;
  nextRetryAt?: number;
  reason?: string;
}

export type SmartConnectPairingErrorCode =
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "LOCKED_OUT"
  | "DESKTOP_UNAVAILABLE"
  | "PROTOCOL_MISMATCH"
  | "TOKEN_REJECTED"
  | "INVALID_REQUEST"
  | "UNKNOWN";

export interface SmartConnectPairingError {
  code: SmartConnectPairingErrorCode;
  message: string;
  retryAfterMs?: number;
  attemptsRemaining?: number;
}

export interface SmartConnectTrustedEndpoint {
  instanceId: string;
  host: string;
  port: number;
  lastVerifiedAt: number;
  method: SmartConnectDiscoveryMethod;
}

export interface SmartConnectDeviceSummary {
  deviceId: string;
  deviceName: string;
  createdAt: number;
  lastSeenAt: number;
  connected: boolean;
}

export interface SmartConnectDeviceUpdate {
  action: "rename" | "revoke";
  deviceId: string;
  deviceName?: string;
}

export type SmartConnectCommandAction =
  | "navigate_page"
  | "back"
  | "home"
  | "menu"
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "sidebar_next"
  | "sidebar_prev"
  | "focus_card_next"
  | "focus_card_prev"
  | "toggle_play"
  | "play_pause"
  | "play"
  | "pause"
  | "seek_to"
  | "seek_-10"
  | "seek_+10"
  | "previous"
  | "next"
  | "toggle_mute"
  | "volume_up"
  | "volume_down"
  | "set_speed"
  | "toggle_subtitles"
  | "toggle_fullscreen"
  | "toggle_pip"
  | "send_text"
  | "constellation_search"
  | "cursor_move"
  | "cursor_click"
  | "scroll"
  | "smart_connect_rename"
  | "smart_connect_unpair";

export interface SmartConnectPointerState {
  x: number;
  y: number;
}

export interface SmartConnectRemoteCommand {
  id: string;
  sequence: number;
  action: SmartConnectCommandAction;
  value?: unknown;
  pointer?: SmartConnectPointerState;
  sentAt: number;
}

export interface SmartConnectEnvelope<T = unknown> {
  version: typeof SMART_CONNECT_PROTOCOL_VERSION;
  type: "command" | "ack" | "status" | "context" | "telemetry" | "heartbeat" | "error";
  deviceId: string;
  payload: T;
}

export interface SmartConnectCommandAck {
  id: string;
  sequence: number;
  ok: boolean;
  appliedAt: number;
  error?: string;
  pointer?: SmartConnectPointerState;
  authoritativeTelemetry?: SmartConnectPlaybackTelemetryV1;
  commandResult?: SmartConnectPlaybackCommandResult;
}

export interface SmartConnectPairingSession {
  deviceId: string;
  deviceName: string;
  protocolVersion: 3;
  desktopInstanceId: string;
  certificateFingerprint: string;
  deviceKeyAlias: string;
  createdAt: number;
  lastSeenAt: number;
}
