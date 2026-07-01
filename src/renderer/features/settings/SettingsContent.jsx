import GeneralSettingsGroup from "./groups/GeneralSettingsGroup";
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

export default function SettingsContent({ model }) {
  const { contentRef } = model;
  return (
<div
        ref={contentRef}
        className="fade-in"
        style={{ padding: "40px 48px 80px" }}
      >
        {/* Page title */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 48,
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          SETTINGS
        </div>
        <div style={{ color: "var(--text3)", fontSize: 14, marginBottom: 48 }}>
          App configuration for Orion
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GROUP: GENERAL                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <GeneralSettingsGroup model={model} />

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
