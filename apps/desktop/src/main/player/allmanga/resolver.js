const https = require("https");

function sanitizeTitle(title) {
  return title
    .replace(/[''`´]/g, "")
    .replace(/[:!.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function anilistSeasonTitle(baseTitle, seasonNumber) {
  return new Promise((resolve) => {
    const resolveFirstSeason = seasonNumber <= 1;
    const query = `query($search:String){Media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}`;
    const body = JSON.stringify({ query, variables: { search: baseTitle } });
    const fallback = {
      title: baseTitle,
      romaji: null,
      episodes: null,
      nextTitle: null,
      nextRomaji: null,
    };
    const request = https.request(
      {
        hostname: "graphql.anilist.co",
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => {
          try {
            const media = JSON.parse(data)?.data?.Media;
            if (!media) return resolve(fallback);
            const firstRomaji = media.title?.romaji || null;
            const sequels = (media.relations?.edges || [])
              .filter(
                (edge) =>
                  edge.relationType === "SEQUEL" &&
                  edge.node.type === "ANIME" &&
                  (edge.node.format === "TV" || edge.node.format === "TV_SHORT"),
              )
              .sort((left, right) => {
                const leftYear =
                  left.node.startDate?.year || left.node.seasonYear || 9999;
                const rightYear =
                  right.node.startDate?.year || right.node.seasonYear || 9999;
                return leftYear - rightYear;
              });
            const getTitle = (node) =>
              node.title?.english || node.title?.romaji || null;
            const getRomaji = (node) => node.title?.romaji || null;

            if (resolveFirstSeason) {
              const next = sequels[0]?.node ?? null;
              return resolve({
                title: media.title?.english || baseTitle,
                romaji: firstRomaji,
                episodes: media.episodes || null,
                nextTitle: next ? getTitle(next) : null,
                nextRomaji: next ? getRomaji(next) : null,
              });
            }

            const target = sequels[seasonNumber - 2];
            if (!target) return resolve({ ...fallback, romaji: firstRomaji });
            const next = sequels[seasonNumber - 1]?.node ?? null;
            resolve({
              title: getTitle(target.node) || baseTitle,
              romaji: getRomaji(target.node) || firstRomaji,
              episodes: target.node.episodes || null,
              nextTitle: next ? getTitle(next) : null,
              nextRomaji: next ? getRomaji(next) : null,
            });
          } catch {
            resolve(fallback);
          }
        });
      },
    );
    request.on("error", () => resolve(fallback));
    request.setTimeout(8000, () => {
      request.destroy();
      resolve(fallback);
    });
    request.write(body);
    request.end();
  });
}

module.exports = { anilistSeasonTitle, sanitizeTitle };
