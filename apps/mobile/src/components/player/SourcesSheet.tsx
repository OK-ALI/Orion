import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accent, fontSizes, radii, spacing } from '@orion/shared/tokens';
import { getMobileSourceHealth } from '../../services/sourceHealth';
import { useOrionTheme } from '../../context/ThemeContext';
import { MOBILE_PLAYER_SOURCES } from '../../features/playback/mobileSources';

interface SourcesSheetProps {
  currentSourceId: string;
  onSelect: (sourceId: string) => void;
  onClose: () => void;
  mediaType?: 'movie' | 'tv';
}

// Rich Source Metadata & Labels
const SOURCE_DETAILS: Record<string, { label: string; badge: string; badgeColor: string }> = {
  videasy: { label: 'VidEasy Ultra', badge: 'FAST • 1080p', badgeColor: '#10b981' },
  vidsrc: { label: 'VidSrc Primary', badge: 'RECOMMENDED', badgeColor: '#67e8f9' },
  vidking: { label: 'VidKing Cinema', badge: 'HIGH SPEED', badgeColor: '#3b82f6' },
  vidlink: { label: 'VidLink Engine', badge: 'EXP', badgeColor: '#f59e0b' },
  autoembed: { label: 'AutoEmbed Direct', badge: 'MULTI-HOST', badgeColor: '#a855f7' },
  vsembed: { label: 'VSEmbed Stream', badge: 'STABLE', badgeColor: '#10b981' },
  '111movies': { label: '111Movies Server', badge: 'EXP', badgeColor: '#f59e0b' },
  vixsrc: { label: 'VixSrc Stream', badge: 'EXP', badgeColor: '#f59e0b' },
  allmanga: { label: 'AllManga Anime', badge: 'ANIME SPECIAL', badgeColor: '#ec4899' },
};

export function SourcesSheet({ currentSourceId, onSelect, onClose, mediaType = 'movie' }: SourcesSheetProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { theme } = useOrionTheme();

  return (
    <View style={[styles.overlay, isLandscape && styles.overlayLandscape]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheetContent, { backgroundColor: theme.elevated, borderColor: theme.border }, isLandscape && styles.sheetContentLandscape]}>
        {/* Top Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="server-outline" size={18} color={theme.accent} />
            <Text style={[styles.title, { color: theme.text }]}>Streaming Servers</Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={theme.text} />
          </Pressable>
        </View>

        {/* Compact Sources List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {MOBILE_PLAYER_SOURCES.map((source) => {
            const isActive = source.id === currentSourceId;
            const runtimeHealth = getMobileSourceHealth(source.id, mediaType);
            const isCoolingDown = Boolean(runtimeHealth?.cooldownUntil && runtimeHealth.cooldownUntil > Date.now());
            const supportsMedia = mediaType === 'movie' ? source.media.movie : source.media.tv;
            const meta = SOURCE_DETAILS[source.id] || {
              label: source.id.toUpperCase(),
              badge: source.health === 'experimental' ? 'EXP' : 'STABLE',
              badgeColor: '#f59e0b',
            };

            return (
              <Pressable
                key={source.id}
                disabled={!supportsMedia}
                style={({ pressed }) => [
                  styles.sourceRow,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  isActive && styles.activeRow,
                  isActive && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                  !supportsMedia && styles.disabledRow,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  onSelect(source.id);
                  onClose();
                }}
              >
                {/* Left Icon + Title */}
                <View style={styles.leftCol}>
                  <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                    <Ionicons 
                      name={isActive ? "play" : "hardware-chip-outline"} 
                      size={14} 
                      color={isActive ? theme.onAccent : theme.textSecondary}
                    />
                  </View>

                  <View style={styles.nameCol}>
                    <Text style={[styles.sourceName, { color: theme.textSecondary }, isActive && styles.activeText, isActive && { color: theme.text }]}>
                      {meta.label}
                    </Text>

                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: `${meta.badgeColor}22`, borderColor: `${meta.badgeColor}55` }]}>
                        <Text style={[styles.badgeText, { color: meta.badgeColor }]}>{meta.badge}</Text>
                      </View>
                      {runtimeHealth?.state && runtimeHealth.state !== 'unknown' && (
                        <Text style={[
                          styles.healthText,
                          runtimeHealth.state === 'failed' && styles.healthFailed,
                        ]}>
                          {isCoolingDown ? 'Cooling down' : runtimeHealth.state}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Right Selection Radio / Checkmark */}
                {isActive ? (
                  <View style={styles.activeCheckPill}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.onAccent} />
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                ) : (
                  <View style={styles.unselectedDot} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  sheetContent: {
    backgroundColor: '#0d0d16',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  sheetContentLandscape: {
    width: 400,
    alignSelf: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
    paddingBottom: 16,
  },
  overlayLandscape: {
    justifyContent: 'center',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing[3],
    gap: 6,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  activeRow: {
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
    borderColor: accent.primary,
  },
  disabledRow: {
    opacity: 0.48,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeIconContainer: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  nameCol: {
    gap: 2,
  },
  sourceName: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthText: { color: 'rgba(255,255,255,0.55)', fontSize: 9, textTransform: 'uppercase', fontWeight: '700' },
  healthFailed: { color: '#f87171' },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activeCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: accent.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  activePillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unselectedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
});
