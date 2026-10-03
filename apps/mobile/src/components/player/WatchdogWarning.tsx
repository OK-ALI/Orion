import { useEffect, useRef } from 'react';

interface WatchdogWarningProps {
  isBuffering: boolean;
  onFailover: () => boolean;
  onTimeout: () => void;
}

/** The shared controller owns visible status; the watchdog only reports an attempt. */
export function WatchdogWarning({ isBuffering, onFailover, onTimeout }: WatchdogWarningProps) {
  const callbacks = useRef({ onFailover, onTimeout });
  callbacks.current = { onFailover, onTimeout };
  useEffect(() => {
    if (!isBuffering) return undefined;
    const timeout = setTimeout(() => {
      if (!callbacks.current.onFailover()) callbacks.current.onTimeout();
    }, 15000);
    return () => clearTimeout(timeout);
  }, [isBuffering]);
  return null;
}
