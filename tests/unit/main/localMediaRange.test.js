const test = require("node:test");
const assert = require("node:assert/strict");
const { parseByteRange } = require("../../../src/main/player/localMediaRange");

test("local media ranges support seeking and reject out-of-bounds tokens", () => {
  assert.deepEqual(parseByteRange(null, 1000), { start: 0, end: 999, status: 200 });
  assert.deepEqual(parseByteRange("bytes=100-199", 1000), { start: 100, end: 199, status: 206 });
  assert.deepEqual(parseByteRange("bytes=-100", 1000), { start: 900, end: 999, status: 206 });
  assert.equal(parseByteRange("bytes=1200-", 1000), null);
});
