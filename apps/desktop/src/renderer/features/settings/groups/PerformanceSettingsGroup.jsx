import { useEffect, useMemo, useState } from "react";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { Divider, SectionGroupHeader } from "../sections/SystemSettings";

const PROFILE_OPTIONS = [
  {
    id: "automatic",
    label: "Automatic (Recommended)",
    description: "Starts from a stable hardware profile, then temporarily steps down when battery, playback, memory, CPU, or responsiveness pressure appears.",
  },
  {
    id: "efficiency",
    label: "Efficiency",
    description: "Keeps Orion conservative on lower-end systems and reduces nonessential rendering pressure.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Orion's tested balance of responsiveness, visual quality, and resource use.",
  },
  {
    id: "quality",
    label: "Quality",
    description: "Allows richer browsing and visual budgets on capable systems while playback protection remains active.",
  },
];

const PROFILE_LABELS = { efficiency: "Efficiency", balanced: "Balanced", quality: "Quality" };
const VALID_SELECTIONS = new Set(PROFILE_OPTIONS.map((option) => option.id));

function storedSelection() {
  const value = storage.get(STORAGE_KEYS.PERFORMANCE_PROFILE);
  return VALID_SELECTIONS.has(value) ? value : "automatic";
}

function profileLabel(value) {
  return PROFILE_LABELS[value] || "Balanced";
}

function graphicsLabel(snapshot) {
  const capability = snapshot?.graphicsCapability;
  const adapterCount = Number(snapshot?.gpuAdapterCount) || 0;
  const adapters = adapterCount > 0 ? ` · ${adapterCount} adapter${adapterCount === 1 ? "" : "s"}` : "";
  if (capability === "hardware") return `Graphics: hardware accelerated${adapters}`;
  if (capability === "limited") return `Graphics: limited acceleration${adapters}`;
  if (capability === "software") return "Graphics: software rendering fallback";
  return "Graphics: detecting acceleration";
}

export default function PerformanceSettingsGroup({ model }) {
  const { secPerformance } = model;
  const [selection, setSelection] = useState(storedSelection);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let mounted = true;
    window.electron?.getPerformanceSnapshot?.().then((value) => {
      if (mounted) setSnapshot(value);
    }).catch(() => {});
    const handler = window.electron?.onPerformanceSnapshot?.((value) => {
      if (mounted) setSnapshot(value);
    });
    const localHandler = (event) => {
      if (mounted && event.detail) setSnapshot(event.detail);
    };
    window.addEventListener("orion:performance-tier-changed", localHandler);
    return () => {
      mounted = false;
      window.removeEventListener("orion:performance-tier-changed", localHandler);
      if (handler) window.electron?.offPerformanceSnapshot?.(handler);
    };
  }, []);

  const applySelection = (next) => {
    if (!VALID_SELECTIONS.has(next)) return;
    setSelection(next);
    storage.set(STORAGE_KEYS.PERFORMANCE_PROFILE, next);
    window.dispatchEvent(new CustomEvent("orion:performance-profile-changed", { detail: next }));
  };

  const status = useMemo(() => {
    const active = profileLabel(snapshot?.tier);
    const automatic = profileLabel(snapshot?.automaticTier);
    if (selection === "automatic") return `Automatic baseline: ${automatic} · Active now: ${active}`;
    return `Selected: ${profileLabel(selection)} · Active now: ${active}`;
  }, [selection, snapshot]);

  const hardware = useMemo(() => {
    if (!snapshot) return "Collecting local hardware and pressure signals…";
    const ram = Number(snapshot.totalMemoryMb) > 0 ? `${Math.round(Number(snapshot.totalMemoryMb) / 1024)} GB RAM` : null;
    const cpu = Number(snapshot.cpuCount) > 0 ? `${snapshot.cpuCount} logical processors` : null;
    const graphics = graphicsLabel(snapshot);
    const parts = [ram, cpu, graphics].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Hardware capability is unavailable; Orion will stay conservative.";
  }, [snapshot]);

  return (
    <div ref={secPerformance} style={{ scrollMarginTop: 80 }}>
      <SectionGroupHeader
        title="Performance"
        subtitle="Choose a Desktop performance profile. Playback, audio, subtitles, catalog identity, and artwork sources are never reduced by these profiles."
      />

      <div role="radiogroup" aria-label="Performance profile" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {PROFILE_OPTIONS.map((option) => {
          const selected = selection === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option.label} performance profile`}
              onClick={() => applySelection(option.id)}
              style={{
                textAlign: "left",
                minHeight: 132,
                padding: "16px 17px",
                borderRadius: 10,
                border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: selected ? "color-mix(in srgb, var(--accent) 10%, var(--surface))" : "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontWeight: 700, fontSize: 14 }}>
                <span>{option.label}</span>
                <span aria-hidden="true" style={{ color: selected ? "var(--accent)" : "var(--text3)" }}>{selected ? "●" : "○"}</span>
              </div>
              <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 8 }}>{option.description}</div>
            </button>
          );
        })}
      </div>

      <div className="settings-card" style={{ marginTop: 16, padding: "15px 17px" }}>
        <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>{status}</div>
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 5 }}>{hardware}</div>
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 5 }}>
          Live safety pressure can temporarily step a selected profile down to protect responsiveness and streaming, then recover after a stable window.
        </div>
      </div>

      <Divider />
    </div>
  );
}
