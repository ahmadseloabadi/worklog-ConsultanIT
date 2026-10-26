import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE diisi "/nama-repo/" saat deploy ke GitHub Pages (lihat .github/workflows/deploy.yml).
// Di Vercel dan lokal cukup "/".
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // Port yang sama dengan `next dev` agar draft, template, dan setup lama
    // (IndexedDB/localStorage per-origin) tetap terbaca di localhost.
    port: 3000,
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
