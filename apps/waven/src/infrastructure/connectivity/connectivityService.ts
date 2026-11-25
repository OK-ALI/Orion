import { traceP8, traceProviderName, traceTransport } from './phase8ValidationTrace';

export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'RECOVERING' | 'DEGRADED';
export type RecoveryStage = 'paused' | 'internet' | 'providers' | 'cloud' | 'pending' | 'metadata' | 'ready';
export interface TransportObservation { connected: boolean | null; internetReachable: boolean | null; type: string }
export interface ProviderAvailability { available: boolean; failures: number; retryAt: number }
export interface ConnectivitySnapshot {
  state: ConnectivityState; stage: RecoveryStage; active: boolean; transport: string;
  remoteReady: boolean; recoveryEpoch: number; checkedAt: number;
  internetReady: boolean;
  providers: Readonly<Record<string, ProviderAvailability>>;
}
export interface ConnectivityDrivers {
  internet: (signal: AbortSignal) => Promise<boolean>;
  providers: (signal: AbortSignal) => Promise<Record<string, boolean>>;
}
export class ConnectivityUnavailableError extends Error {
  readonly code = 'WAVEN_NETWORK_UNAVAILABLE';
  constructor(public readonly state: ConnectivityState, provider?: string) {
    super(state === 'OFFLINE' ? 'You are offline. Your saved music is still available.'
      : state === 'RECOVERING' ? 'Reconnecting. Your saved music is still available.'
        : `${provider === 'orion-cloud' ? 'Orion Cloud' : 'This music service'} is temporarily unavailable. Try again shortly.`);
  }
}

