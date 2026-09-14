const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repo = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(repo, relative), "utf8");

test("P3.3 locks the shared provider registry contract to the proven Music Planet host surface", () => {
  const shared = read("packages/shared/src/music/registry.ts");
  const desktop = read("apps/desktop/src/main/music/providers/registry.js");

  for (const method of ["list", "get", "getActive", "setActive", "subscribe"]) {
    assert.match(
      shared,
      new RegExp(`\\b${method}\\s*\\(`),
      `shared registry contract must expose ${method}()`,
    );
  }

  const exportsBlock = desktop.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(exportsBlock, "Desktop provider registry exports must remain visible");

  for (const method of ["get", "getActive", "list", "setActive", "subscribe"]) {
    assert.match(
      exportsBlock[1],
      new RegExp(`\\b${method}\\b`),
      `Desktop registry evidence must preserve ${method}()`,
    );
  }
});

test("P3.3 preserves preferred-then-first-usable selection without copying Desktop persistence", () => {
  const shared = read("packages/shared/src/music/registry.ts");
  const desktop = read("apps/desktop/src/main/music/providers/registry.js");

  assert.match(desktop, /provider_preferences/);
  assert.match(desktop, /const preferred = get\(preferences\[kind\], kind\)/);
  assert.match(desktop, /usable\(preferred\) \? preferred : list\(kind\)\.find\(usable\)/);
  assert.match(desktop, /requiresConfiguration/);
  assert.match(desktop, /isConfigured/);

  assert.match(shared, /MusicProviderSelectionMap/);
  assert.match(shared, /Partial<Record<MusicProviderKind, string>>/);
  assert.doesNotMatch(
    shared,
    /database|sqlite|AsyncStorage|SecureStore|provider_preferences|password|credential|authorization|cookie/i,
  );
});

test("P3.3 keeps application-facing registry state descriptor-only and secret-free", () => {
  const shared = read("packages/shared/src/music/registry.ts");

  assert.match(shared, /export interface MusicProviderRegistrySnapshot/);
  assert.match(shared, /providers: readonly MusicProviderDescriptor\[\]/);
  assert.match(shared, /activeProviderIds: MusicProviderSelectionMap/);

  assert.doesNotMatch(
    shared,
    /accessToken|refreshToken|clientSecret|apiKey|headers|filePath|playbackUrl|writePortableProfile|NativeModules|child_process/i,
  );
});

test("P3.3 publishes the registry contract through the single shared music owner", () => {
  const index = read("packages/shared/src/music/index.ts");
  const waven = read("apps/waven/src/domain/music.ts");

  assert.match(index, /export \* from "\.\/registry";/);
  assert.equal(
    waven.trim(),
    '/** WAVEN consumes the ecosystem-owned, platform-neutral music contracts. */\nexport * from "@orion/shared/music";',
  );
  assert.doesNotMatch(waven, /ProviderRegistry|provider_preferences|setActive\s*\(/);
});
