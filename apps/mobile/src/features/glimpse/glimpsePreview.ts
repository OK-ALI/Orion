import { GLIMPSE_INTERNAL_PREVIEW, GLIMPSE_PRODUCTION_ENABLED } from './glimpseBuild';

/** Qualified public exposure is independent of the bounded internal/development preview. */
export function isGlimpsePreviewEnabled() {
  return GLIMPSE_PRODUCTION_ENABLED || GLIMPSE_INTERNAL_PREVIEW || (typeof __DEV__ !== 'undefined' && __DEV__
    && process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW === 'true');
}
