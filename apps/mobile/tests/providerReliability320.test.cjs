const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(mobileRoot, '../..');
const readMobile = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');
const readWorkspace = (...parts) => fs.readFileSync(path.join(workspaceRoot, ...parts), 'utf8');

test('Orion 3.2.0 retires dead Mobile providers while preserving live manual candidates', () => {
  const mobileSources = readMobile('src', 'features', 'playback', 'mobileSources.ts');
  const playerScreen = readMobile('src', 'features', 'playback', 'PlayerScreen.tsx');
  const sheet = readMobile('src', 'components', 'player', 'SourcesSheet.tsx');

  assert.match(mobileSources, /MOBILE_RETIRED_SOURCE_IDS[\s\S]*?'videasy'[\s\S]*?'vsembed'/);
  assert.doesNotMatch(mobileSources, /vidking/);
  assert.match(mobileSources, /source\.releaseStatus !== 'disabled'/);
  assert.match(mobileSources, /source\.availability !== 'temporarily-unavailable'/);
  assert.match(mobileSources, /!MOBILE_QUARANTINED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(mobileSources, /!MOBILE_RETIRED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(mobileSources, /MOBILE_DEFAULT_CINEMA_SOURCE_ID[\s\S]*?source\.id === 'vixsrc'/);
  assert.match(mobileSources, /MOBILE_PLAYER_SOURCES = Object\.freeze\(\[[\s\S]*?source\.id === 'vixsrc'/);
  assert.match(playerScreen, /existingProgress\?\.sourceId \|\| MOBILE_DEFAULT_CINEMA_SOURCE_ID/);
  assert.doesNotMatch(sheet, /videasy: 'Videasy'/);
  assert.doesNotMatch(sheet, /vidking: 'VidKing'/);
  assert.doesNotMatch(sheet, /vsembed: 'VsEmbed'/);
});

test('live replacement providers remain manual-first while VixSrc owns automatic Mobile continuity', () => {
  const candidates = readWorkspace('packages', 'shared', 'src', 'sources', 'adapters', 'candidates.ts');
  const experimental = readWorkspace('packages', 'shared', 'src', 'sources', 'adapters', 'experimental.ts');
  const capabilities = readMobile('src', 'features', 'playback', 'mobileSources.ts');

  assert.match(candidates, /id: "vidlink"[\s\S]{0,900}supportsDownloads: true/);
  assert.doesNotMatch(capabilities, /MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_IDS/);
  assert.doesNotMatch(capabilities, /getNextMobileDownloadSource/);
  for (const id of ['vidnest', 'vidsrc-ir', 'cinesrc']) {
    assert.match(candidates, new RegExp(`id: \"${id}\"[\\s\\S]{0,900}routingMode: \"manual-only\"`));
  }
  assert.match(experimental, /id: \"111movies\"[\s\S]{0,900}routingMode: \"manual-only\"/);
  const vixStart = capabilities.indexOf('vixsrc: Object.freeze');
  const vix = capabilities.slice(vixStart, vixStart + 600);
  assert.match(vix, /automaticTarget: true/);
  for (const id of ['vidlink', "'111movies'", 'vidnest', "'vidsrc-ir'", 'cinesrc']) {
    const sourceStart = capabilities.indexOf(`${id}: Object.freeze`);
    assert.ok(sourceStart >= 0, `${id} capability is registered`);
    assert.match(capabilities.slice(sourceStart, sourceStart + 600), /automaticTarget: false/);
  }
  const cineStart = capabilities.indexOf('cinesrc: Object.freeze');
  const cine = capabilities.slice(cineStart, cineStart + 800);
  assert.match(cine, /mode: 'seamless'/);
  assert.match(cine, /description: 'Smooth resume'/);
});

test('episode transitions keep one orientation owner and every route exit unlocks first', () => {
  const screen = readMobile('src', 'features', 'playback', 'PlayerScreen.tsx');
  const orientation = readMobile('src', 'features', 'playback', 'usePlayerOrientation.ts');
  const types = readMobile('src', 'features', 'playback', 'playerTypes.ts');

  assert.match(screen, /router\.replace\(\{[\s\S]{0,900}nextSourceId: sourceId/);
  assert.match(screen, /await releaseOrientation\(\);[\s\S]{0,80}router\.back\(\)/);
  assert.match(screen, /onExit: exitPlayer/);
  assert.match(types, /onExit\(\): void/);
  assert.match(orientation, /let orientationQueue: Promise<void> = Promise\.resolve\(\)/);
  assert.match(orientation, /orientationQueue\.catch\(\(\) => \{\}\)\.then\(command\)/);
  assert.match(orientation, /ScreenOrientation\.unlockAsync\(\)/);
  assert.doesNotMatch(screen, /getOrientationLockAsync/);
});