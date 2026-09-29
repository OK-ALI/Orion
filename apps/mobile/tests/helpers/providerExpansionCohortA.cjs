'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const workspaceRoot = path.resolve(__dirname, '../../../..');
const sharedSources = 'packages/shared/src/sources/index.ts';
const cohortIds = ['mapple', 'stellar', 'chillflix', 'vidsrc-sh', 'vidapi'];

// Execute the real shared registry and Mobile policy with only platform services mocked.
function createLoader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(workspaceRoot, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requireLocal = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier === '@orion/shared/sources') return load(sharedSources);
      if (specifier === '@orion/shared/cinema-block-rules') {
        return require(path.join(workspaceRoot, 'packages/shared/cinemaBlockRules.cjs'));
      }
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), specifier);
        return load(fs.existsSync(target) ? target : `${target}.ts`);
      }
      throw new Error(`Unexpected provider test import: ${specifier}`);
    };
    new Function('exports', 'require', 'module', js)(module.exports, requireLocal, module);
    return module.exports;
  }
  return load;
}

function readyNativeCandidate(session, kind = 'hls') {
  const candidateId = `${session.playbackSessionId}-${kind}`;
  return {
    schemaVersion: 1, playbackSessionId: session.playbackSessionId, sourceId: session.sourceId,
    providerClass: session.providerClass, candidateId, requestContextId: `ctx-${candidateId}`,
    manifestKind: kind, expiry: 'stable', protection: 'clear', availableQualities: ['best'], capturedAt: 1,
    capabilities: { orionLibrary: true, deviceStorage: true, resumable: true, subtitles: true, audioSelection: true },
    preflight: {
      schemaVersion: 1, candidateId, state: 'ready', reachability: 'reachable', resolvedManifestKind: kind,
      expiry: 'stable', protection: 'clear', requestContextReady: true, descendantCount: 20,
      requiredBytes: null, storageRequirement: 'unknown', orionLibraryFreeBytes: null,
      reasonCode: null, reason: null, checkedAt: 1,
    },
  };
}

module.exports = { createLoader, cohortIds, readyNativeCandidate, workspaceRoot, sharedSources };
