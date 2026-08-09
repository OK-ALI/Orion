const path = require("path");
const os = require("os");
const crypto = require("crypto");
const https = require("https");
const { WebSocket } = require("ws");
const { test, expect, _electron: electron } = require("@playwright/test");

function secureJson(baseUrl, pathname, body, attempts = 20) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body || {}));
    const request = https.request(`${baseUrl}${pathname}`, {
      method: "POST",
      rejectUnauthorized: false,
      headers: { "Content-Type": "application/json", "Content-Length": payload.length },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        value: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    request.once("error", (error) => {
      if (attempts > 1 && error.code === "ECONNREFUSED") {
        setTimeout(() => secureJson(baseUrl, pathname, body, attempts - 1).then(resolve, reject), 250);
        return;
      }
      reject(error);
    });
    request.setTimeout(5_000, () => request.destroy(new Error(`Timed out requesting ${pathname}`)));
    request.end(payload);
  });
}

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
  test.setTimeout(90_000);
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-smart-connect-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      `--user-data-dir=${userDataDir}`,
      "--disable-gpu",
      "--orion-electron-test",
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

    let info = await page.evaluate(() => window.electron.getSmartConnectInfo());
    expect(info.connected).toBe(false);
    if (!info.networkPolicy?.allowed) {
      await page.evaluate(() => window.electron.allowSmartConnectPublicNetwork());
      info = await page.evaluate(() => window.electron.getSmartConnectInfo());
      expect(info.networkPolicy.allowed).toBe(true);
    }

    const baseUrl = `https://${info.ip}:${info.port}`;
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const pairResponse = await secureJson(baseUrl, "/api/pair/start", {
      pin: info.pin,
      deviceId: "electron-test-mobile",
      deviceName: "Test Mobile",
      publicKey: publicKeyBase64,
    });
    expect(pairResponse.ok).toBe(true);
    const pairingId = pairResponse.value.transcript.pairingId;
    const desktopConfirmation = await page.evaluate(() => window.electron.confirmSmartConnectPairing());
    expect(desktopConfirmation.ok).toBe(true);
    const mobileConfirmation = await secureJson(baseUrl, "/api/pair/confirm", {
      pairingId,
      deviceId: "electron-test-mobile",
    });
    expect(mobileConfirmation.value.paired).toBe(true);

    const challengeResponse = await secureJson(baseUrl, "/api/auth/challenge", {
      deviceId: "electron-test-mobile",
    });
    expect(challengeResponse.ok).toBe(true);
    const signature = crypto.sign(
      "sha256",
      Buffer.from(challengeResponse.value.nonce),
      privateKey,
    ).toString("base64");
    const ticketResponse = await secureJson(baseUrl, "/api/auth/ticket", {
      deviceId: "electron-test-mobile",
      signature,
    });
    expect(ticketResponse.ok).toBe(true);

    socket = new WebSocket(baseUrl.replace("https:", "wss:") + "/api/socket", {
      rejectUnauthorized: false,
      headers: { "X-Orion-Ticket": ticketResponse.value.ticket.ticketId },
    });
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
      version: 3,
      type: "command",
      deviceId: "electron-test-mobile",
      connectionId: ticketResponse.value.connectionId,
      sequence: 1,
      commandId,
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
      version: 3,
      type: "command",
      deviceId: "electron-test-mobile",
      connectionId: ticketResponse.value.connectionId,
      sequence: 2,
      commandId: restoreCommandId,
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
