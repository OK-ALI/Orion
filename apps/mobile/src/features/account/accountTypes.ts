export type OrionAccountPhase =
  | 'restoring'
  | 'signed-out'
  | 'signing-in'
  | 'signing-out'
  | 'signed-in'
  | 'cancelled'
  | 'error';

export interface OrionAccountProfile {
  schemaVersion: 1;
  provider: 'google';
  accountId: string;
  email: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  avatarUrl: string | null;
  connectedAt: number;
}

export interface NativeGoogleIdentityProfile {
  provider: 'google';
  accountId: string;
  email: string;
  displayName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  avatarUrl?: string | null;
}

export interface OrionAccountState {
  phase: OrionAccountPhase;
  profile: OrionAccountProfile | null;
  feedback: string | null;
}