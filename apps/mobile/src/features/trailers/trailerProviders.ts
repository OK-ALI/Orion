import type {
  TrailerCandidateV1,
  TrailerClientIdentity,
  TrailerProviderError,
} from '@orion/shared/types';

const serialize = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function classifyYouTubeError(code: number | string | null): TrailerProviderError {
  const numeric = Number(code);
  if (numeric === 2) return { provider: 'YouTube', category: 'invalid-request', publicCode: 2, retryable: false };
  if (numeric === 5) return { provider: 'YouTube', category: 'html5-playback', publicCode: 5, retryable: true };
  if (numeric === 100) return { provider: 'YouTube', category: 'removed', publicCode: 100, retryable: false };
  if (numeric === 101 || numeric === 150) return { provider: 'YouTube', category: 'embed-disabled', publicCode: numeric, retryable: false };
  if (numeric === 153) return { provider: 'YouTube', category: 'client-identity', publicCode: 153, retryable: true };
  return { provider: 'YouTube', category: 'provider-error', publicCode: code, retryable: false };
}

export function classifyVimeoError(code: number | string | null): TrailerProviderError {
  const value = String(code || 'provider-error');
  const embed = /privacy|embed|permission/i.test(value);
  return { provider: 'Vimeo', category: embed ? 'embed-disabled' : 'provider-error', publicCode: value, retryable: false };
}

function bridgeScript(candidateId: string) {
  return `function post(type, detail) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ candidateId:${serialize(candidateId)},type:type,detail:detail||null })); }`;
}

export function createYouTubeHtml(candidate: TrailerCandidateV1, identity: TrailerClientIdentity, privacyEnhanced = false) {
  const host = privacyEnhanced ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/><meta name="referrer" content="strict-origin-when-cross-origin"/><style>html,body,#player{width:100%;height:100%;margin:0;background:#000;overflow:hidden}iframe{width:100%!important;height:100%!important;border:0}</style></head><body><div id="player"></div><script>${bridgeScript(candidate.id)}var ready=false;var failed=false;window.onYouTubeIframeAPIReady=function(){try{new YT.Player('player',{host:${serialize(host)},videoId:${serialize(candidate.providerKey)},width:'100%',height:'100%',playerVars:{playsinline:1,controls:1,rel:0,fs:1,enablejsapi:1,origin:${serialize(identity.origin)},widget_referrer:${serialize(identity.referrer)}},events:{onReady:function(){ready=true;post('ready')},onStateChange:function(e){if(e.data===1)post('playing');else if(e.data===2)post('paused');else if(e.data===3)post('buffering');else if(e.data===0)post('ended')},onError:function(e){failed=true;post('provider-error',{code:e.data})},onAutoplayBlocked:function(){post('autoplay-blocked')}}})}catch(e){failed=true;post('provider-error',{code:'wrapper-error'})}};var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=function(){failed=true;post('network-error')};document.head.appendChild(s);setTimeout(function(){if(!ready&&!failed)post('timeout')},25000);</script></body></html>`;
}

export function createVimeoHtml(candidate: TrailerCandidateV1) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/><style>html,body,#player{width:100%;height:100%;margin:0;background:#000;overflow:hidden}iframe{width:100%!important;height:100%!important;border:0}</style></head><body><div id="player"></div><script src="https://player.vimeo.com/api/player.js"></script><script>${bridgeScript(candidate.id)}var ready=false;var failed=false;try{var player=new Vimeo.Player('player',{id:${serialize(candidate.providerKey)},responsive:true,playsinline:true});player.ready().then(function(){ready=true;post('ready')}).catch(function(e){failed=true;post('provider-error',{code:e&&e.name})});player.on('play',function(){post('playing')});player.on('pause',function(){post('paused')});player.on('bufferstart',function(){post('buffering')});player.on('ended',function(){post('ended')});player.on('error',function(e){failed=true;post('provider-error',{code:e&&e.name})})}catch(e){failed=true;post('provider-error',{code:'wrapper-error'})}setTimeout(function(){if(!ready&&!failed)post('timeout')},25000);</script></body></html>`;
}
