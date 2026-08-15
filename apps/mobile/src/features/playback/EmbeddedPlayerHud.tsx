import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShieldVerificationState } from '@orion/shared/types';
import { playerStyles as styles } from './playerStyles';
import { PlayerChromeHandle } from '../../components/player/PlayerChromeHandle';

interface EmbeddedPlayerHudProps {
  visible: boolean;
  compact: boolean;
  title: string;
  sourceLabel: string;
  shieldState: ShieldVerificationState;
  blockedRequests: number;
  nativeShieldObserved: boolean;
  landscape: boolean;
  onReveal(): void;
  onCollapse(): void;
  onBack(): void;
  onPresentation(): void;
  onShield(): void;
  onSubtitles(): void;
  onRotate(): void;
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
  const insets = useSafeAreaInsets();
  const shieldColor = props.shieldState === 'verified'
    ? '#4ade80'
    : props.shieldState === 'failed' ? '#fb7185' : '#fbbf24';
  return (
    <View style={styles.embedHudLayer} pointerEvents="box-none">
      <PlayerChromeHandle
        controlsVisible={props.visible}
        onPress={props.visible ? props.onCollapse : props.onReveal}
      />
      {props.visible && (
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.65)', 'transparent']}
        style={[styles.fullWidthHeaderGradient, { paddingTop: Math.max(insets.top, 8) }]}
        pointerEvents="box-none"
      >
      <Pressable accessibilityLabel="Back" onPress={props.onBack} style={styles.floatingGlassBackBtn}>
        <Ionicons name="arrow-back" size={18} color="#fff" />
      </Pressable>
      <Pressable accessibilityLabel="Picture mode" onPress={props.onPresentation} style={styles.floatingGlassBackBtn}>
        <Ionicons name="scan-outline" size={16} color="#fff" />
      </Pressable>
      <View style={styles.headerTitleWrapper}>
        <Text style={styles.framelessTitle} numberOfLines={1}>{props.title}</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel={`${protectionText(props.shieldState, props.nativeShieldObserved)}. Open shield details.`}
          onPress={props.onShield}
          style={[
            styles.shieldBadge,
            props.shieldState === 'verified'
              ? styles.shieldBadgeVerified
              : props.shieldState === 'failed' ? styles.shieldBadgeFailed : styles.shieldBadgeLimited,
          ]}
        >
          <Ionicons name={props.shieldState === 'failed' ? 'shield-outline' : 'shield-checkmark'} size={12} color={shieldColor} />
          {props.blockedRequests > 0 && (
            <Text style={[
              styles.shieldCounter,
              props.shieldState === 'verified'
                ? styles.shieldCounterVerified
                : props.shieldState === 'failed' ? styles.shieldCounterFailed : styles.shieldCounterLimited,
            ]}>{props.blockedRequests}</Text>
          )}
          {!props.compact && (
            <Text style={[styles.shieldText, props.shieldState !== 'verified' && styles.shieldTextLimited]}>
              {protectionText(props.shieldState, props.nativeShieldObserved)}
            </Text>
          )}
        </Pressable>
        <Pressable accessibilityLabel="Subtitles" onPress={props.onSubtitles} style={styles.floatingGlassBackBtn}>
          <Ionicons name="chatbox-ellipses-outline" size={16} color="#fff" />
        </Pressable>
        <Pressable accessibilityLabel="Rotate player" onPress={props.onRotate} style={styles.floatingGlassBackBtn}>
          <Ionicons name={props.landscape ? 'refresh-outline' : 'expand-outline'} size={16} color="#fff" />
        </Pressable>
        <Pressable accessibilityLabel={`Sources. Current source ${props.sourceLabel}`} onPress={props.onSources} style={styles.floatingGlassSourceChip}>
          <Ionicons name="hardware-chip-outline" size={14} color="#f87171" />
          {!props.compact && <Text style={styles.sourceChipText} numberOfLines={1}>{props.sourceLabel}</Text>}
        </Pressable>
      </View>
      </LinearGradient>
      )}
    </View>
  );
}
