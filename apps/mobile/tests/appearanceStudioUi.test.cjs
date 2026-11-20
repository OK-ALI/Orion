'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createStudioHarness, saved, key, testing, viewports } = require('./helpers/appearanceStudioHarness.cjs');

function fixture(t, options) {
  const harness = createStudioHarness(options);
  t.after(() => harness.unmount());
  return harness;
}

const frame = () => testing.act(async () => { await new Promise(requestAnimationFrame); });
const fixed = /Fixed theme,/;
const dark = /Dark theme,/;
const changeColor = /Change Color,/;
const openHex = f => { f.press(changeColor); f.press('Enter HEX'); };

test('Studio uses the real Settings entry and returns to the same mounted scroll view', t => {
  const f = fixture(t, { settings: true });
  const appearance = f.get('button', { name: 'Appearance Studio' });
  const settingsScroll = appearance.parentElement;
  assert.ok(f.rendered.getByText('Jump to section'));
  assert.equal(f.rendered.getByLabelText('Follow system appearance').checked, false);
  f.press('Appearance Studio');
  assert.ok(f.get('heading', { name: 'Appearance Studio' }));
  f.press('Close');
  assert.equal(f.get('button', { name: 'Appearance Studio' }), appearance);
  assert.ok(settingsScroll.isConnected);
  assert.ok(f.rendered.getByLabelText('Reduced motion'));
  assert.equal(f.writes.length, 0);
});

test('Follow System assignments, independent preview, and HEX use one real V2 write on Studio Apply', t => {
  const f = fixture(t);
  const legacy = JSON.stringify({ schemaVersion: 1, theme: 'slate', customAccent: '#DEFACE' });
  f.env.records.mobileThemePreferencesV1 = legacy;
  f.press(fixed);
  assert.equal(f.get('radio', { name: 'Custom theme' }).getAttribute('aria-checked'), 'true');
  f.switchFollow();
  assert.equal(f.rendered.getByLabelText('Follow system appearance').checked, true);
  assert.ok(f.rendered.getByText('Projector Silver'));
  f.press(dark);
  assert.equal(f.query('radio', { name: 'Projector Silver theme' }), null);
  f.choose('Custom theme');
  f.choose('Preview Light');
  assert.ok(f.get('heading', { name: 'Preview, Projector Silver, light appearance' }));
  openHex(f);
  assert.equal(f.rendered.getAllByRole('textbox').length, 1);
  assert.equal(f.get('textbox').value, saved.customAccent);
  f.hex('aabbcc');
  f.press('Use Color');
  assert.deepEqual(f.state.appearanceChoices, { manualTheme: 'custom', followSystem: false,
    lightTheme: 'projector-silver', darkTheme: 'slate', customAccent: saved.customAccent });
  assert.equal(f.state.theme.accent, saved.customAccent);
  assert.equal(f.attempts.length, 0);
  assert.ok(f.get('heading', { name: 'Preview, Projector Silver, light appearance' }));
  f.press('Apply');
  assert.equal(f.query('heading', { name: 'Appearance Studio' }), null);
  assert.deepEqual(f.writes, [{ name: key, value: { ...saved, followSystem: true, darkTheme: 'custom', customAccent: '#AABBCC' } }]);
  assert.equal(f.env.records.mobileThemePreferencesV1, legacy);
  const restarted = fixture(t, { records: f.env.records, scheme: 'light' });
  assert.equal(restarted.state.theme.id, 'projector-silver');
  restarted.scheme('dark', true);
  assert.equal(restarted.state.theme.accent, '#AABBCC');
  assert.equal(restarted.writes.length, 0);
});

