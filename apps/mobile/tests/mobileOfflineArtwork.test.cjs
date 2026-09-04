'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const {
  OFFLINE_ARTWORK_MAX_BYTES,
  OFFLINE_ARTWORK_MAX_FILES,
  artworkIdentityKey,
  emptyOfflineArtworkManifest,
  normalizeOfflineArtworkManifest,
  selectTmdbArtworkSource,
  selectOfflineArtworkEvictions,
  upsertOfflineArtworkManifestEntry,
  validTmdbArtworkPath,
} = require('../src/features/library/offlineArtworkPolicy.ts');

test('artwork identity and source validation reject remote or traversal input', () => {
  assert.equal(artworkIdentityKey({ id: 7, mediaType: 'movie' }), 'movie:7');
  assert.equal(artworkIdentityKey({ id: 8, mediaType: 'tv', season: 2, episode: 3 }), 'tv:8:s2:e3');
  assert.equal(validTmdbArtworkPath('/safe/image.jpg'), true);
  assert.equal(validTmdbArtworkPath('https://private.example/image.jpg'), false);
  assert.equal(validTmdbArtworkPath('/safe/../secret'), false);
});

test('manifest validation is versioned, owned-path only, and corruption-safe', () => {
  const prefix = 'file:///orion-offline-artwork-v1/';
  assert.equal(normalizeOfflineArtworkManifest({ bad: true }, prefix), null);
  assert.deepEqual(normalizeOfflineArtworkManifest({
    schemaVersion: 1,
    entries: {
      good: { identityKey: 'good', sourcePath: '/good.jpg', uri: prefix + 'good.img', sizeBytes: 4, lastUsedAt: 5 },
      escaped: { identityKey: 'escaped', sourcePath: '/bad.jpg', uri: 'file:///outside.img', sizeBytes: 4, lastUsedAt: 5 },
    },
  }, prefix), {
    schemaVersion: 1,
    entries: {
      good: { identityKey: 'good', sourcePath: '/good.jpg', uri: prefix + 'good.img', sizeBytes: 4, lastUsedAt: 5 },
    },
  });
});

test('source replacement retains the latest artwork for one media identity', () => {
  const manifest = emptyOfflineArtworkManifest();
  assert.equal(upsertOfflineArtworkManifestEntry(manifest, {
    identityKey: 'movie:1', sourcePath: '/old.jpg', uri: 'file:///cache/old.img', sizeBytes: 5, lastUsedAt: 1,
  }), null);
  const previous = upsertOfflineArtworkManifestEntry(manifest, {
    identityKey: 'movie:1', sourcePath: '/new.jpg', uri: 'file:///cache/new.img', sizeBytes: 6, lastUsedAt: 2,
  });
  assert.equal(previous.sourcePath, '/old.jpg');
  assert.equal(manifest.entries['movie:1'].sourcePath, '/new.jpg');
});

test('LRU eviction enforces both file-count and byte limits with stable ties', () => {
  const entries = [
    { identityKey: 'a', sourcePath: '/a.jpg', uri: 'a', sizeBytes: 6, lastUsedAt: 1 },
    { identityKey: 'b', sourcePath: '/b.jpg', uri: 'b', sizeBytes: 6, lastUsedAt: 2 },
    { identityKey: 'c', sourcePath: '/c.jpg', uri: 'c', sizeBytes: 6, lastUsedAt: 3 },
  ];
  assert.deepEqual(selectOfflineArtworkEvictions(entries, 2, 12).map((item) => item.identityKey), ['a']);
  assert.deepEqual(selectOfflineArtworkEvictions(entries, 3, 10).map((item) => item.identityKey), ['a', 'b']);
  assert.equal(OFFLINE_ARTWORK_MAX_FILES, 128);
  assert.equal(OFFLINE_ARTWORK_MAX_BYTES, 32 * 1024 * 1024);
});

