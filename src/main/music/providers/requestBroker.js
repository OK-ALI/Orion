function withTimeout(promise, milliseconds, providerName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  return Promise.resolve(typeof promise === "function" ? promise(controller.signal) : promise)
    .finally(() => clearTimeout(timeout))
    .catch((error) => {
      if (controller.signal.aborted) throw new Error(`${providerName} timed out.`);
      throw error;
    });
}

async function queryProviders(providers, operation, args, { timeout = 8000 } = {}) {
  const settled = await Promise.allSettled(providers.map(async (provider) => {
    if (typeof provider[operation] !== "function") return null;
    const startedAt = Date.now();
    try {
      const value = await withTimeout((signal) => provider[operation](...args, { signal }), timeout, provider.name);
      registry.recordSuccess(provider.id, Date.now() - startedAt);
      return { providerId: provider.id, providerName: provider.name, value };
    } catch (error) {
      registry.recordFailure(provider.id, error, Date.now() - startedAt);
      throw error;
    }
  }));
  return {
    results: settled.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value),
    errors: settled.filter((item) => item.status === "rejected").map((item) => item.reason?.message || "Provider failed"),
  };
}

module.exports = { queryProviders, withTimeout };
const registry = require("./registry");
