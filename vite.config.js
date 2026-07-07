import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isDist = process.env.ELECTRON_DIST === "1";
  return {
    plugins: [react()],
    base: "./",
    build: {
      // A development build can occur while Electron still references the
      // previous hashed lazy chunks. Keep them until Orion is restarted.
      // Distribution builds stay clean and never package stale assets.
      emptyOutDir: isDist,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: isDist,
          drop_debugger: isDist,
        },
        // Preserve ES6 class semantics so Three.js classes aren't
        // transpiled into plain functions (which breaks R3F).
        keep_classnames: true,
        keep_fnames: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            three: ["three", "@react-three/fiber"],
          },
        },
      },
    },
  };
});