test('The visual area and step controls produce a valid accent without a keyboard', t => {
  const f = fixture(t);
  const heading = f.get('heading', { name: 'Theme' }).style.color;
  f.press(changeColor);
  assert.equal(f.query('textbox'), null);
  f.choose('Green hue');
  f.areaTap(100, 0, 100, 100);
  assert.equal(f.rendered.getByTestId('studio-picker-sample').style.backgroundColor, 'rgb(0, 255, 0)');
  const saturation = f.get('slider', { name: 'Saturation' });
  assert.equal(saturation.getAttribute('aria-valuenow'), '100');
  f.press('Decrease saturation');
  assert.equal(saturation.getAttribute('aria-valuenow'), '95');
  f.adjust('Saturation', 'increment');
  assert.equal(saturation.getAttribute('aria-valuenow'), '100');
  f.press('Decrease brightness');
  assert.equal(f.get('slider', { name: 'Brightness' }).getAttribute('aria-valuenow'), '95');
  const proposed = f.rendered.getByTestId('studio-picker-sample').style.backgroundColor;
  f.press('Use Color');
  assert.equal(f.rendered.getByTestId('studio-preview-play').style.backgroundColor, proposed);
  assert.equal(f.get('heading', { name: 'Theme' }).style.color, heading);
  assert.equal(f.state.theme.accent, saved.customAccent);
  assert.equal(f.attempts.length, 0);
  f.press(changeColor);
  assert.equal(f.rendered.getByTestId('studio-picker-sample').style.backgroundColor, proposed);
  f.choose('Rose hue');
  f.press('Cancel color');
  assert.equal(f.rendered.getByTestId('studio-preview-play').style.backgroundColor, proposed);
  f.press('Cancel');
  f.press('Discard changes');
  assert.equal(f.attempts.length, 0);
});

test('Shade movement, steps, hue, marker, swatch and HEX share the same selection', t => {
  const f = fixture(t);
  f.press(changeColor);
  f.choose('Green hue');
  f.measureArea(200, 100);
  const marker = f.rendered.getByTestId('studio-shade-marker');
  const percentage = name => Number(f.get('slider', { name }).getAttribute('aria-valuenow'));
  function matches(saturation, brightness, left, top) {
    assert.deepEqual([percentage('Saturation'), percentage('Brightness')], [saturation, brightness]);
    assert.ok(Math.abs(parseFloat(marker.style.left) - left) < .01, 'saturation marker position');
    assert.ok(Math.abs(parseFloat(marker.style.top) - top) < .01, 'brightness marker position');
  }

  assert.equal(f.canScrollPicker(), true);
  f.areaGesture('start', 40, 80);
  assert.equal(f.canScrollPicker(), false);
  assert.equal(f.canTransferShadeResponder(), false);
  matches(20, 20, 30, 70);
  f.areaGesture('move', 120, 80);
  matches(60, 20, 110, 70);
  f.areaGesture('move', 120, 30);
  matches(60, 70, 110, 20);
  f.areaGesture('move', 180, 20);
  matches(90, 80, 170, 10);
  for (const [x, y, s, b, left, top] of [
    [-10, -10, 0, 100, 0, 0], [210, -10, 100, 100, 180, 0],
    [-10, 110, 0, 0, 0, 80], [210, 110, 100, 0, 180, 80],
    [-10, 50, 0, 50, 0, 40], [210, 50, 100, 50, 180, 40],
    [100, -10, 50, 100, 90, 0], [100, 110, 50, 0, 90, 80],
  ]) {
    f.areaGesture('move', x, y);
    matches(s, b, left, top);
  }
  f.areaGesture('move', 210, -10);
  f.areaGesture('end', 230, -30);
  matches(100, 100, 180, 0);
  assert.equal(f.canScrollPicker(), true);
  f.press('Decrease saturation');
  matches(95, 100, 180, 0);
  f.press('Decrease brightness');
  matches(95, 95, 180, 0);
  f.adjust('Saturation', 'decrement');
  f.adjust('Brightness', 'decrement');
  matches(90, 90, 170, 0);
  f.press('Decrease brightness');
  matches(90, 85, 170, 5);
  f.choose('Red hue');
  matches(90, 85, 170, 5);
  assert.equal(f.rendered.getByTestId('studio-picker-sample').style.backgroundColor, 'rgb(217, 22, 22)');
  assert.ok(f.rendered.getByText('Red, #D91616'));
  f.press('Enter HEX');
  assert.equal(f.get('textbox').value, '#D91616');
  f.areaGesture('start', 100, 50);
  f.areaGesture('terminate');
  matches(50, 50, 90, 40);
  assert.equal(f.canScrollPicker(), true);
  assert.equal(f.attempts.length, 0);
});

