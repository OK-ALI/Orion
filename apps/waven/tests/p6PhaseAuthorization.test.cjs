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

test('P6 accepted closure records its physical handoff while the later P7 ACK earns its fixed weight', () => {
  assert.match(master, /Phase 6 Authorization — `AUTH-P06-2026-09-16`/);
  assert.match(master, /\*\*Decision:\*\* `AUTHORIZED`/);
  assert.match(
    master,
    /Starting ref:[\s\S]*?`385172a2791f04474262fd7ce31682bd34e9b665`/,
  );
  assert.match(
    master,
    /Phase 6's search-to-play exit was implemented and physically validated under the owner's conditional closure authorization/,
  );
  assert.match(master, /Current authoritative WAVEN v1 completion: 68%/);
  assert.match(
    master,
    /\| 6 \| Search, discovery, and details \| 7% \|[^\n]*physically validated[^\n]*ACK-P06-2026-10-01[^\n]*ACCEPTED[^\n]*\| 7% \|/,
  );
  assert.match(master, /P6\.4D Completion ACK — 2026-09-18/);
  assert.match(master, /8`-item discovery-group cap is \*\*not\*\* accepted as a final product ceiling/);
  assert.match(master, /Phase 7 Authorization — `AUTH-P07-2026-10-01`/);
  assert.match(master, /\| 7 \|[^\n]*COMPLETE[^\n]*ACK-P07-2026-10-02[^\n]*ACCEPTED[^\n]*\| 8% \|/);
  assert.match(master, /AUTH-P08-2026-10-02/);
  assert.match(master, /Phase 9 and every later phase remain unauthorized/);
  assert.match(master, /\| 8 \| Offline awareness and connectivity resilience \| 8% \|[^\n]*ACCEPTED WITH DOCUMENTED RESIDUALS[^\n]*ACK-P08-2026-10-19[^\n]*\| 8% \|/);
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

test('P8 owner acceptance requires a prior explicit exception and keeps observed failures separate from acceptance', () => {
  const ack = fs.readFileSync(path.join(repoRoot, 'docs/audits/WAVEN-PHASE-8-COMPLETION-ACK-2026-10-19.md'), 'utf8');
  const exception = fs.readFileSync(path.join(repoRoot, 'docs/audits/WAVEN-PHASE-8-OWNER-EXCEPTION-2026-10-19.md'), 'utf8');
  assert.match(master, /15\.5 Phase 8 owner-authorized development closeout exception/);
  assert.match(ack, /\*\*Normalized ACK status:\*\* `ACCEPTED`/);
  assert.match(ack, /EXC-P08-2026-10-19/);
  assert.match(exception, /for this Phase 8 development milestone only/);
  assert.match(exception, /not PASS/);
  assert.match(exception, /Release obligations remain outstanding/);
  // Repository tests use durable governance documents, not ignored local ZIP data.
  // The closeout verifier separately checks the complete machine evidence matrix.
  assert.match(ack, /Observed performance failures remain \*\*KNOWN ACCEPTED RISKS\*\*/);
  assert.match(ack, /Missing\/incomplete current-candidate physical fixtures remain \*\*UNTESTED \/ OWNER EXCEPTION\*\*/);
  const rows = master.split('\n').filter(line => /^\| \d+ \|/.test(line)).map(line => line.split('|').map(cell => cell.trim()));
  const phases = rows.filter(cells => Number(cells[1]) <= 12);
  assert.equal(phases.length, 13);
  assert.equal(phases.reduce((sum, cells) => sum + Number.parseInt(cells[3]), 0), 100);
  assert.equal(phases.reduce((sum, cells) => sum + Number.parseInt(cells.at(-2)), 0), 68);
});
