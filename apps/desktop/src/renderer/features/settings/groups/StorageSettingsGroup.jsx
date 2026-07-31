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
export default function StorageSettingsGroup({
  model
}) {
  const {
    handleClearCache,
    resetHovered,
    secStorage,
    setShowDeleteDlConfirm,
    setShowProgressConfirm,
    setShowResetConfirm,
    setResetHovered,
    sizes
  } = model;
  return <div ref={secStorage} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="Storage & Data" subtitle="Clear cache, watch progress, downloads, or reset the entire app" />

          <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden"
    }}>
            {/* Install location */}
            <div style={{
        padding: "22px 24px"
      }}>
              <CleanRow title="Install Location" description="Opens the folder where Orion is installed." buttonLabel="Open Folder" onAction={async () => {
          const p = await window.electron?.getInstallPath?.();
          if (p) window.electron.openPath(p);
        }} />
            </div>

            <div style={{
        height: 1,
        background: "var(--border)"
      }} />

            {/* Cache */}
            <div style={{
        padding: "22px 24px"
      }}>
              <CleanRow title="Clear Cache" description="Removes temporary browser cache, shader cache, and service worker data from all internal sessions (main, video player, trailer). Does not affect your personal data or settings." buttonLabel="Clear Cache" onAction={handleClearCache} sizeLabel={formatBytes(sizes.cache)} />
            </div>

            <div style={{
        height: 1,
        background: "var(--border)"
      }} />

            {/* Watch Progress */}
            <div style={{
        padding: "22px 24px"
      }}>
              <CleanRow title="Clear Watch Progress" description="Resets all watch history, continue-watching progress, and watched / completed markings for movies and series. Also clears internal video player session data." buttonLabel="Clear Progress" onAction={() => new Promise(resolve => {
          setShowProgressConfirm(true);
          window.__progressConfirmResolve = resolve;
        })} danger />
            </div>

            <div style={{
        height: 1,
        background: "var(--border)"
      }} />

            {/* Delete Downloads */}
            <div style={{
        padding: "22px 24px"
      }}>
              <CleanRow title="Delete All Downloads" description="Permanently deletes all video files that were downloaded through Orion and removes them from the download list. Only files downloaded through the app will be deleted, nothing else in your folder is touched." buttonLabel="Delete All" onAction={() => new Promise(resolve => {
          setShowDeleteDlConfirm(true);
          window.__deleteDlConfirmResolve = resolve;
        })} sizeLabel={formatBytes(sizes.downloads)} danger />
            </div>

            <div style={{
        height: 1,
        background: "var(--border)"
      }} />

            {/* Full Reset */}
            <div style={{
        padding: "22px 24px",
        background: "rgba(229,9,20,0.03)"
      }}>
              <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24
        }}>
                <div style={{
            flex: 1
          }}>
                  <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
                    Reset App
                    <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                color: "var(--red)",
                background: "rgba(229,9,20,0.12)",
                border: "1px solid rgba(229,9,20,0.25)",
                padding: "2px 7px",
                borderRadius: 4,
                textTransform: "uppercase"
              }}>
                      Irreversible
                    </span>
                  </div>
                  <div style={{
              fontSize: 13,
              color: "var(--text3)",
              lineHeight: 1.6
            }}>
                    Completely resets Orion to factory defaults, clears all
                    settings, API Token, saved library, watch history/progress,
                    and all cached data. Your downloaded video files will not be
                    touched.
                  </div>
                </div>
                <div style={{
            flexShrink: 0,
            paddingTop: 2
          }}>
                  <button className="btn" onClick={() => setShowResetConfirm(true)} onMouseEnter={() => setResetHovered(true)} onMouseLeave={() => setResetHovered(false)} style={{
              color: resetHovered ? "#fff" : "var(--red)",
              background: resetHovered ? "rgba(229,9,20,0.85)" : "rgba(229,9,20,0.08)",
              border: resetHovered ? "1px solid transparent" : "1px solid rgba(229,9,20,0.3)",
              transition: "all 0.2s"
            }}>
                    Reset App
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>;
}