test('Dragging is picker-local until Use Color, and only Studio Apply persists it', t => {
  const f = fixture(t);
  function dragGreen() {
    f.press(changeColor);
    f.choose('Green hue');
    f.measureArea(200, 100);
    f.areaGesture('start', 50, 50);
    f.areaGesture('move', 200, 0);
    f.areaGesture('end');
    assert.equal(f.attempts.length, 0);
  }
  dragGreen();
  f.press('Cancel color');
  f.press(changeColor);
  f.press('Enter HEX');
  assert.equal(f.get('textbox').value, saved.customAccent);
  f.press('Cancel color');
  dragGreen();
  f.press('Use Color');
  assert.equal(f.rendered.getByTestId('studio-preview-play').style.backgroundColor, 'rgb(0, 255, 0)');
  assert.equal(f.state.appearanceChoices.customAccent, saved.customAccent);
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.deepEqual(f.writes, [{ name: key, value: { ...saved, customAccent: '#00FF00' } }]);
});

test('Invalid HEX is announced without reopening the IME, and Back preserves the correct draft boundary', async t => {
  const f = fixture(t);
  openHex(f);
  f.hex('#22');
  f.press('Hide HEX');
  f.press('Use Color');
  assert.match(f.get('alert').textContent, /six HEX digits/);
  assert.match(f.get('textbox').getAttribute('data-accessibility-hint'), /six HEX digits/);
  assert.notEqual(document.activeElement, f.get('textbox'));
  assert.equal(f.env.keyboard, false);
  assert.equal(f.attempts.length, 0);
  f.toggleKeyboard(true);
  await frame();
  f.back();
  assert.equal(f.env.keyboard, false);
  assert.equal(f.query('heading', { name: 'Discard color changes?' }), null);
  f.back();
  assert.ok(f.get('heading', { name: 'Discard color changes?' }));
  f.press('Keep editing color');
  assert.equal(f.get('textbox').value, '#22');
  f.press('Cancel color');
  f.press('Cancel');
  assert.equal(f.attempts.length, 0);
  assert.equal(f.query('heading', { name: 'Appearance Studio' }), null);
});

test('Reset stays local and a write failure retains the last applied appearance and draft', t => {
  const f = fixture(t, { failWrite: true });
  openHex(f);
  f.hex('123456');
  f.press('Use Orion default');
  assert.equal(f.get('textbox').value, '#E50914');
  f.press('Use Color');
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.match(f.get('alert').textContent, /weren’t saved/);
  assert.equal(f.state.theme.accent, saved.customAccent);
  openHex(f);
  assert.equal(f.get('textbox').value, '#E50914');
  f.press('Cancel color');
  f.env.failWrite = false;
  f.press('Apply');
  assert.equal(f.writes[0].value.customAccent, null);
});

test('System appearance emits zero writes and concurrent Reduced Motion survives Apply', t => {
  const f = fixture(t);
  f.switchFollow();
  f.scheme('light');
  assert.equal(f.state.theme.id, saved.manualTheme);
  assert.equal(f.attempts.length, 0);
  testing.act(() => f.state.setReducedMotion(true));
  assert.equal(f.env.modal.animationType, 'none');
  f.press('Apply');
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[1].value.reducedMotion, true);
  assert.equal(f.writes[1].value.manualTheme, saved.manualTheme);
  assert.equal(f.state.theme.id, 'projector-silver');
  f.scheme('dark', true);
  assert.equal(f.state.theme.id, 'slate');
  assert.equal(f.writes.length, 2);
});

test('Overlapping concurrent edits are rejected and retained for review', t => {
  const f = fixture(t);
  f.press(fixed);
  f.choose('Mocha theme');
  testing.act(() => f.state.setTheme('slate'));
  f.press('Apply');
  assert.match(f.get('alert').textContent, /changed while you were editing/);
  assert.equal(f.state.theme.id, 'slate');
  assert.equal(f.get('radio', { name: 'Mocha theme' }).getAttribute('aria-checked'), 'true');
  assert.equal(f.writes.length, 1);
});

