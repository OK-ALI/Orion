const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const load = loader({ '../../services/sourceHealth': { getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null } });
const registry = load('packages/shared/src/sources/registry.ts');
const mobile = load('apps/mobile/src/features/playback/mobileSources.ts');
const resume = load('apps/mobile/src/features/playback/resumeChoice.ts');
const handoff = load('apps/mobile/src/features/playback/handoffPolicy.ts');
test('AniEmbed uses the existing unverified continuity capability, including outgoing saved progress', () => {
  const capability = mobile.getMobileSourceContinuityCapability('aniembed');
  assert.equal(capability.mode, 'resume-unverified'); assert.equal(capability.label, 'Resume May Vary');
  assert.equal(capability.canTrackProgress, true); assert.equal(capability.canTransferOut, true);
  assert.equal(capability.canReceivePosition, true); assert.equal(capability.automaticTarget, false);
  assert.equal(registry.getRegisteredSource('aniembed').resumeParam, 't');
  assert.equal(registry.getRegisteredSource('aniembed').supportsDownloads, false);
});
for (const variant of ['sub', 'dub']) for (const [choice, expected] of [['resume', 240], ['replay-30', 210], ['start-over', 0]]) {
  test(`existing ${choice} action constructs AniEmbed ${variant} at ${expected}s without separate controls`, () => {
    const time = resume.resolveResumeChoiceTime(choice, 240);
    const url = new URL(registry.getSourceUrl('aniembed', 'tv', { anilistId: 21175 }, 1, 1,
      { lang: variant, ...registry.getSourceResumeParams('aniembed', time, 'tv') }));
    assert.equal(time, expected); assert.equal(url.searchParams.get('t'), '0');
    assert.equal(registry.sourceResumeStrategy('aniembed'), 'verified-seek'); assert.equal(url.searchParams.get('lang'), variant);
  });
}
test('incoming AniEmbed handoff requires the same source/time/observation proof as General providers', () => {
  const transfer = handoff.createPlaybackHandoff({ reason: 'manual', fromSessionId: 'old', fromSourceId: 'vixsrc',
    targetSourceId: 'aniembed', requestedTime: 240, strategy: 'url-param', now: 1000 });
  const snapshot = { sourceId: 'aniembed', currentTime: 241, observedAt: 2000 };
  const reached = handoff.confirmPlaybackHandoff(transfer, { ...snapshot, sessionId: 'target', state: 'seeking' }, 2000);
  assert.equal(reached.status, 'seeking');
  assert.equal(handoff.confirmPlaybackHandoff(reached, { ...snapshot, sessionId: 'target', state: 'playing', currentTime: 243, observedAt: 3000 }, 3000).status, 'confirmed');
  for (const patch of [{ sourceId: 'vixsrc' }, { observedAt: 999 }, { currentTime: 1 }]) {
    assert.equal(handoff.confirmPlaybackHandoff(transfer, { ...snapshot, ...patch }, 2000), null);
  }
  assert.equal(handoff.handoffTargetMissedPosition(transfer, { ...snapshot, currentTime: 1 }, 6000), true);
});
test('General ordering/Auto/default/download choices remain unchanged and dedicated providers stay scoped', () => {
  assert.deepEqual(mobile.MOBILE_PLAYER_SOURCES.map(s => s.id), ['vixsrc', 'vidsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc', '111movies']);
  assert.equal(mobile.MOBILE_DEFAULT_CINEMA_SOURCE_ID, 'vixsrc');
  assert.equal(mobile.getPreferredMobileResumeSource('aniembed', 'tv'), 'aniembed');
  assert.equal(mobile.mobileSourceSupportsContinuity('aniembed'), false);
  assert.ok(!mobile.getMobileDownloadSourceChoices('tv').some(s => s.id === 'aniembed'));
  assert.ok(!registry.AUTOMATIC_PLAYER_SOURCES.some(s => s.id === 'aniembed'));
  assert.equal(mobile.getMobileSourceContinuityCapability('vixsrc').mode, 'seamless');
  assert.equal(mobile.getMobileSourceContinuityCapability('vidsrc').mode, 'outgoing-only');
});
test('Anime uses one provider card, both source groups, real header identity and existing capability language', () => {
  const card = read('apps/mobile/src/features/playback/AnimeSourceChoices.tsx');
  const sheet = read('apps/mobile/src/components/player/SourcesSheet.tsx');
  const screen = read('apps/mobile/src/features/playback/PlayerScreen.tsx');
  for (const copy of ['Anime source testing', 'Experimental playback test', 'Test AniEmbed', 'physically qualified']) assert.ok(!card.includes(copy));
  assert.match(card, /getMobileSourceContinuityCapability/); assert.match(card, /capability.description/);
  assert.match(card, /accessibilityState=\{\{ selected: active, disabled: busy \}\}/);
  assert.match(sheet, /props.animeAvailable && <SourceGroup title="Anime Sources"/);
  assert.match(sheet, /title="General Sources" expanded=\{!props.animeAvailable \|\| generalExpanded\}/);
  assert.match(sheet, /props.currentSourceLabel \|\| DISPLAY_NAMES/);
  assert.match(sheet, /currentSourceId === 'aniembed'/); assert.match(sheet, /currentSourceId !== 'aniembed'/);
  assert.match(screen, /getSourceResumeParams\(sourceId, resumeTime, type\), lang: activeAnimeTest.variant/);
  assert.match(screen, /nextAnimeVariant: sourceId === 'aniembed' \? activeAnimeTest\?\.variant/);
  assert.match(screen, /if \(reason === 'automatic' && sourceId === 'aniembed'\) return false/);
  assert.match(screen, /getPlaybackProgress\([\s\S]*resolvedSeason,[\s\S]*resolvedEpisode/);
  assert.match(screen, /ResumePlaybackPrompt/); assert.match(screen, /resolveResumeChoiceTime\(choice, initialSavedTime\)/);
  assert.doesNotMatch(card, /ResumePlaybackPrompt|currentTime|Start Over Only|Seamless Resume/);
});
test('P102 remains diagnostic-only after playback qualification and cannot become a download authority', () => {
  const surface = read('apps/mobile/src/features/playback/EmbedPlayerSurface.tsx');
  assert.match(surface, /animeDiagnosticOnly = source\?\.animeProvider != null && source.supportsDownloads !== true/);
  assert.match(surface, /diagnosticOnly: animeDiagnosticOnly/);
  assert.match(surface, /downloadAllowed=\{source\?\.supportsDownloads === true\}/);
});
test('all new source UI colors come from Orion tokens and share the existing detail panel', () => {
  for (const file of ['AnimeSourceChoices.tsx']) {
    const text = read('apps/mobile/src/features/playback/' + file);
    assert.doesNotMatch(text, /#[0-9a-f]{3,8}|rgba?\(|color:\s*['"]/i);
    assert.match(text, /theme.accent/); assert.match(text, /theme.text/); assert.match(text, /theme.border/);
  }
  const sheet = read('apps/mobile/src/components/player/SourcesSheet.tsx');
  assert.equal((sheet.match(/>Resume & progress</g) || []).length, 1);
});
