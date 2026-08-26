import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { SubtitleTrack } from 'expo-video';
import { useOrionTheme } from '../../context/ThemeContext';

interface OfflineSubtitleSheetProps {
  visible: boolean;
  tracks: readonly SubtitleTrack[];
  selectedKey: string | null;
  onSelect: (track: SubtitleTrack | null) => void;
  onClose: () => void;
}

export function offlineSubtitleTrackKey(track: SubtitleTrack | null | undefined): string | null {
  if (!track) return null;
  return [track.id || '', track.language || '', track.label || '', track.name || ''].join('|');
}

export function OfflineSubtitleSheet({
  visible,
  tracks,
  selectedKey,
  onSelect,
  onClose,
}: OfflineSubtitleSheetProps) {
  const { theme } = useOrionTheme();
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close subtitles"
        style={styles.backdrop}
        onPress={onClose}
      />
      <BlurView intensity={76} tint="dark" style={[styles.sheet, { borderColor: theme.border }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Subtitles</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Downloaded and available offline</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close subtitles"
            style={[styles.closeButton, { backgroundColor: theme.surface }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <SubtitleRow
          label="Off"
          detail="No subtitles"
          selected={selectedKey === null}
          onPress={() => onSelect(null)}
        />

        {tracks.map((track, index) => {
          const key = offlineSubtitleTrackKey(track) || `subtitle-${index}`;
          const label = track.label || track.name || track.language || `Subtitle ${index + 1}`;
          const detail = track.language ? track.language.toUpperCase() : 'Downloaded';
          return (
            <SubtitleRow
              key={key}
              label={label}
              detail={detail}
              selected={selectedKey === key}
              onPress={() => onSelect(track)}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

function SubtitleRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useOrionTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${detail}`}
      style={[styles.row, { borderColor: theme.border, backgroundColor: selected ? theme.surface : 'transparent' }]}
      onPress={onPress}
    >
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text numberOfLines={1} style={[styles.rowDetail, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? theme.accent : theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    width: '92%',
    maxWidth: 480,
    marginBottom: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    overflow: 'hidden',
    gap: 8,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowDetail: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
  },
});
