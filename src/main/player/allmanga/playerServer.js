const http = require("http");
const https = require("https");

let _playerServer = null;

let _currentVideoUrl = null;

let _currentVideoReferer = "https://allmanga.to";

let _currentVideoStartTime = 0;

function buildPlayerHtml(videoUrl, startTime) {
  const isM3u8 = videoUrl.includes(".m3u8");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain;display:block}</style>
</head><body>
<video id="v" src="${isM3u8 ? "" : "/proxy?url=" + encodeURIComponent(videoUrl)}" autoplay controls playsinline crossorigin="anonymous"></video>
${
  isM3u8
    ? `
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js"></script>
<script>
  const video=document.getElementById('v');
  const src=decodeURIComponent("${encodeURIComponent(videoUrl)}");
  const startTime=${startTime};
  if(Hls.isSupported()){
    const hls=new Hls({xhrSetup:(xhr)=>xhr.setRequestHeader('Referer','${_currentVideoReferer}')});
    hls.loadSource(src);hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(startTime>0)video.currentTime=startTime;video.play().catch(()=>{});});
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src=src;
    if(startTime>0)video.addEventListener('loadedmetadata',()=>{video.currentTime=startTime;},{once:true});
  }
</script>`
    : startTime > 0
      ? `<script>
  const v=document.getElementById('v');
  v.addEventListener('loadedmetadata',()=>{v.currentTime=${startTime};},{once:true});
</script>`
      : ""
}
</body></html>`;
}

function getPlayerServer() {
  if (_playerServer) return Promise.resolve(_playerServer);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");

      if (url.pathname === "/player" || url.pathname === "/") {
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Cache-Control": "no-store",
        });
        res.end(
          buildPlayerHtml(_currentVideoUrl || "", _currentVideoStartTime || 0),
        );
        return;
      }

      if (url.pathname === "/proxy") {
        const target = url.searchParams.get("url");
        if (!target) {
          res.writeHead(400);
          res.end();
          return;
        }
        try {
          const targetUrl = new URL(target);
          const lib = targetUrl.protocol === "https:" ? https : http;
          const proxyReq = lib.request(
            {
              hostname: targetUrl.hostname,
              path: targetUrl.pathname + targetUrl.search,
              method: req.method || "GET",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
                Referer: _currentVideoReferer,
                Range: req.headers["range"] || "",
                Accept: "*/*",
              },
            },
            (proxyRes) => {
              const passHeaders = {};
              for (const h of [
                "content-type",
                "content-length",
                "content-range",
                "accept-ranges",
                "last-modified",
                "etag",
              ]) {
                if (proxyRes.headers[h]) passHeaders[h] = proxyRes.headers[h];
              }
              passHeaders["Access-Control-Allow-Origin"] = "*";
              passHeaders["Cache-Control"] = "no-store";
              res.writeHead(proxyRes.statusCode, passHeaders);
              proxyRes.pipe(res);
            },
          );
          proxyReq.on("error", () => {
            res.writeHead(502);
            res.end();
          });
          req.pipe(proxyReq);
        } catch {
          res.writeHead(500);
          res.end();
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(0, "127.0.0.1", () => {
      _playerServer = server;
      resolve(server);
    });
    server.on("error", reject);
  });
}
async function setVideo({ url, referer, startTime }) {
  _currentVideoUrl = url;
  _currentVideoReferer = referer || "https://allmanga.to";
  _currentVideoStartTime = startTime || 0;
  const server = await getPlayerServer();
  return { playerUrl: `http://127.0.0.1:${server.address().port}/player` };
}
module.exports = { setVideo };
