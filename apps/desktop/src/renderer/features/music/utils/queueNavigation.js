export function shuffledIndices(length, excluded = -1, random = Math.random) {
  const values = Array.from({ length }, (_, index) => index).filter((index) => index !== excluded);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

export function previousQueueTarget({ currentTime, currentIndex, history = [] }) {
  if (Number(currentTime) > 5) return { restart: true, index: currentIndex };
  const previous = history[history.length - 1];
  return { restart: false, index: Number.isInteger(previous) ? previous : Math.max(0, currentIndex - 1) };
}

export function normalizeQueueRecovery(saved = {}) {
  const items = Array.isArray(saved.items) ? saved.items : [];
  const validIndex = (value) => Number.isInteger(value) && value >= 0 && value < items.length;
  return {
    items, index: validIndex(saved.index) ? saved.index : items.length ? 0 : -1,
    repeat: ["off", "one", "all"].includes(saved.repeat) ? saved.repeat : "off",
    shuffle: !!saved.shuffle,
    history: Array.isArray(saved.history) ? saved.history.filter(validIndex).slice(-500) : [],
    shuffleBag: Array.isArray(saved.shuffleBag) ? saved.shuffleBag.filter(validIndex).slice(0, items.length) : [],
  };
}
