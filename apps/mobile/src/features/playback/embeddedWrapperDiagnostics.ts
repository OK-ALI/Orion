import type { CinemaSourceDescriptor } from '@orion/shared/sources';

const TYPE = 'ORION_WRAPPER_DIAGNOSTIC';
const STAGES = [
  'wrapper-document-ready', 'provider-iframe-present', 'provider-iframe-connected',
  'provider-iframe-load-fired', 'provider-iframe-error-fired', 'provider-iframe-removed',
  'provider-iframe-hidden', 'wrapper-security-policy-violation', 'provider-message-observed',
] as const;
const DIRECTIVES = ['frame-src', 'child-src', 'default-src', 'script-src', 'script-src-elem',
  'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr', 'connect-src', 'img-src',
  'media-src', 'font-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors', 'other'];
const BLOCKED_CATEGORIES = ['provider', 'wrapper', 'https-other', 'http-other', 'data', 'blob', 'inline', 'eval', 'other'];
const DISPLAYS = ['none', 'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'contents', 'other'];

interface WrapperOptions {
  sessionId: string;
  sourceId: string;
  expectedOrigins: string[];
  requiresIframeWrapper: boolean;
}

function exactHttpsOrigin(value: unknown): value is string {
  try { return typeof value === 'string' && value.length <= 200 && new URL(value).protocol === 'https:' && new URL(value).origin === value; }
  catch { return false; }
}

/** Inspect only construction metadata at the existing WebView handoff, before native loading. */
export function recordWrapperSourceBuilt(
  sourceId: string,
  expectedOrigins: readonly string[],
  webViewSource: unknown,
  injectedBefore: unknown,
  injectedAfter: unknown,
): void {
  if (!/^[a-z0-9-]{1,40}$/.test(sourceId) || !expectedOrigins.length || !expectedOrigins.every(exactHttpsOrigin)) return;
  try {
    const html = webViewSource && typeof webViewSource === 'object' && 'html' in webViewSource
      && typeof webViewSource.html === 'string' ? webViewSource.html : '';
    // Expected markup count, not a claim that Android parsed or attached the frame.
    const frames = html.match(/<iframe\b[^>]*>/gi) || [];
    let providerOrigin: string | null = expectedOrigins[0];
    const src = frames[0]?.match(/\bsrc\s*=\s*"([^"]*)"/i)?.[1];
    if (src) {
      try {
        const origin = new URL(src.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).origin;
        providerOrigin = expectedOrigins.includes(origin) ? origin : null;
      } catch { providerOrigin = null; }
    }
    const injections = [injectedBefore, injectedAfter].filter((value): value is string => typeof value === 'string');
    console.info('[OrionP102Trace] wrapper', JSON.stringify({
      stage: 'wrapper-source-built', sourceId, hasIframe: frames.length > 0,
      iframeCountExpected: Math.min(100, frames.length), providerOrigin,
      htmlLengthBucket: !html.length ? 'empty' : html.length < 1024 ? 'lt-1k'
        : html.length < 4096 ? '1k-4k' : html.length < 16384 ? '4k-16k' : '16k-plus',
      // These scripts are WebView injections associated with this source, not inline HTML.
      hasDiagnosticScript: injections.some(value => value.includes(TYPE) && value.includes('__orionWrapperDiagnostics')),
      hasAdBlocker: injections.some(value => value.includes('__orionCinemaCleanupInstalled')),
    }));
  } catch {} // Diagnostic inspection must never change loading or expose malformed input.
}

