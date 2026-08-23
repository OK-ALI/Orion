const fs = require("node:fs");
const path = require("node:path");

const VULNERABLE_EXPO_UPDATES_VERSION = "57.0.16";
const UPSTREAM_FIX_COMMIT = "ef84af66b9b77aaa33e7f2f8d344c297a3d1e51b";
const UPSTREAM_FIX_PR = 49130;

const IMPORT_ROOM_OLD = `import android.content.Context
import expo.modules.updates.UpdatesConfiguration`;
const IMPORT_ROOM_NEW = `import android.content.Context
import androidx.room.withTransaction
import expo.modules.updates.UpdatesConfiguration`;

const IMPORT_CANCELLATION_OLD = `import expo.modules.updates.manifest.Update
import kotlinx.coroutines.CoroutineScope`;
const IMPORT_CANCELLATION_NEW = `import expo.modules.updates.manifest.Update
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope`;

const PROCESS_UPDATE_OLD = `    } else {
      if (existingUpdateEntity == null) {
        // no update already exists with this ID, so we need to insert it and download everything.
        updateEntity = newUpdateEntity
        database.updateDao().insertUpdate(updateEntity!!)
      } else {
        // we've already partially downloaded the update, so we should use the existing entity.
        // however, it's not ready, so we should try to download all the assets again.
        updateEntity = existingUpdateEntity
      }
      return downloadAllAssets(update)
    }`;

const PROCESS_UPDATE_NEW = `    } else {
      val insertUpdateEntityOnFinish: Boolean
      if (existingUpdateEntity == null) {
        // no update already exists with this ID, so we need to download everything.
        updateEntity = newUpdateEntity
        // EMBEDDED is already in the launchable set, so a row inserted before its launch asset exists
        // gets picked as launchable and then fails every launch.
        insertUpdateEntityOnFinish = newUpdateEntity.status == UpdateStatus.EMBEDDED
        if (!insertUpdateEntityOnFinish) {
          database.updateDao().insertUpdate(updateEntity!!)
        }
      } else {
        // we've already partially downloaded the update, so we should use the existing entity.
        // however, it's not ready, so we should try to download all the assets again.
        updateEntity = existingUpdateEntity
        insertUpdateEntityOnFinish = false
      }
      return downloadAllAssets(update, insertUpdateEntityOnFinish)
    }`;

const DOWNLOAD_SIGNATURE_OLD = `  private suspend fun downloadAllAssets(update: Update): LoaderResult {`;
const DOWNLOAD_SIGNATURE_NEW = `  private suspend fun downloadAllAssets(update: Update, insertUpdateEntityOnFinish: Boolean): LoaderResult {`;

const FINALIZE_OLD = `    try {
      for (asset in existingAssetList) {
        val existingAssetFound = database.assetDao()
          .addExistingAssetToUpdate(updateEntity!!, asset, asset.isLaunchAsset)
        if (!existingAssetFound) {
          // the database and filesystem have gotten out of sync
          // do our best to create a new entry for this file even though it already existed on disk
          // TODO: we should probably get rid of this assumption that if an asset exists on disk with the same filename, it's the same asset
          var hash: ByteArray? = null
          try {
            hash = UpdatesUtils.sha256(File(updatesDirectory, asset.relativePath))
          } catch (_: Exception) {
          }
          asset.downloadTime = Date()
          asset.hash = hash
          finishedAssetList.add(asset)
        }
      }

      database.assetDao().insertAssets(finishedAssetList, updateEntity!!)
      database.updateDao().markUpdateFinished(updateEntity!!)
    } catch (e: Exception) {
      throw IOException("Error while adding new update to database", e)
    }`;

const FINALIZE_NEW = `    try {
      database.withTransaction {
        if (insertUpdateEntityOnFinish) {
          database.updateDao().insertUpdate(updateEntity!!)
        }

        for (asset in existingAssetList) {
          val existingAssetFound = database.assetDao()
            .addExistingAssetToUpdate(updateEntity!!, asset, asset.isLaunchAsset)
          if (!existingAssetFound) {
            // the database and filesystem have gotten out of sync
            // do our best to create a new entry for this file even though it already existed on disk
            // TODO: we should probably get rid of this assumption that if an asset exists on disk with the same filename, it's the same asset
            var hash: ByteArray? = null
            try {
              hash = UpdatesUtils.sha256(File(updatesDirectory, asset.relativePath))
            } catch (_: Exception) {
            }
            asset.downloadTime = Date()
            asset.hash = hash
            finishedAssetList.add(asset)
          }
        }

        database.assetDao().insertAssets(finishedAssetList, updateEntity!!)
        database.updateDao().markUpdateFinished(updateEntity!!)
      }
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      throw IOException("Error while adding new update to database", e)
    }`;

