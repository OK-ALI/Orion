import React from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  HOME_RAIL_LABELS,
  moveHomeRail,
  resetHomeLayoutPreferences,
  setHomeRailEnabled,
  useHomeLayoutPreferences,
  type HomeRailId,
} from '../home/homeLayoutPreferences';

function HomeLayoutRow({
  id,
  index,
  total,
  enabled,
  onMove,
}: {
  id: HomeRailId;
  index: number;
  total: number;
  enabled: boolean;
  onMove: (id: HomeRailId, targetIndex: number) => void;
}) {
  const { theme, preferences } = useOrionTheme();
  const dragY = React.useRef(new Animated.Value(0)).current;
  const rowHeight = React.useRef(68);
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
        onMove(id, targetIndex);
        currentIndex.current = targetIndex;
      }
      const movedSlots = currentIndex.current - startIndex.current;
      dragY.setValue(gesture.dy - movedSlots * step);
    },
    onPanResponderRelease: () => {
      setDragging(false);
      Animated.timing(dragY, {
        toValue: 0,
        duration: preferences.reducedMotion ? 0 : 120,
        useNativeDriver: false,
      }).start();
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      Animated.timing(dragY, {
        toValue: 0,
        duration: preferences.reducedMotion ? 0 : 120,
        useNativeDriver: false,
      }).start();
    },
  }), [dragY, id, onMove, preferences.reducedMotion, total]);

  const moveBy = (delta: number) => moveHomeRail(id, index + delta);

  return (
    <Animated.View
      onLayout={(event: LayoutChangeEvent) => { rowHeight.current = event.nativeEvent.layout.height; }}
      style={[
        styles.railRow,
        {
          backgroundColor: dragging ? theme.accentSoft : theme.surface,
          borderColor: dragging ? theme.accent : theme.border,
          transform: [{ translateY: dragY }],
          zIndex: dragging ? 5 : 0,
        },
      ]}
    >
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${HOME_RAIL_LABELS[id]}`}
        accessibilityHint="Drag to reorder, or use Move up and Move down actions."
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
        <Ionicons name="reorder-three-outline" size={24} color={theme.textSecondary} />
      </View>

      <View style={styles.railCopy}>
        <Text style={[styles.railTitle, { color: theme.text }]}>{HOME_RAIL_LABELS[id]}</Text>
        <Text style={[styles.railPosition, { color: theme.textMuted }]}>Position {index + 1}</Text>
      </View>

      <Switch
        accessibilityRole="switch"
        accessibilityLabel={`Show ${HOME_RAIL_LABELS[id]} on Home`}
        accessibilityState={{ checked: enabled }}
        value={enabled}
        onValueChange={(value) => setHomeRailEnabled(id, value)}
        trackColor={{ false: theme.border, true: theme.accentSoft }}
        thumbColor={enabled ? theme.accent : theme.textMuted}
      />
    </Animated.View>
  );
}

export function HomeLayoutSettingsContent() {
  const { theme, preferences } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const layout = useHomeLayoutPreferences();
  const [open, setOpen] = React.useState(false);
  const visibleCount = layout.order.filter((id) => !layout.hidden.includes(id)).length;

  const handleMove = React.useCallback((id: HomeRailId, targetIndex: number) => {
    moveHomeRail(id, targetIndex);
  }, []);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Home Layout"
        accessibilityHint="Choose which Home sections appear and arrange their order"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.entryRow,
          { borderColor: theme.border, backgroundColor: theme.elevated },
          pressed && { backgroundColor: theme.surfaceHover },
        ]}
      >
        <View style={[styles.entryIcon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="home-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.entryCopy}>
          <Text style={[styles.entryTitle, { color: theme.text }]}>Home Layout</Text>
          <Text style={[styles.entryDescription, { color: theme.textSecondary }]}>Choose what appears on Home and arrange your sections.</Text>
          <Text style={[styles.entryStatus, { color: theme.accent }]}>{visibleCount} of {layout.order.length} sections shown</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </Pressable>

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
            accessibilityLabel="Close Home Layout"
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
                <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.text }]}>Home Layout</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>Show, hide, or drag sections into your preferred order.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Home Layout"
                hitSlop={6}
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && { backgroundColor: theme.surfaceHover }]}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <View style={[styles.heroNote, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
              <Text style={[styles.heroNoteText, { color: theme.textSecondary }]}>The featured banner always stays at the top of Home.</Text>
            </View>

            <ScrollView
              style={styles.railList}
              contentContainerStyle={styles.railListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {layout.order.map((id, index) => (
                <HomeLayoutRow
                  key={id}
                  id={id}
                  index={index}
                  total={layout.order.length}
                  enabled={!layout.hidden.includes(id)}
                  onMove={handleMove}
                />
              ))}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restore default Home layout"
              onPress={resetHomeLayoutPreferences}
              style={({ pressed }) => [
                styles.resetButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && { backgroundColor: theme.surfaceHover },
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.resetText, { color: theme.text }]}>Restore default layout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entryRow: { minHeight: 80, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  entryIcon: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  entryCopy: { flex: 1, minWidth: 0 },
  entryTitle: { fontSize: fontSizes.md, fontWeight: '900' },
  entryDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  entryStatus: { fontSize: fontSizes.xs, fontWeight: '800', marginTop: 5 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.56)' },
  sheet: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], paddingTop: spacing[4], paddingHorizontal: spacing[5], maxHeight: '88%' },
  sheetHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3], marginBottom: spacing[3] },
  sheetHeadingCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: fontSizes.lg, fontWeight: '900' },
  sheetSubtitle: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroNote: { minHeight: 48, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing[3] },
  heroNoteText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 18 },
  railList: { flexGrow: 0 },
  railListContent: { gap: spacing[2], paddingBottom: spacing[3] },
  railRow: { minHeight: 68, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dragHandle: { width: 44, minHeight: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  railCopy: { flex: 1, minWidth: 0 },
  railTitle: { fontSize: fontSizes.sm, fontWeight: '800' },
  railPosition: { fontSize: fontSizes.xs, marginTop: 3 },
  resetButton: { minHeight: 48, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resetText: { fontSize: fontSizes.sm, fontWeight: '800' },
});
