import { mmkvStorageAdapter } from '../../services/storageAdapter';

const PAIRING_GUARD_KEY = 'orion_smart_connect_pairing_guard_v1';

export interface PairingGuardSnapshot {
  attemptsRemaining: number | null;
  lockoutUntil: number | null;
}

export const readPairingGuard = (): PairingGuardSnapshot | null => {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(PAIRING_GUARD_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      attemptsRemaining: Number.isFinite(parsed.attemptsRemaining) ? Number(parsed.attemptsRemaining) : null,
      lockoutUntil: Number(parsed.lockoutUntil) > 0 ? Number(parsed.lockoutUntil) : null,
    };
  } catch {
    return null;
  }
};

export const writePairingGuard = (snapshot: PairingGuardSnapshot) => {
  mmkvStorageAdapter.set(PAIRING_GUARD_KEY, JSON.stringify(snapshot));
};

export const clearPairingGuard = () => mmkvStorageAdapter.remove(PAIRING_GUARD_KEY);
