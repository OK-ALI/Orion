const assert = require('node:assert/strict');
/** Minimal effect/state scheduler: exercises real hooks without Android or a second renderer. */
function hookHarness() {
  const slots = []; let index = 0; let result; let hook; let props; let queued = false; let disposed = false;
  const effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const schedule = () => {
    if (queued || disposed) return;
    queued = true; queueMicrotask(() => { queued = false; if (!disposed) render(); });
  };
  const react = {
    useRef(value) { const at = index++; return slots[at] ??= { current: value }; },
    useState(value) {
      const at = index++; if (!slots[at]) slots[at] = { value: typeof value === 'function' ? value() : value };
      return [slots[at].value, next => {
        const value = typeof next === 'function' ? next(slots[at].value) : next;
        if (Object.is(value, slots[at].value)) return;
        slots[at].value = value; schedule();
      }];
    },
    useMemo(fn, deps) {
      const at = index++; if (!slots[at] || !same(slots[at].deps, deps)) slots[at] = { deps, value: fn() };
      return slots[at].value;
    },
    useCallback(fn, deps) {
      const at = index++; if (!slots[at] || !same(slots[at].deps, deps)) slots[at] = { deps, fn };
      return slots[at].fn;
    },
    useEffect(fn, deps) {
      const at = index++;
      if (!slots[at] || !same(slots[at].deps, deps)) {
        const previous = slots[at]; slots[at] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[at].cleanup = fn(); });
      }
    },
  };
  function render() { index = 0; result = hook(props); while (effects.length) effects.shift()(); }
  return { react, start(fn, input) { hook = fn; props = input; render(); },
    update(input) { props = input; render(); }, get result() { return result; },
    async settle() { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); },
    dispose() { disposed = true; for (const slot of slots) slot?.cleanup?.(); },
    assertMounted() { assert.equal(disposed, false); } };
}
module.exports = { hookHarness };