const LOADER_TASK_IMPORT_STATUS_OLD = `import expo.modules.updates.db.entity.UpdateEntity
import expo.modules.updates.launcher.DatabaseLauncher`;
const LOADER_TASK_IMPORT_STATUS_NEW = `import expo.modules.updates.db.entity.UpdateEntity
import expo.modules.updates.db.enums.UpdateStatus
import expo.modules.updates.launcher.DatabaseLauncher`;

const LOADER_TASK_EMBEDDED_SELECTION_OLD = `      val launchableUpdate = launcher.getLaunchableUpdate(database)
      val manifestFilters = ManifestMetadata.getManifestFilters(database, configuration)
      if (selectionPolicy.shouldLoadNewUpdate(
          embeddedUpdate,
          launchableUpdate,
          manifestFilters
        )
      ) {
        try {`;

const LOADER_TASK_EMBEDDED_SELECTION_NEW = `      val launchableUpdate = launcher.getLaunchableUpdate(database)
      val embeddedRegistrationNeedsRepair = launchableUpdate?.let {
        it.status == UpdateStatus.EMBEDDED &&
          it.id == embeddedUpdate.id &&
          database.updateDao().loadLaunchAssetForUpdate(it.id) == null
      } ?: false
      val manifestFilters = ManifestMetadata.getManifestFilters(database, configuration)
      if (
        embeddedRegistrationNeedsRepair ||
        selectionPolicy.shouldLoadNewUpdate(
          embeddedUpdate,
          launchableUpdate,
          manifestFilters
        )
      ) {
        if (embeddedRegistrationNeedsRepair) {
          logger.warn("Detected an incomplete embedded update registration with no launch asset. Retrying embedded registration before launch.")
        }
        try {`;

const REPLACEMENTS = [
  [IMPORT_ROOM_OLD, IMPORT_ROOM_NEW, "Room transaction import"],
  [IMPORT_CANCELLATION_OLD, IMPORT_CANCELLATION_NEW, "cancellation import"],
  [PROCESS_UPDATE_OLD, PROCESS_UPDATE_NEW, "embedded row insertion ordering"],
  [DOWNLOAD_SIGNATURE_OLD, DOWNLOAD_SIGNATURE_NEW, "asset download signature"],
  [FINALIZE_OLD, FINALIZE_NEW, "atomic database finalization"],
];

