import { View, StyleSheet, Platform, ActivityIndicator, Text, Pressable, useWindowDimensions, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { useEvent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DEFAULT_CINEMA_SOURCE_ID, getSourceUrl, getNextHealthyNonAsyncSource, ALL_CINEMA_SOURCES } from '@orion/shared/sources';
import { tmdbFetch } from '@orion/shared/api';
import type { MobilePlayerHudState, ShieldVerificationState } from '@orion/shared/types';
import { PlayerHUD } from '../../src/components/player/PlayerHUD';
import { SourcesSheet } from '../../src/components/player/SourcesSheet';
import { WatchdogWarning } from '../../src/components/player/WatchdogWarning';
import { accent, fontSizes, radii } from '@orion/shared/tokens';
import { getMobileSourceHealth, hydrateMobileSourceHealth, markMobileSourceFailure, updateMobileSourceHealth } from '../../src/services/sourceHealth';
import { useLibrary } from '../../src/context/LibraryContext';
import {
  clearMobileDiagnosticError,
  reportMobileDiagnosticError,
  updateMobileDiagnostics,
} from '../../src/services/mobileDiagnostics';

// ── Native HLS/MP4 Video Player Component ──────────────────────────────────
function NativeVideoPlayer({ streamUrl, title, sourceId, setSourceId, id, type, season, episode }: any) {
  const router = useRouter();
  const { recordPlayback, getPlaybackProgress } = useLibrary();
  const [showSources, setShowSources] = useState(false);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);

  const player = useVideoPlayer(streamUrl, (p) => {
    p.timeUpdateEventInterval = 1;
    const saved = getPlaybackProgress(type, id, Number(season) || null, Number(episode) || null);
    if (saved?.currentTime > 0 && !saved?.completed) p.currentTime = saved.currentTime;
    p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const timeUpdate = useEvent(player, 'timeUpdate', {
    currentTime: Number(player.currentTime) || 0,
    bufferedPosition: Number(player.bufferedPosition) || 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const isBuffering = status === 'loading';
  const lastSavedAt = useRef(0);

  const persistProgress = () => {
    recordPlayback({
      item: { id, title, media_type: type },
      mediaType: type,
      currentTime: Number(player.currentTime) || Number(timeUpdate.currentTime) || 0,
      duration: Number(player.duration) || 0,
      sourceId,
      season: Number(season) || null,
      episode: Number(episode) || null,
    });
    lastSavedAt.current = Date.now();
  };

  useEffect(() => {
    if (Date.now() - lastSavedAt.current >= 5000) persistProgress();
  }, [timeUpdate.currentTime]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') persistProgress();
    });
    return () => {
      subscription.remove();
      persistProgress();
    };
  }, [id, type, season, episode, sourceId]);

  useEffect(() => {
    setWatchdogDismissed(false);
  }, [sourceId]);

  const handleFailover = () => {
    const nextSource = getNextHealthyNonAsyncSource(sourceId, { mediaType: 'movie', includeExperimental: true });
    if (nextSource) {
      setSourceId(nextSource);
    }
  };

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <PlayerHUD 
        player={player} 
        title={title || 'Playing Video'} 
        onBack={() => router.back()}
        onOpenSources={() => setShowSources(true)}
      />

      {showSources && (
        <SourcesSheet
          currentSourceId={sourceId}
          onSelect={(newSource) => setSourceId(newSource)}
          onClose={() => setShowSources(false)}
        />
      )}

      {!watchdogDismissed && (
        <WatchdogWarning
          isBuffering={isBuffering}
          onFailover={handleFailover}
          onSelectSource={() => setShowSources(true)}
          onDismiss={() => setWatchdogDismissed(true)}
        />
      )}
    </View>
  );
}

