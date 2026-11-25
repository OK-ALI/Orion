import { useEffect, useRef } from 'react';
import { WavenConnectionStatus } from '../connectivity/WavenConnectionStatus';
import { Animated, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { WavenText as Text } from '../typography/WavenText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WavenWordmark } from '../brand/WavenWordmark';
import { WavenAtmosphericCanvas } from '../surfaces/WavenAtmosphericCanvas';
import { useWavenLayout } from '../../hooks/useWavenLayout';
import { wavenColors, wavenFonts, wavenSpacing } from '../../theme/tokens';

interface WavenAppShellProps {
  brandTagline?: boolean;
  children: React.ReactNode;
  initialScrollY?: number;
  scrollRestoreRequest?: { y: number; token: number } | null;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  showBrand?: boolean;
}

export function WavenAppShell({
  brandTagline = false,
  children,
  initialScrollY = 0,
  scrollRestoreRequest = null,
  onScroll,
  scrollEventThrottle,
  showBrand = brandTagline,
}: WavenAppShellProps) {
  const layout = useWavenLayout();
  const scrollRef = useRef<any>(null);
  const restoreTargetRef = useRef<number | null>(
    scrollRestoreRequest || initialScrollY > 0
      ? Math.max(0, scrollRestoreRequest?.y ?? initialScrollY)
      : null,
  );
  const restoreFrameRef = useRef<number | null>(null);

  const cancelRestoreFrame = () => {
    if (restoreFrameRef.current === null) return;
    cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
  };

  const restoreAfterLayout = () => {
    if (restoreTargetRef.current === null) return;
    cancelRestoreFrame();
    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      const y = restoreTargetRef.current;
      if (y !== null) scrollRef.current?.scrollTo?.({ animated: false, x: 0, y });
    });
  };

  const stopRestoration = () => {
    restoreTargetRef.current = null;
    cancelRestoreFrame();
  };

  useEffect(() => {
    restoreTargetRef.current = scrollRestoreRequest || initialScrollY > 0
      ? Math.max(0, scrollRestoreRequest?.y ?? initialScrollY)
      : null;
    restoreAfterLayout();
    // Primary chrome and safe-area layout can settle after the first scroll.
    // Keep the requested offset through those clamps; a touch/drag ends it.
    return stopRestoration;
  }, [scrollRestoreRequest?.token]);

  const renderShell = (
    environment?: React.ReactNode,
    headerControl?: React.ReactNode,
    pageMaterial?: React.ReactNode,
  ) => (
    <View style={styles.root}>
      {environment ?? <WavenAtmosphericCanvas />}
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Animated.ScrollView
          ref={scrollRef}
          contentOffset={{ x: 0, y: Math.max(0, initialScrollY) }}
          onContentSizeChange={restoreAfterLayout}
          onLayout={restoreAfterLayout}
          onScrollBeginDrag={stopRestoration}
          onTouchStart={stopRestoration}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.gutter,
            },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentFrame, { maxWidth: layout.contentMaxWidth }]}>
            {showBrand ? (
              <View
                style={[
                  styles.wordmarkRow,
                  brandTagline ? styles.wordmarkRowWithTagline : null,
                  headerControl && !layout.isTabletLike ? { paddingBottom: 12 } : null,
                ]}
              >
                <WavenWordmark />
                {brandTagline ? (
                  <Text accessibilityRole="text" style={[styles.tagline, headerControl ? { color: '#FFFFFF' } : null]}>
                    Where <Text style={[styles.taglineAccent, headerControl ? { color: '#C4EAFF' } : null]}>Music</Text> Lives
                  </Text>
                ) : null}
              </View>
            ) : null}
            {headerControl}
            <View style={styles.pageContent}>{pageMaterial}<WavenConnectionStatus />{children}</View>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );

  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    brandTagline &&
    process.env.EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'
  ) {
    const { WavenHomeScenePreview } =
      require('../surfaces/WavenHomeScenePreview') as
        typeof import('../surfaces/WavenHomeScenePreview');

    return <WavenHomeScenePreview render={renderShell} gutter={layout.gutter} tabletLike={layout.isTabletLike} />;
  }

  return renderShell();
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: wavenColors.canvas,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: wavenSpacing.lg,
    paddingTop: 8,
  },
  contentFrame: {
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
  wordmarkRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingBottom: 40,
  },
  wordmarkRowWithTagline: {
    minHeight: 72,
    paddingBottom: 42,
  },
  tagline: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontFamily: wavenFonts.semiBold,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 7,
    textAlign: 'center',
  },
  taglineAccent: {
    color: wavenColors.interactionBlue,
    fontFamily: wavenFonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pageContent: {
    flex: 1,
  },
});
