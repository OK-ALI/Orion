import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MobilePlayerPresentation, MobilePresentationCapability } from '@orion/shared/types';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';

const OPTIONS: Array<{
  id: MobilePlayerPresentation;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'provider', label: 'Original', description: "Keep the source player's original picture layout.", icon: 'scan-outline' },
  { id: 'fit', label: 'Fit', description: 'Show the entire picture without cropping.', icon: 'contract-outline' },
  { id: 'fill', label: 'Fill', description: 'Fill the screen and crop only what is necessary.', icon: 'expand-outline' },
  { id: 'stretch', label: 'Stretch', description: 'Stretch the picture to the available player bounds.', icon: 'resize-outline' },
];

interface PresentationSheetProps {
  visible: boolean;
  value: MobilePlayerPresentation;
  capability: MobilePresentationCapability;
  onChange(value: MobilePlayerPresentation): void;
  onClose(): void;
}

export function presentationModeLabel(value: MobilePlayerPresentation): string {
  return OPTIONS.find((option) => option.id === value)?.label || 'Original';
}

export function PresentationSheet({ visible, value, capability, onChange, onClose }: PresentationSheetProps) {
  const { theme } = useOrionTheme();
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  const currentLabel = presentationModeLabel(value);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close picture size settings" onPress={onClose} style={[styles.scrim, { backgroundColor: theme.mediaScrim }]}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.panel,
            wide && styles.panelWide,
            { backgroundColor: theme.surface, borderColor: theme.border, maxHeight: height * 0.84 },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.heading}>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>PICTURE</Text>
              <Text style={[styles.title, { color: theme.text }]}>Resize picture</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Current: {currentLabel}. Orion remembers this choice for this player source.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.options, wide && styles.optionsWide]}>
            {OPTIONS.map((option) => {
              const enabled = capability.supported.includes(option.id);
              const selected = option.id === value;
              return (
                <Pressable
                  key={option.id}
                  disabled={!enabled}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} picture size`}
                  accessibilityState={{ selected, disabled: !enabled }}
                  onPress={() => { onChange(option.id); onClose(); }}
                  style={({ pressed }) => [
                    styles.option,
                    wide && styles.optionWide,
                    { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accentSoft : theme.elevated },
                    pressed && enabled && { opacity: 0.82 },
                    !enabled && styles.disabled,
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: selected ? theme.accentSoft : theme.surfaceHover }]}>
                    <Ionicons name={option.icon} size={20} color={selected ? theme.accent : theme.textSecondary} />
                  </View>
                  <View style={styles.optionText}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[styles.optionTitle, { color: enabled ? theme.text : theme.textMuted }]}>{option.label}</Text>
                      {selected ? (
                        <View style={[styles.currentChip, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
                          <Text style={[styles.currentChipText, { color: theme.accent }]}>Current</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.description, { color: theme.textSecondary }]}>{enabled ? option.description : capability.unsupportedReason || 'This source does not support this picture size.'}</Text>
                  </View>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? theme.accent : theme.textMuted} />
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
  panel: { width: '100%', maxWidth: 660, alignSelf: 'center', borderWidth: 1, borderRadius: radii.xl, overflow: 'hidden' },
  panelWide: { marginVertical: 'auto' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing[5], borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flex: 1, paddingRight: spacing[3] },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { marginTop: spacing[1], fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: spacing[2], fontSize: 12, lineHeight: 18 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  options: { padding: spacing[4], gap: spacing[3] },
  optionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { minHeight: 82, borderWidth: 1, borderRadius: radii.lg, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  optionWide: { width: '48%', flexGrow: 1 },
  optionIcon: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, minWidth: 0 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  optionTitle: { fontSize: 17, fontWeight: '700' },
  currentChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  currentChipText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  description: { marginTop: 3, lineHeight: 19 },
  disabled: { opacity: 0.48 },
});
