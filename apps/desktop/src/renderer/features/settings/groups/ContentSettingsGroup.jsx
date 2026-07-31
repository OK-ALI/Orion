import { useState } from "react";
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
export default function ContentSettingsGroup({
  model
}) {
  const [discoveryRegion, setDiscoveryRegion] = useState(
    () => storage.get(STORAGE_KEYS.DISCOVERY_REGION) || "US",
  );
  const {
    ageLimit,
    ageSaved,
    ratingCountry,
    saveAgeSettings,
    secContent,
    setAgeLimit,
    setRatingCountry
  } = model;
  return <div ref={secContent} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="Content" subtitle="Parental controls and content filtering by age rating" />

          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">
              Age Rating &amp; Parental Controls
            </div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 20,
        lineHeight: 1.6
      }}>
              Set a maximum age rating. Content rated above this age will still
              be visible but{" "}
              <strong style={{
          color: "var(--text)"
        }}>
                you won't be able to play it.
              </strong>{" "}
              Set to <em>No restriction</em> to disable this feature entirely.
            </div>

            <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
              <div>
                <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 8
          }}>
                  Rating Country
                </div>
                <SettingsSelect value={ratingCountry} onChange={v => setRatingCountry(v)} options={RATING_COUNTRIES.map(c => ({
            value: c.code,
            label: c.label
          }))} />
              </div>

              <div>
                <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 8
          }}>
                  Maximum Allowed Age Rating
                </div>
                <SettingsSelect value={ageLimit} onChange={v => setAgeLimit(v)} options={AGE_LIMIT_OPTIONS} />
              </div>

              <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12
        }}>
                <button className="btn btn-primary" onClick={saveAgeSettings}>
                  Save
                </button>
                {ageSaved && <span style={{
            fontSize: 13,
            color: "#48c774"
          }}>
                    ✓ Saved
                  </span>}
              </div>
            </div>
          </div>
          <Divider />
          <div style={{ marginBottom: 40 }}>
            <div className="settings-section-title">Discovery availability</div>
            <CleanRow title="Streaming provider region" description="Used for Netflix, Prime Video, Disney+, Max, and Apple TV+ availability. Provider catalogs can change." right={
              <SettingsSelect value={discoveryRegion} onChange={(value) => {
                setDiscoveryRegion(value);
                storage.set(STORAGE_KEYS.DISCOVERY_REGION, value);
              }} options={["US","GB","PK","IN","CA","AU","DE","FR","JP","KR","AE"].map((value) => ({ value, label: value }))} />
            } />
          </div>
        </div>;
}
