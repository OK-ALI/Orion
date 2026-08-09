export const SMART_CONNECT_PROTOCOL_VERSION = 2 as const;

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
  | "cursor_click";

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
  type: "command" | "ack" | "status" | "heartbeat" | "error";
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
}

export interface SmartConnectPairingSession {
  deviceId: string;
  deviceName: string;
  token: string;
  createdAt: number;
  lastSeenAt: number;
}
