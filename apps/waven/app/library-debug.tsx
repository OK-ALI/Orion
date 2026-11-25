import { useState } from 'react';
import { NativeModules, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createMMKV } from 'react-native-mmkv';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenText as Text } from '../src/components/typography/WavenText';
import { LibraryButton, LibraryNotice } from '../src/components/library/WavenLibraryControls';
import { LocalLibraryRepository, libraryEntityKey, libraryStorageKey } from '../src/features/library/localLibrary';
import fixture from '../tests/fixtures/p7-library-v1.json';
import { wavenColors } from '../src/theme/tokens';
import { nativePlayback } from '../src/features/playback/native/WavenPlaybackNative';

/** Controlled native-storage fixture evidence. Never writes product Library or session data. */
export default function LibraryValidationRoute() {
  const router = useRouter(), [result, setResult] = useState('Ready. No fixture has been written.');
  if (!__DEV__) return <WavenAppShell><LibraryNotice message="Library validation is available only in development." /></WavenAppShell>;
  const open = () => {
    const mmkv = createMMKV({ id: 'waven.library.validation' });
    return { get: (key: string) => mmkv.getString(key) ?? null, set: (key: string, value: string) => mmkv.set(key, value), remove: (key: string) => { mmkv.remove(key); }, keys: () => mmkv.getAllKeys() };
  };
  const verify = () => {
    try {
      const storage = open(), a = new LocalLibraryRepository(storage, Date.now, fixture.scope);
      const b = new LocalLibraryRepository(storage, Date.now, 'google:p7-validation-b');
      const state = a.getSnapshot().state, isolated = b.getSnapshot().state;
      if (state.version !== 2 || state.favorites.length !== 1 || state.playlists.length !== 1 || isolated.favorites.length || isolated.playlists.length) throw Error('Fixture validation failed.');
      const playlist = state.playlists[0];
      const order = playlist.tracks.map(t => t.source.id).join(',');
      const raw = storage.get(libraryStorageKey(fixture.scope));
      if (!raw || JSON.parse(raw).version !== 2) throw Error('Migration was not durable.');
      const original = JSON.stringify(fixture), prefix = `${libraryStorageKey(fixture.scope)}.recovery.`;
      if (!storage.keys().some(key => key.startsWith(prefix) && storage.get(key) === original)) throw Error('Original migration fixture backup was not retained.');
      setResult(`PASS · real MMKV\nSchema ${state.version}\nAccount A: 1 favorite, 1 playlist\nAccount B: empty\nPlaylist order: ${order}\nRevision: ${state.revision}\nOriginal v1 retained before migration\nStorage: isolated validation instance`);
    } catch (error) { setResult(error instanceof Error ? error.message : 'Native validation failed.'); }
  };
  return <WavenAppShell><View style={{ gap: 14, paddingVertical: 20 }}>
    <Text accessibilityRole="header" style={{ color: wavenColors.textPrimary, fontSize: 22 }}>Local Library Validation</Text>
    <Text style={{ color: wavenColors.textMuted }}>Development fixtures only. This uses a separate MMKV instance and never changes your music Library, Google identity or accepted release.</Text>
    <LibraryButton label="Prepare v1 migration fixture" onPress={() => {
      try { const storage = open(), key = libraryStorageKey(fixture.scope);
        if (storage.get(key) === null) { storage.set(key, JSON.stringify(fixture)); setResult('Version 1 fixture written to isolated MMKV. Ready to migrate.'); }
        else setResult('Existing validation fixture preserved. Use Verify to inspect it.');
      } catch { setResult('Native fixture storage unavailable.'); }
    }} />
    <LibraryButton label="Verify migration and account isolation" onPress={verify} />
    <LibraryButton label="Reorder fixture playlist" onPress={() => {
      try { const a = new LocalLibraryRepository(open(), Date.now, fixture.scope), playlist = a.getSnapshot().state.playlists[0];
        if (!playlist) throw Error('Prepare fixture first.');
        const first = playlist.tracks[0]; if (first && playlist.tracks.length > 1) a.moveTrack(playlist.id, libraryEntityKey('track', first), 1); verify();
      } catch { setResult('Prepare the migration fixture before reordering.'); }
    }} />
    <LibraryButton label="Remove fixture song two" onPress={() => {
      try { const a = new LocalLibraryRepository(open(), Date.now, fixture.scope), playlist = a.getSnapshot().state.playlists[0];
        const two = playlist?.tracks.find(t => t.source.id === 'two');
        if (two) a.removeTrack(playlist.id, libraryEntityKey('track', two)); verify();
      } catch { setResult('Fixture mutation failed.'); }
    }} />
    <LibraryNotice message={result} />
    <LibraryButton label="Inspect playback source diagnostics" onPress={async () => {
      try {
        const value = await NativeModules.WavenStreamingSource.getDiagnostics();
        const player = await nativePlayback.getSnapshot();
        setResult(`Source stage: ${value.stage}\nFailure category: ${value.failure ?? 'none'}\nClient: ${value.client}\nExtractor: ${value.extractorVersion}\nDocument bytes: ${value.documentBytes}\nContinuation checked: ${value.continuationChecked}\nPlayer: ${player.state}\nPosition: ${player.positionMs}\nPlayer failure: ${player.error?.code ?? 'none'}\nQueue size: ${player.queueIds.length}\nCurrent song: ${player.currentItem?.title ?? 'none'}`);
      } catch { setResult('Native source diagnostics unavailable.'); }
    }} />
    <LibraryButton label="Back to Home" onPress={() => router.replace('/')} />
  </View></WavenAppShell>;
}
