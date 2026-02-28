import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@kuzu/kuzu-wasm"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@kuzu/kuzu-wasm": path.resolve(
        __dirname,
        "node_modules/@kuzu/kuzu-wasm/dist/kuzu-browser.js",
      ),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
