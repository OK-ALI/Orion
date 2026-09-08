const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  POINTER_COORD_LIMIT,
  createPointerInputRouter,
  normalizePointerPayload,
} = require("../../../src/main/player/pointerInput");

function fakeContents(id, options = {}) {
  const events = [];
  const messages = [];
  const order = [];
  return {
    id,
    events,
    messages,
    order,
    focused: false,
    hostWebContents: options.hostWebContents || null,
    isDestroyed: () => false,
    getType: () => options.type || "window",
    getOwnerBrowserWindow: () => options.ownerWindow || null,
    sendInputEvent: (event) => {
      events.push(event);
      order.push({ kind: "input", type: event.type });
    },
    send: (channel, payload) => {
      messages.push({ channel, payload });
      order.push({ kind: "visual", action: payload?.action });
    },
    focus() { this.focused = true; },
  };
}

test("pointer payloads are finite, integer, and bounded", () => {
  assert.deepEqual(normalizePointerPayload({
    x: 10.6,
    y: -3,
    xRatio: 1.4,
    yRatio: -0.2,
    webContentsId: "42",
  }), {
    x: 11,
    y: 0,
    xRatio: 1,
    yRatio: 0,
    webContentsId: 42,
  });
  assert.equal(normalizePointerPayload({ x: Infinity }).x, 0);
  assert.equal(normalizePointerPayload({ x: POINTER_COORD_LIMIT + 500 }).x, POINTER_COORD_LIMIT);
});

test("main renderer pointer movement stays on the sending WebContents by default", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const router = createPointerInputRouter({ getMainWindow: () => mainWindow, resolveWebContentsById: () => null });

  assert.deepEqual(router.move(sender, { x: 200, y: 120 }), { ok: true, targetId: 10 });
  assert.deepEqual(sender.events, [{ type: "mouseMove", x: 200, y: 120 }]);
});

test("trusted main renderer can route a click into its attached player webview", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const guest = fakeContents(22, { type: "webview", hostWebContents: sender, ownerWindow: mainWindow });
  const router = createPointerInputRouter({
    getMainWindow: () => mainWindow,
    resolveWebContentsById: (id) => id === guest.id ? guest : null,
  });

  assert.deepEqual(router.click(sender, { webContentsId: 22, x: 50, y: 70 }), { ok: true, targetId: 22 });
  assert.equal(guest.focused, true);
  assert.deepEqual(guest.events.map((event) => event.type), ["mouseMove", "mouseDown", "mouseUp"]);
  assert.deepEqual(guest.events[1], { type: "mouseDown", x: 50, y: 70, button: "left", clickCount: 1 });
});

test("renderer cannot inject pointer input into an unrelated WebContents", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const foreignWindow = { id: 2 };
  const foreign = fakeContents(99, { type: "window", ownerWindow: foreignWindow });
  const router = createPointerInputRouter({
    getMainWindow: () => mainWindow,
    resolveWebContentsById: () => foreign,
  });

  const result = router.click(sender, { webContentsId: 99, x: 1, y: 1 });
  assert.equal(result.ok, false);
  assert.equal(foreign.events.length, 0);
});

test("trusted main renderer can route normalized pointer input into the active pop-out window", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const popoutWindow = {
    id: 2,
    getContentBounds: () => ({ x: 200, y: 100, width: 640, height: 360 }),
  };
  const popout = fakeContents(55, { type: "window", ownerWindow: popoutWindow });
  const router = createPointerInputRouter({
    getMainWindow: () => mainWindow,
    resolveWebContentsById: (id) => id === popout.id ? popout : null,
    isTrustedDetachedTarget: (_sender, target) => target === popout,
  });

  assert.deepEqual(
    router.click(sender, {
      webContentsId: 55,
      xRatio: 0.5,
      yRatio: 0.25,
    }),
    { ok: true, targetId: 55 },
  );
  assert.equal(popout.focused, true);
  assert.deepEqual(popout.events[0], { type: "mouseMove", x: 320, y: 90 });
  assert.deepEqual(popout.events[1], {
    type: "mouseDown",
    x: 320,
    y: 90,
    button: "left",
    clickCount: 1,
  });
  assert.equal(popout.messages.length, 1);
  assert.equal(popout.messages[0].channel, "popout-remote-pointer");
  assert.deepEqual(
    { ...popout.messages[0].payload, sentAt: undefined },
    { action: "click", x: 320, y: 90, sentAt: undefined },
  );
  assert.equal(Number.isFinite(popout.messages[0].payload.sentAt), true);
  assert.deepEqual(popout.order.map((entry) => entry.kind), [
    "input", "input", "input", "visual",
  ]);
});

test("detached movement dispatches native input before best-effort cursor visualization", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const popoutWindow = {
    id: 2,
    getContentBounds: () => ({ width: 800, height: 450 }),
  };
  const popout = fakeContents(55, { type: "window", ownerWindow: popoutWindow });
  const router = createPointerInputRouter({
    getMainWindow: () => mainWindow,
    resolveWebContentsById: () => popout,
    isTrustedDetachedTarget: (_sender, target) => target === popout,
  });

  assert.deepEqual(router.move(sender, {
    webContentsId: 55,
    xRatio: 0.25,
    yRatio: 0.5,
  }), { ok: true, targetId: 55 });
  assert.deepEqual(popout.events, [{ type: "mouseMove", x: 200, y: 225 }]);
  assert.equal(popout.messages.length, 1);
  assert.equal(popout.messages[0].channel, "popout-remote-pointer");
  assert.deepEqual(
    { ...popout.messages[0].payload, sentAt: undefined },
    { action: "move", x: 200, y: 225, sentAt: undefined },
  );
  assert.equal(Number.isFinite(popout.messages[0].payload.sentAt), true);
  assert.deepEqual(popout.order, [
    { kind: "input", type: "mouseMove" },
    { kind: "visual", action: "move" },
  ]);
});

