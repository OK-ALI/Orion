const test = require("node:test");
const assert = require("node:assert/strict");
const { assertPublicMediaUrl, publicIp } = require("../../../src/main/downloader/publicMediaUrl");

test("media descendant requests reject local and private destinations", async () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(publicIp(address), false, address);
  }
  assert.equal(publicIp("8.8.8.8"), true);
  await assert.rejects(assertPublicMediaUrl("http://localhost/media.ts"), /not public/);
  await assert.rejects(assertPublicMediaUrl("http://127.0.0.1/media.ts"), /not public/);
  await assert.rejects(assertPublicMediaUrl("https://user:pass@example.com/media.ts"), /not authorized/);
});
