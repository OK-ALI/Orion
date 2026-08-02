/**
 * Candidate Cinema Sources
 *
 * Ported from desktop's adapters/candidates.js
 */

import type { CinemaSourceDescriptor } from "../contracts";

const media = Object.freeze({ movie: true, tv: true, anime: false });

export const candidateSources: CinemaSourceDescriptor[] = [
  {
    id: "vidlink",
    label: "VidLink",
    releaseStatus: "candidate",
    media,
    idPolicy: { movie: "tmdb", tv: "tmdb" },
    buildMovieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    buildEpisodeUrl: (id, season, episode) => `https://vidlink.pro/tv/${id}/${season}/${episode}`,
    expectedOrigins: ["https://vidlink.pro"],
    allowedNavigationOrigins: ["https://vidlink.pro"],
    requiredRequestOrigins: ["https://vidlink.pro"],
    progressStrategy: "player-event",
    resumeStrategy: "url-param",
    subtitleStrategy: "url-param",
    supportsResume: true,
    supportsExternalSubtitles: true,
    supportsDownloads: true,
    colorParam: "primaryColor",
    resumeParam: "startAt",
    externalSubtitleParam: "sub_file",
    externalSubtitleLabelParam: "sub_label",
    params: { autoplay: "true" },
  },
];
