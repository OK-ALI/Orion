import { isAnimeContent } from '@orion/shared/api';
import type { TmdbMediaItem } from '@orion/shared/types';

/** Advisory entry intent only. The player still verifies canonical Anime identity. */
export function getAnimeEntryHint(item: TmdbMediaItem): { animeHint?: 'true' } {
  return isAnimeContent(item) ? { animeHint: 'true' } : {};
}
