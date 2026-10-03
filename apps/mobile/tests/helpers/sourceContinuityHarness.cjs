const { loader } = require('./animeModules.cjs');
const { hookHarness } = require('./playerHookHarness.cjs');
const jsx = (type, props) => ({ type, props });
function memoryStorage() {
  const values = new Map();
  return { values, get: key => values.get(key) || null, set: (key, value) => values.set(key, value), remove: key => values.delete(key) };
}
function libraryFixture(storage = memoryStorage()) {
  const harness = hookHarness();
  const react = { ...harness.react, createContext: () => ({ Provider: 'Provider' }) };
  const load = loader({ react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@orion/shared/api': { tmdbFetch: async () => ({}) },
    '../../services/storageAdapter': { mmkvStorageAdapter: memoryStorage() },
    '../services/mobileDiagnostics': { updateMobileDiagnostics() {} } });
  harness.start(load('apps/mobile/src/context/LibraryContext.tsx').LibraryProvider, { storage, children: null });
  return { storage, harness, load, get library() { return harness.result.props.children.props.children.props.value; } };
}
module.exports = { memoryStorage, libraryFixture, jsx };
