const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const { test, expect, _electron: electron } = require('@playwright/test');

test('trailer video stays visible and advancing through native fullscreen and exit', async ({}, testInfo) => {
  test.setTimeout(90_000);
  const desktopRoot = path.resolve(__dirname, '../..');
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-trailer-fullscreen-'));
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import TrailerModal from './src/renderer/components/TrailerModal.jsx';
        localStorage.setItem('orion_ambientGlow', '0');
        localStorage.setItem('orion_ambientProfile', JSON.stringify('off'));
        const candidates = [{id:'youtube:fixture123',site:'YouTube',providerKey:'fixture123',name:'Fixture trailer',type:'Trailer'}];
        createRoot(document.getElementById('root')).render(<TrailerModal candidates={candidates} title="Fullscreen fixture" onClose={() => { window.fixtureClosed = true; }} />);`,
      resolveDir: desktopRoot, loader: 'jsx',
    }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = fs.readFileSync(path.join(desktopRoot, 'src/renderer/styles/components/trailer-modal.css'), 'utf8');
  const fixturePath = path.join(userData, 'fixture.html');
  fs.writeFileSync(fixturePath, `<html><head><style>
    :root { --media-black:#000; --bg-elevated:#171720; --media-scrim:#111; }
    * {box-sizing:border-box} body {margin:0}
    ${css}</style></head><body><button id="opener" autofocus>Trailer</button><div id="root"></div>
    <script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
  let app;
  try {
    app = await electron.launch({ args: [desktopRoot, '--user-data-dir=' + userData, '--orion-electron-test'] });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(async ({ session }) => {
      const trailerSession = session.fromPartition('persist:trailer');
      trailerSession.protocol.unhandle('orion-trailer');
      trailerSession.protocol.handle('orion-trailer', request => {
        const child = new URL(request.url).pathname === '/fixture-video';
        const html = child ? `<html><style>html,body,video {width:100%;height:100%;margin:0;background:black} canvas{display:none}</style>
          <video autoplay muted playsinline></video><canvas width="640" height="360"></canvas><script>
          const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d'), video=document.querySelector('video');
          setInterval(()=>{ctx.fillStyle='rgb(24,180,92)';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.fillText(String(Date.now()),20,30)},30);
          video.srcObject=canvas.captureStream(30);video.play();
          </script></html>` : `<html><style>html,body,iframe {width:100%;height:100%;margin:0;border:0;background:black}</style>
          <iframe allow="autoplay; fullscreen" allowfullscreen src="orion-trailer://player/fixture-video"></iframe>
          <script>setTimeout(()=>window.dispatchEvent(new CustomEvent('orion-trailer-event',{detail:{candidateId:'youtube:fixture123',type:'playing'}})),250)</script></html>`;
        return new Response(html, {headers:{'content-type':'text/html'}});
      });
    });
    await page.goto('file:///' + fixturePath.replace(/\\/g, '/'));
    const webview = page.locator('webview');
    await expect(webview).toBeVisible();
    await expect(webview).not.toHaveClass(/is-preparing/);
    const guestId = await webview.evaluate(element => element.getWebContentsId());
    const videoTime = () => webview.evaluate(element => element.executeJavaScript(
      "document.querySelector('iframe').contentDocument.querySelector('video').currentTime"));
    await expect.poll(videoTime).toBeGreaterThan(0.2);
    const initialHeight = (await webview.boundingBox()).height;
    await webview.evaluate(element => element.executeJavaScript(
      "document.querySelector('iframe').contentDocument.querySelector('video').requestFullscreen()", true));
    await expect(page.locator('.trailer-modal')).toHaveClass(/is-fullscreen/);
    const bounds = await webview.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x:rect.x, y:rect.y, width:rect.width, height:rect.height, viewportWidth:innerWidth, viewportHeight:innerHeight };
    });
    expect(bounds.height, JSON.stringify(bounds)).toBeGreaterThan(bounds.viewportHeight - 2);
    expect(bounds.width).toBeGreaterThan(bounds.viewportWidth - 2);
    expect(Math.abs(bounds.x)).toBeLessThan(2);
    expect(Math.abs(bounds.y)).toBeLessThan(2);
    const fullscreenTime = await videoTime();
    await expect.poll(videoTime).toBeGreaterThan(fullscreenTime + 0.2);
    const capture = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('fixture.html'));
      const frame = await window.webContents.capturePage();
      const size = frame.getSize();
      const bitmap = frame.toBitmap();
      const offset = (Math.floor(size.height / 2) * size.width + Math.floor(size.width / 2)) * 4;
      return {png:frame.toPNG().toString('base64'), center:[...bitmap.subarray(offset,offset+3)]};
    });
    await testInfo.attach('fullscreen-video', {body:Buffer.from(capture.png,'base64'),contentType:'image/png'});
    // BGRA capture: confirm the displayed video is green, not a black guest surface.
    expect(capture.center[1]).toBeGreaterThan(120);
    expect(capture.center[1]).toBeGreaterThan(capture.center[0] + 40);
    await webview.evaluate(element => element.executeJavaScript('document.exitFullscreen()'));
    await expect(page.locator('.trailer-modal')).not.toHaveClass(/is-fullscreen/);
    await expect(page.getByRole('button', {name:'Close trailer'})).toBeVisible();
    await expect.poll(async () => (await webview.boundingBox()).height).toBeCloseTo(initialHeight, 0);
    expect(await webview.evaluate(element => element.getWebContentsId())).toBe(guestId);
    expect(await page.evaluate(() => Boolean(window.fixtureClosed))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    if (app) await app.close();
    // Leave fixture/profile cleanup to the OS; artifacts use a unique temp directory.
  }
});
