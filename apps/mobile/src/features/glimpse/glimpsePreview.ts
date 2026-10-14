import { GLIMPSE_INTERNAL_PREVIEW } from './glimpseBuild';

/** Temporary, explicit development exposure until the physical qualification gate. */
export function isGlimpsePreviewEnabled() {
  return GLIMPSE_INTERNAL_PREVIEW || (typeof __DEV__ !== 'undefined' && __DEV__
    && process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW === 'true');
}
