'use strict';
// Exact reviewed Anime repair dependencies. Qualified transports/players outside
// these identity, selection-copy and provider-episode arguments remain frozen.
function animeRepairIntegrationBase(file, source) {
  if(file==='packages/shared/src/api/animeLookup.ts') return source
    .replace('  catalog?: AnimeCatalogEvidence; diagnostic?: AnimeIdentityDiagnosticSink;', '  catalog?: AnimeCatalogEvidence; diagnostic?: AnimeIdentityDiagnosticSink; forceRefresh?: boolean;')
    .replace('cached: Boolean(saved && saved.expires > Date.now())','cached: Boolean(!options.forceRefresh && saved && saved.expires > Date.now())')
    .replace('if (saved && saved.expires > Date.now())','if (!options.forceRefresh && saved && saved.expires > Date.now())');
  if(file==='apps/mobile/src/features/playback/animeIdentityRequest.ts') return source
    .replace('export const getAnimeCatalogTitles', "import { resolveCanonicalAnimeEpisode, resolveCanonicalAnimeMovie, type CanonicalAnimeResult, type AnimeEvidenceReader } from './animeCanonicalRepair';\n\nexport const getAnimeCatalogTitles")
    .replace("type Result = Verified | { state: 'blocked'; reason: string };", 'type Result = CanonicalAnimeResult;')
    .replace('  lookup: typeof lookupAnimeEntries;', '  lookup: typeof lookupAnimeEntries;\n  evidence?: AnimeEvidenceReader;')
    .replace("  emit({ stage: 'request', tmdbId: id, mediaType: type, season: season ?? 0,\n    episode: episode ?? 0, year: yearOf(detail?.first_air_date), variant });", "  emit({ stage: 'request', tmdbId: id, mediaType: type, ...(type === 'tv' ? { season: season ?? 0, episode: episode ?? 0 } : {}),\n    year: yearOf(type === 'movie' ? detail?.release_date : detail?.first_air_date), variant });")
    .replace("  if (type !== 'tv') return reject('unsupported-media');", "  if (type === 'movie') {\n    if (!detail.release_date) return reject('unsupported-media');\n    try { return await resolveCanonicalAnimeMovie(id, getAnimeCatalogTitles(detail), yearOf(detail.release_date), dependencies.lookup, signal, diagnostic); }\n    catch (error) { return reject(signal.aborted ? 'lookup-cancelled' : error instanceof AnimeLookupError ? error.reason : 'lookup-malformed-response'); }\n  }")
    .replace('    return verifyAnimeIdentity(catalog, entries, diagnostic);', '    return await resolveCanonicalAnimeEpisode(catalog, detail, selectedSeason, entries, dependencies.lookup, signal, diagnostic, dependencies.evidence);');
  if(file==='apps/mobile/src/features/playback/useAnimeSource.ts') return source
    .replace("import { createAnimeIdentityTrace }", "import { animeFailureCopy, type CanonicalAnimeIdentity } from './animeCanonicalRepair';\nimport { mobileAnimeSupportsMedia, animeSelectionMatches, getMovieAnimeFlowChoice, setMovieAnimeFlowChoice, preferredMovieAnimeSource } from './animeMediaShape';\nimport { createAnimeIdentityTrace }")
    .replace("  identity: Extract<AnimeIdentityResult, { state: 'verified' }>;", '  identity: CanonicalAnimeIdentity;')
    .replace("const eligible = enabled && type === 'tv' && (season ?? 0) > 0 && (episode ?? 0) > 0;", "const eligible = enabled && (type === 'movie' || ((season ?? 0) > 0 && (episode ?? 0) > 0));")
    .replace('  const request = useRef<AbortController | null>(null);', '  const failures = useRef<Record<string, string>>({});\n  const request = useRef<AbortController | null>(null);')
    .replace("    if (!isManualAnimeProvider(providerId) || !getRegisteredSource(providerId)?.animeProvider?.variants.includes(variant)) return null;", "    if (!isManualAnimeProvider(providerId) || !getRegisteredSource(providerId)?.animeProvider?.variants.includes(variant)) { failures.current[providerId] = 'variant-unavailable'; return null; }")
    .replace("      return !signal.aborted && result.state === 'verified' ? { identity: result, variant, providerId } : null;", "      if (signal.aborted) { failures.current[providerId] = 'lookup-cancelled'; return null; }\n      if (result.state !== 'verified') { failures.current[providerId] = result.reason; return null; }\n      if (!mobileAnimeSupportsMedia(providerId, type) || !animeSelectionMatches(result, id, type, season, episode)) { failures.current[providerId] = 'unsupported-media'; return null; }\n      delete failures.current[providerId];\n      return { identity: result, variant, providerId };")
    .replace("      diagnostic({ stage: 'decision', outcome: 'rejected', reason: 'selection-failed' });", "      failures.current[providerId] = 'selection-failed';\n      diagnostic({ stage: 'decision', outcome: 'rejected', reason: 'selection-failed' });")
    .replace('    detailRef.current = null; selectionRef.current = null; manualChoice.current = false;', '    detailRef.current = null; selectionRef.current = null; manualChoice.current = false; failures.current = {};')
    .replaceAll("phase: eligible ? 'checking'", "phase: eligible && (type === 'tv' || isManualAnimeProvider(routedSource) || isManualAnimeProvider(preferenceRef.current?.sourceId)) ? 'checking'")
    .replace('error: continuation ? `Could not continue this episode with ${getRegisteredSource(providerId)?.label}.` : null', 'error: continuation ? (failures.current[providerId] ? animeFailureCopy(failures.current[providerId], type) : `Could not continue this episode with ${getRegisteredSource(providerId)?.label}.`) : null')
    .replace('        detailRef.current = detail;', "        detailRef.current = detail;")
    .replace('    if (selection.identity.tmdbId !== id || selection.identity.season !== season || selection.identity.episode !== episode) return false;', '    if (!mobileAnimeSupportsMedia(providerId, type) || !animeSelectionMatches(selection.identity, id, type, season, episode)) return false;')
    .replace('  }, [episode, id, season]);', '  }, [episode, id, season, type]);')
    .replaceAll('getAnimeFlowChoice(id)', "(type === 'movie' ? getMovieAnimeFlowChoice(id) : getAnimeFlowChoice(id))")
    .replace('preferredAnimeSource(id,', "(type === 'movie' ? preferredMovieAnimeSource : preferredAnimeSource)(id,")
    .replaceAll('setAnimeFlowChoice(id,', "(type === 'movie' ? setMovieAnimeFlowChoice : setAnimeFlowChoice)(id,")
    .replaceAll('  }, [id]);', '  }, [id, type]);')
    .replace('  return { ...current, prepare, activate, manualGeneral, recordSuccess, retry:', '  return { ...current, prepare, activate, manualGeneral, recordSuccess, preparationFailure: (providerId: string) => animeFailureCopy(failures.current[providerId], type), retry:');
  if(file==='apps/mobile/src/features/playback/AnimeSourceChoices.tsx') return source
    .replace("import type { AnimeVariant }", "import { mobileAnimeSupportsMedia } from './animeMediaShape';\nimport type { AnimeVariant }")
    .replace('  currentSourceId: string; variant?: AnimeVariant;', "  currentSourceId: string; variant?: AnimeVariant;\n  mediaType?: 'movie' | 'tv'; preparationFailure?: (providerId: string) => string;")
    .replace('prepare, onSelect, providerId }: AnimeSourceChoicesProps', "prepare, onSelect, providerId, mediaType = 'tv', preparationFailure }: AnimeSourceChoicesProps")
    .replace("  const health = getMobileSourceHealthV2(providerId, 'tv');", "  const health = getMobileSourceHealthV2(providerId, mediaType);\n  const supported = mobileAnimeSupportsMedia(providerId, mediaType);")
    .replace('    if (busy || (selected', '    if (!supported || busy || (selected')
    .replace("setError('Orion could not verify this Anime season and episode. Choose another source.');", "setError(preparationFailure?.(providerId) || 'Orion could not match this Anime episode. Choose another source.');")
    .replace("{health?.state === 'ready' ?", "{!supported ? 'Not currently available for Anime films' : health?.state === 'ready' ?")
    .replace('disabled={busy}', 'disabled={busy || !supported}')
    .replace('disabled: busy }}', 'disabled: busy || !supported }}');
  if(file==='apps/mobile/src/features/playback/PlayerScreen.tsx') return source
    .replace("import { clearAnimeFlowChoice }", "import { getMobileAnimePlaybackUrl, getMobileAnimeFilmResumeSource, clearMovieAnimeFlowChoice } from './animeMediaShape';\nimport { clearAnimeFlowChoice }")
    .replace('    clearAnimeFlowChoice(String(routeIdRef.current));', "    if (routeTypeRef.current === 'movie') clearMovieAnimeFlowChoice(String(routeIdRef.current));\n    else clearAnimeFlowChoice(String(routeIdRef.current));")
    .replace('  const routeIdRef = useRef(id); routeIdRef.current = id;', '  const routeIdRef = useRef(id); routeIdRef.current = id;\n  const routeTypeRef = useRef(type); routeTypeRef.current = type;')
    .replace('useState(() => routedNextSource || getPreferredMobileResumeSource(', 'useState(() => routedNextSource || getMobileAnimeFilmResumeSource(sourcePreference?.sourceId || existingProgress?.sourceId, type) || getPreferredMobileResumeSource(')
    .replace('getSourceUrl(sourceId, type,\n      { tmdbId: id, anilistId: activeAnimeTest.identity.anilistId }, resolvedSeason || 1, resolvedEpisode || 1,', 'getMobileAnimePlaybackUrl(sourceId, activeAnimeTest.identity,')
    .replace('currentSourceId={sourceId} variant={activeAnimeTest?.variant} prepare={anime.prepare}', 'currentSourceId={sourceId} variant={activeAnimeTest?.variant} prepare={anime.prepare} mediaType={type} preparationFailure={anime.preparationFailure}');
  if(file==='apps/mobile/tests/animeProductization.test.cjs')return source.replace('disabled: busy \\}\\}/', 'disabled: busy \\|\\| !supported \\}\\}/');
  if(file==='apps/mobile/src/features/library/sourceAffinity.ts')return source.replace("|| !(type === 'movie' ? source.media.movie : source.media.tv)", "|| !(type === 'movie' ? source.media.movie || isManualAnimeProvider(source.id) : source.media.tv)");
  if(file==='apps/mobile/src/features/playback/animeReadiness.ts') return source
    .replace('export const ANIME_READINESS_DEADLINE_MS = 35_000;', 'export const ANIME_READINESS_DEADLINE_MS = 35_000;\n// AniLink publishes a 90-second recovery budget; allow ten seconds for page startup.\nexport const ANILINK_READINESS_DEADLINE_MS = 100_000;\nexport const animeReadinessDeadline = (providerId?: string) => providerId === \'anilink\'\n  ? ANILINK_READINESS_DEADLINE_MS : ANIME_READINESS_DEADLINE_MS;')
    .replace('expireAnimeReadiness(state: AnimeReadiness, now: number)', 'expireAnimeReadiness(state: AnimeReadiness, now: number, providerId?: string)')
    .replace('now - state.startedAt >= ANIME_READINESS_DEADLINE_MS', 'now - state.startedAt >= animeReadinessDeadline(providerId)');
  if(file==='apps/mobile/src/features/playback/useAnimeReadiness.ts') return source
    .replace('ANIME_READINESS_DEADLINE_MS, createAnimeReadiness', 'animeReadinessDeadline, createAnimeReadiness')
    .replace('attempt: number, onFailure: () => void)', 'attempt: number, onFailure: () => void, providerId?: string)')
    .replace('expireAnimeReadiness(state.current, Date.now())', 'expireAnimeReadiness(state.current, Date.now(), providerId)')
    .replace('}, ANIME_READINESS_DEADLINE_MS);', '}, animeReadinessDeadline(providerId));')
    .replace('[enabled, sessionId, attempt, failed]', '[enabled, sessionId, attempt, failed, providerId]');
  if(file==='apps/mobile/src/features/playback/EmbedPlayerSurface.tsx') return source
    .replace('    setSurfaceReleased(true);\n  });', '    setSurfaceReleased(true);\n  }, sourceId);');
  if(file==='apps/mobile/metro.config.js') return source.replace('module.exports = config;',"// Resolve Orion's public API from this checkout even when dependencies are reused.\nconst upstreamResolveRequest = config.resolver.resolveRequest;\nconfig.resolver.resolveRequest = (context, moduleName, platform) => {\n  if (moduleName === '@orion/shared/api') {\n    return { type: 'sourceFile', filePath: path.join(workspaceRoot, 'packages/shared/src/api/index.ts') };\n  }\n  return upstreamResolveRequest\n    ? upstreamResolveRequest(context, moduleName, platform)\n    : context.resolveRequest(context, moduleName, platform);\n};\n\nmodule.exports = config;");
  return source;
}
// Exact additive route intent and Anime-only pending-identity gate. No General or offline changes.
const animeEntryTransforms = {
  "apps/mobile/src/features/playback/useAnimeSource.ts": [
    [
      "enabled, routedSource, routedVariant, preference, onPreferred",
      "enabled, knownAnime = false, routedSource, routedVariant, preference, onPreferred"
    ],
    [
      "  routedSource?: string; routedVariant?: string; onPreferred",
      "  knownAnime?: boolean; routedSource?: string; routedVariant?: string; onPreferred"
    ],
    [
      "eligible && (type === 'tv' || isManualAnimeProvider(routedSource) || isManualAnimeProvider(preferenceRef.current?.sourceId))",
      "eligible && (type === 'tv' || isManualAnimeProvider(routedSource) || isManualAnimeProvider(preferenceRef.current?.sourceId) || (knownAnime && preferredMovieAnimeSource(id, routedSource, routedVariant, preferenceRef.current) !== null))",
      2
    ],
    [
      "        const selection = await resolve(affinity.variant, detail, scope.signal, affinity.providerId);",
      "        // A catalog-verified Anime film must not open General while identity proof is pending.\n        if (type === 'movie') setState({ key, phase: 'checking', detail, selection: null, error: null });\n        const selection = await resolve(affinity.variant, detail, scope.signal, affinity.providerId);"
    ],
    [
      "resolve, retryAttempt, routedSource, routedVariant, type]);",
      "resolve, retryAttempt, routedSource, routedVariant, knownAnime, type]);"
    ],
    [
      "  const key = `${type}:${id}:${season}:${episode}`;",
      "  const key = `${type}:${id}:${season}:${episode}${knownAnime && type === 'movie' ? ':anime-entry' : ''}`;"
    ]
  ],
  "apps/mobile/src/features/playback/PlayerScreen.tsx": [
    [
      "  nextAnimeVariant?: string;",
      "  nextAnimeVariant?: string;\n  animeHint?: string;"
    ],
    [
      "posterPath, backdropPath, episodeTitle, offlineAssetId, isOffline, nextSourceId, nextAnimeVariant,",
      "posterPath, backdropPath, episodeTitle, offlineAssetId, isOffline, nextSourceId, nextAnimeVariant, animeHint,"
    ],
    [
      "enabled: !offlineRequested && !downloadResolutionOnly, preference: sourcePreference,",
      "enabled: !offlineRequested && !downloadResolutionOnly, knownAnime: animeHint === 'true', preference: sourcePreference,"
    ]
  ],
  "apps/mobile/app/(tabs)/index.tsx": [
    [
      "import { tmdbFetch } from '@orion/shared/api';",
      "import { tmdbFetch } from '@orion/shared/api';\nimport { getAnimeEntryHint } from '../../src/features/playback/animeEntryIntent';"
    ],
    [
      "        id: item.id,\n        type,",
      "        id: item.id,\n        ...getAnimeEntryHint(item),\n        type,"
    ]
  ],
  "apps/mobile/src/features/media-detail/MediaDetailScreen.tsx": [
    [
      "import { imgUrl } from '@orion/shared/api';",
      "import { imgUrl } from '@orion/shared/api';\nimport { getAnimeEntryHint } from '../playback/animeEntryIntent';"
    ],
    [
      "                    id, type, title, year,",
      "                    id, type, title, year,\n                    ...getAnimeEntryHint(data),"
    ]
  ],
  "apps/mobile/tests/p10a2MediaDetailOfflineActions.test.cjs": [
    [
      "const root = path.resolve(__dirname, '..');",
      "const isAnimeContent = require('./helpers/animeModules.cjs').loader()('packages/shared/src/api/tmdb.ts').isAnimeContent;\nconst root = path.resolve(__dirname, '..');"
    ],
    [
      "    '@orion/shared/api': { tmdbFetch:",
      "    '@orion/shared/api': { isAnimeContent, tmdbFetch:"
    ]
  ],
  "apps/mobile/tests/f10aM1OfflineHomePresentation.test.cjs": [
    [
      "const root = path.resolve(__dirname, '..');",
      "const isAnimeContent = require('./helpers/animeModules.cjs').loader()('packages/shared/src/api/tmdb.ts').isAnimeContent;\nconst root = path.resolve(__dirname, '..');"
    ],
    [
      "    '@orion/shared/api': { tmdbFetch:",
      "    '@orion/shared/api': { isAnimeContent, tmdbFetch:"
    ]
  ]
};
const animeEntryAppendTests = {
  "apps/mobile/tests/p10a2MediaDetailOfflineActions.test.cjs": "\ntest('catalog-recognized Anime film Watch adds only advisory entry intent; offline remains unchanged',async()=>{\n const h=harness({repository:downloaded()});\n h.requests[0].resolve({...titleResponse(),original_language:'ja',genres:[{id:16}]});await h.settle();\n h.press('Watch Remote title 1');const route=h.routes[0];assert.equal(route.params.animeHint,'true');\n assert.equal(route.params.id,'1');assert.equal(route.params.type,'movie');assert.equal(route.params.season,undefined);assert.equal(route.params.episode,undefined);\n h.connect('offline');h.press('Play Remote title 1 offline');assert.equal(h.routes[1].params.offlineAssetId,'asset-1');assert.equal(h.routes[1].params.animeHint,undefined);h.unmount();\n});\ntest('ordinary film Watch retains its exact original route payload without an Anime hint',async()=>{\n const h=harness();h.requests[0].resolve(titleResponse());await h.settle();h.press('Watch Remote title 1');\n assert.deepEqual(h.routes[0],{pathname:'/player/[id]',params:{id:'1',type:'movie',title:'Remote title 1',year:'2024',seriesTitle:undefined,posterPath:undefined,backdropPath:undefined}});h.unmount();\n});\n",
  "apps/mobile/tests/f10aM1OfflineHomePresentation.test.cjs": "\ntest('Home Hero uses advisory Anime intent only for recognized catalog items and preserves ordinary movie routes',async()=>{\n for(const anime of [false,true]){\n  const h=harness({state:'online'}),item={id:7,title:'Catalog film',media_type:'movie',release_date:'2026-01-01',poster_path:'/poster',backdrop_path:'/backdrop',genre_ids:[16],original_language:anime?'ja':'en'};\n  h.requests.forEach((r,i)=>r.resolve({results:i===0?[item]:[]}));await h.settle();\n  const hero=h.component('HeroBillboard');assert.ok(hero);hero.props.onPlay(hero.props.items[0]);\n  const expected={pathname:'/player/[id]',params:{id:7,type:'movie',title:'Catalog film',year:'2026',seriesTitle:undefined,posterPath:'/poster',backdropPath:'/backdrop'}};\n  if(anime)expected.params.animeHint='true';assert.deepEqual(h.routes,[expected]);\n }\n});\n"
};
function animeRepairIntegration(file, source) {
  let expected = animeRepairIntegrationBase(file, source);
  for (const [before, after] of animeEntryTransforms[file] || []) expected = expected.replaceAll(before, after);
  return expected + (animeEntryAppendTests[file] || '');
}
module.exports={animeRepairIntegration};