/** Observation only; runs before cosmetic cleanup and is owned by the existing playback bridge. */
export function createWrapperDiagnosticScript(options: WrapperOptions): string {
  if (!options.requiresIframeWrapper || !options.expectedOrigins.length || !options.expectedOrigins.every(exactHttpsOrigin)) return '';
  const config = JSON.stringify({ ...options, stages: STAGES, directives: DIRECTIVES, displays: DISPLAYS });
  return `
    (function() {
      try {
      var config = ${config};
      var existing = window.__orionWrapperDiagnostics;
      if (existing && existing.sessionId === config.sessionId && existing.sourceId === config.sourceId) return true;
      if (existing && typeof existing.stop === 'function') existing.stop();
      var active = true, sequence = 0, frame = null, loadFired = false, frameOrigin = config.expectedOrigins[0];
      var seen = Object.create(null), observer = null, timer = null, deadline = null;
      var mutationCount = 0;
      function originOf(value) {
        try { var url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.origin : null; }
        catch (_) { return null; }
      }
      function finite(value, limit) { return typeof value === 'number' && Number.isFinite(value) ? Math.min(limit, Math.max(0, value)) : 0; }
      function state() {
        var rect = frame && frame.getBoundingClientRect ? frame.getBoundingClientRect() : { width: 0, height: 0 };
        var style = frame ? window.getComputedStyle(frame) : {};
        var hiddenCause = 'none';
        if (frame && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0)) hiddenCause = 'self-style';
        else if (frame && (rect.width <= 0 || rect.height <= 0)) hiddenCause = 'zero-size';
        var ancestor = frame && frame.parentElement;
        for (var depth = 0; ancestor && depth < 16 && hiddenCause === 'none'; depth++, ancestor = ancestor.parentElement) {
          var parentStyle = window.getComputedStyle(ancestor);
          if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.visibility === 'collapse' || Number(parentStyle.opacity) === 0) hiddenCause = 'ancestor-style';
        }
        return {
          providerOrigin: frameOrigin, iframeCount: Math.min(100, document.querySelectorAll('iframe').length),
          documentState: ['loading', 'interactive', 'complete'].indexOf(document.readyState) >= 0 ? document.readyState : 'other',
          srcCategory: !frame ? 'absent' : config.expectedOrigins.indexOf(originOf(frame.src)) >= 0 ? 'provider' : originOf(frame.src) === 'https://orion.local' ? 'wrapper' : 'other',
          isConnected: !!(frame && frame.isConnected), width: finite(rect.width, 10000), height: finite(rect.height, 10000),
          display: config.displays.indexOf(style.display) >= 0 ? style.display : 'other',
          visibility: ['visible', 'hidden', 'collapse'].indexOf(style.visibility) >= 0 ? style.visibility : 'other',
          opacity: frame ? finite(Number(style.opacity), 1) : 0, loadFired: loadFired, hiddenCause: hiddenCause
        };
      }
      function emit(stage, extra) {
        if (!active || sequence >= 64 || !window.ReactNativeWebView) return;
        try {
        var metadata = Object.assign(state(), extra || {});
        var key = stage + JSON.stringify(metadata);
        if (seen[key]) return;
        seen[key] = true;
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
          type: '${TYPE}', schemaVersion: 1, sessionId: config.sessionId, sourceId: config.sourceId,
          sequence: ++sequence, observedAt: Date.now(), stage: stage
        }, metadata)));
        } catch (_) {}
      }
      function onLoad() { loadFired = true; emit('provider-iframe-load-fired'); sample(); }
      function onError() { emit('provider-iframe-error-fired'); }
      function sample() {
        if (!active) return;
        var frames = document.querySelectorAll('iframe');
        var selected = Array.prototype.find.call(frames, function(candidate) { return config.expectedOrigins.indexOf(originOf(candidate.src)) >= 0; });
        if (selected && selected !== frame) {
          if (frame) { frame.removeEventListener('load', onLoad); frame.removeEventListener('error', onError); }
          frame = selected; loadFired = false; frameOrigin = originOf(selected.src);
          frame.addEventListener('load', onLoad); frame.addEventListener('error', onError);
          emit('provider-iframe-present');
        }
        if (frame && frame.isConnected) emit('provider-iframe-connected');
        else if (frame) emit('provider-iframe-removed');
        if (frame && state().hiddenCause !== 'none') emit('provider-iframe-hidden');
      }
      function onReady() { emit('wrapper-document-ready'); sample(); }
      function onMessage(event) {
        if (frame && event.source === frame.contentWindow && config.expectedOrigins.indexOf(event.origin) >= 0
          && event.origin === originOf(frame.src)) emit('provider-message-observed');
      }
      function onPolicy(event) {
        var origin = originOf(event.blockedURI);
        var category = config.expectedOrigins.indexOf(origin) >= 0 ? 'provider' : origin === 'https://orion.local' ? 'wrapper'
          : /^https:/.test(event.blockedURI) ? 'https-other' : /^http:/.test(event.blockedURI) ? 'http-other'
          : /^data:/.test(event.blockedURI) ? 'data' : /^blob:/.test(event.blockedURI) ? 'blob'
          : event.blockedURI === 'inline' ? 'inline' : event.blockedURI === 'eval' ? 'eval' : 'other';
        emit('wrapper-security-policy-violation', {
          blockedDirective: config.directives.indexOf(event.effectiveDirective) >= 0 ? event.effectiveDirective : 'other',
          blockedCategory: category, blockedOrigin: category === 'provider' || category === 'wrapper' ? origin : null
        });
      }
      function stop() {
        active = false;
        if (observer) observer.disconnect();
        clearInterval(timer); clearTimeout(deadline);
        document.removeEventListener('DOMContentLoaded', onReady);
        document.removeEventListener('securitypolicyviolation', onPolicy);
        window.removeEventListener('message', onMessage);
        window.removeEventListener('resize', sample);
        if (frame) { frame.removeEventListener('load', onLoad); frame.removeEventListener('error', onError); }
      }
      window.__orionWrapperDiagnostics = { sessionId: config.sessionId, sourceId: config.sourceId, stop: stop };
      document.addEventListener('securitypolicyviolation', onPolicy);
      window.addEventListener('message', onMessage);
      window.addEventListener('resize', sample);
      if (typeof MutationObserver === 'function') {
        observer = new MutationObserver(function(mutations) {
          if (!active) return;
          mutations.forEach(function(mutation) {
            Array.prototype.forEach.call(mutation.removedNodes || [], function(node) {
              if (frame && (node === frame || (node.contains && node.contains(frame)))) emit('provider-iframe-removed');
            });
          });
          sample();
          if (++mutationCount >= 128) observer.disconnect();
        });
        observer.observe(document, {
          childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style', 'class', 'hidden']
        });
      }
      if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', onReady); sample(); }
      else onReady();
      timer = setInterval(sample, 1000);
      deadline = setTimeout(stop, 30000);
      return true;
      } catch (_) {
        if (window.__orionWrapperDiagnostics && typeof window.__orionWrapperDiagnostics.stop === 'function') window.__orionWrapperDiagnostics.stop();
      }
    })();
    true;
  `;
}

