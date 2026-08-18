const path = require("path");
const os = require("os");
const { test, _electron: electron } = require("@playwright/test");

function print(label, value) {
  console.log(`\n[MUSIC-PROVIDER-DIAG] ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

test("live Music provider search and playback-resolution diagnostics", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const userDataDir = path.join(os.tmpdir(), `orion-music-provider-diag-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });

  try {
    const page = await app.firstWindow();
    await page.waitForTimeout(900);

    const report = await page.evaluate(async () => {
      const timed = async (fn) => {
        const started = performance.now();
        try {
          const value = await fn();
          return { ok: true, ms: Math.round(performance.now() - started), value };
        } catch (error) {
          return { ok: false, ms: Math.round(performance.now() - started), error: error?.message || String(error) };
        }
      };

      const providersResult = await timed(() => window.electron.musicListProviders());
      const providers = Array.isArray(providersResult.value) ? providersResult.value : [];
      const providerSummary = providers.map((provider) => ({
        id: provider.id,
        kind: provider.kind,
        active: provider.active === true,
        capabilities: provider.capabilities || [],
        health: provider.health ? {
          status: provider.health.status,
          latencyMs: provider.health.latencyMs ?? null,
          lastError: provider.health.lastError || "",
        } : null,
      }));

      const statusResult = await timed(() => window.electron.musicGetStatus());
      const searchResult = await timed(() => window.electron.musicSearch("Pasoori Shae Gill"));
      const searchPayload = searchResult.value || {};
      const tracks = (searchPayload.results || []).flatMap((group) => group?.value?.tracks || []);
      const firstTrack = tracks[0] || null;

      let candidatesResult = null;
      let resolveResult = null;
      if (firstTrack) {
        candidatesResult = await timed(() => window.electron.musicListTrackCandidates(firstTrack));
        resolveResult = await timed(() => window.electron.musicResolveTrack(firstTrack));
      }

      const candidateValue = candidatesResult?.value;
      const candidates = Array.isArray(candidateValue?.candidates) ? candidateValue.candidates : [];
      const resolved = resolveResult?.value;

      return {
        status: {
          callOk: statusResult.ok,
          latencyMs: statusResult.ms,
          ok: statusResult.value?.ok === true,
          schemaVersion: statusResult.value?.schemaVersion ?? null,
          error: statusResult.error || statusResult.value?.error || "",
        },
        providers: {
          callOk: providersResult.ok,
          latencyMs: providersResult.ms,
          items: providerSummary,
          error: providersResult.error || "",
        },
        search: {
          callOk: searchResult.ok,
          latencyMs: searchResult.ms,
          resultGroups: searchPayload.results?.length || 0,
          errors: searchPayload.errors || (searchResult.error ? [searchResult.error] : []),
          trackCount: tracks.length,
          firstTrack: firstTrack ? {
            id: firstTrack.id,
            title: firstTrack.title,
            artistName: firstTrack.artistName,
            provider: firstTrack.provider || firstTrack.source?.provider || firstTrack.source?.id || null,
            sourceId: firstTrack.source?.id || null,
            providerRefs: (firstTrack.providerRefs || []).map((ref) => ref?.id || ref?.provider || ref).filter(Boolean),
          } : null,
        },
        candidates: candidatesResult ? {
          callOk: candidatesResult.ok,
          latencyMs: candidatesResult.ms,
          ok: candidateValue?.ok === true,
          error: candidatesResult.error || candidateValue?.error || "",
          count: candidates.length,
          items: candidates.slice(0, 5).map((candidate) => ({
            id: candidate.id,
            providerId: candidate.providerId,
            providerLabel: candidate.providerLabel,
            health: candidate.health,
            format: candidate.format || candidate.ext || null,
            audioQuality: candidate.audioQuality || candidate.quality || null,
          })),
        } : null,
        resolve: resolveResult ? {
          callOk: resolveResult.ok,
          latencyMs: resolveResult.ms,
          ok: resolved?.ok === true,
          error: resolveResult.error || resolved?.error || "",
          hasUrl: typeof resolved?.url === "string" && resolved.url.length > 0,
          providerId: resolved?.candidate?.providerId || null,
          format: resolved?.candidate?.format || resolved?.candidate?.ext || null,
        } : null,
      };
    });

    print("STATUS", report.status);
    print("PROVIDERS", report.providers);
    print("SEARCH", report.search);
    print("CANDIDATES", report.candidates);
    print("RESOLVE", report.resolve);

    console.log("\n[MUSIC-PROVIDER-DIAG] COMPLETE");
  } finally {
    await app.close();
  }
});
