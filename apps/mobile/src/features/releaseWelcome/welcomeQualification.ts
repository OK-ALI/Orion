import { GLIMPSE_INTERNAL_PREVIEW } from '../glimpse/glimpseBuild';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import { normalizeWelcome, TEST_KEY } from './welcomeState';
const listeners = new Set<() => void>();
export function qualificationEnabled() { return GLIMPSE_INTERNAL_PREVIEW && mmkvStorageAdapter.get(TEST_KEY) !== null; }
export function resetWelcomeQualification(request: string | undefined) {
  if (!GLIMPSE_INTERNAL_PREVIEW) return false;
  if (!request || !/^[a-z0-9-]{1,64}$/.test(request)) return false;
  // Remounting the qualification route must never reset an already consumed request.
  if (normalizeWelcome(mmkvStorageAdapter.get(TEST_KEY)).qualificationRequest === request) return false;
  mmkvStorageAdapter.set(TEST_KEY, JSON.stringify({ schemaVersion: 1, lastCompletedReleaseWelcome: null, installation: 'upgrade', qualificationRequest: request }));
  listeners.forEach(listener => listener()); return true;
}
export function subscribeQualification(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
