import { useMemo } from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView } from "expo-camera";
import { spacing, radii } from "@orion/shared/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useConnectController } from "./useConnectController";
import { createConnectStyles } from "./connectStyles";
import { useOrionTheme } from "../../context/ThemeContext";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import { OrionDialog } from "../../components/OrionDialog";
export default function ConnectScreen() {
  const { theme } = useOrionTheme();
  const styles = useMemo(() => createConnectStyles(theme), [theme]);
  const text = { primary: theme.text, secondary: theme.textSecondary, muted: theme.textMuted };
  const {
    activeTab,
    cameraPermission,
    currentSpeedIndex,
    desktopIp,
    formatTime,
    handleBarCodeScanned,
    handleConnect,
    handleDisconnect,
    handlePinChange,
    hiddenPinInputRef,
    isConnected,
    isConnecting,
    isDiscovering,
    isMuted,
    isPlaying,
    navFocusMode,
    nowPlaying,
    pageShortcutItems,
    pairError,
    pairingMethod,
    panResponder,
    pinCode,
    pulseAnim,
    qrNotice,
    remoteError,
    remoteText,
    requestCameraPermission,
    scanLineAnim,
    searchTarget,
    sendRemoteCommand,
    setActiveTab,
    setCurrentSpeedIndex,
    setQrNotice,
    setDesktopIp,
    setNavFocusMode,
    setPairingMethod,
    setPinCode,
    setRemoteText,
    setSearchTarget,
    setShowDisconnectModal,
    setShowPairingModal,
    showDisconnectModal,
    showPairingModal,
    speeds,
    volume
  } = useConnectController();
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.accentSoft, theme.background, theme.background, theme.elevated]}
        locations={[0, 0.35, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MobilePageHeader
        eyebrow="REMOTE"
        title="Orion Connect"
        subtitle="Control Orion Desktop from this device over your local network."
        trailing={<Pressable
          accessibilityRole="button"
          accessibilityLabel={isConnected ? 'Disconnect Orion Desktop' : 'Pair Orion Desktop'}
          style={[
            styles.statusPill,
            isConnected ? styles.statusPillConnected : styles.statusPillDisconnected,
          ]}
          onPress={() => {
            if (isConnected) {
              setShowDisconnectModal(true);
            } else {
              setPairingMethod('pin');
              setShowPairingModal(true);
            }
          }}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? theme.success : theme.warning },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Live' : 'Pair Desktop'}
          </Text>
              {isConnected && <Ionicons name="power" size={12} color={theme.success} style={{ marginLeft: 2 }} />}
        </Pressable>
        }
      />
      {!isConnected ? (
        /* Disconnected Hero Banner & Pairing Guide */
        <ScrollView contentContainerStyle={styles.pairingContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.iconInner}>
              <Ionicons name="wifi-outline" size={44} color={theme.accent} />
            </View>
          </View>
          <Text style={styles.title}>Smart Remote & TV Pairing</Text>
          <Text style={styles.subtitle}>
            Control playback, browse your library, and cast streams to Orion Desktop directly from your phone.
          </Text>
          <View style={styles.stepsContainer}>
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Open Orion Desktop on your PC and click "Orion Connect"</Text>
            </View>
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Ensure phone & PC are on the same Wi-Fi network</Text>
            </View>
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Scan the QR code or enter the expiring six-digit code shown on Desktop</Text>
            </View>
          </View>
          <View style={styles.pairingBtnGroup}>
            <Pressable
              style={({ pressed }) => [styles.primaryConnectBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setPairingMethod('pin');
                setPinCode('');
                setShowPairingModal(true);
              }}
            >
              <Ionicons name="keypad-outline" size={20} color={theme.onAccent} />
              <Text style={styles.primaryConnectBtnText}>Enter Pairing Code</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryConnectBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setPairingMethod('qr');
                setShowPairingModal(true);
              }}
            >
              <Ionicons name="camera-outline" size={18} color={theme.text} />
              <Text style={styles.secondaryConnectBtnText}>Scan QR Code</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        /* Connected Smart Remote Interface */
        <View style={styles.remoteLayout}>
          <View style={styles.nowPlayingBar}>
            <View style={styles.nowPlayingIconGlow}>
              <Ionicons name="tv-outline" size={18} color={theme.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {nowPlaying.title}
              </Text>
              <Text style={styles.nowPlayingSub}>Live remote · {nowPlaying.progress}</Text>
            </View>
            <Pressable
              style={styles.disconnectRemoteBtn}
              onPress={() => setShowDisconnectModal(true)}
            >
              <Ionicons name="power-outline" size={14} color={theme.danger} />
              <Text style={styles.disconnectRemoteText}>Disconnect</Text>
            </Pressable>
          </View>
          {remoteError ? (
            <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[3], padding: spacing[3], borderRadius: radii.lg, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.danger }}>
              <Text style={{ color: theme.danger, fontSize: 12, lineHeight: 18 }}>{remoteError}</Text>
            </View>
          ) : null}
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, activeTab === 'touchpad' && styles.modeTabActive]}
              onPress={() => setActiveTab('touchpad')}
            >
              <Ionicons
                name="hand-left-outline"
                size={16}
                color={activeTab === 'touchpad' ? theme.onAccent : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'touchpad' && styles.modeTabTextActive]}>
                Touchpad
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, activeTab === 'dpad' && styles.modeTabActive]}
              onPress={() => setActiveTab('dpad')}
            >
              <Ionicons
                name="navigate-outline"
                size={16}
                color={activeTab === 'dpad' ? theme.onAccent : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'dpad' && styles.modeTabTextActive]}>
                D-Pad
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, activeTab === 'playback' && styles.modeTabActive]}
              onPress={() => setActiveTab('playback')}
            >
              <Ionicons
                name="play-circle-outline"
                size={16}
                color={activeTab === 'playback' ? theme.onAccent : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'playback' && styles.modeTabTextActive]}>
                HUD
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, activeTab === 'keyboard' && styles.modeTabActive]}
              onPress={() => setActiveTab('keyboard')}
            >
              <Ionicons
                name="keypad-outline"
                size={16}
                color={activeTab === 'keyboard' ? theme.onAccent : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'keyboard' && styles.modeTabTextActive]}>
                Keyboard
              </Text>
            </Pressable>
          </View>
          {activeTab === 'touchpad' && (
            <View style={styles.touchpadSection}>
              <View
                style={styles.touchpadSurface}
                {...panResponder.panHandlers}
              >
                <Ionicons name="finger-print" size={36} color={theme.textMuted} />
                <Text style={styles.touchpadPrompt}>Drag to move laser cursor on TV</Text>
                <Text style={styles.touchpadSubPrompt}>Tap anywhere to click target item</Text>
              </View>
            </View>
          )}
          {activeTab === 'dpad' && (
            <View style={styles.dpadSection}>
              <View style={styles.quickLaunchRailContainer}>
                <Text style={styles.quickLaunchTitle}>Quick Page Navigation</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLaunchRail}>
                  {pageShortcutItems.map((item) => (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.quickPageChip,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }
                      ]}
                      onPress={() => sendRemoteCommand('navigate_page', item.id)}
                    >
                      <Ionicons name={item.icon as any} size={15} color={theme.accent} />
                      <Text style={styles.quickPageChipText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.focusModeSwitchRow}>
                <Pressable
                  style={[styles.focusModeBtn, navFocusMode === 'sidebar' && styles.focusModeBtnActive]}
                  onPress={() => setNavFocusMode('sidebar')}
                >
                  <Ionicons name="list-outline" size={16} color={navFocusMode === 'sidebar' ? theme.text : text.muted} />
                  <Text style={[styles.focusModeText, navFocusMode === 'sidebar' && styles.focusModeTextActive]}>
                    Sidebar Focus
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.focusModeBtn, navFocusMode === 'content' && styles.focusModeBtnActive]}
                  onPress={() => setNavFocusMode('content')}
                >
                  <Ionicons name="grid-outline" size={16} color={navFocusMode === 'content' ? theme.text : text.muted} />
                  <Text style={[styles.focusModeText, navFocusMode === 'content' && styles.focusModeTextActive]}>
                    Content Focus
                  </Text>
                </Pressable>
              </View>
              <View style={styles.navRow}>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('back')}>
                  <Ionicons name="arrow-back" size={20} color={theme.text} />
                </Pressable>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('home')}>
                  <Ionicons name="home-outline" size={20} color={theme.text} />
                </Pressable>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('menu')}>
                  <Ionicons name="menu-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
              <View style={styles.dpadOuter}>
                <Pressable
                  style={styles.dpadUp}
                  onPress={() => {
                    if (navFocusMode === 'sidebar') sendRemoteCommand('sidebar_prev');
                    else sendRemoteCommand('up');
                  }}
                >
                  <Ionicons name="chevron-up" size={28} color={theme.text} />
                </Pressable>
                <View style={styles.dpadMiddleRow}>
                  <Pressable
                    style={styles.dpadLeft}
                    onPress={() => {
                      if (navFocusMode === 'sidebar') sendRemoteCommand('left');
                      else sendRemoteCommand('focus_card_prev');
                    }}
                  >
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                  </Pressable>
                  <Pressable style={styles.dpadCenterOk} onPress={() => sendRemoteCommand('select')}>
                    <Text style={styles.okText}>OK</Text>
                  </Pressable>
                  <Pressable
                    style={styles.dpadRight}
                    onPress={() => {
                      if (navFocusMode === 'sidebar') sendRemoteCommand('right');
                      else sendRemoteCommand('focus_card_next');
                    }}
                  >
                    <Ionicons name="chevron-forward" size={28} color={theme.text} />
                  </Pressable>
                </View>
                <Pressable
                  style={styles.dpadDown}
                  onPress={() => {
                    if (navFocusMode === 'sidebar') sendRemoteCommand('sidebar_next');
                    else sendRemoteCommand('down');
                  }}
                >
                  <Ionicons name="chevron-down" size={28} color={theme.text} />
                </Pressable>
              </View>
            </View>
          )}
          {activeTab === 'playback' && (
            <View style={styles.playbackSection}>
              <View style={styles.scrubberContainer}>
                <View style={styles.scrubberTimeRow}>
                  <Text style={styles.scrubberTimeText}>
                    {formatTime(nowPlaying.currentTime || 0)}
                  </Text>
                  <Text style={styles.scrubberTimeText}>
                    {formatTime(nowPlaying.duration || 0)}
                  </Text>
                </View>
                <Pressable
                  style={styles.scrubberTrack}
                  onPress={(e) => {
                    if (nowPlaying.duration && nowPlaying.duration > 0) {
                      const nativeEvent = e.nativeEvent as any;
                      const locationX = nativeEvent.locationX || 0;
                      const layoutWidth = 320;
                      const ratio = Math.max(0, Math.min(1, locationX / layoutWidth));
                      const targetSec = Math.floor(ratio * nowPlaying.duration);
                      sendRemoteCommand('seek_to', targetSec);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.scrubberFill,
                      {
                        width: `${
                          nowPlaying.duration && nowPlaying.duration > 0
                            ? Math.min(100, Math.max(0, ((nowPlaying.currentTime || 0) / nowPlaying.duration) * 100))
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </Pressable>
              </View>
              <View style={styles.seekRow}>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('previous')}>
                  <Ionicons name="play-skip-back" size={18} color={theme.text} />
                </Pressable>
                <Pressable style={styles.seekBtn} onPress={() => sendRemoteCommand('seek_-10')}>
                  <Ionicons name="play-back" size={20} color={theme.text} />
                  <Text style={styles.seekText}>-10s</Text>
                </Pressable>
                <Pressable
                  style={styles.bigPlayBtn}
                  onPress={() => sendRemoteCommand('toggle_play')}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={theme.onAccent} />
                </Pressable>
                <Pressable style={styles.seekBtn} onPress={() => sendRemoteCommand('seek_+10')}>
                  <Ionicons name="play-forward" size={20} color={theme.text} />
                  <Text style={styles.seekText}>+10s</Text>
                </Pressable>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('next')}>
                  <Ionicons name="play-skip-forward" size={18} color={theme.text} />
                </Pressable>
              </View>
              <View style={styles.hudFeatureGrid}>
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => {
                    const nextIdx = (currentSpeedIndex + 1) % speeds.length;
                    setCurrentSpeedIndex(nextIdx);
                    sendRemoteCommand('set_speed', parseFloat(speeds[nextIdx]));
                  }}
                >
                  <Ionicons name="speedometer-outline" size={18} color={theme.accent} />
                  <Text style={styles.hudFeatureText}>{speeds[currentSpeedIndex]}</Text>
                </Pressable>
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => sendRemoteCommand('toggle_subtitles')}
                >
                  <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.accent} />
                  <Text style={styles.hudFeatureText}>CC</Text>
                </Pressable>
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => sendRemoteCommand('toggle_fullscreen')}
                >
                  <Ionicons name="expand-outline" size={18} color={theme.accent} />
                  <Text style={styles.hudFeatureText}>Screen</Text>
                </Pressable>
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => sendRemoteCommand('toggle_pip')}
                >
                  <Ionicons name="duplicate-outline" size={18} color={theme.accent} />
                  <Text style={styles.hudFeatureText}>PiP</Text>
                </Pressable>
              </View>
              <View style={styles.volumeCard}>
                <Pressable onPress={() => sendRemoteCommand('toggle_mute')}>
                  <Ionicons
                    name={isMuted || volume === 0 ? 'volume-mute' : 'volume-high'}
                    size={22}
                    color={isMuted ? theme.accent : theme.text}
                  />
                </Pressable>
                <View style={styles.volumeTrack}>
                  <View
                    style={[styles.volumeFill, { width: `${isMuted ? 0 : volume}%` }]}
                  />
                </View>
                <Text style={styles.volumeText}>{isMuted ? 'Muted' : `${volume}%`}</Text>
              </View>
              <View style={styles.volumePresetRow}>
                <Pressable
                  style={styles.volStepBtn}
                  onPress={() => sendRemoteCommand('volume_down')}
                >
                  <Ionicons name="remove" size={16} color={theme.text} />
                  <Text style={styles.volStepText}>Vol -</Text>
                </Pressable>
                <Pressable
                  style={styles.volPresetBtn}
                  onPress={() => sendRemoteCommand('volume_up')}
                >
                  <Ionicons name="add" size={16} color={theme.text} />
                  <Text style={styles.volStepText}>Vol +</Text>
                </Pressable>
              </View>
            </View>
          )}
          {activeTab === 'keyboard' && (
            <View style={styles.keyboardSection}>
              <View style={styles.focusModeSwitchRow}>
                <Pressable
                  style={[styles.focusModeBtn, searchTarget === 'cinema' && styles.focusModeBtnActive]}
                  onPress={() => setSearchTarget('cinema')}
                >
                  <Ionicons name="film-outline" size={16} color={searchTarget === 'cinema' ? theme.text : text.muted} />
                  <Text style={[styles.focusModeText, searchTarget === 'cinema' && styles.focusModeTextActive]}>
                    Cinema Search
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.focusModeBtn, searchTarget === 'constellation' && styles.focusModeBtnActive]}
                  onPress={() => setSearchTarget('constellation')}
                >
                  <Ionicons name="planet-outline" size={16} color={searchTarget === 'constellation' ? theme.text : text.muted} />
                  <Text style={[styles.focusModeText, searchTarget === 'constellation' && styles.focusModeTextActive]}>
                    Constellation
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.keyboardPrompt}>
                {searchTarget === 'cinema' ? 'Send Text to Global Cinema Search' : 'Filter Constellation Star Graph'}
              </Text>
              <View style={styles.textInputRow}>
                <Ionicons name={searchTarget === 'cinema' ? 'search' : 'planet'} size={20} color={text.muted} />
                <TextInput
                  style={styles.textInput}
                  placeholder={searchTarget === 'cinema' ? 'Search movies, series, actors...' : 'Filter stars by actor/creator...'}
                  placeholderTextColor={text.muted}
                  value={remoteText}
                  onChangeText={setRemoteText}
                />
                {remoteText.length > 0 && (
                  <Pressable onPress={() => setRemoteText('')}>
                    <Ionicons name="close-circle" size={18} color={text.muted} />
                  </Pressable>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [styles.sendTextBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  if (searchTarget === 'cinema') {
                    sendRemoteCommand('send_text', remoteText);
                  } else {
                    sendRemoteCommand('constellation_search', remoteText);
                  }
                  setRemoteText('');
                }}
              >
                <Ionicons name="paper-plane" size={18} color={theme.onAccent} />
                <Text style={styles.sendTextBtnText}>
                  {searchTarget === 'cinema' ? 'Send to Cinema Search' : 'Filter Constellation Graph'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      <Modal
        visible={showPairingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPairingModal(false)}
        onShow={() => {
          if (pairingMethod === 'pin') setTimeout(() => hiddenPinInputRef.current?.focus(), 280);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalOverlay}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
          <View style={styles.glassModalCard}>
            <View style={styles.modalMethodTabs}>
              <Pressable
                style={[styles.modalMethodTab, pairingMethod === 'pin' && styles.modalMethodTabActive]}
                onPress={() => {
                  setPairingMethod('pin');
                  setTimeout(() => hiddenPinInputRef.current?.focus(), 150);
                }}
              >
                <Ionicons name="keypad-outline" size={14} color={pairingMethod === 'pin' ? theme.onAccent : text.muted} />
                <Text style={[styles.modalMethodTabText, pairingMethod === 'pin' && styles.modalMethodTabTextActive]}>
                  PIN Code
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalMethodTab, pairingMethod === 'qr' && styles.modalMethodTabActive]}
                onPress={() => setPairingMethod('qr')}
              >
                <Ionicons name="qr-code-outline" size={14} color={pairingMethod === 'qr' ? theme.onAccent : text.muted} />
                <Text style={[styles.modalMethodTabText, pairingMethod === 'qr' && styles.modalMethodTabTextActive]}>
                  QR Scan
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalMethodTab, pairingMethod === 'ip' && styles.modalMethodTabActive]}
                onPress={() => setPairingMethod('ip')}
              >
                <Ionicons name="wifi-outline" size={14} color={pairingMethod === 'ip' ? theme.onAccent : text.muted} />
                <Text style={[styles.modalMethodTabText, pairingMethod === 'ip' && styles.modalMethodTabTextActive]}>
                  Direct IP
                </Text>
              </Pressable>
            </View>
            {pairingMethod === 'pin' && (
              <View style={styles.pinSection}>
                <Text style={styles.modalTitle}>Enter Pairing Code</Text>
                <Text style={styles.modalSub}>
                  Enter the six-digit code from Orion Desktop. Mobile will find Orion automatically on the same Wi-Fi.
                </Text>
                <TextInput
                  ref={hiddenPinInputRef}
                  style={styles.hiddenPinInput}
                  value={pinCode}
                  onChangeText={handlePinChange}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                />
                <Pressable
                  style={styles.pinInputRow}
                  onPress={() => hiddenPinInputRef.current?.focus()}
                >
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const digit = pinCode[idx] || '';
                    const isFocused = pinCode.length === idx;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.pinBox,
                          digit !== '' && styles.pinBoxFilled,
                          isFocused && styles.pinBoxFocused,
                        ]}
                      >
                        <Text style={styles.pinBoxText}>{digit}</Text>
                      </View>
                    );
                  })}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => handleConnect()}
                  disabled={isConnecting}
                >
                  <Text style={styles.confirmBtnText}>
                    {isDiscovering ? 'Finding Orion Desktop…' : isConnecting ? 'Verifying & Pairing…' : 'Verify & Connect'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setPairingMethod('ip')} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: text.muted, fontSize: 12, fontWeight: '700' }}>Desktop not found? Use Direct IP</Text>
                </Pressable>
              </View>
            )}
            {pairingMethod === 'qr' && (
              <View style={styles.qrSection}>
                <Text style={styles.modalTitle}>Scan Desktop QR Code</Text>
                <Text style={styles.modalSub}>Point camera at the QR code on Orion Desktop screen.</Text>
                {cameraPermission?.granted ? (
                  <View style={styles.cameraViewfinder}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      onBarcodeScanned={handleBarCodeScanned}
                    />
                    <Animated.View style={[styles.laserScanLine, { transform: [{ translateY: scanLineAnim }] }]} />
                  </View>
                ) : (
                  <View style={[styles.cameraViewfinder, { justifyContent: 'center', alignItems: 'center', gap: 10, padding: 16 }]}>
                    <Ionicons name="camera-outline" size={42} color={theme.accent} />
                    <Text style={{ color: text.muted, fontSize: 12, textAlign: 'center' }}>
                      Camera access is required to scan the desktop QR code.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [styles.confirmBtn, { paddingVertical: 10, paddingHorizontal: 20 }, pressed && { opacity: 0.85 }]}
                      onPress={requestCameraPermission}
                    >
                      <Text style={styles.confirmBtnText}>Grant Camera Permission</Text>
                    </Pressable>
                  </View>
                )}
                <Text style={{ color: text.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: spacing[3] }}>
                  Pairing begins automatically after Orion reads the QR code.
                </Text>
              </View>
            )}
            {pairingMethod === 'ip' && (
              <View style={styles.ipSection}>
                <Text style={styles.modalTitle}>Manual IP & PIN Connect</Text>
                <Text style={styles.modalSub}>Enter your computer's local IP and the pairing PIN.</Text>
                <View style={styles.ipInputRow}>
                  <Ionicons name="desktop-outline" size={20} color={theme.accent} />
                  <TextInput
                    style={styles.ipInput}
                    value={desktopIp}
                    onChangeText={setDesktopIp}
                    placeholder="Desktop IP (192.168...)"
                    placeholderTextColor={text.muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.ipInputRow, { marginTop: 12 }]}>
                  <Ionicons name="keypad-outline" size={20} color={theme.accent} />
                  <TextInput
                    style={styles.ipInput}
                    value={pinCode}
                    onChangeText={setPinCode}
                    placeholder="6-digit pairing code"
                    placeholderTextColor={text.muted}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }, { marginTop: 24 }]}
                  onPress={() => handleConnect()}
                  disabled={isConnecting}
                >
                  <Text style={styles.confirmBtnText}>
                    {isConnecting ? 'Connecting...' : 'Connect to Desktop'}
                  </Text>
                </Pressable>
              </View>
            )}
            {pairError ? (
              <View style={{ marginTop: spacing[3], padding: spacing[3], borderRadius: radii.lg, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.danger }}>
                <Text style={{ color: theme.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{pairError}</Text>
                {/expired/i.test(pairError) ? (
                  <Text style={{ color: text.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 }}>
                    Select New code in Orion Desktop, then enter the refreshed code here.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Pressable style={styles.cancelBtnFull} onPress={() => setShowPairingModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showDisconnectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalCard}>
            <View style={styles.disconnectIconGlow}>
              <Ionicons name="power" size={28} color={theme.danger} />
            </View>
            <Text style={styles.modalTitle}>Disconnect Remote?</Text>
            <Text style={styles.modalSub}>
              This will unpair Mobile from Orion Desktop. You can reconnect anytime via PIN or QR code.
            </Text>
            <View style={styles.disconnectModalBtnRow}>
              <Pressable style={styles.cancelBtnModal} onPress={() => setShowDisconnectModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.disconnectConfirmBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectConfirmText}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <OrionDialog
        visible={Boolean(qrNotice)}
        title="QR code not recognized"
        message={qrNotice}
        icon="qr-code-outline"
        onDismiss={() => setQrNotice('')}
        actions={[{ label: 'OK', role: 'primary', onPress: () => setQrNotice('') }]}
      />
    </View>
  );
}
