'use strict';
const { JSDOM } = require('jsdom');
const { loader } = require('./animeModules.cjs');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true, url: 'http://localhost',
});
for (const key of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'ShadowRoot', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true });
}
for (const key of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  globalThis[key] = dom.window[key].bind(dom.window);
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = require('react');
const RN = require('react-native-web');
const testing = require('@testing-library/react');
const { createElement: h } = React;
const pressable = React.forwardRef(({ accessibilityState, ...props }, ref) => h(RN.Pressable, {
  ...props, ref, accessibilityState, 'aria-checked': accessibilityState?.checked,
}));
const view = React.forwardRef(({ importantForAccessibility, accessibilityElementsHidden, accessibilityValue, ...props }, ref) => h(RN.View, {
  ...props, ref, 'aria-hidden': accessibilityElementsHidden || importantForAccessibility === 'no-hide-descendants' || props['aria-hidden'],
  'aria-valuemin': accessibilityValue?.min, 'aria-valuemax': accessibilityValue?.max,
  'aria-valuenow': accessibilityValue?.now, 'aria-valuetext': accessibilityValue?.text,
}));
const scrollView = React.forwardRef(({ importantForAccessibility, accessibilityElementsHidden, ...props }, ref) => h(RN.ScrollView, {
  ...props, ref, 'aria-hidden': accessibilityElementsHidden || importantForAccessibility === 'no-hide-descendants',
}));
const textInput = React.forwardRef(({ accessibilityHint, ...props }, ref) => h(RN.TextInput, {
  ...props, ref, dataSet: { accessibilityHint },
}));
const saved = {
  schemaVersion: 2, manualTheme: 'custom', followSystem: false, lightTheme: 'projector-silver',
  darkTheme: 'slate', customAccent: '#3867D6', reducedMotion: false,
};
const key = 'mobileThemePreferencesV2';

function createStudioHarness(options = {}) {
  const env = {
    width: 390, height: 800, fontScale: 1, keyboard: false, scheme: 'dark',
    insets: { top: 24, bottom: 24, left: 0, right: 0 },
    profile: 'balanced', systemReduced: false, unavailable: false, failWrite: false,
    appState: 'active', routeFocused: true, platform: 'android',
    records: { [key]: JSON.stringify(saved) }, ...options,
  };
  const writes = [];
  const attempts = [];
  const focus = [];
  const focusTargets = [];
  const scrolls = [];
  const areaControl = { props: null };
  const pickerScroll = { props: null };
  const pickerViewport = { props: null };
  const adjustments = new Map();
  const measuredView = React.forwardRef((props, ref) => {
    const node = React.useRef(null);
    if (props.testID === 'studio-color-area') areaControl.props = props;
    if (props.testID === 'studio-picker-visible') pickerViewport.props = props;
    if (props.accessibilityRole === "adjustable") adjustments.set(props.accessibilityLabel, props.onAccessibilityAction);
    React.useImperativeHandle(ref, () => {
      const element = node.current;
      if (element && props.testID?.startsWith('studio-')) {
        element.measureInWindow = callback => {
          const frame = env.frames?.[props.testID] ?? {
            x: env.insets.left, y: env.insets.top,
            width: env.width - env.insets.left - env.insets.right,
            height: env.height - env.insets.top - env.insets.bottom,
          };
          callback(frame.x, frame.y, frame.width, frame.height);
        };
      }
      return element;
    });
    return h(view, { ...props, ref: node });
  });
  const trackedScroll = React.forwardRef((props, ref) => {
    if (props.testID === 'studio-picker-scroll') pickerScroll.props = props;
    const node = React.useRef(null);
    React.useImperativeHandle(ref, () => ({
      scrollTo(options) { scrolls.push({ id: props.testID, ...options }); node.current.scrollTo(options); },
    }));
    return h(scrollView, { ...props, ref: node });
  });
  function Gradient({ colors, start }) {
    return h('div', {
      style: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to ' +
        (start ? 'right' : 'bottom') + ',' + colors.join(',') + ')' },
    });
  }
  const listeners = new Map();
  const add = (name, callback) => {
    const callbacks = listeners.get(name) ?? new Set();
    callbacks.add(callback);
    listeners.set(name, callbacks);
    return { remove: () => callbacks.delete(callback) };
  };
  const emit = (name, ...args) => listeners.get(name)?.forEach(callback => callback(...args));
  const navigation = {
    isFocused: () => env.routeFocused,
    addListener: (name, callback) => add('navigation:' + name, callback).remove,
  };
  function dismissKeyboard() {
    if (!env.keyboard) return;
    env.keyboard = false;
    env.keyboardFrame = null;
    emit('keyboardDidHide');
  }
  function Modal(props) {
    env.modal = props;
    React.useEffect(() => { props.onShow?.(); }, []);
    return h(RN.View, {
      style: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    }, props.children);
  }
  const native = {
    ...RN, Modal, View: measuredView, ScrollView: trackedScroll, Pressable: pressable, TextInput: textInput,
    Switch: props => h(RN.Switch, { ...props, activeThumbColor: props.thumbColor, activeTrackColor: props.trackColor?.true, trackColor: props.trackColor?.false }),
    Platform: { ...RN.Platform, OS: env.platform }, StatusBar: () => null,
    Appearance: { getColorScheme: () => env.scheme, addChangeListener: callback => add('scheme', callback) },
    AppState: { addEventListener: add, get currentState() { return env.appState; } },
    Keyboard: { addListener: add, isVisible: () => env.keyboard, metrics: () => env.keyboardFrame, dismiss: dismissKeyboard },
    useWindowDimensions: () => ({ width: env.width, height: env.height, fontScale: env.fontScale, scale: 1 }),
    findNodeHandle: node => node === env.missingHandle ? null : node,
    AccessibilityInfo: { setAccessibilityFocus(node) {
      focusTargets.push(node);
      focus.push(node?.getAttribute?.('aria-label') || node?.textContent);
    } },
  };
  const performance = { usePerformanceProfile: () => ({
    selection: env.profile, resolvedProfile: env.profile, setSelection() {},
  }) };
  const mocks = {
    'react-native': native,
    'expo-linear-gradient': { LinearGradient: Gradient },
    'react-native-safe-area-context': { useSafeAreaInsets: () => env.insets },
    '@expo/vector-icons': { Ionicons: ({ size, color, name }) => h('span', {
      'aria-hidden': true, 'data-studio-icon': name,
      style: { width: size, height: size, flexShrink: 0, fontSize: size, lineHeight: size + 'px', color, textAlign: 'center' },
    }, ({ close: '×', 'checkmark-circle': '✓', 'chevron-forward': '›', 'chevron-up': '⌃', add: '+', remove: '−' })[name] ?? '') },
    '../hooks/useSystemReducedMotion': { useSystemReducedMotion: () => env.systemReduced },
    '../services/storageAdapter': {
      getMobileStorageHealth: () => ({ state: env.unavailable ? 'unavailable' : 'ready' }),
      mmkvStorageAdapter: {
        get: name => env.records[name] ?? null,
        set(name, value) {
          attempts.push(name);
          if (env.failWrite) throw Error('Simulated storage failure');
          writes.push({ name, value: JSON.parse(value) });
          env.records[name] = value;
        },
      },
    },
    '../../context/PerformanceContext': performance,
    '../../src/context/PerformanceContext': performance,
    '../../src/services/responsive': { useResponsiveLayout: () => ({ isTablet: env.width >= 840 }) },
    'expo-router': { useLocalSearchParams: () => ({}), useNavigation: () => navigation },
    '../../src/components/MobilePageHeader': { MobilePageHeader: () => null },
    '../../src/features/settings/settingsSectionOrderPreferences': {
      useSettingsSectionOrderPreferences: () => ({ order: ['appearance', 'accessibility'], save() {} }),
    },
    '../../src/features/settings/SettingsSectionNavigator': {
      SettingsSectionNavigator: () => h(RN.Text, null, 'Jump to section'),
    },
    ...Object.fromEntries([
      'AccountSettingsContent', 'UpdatesSettingsContent', 'NotificationSettingsContent', 'HomeLayoutSettingsContent',
    ].map(name => ['../../src/features/settings/' + name, { [name]: () => null }])),
    '../../src/features/downloads/DownloadSettingsContent': { DownloadSettingsContent: () => null },
  };
  const load = loader(mocks);
  const { ThemeProvider, useOrionTheme } = load('apps/mobile/src/context/ThemeContext.tsx');
  mocks['../../src/context/ThemeContext'] = { ...load('apps/mobile/src/context/ThemeContext.tsx') };
  const Studio = load('apps/mobile/src/features/appearance/AppearanceStudioDialog.tsx').default;
  const Settings = options.settings ? load('apps/mobile/app/(tabs)/settings.tsx').default : null;
  let state;
  function Screen() {
    state = useOrionTheme();
    const [open, setOpen] = React.useState(true);
    if (Settings) return h(Settings);
    return open ? h(Studio, { onClose: () => setOpen(false) }) : null;
  }
  const app = () => h(ThemeProvider, null, h(Screen));
  const rendered = testing.render(app());
  return {
    env, writes, attempts, focus, focusTargets, scrolls, rendered, get state() { return state; },
    get: rendered.getByRole, query: rendered.queryByRole,
    choose: name => testing.fireEvent.click(rendered.getByRole('radio', { name })),
    press: name => testing.fireEvent.click(rendered.getByRole('button', { name })),
    switchFollow() { testing.fireEvent.click(rendered.getByLabelText('Follow system appearance')); },
    adjust(name, actionName) { testing.act(() => adjustments.get(name)({ nativeEvent: { actionName } })); },
    measureArea(width, height) {
      testing.act(() => areaControl.props.onLayout({ nativeEvent: { layout: { width, height } } }));
    },
    areaTap(x, y, width, height) {
      this.measureArea(width, height);
      this.areaGesture('start', x, y);
      this.areaGesture('end', x, y);
    },
    areaGesture(phase, x, y) {
      const event = { nativeEvent: { locationX: x, locationY: y } };
      const props = areaControl.props;
      if (phase === 'start' && !props.onStartShouldSetResponder(event)) {
        throw Error('Shade area did not accept the touch responder');
      }
      const handlers = {
        start: props.onResponderGrant, move: props.onResponderMove,
        end: props.onResponderRelease, terminate: props.onResponderTerminate,
      };
      testing.act(() => handlers[phase](event));
    },
    measurePickerLayout(width, contentHeight, viewportHeight) {
      testing.act(() => {
        pickerViewport.props.onLayout({ nativeEvent: { layout: { width, height: viewportHeight } } });
        pickerScroll.props.onContentSizeChange?.(width, contentHeight);
      });
    },
    scrollPicker(offset) {
      testing.act(() => pickerScroll.props.onScroll({ nativeEvent: { contentOffset: { y: offset } } }));
    },
    canScrollPicker: () => pickerScroll.props.scrollEnabled !== false,
    canTransferShadeResponder: () => areaControl.props.onResponderTerminationRequest(),
    hex: value => testing.fireEvent.change(testing.within(rendered.getByTestId('studio-picker-scroll')).getByRole('textbox'), { target: { value } }),
    resize(values) { Object.assign(env, values); rendered.rerender(app()); },
    scheme(scheme, foreground = false) {
      testing.act(() => {
        env.scheme = scheme;
        if (foreground) emit('change', 'active');
        else emit('scheme', { colorScheme: scheme });
      });
    },
    toggleKeyboard(shown, frame = { screenX: 0, screenY: env.height - 255, width: env.width, height: 255 }) {
      testing.act(() => {
        env.keyboard = shown;
        env.keyboardFrame = shown ? frame : null;
        emit(shown ? 'keyboardDidShow' : 'keyboardDidHide', { endCoordinates: frame });
      });
    },
    back: () => testing.act(() => env.modal.onRequestClose()),
    windowFocus: focused => testing.act(() => emit(focused ? 'focus' : 'blur')),
    appState(value) {
      testing.act(() => { env.appState = value; emit('change', value); });
    },
    routeFocus(focused) {
      testing.act(() => { env.routeFocused = focused; emit(focused ? 'navigation:focus' : 'navigation:blur'); });
    },
    listenerCount: name => listeners.get(name)?.size ?? 0,
    unmount: () => rendered.unmount(),
  };
}

