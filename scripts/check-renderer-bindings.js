const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const root = path.join(__dirname, "..", "src");
const sourceExtensions = new Set([".js", ".jsx"]);
const files = [];
const allowedGlobals = new Set([
  "AbortController",
  "AbortSignal",
  "Array",
  "Audio",
  "Blob",
  "Boolean",
  "Buffer",
  "CSS",
  "CustomEvent",
  "DOMParser",
  "Date",
  "Error",
  "Event",
  "File",
  "FileReader",
  "FormData",
  "Headers",
  "Highlight",
  "HTMLElement",
  "HTMLMediaElement",
  "Image",
  "Infinity",
  "IntersectionObserver",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "MediaSource",
  "MutationObserver",
  "NaN",
  "Node",
  "NodeFilter",
  "NodeList",
  "Number",
  "Object",
  "Promise",
  "Reflect",
  "RegExp",
  "Request",
  "Range",
  "ResizeObserver",
  "Response",
  "Set",
  "String",
  "Symbol",
  "TextDecoder",
  "TextEncoder",
  "TypeError",
  "URL",
  "URLSearchParams",
  "WeakMap",
  "WeakSet",
  "WebSocket",
  "__dirname",
  "__filename",
  "cancelAnimationFrame",
  "clearInterval",
  "clearImmediate",
  "clearTimeout",
  "console",
  "crypto",
  "document",
  "fetch",
  "globalThis",
  "global",
  "gc",
  "isFinite",
  "isNaN",
  "localStorage",
  "navigator",
  "parseFloat",
  "parseInt",
  "performance",
  "process",
  "queueMicrotask",
  "requestAnimationFrame",
  "requestIdleCallback",
  "require",
  "sessionStorage",
  "setInterval",
  "setImmediate",
  "setTimeout",
  "structuredClone",
  "undefined",
  "window",
  "exports",
  "module",
]);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
}

function rootJsxName(node) {
  let current = node;
  while (current && current.type === "JSXMemberExpression") current = current.object;
  return current?.type === "JSXIdentifier" ? current.name : null;
}

walk(root);
const failures = [];

for (const absolute of files) {
  const relative = path.relative(path.join(__dirname, ".."), absolute).replace(/\\/g, "/");
  const source = fs.readFileSync(absolute, "utf8");
  let ast;

  try {
    ast = parser.parse(source, { sourceType: "module", plugins: ["jsx"] });
  } catch (error) {
    failures.push(`${relative}:${error.loc?.line || 1} parse error: ${error.message}`);
    continue;
  }

  const seen = new Set();
  traverse(ast, {
    ReferencedIdentifier(identifierPath) {
      const name = identifierPath.node.name;
      if (allowedGlobals.has(name) || identifierPath.scope.hasBinding(name)) return;
      const key = `${name}:${identifierPath.node.loc?.start.line || 1}`;
      if (seen.has(key)) return;
      seen.add(key);
      failures.push(`${relative}:${identifierPath.node.loc?.start.line || 1} unbound identifier ${name}`);
    },
    JSXOpeningElement(elementPath) {
      const name = rootJsxName(elementPath.node.name);
      if (!name || name[0] !== name[0].toUpperCase()) return;
      if (allowedGlobals.has(name) || elementPath.scope.hasBinding(name)) return;
      const line = elementPath.node.loc?.start.line || 1;
      const key = `${name}:${line}`;
      if (seen.has(key)) return;
      seen.add(key);
      failures.push(`${relative}:${line} unbound JSX component ${name}`);
    },
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Source binding check passed for ${files.length} files.`);
