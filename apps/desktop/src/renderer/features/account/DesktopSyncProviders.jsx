import { DesktopMyListSteadyStateSyncProvider } from "./MyListSteadyStateSync";
import { DesktopWatchedSteadyStateSyncProvider } from "./WatchedSteadyStateSync";
import { DesktopViewingActivitySteadyStateSyncProvider } from "./ViewingActivitySteadyStateSync";

export function DesktopSyncProviders({ googleProfile, networkStatus, saved, savedOrder, watched, history, progress, children }) {
  return (
    <DesktopMyListSteadyStateSyncProvider googleProfile={googleProfile} networkStatus={networkStatus} saved={saved} savedOrder={savedOrder}>
      <DesktopWatchedSteadyStateSyncProvider googleProfile={googleProfile} networkStatus={networkStatus} watched={watched}>
        <DesktopViewingActivitySteadyStateSyncProvider googleProfile={googleProfile} networkStatus={networkStatus} history={history} progress={progress}>
          {children}
        </DesktopViewingActivitySteadyStateSyncProvider>
      </DesktopWatchedSteadyStateSyncProvider>
    </DesktopMyListSteadyStateSyncProvider>
  );
}
