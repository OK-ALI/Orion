import type { CinemaSourceDescriptor } from '../contracts';

function aniListEpisode(id: string | number, episode: number): string {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))
    || !Number.isSafeInteger(episode) || episode < 1) throw new Error('Verified AniList episode identity is required.');
  return `https://aniembed.se/e/${id}/${episode}`;
}

/** Documentation contract only. Available solely for explicit physical testing. */
export const aniEmbedSource: CinemaSourceDescriptor = {
  id: 'aniembed', label: 'AniEmbed', releaseStatus: 'experimental',
  media: { movie: false, tv: true, anime: true },
  idPolicy: { movie: 'anilist', tv: 'anilist' },
  buildMovieUrl: () => { throw new Error('AniEmbed movies have not been qualified.'); },
  buildEpisodeUrl: (id, _season, episode) => aniListEpisode(id, episode),
  expectedOrigins: ['https://aniembed.se'], allowedNavigationOrigins: ['https://aniembed.se'],
  requiredRequestOrigins: ['https://aniembed.se'],
  progressStrategy: 'frame-video', resumeStrategy: 'none', subtitleStrategy: 'provider',
  supportsResume: false, supportsExternalSubtitles: false, supportsDownloads: false,
  routingMode: 'manual-only', availability: 'having-trouble',
  availabilityReason: 'Playback and downloads have not been physically qualified.',
  animeOnly: true,
  animeProvider: { variants: ['sub', 'dub'], variantParam: 'lang', playbackQualified: false, downloadQualified: false },
  params: { lang: 'sub', autoplay: '1', t: '0' },
};
