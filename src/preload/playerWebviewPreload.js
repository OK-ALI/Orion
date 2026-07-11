// Sandboxed preload for player webview (cross-origin guest pages)
// Does NOT expose any Electron APIs to the guest page for security.

try {
  const LocationCtor = globalThis.Location;
  const originalReplace = LocationCtor?.prototype?.replace;
  if (typeof originalReplace !== "function") throw new Error("Location.replace is unavailable");
  LocationCtor.prototype.replace = function(url) {
    if (url && typeof url === "string" && (url.includes("/tv/") || url.includes("/movie/")) && url.includes("2embed")) {
      console.log("[Orion] Blocked 2Embed iframe redirect to:", url);
      return;
    }
    return originalReplace.call(this, url);
  };
} catch (e) {
  console.error("[Orion] Failed to inject 2Embed redirect blocker:", e);
}
