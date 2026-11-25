const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Module = require('node:module');
const ts = require('typescript');

const providerFile = path.join(__dirname, '../src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const providerSource = `const fetch = globalThis.__wavenSingleDetailTestFetch;\n` + fs.readFileSync(providerFile, 'utf8') + `
export {
  albumPresentationEvidence,
  albumDetailPresentationEvidence,
  albumDetailPlayVideoId,
  singleTrackFromAlbumPlayEndpoint,
  singleTrackMatchesAlbumIdentity,
  resolveSingleTrackFromCatalog,
};`;

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

function compileProvider(fetchImpl) {
  const output = ts.transpileModule(providerSource, {
    fileName: providerFile,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleRecord = new Module(providerFile, module);
  moduleRecord.filename = providerFile;
  moduleRecord.paths = Module._nodeModulePaths(path.dirname(providerFile));
  globalThis.__wavenSingleDetailTestFetch = fetchImpl;
  try {
    moduleRecord._compile(output, providerFile);
  } finally {
    delete globalThis.__wavenSingleDetailTestFetch;
  }
  return moduleRecord.exports;
}

function artistRun(name = 'Artist', id = 'UCartistOne') {
  return {
    text: name,
    navigationEndpoint: {
      browseEndpoint: {
        browseId: id,
        browseEndpointContextSupportedConfigs: {
          browseEndpointContextMusicConfig: { pageType: 'MUSIC_PAGE_TYPE_ARTIST' },
        },
      },
    },
  };
}

function releaseHeader({
  title = 'Song',
  artist = 'Artist',
  artistId = 'UCartistOne',
  type = 'Single',
  year = '2026',
  videoId = null,
} = {}) {
  return {
    title: { runs: [{ text: title }] },
    subtitle: { runs: [{ text: type }, { text: ' • ' }, { text: year }] },
    straplineTextOne: { runs: [artistRun(artist, artistId)] },
    buttons: videoId ? [{
      musicPlayButtonRenderer: {
        playNavigationEndpoint: { watchEndpoint: { videoId } },
      },
    }] : [],
  };
}

function albumBrowsePayload({ header, tracks = [] } = {}) {
  return {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [{
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [{ musicResponsiveHeaderRenderer: header || releaseHeader() }],
              },
            },
          },
        }],
        secondaryContents: {
          sectionListRenderer: {
            contents: tracks.length ? [{ musicShelfRenderer: { contents: tracks } }] : [],
          },
        },
      },
    },
  };
}

function trackRenderer({
  title = 'Song',
  artist = 'Artist',
  artistId = 'UCartistOne',
  videoId = 'aaaaaaaaaaa',
  albumBrowseId = null,
} = {}) {
  const renderer = {
    flexColumns: [
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: title }] } } },
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [
        { text: 'Song' }, { text: ' • ' }, artistRun(artist, artistId), { text: ' • ' }, { text: '3:15' },
      ] } } },
    ],
    playlistItemData: { videoId },
  };
  if (albumBrowseId) {
    renderer.menu = { menuRenderer: { items: [{
      menuNavigationItemRenderer: {
        text: { runs: [{ text: 'Go to album' }] },
        navigationEndpoint: { browseEndpoint: { browseId: albumBrowseId } },
      },
    }] } };
  }
  return { musicResponsiveListItemRenderer: renderer };
}

function providerWithResponses(responses) {
  const calls = [];
  const fetch = async (url, options) => {
    if (options?.signal?.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }
    if (!options?.body) return { ok: true, status: 200, text: async () => '' };
    const endpoint = String(url).split('/youtubei/v1/')[1].split('?')[0];
    const body = JSON.parse(options.body);
    calls.push({ endpoint, body });
    const key = endpoint === 'search'
      ? `search:${body.query}`
      : `${endpoint}:${body.browseId || body.videoId || ''}`;
    const payload = responses[key] ?? responses[endpoint] ?? {};
    if (payload instanceof Error) throw payload;
    return { ok: true, status: 200, json: async () => payload };
  };
  const provider = compileProvider(fetch);
  return { provider, calls };
}

function albumSeed({
  title = 'Song',
  artistName = 'Artist',
  id = 'MPREsingle',
  primaryType = null,
} = {}) {
  return {
    id: `ytmusic-album:${id}`,
    title,
    artistName,
    primaryType,
    artworkUrl: 'https://example.test/art.jpg',
    source: { provider: 'ytmusic-metadata', id },
  };
}

test('V3.4.10 parses Single identity separately from Artist and year metadata', () => {
  const { provider } = providerWithResponses({});
  const evidence = provider.albumPresentationEvidence([
    { text: 'Single' }, { text: ' • ' }, artistRun('Olivia Example'), { text: ' • ' }, { text: '2026' },
  ]);
  assert.equal(evidence.primaryType, 'Single');
  assert.equal(evidence.artistName, 'Olivia Example');
  assert.equal(evidence.releaseDate, '2026');
  const noArtist = provider.albumPresentationEvidence([
    { text: 'Single' }, { text: ' • ' }, { text: '2026' },
  ]);
  assert.equal(noArtist.artistName, null);
});

test('V3.4.10 hydrates a canonical Single from its own browse play endpoint', async () => {
  const videoId = 'abcdefghijk';
  const browse = albumBrowsePayload({ header: releaseHeader({ title: 'Song', videoId }) });
  const { provider, calls } = providerWithResponses({ 'browse:MPREsingle': browse });
  const detail = await provider.createYouTubeMusicMetadataProvider().getAlbum(albumSeed());
  assert.equal(detail.album.primaryType, 'Single');
  assert.equal(detail.album.artistName, 'Artist');
  assert.equal(detail.album.releaseDate, '2026');
  assert.equal(detail.tracks.length, 1);
  assert.equal(detail.tracks[0].source.id, videoId);
  assert.equal(detail.tracks[0].title, 'Song');
  assert.equal(calls.filter((call) => call.endpoint === 'search').length, 0);
});

test('V3.4.10 falls back to catalog search only when the Track links to the exact Single browse identity', async () => {
  const browse = albumBrowsePayload({ header: releaseHeader({ title: 'Song', videoId: null }) });
  const search = { contents: [trackRenderer({ title: 'Song', albumBrowseId: 'MPREsingle' })] };
  const { provider, calls } = providerWithResponses({
    'browse:MPREsingle': browse,
    'search:Artist Song': search,
  });
  const detail = await provider.createYouTubeMusicMetadataProvider().getAlbum(albumSeed());
  assert.equal(detail.tracks.length, 1);
  assert.equal(detail.tracks[0].title, 'Song');
  assert.equal(calls.filter((call) => call.endpoint === 'search').length, 1);
});

test('V3.4.10 rejects a zero-track Single when catalog fallback belongs to another release', async () => {
  const browse = albumBrowsePayload({ header: releaseHeader({ videoId: null }) });
  const search = { contents: [trackRenderer({ albumBrowseId: 'MPREother' })] };
  const { provider } = providerWithResponses({
    'browse:MPREsingle': browse,
    'search:Artist Song': search,
  });
  await assert.rejects(
    provider.createYouTubeMusicMetadataProvider().getAlbum(albumSeed()),
    /release track listing is unavailable/i,
  );
});

test('V3.4.10 never fabricates an Album or EP as a one-track Single fallback', async () => {
  for (const type of ['Album', 'EP']) {
    const browse = albumBrowsePayload({ header: releaseHeader({ type, videoId: 'abcdefghijk' }) });
    const { provider, calls } = providerWithResponses({ 'browse:MPREsingle': browse });
    await assert.rejects(
      provider.createYouTubeMusicMetadataProvider().getAlbum(albumSeed({ primaryType: type })),
      /release track listing is unavailable/i,
      type,
    );
    assert.equal(calls.filter((call) => call.endpoint === 'search').length, 0, type);
  }
});

test('V3.4.10 preserves normal multi-track Album hydration without fallback search', async () => {
  const browse = albumBrowsePayload({
    header: releaseHeader({ title: 'Album Name', type: 'Album', videoId: 'zzzzzzzzzzz' }),
    tracks: [
      trackRenderer({ title: 'Track One', videoId: 'aaaaaaaaaaa' }),
      trackRenderer({ title: 'Track Two', videoId: 'bbbbbbbbbbb' }),
    ],
  });
  const { provider, calls } = providerWithResponses({ 'browse:MPREalbum': browse });
  const detail = await provider.createYouTubeMusicMetadataProvider().getAlbum(
    albumSeed({ title: 'Album Name', id: 'MPREalbum', primaryType: 'Album' }),
  );
  assert.equal(detail.album.primaryType, 'Album');
  assert.deepEqual(Array.from(detail.tracks, (track) => track.title), ['Track One', 'Track Two']);
  assert.equal(calls.filter((call) => call.endpoint === 'search').length, 0);
});

test('V3.4.10 fails truthfully when a Single fallback provider request itself fails', async () => {
  const browse = albumBrowsePayload({ header: releaseHeader({ videoId: null }) });
  const { provider } = providerWithResponses({
    'browse:MPREsingle': browse,
    'search:Artist Song': new Error('Provider failed'),
  });
  await assert.rejects(
    provider.createYouTubeMusicMetadataProvider().getAlbum(albumSeed()),
    /Provider failed/,
  );
});

test('V3.4.10 release detail UI presents Single and EP truthfully while keeping Album behavior', () => {
  const route = fs.readFileSync(path.join(__dirname, '../app/album/[provider]/[id].tsx'), 'utf8');
  const foundation = fs.readFileSync(path.join(__dirname, '../src/components/detail/WavenMusicDetailFoundation.tsx'), 'utf8');
  const heroVisual = fs.readFileSync(path.join(__dirname, '../src/components/detail/WavenDetailHeroVisual.tsx'), 'utf8');
  assert.match(route, /normalizedPrimaryType === 'single'/);
  assert.match(route, /normalizedPrimaryType === 'ep'/);
  assert.match(route, /kindLabel=\{releaseKind\}/);
  assert.match(foundation, /type DetailKind = 'Artist' \| 'Album' \| 'Single' \| 'EP'/);
  assert.match(heroVisual, /wavenDetailHeroCopyBottom\(kind: 'Artist' \| 'Album' \| 'Single' \| 'EP'\)/);
  assert.doesNotMatch(route, /No album tracks are available right now/);
});

test('V3.4.10 remains provider-generic and does not hardcode the physical example', () => {
  const providerSourceOnly = fs.readFileSync(providerFile, 'utf8');
  assert.doesNotMatch(providerSourceOnly, /Olivia Rodrigo|the cure/i);
  assert.match(providerSourceOnly, /singleTrackMatchesAlbumIdentity/);
  assert.match(providerSourceOnly, /linkedAlbumId !== album\.source\.id/);
});
