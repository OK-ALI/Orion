'use strict';
const c = require('./mobile-development-validation-core.cjs');
const REGISTRY = 'config/orion-mobile-generated-gradle-profiles-v1.json';
const FILE = 'apps/mobile/android/app/build.gradle';
// Review candidate binding only. This file and its registry are not installed or approved.
const CANDIDATE_ID = 'mobile-4.0.0-infrastructure-a-d';
const CANDIDATE_SHA256 = 'ee25b27790552a5b9d25e27b6dff1d7c874921ef1bf07ddbddaf9b73476d3815';
const HISTORICAL_PROFILE = Object.freeze({id: 'mobile-4.0.0-historical-production', purpose: 'historical-production', mobileVersion: '4.0.0', androidVersionCode: 60, normalizedSha256: c.HISTORICAL, fixtureRecovered: false, verification: 'apps/mobile/scripts/mobile-release-integrations.cjs'});
function validateDevelopmentGradle({workspaceRoot, authorityRoot = workspaceRoot, expectedRegistrySha256, profileId, purpose, reviewOnly = false, file = FILE}) {
  c.need(reviewOnly || c.path.resolve(workspaceRoot) === c.path.resolve(authorityRoot), 'External authority root requires review-only mode');
  c.need(purpose === 'development-validation', 'This validator cannot qualify production');
  c.need(file === FILE, 'Unreviewed generated file');
  c.baseline(workspaceRoot);
  const registry = c.pinnedJson(authorityRoot, REGISTRY, expectedRegistrySha256);
  c.keys(registry, ['schemaVersion', 'historicalProduction', 'developmentProfiles']);
  c.need(registry.schemaVersion === 1, 'Unknown registry schema');
  c.need(JSON.stringify(registry.historicalProduction) === JSON.stringify(HISTORICAL_PROFILE), 'Historical production profile is immutable');
  c.need(Array.isArray(registry.developmentProfiles), 'Invalid profile list');
  const ids = registry.developmentProfiles.map(p => p.id);
  c.need(new Set(ids).size === ids.length, 'Duplicate profile ID');
  const profile = registry.developmentProfiles.find(p => p.id === profileId);
  c.need(profile, 'Unknown explicit profile');
  c.need(profile.id === CANDIDATE_ID && profile.fixtureSha256 === CANDIDATE_SHA256, 'Unreviewed development fixture binding');
  c.keys(profile, ['id','purpose','approval','identity','fixture','fixtureSha256','inputs','inputsSha256']);
  c.need(profile.purpose === purpose, 'Profile purpose mismatch');
  c.need(profile.approval === 'owner-approved' || (reviewOnly && profile.approval === 'owner-review-pending'), 'Profile is not trusted');
  const identity = {mobileVersion:'4.0.0',androidVersionCode:60,androidPackage:'com.okali.orion',runtimeVersion:'orion-mobile-native-r2',expectedSignerSha256:c.SIGNER,artifactName:'orion-mobile-v4.0.0.apk',preservationCommit:c.BASE};
  c.need(JSON.stringify(profile.identity) === JSON.stringify(identity), 'Unreviewed version, package, runtime, signing or artifact identity');
  const fixture = c.fs.readFileSync(c.safe(authorityRoot, profile.fixture));
  c.need(c.sha(fixture) === profile.fixtureSha256, 'Reviewed fixture changed');
  c.need(c.fs.readFileSync(c.safe(workspaceRoot, file)).equals(fixture), 'Generated Gradle bytes differ from fixture');
  const manifest = c.pinnedJson(authorityRoot, profile.inputs, profile.inputsSha256);
  c.keys(manifest, ['schemaVersion','sourceBaseline','generation','node','files','absent','directories']);
  c.need(manifest.schemaVersion === 1 && manifest.sourceBaseline === c.BASE, 'Unreviewed generation authority');
  c.need(manifest.node.version === process.version && manifest.node.executableSha256 === c.sha(c.fs.readFileSync(process.execPath)), 'Unreviewed Node generation tool');
  c.need(Array.isArray(manifest.files) && manifest.files.length > 0 && Array.isArray(manifest.absent), 'Invalid input inventory');
  const paths = manifest.files.map(e => e.path);
  c.need(new Set([...paths, ...manifest.absent]).size === paths.length + manifest.absent.length, 'Duplicate or contradictory generation input');
  c.need(JSON.stringify(manifest.directories) === JSON.stringify(['apps/mobile/plugins','apps/mobile/scripts','apps/mobile/assets']), 'Unknown generator inventory boundaries');
  function inventory(relative) {
    const directory = c.safe(workspaceRoot,relative);
    return c.fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
      const name=relative+'/'+entry.name;
      c.need(!entry.isSymbolicLink(),'Unreviewed generator link');
      return entry.isDirectory()?inventory(name):[name];
    });
  }
  for(const directory of manifest.directories) c.need(JSON.stringify(inventory(directory).sort()) === JSON.stringify(paths.filter(p=>p.startsWith(directory+'/')).sort()),'Unreviewed generator directory input: '+directory);
  for (const entry of manifest.files) {
    c.keys(entry, ['path','sha256']);
    c.need(/^[a-f0-9]{64}$/.test(entry.sha256), 'Invalid input digest');
    c.need(c.sha(c.fs.readFileSync(c.safe(workspaceRoot, entry.path))) === entry.sha256, 'Unreviewed generation input: ' + entry.path);
  }
  for (const relative of manifest.absent) c.need(!c.fs.existsSync(c.safe(workspaceRoot, relative)), 'Unexpected generation input: ' + relative);
  const pkg = JSON.parse(c.fs.readFileSync(c.safe(workspaceRoot,'apps/mobile/package.json')));
  const app = JSON.parse(c.fs.readFileSync(c.safe(workspaceRoot,'apps/mobile/app.json'))).expo;
  c.need(pkg.version === '4.0.0' && app.version === '4.0.0' && app.android.versionCode === 60 && app.android.package === 'com.okali.orion' && app.runtimeVersion === identity.runtimeVersion, 'Actual application identity differs');
  return {status:'PASS',mode:reviewOnly?'REVIEW ONLY':'DEVELOPMENT VALIDATION',profileId,purpose,productionQualified:false,profileTrusted:!reviewOnly && profile.approval === 'owner-approved',inputsVerified:paths.length,fixtureSha256:c.sha(fixture)};
}
module.exports = {validateDevelopmentGradle, HISTORICAL_PROFILE, REGISTRY};
