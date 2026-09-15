import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      activeProgress.setValue(active ? 1 : 0);
      return;
    }

    Animated.timing(activeProgress, {
      duration: wavenMotion.standardMs,
      toValue: active ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [active, activeProgress, reducedMotion]);

  const labelWidth = LABEL_WIDTHS[item.label] * labelScale;

  return (
    <WavenPressable
      accessibilityLabel={item.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      containerStyle={styles.itemContainer}
      onPress={onPress}
      style={styles.pressable}
    >
      <View style={styles.itemContent}>
        <View style={styles.iconStack}>
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
        </View>

        <Animated.View
          style={[
            styles.labelClip,
            {
              marginLeft: activeProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 8],
              }),
              opacity: activeProgress,
              width: activeProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, labelWidth],
              }),
            },
          ]}
        >
          <Text
            maxFontSizeMultiplier={labelScale}
            numberOfLines={1}
            style={styles.labelActive}
          >
            {item.label}
          </Text>
        </Animated.View>
      </View>
    </WavenPressable>
  );
}

export function WavenBottomNav() {
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

  const selectionTranslateX = selectionIndex.interpolate({
    inputRange: [0, ITEMS.length - 1],
    outputRange: [0, slotStep * (ITEMS.length - 1)],
  });

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
      <View onLayout={handleInnerLayout} style={styles.inner}>
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
    overflow: 'hidden',
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
