import { useEffect } from "react";
import { subscribeToDesktopUpdateChecks } from "../../shared/utils/updates";

export function useDesktopUpdateAnnouncement({ setUpdateBanner, setShowUpdateModal }) {
  useEffect(() => subscribeToDesktopUpdateChecks((event) => {
    if (event.phase === "checking") {
      setShowUpdateModal(false);
      setUpdateBanner((current) => (
        current?.channel === event.channel ? current : null
      ));
      return;
    }

    if (event.phase !== "complete") return;

    if (event.result?.hasUpdate) {
      setUpdateBanner(event.result);
      return;
    }

    setUpdateBanner(null);
    setShowUpdateModal(false);
  }), [setShowUpdateModal, setUpdateBanner]);
}
