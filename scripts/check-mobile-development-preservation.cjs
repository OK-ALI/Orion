'use strict';
const c = require('./mobile-development-validation-core.cjs');
const CONTRACT = 'config/orion-mobile-v4.1-development-preservation-v1.json';
function validateDevelopmentPreservation({workspaceRoot, authorityRoot = workspaceRoot, expectedContractSha256, reviewOnly = false}) {
  c.need(reviewOnly || c.path.resolve(workspaceRoot) === c.path.resolve(authorityRoot), 'External authority root requires review-only mode');
  c.baseline(workspaceRoot);
  const contract = c.pinnedJson(authorityRoot, CONTRACT, expectedContractSha256);
  c.keys(contract, ['schemaVersion','purpose','approval','baselineCommit','developmentBranch','authorityFile','changes','historicalRefs','protectedRefs']);
  c.need(contract.schemaVersion === 1 && contract.purpose === 'development-preservation' && contract.baselineCommit === c.BASE && contract.authorityFile === CONTRACT, 'Unreviewed preservation authority');
  c.need(contract.approval === 'owner-approved' || (reviewOnly && contract.approval === 'owner-review-pending'), 'Preservation contract is not approved');
  c.need(contract.developmentBranch === 'codex/orion-mobile-v4.1.0' && c.git(workspaceRoot,['branch','--show-current']) === contract.developmentBranch, 'Wrong development branch');
  const entries = contract.changes;
  c.need(Array.isArray(entries) && entries.length > 0, 'Empty change contract');
  const allowed = new Map();
  for (const entry of entries) {
    c.keys(entry, ['path','kind','beforeBlob','afterCanonicalSha256','approval']);
    c.safe(workspaceRoot, entry.path);
    c.need(entry.path !== CONTRACT && !allowed.has(entry.path), 'Self-authorization or duplicate path');
    c.need(['modify','add'].includes(entry.kind) && /^[a-f0-9]{64}$/.test(entry.afterCanonicalSha256), 'Invalid exact change record');
    c.need(entry.approval === 'already-owner-approved' || (reviewOnly && entry.approval === 'proposed-this-review'), 'Change lacks approval');
    const found = c.git(workspaceRoot, ['ls-tree', c.BASE, '--', entry.path]);
    const before = found ? found.split(/\s+/)[2] : null;
    c.need(before === entry.beforeBlob && (entry.kind === 'add') === (before === null), 'Change does not bind official baseline');
    const contentRoot = reviewOnly && entry.approval === 'proposed-this-review' ? authorityRoot : workspaceRoot;
    c.need(c.sha(c.canonical(c.fs.readFileSync(c.safe(contentRoot,entry.path)))) === entry.afterCanonicalSha256, 'Approved change content differs: ' + entry.path);
    allowed.set(entry.path, entry);
  }
  const changed = c.git(workspaceRoot, ['diff','--name-only',c.BASE,'--']).split('\n').filter(Boolean);
  const additions = c.git(workspaceRoot, ['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);
  for (const file of [...changed,...additions]) {
    if (file === CONTRACT) {
      c.need(c.sha(c.fs.readFileSync(c.safe(workspaceRoot,file))) === expectedContractSha256, 'Contract file changed');
    } else c.need(allowed.has(file), 'Unauthorized repository modification: ' + file);
  }
  const refs = c.git(workspaceRoot,['for-each-ref','refs/tags','--format=%(refname) %(objectname)']).split('\n').filter(Boolean);
  c.need(JSON.stringify(refs) === JSON.stringify(contract.historicalRefs), 'Historical release tags or metadata changed');
  c.need(Array.isArray(contract.protectedRefs) && new Set(contract.protectedRefs.map(r=>r.ref)).size === contract.protectedRefs.length, 'Invalid protected references');
  for (const record of contract.protectedRefs) {
    c.keys(record,['ref','object']);
    c.need(/^refs\/(heads|remotes\/origin)\//.test(record.ref) && record.ref !== 'refs/heads/codex/orion-mobile-v4.1.0' && record.ref !== 'refs/remotes/origin/codex/orion-mobile-v4.1.0' && /^[a-f0-9]{40}$/.test(record.object), 'Invalid protected reference');
    c.need(c.git(workspaceRoot,['rev-parse','--verify',record.ref]) === record.object, 'Protected branch moved: ' + record.ref);
  }
  return {status:'PASS',mode:reviewOnly?'REVIEW ONLY':'DEVELOPMENT PRESERVATION',baselineCommit:c.BASE,exactChanges:entries.length,trackedFilesCovered:Number(c.git(workspaceRoot,['ls-tree','-r','--name-only',c.BASE]).split('\n').length),productionQualified:false,historicalGlimpseCheckReplaced:false};
}
module.exports = {validateDevelopmentPreservation, CONTRACT};
