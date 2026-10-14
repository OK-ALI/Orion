import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { GlimpseReel } from './glimpseModel';
import { useGlimpseAmbientSampler } from './useGlimpseAmbientSampler';
import type { GlimpsePalette } from './GlimpseAmbientSampler';
import type { PerformanceProfileId } from '../../services/performanceProfiles';
import { GLIMPSE_INTERNAL_PREVIEW } from './glimpseBuild';
import { allowGlimpseNavigation, createGlimpseEmbedHtml, GLIMPSE_EMBED_ORIGIN, parseGlimpseVideoEvent, parseGlimpseVideoFailure, type GlimpseVideoFailure, type GlimpseVideoEvent } from './glimpseEmbed';

export function GlimpseVideoSurface({ reel, muted, onEvent, ambientGlow = false, profile = 'balanced', reducedMotion = true, onPalette }: {
  ambientGlow?: boolean; profile?: PerformanceProfileId; reducedMotion?: boolean; onPalette?: (palette: GlimpsePalette) => void;
  reel: GlimpseReel; muted: boolean; onEvent: (event: GlimpseVideoEvent, failure?: GlimpseVideoFailure) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const native = useRef<WebView>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const alive = useRef(true);
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const emit = (event: GlimpseVideoEvent, data?: string, nativeFailure?: GlimpseVideoFailure) => {
    if (!alive.current) return;
    setPlaying(event === 'playing');
    const failure = event === 'failed' ? nativeFailure || parseGlimpseVideoFailure(data || '', reel.id, token) || { kind: 'unknown' as const, code: null } : undefined;
    if (GLIMPSE_INTERNAL_PREVIEW) {
      let status: { currentTime?: number; muted?: boolean } = {};
      try { const message = JSON.parse(data || '{}'); status = {
        currentTime: Number.isFinite(message.currentTime) ? message.currentTime : undefined,
        muted: typeof message.muted === 'boolean' ? message.muted : undefined,
      }; } catch {}
      console.info('GlimpseInternal', JSON.stringify({ action: event, reelId: reel.id, session: token, ...status, failure }));
    }
    callback.current(event, failure);
  };
  const token = useMemo(() => String(Date.now()) + ':' + Math.random(), [reel.id]);
  const nativeId = 'orion-glimpse:' + token;
  useGlimpseAmbientSampler(nativeId, token, playing && ambientGlow, profile, reducedMotion, (colors, durationMs) => {
    if (!alive.current) return;
    onPalette?.(colors);
    if (GLIMPSE_INTERNAL_PREVIEW) console.info('GlimpseInternal', JSON.stringify({ action: 'ambient', reelId: reel.id, session: token, colors, durationMs }));
  });
  const initialMuted = useRef(muted).current;
  const origin = Platform.OS === 'web' ? window.location.origin : GLIMPSE_EMBED_ORIGIN;
  const html = useMemo(() => createGlimpseEmbedHtml(reel, token, initialMuted, origin), [reel, token, initialMuted, origin]);

  useEffect(() => {
    alive.current = true;
    if (GLIMPSE_INTERNAL_PREVIEW) console.info('GlimpseInternal', JSON.stringify({ action: 'acquire', reelId: reel.id, session: token }));
    const surface = native.current;
    const frame = iframe.current;
    const stop = () => {
      if (alive.current && GLIMPSE_INTERNAL_PREVIEW) console.info('GlimpseInternal', JSON.stringify({ action: 'release', reelId: reel.id, session: token }));
      alive.current = false; setPlaying(false);
      try { surface?.injectJavaScript('window.orionGlimpseStop && window.orionGlimpseStop(); true;'); } catch {}
      if (frame) { frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; }
    };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    const receive = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || event.origin !== origin || typeof event.data !== 'string') return;
      const parsed = parseGlimpseVideoEvent(event.data, reel.id, token);
      if (parsed) emit(parsed, event.data);
    };
    if (Platform.OS === 'web') window.addEventListener('message', receive);
    return () => {
      stop();
      subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('message', receive);
    };
  }, [reel.id, origin, token]);

  useEffect(() => {
    const command = 'window.orionGlimpseMute && window.orionGlimpseMute(' + muted + '); true;';
    native.current?.injectJavaScript(command);
    if (Platform.OS === 'web') {
      iframe.current?.contentWindow?.postMessage({ reelId: reel.id, token, command: 'mute', muted }, origin);
    }
  }, [muted, origin, reel.id, token]);

  return <View nativeID={nativeId} collapsable={false} style={styles.surface}>
    {Platform.OS === 'web'
      ? <iframe ref={iframe} title={reel.clipTitle} srcDoc={html}
          sandbox="allow-scripts allow-same-origin" allow="autoplay; encrypted-media"
          style={{ width: '100%', height: '100%', border: 0 }} />
      : <WebView ref={native} source={{ html, baseUrl: origin }}
          originWhitelist={['*']} javaScriptEnabled domStorageEnabled
          mixedContentMode="never" allowsInlineMediaPlayback allowsFullscreenVideo={false}
          allowsPictureInPictureMediaPlayback={false} mediaPlaybackRequiresUserAction={false}
          javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
          onOpenWindow={() => {}} onShouldStartLoadWithRequest={request => allowGlimpseNavigation(request.url, reel.video.key)}
          onMessage={({ nativeEvent }) => {
            if (![origin, origin + '/', 'about:blank'].includes(nativeEvent.url)) return;
            const event = parseGlimpseVideoEvent(nativeEvent.data, reel.id, token);
            if (event) emit(event, nativeEvent.data);
          }}
          onError={() => emit('failed', undefined, { kind: 'network', code: null })} onRenderProcessGone={() => emit('failed', undefined, { kind: 'player', code: null })}
          style={styles.surface} />}
  </View>;
}
const styles = StyleSheet.create({ surface: { flex: 1, backgroundColor: '#000' } });
