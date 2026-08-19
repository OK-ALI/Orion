import { DesktopMyListSteadyStateSyncProvider } from "./MyListSteadyStateSync";
import { DesktopWatchedSteadyStateSyncProvider } from "./WatchedSteadyStateSync";

export function DesktopSyncProviders({ googleProfile, networkStatus, saved, savedOrder, watched, children }) {
  return (
    <DesktopMyListSteadyStateSyncProvider googleProfile={googleProfile} networkStatus={networkStatus} saved={saved} savedOrder={savedOrder}>
      <DesktopWatchedSteadyStateSyncProvider googleProfile={googleProfile} networkStatus={networkStatus} watched={watched}>
        {children}
      </DesktopWatchedSteadyStateSyncProvider>
    </DesktopMyListSteadyStateSyncProvider>
  );
}
