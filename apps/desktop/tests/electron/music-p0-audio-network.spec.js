const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");

function print(label, value) {
  console.log(`\n[MUSIC-P0-NET] ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

test("real audio element exposes its loopback request and response contract", async () => {
  test.setTimeout(120_000);

  const realUserData = path.join(process.env.APPDATA || "", "orion");
  if (!process.env.APPDATA) throw new Error("APPDATA is unavailable.");

  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      `--user-data-dir=${realUserData}`,
      "--disable-gpu",
    ],
  });

  try {
    const page = await app.firstWindow();
    await page.waitForTimeout(800);

    const resolved = await page.evaluate(async () => {
      const track = {
        id: "ytmusic:5Eqb_-j3FDA",
        provider: "ytmusic",
        providerTrackId: "5Eqb_-j3FDA",
        title: "Pasoori",
        artistName: "Ali Sethi, Shae Gill",
        source: { provider: "ytmusic", id: "5Eqb_-j3FDA" },
      };
      return window.electron.musicResolveTrack(track);
    });

    if (!resolved?.ok || !resolved?.url) {
      print("RESOLVE_FAILURE", { ok: resolved?.ok === true, error: resolved?.error || "" });
      expect(resolved?.ok).toBe(true);
      return;
    }

    const protectedUrl = new URL(resolved.url);
    const loopbackOrigin = protectedUrl.origin;
    const network = [];

    page.on("request", (request) => {
      try {
        const url = new URL(request.url());
        if (url.origin !== loopbackOrigin) return;
        const headers = request.headers();
        network.push({
          phase: "request",
          method: request.method(),
          host: url.host,
          range: headers.range || "",
          origin: headers.origin || "",
          accept: headers.accept || "",
          secFetchMode: headers["sec-fetch-mode"] || "",
          secFetchDest: headers["sec-fetch-dest"] || "",
        });
      } catch {}
    });

    page.on("response", async (response) => {
      try {
        const url = new URL(response.url());
        if (url.origin !== loopbackOrigin) return;
        const headers = await response.allHeaders();
        network.push({
          phase: "response",
          status: response.status(),
          host: url.host,
          contentType: headers["content-type"] || "",
          contentLength: headers["content-length"] || "",
          contentRange: headers["content-range"] || "",
          acceptRanges: headers["accept-ranges"] || "",
          cors: headers["access-control-allow-origin"] || "",
        });
      } catch {}
    });

    const plainGet = await page.evaluate(async (url) => {
      const started = performance.now();
      try {
        const response = await fetch(url, { method: "GET", redirect: "follow" });
        const report = {
          ok: true,
          latencyMs: Math.round(performance.now() - started),
          status: response.status,
          contentType: response.headers.get("content-type") || "",
          contentLength: response.headers.get("content-length") || "",
          contentRange: response.headers.get("content-range") || "",
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
    }, resolved.url);

    print("PLAIN_GET_NO_RANGE", plainGet);

    await page.evaluate((url) => {
      const old = document.getElementById("music-p0-network-probe");
      old?.remove();

      const button = document.createElement("button");
      button.id = "music-p0-network-probe";
      button.textContent = "Music network probe";
      button.style.position = "fixed";
      button.style.left = "8px";
      button.style.bottom = "8px";
      button.style.zIndex = "2147483647";

      button.onclick = () => {
        window.__musicP0NetworkProbe = (async () => {
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
              readyState: audio.readyState,
              networkState: audio.networkState,
              errorCode: audio.error?.code || 0,
            }));
          }

          let playError = "";
          try {
            await audio.play();
          } catch (error) {
            playError = `${error?.name || "Error"}: ${error?.message || String(error)}`;
          }

          await new Promise((resolve) => setTimeout(resolve, 2500));

          const report = {
            playError,
            paused: audio.paused,
            readyState: audio.readyState,
            networkState: audio.networkState,
            currentTime: audio.currentTime || 0,
            duration: Number.isFinite(audio.duration) ? audio.duration : String(audio.duration),
            errorCode: audio.error?.code || 0,
            errorMessage: audio.error?.message || "",
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
    }, resolved.url);

    await page.locator("#music-p0-network-probe").click();
    const audio = await page.evaluate(() => window.__musicP0NetworkProbe);
    await page.waitForTimeout(300);

    print("AUDIO", audio);
    print("LOOPBACK_NETWORK", network);

    const audioRequests = network.filter((item) => item.phase === "request");
    const audioResponses = network.filter((item) => item.phase === "response");

    print("SUMMARY", {
      plainGetStatus: plainGet.status || null,
      requestMethods: audioRequests.map((item) => item.method),
      requestRanges: audioRequests.map((item) => item.range),
      responseStatuses: audioResponses.map((item) => item.status),
      responseTypes: audioResponses.map((item) => item.contentType),
      audioErrorCode: audio.errorCode || 0,
      audioAdvanced: Number(audio.currentTime || 0) > 0.25,
    });

    expect(resolved.ok).toBe(true);
  } finally {
    await app.close();
  }
});
