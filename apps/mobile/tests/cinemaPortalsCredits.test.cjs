'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
function load(relative) {
  const file = path.join(root, relative);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', source)(module, module.exports);
  return module.exports;
}

const mobile = load('src/features/discover/discoveryHubs.ts');
const desktop = load('../desktop/src/renderer/features/discover/discoveryHubs.js');
const credits = load('src/features/media-detail/titleCredits.ts');
const desktopCredits = load('../desktop/src/renderer/shared/utils/credits.js');

test('Cinema Portal definitions preserve the locked Desktop provider and world semantics', () => {
  assert.deepEqual(mobile.PROVIDER_HUBS.map(({ id, name, aliases }) => ({ id, name, aliases })),
    desktop.PROVIDER_HUBS.map(({ id, name, aliases }) => ({ id, name, aliases })));
  assert.deepEqual(mobile.WORLD_HUBS.map(({ id, name, filters }) => ({ id, name, filters })),
    desktop.WORLD_HUBS.map(({ id, name, filters }) => ({ id, name, filters })));
  assert.deepEqual(mobile.PROVIDER_HUBS.map((item) => item.name),
    ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Apple TV+']);
  assert.deepEqual(mobile.WORLD_HUBS.map((item) => item.name), ['Marvel', 'DC', 'Star Wars', 'Pixar']);
});

test('regional catalog resolves provider IDs and unavailable regions cannot issue a discover query', () => {
  const netflix = mobile.PROVIDER_HUBS[0];
  assert.deepEqual(mobile.findProviderIds([{ provider_id: 8, provider_name: 'Netflix' }], netflix), [8]);
  assert.deepEqual(mobile.findProviderIds([{ provider_id: 337, provider_name: 'Netflix' }], netflix), [337]);
  const selected = { kind: 'provider', id: 'netflix' };
  assert.equal(mobile.hubQueryParams(selected, 'all', 'movie', {
    region: 'GB', movie: [{ provider_id: 337, provider_name: 'Netflix' }], tv: [],
  }), '&watch_region=GB&with_watch_providers=337');
  assert.equal(mobile.hubQueryParams(selected, 'all', 'tv', { region: 'GB', movie: [], tv: [] }), null);
  assert.equal(mobile.hubQueryParams({ kind: 'world', id: 'starwars' }, 'classic', 'tv', null),
    '&with_keywords=377919&first_air_date.lte=1999-12-31');
  assert.equal(mobile.hubQueryParams({ kind: 'world', id: 'pixar' }, 'shorts', 'movie', null),
    '&with_companies=3&with_runtime.lte=45');
});

test('Mobile shows locked product labels without implementation language', () => {
  const portals = read('src/features/discover/CinemaPortals.tsx');
  for (const label of ['CINEMA PORTALS', 'Choose your orbit', 'Streaming Realms', 'Story Universes']) {
    assert.ok(portals.includes(label));
  }
  assert.doesNotMatch(portals, /EDITORIAL HUBS|Streaming Providers|Story Worlds|Provider Hubs|World Hubs/);
  assert.match(portals, /ScrollView horizontal/);
  assert.match(portals, /minHeight: 58/);
  const discover = read('src/features/discover/DiscoverScreen.tsx');
  assert.match(discover, /<CinemaPortals/);
  assert.match(discover, /hubQueryParams\(selectedHub, hubFilter/);
  assert.match(discover, /existingKeys/);
  assert.match(discover, /router\.push\(`\/media\/\$\{item\.id\}\?type=\$\{type\}`\)/);
});

test('title credits preserve every valid ordered cast member and distinct credit identities', () => {
  const raw = Array.from({ length: 60 }, (_, index) => ({
    id: index + 1, name: `Actor ${index + 1}`, order: 59 - index,
    character: index === 25 ? '' : `Role ${index + 1}`,
    profile_path: index === 25 ? null : '/portrait',
    credit_id: `credit-${index + 1}`,
  }));
  raw.push({ id: null, name: 'Invalid', order: 0 });
  raw.push({ ...raw[30] });
  raw.push({ ...raw[30], credit_id: 'second-role', character: 'Another role' });
  const cast = credits.normalizeTitleCast(raw);
  assert.equal(cast.length, 61);
  assert.equal(cast[0].id, 60);
  assert.equal(cast.at(-1).id, 1);
  assert.ok(cast.some((person) => person.id === 26 && person.character === '' && person.profile_path === null));
  assert.equal(cast.filter((person) => person.id === 31).length, 2);
  assert.ok(cast[25], '26th cast member remains reachable');
});

test('key crew is curated, ordered, deduplicated and includes TV creators', () => {
  const crew = [
    { id: 5, name: 'Producer', job: 'Producer' },
    { id: 2, name: 'Director', job: 'Director' },
    { id: 3, name: 'Writer', job: 'Writer' },
    { id: 5, name: 'Producer', job: 'Producer' },
    { id: 6, name: 'Grip', job: 'Grip' },
    { id: null, name: 'Invalid', job: 'Director' },
  ];
  const selected = credits.extractTitleKeyCrew(crew, [{ id: 1, name: 'Creator' }]);
  assert.deepEqual(selected.map((person) => person.job), ['Director', 'Creator', 'Writer', 'Producer']);
  assert.equal(selected.length, 4);
  assert.equal(credits.extractTitleKeyCrew(crew, [], 2).length, 2);
  for (const creators of [[], [{ id: 1, name: 'Creator' }]]) {
    const mobileCrew = credits.extractTitleKeyCrew(crew, creators);
    const desktopCrew = desktopCredits.extractKeyCrew(crew, creators);
    assert.deepEqual(mobileCrew.map((person) => [person.id, person.job]),
      desktopCrew.map((person) => [person.id, person.job]));
  }
});

test('Media Details keeps the existing title endpoint and real person/router stack with virtualized cast', () => {
  const screen = read('src/features/media-detail/MediaDetailScreen.tsx');
  const remote = read('src/features/media-detail/useMediaDetailRemoteState.ts');
  const person = read('app/person/[id].tsx');
  assert.match(remote, /append_to_response=credits,videos,recommendations/);
  assert.doesNotMatch(remote, /aggregate_credits/);
  assert.match(screen, /data=\{activeTab === 'cast' \? castList : \[\]\}/);
  assert.match(screen, /numColumns=\{castColumns\}/);
  assert.match(screen, /maxToRenderPerBatch=\{castGridBudget\.maxToRenderPerBatch\}/);
  assert.match(screen, /<KeyCrewList people=\{keyCrew\}/);
  assert.match(screen, /router\.push\(`\/person\/\$\{personId\}`/);
  assert.match(screen, /onPress=\{\(\) => router\.back\(\)\}/);
  assert.match(person, /router\.back\(\)/);
  assert.match(person, /Filmography/);
  assert.doesNotMatch(screen, /slice\(0, 25\)/);
});
