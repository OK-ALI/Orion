import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ORION_MIN_ANDROID_API_V1 } from "@orion/shared/types";
import {
  DownloadIcon,
  ExternalLinkIcon,
  MobileDeviceIcon,
} from "../../components/common/Icons";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { fetchOrionMobileDistributionStatus } from "../../shared/utils/updates";
import "./get-orion-mobile.css";


function MobileInstallIcon({ size = 22, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
      <path d="M9.6 5.4h4.8" opacity=".72" />
      <path d="M12 8.3v6.2" />
      <path d="m9.7 12.2 2.3 2.3 2.3-2.3" />
      <path d="M10.3 18.4h3.4" />
    </svg>
  );
}

const CHANNELS = [
  { id: "stable", label: "Stable", detail: "Recommended" },
  { id: "preview", label: "Preview", detail: "Early releases" },
];

function ReleaseFact({ label, value, detail }) {
  return (
    <div className="gom-fact">
      <span className="gom-fact-label">{label}</span>
      <strong className="gom-fact-value">{value}</strong>
      {detail && <span className="gom-fact-detail">{detail}</span>}
    </div>
  );
}

function openExternal(url) {
  if (!url) return;
  window.electron?.openExternal?.(url);
}

export default function GetOrionMobilePage() {
  const [channel, setChannel] = useState(() =>
    storage.get(STORAGE_KEYS.UPDATE_CHANNEL) === "preview" ? "preview" : "stable",
  );
  const [distribution, setDistribution] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const refresh = useCallback(async (selectedChannel) => {
    setChecking(true);
    setError("");
    try {
      const nextDistribution = await fetchOrionMobileDistributionStatus(selectedChannel);
      setDistribution(nextDistribution);
      return nextDistribution;
    } catch (reason) {
      setDistribution(null);
      setError("Orion could not reach release services. Check your connection and try again.");
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh(channel);
  }, [channel, refresh]);

  const truth = distribution?.releaseTruth || null;
  const mobile = truth?.mobile || null;
  const release = distribution?.release || mobile?.release || null;
  const apk = distribution?.apk || mobile?.apk || null;
  const installerPublished = Boolean(apk?.url);
  const installerAvailable = Boolean(distribution?.installerReady && apk?.url);
  const integrity = distribution?.integrity || null;
  const releaseNotes = distribution?.notes || "";

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl("");
    if (!installerAvailable || !apk?.url) return () => { cancelled = true; };

    QRCode.toDataURL(apk.url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 264,
      color: { dark: "#09090f", light: "#ffffff" },
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });

    return () => { cancelled = true; };
  }, [apk?.url, installerAvailable]);

  const status = useMemo(() => {
    if (checking) return { tone: "checking", label: "Checking release availability" };
    if (error) return { tone: "error", label: "Release check unavailable" };
    if (installerAvailable) return { tone: "available", label: "Android installer ready" };
    if (installerPublished) return { tone: "error", label: "Installer verification unavailable" };
    return { tone: "waiting", label: "Awaiting first Mobile release" };
  }, [checking, error, installerAvailable, installerPublished]);

  const changeChannel = (nextChannel) => {
    const normalized = nextChannel === "preview" ? "preview" : "stable";
    if (normalized === channel) return;
    storage.set(STORAGE_KEYS.UPDATE_CHANNEL, normalized);
    setChannel(normalized);
  };

  return (
    <main className="gom-page">
      <section className="gom-hero">
        <div className="gom-hero-copy">
          <span className="gom-eyebrow">ORION MOBILE</span>
          <h1>Take your universe with you.</h1>
          <p>
            Get the Android companion for Orion. Release availability, installation and
            version details stay aligned with the channel you choose on this Desktop.
          </p>
          <div className={`gom-status gom-status-${status.tone}`} role="status" aria-live="polite">
            <span className="gom-status-dot" aria-hidden="true" />
            {status.label}
          </div>
        </div>

        <div className="gom-device-stage" aria-hidden="true">
          <div className="gom-device-shell">
            <MobileDeviceIcon size={72} />
            <span className="gom-device-mark">O</span>
          </div>
        </div>
      </section>

      <section className="gom-channel-panel" aria-labelledby="gom-channel-heading">
        <div>
          <span className="gom-section-kicker">RELEASE CHANNEL</span>
          <h2 id="gom-channel-heading">Choose what reaches this device.</h2>
          <p>Preview can include newer early builds, but Orion never treats an older preview as an upgrade over Stable.</p>
        </div>
        <div className="gom-channel-switch" role="radiogroup" aria-label="Orion Mobile release channel">
          {CHANNELS.map((option) => {
            const selected = channel === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`gom-channel-option${selected ? " is-selected" : ""}`}
                role="radio"
                aria-checked={selected}
                onClick={() => changeChannel(option.id)}
              >
                <span>{option.label}</span>
                <small>{option.detail}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="gom-grid">
        <article className="gom-release-section">
          <div className="gom-card-heading">
            <div>
              <span className="gom-section-kicker">RELEASE</span>
              <h2>{release ? `Orion Mobile v${release.version}` : "Mobile release status"}</h2>
            </div>
            <button
              type="button"
              className="gom-icon-button"
              onClick={() => refresh(channel)}
              disabled={checking}
              aria-label="Refresh Orion Mobile release availability"
              title="Refresh release availability"
            >
              ↻
            </button>
          </div>

          <div className="gom-facts">
            <ReleaseFact label="Channel" value={channel === "preview" ? "Preview" : "Stable"} />
            <ReleaseFact
              label="Latest Mobile"
              value={release ? `v${release.version}` : "Not published"}
              detail={release?.publishedAt ? new Date(release.publishedAt).toLocaleDateString() : "No Android release in this channel yet"}
            />
            <ReleaseFact label="Android" value="Android 7.0+" detail={`Minimum API ${ORION_MIN_ANDROID_API_V1}`} />
            <ReleaseFact
              label="Installer"
              value={installerAvailable ? "Ready" : installerPublished ? "Verification required" : "Not published"}
              detail={installerAvailable ? `Integrity metadata published · ${apk.name}` : installerPublished ? "Orion will not expose the QR until release integrity metadata is complete" : "A signed APK will appear here when released"}
            />
          </div>

          {error ? (
            <div className="gom-message gom-message-error">
              <strong>Release check failed.</strong>
              <span>{error}</span>
            </div>
          ) : installerPublished && !installerAvailable ? (
            <div className="gom-message gom-message-error">
              <strong>Installer verification is not ready.</strong>
              <span>Orion could not verify the published installer metadata yet. Refresh in a moment or open the release notes for details.</span>
            </div>
          ) : releaseNotes ? (
            <div className="gom-release-notes">
              <span className="gom-section-kicker">WHAT'S NEW</span>
              <p>{releaseNotes}</p>
            </div>
          ) : (
            <div className="gom-message">
              <strong>No Mobile build is published to {channel === "preview" ? "Preview" : "Stable"} yet.</strong>
              <span>Orion will surface the real APK, QR and release details automatically when the release exists.</span>
            </div>
          )}

          <div className="gom-actions">
            {installerAvailable && (
              <button type="button" className="btn btn-primary gom-primary-action" onClick={() => openExternal(apk.url)}>
                <DownloadIcon size={17} />
                Download APK
              </button>
            )}
            {release?.url && (
              <button type="button" className="btn btn-ghost" onClick={() => openExternal(release.url)}>
                <ExternalLinkIcon size={14} />
                Release notes
              </button>
            )}
          </div>
        </article>

        <article className="gom-install-section">
          <div className="gom-card-heading">
            <div>
              <span className="gom-section-kicker">INSTALL ON ANDROID</span>
              <h2>Scan to install</h2>
            </div>
          </div>

          <div className={`gom-qr-stage${qrDataUrl ? " has-qr" : ""}`}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Orion Mobile Android installation QR code" width="264" height="264" />
            ) : (
              <div className="gom-qr-awaiting">
                <div className="gom-qr-device"><MobileDeviceIcon size={48} /></div>
                <strong>QR activates after release verification.</strong>
                <span>Orion only generates an installation QR when the published APK has complete integrity metadata.</span>
              </div>
            )}
          </div>

          <div className="gom-connect-note">
            <span className="gom-connect-icon"><MobileInstallIcon aria-hidden="true" /></span>
            <div>
              <strong>Installation, not pairing.</strong>
              <span>This QR installs Orion Mobile. Device pairing happens later inside Orion Connect.</span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
