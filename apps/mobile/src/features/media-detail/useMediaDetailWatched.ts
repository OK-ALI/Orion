import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLibraryVisual } from '../../context/LibraryContext';
import { canonicalMediaDetailWatchedRecord } from './mediaDetailWatchedPolicy';

export type SeasonWatchedDialog = {
  action: 'watch' | 'unwatch';
  season: number;
} | null;

export type WatchedUndoNotice = {
  id: number;
  message: string;
  onUndo: () => void;
} | null;

interface UseMediaDetailWatchedInput {
  data: any;
  immediateRecord?: any;
  type: 'movie' | 'tv';
  seriesId: string | number;
  title: string;
  selectedSeason: number;
  episodes: any[];
}

export function useMediaDetailWatched({
  data,
  immediateRecord,
  type,
  seriesId,
  title,
  selectedSeason,
  episodes,
}: UseMediaDetailWatchedInput) {
  const {
    isWatched,
    markWatched,
    markUnwatched,
    isSeasonWatched,
    markSeasonWatched,
    markSeasonUnwatched,
    reconcileSeriesWatched,
  } = useLibraryVisual();
  const [seasonDialog, setSeasonDialog] = useState<SeasonWatchedDialog>(null);
  const [undoNotice, setUndoNotice] = useState<WatchedUndoNotice>(null);

  const mediaRecord = useMemo(
    () => canonicalMediaDetailWatchedRecord({
      data,
      immediateRecord,
      type,
      routeId: seriesId,
      fallbackTitle: title,
    }),
    [data, immediateRecord, seriesId, title, type],
  );

  const movieWatched = Boolean(type === 'movie' && mediaRecord && isWatched(mediaRecord));
  const seasonWatched = Boolean(
    type === 'tv'
      && data?.id != null
      && isSeasonWatched(data.id, selectedSeason, episodes),
  );

  useEffect(() => {
    if (type === 'tv' && data?.id != null) reconcileSeriesWatched(data);
  }, [data, reconcileSeriesWatched, seasonWatched, type]);

  const showUndo = useCallback((message: string, undo: () => void) => {
    const id = Date.now();
    setUndoNotice({
      id,
      message,
      onUndo: () => {
        undo();
        setUndoNotice((current) => current?.id === id ? null : current);
      },
    });
  }, []);

  const toggleMovieWatched = useCallback(() => {
    if (!mediaRecord || type !== 'movie') return;
    const wasWatched = isWatched(mediaRecord);
    if (wasWatched) markUnwatched(mediaRecord);
    else markWatched(mediaRecord);
    showUndo(
      `${title} marked ${wasWatched ? 'unwatched' : 'watched'}.`,
      () => wasWatched ? markWatched(mediaRecord) : markUnwatched(mediaRecord),
    );
  }, [isWatched, markUnwatched, markWatched, mediaRecord, showUndo, title, type]);

  const isEpisodeWatched = useCallback(
    (episode: any) => isWatched(episode, { isEpisode: true, seriesId }),
    [isWatched, seriesId],
  );

  const toggleEpisodeWatched = useCallback((episode: any) => {
    const wasWatched = isWatched(episode, { isEpisode: true, seriesId });
    const options = { isEpisode: true, seriesId } as const;
    if (wasWatched) markUnwatched(episode, options);
    else markWatched(episode, options);
    if (data) reconcileSeriesWatched(data);
    const episodeNumber = Number(episode?.episode_number ?? episode?.episode) || 0;
    showUndo(
      `${episodeNumber ? `Episode ${episodeNumber}` : 'Episode'} marked ${wasWatched ? 'unwatched' : 'watched'}.`,
      () => {
        if (wasWatched) markWatched(episode, options);
        else markUnwatched(episode, options);
        if (data) reconcileSeriesWatched(data);
      },
    );
  }, [data, isWatched, markUnwatched, markWatched, reconcileSeriesWatched, seriesId, showUndo]);

  const requestSeasonToggle = useCallback(() => {
    if (type !== 'tv' || episodes.length === 0) return;
    setSeasonDialog({ action: seasonWatched ? 'unwatch' : 'watch', season: selectedSeason });
  }, [episodes.length, seasonWatched, selectedSeason, type]);

  const confirmSeasonToggle = useCallback(() => {
    if (!seasonDialog || !data || data.id == null || episodes.length === 0) return;
    const shouldUnwatch = seasonDialog.action === 'unwatch';
    const episodeOptions = { isEpisode: true, seriesId: data.id } as const;
    const previouslyWatched = shouldUnwatch
      ? episodes
      : episodes.filter((episode) => isWatched(episode, episodeOptions));

    if (shouldUnwatch) markSeasonUnwatched(data.id, seasonDialog.season, episodes);
    else markSeasonWatched(data, seasonDialog.season, episodes);
    const count = episodes.length;
    const season = seasonDialog.season;
    showUndo(
      `Season ${season} marked ${shouldUnwatch ? 'unwatched' : 'watched'} for ${count} episode${count === 1 ? '' : 's'}.`,
      () => {
        if (shouldUnwatch) {
          markSeasonWatched(data, season, episodes);
          return;
        }
        markSeasonUnwatched(data.id, season, episodes);
        previouslyWatched.forEach((episode) => markWatched(episode, episodeOptions));
        reconcileSeriesWatched(data);
      },
    );
    setSeasonDialog(null);
  }, [data, episodes, isWatched, markSeasonUnwatched, markSeasonWatched, markWatched, reconcileSeriesWatched, seasonDialog, showUndo]);

  const dismissSeasonDialog = useCallback(() => setSeasonDialog(null), []);
  const dismissUndo = useCallback(() => setUndoNotice(null), []);

  return {
    movieWatched,
    seasonWatched,
    isEpisodeWatched,
    toggleMovieWatched,
    toggleEpisodeWatched,
    requestSeasonToggle,
    seasonDialog,
    dismissSeasonDialog,
    confirmSeasonToggle,
    undoNotice,
    dismissUndo,
  };
}
