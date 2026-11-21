'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { loader } = require('./helpers/animeModules.cjs');
const load = loader({
  react: { createContext: () => ({}) }, 'react-native': {}, '../services/storageAdapter': {},
  '../hooks/useSystemReducedMotion': {},
});
const appearance = 'apps/mobile/src/features/appearance/';
const { compositePaletteColor, inheritedCustomPalette, paletteColorMatchesScheme, paletteContrast,
  resolveAdaptiveCustomPalette } = load(appearance + 'customAppearancePalette.ts');
const { getAdvancedAppearanceChoices, loadAdvancedThemePreferences } = load(appearance + 'appearancePreferences.ts');
const { ORION_MOBILE_THEMES: presets, resolvePalette, resolveAppliedAppearancePalette,
  resolveCustomProfile, resolvePlaybackPresentationPalette } = load('apps/mobile/src/context/ThemeContext.tsx');

const defaults = (profile, colors = {}) => resolveAdaptiveCustomPalette(
  presets[profile === 'dark' ? 'custom' : 'projector-silver'], profile, { ...inheritedCustomPalette(), ...colors },
);
const core = ({ background, surface, elevated, input, surfaceHover }) => [background, surface, elevated, input, surfaceHover];

test('All six historical token snapshots and legacy Custom derivation retain their exact values', () => {
  assert.deepEqual(Object.keys(presets), ['midnight-premiere', 'amoled', 'mocha', 'slate', 'projector-silver', 'custom']);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(presets)).digest('hex'),
    '4d3b30a99a9cdb89402662f4fb4b7b2fc2a7920c0491e155786b2a007c6d365f');
  const saved = JSON.stringify({ schemaVersion: 2, manualTheme: 'custom', customAccent: '#285E95' });
  const v3 = loadAdvancedThemePreferences({ get: key => key.endsWith('V2') ? saved : null }, 'dark', false).preferences;
  const choices = getAdvancedAppearanceChoices(v3);
  for (const id of Object.keys(presets).filter(key => key !== 'custom')) {
    assert.equal(resolveAppliedAppearancePalette(id, choices), presets[id]);
    assert.equal(resolvePlaybackPresentationPalette(id, choices), presets[id]);
  }
  const legacy = resolveAppliedAppearancePalette('custom', choices);
  assert.deepEqual(legacy, { ...presets.custom, accent: '#285E95', accentSoft: 'rgba(40,94,149,0.16)', onAccent: '#ffffff' });
  assert.deepEqual(resolvePlaybackPresentationPalette('custom', choices), legacy);
  assert.equal(resolvePalette('custom', null), presets.custom);
  assert.equal(resolveCustomProfile(choices, 'dark').roles.accent.requestedColor, '#285E95');
});

test('Custom Light inherits Projector Silver while deriving its own accessible extended tokens', () => {
  const v3 = loadAdvancedThemePreferences({ get: () => null }, 'light', false).preferences;
  const choices = getAdvancedAppearanceChoices(v3);
  const adaptive = resolveCustomProfile(choices, 'light');
  assert.deepEqual(adaptive.issues, []);
  assert.equal(adaptive.palette.dark, false);
  for (const role of ['accent', 'background', 'surface', 'text', 'border']) {
    assert.equal(adaptive.roles[role].inheritedColor, presets['projector-silver'][role]);
    assert.equal(adaptive.roles[role].requestedColor, null);
  }
  assert.equal(adaptive.palette.background, presets['projector-silver'].background);
  assert.equal(adaptive.palette.surface, presets['projector-silver'].surface);
  assert.equal(adaptive.palette.text, presets['projector-silver'].text);
  assert.deepEqual(resolveAppliedAppearancePalette('custom-light', choices), adaptive.palette);
  assert.equal(resolvePlaybackPresentationPalette('custom-light', choices), presets['projector-silver']);
});

