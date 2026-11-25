import { Image } from 'react-native';
import { wavenArtworkLeaseKey } from '../artwork/wavenArtworkLifecycle';

export type WavenEntityRevealKind = 'artist' | 'album' | 'single' | 'ep';
export type WavenEntityRevealKeyKind = 'artist' | 'album';
export type WavenReleaseRevealKind = Exclude<WavenEntityRevealKind, 'artist'>;
export type WavenEntityRevealRole = 'origin' | 'destination';

export interface WavenEntityRevealRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

export interface WavenEntityRevealArtworkSize {
  width: number;
  height: number;
}

export interface WavenEntityRevealTransition {
  token: number;
  entityKey: string;
  kind: WavenEntityRevealKind;
  artworkUrl: string;
  artworkWidth: number;
  artworkHeight: number;
  title: string;
  phase: 'enter' | 'exit';
  handoffReady: boolean;
  visualReady: boolean;
  navigationCommitted: boolean;
  destinationReady: boolean;
  destinationVisualReady: boolean;
  exitOriginReady: boolean;
  originHandoffReady: boolean;
  from: WavenEntityRevealRect;
  to: WavenEntityRevealRect | null;
}

type Listener = () => void;
type Capture = () => Promise<WavenEntityRevealRect | null>;

interface RegisteredAnchor {
  capture: Capture;
  fallback: WavenEntityRevealRect | null;
}

interface RevealHistory {
  kind: WavenEntityRevealKind;
  artworkUrl: string;
  artworkWidth: number;
  artworkHeight: number;
  title: string;
  origin: WavenEntityRevealRect;
}

interface PendingCommit {
  token: number;
  entityKey: string;
  committed: boolean;
  commit: () => void;
}

const listeners = new Set<Listener>();
const origins = new Map<string, RegisteredAnchor>();
const destinations = new Map<string, RegisteredAnchor>();
const histories = new Map<string, RevealHistory>();
const artworkSizeCache = new Map<string, WavenEntityRevealArtworkSize>();
let activeTransition: WavenEntityRevealTransition | null = null;
let pendingEnterCommit: PendingCommit | null = null;
let pendingExitCommit: PendingCommit | null = null;
let transitionToken = 0;
const ANCHOR_CAPTURE_TIMEOUT_MS = 180;
const DIRECT_LANDING_LOCK_MS = 2200;

function emit() {
  for (const listener of listeners) listener();
}

function registryFor(role: WavenEntityRevealRole) {
  return role === 'origin' ? origins : destinations;
}

async function captureRegistered(
  registry: Map<string, RegisteredAnchor>,
  key: string,
): Promise<WavenEntityRevealRect | null> {
  const anchor = registry.get(key);
  if (!anchor) return null;

  try {
    const measured = await Promise.race<WavenEntityRevealRect | null>([
      anchor.capture(),
      new Promise<WavenEntityRevealRect | null>((resolve) => {
        setTimeout(() => resolve(null), ANCHOR_CAPTURE_TIMEOUT_MS);
      }),
    ]);
    return measured || anchor.fallback;
  } catch {
    return anchor.fallback;
  }
}

function rectsMatch(
  left: WavenEntityRevealRect,
  right: WavenEntityRevealRect,
  tolerance = 0.75,
): boolean {
  return (
    Math.abs(left.x - right.x) <= tolerance &&
    Math.abs(left.y - right.y) <= tolerance &&
    Math.abs(left.width - right.width) <= tolerance &&
    Math.abs(left.height - right.height) <= tolerance &&
    Math.abs(left.borderRadius - right.borderRadius) <= tolerance
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function captureStableRegistered(
  registry: Map<string, RegisteredAnchor>,
  key: string,
  maxFrames = 10,
): Promise<WavenEntityRevealRect | null> {
  let previous: WavenEntityRevealRect | null = null;
  let latest: WavenEntityRevealRect | null = null;

  for (let frame = 0; frame < maxFrames; frame += 1) {
    const current = await captureRegistered(registry, key);
    if (current) {
      latest = current;
      if (previous && rectsMatch(previous, current)) return current;
      previous = current;
    }
    await nextFrame();
  }

  return latest;
}

function resolveArtworkSize(
  artworkUrl: string,
  fallback: WavenEntityRevealRect,
): Promise<WavenEntityRevealArtworkSize> {
  const cached = artworkSizeCache.get(artworkUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    let settled = false;
    const fallbackSize = {
      width: Math.max(1, fallback.width),
      height: Math.max(1, fallback.height),
    };

    const finish = (size: WavenEntityRevealArtworkSize) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const normalized = {
        width: Math.max(1, size.width),
        height: Math.max(1, size.height),
      };
      artworkSizeCache.set(artworkUrl, normalized);
      resolve(normalized);
    };

    const timer = setTimeout(() => finish(fallbackSize), 140);

    Image.getSize(
      artworkUrl,
      (width, height) => finish({ width, height }),
      () => finish(fallbackSize),
    );
  });
}

