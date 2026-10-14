'use strict';
// Internal physical qualification only. No release identity or production source mutation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { checkPreservation } = require('./check-glimpse-preservation.cjs');
const signing = require('./build-android-release.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const MOBILE = path.join(ROOT, 'apps/mobile');
const ANDROID = path.join(MOBILE, 'android');
const OUT = path.join(ROOT, 'test-results/glimpse-physical');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: MOBILE, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error('Physical build step failed: ' + command + ' (exit ' + result.status + ')');
}
function main() {
  if (!process.argv.includes('--internal-physical-test')) throw new Error('Explicit --internal-physical-test required');
  console.log(JSON.stringify(checkPreservation()));
  const config = JSON.parse(fs.readFileSync(path.join(MOBILE, 'app.json'), 'utf8')).expo;
  if (config.android.package !== 'com.okali.orion' || config.version !== '3.2.1' || config.android.versionCode !== 59) {
    throw new Error('STOP: physical build requires unchanged package/versionName/versionCode');
  }
  const gate = path.join(MOBILE, 'src/features/glimpse/glimpseBuild.ts');
  const gateHash = hash(gate);
  if (!fs.readFileSync(gate, 'utf8').includes('export const GLIMPSE_INTERNAL_PREVIEW = false;')) throw new Error('Production gate is not closed');
  fs.mkdirSync(OUT, { recursive: true });
  // A distinct Metro cache and transformer override apply only to this internal build command.
  const configPath = path.join(OUT, 'metro.internal.cjs');
  const transformerPath = path.join(OUT, 'transformer.internal.cjs');
  const metro = require(path.join(MOBILE, 'metro.config.js'));
  const upstream = metro.transformer.babelTransformerPath;
  if (!upstream) throw new Error('Cannot locate existing Metro transformer');
  fs.writeFileSync(transformerPath,
    "const upstream=require(" + JSON.stringify(upstream) + ");\n"
    + "const {internalPreviewTransform}=require(" + JSON.stringify(path.join(__dirname, 'glimpse-internal-transform.cjs')) + ");\n"
    + "module.exports={...upstream,transform(args){return upstream.transform(internalPreviewTransform(args,"
    + JSON.stringify(gate) + ",process.env.ORION_GLIMPSE_INTERNAL_PREVIEW_BUILD==='1'))}};\n");
  fs.writeFileSync(configPath,
    "const fs=require('node:fs');const config=require(" + JSON.stringify(path.join(MOBILE, 'metro.config.js')) + ");\n"
    + "config.watchFolders=[...new Set([...config.watchFolders,fs.realpathSync(" + JSON.stringify(path.join(ROOT, 'node_modules')) + "),fs.realpathSync("
    + JSON.stringify(path.join(MOBILE, 'node_modules')) + ")," + JSON.stringify(fs.realpathSync(path.join(ROOT, 'node_modules/@orion/shared'))) + "])];\n"
    + "const sharedApiOrigin=" + JSON.stringify(path.join(ROOT, 'packages/shared/src/api/index.ts')) + ";const upstreamResolve=config.resolver.resolveRequest;config.resolver.resolveRequest=(context,name,platform)=>name==='@orion/shared/api'?{type:'sourceFile',filePath:sharedApiOrigin}:upstreamResolve?upstreamResolve(context,name,platform):context.resolveRequest(context,name,platform);\n"
    + "config.transformer.babelTransformerPath=" + JSON.stringify(transformerPath) + ";config.cacheVersion='orion-glimpse-internal-physical-v1';module.exports=config;\n");
  const env = { ...process.env, NODE_ENV: 'production', EXPO_OVERRIDE_METRO_CONFIG: configPath,
    ORION_GLIMPSE_INTERNAL_PREVIEW_BUILD: '1', EXPO_PUBLIC_GLIMPSE_PREVIEW: 'false' };
  // Unlock the existing DPAPI-protected authority in memory. Never print/write credential values.
  signing.loadStoredReleaseCredentials();
  env.ORION_ANDROID_RELEASE_STORE_PASSWORD = process.env.ORION_ANDROID_RELEASE_STORE_PASSWORD;
  env.ORION_ANDROID_RELEASE_KEY_PASSWORD = process.env.ORION_ANDROID_RELEASE_KEY_PASSWORD;
  if (!env.ORION_ANDROID_RELEASE_STORE_PASSWORD || !env.ORION_ANDROID_RELEASE_KEY_PASSWORD) throw new Error('Permanent signing credentials unavailable');
  run(process.execPath, [path.join(__dirname, 'build-android-standalone.cjs'), '--prepare-only'], { env });
  const gradle = path.join(ANDROID, 'app/build.gradle');
  const gradleSource = fs.readFileSync(gradle, 'utf8');
  const patched = signing.patchReleaseGradleText(gradleSource);
  if (patched !== gradleSource) fs.writeFileSync(gradle, patched);
  const shortRoot = path.join(process.env.USERPROFILE, '.orion', 'g-' + process.pid);
  if (fs.existsSync(shortRoot)) throw new Error('Internal build junction already exists');
  fs.symlinkSync(ROOT, shortRoot, 'junction');
  try {
    run('gradlew.bat', ['assembleRelease', '--no-daemon', '--no-parallel', '--console=plain',
      '-PreactNativeArchitectures=arm64-v8a', '-Porion.useEmbeddedReleaseBundle=true'],
      { cwd: path.join(shortRoot, 'apps/mobile/android'), shell: true, env });
  } finally { fs.unlinkSync(shortRoot); }
  const generated = path.join(ANDROID, 'app/build/outputs/apk/release/app-release.apk');
  signing.verifySigning(generated);
  if (hash(gate) !== gateHash) throw new Error('Production gate source changed');
  checkPreservation();
  const apk = path.join(OUT, 'orion-mobile-glimpse-internal-physical-test.apk');
  fs.copyFileSync(generated, apk);
  const manifest = {
    purpose: 'INTERNAL PHYSICAL TEST ONLY - not published',
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirtySource: true, preservationAuthority: '32ea4f75d8ff64975f44507672ad07db477efaf9',
    package: config.android.package, versionName: config.version, versionCode: config.android.versionCode,
    apkPath: apk, apkSha256: hash(apk), signerSha256: signing.expectedCertificateSha256.toLowerCase(),
    runtime: 'production Hermes bundle and non-debuggable signed native release build type',
    preview: 'build-scoped single-file Metro transform; production source constant remains false',
    sourceFiles: [...['src/features/feedback', 'src/features/releaseNotes', 'modules/orion-feedback'].flatMap(directory => fs.readdirSync(path.join(MOBILE, directory), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile() && !entry.parentPath.includes(path.sep + 'build')).map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, '/'))),
      "apps/mobile/app.json",
      "apps/mobile/metro.config.js",
      "packages/shared/src/api/animeLookup.ts","apps/mobile/src/features/playback/animeIdentityRequest.ts","apps/mobile/src/features/playback/useAnimeSource.ts","apps/mobile/src/features/playback/AnimeSourceChoices.tsx","apps/mobile/src/features/playback/PlayerScreen.tsx",
      "apps/mobile/src/features/playback/animeReadiness.ts",
      "apps/mobile/src/features/playback/useAnimeReadiness.ts",
      "apps/mobile/src/features/playback/EmbedPlayerSurface.tsx",
      "apps/mobile/src/features/library/sourceAffinity.ts",
      "apps/mobile/src/features/playback/animeMediaShape.ts","apps/mobile/src/features/playback/mobileSources.ts",
      "apps/mobile/src/features/playback/animePublicEvidence.ts","apps/mobile/src/features/playback/animeEpisodeProof.ts","apps/mobile/src/features/playback/animeCanonicalRepair.ts",
      'apps/mobile/src/features/settings/UpdatesSettingsContent.tsx', 'apps/mobile/src/services/mobileDiagnostics.ts', 'apps/mobile/src/features/playback/animeIdentityDiagnostics.ts', 'apps/mobile/app/feedback.tsx', 'apps/mobile/app/feedback-retry-test.tsx', ...fs.readdirSync(path.join(MOBILE, 'modules/orion-release-welcome'), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile() && !entry.parentPath.includes(path.sep + 'build')).map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, '/')),
      ...fs.readdirSync(path.join(MOBILE, 'src/features/releaseWelcome')).map(file => 'apps/mobile/src/features/releaseWelcome/' + file),
      'apps/mobile/app/_layout.tsx', 'apps/mobile/app/release-welcome-test.tsx', 'apps/mobile/app/release-notes-test.tsx', ...fs.readdirSync(path.join(MOBILE, 'modules/orion-glimpse-ambient'), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile() && !entry.parentPath.includes(path.sep + 'build')).map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, '/')), ...fs.readdirSync(path.join(MOBILE, 'src/features/glimpse')).map(file => 'apps/mobile/src/features/glimpse/' + file),
      'apps/mobile/app/(tabs)/glimpse.tsx', 'apps/mobile/app/(tabs)/_layout.tsx', 'apps/mobile/src/components/SidebarDrawer.tsx',
      'apps/mobile/src/features/library/LibrarySortDialog.tsx', 'apps/mobile/src/features/settings/settingsArchitecture.ts',
      'apps/mobile/src/features/settings/SettingsSectionNavigator.tsx', 'apps/mobile/app/(tabs)/settings.tsx',
      'apps/mobile/scripts/build-glimpse-physical.cjs', 'apps/mobile/scripts/glimpse-internal-transform.cjs']
      .map(file => ({ file, sha256: hash(path.join(ROOT, file)) })),
  };
  fs.writeFileSync(path.join(OUT, 'artifact.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
