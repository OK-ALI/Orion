const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { aniLinkFrameHost, event } = require('./helpers/aniLinkFrameHarness.cjs');
const load = loader(), bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const url = 'https://anilink.cc/watch/21175/1?variant=sub&autonext=false';
const context = {sessionId:'current',sourceId:'anilink',expectedOrigins:['https://anilink.cc'],lastSequence:0};
test('documented selected-frame events feed the existing bridge sequence and bounded Anime readiness', () => {
  const host = aniLinkFrameHost(url), ready = load('apps/mobile/src/features/playback/animeReadiness.ts');
  let state = ready.createAnimeReadiness('current',Date.now());
  for (const [name,position] of [['ready',0],['play',1200],['progress',1201]]) {
    host.send(event(name,{position})); const parsed = bridge.parseEmbeddedTelemetryMessage(host.messages.at(-1),context);
    assert.ok(parsed); assert.equal(parsed.input.evidence,'provider-message');
    state = ready.observeAnimeReadiness(state,'current',parsed.input,Date.now());
    assert.equal(state.status,name==='progress'?'ready':name==='play'?'waiting':'opening');
  }
  host.send(event('pause')); host.send(event('progress')); assert.equal(host.messages.at(-1).state,'paused');
  host.send(event('ended')); assert.equal(host.messages.at(-1).state,'ended');
  assert.deepEqual(host.messages.map(m=>m.sequence),[1,2,3,4,5,6]);
});
test('wrong/lookalike/wrapper origins, unrelated frames, duplicates and mutated routes are rejected', () => {
  const host = aniLinkFrameHost(url);
  for (const origin of ['https://www.anilink.cc','http://anilink.cc','https://anilink.cc.evil','https://orion.local','null']) host.send(event(),origin);
  host.send(event(),'https://anilink.cc',{}); host.duplicates(2); host.send(event()); host.duplicates(1);
  host.frame.src='https://anilink.cc/watch/21175/2?variant=sub'; host.send(event());
  host.frame.src=url+'&start=100'; host.send(event()); assert.equal(host.messages.length,0);
});
test('malformed payloads, unsupported events, wrong content and old episode samples cannot write progress', () => {
  const host=aniLinkFrameHost(url);
  for (const data of [null,[],JSON.stringify(event()),{type:'PLAYER_EVENT',data:{currentTime:1200}},
    {type:'anilink-player:progress',payload:[]},event('fullscreenchange'),event('markerschange'),event('serverschange'),event('skip'),event('autonext'),
    event('progress',{anilistId:1}),event('progress',{episodeNumber:2}),event('progress',{variant:'dub'}),event('progress',{variant:'raw'}),
    event('progress',{position:'1200'}),event('progress',{position:-1}),event('progress',{duration:0}),event('progress',{duration:Infinity}),
    event('progress',{position:1500}),event('progress',{anilistId:undefined}),event('error',{code:''})]) host.send(data);
  assert.deepEqual(host.messages,[]);
});
test('terminal errors and in-player episode/variant drift use the existing failure state without provider strings', () => {
  for (const data of [event('error',{code:'NO_SOURCE',message:'PRIVATE',url:'PRIVATE'}),
    event('episodechange',{episodeNumber:2}),event('variantchange',{variant:'dub'})]) {
    const host=aniLinkFrameHost(url); host.send(data); assert.equal(host.messages[0].state,'error');
    assert.doesNotMatch(JSON.stringify(host.messages),/PRIVATE|NO_SOURCE|"url"|"message"/);
    host.send(event()); assert.equal(host.messages.length,1,'terminal failure cannot be revived by later progress');
  }
  const host=aniLinkFrameHost(url); host.send({type:'anilink-player:error',payload:{code:'NO_SOURCE'}});
  assert.equal(host.messages[0].state,'error','public errors may omit identity; selected exact frame/route still binds them');
});
test('frame replacement, stopped callbacks, stale sessions and replayed envelope sequences are fenced', () => {
  const host=aniLinkFrameHost(url); host.send(event()); const old=host.replaceFrame();
  host.send(event(),'https://anilink.cc',old.contentWindow); host.send(event()); assert.equal(host.messages.length,1);
  const callback=[...host.listeners][0]; host.window.__orionPlaybackTelemetry.stop();
  callback({data:event(),origin:'https://anilink.cc',source:host.frame.contentWindow}); assert.equal(host.messages.length,1);
  host.inject('next'); host.send(event()); assert.equal(host.messages.at(-1).sessionId,'next'); assert.equal(host.listeners.size,1);
  assert.equal(bridge.parseEmbeddedTelemetryMessage(host.messages.at(-1),context),null);
  assert.equal(bridge.parseEmbeddedTelemetryMessage(host.messages[0],{...context,lastSequence:1}),null);
  assert.equal(bridge.parseEmbeddedTelemetryMessage({...host.messages[0],observedAt:Date.now()-16000},context),null);
});
test('fresh AniLink playback settles the existing source/session-bound resume handoff at its target', () => {
  const handoff=load('apps/mobile/src/features/playback/handoffPolicy.ts');
  let transfer=handoff.createPlaybackHandoff({reason:'manual',fromSessionId:'old',fromSourceId:'aniembed',targetSourceId:'anilink',requestedTime:1200,strategy:'url-param',now:1000});
  transfer=handoff.confirmPlaybackHandoff(transfer,{sourceId:'anilink',sessionId:'new',state:'playing',currentTime:1200,observedAt:2000},2000);
  assert.equal(transfer.status,'seeking');
  assert.equal(handoff.confirmPlaybackHandoff(transfer,{sourceId:'anilink',sessionId:'new',state:'playing',currentTime:1202,observedAt:3000},3000).status,'confirmed');
});