export function wavenReleaseRevealKind(primaryType: unknown): WavenReleaseRevealKind {
  const normalized = String(primaryType || '').trim().toLowerCase();
  if (normalized === 'single') return 'single';
  if (normalized === 'ep' || normalized === 'e.p.') return 'ep';
  return 'album';
}

export function wavenEntityRevealKey(
  kind: WavenEntityRevealKeyKind,
  provider: string,
  id: string,
): string {
  return wavenArtworkLeaseKey(kind, provider, id);
}

export function subscribeWavenEntityReveal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWavenEntityRevealTransition(): WavenEntityRevealTransition | null {
  return activeTransition;
}

export function registerWavenEntityRevealAnchor(
  role: WavenEntityRevealRole,
  entityKey: string,
  capture: Capture,
  fallback: WavenEntityRevealRect | null,
): () => void {
  const registry = registryFor(role);
  const record = { capture, fallback };
  registry.set(entityKey, record);

  if (role === 'destination') {
    void captureStableRegistered(destinations, entityKey).then((rect) => {
      if (!rect) return;
      if (
        activeTransition?.phase === 'enter' &&
        activeTransition.entityKey === entityKey
      ) {
        activeTransition = {
          ...activeTransition,
          destinationReady: true,
          to: rect,
        };
        emit();
      }
    });
  }

  return () => {
    if (registry.get(entityKey) === record) registry.delete(entityKey);
  };
}

export function updateWavenEntityRevealAnchorFallback(
  role: WavenEntityRevealRole,
  entityKey: string,
  rect: WavenEntityRevealRect,
) {
  const registry = registryFor(role);
  const current = registry.get(entityKey);
  if (!current) return;
  current.fallback = rect;
}

function releaseDirectEnterLock(token: number) {
  setTimeout(() => {
    if (
      pendingEnterCommit?.token === token &&
      pendingEnterCommit.committed &&
      activeTransition?.token !== token
    ) {
      pendingEnterCommit = null;
    }
  }, DIRECT_LANDING_LOCK_MS);
}

function fulfillEnterIntentWithoutReveal(token: number): boolean {
  const pending = pendingEnterCommit;
  if (!pending || pending.token !== token) return false;
  if (pending.committed) return true;
  pending.committed = true;
  pending.commit();
  releaseDirectEnterLock(token);
  return true;
}

export function acknowledgeWavenEntityRevealLanding(entityKey: string) {
  if (
    pendingEnterCommit?.entityKey === entityKey &&
    pendingEnterCommit.committed &&
    (!activeTransition || activeTransition.entityKey !== entityKey)
  ) {
    pendingEnterCommit = null;
  }
}

export function cancelWavenEntityRevealEnterForBack(entityKey: string): boolean {
  const transition = activeTransition;
  if (
    transition?.phase === 'enter' &&
    transition.entityKey === entityKey
  ) {
    activeTransition = null;
    if (pendingEnterCommit?.token === transition.token) pendingEnterCommit = null;
    histories.delete(entityKey);
    emit();
    return true;
  }

  if (
    pendingEnterCommit?.entityKey === entityKey &&
    pendingEnterCommit.committed
  ) {
    pendingEnterCommit = null;
    histories.delete(entityKey);
    emit();
    return true;
  }
  return false;
}

