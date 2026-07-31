import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  DEFAULT_CINEMA_SOURCE_ID,
  getSourceResumeParams,
  getSourceUrl,
} from '@orion/shared/sources';
import { tmdbFetch } from '@orion/shared/api';
import { useLibrary } from '../../context/LibraryContext';
import { getMobileSourceHealth, hydrateMobileSourceHealth } from '../../services/sourceHealth';
import { updateMobileDiagnostics } from '../../services/mobileDiagnostics';
import { EmbedPlayerSurface } from './EmbedPlayerSurface';
import { NativePlayerSurface } from './NativePlayerSurface';
import type { VerifiedPlaybackSnapshot } from './playerTypes';
import { verifiedResumeSeconds } from './playbackResume';

type PlayerRouteParams = {
  id: string;
  type: 'movie' | 'tv';
  title: string;
  season?: string;
  episode?: string;
  offlineUri?: string;
  isOffline?: string;
};

export default function PlayerScreen() {
  const { id, type, title, season, episode, offlineUri, isOffline } =
    useLocalSearchParams<PlayerRouteParams>();
  const { getPlaybackProgress } = useLibrary();
  const [sourceId, setSourceId] = useState(DEFAULT_CINEMA_SOURCE_ID);
  const [imdbId, setImdbId] = useState<string | null>(null);
  const existingProgress = getPlaybackProgress(
    type,
    id,
    Number(season) || null,
    Number(episode) || null,
  );
  const [resumeTime, setResumeTime] = useState(() => (
    existingProgress?.completed ? 0 : Math.max(0, Number(existingProgress?.currentTime) || 0)
  ));

  useEffect(() => { hydrateMobileSourceHealth(); }, []);
  useEffect(() => {
    const health = getMobileSourceHealth(sourceId, type);
    updateMobileDiagnostics({
      activeSourceId: isOffline === 'true' ? 'local' : sourceId,
      sourceHealth: isOffline === 'true' ? 'ready' : (health?.state ?? 'unknown'),
      playbackState: 'loading',
      playbackSurface: isOffline === 'true' ? 'native' : 'embed',
      playbackEvidence: null,
      lastTelemetryAt: null,
    });
  }, [isOffline, sourceId, type]);

  useEffect(() => {
    let cancelled = false;
    tmdbFetch<any>(`/${type}/${id}/external_ids`)
      .then((result) => {
        if (!cancelled) setImdbId(result?.imdb_id || null);
      })
      .catch(() => {
        if (!cancelled) setImdbId(null);
      });
    return () => { cancelled = true; };
  }, [id, type]);

  const activeStreamUrl = useMemo(() => {
    if (isOffline === 'true' && offlineUri) return offlineUri;
    return getSourceUrl(
      sourceId,
      type,
      { tmdbId: id, imdbId: imdbId || undefined },
      Number(season) || 1,
      Number(episode) || 1,
      getSourceResumeParams(sourceId, resumeTime),
    );
  }, [episode, id, imdbId, isOffline, offlineUri, resumeTime, season, sourceId, type]);

  const changeSource = (
    nextSourceId: string,
    verifiedSnapshot: VerifiedPlaybackSnapshot | null,
  ) => {
    setResumeTime(verifiedResumeSeconds(verifiedSnapshot));
    setSourceId(nextSourceId);
  };

  if (isOffline === 'true' && offlineUri) {
    return (
      <NativePlayerSurface
        key={`local-${offlineUri}`}
        streamUrl={offlineUri}
        title={title}
        sourceId="local"
        onSourceChange={changeSource}
        id={id}
        type={type}
        season={season}
        episode={episode}
        initialResumeTime={resumeTime}
      />
    );
  }

  return (
    <EmbedPlayerSurface
      key={`${sourceId}-${activeStreamUrl}`}
      embedUrl={activeStreamUrl}
      title={title}
      sourceId={sourceId}
      onSourceChange={changeSource}
      id={id}
      type={type}
      season={season}
      episode={episode}
      initialResumeTime={resumeTime}
    />
  );
}
