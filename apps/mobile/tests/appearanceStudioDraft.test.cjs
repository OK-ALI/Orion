'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./helpers/animeModules.cjs');
const load = loader();
const location = 'apps/mobile/src/features/appearance/';
const draft = load(location + 'appearanceStudioDraft.ts');
const { prepareAppearancePatch } = load(location + 'appearancePreferences.ts');
const { studioContrast } = load(location + 'appearanceStudioContrast.ts');
const original = {
  manualTheme: 'mocha', lightTheme: 'projector-silver', darkTheme: 'amoled', followSystem: false,
  customAccent: '#3867D6',
};
const defaultAccent = '#E50914';

test('Studio restores six historical manual choices and the saved inactive accent', () => {
  for (const manualTheme of Object.keys(draft.THEME_NAMES)) {
    const saved = { ...original, manualTheme };
    const value = draft.newStudioDraft(saved, defaultAccent);
    assert.deepEqual(value.choices, saved);
    assert.notEqual(value.choices, saved);
    assert.equal(value.accentInput, original.customAccent);
    assert.equal(draft.isStudioDirty(value, saved), false);
  }
});

test('Fixed and Follow System editing preserve the alternate choices, including on reset', () => {
  const fixed = draft.newStudioDraft(original, defaultAccent);
  const changed = draft.selectStudioTheme(fixed, 'dark', 'slate');
  assert.deepEqual(changed.choices, { ...original, manualTheme: 'slate' });
  assert.deepEqual(draft.resetStudioSelection(changed, original, 'dark').choices, original);
  const follow = { ...changed, choices: { ...changed.choices, followSystem: true } };
  assert.equal(draft.selectStudioTheme(follow, 'light', 'slate').choices, follow.choices);
  const edited = draft.selectStudioTheme(follow, 'dark', 'custom');
  assert.equal(edited.choices.lightTheme, original.lightTheme);
  assert.equal(edited.choices.manualTheme, 'slate');
  assert.equal(draft.getStudioTheme(edited.choices, 'dark'), 'custom');
  assert.equal(draft.getStudioTheme(edited.choices, 'light'), 'projector-silver');
  const reset = draft.resetStudioSelection(edited, original, 'dark');
  assert.deepEqual(reset.choices, { ...edited.choices, darkTheme: 'midnight-premiere' });
});

test('Light and Dark previews leave Fixed choice and both saved assignments intact', () => {
  const value = draft.newStudioDraft(original, defaultAccent);
  assert.equal(draft.getStudioPreviewTheme(value, 'dark'), 'mocha');
  assert.equal(draft.getStudioPreviewTheme(value, 'light'), 'projector-silver');
  assert.equal(draft.getStudioTheme(value.choices, 'light'), 'mocha');
  assert.equal(draft.isStudioDirty(value, original), false);
});

test('HEX edits preserve last valid preview, normalize input and support default reset', () => {
  const value = draft.newStudioDraft(original, defaultAccent);
  for (const invalid of ['#abc', 'g00000', '', '##aabbcc', 'aabbccff']) {
    assert.equal(draft.parseStudioAccent(invalid), null);
    const error = draft.withStudioAccent(value, invalid, defaultAccent);
    assert.equal(error.accentInput, invalid);
    assert.equal(error.choices.customAccent, original.customAccent);
    assert.equal(draft.isStudioDirty(error, original), true);
  }
  const changed = draft.withStudioAccent(value, ' aabbcc ', defaultAccent);
  assert.equal(changed.choices.customAccent, '#AABBCC');
  assert.equal(draft.withStudioAccent(changed, defaultAccent, defaultAccent).choices.customAccent, null);
  const explicit = draft.newStudioDraft({ ...original, customAccent: defaultAccent }, defaultAccent);
  assert.equal(draft.withStudioAccent(explicit, 'e50914', defaultAccent).choices, explicit.choices);
});

test('Batch Apply validates inputs and merges nonconflicting changes without overwriting current values', () => {
  const current = { ...original, darkTheme: 'slate', reducedMotion: true };
  assert.deepEqual(prepareAppearancePatch(original, { ...original, customAccent: '#aabbcc' }, current),
    { ok: true, patch: { customAccent: '#AABBCC' } });
  assert.deepEqual(prepareAppearancePatch(original, { ...original, darkTheme: 'slate' }, current),
    { ok: true, patch: {} });
  assert.equal(prepareAppearancePatch(original, { ...original, darkTheme: 'custom' }, current).ok, false);
  for (const invalid of [{ manualTheme: 'arctic-blue' }, { lightTheme: 'amoled' }, { darkTheme: 'projector-silver' },
    { customAccent: '#12' }, { followSystem: 'true' }]) {
    assert.equal(prepareAppearancePatch(original, { ...original, ...invalid }, current).ok, false);
  }
});

