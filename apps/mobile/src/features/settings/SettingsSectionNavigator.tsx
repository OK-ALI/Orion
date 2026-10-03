import React, { useMemo, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, fontSizes } from '@orion/shared/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';
import type { MobileSettingsSectionDefinition, MobileSettingsSectionId } from './settingsArchitecture';
import { moveSettingsSection } from './settingsSectionOrderPreferences';

const SECTION_ICONS: Partial<Record<MobileSettingsSectionId, React.ComponentProps<typeof Ionicons>['name']>> = {
  appearance: 'color-palette-outline',
  performance: 'speedometer-outline',
  home: 'home-outline',
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

function SettingsSectionOption({
  section,
  index,
  total,
  selected,
  onSelect,
}: {
  section: MobileSettingsSectionDefinition;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { theme, preferences, systemReducedMotion } = useOrionTheme();
  const motion = resolveMotionPolicy(preferences?.reducedMotion === true, systemReducedMotion);
  const dragY = React.useRef(new Animated.Value(0)).current;
  const rowHeight = React.useRef(54);
  const currentIndex = React.useRef(index);
  const startIndex = React.useRef(index);
  const [dragging, setDragging] = React.useState(false);
  currentIndex.current = index;

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => {
      startIndex.current = currentIndex.current;
      setDragging(true);
    },
    onPanResponderMove: (_, gesture) => {
      const step = Math.max(1, rowHeight.current + spacing[2]);
      const targetIndex = Math.max(0, Math.min(total - 1, startIndex.current + Math.round(gesture.dy / step)));
      if (targetIndex !== currentIndex.current) {
        moveSettingsSection(section.id, targetIndex);
        currentIndex.current = targetIndex;
      }
      const movedSlots = currentIndex.current - startIndex.current;
      dragY.setValue(gesture.dy - movedSlots * step);
    },
    onPanResponderRelease: () => {
      setDragging(false);
      Animated.timing(dragY, {
        toValue: 0,
        duration: motion.reduceMotion ? 0 : 120,
        useNativeDriver: false,
      }).start();
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      Animated.timing(dragY, {
        toValue: 0,
        duration: motion.reduceMotion ? 0 : 120,
        useNativeDriver: false,
      }).start();
    },
  }), [dragY, motion.reduceMotion, section.id, total]);

  const moveBy = (delta: number) => moveSettingsSection(section.id, index + delta);

  return (
    <Animated.View
      onLayout={(event: LayoutChangeEvent) => { rowHeight.current = event.nativeEvent.layout.height; }}
      style={[
        styles.option,
        {
          backgroundColor: dragging || selected ? theme.accentSoft : theme.surface,
          borderColor: dragging || selected ? theme.accent : theme.border,
          transform: [{ translateY: dragY }],
          zIndex: dragging ? 5 : 0,
        },
      ]}
    >
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${section.label} Settings section`}
        accessibilityHint="Drag to reorder Settings, or use Move up and Move down actions."
        accessibilityActions={[
          ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
          ...(index < total - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'moveUp') moveBy(-1);
          if (event.nativeEvent.actionName === 'moveDown') moveBy(1);
        }}
        style={[styles.dragHandle, { backgroundColor: theme.surfaceHover }]}
        {...panResponder.panHandlers}
      >
        <Ionicons name="reorder-three-outline" size={22} color={theme.textSecondary} />
      </View>

      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={`${section.label} Settings section`}
        accessibilityState={{ checked: selected }}
        onPress={onSelect}
        style={({ pressed }) => [styles.optionTarget, pressed && { backgroundColor: theme.surfaceHover }]}
      >
        <View style={[styles.optionIcon, { backgroundColor: theme.surfaceHover }]}>
          <Ionicons name={SECTION_ICONS[section.id] || 'options-outline'} size={19} color={selected ? theme.accent : theme.textSecondary} />
        </View>
        <Text style={[styles.optionLabel, { color: theme.text }]}>{section.label}</Text>
        {selected && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
      </Pressable>
    </Animated.View>
  );
}

export function SettingsSectionNavigator({ sections, currentSectionId, onSelect }: SettingsSectionNavigatorProps) {
  const { theme, preferences, systemReducedMotion } = useOrionTheme();
  const motion = resolveMotionPolicy(preferences?.reducedMotion === true, systemReducedMotion);
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
        animationType={motion.reduceMotion ? 'fade' : 'slide'}
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
              <View style={styles.sheetHeadingCopy}>
                <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.text }]}>Jump to section</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>Tap to jump, or drag to arrange Settings.</Text>
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

            <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {sections.map((section, index) => (
                <SettingsSectionOption
                  key={section.id}
                  section={section}
                  index={index}
                  total={sections.length}
                  selected={section.id === currentSectionId}
                  onSelect={() => {
                    setOpen(false);
                    onSelect(section.id);
                  }}
                />
              ))}
            </ScrollView>
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
  sheetHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[4], marginBottom: spacing[4] },
  sheetHeadingCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: fontSizes.lg, fontWeight: '900' },
  sheetSubtitle: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  options: { flexGrow: 0 },
  optionsContent: { gap: spacing[2], paddingBottom: spacing[1] },
  option: { minHeight: 58, borderWidth: 1, borderRadius: radii.xl, padding: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dragHandle: { width: 44, minHeight: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  optionTarget: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: radii.lg, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionIcon: { width: 36, height: 36, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: fontSizes.sm, fontWeight: '800' },
});
