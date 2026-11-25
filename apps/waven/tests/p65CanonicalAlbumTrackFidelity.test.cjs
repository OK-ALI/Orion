const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const canonicalFile = path.join(
  __dirname,
  '../src/features/discovery/wavenCanonicalPresentation.ts',
);

require.extensions['.ts'] = function compileTypeScript(moduleRecord, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
    },
  }).outputText;
  moduleRecord._compile(output, filename);
};

function track(id, title) {
  return {
    id: `ytmusic:${id}`,
    providerTrackId: id,
    provider: 'ytmusic',
    title,
    artistName: 'Olivia Example',
    albumTitle: 'Album Example',
    durationMs: 180000,
    artworkUrl: 'https://example.test/art.jpg',
    source: { provider: 'ytmusic-metadata', id },
    providerRefs: [{ provider: 'ytmusic-metadata', id }],
  };
}

function album() {
  return {
    id: 'ytmusic-album:MPREalbumfidelity',
    title: 'Album Example',
    artistName: 'Olivia Example',
    primaryType: 'Album',
    artworkUrl: 'https://example.test/album.jpg',
    source: { provider: 'ytmusic-metadata', id: 'MPREalbumfidelity' },
  };
}

test('V3.4.12 authoritative Album detail preserves a legitimate member carrying secondary renderer evidence', () => {
  delete require.cache[require.resolve(canonicalFile)];
  const canonical = require(canonicalFile);

  const first = track('aaaaaaaaaaa', 'Track One');
  const decorated = track('bbbbbbbbbbb', 'love is embarrassing');
  const third = track('ccccccccccc', 'Track Three');

  canonical.rememberWavenMediaPresentationEvidence(
    decorated,
    {
      secondary: true,
      lowConfidence: false,
      rendererType: 'MUSIC_VIDEO_TYPE_OMV',
      reason: 'youtube-music-video-renderer',
    },
    'track',
  );

  const detail = canonical.canonicalizeWavenAlbumDetail({
    album: album(),
    tracks: [first, decorated, third],
  });

  assert.deepEqual(
    Array.from(detail.tracks, (item) => item.title),
    ['Track One', 'love is embarrassing', 'Track Three'],
  );
});

test('V3.4.12 discovery/search Songs purity still excludes secondary presentation', () => {
  delete require.cache[require.resolve(canonicalFile)];
  const canonical = require(canonicalFile);

  const ordinary = track('ddddddddddd', 'Canonical Song');
  const videoDecorated = track('eeeeeeeeeee', 'Catalog Song');

  canonical.rememberWavenMediaPresentationEvidence(
    videoDecorated,
    {
      secondary: true,
      lowConfidence: false,
      rendererType: 'MUSIC_VIDEO_TYPE_OMV',
      reason: 'youtube-music-video-renderer',
    },
    'track',
  );

  const result = canonical.canonicalizeWavenSearchResult({
    tracks: [ordinary, videoDecorated],
    artists: [],
    albums: [],
    playlists: [],
  });

  assert.deepEqual(
    Array.from(result.tracks, (item) => item.title),
    ['Canonical Song'],
  );
});

test('V3.4.12 authoritative Album detail still rejects low-confidence/fan-made material', () => {
  delete require.cache[require.resolve(canonicalFile)];
  const canonical = require(canonicalFile);

  const canonicalTrack = track('ffffffffff1', 'Canonical Song');
  const fanMade = track('ffffffffff2', 'Fan-Made Song');

  const detail = canonical.canonicalizeWavenAlbumDetail({
    album: album(),
    tracks: [canonicalTrack, fanMade],
  });

  assert.deepEqual(
    Array.from(detail.tracks, (item) => item.title),
    ['Canonical Song'],
  );
});

test('V3.4.12 keeps songsOnly filtering on discovery surfaces but not authoritative Album detail', () => {
  const source = fs.readFileSync(canonicalFile, 'utf8');

  assert.match(
    source,
    /canonicalizeWavenSearchResult[\s\S]*tracks: canonicalizeWavenTracks\(result\.tracks, \{ songsOnly: true \}\)/,
  );
  assert.match(
    source,
    /canonicalizeWavenArtistDetail[\s\S]*tracks: canonicalizeWavenTracks\(detail\.tracks, \{ songsOnly: true \}\)/,
  );
  assert.match(
    source,
    /canonicalizeWavenDashboard[\s\S]*canonicalizeWavenTracks\(section\.items as readonly MusicTrack\[\], \{ songsOnly: true \}\)/,
  );
  assert.match(
    source,
    /canonicalizeWavenAlbumDetail[\s\S]*tracks: canonicalizeWavenTracks\(detail\.tracks\),/,
  );
  assert.doesNotMatch(
    source,
    /canonicalizeWavenAlbumDetail[\s\S]{0,500}tracks: canonicalizeWavenTracks\(detail\.tracks, \{ songsOnly: true \}\)/,
  );
});
