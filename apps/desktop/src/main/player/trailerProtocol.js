const { protocol, session } = require("electron");

let registered = false;

const ORION_TRAILER_ORIGIN = "https://com.okali.orion";
const ORION_TRAILER_REFERRER = `${ORION_TRAILER_ORIGIN}/`;

function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: "orion-trailer",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: false,
      corsEnabled: false,
      stream: false,
    },
  }]);
}

function serialize(value) {
  return JSON.stringify(String(value ?? "")).replace(/</g, "\\u003c");
}

function errorResponse(status, message) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function bridgeScript(candidateId) {
  return `function post(type,detail){window.dispatchEvent(new CustomEvent('orion-trailer-event',{detail:{candidateId:${serialize(candidateId)},type:type,detail:detail||null}}));}`;
}

function youtubeHtml(candidateId, providerKey, privacyEnhanced) {
  const host = privacyEnhanced ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://www.youtube.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src https://www.youtube.com https://*.googlevideo.com; img-src https: data:"><style>html,body,#player{width:100%;height:100%;margin:0;background:#000;overflow:hidden}iframe{width:100%!important;height:100%!important;border:0}</style></head><body><div id="player"></div><script>${bridgeScript(candidateId)}var ready=false;var failed=false;window.onYouTubeIframeAPIReady=function(){try{new YT.Player('player',{host:${serialize(host)},videoId:${serialize(providerKey)},width:'100%',height:'100%',playerVars:{autoplay:1,playsinline:1,controls:1,rel:0,fs:1,enablejsapi:1,origin:${serialize(ORION_TRAILER_ORIGIN)},widget_referrer:${serialize(ORION_TRAILER_REFERRER)}},events:{onReady:function(e){ready=true;post('ready');try{e.target.playVideo()}catch(_){}},onStateChange:function(e){if(e.data===1)post('playing');else if(e.data===2)post('paused');else if(e.data===3)post('buffering');else if(e.data===0)post('ended')},onError:function(e){failed=true;post('provider-error',{code:e.data})},onAutoplayBlocked:function(){post('autoplay-blocked')}}})}catch(e){failed=true;post('provider-error',{code:'wrapper-error'})}};var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=function(){failed=true;post('network-error')};document.head.appendChild(s);setTimeout(function(){if(!ready&&!failed)post('timeout')},25000);</script></body></html>`;
}

function vimeoHtml(candidateId, providerKey) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://player.vimeo.com; frame-src https://player.vimeo.com; connect-src https://player.vimeo.com https://*.vimeocdn.com; img-src https: data:"><style>html,body,#player{width:100%;height:100%;margin:0;background:#000;overflow:hidden}iframe{width:100%!important;height:100%!important;border:0}</style></head><body><div id="player"></div><script src="https://player.vimeo.com/api/player.js"></script><script>${bridgeScript(candidateId)}var ready=false;var failed=false;try{var player=new Vimeo.Player('player',{id:${serialize(providerKey)},responsive:true,playsinline:true,autoplay:true});player.ready().then(function(){ready=true;post('ready')}).catch(function(e){failed=true;post('provider-error',{code:e&&e.name})});player.on('play',function(){post('playing')});player.on('pause',function(){post('paused')});player.on('bufferstart',function(){post('buffering')});player.on('ended',function(){post('ended')});player.on('error',function(e){failed=true;post('provider-error',{code:e&&e.name})})}catch(e){failed=true;post('provider-error',{code:'wrapper-error'})}setTimeout(function(){if(!ready&&!failed)post('timeout')},25000);</script></body></html>`;
}

function createTrailerResponse(request) {
  let url;
  try { url = new URL(request.url); } catch { return errorResponse(400, "Invalid trailer request"); }
  if (url.hostname !== "player" || url.pathname !== "/embed") {
    return errorResponse(404, "Trailer page not found");
  }

  const provider = url.searchParams.get("provider");
  const candidateId = url.searchParams.get("candidate") || "";
  const providerKey = url.searchParams.get("key") || "";
  if (!/^[A-Za-z0-9:_-]{1,180}$/.test(candidateId)) {
    return errorResponse(400, "Invalid trailer candidate");
  }

  let html;
  if (provider === "youtube" && /^[A-Za-z0-9_-]{5,32}$/.test(providerKey)) {
    html = youtubeHtml(candidateId, providerKey, url.searchParams.get("privacy") === "1");
  } else if (provider === "vimeo" && /^\d{1,20}$/.test(providerKey)) {
    html = vimeoHtml(candidateId, providerKey);
  } else {
    return errorResponse(400, "Invalid trailer provider");
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function register() {
  if (registered) return;
  session.fromPartition("persist:trailer").protocol.handle("orion-trailer", createTrailerResponse);
  registered = true;
}

module.exports = {
  createTrailerResponse,
  register,
  registerScheme,
};
