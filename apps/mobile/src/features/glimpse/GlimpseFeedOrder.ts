import type { GlimpseReel } from './glimpseModel';

/** Keep the viewed prefix stable; rank/sort only upcoming reels as metadata arrives. */
export class GlimpseFeedOrder {
  private key = '';
  private ids: string[] = [];
  private viewed = new Set<string>();
  order(key: string, sorted: GlimpseReel[], anchor: string | null, fallbackIndex = 0) {
    if (this.key !== key) { this.key = key; this.ids = []; this.viewed.clear(); }
    const oldAnchor = anchor ? this.ids.indexOf(anchor) : -1;
    if (oldAnchor >= 0) this.ids.slice(0, oldAnchor + 1).forEach(id => this.viewed.add(id));
    const byId = new Map(sorted.map(reel => [reel.id, reel]));
    const prefix = this.ids.filter(id => this.viewed.has(id) && byId.has(id));
    const held = new Set(prefix);
    const ordered = [...prefix.map(id => byId.get(id)!), ...sorted.filter(reel => !held.has(reel.id))];
    const nextAnchor = anchor ? ordered.findIndex(reel => reel.id === anchor) : -1;
    const through = nextAnchor >= 0 ? nextAnchor : Math.min(fallbackIndex, Math.max(0, ordered.length - 1));
    ordered.slice(0, through + 1).forEach(reel => this.viewed.add(reel.id));
    this.ids = ordered.map(reel => reel.id);
    this.viewed = new Set(this.ids.filter(id => this.viewed.has(id)));
    return ordered;
  }
}
