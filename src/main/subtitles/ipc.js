// ── IPC: Subtitles ────────────────────────────────────────────────────────────
// Handles subtitle search (SubDL + Wyzie), ZIP extraction, download-for-file,
// and subtitle registry management in the downloads store.

const { ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");
const { SUBTITLE_EXTS, extractFirstSubtitleFromZip } = require("./archive");
const { extractSubtitleLang, fetchWithTimeout, getLocalProviderKey, resolveSubtitleAsset } = require("./service");



// Max decompressed zip size (10mb) to prevent zip-bombs














function register({ getDownloads, saveDownloads }) {
  ipcMain.handle("wyzie-open-redeem", async () => {
    try {
      await shell.openExternal("https://store.wyzie.io/redeem");
      return {
        ok: false,
        manual: true,
        message: "Redeem page opened. Paste the key here after copying it.",
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("wyzie-validate-key", async (_, key) => {
    try {
      const normalized = String(key || "").trim();
      if (!normalized) return { ok: false, error: "Enter a Wyzie API key." };
      if (normalized.length < 12) {
        return { ok: false, error: "That key looks too short." };
      }
      if (!/^wyzie-/i.test(normalized)) {
        return {
          ok: false,
          error: "Wyzie keys usually start with wyzie-.",
        };
      }
      if (!/^[a-z0-9_-]+$/i.test(normalized)) {
        return {
          ok: false,
          error: "The key contains characters Orion cannot use.",
        };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(
    "search-subtitles",
    async (
      _,
      {
        tmdbId,
        mediaType,
        season,
        episode,
        languages,
        subdlApiKey,
        wyzieApiKey,
      },
    ) => {
      const effectiveSubdlApiKey =
        String(subdlApiKey || "").trim() ||
        getLocalProviderKey("ORION_SUBDL_API_KEY", 8);

      function toSubDLLang(lang) {
        if (!lang) return "";
        return lang.split("-")[0].toUpperCase();
      }

      async function searchSubDL() {
        try {
          const params = new URLSearchParams({
            api_key: effectiveSubdlApiKey,
            tmdb_id: String(tmdbId),
            type: mediaType === "tv" ? "tv" : "movie",
            subs_per_page: "30",
          });
          if (mediaType === "tv" && season != null)
            params.set("season_number", String(season));
          if (mediaType === "tv" && episode != null)
            params.set("episode_number", String(episode));
          if (languages) params.set("languages", toSubDLLang(languages));

          const res = await fetchWithTimeout(
            `https://api.subdl.com/api/v1/subtitles?${params}`,
            { headers: { "User-Agent": "Orion" } },
            12000,
          );
          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            return {
              ok: false,
              error: `SubDL error ${res.status}: ${errText}`,
            };
          }
          const data = await res.json();
          if (!data.status)
            return { ok: false, error: "SubDL returned no results" };
          const results = (data.subtitles || []).map((s) => ({
            file_id: `subdl_${s.sd_id}_${encodeURIComponent(s.url)}`,
            file_name: s.name || s.release_name || "",
            language: (s.lang || "").toLowerCase(),
            release: s.release_name || s.name || "",
            uploader: s.author || "SubDL",
            download_count: s.downloads || 0,
            hearing_impaired: !!s.hi,
            ai_translated: false,
            machine_translated: false,
            ratings: 0,
            fps: null,
            from_trusted: false,
            via_subdl: true,
          }));
          if (results.length === 0)
            return { ok: false, error: "SubDL: no results" };
          return { ok: true, results, via_subdl: true };
        } catch (e) {
          const msg =
            e.name === "AbortError"
              ? "SubDL timed out, server may be temporarily unavailable"
              : e.message;
          return { ok: false, error: msg };
        }
      }

      async function searchWyzie() {
        try {
          // A user-saved key takes precedence. The local env fallback remains in
          // the main process and is never returned to renderer code.
          const effectiveWyzieApiKey =
            String(wyzieApiKey || "").trim() ||
            getLocalProviderKey("ORION_WYZIE_API_KEY", 12);
          const params = new URLSearchParams({
            id: String(tmdbId),
            format: "srt",
          });
          if (languages) params.set("language", languages);
          if (mediaType === "tv" && season != null)
            params.set("season", String(season));
          if (mediaType === "tv" && episode != null)
            params.set("episode", String(episode));

          if (effectiveWyzieApiKey) params.set("key", effectiveWyzieApiKey);

          const baseUrl = effectiveWyzieApiKey
            ? "https://sub.wyzie.io/search"
            : "https://subs.wyzie.ru/search";

          const res = await fetchWithTimeout(`${baseUrl}?${params}`, {}, 12000);
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              return {
                ok: false,
                error: `Wyzie API key invalid or expired (${res.status})`,
                wyzie_auth_error: true,
              };
            }
            return { ok: false, error: `Wyzie error ${res.status}` };
          }
          const data = await res.json();
          const results = (Array.isArray(data) ? data : [])
            .filter((r) => r.url)
            .map((r, i) => {
              const rawUrl = r.url || "";
              const fullUrl = rawUrl.startsWith("http")
                ? rawUrl
                : `https://subs.wyzie.ru${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
              const displayName =
                r.display_name ||
                r.name ||
                r.release_name ||
                r.title ||
                r.SubFileName ||
                r.fileName ||
                "";
              const lang = (r.language || "").toUpperCase();
              const hiTag = r.isHearingImpaired ? " [HI]" : "";
              const aiTag = r.isAiTranslated ? " [AI]" : "";
              const src = r.source ? ` · ${r.source}` : "";
              const fallback = `${lang} subtitle${hiTag}${aiTag}${src} #${i + 1}`;
              return {
                file_id: `wyzie_${i}_${encodeURIComponent(fullUrl)}`,
                direct_url: fullUrl,
                file_name: displayName || fallback,
                language: r.language || "",
                release: displayName || fallback,
                uploader: "Wyzie",
                download_count: 0,
                hearing_impaired: !!r.isHearingImpaired,
                ai_translated: !!r.isAiTranslated,
                machine_translated: false,
                ratings: 0,
                fps: null,
                from_trusted: false,
                via_wyzie: true,
                original_source: r.source || "",
              };
            });
          if (results.length === 0)
            return { ok: false, error: "Wyzie: no results" };
          return { ok: true, results, via_wyzie: true };
        } catch (e) {
          const msg =
            e.name === "AbortError"
              ? "Subtitle service timed out, it may be temporarily down. Try adding a free SubDL API key in Settings for reliable results."
              : e.message;
          return { ok: false, error: msg };
        }
      }
      const errors = [];
      if (effectiveSubdlApiKey) {
        const r = await searchSubDL();
        if (r.ok) return r;
        errors.push(r.error);
      }
      const r = await searchWyzie();
      if (r.ok) return r;
      errors.push(r.error);
      const allTimedOut = errors.every((e) => e && e.includes("timed out"));
      return {
        ok: false,
        error: allTimedOut
          ? "Subtitle service timed out, it may be temporarily down. Add a free SubDL API key in Settings for reliable results."
          : errors.length > 0
            ? errors.join(" · ")
            : "No subtitles found. Try a different language or add a SubDL API key in Settings.",
      };
    },
  );

  const TEMP_SUB_TTL_MS = 5 * 60 * 1000;

  ipcMain.handle("get-subtitle-url", async (_, { fileId }) => {
    try {
      if (String(fileId).startsWith("subdl_")) {
        const parts = String(fileId).split("_");
        const subdlPath = decodeURIComponent(parts.slice(2).join("_"));
        const downloadUrl = `https://dl.subdl.com${subdlPath}`;
        const res = await fetchWithTimeout(
          downloadUrl,
          { headers: { "User-Agent": "Orion" } },
          30000,
        );
        if (!res.ok)
          return { ok: false, error: `SubDL download error ${res.status}` };
        const zipBuffer = Buffer.from(await res.arrayBuffer());
        const extracted = extractFirstSubtitleFromZip(zipBuffer);
        if (!extracted)
          return { ok: false, error: "No subtitle file found in SubDL ZIP" };

        const safeName = path.basename(extracted.name);
        const tmpPath = path.join(
          os.tmpdir(),
          `orion_sub_${Date.now()}_${safeName}`,
        );
        fs.writeFileSync(tmpPath, extracted.data);

        setTimeout(() => {
          try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          } catch {}
        }, TEMP_SUB_TTL_MS);

        return {
          ok: true,
          url: `file://${tmpPath}`,
          file_name: extracted.name,
          remaining: null,
          reset_time: null,
          via_subdl: true,
        };
      }

      if (String(fileId).startsWith("wyzie_")) {
        const url = decodeURIComponent(
          String(fileId).split("_").slice(2).join("_"),
        );
        return {
          ok: true,
          url,
          file_name: "",
          remaining: null,
          reset_time: null,
          via_wyzie: true,
        };
      }

      return { ok: false, error: "Unknown subtitle source" };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(
    "download-subtitles-for-file",
    async (_, { filePath, selectedSubs }) => {
      try {
        const resolvedFilePath = path.resolve(filePath);

        let targetStat;
        try {
          targetStat = fs.statSync(resolvedFilePath);
        } catch {
          return { ok: false, error: "Target file does not exist" };
        }
        if (!targetStat.isFile()) {
          return { ok: false, error: "Target path is not a file" };
        }

        const allDownloads = getDownloads();
        const resolvedDir = path.dirname(resolvedFilePath);
        const isKnownFile = allDownloads.some(
          (d) => d.filePath && path.resolve(d.filePath) === resolvedFilePath,
        );
        const isInKnownDownloadDir = allDownloads.some((d) => {
          if (!d.downloadPath) return false;
          const dp = path.resolve(d.downloadPath);
          return (
            resolvedDir === dp || resolvedDir.startsWith(dp + path.sep)
          );
        });
        if (!isKnownFile && !isInKnownDownloadDir) {
          return {
            ok: false,
            error: "File is not in a known download directory",
          };
        }

        const dir = path.dirname(resolvedFilePath);
        const baseName = path.basename(resolvedFilePath, path.extname(resolvedFilePath));
        const results = [];
        const langCounter = {};

        for (const sub of selectedSubs) {
          try {
            const langCode = (sub.language || sub.lang || "unknown").replace(
              /[^a-z0-9_-]/gi,
              "",
            );
            let fileData, ext;

            if (String(sub.file_id).startsWith("subdl_")) {
              const parts = String(sub.file_id).split("_");
              const subdlPath = decodeURIComponent(parts.slice(2).join("_"));
              const res = await fetchWithTimeout(
                `https://dl.subdl.com${subdlPath}`,
                { headers: { "User-Agent": "Orion" } },
                30000,
              );
              if (!res.ok) continue;
              const zipBuf = Buffer.from(await res.arrayBuffer());
              const extracted = extractFirstSubtitleFromZip(zipBuf);
              if (!extracted) continue;
              fileData = extracted.data;

              ext = extracted.name.split(".").pop().toLowerCase();
              if (!SUBTITLE_EXTS.has(ext)) continue;
            } else {
              const url =
                sub.direct_url ||
                (String(sub.file_id).startsWith("wyzie_")
                  ? decodeURIComponent(
                      String(sub.file_id).split("_").slice(2).join("_"),
                    )
                  : null);
              if (!url) continue;
              const res = await fetchWithTimeout(url, {}, 30000);
              if (!res.ok) continue;
              fileData = Buffer.from(await res.arrayBuffer());
              const urlExt = url.split("?")[0].split(".").pop().toLowerCase();
              ext = SUBTITLE_EXTS.has(urlExt) ? urlExt : "srt";
            }

            const lIdx = langCounter[langCode] ?? 0;
            langCounter[langCode] = lIdx + 1;
            const suffix = lIdx > 0 ? `.${lIdx}` : "";
            const destPath = path.join(
              dir,
              `${baseName}.${langCode}${suffix}.${ext}`,
            );
            fs.writeFileSync(destPath, fileData);
            results.push({
              lang: langCode,
              path: destPath,
              file_id: sub.file_id || null,
              release: sub.release || sub.file_name || null,
              source: sub.via_subdl ? "subdl" : "wyzie",
            });
          } catch (subErr) {
            console.error("Subtitle download error:", subErr);
          }
        }

        if (results.length > 0 && resolvedFilePath) {
          const downloads = getDownloads();
          const idx = downloads.findIndex((d) => d.filePath === resolvedFilePath);
          if (idx >= 0) {
            const existing = downloads[idx].subtitlePaths || [];
            const existingFileIds = new Set(
              existing.map((s) => s.file_id).filter(Boolean),
            );
            downloads[idx].subtitlePaths = [
              ...existing,
              ...results.filter(
                (r) => !r.file_id || !existingFileIds.has(r.file_id),
              ),
            ];
            saveDownloads();
          }
        }

        return { ok: true, subtitlePaths: results };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  );

  ipcMain.handle("prune-subtitle-paths", (_, { downloadId }) => {
    try {
      const downloads = getDownloads();
      const idx = downloads.findIndex((d) => d.id === downloadId);
      if (idx < 0) return { ok: true, subtitlePaths: [] };
      const before = downloads[idx].subtitlePaths || [];
      const after = before.filter((sp) => {
        const p = typeof sp === "string" ? sp : sp?.path;
        return p && fs.existsSync(p);
      });
      if (after.length !== before.length) {
        downloads[idx].subtitlePaths = after;
        saveDownloads();
      }
      return { ok: true, subtitlePaths: after };
    } catch (e) {
      return { ok: false, error: e.message, subtitlePaths: [] };
    }
  });

  ipcMain.handle("delete-subtitle-file", (_, { downloadId, subtitlePath }) => {
    try {
      if (subtitlePath && fs.existsSync(subtitlePath))
        fs.unlinkSync(subtitlePath);
      if (downloadId) {
        const downloads = getDownloads();
        const idx = downloads.findIndex((d) => d.id === downloadId);
        if (idx >= 0) {
          downloads[idx].subtitlePaths = (
            downloads[idx].subtitlePaths || []
          ).filter((sp) => sp.path !== subtitlePath);
          saveDownloads();
        }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register, extractSubtitleLang, resolveSubtitleAsset };
