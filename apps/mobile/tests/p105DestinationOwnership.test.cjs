const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.5 destination selection is owned by defaultDestination, not a remembered Device Storage folder', () => {
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const preferences = read('src', 'features', 'downloads', 'downloadPreferences.ts');

  assert.match(preferences, /defaultDestination: 'orion-library'/);
  assert.match(preferences, /input\.defaultDestination === 'device-storage' && deviceStorageTarget/);

  assert.match(
    modal,
    /const destination: MobileDownloadJobV1\['destination'\] = preferences\.defaultDestination;/,
  );
  assert.match(
    start,
    /const destination: MobileDownloadJobV1\['destination'\] = preferences\.defaultDestination;/,
  );

  assert.doesNotMatch(
    modal,
    /const destination:[\s\S]{0,140}preferences\.deviceStorageTarget\s*\?\s*'device-storage'/,
  );
  assert.doesNotMatch(
    start,
    /const destination:[\s\S]{0,140}preferences\.deviceStorageTarget\s*\?\s*'device-storage'/,
  );

  assert.match(modal, /\? 'Device Storage'\s*:\s*'Orion Library'/);
  assert.match(modal, /Portable media saved to your persisted Android storage folder\./);
  assert.match(modal, /preferences\.deviceStorageTarget\?\.displayName/);
  assert.match(start, /destination === 'device-storage'/);
  assert.match(start, /storageTarget\.persistedPermission/);
});