for (const [name, options, message] of [
  ['unavailable storage', { unavailable: true }, /storage is unavailable/],
  ['future record', { records: { [key]: '{"schemaVersion":3}' } }, /different version/],
]) test('Studio blocks saving with ' + name, t => {
  const f = fixture(t, options);
  f.press(/(?:Fixed|Dark) theme,/);
  f.choose('Mocha theme');
  assert.match(f.get('alert').textContent, message);
  assert.equal(f.get('button', { name: 'Apply' }).getAttribute('aria-disabled'), 'true');
  f.press('Apply');
  assert.equal(f.attempts.length, 0);
});

test('Platform Reduced Motion and Efficiency use the static modal path', t => {
  for (const options of [{ systemReduced: true }, { profile: 'efficiency' }]) {
    const value = fixture(t, options);
    assert.equal(value.env.modal.animationType, 'none');
  }
});

test('Resizing and rotating keeps the editable picker and scrolling actions in the same draft', async t => {
  const f = fixture(t);
  openHex(f);
  f.hex('#4040CC');
  for (const size of viewports) {
    f.resize(size);
    f.toggleKeyboard(!!size.ime, size.keyboardFrame);
    await frame();
    assert.equal(f.get('textbox').value, '#4040CC', size.name);
    const actions = f.rendered.getByTestId('studio-picker-actions');
    assert.ok(f.rendered.getByTestId('studio-picker-scroll').contains(actions));
    for (const name of ['Cancel color', 'Use Color']) {
      assert.ok(actions.contains(f.get('button', { name })), size.name);
    }
  }
  f.toggleKeyboard(false);
  f.press('Use Color');
  const actions = f.rendered.getByTestId('studio-actions');
  assert.ok(f.rendered.getByTestId('studio-scroll').contains(actions));
  for (const name of ['Apply', 'Cancel']) assert.ok(actions.contains(f.get('button', { name })));
  assert.equal(f.attempts.length, 0);
});

test('An unresized Android sheet adds only occlusion and reveals the entire HEX and error group', async t => {
  const full = { x: 0, y: 24, width: 390, height: 740 };
  const visible = { ...full, height: 400 };
  const field = { ...full, y: 375, height: 100 };
  const frames = { 'studio-picker-viewport': full, 'studio-picker-visible': visible, 'studio-hex-group': field };
  const f = fixture(t, { frames });
  openHex(f);
  f.hex('bad');
  f.toggleKeyboard(true, { screenX: 0, screenY: 424, width: 390, height: 376 });
  f.press('Use Color');
  await frame();
  await frame();
  assert.equal(f.rendered.getByTestId('studio-picker-viewport').style.paddingBottom, '340px');
  assert.deepEqual(f.scrolls.at(-1), { id: 'studio-picker-scroll', y: 59, animated: false });
  f.resize({ frames: { ...frames, 'studio-picker-viewport': visible } });
  f.toggleKeyboard(true, { screenX: 0, screenY: 424, width: 390, height: 376 });
  await frame();
  assert.equal(f.rendered.getByTestId('studio-picker-viewport').style.paddingBottom, '0px');
  assert.match(f.get('alert').textContent, /six HEX digits/);
  assert.equal(f.env.keyboard, true);
});

test('Fixed edits reopen with the inactive system choices and saved accent intact', t => {
  const f = fixture(t, { records: { [key]: JSON.stringify({ ...saved, followSystem: true }) } });
  f.switchFollow();
  f.press(fixed);
  f.choose('Projector Silver theme');
  f.press('Apply');
  assert.equal(f.state.theme.id, 'projector-silver');
  assert.deepEqual(f.writes[0].value, { ...saved, manualTheme: 'projector-silver' });
  const resumed = fixture(t, { records: f.env.records });
  resumed.press(fixed);
  assert.equal(resumed.get('radio', { name: 'Projector Silver theme' }).getAttribute('aria-checked'), 'true');
  assert.equal(resumed.query('button', { name: changeColor }), null);
  assert.equal(resumed.writes.length, 0);
});

