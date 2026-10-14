import { mmkvStorageAdapter as storage } from '../../services/storageAdapter';
import { NOTE_LIMIT, parseReleaseNotes, type ReleaseDocument } from './releaseNotesModel';
const KEY = 'orion.mobile.releaseNotes.v1';
const bundled: Record<string, string> = {
  '3.2.1': '# Orion Mobile\n\nOrion brings movies, series and anime together with discovery, your Library, downloads and connected devices.\n\n## Your Orion\n- Continue watching from where you left off.\n- Explore movies, series and anime.\n- Keep saved downloads available offline.\n\n[Official Orion releases](https://github.com/OK-ALI/Orion/releases)',
  '4.0.0': '# A New Way to Discover\n\nOrion 4.0 is the final major **feature release**. Bug fixes, compatibility work, essential maintenance and improvements driven by feedback may follow where necessary.\n\n## Glimpse\n- Explore clips from movies, series and anime.\n- Save private Likes on this device.\n- Search, filter and sort what you explore.\n- Choose sound, auto-advance and ambient glow in Glimpse settings.\n\n## Stay connected to Orion\n- Report a problem, suggest a feature or share your experience from the sidebar Feedback shortcut.\n- Choose whether to include safe diagnostics and an optional screenshot.\n- Keep your Feedback IDs and history on this device, and add information later.\n\n## Still Orion\nYour familiar discovery, Library, playback, downloads and connected devices remain part of Orion.\n\n[Official Orion releases](https://github.com/OK-ALI/Orion/releases)',
};
export function installedReleaseNotes(version: string): ReleaseDocument {
  try { const cached = JSON.parse(storage.get(KEY) || 'null'); if (cached?.version === version && typeof cached.notes === 'string' && cached.notes.trim() && cached.notes.length <= NOTE_LIMIT) return cached; } catch { /* bundled offline fallback */ }
  return { version, title: 'Release Notes', notes: bundled[version] || bundled['3.2.1'] };
}
// Called only with the already-authoritative updater result, never fetches notes.
export function releaseNotesFromUpdate(installed: string, available?: { version: string; notes?: string | null } | null): ReleaseDocument {
  if (!available?.notes?.trim() || !parseReleaseNotes(available.notes).length) return installedReleaseNotes(installed);
  const document = { version: available.version, title: 'Release Notes', notes: available.notes.slice(0, NOTE_LIMIT) };
  if (available.version === installed) { try { storage.set(KEY, JSON.stringify(document)); } catch { /* preserve bundled fallback */ } }
  return document;
}
