import type { SeriesWatchedReconciliationCandidate } from './watchedState';

export const SERIES_WATCHED_REQUEST_TIMEOUT_MS = 8000;
export const SERIES_WATCHED_REQUEST_CONCURRENCY = 2;

interface ReconciliationBatchOptions {
  candidates: SeriesWatchedReconciliationCandidate[];
  fetchSeries: (seriesId: string, signal: AbortSignal) => Promise<any>;
  applySeries: (series: any) => void;
  isCurrent: (candidate: SeriesWatchedReconciliationCandidate) => boolean;
  createController?: () => AbortController;
  timeoutMs?: number;
  concurrency?: number;
  onController?: (controller: AbortController, active: boolean) => void;
}

type SettledSeries =
  | { status: 'resolved'; series: any }
  | { status: 'rejected' }
  | { status: 'timed-out' };

export async function runSeriesWatchedReconciliationBatch({
  candidates,
  fetchSeries,
  applySeries,
  isCurrent,
  createController = () => new AbortController(),
  timeoutMs = SERIES_WATCHED_REQUEST_TIMEOUT_MS,
  concurrency = SERIES_WATCHED_REQUEST_CONCURRENCY,
  onController,
}: ReconciliationBatchOptions): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      const controller = createController();
      onController?.(controller, true);
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const request = Promise.resolve()
        .then(() => fetchSeries(candidate.seriesId, controller.signal))
        .then(
          (series): SettledSeries => ({ status: 'resolved', series }),
          (): SettledSeries => ({ status: 'rejected' }),
        );
      const deadline = new Promise<SettledSeries>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve({ status: 'timed-out' });
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([request, deadline]);
        if (
          result.status === 'resolved'
          && !controller.signal.aborted
          && isCurrent(candidate)
        ) {
          applySeries(result.series);
        }
      } finally {
        if (timeout !== null) clearTimeout(timeout);
        onController?.(controller, false);
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), candidates.length) },
      () => worker(),
    ),
  );
}