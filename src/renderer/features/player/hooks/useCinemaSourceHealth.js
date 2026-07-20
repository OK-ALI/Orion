import { useEffect, useMemo, useState } from "react";

export function describeCinemaSourceHealth(record) {
  if (!record) return { label: "Not tested", tone: "unknown", detail: "No playback evidence yet." };
  if (record.cooldownUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((record.cooldownUntil - Date.now()) / 60_000));
    return { label: `Cooling ${minutes}m`, tone: "failed", detail: record.redactedMessage || "Recent attempts failed." };
  }
  const values = {
    ready: ["Ready", "ready"], checking: ["Checking", "checking"], slow: ["Slow", "slow"],
    degraded: ["Degraded", "failed"], failed: ["Failed", "failed"], disabled: ["Unavailable", "failed"],
  };
  const [label, tone] = values[record.state] || ["Not tested", "unknown"];
  return { label, tone, detail: record.redactedMessage || "Runtime source health." };
}

export function useCinemaSourceHealth(mediaType, active = true) {
  const [records, setRecords] = useState([]);
  useEffect(() => {
    if (!active || !window.electron?.listCinemaSourceHealth) return undefined;
    let cancelled = false;
    const refresh = () => window.electron.listCinemaSourceHealth(mediaType)
      .then((value) => { if (!cancelled) setRecords(Array.isArray(value) ? value : []); })
      .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [mediaType, active]);
  return useMemo(() => new Map(records.map((record) => [record.sourceId, record])), [records]);
}
