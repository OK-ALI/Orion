import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPortableMyListPreviewV1 } from "@orion/shared/types";
import { storage } from "../../../src/renderer/services/settingsStore";
import {
  applyDesktopPortableMyListPreviewV1,
  buildDesktopMyListSnapshotV1,
  MY_LIST_SYNC_APPLIED_EVENT,
  readDesktopPortableMyListPreviewV1,
} from "../../../src/renderer/services/myListSyncLocalStore";
import {
  loadDesktopMyListAutomaticV1,
  loadDesktopWatchedAutomaticV1,
  saveDesktopMyListAutomaticV1,
  saveDesktopWatchedAutomaticV1,
} from "../../../src/renderer/services/syncPolicy";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(here, "../../../src/renderer");
const read = (relative) => fs.readFileSync(path.join(rendererRoot, relative), "utf8");

describe("P8.3 Desktop My List post-lock amendment", () => {
  beforeEach(() => localStorage.clear());

  it("mounts My List and Watched as peer providers without reopening their engines", () => {
    const app = read("app/App.jsx");
    const wrapper = read("features/account/DesktopSyncProviders.jsx");
    expect(app).toMatch(/<DesktopSyncProviders[^>]*saved=\{saved\}[^>]*savedOrder=\{savedOrder\}[^>]*watched=\{watched\}/);
    expect((app.match(/<DesktopSyncProviders/g) || [])).toHaveLength(1);
    expect(wrapper).toMatch(/<DesktopMyListSteadyStateSyncProvider[\s\S]*<DesktopWatchedSteadyStateSyncProvider/);
  });

  it("uses the canonical portable My List machinery with checkpoint-driven safe reconciliation", () => {
    const sync = read("features/account/MyListSteadyStateSync.jsx");
    expect(sync).toMatch(/buildPortableMyListSteadyStateProfileV1/);
    expect(sync).toMatch(/portableMyListNamespaceSignatureV1/);
    expect(sync).toMatch(/loadDesktopMyListSyncCheckpointV1/);
    expect(sync).toMatch(/const localChanged = operationLocalSignature !== checkpoint\.localSignature/);
    expect(sync).toMatch(/const cloudChanged = cloudNamespaceSignature !== checkpoint\.cloudNamespaceSignature/);
    expect(sync).toMatch(/if \(localChanged && cloudChanged\)/);
    expect(sync).toMatch(/expectedRevisionTag: remote\.revisionTag/);
    expect(sync).toMatch(/readBackCloudProfileUntilVerified/);
    expect(sync).toMatch(/unrelatedNamespacesMatch\(candidate, readBack\.profile\)/);
    expect(sync).toMatch(/freshPull\.revisionTag !== remote\.revisionTag/);
    expect(sync).toMatch(/latestRef\.current\.localSignature !== operationLocalSignature/);
    expect(sync).toMatch(/applyDesktopPortableMyListPreviewV1\(cloudPreview\)/);
    expect(sync).not.toMatch(/uploadSync|downloadSync|collectLegacyCloudSyncData|restoreLegacyCloudSyncData/);
    expect(sync).not.toMatch(/markWatched|markUnwatched|recordPlayback|clearHistory|removeProgress/);
  });

  it("keeps first enrollment explicit and restore limited to an empty local My List", () => {
    const card = read("features/settings/components/MyListSyncCard.jsx");
    expect(card).toMatch(/inspectPortableMyListV1/);
    expect(card).toMatch(/buildPortableMyListEnrollmentProfileV1/);
    expect(card).toMatch(/portableMyListMatchesPreviewV1/);
    expect(card).toMatch(/state\.action === "restore" \? void confirmRestore\(\) : void confirmUpload\(\)/);
    expect(card).toMatch(/Confirm restore/);
    expect(card).toMatch(/Confirm sync/);
    expect(card).toMatch(/local\.orderedKeys\.length !== 0/);
    expect(card).toMatch(/fresh\.revisionTag !== expected\.baselineRevisionTag/);
    expect(card).toMatch(/readBackCloudProfileUntilVerified/);
    expect(card).not.toMatch(/useEffect\(/);
  });

  it("offers an explicit no-loss first-enrollment combine before either destructive replacement path", () => {
    const card = read("features/settings/components/MyListSyncCard.jsx");
    const merge = read("services/myListConflictResolution.js");
    expect(card).toMatch(/phase: "conflict"/);
    expect(card).toMatch(/combinePortableMyListPreviewsV1\(preview, cloudPreview\)/);
    expect(card).toMatch(/>Combine both<\/button>/);
    expect(card).toMatch(/>Keep Desktop My List<\/button>/);
    expect(card).toMatch(/>Keep Orion Cloud My List<\/button>/);
    expect(card).toMatch(/Every title currently present in either My List will be preserved/);
    expect(card).toMatch(/fresh\.revisionTag !== expected\.baselineRevisionTag/);
    expect(card).toMatch(/freshCloudNamespaceSignature !== expected\.cloudNamespaceSignature/);
    expect(card).toMatch(/expectedRevisionTag: fresh\.revisionTag/);
    expect(card).toMatch(/buildPortableMyListSteadyStateProfileV1\(fresh\.profile, resolved/);
    expect(card).toMatch(/unrelatedNamespacesMatch\(candidate, readBack\.profile\)/);
    expect(card).toMatch(/portableMyListActiveMatchesPreviewV1\(readBack\.profile, resolved\)/);
    expect(card).toMatch(/applyDesktopPortableMyListPreviewV1\(resolved\)/);
    expect(card).toMatch(/saveDesktopMyListSyncCheckpointV1/);
    expect(merge).toMatch(/Object\.prototype\.hasOwnProperty\.call\(records, key\)/);
    expect(merge).toMatch(/sharedCount \+= 1/);
    expect(merge).toMatch(/desktopOnlyCount: desktopCount - sharedCount/);
    expect(merge).toMatch(/cloudOnlyCount: cloudCount - sharedCount/);
  });

  it("round-trips Desktop saved state through the shared constrained My List preview", () => {
    const existing = {
      movie_7: { id: 7, media_type: "movie", title: "Seven", poster_path: "/7.jpg", backdrop_path: null, year: "2025", overview: "keep" },
    };
    const preview = buildPortableMyListPreviewV1(existing, ["movie_7"]);
    const snapshot = buildDesktopMyListSnapshotV1(preview, existing);
    expect(snapshot.saved.movie_7.overview).toBe("keep");
    expect(snapshot.saved.movie_7.title).toBe("Seven");
    expect(snapshot.savedOrder).toEqual(["movie_7"]);

    storage.set("saved", existing);
    storage.set("savedOrder", ["movie_7"]);
    expect(readDesktopPortableMyListPreviewV1()).toEqual(preview);
  });

  it("applies a cloud pull to My List only and emits one local refresh event", () => {
    storage.set("saved", { movie_1: { id: 1, media_type: "movie", title: "Old" } });
    storage.set("savedOrder", ["movie_1"]);
    storage.set("watched", { movie_99: true });
    storage.set("history", [{ id: 99 }]);
    const preview = buildPortableMyListPreviewV1({ tv_2: { id: 2, media_type: "tv", name: "New" } }, ["tv_2"]);
    const listener = vi.fn();
    window.addEventListener(MY_LIST_SYNC_APPLIED_EVENT, listener);
    applyDesktopPortableMyListPreviewV1(preview);
    expect(storage.get("saved").tv_2.id).toBe(2);
    expect(storage.get("savedOrder")).toEqual(["tv_2"]);
    expect(storage.get("watched")).toEqual({ movie_99: true });
    expect(storage.get("history")).toEqual([{ id: 99 }]);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(MY_LIST_SYNC_APPLIED_EVENT, listener);
  });

  it("exposes explicit steady-state conflict recovery without treating a signature checkpoint as a merge base", () => {
    const sync = read("features/account/MyListSteadyStateSync.jsx");
    const card = read("features/settings/components/MyListSyncCard.jsx");
    expect(sync).toMatch(/resolvePortableMyListSteadyStateConflictV1/);
    expect(sync).toMatch(/reason: "both-changed"/);
    expect(sync).toMatch(/resolution === "desktop" \? "keep-local" : "keep-cloud"/);
    expect(card).toMatch(/Keep Desktop My List/);
    expect(card).toMatch(/Keep Orion Cloud My List/);
    expect(card).toMatch(/Both copies changed\. Choose which My List Orion should keep\./);

    const steadyReviewStart = card.indexOf("{steadyReviewAvailable && (");
    const firstEnrollmentConflictStart = card.indexOf('!steadyActive && state.phase === "conflict"');
    expect(steadyReviewStart).toBeGreaterThanOrEqual(0);
    expect(firstEnrollmentConflictStart).toBeGreaterThan(steadyReviewStart);
    const steadyReviewPresentation = card.slice(steadyReviewStart, firstEnrollmentConflictStart);
    expect(steadyReviewPresentation).toMatch(/Keep Desktop My List/);
    expect(steadyReviewPresentation).toMatch(/Keep Orion Cloud My List/);
    expect(steadyReviewPresentation).not.toMatch(/Combine both/);
    expect(card).not.toMatch(/cannot safely infer which removals were intentional/);
  });

  it("stores Auto sync per domain without erasing the other domain policy", () => {
    saveDesktopWatchedAutomaticV1("profile-1", false);
    saveDesktopMyListAutomaticV1("profile-1", false);
    expect(loadDesktopWatchedAutomaticV1("profile-1")).toBe(false);
    expect(loadDesktopMyListAutomaticV1("profile-1")).toBe(false);
    saveDesktopMyListAutomaticV1("profile-1", true);
    expect(loadDesktopMyListAutomaticV1("profile-1")).toBe(true);
    expect(loadDesktopWatchedAutomaticV1("profile-1")).toBe(false);
  });
});
