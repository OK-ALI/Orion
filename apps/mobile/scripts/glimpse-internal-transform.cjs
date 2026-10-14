'use strict';
const path = require('node:path');
const marker = 'ORION_GLIMPSE_INTERNAL_PHYSICAL_TEST_ONLY';
function internalPreviewTransform(args, targetFile, enabled) {
  if (!enabled || path.resolve(args.filename) !== path.resolve(targetFile)) return args;
  const original = 'export const GLIMPSE_INTERNAL_PREVIEW = false;';
  if (args.src.split(original).length !== 2) throw new Error('Internal preview build gate differs from the qualified source');
  return { ...args, src: args.src.replace(original, "export const GLIMPSE_INTERNAL_PREVIEW = true; // " + marker) };
}
module.exports = { internalPreviewTransform, marker };
