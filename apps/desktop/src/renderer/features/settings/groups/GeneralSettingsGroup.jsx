import { storage, STORAGE_KEYS, isElectron, formatBytes } from "../../../services/settingsStore";
import { DEFAULT_INVIDIOUS_BASE } from "../../../components/TrailerModal";
import { RATING_COUNTRIES } from "../../../shared/utils/ageRating";
import { AGE_LIMIT_OPTIONS } from "../settingsConstants";
import { CleanRow, SettingsSelect, Toggle } from "../components/SettingsControls";
import { VersionSection, HomeLayoutSection, BackupRestoreSection, GoogleAuthSection } from "../sections/GeneralSettings";
import { AppearanceSection } from "../sections/InterfaceSettings";
import { LibraryPrivacySection, StartPageSection, CloseBehaviorSection, TmdbLanguageSection } from "../sections/LibrarySettings";
import { SubtitleSettingsSection, NotificationsSection } from "../sections/SubtitleSettings";
import { SectionGroupHeader, Divider, SystemCheckSection, DownloaderToolsSection } from "../sections/SystemSettings";
export default function GeneralSettingsGroup({
  model
}) {
  const allowDeveloperConfig = import.meta.env.DEV;
  const {
    apiKey,
    apiKeySource,
    downloadPath,
    onChangeApiKey,
    secUpdates,
    secGoogle
  } = model;
  return <div ref={secUpdates} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="General" subtitle="App version, updates, account and languages" />

          {/* Version & Updates */}
          <VersionSection />

          <Divider />

          {/* Google Auth */}
          <GoogleAuthSection secGoogle={secGoogle} />

          <Divider />

          <SystemCheckSection apiKey={apiKey} apiKeySource={apiKeySource} downloadPath={downloadPath} />

          <Divider />

          {/* Metadata service */}
          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">Metadata service</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              Orion manages the movie and TV metadata connection used for posters,
              ratings, cast information, discovery, and search. Public releases do
              not require end users to provide developer credentials.
            </div>
            <div style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
              <span className="badge badge-secondary">
                {apiKeySource === "bundled" ? "Managed by Orion" : apiKeySource === "user" ? "Developer override" : "Unavailable"}
              </span>
              {allowDeveloperConfig && (
                <>
                  <code style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    background: "var(--surface2)",
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--border)"
                  }}>
                    {apiKey ? apiKey.slice(0, 8) + "••••••••••••••••" : "(not set)"}
                  </code>
                  <button className="btn btn-ghost" onClick={onChangeApiKey}>
                    Change development token
                  </button>
                </>
              )}
            </div>
          </div>

          <Divider />

          <TmdbLanguageSection />
        </div>;
}
