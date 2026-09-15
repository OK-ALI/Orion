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

test('P5.5B records the authoritative Phase 5 Completion ACK', () => {
  assert.match(master, /P5\.2 `1dab4ec40e1e93f4d411fcb9ab809b1c78599c3c`/);
  assert.match(master, /P5\.3 `3f3cf303375acd11f65169efe839d9247a040b4d`/);
  assert.match(master, /P5\.4 `353301c45acd30aed9f25533724e16ccdb5245a8`/);
  assert.match(master, /P5\.5A `0d949a8aad1863f3dd8bfbc5e0d132f526714079`/);
  assert.match(master, /P5\.5B `68d55a57456ace75cd87ab6fdf702aec246409b5`/);
  assert.match(master, /Phase 5 Completion ACK — `ACK-P05-2026-09-16`/);
  assert.match(master, /\*\*Decision:\*\* `ACCEPTED`/);
  assert.match(master, /Current authoritative WAVEN v1 completion: 45%/);
  assert.match(master, /This ACK does \*\*not\*\* authorize Phase 6/);
  assert.doesNotMatch(master, /P5\.5B closure audit\/reconciliation remains before Completion ACK/);
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
  assert.match(design, /Phase 5 completion lock — 2026-09-16/);
  assert.match(design, /ACK-P05-2026-09-16/);
  assert.match(design, /68d55a57456ace75cd87ab6fdf702aec246409b5/);
});
