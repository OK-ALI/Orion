const media = Object.freeze({ movie: true, tv: true, anime: false });
const tmdb = Object.freeze({ movie: "tmdb", tv: "tmdb" });

export const experimentalSources = [
  {
    id: "autoembed", label: "AutoEmbed", releaseStatus: "experimental", media,
    idPolicy: { movie: "imdb-preferred", tv: "imdb-preferred" },
    buildMovieUrl: (id) => `https://autoembed.co/movie/${String(id).startsWith("tt") ? "imdb" : "tmdb"}/${id}`,
    buildEpisodeUrl: (id, season, episode) => `https://autoembed.co/tv/${String(id).startsWith("tt") ? "imdb" : "tmdb"}/${id}-${season}-${episode}`,
    expectedOrigins: ["https://autoembed.co"], allowedNavigationOrigins: ["https://autoembed.co"], requiredRequestOrigins: ["https://autoembed.co"],
    progressStrategy: "frame-video", subtitleStrategy: "request-capture", supportsResume: true, supportsExternalSubtitles: false, supportsDownloads: true, params: {},
  },
  {
    id: "vsembed", label: "VsEmbed", releaseStatus: "experimental", media,
    idPolicy: { movie: "imdb-preferred", tv: "imdb-preferred" },
    buildMovieUrl: (id) => `https://vsembed.su/embed/movie/${id}`,
    buildEpisodeUrl: (id, season, episode) => `https://vsembed.su/embed/tv/${id}/${season}/${episode}`,
    expectedOrigins: ["https://vsembed.su"], allowedNavigationOrigins: ["https://vsembed.su"], requiredRequestOrigins: ["https://vsembed.su"],
    progressStrategy: "frame-video", subtitleStrategy: "url-param", supportsResume: true, supportsExternalSubtitles: true, supportsDownloads: true,
    langParam: "ds_lang", externalSubtitleParam: "sub_url", params: {},
  },
  {
    id: "111movies", label: "111Movies", releaseStatus: "experimental", media,
    idPolicy: { movie: "imdb-preferred", tv: "imdb-preferred" },
    buildMovieUrl: (id) => `https://111movies.net/movie/${id}`,
    buildEpisodeUrl: (id, season, episode) => `https://111movies.net/tv/${id}/${season}/${episode}`,
    expectedOrigins: ["https://111movies.net"], allowedNavigationOrigins: ["https://111movies.net"], requiredRequestOrigins: ["https://111movies.net"],
    progressStrategy: "frame-video", subtitleStrategy: "request-capture", supportsResume: true, supportsExternalSubtitles: false, supportsDownloads: true, params: {},
  },
  {
    id: "vixsrc", label: "VixSrc", releaseStatus: "experimental", media,
    idPolicy: { movie: "imdb-preferred", tv: "imdb-preferred" },
    buildMovieUrl: (id) => `https://vixsrc.to/movie/${id}`,
    buildEpisodeUrl: (id, season, episode) => `https://vixsrc.to/tv/${id}/${season}/${episode}`,
    expectedOrigins: ["https://vixsrc.to"], allowedNavigationOrigins: ["https://vixsrc.to"], requiredRequestOrigins: ["https://vixsrc.to"],
    progressStrategy: "player-event", subtitleStrategy: "request-capture", supportsResume: true, supportsExternalSubtitles: false, supportsDownloads: true,
    colorParam: "primaryColor", langParam: "lang", resumeParam: "startAt", params: { autoplay: "true" },
  },
  {
    id: "superembed", label: "SuperEmbed", releaseStatus: "experimental", media, idPolicy: tmdb,
    buildMovieUrl: (id) => `https://multiembed.mov/?video_id=${id}`,
    buildEpisodeUrl: (id, season, episode) => `https://multiembed.mov/?video_id=${id}&s=${season}&e=${episode}`,
    expectedOrigins: ["https://multiembed.mov"], allowedNavigationOrigins: ["https://multiembed.mov"], requiredRequestOrigins: ["https://multiembed.mov"],
    progressStrategy: "frame-video", subtitleStrategy: "request-capture", supportsResume: true, supportsExternalSubtitles: false, supportsDownloads: true,
    quarantined: true, params: { tmdb: "1" },
  },
];

export const disabledSources = [
  ["vidfast", "VidFast", "https://vidfast.co"],
  ["vidify", "Vidify", "https://vidify.co"],
  ["2embed", "2Embed", "https://www.2embed.skin"],
  ["vidsrccc", "VidSrc CC", "https://vidsrc.cc"],
].map(([id, label, origin]) => ({
  id, label, releaseStatus: "disabled", media, idPolicy: tmdb,
  buildMovieUrl: (mediaId) => `${origin}/embed/movie/${mediaId}`,
  buildEpisodeUrl: (mediaId, season, episode) => `${origin}/embed/tv/${mediaId}/${season}/${episode}`,
  expectedOrigins: [origin], allowedNavigationOrigins: [origin], requiredRequestOrigins: [origin],
  progressStrategy: "none", subtitleStrategy: "request-capture", supportsResume: false, supportsExternalSubtitles: false, supportsDownloads: false,
  disabledReason: id === "vidsrccc" ? "Domain is currently down (HTTP 522)." : "Current provider contract has not been verified.", params: {},
}));
