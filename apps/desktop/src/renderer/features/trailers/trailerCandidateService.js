const TYPE_SCORE = {
  trailer: 420,
  teaser: 300,
  clip: 120,
  featurette: 80,
};

const TITLE_PENALTIES = [
  "reaction",
  "review",
  "recap",
  "interview",
  "behind the scenes",
  "making of",
  "bloopers",
  "breakdown",
  "fan made",
  "fan-made",
  "tv spot",
  "commercial",
  "soundtrack",
  "theme song",
  "opening credits",
  "ending credits",
];

function providerOf(site) {
  const normalized = String(site || "").toLowerCase();
  if (normalized === "youtube") return "YouTube";
  if (normalized === "vimeo") return "Vimeo";
  return null;
}

function scoreCandidate(candidate, preferredLanguage, originalLanguage) {
  const type = candidate.type.toLowerCase();
  const name = candidate.name.toLowerCase();
  let value = TYPE_SCORE[type] ?? 20;
  if (candidate.official) value += 500;
  if (candidate.language === preferredLanguage) value += 180;
  else if (candidate.language === originalLanguage) value += 130;
  else if (candidate.language === "en") value += 100;
  if (candidate.scope === "season") value += 90;
  if (candidate.site === "YouTube") value += 10;
  value += Math.min(80, Math.max(0, (candidate.size || 0) / 27));
  if (candidate.publishedAt) {
    const publishedYear = new Date(candidate.publishedAt).getUTCFullYear();
    value += Math.max(0, Math.min(70, publishedYear - 1960));
  }
  for (const phrase of TITLE_PENALTIES) {
    if (name.includes(phrase)) value -= 260;
  }
  return Math.round(value);
}

export function hasPlayableTrailerVideo(videos = []) {
  return videos.some((video) => providerOf(video?.site) && String(video?.key || "").trim());
}

export function mergeTrailerVideos(primary = [], fallback = []) {
  const seen = new Set();
  const merged = [];
  for (const video of [...primary, ...fallback]) {
    const site = String(video?.site || "").toLowerCase();
    const key = String(video?.key || "").trim();
    const identity = site && key
      ? `${site}:${key}`
      : String(video?.id || `${site}:${key}:${merged.length}`);
    if (seen.has(identity)) continue;
    seen.add(identity);
    merged.push(video);
  }
  return merged;
}

export function normalizeTrailerCandidates(
  titleVideos = [],
  seasonVideos = [],
  preferredLanguage = "en",
  originalLanguage = preferredLanguage,
) {
  const seen = new Set();
  const candidates = [];

  for (const [videos, scope] of [[titleVideos, "title"], [seasonVideos, "season"]]) {
    for (const video of videos) {
      const site = providerOf(video?.site);
      const providerKey = String(video?.key || "").trim();
      if (!site || !providerKey) continue;
      const id = `${site.toLowerCase()}:${providerKey}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const base = {
        id,
        site,
        providerKey,
        name: `${scope === "season" && video?.seasonNum ? `Season ${video.seasonNum}: ` : ""}${video?.name || video?.type || "Trailer"}`,
        type: String(video?.type || "Video"),
        official: video?.official === true,
        language: video?.iso_639_1 || null,
        country: video?.iso_3166_1 || null,
        publishedAt: video?.published_at ? Date.parse(video.published_at) || null : null,
        size: Number.isFinite(video?.size) ? Number(video.size) : null,
        season: Number.isFinite(video?.seasonNum) ? Number(video.seasonNum) : null,
        scope,
      };

      candidates.push({
        ...base,
        score: scoreCandidate(base, preferredLanguage, originalLanguage),
      });
    }
  }

  return candidates.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}
