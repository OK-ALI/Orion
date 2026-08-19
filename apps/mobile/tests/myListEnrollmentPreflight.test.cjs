"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(mobileRoot, "..", "..", "packages", "shared", "src");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readShared = (relative) => fs.readFileSync(path.join(sharedRoot, relative), "utf8");

test("P8.3 My List gets a constrained shared portable payload instead of a raw saved blob", () => {
  const portable = readShared("types/portableMyList.ts");
  const index = readShared("types/index.ts");

  assert.match(portable, /PORTABLE_MY_LIST_ITEM_SCHEMA_VERSION = 1/);
  assert.match(portable, /mediaType: "movie" \| "tv"/);
  assert.match(portable, /mediaId: number/);
  assert.match(portable, /title: string/);
  assert.match(portable, /posterPath: string \| null/);
  assert.match(portable, /backdropPath: string \| null/);
  assert.match(portable, /year: string \| null/);
  assert.match(portable, /order: number/);
  assert.match(index, /export \* from "\.\/portableMyList"/);

  assert.doesNotMatch(portable, /overview:|genre_ids:|vote_average:|popularity:|adult:/);
  assert.doesNotMatch(portable, /mmkvStorageAdapter|SecureStore|AsyncStorage|CloudProfileStore/);
});

test("P8.3 local My List preview preserves canonical keys and explicit order while rejecting unsafe entries", () => {
  const portable = readShared("types/portableMyList.ts");

  assert.match(portable, /buildPortableMyListPreviewV1/);
  assert.match(portable, /portableMyListRecordKey/);
  assert.match(portable, /canonicalKey !== sourceKey/);
  assert.match(portable, /records\[canonicalKey\]/);
  assert.match(portable, /order,/);
  assert.match(portable, /rejectedKeys\.push\(sourceKey\)/);
  assert.match(portable, /poster_path[\s\S]*backdrop_path[\s\S]*rejectedKeys\.push/);
});

test("P8.3 enrollment inspection semantically blocks populated, tombstoned, future or malformed cloud My List data", () => {
  const portable = readShared("types/portableMyList.ts");
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(portable, /inspectPortableMyListV1/);
  assert.match(portable, /record\.deletedAt != null[\s\S]*tombstoneCount \+= 1/);
  assert.match(portable, /normalizePortableMyListItemV1\(record\.value\)/);
  assert.match(portable, /state: "invalid"/);

  assert.match(preflight, /myList\.state === 'invalid'/);
  assert.match(preflight, /myList\.state === 'empty'/);
  assert.match(preflight, /phase: 'needs-review'/);
  assert.match(preflight, /will not merge or overwrite either copy automatically/i);
});

test("P8.3 Candidate 2 keeps readiness inspection read-only and identity-safe before explicit confirmation", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");
  const portableProfile = readShared("types/portableProfile.ts");
  const inspectStart = preflight.indexOf("const inspectEnrollment");
  const confirmStart = preflight.indexOf("const confirmEnrollment");
  const inspectPath = preflight.slice(inspectStart, confirmStart);

  assert.match(portableProfile, /PORTABLE_PROFILE_PRIMARY_KEY = "orion-primary-profile-v3"/);
  assert.match(inspectPath, /store\.read\(PORTABLE_PROFILE_PRIMARY_KEY\)/);
  assert.match(inspectPath, /remote\.profile\.profileId !== profileId/);
  assert.match(preflight, /Start My List sync/);
  assert.match(preflight, /<OrionDialog/);
  assert.doesNotMatch(inspectPath, /store\.write\(/);

  assert.doesNotMatch(preflight, /toggleSave|markWatched|markUnwatched|clearHistory|removeProgress/);
  assert.doesNotMatch(preflight, /mmkvStorageAdapter\.(?:set|remove)|SecureStore|AsyncStorage/);
});

test("P8.3 Candidate 2.1 read-only status check remains available until Candidate 3 establishes a verified checkpoint", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");
  const inspectStart = preflight.indexOf("const inspectEnrollment");
  const confirmStart = preflight.indexOf("const confirmEnrollment");
  const inspectPath = preflight.slice(inspectStart, confirmStart);

  assert.match(preflight, /Sync status is cloud-derived, not a persisted local flag/);
  assert.match(preflight, /if \(!steady\.hasCheckpoint && autoSyncEnabled\) void inspectEnrollment\(\)/);
  assert.match(inspectPath, /portableMyListActiveMatchesPreviewV1\(remote\.profile, preview\)/);
  assert.match(inspectPath, /saveMyListSyncCheckpointV1/);
  assert.match(inspectPath, /setState\(\{ phase: 'synced' \}\)/);
  assert.doesNotMatch(inspectPath, /store\.write\(/);
});

test("P8.3 Candidate 2 re-reads cloud state, refuses revision drift, and uses conditional writes", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(preflight, /baselineRevisionTag/);
  assert.match(preflight, /const fresh = await store\.read\(PORTABLE_PROFILE_PRIMARY_KEY\)/);
  assert.match(preflight, /fresh\.revisionTag !== readyState\.baselineRevisionTag/);
  assert.match(preflight, /expectedRevisionTag/);
  assert.match(preflight, /store\.write\(PORTABLE_PROFILE_PRIMARY_KEY/);
  assert.match(preflight, /write\.state === 'conflict'/);
  assert.match(preflight, /stopped before overwriting anything|did not overwrite it/);
});