test('offline Continue Watching selects only verified local artwork and never a remote URI', () => {
  const hook = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/useContinueWatchingArtwork.ts'),
    'utf8',
  );
  const cache = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/offlineArtworkCache.ts'),
    'utf8',
  );
  const card = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/ContinueWatchingCard.tsx'),
    'utf8',
  );
  assert.match(hook, /if \(remoteReady\) return imgUrl\(sourcePath, 'w780'\)/);
  assert.ok(hook.includes('uri: getOfflineArtworkUri(identityKey, sourcePath)'));
  assert.doesNotMatch(cache, /fetch\(/);
  assert.match(cache, /File\.downloadFileAsync/);
  assert.match(cache, /if \(partial\.exists\) partial\.delete\(\)/);
  assert.match(cache, /resetCorruptCache/);
  assert.match(cache, /withManifestWriteLock/);
  assert.match(cache, /latestRequestedSource/);
  assert.match(card, /useContinueWatchingArtwork\(entry\)/);
  assert.match(card, /styles\.fallback/);
});

test('online and recovery backfill uses Continue Watching and download metadata with two workers', () => {
  const coordinator = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/MobileArtworkCacheCoordinator.tsx'),
    'utf8',
  );
  assert.match(coordinator, /repository\.jobs/);
  assert.match(coordinator, /repository\.offlineEntries/);
  assert.match(coordinator, /getContinueWatching\(\)/);
  assert.match(coordinator, /concurrency = 2/);
  assert.match(coordinator, /if \(!remoteReady \|\| candidates\.length === 0\) return/);
  assert.match(coordinator, /recoveryEpoch/);
});
function artworkCacheHarness() {
  const values = new Map();
  const files = new Map();
  const directories = new Set(['file:///documents/']);
  let failDownload = false;

  const uriFor = (parts, directory = false) => {
    const values = parts.map((part) => typeof part === 'string' ? part : part.uri);
    let uri = values.shift();
    for (const value of values) uri = uri.replace(/\/+$/, '') + '/' + String(value).replace(/^\/+/, '');
    return directory ? uri.replace(/\/+$/, '') + '/' : uri;
  };
  class Directory {
    constructor(...parts) { this.uri = uriFor(parts, true); }
    get exists() { return directories.has(this.uri); }
    create() { directories.add(this.uri); }
    list() {
      return [...files.keys()]
        .filter((uri) => uri.startsWith(this.uri))
        .map((uri) => new File(uri));
    }
  }
  class File {
    constructor(...parts) { this.uri = uriFor(parts); }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri) || 0; }
    delete() { files.delete(this.uri); }
    async move(destination) {
      files.set(destination.uri, this.size);
      files.delete(this.uri);
      this.uri = destination.uri;
    }
    static async downloadFileAsync(_url, destination) {
      files.set(destination.uri, 12);
      if (failDownload) throw new Error('download-failed');
      return destination;
    }
  }

  const mocks = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system': { Directory, File, Paths: { document: new Directory('file:///documents/') } },
    '@orion/shared/api': { imgUrl: (source) => 'https://image.tmdb.org/t/p/w780' + source },
    '../../services/storageAdapter': {
      mmkvStorageAdapter: {
        get: (key) => values.get(key) || null,
        set: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      },
    },
  };
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText;
    const module = { exports: {} };
    modules.set(file, module);
    const localRequire = (request) => {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      const base = path.resolve(path.dirname(file), request);
      return load(['.ts', '.tsx'].map((extension) => base + extension).find(fs.existsSync));
    };
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    return module.exports;
  }
  const api = load(path.resolve(__dirname, '../src/features/library/offlineArtworkCache.ts'));
  return {
    api,
    files,
    values,
    failNext() { failDownload = true; },
  };
}

