import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createMMKV } from 'react-native-mmkv';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenText as Text } from '../src/components/typography/WavenText';
import { LibraryButton, LibraryNotice } from '../src/components/library/WavenLibraryControls';
import { getLocalLibrary } from '../src/features/library/libraryRuntime';
import { LocalLibraryRepository, libraryEntityKey } from '../src/features/library/localLibrary';
import { nativePlayback } from '../src/features/playback/native/WavenPlaybackNative';
import { useWavenConnectivity } from '../src/infrastructure/connectivity/connectivityHooks';
import { checkWavenConnection, setConnectivityValidationOutage } from '../src/infrastructure/connectivity/connectivityRuntime';
import { offlineMetadata, OfflineMetadataStore } from '../src/infrastructure/connectivity/offlineMetadata';
import { wavenColors } from '../src/theme/tokens';

/** Development evidence only. Fixture mutations use independent MMKV, never product Library. */
export default function ConnectivityValidationRoute() {
  const connection = useWavenConnectivity(), router = useRouter();
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  const [result, setResult] = useState('No fixture changed.');
  const inspect = async () => {
    const library = getLocalLibrary().getSnapshot().state, playback = await nativePlayback.getSnapshot();
    const summary = { state: connection.state, stage: connection.stage, transport: connection.transport, epoch: connection.recoveryEpoch,
      cache: offlineMetadata.getSummary(), library: { favorites: library.favorites.length, playlists: library.playlists.length, history: library.history.length },
      playback: { state: playback.state, playing: playback.playing, queueItems: playback.queueIds.length, positionMs: playback.positionMs } };
    setResult(JSON.stringify(summary, null, 2));
  };
  const fixture = (write: boolean) => {
    try {
      const native = createMMKV({ id: 'waven.connectivity.validation' });
      const storage = { get: (k: string) => native.getString(k) ?? null, set: (k: string, v: string) => native.set(k,v), remove: (k: string) => { native.remove(k); } };
      const local = new LocalLibraryRepository(storage, () => 100, 'local'), cache = new OfflineMetadataStore(() => 100); cache.configure(storage);
      if (write) {
        const one = { id:'p8-one', title:'Offline fixture one', artistName:'Validation', source:{provider:'catalog',id:'one'} };
        const two = { ...one, id:'p8-two', title:'Offline fixture two', source:{provider:'catalog',id:'two'} };
        local.setFavorite('track',one,true);
        const id = local.getSnapshot().state.playlists[0]?.id ?? local.createPlaylist('Offline persistence fixture');
        local.addTrack(id,one); local.addTrack(id,two); local.moveTrack(id,libraryEntityKey('track',two),-1);
        cache.enqueue('home-charts'); cache.enqueue('home-charts');
      }
      const state = new LocalLibraryRepository(storage, () => 101, 'local').getSnapshot().state, restored = new OfflineMetadataStore(() => 101); restored.configure(storage);
      if (state.favorites.length !== 1 || state.playlists.length !== 1 || state.playlists[0].tracks.map(t=>t.source.id).join(',') !== 'two,one' || restored.pendingKeys().join(',') !== 'home-charts') throw new Error('Offline fixture verification failed.');
      setResult('PASS · real MMKV\n1 favorite · 1 ordered playlist\nOrder: two,one\n1 deduplicated pending read retained\nIndependent validation storage\nProduct Library unchanged');
    } catch { setResult('Fixture not prepared or verification failed.'); }
  };
  useEffect(() => {
    if (!__DEV__) return;
    if (scenario === 'outage') setConnectivityValidationOutage(true);
    else if (scenario === 'restore') setConnectivityValidationOutage(false);
    else if (scenario === 'write') fixture(true);
    else if (scenario === 'verify') fixture(false);
  }, [scenario]);
  if (!__DEV__) return <WavenAppShell><LibraryNotice message="Connectivity validation is available only in development." /></WavenAppShell>;
  return <WavenAppShell><View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{color:wavenColors.textPrimary,fontSize:22}}>Connectivity Validation</Text>
    <Text style={{color:wavenColors.textSecondary}}>{connection.state} · {connection.stage} · {connection.transport} · recovery {connection.recoveryEpoch}</Text>
    <LibraryButton label="Inspect connection and existing data" onPress={() => { void inspect(); }} />
    <LibraryButton label="Prepare offline persistence fixture" onPress={() => fixture(true)} />
    <LibraryButton label="Verify fixture after restart" onPress={() => fixture(false)} />
    <LibraryButton label="Simulate provider outage" onPress={() => setConnectivityValidationOutage(true)} />
    <LibraryButton label="Restore real provider checks" onPress={() => { setConnectivityValidationOutage(false); void checkWavenConnection(); }} />
    <LibraryButton label="Return to Library" onPress={() => router.replace('/library')} />
    <Text selectable style={{color:wavenColors.textPrimary,fontSize:13,lineHeight:20}}>{result}</Text>
  </View></WavenAppShell>;
}
