import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  MOBILE_LIBRARY_SORT_OPTIONS,
  type MobileLibrarySort,
} from './librarySort';

interface LibrarySortDialogProps {
  visible: boolean;
  selected: MobileLibrarySort;
  onSelect: (sort: MobileLibrarySort) => void;
  onDismiss: () => void;
}

export function LibrarySortDialog({
  visible,
  selected,
  onSelect,
  onDismiss,
}: LibrarySortDialogProps) {
  const { theme, preferences } = useOrionTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={preferences.reducedMotion ? 'fade' : 'slide'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close sort options"
        style={[styles.backdrop, { backgroundColor: theme.mediaScrim }]}
        onPress={onDismiss}
      >
        <Pressable
          accessibilityRole="none"
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[styles.sheet, { backgroundColor: theme.elevated, borderColor: theme.border }]}
        >
          <View style={styles.heading}>
            <View>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>MY LIST</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Sort titles</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sort options"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.close,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View accessibilityRole="radiogroup" style={styles.options}>
            {MOBILE_LIBRARY_SORT_OPTIONS.map((option) => {
              const checked = option.id === selected;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked }}
                  onPress={() => onSelect(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: checked ? theme.accent : theme.border,
                      backgroundColor: checked ? theme.accentSoft : theme.surface,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                  <Ionicons
                    name={checked ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={checked ? theme.accent : theme.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    borderWidth: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 34,
  },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, marginBottom: 5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  options: { gap: 10, marginTop: 20 },
  option: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});