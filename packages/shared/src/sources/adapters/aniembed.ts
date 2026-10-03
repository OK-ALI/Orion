import type { CinemaSourceDescriptor } from '../contracts';

function aniListEpisode(id: string | number, episode: number): string {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))
    || !Number.isSafeInteger(episode) || episode < 1) throw new Error('Verified AniList episode identity is required.');
  return `https://aniembed.se/e/${id}/${episode}`;
}

/** Sub playback is physically proven; incoming continuity still needs qualification. */
export const aniEmbedSource: CinemaSourceDescriptor = {
  id: 'aniembed', label: 'AniEmbed', releaseStatus: 'candidate',
  media: { movie: false, tv: true, anime: true },
  idPolicy: { movie: 'anilist', tv: 'anilist' },
  buildMovieUrl: () => { throw new Error('AniEmbed movies have not been qualified.'); },
  buildEpisodeUrl: (id, _season, episode) => aniListEpisode(id, episode),
  expectedOrigins: ['https://aniembed.se'], allowedNavigationOrigins: ['https://aniembed.se'],
  requiredRequestOrigins: ['https://aniembed.se'],
  progressStrategy: 'frame-video', resumeStrategy: 'url-param', resumeParam: 't', subtitleStrategy: 'provider',
  supportsResume: true, supportsExternalSubtitles: false, supportsDownloads: false,
  routingMode: 'manual-only', availability: 'ready', availabilityReason: 'Ready.',
  animeOnly: true,
  animeProvider: { variants: ['sub', 'dub'], variantParam: 'lang', playbackQualified: true, downloadQualified: false },
  params: { lang: 'sub', autoplay: '1', t: '0' },
};
