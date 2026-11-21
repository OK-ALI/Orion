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
const changeColor = /Edit Accent,/;
const accentHeading = 'Custom Dark · Accent';
const openHex = f => { f.press(changeColor); f.press('Enter HEX'); };

const authoritativeKey = 'mobileThemePreferencesV3';
function expectedV3(overrides, rendering = 'legacy') {
  const { customAccent, ...settings } = { ...saved, ...overrides };
  const defaults = { accent: null, background: null, surface: null, text: null, border: null };
  return { ...settings, schemaVersion: 3, custom: {
    light: defaults, dark: { colors: { ...defaults, accent: customAccent }, rendering },
  } };
}

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

test('Follow System assignments, independent preview, and HEX use one real V3 write on Studio Apply', t => {
  const f = fixture(t);
  const legacy = JSON.stringify({ schemaVersion: 1, theme: 'slate', customAccent: '#DEFACE' });
  f.env.records.mobileThemePreferencesV1 = legacy;
  f.press(fixed);
  assert.equal(f.get('radio', { name: 'Custom Dark theme' }).getAttribute('aria-checked'), 'true');
  f.switchFollow();
  assert.equal(f.rendered.getByLabelText('Follow system appearance').checked, true);
  assert.ok(f.rendered.getByText('Projector Silver'));
  f.press(dark);
  assert.equal(f.query('radio', { name: 'Projector Silver theme' }), null);
  f.choose('Custom Dark theme');
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
  assert.deepEqual(f.writes, [{ name: authoritativeKey, value: expectedV3({ followSystem: true, darkTheme: 'custom', customAccent: '#AABBCC' }, 'adaptive') }]);
  assert.equal(f.env.records.mobileThemePreferencesV1, legacy);
  assert.equal(f.env.records[key], JSON.stringify(saved));
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

test('A continuous Light shade drag keeps live color evidence and defers writes through Cancel and Apply', t => {
  const f = fixture(t);
  f.choose('Custom Light');
  f.press(changeColor);
  f.choose('Blue hue');
  f.measureArea(200, 100);
  f.measurePickerLayout(240, 1020, 440);
  f.press('Enter HEX');
  const picker = testing.within(f.rendered.getByTestId('studio-picker-scroll'));
  const shade = f.rendered.getByTestId('studio-color-area');
  const marker = f.rendered.getByTestId('studio-shade-marker');
  const proposed = f.rendered.getByTestId('studio-proposed-color');
  const swatch = f.rendered.getByTestId('studio-picker-sample');
  const expected = [
    [58, 61, '#474763', false], [30, 5, '#CECEF2', true],
    [18, 5, '#DCDCF2', true], [170, 82, '#07072E', false], [30, 5, '#CECEF2', true],
  ];
  for (const [index, [x, y, color, adjusted]] of expected.entries()) {
    f.areaGesture(index === 0 ? 'start' : 'move', x, y);
    assert.equal(f.rendered.getByTestId('studio-color-area'), shade);
    assert.ok(Math.abs(parseFloat(marker.style.left) - Math.max(0, Math.min(180, x - 10))) < .01);
    assert.ok(Math.abs(parseFloat(marker.style.top) - Math.max(0, Math.min(80, y - 10))) < .01);
    assert.equal(f.get('slider', { name: 'Saturation' }).getAttribute('aria-valuenow'), String(x / 2));
    assert.equal(f.get('slider', { name: 'Brightness' }).getAttribute('aria-valuenow'), String(100 - y));
    assert.ok(proposed.textContent.endsWith(color));
    assert.equal(picker.getByRole('textbox').value, color);
    assert.equal(swatch.style.backgroundColor, marker.style.backgroundColor);
    const displayed = adjusted ? picker.getByText(/^Displayed #[A-F0-9]{6}$/).textContent.slice(-7) : color;
    const displayedRgb = displayed.slice(1).match(/../g).map(channel => Number.parseInt(channel, 16));
    assert.equal(picker.getByText('Play').parentElement.style.backgroundColor, 'rgb(' + displayedRgb.join(', ') + ')');
    assert.equal(!!picker.queryByText('Requested ' + color), adjusted);
    assert.equal(!!picker.queryByText('Adjusted for contrast.'), adjusted);
    assert.equal(f.canScrollPicker(), false);
    assert.equal(f.attempts.length, 0);
  }
  f.areaGesture('end');
  f.press('Cancel color');
  assert.ok(f.get('button', { name: /Edit Accent, Orion default/ }));
  assert.equal(f.attempts.length, 0);
  f.press(changeColor);
  f.choose('Blue hue');
  f.areaTap(30, 5, 200, 100);
  f.press('Use Color');
  assert.ok(f.get('button', { name: 'Edit Accent, #CECEF2' }));
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].value.custom.light.accent, '#CECEF2');
  assert.equal(f.writes[0].value.custom.dark.colors.accent, saved.customAccent);
});

test('The picker scroll thumb follows the viewport using the committed accent', t => {
  const f = fixture(t);
  f.press(changeColor);
  const picker = f.rendered.getByTestId('studio-picker-scroll');
  f.measurePickerLayout(240, 400, 400);
  assert.equal(f.rendered.queryByTestId('studio-picker-scrollbar'), null);
  f.measurePickerLayout(240, 1000, 400);
  const thumb = f.rendered.getByTestId('studio-picker-scrollbar');
  assert.equal(thumb.parentElement, picker.parentElement);
  assert.equal(thumb.style.backgroundColor, 'rgb(56, 103, 214)');
  assert.equal(thumb.style.height, '160px');
  assert.match(thumb.style.transform, /translateY\(0px\)/);
  f.scrollPicker(300);
  assert.match(thumb.style.transform, /translateY\(120px\)/);
  f.choose('Green hue');
  f.areaTap(100, 0, 100, 100);
  assert.equal(thumb.style.backgroundColor, 'rgb(56, 103, 214)');
  f.scrollPicker(900);
  assert.match(thumb.style.transform, /translateY\(240px\)/);
  f.measurePickerLayout(240, 300, 400);
  assert.equal(f.rendered.queryByTestId('studio-picker-scrollbar'), null);
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
  assert.deepEqual(f.writes, [{ name: authoritativeKey, value: expectedV3({ customAccent: '#00FF00' }, 'adaptive') }]);
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
  assert.equal(f.writes[0].value.custom.dark.colors.accent, null);
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
  ['future V2 record', { records: { [key]: '{"schemaVersion":3}' } }, /different version/],
  ['future V3 record', { records: { [authoritativeKey]: '{"schemaVersion":4}' } }, /different version/],
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
  assert.deepEqual(f.writes[0].value, expectedV3({ manualTheme: 'projector-silver' }));
  const resumed = fixture(t, { records: f.env.records });
  resumed.press(fixed);
  assert.equal(resumed.get('radio', { name: 'Projector Silver theme' }).getAttribute('aria-checked'), 'true');
  assert.ok(resumed.get('button', { name: changeColor }));
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
  assert.equal(f.focus.at(-1), accentHeading);
  assert.equal(f.query('heading', { name: 'Theme' }), null);
  f.press('Cancel color');
  await frame();
  assert.match(f.focus.at(-1), /Edit Accent/);
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
  assert.ok(f.get('heading', { name: accentHeading }));
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
    ...['#000000', '#FFFFFF', '#09090D', '#F5FA44', '#663399'].map(hex => ['custom', 'Custom Dark', hex]),
  ]) {
    const f = createStudioHarness({ records: { [key]: JSON.stringify({ ...saved, manualTheme: id, customAccent: accent }) } });
    try {
      const backing = f.state.theme.background;
      const heading = f.get('heading', { name: 'Appearance Studio' });
      for (const section of [heading, f.get('heading', { name: 'Theme' }), f.get('heading', { name: 'Preview' })]) {
        assert.ok(studioContrast(cssHex(section.style.color), backing) >= 4.5, id + ' heading');
        assert.equal(section.style.color, heading.style.color);
      }
      assert.equal(f.get('heading', { name: 'Custom Palette' }).style.color, heading.style.color);
      f.press(fixed);
      const selected = f.get('radio', { name: name + ' theme' });
      assert.equal(selected.getAttribute('aria-checked'), 'true');
      assert.ok(selected.querySelector('[data-studio-icon="checkmark-circle"]'));
      assert.ok(studioContrast(cssHex(selected.style.borderTopColor), cssHex(selected.style.backgroundColor)) >= 3);
      const old = heading.style.color;
      f.choose(id === 'mocha' ? 'Slate theme' : 'Mocha theme');
      assert.equal(heading.style.color, old);
      const draftTheme = f.query('radio', { name: 'Custom Dark theme' });
      if (draftTheme) f.choose('Custom Dark theme');
      f.press(changeColor);
      const pickerBacking = f.state.theme.elevated;
      const pickerTitle = f.get('heading', { name: accentHeading });
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
  assert.equal(f.writes[0].value.custom.dark.colors.accent, null);
});

const lightColors = { accent: '#545C92', background: '#FAF7EE', surface: '#ECF2FF', text: '#172238', border: '#30334A' };
const darkColors = { accent: '#ECB97B', background: '#0E141E', surface: '#242834', text: '#F4F5F9', border: '#7F91AF' };

function stageRole(f, role, color) {
  f.press(new RegExp('^Edit ' + role + ','));
  f.press('Enter HEX');
  f.hex(color);
  f.press('Use Color');
}

test('All ten role values edit independently in Studio and persist across a cold start', t => {
  const f = fixture(t);
  f.choose('Custom Light');
  assert.equal(f.get('radio', { name: 'Custom Light' }).getAttribute('aria-checked'), 'true');
  assert.equal(f.get('button', { name: 'Apply' }).getAttribute('aria-disabled'), 'true');
  for (const [profile, colors] of [['Custom Light', lightColors], ['Custom Dark', darkColors]]) {
    f.choose(profile);
    for (const [role, color] of Object.entries(colors)) stageRole(f, role[0].toUpperCase() + role.slice(1), color);
  }
  assert.equal(f.state.effectiveAppearanceThemeId, 'custom');
  assert.equal(f.state.theme.accent, saved.customAccent);
  assert.equal(f.attempts.length, 0);
  f.switchFollow();
  f.press(/Light theme,/);
  assert.equal(f.query('radio', { name: 'Mocha theme' }), null);
  assert.ok(f.get('radio', { name: 'Projector Silver theme' }));
  f.choose('Custom Light theme');
  f.press(dark);
  assert.equal(f.query('radio', { name: 'Custom Light theme' }), null);
  f.choose('Custom Dark theme');
  f.choose('Preview Light');
  assert.ok(f.get('heading', { name: 'Preview, Custom Light, light appearance' }));
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0].value.custom, { light: lightColors, dark: { colors: darkColors, rendering: 'adaptive' } });
  assert.equal(f.writes[0].value.manualTheme, 'custom');
  assert.equal(f.env.records[key], JSON.stringify(saved));
  const restart = fixture(t, { settings: true, records: f.env.records, scheme: 'light' });
  assert.equal(restart.state.effectiveAppearanceThemeId, 'custom-light');
  assert.equal(restart.state.theme.dark, false);
  assert.equal(restart.state.theme.background, lightColors.background);
  assert.ok(restart.rendered.getByText(/Using Custom Light/));
  assert.equal(restart.get('radio', { name: 'Projector Silver theme' }).getAttribute('aria-checked'), 'false');
  restart.scheme('dark', true);
  assert.equal(restart.state.effectiveAppearanceThemeId, 'custom');
  assert.equal(restart.state.theme.background, darkColors.background);
  assert.equal(restart.writes.length, 0);
});

