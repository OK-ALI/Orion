# Existing Orion Feedback Worker — deployment plan, not a deployment

## Official-inbox qualification — 14 October 2026

The real Android → production Worker → Brevo → official.orion.feedback@gmail.com path passed. The explicitly selected official Gmail connection contains exactly four unique qualification emails: Problem, follow-up, feature and general. Structured subjects/bodies, Settings/Annoying fields, original Feedback-ID link and usefulness text match. The Problem has screenshot.jpg (17,991 bytes), orion-diagnostics.zip (467 bytes) and the supplied Reply-To. The recipient opened the ZIP and reported zero events; Gmail does not support ZIP extraction, so no unsupported attachment fetch was attempted. Reports filter recent events to the selected area: after normal Settings navigation, the actual device Included information dialog showed one real Settings event. No artificial event was added; the own unsent preview draft was discarded.

The retry recovered the same Feedback ID without another provider call or duplicate inbox email. History retains four unique receipts across cold restart. Feature/general supplied no reply address or attachments; Brevo adds its verified sender as a default Reply-To and rewrites the free sender address to its brevosend.com domain. Those transport defaults are distinguished from user-supplied reply addresses. The sanitized evidence record contains no diagnostic JSON, raw payloads, credentials or attachment bytes.

Feedback delivery is qualified for phase4ae. AniLink incoming continuity and the final Mobile release gates remain open; this is not a final v4 seal. Earlier pending-inbox statements below are historical and superseded by this qualification.

## Qualification cleanup and presentation checks — 14 October 2026

The final normal-rate Worker deployment is **59b32e72-d13c-4060-8093-d309efdc2523**. The temporary ten-send code and Cloudflare variable were removed before 05:00 Pakistan time. The five/network/day, 100/global/day and six/minute controls are restored. All existing secret names, public sender/recipient values and SQLite namespaces were checked afterward; no secret value was retrieved or replaced. A cleanup-only authoritative variable upload was guarded against unrelated dashboard variables, and the source keep_vars:true policy was restored. Safe endpoint checks return 405/400 without sending mail. Twenty Worker tests and TypeScript pass.

Native Release Notes opened offline and Android Back closed it while Last checked stayed identical. At font scale 1.6, the header, content and close action remained readable without overlap. Samsung TalkBack showed an actual focus indicator and Back returned to Update; speech audio was not recorded. Original accessibility enabled state 0 and the original empty service setting were verified restored. The installed 3.2.1 bundled notes fit the dialog, so these snapshots do not claim overflow scrolling of the longer final 4.0 notes or hardware-tablet qualification.

The Welcome Feedback illustration, report types, IDs/History copy and safe-diagnostics introduction rendered with both network connections disabled, after the existing Orion section and before the Final Chapter. Its product copy promises a final major feature release with maintenance/feedback improvements still possible. The only final actions remained Explore Glimpse and Continue to Orion. Deliberate Continue dismissal persisted across a cold restart in the bounded internal qualification namespace; the real Welcome marker was not modified and the actual final version upgrade remains a later gate. Original font/network/accessibility settings were restored.

**Official-inbox verification passed. Feedback delivery is qualified; AniLink incoming continuity remains an open release gate. No public release or final identity transition is claimed.**


## Current qualification update — 14 October 2026

The existing Production Worker **orion-feedback** is deployed. Its current tested source version is **2476217d-39ba-498e-b6d8-aab23e03c23b**, recorded with runtime-source hashes in test-results/feedback-physical-qualification.json. The existing BREVO_API_KEY was never read, requested or replaced; FEEDBACK_HMAC_SECRET was generated securely only after its absence was verified. SQLite RECEIPTS and BUDGET plus IP_LIMIT were applied through Wrangler. No paid-plan upgrade or additional Worker was created. Workers Free was confirmed by the user; the billing API denied read access, while the live namespace API confirmed SQLite compatibility.

The installed permanently signed **phase4ae** internal APK is 3.2.1 (59), package com.okali.orion, SHA-256 a953c3328e20e7e03ac80e4ef61d2a705fec05eef564e65f53ebb9bfe73307b6. It points to the real Production /v1/feedback endpoint. Data-preserving install and the original signer were verified. It is not a final v4 APK or release checkpoint.

Physical Android sends returned four distinct server IDs: Problem ORN-FB-6BABD5E0133447CD8A2125F6, follow-up ORN-FB-F1C7309B01F842E19D0BF0BC, Feature ORN-FB-B0878E32161E4CB2BC1C5A64, General ORN-FB-2A52F82D63464186AD167F72. All four survived a real cold restart and occur once in native History. The internal first-acknowledgement-loss hook discarded a validated accepted response; Try Again recovered the same Problem ID, and sanitized live events showed no second provider submission. Send another report and a follow-up from the actual History entry were exercised. Earlier offline failure and cold draft/screenshot persistence remain recorded. The user explicitly confirmed removing the earlier failed test draft; its disappearance is not attributed to a persistence regression.

