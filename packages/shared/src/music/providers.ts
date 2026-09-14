/**
 * Shared provider descriptor contracts.
 *
 * The provider-kind boundary mirrors the locked Music Planet capability host.
 * Executable provider method interfaces are introduced separately so P3.1 does
 * not reopen Desktop provider or playback behavior.
 */

export const MUSIC_PROVIDER_KINDS = [
  "metadata",
  "streaming",
  "lyrics",
  "dashboard",
  "playlists",
  "discovery",
  "scrobbling",
] as const;

export const MUSIC_PROVIDER_HEALTH_STATUSES = [
  "unknown",
  "healthy",
  "slow",
  "rate_limited",
  "authentication_required",
  "unavailable",
] as const;

export type MusicProviderKind = (typeof MUSIC_PROVIDER_KINDS)[number];
export type MusicProviderHealthStatus = (typeof MUSIC_PROVIDER_HEALTH_STATUSES)[number];

/**
 * Capability names stay extensible because individual providers expose
 * provider-specific features such as synchronized lyrics, Top 50, or range.
 */
export type MusicProviderCapability = string;

export interface MusicProviderHealth {
  status: MusicProviderHealthStatus;
  latencyMs: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string;
  consecutiveFailures: number;
}

/** Serializable provider information safe for application/UI boundaries. */
export interface MusicProviderDescriptor {
  id: string;
  name: string;
  kind: MusicProviderKind;
  pluginId: string | null;
  capabilities: readonly MusicProviderCapability[];
  firstParty: boolean;
  requiresConfiguration: boolean;
  configured: boolean;
  pairedStreamingProviderId: string | null;
  health: MusicProviderHealth;
}
