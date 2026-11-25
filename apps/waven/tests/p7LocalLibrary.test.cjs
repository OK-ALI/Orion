const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (record, filename) => record._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { LocalLibraryRepository: Repo, libraryScope, libraryStorageKey: key, libraryEntityKey: identity, LIBRARY_LIMITS } = require('../src/features/library/localLibrary.ts');
const { PlaybackHistoryObserver: Observer } = require('../src/features/library/playbackHistory.ts');
const fixture = require('./fixtures/p7-library-v1.json');
const track = (id = 'one', provider = 'catalog') => ({ id: `display-${id}`, title: 'Same title', artistName: 'Same artist', source: { provider, id } });
const album = { id: 'album', title: 'Same title', source: { provider: 'catalog', id: 'one' } };
const artist = { id: 'artist', name: 'Same artist', source: { provider: 'catalog', id: 'one' } };
function storage() { const map = new Map(); return { map, get: k => map.get(k) ?? null, set: (k, v) => map.set(k, v), remove: k => map.delete(k) }; }
function setup(scope = 'local') { const s = storage(); let now = 100; const repo = new Repo(s, () => now++, scope); return { s, repo }; }
const recovery = (ids = ['a', 'b']) => ({ version: 1, queue: ids.map(id => ({ queueId: id, track: track(id), streamingProvider: { provider: 'catalog', id } })), currentIndex: 0, positionMs: 0, repeatMode: 'off', shuffleEnabled: false, wasPlayWhenReady: true, savedAtMs: 1 });
const snapshot = (id = 'a', overrides = {}) => ({ state: 'playing', queueIds: ['a', 'b'], currentQueueId: id, playing: true, buffering: false, error: null, ...overrides });

