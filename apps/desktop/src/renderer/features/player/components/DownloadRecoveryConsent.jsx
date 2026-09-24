import { useEffect, useRef } from "react";

export default function DownloadRecoveryConsent({ consent, onAnswer }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!consent) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onAnswer(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [consent, onAnswer]);
  if (!consent) return null;
  const advertisingWarning = consent.kind === "vidsrc";
  return (
    <div className="download-modal-backdrop" role="presentation">
      <div
        className="download-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="download-source-consent-title"
        aria-describedby="download-source-consent-description"
        style={{ maxWidth: 480 }}
      >
        <div className="download-dialog-heading">
          <div>
            <h2 id="download-source-consent-title">
              {advertisingWarning ? "Try VidSrc for this download?" : "Try another playback source?"}
            </h2>
            <p id="download-source-consent-description">
              {advertisingWarning
                ? "VidSrc may open advertising outside Orion. Orion will only prepare a download after checking actual media bytes."
                : "This download needs another source. Allow Orion to try visible manual-only sources for this download?"}
            </p>
          </div>
        </div>
        <div className="download-dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => onAnswer(false)}>Not now</button>
          <button type="button" className="btn btn-primary" onClick={() => onAnswer(true)}>Allow for this download</button>
        </div>
      </div>
    </div>
  );
}
