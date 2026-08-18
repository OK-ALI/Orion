const fs = require("fs");

function removeFile(filePath) {
  if (!filePath) return { deleted: 0, errors: 0 };
  try {
    if (!fs.existsSync(filePath)) return { deleted: 0, errors: 0 };
    fs.unlinkSync(filePath);
    return { deleted: 1, errors: 0 };
  } catch {
    return { deleted: 0, errors: 1 };
  }
}

function cleanupDownloadTask(
  entry,
  { activeProcs, killProcessTree, cleanupTempFiles, deleteMedia = true } = {},
) {
  if (!entry) return { deleted: 0, errors: 0 };

  const proc = activeProcs?.get(entry.id);
  if (proc) {
    try { killProcessTree?.(proc); } catch {}
    try { proc.__orionCleanup?.(); } catch {}
    activeProcs.delete(entry.id);
  }

  let deleted = 0;
  let errors = 0;
  if (deleteMedia) {
    const result = removeFile(entry.filePath);
    deleted += result.deleted;
    errors += result.errors;
  }

  for (const subtitle of entry.subtitlePaths || []) {
    const result = removeFile(subtitle?.path);
    deleted += result.deleted;
    errors += result.errors;
  }

  removeFile(entry.cookiePath);
  removeFile(entry.logPath);
  cleanupTempFiles?.(entry.downloadPath, entry.outputStem);

  return { deleted, errors };
}

module.exports = { cleanupDownloadTask, removeFile };
