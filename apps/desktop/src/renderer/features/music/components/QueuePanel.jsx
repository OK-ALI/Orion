import { useState } from "react";
import { useMusic } from "../context/MusicProvider";
import MusicArtwork from "./MusicArtwork";

export default function QueuePanel({ onClose }) {
  const { queue, index, selectQueueItem, removeFromQueue, moveQueueItem, clearUpcoming } = useMusic();
  const [dragIndex, setDragIndex] = useState(-1);
  return <aside className="music-right-panel queue-panel" aria-label="Music queue">
    <header><div><span>Listening order</span><h2>Up Next</h2></div><div className="queue-header-actions">
      {queue.length > 1 && <button onClick={clearUpcoming}>Clear upcoming</button>}
      <button onClick={onClose} className="music-header-icon-btn" aria-label="Close queue">×</button>
    </div></header>
    <div className="queue-content">{!queue.length ? <div className="music-empty">The queue is quiet.<br />Add tracks to shape the next orbit.</div>
      : <ol className="music-queue-list">{queue.map((track, itemIndex) => {
        const active = itemIndex === index;
        return <li key={`${track.id}-${itemIndex}`} draggable onDragStart={() => setDragIndex(itemIndex)}
          onDragOver={(event) => event.preventDefault()} onDrop={() => moveQueueItem(dragIndex, itemIndex)}
          className={`music-queue-item${active ? " active" : ""}`}>
          <button className="queue-item-play" onClick={() => selectQueueItem(itemIndex)} aria-label={`Play ${track.title}`}>
            <span className="queue-item-position">{active ? "♪" : itemIndex + 1}</span>
            <MusicArtwork className="queue-item-thumb" track={track} />
            <span className="queue-item-info"><strong>{track.title}</strong><small>{track.artistName || "Unknown artist"}</small></span>
          </button>
          <button className="queue-item-remove" onClick={() => removeFromQueue(itemIndex)} aria-label={`Remove ${track.title} from queue`}>×</button>
        </li>;
      })}</ol>}
    </div>
  </aside>;
}
