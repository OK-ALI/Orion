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
const personProfile = load('src/features/media-detail/personProfile.ts');
const desktopCredits = load('../desktop/src/renderer/shared/utils/credits.js');

test('Cinema Portal definitions preserve Desktop identity while repairing empty Mobile facets', () => {
  assert.deepEqual(mobile.PROVIDER_HUBS.map(({ id, name, aliases }) => ({ id, name, aliases })),
    desktop.PROVIDER_HUBS.map(({ id, name, aliases }) => ({ id, name, aliases })));
  assert.deepEqual(mobile.WORLD_HUBS.map(({ id, name, filters }) => ({ id, name, facets: filters.map(({ id, name }) => ({ id, name })) })),
    desktop.WORLD_HUBS.map(({ id, name, filters }) => ({ id, name, facets: filters.map(({ id, name }) => ({ id, name })) })));
  assert.deepEqual(mobile.PROVIDER_HUBS.map((item) => item.name),
    ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Apple TV+']);
  assert.deepEqual(mobile.WORLD_HUBS.map((item) => item.name), ['Marvel', 'DC', 'Star Wars', 'Pixar']);
});

test('empty X-Men, Spider-Man, Batman and Superman facets use verified Mobile queries', () => {
  const marvel = { kind: 'world', id: 'marvel' };
  const dc = { kind: 'world', id: 'dc' };
  assert.equal(mobile.hubQueryParams(marvel, 'xmen', 'movie', null),
    '&with_companies=160251|19551|7505|420&with_keywords=1852');
  assert.equal(mobile.hubQueryParams(marvel, 'xmen', 'tv', null),
    '&with_companies=160251|19551|7505|38679|420&with_keywords=1852');
  assert.equal(mobile.hubQueryParams(marvel, 'spider', 'movie', null),
    '&with_companies=5&with_keywords=9715,9717');
  assert.equal(mobile.hubTitleSearch(marvel, 'spider', 'tv'), 'Spider-Man');
  assert.equal(mobile.hubTitleSearch(dc, 'batman', 'movie'), 'Batman');
  assert.equal(mobile.hubTitleSearch(dc, 'batman', 'tv'), 'Batman');
  assert.equal(mobile.hubTitleSearch(dc, 'superman', 'movie'), 'Superman');
  assert.equal(mobile.hubTitleSearch(dc, 'superman', 'tv'), 'Superman');
  assert.equal(mobile.hubTitleSearch(dc, 'arrowverse', 'tv'), null);
  assert.equal(mobile.hubTitleSearchMatches(dc, 'batman', 'movie', { title: 'The Batman' }), true);
  assert.equal(mobile.hubTitleSearchMatches(dc, 'batman', 'movie', { title: 'A Gotham Story' }), false);
  assert.equal(mobile.hubTitleSearchMatches(marvel, 'spider', 'tv', { name: 'Spider-Man: The Animated Series' }), true);
  assert.equal(mobile.hubTitleSearchMatches(marvel, 'spider', 'tv', { name: 'Spider Riders' }), false);
  assert.doesNotMatch(JSON.stringify(mobile.WORLD_HUBS), /377742|373794|349974|377234/);
  const screen = read('src/features/discover/DiscoverScreen.tsx');
  assert.match(screen, /hubTitleSearch\(selectedHub, hubFilter/);
  assert.match(screen, /hubTitleSearchMatches\(selectedHub, hubFilter/);
  assert.match(screen, /\/search\/\$\{mediaType\}/);
  assert.match(screen, /setGenreResults\(\(prev: any\) =>/);
  assert.match(screen, /existingKeys/);
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
    '&with_companies=1&with_keywords=161176&first_air_date.lte=1999-12-31');
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
  assert.match(discover, /<View style={styles.worldFacetRail}>/);
  assert.match(read('src/features/discover/discoverStyles.ts'), /worldFacetRail:\s*\{\s*height: 44,\s*flexShrink: 0,/);
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
  const presentation = read('src/features/media-detail/CreditsPresentation.tsx');
  const remote = read('src/features/media-detail/useMediaDetailRemoteState.ts');
  const person = read('app/person/[id].tsx');
  assert.match(remote, /append_to_response=credits,videos,recommendations/);
  assert.doesNotMatch(remote, /aggregate_credits/);
  assert.match(screen, /data=\{activeTab === 'cast' \? castList : \[\]\}/);
  assert.match(screen, /numColumns=\{castColumns\}/);
  assert.match(screen, /maxToRenderPerBatch=\{castGridBudget\.maxToRenderPerBatch\}/);
  assert.match(screen, /<KeyCrewList people=\{keyCrew\}/);
  assert.match(screen, /pathname: '\/person\/\[id\]'/);
  assert.match(screen, /originTitle:|originRole:|originKind:/);
  assert.match(screen, /onPress=\{\(\) => router\.back\(\)\}/);
  assert.match(person, /router\.back\(\)/);
  assert.match(person, /Filmography/);
  assert.match(person, /personFilmography\(data\)/);
  assert.match(person, /tint=\{theme\.dark \? 'dark' : 'light'\}/);
  assert.doesNotMatch(screen, /slice\(0, 25\)/);
  assert.match(presentation, />TOP CAST<\/Text>/);
  assert.match(presentation, />KEY CREW<\/Text>/);
  assert.doesNotMatch(presentation, /TOP CAST & CREW/);
});

test('Person profile includes crew-only work and truthful sparse-profile presentation', () => {
  const work = personProfile.personFilmography({ combined_credits: {
    cast: [{ id: 8, media_type: 'movie', title: 'First', popularity: 3 }],
    crew: [{ id: 9, media_type: 'tv', name: 'Created Show', popularity: 8 },
      { id: 8, media_type: 'movie', title: 'First', popularity: 3 },
      { id: 0, media_type: 'movie', title: 'Invalid' }],
  } });
  assert.deepEqual(work.map((item) => [item.media_type, item.id]), [['tv', 9], ['movie', 8]]);
  assert.equal(work[0].poster_path, null);
  assert.equal(work[0].backdrop_path, null);
  const person = read('app/person/[id].tsx');
  assert.match(person, /A biography has not been added for this person/);
  assert.match(person, /No filmography is listed for this person yet/);
  assert.match(person, /portraitFallback/);
  assert.doesNotMatch(person, /tint="dark" style=\{styles\.backButtonInner\}/);
});

test('Star Wars uses verified Lucasfilm/space-opera Discover facets instead of Desktop’s empty keyword', () => {
  const hub = { kind: 'world', id: 'starwars' };
  const expected = {
    movies: '&with_companies=1&with_keywords=161176',
    series: '&with_companies=1&with_keywords=161176',
    animation: '&with_companies=1&with_keywords=161176&with_genres=16',
    classic: '&with_companies=1&with_keywords=161176&primary_release_date.lte=1999-12-31',
    modern: '&with_companies=1&with_keywords=161176&primary_release_date.gte=2000-01-01',
  };
  for (const [facet, params] of Object.entries(expected)) {
    assert.equal(mobile.hubQueryParams(hub, facet, 'movie', null), params);
  }
  assert.doesNotMatch(JSON.stringify(mobile.WORLD_HUBS.find((world) => world.id === 'starwars').filters), /377919/);
  const screen = read('src/features/discover/DiscoverScreen.tsx');
  assert.match(screen, /hub\.id === 'starwars'\) setGenreType\('movie'\)/);
  assert.match(screen, /facet\.id === 'series'\) setGenreType\('tv'\)/);
  assert.match(screen, /facet\.id === 'animation'\) setGenreType\('all'\)/);
});