test('durable cache lookup, replacement, corruption reset, and partial cleanup execute atomically', async () => {
  const harness = artworkCacheHarness();
  assert.equal(harness.api.getOfflineArtworkUri('movie:1', '/one.jpg'), null);
  const first = await harness.api.cacheOfflineArtwork('movie:1', '/one.jpg');
  assert.match(first, /^file:\/\/\/documents\/orion-offline-artwork-v1\/.+\.img$/);
  assert.equal(harness.api.getOfflineArtworkUri('movie:1', '/one.jpg'), first);

  const replacement = await harness.api.cacheOfflineArtwork('movie:1', '/two.jpg');
  assert.notEqual(replacement, first);
  assert.equal(harness.files.has(first), false);
  assert.equal(harness.api.getOfflineArtworkUri('movie:1', '/two.jpg'), replacement);

  harness.failNext();
  assert.equal(await harness.api.cacheOfflineArtwork('movie:2', '/fail.jpg'), null);
  assert.equal([...harness.files.keys()].some((uri) => uri.endsWith('.partial')), false);

  harness.values.set(harness.api.OFFLINE_ARTWORK_MANIFEST_KEY, '{malformed');
  assert.equal(harness.api.getOfflineArtworkUri('movie:1', '/two.jpg'), null);
  assert.equal(harness.files.size, 0);
});
test('artwork source selection consistently prefers a valid backdrop then poster', () => {
  assert.equal(selectTmdbArtworkSource('/backdrop.jpg', '/poster.jpg'), '/backdrop.jpg');
  assert.equal(selectTmdbArtworkSource(null, '/poster.jpg'), '/poster.jpg');
  assert.equal(selectTmdbArtworkSource('https://invalid.example/backdrop.jpg', '/poster.jpg'), '/poster.jpg');
  assert.equal(selectTmdbArtworkSource('/unsafe/../backdrop.jpg', 'file:///private/poster.jpg'), null);
});

function continueWatchingArtworkHarness(remoteReady) {
  const state = [];
  const lookups = [];
  let stateIndex = 0;
  let effects = [];
  const mocks = {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (next) => {
          state[index] = typeof next === 'function' ? next(state[index]) : next;
        }];
      },
      useEffect(effect) { effects.push(effect); },
    },
    '@orion/shared/api': { imgUrl: (source, size) => 'remote:' + size + ':' + source },
    '../../context/NetworkContext': { useNetworkStatus: () => ({ remoteReady }) },
    './offlineArtworkCache': {
      subscribeOfflineArtworkCache: () => () => {},
      getOfflineArtworkUri: (identity, source) => {
        lookups.push({ identity, source });
        return 'local:' + identity + ':' + source;
      },
    },
  };
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText;
    const module = { exports: {} };
    modules.set(file, module);
    const localRequire = (request) => {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      const base = path.resolve(path.dirname(file), request);
      const localFile = ['.ts', '.tsx'].map((extension) => base + extension).find(fs.existsSync);
      if (!localFile) throw new Error('Missing test module ' + request);
      return load(localFile);
    };
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    return module.exports;
  }
  const { useContinueWatchingArtwork } = load(path.resolve(
    __dirname,
    '../src/features/library/useContinueWatchingArtwork.ts',
  ));
  const entry = {
    progress: {
      mediaIdentity: { id: 17, mediaType: 'movie' },
      presentation: {
        backdropPath: 'https://invalid.example/backdrop.jpg',
        posterPath: '/poster.jpg',
      },
    },
  };
  function render() {
    stateIndex = 0;
    effects = [];
    const value = useContinueWatchingArtwork(entry);
    for (const effect of effects) effect();
    return value;
  }
  render();
  return { value: render(), lookups };
}

test('offline lookup and online rendering use the same selected fallback poster', () => {
  const offline = continueWatchingArtworkHarness(false);
  const online = continueWatchingArtworkHarness(true);
  assert.equal(offline.value, 'local:movie:17:/poster.jpg');
  assert.ok(offline.lookups.length >= 1);
  assert.equal(offline.lookups.every((lookup) => (
    lookup.identity === 'movie:17' && lookup.source === '/poster.jpg'
  )), true);
  assert.equal(online.value, 'remote:w780:/poster.jpg');
  assert.deepEqual(online.lookups, []);
});