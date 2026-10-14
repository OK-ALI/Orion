export const RELEASE = '4.0.0';
export const WELCOME_KEY = 'orion.mobile.releaseWelcome.v1';
export const TEST_KEY = 'orion.mobile.releaseWelcome.qualification.v1';
export interface WelcomeStorage { get(key: string): string | null; set(key: string, value: string): void }
export interface Installation { version: string; firstInstallTime: number; lastUpdateTime: number }
export interface WelcomeRecord { schemaVersion: 1; lastCompletedReleaseWelcome: string | null; installation: 'upgrade' | 'fresh' | null; qualificationRequest?: string }
export function normalizeWelcome(raw: string | null): WelcomeRecord {
  try { const v = JSON.parse(raw || '{}'); return { schemaVersion: 1, lastCompletedReleaseWelcome: v.lastCompletedReleaseWelcome === RELEASE ? RELEASE : null, installation: v.installation === 'upgrade' || v.installation === 'fresh' ? v.installation : null, ...(typeof v.qualificationRequest === 'string' && /^[a-z0-9-]{1,64}$/.test(v.qualificationRequest) ? { qualificationRequest: v.qualificationRequest } : {}) }; } catch { return { schemaVersion: 1, lastCompletedReleaseWelcome: null, installation: null }; }
}
export function resolveWelcome(storage: WelcomeStorage, facts: Installation, qualification = false): boolean {
  const key = qualification ? TEST_KEY : WELCOME_KEY; const state = normalizeWelcome(storage.get(key));
  if (state.lastCompletedReleaseWelcome === RELEASE) return false;
  if (!qualification && facts.version !== RELEASE) return false;
  if (!state.installation) {
    if (!qualification && (!Number.isSafeInteger(facts.firstInstallTime) || facts.firstInstallTime <= 0 || !Number.isSafeInteger(facts.lastUpdateTime) || facts.lastUpdateTime < facts.firstInstallTime)) return false;
    state.installation = qualification || facts.lastUpdateTime > facts.firstInstallTime ? 'upgrade' : 'fresh';
    storage.set(key, JSON.stringify(state));
  }
  return state.installation === 'upgrade';
}
export function completeWelcome(storage: WelcomeStorage, qualification: boolean): void {
  const key = qualification ? TEST_KEY : WELCOME_KEY;
  storage.set(key, JSON.stringify({ ...normalizeWelcome(storage.get(key)), lastCompletedReleaseWelcome: RELEASE }));
  if (normalizeWelcome(storage.get(key)).lastCompletedReleaseWelcome !== RELEASE) throw new Error('WELCOME_WRITE_FAILED');
}


/** Completed welcomes and known fresh installs retain the ordinary synchronous startup path. */
export function shouldCheckWelcome(storage: WelcomeStorage, productVersion: string | undefined, qualification = false): boolean {
  if (!qualification && productVersion !== RELEASE) return false;
  const state = normalizeWelcome(storage.get(qualification ? TEST_KEY : WELCOME_KEY));
  return state.lastCompletedReleaseWelcome !== RELEASE && state.installation !== 'fresh';
}
