import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  resolveWavenMaterial,
  type WavenMaterialTheme,
  type WavenMaterialRole,
  type WavenMaterialRendering,
} from '../../theme/adaptiveMaterials';

interface AdaptiveSurfaceProps {
  children: ReactNode;
  theme: WavenMaterialTheme;
  role?: WavenMaterialRole;
  rendering?: WavenMaterialRendering;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native-safe rounded material.
 * No independent animation, backdrop capture or blur loops.
 * Existing touchable children retain ownership of interaction.
 */
export function WavenAdaptiveSurface({
  children,
  theme,
  role = 'panel',
  rendering = 'solid',
  style,
}: AdaptiveSurfaceProps) {
  const material = resolveWavenMaterial(theme, role, rendering);

  return (
    <View
      style={[
        styles.surface,
        style,
        {
          backgroundColor: material.background,
          borderColor: material.edge,
          borderRadius: material.radius,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View
        accessible={false}
        pointerEvents="none"
        style={styles.highlightLayer}
      >
        <LinearGradient
          colors={[material.highlight, material.transparent]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

interface MaterialFadeProps {
  theme: WavenMaterialTheme;
  role?: WavenMaterialRole;
  rendering?: WavenMaterialRendering;
  direction?: 'into-surface' | 'out-of-surface';
  height?: number;
  colorsOverride?: readonly [string, string];
}

/**
 * Decorative boundary blending.
 * Uses the actual surface color rather than transparent black.
 * No touch interception or additional accessibility element.
 */
export function WavenMaterialFade({
  theme,
  role = 'panel',
  rendering = 'solid',
  direction = 'into-surface',
  height = 40,
  colorsOverride,
}: MaterialFadeProps) {
  const material = resolveWavenMaterial(theme, role, rendering);

  const safeHeight = Number.isFinite(height)
    ? Math.min(120, Math.max(0, height))
    : 40;

  const colors: readonly [string, string] =
    colorsOverride ?? (
      direction === 'out-of-surface'
        ? [material.background, material.transparent]
        : [material.transparent, material.background]
    );

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ height: safeHeight, width: '100%' }}
    >
      <LinearGradient
        colors={colors}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
  },
  highlightLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: 999,
  },
});