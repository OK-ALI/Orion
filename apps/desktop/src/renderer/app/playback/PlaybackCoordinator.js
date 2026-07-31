let owner = null;
const listeners = new Set();

export function claimPlayback(nextOwner) {
  if (nextOwner !== "music" && nextOwner !== "video" && nextOwner !== null) return owner;
  owner = nextOwner;
  listeners.forEach((listener) => listener(owner));
  return owner;
}

export function getPlaybackOwner() { return owner; }
export function subscribePlaybackOwner(listener) { listeners.add(listener); return () => listeners.delete(listener); }
