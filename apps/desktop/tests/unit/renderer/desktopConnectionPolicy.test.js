import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

import {
  deriveDesktopConnectionState,
  isDesktopRemoteReady,
  legacyDesktopNetworkStatus,
  normalizeDesktopConnectionState,
  shouldEmitDesktopRecovery,
} from "../../../src/renderer/services/desktopConnectionPolicy";

const desktopRoot =
  path.resolve(
    import.meta.dirname,
    "../../..",
  );

const read = (relative) =>
  fs.readFileSync(
    path.join(
      desktopRoot,
      relative,
    ),
    "utf8",
  );

describe("P10A.1-C Desktop connection policy", () => {
  it("normalizes only the five supported product states", () => {
    for (const state of [
      "checking",
      "online",
      "degraded",
      "offline",
      "reconnecting",
    ]) {
      expect(
        normalizeDesktopConnectionState(
          state,
        ),
      ).toBe(state);
    }

    expect(
      normalizeDesktopConnectionState(
        "mystery",
      ),
    ).toBe("checking");
  });

  it("keeps verified transport-offline distinct from service degradation", () => {
    expect(
      deriveDesktopConnectionState({
        transportStatus: "offline",
        serviceRequired: true,
        serviceReachable: false,
        previousState: "online",
      }),
    ).toBe("offline");

    expect(
      deriveDesktopConnectionState({
        transportStatus: "online",
        serviceRequired: true,
        serviceReachable: false,
        previousState: "online",
      }),
    ).toBe("degraded");
  });

  it("uses reconnecting while restored transport awaits remote validation", () => {
    expect(
      deriveDesktopConnectionState({
        transportStatus: "checking",
        serviceRequired: true,
        serviceReachable: null,
        previousState: "offline",
      }),
    ).toBe("reconnecting");

    expect(
      deriveDesktopConnectionState({
        transportStatus: "online",
        serviceRequired: true,
        serviceReachable: null,
        previousState: "reconnecting",
      }),
    ).toBe("reconnecting");
  });

  it("does not invent reconnecting during normal cold startup", () => {
    expect(
      deriveDesktopConnectionState({
        transportStatus: "checking",
        serviceRequired: true,
        serviceReachable: null,
        previousState: "checking",
      }),
    ).toBe("checking");
  });

  it("reaches online only after required remote capability validates", () => {
    expect(
      deriveDesktopConnectionState({
        transportStatus: "online",
        serviceRequired: true,
        serviceReachable: true,
        previousState: "reconnecting",
      }),
    ).toBe("online");

    expect(
      isDesktopRemoteReady(
        "online",
      ),
    ).toBe(true);

    expect(
      isDesktopRemoteReady(
        "degraded",
      ),
    ).toBe(false);
  });

  it("keeps the legacy status surface compatible while product state gains reconnecting", () => {
    expect(
      legacyDesktopNetworkStatus(
        "reconnecting",
      ),
    ).toBe("checking");

    expect(
      legacyDesktopNetworkStatus(
        "degraded",
      ),
    ).toBe("degraded");

    expect(
      legacyDesktopNetworkStatus(
        "offline",
      ),
    ).toBe("offline");
  });

  it("emits recovery only for meaningful restoration to fully online", () => {
    expect(
      shouldEmitDesktopRecovery(
        "offline",
        "online",
      ),
    ).toBe(true);

    expect(
      shouldEmitDesktopRecovery(
        "reconnecting",
        "online",
      ),
    ).toBe(true);

    expect(
      shouldEmitDesktopRecovery(
        "degraded",
        "online",
      ),
    ).toBe(true);

    expect(
      shouldEmitDesktopRecovery(
        "checking",
        "online",
      ),
    ).toBe(false);

    expect(
      shouldEmitDesktopRecovery(
        "online",
        "online",
      ),
    ).toBe(false);
  });

  it("extends the existing hook instead of creating a second connectivity probe", () => {
    const hook =
      read(
        "src/renderer/shared/hooks/useNetworkStatus.js",
      );

    const measure =
      read(
        "src/renderer/services/networkStatus.js",
      );

    expect(hook).toContain(
      "measureNetworkStatus",
    );

    expect(hook).toContain(
      "let generation = 0",
    );

    expect(hook).toContain(
      "serviceProbe",
    );

    expect(hook).toContain(
      "serviceReachable",
    );

    expect(hook).toContain(
      "recoveryEpoch",
    );

    expect(hook).toContain(
      "restoredAt",
    );

    expect(hook).toContain(
      "manualProbeRef",
    );

    expect(measure).toContain(
      "https://www.gstatic.com/generate_204",
    );

    expect(measure).toContain(
      "NETWORK_PROBE_INTERVAL = 15_000",
    );

    expect(hook).not.toContain(
      "https://www.gstatic.com/generate_204",
    );
  });

  it("fences stale asynchronous probe completion", () => {
    const hook =
      read(
        "src/renderer/shared/hooks/useNetworkStatus.js",
      );

    expect(hook).toMatch(
      /currentGeneration !== generation/,
    );

    expect(hook).toContain(
      "generation += 1",
    );
  });

  it("keeps TMDB capability ownership in App while recovery orchestration stays app-layer", () => {
    const app =
      read(
        "src/renderer/app/App.jsx",
      );

    expect(app).toContain(
      'tmdbFetch("/configuration", apiKey)',
    );

    expect(app).toContain(
      "serviceProbe: apiKey ? probeMetadataService : null",
    );

    expect(app).toContain(
      "useDesktopNetworkRecovery(network, fetchTrending)",
    );

    expect(app).not.toContain(
      "handledNetworkRecoveryRef",
    );

    expect(app).not.toContain(
      "previousNetworkStatusRef",
    );
  });

  it("dispatches one versioned recovery event from the bounded app recovery hook", () => {
    const recoveryHook =
      read(
        "src/renderer/app/hooks/useDesktopNetworkRecovery.js",
      );

    expect(recoveryHook).toContain(
      "useRef(network.recoveryEpoch)",
    );

    expect(recoveryHook).toContain(
      "network.recoveryEpoch <=",
    );

    expect(recoveryHook).toContain(
      "handledRecoveryEpochRef.current",
    );

    expect(recoveryHook).toContain(
      "onRecovery();",
    );

    expect(recoveryHook).toContain(
      '"orion:network-restored"',
    );

    expect(recoveryHook).toContain(
      "recoveryEpoch:",
    );

    expect(recoveryHook).toContain(
      "network.recoveryEpoch",
    );

    expect(recoveryHook).toContain(
      "restoredAt:",
    );

    expect(recoveryHook).toContain(
      "network.restoredAt",
    );

    expect(recoveryHook).not.toMatch(
      /tmdbFetch|measureNetworkStatus|setInterval/,
    );
  });

  it("turns Home Retry into a real connection recheck while preserving normal refresh", () => {
    const app =
      read(
        "src/renderer/app/App.jsx",
      );

    expect(app).toMatch(
      /if \(offline\) \{\s*network\.recheck\(\);\s*return;/,
    );

    expect(app).toContain(
      "fetchTrending();",
    );
  });

  it("does not add navigation, authentication, player, download, or Smart Connect ownership", () => {
    const policy =
      read(
        "src/renderer/services/desktopConnectionPolicy.js",
      );

    const hook =
      read(
        "src/renderer/shared/hooks/useNetworkStatus.js",
      );

    for (const source of [
      policy,
      hook,
    ]) {
      expect(source).not.toMatch(
        /navigate\(|router\.|download|playback|googleProfile|Smart Connect/i,
      );
    }
  });
});