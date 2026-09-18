import { Image } from 'react-native';

export type WavenEntityRevealKind = 'artist' | 'album';
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
  navigationCommitted: boolean;
  destinationReady: boolean;
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
    return (await anchor.capture()) || anchor.fallback;
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

export function wavenEntityRevealKey(
  kind: WavenEntityRevealKind,
  provider: string,
  id: string,
): string {
  return `${kind}:${provider}:${id}`;
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

export async function beginWavenEntityReveal(
  input: {
    entityKey: string;
    kind: WavenEntityRevealKind;
    artworkUrl?: string | null;
    title: string;
  },
  commit?: () => void,
): Promise<boolean> {
  const artworkUrl = input.artworkUrl?.trim() || '';
  if (!artworkUrl || activeTransition) return false;

  const origin = await captureRegistered(origins, input.entityKey);
  if (!origin || origin.width <= 1 || origin.height <= 1) return false;

  const artworkSize = await resolveArtworkSize(artworkUrl, origin);

  histories.set(input.entityKey, {
    kind: input.kind,
    artworkUrl,
    artworkWidth: artworkSize.width,
    artworkHeight: artworkSize.height,
    title: input.title,
    origin,
  });

  const token = ++transitionToken;
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
    navigationCommitted: !commit,
    destinationReady: false,
    exitOriginReady: false,
    originHandoffReady: false,
    from: origin,
    to: null,
  };
  pendingEnterCommit = commit
    ? {
        token,
        committed: false,
        commit,
      }
    : null;
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
    navigationCommitted: !commit,
    destinationReady: true,
    exitOriginReady: false,
    originHandoffReady: false,
    from: destination,
    to: origin,
  };
  pendingExitCommit = commit
    ? {
        token,
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
    if (activeTransition?.entityKey === entityKey) {
      if (pendingEnterCommit?.token === activeTransition.token) pendingEnterCommit = null;
      if (pendingExitCommit?.token === activeTransition.token) pendingExitCommit = null;
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
