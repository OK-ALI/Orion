import type {
  MusicProviderHealth,
  MusicProviderHealthStatus,
} from '../../domain/music';

export interface WavenProviderRuntimeIdentity {
  readonly id: string;
  readonly name: string;
}

export interface WavenProviderOperationResult<T> {
  providerId: string;
  providerName: string;
  value: T;
}

export interface WavenProviderQueryResult<T> {
  results: readonly WavenProviderOperationResult<T>[];
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenProviderQueryOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function initialHealth(): MusicProviderHealth {
  return {
    status: 'unknown',
    latencyMs: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: '',
    consecutiveFailures: 0,
  };
}

export function cleanProviderError(value: unknown): string {
  return String(
    value instanceof Error ? value.message : value || 'Provider request failed',
  )
    .replace(/https?:\/\/[^\s)]+/gi, '[url]')
    .replace(
      /(token|key|password|authorization|cookie)=?[^\s&]*/gi,
      '$1=[redacted]',
    )
    .slice(0, 240);
}

export function classifyProviderFailure(
  value: unknown,
): MusicProviderHealthStatus {
  const message = cleanProviderError(value);
  if (/401|403|auth|credential|password/i.test(message)) {
    return 'authentication_required';
  }
  if (/429|rate.?limit|retry-after/i.test(message)) {
    return 'rate_limited';
  }
  if (/timed? out|timeout|abort/i.test(message)) {
    return 'slow';
  }
  return 'unavailable';
}

export class WavenProviderHealthBook {
  private readonly values = new Map<string, MusicProviderHealth>();

  snapshot(providerId: string): MusicProviderHealth {
    return { ...(this.values.get(providerId) ?? initialHealth()) };
  }

  recordSuccess(providerId: string, latencyMs: number): void {
    const previous = this.values.get(providerId) ?? initialHealth();
    this.values.set(providerId, {
      status: latencyMs > 5_000 ? 'slow' : 'healthy',
      latencyMs: Math.max(0, Math.round(latencyMs)),
      lastSuccessAt: Date.now(),
      lastFailureAt: previous.lastFailureAt,
      lastError: '',
      consecutiveFailures: 0,
    });
  }

  recordFailure(
    providerId: string,
    error: unknown,
    latencyMs: number,
  ): void {
    const previous = this.values.get(providerId) ?? initialHealth();
    this.values.set(providerId, {
      ...previous,
      status: classifyProviderFailure(error),
      latencyMs: Math.max(0, Math.round(latencyMs)),
      lastFailureAt: Date.now(),
      lastError: cleanProviderError(error),
      consecutiveFailures: previous.consecutiveFailures + 1,
    });
  }
}

class WavenProviderCancelledError extends Error {
  constructor() {
    super('Provider request cancelled.');
    this.name = 'WavenProviderCancelledError';
  }
}

class WavenProviderTimeoutError extends Error {
  constructor(providerName: string) {
    super(`${providerName} timed out.`);
    this.name = 'WavenProviderTimeoutError';
  }
}

async function withProviderTimeout<T>(
  providerName: string,
  timeoutMs: number,
  parentSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parentSignal?.aborted) {
    throw new WavenProviderCancelledError();
  }

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const cleanupCallbacks: Array<() => void> = [];

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new WavenProviderTimeoutError(providerName));
    }, timeoutMs);
  });

  const cancellationPromise = new Promise<never>((_, reject) => {
    if (!parentSignal) return;

    const onAbort = () => {
      controller.abort();
      reject(new WavenProviderCancelledError());
    };

    parentSignal.addEventListener('abort', onAbort, { once: true });
    cleanupCallbacks.push(() =>
      parentSignal.removeEventListener('abort', onAbort),
    );
  });

  try {
    return await Promise.race([
      operation(controller.signal),
      timeoutPromise,
      cancellationPromise,
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    cleanupCallbacks.forEach((cleanup) => cleanup());
  }
}

export async function queryMusicProviders<
  TProvider extends WavenProviderRuntimeIdentity,
  TValue,
>(
  providers: readonly TProvider[],
  healthBook: WavenProviderHealthBook,
  operation: (
    provider: TProvider,
    signal: AbortSignal,
  ) => Promise<TValue>,
  options: WavenProviderQueryOptions = {},
): Promise<WavenProviderQueryResult<TValue>> {
  const timeoutMs = Math.max(
    1_000,
    Math.round(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );

  const settled = await Promise.allSettled(
    providers.map(async (provider) => {
      const startedAt = Date.now();
      try {
        const value = await withProviderTimeout(
          provider.name,
          timeoutMs,
          options.signal,
          (signal) => operation(provider, signal),
        );
        healthBook.recordSuccess(provider.id, Date.now() - startedAt);
        return {
          providerId: provider.id,
          providerName: provider.name,
          value,
        } satisfies WavenProviderOperationResult<TValue>;
      } catch (error) {
        if (!(error instanceof WavenProviderCancelledError)) {
          healthBook.recordFailure(provider.id, error, Date.now() - startedAt);
        }
        throw error;
      }
    }),
  );

  const results: WavenProviderOperationResult<TValue>[] = [];
  const errors: string[] = [];
  let cancelled = false;

  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(item.value);
      continue;
    }
    if (item.reason instanceof WavenProviderCancelledError) {
      cancelled = true;
      continue;
    }
    errors.push(cleanProviderError(item.reason));
  }

  return {
    results,
    errors,
    cancelled,
  };
}