test('Closing restores focus within each layer and finally returns to the same Settings entry', async t => {
  const f = fixture(t, { settings: true });
  const entry = f.get('button', { name: 'Appearance Studio' });
  f.press('Appearance Studio');
  assert.equal(f.focus.at(-1), 'Appearance Studio');
  const modal = f.rendered.getByTestId('studio-modal');
  const actions = [...modal.querySelectorAll('button, [role="radio"], input')];
  assert.equal(actions[0].getAttribute('aria-label'), 'Close');
  assert.equal(actions.at(-1).textContent, 'Apply');
  f.press(changeColor);
  await frame();
  assert.equal(f.focus.at(-1), 'Custom accent');
  assert.equal(f.query('heading', { name: 'Theme' }), null);
  f.press('Cancel color');
  await frame();
  assert.match(f.focus.at(-1), /Change Color/);
  f.press(fixed);
  f.choose('Mocha theme');
  f.press('Close');
  await frame();
  assert.equal(f.focus.at(-1), 'Discard changes?');
  f.back();
  await frame();
  assert.equal(f.focus.at(-1), 'Close');
  f.press('Cancel');
  const beforeDiscard = f.focusTargets.length;
  f.press('Discard changes');
  await frame();
  assert.equal(f.get('button', { name: 'Appearance Studio' }), entry);
  assert.equal(f.focusTargets.length, beforeDiscard);
  f.windowFocus(true);
  assert.match(f.focus.at(-1), /Appearance Studio/);
  assertFocusRequest(f, beforeDiscard, entry);
});

function assertFocusRequest(f, prior, target) {
  assert.equal(f.focusTargets.length, prior + 1);
  assert.equal(f.focusTargets[prior], target);
}

function openStudioFromSettings(f) {
  const entry = f.get('button', { name: 'Appearance Studio' });
  f.press('Appearance Studio');
  f.windowFocus(false);
  assert.notEqual(f.focusTargets.at(-1), entry);
  return entry;
}

for (const [label, dismiss] of [
  ['Android Back', f => f.back()],
  ['Close', f => f.press('Close')],
  ['Cancel', f => f.press('Cancel')],
  ['successful Apply', f => {
    f.press(fixed);
    f.choose('Mocha theme');
    f.press('Apply');
    assert.equal(f.writes.length, 1);
  }],
]) {
  test(`${label} restores the exact Settings entry once after the window regains focus`, async t => {
    const f = fixture(t, { settings: true });
    const entry = openStudioFromSettings(f);
    const prior = f.focusTargets.length;
    dismiss(f);
    assert.equal(f.get('button', { name: 'Appearance Studio' }), entry);
    await frame();
    assert.equal(f.focusTargets.length, prior);
    f.windowFocus(true);
    f.windowFocus(true);
    assertFocusRequest(f, prior, entry);
  });
}

test('An Android focus event received before React re-exposes Settings waits for the close commit', t => {
  const f = fixture(t, { settings: true });
  const entry = openStudioFromSettings(f);
  const prior = f.focusTargets.length;
  testing.act(() => {
    f.back();
    f.windowFocus(true);
    assert.ok(f.rendered.getByTestId('studio-modal'));
    assert.equal(f.focusTargets.length, prior);
  });
  assert.equal(f.get('button', { name: 'Appearance Studio' }), entry);
  assertFocusRequest(f, prior, entry);
});

test('Missing Settings native handle leaves focus pending until a valid focus opportunity', t => {
  const f = fixture(t, { settings: true });
  const entry = openStudioFromSettings(f);
  const prior = f.focusTargets.length;
  f.env.missingHandle = entry;
  f.back();
  f.windowFocus(true);
  assert.equal(f.focusTargets.length, prior);
  f.env.missingHandle = null;
  f.windowFocus(true);
  f.windowFocus(true);
  assertFocusRequest(f, prior, entry);
});

