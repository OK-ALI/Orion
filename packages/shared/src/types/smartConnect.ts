export const SMART_CONNECT_PROTOCOL_VERSION = 2 as const;

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
