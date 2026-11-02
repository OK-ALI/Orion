const test=require('node:test'),assert=require('node:assert/strict');
const c=require('../mobile-development-validation-core.cjs');
const {validateDevelopmentGradle:validate,REGISTRY}=require('../check-mobile-development-gradle.cjs');
const {fixture}=require('./development-validation-fixtures.cjs');
test('exact pending candidate can be inspected only as a nonqualifying review',t=>{const f=fixture(t);const result=validate(f.registryOptions());assert.equal(result.status,'PASS');assert.equal(result.productionQualified,false);assert.equal(result.profileTrusted,false);});
const cases={
 'unknown explicit profile':(f,o)=>o.profileId='unknown',
 'production purpose':(f,o)=>o.purpose='production-release',
 'historical profile through development path':(f,o)=>o.profileId='mobile-4.0.0-historical-production',
 'no approval outside review':(f,o)=>o.reviewOnly=false,
 'no external digest':(f,o)=>delete o.expectedRegistrySha256,
 'wrong authority digest':(f,o)=>o.expectedRegistrySha256='0'.repeat(64),
 'wrong generated path':(f,o)=>o.file='apps/desktop/build.gradle',
 'one-byte generated edit':f=>f.write('apps/mobile/android/app/build.gradle','changed'),
 'different line-ending bytes':f=>f.write('apps/mobile/android/app/build.gradle',c.fs.readFileSync(c.path.join(f.root,'config/fixtures/review.gradle'),'utf8').replace(/\n/g,'\r\n')),
 'changed credential reference':f=>f.write('apps/mobile/android/app/build.gradle',c.fs.readFileSync(c.path.join(f.root,'config/fixtures/review.gradle'),'utf8').replace('ORION_ANDROID_RELEASE_KEY_PASSWORD','OTHER_KEY')),
 'changed release signing':f=>f.write('apps/mobile/android/app/build.gradle',c.fs.readFileSync(c.path.join(f.root,'config/fixtures/review.gradle'),'utf8').replace('signingConfigs.release','signingConfigs.debug')),
 'changed reviewed fixture':f=>f.write('config/fixtures/review.gradle','changed'),
 'changed generator input':f=>f.write('generator.js','unreviewed'),
 'unexpected dotenv input':f=>f.write('.env','not a credential'),
 'unreviewed added plugin input':f=>f.write('apps/mobile/plugins/unreviewed.js','unreviewed'),
 'unreviewed added generation script':f=>f.write('apps/mobile/scripts/unreviewed.cjs','unreviewed'),
 'changed input manifest':f=>f.write('config/fixtures/inputs.json','{}'),
 'immutable historical fingerprint':(f,o)=>{f.registry.historicalProduction.normalizedSha256='0'.repeat(64);f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'wrong version in rehashed registry':(f,o)=>{f.registry.developmentProfiles[0].identity.mobileVersion='4.1.0';f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'wrong signer in rehashed registry':(f,o)=>{f.registry.developmentProfiles[0].identity.expectedSignerSha256='0'.repeat(64);f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'wrong package in rehashed registry':(f,o)=>{f.registry.developmentProfiles[0].identity.androidPackage='other';f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'wrong runtime in rehashed registry':(f,o)=>{f.registry.developmentProfiles[0].identity.runtimeVersion='other';f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'wrong artifact in rehashed registry':(f,o)=>{f.registry.developmentProfiles[0].identity.artifactName='other.apk';f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'wrong versionCode in rehashed registry':(f,o)=>{f.registry.developmentProfiles[0].identity.androidVersionCode=61;f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'actual package version mismatch':f=>f.write('apps/mobile/package.json','{"version":"4.1.0"}'),
 'unknown registry fields':(f,o)=>{f.registry.fallback=true;f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;},
 'duplicate profiles':(f,o)=>{f.registry.developmentProfiles.push(f.registry.developmentProfiles[0]);f.json(REGISTRY,f.registry);o.expectedRegistrySha256=f.registryOptions().expectedRegistrySha256;}
};
for(const [name,mutate] of Object.entries(cases))test('rejects '+name,t=>{const f=fixture(t),options=f.registryOptions();mutate(f,options);assert.throws(()=>validate(options));});
test('unsafe input path fails even in a freshly hashed candidate manifest',t=>{const f=fixture(t);f.manifest.files[0].path='../escape';f.json('config/fixtures/inputs.json',f.manifest);f.registry.developmentProfiles[0].inputsSha256=c.sha(c.fs.readFileSync(c.path.join(f.root,'config/fixtures/inputs.json')));f.json(REGISTRY,f.registry);assert.throws(()=>validate(f.registryOptions()),/Unsafe/);});
for(const [name,from,to] of [['signing','signingConfig signingConfigs.release','signingConfig signingConfigs.debug'],['credentials','ORION_ANDROID_RELEASE_KEY_PASSWORD','OTHER_KEY'],['version','versionCode 60','versionCode 61']])test('rejects repinned altered '+name+' fixture',t=>{const f=fixture(t);const altered=c.fs.readFileSync(c.path.join(f.root,'config/fixtures/review.gradle'),'utf8').replace(from,to);f.write('config/fixtures/review.gradle',altered);f.write('apps/mobile/android/app/build.gradle',altered);f.registry.developmentProfiles[0].fixtureSha256=c.sha(Buffer.from(altered));f.json(REGISTRY,f.registry);assert.throws(()=>validate(f.registryOptions()),/fixture binding/);});