test('Fixed Custom Light persists independently of Follow System choices', t => {
  const f = fixture(t);
  f.press(fixed);
  f.choose('Custom Light theme');
  f.press('Apply');
  assert.equal(f.state.effectiveAppearanceThemeId, 'custom-light');
  assert.equal(f.writes[0].value.lightTheme, 'projector-silver');
  assert.equal(f.writes[0].value.darkTheme, 'slate');
  f.scheme('dark', true);
  assert.equal(f.state.effectiveAppearanceThemeId, 'custom-light');
  assert.equal(f.writes.length, 1);
});

test('Every shipped Orion accent preset is unique, selected accessibly, and staged only for its target', t => {
  const f = fixture(t);
  f.choose('Custom Light');
  f.press(changeColor);
  const presets = [
    ['Midnight Premiere', '#E50914'], ['AMOLED', '#FF1F2D'], ['Mocha', '#D96852'],
    ['Slate', '#6F8FB8'], ['Projector Silver', '#A1121D'],
  ];
  const picker = testing.within(f.rendered.getByTestId('studio-picker-scroll'));
  assert.equal(picker.getAllByRole('radio', { name: /#[A-F0-9]{6}$/ }).length, 5);
  for (const [name, hex] of presets) {
    const label = name + ', ' + hex;
    f.choose(label);
    assert.equal(f.get('radio', { name: label }).getAttribute('aria-checked'), 'true');
    assert.equal(picker.getAllByRole('radio', { name: /#[A-F0-9]{6}$/, checked: true }).length, 1);
    assert.match(picker.getByTestId('studio-proposed-color').textContent, new RegExp(', ' + hex + '$'));
  }
  assert.equal(f.attempts.length, 0);
  f.press('Use Color');
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  const result = f.writes[0].value;
  assert.equal(result.manualTheme, saved.manualTheme);
  assert.deepEqual(result.custom.light, { ...expectedV3({}).custom.light, accent: '#A1121D' });
  assert.deepEqual(result.custom.dark, expectedV3({}).custom.dark);
});

test('Choosing the exact inherited accent preset stores an explicit HEX until Reset Accent is applied', t => {
  const starting = { [key]: JSON.stringify({ ...saved, customAccent: null }) };
  const f = fixture(t, { records: starting });
  assert.ok(f.get('button', { name: /Edit Accent, Orion default/ }));
  f.press(changeColor);
  f.choose('Midnight Premiere, #E50914');
  f.press('Use Color');
  assert.ok(f.get('button', { name: 'Edit Accent, #E50914' }));
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.equal(f.writes[0].value.custom.dark.colors.accent, '#E50914');
  const resumed = fixture(t, { records: f.env.records });
  resumed.press('Reset Accent');
  resumed.press('Apply');
  assert.equal(resumed.writes[0].value.custom.dark.colors.accent, null);
  assert.equal(resumed.writes[0].value.custom.dark.rendering, 'adaptive');
});

test('Picker retains the role and returns focus to the exact launching control after a system appearance change', async t => {
  const f = fixture(t, { settings: true });
  openStudioFromSettings(f);
  f.choose('Custom Light');
  const role = f.get('button', { name: /^Edit Border,/ });
  f.press(/^Edit Border,/);
  await frame();
  assert.equal(f.focus.at(-1), 'Custom Light · Border');
  assert.equal(f.query('heading', { name: 'Orion Accents' }), null);
  assert.equal(f.query('radio', { name: 'Custom Dark' }), null);
  f.scheme('light', true);
  f.press('Enter HEX');
  assert.ok(f.get('textbox', { name: 'Custom Light border HEX' }));
  f.hex('#30334A');
  f.press('Use Color');
  await frame();
  assert.equal(f.focusTargets.at(-1), role);
  assert.ok(f.get('button', { name: 'Edit Border, #30334A' }));
  f.choose('Custom Dark');
  assert.match(f.get('button', { name: /^Edit Border,/ }).getAttribute('aria-label'), /Translucent/);
  f.press('Cancel');
  f.press('Discard changes');
  assert.equal(f.attempts.length, 0);
});

test('Adjusted role colors show both swatches while invalid scheme and text combinations block Apply', t => {
  const f = fixture(t);
  f.choose('Custom Light');
  stageRole(f, 'Accent', '#FFFF00');
  const accent = f.rendered.getByTestId('studio-role-accent');
  assert.ok(testing.within(accent).getByText('Requested #FFFF00'));
  assert.match(testing.within(accent).getByText(/^Displayed/).textContent, /^Displayed #(?!FFFF00)[0-9A-F]{6}$/);
  assert.ok(testing.within(accent).getByText('Adjusted for contrast.'));
  stageRole(f, 'Border', '#FFFFFF');
  assert.match(f.rendered.getByTestId('studio-role-border').textContent, /Requested #FFFFFF.*Displayed #.*Adjusted for contrast/);
  f.choose('Custom Dark');
  stageRole(f, 'Background', '#FFFFFF');
  assert.match(f.get('alert').textContent, /Custom Dark background/);
  assert.equal(f.get('button', { name: 'Apply' }).getAttribute('aria-disabled'), 'true');
  f.press('Apply');
  f.press('Reset Background');
  stageRole(f, 'Text', '#000000');
  assert.match(f.get('alert').textContent, /Custom Dark text/);
  assert.equal(f.attempts.length, 0);
  assert.equal(f.state.theme.accent, saved.customAccent);
  f.press('Reset Text');
  f.press('Apply');
  assert.equal(f.writes[0].value.custom.light.accent, '#FFFF00');
  assert.equal(f.writes[0].value.custom.light.border, '#FFFFFF');
  assert.deepEqual(f.writes[0].value.custom.dark, expectedV3({}).custom.dark);
});

test('Individual and whole-profile resets restore exact inheritance and keep the opposite profile', t => {
  const initial = expectedV3({}, 'adaptive');
  initial.custom = { light: lightColors, dark: { colors: darkColors, rendering: 'adaptive' } };
  const f = fixture(t, { records: { [authoritativeKey]: JSON.stringify(initial) } });
  f.choose('Custom Light');
  f.press('Reset Border');
  assert.ok(f.get('button', { name: /Edit Border, Orion default · Translucent/ }));
  assert.ok(f.get('button', { name: 'Edit Text, ' + lightColors.text }));
  f.choose('Custom Dark');
  f.press('Restore default palette');
  assert.ok(f.get('button', { name: /Edit Border, Orion default · Translucent/ }));
  assert.equal(f.state.theme.accent, darkColors.accent);
  assert.equal(f.attempts.length, 0);
  f.press('Apply');
  assert.deepEqual(f.writes[0].value.custom, {
    light: { ...lightColors, border: null }, dark: { colors: expectedV3({}).custom.light, rendering: 'legacy' },
  });
  assert.equal(f.state.theme.accent, '#E50914');
  const reopened = fixture(t, { records: f.env.records });
  reopened.choose('Custom Light');
  reopened.press('Restore default palette');
  reopened.press('Apply');
  assert.deepEqual(reopened.writes[0].value.custom.light, expectedV3({}).custom.light);
  assert.deepEqual(reopened.writes[0].value.custom.dark, f.writes[0].value.custom.dark);
});

test('Studio merges disjoint role edits and rejects a conflicting write without losing the draft', t => {
  const { loader } = require('./helpers/animeModules.cjs');
  const { editAdvancedPaletteRole } = loader()('apps/mobile/src/features/appearance/appearancePreferences.ts');
  for (const role of ['border', 'accent']) {
    const f = fixture(t);
    f.choose('Custom Light');
    stageRole(f, 'Accent', lightColors.accent);
    const current = f.state.advancedAppearanceChoices;
    testing.act(() => assert.equal(f.state.applyAdvancedAppearanceChoices(current,
      editAdvancedPaletteRole(current, 'light', role, '#30334A')).ok, true));
    f.press('Apply');
    if (role === 'border') {
      assert.equal(f.writes.length, 2);
      assert.deepEqual(f.writes[1].value.custom.light, { ...expectedV3({}).custom.light, accent: lightColors.accent, border: '#30334A' });
    } else {
      assert.equal(f.writes.length, 1);
      assert.match(f.get('alert').textContent, /changed while you were editing/);
      assert.ok(f.get('button', { name: 'Edit Accent, ' + lightColors.accent }));
    }
    f.unmount();
  }
});
