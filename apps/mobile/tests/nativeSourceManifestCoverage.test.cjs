'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../plugins/withOrionCinemaWebView.js');

test('native copy manifests cover every authoritative source and test exactly once', () => {
  for (const [directory, files] of [
    ['orion-cinema-webview-native', manifest.CINEMA_NATIVE_FILES],
    ['orion-cinema-webview-native-tests', manifest.CINEMA_NATIVE_TEST_FILES],
  ]) {
    const actual = fs.readdirSync(path.resolve(__dirname, '../plugins', directory))
      .filter(name => /\.(kt|java)$/.test(name));
    assert.equal(new Set(files).size, files.length, `${directory}: duplicate entries`);
    assert.deepEqual([...files].sort(), actual.sort(), `${directory}: source omitted or stale manifest entry`);
  }
});
