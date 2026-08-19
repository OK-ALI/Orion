import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useOrionAccount } from '../../context/AccountContext';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

const SYNC_POLICY_SCHEMA_VERSION = 1 as const;
const SYNC_POLICY_KEY_PREFIX = 'p8.syncPolicy.v1:';

// P8.3 introduced the reusable local policy registry. P8.4 C3-D enrolls
// Watched without changing the storage contract or making policy portable.
export const ORION_SYNC_DOMAINS = ['myList', 'watched'] as const;
export type OrionSyncDomain = (typeof ORION_SYNC_DOMAINS)[number];

export interface OrionSyncDomainPolicyV1 {
  automatic: boolean;
}

interface StoredSyncPolicyV1 {
  schemaVersion: typeof SYNC_POLICY_SCHEMA_VERSION;
  profileId: string;
  domains: Record<OrionSyncDomain, OrionSyncDomainPolicyV1>;
}

interface SyncPolicyContextValue {
  ready: boolean;
  getAutomatic: (domain: OrionSyncDomain) => boolean;
  setAutomatic: (domain: OrionSyncDomain, enabled: boolean) => void;
}

const SyncPolicyContext = createContext<SyncPolicyContextValue | null>(null);

function defaultDomains(): Record<OrionSyncDomain, OrionSyncDomainPolicyV1> {
  return {
    myList: { automatic: true },
    watched: { automatic: true },
  };
}

function keyFor(profileId: string): string {
  const normalized = profileId.trim();
  if (!normalized) throw new Error('Sync policy profile id is required.');
  return `${SYNC_POLICY_KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function loadStoredPolicy(profileId: string): StoredSyncPolicyV1 {
  const fallback: StoredSyncPolicyV1 = {
    schemaVersion: SYNC_POLICY_SCHEMA_VERSION,
    profileId,
    domains: defaultDomains(),
  };
  const raw = mmkvStorageAdapter.get(keyFor(profileId));
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSyncPolicyV1>;
    if (parsed.schemaVersion !== SYNC_POLICY_SCHEMA_VERSION || parsed.profileId !== profileId) return fallback;
    const domains = defaultDomains();
    for (const domain of ORION_SYNC_DOMAINS) {
      const automatic = parsed.domains?.[domain]?.automatic;
      if (typeof automatic === 'boolean') domains[domain] = { automatic };
    }
    return { schemaVersion: SYNC_POLICY_SCHEMA_VERSION, profileId, domains };
  } catch {
    return fallback;
  }
}

function saveStoredPolicy(policy: StoredSyncPolicyV1): void {
  mmkvStorageAdapter.set(keyFor(policy.profileId), JSON.stringify(policy));
}

export function OrionSyncPolicyProvider({ children }: { children: React.ReactNode }) {
  const account = useOrionAccount();
  const profileId = account.state.phase === 'signed-in'
    ? account.state.profile?.accountId ?? null
    : null;
  const [loaded, setLoaded] = useState<{ profileId: string | null; policy: StoredSyncPolicyV1 | null }>({
    profileId: null,
    policy: null,
  });

  useEffect(() => {
    if (!profileId) {
      setLoaded({ profileId: null, policy: null });
      return;
    }
    setLoaded({ profileId, policy: loadStoredPolicy(profileId) });
  }, [profileId]);

  const ready = profileId == null || loaded.profileId === profileId;

  const getAutomatic = useCallback((domain: OrionSyncDomain): boolean => {
    if (!profileId || !ready || !loaded.policy) return true;
    return loaded.policy.domains[domain].automatic;
  }, [loaded.policy, profileId, ready]);

  const setAutomatic = useCallback((domain: OrionSyncDomain, enabled: boolean) => {
    if (!profileId || !ready || !loaded.policy) return;
    setLoaded((current) => {
      if (current.profileId !== profileId || !current.policy) return current;
      const next: StoredSyncPolicyV1 = {
        ...current.policy,
        domains: {
          ...current.policy.domains,
          [domain]: { automatic: enabled },
        },
      };
      saveStoredPolicy(next);
      return { profileId, policy: next };
    });
  }, [loaded.policy, profileId, ready]);

  const value = useMemo<SyncPolicyContextValue>(() => ({
    ready,
    getAutomatic,
    setAutomatic,
  }), [getAutomatic, ready, setAutomatic]);

  return <SyncPolicyContext.Provider value={value}>{children}</SyncPolicyContext.Provider>;
}

export function useOrionSyncPolicy(): SyncPolicyContextValue {
  const value = useContext(SyncPolicyContext);
  if (!value) throw new Error('useOrionSyncPolicy must be used within OrionSyncPolicyProvider');
  return value;
}
