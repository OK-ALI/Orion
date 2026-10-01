'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTypeScriptModule(relative, mocks = {}) {
  const filePath = path.join(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
    throw new Error(`Unexpected import in P10.4 subtitle test: ${specifier}`);
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, localRequire, module, filePath, path.dirname(filePath));
  return module.exports;
}

function response(status, json) {
  return { status, ok: status >= 200 && status < 300, json: async () => json };
}

test('official-shaped Wyzie response keeps format/display/release/fileName and query-format URL', async () => {
  const keys = new Map([
    ['orion.mobile.subtitles.subdl.v1', 'subdl-key-123'],
    ['orion.mobile.subtitles.wyzie.v1', 'wyzie-abcdef123'],
  ]);
  const service = loadTypeScriptModule('src/services/subtitles.ts', {
    'expo-secure-store': {
      getItemAsync: async (key) => keys.get(key) || null,
      setItemAsync: async (key, value) => keys.set(key, value),
      deleteItemAsync: async (key) => keys.delete(key),
    },
  });
  const previousFetch = global.fetch;
  global.fetch = async (url) => String(url).includes('api.subdl.com')
    ? response(200, { status: true, subtitles: [] })
    : response(200, [{
      id: '1955024019',
      url: 'https://sub.wyzie.io/c/198e0c4d/id/1955024019?format=srt&encoding=UTF-8',
      format: 'srt', display: 'English', language: 'en',
      release: 'Fixture.2026.WEB-DL', fileName: 'fixture.2026.web-dl.srt',
    }]);
  try {
    const outcome = await service.searchSubtitlesWithOutcome({ tmdbId: '7', mediaType: 'movie', languages: 'en' });
    assert.equal(outcome.state, 'available');
    assert.equal(outcome.tracks.length, 1);
    assert.equal(outcome.tracks[0].provider, 'wyzie');
    assert.equal(outcome.tracks[0].format, 'srt');
    assert.equal(outcome.tracks[0].langLabel, 'English');
    assert.equal(outcome.tracks[0].release_name, 'Fixture.2026.WEB-DL');
    assert.deepEqual(outcome.providerOutcomes.subdl, { configured: true, state: 'no-results', count: 0 });
    assert.deepEqual(outcome.providerOutcomes.wyzie, { configured: true, state: 'available', count: 1 });
  } finally {
    global.fetch = previousFetch;
  }
});

test('Wyzie direct URL format query survives download normalization without an extension', async () => {
  const providerOutcomes = {
    subdl: { configured: true, state: 'no-results', count: 0 },
    wyzie: { configured: true, state: 'available', count: 1 },
  };
  const downloadSubtitles = loadTypeScriptModule('src/features/downloads/downloadSubtitles.ts', {
    '../../services/subtitles': {
      searchSubtitlesWithOutcome: async () => ({
        state: 'available', providerOutcomes,
        tracks: [{ id: 'wyzie-1', file_id: 'wyzie-1', lang: 'en', langLabel: 'English', release_name: 'Official fixture', url: 'https://sub.wyzie.io/c/hash/id/1?format=srt&encoding=UTF-8', provider: 'wyzie', format: 'srt' }],
      }),
    },
  });
  const target = { media: { id: 7, mediaType: 'movie', season: null, episode: null } };
  const outcome = await downloadSubtitles.discoverMobileDownloadSubtitlesV1(target);
  assert.equal(outcome.state, 'ready');
  assert.equal(outcome.tracks[0].format, 'srt');
  assert.deepEqual(outcome.providerOutcomes, providerOutcomes);
  assert.equal(JSON.stringify(outcome).includes('https://'), false);
});

test('provider-specific key, quota, offline, failure, and zero states remain represented without false unavailable labels', () => {
  const service = fs.readFileSync(path.join(root, 'src/services/subtitles.ts'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'src/components/DownloadModal.tsx'), 'utf8');
  assert.match(service, /response\.status === 402 \|\| response\.status === 429/);
  assert.match(service, /providerOutcomes/);
  assert.match(service, /state: 'no-results'/);
  assert.match(modal, /title="Subtitles unavailable"/);
  assert.match(modal, /subtitles\.state !== 'none'/);
  assert.match(modal, /return 'Unavailable'/);
  assert.match(modal, /'No match'/);
});

test('download subtitle summary distinguishes cleared selection, no matches and provider failure', () => {
  const modal = fs.readFileSync(path.join(root, 'src/components/DownloadModal.tsx'), 'utf8');
  const tree = ts.createSourceFile('DownloadModal.tsx', modal, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let summaryCallback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'subtitleSummary'
      && node.initializer && ts.isCallExpression(node.initializer)) {
      summaryCallback = node.initializer.arguments[0]?.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(summaryCallback);
  const summarize = (tracks, selectedIds, choice, state) =>
    new Function('eligibleSubtitleTracks', 'selectedSubtitleIds', 'subtitleChoice', 'subtitles',
      `return (${summaryCallback})();`)(tracks, selectedIds, choice, { state });
  const match = { id: 'subdl-1', languageLabel: 'English', providerLabel: 'SubDL' };
  assert.equal(summarize([match], [], 'auto', 'ready'), 'None');
  assert.equal(summarize([match], [], 'subdl', 'ready'), 'None');
  assert.equal(summarize([match], ['subdl-1'], 'auto', 'ready'), 'English · SubDL');
  assert.equal(summarize([], [], 'auto', 'none'), 'No match');
  assert.equal(summarize([], [], 'subdl', 'none'), 'SubDL · No match');
  assert.equal(summarize([], [], 'wyzie', 'none'), 'Wyzie · No match');
  assert.equal(summarize([], [], 'auto', 'provider-failure'), 'Unavailable');
});
