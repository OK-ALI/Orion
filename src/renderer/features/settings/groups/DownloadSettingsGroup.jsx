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
export default function DownloadSettingsGroup({
  model
}) {
  const {
    downloadPath,
    handleSavePath,
    pickFolder,
    saved,
    secDownloads,
    setDownloadPath
  } = model;
  return <div ref={secDownloads} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="Downloads" subtitle="Managed tools, quality, and where downloaded files are saved" />

          <DownloaderToolsSection />

          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">Download Folder</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              Downloaded videos will be saved here. Make sure the folder exists
              and Orion has write access to it.
            </div>
            <div style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
              <input className="apikey-input" style={{
          flex: 1,
          minWidth: 260,
          marginBottom: 0
        }} placeholder="/home/you/Movies" value={downloadPath} onChange={e => setDownloadPath(e.target.value)} />
              {isElectron && <button className="btn btn-secondary" onClick={pickFolder}>
                  Browse …
                </button>}
              <button className="btn btn-primary" onClick={handleSavePath}>
                Save
              </button>
            </div>
            {saved && <div style={{
        marginTop: 10,
        fontSize: 13,
        color: "#4caf50"
      }}>
                ✓ Saved
              </div>}
            {!downloadPath && <div style={{
        marginTop: 10,
        fontSize: 13,
        color: "var(--red)"
      }}>
                ⚠ No download folder set - videos cannot be downloaded until you
                set one.
              </div>}
          </div>
        </div>;
}
