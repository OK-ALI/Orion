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
export default function InterfaceSettingsGroup({
  model
}) {
  const {
    secInterface
  } = model;
  return <div ref={secInterface} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="Interface" subtitle="Home layout, start page, appearance, and display options" />
          <HomeLayoutSection />
          <Divider />
          <StartPageSection />
          <Divider />
          <CloseBehaviorSection />
          <Divider />
          <AppearanceSection />
        </div>;
}