test('Opening Studio again cancels the original focus handoff', t => {
  const f = fixture(t, { settings: true });
  const entry = openStudioFromSettings(f);
  f.back();
  openStudioFromSettings(f);
  const prior = f.focusTargets.length;
  f.windowFocus(true);
  assert.equal(f.focusTargets.length, prior);
  assert.equal(f.query('button', { name: 'Appearance Studio' }), null);
  f.back();
  assert.equal(f.focusTargets.length, prior);
  f.windowFocus(true);
  assertFocusRequest(f, prior, entry);
});

test('Navigating away cancels the handoff and unmount removes its listeners', t => {
  const f = fixture(t, { settings: true });
  openStudioFromSettings(f);
  f.back();
  const prior = f.focusTargets.length;
  f.routeFocus(false);
  f.windowFocus(true);
  f.routeFocus(true);
  f.windowFocus(true);
  assert.equal(f.focusTargets.length, prior);
  for (const event of ['focus', 'blur', 'change', 'navigation:blur']) assert.ok(f.listenerCount(event) > 0);
  openStudioFromSettings(f);
  f.routeFocus(false);
  f.back();
  f.routeFocus(true);
  f.windowFocus(true);
  assert.ok(!f.focusTargets.includes(f.get('button', { name: 'Appearance Studio' })));
  f.unmount();
  for (const event of ['focus', 'blur', 'change', 'navigation:blur']) assert.equal(f.listenerCount(event), 0);
});

test('A notification interrupts regained focus and foregrounding alone cannot restore it', async t => {
  const f = fixture(t, { settings: true });
  const entry = openStudioFromSettings(f);
  const prior = f.focusTargets.length;
  f.windowFocus(true);
  assert.equal(f.focusTargets.length, prior);
  testing.act(() => {
    f.back();
    f.windowFocus(true);
    f.windowFocus(false);
  });
  f.windowFocus(true);
  assert.equal(f.focusTargets.length, prior);
  openStudioFromSettings(f);
  f.back();
  const afterReopen = f.focusTargets.length;
  f.appState('active');
  await frame();
  assert.equal(f.focusTargets.length, afterReopen);
  f.appState('background');
  f.windowFocus(true);
  f.appState('active');
  f.windowFocus(true);
  assert.equal(f.focusTargets.length, afterReopen);
  openStudioFromSettings(f);
  f.back();
  f.windowFocus(true);
  assert.equal(f.focusTargets.at(-1), entry);
});

test('Failed Apply and Keep Editing do not transfer focus to Settings', async t => {
  const f = fixture(t, { settings: true, failWrite: true });
  const entry = openStudioFromSettings(f);
  f.press(fixed);
  f.choose('Mocha theme');
  f.press('Apply');
  assert.match(f.get('alert').textContent, /save/i);
  assert.equal(f.attempts.length, 1);
  f.windowFocus(true);
  f.press('Close');
  await frame();
  assert.equal(f.focus.at(-1), 'Discard changes?');
  f.press('Keep editing');
  await frame();
  f.windowFocus(true);
  assert.ok(f.rendered.getByTestId('studio-modal'));
  assert.equal(f.focus.at(-1), 'Close');
  assert.ok(!f.focusTargets.includes(entry));
});

test('Keyboard Back and picker dismissal never transfer focus to Settings behind Studio', async t => {
  const f = fixture(t, { settings: true });
  const entry = openStudioFromSettings(f);
  const color = f.get('button', { name: changeColor });
  f.press(changeColor);
  await frame();
  f.toggleKeyboard(true);
  f.back();
  f.windowFocus(true);
  assert.equal(f.env.keyboard, false);
  assert.ok(f.get('heading', { name: 'Custom accent' }));
  assert.equal(f.query('button', { name: changeColor }), null);
  assert.equal(f.query('button', { name: 'Appearance Studio' }), null);
  f.back();
  await frame();
  f.windowFocus(true);
  assert.equal(f.focusTargets.at(-1), color);
  assert.ok(!f.focusTargets.includes(entry));
  assert.ok(f.rendered.getByTestId('studio-modal'));
});

test('Closing Studio on iOS keeps the existing post-commit focus handoff', async t => {
  const f = fixture(t, { settings: true, platform: 'ios' });
  const entry = openStudioFromSettings(f);
  const prior = f.focusTargets.length;
  f.press('Close');
  await frame();
  assertFocusRequest(f, prior, entry);
});

