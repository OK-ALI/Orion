import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getMobileDiagnosticsSnapshot, subscribeMobileDiagnosticEvidence } from '../../services/mobileDiagnostics';
import { subscribeMobileApplicationUpdateStateV1 } from '../../services/mobileApplicationUpdateState';
import { subscribeMobileDownloadRepositoryV1 } from '../downloads/downloadRepository';
import { subscribeAnimeIdentityEvidence } from '../playback/animeIdentityDiagnostics';
import { useMyListSteadyStateSync } from '../account/MyListSteadyStateSync';
import { useWatchedSteadyStateSync } from '../account/WatchedSteadyStateSync';
import { useViewingActivitySteadyStateSync } from '../account/ViewingActivitySteadyStateSync';
import { diagnosticArea, flushDiagnostics, initializeDiagnostics, recordFeedbackEvent, safeCode } from './feedbackDiagnostics';
export function FeedbackDiagnosticsBridge() {
  const myList = useMyListSteadyStateSync().phase;
  const watched = useWatchedSteadyStateSync().phase;
  const viewing = useViewingActivitySteadyStateSync().phase;
  useEffect(() => { for (const [domain, phase] of [['MY_LIST', myList], ['WATCHED', watched], ['VIEWING', viewing]]) if (phase === 'error') recordFeedbackEvent({ at: Date.now(), area: 'Account', event: 'failure', code: 'CLOUD_' + domain + '_SYNC_FAILED' }, true); }, [myList, watched, viewing]);
  useEffect(()=>{
    initializeDiagnostics();let last='';let error='';let lastUpdate='';
    const observe=()=>{const s=getMobileDiagnosticsSnapshot();const area=diagnosticArea(s.route);const fingerprint=[area,s.activeSourceId,s.playbackState,s.networkState.startsWith('offline')].join(':');
      if(fingerprint!==last){last=fingerprint;recordFeedbackEvent({at:Date.now(),area,event:'state',provider:s.activeSourceId||undefined,state:s.playbackState||undefined});}
      const next=s.lastError?`${s.lastError.area}:${s.lastError.code}`:'';if(next&&next!==error)recordFeedbackEvent({at:Date.now(),area:s.lastError?.area.includes('anime')?'Anime':area,event:'failure',code:safeCode(s.lastError?.code),provider:s.activeSourceId||undefined},true);error=next;};
    observe();const unsubscribe=subscribeMobileDiagnosticEvidence(observe);const update=subscribeMobileApplicationUpdateStateV1(s=>{if(s.status===lastUpdate)return;lastUpdate=s.status;if(s.status==='failed')recordFeedbackEvent({at:Date.now(),area:'Update',event:'failure',code:'UPDATE_FAILED'},true);});
    const anime = subscribeAnimeIdentityEvidence(e => {
      const number = (key: string) => typeof e[key] === 'number' && Number.isSafeInteger(e[key]) ? Number(e[key]) : undefined;
      recordFeedbackEvent({ at: Date.now(), area: 'Anime', event: 'identity-' + e.stage, stage: String(e.stage), ...(e.outcome === 'rejected' ? { code: safeCode(String(e.reason || 'ANIME_IDENTITY_UNAVAILABLE').toUpperCase().replaceAll('-', '_')) } : {}), mediaId: Number(e.tmdbId) || undefined, mediaType: e.mediaType === 'movie' ? 'movie' : e.mediaType === 'tv' ? 'tv' : undefined, anilistId: number('anilistId'), ...(e.mediaType === 'tv' ? { season: number('season'), episode: number('episode') } : {}), variant: e.variant === 'sub' ? 'sub' : e.variant === 'dub' ? 'dub' : undefined }, e.outcome === 'rejected');
    });
    const downloadStates = new Map<string, string>();
    const downloads = subscribeMobileDownloadRepositoryV1(snapshot => {
      for (const job of snapshot.jobs.slice(-32)) {
        const signature = job.state + ':' + job.retryCount + ':' + (job.failure?.code || '');
        if (downloadStates.get(job.jobId) === signature) continue;
        if (downloadStates.size >= 32) downloadStates.delete(downloadStates.keys().next().value!);
        downloadStates.set(job.jobId, signature);
        recordFeedbackEvent({ at: Date.now(), area: 'Downloads', event: job.failure ? 'failure' : 'state', ...(job.failure ? { code: safeCode(job.failure.code) } : {}), provider: job.sourceId, state: job.state, retryCount: job.retryCount, phase: job.progress.finalizationStage || job.state }, !!job.failure);
      }
    });
    const timer=setInterval(()=>flushDiagnostics(),5000);const life=AppState.addEventListener('change',s=>flushDiagnostics(s!=='active'));
    return()=>{unsubscribe();update();downloads();anime();clearInterval(timer);life.remove();flushDiagnostics();};
  },[]);return null;
}