const viewports = [
  { name: 'portrait', width: 390, height: 844, fontScale: 1 },
  { name: '130% font', width: 390, height: 844, fontScale: 1.3 },
  { name: '200% font model', width: 390, height: 844, fontScale: 2 },
  { name: 'display zoom model', width: 320, height: 660, fontScale: 1 },
  { name: '200% + display zoom model', width: 300, height: 620, fontScale: 2 },
  { name: 'compact portrait', width: 320, height: 568, fontScale: 1 },
  { name: 'landscape', width: 800, height: 360, fontScale: 1.3, insets: { top: 10, bottom: 20, left: 30, right: 30 } },
  { name: 'large phone', width: 480, height: 960, fontScale: 1 },
  { name: 'tablet', width: 1100, height: 850, fontScale: 1 },
  { name: 'tablet with 200% font model', width: 1100, height: 850, fontScale: 2 },
  { name: 'compact keyboard', width: 300, height: 300, fontScale: 2, ime: true, nativeResized: true },
  { name: 'landscape keyboard', width: 800, height: 220, fontScale: 1.3, ime: true, nativeResized: true },
  { name: '200% zoom with a native keyboard overlay', width: 300, height: 620, fontScale: 2, ime: true, keyboardTop: 355 },
  { name: 'short landscape keyboard overlay', width: 800, height: 360, fontScale: 1.3, ime: true, keyboardTop: 220 },
  { name: 'three-button insets', width: 390, height: 760, fontScale: 1.3, insets: { top: 24, bottom: 48, left: 0, right: 0 } },
];

