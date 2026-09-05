import GeneralSettingsGroup from "./groups/GeneralSettingsGroup";
import PerformanceSettingsGroup from "./groups/PerformanceSettingsGroup";
import ContentSettingsGroup from "./groups/ContentSettingsGroup";
import PlaybackSettingsGroup from "./groups/PlaybackSettingsGroup";
import SystemIntegrationSettingsGroup from "./groups/SystemIntegrationSettingsGroup";
import SubtitleSettingsGroup from "./groups/SubtitleSettingsGroup";
import DownloadSettingsGroup from "./groups/DownloadSettingsGroup";
import NotificationSettingsGroup from "./groups/NotificationSettingsGroup";
import InterfaceSettingsGroup from "./groups/InterfaceSettingsGroup";
import LibrarySettingsGroup from "./groups/LibrarySettingsGroup";
import BackupSettingsGroup from "./groups/BackupSettingsGroup";
import StorageSettingsGroup from "./groups/StorageSettingsGroup";
import MusicAppearanceSettings from "./sections/MusicAppearanceSettings";
import DesktopPageHeader from "../../components/common/DesktopPageHeader";

export default function SettingsContent({ model }) {
  const { contentRef } = model;
  return (
<div
        ref={contentRef}
        className="fade-in settings-content"
      >
        <DesktopPageHeader
          eyebrow="Orion Desktop"
          title="Settings"
          subtitle="Customize Orion on this Desktop."
        />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: GENERAL                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <GeneralSettingsGroup model={model} />
        <PerformanceSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: CONTENT                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <ContentSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: PLAYBACK                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <PlaybackSettingsGroup model={model} />
        <SystemIntegrationSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: SUBTITLES                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <SubtitleSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: DOWNLOADS                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <DownloadSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: NOTIFICATIONS                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <NotificationSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: INTERFACE                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <InterfaceSettingsGroup model={model} />
        <MusicAppearanceSettings sectionRef={model.secMusicAppearance} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: LIBRARY                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <LibrarySettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: BACKUP                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <BackupSettingsGroup model={model} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: STORAGE & DATA                                              */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <StorageSettingsGroup model={model} />
      </div>
  );
}
