const path = require("path");
const os = require("os");
const { WebSocket } = require("ws");
const { test, expect, _electron: electron } = require("@playwright/test");

function waitForEnvelope(socket, predicate, timeoutMs = 4_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for Smart Connect response."));
    }, timeoutMs);
    const onMessage = (raw) => {
      const envelope = JSON.parse(String(raw));
      if (!predicate(envelope)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(envelope);
    };
    socket.on("message", onMessage);
  });
}

test("Smart Connect reports live transport and applies pointer commands", async ({}, testInfo) => {
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-smart-connect-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      `--user-data-dir=${userDataDir}`,
      "--disable-gpu",
    ],
  });
  await app.evaluate(({ app }) => {
    globalThis.__smartConnectRenderGone = null;
    app.once("render-process-gone", (_event, _contents, details) => {
      globalThis.__smartConnectRenderGone = details;
    });
  });
  let page = await app.firstWindow();
  let socket;

  try {
    try {
      await page.waitForTimeout(1_200);
    } catch (error) {
      const details = await app.evaluate(() => globalThis.__smartConnectRenderGone);
      throw new Error(`${error.message}; render-process-gone=${JSON.stringify(details)}`);
    }
    await page.waitForLoadState("domcontentloaded");
    const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
    if (await skipSignIn.count()) await skipSignIn.click();
    const continueCinema = page.getByRole("button", { name: "Continue to Cinema" });
    if (await continueCinema.count()) await continueCinema.click();

    const info = await page.evaluate(() => window.electron.getSmartConnectInfo());
    expect(info.connected).toBe(false);

    const pairResponse = await fetch("http://127.0.0.1:8924/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: info.pin,
        deviceId: "electron-test-mobile",
        deviceName: "Test Mobile",
      }),
    });
    const paired = await pairResponse.json();
    expect(pairResponse.ok).toBe(true);
    expect(paired.token).toBeTruthy();

    socket = new WebSocket(`ws://127.0.0.1:8924/api/socket?token=${paired.token}`);
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    await waitForEnvelope(socket, (message) => message.type === "status");

    await expect.poll(
      () => page.evaluate(() => window.electron.getSmartConnectInfo().then((value) => value.connected)),
    ).toBe(true);

    const commandId = "pointer-test-1";
    socket.send(JSON.stringify({
      version: 2,
      type: "command",
      deviceId: "electron-test-mobile",
      payload: {
        id: commandId,
        sequence: 1,
        action: "cursor_move",
        pointer: { x: 0.25, y: 0.4 },
        sentAt: Date.now(),
      },
    }));
    const acknowledgement = await waitForEnvelope(
      socket,
      (message) => message.type === "ack" && message.payload?.id === commandId,
    );
    expect(acknowledgement.payload.ok).toBe(true);
    expect(acknowledgement.payload.pointer).toEqual({ x: 0.25, y: 0.4 });

    const cursor = page.locator(".orion-virtual-cursor");
    await expect(cursor).toBeVisible();
    const cursorPosition = await cursor.evaluate((element) => ({
      left: Number.parseFloat(element.style.left),
      top: Number.parseFloat(element.style.top),
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    expect(cursorPosition.left / cursorPosition.width).toBeCloseTo(0.25, 1);
    expect(cursorPosition.top / cursorPosition.height).toBeCloseTo(0.4, 1);

    await expect(cursor).toHaveCount(0, { timeout: 5_000 });

    const restoreCommandId = "pointer-test-2";
    socket.send(JSON.stringify({
      version: 2,
      type: "command",
      deviceId: "electron-test-mobile",
      payload: {
        id: restoreCommandId,
        sequence: 2,
        action: "cursor_move",
        pointer: { x: 0.3, y: 0.45 },
        sentAt: Date.now(),
      },
    }));
    await waitForEnvelope(
      socket,
      (message) => message.type === "ack" && message.payload?.id === restoreCommandId,
    );
    await expect(cursor).toBeVisible();

    await cursor.evaluate((element) => {
      element.classList.add("spatial-remote-focused");
    });

    socket.close();
    await expect.poll(
      () => page.evaluate(() => window.electron.getSmartConnectInfo().then((value) => value.connected)),
    ).toBe(false);
    await expect(cursor).toHaveCount(0);
    await expect(page.locator(".spatial-remote-focused")).toHaveCount(0);
  } finally {
    try { socket?.close(); } catch {}
    await app.close();
  }
});
