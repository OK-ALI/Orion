const SENSITIVE_QUERY = /([?&](?:token|api_key|key|sig|signature|auth|authorization|cookie)=)[^&#\s]+/gi;
const BEARER = /bearer\s+[a-z0-9._~+/=-]+/gi;

export function redactDiagnostic(value) {
  return String(value || "")
    .replace(SENSITIVE_QUERY, "$1[redacted]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(/(cookie|authorization):\s*[^\r\n]+/gi, "$1: [redacted]");
}

export function classifyOrionError(error, context = "application") {
  const message = String(error?.message || error || "Unexpected error");
  const lower = message.toLowerCase();
  let code = "unexpected";
  let title = "Something went wrong";
  let guidance = "Try again. If the problem continues, restart Orion.";
  if (error?.name === "AbortError") { code = "cancelled"; title = "Request cancelled"; guidance = "Start the action again when ready."; }
  else if (/offline|unreachable|network|failed to fetch/.test(lower)) { code = "offline"; title = "Orion cannot reach the service"; guidance = "Check your connection. Orion will retry once when service access returns."; }
  else if (/timeout|timed out/.test(lower)) { code = "timeout"; title = "The service took too long"; guidance = "Retry now or choose another playback source."; }
  else if (/401|403|unauthor|forbidden/.test(lower)) { code = "authentication"; title = "Service authentication failed"; guidance = "Check the related service setting and try again."; }
  else if (/429|rate.?limit/.test(lower)) { code = "rate_limit"; title = "Service is temporarily busy"; guidance = "Wait briefly, then retry."; }
  else if (/404|not found/.test(lower)) { code = "not_found"; title = "This content is unavailable"; guidance = "Try another source or return to the previous page."; }
  const diagnostic = redactDiagnostic(`${context}: ${message}`);
  return { code, title, guidance, diagnostic, recoveryId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` };
}
