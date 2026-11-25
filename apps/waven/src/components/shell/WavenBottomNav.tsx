import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WavenText as Text } from '../typography/WavenText';
import { WavenPressable } from '../interaction/WavenPressable';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import {
  wavenColors,
  wavenLayout,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
  wavenMotion,
} from '../../theme/tokens';


const useNavigationAppearance:
  typeof import('../../theme/previewChromeMaterials').usePreviewNavigationAppearance =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'
    ? (
        require('../../theme/previewChromeMaterials') as
          typeof import('../../theme/previewChromeMaterials')
      ).usePreviewNavigationAppearance
    : (base) => ({
        styles: base,
        activeTone: null,
        inactiveTone: null,
        highlight: null,
      });

interface NavItem {
  label: 'Home' | 'Search' | 'Library';
  href: '/' | '/search' | '/library';
  icon: 'home' | 'search' | 'library';
}

const ITEMS: readonly NavItem[] = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Search', href: '/search', icon: 'search' },
  { label: 'Library', href: '/library', icon: 'library' },
];

const TRACK_PADDING = 5;
const ITEM_GAP = 5;
const NAV_LABEL_MAX_SCALE = 1.4;
const NAV_LABEL_COMPACT_MAX_SCALE = 1.2;
const NAV_SWIPE_ACTIVATION_PX = 8;
const NAV_SWIPE_COMMIT_RATIO = 0.28;
const NAV_SWIPE_VELOCITY = 0.35;

const LABEL_WIDTHS: Record<NavItem['label'], number> = {
  Home: 46,
  Search: 52,
  Library: 55,
};

function NavIcon({
  kind,
  tone,
}: {
  kind: NavItem['icon'];
  tone: string;
}) {
  const appearance = useNavigationAppearance(noirStyles);

  tone = tone === wavenColors.interactionBlue
    ? appearance.activeTone ?? tone
    : appearance.inactiveTone ?? tone;

  if (kind === 'search') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.searchRing, { borderColor: tone }]} />
        <View style={[styles.searchHandle, { backgroundColor: tone }]} />
      </View>
    );
  }

  if (kind === 'library') {
    return (
      <View style={[styles.iconBox, styles.libraryIcon]}>
        <View style={[styles.libraryBar, { backgroundColor: tone, height: 14 }]} />
        <View style={[styles.libraryBar, { backgroundColor: tone, height: 19 }]} />
        <View style={[styles.libraryBar, { backgroundColor: tone, height: 11 }]} />
      </View>
    );
  }

  return (
    <View style={styles.iconBox}>
      <View style={[styles.homeRoof, { borderBottomColor: tone }]} />
      <View style={[styles.homeBody, { borderColor: tone }]} />
    </View>
  );
}

function WavenNavItem({
  active,
  item,
  labelScale,
  onPress,
  reducedMotion,
}: {
  active: boolean;
  item: NavItem;
  labelScale: number;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  const { styles } = useNavigationAppearance(noirStyles);
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      activeProgress.setValue(active ? 1 : 0);
      return;
    }

    Animated.timing(activeProgress, {
      duration: wavenMotion.standardMs,
      toValue: active ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [active, activeProgress, reducedMotion]);

  const labelWidth = LABEL_WIDTHS[item.label] * labelScale;

  // Selection changes update activeProgress, not the native graph. Replacing
  // these elements on each route change replaces AnimatedProps and reconnects
  // their interpolation nodes while the existing transition is running.
  const presentation = useMemo(() => (
      <View style={styles.itemContent}>
        <Animated.View style={[
          styles.iconStack,
          { transform: [{ translateX: activeProgress.interpolate({
            inputRange: [0, 1], outputRange: [0, -(labelWidth + 8) / 2],
          }) }] },
        ]}>
          <NavIcon kind={item.icon} tone={wavenColors.textMuted} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.iconOverlay,
              {
                opacity: activeProgress,
              },
            ]}
          >
            <NavIcon kind={item.icon} tone={wavenColors.interactionBlue} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.labelClip,
            {
              // Match the previous expanding-label geometry without measuring
              // text or changing the flex row's width on every animation frame.
              width: labelWidth,
              opacity: activeProgress,
              transform: [{ translateX: activeProgress.interpolate({
                inputRange: [0, 1], outputRange: [12 - labelWidth, 16 - labelWidth / 2],
              }) }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ translateX: activeProgress.interpolate({
            inputRange: [0, 1], outputRange: [labelWidth, 0],
          }) }] }}>
          <Text
            maxFontSizeMultiplier={labelScale}
            numberOfLines={1}
            style={styles.labelActive}
          >
            {item.label}
          </Text>
          </Animated.View>
        </Animated.View>
      </View>
  ), [activeProgress, item.icon, item.label, labelScale, labelWidth, styles.labelActive]);

  return (
    <WavenPressable
      accessibilityLabel={item.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      containerStyle={styles.itemContainer}
      onPress={onPress}
      style={styles.pressable}
    >
      {presentation}
    </WavenPressable>
  );
}

