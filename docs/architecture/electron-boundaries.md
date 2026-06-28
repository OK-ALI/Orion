# Electron boundaries

The renderer cannot use Node.js APIs. All privileged operations go through the preload bridge.

`src/preload/index.js` composes domain APIs while preserving the existing flat `window.electron` names. The IPC compatibility test compares all exposed methods and renderer channels with `tests/fixtures/ipc-contract.json`.

Main-process handlers validate URLs and paths before opening or proxying them. Secure credentials, cookies, request headers, tool paths, and spawn arguments remain outside React. Local media uses opaque time-limited grants, and ambient sampling emits palettes rather than captured frames. Compatibility aliases remain available through v1.0.9 and can only be removed in a later breaking release.

The source-binding check parses renderer, preload, and main-process modules. It fails on unresolved JavaScript identifiers and unresolved JSX component names, covering runtime-only extraction errors that Vite may otherwise accept.
