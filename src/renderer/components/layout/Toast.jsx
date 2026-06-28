// ── Orion — Toast Notifications ───────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";

const TOAST_DURATION = 4000;

// Singleton event emitter so any part of the app can fire toasts
const listeners = new Set();

export function showToast(message, type = "info") {
  listeners.forEach((fn) => fn({ message, type, id: Date.now() }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev.slice(-4), toast]); // max 5 visible
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      timersRef.current.delete(toast.id);
    }, TOAST_DURATION);
    timersRef.current.set(toast.id, timer);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
      timersRef.current.forEach(clearTimeout);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
