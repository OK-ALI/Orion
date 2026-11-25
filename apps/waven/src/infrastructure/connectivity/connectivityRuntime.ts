import { AppState, NativeModules, Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { createMMKV } from 'react-native-mmkv';
import { createYouTubeMusicMetadataProvider } from '../music/providers/youtubeMusicMetadata';
import { createSpotifyChartsDashboardProvider } from '../music/providers/spotifyChartsDashboard';
import { wavenDiscoveryRuntime } from '../../features/discovery/wavenDiscoveryRuntime';
import { trackPlayback } from '../../features/playback/trackPlaybackRuntime';
import { wavenConnectivity } from './connectivityService';
import { offlineMetadata } from './offlineMetadata';
import { boundedConnectivityProbe, probeInternetEndpoint } from './reachabilityProbe';
import { configureP8TraceBridge, traceP8 } from './phase8ValidationTrace';

let users = 0;
let stopRuntime: (() => void) | null = null;
let validationProviderOutage = false;
const observe = (state: NetInfoState) => wavenConnectivity.observe({ connected: state.isConnected, internetReachable: state.isInternetReachable, type: state.type });
export async function checkWavenConnection() { try { observe(await NetInfo.fetch()); } catch { /* Last observed state stays authoritative. */ } await wavenConnectivity.revalidate(); }
/** Development-only controlled outage; never changes transport, Library or a Cloud profile. */
export function setConnectivityValidationOutage(enabled: boolean) {
  if (!__DEV__) throw new Error('Connectivity validation is available only in development.');
  validationProviderOutage = enabled;
  if (enabled) wavenConnectivity.reportProvider('ytmusic-metadata', false);
  else void checkWavenConnection();
}
export function startWavenConnectivity() {
  users++;
  if (users === 1) {
    // Native logging is guarded again by the exact physical validation package.
    // Attach before startup probes and recovery so their timings are observable.
    configureP8TraceBridge(Platform.OS === 'android' ? NativeModules.WavenStreamingSource ?? null : null);
    try {
      if (Platform.OS === 'web') offlineMetadata.configure({ get: key => localStorage.getItem(key), set: (key,value) => localStorage.setItem(key,value), remove: key => localStorage.removeItem(key) });
      else {
        const store = createMMKV({ id: 'waven.connectivity' });
        offlineMetadata.configure({ get: key => store.getString(key) ?? null, set: (key,value) => store.set(key,value), remove: key => { store.remove(key); } });
      }
    } catch { offlineMetadata.unavailable(); }
    const metadata = createYouTubeMusicMetadataProvider(), charts = createSpotifyChartsDashboardProvider();
    wavenConnectivity.start({
      internet: async signal => {
        for (const url of ['https://clients3.google.com/generate_204', 'https://www.gstatic.com/generate_204']) {
          if (signal.aborted) return false;
          if (await probeInternetEndpoint(url, signal)) return true;
        } return false;
      },
      providers: async signal => {
        const musicAt = Date.now();
        const music = validationProviderOutage ? false : await boundedConnectivityProbe(s => metadata.getSuggestions!('music', { signal: s }), signal).then(() => true, () => false);
        traceP8('probe', music ? 'metadata:up' : 'metadata:down', Date.now() - musicAt);
        const chartAt = Date.now();
        const chart = signal.aborted ? false : await boundedConnectivityProbe(s => charts.getDashboard({ signal: s }), signal).then(result => result.sections.length > 0, () => false);
        traceP8('probe', chart ? 'charts:up' : 'charts:down', Date.now() - chartAt);
        // These probes prove their own capabilities, not release/category or stream access.
        return { 'ytmusic-metadata': music, 'spotify-charts-dashboard': chart };
      },
    });
    const unregister = wavenConnectivity.registerRecovery('catalogue-refresh', 'metadata', async signal => {
      const started = Date.now();
      traceP8('recovery', 'metadata:begin', 0, offlineMetadata.pendingKeys().length);
      traceP8('recovery', 'pending_releases', 0, offlineMetadata.pendingKeys().includes('home-releases') ? 1 : 0);
      traceP8('recovery', 'pending_charts', 0, offlineMetadata.pendingKeys().includes('home-charts') ? 1 : 0);
      try { await wavenDiscoveryRuntime.refreshPendingOfflineMetadata(signal);
        traceP8('recovery', 'metadata:done', Date.now() - started, offlineMetadata.pendingKeys().length);
      } catch (error) { traceP8('recovery', signal.aborted ? 'metadata:cancelled' : 'metadata:failed', Date.now() - started, offlineMetadata.pendingKeys().length); throw error; }
    }, () => offlineMetadata.pendingKeys().length > 0);
    const unsubscribe = NetInfo.addEventListener(observe);
    const appState = AppState.addEventListener('change', state => {
      const active = state === 'active';
      wavenConnectivity.setActive(active);
      // NetInfo may miss network changes while Android suspends the app. Read its
      // current snapshot on foreground, rather than waiting for another event.
      if (active) void checkWavenConnection();
    });
    wavenConnectivity.setActive(AppState.currentState === 'active');
    let priorReady = false;
    const cancelResolution = wavenConnectivity.subscribe(() => {
      const ready = wavenConnectivity.canRequest('ytmusic-streaming');
      if (priorReady && !ready) trackPlayback.cancel();
      priorReady = ready;
    });
    void checkWavenConnection();
    stopRuntime = () => { unregister(); unsubscribe(); appState.remove(); cancelResolution(); wavenConnectivity.stop(); configureP8TraceBridge(null); };
  }
  return () => { if (users > 0 && --users === 0) { stopRuntime?.(); stopRuntime = null; } };
}
