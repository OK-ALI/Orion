import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrionDialog } from '../../components/OrionDialog';
import { createPortableProfileV3 } from '@orion/shared/types';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useOrionAccount } from '../../context/AccountContext';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  authorizeGoogleDriveAppData,
  checkGoogleDriveAppDataAuthorization,
  isNativeGoogleDriveAuthorizationAvailable,
  revokeGoogleDriveAppData,
} from '../account/nativeGoogleDriveAuthorization';
import { GoogleDriveCloudProfileStore } from '../account/googleDriveCloudProfileStore';
import { MyListEnrollmentPreflight } from './MyListEnrollmentPreflight';
import { WatchedSyncControl } from './WatchedSyncControl';
import { ViewingActivitySyncControl } from './ViewingActivitySyncControl';


export async function runP82DriveStorageProbeForDiagnostics(accountEmail: string) {
  const store = new GoogleDriveCloudProfileStore(accountEmail);
  const probeKey = 'p8.2-storage-probe';

  try {
    const existing = await store.read(probeKey);
    if (existing.state === 'missing') {
      const emptyProfile = createPortableProfileV3('p8.2-storage-probe');
      const write = await store.write(probeKey, {
        profile: emptyProfile,
        expectedRevisionTag: null,
      });
      if (write.state === 'conflict') return 'conflict' as const;

      const verify = await store.read(probeKey);
      return verify.state === 'found' ? 'created' as const : 'error' as const;
    }

    const now = Math.max(Date.now(), existing.profile.updatedAt + 1);
    const nextProfile = {
      ...existing.profile,
      revision: existing.profile.revision + 1,
      updatedAt: now,
    };
    const write = await store.write(probeKey, {
      profile: nextProfile,
      expectedRevisionTag: existing.revisionTag,
    });
    if (write.state === 'conflict') return 'conflict' as const;

    const verify = await store.read(probeKey);
    return verify.state === 'found' && verify.profile.revision >= nextProfile.revision
      ? 'updated' as const
      : 'error' as const;
  } catch {
    return 'error' as const;
  }
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : 'O';
}

