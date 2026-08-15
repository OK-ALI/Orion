import type { MobilePlayerPresentation } from '@orion/shared/types';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

const KEY = 'orion.player.presentation.v1';

interface Preferences {
  native: MobilePlayerPresentation;
  embedded: Record<string, MobilePlayerPresentation>;
}

const DEFAULTS: Preferences = { native: 'fit', embedded: {} };
const MODES = new Set<MobilePlayerPresentation>(['fit', 'fill', 'stretch', 'provider']);

function readPreferences(): Preferences {
  try {
    const raw = mmkvStorageAdapter.get(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      native: MODES.has(parsed.native as MobilePlayerPresentation) ? parsed.native! : 'fit',
      embedded: Object.fromEntries(Object.entries(parsed.embedded || {}).filter(([, mode]) => MODES.has(mode))),
    };
  } catch {
    return DEFAULTS;
  }
}

export function getPresentationPreference(surface: 'native' | 'embed', sourceId: string): MobilePlayerPresentation {
  const preferences = readPreferences();
  return surface === 'native' ? preferences.native : preferences.embedded[sourceId] || 'provider';
}

export function savePresentationPreference(surface: 'native' | 'embed', sourceId: string, mode: MobilePlayerPresentation) {
  if (!MODES.has(mode)) return;
  const preferences = readPreferences();
  if (surface === 'native') preferences.native = mode;
  else preferences.embedded[sourceId] = mode;
  mmkvStorageAdapter.set(KEY, JSON.stringify(preferences));
}

export function getEmbeddedPresentationModes(sourceId: string): MobilePlayerPresentation[] {
  // These sources render inside a known responsive player viewport. Generic
  // DOM/CSS mutation remains prohibited; Orion only sizes the outer WebView.
  const viewportSafe = new Set(['videasy', 'vidsrc', 'vidking', 'vidlink', 'autoembed', 'vsembed', '111movies', 'vixsrc']);
  return viewportSafe.has(sourceId) ? ['provider', 'fit', 'fill', 'stretch'] : ['provider'];
}
