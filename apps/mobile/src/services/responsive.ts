import { useWindowDimensions } from "react-native";
import type { MobileResponsiveLayout } from "@orion/shared/types";

export function getResponsiveLayout(width: number): MobileResponsiveLayout {
  if (width < 360) return "compact-phone";
  if (width < 600) return "phone";
  if (width < 900) return "tablet";
  return "large-tablet";
}

export function useResponsiveLayout() {
  const dimensions = useWindowDimensions();
  const layout = getResponsiveLayout(dimensions.width);
  return {
    ...dimensions,
    layout,
    isPhone: layout === "compact-phone" || layout === "phone",
    isTablet: layout === "tablet" || layout === "large-tablet",
  };
}