// ── Interactive Embed Player Component (Desktop 1:1 Parity Player HUD Overlay) ───
function EmbedVideoPlayer({ embedUrl, title, sourceId, setSourceId, id, type, season, episode }: any) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [showSources, setShowSources] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hudState, setHudState] = useState<MobilePlayerHudState>('buffering');
  const [shieldState, setShieldState] = useState<ShieldVerificationState>('limited');
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [allowedDependencies, setAllowedDependencies] = useState(0);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const hideTimeout = useRef<any>(null);
  const loadStartedAt = useRef(Date.now());

  const activeSourceObj = ALL_CINEMA_SOURCES.find((s) => s.id === sourceId);
  const sourceLabel = activeSourceObj?.label || 'VidEasy Direct';

  // Automatically lock screen to landscape mode when playing
  useEffect(() => {
    async function lockLandscape() {
      try {
        if (Platform.OS !== 'web') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          setIsLandscape(true);
        }
      } catch (err) {}
    }
    lockLandscape();

    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

  const toggleOrientation = async () => {
    try {
      if (Platform.OS !== 'web') {
        if (isLandscape) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          setIsLandscape(false);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          setIsLandscape(true);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadStartedAt.current = Date.now();
    setIsBuffering(true);
    setHudState('buffering');
    setShowControls(true);
    setShieldState('limited');
    setBlockedRequests(0);
    setAllowedDependencies(0);
    setWatchdogDismissed(false);
  }, [embedUrl, id, title, sourceId]);

  const handleFailover = () => {
    const nextSource = getNextHealthyNonAsyncSource(sourceId, {
      mediaType: type,
      includeExperimental: true,
    });
    if (nextSource) {
      setSourceId(nextSource);
    }
  };

  const resetHideTimer = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setShowControls(true);
    if (!isBuffering && !showSources && hudState !== 'error') {
      hideTimeout.current = setTimeout(() => {
        setShowControls(false);
        setHudState('hidden');
      }, 4000);
    }
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [isBuffering, showSources, hudState]);

  const handleScreenTap = () => {
    if (!showControls) {
      setHudState('visible');
      resetHideTimer();
    } else {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      setShowControls(false);
      setHudState('hidden');
    }
  };

  // Mobile layout calculations
  const isCompactMobile = windowWidth < 480;

  // Mobile AdBlocker JavaScript Injection & Network Rules
  const mobileAdBlockerJs = `
    (function() {
      window.open = function() { return null; };
      window.alert = function() {};
      
      function removeAds() {
        const selectors = [
          "iframe[src*='doubleclick.net']",
          "iframe[src*='googlesyndication.com']",
          "iframe[src*='profitableratecpm.com']",
          "iframe[src*='adexchangeclear.com']",
          "ins.adsbygoogle",
          "[id^='google_ads_']",
          "div[style*='z-index: 2147483647']",
          "a[target='_blank'][style*='position: fixed']",
          "[class*='ad-overlay']",
          "[class*='popunder']",
          "[class*='adblock-detector']"
        ];
        document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());
      }

      document.addEventListener('DOMContentLoaded', removeAds);
      setInterval(removeAds, 1000);

      document.addEventListener('click', function(e) {
        const anchor = e.target?.closest?.('a[target="_blank"]');
        if (anchor) {
          e.preventDefault();
          e.stopImmediatePropagation();
        } else {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TAP' }));
          }
        }
      }, true);
      
      document.addEventListener('touchstart', function(e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TAP' }));
        }
      }, { passive: true });
    })();
    true;
  `;

  const handleShouldStartLoad = (request: any) => {
    const url = request?.url || '';
    if (!url) return true;
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    const requiredOrigins = new Set([
      ...(activeSourceObj?.expectedOrigins || []),
      ...(activeSourceObj?.allowedNavigationOrigins || []),
      ...(activeSourceObj?.requiredRequestOrigins || []),
    ]);
    const isRequired = requiredOrigins.has(origin)
      || /\.(m3u8|mpd|vtt|srt|m4s|ts)(\?|$)/i.test(url)
      || /subtitle|caption|manifest|playlist/i.test(url);
    if (isRequired) {
      setAllowedDependencies((value) => value + 1);
      setShieldState('dependency-allowed');
      return true;
    }
    if (/doubleclick|popcash|adsterra|profitableratecpm|adexchangeclear|bet365|exoclick|googlesyndication/i.test(url)) {
      setBlockedRequests((value) => value + 1);
      setShieldState('verified');
      return false;
    }
    return true;
  };

  const markLoaded = () => {
    const startupMs = Date.now() - loadStartedAt.current;
    setIsBuffering(false);
    setHudState('visible');
    const health = updateMobileSourceHealth(sourceId, type, {
      state: startupMs > 12_000 ? 'slow' : 'ready',
      startupMs,
      failureCount: 0,
      cooldownUntil: 0,
      blockedRequests,
      allowedDependencies,
      lastError: null,
    });
    updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
    clearMobileDiagnosticError('playback');
    resetHideTimer();
  };

  const markFailed = (message: string) => {
    setIsBuffering(false);
    setHudState('error');
    setShowControls(true);
    setShieldState('failed');
    const health = markMobileSourceFailure(sourceId, type, message);
    updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
    reportMobileDiagnosticError({ area: 'playback', code: 'SOURCE_FAILED', message });
  };

  return (
    <View style={styles.container}>
      {/* Video Canvas Box with 16:9 Aspect Ratio Preservation */}
      <View style={styles.videoBoxWrapper}>
        {Platform.OS === 'web' ? (
            <iframe
              src={embedUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#000',
              }}
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
              onLoad={markLoaded}
            />
        ) : (
          <WebView
            source={{ uri: embedUrl }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScript={mobileAdBlockerJs}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            style={{ flex: 1, backgroundColor: '#000' }}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            onLoadStart={() => {
              setIsBuffering(true);
              setHudState('buffering');
            }}
            onLoadEnd={markLoaded}
            onError={({ nativeEvent }) => markFailed(nativeEvent.description || 'Provider failed to load')}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.statusCode >= 400) markFailed(`Provider returned HTTP ${nativeEvent.statusCode}`);
            }}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'TAP') {
                  handleScreenTap();
                }
              } catch (e) {}
            }}
          />
        )}
      </View>

      {!showControls && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show player controls"
          onPress={() => {
            setHudState('visible');
            resetHideTimer();
          }}
          style={styles.embedRevealHandle}
        >
          <View style={styles.embedRevealBar} />
        </Pressable>
      )}

      {/* Desktop 1:1 Replica Top Controls Header Gradient Overlay */}
      {showControls && (
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.65)', 'transparent']}
          style={styles.fullWidthHeaderGradient}
          pointerEvents="box-none"
        >
          {/* Left Group: Independent Glass Back Button */}
          <Pressable onPress={() => router.back()} style={styles.floatingGlassBackBtn}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Pressable>

          {/* Center Title (Frameless Typography) */}
          <View style={styles.headerTitleWrapper}>
            <Text style={styles.framelessTitle} numberOfLines={1}>
              {title || 'Orion Stream'}
            </Text>
          </View>

          {/* Right Group: Shield, Orientation & Glass Server Chip Button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.shieldBadge}>
              <Ionicons
                name={shieldState === 'failed' ? 'shield-outline' : 'shield-checkmark'}
                size={12}
                color={shieldState === 'verified' ? '#4ade80' : '#fbbf24'}
              />
              {!isCompactMobile && (
                <Text style={[styles.shieldText, shieldState !== 'verified' && styles.shieldTextLimited]}>
                  {shieldState === 'verified' ? `Shield ${blockedRequests}` : shieldState === 'failed' ? 'Shield failed' : 'Shield limited'}
                </Text>
              )}
            </View>
            <Pressable onPress={toggleOrientation} style={styles.floatingGlassBackBtn}>
              <Ionicons name={isLandscape ? 'refresh-outline' : 'expand-outline'} size={16} color="#fff" />
            </Pressable>
            <Pressable onPress={() => {
              setShowSources(true);
              setHudState('sheet-open');
              setShowControls(true);
            }} style={styles.floatingGlassSourceChip}>
              <Ionicons name="hardware-chip-outline" size={14} color="#f87171" />
              {!isCompactMobile && (
                <Text style={styles.sourceChipText} numberOfLines={1}>{sourceLabel}</Text>
              )}
            </Pressable>
          </View>
        </LinearGradient>
      )}

      {/* Automatic Slow Stream Watchdog Warning Toast */}
      {!watchdogDismissed && (
        <WatchdogWarning
          isBuffering={isBuffering}
          onFailover={handleFailover}
          onSelectSource={() => setShowSources(true)}
          onDismiss={() => setWatchdogDismissed(true)}
        />
      )}

      {showSources && (
        <SourcesSheet
          currentSourceId={sourceId}
          onSelect={(newSource) => setSourceId(newSource)}
          mediaType={type}
          onClose={() => {
            setShowSources(false);
            setHudState('visible');
            resetHideTimer();
          }}
        />
      )}
    </View>
  );
}

