import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WavenText as Text } from '../src/components/typography/WavenText';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenAccentTitle } from '../src/components/typography/WavenAccentTitle';
import { useWavenLayout } from '../src/hooks/useWavenLayout';
import { LibraryButton, LibraryDialog, LibraryNameInput, LibraryNotice, WavenLibraryHeroArtwork, WavenLibraryRow } from '../src/components/library/WavenLibraryControls';
import { getLocalLibrary, useLocalLibrary } from '../src/features/library/libraryRuntime';
import { libraryEntityKey } from '../src/features/library/localLibrary';
import { albumDetailRoute, artistDetailRoute } from '../src/features/discovery/detailNavigation';
import type { MusicAlbum, MusicArtist, MusicTrack } from '../src/domain/music';
import {
  wavenColors,
  wavenLayout,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const FILTERS = ['All', 'Songs', 'Albums', 'Artists', 'Playlists', 'History'] as const;
type LibraryFilter = (typeof FILTERS)[number];

function LibraryCollectionCard({ title, detail, seed, track, grid = false, onPress }: {
  title: string; detail: string; seed: string; track?: MusicTrack; grid?: boolean; onPress: () => void;
}) {
  return <WavenPressable accessibilityRole="button" accessibilityLabel={`${title}, ${detail}`}
    onPress={onPress} containerStyle={grid ? styles.collectionSlot : styles.collectionFull} style={styles.collectionCard}>
    <View style={styles.collectionArt}>
      {track ? <WavenLibraryHeroArtwork track={track} size={54} /> : <WavenArtworkFallback accessibilityLabel={`${title} artwork`} seed={seed} size={54} />}
    </View>
    <View style={styles.collectionCopy}>
      <Text numberOfLines={2} style={styles.collectionTitle}>{title}</Text>
      <Text numberOfLines={1} style={styles.collectionDetail}>{detail}</Text>
    </View>
    <Text accessible={false} style={styles.collectionArrow}>›</Text>
  </WavenPressable>;
}

export default function WavenLibraryScreen() {
  const router = useRouter();
  const layout = useWavenLayout();
  const [filter, setFilter] = useState<LibraryFilter>('All');
  const artworkSize = layout.isCompact ? 72 : 88;
  const snapshot = useLocalLibrary(), owner = getLocalLibrary();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: 'create' | 'rename' | 'delete'; id?: string; scope: string } | null>(null);
  const [name, setName] = useState(''), [error, setError] = useState<string | null>(null);
  const available = snapshot.status !== 'blocked' && snapshot.status !== 'unavailable';
  const favoriteTracks = snapshot.state.favorites.filter(f => f.kind === 'track');
  const favoriteArtists = snapshot.state.favorites.filter(f => f.kind === 'artist');
  const favoriteAlbums = snapshot.state.favorites.filter(f => f.kind === 'album');
  const favorites = snapshot.state.favorites.filter(f => filter === 'All' || (filter === 'Songs' && f.kind === 'track') || (filter === 'Albums' && f.kind === 'album') || (filter === 'Artists' && f.kind === 'artist'));
  const showPlaylists = filter === 'All' || filter === 'Playlists';
  const showHistory = filter === 'History';
  const selectedPlaylist = snapshot.state.playlists.find(p => p.id === selectedPlaylistId);
  const hasContent = favorites.length > 0 || (showPlaylists && snapshot.state.playlists.length > 0) || (showHistory && snapshot.state.history.length > 0);
  useEffect(() => { setSelectedPlaylistId(null); setDialog(null); setError(null); }, [snapshot.state.scope]);
  const run = (action: () => void) => { try { action(); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update Library.'); } };
  const openDialog = (mode: 'create' | 'rename' | 'delete', id?: string) => {
    setName(mode === 'rename' ? snapshot.state.playlists.find(p => p.id === id)?.title ?? '' : '');
    setError(null); setDialog({ mode, id, scope: snapshot.state.scope });
  };

  return (
    <WavenAppShell>
      <View style={styles.page}>
        <View style={styles.heading}>
          <WavenAccentTitle before="Your " accent="Library" />
        </View>

        <View accessibilityLabel="Library filters" style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item === filter;
            return (
              <WavenPressable
                accessibilityLabel={`Show ${item.toLowerCase()} in library`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={item}
                onPress={() => { setFilter(item); setSelectedPlaylistId(null); }}
                style={styles.minimumTouchTarget}
              >
                <View style={[styles.filterChip, active ? styles.filterChipActive : null]}>
                  <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{item}</Text>
                </View>
              </WavenPressable>
            );
          })}
        </View>

        <LibraryNotice message={snapshot.notice} />
        <LibraryNotice message={error} />
        <View style={styles.actions}>
          <LibraryButton disabled={!available} label="Create playlist" onPress={() => openDialog('create')} />
          {showHistory ? <>
            <LibraryButton disabled={!available} label={snapshot.state.preferences.historyEnabled ? 'Pause history recording' : 'Resume history recording'} onPress={() => run(() => owner.setHistoryEnabled(!snapshot.state.preferences.historyEnabled))} />
            <LibraryButton disabled={!available || !snapshot.state.history.length} label="Clear listening history" onPress={() => run(() => owner.clearHistory())} />
          </> : null}
        </View>
        {filter === 'All' && !selectedPlaylist && (snapshot.state.favorites.length || snapshot.state.playlists.length || snapshot.state.history.length) ? <>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Your Music</Text>
          <View style={styles.collectionGrid}>
            {favoriteTracks.length ? <LibraryCollectionCard grid title="Liked Songs" detail={`${favoriteTracks.length} ${favoriteTracks.length === 1 ? 'song' : 'songs'}`}
              seed="library-liked-songs" track={favoriteTracks[0].entity as MusicTrack} onPress={() => setFilter('Songs')} /> : null}
            {snapshot.state.playlists.length ? <LibraryCollectionCard grid title="Playlists" detail={`${snapshot.state.playlists.length} ${snapshot.state.playlists.length === 1 ? 'playlist' : 'playlists'}`}
              seed="library-playlists" track={snapshot.state.playlists[0].tracks[0]} onPress={() => setFilter('Playlists')} /> : null}
            {favoriteArtists.length ? <LibraryCollectionCard grid title="Artists" detail={`${favoriteArtists.length} ${favoriteArtists.length === 1 ? 'artist' : 'artists'}`}
              seed="library-artists" onPress={() => setFilter('Artists')} /> : null}
            {favoriteAlbums.length ? <LibraryCollectionCard grid title="Albums" detail={`${favoriteAlbums.length} ${favoriteAlbums.length === 1 ? 'album' : 'albums'}`}
              seed="library-albums" onPress={() => setFilter('Albums')} /> : null}
            {snapshot.state.history.length ? <LibraryCollectionCard grid title="Recently Played" detail={`${snapshot.state.history.length} ${snapshot.state.history.length === 1 ? 'song' : 'songs'}`}
              seed="library-recent" track={snapshot.state.history[0].track} onPress={() => setFilter('History')} /> : null}
          </View>
        </> : null}
        {selectedPlaylist ? <View style={styles.collection}>
          <LibraryButton label="Back to playlists" onPress={() => setSelectedPlaylistId(null)} />
          <View style={styles.playlistHero}>
            <View style={styles.playlistHeroArt}>{selectedPlaylist.tracks[0]
              ? <WavenLibraryHeroArtwork track={selectedPlaylist.tracks[0]} size={100} />
              : <WavenArtworkFallback accessibilityLabel={`${selectedPlaylist.title} artwork`} seed={selectedPlaylist.id} size={100} />}</View>
            <View style={styles.playlistHeroCopy}>
              <Text accessibilityRole="header" style={styles.playlistHeroTitle}>{selectedPlaylist.title}</Text>
              <Text style={styles.collectionDetail}>{selectedPlaylist.tracks.length} {selectedPlaylist.tracks.length === 1 ? 'song' : 'songs'} · Local playlist</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <LibraryButton label="Rename playlist" onPress={() => openDialog('rename', selectedPlaylist.id)} />
            <LibraryButton label="Delete playlist" onPress={() => openDialog('delete', selectedPlaylist.id)} />
          </View>
          {!selectedPlaylist.tracks.length ? <Text style={styles.emptyBody}>Your playlist is empty. Add songs from their music-actions menu.</Text> : null}
          {selectedPlaylist.tracks.map((track, index) => {
            const key = libraryEntityKey('track', track);
            return <View key={key}>
              <WavenLibraryRow kind="track" entity={track} />
              <View style={styles.actions}>
                <LibraryButton label={`Move ${track.title} up`} disabled={index === 0} onPress={() => run(() => owner.moveTrack(selectedPlaylist.id, key, -1))} />
                <LibraryButton label={`Move ${track.title} down`} disabled={index === selectedPlaylist.tracks.length - 1} onPress={() => run(() => owner.moveTrack(selectedPlaylist.id, key, 1))} />
                <LibraryButton label={`Remove ${track.title} from playlist`} onPress={() => run(() => owner.removeTrack(selectedPlaylist.id, key))} />
              </View>
            </View>;
          })}
        </View> : <>
          {favorites.map(f => <WavenLibraryRow key={f.key} kind={f.kind} entity={f.entity} onOpen={f.kind === 'track' ? undefined : () => {
            const route = f.kind === 'album' ? albumDetailRoute(f.entity as MusicAlbum) : artistDetailRoute(f.entity as MusicArtist);
            if (route) router.push(route);
          }} />)}
          {showPlaylists ? snapshot.state.playlists.map(p => <LibraryCollectionCard key={p.id} title={p.title}
            detail={`${p.tracks.length} ${p.tracks.length === 1 ? 'song' : 'songs'} · Local playlist`}
            seed={p.id} track={p.tracks[0]} onPress={() => setSelectedPlaylistId(p.id)} />) : null}
          {showHistory && snapshot.state.history.length ? <Text accessibilityRole="header" style={styles.sectionTitle}>Recently Played</Text> : null}
          {showHistory ? snapshot.state.history.map(h => <WavenLibraryRow key={h.key} kind="track" entity={h.track} />) : null}
        </>}
        {!selectedPlaylist && !hasContent ? <View style={styles.emptyStage}>
          <WavenArtworkFallback
            accessibilityLabel="Library artwork"
            seed={`library-${filter}`}
            size={artworkSize}
          />
          <View style={styles.copy}>
            <Text style={styles.emptyTitle}>{filter === 'All' ? 'Your Library Is Quiet' : `No ${filter} Yet`}</Text>
            <Text style={styles.emptyBody}>
              {filter === 'All'
                ? 'Save music from its actions menu. Your favorites and local playlists will gather here.'
                : `${filter} will appear here as your library grows.`}
            </Text>
          </View>
          <WavenPressable
            accessibilityLabel="Find music"
            accessibilityRole="button"
            onPress={() => router.navigate('/search')}
            style={styles.minimumTouchTarget}
          >
            <View style={styles.findMusicAction}>
              <Text style={styles.findMusicText}>Find Music</Text>
            </View>
          </WavenPressable>
        </View> : null}
        <LibraryDialog title={dialog?.mode === 'delete' ? 'Delete playlist?' : dialog?.mode === 'rename' ? 'Rename playlist' : 'Create playlist'} visible={Boolean(dialog)} onClose={() => setDialog(null)}>
          {dialog?.mode === 'delete' ? <Text style={styles.emptyBody}>This removes the local playlist. Your favorites stay saved.</Text> : <LibraryNameInput value={name} onChange={setName} />}
          <LibraryNotice message={error} />
          <LibraryButton label={dialog?.mode === 'delete' ? 'Delete playlist' : 'Save playlist'} disabled={!available || (dialog?.mode !== 'delete' && !name.trim())} onPress={() => {
            if (!dialog || dialog.scope !== owner.getSnapshot().state.scope) { setDialog(null); return; }
            try {
              if (dialog.mode === 'create') { setSelectedPlaylistId(owner.createPlaylist(name)); setFilter('Playlists'); }
              if (dialog.mode === 'rename' && dialog.id) owner.renamePlaylist(dialog.id, name);
              if (dialog.mode === 'delete' && dialog.id) { owner.deletePlaylist(dialog.id); setSelectedPlaylistId(null); }
              setDialog(null); setError(null);
            } catch (e) { setError(e instanceof Error ? e.message : 'Could not save playlist.'); }
          }} />
        </LibraryDialog>
      </View>
    </WavenAppShell>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  collection: { gap: 12, marginTop: 12 },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  collectionSlot: { width: '47%', flexGrow: 1, flexShrink: 0 },
  collectionFull: { width: '100%' },
  collectionCard: { width: '100%',
    minHeight: 132, gap: 8, padding: 12, marginVertical: 5, borderWidth: StyleSheet.hairlineWidth,
    borderColor: wavenColors.borderSubtle, borderRadius: wavenRadii.md, backgroundColor: wavenColors.surfaceSoft },
  collectionArt: { width: 54, height: 54, borderRadius: wavenRadii.sm, overflow: 'hidden' },
  collectionCopy: { minWidth: 0, paddingRight: 12 },
  collectionTitle: { color: wavenColors.textPrimary, fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight },
  collectionDetail: { color: wavenColors.textMuted, fontSize: wavenTypography.caption.fontSize, marginTop: 3 },
  collectionArrow: { position: 'absolute', right: 12, top: 10, color: wavenColors.interactionBlue, fontSize: 24 },
  sectionTitle: { color: wavenColors.textPrimary, fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight, marginTop: 16, marginBottom: 6 },
  playlistHero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 12 },
  playlistHeroArt: { width: 100, height: 100, borderRadius: wavenRadii.md, overflow: 'hidden' },
  playlistHeroCopy: { flex: 1, gap: 4 },
  playlistHeroTitle: { color: wavenColors.textPrimary, fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight },
  page: {
    flex: 1,
  },
  heading: {
    marginBottom: wavenSpacing.lg,
    marginTop: wavenSpacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  minimumTouchTarget: {
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
  },
  filterChip: {
    backgroundColor: wavenColors.surfaceSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  filterChipActive: {
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
  },
  filterText: {
    color: wavenColors.textMuted,
    fontSize: wavenTypography.caption.fontSize,
    fontWeight: wavenTypography.caption.fontWeight,
  },
  filterTextActive: {
    color: wavenColors.textPrimary,
  },
  emptyStage: {
    alignItems: 'center',
    flex: 1,
    gap: wavenSpacing.md,
    justifyContent: 'center',
    minHeight: 280,
    paddingBottom: wavenSpacing.xl,
    paddingTop: wavenSpacing.lg,
  },
  copy: {
    alignItems: 'center',
    maxWidth: 430,
  },
  emptyTitle: {
    color: wavenColors.textSecondary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
    textAlign: 'center',
  },
  emptyBody: {
    color: wavenColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  findMusicAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  findMusicText: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
});