test('new schema initializes empty without seeding or claiming user data', () => {
  const { s, repo } = setup(); const state = repo.getSnapshot().state;
  assert.equal(state.version, 2); assert.equal(state.scope, 'local'); assert.deepEqual(state.favorites, []);
  assert.deepEqual(state.playlists, []); assert.deepEqual(state.history, []); assert.equal(s.map.size, 0);
});
test('real v1 fixture migrates into v2, retains playlist order and preserves exact original', () => {
  const s = storage(), raw = JSON.stringify(fixture); s.set(key(fixture.scope), raw);
  const repo = new Repo(s, () => 100, fixture.scope), state = repo.getSnapshot().state;
  assert.equal(state.version, 2); assert.equal(state.favorites.length, 1);
  assert.equal(state.playlists[0].title, 'Migration Fixture Playlist');
  assert.deepEqual(state.playlists[0].tracks.map(t => t.source.id), ['two', 'one']);
  assert.ok([...s.map.entries()].some(([k,v]) => k.includes('.recovery.') && v === raw));
  assert.deepEqual(new Repo(s, () => 101, fixture.scope).getSnapshot().state, state);
});
test('favorite add/remove is durable and repeated requests are idempotent', () => {
  const { s, repo } = setup(); repo.setFavorite('track', track(), true);
  const revision = repo.getSnapshot().state.revision; repo.setFavorite('track', track(), true);
  assert.equal(repo.getSnapshot().state.revision, revision);
  assert.equal(new Repo(s).getSnapshot().state.favorites.length, 1);
  repo.setFavorite('track', track(), false); repo.setFavorite('track', track(), false);
  assert.equal(new Repo(s).getSnapshot().state.favorites.length, 0);
});
test('favorite identity separates providers and entity kinds despite identical display names', () => {
  const { repo } = setup(); repo.setFavorite('track', track(), true); repo.setFavorite('track', track('one', 'other'), true);
  repo.setFavorite('album', album, true); repo.setFavorite('artist', artist, true);
  assert.equal(repo.getSnapshot().state.favorites.length, 4);
  assert.equal(new Set(repo.getSnapshot().state.favorites.map(f => f.key)).size, 4);
});
test('favorite ordering is deterministic and persisted timestamps survive restart', () => {
  const { s, repo } = setup(); repo.setFavorite('track', track('one'), true); repo.setFavorite('track', track('two'), true);
  assert.deepEqual(new Repo(s).getSnapshot().state.favorites.map(f => f.entity.source.id), ['two', 'one']);
});
test('playlist create/rename/delete use stable identities and survive restart', () => {
  const { s, repo } = setup(); const id = repo.createPlaylist(' First '); repo.renamePlaylist(id, 'Renamed');
  let restarted = new Repo(s); assert.equal(restarted.getSnapshot().state.playlists[0].id, id);
  assert.equal(restarted.getSnapshot().state.playlists[0].title, 'Renamed');
  restarted.deletePlaylist(id); assert.equal(new Repo(s).getSnapshot().state.playlists.length, 0);
  assert.throws(() => repo.createPlaylist('   '), /name/);
});
test('playlist IDs stay distinct when titles and clocks are identical across repository restarts', () => {
  const s = storage(), a = new Repo(s, () => 1); const first = a.createPlaylist('Same');
  const b = new Repo(s, () => 1); assert.notEqual(b.createPlaylist('Same'), first);
});
test('playlist add/remove dedupes canonical identity and does not merge providers', () => {
  const { s, repo } = setup(), id = repo.createPlaylist('Songs');
  repo.addTrack(id, track()); repo.addTrack(id, track()); repo.addTrack(id, track('one', 'other'));
  assert.equal(repo.getSnapshot().state.playlists[0].tracks.length, 2);
  repo.removeTrack(id, identity('track', track()));
  assert.equal(new Repo(s).getSnapshot().state.playlists[0].tracks[0].source.provider, 'other');
});
test('playlist reorder preserves exact order across serialization and subsequent removal', () => {
  const { s, repo } = setup(), id = repo.createPlaylist('Ordered');
  ['one','two','three'].forEach(x => repo.addTrack(id, track(x)));
  repo.moveTrack(id, identity('track', track('three')), -1); repo.moveTrack(id, identity('track', track('one')), -1);
  let restarted = new Repo(s); assert.deepEqual(restarted.getSnapshot().state.playlists[0].tracks.map(t => t.source.id), ['one','three','two']);
  restarted.removeTrack(id, identity('track', track('three')));
  assert.deepEqual(new Repo(s).getSnapshot().state.playlists[0].tracks.map(t => t.source.id), ['one','two']);
});
test('malformed state recovers the last verified state while retaining the corrupt original', () => {
  const { s, repo } = setup(); repo.setFavorite('track', track(), true); repo.createPlaylist('Second write');
  s.set(key('local'), '{broken'); const restored = new Repo(s);
  assert.equal(restored.getSnapshot().status, 'recovered'); assert.equal(restored.getSnapshot().state.favorites.length, 1);
  assert.ok([...s.map.entries()].some(([k,v]) => k.includes('.recovery.') && v === '{broken'));
});
test('malformed individual records are quarantined, valid identities and ordering remain usable', () => {
  const { s, repo } = setup(); repo.setFavorite('track', track(), true);
  const state = JSON.parse(s.get(key('local'))); state.favorites.push({kind:'track',entity:{title:'missing identity'}});
  state.playlists = [{id:'p',title:'Test',tracks:[track('two'), {}, track('two'), track('one')]}];
  const raw = JSON.stringify(state); s.set(key('local'), raw); const migrated = new Repo(s);
  assert.equal(migrated.getSnapshot().state.favorites.length, 1);
  assert.deepEqual(migrated.getSnapshot().state.playlists[0].tracks.map(t => t.source.id), ['two','one']);
  assert.ok([...s.map.values()].includes(raw));
});
test('future schemas are preserved read-only and cannot be overwritten by a mutation', () => {
  const s = storage(), raw = JSON.stringify({version:99,scope:'local',data:'future'}); s.set(key('local'),raw);
  const repo = new Repo(s); assert.equal(repo.getSnapshot().status,'blocked');
  assert.throws(() => repo.createPlaylist('overwrite'), /newer/); assert.equal(s.get(key('local')), raw);
});
test('failed recovery backup leaves the original untouched and exposes unavailable state', () => {
  const s = storage(); s.set(key('local'), '{broken'); s.set = () => { throw Error('disk full'); };
  const repo = new Repo(s); assert.equal(repo.getSnapshot().status, 'unavailable'); assert.equal(s.get(key('local')), '{broken');
});

