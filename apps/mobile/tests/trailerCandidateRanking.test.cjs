const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { normalizeTrailerCandidates: normalize } = loader()('apps/mobile/src/features/trailers/trailerCandidateService.ts');
const video = (key, type, official, extra = {}) => ({ site: 'YouTube', key, type, official, name: type, iso_639_1: 'en', ...extra });
test('official Trailer, other Trailer, official Teaser and other Teaser precede promotional material', () => {
  const list = normalize([
    video('promotional', 'Clip', true), video('otherteaser', 'Teaser', false),
    video('officialtea', 'Teaser', true), video('othertrailr', 'Trailer', false),
    video('officialtrl', 'Trailer', true), video('reactionvid', 'Trailer', true, { name: 'Fan reaction' }),
  ], []);
  assert.deepEqual(list.map(x => x.providerKey), ['officialtrl', 'othertrailr', 'officialtea', 'otherteaser', 'promotional', 'reactionvid']);
});
test('preferred, original and English relevance is preserved within a tier without discarding other languages', () => {
  const list = normalize(['es','ja','en','fr'].map((lang,i) => video(`language00${i}`, 'Trailer', true, { iso_639_1: lang })), [], 'es', 'ja');
  assert.deepEqual(list.map(x => x.language), ['es','ja','en','fr']);
});
test('malformed/empty YouTube IDs and unsupported sites are excluded; valid keys deduplicate across seasons', () => {
  const list = normalize([null, {}, video('bad', 'Trailer', true), video('invalid!000', 'Trailer', true),
    video({ private: true }, 'Trailer', true), video('officialtrl', 'Trailer', true, { site: 'Dailymotion' }),
    video('officialtrl', 'Trailer', true, { site: ' youtube ' })], [video('officialtrl','Trailer',true)]);
  assert.deepEqual(list.map(x=>x.id), ['youtube:officialtrl']);
});
test('teaser-only titles remain playable and existing Vimeo support is retained', () => {
  const list = normalize([video('otherteaser','Teaser',false), { site:'Vimeo', key:'76979871',type:'Teaser',official:true,name:'Official Teaser' }], []);
  assert.equal(list.length, 2); assert.equal(list[0].site, 'Vimeo');
});
test('within-tier quality/year/name ordering remains deterministic independent of input order', () => {
  const videos = [video('officialtrl','Trailer',true,{ name:'A', published_at:'2025-01-01',size:1080 }),
    video('othertrailr','Trailer',true,{ name:'B',published_at:'2015-01-01',size:720 })];
  assert.deepEqual(normalize(videos,[]), normalize([...videos].reverse(),[]));
});
