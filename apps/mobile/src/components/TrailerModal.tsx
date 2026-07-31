import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { accent, fontSizes, radii, spacing, text } from '@orion/shared/tokens';
import type { TrailerPlaybackState } from '@orion/shared/types';
import {
  clearMobileDiagnosticError,
  reportMobileDiagnosticError,
} from '../services/mobileDiagnostics';

export interface TrailerItem {
  key: string;
  name: string;
  type?: string;
  season?: number;
}

interface TrailerModalProps {
  visible: boolean;
  onClose: () => void;
  trailerKey: string | null;
  title: string;
  allTrailers?: TrailerItem[];
}

const ANDROID_YOUTUBE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

function createYouTubePlayerHtml(videoId: string, privacyMode: boolean) {
  const safeVideoId = JSON.stringify(videoId);
  const host = privacyMode ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <style>
      html, body, #player { width: 100%; height: 100%; margin: 0; background: #000; overflow: hidden; }
      iframe { width: 100% !important; height: 100% !important; border: 0; }
    </style>
  </head>
  <body>
    <div id="player"></div>
    <script>
      (function () {
        var postedReady = false;
        function post(type, detail) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, detail: detail || null }));
          }
        }
        window.onYouTubeIframeAPIReady = function () {
          try {
            new YT.Player('player', {
              host: ${JSON.stringify(host)},
              videoId: ${safeVideoId},
              width: '100%',
              height: '100%',
              playerVars: {
                playsinline: 1,
                controls: 1,
                rel: 0,
                fs: 1,
                enablejsapi: 1,
                origin: 'https://www.youtube.com'
              },
              events: {
                onReady: function () { postedReady = true; post('ready'); },
                onStateChange: function (event) {
                  if (event.data === YT.PlayerState.PLAYING) post('playing');
                  if (event.data === YT.PlayerState.PAUSED) post('paused');
                  if (event.data === YT.PlayerState.BUFFERING) post('buffering');
                },
                onError: function (event) { post('error', { code: event.data }); }
              }
            });
          } catch (error) {
            post('error', { message: String(error && error.message || error) });
          }
        };
        var script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = function () { post('network-error'); };
        document.head.appendChild(script);
        setTimeout(function () { if (!postedReady) post('timeout'); }, 12000);
      })();
    </script>
  </body>
