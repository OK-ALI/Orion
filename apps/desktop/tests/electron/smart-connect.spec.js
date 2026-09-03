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

    // Internet status must not gate the existing authenticated LAN transport.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      window.dispatchEvent(new Event("offline"));
    });
    await expect(page.locator(".titlebar-network")).toHaveAttribute("aria-label", "Offline");
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
    // cursor_move is realtime/droppable by protocol design and is intentionally
    // not ACKed. Validate application through the rendered cursor instead.
    const cursor = page.locator(".orion-virtual-cursor");
    await expect(cursor).toBeVisible();
    await expect.poll(
      () => cursor.evaluate((element) => Number(element.dataset.x) / window.innerWidth),
    ).toBeCloseTo(0.25, 1);
    await expect.poll(
      () => cursor.evaluate((element) => Number(element.dataset.y) / window.innerHeight),
    ).toBeCloseTo(0.4, 1);

    // Reliable commands still use the ACK contract. Keep explicit E2E coverage
    // for that path without imposing ACK semantics on realtime pointer traffic.
    const reliableCommandId = "reliable-home-test";
    socket.send(JSON.stringify({
      version: 3,
      type: "command",
      deviceId: "electron-test-mobile",
      connectionId: ticketResponse.value.connectionId,
      sequence: 2,
      commandId: reliableCommandId,
      payload: {
        id: reliableCommandId,
        sequence: 2,
        action: "home",
        sentAt: Date.now(),
      },
    }));
    const reliableAcknowledgement = await waitForEnvelope(
      socket,
      (message) => message.type === "ack" && message.payload?.id === reliableCommandId,
    );
    expect(reliableAcknowledgement.payload.ok).toBe(true);

    await expect(cursor).toHaveCSS("opacity", "0", { timeout: 5_000 });

    const restoreCommandId = "pointer-test-2";
    socket.send(JSON.stringify({
      version: 3,
      type: "command",
      deviceId: "electron-test-mobile",
      connectionId: ticketResponse.value.connectionId,
      sequence: 3,
      commandId: restoreCommandId,
      payload: {
        id: restoreCommandId,
        sequence: 3,
        action: "cursor_move",
        pointer: { x: 0.3, y: 0.45 },
        sentAt: Date.now(),
      },
    }));
    await expect(cursor).toBeVisible();

    // Exercise real remote-hover ownership instead of attaching the focus class
    // to the virtual cursor. Production only assigns spatial-remote-focused to
    // interactive UI elements beneath the remote pointer.
    await page.evaluate(() => {
      const target = document.createElement("button");
      target.id = "e2e-smartconnect-hover-target";
      target.type = "button";
      target.textContent = "Smart Connect E2E hover target";
      Object.assign(target.style, {
        position: "fixed",
        left: "calc(30vw - 30px)",
        top: "calc(45vh - 30px)",
        width: "60px",
        height: "60px",
        zIndex: "2147483646",
        opacity: "0.01",
        pointerEvents: "auto",
      });
      document.body.appendChild(target);
    });

    const hoverTarget = page.locator("#e2e-smartconnect-hover-target");
    const hoverCommandId = "pointer-hover-test";
    socket.send(JSON.stringify({
      version: 3,
      type: "command",
      deviceId: "electron-test-mobile",
      connectionId: ticketResponse.value.connectionId,
      sequence: 4,
      commandId: hoverCommandId,
      payload: {
        id: hoverCommandId,
        sequence: 4,
        action: "cursor_move",
        pointer: { x: 0.3, y: 0.45 },
        sentAt: Date.now(),
      },
    }));
    await expect(hoverTarget).toHaveClass(/spatial-remote-focused/);

    socket.close();
    await expect.poll(
      () => page.evaluate(() => window.electron.getSmartConnectInfo().then((value) => value.connected)),
    ).toBe(false);
    await expect(cursor).toHaveCSS("opacity", "0");
    await expect(hoverTarget).not.toHaveClass(/spatial-remote-focused/);
  } finally {
    try { socket?.close(); } catch {}
    await app.close();
  }
});
