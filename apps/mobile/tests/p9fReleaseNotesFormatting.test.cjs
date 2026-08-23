const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobileRoot = path.resolve(__dirname, '..');

function readMobile(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('P9-F3 Mobile renders release notes structurally instead of leaking raw Markdown', () => {
  const content = readMobile('src/features/settings/UpdatesSettingsContent.tsx');
  const notes = readMobile('src/features/settings/MobileReleaseNotes.tsx');

  assert.match(content, /import \{ MobileReleaseNotes \} from '\.\/MobileReleaseNotes';/);
  assert.match(content, /<MobileReleaseNotes notes=\{releaseNotes\} \/>/);
  assert.doesNotMatch(content, /numberOfLines=\{6\}/);

  assert.match(notes, /parseMobileReleaseNotesV1/);
  assert.match(notes, /\^\(#\{1,3\}\)\\s\+\(\.\+\)\$/);
  assert.match(notes, /\^\[-\*\+\]\\s\+\(\.\+\)\$/);
  assert.match(notes, /\^\(\\d\+\)\[\.\)\]\\s\+\(\.\+\)\$/);
  assert.match(notes, /block\.kind === 'heading'/);
  assert.match(notes, /block\.kind === 'bullet'/);
  assert.match(notes, /block\.kind === 'numbered'/);
  assert.match(notes, /block\.kind === 'quote'/);
  assert.match(notes, /accessibilityRole="header"/);
});
