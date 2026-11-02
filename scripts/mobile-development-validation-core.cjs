'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const BASE = '5d5e893f8be951020015aa658dfe1a67d8c0b16d';
const HISTORICAL = '0df69eef3e0aee7ff94596f7a37c25943fb978037b845ec855aa541c38d2b8ba';
const SIGNER = '4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function need(condition, message) { if (!condition) throw new Error(message); }
function keys(value, expected) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  need(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()), 'Unreviewed object fields');
}
function safe(root, relative) {
  need(typeof relative === 'string' && relative.length > 0 && !relative.includes('\\') && !relative.includes(':') && !relative.startsWith('/') && relative.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe relative path');
  const base = fs.realpathSync(root);
  const result = path.resolve(base, relative);
  if (fs.existsSync(result)) {
    const real = fs.realpathSync(result);
    need(real.startsWith(base + path.sep), 'Input resolves outside workspace');
  } else {
    let parent = path.dirname(result);
    while (!fs.existsSync(parent)) parent = path.dirname(parent);
    need(parent === base || fs.realpathSync(parent).startsWith(base + path.sep), 'Parent resolves outside workspace');
  }
  return result;
}
function pinnedJson(root, file, expected) {
  need(/^[a-f0-9]{64}$/.test(expected || ''), 'Explicit reviewed authority SHA-256 required');
  const bytes = fs.readFileSync(safe(root, file));
  need(sha(bytes) === expected, 'Authority file differs from reviewed bytes');
  return JSON.parse(bytes.toString('utf8'));
}
function git(root, args) {
  return execFileSync('git', args, {cwd: root, env: {...process.env, GIT_NO_REPLACE_OBJECTS: '1'}, encoding: 'utf8'}).trim();
}
function baseline(root) {
  need(git(root, ['rev-parse', 'v4.0.0^{commit}']) === BASE, 'Official v4.0.0 preservation tag moved');
}
function canonical(bytes) {
  const text = bytes.toString('utf8');
  return !bytes.includes(0) && Buffer.from(text).equals(bytes) ? Buffer.from(text.replace(/\r\n/g, '\n')) : bytes;
}
module.exports = {fs, path, BASE, HISTORICAL, SIGNER, sha, need, keys, safe, pinnedJson, git, baseline, canonical};
