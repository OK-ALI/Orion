const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
function loader(mocks = {}) {
  const cache = new Map();
  return function load(relative) {
    const file = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === '@orion/shared/cinema-block-rules') return require(path.join(root, 'packages/shared/cinemaBlockRules.cjs'));
      if (id === '@orion/shared/sources') return load('packages/shared/src/sources/registry.ts');
      if (id.startsWith('.')) {
        const target = path.resolve(path.dirname(file), id);
        const resolved = fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts');
        return load(resolved);
      }
      return createRequire(file)(id);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  };
}
module.exports = { root, read, loader };