test('Back priority is keyboard, discard confirmation, then dirty or clean close', () => {
  assert.equal(draft.studioBackAction(true, true, true), 'hide-keyboard');
  assert.equal(draft.studioBackAction(false, true, true), 'keep-editing');
  assert.equal(draft.studioBackAction(false, false, true), 'confirm-discard');
  assert.equal(draft.studioBackAction(false, false, false), 'close');
});

test('The editor chooses one column for short, narrow, very large text and IME windows', () => {
  for (const [w, h, scale, keyboard, columns, stack] of [
    [320, 620, 1, false, false, true], [800, 360, 1, false, false, true],
    [900, 720, 2, false, false, true], [900, 720, 1.3, false, true, false],
    [900, 480, 1, true, false, true], [480, 800, 1, false, false, false],
  ]) {
    assert.deepEqual(draft.getStudioLayout(w, h, scale, keyboard),
      { sideBySide: columns, stackedActions: stack });
  }
});

test('Contrast follows sRGB and can distinguish the accessible primary foreground', () => {
  assert.equal(studioContrast('#000000', '#FFFFFF'), 21);
  assert.equal(studioContrast('#777777', '#777777'), 1);
  assert.ok(studioContrast('#777777', '#000000') >= 4.5);
  assert.ok(studioContrast('#777777', '#FFFFFF') < 4.5);
});

const color = load(location + 'appearanceStudioAccentColor.ts');
const ime = load(location + 'appearanceStudioIme.ts');
const { studioAccentForeground } = load(location + 'appearanceStudioContrast.ts');

test('HSV conversion round-trips exact channels, including neutrals and vivid hex colors', () => {
  for (const rgb of ['#000000', '#FFFFFF', '#808080', '#3867D6', '#03458F', '#E50914', '#FF0001', '#00FFFF', '#AABBCC']) {
    assert.equal(color.accentHsvToHex(color.hexToAccentHsv(rgb)), rgb);
  }
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
        assert.equal(color.accentHsvToHex(color.hexToAccentHsv(hex)), hex);
      }
    }
  }
  assert.equal(color.storedPickerAccent('#E50914', null, '#E50914'), null);
  assert.equal(color.storedPickerAccent('#E50914', '#E50914', '#E50914'), '#E50914');
  assert.equal(color.storedPickerAccent('#E50914', '#123456', '#E50914'), null);
});

test('Touch selects both saturation and shade on the measured area', () => {
  assert.deepEqual(color.accentFromArea(180, 25, 50, 100, 100), { hue: 180, saturation: 25, brightness: 50 });
  assert.equal(color.accentHsvToHex(color.accentFromArea(180, 150, -5, 100, 100)), '#00FFFF');
  assert.equal(color.accentHsvToHex(color.accentFromArea(180, 50, 200, 100, 100)), '#000000');
  assert.equal(color.accentFromArea(180, 20, 50, 0, 100), null);
});

test('Accent foreground preserves a readable historic accent and adjusts low-contrast colors', () => {
  const cases = [['#E50914', '#08070c', '#f4f1f6'], ['#ff1f2d', '#000000', '#ffffff'],
    ['#d96852', '#17110f', '#f5ebe3'], ['#6f8fb8', '#0b1017', '#eef4fb'], ['#a1121d', '#f1ede5', '#211f23'],
    ['#E50914', '#09090d', '#f4f4f7'], ['#000000', '#09090d', '#f4f4f7'], ['#FFFFFF', '#09090d', '#f4f4f7'],
    ['#121212', '#09090d', '#f4f4f7'], ['#FFF700', '#09090d', '#f4f4f7']];
  for (const [accent, background, text] of cases) {
    const theme = { accent, text };
    const foreground = studioAccentForeground(theme, background);
    assert.ok(studioContrast(foreground, background) >= 4.5);
    if (studioContrast(accent, background) >= 4.5) assert.equal(foreground, accent);
    assert.ok(studioContrast(studioAccentForeground(theme, '#f1ede5', 3), '#f1ede5') >= 3);
    assert.equal(theme.accent, accent);
  }
});

test('Keyboard geometry counts only uncovered overlap and handles short scroll viewports', () => {
  const viewport = { x: 15, y: 24, width: 390, height: 740 };
  const overlay = { screenX: 0, screenY: 460, width: 420, height: 320 };
  assert.equal(ime.studioKeyboardInset(viewport, overlay), 304);
  assert.equal(ime.studioKeyboardInset({ ...viewport, height: 420 }, overlay), 0);
  assert.equal(ime.studioKeyboardInset(viewport, { ...overlay, screenX: 500 }), 0);
  assert.equal(ime.studioKeyboardInset(viewport, null), 0);
  const visible = { ...viewport, height: 430 };
  assert.equal(ime.studioRevealOffset(25, visible, { ...visible, y: 420, height: 80 }, 8), 79);
  assert.equal(ime.studioRevealOffset(500, { ...visible, height: 90 }, { ...visible, y: 75, height: 120 }, 8), 543);
  assert.equal(ime.studioRevealOffset(25, visible, { ...visible, y: 150, height: 80 }, 8), 25);
});
