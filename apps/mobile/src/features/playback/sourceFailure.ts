import type { CinemaSourceFailureCode } from '../../services/sourceHealth';

/** Maps native/WebView errors into bounded, user-safe source health codes. */
export function classifyCinemaSourceFailure(message: string, options: {
  online?: boolean;
  superseded?: boolean;
  shieldFailure?: boolean;
  subtitleFailure?: boolean;
} = {}): CinemaSourceFailureCode {
  const normalized = String(message || '').toLowerCase();
  // ERR_ABORTED is harmless only when the caller proves a newer source
  // navigation superseded it. Otherwise it is a genuine provider failure.
  if (options.superseded) return 'user-cancelled';
  if (options.online === false || /network|offline|internet|timed out/.test(normalized)) return 'offline';
  if (options.shieldFailure || /blocked.*(dependency|request)|manifest/.test(normalized)) return 'blocked-dependency';
  if (options.subtitleFailure || /subtitle|caption/.test(normalized)) return 'subtitle-failure';
  if (/renderer.*(gone|terminated)|render process/.test(normalized)) return 'renderer-termination';
  if (/http\s*[45]\d\d|status\s*[45]\d\d/.test(normalized)) return 'http-failure';
  if (/reject|embed|unavailable|not found/.test(normalized)) return 'provider-rejection';
  if (/navigation|redirect|origin/.test(normalized)) return 'unexpected-navigation';
  if (/timeout|preparing|start/.test(normalized)) return 'startup-timeout';
  return 'unknown';
}