test('repeated corruption has a bounded recovery archive and never evicts originals or overwrites when full', () => {
  const s = storage(), main = key('local');
  for (let n = 0; n < 4; n++) {
    s.set(main, `{broken-${n}`); assert.equal(new Repo(s).getSnapshot().status, 'recovered');
  }
  const originals = [...s.map.entries()].filter(([k]) => k.includes('.recovery.'));
  assert.equal(originals.length, 4);
  s.set(main, '{broken-4'); const blocked = new Repo(s);
  assert.equal(blocked.getSnapshot().status, 'blocked');
  assert.equal(s.get(main), '{broken-4');
  assert.deepEqual([...s.map.entries()].filter(([k]) => k.includes('.recovery.')), originals);
  assert.throws(() => blocked.createPlaylist('overwrite'), /recovery space/);
  s.set(main, '{broken-0'); assert.equal(new Repo(s).getSnapshot().status, 'recovered');
  assert.equal([...s.map.keys()].filter(k => k.includes('.recovery.')).length, 4);
});

test('oversized corruption blocks before backup or destructive normalization', () => {
  const s = storage(), raw = '{' + 'x'.repeat(8 * 1024 * 1024);
  s.set(key('local'), raw); const repo = new Repo(s);
  assert.equal(repo.getSnapshot().status, 'blocked'); assert.equal(s.get(key('local')), raw);
  assert.equal(s.map.size, 1);
});
test('unconfirmed writes never publish false success and preserve previous durable data', () => {
  const { s, repo } = setup(); repo.setFavorite('track', track('one'), true);
  const before = repo.getSnapshot(), set = s.set; s.set = (k,v) => { if (k !== key('local')) set(k,v); };
  assert.throws(() => repo.setFavorite('track', track('two'), true), /confirm/);
  assert.equal(repo.getSnapshot(), before); assert.equal(new Repo(s).getSnapshot().state.favorites.length, 1);
});
test('snapshot is immutable and subscribers only observe confirmed changes', () => {
  const { repo } = setup(); let changes = 0; const off = repo.subscribe(() => changes++);
  repo.setFavorite('track', track(), true); repo.setFavorite('track', track(), true); off(); repo.createPlaylist('No notification');
  assert.equal(changes, 1); assert.throws(() => repo.getSnapshot().state.favorites.push({}), TypeError);
});
test('canonical Google account IDs isolate local, A and B without email/display-name identities', () => {
  const { s, repo } = setup(); repo.setFavorite('track', track('local'), true);
  const a = libraryScope('id/a'), b = libraryScope('id:b'); assert.notEqual(a,b); assert.equal(libraryScope(null),'local');
  repo.switchScope(a); assert.equal(repo.getSnapshot().state.favorites.length,0); repo.createPlaylist('A');
  repo.switchScope(b); assert.equal(repo.getSnapshot().state.playlists.length,0); repo.setFavorite('track', track('b'),true);
  repo.switchScope(a); assert.equal(repo.getSnapshot().state.playlists[0].title,'A');
  assert.equal(new Repo(s,Date.now,b).getSnapshot().state.favorites[0].entity.source.id,'b');
  repo.switchScope('local'); assert.equal(repo.getSnapshot().state.favorites[0].entity.source.id,'local');
});
test('a record in the wrong account namespace is backed up and never hydrated into another account', () => {
  const s = storage(); s.set(key('google:b'), JSON.stringify(fixture)); const repo = new Repo(s,Date.now,'google:b');
  assert.equal(repo.getSnapshot().state.favorites.length,0); assert.ok([...s.map.values()].includes(JSON.stringify(fixture)));
});
test('metadata serialization strips sources, authorization, signed artwork and unknown runtime properties', () => {
  const { s, repo } = setup(); const t = {...track(), artworkUrl:'https://img.test/art?signature=secret', providerTrackId:'https://audio.test/ephemeral',
    resolvedSource:{uri:'https://audio.test/ephemeral',headers:{Authorization:'secret'}},uri:'https://audio.test/ephemeral',headers:{secret:'private'}};
  repo.setFavorite('track',t,true); repo.addTrack(repo.createPlaylist('Safe'),t); repo.recordPlayed(t,'local');
  const raw = JSON.stringify([...s.map.values()]); assert.doesNotMatch(raw,/ephemeral|Authorization|private|signature|resolvedSource|secret/);
  assert.throws(() => repo.setFavorite('track',{...track(),source:{provider:'catalog',id:'https://audio.test/lease'}},true), /identity/);
});
test('history rejects taps/ready/buffering/paused/failed/never-started native events', async () => {
  const { repo } = setup(); repo.claimQueue(snapshot().queueIds); let reads = 0; const observer = new Observer(repo,async()=>{reads++;return recovery();});
  for (const state of ['idle','ready','buffering','paused','ended','error']) await observer.observe(snapshot('a',{state,playing:false}));
  await observer.observe(snapshot('a',{error:{code:'network'}})); await observer.observe(snapshot('a',{buffering:true}));
  assert.equal(reads,0); assert.equal(repo.getSnapshot().state.history.length,0);
});
test('actual native playing maps queue intent to canonical track, dedupes progress/resume and survives restart', async () => {
  const { s, repo } = setup(); repo.claimQueue(snapshot().queueIds); const observer = new Observer(repo,async()=>recovery());
  await observer.observe(snapshot()); await observer.observe(snapshot()); await observer.observe(snapshot('a',{state:'paused',playing:false})); await observer.observe(snapshot());
  assert.equal(repo.getSnapshot().state.history[0].playCount,1);
  const restarted = new Repo(s), reattached = new Observer(restarted,async()=>recovery()); await reattached.observe(snapshot());
  assert.equal(restarted.getSnapshot().state.history[0].playCount,1);
  await reattached.observe(snapshot('b')); await reattached.observe(snapshot('a'));
  assert.deepEqual(restarted.getSnapshot().state.history.map(h=>h.track.source.id),['a','b']); assert.equal(restarted.getSnapshot().state.history[0].playCount,2);
});
test('history caps retention, keeps most recent canonical entries and persists the preference', () => {
  const { s, repo } = setup(); repo.claimQueue(snapshot().queueIds); for (let i=0;i<LIBRARY_LIMITS.history+3;i++) repo.recordPlayed(track(String(i)),'local');
  assert.equal(repo.getSnapshot().state.history.length,LIBRARY_LIMITS.history); assert.equal(repo.getSnapshot().state.history[0].track.source.id,'202');
  repo.setHistoryEnabled(false); repo.recordPlayed(track('disabled'),'local');
  assert.equal(new Repo(s).getSnapshot().state.preferences.historyEnabled,false); assert.equal(repo.getSnapshot().state.history[0].track.source.id,'202');
  repo.clearHistory(); assert.equal(new Repo(s).getSnapshot().state.history.length,0);
});
test('concurrent progress callbacks reserve a history occurrence before asynchronous intent lookup', async () => {
  const { repo } = setup(); repo.claimQueue(snapshot().queueIds); let resolve, reads=0; const pending = new Promise(r=>resolve=r);
  const observer = new Observer(repo,()=>{reads++;return pending;}); const first = observer.observe(snapshot()); await observer.observe(snapshot());
  resolve(recovery()); await first; assert.equal(reads,1); assert.equal(repo.getSnapshot().state.history[0].playCount,1);
});
test('account switch during intent lookup prevents old playback leaking into the new account', async () => {
  const { repo } = setup(); repo.claimQueue(snapshot().queueIds); let resolve; const pending = new Promise(r=>resolve=r);
  const observer = new Observer(repo,()=>pending); const first = observer.observe(snapshot());
  repo.switchScope('google:b'); observer.accountChanged(); resolve(recovery()); await first;
  await observer.observe(snapshot()); assert.equal(repo.getSnapshot().state.history.length,0);
});
test('native queue ownership survives process restart and account rebinding', async () => {
  const { s, repo } = setup('google:a'); repo.claimQueue(snapshot().queueIds); const observer = new Observer(repo,async()=>recovery()); await observer.observe(snapshot());
  const b = new Repo(s,Date.now,'google:b'), listener = new Observer(b,async()=>recovery()); await listener.observe(snapshot());
  assert.equal(b.getSnapshot().state.history.length,0);
  await listener.observe(snapshot('c',{queueIds:['c']})); // No matching native intent: no fabricated history.
  assert.equal(b.getSnapshot().state.history.length,0);
});
test('an unowned legacy native queue is never silently attributed to the current account',async()=>{
  const {s,repo}=setup('google:b'), observer=new Observer(repo,async()=>recovery());
  await observer.observe(snapshot());assert.equal(repo.getSnapshot().state.history.length,0);assert.equal(s.map.size,0);
  repo.switchScope('google:a');repo.claimQueue(snapshot().queueIds);
  repo.switchScope('google:b');observer.accountChanged();await observer.observe(snapshot());
  assert.equal(repo.getSnapshot().state.history.length,0);assert.equal(repo.queueOwner(snapshot().queueIds),'google:a');
});
test('missing or mismatched native intent never uses presentation labels as identity', async () => {
  const { repo } = setup(); repo.claimQueue(snapshot().queueIds); const observer = new Observer(repo,async()=>recovery(['other']));
  await observer.observe(snapshot('a',{currentItem:{title:'Misleading',artistName:'Name'}})); assert.equal(repo.getSnapshot().state.history.length,0);
});
test('disposed observer and stale track lookup cannot write a later track occurrence', async () => {
  const { repo } = setup(); repo.claimQueue(snapshot().queueIds); let resolve; const observer = new Observer(repo,()=>new Promise(r=>resolve=r));
  const pending = observer.observe(snapshot()); observer.dispose(); resolve(recovery()); await pending; assert.equal(repo.getSnapshot().state.history.length,0);
});
test('native recovery, shared entities and existing provider verifier retain sole ownership', () => {
  const owner = fs.readFileSync(path.join(__dirname,'../src/features/library/libraryRuntime.ts'),'utf8');
  const history = fs.readFileSync(path.join(__dirname,'../src/features/library/playbackHistory.ts'),'utf8');
  const library = fs.readFileSync(path.join(__dirname,'../src/features/library/localLibrary.ts'),'utf8');
  assert.match(owner,/createMMKV/); assert.match(owner,/subscribeNativePlayback/); assert.match(owner,/getPersistedPlaybackRecoveryState/);
  assert.doesNotMatch(owner+history+library,/fetch\(|Cloud.*(?:write|sync)|new (?:Audio|Player)|expo-audio|resolvedSource\s*:/);
});
test('same-clock history changes retain exact recency order through restart',()=>{
  const s=storage(), repo=new Repo(s,()=>1);repo.recordPlayed(track('z'),'local');repo.recordPlayed(track('a'),'local');repo.recordPlayed(track('z'),'local');
  assert.deepEqual(new Repo(s).getSnapshot().state.history.map(h=>h.track.source.id),['z','a']);
});
test('large libraries hydrate deterministically and playlist/favorite limits reject new mutations',()=>{
  const s=storage(), rows=Array.from({length:LIBRARY_LIMITS.favorites},(_,i)=>({kind:'track',entity:track(String(i)),addedAt:i}));
  s.set(key('local'),JSON.stringify({version:2,scope:'local',favorites:rows,playlists:[],history:[]}));
  const repo=new Repo(s);assert.equal(repo.getSnapshot().state.favorites.length,5000);assert.throws(()=>repo.setFavorite('track',track('overflow'),true),/limit/);
  assert.equal(new Repo(s).getSnapshot().state.favorites[0].entity.source.id,'4999');
});
test('UTF-8 storage budget counts non-ASCII metadata and prevents oversized writes',()=>{
  const {libraryUtf8Bytes,LIBRARY_BYTE_BUDGET}=require('../src/features/library/localLibrary.ts');
  assert.equal(libraryUtf8Bytes('aé中🎵'),Buffer.byteLength('aé中🎵'));assert.equal(LIBRARY_BYTE_BUDGET,2*1024*1024);
  const {repo}=setup();const state=JSON.parse(JSON.stringify(repo.getSnapshot().state));
  state.favorites=Array.from({length:3000},(_,i)=>({key:String(i),kind:'track',entity:{...track(String(i)),title:'中'.repeat(600)},addedAt:1}));
  const s=storage();s.set(key('local'),JSON.stringify(state));const large=new Repo(s);
  assert.throws(()=>large.createPlaylist('Over budget'),/2 MiB/);
});
test('uninstall/reinstall storage absence starts empty rather than inventing restoration or Cloud data',()=>{
  const {repo}=setup();repo.setFavorite('track',track(),true);const fresh=new Repo(storage());assert.equal(fresh.getSnapshot().state.favorites.length,0);assert.equal(fresh.getSnapshot().state.scope,'local');
});
