import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MobilePlayerPresentation, MobilePresentationCapability } from '@orion/shared/types';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';

const OPTIONS: Array<{ id: MobilePlayerPresentation; label: string; description: string }> = [
  { id: 'fit', label: 'Fit', description: 'Show the entire picture without cropping.' },
  { id: 'fill', label: 'Fill', description: 'Fill the player and crop only what is necessary.' },
  { id: 'stretch', label: 'Stretch', description: 'Stretch the picture to the available player bounds.' },
  { id: 'provider', label: 'Provider / Original', description: "Use the source player's own presentation." },
];

interface PresentationSheetProps {
  visible: boolean;
  value: MobilePlayerPresentation;
  capability: MobilePresentationCapability;
  onChange(value: MobilePlayerPresentation): void;
  onClose(): void;
}

export function PresentationSheet({ visible, value, capability, onChange, onClose }: PresentationSheetProps) {
  const { theme } = useOrionTheme();
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close display settings" onPress={onClose} style={[styles.scrim, { backgroundColor: theme.mediaScrim }]}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.panel,
            wide && styles.panelWide,
            { backgroundColor: theme.surface, borderColor: theme.border, maxHeight: height * 0.84 },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>DISPLAY</Text>
              <Text style={[styles.title, { color: theme.text }]}>Picture mode</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.options}>
            {OPTIONS.map((option) => {
              const enabled = capability.supported.includes(option.id);
              const selected = option.id === value;
              return (
                <Pressable
                  key={option.id}
                  disabled={!enabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !enabled }}
                  onPress={() => { onChange(option.id); onClose(); }}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accentSoft : theme.elevated },
                    pressed && enabled && { opacity: 0.82 },
                    !enabled && styles.disabled,
                  ]}
                >
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? theme.accent : theme.textMuted} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: enabled ? theme.text : theme.textMuted }]}>{option.label}</Text>
                    <Text style={[styles.description, { color: theme.textSecondary }]}>{enabled ? option.description : capability.unsupportedReason || 'This source does not support this mode.'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', padding: spacing[3] },
  panel: { width: '100%', maxWidth: 620, alignSelf: 'center', borderWidth: 1, borderRadius: radii.xl, overflow: 'hidden' },
  panelWide: { marginVertical: 'auto' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing[5], borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { marginTop: spacing[1], fontSize: 24, fontWeight: '800' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  options: { padding: spacing[4], gap: spacing[3] },
  option: { minHeight: 76, borderWidth: 1, borderRadius: radii.lg, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 17, fontWeight: '700' },
  description: { marginTop: 3, lineHeight: 19 },
  disabled: { opacity: 0.48 },
});
