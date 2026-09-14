import { useWindowDimensions } from 'react-native';
import { wavenLayout } from '../theme/tokens';

export interface WavenResponsiveLayout {
  width: number;
  isCompact: boolean;
  isRoomy: boolean;
  isTabletLike: boolean;
  gutter: number;
  contentMaxWidth: number;
  heroArtworkSize: number;
}

export function useWavenLayout(): WavenResponsiveLayout {
  const { width } = useWindowDimensions();
  const isCompact = width < wavenLayout.compactWidth;
  const isRoomy = width >= wavenLayout.roomyWidth;
  const isTabletLike = width >= wavenLayout.tabletWidth;

  const gutter = isCompact
    ? wavenLayout.gutterCompact
    : isTabletLike
      ? wavenLayout.gutterTablet
      : isRoomy
        ? wavenLayout.gutterRoomy
        : wavenLayout.gutter;

  return {
    width,
    isCompact,
    isRoomy,
    isTabletLike,
    gutter,
    contentMaxWidth: wavenLayout.contentMaxWidth,
    heroArtworkSize: isCompact
      ? wavenLayout.artworkHeroCompact
      : wavenLayout.artworkHero,
  };
}
