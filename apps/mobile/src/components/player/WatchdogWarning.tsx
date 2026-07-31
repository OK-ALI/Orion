import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { text, accent, spacing, fontSizes, radii } from '@orion/shared/tokens';

interface WatchdogWarningProps {
  isBuffering: boolean;
  onFailover: () => void;
  onSelectSource: () => void;
  onDismiss: () => void;
}

export function WatchdogWarning({ isBuffering, onFailover, onSelectSource, onDismiss }: WatchdogWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isBuffering) {
      // 15 seconds watchdog
      timeout = setTimeout(() => {
        setShowWarning(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 15000);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowWarning(false));
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isBuffering]);

  if (!showWarning) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={90} tint="dark" style={styles.content}>
        <Pressable style={styles.closeButton} onPress={onDismiss}>
          <Ionicons name="close" size={20} color={text.muted} />
        </Pressable>

        <Ionicons name="warning" size={32} color="#f14668" style={styles.icon} />
        <Text style={styles.title}>Buffering Timeout</Text>
        <Text style={styles.description}>
          This source is taking longer than usual to load. Would you like to switch to a different backend?
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={onSelectSource}>
            <Text style={styles.secondaryText}>Switch Manually</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={onFailover}>
            <Text style={styles.primaryText}>Auto Failover</Text>
          </Pressable>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 320,
    zIndex: 500,
  },
  content: {
    borderRadius: radii.xl,
    padding: spacing[5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    padding: spacing[1],
  },
  icon: {
    marginBottom: spacing[2],
  },
  title: {
    color: '#fff',
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    marginBottom: spacing[2],
  },
  description: {
    color: text.secondary,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginBottom: spacing[5],
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    alignItems: 'center',
  },
  secondaryText: {
    color: text.primary,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: accent.primary,
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
