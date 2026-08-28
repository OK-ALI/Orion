const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.5 new jobs have one logical Orion Library destination and a separate physical folder', () => {
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const preferences = read('src', 'features', 'downloads', 'downloadPreferences.ts');

  assert.match(preferences, /defaultDestination: 'orion-library'/);
  assert.match(preferences, /input\.defaultDestination === 'device-storage' && deviceStorageTarget/);
  assert.match(preferences, /libraryStorageTarget/);
  assert.match(preferences, /mode: 'user-folder' as const/);

  assert.match(
    modal,
    /const destination: MobileDownloadJobV1\['destination'\] = 'orion-library';/,
  );
  assert.match(
    start,
    /const destination: MobileDownloadJobV1\['destination'\] = 'orion-library';/,
  );

  assert.doesNotMatch(
    modal,
    /const destination:[\s\S]{0,140}preferences\.deviceStorageTarget\s*\?\s*'device-storage'/,
  );
  assert.doesNotMatch(
    start,
    /const destination:[\s\S]{0,140}preferences\.deviceStorageTarget\s*\?\s*'device-storage'/,
  );

  assert.doesNotMatch(modal, /\? 'Device Storage'\s*:\s*'Orion Library'/);
  assert.match(modal, /Storage folder:/);
  assert.match(modal, /preferences\.libraryStorageTarget/);
  assert.match(start, /storageTarget\.mode !== 'user-folder'/);
  assert.match(start, /storageTarget\.persistedPermission/);
});
