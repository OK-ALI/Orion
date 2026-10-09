const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { libraryFixture, memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { aniLinkFrameHost, event } = require('./helpers/aniLinkFrameHarness.cjs');
const load = loader(), registry = load('packages/shared/src/sources/registry.ts');
function identityFixture() {
  const harness = hookHarness(), requests = [], chosen = [];
  const hookLoad = loader({react:harness.react,
    '@orion/shared/api':{isAnimeContent:value=>value.anime,tmdbFetch:async()=>({id:62715,anime:true}),lookupAnimeEntries(){}},
    './animeIdentityDiagnostics':{createAnimeIdentityTrace:()=>()=>{}},
    './animeIdentityRequest':{resolveAnimeTestIdentity:async input=>{requests.push(input);return {state:'verified',tmdbId:input.id,
      anilistId:input.season===1?21175:172463,season:input.season,episode:input.episode};}},
    '../../services/storageAdapter':{mmkvStorageAdapter:memoryStorage()}});
  const props={id:'62715',type:'tv',season:1,episode:1,enabled:true,onPreferred:value=>chosen.push(value)};
  harness.start(hookLoad('apps/mobile/src/features/playback/useAnimeSource.ts').useAnimeSource,props);
  return {harness,props,requests,chosen,affinity:hookLoad('apps/mobile/src/features/playback/animeSourceAffinity.ts')};
}
for (const variant of ['sub','dub']) test(`manual AniLink ${variant} independently resolves next episode and later season, preserving only series/variant intent`,async()=>{
  const f=identityFixture(); await f.harness.settle(); assert.equal(f.chosen[0].providerId,'aniembed');
  const selection=await f.harness.result.prepare(variant,'anilink'); assert.equal(selection.providerId,'anilink');
  assert.ok(f.harness.result.activate(selection)); await f.harness.settle(); f.harness.result.recordSuccess('anilink');
  assert.equal(f.affinity.getAnimeAffinity('62715'),null,'durable success remains owned by shared verified Library writer');
  for (const [season,episode,anilistId] of [[1,2,21175],[2,1,172463]]) {
    f.harness.update({...f.props,season,episode,routedSource:'anilink',routedVariant:variant}); await f.harness.settle();
    assert.equal(f.chosen.at(-1).providerId,'anilink'); assert.equal(f.chosen.at(-1).variant,variant);
    assert.equal(f.chosen.at(-1).identity.anilistId,anilistId); assert.equal(f.requests.at(-1).episode,episode);
    assert.ok(!Object.hasOwn(f.chosen.at(-1),'currentTime'));
    assert.equal(new URL(registry.getSourceUrl('anilink','tv',{anilistId},season,episode,{variant})).pathname,`/watch/${anilistId}/${episode}`);
  }
  f.harness.result.manualGeneral('vidlink'); await f.harness.settle();
  assert.equal(f.harness.result.phase,'general'); assert.equal(f.harness.result.error,null);
  f.harness.update({...f.props,season:2,episode:2,routedSource:'vidlink'}); await f.harness.settle();
  assert.equal(f.harness.result.phase,'general'); f.harness.dispose();
});
test('existing exact identity verifier covers Dragon Ball Super, Solo Leveling and independently related season two',()=>{
  const verify=load('packages/shared/src/api/animeIdentity.ts').verifyAnimeIdentity;
  const cases=[{tmdbId:'62715',titles:['Dragon Ball Super'],year:2015,episodeCount:131,anilistId:21175},
    {tmdbId:'127532',titles:['Solo Leveling'],year:2024,episodeCount:12,anilistId:151807}];
  for (const c of cases) {
    const result=verify({...c,mediaType:'tv',season:1,episode:1,seasonYear:c.year},
      [{id:c.anilistId,titles:c.titles,year:c.year,format:'TV',episodes:c.episodeCount,sequels:[]}]);
    assert.equal(result.state,'verified');
    for(const variant of ['sub','dub']) assert.match(registry.getSourceUrl('anilink','tv',result,1,1,{variant}),new RegExp(`/watch/${c.anilistId}/1\\?`));
  }
  const next={id:172463,titles:['Solo Leveling Season 2 -Arise from the Shadow-'],year:2025,format:'TV',episodes:13,sequels:[]};
  const base={id:151807,titles:['Solo Leveling'],year:2024,format:'TV',episodes:12,sequels:[next]};
  const catalog={tmdbId:'127532',titles:base.titles,year:2024,mediaType:'tv',season:2,episode:1,seasonYear:2025,episodeCount:13,seasonTitles:next.titles};
  const result=verify(catalog,[base]); assert.equal(result.anilistId,172463);
  assert.match(registry.getSourceUrl('anilink','tv',result,2,1,{variant:'sub'}),/\/watch\/172463\/1\?/);
  assert.equal(verify(catalog,[{...base,sequels:[]}]).state,'blocked');
});
for(const variant of ['sub','dub']) test(`verified AniLink ${variant} progress uses the existing Library, per-episode positions and title-level affinity`,async()=>{
  const f=libraryFixture();
  const record={item:{id:62715,title:'Dragon Ball Super'},mediaType:'tv',season:1,episode:1,sourceId:'anilink',sourceVariant:variant,currentTime:1200,duration:1440};
  f.library.recordPlayback({...record,evidence:'opened-only',sessionId:'unverified'}); await f.harness.settle();
  assert.equal(f.library.getPlaybackSourcePreference('tv',62715),null);
  f.library.recordPlayback({...record,evidence:'provider-message',sessionId:'verified'}); await f.harness.settle();
  assert.deepEqual(f.library.getPlaybackSourcePreference('tv',62715),{sourceId:'anilink',variant});
  assert.equal(f.library.getPlaybackProgress('tv',62715,1,1).currentTime,1200);
  for(const [season,episode] of [[1,2],[2,1]]) assert.equal(f.library.getPlaybackProgress('tv',62715,season,episode),null);
  assert.equal(f.library.getPlaybackSourcePreference('tv',127532),null);
  const reopened=libraryFixture(f.storage); assert.deepEqual(reopened.library.getPlaybackSourcePreference('tv',62715),{sourceId:'anilink',variant});
  const stored=JSON.stringify([...f.storage.values.values()]); assert.doesNotMatch(stored,/anilink\.cc|requestContext|anilistId/);
  f.harness.dispose(); reopened.harness.dispose();
});
function player(providerId='aniembed', fetchOverride) {
  let f; const selection={providerId,variant:'sub',identity:{state:'verified',tmdbId:'62715',anilistId:21175,season:1,episode:1}};
  const storage=memoryStorage();
  load('apps/mobile/src/features/library/sourceAffinity.ts').rememberSourcePreference(storage,'tv',62715,
    {sourceId:providerId,variant:'sub'},'provider-video-event','prior-success');
  f=playbackFixture({id:'62715',type:'tv',season:'1',episode:'1',title:'Dragon Ball Super',nextSourceId:providerId},storage,
    {phase:'anime',selection,detail:{id:62715},activate(value){f.anime.selection=value;return true;},
      manualGeneral(){f.anime.phase='general';f.anime.selection=null;f.anime.error=null;}},fetchOverride);
  return f;
}
const props=(f,name)=>nodes(f.surface.result,name)[0]?.props;
for(const [choice,target] of [['resume',900],['replay-30',870],['start-over',0]]) test(`actual Orion source-switch sheet: AniEmbed at 900 → AniLink → ${choice}=${target}`,async()=>{
  const time=clock(), f=player();
  try {
    await f.settle(); for(const position of [898,899,900]) {time.tick(1000);await f.emit('playing',position,1440);}
    props(f,'EmbeddedPlayerHud').onSources(); await f.settle();
    props(f,'SourcesSheet').sourceExtras.props.onSelect({...f.anime.selection,providerId:'anilink',variant:'dub'}); await f.settle();
    const prompt=props(f,'ResumePlaybackPrompt'); assert.ok(prompt); assert.equal(prompt.savedTime,900);
    assert.equal(f.props.sourceId,'aniembed','selection alone must not persist success or swap before the existing choice');
    prompt.onChoose(choice); await f.settle(); time.tick(240); await f.settle();
    assert.equal(f.props.sourceId,'anilink'); assert.equal(new URL(f.props.embedUrl).searchParams.get('start'),String(target));
    assert.equal(new URL(f.props.embedUrl).searchParams.get('variant'),'dub');
    const view=props(f,'WebView'); assert.ok(view.source.html); assert.equal(view.source.baseUrl,'https://orion.local/player/');
    const host=aniLinkFrameHost(f.props.embedUrl,view.shieldSessionId,raw=>view.onMessage({nativeEvent:{data:raw}}));
    for(const position of [target,target+2,target+5,target+11,target+17]) {
      time.tick(5000); host.send(event('progress',{position,variant:'dub'})); await f.settle();
    }
    assert.equal(f.props.continuityError,undefined);
    assert.deepEqual(f.library.library.getPlaybackSourcePreference('tv',62715),{sourceId:'anilink',variant:'dub'});
    assert.equal(f.library.library.getPlaybackProgress('tv',62715,1,2),null);
    assert.ok(!f.injections.some(script=>script.includes('ORION_RESUME_RESULT')),'no host seek injection for the public initial-start contract');
    assert.equal(f.props.canAutomaticFailover(null),false);
    assert.equal(f.props.onAutomaticFailover(null),false);
    const writes=[], originalSet=f.library.storage.set;
    f.library.storage.set=(key,value)=>{writes.push(key);originalSet(key,value);};
    for(let i=0;i<12;i++){time.tick(20);host.send(event('progress',{position:target+17+i/100,variant:'dub'}));await f.settle();}
    assert.equal(writes.length,0,'frequent raw progress reuses Orion\'s existing five-second writer throttle');
    time.tick(5000);host.send(event('progress',{position:target+18,variant:'dub'}));await f.settle();
    assert.ok(writes.length>0,'the existing writer still publishes debounced progress');
  } finally {f.dispose();time.restore();}
});
test('terminal error during an incoming resume attempt still permits immediate manual General escape',async()=>{
  const time=clock(),f=player();
  try{
    await f.settle();for(const position of [898,899,900]){time.tick(1000);await f.emit('playing',position,1440);}
    props(f,'EmbeddedPlayerHud').onSources();await f.settle();
    props(f,'SourcesSheet').sourceExtras.props.onSelect({...f.anime.selection,providerId:'anilink'});await f.settle();
    props(f,'ResumePlaybackPrompt').onChoose('resume');await f.settle();time.tick(240);await f.settle();
    const view=props(f,'WebView'),host=aniLinkFrameHost(f.props.embedUrl,view.shieldSessionId,raw=>view.onMessage({nativeEvent:{data:raw}}));
    assert.ok(f.props.activeHandoffId);host.send(event('error',{code:'UNAVAILABLE'}));await f.settle();
    props(f,'EmbeddedPlayerHud').onSources();await f.settle();props(f,'SourcesSheet').onSelect('vidlink');
    await f.settle();time.tick(240);await f.settle();assert.equal(f.props.sourceId,'vidlink');
    assert.match(f.props.embedUrl,/^https:\/\/vidlink.pro\/tv\/62715\/1\/1/);
  }finally{f.dispose();time.restore();}
});
test('AniLink Next Episode relinquishes old owner, retains variant, freshly resolves and resumes only the new episode\'s own progress',async()=>{
  const time=clock(),f=player('anilink',async path=>path.includes('/season/')?{episodes:[1,2].map(episode=>({season_number:1,episode_number:episode,name:`Episode ${episode}`,air_date:'2020-01-01'}))}:{imdb_id:null});
  try{
    await f.settle();f.library.library.recordPlayback({item:{id:62715,title:'Dragon Ball Super'},mediaType:'tv',season:1,episode:2,
      sourceId:'anilink',sourceVariant:'sub',currentTime:70,duration:1440,evidence:'provider-message',sessionId:'new-episode-saved'});
    await f.settle();const view=props(f,'WebView'),host=aniLinkFrameHost(f.props.embedUrl,view.shieldSessionId,raw=>view.onMessage({nativeEvent:{data:raw}}));
    for(const position of [1437,1438]){time.tick(1000);host.send(event('progress',{position}));await f.settle();}
    assert.ok(f.find('NextEpisodePrompt'));const mounts=f.mounted;f.find('NextEpisodePrompt').onPlayNow();await f.settle();
    assert.equal(f.props,undefined);assert.equal(f.mounted,mounts);
    const next=f.navigation[0].params;assert.equal(next.episode,'2');assert.equal(next.nextSourceId,'anilink');assert.equal(next.nextAnimeVariant,'sub');
    f.anime.phase='checking';f.anime.selection=null;f.update(next);await f.settle();assert.equal(f.props,undefined);
    f.anime.phase='anime';f.anime.selection={providerId:'anilink',variant:'sub',identity:{state:'verified',tmdbId:'62715',anilistId:21175,season:1,episode:2}};
    f.update(next);await f.settle();assert.equal(f.find('ResumePlaybackPrompt').savedTime,70);
    f.find('ResumePlaybackPrompt').onChoose('resume');await f.settle();assert.equal(f.mounted,mounts+1);
    assert.equal(new URL(f.props.embedUrl).pathname,'/watch/21175/2');assert.equal(new URL(f.props.embedUrl).searchParams.get('start'),'70');
    const newView=props(f,'WebView');assert.notEqual(newView.shieldSessionId,view.shieldSessionId);
    newView.onMessage({nativeEvent:{data:JSON.stringify(host.messages.at(-1))}});await f.settle();
    assert.equal(f.library.library.getPlaybackProgress('tv',62715,1,2).currentTime,70,'old episode cannot overwrite new progress');
  }finally{f.dispose();time.restore();}
});
test('terminal AniLink error presents Orion failure and immediate manual General escape releases stale readiness',async()=>{
  const time=clock(), f=player();
  try {
    await f.settle(); props(f,'EmbeddedPlayerHud').onSources(); await f.settle();
    props(f,'SourcesSheet').sourceExtras.props.onSelect({...f.anime.selection,providerId:'anilink'});
    await f.settle(); time.tick(240); await f.settle();
    const view=props(f,'WebView'), host=aniLinkFrameHost(f.props.embedUrl,view.shieldSessionId,raw=>view.onMessage({nativeEvent:{data:raw}}));
    host.send(event('error',{code:'UNAVAILABLE'})); await f.settle();
    assert.equal(props(f,'PlayerStateOverlay').state,'failed');
    assert.deepEqual(f.failures.map(row=>row[0]),['anilink']);
    props(f,'EmbeddedPlayerHud').onSources(); await f.settle(); props(f,'SourcesSheet').onSelect('vidlink');
    await f.settle(); time.tick(240); await f.settle(); assert.equal(f.props.sourceId,'vidlink');
    assert.match(f.props.embedUrl,/^https:\/\/vidlink.pro\/tv\/62715\/1\/1/); assert.equal(f.props.sourceError,null);
    time.tick(36000); await f.settle(); assert.equal(f.props.sourceId,'vidlink');
    assert.deepEqual(f.failures.map(row=>row[0]),['anilink'],'old readiness deadline must not poison General');
  } finally {f.dispose();time.restore();}
});
