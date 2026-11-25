/** Render the visible horizontal cards plus bounded overscan, without truncating data. */
export function wavenMediaRailWindow(itemWidth: number, visibleWidth: number, gap: number) {
  const step = itemWidth + gap;
  const batch = Math.max(1, Math.ceil(Math.max(1, visibleWidth) / step) + 1);
  return {
    initialNumToRender: batch,
    maxToRenderPerBatch: batch,
    windowSize: 3,
    // Retain the normal artwork/reveal view lifecycle; do not detach native
    // image children merely because Android clips their parent scroll view.
    removeClippedSubviews: false,
    getItemLayout: (_data: unknown, index: number) => ({
      index,
      length: itemWidth,
      offset: index * step,
    }),
  };
}
