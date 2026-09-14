import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { wavenColors, wavenRadii, wavenSpacing } from '../../theme/tokens';
import {
  clearOrionGoogleCredentialState,
  isNativeOrionGoogleIdentityAvailable,
  signInToOrionCloud,
  type WavenGoogleIdentityProfile,
} from '../../infrastructure/orionCloud/nativeGoogleIdentity';
import {
  authorizeOrionDriveReadAccess,
  checkOrionDriveReadAccess,
  clearOrionDriveAuthorizationCache,
  isNativeOrionDriveAuthorizationAvailable,
  revokeOrionDriveAccess,
} from '../../infrastructure/orionCloud/nativeGoogleDriveAuthorization';
import {
  isNativeOrionCloudReadOnlyProbeAvailable,
  readExistingOrionPrimaryProfile,
} from '../../infrastructure/orionCloud/orionCloudReadOnlyProbe';

type GatePhase =
  | 'idle'
  | 'signing-in'
  | 'signed-in'
  | 'authorizing'
  | 'authorized'
  | 'reading'
  | 'found'
  | 'missing'
  | 'revoking'
  | 'revoked'
  | 'error';

const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID || '').trim();

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'UNKNOWN';
  const value = String((error as { code?: unknown }).code || '').trim();
  return value || 'UNKNOWN';
}