test("P8.3 Candidate 2 builds only My List while preserving unrelated and unknown namespaces", () => {
  const portable = readShared("types/portableMyList.ts");

  assert.match(portable, /buildPortableMyListEnrollmentProfileV1/);
  assert.match(portable, /inspection\.state !== "empty"/);
  assert.match(portable, /revision: \(baseProfile\?\.revision \?\? 0\) \+ 1/);
  assert.match(portable, /namespaces:\s*\{\s*\.\.\.\(baseProfile\?\.namespaces \?\? \{\}\),\s*myList,/s);
  assert.match(portable, /deletedAt: null/);
  assert.match(portable, /value: \{ \.\.\.item \}/);

  const enrollmentStart = portable.indexOf("export function buildPortableMyListEnrollmentProfileV1");
  const matcherStart = portable.indexOf("export function portableMyListMatchesPreviewV1");
  const enrollment = portable.slice(enrollmentStart, matcherStart);
  assert.doesNotMatch(enrollment, /namespaces\.(?:history|watched|progress|preferences)\s*=/);
  assert.doesNotMatch(enrollment, /delete\s+baseProfile|delete\s+.*namespaces/);
});

test("P8.3 Candidate 2 requires read-back identity, revision and My List verification before Synced", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");
  const portable = readShared("types/portableMyList.ts");

  assert.match(portable, /portableMyListMatchesPreviewV1/);
  assert.match(portable, /record\.deletedAt != null/);
  assert.match(portable, /keys\.length !== preview\.orderedKeys\.length/);

  assert.match(preflight, /const verify = await store\.read\(PORTABLE_PROFILE_PRIMARY_KEY\)/);
  assert.match(preflight, /verify\.revisionTag === write\.revisionTag/);
  assert.match(preflight, /verify\.profile\.profileId === profileId/);
  assert.match(preflight, /verify\.profile\.revision === candidate\.revision/);
  assert.match(preflight, /verify\.profile\.updatedAt === candidate\.updatedAt/);
  assert.match(preflight, /unrelatedNamespacesMatch\(candidate, verify\.profile\)/);
  assert.match(preflight, /portableMyListMatchesPreviewV1\(verify\.profile, preview\)/);

  const verifyStart = preflight.indexOf("const verify = await store.read");
  const syncedAfterVerify = preflight.indexOf("setState({ phase: 'synced' })", verifyStart);
  assert.ok(verifyStart >= 0 && syncedAfterVerify > verifyStart);
});

test("P8.3 Candidate 2 invalidates readiness when actual local My List content or order changes", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(preflight, /const previewSignature = useMemo/);
  assert.match(preflight, /orderedKeys: preview\.orderedKeys/);
  assert.match(preflight, /records: preview\.records/);
  assert.match(preflight, /rejectedKeys: preview\.rejectedKeys/);
  assert.match(preflight, /\[accountEmail, profileId, previewSignature, steady\.hasCheckpoint\]/);
  assert.match(preflight, /readyState\.previewSignature !== previewSignature/);
  assert.match(preflight, /contextKeyRef\.current !== confirmedContextKey/);
  assert.match(preflight, /operationBusyRef\.current/);
});

test("P8.3 Account exposes My List enrollment only after Drive is Ready", () => {
  const account = read("src/features/settings/AccountSettingsContent.tsx");
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(account, /drivePhase === 'ready'[\s\S]*<MyListEnrollmentPreflight/);
  assert.match(account, /accountEmail=\{profile\.email\}/);
  assert.match(account, /profileId=\{profile\.accountId\}/);
  assert.match(preflight, /item\{localCount === 1 \? '' : 's'\} on this device/);
  assert.match(preflight, /ready to sync\. Nothing has been uploaded yet/);
  assert.match(preflight, /will not merge or overwrite either copy automatically/i);
});

test("P8.3 Candidate 2 exposes the required calm status progression and confirmation scope", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(preflight, /'Not synced'/);
  assert.match(preflight, /'Ready to sync'/);
  assert.match(preflight, /'Syncing…'/);
  assert.match(preflight, /'Synced'/);
  assert.match(preflight, /'Needs review'/);
  assert.match(preflight, /'Start My List sync\?'/);
  assert.match(preflight, /Orion will upload only My List/);
  assert.match(preflight, /My List changes sync automatically through Orion Cloud/);
  assert.match(preflight, /Other sync domains are not part of this action/);
  assert.doesNotMatch(preflight, /watched status and playback progress stay on this device for now/i);
});

test("P8.3 Candidate 1A Settings grammar stays flat and development diagnostics remain hidden", () => {
  const account = read("src/features/settings/AccountSettingsContent.tsx");
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(account, /topDivider: \{ borderTopWidth: 1, paddingTop: spacing\[4\] \}/);
  assert.match(account, /managementRow: \{ minHeight: 58, flexDirection: 'row'/);
  assert.match(account, /Orion Cloud/);
  assert.match(preflight, />My List</);
  assert.match(account, /Google connects your Orion identity\. Orion Cloud is a separate connection/);

  assert.doesNotMatch(account, /Cloud profile storage check|Verify Drive storage|Development validation only|Checking appDataFolder|appDataFolder/);
  assert.doesNotMatch(preflight, />My List enrollment preflight<|Read-only development check|Local preview:|portable item|primary cloud profile/);
  assert.doesNotMatch(account, /identityCard:|truthCard:|driveCard:|cloudProbeCard:/);
  assert.match(account, /runP82DriveStorageProbeForDiagnostics/);
});
