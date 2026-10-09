const test = require('node:test'), assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const load = loader({ '../../services/sourceHealth': { getMobileSourceHealthV2: () => null } });
const registry = load('packages/shared/src/sources/registry.ts'), source = registry.getRegisteredSource('anilink');
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts'), mobile = load('apps/mobile/src/features/playback/mobileSources.ts');
const url = (variant = 'sub', extra = {}) => registry.getSourceUrl('anilink', 'tv', { tmdbId: 62715, anilistId: 21175 }, 1, 1, {variant,...extra});
test('AniLink is a valid manual-only candidate, independently unqualified for playback and downloads', () => {
  assert.deepEqual(load('packages/shared/src/sources/contracts.ts').validateSourceDescriptor(source), []);
  assert.equal(source.routingMode, 'manual-only'); assert.equal(source.releaseStatus, 'candidate');
  assert.equal(source.supportsDownloads, false); assert.equal(source.animeOnly, true);
  assert.deepEqual(source.animeProvider, {variants:['sub','dub'],variantParam:'variant',playbackQualified:false,downloadQualified:false});
  assert.ok(!registry.AUTOMATIC_PLAYER_SOURCES.some(s => s.id === 'anilink'));
  assert.equal(mobile.mobileSourceSupportsContinuity('anilink'), false);
  assert.ok(!mobile.MOBILE_PLAYER_SOURCES.some(s => s.id === 'anilink'));
  assert.ok(!mobile.getMobileDownloadSourceChoices('tv').some(s => s.id === 'anilink'));
  assert.equal(mobile.getPreferredMobileResumeSource('anilink','tv'),'anilink');
  assert.equal(mobile.getPreferredMobileResumeSource('anilink','movie'),'vixsrc');
});
for (const variant of ['sub','dub']) test(`public ${variant} URL uses verified AniList work/episode and disables provider advancement`, () => {
  assert.equal(url(variant), `https://anilink.cc/watch/21175/1?autoplay=true&autonext=false&variant=${variant}`);
  assert.equal(new URL(url(variant)).searchParams.has('start'), false);
  assert.throws(() => url('raw'));
  for (const ids of [{tmdbId:21175},{imdbId:'tt21175'},{anilistId:0},{anilistId:1.5},21175]) {
    assert.throws(() => registry.getSourceUrl('anilink','tv',ids,1,1));
  }
  assert.throws(() => registry.getSourceUrl('anilink','movie',{anilistId:21175},1,1));
  assert.throws(() => registry.getSourceUrl('anilink','tv',{anilistId:21175},1,0));
  assert.throws(() => registry.getSourceUrl('anilink','tv',{anilistId:21175},1,1,{variant:''}));
  assert.throws(() => registry.getSourceUrl('anilink','tv',{anilistId:21175},1,1));
});
for (const [choice,target] of [['resume',1200],['replay-30',1170],['start-over',0]]) test(`existing ${choice} preserves its explicit ${target}s one-time target`, () => {
  const time = load('apps/mobile/src/features/playback/resumeChoice.ts').resolveResumeChoiceTime(choice,1200);
  assert.equal(time,target);
  const params = support.getMobileEmbedResumeParams('anilink',time,'tv',choice==='start-over');
  assert.equal(new URL(url('dub',params)).searchParams.get('start'),String(target));
  assert.match(read('apps/mobile/src/features/playback/EmbedPlayerSurface.tsx'), /forceStartFromBeginning && sourceId !== 'anilink'/);
});
test('wrapper CSP and native shield grant only explicit frame/navigation authority; synthetic origin is not telemetry/media authority', () => {
  const wrapped = support.createProviderWebViewSource(source,url());
  assert.equal(wrapped.baseUrl,'https://orion.local/player/');
  assert.match(wrapped.html,/frame-src https:\/\/anilink.cc"/);
  assert.match(wrapped.html,/referrerpolicy="origin"/);
  const manifest = support.getProviderShieldManifest('anilink',source);
  assert.deepEqual(manifest.allowedNavigationOrigins,['https://anilink.cc','https://orion.local']);
  assert.deepEqual(manifest.requiredOrigins,['https://anilink.cc']);
  assert.deepEqual(manifest.mediaOrigins,[]); assert.equal(manifest.popupPolicy,'block');
  assert.equal(support.getProviderTelemetryFrameOrigin(source,url()),'https://anilink.cc');
  for (const bad of ['https://www.anilink.cc/watch/21175/1','https://anilink.cc.evil/watch/21175/1','http://anilink.cc/watch/21175/1','https://x:y@anilink.cc/watch/21175/1']) {
    assert.deepEqual(support.createProviderWebViewSource(source,bad),{uri:'about:blank'});
  }
  const fallback = support.getProviderShieldManifest('anilink',{...source,requestManifest:undefined});
  assert.deepEqual(fallback.allowedNavigationOrigins,manifest.allowedNavigationOrigins);
  assert.deepEqual(fallback.requiredOrigins,manifest.requiredOrigins); assert.deepEqual(fallback.mediaOrigins,[]);
});
test('wrapper navigation permits its exact declared synthetic document and requested episode/variant only', () => {
  assert.equal(support.isSelectedAnimeNavigation('https://orion.local/player/',url(),source),true);
  assert.equal(support.isSelectedAnimeNavigation(url(),url(),source),true);
  for (const bad of ['https://orion.local/other','https://orion.local/player/?x=1','https://anilink.cc/watch/21175/2?variant=sub',url('dub')]) {
    assert.equal(support.isSelectedAnimeNavigation(bad,url(),source),false);
  }
  assert.equal(support.isSelectedAnimeNavigation('https://orion.local/player/','https://aniembed.se/e/21175/1?lang=sub',registry.getRegisteredSource('aniembed')),false);
});
test('diagnostic-only native ready candidate never enters preparation storage and cleanup always releases contexts', () => {
  let listener; const released = [];
  const capture = loader({'react-native':{Platform:{OS:'android'},NativeModules:{OrionDownloadCapture:{releaseSession:id=>released.push(id)}},
    DeviceEventEmitter:{addListener:(_name,fn)=>{listener=fn;return{remove(){}};}}}})('apps/mobile/src/features/downloads/downloadCandidateCapture.ts');
  const session = {playbackSessionId:'ani',sourceId:'anilink',providerClass:'candidate',itemKey:'series:62715:s1:e1',
    media:{schemaVersion:1,id:62715,mediaType:'tv',title:'Dragon Ball Super',year:2015,season:1,episode:1,libraryKind:'anime'},diagnosticOnly:true};
  const stop = capture.beginMobileDownloadCaptureSessionV1(session);
  const candidate = {schemaVersion:1,playbackSessionId:'ani',sourceId:'anilink',candidateId:'candidate',requestContextId:'opaque',
    manifestKind:'hls',expiry:'session',protection:'clear',observedAt:Date.now(),capabilities:{orionLibrary:true,deviceStorage:true,resumable:true},
    preflight:{candidateId:'candidate',state:'ready',reachability:'reachable',resolvedManifestKind:'hls',expiry:'session',protection:'clear',storageRequirement:'known',requestContextReady:true,availableQualities:[]}};
  listener(candidate); assert.equal(capture.normalizeMobileDownloadCandidateEventV1(candidate,session),null);
  assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(),[]); assert.equal(capture.isMobileDownloadSourceAllowedV1('anilink'),false);
  assert.equal(capture.selectMobileDownloadCandidateForItemV1(session.itemKey,'auto'),null);
  capture.requestMobileDownloadSourceResolutionV1(session.itemKey); stop(); assert.deepEqual(released,['ani']);
  capture.cancelMobileDownloadSourceResolutionV1(session.itemKey); assert.deepEqual(released,['ani']);
});
