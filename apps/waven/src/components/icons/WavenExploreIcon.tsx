import { StyleSheet, View } from 'react-native';
import { wavenColors } from '../../theme/tokens';

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
      style={[styles.iconField, { height: size, width: size }]}
    >
      <View
        style={[
          styles.halo,
          {
            borderRadius: size * 0.36,
            height: size * 0.72,
            width: size * 0.72,
          },
        ]}
      />

      {kind === 'songs' ? (
        <View style={[styles.symbolStage, { height: px(50), width: px(46) }]}>
          <View
            style={[
              styles.songStem,
              { height: px(30), left: px(25), top: px(6), width: px(4) },
            ]}
          />
          <View
            style={[
              styles.songFlag,
              { height: px(4), left: px(26), top: px(6), width: px(13) },
            ]}
          />
          <View
            style={[
              styles.songHead,
              {
                borderRadius: px(8),
                bottom: px(6),
                height: px(12),
                left: px(15),
                width: px(15),
              },
            ]}
          />
        </View>
      ) : null}

      {kind === 'artists' ? (
        <View style={[styles.symbolStage, { height: px(52), width: px(56) }]}>
          <View
            style={[
              styles.artistHead,
              {
                borderRadius: px(10),
                height: px(19),
                left: px(12),
                top: px(5),
                width: px(19),
              },
            ]}
          />
          <View
            style={[
              styles.artistBust,
              {
                borderBottomLeftRadius: px(7),
                borderBottomRightRadius: px(7),
                borderTopLeftRadius: px(18),
                borderTopRightRadius: px(18),
                bottom: px(5),
                height: px(23),
                left: px(4),
                width: px(36),
              },
            ]}
          />
          <View style={[styles.artistSignalBar, { height: px(10), left: px(43), top: px(24), width: px(3) }]} />
          <View style={[styles.artistSignalBar, { height: px(18), left: px(49), top: px(20), width: px(3) }]} />
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
  iconField: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    backgroundColor: 'rgba(40, 157, 224, 0.04)',
    borderColor: 'rgba(72, 178, 235, 0.13)',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  symbolStage: {
    position: 'relative',
  },
  songStem: {
    backgroundColor: wavenColors.textSecondary,
    borderRadius: 999,
    position: 'absolute',
  },
  songFlag: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 999,
    position: 'absolute',
    transform: [{ rotate: '10deg' }],
  },
  songHead: {
    backgroundColor: wavenColors.interactionBlue,
    position: 'absolute',
    transform: [{ rotate: '-12deg' }],
  },
  artistHead: {
    backgroundColor: wavenColors.textSecondary,
    position: 'absolute',
  },
  artistBust: {
    backgroundColor: wavenColors.textSecondary,
    position: 'absolute',
  },
  artistSignalBar: {
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
