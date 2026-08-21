import { memo, useCallback } from "react";
import MediaCard from "../../../components/media/MediaCard";

function CollectionCard({ part, isCurrent, onSelect, progress, watched, onMarkWatched, onMarkUnwatched, inMyList = false }) {
  const handleSelect = useCallback(
    (value) => onSelect(value && !value.nativeEvent ? value : part),
    [onSelect, part],
  );
  return (
    <div style={{ opacity: isCurrent ? 0.5 : 1, pointerEvents: isCurrent ? "none" : "auto" }}>
      <MediaCard
        item={part}
        onClick={handleSelect}
        progress={progress}
        watched={watched}
        onMarkWatched={onMarkWatched}
        onMarkUnwatched={onMarkUnwatched}
        inMyList={inMyList}
      />
    </div>
  );
}

export default memo(CollectionCard);
