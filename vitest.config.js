import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Default "/" works for Render, Netlify, Vercel, local preview.
  // GitHub Pages sets VITE_BASE=/9x9-success-grid/ in its workflow.
  base: process.env.VITE_BASE ?? "/",

  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false
  },

  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Success Grid",
        short_name: "Grid",
        description: "A 9×9 grid goal tracker. Turn any goal into a plan.",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html"
      },
      devOptions: { enabled: false }
    })
  ]
});