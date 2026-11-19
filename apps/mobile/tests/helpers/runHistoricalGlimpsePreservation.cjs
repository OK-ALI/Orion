'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { canonical, sha } = require('../../../../scripts/mobile-development-validation-core.cjs');

const ROOT = path.resolve(__dirname, '../../../..');
const RELEASE_TAG = 'refs/tags/v4.0.0';
const RELEASE_TAG_OBJECT = '39cea2b56825efe15487ec10d7879c49fb51676e';
const RELEASE_COMMIT = '5d5e893f8be951020015aa658dfe1a67d8c0b16d';
const LOCKED_COMMIT = '32ea4f75d8ff64975f44507672ad07db477efaf9';
const GRADLE_SHA256 = '0df69eef3e0aee7ff94596f7a37c25943fb978037b845ec855aa541c38d2b8ba';
const FIXTURE = 'config/fixtures/orion-mobile-4.0.0-historical-release.gradle';
const GENERATED_GRADLE = 'apps/mobile/android/app/build.gradle';
const CHECKER = 'apps/mobile/scripts/check-glimpse-preservation.cjs';
const TEMP_PREFIX = 'orion-glimpse-v4-';

function replayEnvironment(globalConfig) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_NO_REPLACE_OBJECTS: '1',
  };
}

function verifyGradle(file) {
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    throw new Error('Cannot read historical Gradle input: ' + file, { cause: error });
  }
  if (sha(canonical(bytes)) !== GRADLE_SHA256) {
    throw new Error('Historical Gradle fingerprint mismatch: ' + file);
  }
  return bytes;
}

function withHistoricalGlimpseReplay(verify, { autocrlf = false } = {}) {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const disposable = fs.mkdtempSync(path.join(tempRoot, TEMP_PREFIX));
  try {
    const globalConfig = path.join(disposable, 'gitconfig');
    fs.writeFileSync(globalConfig, '', { flag: 'wx' });
    const env = replayEnvironment(globalConfig);
    const run = (command, args, cwd, context) => {
      try {
        return execFileSync(command, args, {
          cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
      } catch (error) {
        const detail = error.stderr?.trim() || error.message;
        throw new Error(context + ': ' + detail, { cause: error });
      }
    };
    const resolveRelease = (ref) => run('git', ['rev-parse', '--verify', ref], ROOT, 'Historical Git input ' + ref);
    if (resolveRelease(RELEASE_TAG) !== RELEASE_TAG_OBJECT ||
        resolveRelease(RELEASE_TAG + '^{commit}') !== RELEASE_COMMIT) {
      throw new Error('Historical Mobile v4.0.0 tag or release commit mismatch');
    }
    resolveRelease(LOCKED_COMMIT + '^{commit}');
    const fixture = verifyGradle(path.join(ROOT, FIXTURE));

    const checkout = path.join(disposable, 'source');
    run('git', ['clone', '--quiet', '--shared', '--no-tags', '--no-checkout', '--template=', '--', ROOT, checkout],
      tempRoot, 'Create isolated historical checkout');
    run('git', ['config', 'core.autocrlf', String(autocrlf)], checkout, 'Configure isolated checkout line endings');
    run('git', ['checkout', '--quiet', '--detach', RELEASE_COMMIT],
      checkout, 'Check out pinned Mobile v4.0.0 source');
    if (run('git', ['rev-parse', 'HEAD'], checkout, 'Isolated checkout identity') !== RELEASE_COMMIT) {
      throw new Error('Isolated historical checkout has the wrong commit');
    }
    const gradle = path.join(checkout, GENERATED_GRADLE);
    fs.mkdirSync(path.dirname(gradle), { recursive: true });
    fs.writeFileSync(gradle, fixture, { flag: 'wx' });

    const checkPreservation = () => {
      verifyGradle(gradle);
      return JSON.parse(run(process.execPath, [CHECKER], checkout, 'Historical Glimpse preservation'));
    };
    return verify({ checkout, gradle, checkPreservation });
  } finally {
    const resolved = fs.realpathSync(disposable);
    if (path.dirname(resolved) !== tempRoot || !path.basename(resolved).startsWith(TEMP_PREFIX)) {
      throw new Error('Historical checkout cleanup path escaped the temporary directory');
    }
    fs.rmSync(resolved, { recursive: true, maxRetries: 3 });
  }
}

module.exports = { withHistoricalGlimpseReplay };
