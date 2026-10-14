import type { PerformanceProfileId } from '../../services/performanceProfiles';
export type GlimpsePalette = readonly [string, string];
export interface GlimpseAmbientNative {
  sample(nativeId: string, session: string): Promise<{ colors: string[]; session: string; durationMs?: number } | null>;
  stop(session: string): Promise<unknown>;
}
/** Serial, finite-failure sampling. A cancelled owner can never publish or reschedule. */
export class GlimpseAmbientSampler {
  private generation = 0; private timer: ReturnType<typeof setTimeout> | null = null; private session: string | null = null;
  constructor(private native: GlimpseAmbientNative, private publish: (colors: GlimpsePalette, durationMs?: number) => void) {}
  start(nativeId: string, session: string, profile: PerformanceProfileId, reducedMotion: boolean) {
    this.stop(); if (profile === 'efficiency') return;
    this.session = session; const generation = this.generation; let failures = 0;
    const tick = async () => {
      if (generation !== this.generation) return;
      let result: Awaited<ReturnType<GlimpseAmbientNative['sample']>> = null;
      try { result = await this.native.sample(nativeId, session); } catch {}
      if (generation !== this.generation) return;
      if (result?.session === session && result.colors?.length === 2 && result.colors.every(color => /^#[0-9a-f]{6}$/i.test(color))) {
        failures = 0; this.publish([result.colors[0], result.colors[1]], result.durationMs);
      } else failures++;
      if (!reducedMotion && failures < 3) this.timer = setTimeout(() => { this.timer = null; void tick(); }, profile === 'quality' ? 850 : 1400);
    };
    void tick();
  }
  stop() {
    this.generation++; if (this.timer !== null) clearTimeout(this.timer); this.timer = null;
    if (this.session !== null) void this.native.stop(this.session).catch(() => {});
    this.session = null;
  }
}