Two live transport defects were repaired: a redirect-handling exception, then Brevo's definite attachment-format rejection. Outgoing requests now use manual redirects, never forwarding the API key to a redirect target. The unchanged diagnostics JSON is carried inside **orion-diagnostics.zip**, containing only **orion-diagnostics.json**; **screenshot.jpg** remains the optional JPEG attachment. ZIP bytes passed an independent .NET reader check. Definite provider rejections return their own daily-budget reservation; accepted or ambiguous requests retain it. Ambiguous pending requests are never automatically resent.

Twenty Worker runtime tests and nineteen Mobile product/privacy tests pass. Operational tracing accepts only generated IDs, fixed allowlisted codes and numeric HTTP status. No report body, user email, screenshot, diagnostic content, authentication information, exception text or secret is logged. Persistent Worker observability and Wrangler disk logging remain disabled.

The user specifically authorized a temporary network allowance of ten sends until **05:00 Pakistan time on 14 October 2026**; it automatically reverts to five afterward. The global 100/day budget and six/minute throttle are unchanged. Remove this temporary qualification variable/code before a final backend checkpoint. Wi-Fi is restored; cellular had no usable connection and is not claimed as qualified.

**Inbox verification is pending. Feedback is not fully qualified.** Provider acceptance does not prove recipient delivery. The separate AniLink incoming-continuity release gate remains open. No final identity transition, seal, tag, merge or publication has occurred. The user authorized a documented data-preserving internal 3.2.1 to 4.0.0 upgrade test because no second device running public 3.2.0 exists; the exact public upgrade must not be claimed as physically tested.

The records below describe earlier qualification phases and their state at that time; this update supersedes their earlier current-state statements.


Prepared 13 October 2026 against the user's current production state. No production upload, secret write, real Feedback submission or live email has been performed by this task.

## Exact target and stored-secret preservation

The sole proposed Worker target is **`orion-feedback`**, using its existing default/Production deployment at `https://orion-feedback.okali-orion.workers.dev`. The native submission route will be **`https://orion-feedback.okali-orion.workers.dev/v1/feedback`**. No separate `orion-mobile-feedback` Worker, staging Worker or temporary preview target is proposed.

The existing encrypted **`BREVO_API_KEY` is preserved**. Its value is neither requested, read nor replaced. No `secret put BREVO_API_KEY`, bulk-secret replacement or secret deletion belongs to this plan. Wrangler preserves existing secrets when deploying; `keep_vars: true` additionally preserves dashboard variables not explicitly supplied by the config. The checked-in public sender/recipient values match the state supplied by the user.

Source: [Wrangler configuration / source of truth](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth).

## Exact proposed configuration and bindings

`wrangler.jsonc` is the reviewable source of truth:

```json
{
  "name": "orion-feedback",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-13",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "preview_urls": false,
  "keep_vars": true,
  "send_metrics": false,
  "observability": { "enabled": false },
  "secrets": { "required": ["BREVO_API_KEY", "FEEDBACK_HMAC_SECRET"] },
  "vars": {
    "DAILY_MAIL_LIMIT": "100",
    "FEEDBACK_RECIPIENT": "official.orion.feedback@gmail.com",
    "BREVO_SENDER_EMAIL": "official.orion.feedback@gmail.com",
    "BREVO_SENDER_NAME": "Orion Feedback"
  },
  "ratelimits": [{
    "name": "IP_LIMIT", "namespace_id": "1001",
    "simple": { "limit": 6, "period": 60 }
  }],
  "durable_objects": { "bindings": [
    { "name": "RECEIPTS", "class_name": "FeedbackReceipt" },
    { "name": "BUDGET", "class_name": "FeedbackBudget" }
  ] },
  "migrations": [{
    "tag": "v1",
    "new_sqlite_classes": ["FeedbackReceipt", "FeedbackBudget"]
  }]
}
```

The schema reference is the installed Wrangler schema; it is omitted from the excerpt above. No route for another domain, cron, Queue, KV, D1, R2, container, email-routing product or paid-plan change is introduced. Sender-name/email and recipient variables feed Brevo directly. Test transport overrides these with synthetic `example.invalid` fixtures and blocks outbound delivery.

## Why two SQLite Durable Object classes are required here

`RECEIPTS` provides a durable receipt per anonymous client/request identity: concurrent duplicate submissions and retries see the same pending/accepted state, and confirmed receipts survive object eviction. It stores an ID, content hash, safe state and time, then deletes them after seven days. It never stores the feedback body, email, screenshot or diagnostic JSON. Ambiguous Brevo outcomes remain pending and are not silently sent again.