export async function beginWavenEntityReveal(
  input: {
    entityKey: string;
    kind: WavenEntityRevealKind;
    artworkUrl?: string | null;
    title: string;
  },
  commit?: () => void,
  options: { animate?: boolean } = {},
): Promise<boolean> {
  // User intent is claimed synchronously, before measurement, prefetch, image
  // sizing, or reveal preparation can yield. A rapid second tap therefore
  // coalesces into this transaction instead of opening a duplicate route.
  if (activeTransition || pendingEnterCommit) return true;
  if (!commit) return false;

  const token = ++transitionToken;
  pendingEnterCommit = {
    token,
    entityKey: input.entityKey,
    committed: false,
    commit,
  };

  const artworkUrl = input.artworkUrl?.trim() || '';
  if (options.animate === false || !artworkUrl) {
    fulfillEnterIntentWithoutReveal(token);
    return true;
  }

  const origin = await captureRegistered(origins, input.entityKey);
  if (pendingEnterCommit?.token !== token) return true;
  if (!origin || origin.width <= 1 || origin.height <= 1) {
    fulfillEnterIntentWithoutReveal(token);
    return true;
  }

  const artworkSize = await resolveArtworkSize(artworkUrl, origin);
  if (pendingEnterCommit?.token !== token) return true;

  histories.set(input.entityKey, {
    kind: input.kind,
    artworkUrl,
    artworkWidth: artworkSize.width,
    artworkHeight: artworkSize.height,
    title: input.title,
    origin,
  });

  activeTransition = {
    token,
    entityKey: input.entityKey,
    kind: input.kind,
    artworkUrl,
    artworkWidth: artworkSize.width,
    artworkHeight: artworkSize.height,
    title: input.title,
    phase: 'enter',
    handoffReady: false,
    visualReady: false,
    navigationCommitted: false,
    destinationReady: false,
    destinationVisualReady: false,
    exitOriginReady: false,
    originHandoffReady: false,
    from: origin,
    to: null,
  };
  emit();
  return true;
}

export function commitWavenEntityRevealEnter(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'enter' ||
    activeTransition.navigationCommitted
  ) {
    return;
  }

  if (
    pendingEnterCommit?.token !== token ||
    pendingEnterCommit.committed
  ) {
    activeTransition = { ...activeTransition, navigationCommitted: true };
    emit();
    return;
  }

  pendingEnterCommit.committed = true;
  activeTransition = { ...activeTransition, navigationCommitted: true };
  emit();
  pendingEnterCommit.commit();
}

export async function beginWavenEntityRevealExit(
  entityKey: string,
  commit?: () => void,
  artworkUrl?: string | null,
): Promise<boolean> {
  if (activeTransition) return false;
  const history = histories.get(entityKey);
  if (!history) return false;

  const destination = await captureRegistered(destinations, entityKey);
  if (!destination) return false;

  const refreshedOrigin = await captureRegistered(origins, entityKey);
  const origin = refreshedOrigin || history.origin;
  const exitArtworkUrl = artworkUrl?.trim() || history.artworkUrl;
  const artworkSize =
    exitArtworkUrl === history.artworkUrl
      ? { width: history.artworkWidth, height: history.artworkHeight }
      : await resolveArtworkSize(exitArtworkUrl, destination);

  const token = ++transitionToken;
  activeTransition = {
    token,
    entityKey,
    kind: history.kind,
    artworkUrl: exitArtworkUrl,
    artworkWidth: artworkSize.width,
    artworkHeight: artworkSize.height,
    title: history.title,
    phase: 'exit',
    handoffReady: false,
    visualReady: false,
    navigationCommitted: !commit,
    destinationReady: true,
    destinationVisualReady: true,
    exitOriginReady: false,
    originHandoffReady: false,
    from: destination,
    to: origin,
  };
  pendingExitCommit = commit
    ? {
        token,
        entityKey,
        committed: false,
        commit,
      }
    : null;
  emit();
  return true;
}

