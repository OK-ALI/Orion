const crypto = require("crypto");
const fs = require("fs");
const registry = require("../providers/registry");
const tokens = require("./tokenRegistry");

const candidateGrants = new Map();

function normalizedText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candidateScore(track, candidate) {
  const wantedTitle = normalizedText(track.title);
  const wantedArtist = normalizedText(track.artistName);
  const title = normalizedText(candidate.title);
  const artist = normalizedText(candidate.artistName);
  let score = 0;
  if (wantedTitle && title.includes(wantedTitle)) score += 8;
  if (wantedArtist && `${title} ${artist}`.includes(wantedArtist)) score += 6;
  if (/official (audio|video)|provided to youtube/i.test(candidate.title || "")) score += 2;
  if (/cover|karaoke|nightcore|slowed|sped up|reaction/i.test(candidate.title || "")) score -= 4;
  const expected = Number(track.durationMs);
  const actual = Number(candidate.durationMs);
  if (expected > 0 && actual > 0) {
    const difference = Math.abs(expected - actual);
    score += difference <= 3_000 ? 5 : difference <= 10_000 ? 2 : difference > 45_000 ? -4 : 0;
  }
  return score;
}

function providerOrder(providerId) {
  const preferred = providerId ? registry.get(providerId, "streaming") : registry.getActive("streaming");
  if (providerId) return [preferred].filter(Boolean);
  
  const allProviders = registry.list("streaming");
  const ordered = [];
  const ytMusic = allProviders.find((p) => p.id === "ytmusic-streaming");
  if (ytMusic) ordered.push(ytMusic);
  if (preferred && preferred.id !== "ytmusic-streaming") ordered.push(preferred);
  for (const provider of allProviders) {
    if (provider.id !== "ytmusic-streaming" && (!preferred || provider.id !== preferred.id)) {
      ordered.push(provider);
    }
  }
  return ordered.filter((provider) => !provider.requiresConfiguration || provider.isConfigured?.());
}

async function discoverCandidates(track, providerId) {
  const providers = providerOrder(providerId);
  if (!providers.length) throw new Error("No configured streaming provider can play this track.");
  const errors = [];
  const candidates = [];
  for (const provider of providers) {
    if (typeof provider.searchForTrack !== "function") continue;
    const startedAt = Date.now();
    try {
      const found = await provider.searchForTrack(track);
      registry.recordSuccess(provider.id, Date.now() - startedAt);
      for (const candidate of found || []) candidates.push({ ...candidate, providerId: provider.id });
      if (providerId && candidates.length) break;
      if (candidates.length >= 12) break;
    } catch (error) {
      registry.recordFailure(provider.id, error, Date.now() - startedAt);
      errors.push({ providerId: provider.id, providerName: provider.name, message: error.message });
    }
  }
  candidates.sort((left, right) => candidateScore(track, right) - candidateScore(track, left));
  return { candidates: candidates.slice(0, 18), errors };
}

async function probeRemoteResource(resource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response;
  try {
    const headers = new Headers(resource.headers || {});
    if (!headers.has("range")) headers.set("range", "bytes=0-1");
    response = await fetch(resource.url, { headers, redirect: "follow", signal: controller.signal });
    if (![200, 206].includes(response.status)) throw new Error(`Audio host rejected playback (${response.status}).`);
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (type.includes("text/html") || type.includes("application/json")) throw new Error("Audio host returned a non-audio response.");
    return true;
  } finally {
    clearTimeout(timeout);
    try { await response?.body?.cancel(); } catch {}
  }
}

async function resolveCandidate(candidate, providerId, { probe = true } = {}) {
  const provider = registry.get(providerId || candidate.providerId, "streaming");
  if (!provider?.resolveCandidate) throw new Error("The selected streaming provider cannot resolve this candidate.");
  const startedAt = Date.now();
  try {
    const resource = await provider.resolveCandidate(candidate);
    if (!resource || !["local", "remote"].includes(resource.kind)) throw new Error("The provider returned an unsupported playback resource.");
    if (resource.kind === "local" && (!resource.filePath || !fs.existsSync(resource.filePath))) throw new Error("The local music file is missing.");
    if (resource.kind === "remote" && probe) await probeRemoteResource(resource);
    registry.recordSuccess(provider.id, Date.now() - startedAt);
    const ttl = Math.max(30_000, (resource.expiresAt || Date.now() + 3_600_000) - Date.now());
    const grant = tokens.createGrant(resource, ttl);
    return { url: grant.url, expiresAt: grant.expiresAt, candidate: {
      id: candidate.id, providerId: provider.id, title: candidate.title,
      artistName: candidate.artistName || "", durationMs: candidate.durationMs || null,
      thumbnail: candidate.thumbnail || candidate.artworkUrl || null, resolved: true,
    } };
  } catch (error) {
    registry.recordFailure(provider.id, error, Date.now() - startedAt);
    throw error;
  }
}

async function resolveTrack(track, providerId) {
  const { candidates, errors } = await discoverCandidates(track, providerId);
  if (!candidates.length) {
    const toolError = errors.find((entry) => /tools are not installed/i.test(entry.message));
    throw new Error(toolError?.message || "No installed music source could find a playable version of this track.");
  }
  const failures = [];
  for (const candidate of candidates.slice(0, 6)) {
    try {
      const resolved = await resolveCandidate(candidate, candidate.providerId);
      return { ...resolved, attempts: failures.length + 1 };
    } catch (error) {
      failures.push(`${candidate.providerId}: ${String(error.message || "resolution failed").replace(/https?:\/\/\S+/g, "[url]")}`);
    }
  }
  throw new Error(`Orion tried ${Math.min(6, candidates.length)} music sources, but none returned playable audio. ${failures.at(-1) || ""}`.trim());
}

async function listCandidateSummaries(track, providerId) {
  const result = await discoverCandidates(track, providerId);
  return result.candidates.map((candidate) => {
    const id = crypto.randomBytes(18).toString("base64url");
    candidateGrants.set(id, { candidate, providerId: candidate.providerId, expiresAt: Date.now() + 15 * 60 * 1000 });
    return { id, title: candidate.title || track.title, artistName: candidate.artistName || "",
      durationMs: candidate.durationMs || null, thumbnail: candidate.thumbnail || candidate.artworkUrl || null,
      providerId: candidate.providerId, matchScore: candidateScore(track, candidate) };
  });
}

async function resolveCandidateGrant(id) {
  const grant = candidateGrants.get(String(id || ""));
  candidateGrants.delete(String(id || ""));
  if (!grant || grant.expiresAt < Date.now()) throw new Error("That music source expired. Refresh sources and try again.");
  return resolveCandidate(grant.candidate, grant.providerId);
}

module.exports = { candidateScore, discoverCandidates, listCandidateSummaries, probeRemoteResource,
  resolveCandidate, resolveCandidateGrant, resolveTrack };
