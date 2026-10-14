# Orion Feedback infrastructure

This repository contains the deployed backend source/configuration for the existing **orion-feedback** Worker. Mobile uses **https://orion-feedback.okali-orion.workers.dev/v1/feedback**. See [DEPLOYMENT-PLAN.md](./DEPLOYMENT-PLAN.md) for current deployment and qualification evidence. Physical end-to-end delivery has passed: actual Android submissions reached the official inbox, with four distinct accepted IDs, correct report formats and attachments, and no duplicate email after receipt recovery. Gmail verified headers/body/attachment metadata; the recipient inspected the diagnostics ZIP. See test-results/feedback-inbox-verification.json for sanitized evidence. This qualifies Feedback delivery, not the final Mobile release.

## Verification and deployment

Run npm ci --ignore-scripts, npm test, npm run typecheck, and npm run check:deploy from this directory. Wrangler authentication is already established for the intended account. Future deployments must inspect the existing target, secret names and bindings first and use the same Worker. Preserve BREVO_API_KEY and FEEDBACK_HMAC_SECRET exactly; never retrieve their values or run a secret replacement as part of deployment. Keep unrelated Production variables and the existing SQLite migration.

Set WRANGLER_WRITE_LOGS=false and WRANGLER_SEND_METRICS=false for all CLI operations. Do not run an unfiltered tail or print OAuth token output. No real secret belongs in a repository file, fixture, argument or log. Local tests use synthetic credentials and example.invalid addresses and block unexpected outbound network calls.

## Delivery, attachments and privacy

Reports are strictly bounded/validated before mail transport. Only a definite Brevo acceptance creates a recoverable accepted receipt; ambiguous outcomes remain pending and cannot silently resend. Private HMAC capabilities authorize follow-ups. Seven-day receipt expiry exceeds the six-day frozen-submission lifetime. SQLite contains receipt IDs/hashes/state/timestamps and budget counters, not user reports or attachments.

Brevo supports ZIP attachments but rejects the direct diagnostics JSON extension. The optional **orion-diagnostics.zip** contains exactly **orion-diagnostics.json**, with the same validated JSON bytes and a fixed safe name. The optional screenshot is **screenshot.jpg**, decoded/re-encoded by the native picker and stripped of source metadata. No uploaded file paths, external URLs or arbitrary archive entry names are accepted.

The single operational logger accepts generated Orion IDs, fixed codes and numeric status only. Never pass payloads, feedback, email, images/base64, diagnostics, authentication/session information, raw exceptions or API keys to logging. Persistent Worker observability is disabled. The bounded qualification tail emits the same sanitized metadata and discards raw frames.

Normal budgets are five accepted/ambiguous sends per network/day, 100 globally/day, and six requests/minute. Definite provider rejections refund their own reservation. The user-authorized temporary ten-send qualification allowance was removed before 05:00 Pakistan time on 14 October 2026; neither its code nor its Cloudflare variable remains. No paid plan is enabled; Free-plan quotas are shared with the account and may stop work when exhausted.
