const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const tokens = read('src/theme/tokens.ts');
const search = read('app/search.tsx');

function hexColor(name) {
  const match = tokens.match(
    new RegExp('\\b' + name + ":\\s*'(#(?:[0-9A-Fa-f]{6}))'")
  );
  assert.ok(match, 'Missing hex color token: ' + name);
  return match[1];
}

function rgbaColor(name) {
  const match = tokens.match(
    new RegExp(
      '\\b' + name +
      ":\\s*'rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)'"
    )
  );
  assert.ok(match, 'Missing rgba color token: ' + name);
  return {
    rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: Number(match[4]),
  };
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function composite(foreground, background, alpha) {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha))
  );
}

function relativeLuminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return (
    linear[0] * 0.2126 +
    linear[1] * 0.7152 +
    linear[2] * 0.0722
  );
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

test('P5.4H keeps the semantic WAVEN text palette at WCAG AA contrast across canonical dark surfaces', () => {
  const canvas = hexToRgb(hexColor('canvas'));
  const surfaceSoft = hexToRgb(hexColor('surfaceSoft'));
  const surfaceRaised = hexToRgb(hexColor('surfaceRaised'));

  const glassSoft = rgbaColor('glassSoft');
  const navGlass = rgbaColor('navGlass');
  const blueWash = rgbaColor('blueWash');

  const backgrounds = {
    canvas,
    surfaceSoft,
    surfaceRaised,
    glassSoftOnCanvas: composite(glassSoft.rgb, canvas, glassSoft.alpha),
    navGlassOnCanvas: composite(navGlass.rgb, canvas, navGlass.alpha),
    blueWashOnSurface: composite(blueWash.rgb, surfaceSoft, blueWash.alpha),
  };

  const foregrounds = {
    textPrimary: hexToRgb(hexColor('textPrimary')),
    textSecondary: hexToRgb(hexColor('textSecondary')),
    textMuted: hexToRgb(hexColor('textMuted')),
    interactionBlue: hexToRgb(hexColor('interactionBlue')),
  };

  for (const [foregroundName, foreground] of Object.entries(foregrounds)) {
    for (const [backgroundName, background] of Object.entries(backgrounds)) {
      const ratio = contrastRatio(foreground, background);

      assert.ok(
        ratio >= 4.5,
        foregroundName + ' on ' + backgroundName +
          ' must be >= 4.5:1, got ' + ratio.toFixed(2) + ':1',
      );
    }
  }
});

test('P5.4H uses the AA-safe semantic muted color for Search placeholder text', () => {
  assert.match(
    search,
    /placeholderTextColor=\{wavenColors\.textMuted\}/,
  );

  assert.doesNotMatch(
    search,
    /placeholderTextColor=\{wavenColors\.mutedGray\}/,
  );

  const placeholderForeground = hexToRgb(hexColor('textMuted'));
  const canvas = hexToRgb(hexColor('canvas'));
  const glassSoft = rgbaColor('glassSoft');
  const searchBackground = composite(
    glassSoft.rgb,
    canvas,
    glassSoft.alpha,
  );

  const ratio = contrastRatio(
    placeholderForeground,
    searchBackground,
  );

  assert.ok(
    ratio >= 4.5,
    'Search placeholder contrast must be >= 4.5:1, got ' +
      ratio.toFixed(2) + ':1',
  );
});