/** The sole connectivity owner. It never owns navigation, local mutations or native audio. */
export class ConnectivityService {
  private snapshot: ConnectivitySnapshot = { state: 'RECOVERING', stage: 'internet', active: true, transport: 'unknown', remoteReady: false, internetReady: false, recoveryEpoch: 0, checkedAt: 0, providers: {} };
  private observation: TransportObservation = { connected: null, internetReachable: null, type: 'unknown' };
  private listeners = new Set<() => void>();
  private recoveryJobs = new Map<string, { stage: 'cloud' | 'pending' | 'metadata'; run: (signal: AbortSignal) => Promise<void>; hasPending?: () => boolean }>();
  private incompleteJobs = new Set<string>();
  private drivers: ConnectivityDrivers | null = null;
  private generation = 0;
  private epochController = new AbortController();
  private recoveryController: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private remoteTail: Promise<void> = Promise.resolve();
  private failures = 0;
  // An unfinished recovery job can coexist with healthy provider health.
  private recoveryIncomplete = false;
  private lastAttemptAt = -Infinity;
  private started = false;
  constructor(private now = Date.now, private debounceMs = 600) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ConnectivitySnapshot>) {
    const previous = this.snapshot;
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    if (previous.state !== this.snapshot.state || previous.stage !== this.snapshot.stage) {
      traceP8('connectivity', `${this.snapshot.state}:${this.snapshot.stage}`, 0, this.snapshot.recoveryEpoch);
    }
    if (previous.transport !== this.snapshot.transport) {
      traceP8('connectivity', `transport:${traceTransport(this.snapshot.transport)}`);
    }
    this.listeners.forEach(listener => listener());
  }
  start(drivers: ConnectivityDrivers) {
    if (this.started) return;
    this.started = true; this.drivers = drivers;
    // A retained ONLINE snapshot belongs to the old lifecycle, not this one.
    // Do not admit new remote work until this lifecycle has validated transport.
    const unavailable = this.observation.connected === false || this.observation.internetReachable === false;
    this.recoveryIncomplete = false;
    this.incompleteJobs.clear();
    this.publish({ state: unavailable ? 'OFFLINE' : 'RECOVERING', remoteReady: false, internetReady: false,
      stage: this.snapshot.active ? 'internet' : 'paused' });
    this.schedule(this.debounceMs);
  }
  stop() {
    this.started = false; this.invalidate(); this.drivers = null;
    const unavailable = this.observation.connected === false || this.observation.internetReachable === false;
    this.publish({ state: unavailable ? 'OFFLINE' : 'RECOVERING', remoteReady: false, internetReady: false, stage: 'paused' });
  }
  cancelAccountWork() {
    this.invalidate();
    this.publish({ remoteReady: false, internetReady: false, ...(this.snapshot.state === 'OFFLINE' ? {} : { state: 'RECOVERING' as const }), stage: this.snapshot.active ? 'internet' : 'paused' });
    this.schedule(this.debounceMs);
  }
  registerRecovery(key: string, stage: 'cloud' | 'pending' | 'metadata', run: (signal: AbortSignal) => Promise<void>, hasPending?: () => boolean) {
    this.recoveryJobs.set(key, { stage, run, hasPending }); return () => { this.recoveryJobs.delete(key); this.incompleteJobs.delete(key); };
  }
  /** A completed read can settle durable intent between coordinator passes.
   * Only a job's own predicate can prove this; provider/cache success alone cannot. */
  reportRecoveryProgress() {
    if (!this.started || !this.snapshot.active) return;
    let changed = false;
    for (const key of this.incompleteJobs) {
      const job = this.recoveryJobs.get(key);
      try { if (job?.hasPending && !job.hasPending()) { this.incompleteJobs.delete(key); changed = true; } }
      catch { /* An unreadable predicate cannot establish recovery. */ }
    }
    if (!changed) return;
    this.recoveryIncomplete = this.incompleteJobs.size > 0;
    if (!this.snapshot.remoteReady) return;
    const degraded = this.recoveryIncomplete || Object.values(this.snapshot.providers).some(p => !p.available);
    if (!degraded) { this.failures = 0; if (this.timer) clearTimeout(this.timer); this.timer = null; }
    this.publish({ state: degraded ? 'DEGRADED' : 'ONLINE' });
  }
  private invalidate() {
    this.generation++; this.epochController.abort(); this.epochController = new AbortController();
    this.recoveryController?.abort(); if (this.timer) clearTimeout(this.timer); this.timer = null;
  }
  observe(observation: TransportObservation) {
    const changed = observation.connected !== this.observation.connected || observation.internetReachable !== this.observation.internetReachable || observation.type !== this.observation.type;
    this.observation = observation;
    if (!changed) return;
    this.invalidate();
    if (observation.connected === false || observation.internetReachable === false) {
      this.publish({ state: 'OFFLINE', stage: this.snapshot.active ? 'internet' : 'paused', remoteReady: false, internetReady: false, transport: observation.type }); return;
    }
    this.publish({ state: 'RECOVERING', stage: this.snapshot.active ? 'internet' : 'paused', remoteReady: false, internetReady: false, transport: observation.type });
    this.failures = 0; this.schedule(this.debounceMs);
  }
  setActive(active: boolean) {
    if (active === this.snapshot.active) return;
    this.invalidate();
    // Returning from background must not fabricate connectivity while NetInfo still
    // reports an unusable transport. A fresh observation owns any later transition.
    const unavailable = this.observation.connected === false || this.observation.internetReachable === false;
    this.publish({ active, stage: active ? 'internet' : 'paused', remoteReady: false, internetReady: false,
      ...(active ? { state: unavailable ? 'OFFLINE' as const : 'RECOVERING' as const } : {}) });
    if (active && !unavailable) this.schedule(this.debounceMs);
  }
  private schedule(delay: number) {
    if (!this.started || !this.snapshot.active || this.observation.connected === false || this.observation.internetReachable === false) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.revalidate(); }, delay);
  }
  async revalidate(): Promise<void> {
    if (!this.started || !this.drivers || !this.snapshot.active || this.observation.connected === false || this.observation.internetReachable === false) return;
    if (this.running) return this.running;
    const wait = Math.max(0, 2000 - (this.now() - this.lastAttemptAt));
    if (wait) { this.schedule(wait); return; }
    const generation = this.generation, controller = new AbortController(); this.recoveryController = controller;
    const valid = () => !controller.signal.aborted && generation === this.generation && this.snapshot.active && this.started;
    this.lastAttemptAt = this.now(); this.publish({ state: 'RECOVERING', stage: 'internet', remoteReady: false });
    this.running = (async () => {
      const independentInternet = await this.drivers!.internet(controller.signal).catch(() => false);
      if (!valid()) return;
      // An endpoint outage must not negate Android's validated internet evidence.
      if (!independentInternet && this.observation.internetReachable !== true) {
        this.epochController.abort(); this.epochController = new AbortController();
        this.publish({ state: 'OFFLINE', remoteReady: false, internetReady: false, checkedAt: this.now() }); this.failures++; return;
      }
      this.publish({ stage: 'providers', internetReady: true });
      const checked = await this.drivers!.providers(controller.signal).catch(() => ({ 'ytmusic-metadata': false }));
      if (!valid()) return;
      const providers = { ...this.snapshot.providers };
      for (const [id, available] of Object.entries(checked)) {
        const failures = available ? 0 : (providers[id]?.failures ?? 0) + 1;
        providers[id] = { available, failures, retryAt: available ? 0 : this.now() + Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)) };
      }
      this.publish({ providers: Object.freeze(providers) });
      for (const [id, health] of Object.entries(providers)) {
        traceP8('provider', `${traceProviderName(id)}:${health.available ? 'up' : 'down'}`, 0, health.failures);
      }
      // A recovery job can fail even when internet and provider probes pass.
      // Keep the other stages ordered, but do not publish a falsely healthy epoch
      // or abandon durable intent until another unrelated network event.
      for (const stage of ['cloud', 'pending', 'metadata'] as const) {
        this.publish({ stage });
        for (const [key, job] of this.recoveryJobs) {
          if (job.stage !== stage || !valid()) continue;
          try { await job.run(controller.signal); if (valid()) this.incompleteJobs.delete(key); }
          catch { if (valid()) this.incompleteJobs.add(key); }
        }
        if (!valid()) return;
      }
      const recoveryIncomplete = this.incompleteJobs.size > 0;
      this.recoveryIncomplete = recoveryIncomplete;
      traceP8('recovery', recoveryIncomplete ? 'incomplete' : 'complete', 0, this.recoveryJobs.size);
      const degraded = recoveryIncomplete || Object.values(this.snapshot.providers).some(provider => !provider.available);
      this.failures = degraded ? this.failures + 1 : 0;
      this.publish({ state: degraded ? 'DEGRADED' : 'ONLINE', stage: 'ready', remoteReady: true, recoveryEpoch: this.snapshot.recoveryEpoch + 1, checkedAt: this.now() });
    })().finally(() => {
      this.running = null; this.recoveryController = null;
      if (valid() && (this.failures || this.snapshot.state === 'OFFLINE')) this.schedule(Math.min(60_000, 2000 * 2 ** Math.min(this.failures, 5)));
      // If transport flapped during the previous run, ensure its replacement is not lost.
      else if (this.started && this.snapshot.active && generation !== this.generation) this.schedule(this.debounceMs);
    });
    return this.running;
  }
  canRequest(provider?: string): boolean {
    // Isolated pure-runtime contract tests have no native lifecycle. Production starts this service at the root.
    if (!this.started) return true;
    const ready = this.snapshot.active && (provider === 'ytmusic-streaming' ? this.snapshot.internetReady
      : this.snapshot.remoteReady || ['cloud', 'pending', 'metadata'].includes(this.snapshot.stage));
    const health = provider ? this.snapshot.providers[provider] : null;
    return ready && (!health || health.available || health.retryAt <= this.now());
  }
  assertRemote(provider?: string) { if (!this.canRequest(provider)) throw new ConnectivityUnavailableError(this.snapshot.state, provider); }
  /** Serialize external remote requests. Epoch cancellation prevents stale results after loss/background. */
  async runRemote<T>(provider: string, operation: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
    this.assertRemote(provider);
    if (!this.started) return operation(parent ?? new AbortController().signal);
    const epoch = this.epochController.signal;
    const queuedAt = this.now();
    const providerKind = traceProviderName(provider);
    const command = this.remoteTail.then(async () => {
      traceP8('queue_wait', providerKind, this.now() - queuedAt);
      const workStartedAt = this.now();
      try {
      this.assertRemote(provider);
      const controller = new AbortController(); const abort = () => controller.abort();
      if (epoch.aborted || parent?.aborted) controller.abort();
      epoch.addEventListener('abort', abort); parent?.addEventListener('abort', abort);
      try {
        if (controller.signal.aborted) throw new ConnectivityUnavailableError(this.snapshot.state, provider);
        const value = await operation(controller.signal);
        if (controller.signal.aborted) throw new ConnectivityUnavailableError(this.snapshot.state, provider);
        return value;
      } finally { epoch.removeEventListener('abort', abort); parent?.removeEventListener('abort', abort); }
      } finally { traceP8('remote_work', providerKind, this.now() - workStartedAt); }
    });
    this.remoteTail = command.then(() => {}, () => {}); return command;
  }
  reportProvider(provider: string, available: boolean) {
    if (!this.started || !this.snapshot.active || (!this.snapshot.remoteReady && !['cloud', 'pending', 'metadata'].includes(this.snapshot.stage))) return;
    const previous = this.snapshot.providers[provider], failures = available ? 0 : (previous?.failures ?? 0) + 1;
    const providers = Object.freeze({ ...this.snapshot.providers, [provider]: { available, failures, retryAt: available ? 0 : this.now() + Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)) } });
    this.publish({ providers, ...(this.snapshot.remoteReady ? { state: this.recoveryIncomplete || Object.values(providers).some(p => !p.available) ? 'DEGRADED' as const : 'ONLINE' as const } : {}) });
    traceP8('provider', `${traceProviderName(provider)}:${available ? 'up' : 'down'}`, 0, failures);
    if (!available) { this.failures = Math.max(1, this.failures); this.schedule(4000); }
  }
}
export const wavenConnectivity = new ConnectivityService();