test('Both schemes enforce the approved luminance boundaries without silently rewriting the draft', () => {
  assert.equal(paletteColorMatchesScheme('#747474', 'dark'), true);
  assert.equal(paletteColorMatchesScheme('#757575', 'dark'), false);
  assert.equal(paletteColorMatchesScheme('#767676', 'light'), false);
  assert.equal(paletteColorMatchesScheme('#777777', 'light'), true);
  assert.deepEqual(defaults('dark', { surface: '#FFFFFF' }).issues, [{ role: 'surface', code: 'scheme-luminance' }]);
  assert.ok(defaults('light', { background: '#000000' }).issues.some(issue => issue.role === 'background'));
  assert.deepEqual(defaults('dark', { accent: '#fff' }).issues, [{ role: 'accent', code: 'invalid-hex' }]);
  const invalid = defaults('light', { text: '#FFFFFF' });
  assert.deepEqual(invalid.issues, [{ role: 'text', code: 'text-contrast' }]);
  assert.equal(invalid.roles.text.requestedColor, '#FFFFFF');
  assert.equal(invalid.roles.text.effectiveColor, defaults('light').palette.text);
  assert.equal(invalid.roles.text.adjusted, true);
});

test('An inherited translucent border is composited before assessing contrast', () => {
  const base = presets.custom;
  assert.equal(compositePaletteColor(base.border, base.surface), '#303039');
  const resolution = defaults('dark');
  assert.equal(resolution.roles.border.inheritedColor, base.border);
  assert.equal(resolution.roles.border.requestedColor, null);
  assert.equal(resolution.roles.border.adjusted, true);
  assert.ok(resolution.warnings.some(warning => warning.role === 'border'));
  for (const fill of core(resolution.palette)) {
    assert.ok(paletteContrast(compositePaletteColor(resolution.palette.border, fill), fill) >= 3);
  }
});

test('Readable requested accent and border remain exact and choose contrasting filled-control text', () => {
  for (const [scheme, accent, border, foreground] of [
    ['dark', '#FFFFFF', '#CCCCCC', '#000000'],
    ['light', '#000000', '#222222', '#FFFFFF'],
  ]) {
    const resolution = defaults(scheme, { accent, border });
    assert.deepEqual(resolution.issues, []);
    assert.equal(resolution.palette.accent, accent);
    assert.equal(resolution.palette.border, border);
    assert.equal(resolution.palette.onAccent, foreground);
    assert.equal(resolution.roles.accent.adjusted, false);
    assert.equal(resolution.roles.border.adjusted, false);
  }
});

test('Adjusted colors retain requests; all owned plain and tinted surfaces preserve text and controls', () => {
  for (const [scheme, surface, background] of [
    ['dark', '#747474', '#0B1019'], ['light', '#777777', '#F9FAFB'],
  ]) {
    const result = defaults(scheme, { background, surface, accent: surface, border: surface });
    const { palette } = result;
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.roles.accent, { requestedColor: surface,
      inheritedColor: presets[scheme === 'dark' ? 'custom' : 'projector-silver'].accent,
      adjusted: true, effectiveColor: palette.accent });
    assert.equal(result.roles.border.requestedColor, surface);
    assert.equal(result.roles.border.adjusted, true);
    assert.ok(paletteContrast(palette.onAccent, palette.accent) >= 4.5);

    const bases = core(palette);
    for (const surfaceColor of [...bases, ...bases.map(fill => compositePaletteColor(palette.accentSoft, fill))]) {
      for (const token of ['text', 'textSecondary', 'textMuted', 'accent', 'success', 'warning', 'danger']) {
        assert.ok(paletteContrast(palette[token], surfaceColor) >= 4.5, token + ' on ' + surfaceColor);
      }
      assert.ok(paletteContrast(compositePaletteColor(palette.border, surfaceColor), surfaceColor) >= 3);
    }
    assert.notEqual(palette.success, palette.warning);
    // At the most constrained contrast point hues may converge to the readable neutral.
    assert.equal(palette.mediaScrim, presets[scheme === 'dark' ? 'custom' : 'projector-silver'].mediaScrim);
  }
});

test('Adaptive Dark keeps the historical media scrim and offers an isolated playback palette', () => {
  const v3 = loadAdvancedThemePreferences({ get: () => null }, 'dark', false).preferences;
  v3.custom.dark = { colors: { ...inheritedCustomPalette(), accent: '#11EEEE', surface: '#161616' }, rendering: 'adaptive' };
  const choices = getAdvancedAppearanceChoices(v3);
  const application = resolveAppliedAppearancePalette('custom', choices);
  assert.equal(application.accent, '#11EEEE');
  assert.equal(application.surface, '#161616');
  assert.equal(application.mediaScrim, presets.custom.mediaScrim);
  assert.equal(resolvePlaybackPresentationPalette('custom', choices), presets.custom);
});
