const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (record, file) => {
  record._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file,
  );
};

const {
  resolvePreviewNavigationAppearance: resolve,
  resolvePreviewChromeBacking: backing,
} = require('../src/theme/previewChromeMaterials.ts');

const base = {
  outer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inner: {
    borderRadius: 999,
    padding: 5,
    gap: 5,
    minHeight: 58,
    backgroundColor: '#000000',
  },
  selectionPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: 999,
  },
  itemContent: {
    minHeight: 48,
    width: '100%',
  },
  labelActive: {
    color: '#FFFFFF',
    fontSize: 13,
  },
};

test('normal NOIR retains original navigation styles and backing', () => {
  const result = resolve(base, null);

  assert.equal(result.styles, base);
  assert.equal(result.activeTone, null);
  assert.equal(result.highlight, null);
  assert.equal(backing(null), null);
});

test('day and night adapt navigation without changing geometry', () => {
  const day = resolve(base, 0);
  const night = resolve(base, 1);

  assert.equal(day.activeTone, '#075F9F');
  assert.equal(night.activeTone, '#74D2FF');

  assert.equal(day.styles.labelActive.color, '#153247');
  assert.equal(night.styles.labelActive.color, '#F2F7FF');

  for (const result of [day, night]) {
    assert.equal(result.styles.outer, base.outer);
    assert.equal(result.styles.itemContent, base.itemContent);
    assert.equal(result.styles.inner.borderRadius, 999);
    assert.equal(result.styles.inner.padding, 5);
    assert.equal(result.styles.inner.minHeight, 58);
    assert.equal(result.styles.selectionPill.left, 5);
    assert.equal(result.styles.selectionPill.top, 5);
    assert.equal(result.styles.inner.borderColor, 'transparent');
  }

  assert.notEqual(
    day.styles.inner.backgroundColor,
    night.styles.inner.backgroundColor,
  );
});

test('navigation and root backing follow reversible shared progress', () => {
  const forward = Array.from(
    { length: 49 },
    (_, i) => [resolve(base, i / 48), backing(i / 48)],
  );

  const reverse = Array.from(
    { length: 49 },
    (_, i) => [
      resolve(base, (48 - i) / 48),
      backing((48 - i) / 48),
    ],
  );

  assert.deepEqual(forward, reverse.reverse());

  assert.ok(
    new Set(forward.map(x => x[0].activeTone)).size > 30,
  );

  assert.ok(
    new Set(forward.map(x => x[1].base)).size > 30,
  );

  assert.equal(backing(0).base, '#F4FAFF');
  assert.equal(backing(1).base, '#08192C');

  assert.equal(backing(0).fade[0], 'rgba(244,250,255,0.000)');
  assert.equal(backing(1).fade[0], 'rgba(8,25,44,0.000)');

  assert.equal(backing(0).fade[1], backing(0).base);
  assert.equal(backing(1).fade[1], backing(1).base);
});

test('actual navigation preserves finger gestures and shared atmosphere', () => {
  const app = path.resolve(__dirname, '..');

  const read = relative =>
    fs.readFileSync(path.join(app, relative), 'utf8');

  const nav = read('src/components/shell/WavenBottomNav.tsx');
  const scene = read('src/components/surfaces/WavenHomeScenePreview.tsx');
  const layout = read('app/_layout.tsx');
  const material = read('src/theme/previewChromeMaterials.ts');

  assert.match(nav, /useNavigationAppearance\(noirStyles\)/);
  assert.match(nav, /PanResponder\.create/);
  assert.match(nav, /onPanResponderMove/);
  assert.match(nav, /onPanResponderTerminate/);
  assert.match(nav, /router\.navigate\(ITEMS\[targetIndex\]\.href\)/);
  assert.match(nav, /selectionTranslateX/);
  assert.match(nav, /useNativeDriver: true/);
  assert.match(nav, /<PreviewHighlight/);

  assert.match(scene, /resolvePreviewChromeBacking\(materialProgress\)/);
  assert.match(scene, /colors=\{chromeBacking\.fade\}/);
  assert.match(scene, /height: '18%'/);

  assert.match(layout, /homeBacking\.base/);
  assert.match(layout, /pathname === '\/' \? chromeBacking : null/);
  assert.match(layout, /homeBacking \? null : showAtmosphericCanvas/);

  assert.match(material, /useContext\(WavenPreviewChromeContext\)/);
  assert.doesNotMatch(material, /withTiming|useSharedValue|setInterval/);
});