import { StyleSheet, View } from 'react-native';
import { wavenColors, wavenRadii } from '../../theme/tokens';

export type WavenExploreIconKind = 'songs' | 'artists' | 'albums';

export function WavenExploreIcon({
  kind,
  size,
}: {
  kind: WavenExploreIconKind;
  size: number;
}) {
  const scale = size / 96;
  const px = (value: number) => Math.max(1, value * scale);

  return (
    <View
      accessible={false}
      style={[
        styles.tile,
        {
          borderRadius: Math.max(wavenRadii.md, size * 0.22),
          height: size,
          width: size,
        },
      ]}
    >
      <View style={styles.topSheen} />
      <View
        style={[
          styles.halo,
          {
            borderRadius: size * 0.34,
            height: size * 0.68,
            width: size * 0.68,
          },
        ]}
      />

      {kind === 'songs' ? (
        <View style={{ height: px(50), width: px(50) }}>
          <View
            style={[
              styles.noteStem,
              {
                height: px(30),
                left: px(15),
                top: px(7),
                width: px(4),
              },
            ]}
          />
          <View
            style={[
              styles.noteStem,
              {
                height: px(32),
                right: px(5),
                top: px(4),
                width: px(4),
              },
            ]}
          />
          <View
            style={[
              styles.noteBeam,
              {
                height: px(6),
                left: px(15),
                top: px(5),
                width: px(30),
              },
            ]}
          />
          <View
            style={[
              styles.noteHead,
              {
                bottom: px(3),
                height: px(13),
                left: px(4),
                width: px(17),
              },
            ]}
          />
          <View
            style={[
              styles.noteHead,
              {
                bottom: px(3),
                height: px(13),
                right: 0,
                width: px(17),
              },
            ]}
          />
          <View
            style={[
              styles.noteAccent,
              {
                height: px(4),
                right: px(8),
                top: px(5),
                width: px(9),
              },
            ]}
          />
        </View>
      ) : null}

      {kind === 'artists' ? (
        <View style={{ alignItems: 'center', height: px(50), width: px(44) }}>
          <View
            style={[
              styles.micCapsule,
              {
                borderRadius: px(14),
                height: px(28),
                width: px(18),
              },
            ]}
          >
            <View
              style={[
                styles.micSignal,
                {
                  borderRadius: px(2),
                  height: px(13),
                  width: px(3),
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.micCradle,
              {
                borderBottomLeftRadius: px(14),
                borderBottomRightRadius: px(14),
                height: px(20),
                top: px(13),
                width: px(30),
              },
            ]}
          />
          <View
            style={[
              styles.micStand,
              { height: px(10), top: px(31), width: px(3) },
            ]}
          />
          <View
            style={[
              styles.micBase,
              { height: px(3), top: px(41), width: px(22) },
            ]}
          />
        </View>
      ) : null}

      {kind === 'albums' ? (
        <View style={{ height: px(48), width: px(50) }}>
          <View
            style={[
              styles.albumBack,
              {
                borderRadius: px(7),
                height: px(34),
                left: px(1),
                top: px(3),
                width: px(34),
              },
            ]}
          />
          <View
            style={[
              styles.albumFront,
              {
                borderRadius: px(8),
                bottom: px(2),
                height: px(37),
                right: px(1),
                width: px(37),
              },
            ]}
          >
            <View
              style={[
                styles.albumDisc,
                {
                  borderRadius: px(11),
                  height: px(22),
                  width: px(22),
                },
              ]}
            >
              <View
                style={[
                  styles.albumDiscCore,
                  {
                    borderRadius: px(3),
                    height: px(6),
                    width: px(6),
                  },
                ]}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 11, 17, 0.82)',
    borderColor: 'rgba(213, 225, 234, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  topSheen: {
    backgroundColor: 'rgba(237, 244, 249, 0.06)',
    height: StyleSheet.hairlineWidth,
    left: 10,
    position: 'absolute',
    right: 10,
    top: 0,
  },
  halo: {
    backgroundColor: 'rgba(40, 157, 224, 0.035)',
    borderColor: 'rgba(72, 178, 235, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  noteStem: {
    backgroundColor: wavenColors.textSecondary,
    borderRadius: 999,
    position: 'absolute',
  },
  noteBeam: {
    backgroundColor: wavenColors.textSecondary,
    borderRadius: 999,
    position: 'absolute',
    transform: [{ rotate: '-8deg' }],
  },
  noteHead: {
    backgroundColor: wavenColors.textSecondary,
    borderRadius: 999,
    position: 'absolute',
    transform: [{ rotate: '-16deg' }],
  },
  noteAccent: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 999,
    position: 'absolute',
  },
  micCapsule: {
    alignItems: 'center',
    borderColor: wavenColors.textSecondary,
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  micSignal: {
    backgroundColor: wavenColors.interactionBlue,
  },
  micCradle: {
    borderBottomColor: wavenColors.textSecondary,
    borderBottomWidth: 2,
    borderLeftColor: wavenColors.textSecondary,
    borderLeftWidth: 2,
    borderRightColor: wavenColors.textSecondary,
    borderRightWidth: 2,
    position: 'absolute',
  },
  micStand: {
    backgroundColor: wavenColors.textSecondary,
    borderRadius: 999,
    position: 'absolute',
  },
  micBase: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 999,
    position: 'absolute',
  },
  albumBack: {
    backgroundColor: 'rgba(216, 225, 232, 0.06)',
    borderColor: 'rgba(214, 225, 234, 0.38)',
    borderWidth: 1.5,
    position: 'absolute',
    transform: [{ rotate: '-8deg' }],
  },
  albumFront: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 17, 24, 0.96)',
    borderColor: wavenColors.textSecondary,
    borderWidth: 1.5,
    justifyContent: 'center',
    position: 'absolute',
  },
  albumDisc: {
    alignItems: 'center',
    borderColor: wavenColors.interactionBlue,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  albumDiscCore: {
    backgroundColor: wavenColors.textSecondary,
  },
});
