const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const layout = loader()('apps/mobile/src/components/player/playerDrawerLayout.ts');
const zero = { top: 0, right: 0, bottom: 0, left: 0 };
for (const [width, height] of [[240, 320], [360, 780], [780, 360], [1080, 2400], [2400, 1080]]) {
  test(`drawer and precise hit region remain bounded at ${width}x${height}`, () => {
    const result = layout.resolvePlayerDrawerLayout(width, height, zero);
    assert.equal(result.edge, 'right'); assert.equal(result.hit.width, 44); assert.equal(result.hit.height, 44);
    assert.equal(result.visualWidth, 14); assert.equal(result.visualHeight, 28);
    for (const rect of [result.hit, result.body]) {
      assert.ok(rect.x >= 0 && rect.y >= 0); assert.ok(rect.x + rect.width <= width); assert.ok(rect.y + rect.height <= height);
    }
    assert.ok(result.body.x >= result.hit.width, 'open grip fits beside the drawer');
    assert.ok(result.closedTranslation > result.body.width - 1, 'closed body retracts completely past edge');
  });
}
test('right cutout uses left fallback and rotation recalculates safe geometry', () => {
  const insets = { top: 24, right: 64, bottom: 16, left: 0 };
  const wide = layout.resolvePlayerDrawerLayout(780, 360, insets);
  assert.equal(wide.edge, 'left'); assert.ok(wide.body.x + wide.body.width + wide.hit.width <= 716);
  const tall = layout.resolvePlayerDrawerLayout(360, 780, { ...insets, right: 0 });
  assert.equal(tall.edge, 'right'); assert.notEqual(wide.hit.y, tall.hit.y); assert.notEqual(wide.body.height, tall.body.height);
});
test('occupied right control region falls back left; both occupied edges fail closed', () => {
  const right = { x: 700, y: 0, width: 80, height: 360 };
  const result = layout.resolvePlayerDrawerLayout(780, 360, zero, [right]);
  assert.equal(result.edge, 'left'); assert.equal(result.available, true);
  assert.equal(layout.intersects(result.hit, right), false);
  assert.equal(layout.resolvePlayerDrawerLayout(780, 360, zero, [right, { x: 0, y: 0, width: 80, height: 360 }]).available, false);
});
test('drawer reserves subtitle/provider bottom controls and top controls instead of covering them', () => {
  const result = layout.resolvePlayerDrawerLayout(780, 360, zero);
  assert.ok(result.body.y >= 360 * .14); assert.ok(result.body.y + result.body.height <= 360 * .77 + 1e-8);
});
test('one controller-driven drawer animates connected grip/body, blocks sheets and removes closed ghosts', () => {
  const drawer = read('apps/mobile/src/components/player/PlayerEdgeDrawer.tsx');
  for (const pattern of [/progress.stopAnimation\(\)/, /animation.stop\(\)/, /setMounted\(false\)/,
    /reducedMotion \? 0 : 180/, /controller.state.overlay !== 'none'/, /if \(blocked \|\| !layout.available\) return null/,
    /pointerEvents=\{visible \? 'auto' : 'none'\}/, /accessibilityElementsHidden=\{!visible\}/,
    /layout.edge === 'right' \? -layout.body.width : layout.body.width/, /ScrollView/]) assert.match(drawer, pattern);
  for (const file of ['PlayerEdgeDrawer.tsx', 'PlayerChromeHandle.tsx']) {
    assert.doesNotMatch(read('apps/mobile/src/components/player/' + file), /#[0-9a-f]{3,8}|rgba?\(/i);
  }
  assert.match(read('apps/mobile/src/features/playback/EmbeddedPlayerHud.tsx'), /PlayerEdgeDrawer/);
  assert.match(read('apps/mobile/src/components/player/PlayerHUD.tsx'), /PlayerEdgeDrawer/);
});
test('immersive scope hides bars while paused or controls visible, reasserts on rotation and restores on exit', async () => {
  const harness = hookHarness(); const commands = []; let appState; let dimensions = { width: 780, height: 360 };
  const hook = loader({ react: harness.react, 'react-native': { Platform: { OS: 'android' },
    NativeModules: { OrionPlayerSystemUi: Object.fromEntries(['enter', 'hide', 'show', 'exit'].map(name => [name, () => commands.push(name)])) },
    AppState: { addEventListener: (_event, fn) => { appState = fn; return { remove() {} }; } },
    useWindowDimensions: () => dimensions } })('apps/mobile/src/features/playback/immersiveSystemUi.ts').usePlayerImmersiveSystemUi;
  harness.start(({ active, playing, hidden }) => hook(active, playing, hidden), { active: true, playing: false, hidden: false });
  assert.deepEqual(commands, ['enter', 'hide']);
  dimensions = { width: 360, height: 780 }; harness.update({ active: true, playing: false, hidden: false });
  assert.equal(commands.at(-1), 'hide'); appState('background'); assert.equal(commands.at(-1), 'exit');
  appState('active'); assert.equal(commands.at(-1), 'enter'); assert.ok(!commands.includes('show'));
  harness.dispose(); assert.equal(commands.at(-1), 'exit');
  const native = read('apps/mobile/plugins/orion-cinema-webview-native/OrionPlayerSystemUiModule.kt');
  assert.match(native, /addOnLayoutChangeListener\(layoutListener\)/); assert.match(native, /removeOnLayoutChangeListener\(layoutListener\)/);
  assert.match(native, /addOnWindowFocusChangeListener\(focusListener\)/); assert.match(native, /removeOnWindowFocusChangeListener\(focusListener\)/);
  assert.match(native, /if \(!owned\) return@withWindow/);
});
