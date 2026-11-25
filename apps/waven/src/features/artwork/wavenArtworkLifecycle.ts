export type WavenArtworkEntityKind = 'track' | 'artist' | 'album' | 'playlist';

interface WavenArtworkSourceState {
  rendered: boolean;
  consecutiveFailures: number;
}

interface WavenArtworkLeaseState {
  sources: Map<string, WavenArtworkSourceState>;
  lastRenderedSourceKey: string | null;
}

const SESSION_ARTWORK_LEASE_LIMIT = 2048;
const artworkLeases = new Map<string, WavenArtworkLeaseState>();

export function wavenArtworkLeaseKey(
  kind: WavenArtworkEntityKind,
  provider: string,
  id: string,
): string {
  return `${kind}:${provider}:${id}`;
}

function readOrCreateLease(leaseKey: string): WavenArtworkLeaseState {
  const existing = artworkLeases.get(leaseKey);
  if (existing) {
    artworkLeases.delete(leaseKey);
    artworkLeases.set(leaseKey, existing);
    return existing;
  }

  const created: WavenArtworkLeaseState = {
    sources: new Map(),
    lastRenderedSourceKey: null,
  };
  artworkLeases.set(leaseKey, created);
  while (artworkLeases.size > SESSION_ARTWORK_LEASE_LIMIT) {
    const oldest = artworkLeases.keys().next().value;
    if (!oldest) break;
    artworkLeases.delete(oldest);
  }
  return created;
}

function readOrCreateSource(
  leaseKey: string,
  sourceKey: string,
): WavenArtworkSourceState {
  const lease = readOrCreateLease(leaseKey);
  const existing = lease.sources.get(sourceKey);
  if (existing) return existing;
  const created: WavenArtworkSourceState = {
    rendered: false,
    consecutiveFailures: 0,
  };
  lease.sources.set(sourceKey, created);
  return created;
}

export function hasWavenArtworkRendered(
  leaseKey: string,
  sourceKey: string | null | undefined,
): boolean {
  if (!sourceKey) return false;
  return artworkLeases.get(leaseKey)?.sources.get(sourceKey)?.rendered === true;
}

export function markWavenArtworkRendered(
  leaseKey: string,
  sourceKey: string | null | undefined,
): void {
  if (!sourceKey) return;
  const lease = readOrCreateLease(leaseKey);
  const source = readOrCreateSource(leaseKey, sourceKey);
  source.rendered = true;
  source.consecutiveFailures = 0;
  lease.lastRenderedSourceKey = sourceKey;
}


export function readWavenArtworkBackupSource(
  leaseKey: string,
  sourceKey: string | null | undefined,
): string | null {
  const backup = artworkLeases.get(leaseKey)?.lastRenderedSourceKey || null;
  if (!backup || backup === sourceKey) return null;
  return backup;
}

export function reportWavenArtworkRenderFailure(
  leaseKey: string,
  sourceKey: string | null | undefined,
): { hadRendered: boolean; shouldRetry: boolean } {
  if (!sourceKey) return { hadRendered: false, shouldRetry: false };
  const source = readOrCreateSource(leaseKey, sourceKey);
  const hadRendered = source.rendered;
  source.consecutiveFailures += 1;
  return {
    hadRendered,
    // One immediate remount is enough to recover transient Android decode/cache
    // failures without creating an unbounded renderer loop. A render failure is
    // deliberately NOT canonical evidence that the artwork disappeared.
    shouldRetry: source.consecutiveFailures === 1,
  };
}

export function clearWavenArtworkLifecycleSessionForTests(): void {
  artworkLeases.clear();
}
