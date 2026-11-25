import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import type { WavenThemeId } from '../../theme/appearance';
import { getWavenThemeDesign } from '../../theme/themeDesign';
import { WavenAtmosphericCanvas } from './WavenAtmosphericCanvas';

const SKYLINE = [
  { x: 3, width: 10, height: 50 },
  { x: 15, width: 13, height: 78 },
  { x: 31, width: 8, height: 58 },
  { x: 42, width: 16, height: 108 },
  { x: 61, width: 10, height: 73 },
  { x: 74, width: 12, height: 94 },
  { x: 89, width: 8, height: 46 },
] as const;

const STARS = [
  [9, 12], [21, 25], [33, 9], [49, 17],
  [62, 7], [81, 24], [91, 10], [72, 38],
] as const;

const percent = (value: number): `${number}%` => `${value}%`;

export function WavenThemeScene({ theme }: {
  theme: WavenThemeId;
}) {
  const design = getWavenThemeDesign(theme);

  if (theme === 'noir') {
    return (
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <WavenAtmosphericCanvas />
      </View>
    );
  }

  const night = design.environment === 'night-city';

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.scene]}
    >
      <LinearGradient
        colors={design.sky}
        style={StyleSheet.absoluteFill}
      />

      <View style={[
        styles.celestial,
        {
          backgroundColor: design.celestial,
          right: night ? 28 : 42,
        },
      ]} />

      {night ? (
        <>
          {STARS.map(([x, y], index) => (
            <View
              key={index}
              style={[
                styles.star,
                {
                  left: percent(x),
                  top: percent(y),
                  backgroundColor: design.celestial,
                },
              ]}
            />
          ))}

          {SKYLINE.map((building, index) => (
            <View
              key={`distant-${index}`}
              style={[
                styles.building,
                {
                  left: percent(building.x + 2),
                  width: percent(building.width),
                  height: building.height + 24,
                  backgroundColor: design.distant,
                  bottom: 18,
                },
              ]}
            />
          ))}

          {SKYLINE.map((building, index) => (
            <View
              key={`building-${index}`}
              style={[
                styles.building,
                {
                  left: percent(building.x),
                  width: percent(building.width),
                  height: building.height,
                  backgroundColor: design.foreground,
                },
              ]}
            >
              {[0, 1, 2].map(row => (
                <View key={row} style={styles.windowRow}>
                  {[0, 1].map(column => (
                    <View
                      key={column}
                      style={[
                        styles.window,
                        {
                          backgroundColor: design.detail,
                          opacity: (row + column + index) % 3
                            ? 0.64 : 0.18,
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </>
      ) : (
        <>
          <View style={[
            styles.cloud,
            { top: 24, left: -22, width: '58%' },
          ]} />

          <View style={[
            styles.cloud,
            { top: 65, right: -15, width: '45%', opacity: 0.78 },
          ]} />

          <View style={[
            styles.ridge,
            {
              backgroundColor: design.distant,
              left: '-12%',
              bottom: -40,
              transform: [{ rotate: '-13deg' }],
            },
          ]} />

          <View style={[
            styles.ridge,
            {
              backgroundColor: design.foreground,
              right: '-22%',
              bottom: -67,
              transform: [{ rotate: '15deg' }],
            },
          ]} />

          <View style={[
            styles.horizon,
            { backgroundColor: design.detail },
          ]} />
        </>
      )}

      <View style={[
        styles.frame,
        { borderColor: design.panelEdge },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    overflow: 'hidden',
  },

  celestial: {
    position: 'absolute',
    top: 22,
    width: 53,
    height: 53,
    borderRadius: 27,
    opacity: 0.92,
  },

  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
  },

  cloud: {
    position: 'absolute',
    height: 16,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
    transform: [{ rotate: '-5deg' }],
  },

  ridge: {
    position: 'absolute',
    width: '85%',
    height: 110,
  },

  horizon: {
    position: 'absolute',
    bottom: 28,
    left: 14,
    width: '70%',
    height: 2,
    opacity: 0.65,
  },

  building: {
    position: 'absolute',
    bottom: 0,
    paddingTop: 9,
    paddingHorizontal: 4,
    gap: 6,
  },

  windowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  window: {
    width: 3,
    height: 5,
  },

  frame: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderWidth: 1,
    opacity: 0.45,
  },
});
