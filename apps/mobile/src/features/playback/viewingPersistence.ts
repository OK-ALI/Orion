export type PlaybackPurpose = 'viewing' | 'download-resolution';

export function runViewingSideEffect(purpose: PlaybackPurpose, effect: () => void): boolean {
  if (purpose !== 'viewing') return false;
  effect();
  return true;
}