test('Opening the picker is an exact no-op for neutral, vivid, and explicitly saved default accents', t => {
  for (const accent of ['#000000', '#FFFFFF', '#777777', '#FF0055', '#0357AE', '#E50914', null]) {
    const f = createStudioHarness({ records: { [key]: JSON.stringify({ ...saved, customAccent: accent }) } });
    try {
      f.press(changeColor);
      f.press('Use Color');
      assert.equal(f.get('button', { name: 'Apply' }).getAttribute('aria-disabled'), 'true', String(accent));
      assert.equal(f.state.appearanceChoices.customAccent, accent);
      assert.equal(f.attempts.length, 0);
    } finally {
      f.unmount();
    }
  }
});

test('Every committed preset styles its headings and selected theme with accessible highlights', t => {
  const { loader } = require('./helpers/animeModules.cjs');
  const { studioContrast } = loader()('apps/mobile/src/features/appearance/appearanceStudioContrast.ts');
  const cssHex = value => '#' + (value.match(/\d+/g) ?? []).slice(0, 3)
    .map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  for (const [id, name, accent] of [
    ['midnight-premiere', 'Midnight Premiere', null], ['amoled', 'AMOLED', null],
    ['mocha', 'Mocha', null], ['slate', 'Slate', null], ['projector-silver', 'Projector Silver', null],
    ...['#000000', '#FFFFFF', '#09090D', '#F5FA44', '#663399'].map(hex => ['custom', 'Custom', hex]),
  ]) {
    const f = createStudioHarness({ records: { [key]: JSON.stringify({ ...saved, manualTheme: id, customAccent: accent }) } });
    try {
      const backing = f.state.theme.background;
      const heading = f.get('heading', { name: 'Appearance Studio' });
      for (const section of [heading, f.get('heading', { name: 'Theme' }), f.get('heading', { name: 'Preview' })]) {
        assert.ok(studioContrast(cssHex(section.style.color), backing) >= 4.5, id + ' heading');
        assert.equal(section.style.color, heading.style.color);
      }
      if (id === 'custom') assert.equal(f.get('heading', { name: 'Custom accent' }).style.color, heading.style.color);
      f.press(fixed);
      const selected = f.get('radio', { name: name + ' theme' });
      assert.equal(selected.getAttribute('aria-checked'), 'true');
      assert.ok(selected.querySelector('[data-studio-icon="checkmark-circle"]'));
      assert.ok(studioContrast(cssHex(selected.style.borderTopColor), cssHex(selected.style.backgroundColor)) >= 3);
      const old = heading.style.color;
      f.choose(id === 'mocha' ? 'Slate theme' : 'Mocha theme');
      assert.equal(heading.style.color, old);
      const draftTheme = f.query('radio', { name: 'Custom theme' });
      if (draftTheme) f.choose('Custom theme');
      f.press(changeColor);
      const pickerBacking = f.state.theme.elevated;
      const pickerTitle = f.get('heading', { name: 'Custom accent' });
      for (const name of ['Hue', 'Shade']) {
        const section = f.get('heading', { name });
        assert.equal(section.style.color, pickerTitle.style.color);
        assert.ok(studioContrast(cssHex(section.style.color), pickerBacking) >= 4.5, id + ' picker heading');
      }
      for (const name of ['Saturation', 'Brightness']) {
        const step = f.get('slider', { name });
        const value = testing.within(step).getByText(/^\d+%$/);
        assert.ok(studioContrast(cssHex(value.style.color), pickerBacking) >= 4.5, id + ' picker percentage');
      }
      assert.equal(f.writes.length, 0);
    } finally {
      f.unmount();
    }
  }
});

test('An explicit Orion default reset clears the saved override without changing RGB on open', t => {
  const f = fixture(t, { records: { [key]: JSON.stringify({ ...saved, customAccent: '#E50914' }) } });
  f.press(changeColor);
  f.press('Use Orion default');
  f.press('Use Color');
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.equal(f.writes[0].value.customAccent, null);
});