test("detached visual cleanup does not synthesize native pointer movement", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const popoutWindow = {
    id: 2,
    getContentBounds: () => ({ width: 800, height: 450 }),
  };
  const popout = fakeContents(55, { type: "window", ownerWindow: popoutWindow });
  const router = createPointerInputRouter({
    getMainWindow: () => mainWindow,
    resolveWebContentsById: () => popout,
    isTrustedDetachedTarget: (_sender, target) => target === popout,
  });

  assert.deepEqual(router.move(sender, {
    webContentsId: 55,
    xRatio: 0.25,
    yRatio: 0.5,
    visualAction: "hide",
  }), { ok: true, targetId: 55 });
  assert.deepEqual(popout.events, []);
  assert.equal(popout.messages.length, 1);
  assert.equal(popout.messages[0].channel, "popout-remote-pointer");
  assert.deepEqual(
    { ...popout.messages[0].payload, sentAt: undefined },
    { action: "hide", x: 200, y: 225, sentAt: undefined },
  );
  assert.equal(Number.isFinite(popout.messages[0].payload.sentAt), true);
});

test("stale detached targets are rejected when the pop-out owner no longer trusts them", () => {
  const sender = fakeContents(10);
  const mainWindow = { id: 1, webContents: sender, isDestroyed: () => false };
  const oldPopoutWindow = {
    id: 2,
    getContentBounds: () => ({ width: 640, height: 360 }),
  };
  const stale = fakeContents(55, { type: "window", ownerWindow: oldPopoutWindow });
  const router = createPointerInputRouter({
    getMainWindow: () => mainWindow,
    resolveWebContentsById: () => stale,
    isTrustedDetachedTarget: () => false,
  });

  const result = router.move(sender, {
    webContentsId: 55,
    xRatio: 0.2,
    yRatio: 0.4,
  });

  assert.equal(result.ok, false);
  assert.equal(stale.events.length, 0);
  assert.equal(stale.messages.length, 0);
});

test("pop-out visual cursor remains non-interactive, latest-target-only, and cleanup-bound", () => {
  const preloadSource = fs.readFileSync(
    path.join(__dirname, "../../../popout-preload.js"),
    "utf8",
  );
  const rendererSource = fs.readFileSync(
    path.join(__dirname, "../../../src/renderer/app/hooks/useSmartConnectRemoteCommands.js"),
    "utf8",
  );
  const smoothingSource = fs.readFileSync(
    path.join(__dirname, "../../../src/renderer/features/player/services/remotePointerSmoothing.js"),
    "utf8",
  );

  assert.match(preloadSource, /pointer-events:\s*none\s*!important/);
  assert.match(preloadSource, /remoteCursorTarget\s*=\s*normalizeRemoteCursorPoint\(payload\)/);
  assert.match(preloadSource, /requestAnimationFrame\(renderRemoteCursorFrame\)/);
  assert.match(preloadSource, /REMOTE_CURSOR_INACTIVITY_MS\s*=\s*4_000/);
  assert.match(preloadSource, /REMOTE_CURSOR_MAX_SIGNAL_AGE_MS\s*=\s*250/);
  assert.match(preloadSource, /Date\.now\(\)\s*-\s*sentAt\s*>\s*REMOTE_CURSOR_MAX_SIGNAL_AGE_MS/);
  assert.match(preloadSource, /window\.addEventListener\("pagehide",\s*clearRemoteCursorVisual\)/);
  assert.match(preloadSource, /_lastUrl\s*=\s*location\.href;\s*clearRemoteCursorVisual\(\)/s);
  assert.doesNotMatch(preloadSource, /remoteCursor(?:Queue|History|Points)/);
  assert.match(smoothingSource, /REMOTE_POINTER_VISUAL_SETTLE_PX\s*=\s*0\.35/);
  assert.match(smoothingSource, /MAX_FRAME_DELTA_MS\s*=\s*34/);
  assert.match(smoothingSource, /SMALL_MOTION_TAU_MS\s*=\s*6/);
  assert.match(smoothingSource, /MEDIUM_MOTION_TAU_MS\s*=\s*5/);
  assert.match(smoothingSource, /FAST_MOTION_TAU_MS\s*=\s*4/);
  assert.match(preloadSource, /REMOTE_CURSOR_SETTLE_PX\s*=\s*0\.35/);
  assert.match(preloadSource, /Math\.min\(34,/);
  assert.match(preloadSource, /distance\s*>=\s*180\s*\?\s*4\s*:\s*distance\s*>=\s*72\s*\?\s*5\s*:\s*6/);

  assert.match(rendererSource, /target\.route\?\.kind\s*===\s*"detached"/);
  assert.match(rendererSource, /mainCursor\.style\.opacity\s*=\s*"0"/);
  assert.match(rendererSource, /scheduleRemoteCursorCleanup\(\{\s*showMainCursor:\s*false\s*\}\)/);
  assert.match(rendererSource, /visualAction:\s*"hide"/);
});

