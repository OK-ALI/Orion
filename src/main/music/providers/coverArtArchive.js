function releaseGroupArtwork(id, size = 500) {
  if (!/^[a-f0-9-]{36}$/i.test(String(id || ""))) return null;
  return `https://coverartarchive.org/release-group/${id}/front-${size}`;
}

module.exports = { releaseGroupArtwork };
