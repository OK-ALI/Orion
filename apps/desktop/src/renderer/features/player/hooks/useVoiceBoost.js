import { useEffect, useState } from "react";
import { getReadyWebContentsId } from "../services/webviewLifecycle";

const STATUS_MESSAGE = {
  cross_origin_audio: "Voice Boost is unavailable for this source's protected audio.",
  audio_suspended: "Voice Boost needs an active playback gesture.",
  audio_unavailable: "Voice Boost could not access this source's audio.",
};

export function useVoiceBoost({ webviewRef, playing, webviewLoading, enabled }) {
  const [status, setStatus] = useState("off");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!playing) {
      setStatus("off");
      setMessage("");
      return undefined;
    }
    let disposed = false;
    let inFlight = false;
    const apply = async () => {
      if (inFlight) return;
      const id = getReadyWebContentsId(webviewRef.current);
      if (!id || !window.electron?.setVoiceBoost) {
        if (!disposed && enabled) setStatus("waiting");
        return;
      }
      inFlight = true;
      try {
        const result = await window.electron.setVoiceBoost(id, enabled);
        if (disposed) return;
        if (!enabled) {
          setStatus("off");
          setMessage("");
        } else if (result?.ok && result?.active) {
          setStatus("active");
          setMessage("");
        } else {
          setStatus(STATUS_MESSAGE[result?.code] ? "unavailable" : "waiting");
          setMessage(STATUS_MESSAGE[result?.code] || "Waiting for playable video audio.");
        }
      } catch {
        if (!disposed && enabled) {
          setStatus("unavailable");
          setMessage("Voice Boost could not access this source's audio.");
        }
      } finally {
        inFlight = false;
      }
    };
    if (!enabled || !webviewLoading) apply();
    const timer = enabled ? window.setInterval(apply, 2500) : null;
    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, playing, webviewLoading, webviewRef]);

  return { status, message };
}
