import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOrionTheme } from '../../context/ThemeContext';
import type { MobilePlayerPresentation, ShieldVerificationState } from '@orion/shared/types';
import { PlayerEdgeDrawer } from '../../components/player/PlayerEdgeDrawer';
import { presentationModeLabel } from '../../components/player/PresentationSheet';

interface EmbeddedPlayerHudProps {
  visible: boolean;
  compact: boolean;
  title: string;
  sourceLabel: string;
  shieldState: ShieldVerificationState;
  blockedRequests: number;
  nativeShieldObserved: boolean;
  landscape: boolean;
  presentation: MobilePlayerPresentation;
  onReveal(): void;
  onCollapse(): void;
  onBack(): void;
  onPresentation(): void;
  onShield(): void;
  onSubtitles(): void;
  onRotate(): void;
  onProviderControls(): void;
  onSources(): void;
}

function protectionText(state: ShieldVerificationState, nativeObserved: boolean) {
  if (state === 'verified') return 'Protected';
  if (state === 'failed') return 'Protection issue';
  if (state === 'unavailable') return 'Protection unavailable';
  if (state === 'dependency-allowed') return 'Protection active';
  return nativeObserved ? 'Shield active' : 'Protection limited';
}

export function EmbeddedPlayerHud(props: EmbeddedPlayerHudProps) {
  const { theme } = useOrionTheme();
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const shieldColor = props.shieldState === 'verified' ? theme.success : props.shieldState === 'failed' ? theme.danger : theme.warning;
  const actions: { label: string; icon: keyof typeof Ionicons.glyphMap; run(): void; color?: string }[] = [
    { label: 'Back', icon: 'arrow-back', run: props.onBack },
    { label: 'Resize picture. Current mode ' + presentationModeLabel(props.presentation) + '.', icon: 'resize-outline', run: props.onPresentation },
    { label: protectionText(props.shieldState, props.nativeShieldObserved) + '. Open shield details.', icon: 'shield-checkmark', run: props.onShield, color: shieldColor },
    { label: 'Subtitles', icon: 'chatbox-ellipses-outline', run: props.onSubtitles },
    { label: 'Use provider controls', icon: 'options-outline', run: props.onProviderControls },
    { label: 'Rotate player', icon: props.landscape ? 'refresh-outline' : 'expand-outline', run: props.onRotate },
    { label: 'Sources. Current source ' + props.sourceLabel, icon: 'hardware-chip-outline', run: props.onSources },
  ];
  const measuredWidths = actions.map((action) => labelWidths[action.label]).filter(Number.isFinite);
  const contentWidth = measuredWidths.length ? Math.max(...measuredWidths) + 82 : undefined;
  return <PlayerEdgeDrawer controlsVisible={props.visible} contentWidth={contentWidth}
    onPress={(open) => open ? props.onReveal() : props.onCollapse()}>
    <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{props.title}</Text>
    <Text numberOfLines={2} style={[styles.meta, { color: theme.textSecondary }]}>{props.sourceLabel}</Text>
    <View style={styles.actions}>
      {actions.map((action) => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
        onPress={action.run} style={({ pressed }) => [styles.action, { backgroundColor: pressed ? theme.accentSoft : theme.surface, borderColor: theme.border }]}>
        <Ionicons name={action.icon} size={18} color={action.color || theme.text} />
        <Text style={[styles.label, { color: action.color || theme.text }]} onTextLayout={({ nativeEvent }) => {
          const measured = Math.ceil(nativeEvent.lines.reduce((sum, line) => sum + line.width, 0)
            + Math.max(0, nativeEvent.lines.length - 1) * 4)
            + (action.color && props.blockedRequests > 0 ? 10 + String(props.blockedRequests).length * 8 : 0);
          setLabelWidths((current) => current[action.label] === measured ? current : { ...current, [action.label]: measured });
        }}>{action.label.startsWith('Sources.') ? 'Sources' : action.label.startsWith('Resize') ? 'Resize' : action.color ? protectionText(props.shieldState, props.nativeShieldObserved) : action.label}</Text>
        {action.color && props.blockedRequests > 0 && <Text style={[styles.shieldCounter, { color: action.color }]}>{props.blockedRequests}</Text>}
      </Pressable>)}
    </View>
  </PlayerEdgeDrawer>;
}
const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '800' }, meta: { fontSize: 11 },
  shieldCounter: { fontSize: 11 },
  actions: { gap: 8 }, action: { minHeight: 44, borderWidth: 1, borderRadius: 12, padding: 10, gap: 10, flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700', flex: 1, flexShrink: 1 },
});
