import { useMemo, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { spacing, radii } from "@orion/shared/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useConnectController } from "./useConnectController";
import { createConnectStyles } from "./connectStyles";
import { useOrionTheme } from "../../context/ThemeContext";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import { OrionDialog } from "../../components/OrionDialog";
import { SmartConnectPairingModal } from "./SmartConnectPairingModal";
export default function ConnectScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const scrubberWidthRef = useRef(1);
  const { theme } = useOrionTheme();
  const styles = useMemo(() => createConnectStyles(theme), [theme]);
  const text = { primary: theme.text, secondary: theme.textSecondary, muted: theme.textMuted };
  const controller = useConnectController();
  const {
    activeTab,
    currentSpeedIndex,
    formatTime,
    handleDisconnect,
    isConnected,
    isMuted,
    isPlaying,
    navFocusMode,
    nowPlaying,
    pageShortcutItems,
    panResponder,
    pulseAnim,
    qrNotice,
    remoteError,
    remoteText,
    searchTarget,
    sendRemoteCommand,
    setActiveTab,
    setCurrentSpeedIndex,
    setQrNotice,
    setNavFocusMode,
    setPairingMethod,
    setPinCode,
    setRemoteText,
    setSearchTarget,
    setShowDisconnectModal,
    setShowPairingModal,
    showDisconnectModal,
    speeds,
    volume,
    connectionState,
    deviceName,
    renameThisDevice,
    lockoutSeconds,
  } = controller;
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
          {connectionState !== 'idle' && (
            <View style={styles.connectionNotice}>
              <Ionicons
                name={connectionState === 'reconnecting' || connectionState === 'discovering' ? 'sync-outline' : 'information-circle-outline'}
                size={16}
                color={connectionState === 'failed' || connectionState === 'token-rejected' ? theme.danger : theme.warning}
              />
              <Text style={styles.connectionNoticeText}>
                {{
                  discovering: 'Looking for Orion Desktop on this Wi-Fi…',
                  pairing: 'Confirming this device with Orion Desktop…',
                  connected: 'Desktop connection confirmed.',
                  reconnecting: 'Reconnecting to your trusted Desktop…',
                  'endpoint-lost': 'Trusted Desktop is currently unavailable.',
                  'token-rejected': 'This device needs to be paired again.',
                  'code-expired': 'The pairing code expired. Generate a new code on Desktop.',
                  'locked-out': `Pairing is temporarily locked${lockoutSeconds ? ` for ${lockoutSeconds}s` : ''}.`,
                  'protocol-mismatch': 'Desktop and Mobile use incompatible Connect versions.',
                  failed: 'Orion could not complete the connection.',
                  idle: '',
                }[connectionState]}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* Connected Smart Remote Interface */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.remoteLayout, isLandscape && styles.remoteLayoutLandscape]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
          <View style={styles.deviceIdentityRow}>
            <Ionicons name="phone-portrait-outline" size={16} color={theme.accent} />
            <TextInput
              defaultValue={deviceName}
              maxLength={80}
              selectTextOnFocus
              returnKeyType="done"
              accessibilityLabel="This mobile device name"
              onSubmitEditing={(event) => void renameThisDevice(event.nativeEvent.text)}
              style={styles.deviceIdentityInput}
            />
            <Text style={styles.deviceIdentityHint}>Enter to rename</Text>
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
                style={[styles.touchpadSurface, isLandscape && styles.touchpadSurfaceLandscape]}
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
                  onLayout={(event) => {
                    scrubberWidthRef.current = Math.max(1, event.nativeEvent.layout.width);
                  }}
                  onPress={(e) => {
                    if (nowPlaying.duration && nowPlaying.duration > 0) {
                      const nativeEvent = e.nativeEvent as any;
                      const locationX = nativeEvent.locationX || 0;
                      const ratio = Math.max(0, Math.min(1, locationX / scrubberWidthRef.current));
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
        </ScrollView>
      )}
      <SmartConnectPairingModal controller={controller} />
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
