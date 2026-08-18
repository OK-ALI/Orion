const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");

function print(label, value) {
  console.log(`\n[MUSIC-P0-REAL] ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

test("real Orion profile resolves, serves and decodes a protected Music stream", async () => {
  test.setTimeout(120_000);

  const realUserData = path.join(process.env.APPDATA || "", "orion");
  if (!process.env.APPDATA) throw new Error("APPDATA is unavailable; cannot locate the real Orion profile.");

  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      `--user-data-dir=${realUserData}`,
      "--disable-gpu",
    ],
  });

  try {
    const page = await app.firstWindow();
    await page.waitForTimeout(900);

    const resolveReport = await page.evaluate(async () => {
      const track = {
        id: "ytmusic:5Eqb_-j3FDA",
        provider: "ytmusic",
        providerTrackId: "5Eqb_-j3FDA",
        title: "Pasoori",
        artistName: "Ali Sethi, Shae Gill",
        source: {
          provider: "ytmusic",
          id: "5Eqb_-j3FDA",
        },
      };

      const started = performance.now();
      try {
        const value = await window.electron.musicResolveTrack(track);
        const parsed = value?.url ? new URL(value.url) : null;
        return {
          callOk: true,
          latencyMs: Math.round(performance.now() - started),
          ok: value?.ok === true,
          error: value?.error || "",
          hasUrl: typeof value?.url === "string" && value.url.length > 0,
          url: value?.url || "",
          urlScheme: parsed?.protocol || null,
          urlHost: parsed?.hostname || null,
          urlPort: parsed?.port || null,
          pathSegments: parsed?.pathname?.split("/").filter(Boolean).length || 0,
          candidateProvider: value?.candidate?.providerId || null,
          attempts: value?.attempts ?? null,
        };
      } catch (error) {
        return {
          callOk: false,
          latencyMs: Math.round(performance.now() - started),
          ok: false,
          error: error?.message || String(error),
          hasUrl: false,
          url: "",
        };
      }
    });

    print("RESOLVE", {
      ...resolveReport,
      url: resolveReport.url ? "[protected loopback URL withheld]" : "",
    });

    if (!resolveReport.ok || !resolveReport.url) {
      console.log("\n[MUSIC-P0-REAL] STOP: resolution failed before the protected playback boundary.");
      return;
    }

    const transportReport = await page.evaluate(async (url) => {
      const timedFetch = async (method, headers = {}) => {
        const started = performance.now();
        try {
          const response = await fetch(url, {
            method,
            headers,
            redirect: "follow",
          });

          const report = {
            ok: true,
            latencyMs: Math.round(performance.now() - started),
            status: response.status,
            contentType: response.headers.get("content-type") || "",
            contentLength: response.headers.get("content-length") || "",
            contentRange: response.headers.get("content-range") || "",
            acceptRanges: response.headers.get("accept-ranges") || "",
            cors: response.headers.get("access-control-allow-origin") || "",
            resourcePolicy: response.headers.get("cross-origin-resource-policy") || "",
            finalHost: new URL(response.url).hostname,
          };

          try { await response.body?.cancel(); } catch {}
          return report;
        } catch (error) {
          return {
            ok: false,
            latencyMs: Math.round(performance.now() - started),
            error: error?.message || String(error),
          };
        }
      };

      return {
        head: await timedFetch("HEAD"),
        range: await timedFetch("GET", { Range: "bytes=0-1" }),
      };
    }, resolveReport.url);

    print("LOOPBACK_TRANSPORT", transportReport);

    await page.evaluate((url) => {
      const old = document.getElementById("music-p0-real-probe");
      old?.remove();

      const button = document.createElement("button");
      button.id = "music-p0-real-probe";
      button.textContent = "Music P0 Probe";
      button.style.position = "fixed";
      button.style.left = "8px";
      button.style.bottom = "8px";
      button.style.zIndex = "2147483647";

      button.onclick = () => {
        window.__musicP0RealProbe = (async () => {
          const audio = new Audio();
          audio.crossOrigin = "anonymous";
          audio.preload = "auto";
          audio.src = url;
          document.body.appendChild(audio);

          const events = [];
          for (const name of [
            "loadstart", "durationchange", "loadedmetadata", "loadeddata",
            "canplay", "canplaythrough", "play", "playing", "waiting",
            "stalled", "suspend", "pause", "error",
          ]) {
            audio.addEventListener(name, () => events.push({
              name,
              at: Math.round(performance.now()),
              readyState: audio.readyState,
              networkState: audio.networkState,
              errorCode: audio.error?.code || 0,
            }));
          }

          let playError = "";
          const started = performance.now();

          try {
            await audio.play();
          } catch (error) {
            playError = `${error?.name || "Error"}: ${error?.message || String(error)}`;
          }

          await new Promise((resolve) => setTimeout(resolve, 3500));

          const report = {
            elapsedMs: Math.round(performance.now() - started),
            playError,
            paused: audio.paused,
            readyState: audio.readyState,
            networkState: audio.networkState,
            currentTime: audio.currentTime || 0,
            duration: Number.isFinite(audio.duration) ? audio.duration : String(audio.duration),
            errorCode: audio.error?.code || 0,
            errorMessage: audio.error?.message || "",
            currentSrcScheme: audio.currentSrc ? new URL(audio.currentSrc).protocol : "",
            currentSrcHost: audio.currentSrc ? new URL(audio.currentSrc).hostname : "",
            events,
          };

          audio.pause();
          audio.removeAttribute("src");
          audio.load();
          audio.remove();
          return report;
        })();
      };

      document.body.appendChild(button);
    }, resolveReport.url);

    await page.locator("#music-p0-real-probe").click();
    const audioReport = await page.evaluate(() => window.__musicP0RealProbe);

    print("HTML_AUDIO", audioReport);

    const result = {
      resolveOk: resolveReport.ok === true,
      loopbackRangeOk: transportReport.range?.ok === true
        && [200, 206].includes(transportReport.range.status)
        && !/text\/html|application\/json/i.test(transportReport.range.contentType || ""),
      audioAdvanced: Number(audioReport?.currentTime || 0) > 0.25,
      audioErrorCode: audioReport?.errorCode || 0,
      playError: audioReport?.playError || "",
    };

    print("SUMMARY", result);

    if (result.resolveOk && result.loopbackRangeOk && result.audioAdvanced) {
      console.log("\n[MUSIC-P0-REAL] FINAL PLAYBACK BOUNDARY: PASS");
    } else if (result.resolveOk && result.loopbackRangeOk) {
      console.log("\n[MUSIC-P0-REAL] FINAL PLAYBACK BOUNDARY: AUDIO ELEMENT FAILURE");
    } else if (result.resolveOk) {
      console.log("\n[MUSIC-P0-REAL] FINAL PLAYBACK BOUNDARY: LOOPBACK TRANSPORT FAILURE");
    } else {
      console.log("\n[MUSIC-P0-REAL] FINAL PLAYBACK BOUNDARY: RESOLUTION FAILURE");
    }

    expect(resolveReport.ok).toBe(true);
  } finally {
    await app.close();
  }
});
