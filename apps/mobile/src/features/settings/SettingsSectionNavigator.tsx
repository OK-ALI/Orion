import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, fontSizes } from '@orion/shared/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';
import type { MobileSettingsSectionDefinition, MobileSettingsSectionId } from './settingsArchitecture';

const SECTION_ICONS: Partial<Record<MobileSettingsSectionId, React.ComponentProps<typeof Ionicons>['name']>> = {
  appearance: 'color-palette-outline',
  performance: 'speedometer-outline',
  accessibility: 'accessibility-outline',
  notifications: 'notifications-outline',
  account: 'person-circle-outline',
  sync: 'sync-outline',
  playback: 'play-circle-outline',
  connect: 'phone-portrait-outline',
  downloads: 'download-outline',
  updates: 'cloud-download-outline',
};

interface SettingsSectionNavigatorProps {
  sections: readonly MobileSettingsSectionDefinition[];
  currentSectionId: MobileSettingsSectionId;
  onSelect: (id: MobileSettingsSectionId) => void;
}

export function SettingsSectionNavigator({ sections, currentSectionId, onSelect }: SettingsSectionNavigatorProps) {
  const { theme, preferences } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = useMemo(
    () => sections.find((section) => section.id === currentSectionId) || sections[0],
    [currentSectionId, sections],
  );

  if (!current || sections.length < 2) return null;

  return (
    <>
      <View style={[styles.bar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jump to Settings section"
          accessibilityHint={`Current section is ${current.label}. Opens the section navigator.`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.trigger,
            { backgroundColor: theme.elevated, borderColor: theme.border },
            pressed && { backgroundColor: theme.surfaceHover },
          ]}
        >
          <Ionicons name="list-outline" size={18} color={theme.accent} />
          <Text style={[styles.triggerLabel, { color: theme.textSecondary }]}>Jump to section</Text>
          <Text numberOfLines={1} style={[styles.currentLabel, { color: theme.text }]}>{current.label}</Text>
          <Ionicons name="chevron-down" size={17} color={theme.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType={preferences.reducedMotion ? 'fade' : 'slide'}
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close section navigator"
            style={styles.backdrop}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
                paddingBottom: Math.max(spacing[5], insets.bottom + spacing[3]),
              },
            ]}
          >
            <View style={styles.sheetHeading}>
              <View>
                <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.text }]}>Jump to section</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>Move directly within Settings.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close section navigator"
                hitSlop={6}
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && { backgroundColor: theme.surfaceHover }]}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.options}>
              {sections.map((section) => {
                const selected = section.id === currentSectionId;
                return (
                  <Pressable
                    key={section.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${section.label} Settings section`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setOpen(false);
                      onSelect(section.id);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: selected ? theme.accentSoft : theme.surface,
                        borderColor: selected ? theme.accent : theme.border,
                      },
                      pressed && { backgroundColor: theme.surfaceHover },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.surfaceHover }]}>
                      <Ionicons name={SECTION_ICONS[section.id] || 'options-outline'} size={19} color={selected ? theme.accent : theme.textSecondary} />
                    </View>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{section.label}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing[5], paddingVertical: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth },
  trigger: { minHeight: 46, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  triggerLabel: { fontSize: fontSizes.xs, fontWeight: '700' },
  currentLabel: { flex: 1, textAlign: 'right', fontSize: fontSizes.sm, fontWeight: '900' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.56)' },
  sheet: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], paddingTop: spacing[4], paddingHorizontal: spacing[5], maxHeight: '82%' },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[4], marginBottom: spacing[4] },
  sheetTitle: { fontSize: fontSizes.lg, fontWeight: '900' },
  sheetSubtitle: { fontSize: fontSizes.xs, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  options: { gap: spacing[2] },
  option: { minHeight: 54, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { width: 36, height: 36, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: fontSizes.sm, fontWeight: '800' },
});