</html>`;
}

export function TrailerModal({ visible, onClose, trailerKey: propTrailerKey, title, allTrailers = [] }: TrailerModalProps) {
  const [playbackState, setPlaybackState] = useState<TrailerPlaybackState>('idle');
  const [activeKey, setActiveKey] = useState<string | null>(propTrailerKey);
  const [useFallback, setUseFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (visible) {
      setPlaybackState('loading');
      setUseFallback(false);
      setActiveKey(propTrailerKey || (allTrailers.length > 0 ? allTrailers[0].key : null));
    }
  }, [visible, propTrailerKey, allTrailers]);

  useEffect(() => {
    if (!visible || !activeKey || playbackState !== 'loading') return;
    const timer = setTimeout(() => {
      if (!useFallback) {
        setUseFallback(true);
        setAttempt((value) => value + 1);
      } else {
        setPlaybackState('embed-rejected');
      }
    }, 13000);
    return () => clearTimeout(timer);
  }, [visible, activeKey, playbackState, attempt, useFallback]);

  const primaryUrl = activeKey
    ? `https://www.youtube-nocookie.com/embed/${activeKey}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=https%3A%2F%2Fwww.youtube.com`
    : null;
  const fallbackUrl = activeKey
    ? `https://www.youtube.com/embed/${activeKey}?playsinline=1&rel=0&modestbranding=1`
    : null;

  const activeUrl = useFallback ? fallbackUrl : primaryUrl;
  const nativeHtml = useMemo(
    () => activeKey ? createYouTubePlayerHtml(activeKey, !useFallback) : '',
    [activeKey, useFallback, attempt],
  );

  const handleSelectTrailer = (key: string) => {
    if (key !== activeKey) {
      setPlaybackState('loading');
      setUseFallback(false);
      setActiveKey(key);
      setAttempt((value) => value + 1);
    }
  };

  const retry = () => {
    setUseFallback((current) => !current);
    setPlaybackState('loading');
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    if (playbackState === 'ready') {
      clearMobileDiagnosticError('trailer');
      return;
    }
    if (['embed-rejected', 'network-error', 'playback-error'].includes(playbackState)) {
      reportMobileDiagnosticError({
        area: 'trailer',
        code: playbackState.toUpperCase().replaceAll('-', '_'),
        message: `Trailer playback entered ${playbackState}.`,
      });
    }
  }, [playbackState]);

  const openExternal = async () => {
    if (!activeKey) return;
    const appUrl = `vnd.youtube://${activeKey}`;
    const webUrl = `https://www.youtube.com/watch?v=${activeKey}`;
    try {
      if (Platform.OS !== 'web' && await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      setPlaybackState('playback-error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="film-outline" size={18} color="#f87171" />
              <Text style={styles.headerTitle} numberOfLines={1}>Trailer: {title}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Multi-Season / Multi-Trailer Selector Row */}
          {allTrailers.length > 1 && (
            <View style={styles.selectorBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allTrailers.map((t, idx) => {
                  const isActive = t.key === activeKey;
                  return (
                    <Pressable
                      key={`${t.key}_${idx}`}
                      style={[styles.trailerPill, isActive && styles.trailerPillActive]}
                      onPress={() => handleSelectTrailer(t.key)}
                    >
                      <Ionicons
                        name={isActive ? 'play-circle' : 'film-outline'}
                        size={12}
                        color={isActive ? '#fff' : 'rgba(255,255,255,0.6)'}
                      />
                      <Text style={[styles.trailerPillText, isActive && styles.trailerPillTextActive]}>
                        {t.name || `Trailer ${idx + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Video Player Box */}
          <View style={styles.playerBox}>
            {playbackState === 'loading' && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={accent.primary} />
                <Text style={styles.loadingText}>Preparing trailer…</Text>
              </View>
            )}

            {['embed-rejected', 'network-error', 'playback-error'].includes(playbackState) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={34} color="#f87171" />
                <Text style={styles.errorTitle}>Trailer could not play in Orion</Text>
                <Text style={styles.errorText}>
                  YouTube may have rejected embedded playback on this device. You can retry here or continue in YouTube.
                </Text>
                <View style={styles.errorActions}>
                  <Pressable accessibilityRole="button" style={styles.secondaryAction} onPress={retry}>
                    <Text style={styles.secondaryActionText}>Retry in Orion</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.primaryAction} onPress={openExternal}>
                    <Ionicons name="open-outline" size={16} color="#fff" />
                    <Text style={styles.primaryActionText}>Open YouTube</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeUrl && !['embed-rejected', 'network-error', 'playback-error'].includes(playbackState) && (
              Platform.OS === 'web' ? (
                <iframe
                  src={activeUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#000',
                  }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  onLoad={() => setPlaybackState('ready')}
                  onError={() => {
                    if (!useFallback) {
                      setUseFallback(true);
                      setAttempt((value) => value + 1);
                    } else {
                      setPlaybackState('embed-rejected');
                    }
                  }}
                />
              ) : (
                <WebView
                  key={`${activeKey}-${useFallback}-${attempt}`}
                  originWhitelist={['https://*', 'about:*', 'data:*']}
                  source={{ html: nativeHtml, baseUrl: 'https://www.youtube.com/' }}
                  userAgent={ANDROID_YOUTUBE_USER_AGENT}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  allowsInlineMediaPlayback={true}
                  allowsFullscreenVideo={true}
                  mediaPlaybackRequiresUserAction={true}
                  androidLayerType="hardware"
                  onMessage={({ nativeEvent }) => {
                    try {
                      const message = JSON.parse(nativeEvent.data || '{}');
                      if (message.type === 'ready' || message.type === 'playing' || message.type === 'paused') {
                        setPlaybackState('ready');
                      } else if (message.type === 'buffering') {
                        setPlaybackState((current) => current === 'loading' ? current : 'ready');
                      } else if (message.type === 'network-error') {
                        setPlaybackState('network-error');
                      } else if (message.type === 'error' || message.type === 'timeout') {
                        if (!useFallback) {
                          setUseFallback(true);
                          setPlaybackState('loading');
                          setAttempt((value) => value + 1);
                        } else {
                          setPlaybackState('embed-rejected');
                        }
                      }
                    } catch {
                      // Ignore non-Orion messages emitted by the embedded player.
                    }
                  }}
                  onError={() => setPlaybackState('network-error')}
                  onHttpError={({ nativeEvent }) => {
                    if (nativeEvent.statusCode >= 400) setPlaybackState('embed-rejected');
                  }}
                  onShouldStartLoadWithRequest={({ url, navigationType }) => {
                    const allowed = [
                      'https://www.youtube.com/',
                      'https://www.youtube-nocookie.com/',
                      'https://m.youtube.com/',
                      'https://googleads.g.doubleclick.net/',
                      'about:',
                      'data:',
                    ].some((prefix) => url.startsWith(prefix));
                    if (!allowed && navigationType === 'click') {
                      Linking.openURL(url).catch(() => {});
                    }
                    return allowed;
                  }}
                  style={{ flex: 1, backgroundColor: '#000' }}
                />
              )
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 740,
    backgroundColor: '#0d0d16',
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    maxWidth: 400,
  },
  hdPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  hdPillText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
  selectorBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  trailerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  trailerPillActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  trailerPillText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  trailerPillTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  playerBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    color: text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
    backgroundColor: '#05050a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[2],
  },
  errorTitle: { color: '#fff', fontSize: fontSizes.lg, fontWeight: '800', textAlign: 'center' },
  errorText: { color: text.secondary, fontSize: fontSizes.sm, lineHeight: 20, textAlign: 'center', maxWidth: 420 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[3], marginTop: spacing[3] },
  primaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, justifyContent: 'center', borderRadius: radii.xl, backgroundColor: accent.primary },
  primaryActionText: { color: '#fff', fontWeight: '800' },
  secondaryAction: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  secondaryActionText: { color: '#fff', fontWeight: '700' },
});
