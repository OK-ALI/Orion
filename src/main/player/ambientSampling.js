function samplingInterval(profile, onBattery = false) {
  const ac = profile === "low" ? 1800 : profile === "vivid" ? 750 : 1100;
  if (!onBattery) return ac;
  return profile === "low" ? 3600 : profile === "vivid" ? 1800 : 2600;
}

function boundedSampleRect(rect, maxWidth = 320, maxHeight = 180) {
  const source = rect || {};
  const sourceWidth = Math.max(1, Math.round(Number(source.width) || maxWidth));
  const sourceHeight = Math.max(1, Math.round(Number(source.height) || maxHeight));
  const width = Math.min(sourceWidth, maxWidth);
  const height = Math.min(sourceHeight, maxHeight);
  return {
    x: Math.max(0, Math.round((Number(source.x) || 0) + (sourceWidth - width) / 2)),
    y: Math.max(0, Math.round((Number(source.y) || 0) + (sourceHeight - height) / 2)),
    width,
    height,
  };
}

module.exports = { boundedSampleRect, samplingInterval };
