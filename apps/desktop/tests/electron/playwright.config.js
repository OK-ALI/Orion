const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "*.spec.js",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure" },
});
