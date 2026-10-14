import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
export default defineConfig({plugins:[cloudflareTest({wrangler:{configPath:'./wrangler.jsonc'},miniflare:{bindings:{BREVO_API_KEY:'test-placeholder-not-a-key',FEEDBACK_HMAC_SECRET:'test-only-public-fixture-key',BREVO_SENDER_EMAIL:'orion@example.invalid',BREVO_SENDER_NAME:'Orion Feedback Fixture',FEEDBACK_RECIPIENT:'inbox@example.invalid'}}})],test:{include:['tests/*.test.ts']}});