export async function refreshWavenEntityRevealExitOrigin(
  token: number,
): Promise<boolean> {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'exit' ||
    !activeTransition.navigationCommitted
  ) {
    return false;
  }

  const entityKey = activeTransition.entityKey;
  const refreshedOrigin = await captureStableRegistered(origins, entityKey, 12);

  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'exit'
  ) {
    return false;
  }

  const history = histories.get(entityKey);
  const origin = refreshedOrigin || history?.origin || activeTransition.to;
  if (!origin) return false;

  activeTransition = {
    ...activeTransition,
    exitOriginReady: true,
    to: origin,
  };
  emit();
  return true;
}

export function markWavenEntityRevealVisualReady(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.visualReady
  ) {
    return;
  }

  activeTransition = { ...activeTransition, visualReady: true };
  emit();
}

export function markWavenEntityRevealDestinationVisualReady(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'enter' ||
    activeTransition.destinationVisualReady
  ) {
    return;
  }

  activeTransition = { ...activeTransition, destinationVisualReady: true };
  emit();
}

export function markWavenEntityRevealOriginHandoffReady(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'exit' ||
    activeTransition.originHandoffReady
  ) {
    return;
  }

  activeTransition = { ...activeTransition, originHandoffReady: true };
  emit();
}

export function markWavenEntityRevealHandoffReady(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'enter' ||
    activeTransition.handoffReady
  ) {
    return;
  }

  activeTransition = { ...activeTransition, handoffReady: true };
  emit();
}

export function commitWavenEntityRevealExit(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'exit' ||
    activeTransition.navigationCommitted
  ) {
    return;
  }

  activeTransition = { ...activeTransition, navigationCommitted: true };
  emit();

  if (
    pendingExitCommit?.token !== token ||
    pendingExitCommit.committed
  ) {
    return;
  }

  pendingExitCommit.committed = true;
  pendingExitCommit.commit();
}

export function forceCompleteWavenEntityRevealEnter(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'enter'
  ) {
    return;
  }

  const pending =
    pendingEnterCommit?.token === token && !pendingEnterCommit.committed
      ? pendingEnterCommit
      : null;

  if (pending) pending.committed = true;
  activeTransition = null;
  emit();

  // Enter fallback releases visual ownership first, then fulfills the original
  // OPEN intent exactly once. Keep the committed intent locked until the
  // destination acknowledges landing (or the bounded direct lock expires), so
  // a rapid second tap cannot stack the same route during recovery.
  pending?.commit();
  if (pending) releaseDirectEnterLock(token);
}

export function forceCompleteWavenEntityRevealExit(token: number) {
  if (
    activeTransition?.token !== token ||
    activeTransition.phase !== 'exit'
  ) {
    return;
  }

  const finished = activeTransition;
  const pending =
    pendingExitCommit?.token === token && !pendingExitCommit.committed
      ? pendingExitCommit
      : null;

  if (pending) pending.committed = true;
  activeTransition = null;
  pendingExitCommit = null;
  histories.delete(finished.entityKey);
  emit();

  pending?.commit();
}

export function forceCompleteWavenEntityRevealTransaction(token: number) {
  if (activeTransition?.token !== token) return;
  if (activeTransition.phase === 'enter') {
    forceCompleteWavenEntityRevealEnter(token);
    return;
  }
  forceCompleteWavenEntityRevealExit(token);
}

export function completeWavenEntityReveal(token: number) {
  if (activeTransition?.token !== token) return;
  const finished = activeTransition;
  activeTransition = null;
  if (pendingEnterCommit?.token === token) pendingEnterCommit = null;
  if (pendingExitCommit?.token === token) pendingExitCommit = null;
  if (finished.phase === 'exit') histories.delete(finished.entityKey);
  emit();
}

export function clearWavenEntityReveal(entityKey?: string) {
  if (entityKey) {
    histories.delete(entityKey);
    origins.delete(entityKey);
    destinations.delete(entityKey);
    if (pendingEnterCommit?.entityKey === entityKey) pendingEnterCommit = null;
    if (pendingExitCommit?.entityKey === entityKey) pendingExitCommit = null;
    if (activeTransition?.entityKey === entityKey) {
      activeTransition = null;
    }
  } else {
    histories.clear();
    origins.clear();
    destinations.clear();
    activeTransition = null;
    pendingEnterCommit = null;
    pendingExitCommit = null;
  }
  emit();
}