export function AccountSettingsContent() {
  const { theme } = useOrionTheme();
  const {
    state,
    googleConfigured,
    nativeGoogleAvailable,
    signIn,
    signOut,
    clearFeedback,
  } = useOrionAccount();
  const profile = state.profile;
  const busy = state.phase === 'restoring' || state.phase === 'signing-in' || state.phase === 'signing-out';
  const displayName = profile?.displayName || profile?.email || 'Orion profile';
  const driveNativeAvailable = isNativeGoogleDriveAuthorizationAvailable();
  const [drivePhase, setDrivePhase] = useState<'idle' | 'checking' | 'authorizing' | 'ready' | 'revoking' | 'cancelled' | 'error'>('idle');
  const [driveFeedback, setDriveFeedback] = useState<'none' | 'removed' | 'revoke-error'>('none');
  const [showDriveRemovalDialog, setShowDriveRemovalDialog] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setDriveFeedback('none');
    setShowDriveRemovalDialog(false);

    if (!profile || !driveNativeAvailable) {
      setDrivePhase('idle');
      return () => {
        cancelled = true;
      };
    }

    setDrivePhase('checking');
    void checkGoogleDriveAppDataAuthorization(profile.email)
      .then((result) => {
        if (cancelled) return;
        setDrivePhase(result.authorized ? 'ready' : 'idle');
      })
      .catch(() => {
        if (cancelled) return;
        setDrivePhase('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [driveNativeAvailable, profile?.accountId, profile?.email]);

  const authorizeDrive = async () => {
    if (!profile || !driveNativeAvailable || drivePhase === 'checking' || drivePhase === 'authorizing') return;
    setDriveFeedback('none');
    setDrivePhase('authorizing');
    try {
      await authorizeGoogleDriveAppData(profile.email);
      setDrivePhase('ready');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      setDrivePhase(code === 'GOOGLE_DRIVE_AUTH_CANCELLED' ? 'cancelled' : 'error');
    }
  };

  const revokeDrive = async () => {
    if (!profile || !driveNativeAvailable || drivePhase !== 'ready') return;
    setShowDriveRemovalDialog(false);
    setDriveFeedback('none');
    setDrivePhase('revoking');
    try {
      await revokeGoogleDriveAppData(profile.email);
      setDrivePhase('idle');
      setDriveFeedback('removed');
    } catch {
      setDrivePhase('ready');
      setDriveFeedback('revoke-error');
    }
  };

  const driveReady = drivePhase === 'ready' || drivePhase === 'revoking';
  const driveBusy = drivePhase === 'checking' || drivePhase === 'authorizing' || drivePhase === 'revoking';
  const driveStatus = driveReady
    ? 'Connected'
    : drivePhase === 'checking'
      ? 'Checking'
      : drivePhase === 'authorizing'
        ? 'Connecting'
        : 'Off';

  return (
    <View style={styles.stack}>
      {profile ? (
        <>
          <View style={styles.profileRow}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} accessibilityLabel={`${displayName} profile photo`} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
                <Text style={[styles.avatarInitial, { color: theme.accent }]}>{initialFor(displayName)}</Text>
              </View>
            )}
            <View style={styles.profileCopy}>
              <Text style={[styles.profileName, { color: theme.text }]}>{displayName}</Text>
              <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{profile.email}</Text>
              <Text style={[styles.profileMeta, { color: theme.textMuted }]}>Google connected</Text>
            </View>
          </View>

          <View style={[styles.settingBlock, styles.topDivider, { borderTopColor: theme.border }]}>
            <View style={styles.settingHeading}>
              <View style={[styles.settingIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="cloud-outline" size={20} color={theme.accent} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Orion Cloud</Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  {driveReady
                    ? 'Keep your Orion library in sync across devices.'
                    : drivePhase === 'checking'
                      ? 'Checking Orion Cloud connection.'
                      : drivePhase === 'authorizing'
                        ? 'Waiting for Google permission.'
                        : 'Connect Orion Cloud to keep your Orion library in sync across devices.'}
                </Text>
              </View>
              <View
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: driveReady ? theme.accentSoft : theme.surfaceHover,
                    borderColor: driveReady ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={[styles.smallChipText, { color: driveReady ? theme.accent : theme.textMuted }]}>{driveStatus}</Text>
              </View>
            </View>

            {(drivePhase === 'cancelled' || drivePhase === 'error' || driveFeedback !== 'none') && (
              <Text
                accessibilityRole="alert"
                style={[
                  styles.inlineFeedback,
                  {
                    color: drivePhase === 'error' || driveFeedback === 'revoke-error'
                      ? theme.warning
                      : theme.textMuted,
                  },
                ]}
              >
                {driveFeedback === 'removed'
                  ? 'Orion Cloud was disconnected. Your local library was not changed.'
                  : driveFeedback === 'revoke-error'
                    ? 'Orion Cloud could not be disconnected. Orion still considers the cloud connection active.'
                    : drivePhase === 'cancelled'
                      ? 'Orion Cloud was not connected. Nothing changed.'
                      : 'Orion Cloud could not be connected. Nothing was uploaded.'}
              </Text>
            )}

            {!driveReady && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={drivePhase === 'checking' ? 'Checking Orion Cloud' : 'Connect Orion Cloud'}
                accessibilityHint="Connects Orion Cloud. Each sync area keeps its own Auto sync setting"
                accessibilityState={{ disabled: busy || !driveNativeAvailable || driveBusy }}
                disabled={busy || !driveNativeAvailable || driveBusy}
                onPress={() => void authorizeDrive()}
                style={({ pressed }) => [
                  styles.inlineButton,
                  { backgroundColor: theme.elevated, borderColor: theme.border, opacity: !driveNativeAvailable ? 0.5 : 1 },
                  pressed && styles.pressed,
                ]}
              >
                {driveBusy ? (
                  <ActivityIndicator color={theme.text} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.text} />
                )}
                <Text style={[styles.inlineButtonText, { color: theme.text }]}>
                  {drivePhase === 'checking'
                    ? 'Checking Cloud...'
                    : drivePhase === 'authorizing'
                      ? 'Opening Google...'
                      : 'Connect Orion Cloud'}
                </Text>
              </Pressable>
            )}

            {!driveNativeAvailable && (
              <Text style={[styles.setupText, { color: theme.textMuted }]}>Orion Cloud is unavailable on this device.</Text>
            )}
          </View>

          {drivePhase === 'ready' && (
            <>
              <MyListEnrollmentPreflight
                accountEmail={profile.email}
                profileId={profile.accountId}
              />
              <WatchedSyncControl
                key={profile.accountId}
                accountEmail={profile.email}
                profileId={profile.accountId}
              />
              <ViewingActivitySyncControl
                key={`viewing-${profile.accountId}`}
                accountEmail={profile.email}
                profileId={profile.accountId}
              />
            </>
          )}

          <View style={[styles.accountActions, { borderTopColor: theme.border }]}>
            {driveReady && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Disconnect Orion Cloud"
                accessibilityHint="Stops Orion Cloud sync while keeping local Orion data on this device"
                accessibilityState={{ disabled: busy || driveBusy }}
                disabled={busy || driveBusy}
                onPress={() => setShowDriveRemovalDialog(true)}
                style={({ pressed }) => [styles.managementRow, pressed && styles.pressed]}
              >
                <Ionicons name="cloud-offline-outline" size={20} color={theme.danger} />
                <View style={styles.managementCopy}>
                  <Text style={[styles.managementTitle, { color: theme.danger }]}>
                    {drivePhase === 'revoking' ? 'Disconnecting Orion Cloud...' : 'Disconnect Orion Cloud'}
                  </Text>
                  <Text style={[styles.managementDescription, { color: theme.textMuted }]}>Keep your library on this device.</Text>
                </View>
                {drivePhase === 'revoking' ? (
                  <ActivityIndicator color={theme.danger} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                )}
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Disconnect Google from Orion"
              accessibilityHint="Disconnects this Google identity while keeping local Orion data on this device"
              disabled={busy}
              onPress={() => void signOut()}
              style={({ pressed }) => [
                styles.managementRow,
                driveReady && styles.managementDivider,
                driveReady && { borderTopColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              {state.phase === 'signing-out' ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <Ionicons name="log-out-outline" size={20} color={theme.text} />
              )}
              <View style={styles.managementCopy}>
                <Text style={[styles.managementTitle, { color: theme.text }]}>
                  {state.phase === 'signing-out' ? 'Disconnecting...' : 'Disconnect Google'}
                </Text>
                <Text style={[styles.managementDescription, { color: theme.textMuted }]}>Keep Orion usable with your local profile.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.localHeading}>
            <View style={[styles.localIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="person-circle-outline" size={28} color={theme.accent} />
            </View>
            <View style={styles.localCopy}>
              <Text style={[styles.localTitle, { color: theme.text }]}>Your Orion profile</Text>
              <Text style={[styles.localSubtitle, { color: theme.textSecondary }]}>Orion remains fully usable on this device without signing in.</Text>
            </View>
            <View style={[styles.localChip, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
              <Text style={[styles.localChipText, { color: theme.textSecondary }]}>Local only</Text>
            </View>
          </View>

          <Text style={[styles.explanation, { color: theme.textSecondary }]}>
            Connect Google to use the same Orion identity across devices.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityHint={googleConfigured ? 'Opens the Android Google account chooser' : 'Google sign-in is not available right now'}
            accessibilityState={{ disabled: busy || !googleConfigured }}
            disabled={busy || !googleConfigured}
            onPress={() => void signIn()}
            style={({ pressed }) => [
              styles.googleButton,
              { backgroundColor: theme.text, borderColor: theme.text, opacity: busy || !googleConfigured ? 0.5 : 1 },
              pressed && styles.pressed,
            ]}
          >
            {state.phase === 'signing-in' ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Image source={require('../../../assets/google-g-logo.png')} style={styles.googleLogo} accessible={false} />
            )}
            <Text style={[styles.googleButtonText, { color: theme.background }]}>
              {state.phase === 'signing-in' ? 'Opening Google...' : 'Continue with Google'}
            </Text>
          </Pressable>

          {!nativeGoogleAvailable && (
            <Text style={[styles.setupText, { color: theme.textMuted }]}>Google sign-in is unavailable on this device.</Text>
          )}
          {nativeGoogleAvailable && !googleConfigured && (
            <Text style={[styles.setupText, { color: theme.textMuted }]}>Google sign-in is not available right now.</Text>
          )}
        </>
      )}

      {!!state.feedback && (
        <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <Ionicons
            name={state.phase === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
            size={19}
            color={state.phase === 'error' ? theme.warning : theme.textSecondary}
          />
          <Text style={[styles.feedbackText, { color: theme.textSecondary }]}>{state.feedback}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss account message"
            hitSlop={8}
            onPress={clearFeedback}
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={theme.textMuted} />
          </Pressable>
        </View>
      )}

      <OrionDialog
        visible={showDriveRemovalDialog}
        title="Disconnect Orion Cloud?"
        message="Orion will stop using Orion Cloud for this account. Your local library will stay on this device."
        icon="cloud-offline-outline"
        onDismiss={() => setShowDriveRemovalDialog(false)}
        actions={[
          {
            label: 'Cancel',
            role: 'cancel',
            onPress: () => setShowDriveRemovalDialog(false),
          },
          {
            label: 'Disconnect',
            role: 'destructive',
            onPress: () => void revokeDrive(),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[4] },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 19, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: fontSizes.sm, fontWeight: '900', flexShrink: 1 },
  profileEmail: { marginTop: 2, fontSize: 11, lineHeight: 15, flexShrink: 1 },
  profileMeta: { marginTop: 1, fontSize: 10, lineHeight: 14, fontWeight: '700', flexShrink: 1 },
  topDivider: { borderTopWidth: 1, paddingTop: spacing[4] },
  settingBlock: { gap: spacing[3] },
  settingHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  settingIcon: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, minWidth: 0 },
  settingTitle: { fontSize: fontSizes.md, fontWeight: '800' },
  settingDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  smallChip: { minHeight: 30, borderRadius: 15, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  smallChipText: { fontSize: 10, fontWeight: '900' },
  inlineFeedback: { fontSize: fontSizes.xs, lineHeight: 18, paddingLeft: 52 },
  inlineButton: { minHeight: 46, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginLeft: 52 },
  inlineButtonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  accountActions: { borderTopWidth: 1 },
  managementRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  managementDivider: { borderTopWidth: 1 },
  managementCopy: { flex: 1, minWidth: 0 },
  managementTitle: { fontSize: fontSizes.sm, fontWeight: '800' },
  managementDescription: { marginTop: 2, fontSize: 11, lineHeight: 16 },
  localHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  localIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  localCopy: { flex: 1, minWidth: 0 },
  localTitle: { fontSize: fontSizes.md, fontWeight: '900' },
  localSubtitle: { marginTop: 3, fontSize: fontSizes.xs, lineHeight: 18 },
  localChip: { minHeight: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  localChipText: { fontSize: 10, fontWeight: '900' },
  explanation: { fontSize: fontSizes.xs, lineHeight: 19 },
  googleButton: { minHeight: 52, borderWidth: 1, borderRadius: 26, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleLogo: { width: 20, height: 20 },
  googleButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
  setupText: { fontSize: 11, lineHeight: 17, textAlign: 'center' },
  feedback: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  feedbackText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 18 },
  dismiss: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
