const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const master = fs.readFileSync(
  path.join(repoRoot, 'docs/plans/WAVEN-V1-MASTER-PLAN.md'),
  'utf8',
);

test('P6 authorization is explicit, bounded, and does not advance completion', () => {
  assert.match(master, /Phase 6 Authorization — `AUTH-P06-2026-09-16`/);
  assert.match(master, /\*\*Decision:\*\* `AUTHORIZED`/);
  assert.match(
    master,
    /Starting ref:[\s\S]*?`385172a2791f04474262fd7ce31682bd34e9b665`/,
  );
  assert.match(
    master,
    /Phase 6 is authorized under `AUTH-P06-2026-09-16` but still earns 0%/,
  );
  assert.match(master, /Current authoritative WAVEN v1 completion: 45%/);
  assert.match(
    master,
    /\| 6 \| Search, discovery, and details \| 7% \|[\s\S]*?AUTHORIZED \/ NOT STARTED under `AUTH-P06-2026-09-16`/,
  );
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(
    master,
    /no WAVEN music namespace writes, no Orion Cloud music synchronization, no Phase 7 Library persistence, no Phase 8 offline state-machine ownership/,
  );
  assert.match(
    master,
    /no Expo\/React Native\/toolchain\/dependency upgrade is authorized/,
  );
});