`BUDGET` atomically enforces the global daily sending allowance and five mail attempts per network/day across Worker instances. It stores short-lived HMAC keys/counters and does not perform mail I/O. The edge `IP_LIMIT` is an additional abuse guard; it is not a globally consistent quota ledger.

A plain stateless Worker can send an email, but cannot provide these restart-safe duplicate and quota guarantees by keeping state in memory. Durable storage is required for the promised safeguards. This design uses two SQLite namespaces and does not require a separate general database service.

The proposed `v1` migration creates only `FeedbackReceipt` and `FeedbackBudget` as SQLite-backed classes. No existing namespace deletion, transfer, rename or data migration is proposed. Before upload, authenticated inspection must confirm that the placeholder has no conflicting bindings/classes or migration tag. If it does, stop and revise the plan rather than overwrite an existing stateful deployment.

## Free-tier / zero-cost boundary

Cloudflare's current documentation provides SQLite Durable Objects on **Workers Free**. Included limits are 100,000 requests/day, 13,000 GB-s/day, five million row reads/day, 100,000 row writes/day and 5 GB stored data. On Workers Free, exceeding a free quota makes further operations fail; it does not automatically enable paid overage. These are account-wide limits and other account workloads also consume them. [Official Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

The intended ordinary workload is at most 100 mail attempts/day, with bounded 15-second Brevo waits, short receipt records, seven-day receipt cleanup and daily budget cleanup. There are no persistent connections or recurring polling timers. This is comfortably within the documented allowances for ordinary use; abuse can still exhaust quotas and temporarily stop service.

**The account's actual plan has not been independently verified**: local Wrangler is not authenticated. Zero cost is therefore conditional on confirming that this Worker is on Workers Free and sufficient free allowance remains. A paid account has a different billing model; the app's mail cap alone is not a guarantee of zero charges there. No subscription upgrade or paid resource creation is authorized. If Free-plan eligibility or billing state cannot be verified, do not deploy under a zero-cost claim.

## Remaining secure prerequisite

The supplied production state lists `BREVO_API_KEY`, but does not list **`FEEDBACK_HMAC_SECRET`**. This additional secret is needed for private receipt lookup keys, anonymized network keys and follow-up capabilities. Once authenticated, list secret **names only** to see whether it already exists. Preserve it if present. If absent, create a strong random value securely and send it directly to Wrangler's secret-input stream, or use its secure interactive prompt. Never print it, write it to repository/config/fixture/log files, or paste it into chat.

The verified Brevo sender and existing recipient are accepted as the user's current state; this plan does not ask for another Brevo key or sender setup.

From `apps/mobile/feedback-backend`, the relevant commands are:

```powershell
npx wrangler login
npx wrangler whoami --json
npx wrangler deployments list --name orion-feedback --json
npx wrangler secret list
# Only if this secret is absent, through a secure prompt:
npx wrangler secret put FEEDBACK_HMAC_SECRET
npx wrangler deploy --dry-run
# Only after this plan and live account/bindings checks are proven safe:
npx wrangler deploy
```

Do not publish raw account/authentication metadata or enable verbose request logging. Live binding/migration and billing inspection must precede secret creation/deployment. The current task has run only local type generation, tests, dry-run, and a sanitized authentication-status check; the latter confirmed CLI authentication is missing.

## Current APK and physical qualification

The installed **phase4y internal physical APK** has **no Feedback endpoint configured**. It points to neither Production nor a test endpoint. Its `feedbackEndpoint()` returns null and Send honestly retains the draft. No live end-to-end delivery has occurred.

After deployment, a bounded Mobile configuration addition must set `expo.extra.feedbackEndpoint` to the exact production `/v1/feedback` URL. It requires another permanently signed internal APK; package `com.okali.orion`, installed data and signing authority remain unchanged. No version-code strategy change, tag, release, merge or final seal is authorized.

Final Feedback qualification must use the real Android Orion app to submit an explicitly identified test report through this Production Worker and Brevo, and verify that it arrives in **`official.orion.feedback@gmail.com`** with the same Orion Feedback ID and correct content/optional attachments. Brevo acceptance alone is not inbox delivery. Mocked/local tests are not physical end-to-end evidence. Retry/deduplication and follow-up qualification should likewise verify real inbox behavior without sending duplicate reports.

## Local proof so far

- Worker TypeScript passes with regenerated binding types.
- 14 local Worker tests pass with fixture-only credentials and destinations; no real transport.
- Wrangler 4.149.0 dry-run passes and lists the exact two Durable Object bindings, edge rate limit and four variables above.
- 51 focused Mobile presentation/network/config/privacy tests pass.
- Permanent-signer internal phase4y APK is built and installed using `adb -s R5CWC2RYXZF install -r`; installed app data identities were preserved.
- Shared footer and all three severity preview choices passed real device checks. That is presentation evidence, not Feedback delivery qualification.

The Worker has no application log calls and observability is disabled. Nothing in this plan relaxes the secure logging requirement.
