import type { CinemaSourceDescriptor } from '../contracts';

function aniLinkEpisode(id: string | number, episode: number): string {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))
    || !Number.isSafeInteger(episode) || episode < 1) throw new Error('Verified AniList episode identity is required.');
  return `https://anilink.cc/watch/${id}/${episode}`;
}

/** Public iframe contract only; physical playback and downloads remain unqualified. */
export const aniLinkSource: CinemaSourceDescriptor = {
  id: 'anilink', label: 'AniLink', releaseStatus: 'candidate',
  media: { movie: false, tv: true, anime: true }, idPolicy: { movie: 'anilist', tv: 'anilist' },
  buildMovieUrl: () => { throw new Error('AniLink movie identity is not qualified.'); },
  buildEpisodeUrl: (id, _season, episode) => aniLinkEpisode(id, episode),
  expectedOrigins: ['https://anilink.cc'],
  allowedNavigationOrigins: ['https://anilink.cc', 'https://orion.local'],
  requiredRequestOrigins: ['https://anilink.cc'],
  progressStrategy: 'player-event', resumeStrategy: 'url-param', resumeParam: 'start', subtitleStrategy: 'provider',
  supportsResume: true, supportsExternalSubtitles: false, supportsDownloads: false,
  routingMode: 'manual-only', availability: 'ready', availabilityReason: 'Anime focused',
  requiresIframeWrapper: true, animeOnly: true,
  animeProvider: { variants: ['sub', 'dub'], variantParam: 'variant', playbackQualified: false, downloadQualified: false },
  params: { autoplay: 'true', autonext: 'false' },
};
