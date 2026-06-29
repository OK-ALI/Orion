const path = require("path");
const os = require("os");
const http = require("http");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Orion starts without an uncaught renderer error", async ({}, testInfo) => {
  const popoutServer = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><body style='margin:0;background:black'><video></video></body></html>");
  });
  await new Promise((resolve) => popoutServer.listen(0, "127.0.0.1", resolve));
  const popoutUrl = `http://127.0.0.1:${popoutServer.address().port}/player`;
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-pw-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      `--user-data-dir=${userDataDir}`,
      "--disable-gpu",
    ],
  });
  await app.evaluate(({ app }) => {
    globalThis.__orionTestRenderGone = null;
    app.once("render-process-gone", (_event, _contents, details) => {
      globalThis.__orionTestRenderGone = details;
    });
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.waitForLoadState("domcontentloaded");
  } catch (error) {
    const details = await app.evaluate(() => globalThis.__orionTestRenderGone);
    throw new Error(`${error.message}; render-process-gone=${JSON.stringify(details)}`);
  }
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.locator(".titlebar")).toBeVisible();
  await expect(page.locator(".titlebar-controls button")).toHaveCount(3);
  const bridge = await page.evaluate(() => ({
    available: Boolean(window.electron),
    installDownloaderTools: typeof window.electron?.installDownloaderTools,
    resolveAllManga: typeof window.electron?.resolveAllManga,
    openPipWindow: typeof window.electron?.openPipWindow,
    controlVideo: typeof window.electron?.controlVideo,
  }));
  expect(bridge).toEqual({
    available: true,
    installDownloaderTools: "function",
    resolveAllManga: "function",
    openPipWindow: "function",
    controlVideo: "function",
  });

  const popoutResult = await page.evaluate(
    (url) => window.electron.openPipWindow(url, "Orion smoke test"),
    popoutUrl,
  );
  expect(popoutResult.ok, popoutResult.error).toBe(true);
  await expect.poll(async () => (await app.windows()).length).toBe(2);
  const popout = (await app.windows()).find((window) => window !== page);
  await expect(popout.locator("#__orion_transport__")).toBeVisible();
  await expect(popout.locator("#__orion_ambient__")).toBeAttached();
  await page.evaluate(() => window.electron.closePipWindow());
  await expect.poll(async () => (await app.windows()).length).toBe(1);
  expect(errors).toEqual([]);
  await app.close();
  await new Promise((resolve) => popoutServer.close(resolve));
});
