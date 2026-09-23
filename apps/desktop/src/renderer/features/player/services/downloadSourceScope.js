export function beginDownloadSourceScope(sourceId, previousScope, playing) {
  return {
    attempted: new Set([sourceId]),
    originalSource: previousScope?.originalSource || sourceId,
    manualApproved: false,
    refreshed: false,
    handledSession: null,
    reload: playing,
  };
}

export function restoreDownloadSource(scope, currentSource) {
  return scope?.originalSource || currentSource;
}

export function shouldPersistPlayerSource(downloadTarget) {
  return !downloadTarget;
}
