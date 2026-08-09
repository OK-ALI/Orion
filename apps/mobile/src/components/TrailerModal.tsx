import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TrailerCandidateV1, TrailerPlaybackState } from '@orion/shared/types';
import { useOrionTheme } from '../context/ThemeContext';
import { clearMobileDiagnosticError, reportMobileDiagnosticError } from '../services/mobileDiagnostics';
import { createVimeoHtml, createYouTubeHtml } from '../features/trailers/trailerProviders';
import { useTrailerSession } from '../features/trailers/hooks/useTrailerSession';

interface TrailerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  candidates: TrailerCandidateV1[];
}

const IDENTITY = {
  applicationId: 'com.okali.orion',
  applicationVersion: '2.0.1',
  origin: 'https://com.okali.orion',
  referrer: 'https://com.okali.orion/',
};

function errorCopy(state: TrailerPlaybackState, provider?: string) {
  if (state === 'removed' || state === 'private') return ['Trailer is unavailable', 'This upload was removed or made private. Orion is trying another trailer.'];
  if (state === 'embed-disabled') return ['Embedding is disabled', `The owner does not allow this ${provider || 'provider'} trailer inside apps. Orion is trying another one.`];
  if (state === 'client-identity-error') return ['Player identification failed', 'The provider could not verify Orion on this device. You can retry or continue externally.'];
  if (state === 'network-error') return ['Trailer connection failed', 'Check your connection, retry this trailer, or open it in the provider app.'];
  if (state === 'exhausted') return ['No in-app trailer is available', 'Every available trailer rejected embedded playback or could not be reached.'];
  return ['Trailer could not play', 'Orion could not start this candidate. Try it again, choose another trailer, or open it externally.'];
}