module.exports = { createStudioHarness, saved, key, testing, viewports, RN };


async function verifyGeometry(executablePath, evidenceDirectory) {
  const assert = require('node:assert/strict');
  const { chromium } = require('playwright');
  const path = require('node:path');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    for (const size of viewports) {
      await page.setViewportSize({ width: size.width, height: size.height });
      const f = createStudioHarness({ ...size, settings: true });
      async function loadLayout(container) {
        const style = RN.StyleSheet.getSheet().textContent;
        await page.setContent('<!doctype html><style>body{margin:0}'+ style + '</style>' + container.outerHTML);
        await page.evaluate(fontScale => {
          const text = [...document.querySelectorAll('[dir="auto"], input')];
          const original = text.map(element => {
            const { fontSize, lineHeight } = getComputedStyle(element);
            return { fontSize: parseFloat(fontSize), lineHeight: parseFloat(lineHeight) };
          });
          text.forEach((element, index) => {
            const { fontSize, lineHeight } = original[index];
            element.style.fontSize = fontSize * fontScale + 'px';
            if (Number.isFinite(lineHeight)) element.style.lineHeight = lineHeight * fontScale + 'px';
          });
        }, size.fontScale);
      }
      async function assertTypography(element, fontSize, fontWeight, lineHeight) {
        const style = await element.evaluate(node => {
          const { fontSize, fontWeight, lineHeight } = getComputedStyle(node);
          return { fontSize, fontWeight, lineHeight };
        });
        assert.ok(Math.abs(parseFloat(style.fontSize) - fontSize * size.fontScale) < 0.01, 'text size');
        if (fontWeight) assert.equal(style.fontWeight, String(fontWeight), 'text weight');
        if (lineHeight) assert.ok(Math.abs(parseFloat(style.lineHeight) - lineHeight * size.fontScale) < 0.01, 'line height');
      }
      async function assertVisible(selector) {
        const element = page.locator(selector).first();
        await element.evaluate(node => node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
        const box = await element.boundingBox();
        const active = (await page.getByTestId('studio-picker-scroll').count()) ? 'studio-picker-scroll' : 'studio-scroll';
        const scroll = await page.getByTestId(active).boundingBox();
        assert.ok(box.y >= scroll.y - 1 && box.y + box.height <= scroll.y + scroll.height + 1,
          'clipped viewport action: ' + selector + ' ' + JSON.stringify({box, scroll}));
      }
      async function assertNoCollisions() {
        const issues = await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="studio-modal"]');
          const scroll = modal.querySelector('[data-testid="studio-picker-scroll"]') ??
            modal.querySelector('[data-testid="studio-scroll"]');
          const controls = [...scroll.querySelectorAll('button, [role="radio"], [role="slider"], input:not([type="checkbox"])')];
          const rects = controls.map(node => node.getBoundingClientRect());
          const bounds = scroll.getBoundingClientRect();
          const issues = [];
          const name = node => node.getAttribute('aria-label') || node.textContent;
          for (const [index, rect] of rects.entries()) {
            const control = controls[index];
            if (rect.height < 47.9 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1) {
              issues.push('touch target outside safe area: ' + name(control));
            }
            for (const other of rects.slice(index + 1)) {
              if (Math.min(other.right, rect.right) - Math.max(other.left, rect.left) > 1 &&
                  Math.min(other.bottom, rect.bottom) - Math.max(other.top, rect.top) > 1) {
                issues.push('controls overlap: ' + name(control));
              }
            }
            const label = control.querySelector('[dir="auto"]');
            const icon = control.querySelector('[aria-hidden="true"]');
            if (label && icon && icon.getBoundingClientRect().left > label.getBoundingClientRect().left &&
                label.getBoundingClientRect().right > icon.getBoundingClientRect().left + 1) {
              issues.push('checkmark overlaps label: ' + name(control));
            }
          }
          for (const node of scroll.querySelectorAll('[dir="auto"]:not(input)')) {
            if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) {
              issues.push('text clipped: ' + node.textContent);
            }
          }
          const padding = getComputedStyle(modal);
          if (bounds.top < parseFloat(padding.paddingTop) - 1 ||
              bounds.bottom > innerHeight - parseFloat(padding.paddingBottom) + 1 ||
              bounds.left < parseFloat(padding.paddingLeft) - 1 ||
              bounds.right > innerWidth - parseFloat(padding.paddingRight) + 1 ||
              scroll.scrollWidth > scroll.clientWidth + 1) issues.push('scroll area exceeds insets ' +
                JSON.stringify({ bounds: bounds.toJSON(), viewport: [innerWidth, innerHeight],
                  padding: [padding.paddingTop, padding.paddingRight, padding.paddingBottom, padding.paddingLeft],
                  widths: [scroll.scrollWidth, scroll.clientWidth] }));
          return issues;
        });
        assert.deepEqual(issues, [], 'collision check');
      }
      async function assertShadeStability(modal, atEnd = false) {
        const pickerScroll = page.getByTestId('studio-picker-scroll');
        const area = page.getByTestId('studio-color-area');
        const warning = pickerScroll.getByText('Adjusted for contrast.', { exact: true });
        await area.evaluate((element, end) => {
          const scroll = element.closest('[data-testid="studio-picker-scroll"]');
          if (end) scroll.scrollTop = scroll.scrollHeight;
          else element.scrollIntoView({ block: 'center', inline: 'nearest' });
        }, atEnd);
        const original = await area.boundingBox();
        const scrollTop = await pickerScroll.evaluate(scroll => scroll.scrollTop);
        const content = await pickerScroll.evaluate(node => ({
          width: node.clientWidth, height: node.scrollHeight, viewportHeight: node.clientHeight,
        }));
        f.measureArea(original.width, original.height);
        f.measurePickerLayout(content.width, content.height, content.viewportHeight);
        assert.equal(await warning.count(), atEnd ? 1 : 0);
        for (const [index, step] of (atEnd ? [
          [.15, .05, true], [.29, .61, false], [.09, .05, true], [.85, .82, false],
        ] : [
          [.29, .61, false], [.15, .05, true], [.85, .82, false], [.09, .05, true], [.48, .21, true], [.29, .61, false],
        ]).entries()) {
          const [x, y, adjusted] = step;
          const next = await area.boundingBox();
          // The finger uses the opening screen coordinates. RN receives them relative to the current view.
          f.areaGesture(index === 0 ? 'start' : 'move',
            original.x + original.width * x - next.x, original.y + original.height * y - next.y);
          await loadLayout(modal);
          await pickerScroll.evaluate((node, offset) => { node.scrollTop = offset; }, scrollTop);
          const actual = await area.boundingBox();
          const thumb = await page.getByTestId('studio-picker-scrollbar').boundingBox();
          const viewport = await pickerScroll.boundingBox();
          assert.ok(thumb.x >= actual.x + actual.width && thumb.x + thumb.width <= viewport.x + viewport.width,
            'accent scroll thumb must be outside the shade and inside the picker');
          const actualOffset = await pickerScroll.evaluate(node => node.scrollTop);
          const difference = actual.y - original.y;
          console.log('SHADE_GEOMETRY ' + JSON.stringify({
            viewport: size.name, atEnd, step: index, adjusted, shade: actual, deltaY: difference, scrollTop: actualOffset,
          }));
          assert.ok(Math.abs(difference) <= 1, 'shade moved by ' + difference + ' CSS px at contrast boundary');
          for (const property of ['x', 'width', 'height']) {
            assert.ok(Math.abs(actual[property] - original[property]) <= 1, 'shade changed ' + property);
          }
          assert.ok(Math.abs(actualOffset - scrollTop) <= 1, 'scroll offset changed during shade drag');
          assert.equal(await warning.count(), adjusted ? 1 : 0);
          if (adjusted) {
            assert.equal(await pickerScroll.getByText(/^Requested #[A-F0-9]{6}$/).count(), 1);
            assert.equal(await pickerScroll.getByText(/^Displayed #[A-F0-9]{6}$/).count(), 1);
          }
          assert.equal(f.get('slider', { name: 'Saturation' }).getAttribute('aria-valuenow'), String(Math.round(x * 100)));
          assert.equal(f.get('slider', { name: 'Brightness' }).getAttribute('aria-valuenow'), String(Math.round((1 - y) * 100)));
          assert.equal(f.canScrollPicker(), false);
          assert.equal(f.attempts.length, 0);
        }
        f.areaGesture('end');
        assert.equal(f.canScrollPicker(), true);
      }
      const snapshot = async name => {
        if (evidenceDirectory) await page.screenshot({ path: path.join(evidenceDirectory, name + '.png') });
      };
      const layoutFrame = () => testing.act(async () => { await new Promise(requestAnimationFrame); });
      try {
        await loadLayout(f.rendered.container);
        const entry = page.getByRole('button', { name: 'Appearance Studio' });
        const row = await entry.boundingBox();
        assert.ok(row.width > 0 && row.height >= 48);
        assert.ok(await entry.evaluate(el => {
          const [copy, icon] = el.children;
          return copy.getBoundingClientRect().right < icon.getBoundingClientRect().left &&
            [...copy.children].every(text => text.scrollWidth <= text.clientWidth + 1);
        }), 'Settings entry text and icon collide');
        f.press('Appearance Studio');
        const modal = f.rendered.getByTestId('studio-modal').parentElement;
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('button:has-text("Apply")');
        await assertTypography(page.getByRole('heading', { name: 'Appearance Studio' }), 20, 900);
        for (const name of ['Theme', 'Custom Palette', 'Preview']) {
          await assertTypography(page.getByRole('heading', { name, exact: true }), 16, 900);
        }
        const follow = page.getByTestId('studio-scroll').getByText('Follow system appearance', { exact: true });
        await assertTypography(follow, 16, 800);
        assert.ok(await follow.evaluate(label =>
          label.getBoundingClientRect().right <= label.nextElementSibling.getBoundingClientRect().left + 1),
        'Follow System label and switch collide');
        const fixedTheme = page.getByRole('button', { name: /Fixed theme,/ });
        await assertTypography(fixedTheme.getByText('Fixed theme', { exact: true }), 13, 800);
        await assertTypography(fixedTheme.getByText('Custom Dark', { exact: true }), 11, null, 18);
        if (size.name === 'portrait') {
          await page.getByTestId('studio-scroll').evaluate(element => { element.scrollTop = 0; });
          await snapshot('appearance-studio-browser');
        }
        f.press(/Fixed theme,/);
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('[aria-label="Midnight Premiere theme"]');
        const card = page.getByRole('radio', { name: 'Midnight Premiere theme' });
        await assertTypography(card.getByText('Midnight Premiere theme', { exact: true }), 13, 800);
        await assertTypography(card.locator('[dir="auto"]').nth(1), 11, null, 15);
        f.choose('Custom Light');
        await loadLayout(modal);
        await assertNoCollisions();
        for (const role of ['accent', 'background', 'surface', 'text', 'border']) {
          await assertVisible('[data-testid="studio-role-' + role + '"] button');
        }
        await assertVisible('button:has-text("Restore default palette")');
        if (size.name === 'portrait') {
          await page.getByRole('heading', { name: 'Custom Palette' })
            .evaluate(node => node.scrollIntoView({ block: 'start', inline: 'nearest' }));
          await snapshot('appearance-palette-browser');
        }
        f.press(/Edit Border,/);
        await layoutFrame();
        await loadLayout(modal);
        await assertNoCollisions();
        assert.equal(await page.getByRole('heading', { name: 'Orion Accents' }).count(), 0);
        await assertVisible('button:has-text("Use Color")');
        f.press('Cancel color');
        f.choose('Custom Dark');
        f.press(/Edit Accent,/);
        await layoutFrame();
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('[data-testid="studio-color-area"]');
        await assertVisible('[aria-label="Midnight Premiere, #E50914"]');
        const picker = page.getByTestId('studio-picker-scroll');
        await assertTypography(picker.getByRole('heading', { name: 'Custom Dark · Accent' }), 20, 900);
        for (const name of ['Orion Accents', 'Hue', 'Shade']) {
          await assertTypography(picker.getByRole('heading', { name }), 16, 900);
        }
        for (const label of ['Saturation', 'Brightness']) {
          const step = picker.getByRole('slider', { name: label });
          await assertTypography(step.getByText(label, { exact: true }), 13, 800);
          await assertTypography(step.getByText(/^\d+%$/), 14);
        }
        const shade = await page.getByTestId('studio-color-area').boundingBox();
        f.measureArea(shade.width, shade.height);
        f.areaGesture('start', shade.width * .25, shade.height * .75);
        f.areaGesture('move', shade.width * .65, shade.height * .35);
        assert.equal(f.get('slider', { name: 'Saturation' }).getAttribute('aria-valuenow'), '65');
        assert.equal(f.get('slider', { name: 'Brightness' }).getAttribute('aria-valuenow'), '65');
        assert.equal(f.canScrollPicker(), false);
        f.areaGesture('end');
        assert.equal(f.canScrollPicker(), true);
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('button:has-text("Use Color")');
        if (size.name === 'portrait') {
          await page.getByTestId('studio-picker-scroll').evaluate(element => { element.scrollTop = 0; });
          await snapshot('appearance-picker-browser');
        }
        f.press('Enter HEX');
        f.hex('bad');
        f.press('Use Color');
        if (size.ime) {
          const top = size.nativeResized ? size.height : size.keyboardTop;
          f.toggleKeyboard(true, { screenX: 0, screenY: top, width: size.width, height: 255 });
        }
        await layoutFrame();
        await layoutFrame();
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('input');
        await assertVisible('[role="alert"]');
        await assertVisible('[data-testid="studio-hex-group"]');
        const field = await page.getByTestId('studio-hex-group').boundingBox();
        const visible = await page.getByTestId('studio-picker-scroll').boundingBox();
        assert.ok(field.y >= visible.y - 1 && field.y + field.height <= visible.y + visible.height + 1,
          'HEX field and error must fit together: ' + JSON.stringify({ field, visible }));
        if (size.keyboardTop) {
          assert.ok(visible.y + visible.height <= size.keyboardTop + 1, 'picker must stop above modeled IME');
          if (size.fontScale === 2 && evidenceDirectory) {
            await page.evaluate(top => {
              const keyboard = document.createElement('div');
              keyboard.textContent = 'Modeled Android keyboard';
              Object.assign(keyboard.style, {
                position: 'fixed', top: top + 'px', bottom: '0', left: '0', right: '0',
                background: '#262732', color: '#e0dfe9', font: '14px Segoe UI, sans-serif',
                padding: '14px', pointerEvents: 'none',
              });
              document.body.appendChild(keyboard);
            }, size.keyboardTop);
            await snapshot('appearance-picker-zoom-ime-browser');
          }
        }
        await assertVisible('button:has-text("Cancel color")');
        await assertVisible('button:has-text("Use Color")');
        f.toggleKeyboard(false);
        await layoutFrame();
        f.press('Close color picker');
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('button:has-text("Keep editing color")');
        await assertVisible('button:has-text("Discard color changes")');
        f.press('Discard color changes');
        f.choose('Custom Light');
        f.press(/Edit Accent,/);
        f.choose('Blue hue');
        if (size.ime) {
          f.press('Enter HEX');
          const top = size.nativeResized ? size.height : size.keyboardTop;
          f.toggleKeyboard(true, { screenX: 0, screenY: top, width: size.width, height: 255 });
          await layoutFrame();
        }
        await loadLayout(modal);
        await assertShadeStability(modal);
        await assertNoCollisions();
        if (size.name === 'portrait') {
          const shade = await page.getByTestId('studio-color-area').boundingBox();
          f.areaTap(shade.width * .15, shade.height * .05, shade.width, shade.height);
          await loadLayout(modal);
          await assertShadeStability(modal, true);
        }
        f.toggleKeyboard(false);
        f.press('Cancel color');
        f.choose('Custom Dark');
        f.choose('Mocha theme');
        f.press('Cancel');
        await loadLayout(modal);
        await assertNoCollisions();
        await assertVisible('button:has-text("Keep editing")');
        await assertVisible('button:has-text("Discard changes")');
        console.log('PASS ' + size.name + ' — Settings entry, theme cards, picker, HEX and discard controls');
      } catch (error) {
        throw new Error(size.name + ': ' + error.message, { cause: error });
      } finally {
        f.unmount();
      }
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  verifyGeometry(process.argv[2], process.argv[3]).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