/** Whitelist the diagnostic envelope before writing only safe metadata to the existing P102 lane. */
export function recordWrapperDiagnosticMessage(
  raw: unknown,
  source: CinemaSourceDescriptor | undefined,
  sessionId: string,
  lastSequence: number,
): number | null {
  if (source?.requiresIframeWrapper !== true || !source.expectedOrigins.every(exactHttpsOrigin)) return null;
  let data: any = raw;
  if (typeof raw === 'string') {
    if (raw.length > 4096) return null;
    try { data = JSON.parse(raw); } catch { return null; }
  }
  if (!data || Array.isArray(data) || data.type !== TYPE || data.schemaVersion !== 1
    || data.sourceId !== source.id || data.sessionId !== sessionId || !/^[a-z0-9-]{1,40}$/.test(source.id)
    || !STAGES.includes(data.stage) || !source.expectedOrigins.includes(data.providerOrigin)
    || !Number.isInteger(data.sequence) || data.sequence < 1 || data.sequence <= lastSequence || data.sequence > 64
    || !Number.isFinite(data.observedAt) || Math.abs(Date.now() - data.observedAt) > 15000) return null;
  for (const [value, maximum] of [[data.width, 10000], [data.height, 10000], [data.opacity, 1], [data.iframeCount, 100]]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) return null;
  }
  if (!Number.isInteger(data.iframeCount) || typeof data.isConnected !== 'boolean' || typeof data.loadFired !== 'boolean'
    || !DISPLAYS.includes(data.display) || !['visible', 'hidden', 'collapse', 'other'].includes(data.visibility)
    || !['none', 'self-style', 'ancestor-style', 'zero-size'].includes(data.hiddenCause)
    || !['loading', 'interactive', 'complete', 'other'].includes(data.documentState)
    || !['absent', 'provider', 'wrapper', 'other'].includes(data.srcCategory)) return null;
  const safe: Record<string, unknown> = {
    stage: data.stage, sourceId: source.id, providerOrigin: data.providerOrigin, sequence: data.sequence,
    iframeCount: data.iframeCount, isConnected: data.isConnected, width: data.width, height: data.height,
    display: data.display, visibility: data.visibility, opacity: data.opacity,
    loadFired: data.loadFired, hiddenCause: data.hiddenCause,
    documentState: data.documentState, srcCategory: data.srcCategory,
  };
  if (data.stage === 'wrapper-security-policy-violation') {
    if (!DIRECTIVES.includes(data.blockedDirective) || !BLOCKED_CATEGORIES.includes(data.blockedCategory)) return null;
    const expected = data.blockedCategory === 'provider' ? source.expectedOrigins.includes(data.blockedOrigin)
      : data.blockedCategory === 'wrapper' ? data.blockedOrigin === 'https://orion.local' : data.blockedOrigin === null;
    if (!expected) return null;
    Object.assign(safe, { blockedDirective: data.blockedDirective, blockedCategory: data.blockedCategory, blockedOrigin: data.blockedOrigin });
  }
  console.info('[OrionP102Trace] wrapper', JSON.stringify(safe));
  return data.sequence;
}
