const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) =>
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const search = readApp('app/search.tsx');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

test('P5.5B keeps the pre-Phase-6 Search shell truthful', () => {
  assert.doesNotMatch(search, />SEARCHING \{scope\.toUpperCase\(\)\}</);
  assert.match(search, />YOUR SEARCH · \{scope\.toUpperCase\(\)\}</);
  assert.match(search, /<Text numberOfLines=\{2\} style=\{styles\.queryText\}>“\{query\}”<\/Text>/);
});

test('P5.5B gives Clear Search a real minimum touch target', () => {
  assert.match(search, /accessibilityLabel="Clear search"[\s\S]*?accessibilityRole="button"/);
  assert.doesNotMatch(search, /accessibilityLabel="Clear search"[\s\S]*?hitSlop=\{8\}/);
  assert.match(
    search,
    /clearButton:\s*\{[\s\S]*?height:\s*wavenLayout\.minimumTouchTarget[\s\S]*?width:\s*wavenLayout\.minimumTouchTarget/,
  );
});

test('P5.5B reconciles the authoritative Phase 5 publication record', () => {
  assert.match(master, /P5\.2 `1dab4ec40e1e93f4d411fcb9ab809b1c78599c3c`/);
  assert.match(master, /P5\.3 `3f3cf303375acd11f65169efe839d9247a040b4d`/);
  assert.match(master, /P5\.4 `353301c45acd30aed9f25533724e16ccdb5245a8`/);
  assert.match(master, /P5\.5A `0d949a8aad1863f3dd8bfbc5e0d132f526714079`/);
  assert.match(master, /native Google identity\/sign-in has been physically accepted/i);
  assert.match(master, /P5\.5B closure audit\/reconciliation remains before Completion ACK/);
  assert.match(master, /Overall completion remains \*\*38%\*\*/);
  assert.match(master, /Phase 6 remains \*\*NOT AUTHORIZED\*\*/);
});

test('P5.5B records the accepted black-surface blue-accent design rule', () => {
  assert.match(
    design,
    /primary\/selected interaction fills WAVEN black and uses blue selectively for edges, icons, arrows, waveform\/progress, focus, and identity/,
  );
  assert.match(
    design,
    /Selected filters use a WAVEN-black active surface with a restrained WAVEN-blue edge\/accent/,
  );
  assert.match(design, /P5\.5A product-language, transition, and interaction-material lock/);
  assert.match(design, /must not label that inert shell state as actively “SEARCHING”/);
});