function countOccurrences(source, needle) {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function replaceExactlyOnce(source, before, after, label) {
  const count = countOccurrences(source, before);
  if (count !== 1) {
    throw new Error(`P9-F6 Expo backport refused: expected exactly one ${label} target, found ${count}.`);
  }
  return source.replace(before, after);
}

function isFixedLoaderSource(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  const required = [
    "import androidx.room.withTransaction",
    "import kotlinx.coroutines.CancellationException",
    "val insertUpdateEntityOnFinish: Boolean",
    "insertUpdateEntityOnFinish = newUpdateEntity.status == UpdateStatus.EMBEDDED",
    "return downloadAllAssets(update, insertUpdateEntityOnFinish)",
    "private suspend fun downloadAllAssets(update: Update, insertUpdateEntityOnFinish: Boolean): LoaderResult",
    "database.withTransaction {",
    "if (insertUpdateEntityOnFinish) {",
    "} catch (e: CancellationException) {",
  ];
  return required.every((marker) => normalized.includes(marker));
}

function transformLoaderSource(source) {
  if (isFixedLoaderSource(source)) {
    return source;
  }

  const usesCrlf = source.includes("\r\n");
  let normalized = source.replace(/\r\n/g, "\n");
  for (const [before, after, label] of REPLACEMENTS) {
    normalized = replaceExactlyOnce(normalized, before, after, label);
  }

  if (!isFixedLoaderSource(normalized)) {
    throw new Error("P9-F6 Expo backport verification failed after transformation.");
  }

  return usesCrlf ? normalized.replace(/\n/g, "\r\n") : normalized;
}

function isFixedLoaderTaskSource(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  const required = [
    "import expo.modules.updates.db.enums.UpdateStatus",
    "val embeddedRegistrationNeedsRepair = launchableUpdate?.let {",
    "it.status == UpdateStatus.EMBEDDED",
    "it.id == embeddedUpdate.id",
    "database.updateDao().loadLaunchAssetForUpdate(it.id) == null",
    "embeddedRegistrationNeedsRepair ||",
    "Detected an incomplete embedded update registration with no launch asset.",
  ];
  return required.every((marker) => normalized.includes(marker));
}

function transformLoaderTaskSource(source) {
  if (isFixedLoaderTaskSource(source)) {
    return source;
  }

  const usesCrlf = source.includes("\r\n");
  let normalized = source.replace(/\r\n/g, "\n");
  normalized = replaceExactlyOnce(
    normalized,
    LOADER_TASK_IMPORT_STATUS_OLD,
    LOADER_TASK_IMPORT_STATUS_NEW,
    "LoaderTask UpdateStatus import"
  );
  normalized = replaceExactlyOnce(
    normalized,
    LOADER_TASK_EMBEDDED_SELECTION_OLD,
    LOADER_TASK_EMBEDDED_SELECTION_NEW,
    "LoaderTask legacy embedded-registration healing"
  );

  if (!isFixedLoaderTaskSource(normalized)) {
    throw new Error("P9-F6 Expo legacy-state healing verification failed after transformation.");
  }

  return usesCrlf ? normalized.replace(/\n/g, "\r\n") : normalized;
}

function resolveExpoUpdatesPackage(rootDirectory) {
  const mobileDirectory = path.join(rootDirectory, "apps", "mobile");
  const packageJsonPath = require.resolve("expo-updates/package.json", {
    paths: [mobileDirectory],
  });
  return {
    packageJsonPath,
    packageRoot: path.dirname(packageJsonPath),
  };
}

function applyPatch(rootDirectory = path.resolve(__dirname, "..")) {
  const { packageJsonPath, packageRoot } = resolveExpoUpdatesPackage(rootDirectory);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const loaderPath = path.join(
    packageRoot,
    "android",
    "src",
    "main",
    "java",
    "expo",
    "modules",
    "updates",
    "loader",
    "Loader.kt"
  );
  const loaderTaskPath = path.join(
    packageRoot,
    "android",
    "src",
    "main",
    "java",
    "expo",
    "modules",
    "updates",
    "loader",
    "LoaderTask.kt"
  );

  if (!fs.existsSync(loaderPath)) {
    throw new Error(`P9-F6 Expo backport refused: Loader.kt not found at ${loaderPath}`);
  }
  if (!fs.existsSync(loaderTaskPath)) {
    throw new Error(`P9-F6 Expo backport refused: LoaderTask.kt not found at ${loaderTaskPath}`);
  }

  const loaderSource = fs.readFileSync(loaderPath, "utf8");
  const loaderTaskSource = fs.readFileSync(loaderTaskPath, "utf8");
  const loaderAlreadyFixed = isFixedLoaderSource(loaderSource);
  const loaderTaskAlreadyFixed = isFixedLoaderTaskSource(loaderTaskSource);

  if (loaderAlreadyFixed && loaderTaskAlreadyFixed) {
    console.log(
      `[Orion P9-F6] expo-updates ${packageJson.version} already contains the atomic embedded-registration fix and Orion legacy-state healing.`
    );
    return {
      changed: false,
      loaderPath,
      loaderTaskPath,
      version: packageJson.version,
    };
  }

  if (packageJson.version !== VULNERABLE_EXPO_UPDATES_VERSION) {
    throw new Error(
      `P9-F6 Expo backport refused: expo-updates ${packageJson.version} is not the audited vulnerable version ${VULNERABLE_EXPO_UPDATES_VERSION}. Re-audit before patching.`
    );
  }

  if (!loaderAlreadyFixed) {
    fs.writeFileSync(loaderPath, transformLoaderSource(loaderSource), "utf8");
  }
  if (!loaderTaskAlreadyFixed) {
    fs.writeFileSync(loaderTaskPath, transformLoaderTaskSource(loaderTaskSource), "utf8");
  }

  const verifyLoader = fs.readFileSync(loaderPath, "utf8");
  const verifyLoaderTask = fs.readFileSync(loaderTaskPath, "utf8");
  if (!isFixedLoaderSource(verifyLoader)) {
    throw new Error("P9-F6 Expo atomic embedded-registration write verification failed.");
  }
  if (!isFixedLoaderTaskSource(verifyLoaderTask)) {
    throw new Error("P9-F6 Expo legacy-state healing write verification failed.");
  }

  console.log(
    `[Orion P9-F6] Applied Expo upstream embedded-registration fix ${UPSTREAM_FIX_COMMIT} (PR #${UPSTREAM_FIX_PR}) plus Orion legacy-state healing to expo-updates ${packageJson.version}.`
  );
  return {
    changed: true,
    loaderPath,
    loaderTaskPath,
    version: packageJson.version,
  };
}

if (require.main === module) {
  try {
    applyPatch();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  UPSTREAM_FIX_COMMIT,
  UPSTREAM_FIX_PR,
  VULNERABLE_EXPO_UPDATES_VERSION,
  applyPatch,
  isFixedLoaderSource,
  transformLoaderSource,
  isFixedLoaderTaskSource,
  transformLoaderTaskSource,
  __test: {
    IMPORT_ROOM_OLD,
    IMPORT_CANCELLATION_OLD,
    PROCESS_UPDATE_OLD,
    DOWNLOAD_SIGNATURE_OLD,
    FINALIZE_OLD,
    LOADER_TASK_IMPORT_STATUS_OLD,
    LOADER_TASK_EMBEDDED_SELECTION_OLD,
  },
};
