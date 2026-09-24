export function beginDownloadSourceScope(sourceId, previousScope, playing) {
  return {
    attempted: new Set([sourceId]),
    originalSource: previousScope?.originalSource || sourceId,
    manualApproved: false,
    manualConsentResolved: false,
    vidsrcApproved: false,
    vidsrcConsentResolved: false,
    refreshed: false,
    handledSession: null,
    lastFailure: null,
    reload: playing,
  };
}

export function restoreDownloadSource(scope, currentSource) {
  return scope?.originalSource || currentSource;
}

export function shouldPersistPlayerSource(downloadTarget) {
  return !downloadTarget;
}