export function TrailerModal({ visible, onClose, title, candidates }: TrailerModalProps) {
  const { theme, preferences } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const session = useTrailerSession(visible, candidates);
  const candidate = session.activeCandidate;
  const landscape = width > height;
  const sheetWidth = Math.min(width - 24, landscape ? 1080 : 820);
  const candidateRailWidth = candidates.length > 1 ? Math.min(220, Math.max(150, sheetWidth * 0.2)) : 0;
  const actionRailWidth = Math.min(190, Math.max(150, sheetWidth * 0.18));
  const landscapeChromeWidth = candidateRailWidth + actionRailWidth + (candidates.length > 1 ? 20 : 10);
  const availablePlayerHeight = Math.max(200, height - insets.top - insets.bottom - (landscape ? 116 : 280));
  const availablePlayerWidth = landscape ? Math.max(300, sheetWidth - landscapeChromeWidth) : sheetWidth;
  const playerWidth = Math.min(availablePlayerWidth, availablePlayerHeight * 16 / 9);
  // YouTube requires an embedded viewport of at least 200 CSS pixels per side.
  // Compact phones therefore receive a small letterboxed exception to strict 16:9.
  const playerHeight = Math.max(200, playerWidth * 9 / 16);

  const html = useMemo(() => {
    if (!candidate) return '';
    return candidate.site === 'YouTube' ? createYouTubeHtml(candidate, IDENTITY) : createVimeoHtml(candidate);
  }, [candidate]);

  const directEmbedUrl = useMemo(() => {
    if (!candidate) return '';
    if (candidate.site === 'Vimeo') {
      return `https://player.vimeo.com/video/${encodeURIComponent(candidate.providerKey)}?playsinline=1&dnt=1`;
    }
    const params = new URLSearchParams({
      playsinline: '1', controls: '1', rel: '0', fs: '1',
      origin: IDENTITY.origin, widget_referrer: IDENTITY.referrer,
    });
    return `https://www.youtube.com/embed/${encodeURIComponent(candidate.providerKey)}?${params.toString()}`;
  }, [candidate]);

  useEffect(() => {
    if (session.state === 'playing') clearMobileDiagnosticError('trailer');
    else if (['network-error', 'embed-disabled', 'client-identity-error', 'playback-error', 'exhausted'].includes(session.state)) {
      reportMobileDiagnosticError({
        area: 'trailer',
        code: session.error?.category?.toUpperCase().replaceAll('-', '_') || session.state.toUpperCase().replaceAll('-', '_'),
        message: `${candidate?.site || 'Trailer'} playback entered ${session.state}.`,
      });
    }
  }, [candidate?.site, session.error?.category, session.state]);

  const externalUrl = candidate?.site === 'Vimeo'
    ? `https://vimeo.com/${candidate.providerKey}`
    : candidate ? `https://www.youtube.com/watch?v=${candidate.providerKey}` : null;
  const openBrowser = () => externalUrl && Linking.openURL(externalUrl).catch(() => {});
  const openProvider = async () => {
    if (!candidate) return;
    const appUrl = candidate.site === 'YouTube' ? `vnd.youtube://${candidate.providerKey}` : `vimeo://video/${candidate.providerKey}`;
    if (Platform.OS !== 'web' && await Linking.canOpenURL(appUrl).catch(() => false)) return Linking.openURL(appUrl);
    return openBrowser();
  };

  const [errorTitle, errorText] = errorCopy(session.state, candidate?.site);
  const showError = ['network-error', 'removed', 'private', 'embed-disabled', 'client-identity-error', 'playback-error', 'exhausted'].includes(session.state);
  const isPreparing = ['preparing', 'rotating'].includes(session.state);
  const allowedPrefixes = candidate?.site === 'Vimeo'
    ? ['https://player.vimeo.com/', 'https://vimeo.com/', 'https://f.vimeocdn.com/', 'about:', 'data:']
    : ['https://www.youtube.com/', 'https://www.youtube-nocookie.com/', 'https://i.ytimg.com/', 'https://s.ytimg.com/', 'about:', 'data:'];

  return (
    <Modal visible={visible} transparent animationType={preferences.reducedMotion ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
        <Pressable accessibilityLabel="Close trailer" style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { width: sheetWidth, maxHeight: height - insets.top - insets.bottom - 20, backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerIdentity}>
              <Ionicons name="film-outline" size={20} color={theme.accent} />
              <View style={styles.headerText}>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>TRAILER</Text>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close trailer" onPress={onClose} style={[styles.iconButton, { borderColor: theme.border }]}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.body, landscape && styles.bodyLandscape]}>
          {candidates.length > 1 && (
            <ScrollView
              horizontal={!landscape}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={[styles.selector, landscape && { width: candidateRailWidth, maxHeight: playerHeight }]}
              contentContainerStyle={[styles.selectorContent, landscape && styles.selectorContentLandscape]}
            >
              {candidates.map((item, index) => {
                const active = index === session.activeIndex;
                return <Pressable key={item.id} onPress={() => session.select(index)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.pill, landscape && styles.pillLandscape, { backgroundColor: active ? theme.accentSoft : theme.surface, borderColor: active ? theme.accent : theme.border }]}>
                  <Ionicons name={item.site === 'Vimeo' ? 'logo-vimeo' : 'logo-youtube'} size={15} color={active ? theme.accent : theme.textSecondary} />
                  <Text style={[styles.pillText, landscape && styles.pillTextLandscape, { color: active ? theme.text : theme.textSecondary }]} numberOfLines={landscape ? 2 : 1}>{item.name}</Text>
                  {item.official && <Text style={[styles.official, { color: theme.accent }]}>OFFICIAL</Text>}
                </Pressable>;
              })}
            </ScrollView>
          )}

          <View style={[styles.playerFrame, { width: playerWidth, height: playerHeight, borderColor: theme.border }]}>
            {candidate && !showError && (
              Platform.OS === 'web' ? (
                <iframe key={`${candidate.id}-${session.attempt}`} src={externalUrl?.replace('watch?v=', 'embed/').replace('vimeo.com/', 'player.vimeo.com/video/')} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen onLoad={() => session.handleMessage(JSON.stringify({ candidateId: candidate.id, type: 'ready' }))} />
              ) : (
                <WebView
                  key={`${candidate.id}-${session.attempt}`}
                  source={session.transport === 'direct'
                    ? { uri: directEmbedUrl, headers: { Referer: IDENTITY.referrer } }
                    : { html, baseUrl: IDENTITY.origin }}
                  applicationNameForUserAgent="Orion/2.0.1"
                  originWhitelist={['*']}
                  javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction={false}
                  setSupportMultipleWindows={false}
                  mixedContentMode="never"
                  onMessage={({ nativeEvent }) => session.handleMessage(nativeEvent.data)}
                  onLoad={() => session.transport === 'direct' && session.handleMessage(JSON.stringify({ candidateId: candidate.id, type: 'direct-loaded' }))}
                  onError={() => session.handleMessage(JSON.stringify({ candidateId: candidate.id, type: 'network-error' }))}
                  onHttpError={({ nativeEvent }) => nativeEvent.statusCode >= 400 && session.handleMessage(JSON.stringify({ candidateId: candidate.id, type: 'provider-error', detail: { code: `http-${nativeEvent.statusCode}` } }))}
                  onShouldStartLoadWithRequest={({ url, navigationType }) => {
                    const allowed = allowedPrefixes.some((prefix) => url.startsWith(prefix)) || url.includes('.googlevideo.com/');
                    if (!allowed && navigationType === 'click') Linking.openURL(url).catch(() => {});
                    return allowed;
                  }}
                  style={styles.webview}
                />
              )
            )}
            {isPreparing && <View style={styles.playerOverlay}><ActivityIndicator size="large" color={theme.accent} /><Text style={[styles.statusText, { color: theme.textSecondary }]}>{session.state === 'rotating' ? 'Trying another trailer…' : 'Preparing trailer…'}</Text></View>}
            {showError && <View style={[styles.playerOverlay, { backgroundColor: theme.mediaScrim }]}>
              <Ionicons name="alert-circle-outline" size={34} color={theme.warning} />
              <Text style={[styles.errorTitle, { color: theme.text }]}>{errorTitle}</Text>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>{errorText}</Text>
            </View>}
          </View>

          <View style={[styles.actions, landscape && [styles.actionsLandscape, { width: actionRailWidth }], { borderColor: theme.border }]}>
            <Pressable accessibilityRole="button" onPress={session.retry} disabled={!candidate} style={[styles.action, landscape && styles.actionLandscape, { backgroundColor: theme.accent }]}>
              <Ionicons name="refresh" size={18} color={theme.onAccent} /><Text style={[styles.actionText, { color: theme.onAccent }]}>Retry</Text>
            </Pressable>
            {candidates.length > 1 && <Pressable accessibilityRole="button" onPress={session.next} style={[styles.action, landscape && styles.actionLandscape, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="play-skip-forward" size={18} color={theme.text} /><Text style={[styles.actionText, { color: theme.text }]}>Try next</Text>
            </Pressable>}
            <Pressable accessibilityRole="button" onPress={openProvider} disabled={!candidate} style={[styles.action, landscape && styles.actionLandscape, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="open-outline" size={18} color={theme.text} /><Text style={[styles.actionText, { color: theme.text }]} numberOfLines={2}>Open {candidate?.site || 'provider'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openBrowser} disabled={!candidate} style={[styles.browserAction, landscape && styles.browserActionLandscape]}><Text style={[styles.browserText, { color: theme.textSecondary }]}>Open in browser</Text></Pressable>
          </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: { borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  header: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { fontSize: 20, fontWeight: '800' },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center' },
  bodyLandscape: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', padding: 10, gap: 10 },
  selector: { maxHeight: 58 }, selectorContent: { paddingHorizontal: 14, paddingVertical: 9, gap: 8 },
  selectorContentLandscape: { paddingHorizontal: 0, paddingVertical: 0, flexDirection: 'column' },
  pill: { minHeight: 40, maxWidth: 260, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pillLandscape: { width: '100%', maxWidth: '100%', minHeight: 52, borderRadius: 16 },
  pillText: { maxWidth: 170, fontSize: 12, fontWeight: '700' }, official: { fontSize: 8, fontWeight: '900' },
  pillTextLandscape: { flex: 1, maxWidth: undefined },
  playerFrame: { maxWidth: '100%', alignSelf: 'center', backgroundColor: '#000', borderWidth: 1, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#000' },
  playerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 8 },
  statusText: { fontSize: 14, fontWeight: '700' }, errorTitle: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  errorText: { fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 460 },
  actions: { borderTopWidth: 1, padding: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  actionsLandscape: { borderTopWidth: 0, borderLeftWidth: 1, paddingVertical: 0, paddingHorizontal: 10, flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'center' },
  action: { minHeight: 44, minWidth: 116, paddingHorizontal: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionLandscape: { width: '100%', minWidth: 0, paddingHorizontal: 10 },
  actionText: { fontSize: 13, fontWeight: '800' }, browserAction: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  browserActionLandscape: { width: '100%', alignItems: 'center', paddingHorizontal: 4 },
  browserText: { fontSize: 13, fontWeight: '700' },
});
