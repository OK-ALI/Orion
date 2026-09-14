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
import {
  clearControlledNoOpWriteState,
  executePreparedControlledNoOpWrite,
  isControlledNoOpWriteGateAvailable,
  prepareControlledNoOpWrite,
  retryControlledNoOpReadBack,
  type ControlledNoOpWritePreparation,
} from '../../infrastructure/orionCloud/orionCloudControlledNoOpWriteGate';

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
  | 'preparing-write'
  | 'write-armed'
  | 'writing'
  | 'write-verified'
  | 'write-conflict'
  | 'write-verification-required'
  | 'write-mismatch'
  | 'error';

const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID || '').trim();

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'UNKNOWN';
  const value = String((error as { code?: unknown }).code || '').trim();
  return value || 'UNKNOWN';
}

function shortRevision(revisionTag: string): string {
  if (revisionTag.startsWith('version:')) return revisionTag.slice('version:'.length);
  if (revisionTag.startsWith('etag:')) {
    return `etag:${revisionTag.slice('etag:'.length, 'etag:'.length + 12)}…`;
  }
  return revisionTag.slice(0, 18);
}

export function OrionCloudReadOnlyGateCard() {
  const [phase, setPhase] = useState<GatePhase>('idle');
  const [profile, setProfile] = useState<WavenGoogleIdentityProfile | null>(null);
  const [driveAuthorized, setDriveAuthorized] = useState(false);
  const [writePreparation, setWritePreparation] =
    useState<ControlledNoOpWritePreparation | null>(null);
  const [message, setMessage] = useState(
    'This development gate can sign in, request or revoke private Drive app-data access, read the existing Orion primary profile, and perform one separately prepared content-identical conditional write. It cannot create or delete a profile, and it cannot accept arbitrary profile content.',
  );

  const nativeReady =
    Platform.OS === 'android'
    && isNativeOrionGoogleIdentityAvailable()
    && isNativeOrionDriveAuthorizationAvailable()
    && isNativeOrionCloudReadOnlyProbeAvailable()
    && isControlledNoOpWriteGateAvailable();

  const configured = nativeReady && !!GOOGLE_WEB_CLIENT_ID;
  const busy =
    phase === 'signing-in'
    || phase === 'authorizing'
    || phase === 'reading'
    || phase === 'revoking'
    || phase === 'preparing-write'
    || phase === 'writing';

  const status = useMemo(() => {
    if (!nativeReady) return 'Development build required';
    if (!GOOGLE_WEB_CLIENT_ID) return 'OAuth configuration required';
    if (phase === 'write-verified') return 'Controlled no-op write verified';
    if (phase === 'write-armed') return 'Controlled write armed';
    if (phase === 'write-conflict') return 'STOP: conditional conflict';
    if (phase === 'write-verification-required') return 'Read-back verification required';
    if (phase === 'write-mismatch') return 'STOP: read-back mismatch';
    if (phase === 'found') return 'Existing profile visible';
    if (phase === 'missing') return 'STOP: profile not visible';
    if (phase === 'revoked') return 'Drive access revoked';
    if (phase === 'authorized') return 'Read access ready';
    if (profile) return 'Google identity ready';
    return 'Ready for preservation checks';
  }, [nativeReady, phase, profile]);

  const disarmWrite = () => {
    clearControlledNoOpWriteState();
    setWritePreparation(null);
  };

  const signIn = async () => {
    if (!configured || busy) return;
    disarmWrite();
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
    disarmWrite();
    setPhase('authorizing');
    setMessage('Requesting the existing Orion Cloud private app-data scope. No profile write is being attempted.');
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
    disarmWrite();
    setPhase('revoking');
    setMessage(
      'Revoking only the Google Drive app-data authorization. The Orion Cloud profile and its data will not be deleted or modified.',
    );
    try {
      await revokeOrionDriveAccess(profile.email);
      setDriveAuthorized(false);
      setPhase('revoked');
      setMessage(
        'Drive access revoked. The Orion Cloud profile and its data were not deleted or modified. Reauthorize private Drive data to repeat the preservation checks.',
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
    disarmWrite();
    setPhase('reading');
    setMessage('Reading only the existing Orion primary profile. No mutation is being attempted.');
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

  const prepareWrite = async () => {
    if (!profile || !driveAuthorized || phase !== 'found' || busy) return;
    disarmWrite();
    setPhase('preparing-write');
    setMessage(
      'Preparing only: capturing the exact raw preimage, SHA-256, PortableProfileV3 revision, namespaces, and conditional Drive revision. This step does not write.',
    );
    try {
      const preparation = await prepareControlledNoOpWrite(profile.email);
      setWritePreparation(preparation);
      setPhase('write-armed');
      setMessage(
        `ARMED, NOT WRITTEN. Captured ${preparation.rawByteLength} exact UTF-8 bytes; SHA-256 ${preparation.rawSha256.slice(0, 16)}…; Drive revision ${shortRevision(preparation.revisionTag)}; PortableProfileV3 revision ${preparation.portableProfileRevision}; ${preparation.namespaceCount} namespace(s). Expected semantic delta: ZERO. The next button is the only action that can perform the approved conditional no-op write.`,
      );
    } catch (error) {
      disarmWrite();
      setPhase('error');
      setMessage(`Controlled-write preparation failed safely (${errorCode(error)}). No write was attempted.`);
    }
  };

  const executeWrite = async () => {
    if (!profile || !driveAuthorized || phase !== 'write-armed' || !writePreparation || busy) return;

    setPhase('writing');
    setMessage(
      'Executing the explicitly approved content-identical write. WAVEN will re-read the profile first, require the same revision and SHA-256, use that revision as the conditional precondition, write the exact captured bytes, then read them back. No arbitrary content is accepted.',
    );

    try {
      const result = await executePreparedControlledNoOpWrite(
        profile.email,
        writePreparation.revisionTag,
        writePreparation.rawSha256,
      );

      if (result.state === 'conflict') {
        setWritePreparation(null);
        setPhase('write-conflict');
        setMessage(
          `STOP. Conditional conflict before the no-op write could be accepted. Expected ${shortRevision(result.expectedRevisionTag)}; current ${result.currentRevisionTag ? shortRevision(result.currentRevisionTag) : 'missing'}. Do not retry automatically. No overwrite was accepted by this gate.`,
        );
        return;
      }

      if (result.state === 'verification-required') {
        setWritePreparation(null);
        setPhase('write-verification-required');
        setMessage(
          `The conditional write reported success, but immediate read-back could not finish (${result.errorCode}). DO NOT execute the write again. Use only "Retry read-back verification". Expected SHA-256 ${result.rawSha256.slice(0, 16)}…; written revision ${shortRevision(result.writtenRevisionTag)}.`,
        );
        return;
      }

      if (result.state === 'mismatch') {
        setWritePreparation(null);
        setPhase('write-mismatch');
        setMessage(
          `STOP. The controlled write completed but read-back did not match the exact preimage. ${result.reason} Expected SHA-256 ${result.expectedSha256.slice(0, 16)}…; actual ${result.actualSha256 ? `${result.actualSha256.slice(0, 16)}…` : 'unavailable'}. Do not perform another write.`,
        );
        return;
      }

      setWritePreparation(null);
      setPhase('write-verified');
      setMessage(
        `PASS. Controlled no-op write and read-back verified. Exact payload SHA-256 ${result.rawSha256.slice(0, 16)}… is unchanged; ${result.rawByteLength} bytes; PortableProfileV3 revision ${result.portableProfileRevision}; ${result.namespaceCount} namespace(s). Drive revision advanced ${shortRevision(result.beforeRevisionTag)} → ${shortRevision(result.afterRevisionTag)}. Semantic profile delta: ZERO.`,
      );
    } catch (error) {
      setWritePreparation(null);
      setPhase('error');
      setMessage(
        `Controlled no-op write stopped safely (${errorCode(error)}). If the message did not explicitly report a successful write, do not assume a write occurred.`,
      );
    }
  };

  const retryReadBack = async () => {
    if (!profile || !driveAuthorized || phase !== 'write-verification-required' || busy) return;

    setPhase('writing');
    setMessage('Retrying READ-BACK ONLY. This action does not call writePortableProfile and cannot perform a second write.');

    try {
      const result = await retryControlledNoOpReadBack(profile.email);

      if (result.state === 'verification-required') {
        setPhase('write-verification-required');
        setMessage(
          `Read-back is still unavailable (${result.errorCode}). No second write was attempted. Restore connectivity if needed and retry read-back only.`,
        );
        return;
      }

      if (result.state === 'mismatch') {
        setPhase('write-mismatch');
        setMessage(`STOP. Read-back does not match the captured preimage. ${result.reason} Do not perform another write.`);
        return;
      }

      if (result.state === 'verified') {
        setPhase('write-verified');
        setMessage(
          `PASS. Delayed read-back verified the exact captured preimage. SHA-256 ${result.rawSha256.slice(0, 16)}…; Drive revision ${shortRevision(result.beforeRevisionTag)} → ${shortRevision(result.afterRevisionTag)}. Semantic profile delta: ZERO.`,
        );
        return;
      }

      setPhase('write-conflict');
      setMessage('STOP. Unexpected conflict state during read-back verification. No second write was attempted.');
    } catch (error) {
      setPhase('write-verification-required');
      setMessage(`Read-back retry failed safely (${errorCode(error)}). No second write was attempted.`);
    }
  };

  const resetLocalSession = async () => {
    if (busy) return;
    disarmWrite();
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
      <Text style={styles.eyebrow}>PHASE 2.3D</Text>
      <Text style={styles.title}>Orion Cloud Preservation Gate</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.message}>{message}</Text>

      {!nativeReady && (
        <Text style={styles.warning}>
          Expo Go cannot validate this native gate. Use the WAVEN Android development build.
        </Text>
      )}

      {nativeReady && !GOOGLE_WEB_CLIENT_ID && (
        <Text style={styles.warning}>
          Set EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID before running this gate. Never place a client secret or OAuth token in an EXPO_PUBLIC variable.
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
          disabled={!profile || !driveAuthorized || phase !== 'found' || busy}
          label={phase === 'preparing-write' ? 'Preparing…' : '4. Prepare controlled no-op write'}
          onPress={prepareWrite}
        />
        <GateButton
          danger
          disabled={!profile || !driveAuthorized || phase !== 'write-armed' || !writePreparation || busy}
          label={phase === 'writing' ? 'Writing…' : '5. EXECUTE identical conditional write'}
          onPress={executeWrite}
        />

        {phase === 'write-verification-required' && (
          <GateButton
            secondary
            disabled={!profile || !driveAuthorized || busy}
            label="Retry read-back verification only"
            onPress={retryReadBack}
          />
        )}

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
        Safety boundary: preparation is read-only. The execute action is enabled only after a fresh
        existing-profile capture. Immediately before writing, WAVEN re-reads and requires the same
        exact bytes, SHA-256, and conditional Drive revision. It writes only those captured bytes
        back to the same existing profile with a non-null expected revision, then requires exact
        read-back. No create path and no arbitrary payload input are exposed by this gate.
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
  danger = false,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled: boolean;
  secondary?: boolean;
  danger?: boolean;
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
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
          danger && styles.dangerButtonText,
        ]}
      >
        {label}
      </Text>
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
  dangerButton: {
    backgroundColor: 'rgba(92, 24, 32, 0.92)',
    borderColor: 'rgba(255, 92, 110, 0.48)',
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
  dangerButtonText: {
    color: wavenColors.coolWhite,
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
