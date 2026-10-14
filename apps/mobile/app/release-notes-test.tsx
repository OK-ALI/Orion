import { Redirect, useRouter } from 'expo-router';
import { GLIMPSE_INTERNAL_PREVIEW } from '../src/features/glimpse/glimpseBuild';
import { ReleaseNotesDialog } from '../src/features/releaseNotes/ReleaseNotesDialog';
import { installedReleaseNotes } from '../src/features/releaseNotes/releaseNotesContent';
/** Read-only internal qualification of the exact bundled v4 notes, without a version transition. */
export default function ReleaseNotesQualificationRoute() {
  const router = useRouter();
  if (!GLIMPSE_INTERNAL_PREVIEW) return <Redirect href="/" />;
  return <ReleaseNotesDialog document={installedReleaseNotes('4.0.0')} onClose={() => router.replace('/settings')} />;
}
