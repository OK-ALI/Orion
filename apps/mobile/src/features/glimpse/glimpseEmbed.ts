import type { GlimpseReel } from './glimpseModel';
import { GLIMPSE_INTERNAL_PREVIEW } from './glimpseBuild';

export const GLIMPSE_EMBED_ORIGIN = 'https://com.okali.orion';
const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

export type GlimpseVideoEvent = 'buffering' | 'ready' | 'playing' | 'paused' | 'ended' | 'blocked' | 'failed';
export function parseGlimpseVideoEvent(data: string, reelId: string, token: string): GlimpseVideoEvent | null {
  if (data.length > 2048) return null;
  try {
    const message = JSON.parse(data);
    return message?.reelId === reelId && message?.token === token
      && ['buffering', 'ready', 'playing', 'paused', 'ended', 'blocked', 'failed'].includes(message.type) ? message.type : null;
  } catch { return null; }
}

export type GlimpseVideoFailure = { kind: 'embedding' | 'unavailable' | 'identity' | 'player' | 'network' | 'timeout' | 'unknown'; code: number | null };
export function parseGlimpseVideoFailure(data: string, reelId: string, token: string): GlimpseVideoFailure | null {
  if (parseGlimpseVideoEvent(data, reelId, token) !== 'failed') return null;
  const message = JSON.parse(data);
  const code = Number.isSafeInteger(message.errorCode) && message.errorCode >= 0 && message.errorCode < 1000 ? message.errorCode : null;
  const kind = code === 101 || code === 150 ? 'embedding' : code === 100 ? 'unavailable' : code === 153 ? 'identity'
    : code === 2 || code === 5 ? 'player' : message.reason === 'network' ? 'network' : message.reason === 'timeout' ? 'timeout' : 'unknown';
  return { kind, code };
}
export function glimpseFailureCopy(failure?: GlimpseVideoFailure): string {
  switch (failure?.kind) {
    case 'embedding': return 'The uploader does not allow this clip to play inside other apps.';
    case 'unavailable': return 'YouTube reports this clip as unavailable. It may be private or removed.';
    case 'identity': return 'YouTube could not verify this embedded player. Please retry.';
    case 'network': return 'The clip could not connect. Please retry when connected.';
    case 'timeout': return 'The clip took too long to load. Please retry.';
    case 'player': return 'YouTube could not play this clip here. Please retry or open it in YouTube.';
    default: return 'This clip could not play here. Please retry or open it in YouTube.';
  }
}
export function glimpseYouTubeUrl(reel: GlimpseReel): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(reel.video.key)) throw new Error('Invalid Glimpse video key');
  return 'https://www.youtube.com/watch?v=' + reel.video.key;
}
export function allowGlimpseNavigation(url: string, videoKey: string): boolean {
  if (url === 'about:blank' || url === GLIMPSE_EMBED_ORIGIN || url === GLIMPSE_EMBED_ORIGIN + '/') return true;
  try {
    const target = new URL(url);
    return target.protocol === 'https:' && target.username === '' && target.password === '' && target.port === ''
      && (target.hostname === 'www.youtube-nocookie.com' || target.hostname === 'www.youtube.com')
      && target.pathname === '/embed/' + videoKey;
  } catch { return false; }
}

export function createGlimpseEmbedHtml(reel: GlimpseReel, token: string, muted: boolean, origin = GLIMPSE_EMBED_ORIGIN) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(reel.video.key)) throw new Error('Invalid Glimpse video key');
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<meta name="referrer" content="strict-origin-when-cross-origin"/>' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https://www.youtube.com https://www.youtube-nocookie.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; style-src \'unsafe-inline\'; connect-src https://www.youtube.com https://www.youtube-nocookie.com"/>' +
    '<style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>' +
    '</head><body><div id="player"></div><script>' +
    'var player=null,stopped=false,timer=null,diagnosticTimer=null;function post(type,errorCode,reason){var data={reelId:' + json(reel.id) + ',token:' + json(token) +
    ',type:type,errorCode:errorCode,reason:reason};try{if(player){data.currentTime=player.getCurrentTime();data.muted=player.isMuted()}}catch(e){}if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else window.parent.postMessage(JSON.stringify(data),' + json(origin) + ')}' +
    'window.orionGlimpseStop=function(){stopped=true;clearTimeout(timer);if(diagnosticTimer!==null)clearInterval(diagnosticTimer);if(player){try{player.pauseVideo();player.destroy()}catch(e){}player=null}};' +
    'window.orionGlimpseMute=function(value){if(player&&!stopped){if(value)player.mute();else player.unMute()}};' +
    'window.addEventListener("message",function(e){var data=e.data;if(e.source===window.parent&&e.origin===' + json(origin) + '&&data&&data.reelId===' + json(reel.id) + '&&data.token===' + json(token) + '&&data.command==="mute")window.orionGlimpseMute(data.muted===true)});' +
    'document.addEventListener("visibilitychange",function(){if(document.hidden)window.orionGlimpseStop()});' +
    'window.addEventListener("pagehide",window.orionGlimpseStop);window.open=function(){return null};' +
    'window.onYouTubeIframeAPIReady=function(){if(stopped)return;try{player=new YT.Player("player",{host:"https://www.youtube-nocookie.com",videoId:' + json(reel.video.key) +
    ',width:"100%",height:"100%",playerVars:{playsinline:1,controls:1,rel:0,fs:0,origin:' + json(origin) +
    ',widget_referrer:' + json(origin + '/') + '},events:{onReady:function(){if(stopped)return;clearTimeout(timer);' +
    (muted ? 'player.mute();' : 'player.unMute();') +
    'post("ready");player.playVideo();' + (GLIMPSE_INTERNAL_PREVIEW ? 'diagnosticTimer=setInterval(function(){if(player&&!stopped&&player.getPlayerState()===1)post("playing")},3000);' : '') + '},onStateChange:function(e){if(stopped)return;if(e.data===1)post("playing");else if(e.data===3)post("buffering");else if(e.data===2)post("paused");else if(e.data===0)post("ended")},' +
    'onError:function(e){if(!stopped){clearTimeout(timer);post("failed",e.data)}},onAutoplayBlocked:function(){if(!stopped)post("blocked")}}})}catch(e){post("failed")}};' +
    'var script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.onerror=function(){if(!stopped)post("failed",null,"network")};document.head.appendChild(script);' +
    'timer=setTimeout(function(){if(!stopped)post("failed",null,"timeout")},25000);</script></body></html>';
}
