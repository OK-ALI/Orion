const test = require("node:test");
const assert = require("node:assert/strict");
const { collectCatalogSections, collectContinuationTokens, collectMusicItems, collectSearchSuggestions, splitResults } = require("../../../src/main/music/providers/ytmusic");

test("normalizes YouTube Music two-row artist cards", () => {
  const items = collectMusicItems({
    musicTwoRowItemRenderer: {
      title: { runs: [{ text: "Orion Artist" }] },
      subtitle: { runs: [{ text: "Artist" }] },
      thumbnailRenderer: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w60-h60" }] } } },
      navigationEndpoint: { browseEndpoint: {
        browseId: "UCorionArtist",
        browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } },
      } },
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "ytmusic-artist:UCorionArtist");
  assert.equal(items[0].name, "Orion Artist");
  assert.match(items[0].profileImageUrl, /w544-h544/);
});

test("normalizes YouTube Music multi-row playable tracks", () => {
  const items = collectMusicItems({
    musicMultiRowListItemRenderer: {
      title: { runs: [{ text: "Satellite Heart" }] },
      subtitle: { runs: [{ text: "Orion Ensemble" }, { text: " • " }, { text: "3:42" }] },
      thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w120-h120" }] } } },
      navigationEndpoint: { watchEndpoint: { videoId: "abc123def45" } },
    },
  });
  const results = splitResults(items);

  assert.equal(results.tracks.length, 1);
  assert.equal(results.tracks[0].providerTrackId, "abc123def45");
  assert.equal(results.tracks[0].artistName, "Orion Ensemble");
  assert.equal(results.tracks[0].durationMs, 222000);
});

test("keeps artist, album and duration fields separate in responsive track metadata", () => {
  const items = collectMusicItems({
    musicResponsiveListItemRenderer: {
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Celestial Signal", navigationEndpoint: { watchEndpoint: { videoId: "celestial01" } } }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Orion Ensemble" }, { text: " • " }, { text: "Living World" }, { text: " • " }, { text: "4:10" }] } } },
      ],
      thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w60-h60" }] } } },
    },
  });

  const track = splitResults(items).tracks[0];
  assert.equal(track.artistName, "Orion Ensemble");
  assert.equal(track.albumTitle, "Living World");
  assert.equal(track.durationMs, 250000);
});

test("normalizes watch-next playlist-panel tracks", () => {
  const items = collectMusicItems({
    playlistPanelVideoRenderer: {
      title: { runs: [{ text: "Return to Orion" }] },
      longBylineText: { runs: [{ text: "Resonance Ensemble" }] },
      lengthText: { simpleText: "4:05" },
      thumbnail: { thumbnails: [{ url: "https://img.example/w80-h80" }] },
      navigationEndpoint: { watchEndpoint: { videoId: "orbit987654" } },
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Return to Orion");
  assert.equal(items[0].durationMs, 245000);
  assert.match(items[0].artworkUrl, /w544-h544/);
});

test("uses a responsive row title endpoint before artist metadata", () => {
  const items = collectMusicItems({
    musicResponsiveListItemRenderer: {
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Discovery", navigationEndpoint: { browseEndpoint: { browseId: "MPREb_discovery" } } }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Album" }, { text: " • " }, { text: "Daft Punk", navigationEndpoint: { browseEndpoint: { browseId: "UCDaftPunk" } } }] } } },
      ],
      thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w60-h60" }] } } },
    },
  });

  const results = splitResults(items);
  assert.equal(results.artists.length, 0);
  assert.equal(results.albums.length, 1);
  assert.equal(results.albums[0].title, "Discovery");
});

test("uses a responsive row page type for artist cards", () => {
  const items = collectMusicItems({
    musicResponsiveListItemRenderer: {
      flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Daft Punk" }] } } }],
      navigationEndpoint: { browseEndpoint: {
        browseId: "UCDaftPunk",
        browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } },
      } },
      thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w60-h60" }] } } },
    },
  });

  const results = splitResults(items);
  assert.equal(results.artists.length, 1);
  assert.equal(results.artists[0].name, "Daft Punk");
});

test("prefers a responsive row's album endpoint over linked artist metadata", () => {
  const items = collectMusicItems({
    musicResponsiveListItemRenderer: {
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Discovery" }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Album" }, { text: " • " }, { text: "Daft Punk", navigationEndpoint: { browseEndpoint: { browseId: "UCDaftPunk" } } }] } } },
      ],
      navigationEndpoint: { browseEndpoint: {
        browseId: "MPREdiscovery",
        browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" } },
      } },
      thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w60-h60" }] } } },
    },
  });

  const album = splitResults(items).albums[0];
  assert.equal(album.id, "ytmusic-album:MPREdiscovery");
  assert.equal(album.source.id, "MPREdiscovery");
});

test("collects unique bounded YouTube Music continuation tokens", () => {
  const tokens = collectContinuationTokens({ contents: [
    { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "next-a" } } } },
    { nextContinuationData: { continuation: "next-a" } },
    { continuationEndpoint: { continuationCommand: { token: "next-b" } } },
    { continuationEndpoint: { continuationCommand: { token: "next-c" } } },
  ] });
  assert.deepEqual(tokens, ["next-a", "next-b"]);
});

test("preserves a titled carousel shelf instead of flattening it into the home response", () => {
  const sections = collectCatalogSections({
    musicCarouselShelfRenderer: {
      header: { musicCarouselShelfBasicHeaderRenderer: { title: { runs: [{ text: "Orbital artists" }] } } },
      contents: [{ musicTwoRowItemRenderer: {
        title: { runs: [{ text: "Resonance Ensemble" }] },
        thumbnailRenderer: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "https://img.example/w60-h60" }] } } },
        navigationEndpoint: { browseEndpoint: {
          browseId: "UCresonance",
          browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } },
        } },
      } }],
    },
  });

  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Orbital artists");
  assert.equal(sections[0].type, "artists");
  assert.equal(sections[0].items[0].name, "Resonance Ensemble");
});

test("keeps playlists separate from albums in catalog results", () => {
  const results = splitResults([{ id: "ytmusic-playlist:VLmix", title: "Midnight mix", source: { provider: "ytmusic-metadata", id: "VLmix" } }]);
  assert.equal(results.playlists.length, 1);
  assert.equal(results.albums.length, 0);
});

test("collects unique search suggestions", () => {
  const suggestions = collectSearchSuggestions({ contents: [
    { searchSuggestionRenderer: { suggestion: { runs: [{ text: "Daft Punk" }] } } },
    { searchSuggestionRenderer: { suggestion: { runs: [{ text: "Daft" }, { text: " Punk" }] } } },
    { searchSuggestionRenderer: { suggestion: { runs: [{ text: "Daft Punk albums" }] } } },
  ] });
  assert.deepEqual(suggestions, ["Daft Punk", "Daft Punk albums"]);
});
