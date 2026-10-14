import { useCallback, useEffect, useState } from 'react';
import type { GlimpseReel } from './glimpseModel';
import { getGlimpseLikesStore } from './glimpseLikesStorage';

export function useGlimpseLikes() {
  const store = getGlimpseLikesStore();
  const [snapshot, setSnapshot] = useState(store.getSnapshot);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    const update = () => setSnapshot(store.getSnapshot());
    const unsubscribe = store.subscribe(update);
    update();
    return unsubscribe;
  }, [store]);
  const toggle = useCallback((reel: GlimpseReel) => {
    try { store.setLiked(reel, store.getSnapshot().document.records[reel.id]?.tombstone !== false); setSaveError(false); }
    catch { setSaveError(true); }
  }, [store]);
  return { ...snapshot, toggle, saveError };
}
