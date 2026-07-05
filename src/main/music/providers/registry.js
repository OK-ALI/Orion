const database = require("../database");
const { MUSIC_PROVIDER_KINDS } = require("../../../shared/musicConstants.cjs");

const knownKinds = new Set(Object.values(MUSIC_PROVIDER_KINDS));
const providers = new Map();
const listeners = new Set();
const health = new Map();

function defaultHealth() {
  return { status: "unknown", latencyMs: null, lastSuccessAt: null, lastFailureAt: null, lastError: "", consecutiveFailures: 0 };
}

function cleanError(value) {
  return String(value || "Provider request failed")
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/(token|key|password|authorization|cookie)=?[^\s&]*/gi, "$1=[redacted]")
    .slice(0, 240);
}

function classifyFailure(message) {
  if (/401|403|auth|credential|password/i.test(message)) return "authentication_required";
  if (/429|rate.?limit|retry-after/i.test(message)) return "rate_limited";
  if (/timed? out|abort/i.test(message)) return "slow";
  return "unavailable";
}

function recordSuccess(providerId, latencyMs) {
  health.set(providerId, { status: Number(latencyMs) > 5000 ? "slow" : "healthy",
    latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)), lastSuccessAt: Date.now(),
    lastFailureAt: health.get(providerId)?.lastFailureAt || null, lastError: "", consecutiveFailures: 0 });
}

function recordFailure(providerId, error, latencyMs) {
  const previous = health.get(providerId) || defaultHealth();
  const message = cleanError(error?.message || error);
  health.set(providerId, { ...previous, status: classifyFailure(message),
    latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)), lastFailureAt: Date.now(),
    lastError: message, consecutiveFailures: previous.consecutiveFailures + 1 });
}

function assertProvider(provider) {
  if (!provider || typeof provider !== "object") throw new TypeError("Provider must be an object.");
  if (!provider.id || !provider.name || !knownKinds.has(provider.kind)) {
    throw new TypeError("Provider requires a unique id, name, and supported kind.");
  }
  if (providers.has(provider.id)) throw new Error(`Music provider already registered: ${provider.id}`);
}

function register(provider) {
  assertProvider(provider);
  providers.set(provider.id, Object.freeze({ firstParty: true, ...provider }));
  if (!health.has(provider.id)) health.set(provider.id, defaultHealth());
  listeners.forEach((listener) => listener());
  return provider.id;
}

function unregister(providerId) {
  const removed = providers.delete(providerId);
  if (removed) listeners.forEach((listener) => listener());
  return removed;
}

function list(kind) {
  return [...providers.values()].filter((provider) => !kind || provider.kind === kind);
}

function get(providerId, kind) {
  const provider = providers.get(providerId);
  return provider && (!kind || provider.kind === kind) ? provider : undefined;
}

function getActive(kind) {
  const preferences = database.getState("provider_preferences", {});
  const usable = (provider) => provider && (!provider.requiresConfiguration || provider.isConfigured?.());
  const preferred = get(preferences[kind], kind);
  return usable(preferred) ? preferred : list(kind).find(usable);
}

function setActive(kind, providerId) {
  if (!knownKinds.has(kind)) throw new Error(`Unsupported provider kind: ${kind}`);
  const provider = get(providerId, kind);
  if (!provider) throw new Error(`Provider ${providerId} does not supply ${kind}.`);
  if (provider.requiresConfiguration && !provider.isConfigured?.()) {
    throw new Error(`${provider.name} must be configured before it can be selected.`);
  }
  const preferences = database.getState("provider_preferences", {});
  database.setState("provider_preferences", { ...preferences, [kind]: providerId });
  listeners.forEach((listener) => listener());
}

function publicDescriptor(provider) {
  return {
    id: provider.id, name: provider.name, kind: provider.kind,
    pluginId: provider.pluginId || null,
    capabilities: provider.capabilities || [], firstParty: provider.firstParty !== false,
    requiresConfiguration: !!provider.requiresConfiguration,
    configured: !provider.requiresConfiguration || !!provider.isConfigured?.(),
    pairedStreamingProviderId: provider.pairedStreamingProviderId || null,
    health: { ...(health.get(provider.id) || defaultHealth()) },
  };
}

function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function clear() { providers.clear(); health.clear(); listeners.forEach((listener) => listener()); }

module.exports = { clear, get, getActive, list, publicDescriptor, recordFailure, recordSuccess,
  register, setActive, subscribe, unregister };
