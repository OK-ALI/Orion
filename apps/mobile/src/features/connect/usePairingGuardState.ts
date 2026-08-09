import { useEffect, useState } from 'react';
import { clearPairingGuard, readPairingGuard } from './pairingGuardStore';

export const usePairingGuardState = () => {
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  useEffect(() => {
    const savedGuard = readPairingGuard();
    if (!savedGuard) return;
    if (savedGuard.lockoutUntil && savedGuard.lockoutUntil > Date.now()) {
      setLockoutUntil(savedGuard.lockoutUntil);
      setAttemptsRemaining(0);
    } else if (savedGuard.attemptsRemaining !== null) {
      setAttemptsRemaining(savedGuard.attemptsRemaining);
    }
  }, []);

  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutSeconds(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutSeconds(remaining);
      if (!remaining) {
        setLockoutUntil(null);
        setAttemptsRemaining(null);
        clearPairingGuard();
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  return {
    attemptsRemaining,
    lockoutSeconds,
    lockoutUntil,
    setAttemptsRemaining,
    setLockoutUntil,
  };
};
