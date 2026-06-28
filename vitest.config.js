import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/renderer/setup.js"],
    include: ["tests/unit/renderer/**/*.test.{js,jsx}"],
    restoreMocks: true,
  },
});