// ── Main Player Screen ─────────────────────────────────────────────────────
export default function PlayerScreen() {
  const { id, type, title, season, episode, offlineUri, isOffline } = useLocalSearchParams<{
    id: string;
    type: 'movie' | 'tv';
    title: string;
    season?: string;
    episode?: string;
    offlineUri?: string;
    isOffline?: string;
  }>();
  
  const [sourceId, setSourceId] = useState(DEFAULT_CINEMA_SOURCE_ID);
  const [imdbId, setImdbId] = useState<string | null>(null);

  useEffect(() => {
    hydrateMobileSourceHealth();
  }, []);

  useEffect(() => {
    const health = getMobileSourceHealth(sourceId, type);
    updateMobileDiagnostics({
      activeSourceId: isOffline === 'true' ? 'local' : sourceId,
      sourceHealth: isOffline === 'true' ? 'ready' : (health?.state ?? 'unknown'),
    });
  }, [isOffline, sourceId, type]);

  // If offline mode is requested, use local file URI directly
  const activeStreamUrl = isOffline === 'true' && offlineUri
    ? offlineUri
    : getSourceUrl(sourceId, type, { tmdbId: id, imdbId: imdbId || undefined }, parseInt(season || '1', 10), parseInt(episode || '1', 10));

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

  return isOffline === 'true' && offlineUri ? (
    <NativeVideoPlayer
      streamUrl={offlineUri}
      title={title}
      sourceId="local"
      setSourceId={setSourceId}
      id={id}
      type={type}
      season={season}
      episode={episode}
    />
  ) : (
    <EmbedVideoPlayer
      embedUrl={activeStreamUrl}
      title={title}
      sourceId={sourceId}
      setSourceId={setSourceId}
      id={id}
      type={type}
      season={season}
      episode={episode}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoBoxWrapper: {
    width: '100%',
    height: '100%',
    flex: 1,
    alignSelf: 'center',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  fullWidthHeaderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 999,
  },
  floatingGlassBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  framelessTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  floatingGlassSourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  sourceChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
    paddingHorizontal: 8,
    height: 38,
    borderRadius: radii.full,
  },
  shieldText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  shieldTextLimited: {
    color: '#fbbf24',
  },
  embedRevealHandle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 38 : 12,
    alignSelf: 'center',
    zIndex: 1000,
    width: 76,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  embedRevealBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
});
