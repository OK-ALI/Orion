function samplingInterval(profile, onBattery = false) {
  const ac = profile === "low" ? 1400 : profile === "vivid" ? 500 : 750;
  if (!onBattery) return ac;
  return profile === "low" ? 3000 : profile === "vivid" ? 1500 : 2250;
}

module.exports = { samplingInterval };
