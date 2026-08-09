import { useMemo } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useOrionTheme } from '../../context/ThemeContext';
import { MobilePageHeader } from '../../components/MobilePageHeader';
import { OrionDialog } from '../../components/OrionDialog';
import { useConnectController } from './useConnectController';
import { createConnectStyles } from './connectStyles';
import { SmartConnectPairingModal } from './SmartConnectPairingModal';
import { UnifiedRemoteSurface } from './UnifiedRemoteSurface';

export default function ConnectScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { theme } = useOrionTheme();
  const styles = useMemo(() => createConnectStyles(theme), [theme]);
  const controller = useConnectController();
  const {
    connectionState, handleDisconnect, isConnected, lockoutSeconds, pulseAnim, qrNotice,
    setPairingMethod, setPinCode, setQrNotice, setShowDisconnectModal, setShowPairingModal,
    showDisconnectModal,
  } = controller;

  const openPairing = (method: 'pin' | 'qr') => {
    setPairingMethod(method);
    if (method === 'pin') setPinCode('');
    setShowPairingModal(true);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[theme.accentSoft, theme.background, theme.background, theme.elevated]} locations={[0, .35, .75, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <MobilePageHeader
        eyebrow="REMOTE"
        title="Orion Connect"
        subtitle="Control Orion Desktop from this device over your local network."
        trailing={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isConnected ? 'Disconnect Orion Desktop' : 'Pair Orion Desktop'}
            style={[styles.statusPill, isConnected ? styles.statusPillConnected : styles.statusPillDisconnected]}
            onPress={() => isConnected ? setShowDisconnectModal(true) : openPairing('pin')}
          >
            <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.success : theme.warning }]} />
            <Text style={styles.statusText}>{isConnected ? 'Live' : 'Pair Desktop'}</Text>
            {isConnected && <Ionicons name="power" size={12} color={theme.success} />}
          </Pressable>
        )}
      />
      {!isConnected ? (
        <ScrollView contentContainerStyle={styles.pairingContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.iconInner}><Ionicons name="wifi-outline" size={44} color={theme.accent} /></View>
          </View>
          <Text style={styles.title}>Smart Remote & TV Pairing</Text>
          <Text style={styles.subtitle}>Control playback and browse Orion Desktop from the same local network.</Text>
          <View style={styles.stepsContainer}>
            {[
              'Open Orion Connect on Desktop.',
              'Keep phone and computer on the same Wi-Fi.',
              'Enter the expiring code or scan the secure QR.',
            ].map((label, index) => <View key={label} style={styles.stepCard}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={styles.stepText}>{label}</Text></View>)}
          </View>
          <View style={styles.pairingBtnGroup}>
            <Pressable style={styles.primaryConnectBtn} onPress={() => openPairing('pin')}><Ionicons name="keypad-outline" size={20} color={theme.onAccent} /><Text style={styles.primaryConnectBtnText}>Enter Pairing Code</Text></Pressable>
            <Pressable style={styles.secondaryConnectBtn} onPress={() => openPairing('qr')}><Ionicons name="camera-outline" size={18} color={theme.text} /><Text style={styles.secondaryConnectBtnText}>Scan QR Code</Text></Pressable>
          </View>
          {connectionState !== 'idle' && <View style={styles.connectionNotice}><Ionicons name="information-circle-outline" size={16} color={connectionState === 'failed' ? theme.danger : theme.warning} /><Text style={styles.connectionNoticeText}>{connectionMessage(connectionState, lockoutSeconds)}</Text></View>}
        </ScrollView>
      ) : <UnifiedRemoteSurface controller={controller} theme={theme} isLandscape={isLandscape} legacyStyles={styles} />}
      <SmartConnectPairingModal controller={controller} />
      <Modal visible={showDisconnectModal} transparent animationType="fade" onRequestClose={() => setShowDisconnectModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.glassModalCard}>
          <View style={styles.disconnectIconGlow}><Ionicons name="power" size={28} color={theme.danger} /></View>
          <Text style={styles.modalTitle}>Disconnect Remote?</Text>
          <Text style={styles.modalSub}>This ends the live remote session. You can reconnect from this trusted device later.</Text>
          <View style={styles.disconnectModalBtnRow}><Pressable style={styles.cancelBtnModal} onPress={() => setShowDisconnectModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable><Pressable style={styles.disconnectConfirmBtn} onPress={handleDisconnect}><Text style={styles.disconnectConfirmText}>Disconnect</Text></Pressable></View>
        </View></View>
      </Modal>
      <OrionDialog visible={Boolean(qrNotice)} title="QR code not recognized" message={qrNotice} icon="qr-code-outline" onDismiss={() => setQrNotice('')} actions={[{ label: 'OK', role: 'primary', onPress: () => setQrNotice('') }]} />
    </View>
  );
}

function connectionMessage(state: string, lockoutSeconds: number) {
  return ({
    discovering: 'Looking for Orion Desktop on this Wi-Fi…', pairing: 'Confirming this device with Orion Desktop…', connected: 'Desktop connection confirmed.', reconnecting: 'Reconnecting to your trusted Desktop…',
    'endpoint-lost': 'Trusted Desktop is currently unavailable.', 'token-rejected': 'This device needs to be paired again.', 'code-expired': 'The pairing code expired. Generate a new code on Desktop.',
    'locked-out': `Pairing is temporarily locked${lockoutSeconds ? ` for ${lockoutSeconds}s` : ''}.`, 'protocol-mismatch': 'Desktop and Mobile use incompatible Connect versions.', failed: 'Orion could not complete the connection.',
  } as Record<string, string>)[state] || '';
}
