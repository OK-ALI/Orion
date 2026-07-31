const http = require("http");
const https = require("https");
const { spawnSync } = require("child_process");

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  Referer: "https://allmanga.to",
  Origin: "https://allmanga.to",
  Accept: "*/*",
};

function httpsGet(urlString) {
  return new Promise((resolve, reject) => {
    function requestUrl(url) {
      const parsed = new URL(url);
      const request = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "GET",
          headers: REQUEST_HEADERS,
        },
        (response) => {
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            const location = response.headers.location.startsWith("http")
              ? response.headers.location
              : new URL(response.headers.location, url).href;
            response.resume();
            requestUrl(location);
            return;
          }
          let data = "";
          response.on("data", (chunk) => (data += chunk));
          response.on("end", () =>
            resolve({ status: response.statusCode, body: data }),
          );
        },
      );
      request.on("error", reject);
      request.setTimeout(12000, () => {
        request.destroy();
        reject(new Error("timeout"));
      });
      request.end();
    }
    requestUrl(urlString);
  });
}

function followRedirects(urlString, maxHops = 10) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function step(url) {
      if (++hops > maxHops) return resolve(url);
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return reject(new Error(`invalid url: ${url}`));
      }
      const transport = parsed.protocol === "https:" ? https : http;
      const request = transport.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "HEAD",
          headers: REQUEST_HEADERS,
        },
        (response) => {
          response.resume();
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            const location = response.headers.location.startsWith("http")
              ? response.headers.location
              : new URL(response.headers.location, url).href;
            step(location);
          } else {
            resolve(url);
          }
        },
      );
      request.on("error", reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error("timeout"));
      });
      request.end();
    }
    step(urlString);
  });
}

function resolveWithYtdlp(youtubeUrl) {
  return new Promise((resolve) => {
    const which = spawnSync(
      process.platform === "win32" ? "where" : "which",
      ["yt-dlp"],
      { encoding: "utf8" },
    );
    if (which.status !== 0) return resolve(null);
    const result = spawnSync(
      "yt-dlp",
      [
        "--no-playlist",
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-g",
        youtubeUrl,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    if (result.status !== 0 || !result.stdout?.trim()) return resolve(null);
    resolve(result.stdout.trim().split("\n")[0]);
  });
}

function allanimeGQL(variables, query) {
  const body = JSON.stringify({ variables, query });
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.allanime.day",
        path: "/api",
        method: "POST",
        headers: {
          ...REQUEST_HEADERS,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, body: data }),
        );
      },
    );
    request.on("error", reject);
    request.setTimeout(12000, () => {
      request.destroy();
      reject(new Error("timeout"));
    });
    request.write(body);
    request.end();
  });
}

module.exports = { allanimeGQL, followRedirects, httpsGet, resolveWithYtdlp };
