import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { IStorageAdapter } from '@orion/shared/api';
import { useOrionAccount } from '../../context/AccountContext';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import {
  ensureLocalLibraryProfileV1,
  finalizeGoogleLibraryProfileV1,
  prepareGoogleLibraryProfileV1,
  googleLibraryProfileScopeV1,
  localLibraryProfileScopeV1,
  type LibraryProfileKind,
} from '../library/libraryProfileStorage';
import { clearMyListSyncCheckpointV1 } from './myListSyncCheckpoint';
import {
  canCarryWatchedSyncCheckpointToScopedLibraryV1,
  clearWatchedSyncCheckpointV1,
} from './watchedSyncCheckpoint';
import { clearViewingActivitySyncCheckpointV1 } from './viewingActivitySyncCheckpoint';

export type LibraryProfilePhase = 'preparing' | 'ready' | 'error';

interface BoundLibraryProfileState {
  targetKey: string | null;
  phase: LibraryProfilePhase;
  kind: LibraryProfileKind | null;
  scopeId: string | null;
  profileId: string | null;
  storage: IStorageAdapter | null;
  errorCode: string | null;
}

interface LibraryProfileContextValue extends BoundLibraryProfileState {
  ready: boolean;
  cloudEligible: boolean;
}

const LibraryProfileContext = createContext<LibraryProfileContextValue | null>(null);

export function LibraryProfileProvider({ children }: { children: React.ReactNode }) {
  const account = useOrionAccount();
  const accountProfileId = account.state.profile?.accountId?.trim() || null;
  const targetKey = account.state.phase === 'restoring'
    ? null
    : accountProfileId
      ? googleLibraryProfileScopeV1(accountProfileId).scopeId
      : localLibraryProfileScopeV1().scopeId;
  const [bound, setBound] = useState<BoundLibraryProfileState>({
    targetKey: null,
    phase: 'preparing',
    kind: null,
    scopeId: null,
    profileId: null,
    storage: null,
    errorCode: null,
  });

  useEffect(() => {
    if (!targetKey) {
      setBound({
        targetKey: null,
        phase: 'preparing',
        kind: null,
        scopeId: null,
        profileId: null,
        storage: null,
        errorCode: null,
      });
      return;
    }

    try {
      if (!accountProfileId) {
        const prepared = ensureLocalLibraryProfileV1(mmkvStorageAdapter);
        setBound({
          targetKey,
          phase: 'ready',
          kind: prepared.scope.kind,
          scopeId: prepared.scope.scopeId,
          profileId: null,
          storage: prepared.storage,
          errorCode: null,
        });
        return;
      }

      const prepared = prepareGoogleLibraryProfileV1(mmkvStorageAdapter, accountProfileId);
      if (prepared.needsFinalization) {
        // Checkpoints created against the old unscoped library cannot prove
        // convergence for this new account-scoped storage lineage. Data and
        // Orion Cloud stay untouched; existing first-enrollment logic proves
        // the new relationship again before Auto Sync can resume.
        clearMyListSyncCheckpointV1(accountProfileId);

        // Watched first enrollment is intentionally explicit, so blindly
        // deleting an already-valid checkpoint makes an existing enrolled
        // user fall back to Manual after this storage-only migration. Carry
        // the checkpoint only when the newly scoped copy still has exactly
        // the same portable Watched truth it previously verified. Any
        // mismatch remains conservative and returns to explicit enrollment.
        const carryWatchedCheckpoint = canCarryWatchedSyncCheckpointToScopedLibraryV1(
          accountProfileId,
          prepared.storage,
        );
        if (!carryWatchedCheckpoint) clearWatchedSyncCheckpointV1(accountProfileId);

        // Viewing Activity checkpoints bind verified History/playback truth to
        // the prior storage lineage. Re-enroll against the scoped copy instead
        // of carrying that proof across a migration it did not verify.
        clearViewingActivitySyncCheckpointV1(accountProfileId);

        finalizeGoogleLibraryProfileV1(mmkvStorageAdapter, accountProfileId);
      }

      setBound({
        targetKey,
        phase: 'ready',
        kind: prepared.scope.kind,
        scopeId: prepared.scope.scopeId,
        profileId: accountProfileId,
        storage: prepared.storage,
        errorCode: null,
      });
    } catch (error) {
      const errorCode = error instanceof Error && /^LIBRARY_PROFILE_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'LIBRARY_PROFILE_INIT_FAILED';
      setBound({
        targetKey,
        phase: 'error',
        kind: null,
        scopeId: null,
        profileId: accountProfileId,
        storage: null,
        errorCode,
      });
    }
  }, [accountProfileId, targetKey]);

  // A previous profile is never considered ready after AccountContext switches
  // identities, even during the render before the preparation effect runs.
  const targetMatches = !!targetKey && bound.targetKey === targetKey;
  const effectivePhase: LibraryProfilePhase = targetMatches ? bound.phase : 'preparing';
  const ready = targetMatches
    && effectivePhase === 'ready'
    && !!bound.storage
    && !!bound.scopeId;
  const cloudEligible = ready
    && bound.kind === 'google'
    && !!accountProfileId
    && bound.profileId === accountProfileId;

  const value = useMemo<LibraryProfileContextValue>(() => ({
    ...bound,
    phase: effectivePhase,
    ready,
    cloudEligible,
  }), [bound, cloudEligible, effectivePhase, ready]);

  return <LibraryProfileContext.Provider value={value}>{children}</LibraryProfileContext.Provider>;
}

export function useOrionLibraryProfile(): LibraryProfileContextValue {
  const value = useContext(LibraryProfileContext);
  if (!value) throw new Error('useOrionLibraryProfile must be used within LibraryProfileProvider');
  return value;
}
