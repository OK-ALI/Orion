const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect, _electron: electron } = require("@playwright/test");

test("trailer wrapper is served only inside Orion's isolated trailer session", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-trailer-protocol-"));
  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      "--user-data-dir=" + userDataDir,
      "--disable-gpu",
      "--orion-electron-test",
    ],
  });
  try {
    await app.firstWindow();
    const result = await app.evaluate(async ({ BrowserWindow, session }) => {
      const isolatedSession = session.fromPartition("persist:trailer");
      const trailer = new BrowserWindow({
        show: false,
        webPreferences: {
          partition: "persist:trailer",
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      try {
        await trailer.loadURL("orion-trailer://player/embed?provider=youtube&candidate=youtube%3Afixture&key=fixture123");
        const page = await trailer.webContents.executeJavaScript(`({
          protocol: location.protocol,
          hasPlayer: Boolean(document.querySelector('#player')),
          hasCsp: Boolean(document.querySelector('meta[http-equiv="Content-Security-Policy"]')),
          hasElectron: typeof window.electron !== 'undefined',
          text: document.body.innerText
        })`);
        return {
          ...page,
          stableSessionIdentity: trailer.webContents.session === isolatedSession,
          unsupportedPartitionGetterAbsent: typeof trailer.webContents.session.getPartition === "undefined",
        };
      } finally {
        trailer.destroy();
      }
    });

    expect(result).toMatchObject({
      protocol: "orion-trailer:",
      hasPlayer: true,
      hasCsp: true,
      hasElectron: false,
      text: "",
      stableSessionIdentity: true,
      unsupportedPartitionGetterAbsent: true,
    });
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