export function WavenBottomNav() {
  const { styles, highlight } = useNavigationAppearance(noirStyles);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useWavenReducedMotion();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const [innerWidth, setInnerWidth] = useState(0);

  const labelScale = Math.min(
    fontScale,
    windowWidth < wavenLayout.compactWidth
      ? NAV_LABEL_COMPACT_MAX_SCALE
      : NAV_LABEL_MAX_SCALE,
  );

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
    ),
  );

  const selectionIndex = useRef(new Animated.Value(activeIndex)).current;
  const activeIndexRef = useRef(activeIndex);
  const slotStepRef = useRef(0);
  const slotWidthRef = useRef(0);
  const reducedMotionRef = useRef(reducedMotion);
  activeIndexRef.current = activeIndex;
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    if (reducedMotion) {
      selectionIndex.setValue(activeIndex);
      return;
    }

    Animated.timing(selectionIndex, {
      duration: wavenMotion.deliberateMs,
      toValue: activeIndex,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, reducedMotion, selectionIndex]);

  const handleInnerLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (Math.abs(nextWidth - innerWidth) > 0.5) {
      setInnerWidth(nextWidth);
    }
  };

  const usableWidth = Math.max(
    0,
    innerWidth - TRACK_PADDING * 2 - ITEM_GAP * (ITEMS.length - 1),
  );
  const slotWidth = usableWidth / ITEMS.length;
  const slotStep = slotWidth + ITEM_GAP;
  slotWidthRef.current = slotWidth;
  slotStepRef.current = slotStep;

  const panResponder = useMemo(() => {
    const clampIndex = (value: number) =>
      Math.max(0, Math.min(ITEMS.length - 1, value));
    const startIndexRef = { current: 0 };

    const settle = (dx: number, vx: number) => {
      const startIndex = startIndexRef.current;
      const step = slotStepRef.current;
      const width = slotWidthRef.current;
      if (step <= 0 || width <= 0) return;

      const committed =
        Math.abs(dx) >= width * NAV_SWIPE_COMMIT_RATIO ||
        Math.abs(vx) >= NAV_SWIPE_VELOCITY;
      // Pager semantics are intentionally inverse to raw finger motion:
      // dragging left pulls the current page away and exposes the next tab to
      // the right; dragging right returns to the previous tab.
      const rawIndex = startIndex - dx / step;
      let targetIndex = startIndex;

      if (committed) {
        const directionalValue = Math.abs(dx) >= NAV_SWIPE_ACTIVATION_PX ? dx : vx;
        const direction = directionalValue < 0 ? 1 : directionalValue > 0 ? -1 : 0;
        targetIndex = Math.abs(dx) >= step * 1.35
          ? clampIndex(Math.round(rawIndex))
          : clampIndex(startIndex + direction);
      }

      selectionIndex.stopAnimation();
      if (reducedMotionRef.current) {
        selectionIndex.setValue(targetIndex);
      } else {
        Animated.spring(selectionIndex, {
          toValue: targetIndex,
          speed: 18,
          bounciness: 0,
          useNativeDriver: true,
        }).start();
      }

      if (targetIndex !== activeIndexRef.current) {
        router.navigate(ITEMS[targetIndex].href);
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);
        return (
          slotStepRef.current > 0 &&
          horizontal >= NAV_SWIPE_ACTIVATION_PX &&
          horizontal > vertical * 1.25
        );
      },
      onPanResponderGrant: () => {
        startIndexRef.current = activeIndexRef.current;
        selectionIndex.stopAnimation();
        selectionIndex.setValue(activeIndexRef.current);
      },
      onPanResponderMove: (_event, gestureState) => {
        const step = slotStepRef.current;
        if (step <= 0) return;
        const nextIndex = clampIndex(
          startIndexRef.current - gestureState.dx / step,
        );
        selectionIndex.setValue(nextIndex);
      },
      onPanResponderRelease: (_event, gestureState) => {
        settle(gestureState.dx, gestureState.vx);
      },
      onPanResponderTerminate: () => {
        // System/parent termination is a cancellation, never a tab commit.
        settle(0, 0);
      },
      onPanResponderTerminationRequest: () => true,
    });
  }, [router, selectionIndex]);

  const selectionTranslateX = useMemo(() => selectionIndex.interpolate({
    inputRange: [0, ITEMS.length - 1],
    outputRange: [0, slotStep * (ITEMS.length - 1)],
  }), [selectionIndex, slotStep]);

  const PreviewHighlight = highlight === null
    ? null
    : (require('expo-linear-gradient') as typeof import('expo-linear-gradient')).LinearGradient;

  return (
    <View
      accessibilityLabel="Primary navigation"
      accessibilityRole="tablist"
      style={[
        styles.outer,
        {
          paddingBottom: Math.max(insets.bottom, wavenSpacing.sm),
        },
      ]}
    >
      <View
        {...panResponder.panHandlers}
        onLayout={handleInnerLayout}
        style={styles.inner}
      >
        {PreviewHighlight && highlight ? (
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 26,
            }}
          >
            <PreviewHighlight
              colors={highlight}
              locations={[0, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}

        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.selectionPill,
              {
                width: slotWidth,
                transform: [{ translateX: selectionTranslateX }],
              },
            ]}
          />
        ) : null}

        {ITEMS.map((item, index) => {
          const active = index === activeIndex;

          return (
            <WavenNavItem
              active={active}
              item={item}
              key={item.href}
              labelScale={labelScale}
              onPress={() => {
                if (!active) router.navigate(item.href);
              }}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'transparent',
    paddingHorizontal: wavenSpacing.md,
    paddingTop: 8,
  },
  inner: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: wavenColors.navGlass,
    borderColor: wavenColors.borderStrong,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: ITEM_GAP,
    maxWidth: wavenLayout.navCompactMaxWidth,
    minHeight: wavenLayout.bottomNavBaseHeight,
    overflow: 'hidden',
    padding: TRACK_PADDING,
    position: 'relative',
    width: '100%',
  },
  selectionPill: {
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    position: 'absolute',
    top: TRACK_PADDING,
  },
  itemContainer: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
  },
  pressable: {
    width: '100%',
  },
  itemContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
    width: '100%',
  },
  iconStack: {
    height: 22,
    position: 'relative',
    width: 24,
  },
  iconOverlay: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  labelClip: {
    bottom: 0,
    justifyContent: 'center',
    left: '50%',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  labelActive: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
  iconBox: {
    height: 22,
    justifyContent: 'center',
    position: 'relative',
    width: 24,
  },
  searchRing: {
    borderRadius: 8,
    borderWidth: 1.8,
    height: 14,
    left: 3,
    position: 'absolute',
    top: 2,
    width: 14,
  },
  searchHandle: {
    borderRadius: 999,
    bottom: 3,
    height: 2,
    position: 'absolute',
    right: 3,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  libraryIcon: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    paddingBottom: 1,
  },
  libraryBar: {
    borderRadius: 2,
    width: 4,
  },
  homeRoof: {
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderLeftWidth: 9,
    borderRightColor: 'transparent',
    borderRightWidth: 9,
    height: 0,
    left: 3,
    position: 'absolute',
    top: 1,
    width: 0,
  },
  homeBody: {
    borderRadius: 3,
    borderWidth: 1.8,
    bottom: 2,
    height: 11,
    left: 5,
    position: 'absolute',
    width: 14,
  },
});

const noirStyles = styles;
