import {
  OrionNativeAssetPlayerSurface,
  type OrionOfflinePlayerSurfaceProps,
} from './OrionOfflinePlayerSurface';

/** Finalized normal-media route. Storage authority remains native and asset-ID-only. */
export function OrionFinalizedPlayerSurface(props: OrionOfflinePlayerSurfaceProps) {
  return <OrionNativeAssetPlayerSurface {...props} finalized />;
}