export function OrionCloudReadOnlyGateCard() {
  const [phase, setPhase] = useState<GatePhase>('idle');
  const [profile, setProfile] = useState<WavenGoogleIdentityProfile | null>(null);
  const [driveAuthorized, setDriveAuthorized] = useState(false);
  const [message, setMessage] = useState(
    'This gate can sign in, request or revoke private Drive app-data access, and read the existing Orion primary profile. It cannot create, write, update, or delete one.',
  );

  const nativeReady =
    Platform.OS === 'android' &&
    isNativeOrionGoogleIdentityAvailable() &&
    isNativeOrionDriveAuthorizationAvailable() &&
    isNativeOrionCloudReadOnlyProbeAvailable();

  const configured = nativeReady && !!GOOGLE_WEB_CLIENT_ID;
  const busy =
    phase === 'signing-in' ||
    phase === 'authorizing' ||
    phase === 'reading' ||
    phase === 'revoking';

  const status = useMemo(() => {
    if (!nativeReady) return 'Development build required';
    if (!GOOGLE_WEB_CLIENT_ID) return 'OAuth configuration required';
    if (phase === 'found') return 'Existing profile visible';
    if (phase === 'missing') return 'STOP: profile not visible';
    if (phase === 'revoked') return 'Drive access revoked';
    if (phase === 'authorized') return 'Read access ready';
    if (profile) return 'Google identity ready';
    return 'Ready for read-only check';
  }, [nativeReady, phase, profile]);

  const signIn = async () => {
    if (!configured || busy) return;
    setPhase('signing-in');
    setMessage('Opening Google identity. No Orion Cloud profile access has happened yet.');
    try {
      const nextProfile = await signInToOrionCloud(GOOGLE_WEB_CLIENT_ID);
      setProfile(nextProfile);
      const existingGrant = await checkOrionDriveReadAccess(nextProfile.email);
      if (existingGrant.authorized) {
        setDriveAuthorized(true);
        setPhase('authorized');
        setMessage('Google identity and private Drive app-data authorization are ready. The profile has not been read yet.');
      } else {
        setDriveAuthorized(false);
        setPhase('signed-in');
        setMessage('Google identity is ready. Drive app-data permission still requires explicit authorization.');
      }
    } catch (error) {
      setProfile(null);
      setDriveAuthorized(false);
      setPhase('error');
      setMessage(`Google identity failed safely (${errorCode(error)}). No Orion Cloud data was changed.`);
    }
  };

  const authorize = async () => {
    if (!profile || busy) return;
    setPhase('authorizing');
    setMessage('Requesting the existing Orion Cloud private app-data scope. No profile write is available.');
    try {
      await authorizeOrionDriveReadAccess(profile.email);
      setDriveAuthorized(true);
      setPhase('authorized');
      setMessage('Private Drive app-data access is authorized. Run the explicit read-only visibility check next.');
    } catch (error) {
      setPhase('error');
      setMessage(`Drive authorization failed safely (${errorCode(error)}). No Orion Cloud profile was changed.`);
    }
  };

  const revokeDriveAccess = async () => {
    if (!profile || !driveAuthorized || busy) return;
    setPhase('revoking');
    setMessage(
      'Revoking only the Google Drive app-data authorization. The Orion Cloud profile and its data will not be deleted or modified.',
    );
    try {
      await revokeOrionDriveAccess(profile.email);
      setDriveAuthorized(false);
      setPhase('revoked');
      setMessage(
        'Drive access revoked. The Orion Cloud profile and its data were not deleted or modified. Reauthorize private Drive data to repeat the read-only verification.',
      );
    } catch (error) {
      setPhase('error');
      setMessage(
        `Drive access revocation failed safely (${errorCode(error)}). Authorization was not reported as revoked, and no Orion Cloud profile data was changed.`,
      );
    }
  };

  const verifyVisibility = async () => {
    if (!profile || !driveAuthorized || phase !== 'authorized') return;
    setPhase('reading');
    setMessage('Reading only the existing Orion primary profile. Create and write operations are unavailable.');
    try {
      const result = await readExistingOrionPrimaryProfile(profile.email);
      if (result.state === 'missing') {
        setPhase('missing');
        setMessage(
          'STOP. The existing Orion primary profile is not visible to WAVEN. No replacement was created and no write was attempted.',
        );
        return;
      }

      const namespaceCount = Object.keys(result.profile.namespaces).length;
      setPhase('found');
      setMessage(
        `PASS. Existing Orion primary profile is visible and validates as PortableProfileV3. Revision ${result.profile.revision}; ${namespaceCount} namespace(s). No write was attempted.`,
      );
    } catch (error) {
      setPhase('error');
      setMessage(`Read-only visibility check failed safely (${errorCode(error)}). No Orion Cloud data was changed.`);
    }
  };

  const resetLocalSession = async () => {
    if (busy) return;
    await Promise.allSettled([
      clearOrionDriveAuthorizationCache(),
      clearOrionGoogleCredentialState(),
    ]);
    setProfile(null);
    setDriveAuthorized(false);
    setPhase('idle');
    setMessage('Local identity and authorization caches were cleared. The Google Drive grant and Orion Cloud data were not revoked or changed.');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PHASE 2.3A</Text>
      <Text style={styles.title}>Orion Cloud Read-Only Lifecycle Gate</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.message}>{message}</Text>

      {!nativeReady && (
        <Text style={styles.warning}>
          Expo Go cannot validate this native gate. Use the WAVEN Android development build.
        </Text>
      )}

      {nativeReady && !GOOGLE_WEB_CLIENT_ID && (
        <Text style={styles.warning}>
          Set EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID before building. Never place a client secret or OAuth token in an EXPO_PUBLIC variable.
        </Text>
      )}

      <View style={styles.actions}>
        <GateButton
          disabled={!configured || busy}
          label={phase === 'signing-in' ? 'Signing in…' : '1. Sign in with Google'}
          onPress={signIn}
        />

        <GateButton
          disabled={!profile || busy || driveAuthorized}
          label={phase === 'authorizing' ? 'Authorizing…' : '2. Authorize private Drive data'}
          onPress={authorize}
        />

        <GateButton
          disabled={!profile || !driveAuthorized || phase !== 'authorized' || busy}
          label={phase === 'reading' ? 'Reading…' : '3. Verify existing profile, read only'}
          onPress={verifyVisibility}
        />

        <GateButton
          secondary
          disabled={!profile || !driveAuthorized || busy}
          label={phase === 'revoking' ? 'Revoking…' : 'Revoke private Drive access'}
          onPress={revokeDriveAccess}
        />

        <GateButton
          secondary
          disabled={busy}
          label="Clear local test session (does not revoke)"
          onPress={resetLocalSession}
        />
      </View>

      <Text style={styles.lifecycleNote}>
        Clear local session removes local/native authorization caches and Credential Manager state;
        it does not revoke the Drive grant. Revoke private Drive access removes only that grant.
        Neither action deletes or changes Orion Cloud profile data.
      </Text>

      {busy && <ActivityIndicator color={wavenColors.activeBlue} style={styles.spinner} />}
    </View>
  );
}

function GateButton({
  label,
  onPress,
  disabled,
  secondary = false,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(17, 22, 28, 0.92)',
    borderColor: 'rgba(197, 202, 209, 0.16)',
    borderRadius: wavenRadii.lg,
    borderWidth: 1,
    marginTop: 32,
    maxWidth: 560,
    padding: wavenSpacing.lg,
    width: '100%',
  },
  eyebrow: {
    color: wavenColors.activeBlue,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  title: {
    color: wavenColors.coolWhite,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  status: {
    color: wavenColors.silver,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  message: {
    color: wavenColors.steelGray,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  warning: {
    color: wavenColors.skyBlue,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  actions: {
    gap: 10,
    marginTop: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: wavenColors.blue,
    borderRadius: wavenRadii.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButton: {
    backgroundColor: wavenColors.elevatedSurface,
    borderColor: 'rgba(197, 202, 209, 0.18)',
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.42,
  },
  pressedButton: {
    opacity: 0.82,
  },
  buttonText: {
    color: wavenColors.coolWhite,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: wavenColors.silver,
  },
  lifecycleNote: {
    color: wavenColors.steelGray,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  spinner: {
    marginTop: 16,
  },
});
