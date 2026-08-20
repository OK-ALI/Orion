import { storage } from "./settingsStore";

const SYNC_POLICY_SCHEMA_VERSION = 1;
const SYNC_POLICY_KEY_PREFIX = "p8.syncPolicy.v1:";

function keyFor(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) throw new Error("Sync policy profile id is required.");
  return `${SYNC_POLICY_KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function loadPolicy(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return null;
  const raw = storage.get(keyFor(normalized));
  if (
    !raw
    || typeof raw !== "object"
    || raw.schemaVersion !== SYNC_POLICY_SCHEMA_VERSION
    || raw.profileId !== normalized
    || !raw.domains
    || typeof raw.domains !== "object"
  ) {
    return { schemaVersion: SYNC_POLICY_SCHEMA_VERSION, profileId: normalized, domains: {} };
  }
  return {
    schemaVersion: SYNC_POLICY_SCHEMA_VERSION,
    profileId: normalized,
    domains: { ...raw.domains },
  };
}

function loadAutomatic(profileId, domain) {
  const policy = loadPolicy(profileId);
  if (!policy) return true;
  const automatic = policy.domains?.[domain]?.automatic;
  return typeof automatic === "boolean" ? automatic : true;
}

function saveAutomatic(profileId, domain, enabled) {
  const policy = loadPolicy(profileId);
  if (!policy) return;
  storage.set(keyFor(policy.profileId), {
    ...policy,
    domains: {
      ...policy.domains,
      [domain]: { automatic: !!enabled },
    },
  });
}

export const loadDesktopMyListAutomaticV1 = (profileId) => loadAutomatic(profileId, "myList");
export const saveDesktopMyListAutomaticV1 = (profileId, enabled) => saveAutomatic(profileId, "myList", enabled);
export const loadDesktopWatchedAutomaticV1 = (profileId) => loadAutomatic(profileId, "watched");
export const saveDesktopWatchedAutomaticV1 = (profileId, enabled) => saveAutomatic(profileId, "watched", enabled);

export const loadDesktopViewingActivityAutomaticV1 = (profileId) => loadAutomatic(profileId, "viewingActivity");
export const saveDesktopViewingActivityAutomaticV1 = (profileId, enabled) => saveAutomatic(profileId, "viewingActivity", enabled);
