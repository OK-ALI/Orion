import { storage, STORAGE_KEYS, isElectron, formatBytes } from "../../../services/settingsStore";
import { DEFAULT_INVIDIOUS_BASE } from "../../../components/TrailerModal";
import { RATING_COUNTRIES } from "../../../shared/utils/ageRating";
import { AGE_LIMIT_OPTIONS } from "../settingsConstants";
import { CleanRow, SettingsSelect, Toggle } from "../components/SettingsControls";
import { VersionSection, HomeLayoutSection, BackupRestoreSection } from "../sections/GeneralSettings";
import { AppearanceSection } from "../sections/InterfaceSettings";
import { LibraryPrivacySection, StartPageSection, CloseBehaviorSection, TmdbLanguageSection } from "../sections/LibrarySettings";
import { SubtitleSettingsSection, NotificationsSection } from "../sections/SubtitleSettings";
import { SectionGroupHeader, Divider, SystemCheckSection, DownloaderToolsSection } from "../sections/SystemSettings";
export default function GeneralSettingsGroup({
  model
}) {
  const {
    apiKey,
    apiKeySource,
    downloadPath,
    onChangeApiKey,
    secUpdates
  } = model;
  return <div ref={secUpdates} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="General" subtitle="App version, updates, API credentials and Languages" />

          {/* Version & Updates */}
          <VersionSection />

          <Divider />

          <SystemCheckSection apiKey={apiKey} apiKeySource={apiKeySource} downloadPath={downloadPath} />

          <Divider />

          {/* TMDB API Token */}
          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">TMDB Read Access Token</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              Used to fetch movie and TV metadata, posters, ratings, and cast
              info from The Movie Database. Orion uses the bundled token by
              default when available; a saved token here overrides it.
            </div>
            <div style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
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
              <span className="badge badge-secondary">
                {apiKeySource === "user" ? "User configured" : apiKeySource === "bundled" ? "Bundled" : "Missing"}
              </span>
              <button className="btn btn-ghost" onClick={onChangeApiKey}>
                Change API Token
              </button>
            </div>
          </div>

          <Divider />

          <TmdbLanguageSection />
        </div>;
}
