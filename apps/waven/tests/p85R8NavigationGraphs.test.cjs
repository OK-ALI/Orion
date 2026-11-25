const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, mount, React } = require('./helpers/navigationAnimatedFixture.cjs');

test('R8 tab selection keeps the installed RN AnimatedProps memo nodes attached', async t => {
  const f = fixture(), ui = await mount(t, f.nav), before = f.propsCreated;
  for (const path of ['/search', '/', '/library', '/search', '/']) { f.route(path); await ui.render(); }
  assert.equal(f.propsCreated, before, 'changing active tab must update existing native values, not replace AnimatedProps nodes');
});
test('R8 parent refreshes do not allocate another navigation interpolation graph', async t => {
  const f = fixture(), ui = await mount(t, f.nav), expressions = f.expressions.length, props = f.propsCreated;
  for (let i = 0; i < 8; i++) await ui.render();
  assert.equal(f.expressions.length, expressions); assert.equal(f.propsCreated, props);
});
test('R8 layout/font changes rebuild only required geometry and then stabilize', async t => {
  const f = fixture(), ui = await mount(t, f.nav), initial = f.expressions.length;
  f.viewport({ width: 630, fontScale: 1.4 }); await ui.render();
  assert.ok(f.expressions.length > initial); const after = f.expressions.length, props = f.propsCreated;
  f.route('/search'); await ui.render(); await ui.render();
  assert.equal(f.expressions.length, after); assert.equal(f.propsCreated, props);
  const labels = f.bindings.filter(b => b.style.left === '50%').slice(-3);
  assert.deepEqual(labels.map(b => b.style.width), [46,52,55].map(n => n * 1.4));
});
test('R8 memoized labels retain continuous R7 icon/mask/text geometry', async t => {
  const f = fixture(), ui = await mount(t, f.nav);
  const icons = f.bindings.filter(b => b.style.width === 24 && b.style.height === 22 && b.style.transform).slice(-3);
  const masks = f.bindings.filter(b => b.style.left === '50%').slice(-3);
  assert.equal(icons.length, 3); assert.equal(masks.length, 3);
  for (let i = 0; i < 3; i++) for (const p of [0,.125,.5,.875,1]) {
    const width = [46,52,55][i]; icons[i].style.transform[0].translateX.parentValue.setValue(p);
    assert.ok(Math.abs(f.read(icons[i].style.transform[0].translateX) + (width + 8) * p / 2) < 1e-8);
    assert.ok(Math.abs(f.read(masks[i].style.transform[0].translateX) + width - (12 + (4 + width/2) * p)) < 1e-8);
  }
  assert.equal(ui.container.querySelectorAll('button').length, 3);
});
test('R8 same-tab presses and primary route/Back selection preserve navigation ownership', async t => {
  const f = fixture(), ui = await mount(t, f.nav), buttons = () => [...ui.container.querySelectorAll('button')];
  await React.act(async () => buttons()[0].click()); assert.deepEqual(f.routes, []);
  await React.act(async () => buttons()[1].click()); assert.deepEqual(f.routes, ['/search']);
  f.route('/search'); await ui.render(); assert.equal(buttons()[1].getAttribute('aria-selected'), 'true');
  await React.act(async () => buttons()[2].click()); assert.deepEqual(f.routes, ['/search','/library']);
  f.route('/'); await ui.render(); assert.equal(buttons()[0].getAttribute('aria-selected'), 'true');
});
test('R8 Reduced Motion updates the same graph without starting another transition', async t => {
  const f = fixture(), ui = await mount(t, f.nav), props = f.propsCreated;
  f.reduced(true); await ui.render(); const timings = f.timings.length;
  f.route('/library'); await ui.render(); assert.equal(f.timings.length, timings); assert.equal(f.propsCreated, props);
  const icons = f.bindings.filter(b => b.style.width === 24 && b.style.height === 22 && b.style.transform).slice(-3);
  assert.deepEqual(icons.map(b => b.style.transform[0].translateX.parentValue.read()), [0,0,1]);
});
test('R8 frame progression avoids React commits and retains native animation drivers', async t => {
  const f = fixture(), ui = await mount(t, f.nav); f.route('/search'); await ui.render(); const commits = ui.commits;
  for (let i = 0; i <= 240; i++) for (const a of f.timings) a.value.setValue(i/240);
  assert.equal(ui.commits, commits); assert.ok(f.timings.length); assert.ok(f.timings.every(a => a.config.useNativeDriver));
  assert.equal(f.bindings.filter(b => ['width','height','marginLeft','left','top'].some(k => b.style[k] && typeof b.style[k].read === 'function')).length, 0);
});
