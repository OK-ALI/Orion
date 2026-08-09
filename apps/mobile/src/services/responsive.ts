import { useWindowDimensions } from "react-native";
import type { MobileResponsiveLayout } from "@orion/shared/types";

export function getResponsiveLayout(width: number, height = width): MobileResponsiveLayout {
  // A rotated phone must remain a phone. Classifying from width alone made a
  // landscape handset render the tablet sidebar and left too little room for
  // every route's content.
  const shortestEdge = Math.min(width, height);
  if (shortestEdge < 360) return "compact-phone";
  if (shortestEdge < 600) return "phone";
  if (shortestEdge < 900) return "tablet";
  return "large-tablet";
}

export function useResponsiveLayout() {
  const dimensions = useWindowDimensions();
  const layout = getResponsiveLayout(dimensions.width, dimensions.height);
  return {
    ...dimensions,
    shortestEdge: Math.min(dimensions.width, dimensions.height),
    isLandscape: dimensions.width > dimensions.height,
    layout,
    isPhone: layout === "compact-phone" || layout === "phone",
    isTablet: layout === "tablet" || layout === "large-tablet",
  };
}
