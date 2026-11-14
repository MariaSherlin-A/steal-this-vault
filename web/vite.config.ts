import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The public native REST API sends no CORS headers, so the browser reaches it
 * through a same-origin path: /lcd/* is forwarded to the testnet REST endpoint
 * here in development, and by vercel.json in production.
 */
const proxy = {
  "/lcd": {
    target: "https://api-testnet.qore.host",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/lcd/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  build: {
    target: "es2022",
    sourcemap: false,
    // The attack runner pulls in the whole SDK. It is reached only through a dynamic import (lib/lab.ts),
    // so Rollup keeps it out of the first paint by itself.
    chunkSizeWarningLimit: 3500,
  },
});
