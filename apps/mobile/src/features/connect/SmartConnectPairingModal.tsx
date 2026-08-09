import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { createConnectStyles } from './connectStyles';
import type { ConnectController } from './useConnectController';

interface SmartConnectPairingModalProps {
  controller: ConnectController;
}

export function SmartConnectPairingModal({ controller }: SmartConnectPairingModalProps) {
  const { width, height } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { theme } = useOrionTheme();
  const styles = useMemo(() => createConnectStyles(theme), [theme]);
  const muted = theme.textMuted;
  const wide = width >= 600 || width > height;
  const {
    cameraPermission,
    chooseDiscoveredDesktop,
    connectionState,
    desktopIp,
    discoveredDesktops,
    discoverDesktop,
    handleBarCodeScanned,
    handleConnect,
    handlePinChange,
    hiddenPinInputRef,
    isConnecting,
    isDiscovering,
    lockoutSeconds,
    attemptsRemaining,
    pairError,
    pairingMethod,
    pinCode,
    prepareDirectIp,
    requestCameraPermission,
    runSubnetFallback,
    scanLineAnim,
    setDesktopIp,
    setPairingMethod,
    setShowPairingModal,
    showPairingModal,
  } = controller;

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  const focusPin = () => InteractionManager.runAfterInteractions(() => hiddenPinInputRef.current?.focus());

  return (
    <Modal
      visible={showPairingModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPairingModal(false)}
      onShow={() => { if (pairingMethod === 'pin') focusPin(); }}
    >
      <KeyboardAvoidingView style={styles.modalKeyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.modalOverlay, !wide && styles.modalOverlayPhone]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          bounces={false}
        >
          <View style={[
            styles.glassModalCard,
            wide ? styles.glassModalCardWide : styles.glassModalCardPhone,
            keyboardVisible && styles.glassModalCardKeyboard,
          ]}>
            <View style={styles.modalMethodTabs}>
              {([
                ['pin', 'keypad-outline', 'PIN Code'],
                ['qr', 'qr-code-outline', 'QR Scan'],
                ['ip', 'wifi-outline', 'Direct IP'],
              ] as const).map(([method, icon, label]) => (
                <Pressable
                  key={method}
                  style={[styles.modalMethodTab, pairingMethod === method && styles.modalMethodTabActive]}
                  onPress={() => {
                    setPairingMethod(method);
                    if (method === 'pin') focusPin();
                  }}
                >
                  <Ionicons name={icon} size={14} color={pairingMethod === method ? theme.onAccent : muted} />
                  <Text style={[styles.modalMethodTabText, pairingMethod === method && styles.modalMethodTabTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {pairingMethod === 'pin' && (
              <View style={styles.pinSection}>
                <Text style={styles.modalTitle}>Enter Pairing Code</Text>
                {!keyboardVisible && <Text style={styles.modalSub}>Enter the six-digit code from Orion Desktop. Mobile will find trusted desktops on the same Wi-Fi.</Text>}
                <Pressable style={styles.pinInputRow} onPress={focusPin}>
                  <TextInput
                    ref={hiddenPinInputRef}
                    style={styles.pinInputControl}
                    value={pinCode}
                    onChangeText={handlePinChange}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    accessibilityLabel="Six-digit Orion Desktop pairing code"
                  />
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <View key={index} style={[
                      styles.pinBox,
                      pinCode[index] && styles.pinBoxFilled,
                      pinCode.length === index && styles.pinBoxFocused,
                    ]}>
                      <Text style={styles.pinBoxText} adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.35}>
                        {pinCode[index] || ''}
                      </Text>
                    </View>
                  ))}
                </Pressable>
                {Number.isFinite(attemptsRemaining) && attemptsRemaining !== null && connectionState !== 'locked-out' && (
                  <Text style={styles.attemptsRemainingText}>
                    {attemptsRemaining} pairing attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                  </Text>
                )}
                {!keyboardVisible && (
                  <Pressable style={styles.keyboardRecoveryBtn} onPress={focusPin}>
                    <Ionicons name="keypad-outline" size={16} color={theme.accent} />
                    <Text style={styles.keyboardRecoveryText}>Enter code</Text>
                  </Pressable>
                )}
                {discoveredDesktops.length > 1 && (
                  <View style={styles.desktopChooser}>
                    <Text style={styles.desktopChooserTitle}>Choose a Desktop</Text>
                    {discoveredDesktops.map((desktop) => (
                      <Pressable key={desktop.instanceId} style={styles.desktopChoice} onPress={() => chooseDiscoveredDesktop(desktop)}>
                        <Ionicons name="desktop-outline" size={18} color={theme.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.desktopChoiceName}>{desktop.displayName}</Text>
                          <Text style={styles.desktopChoiceMeta}>{desktop.discoveryMethod} · protocol {desktop.protocolVersion}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Pressable style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]} onPress={() => handleConnect()} disabled={isConnecting || connectionState === 'locked-out'}>
                  <Text style={styles.confirmBtnText}>{isDiscovering ? 'Finding Orion Desktop…' : isConnecting ? 'Verifying & Pairing…' : 'Verify & Connect'}</Text>
                </Pressable>
                <Pressable onPress={() => setPairingMethod('ip')} style={styles.modalTextAction}>
                  <Text style={styles.modalTextActionLabel}>Desktop not found? Use Direct IP</Text>
                </Pressable>
                <Pressable onPress={() => void discoverDesktop()} style={styles.modalTextAction} disabled={isDiscovering}>
                  <Text style={styles.modalTextActionSmall}>{isDiscovering ? 'Finding Desktop…' : 'Find Desktop again'}</Text>
                </Pressable>
                <Pressable onPress={runSubnetFallback} style={styles.modalTextAction}>
                  <Text style={styles.modalTextActionSmall}>Advanced: scan this local subnet</Text>
                </Pressable>
              </View>
            )}

            {pairingMethod === 'qr' && (
              <View style={styles.qrSection}>
                <Text style={styles.modalTitle}>Scan Desktop QR Code</Text>
                <Text style={styles.modalSub}>Point the camera at the QR code on Orion Desktop.</Text>
                {cameraPermission?.granted ? (
                  <View style={styles.cameraViewfinder}>
                    <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleBarCodeScanned} />
                    <Animated.View style={[styles.laserScanLine, { transform: [{ translateY: scanLineAnim }] }]} />
                  </View>
                ) : (
                  <View style={[styles.cameraViewfinder, styles.cameraPermissionState]}>
                    <Ionicons name="camera-outline" size={42} color={theme.accent} />
                    <Text style={styles.cameraPermissionText}>Camera access is required to scan the desktop QR code.</Text>
                    <Pressable style={styles.confirmBtn} onPress={requestCameraPermission}><Text style={styles.confirmBtnText}>Grant Camera Permission</Text></Pressable>
                  </View>
                )}
                <Text style={styles.qrGuidance}>Pairing begins automatically after Orion reads the QR code.</Text>
              </View>
            )}

            {pairingMethod === 'ip' && (
              <View style={styles.ipSection}>
                <Text style={styles.modalTitle}>Find Desktop by Address</Text>
                {!keyboardVisible && <Text style={styles.modalSub}>Orion keeps the last discovered address filled in. This step finds Desktop; the dedicated PIN screen securely pairs a new device.</Text>}
                <View style={styles.ipInputRow}>
                  <Ionicons name="desktop-outline" size={20} color={theme.accent} />
                  <TextInput
                    style={styles.ipInput}
                    value={desktopIp}
                    onChangeText={setDesktopIp}
                    placeholder="Desktop IP (192.168…)"
                    placeholderTextColor={muted}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() => void prepareDirectIp()}
                  />
                </View>
                <Pressable style={styles.confirmBtn} onPress={() => void prepareDirectIp()} disabled={isConnecting}>
                  <Text style={styles.confirmBtnText}>{isConnecting ? 'Checking Desktop…' : 'Find Desktop'}</Text>
                </Pressable>
              </View>
            )}

            {pairError ? (
              <View style={styles.pairErrorCard}>
                <Text style={styles.pairErrorText}>{pairError}</Text>
                {connectionState === 'locked-out' && lockoutSeconds > 0 && <Text style={styles.pairErrorHelp}>Pairing unlocks automatically in {lockoutSeconds} seconds.</Text>}
                {/expired/i.test(pairError) && <Text style={styles.pairErrorHelp}>Select New code in Orion Desktop, then enter the refreshed code here.</Text>}
              </View>
            ) : null}
            <Pressable style={styles.cancelBtnFull} onPress={() => setShowPairingModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
