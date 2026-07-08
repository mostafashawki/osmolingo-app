import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "osmolingo-icon.svg", "notification-tone.wav"],
      manifest: {
        name: "Osmolingo",
        short_name: "Osmolingo",
        description: "Local-first AI language practice with notifications, correction, history, and bookmarks.",
        theme_color: "#315f72",
        background_color: "#f7f4ef",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/osmolingo-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      devOptions: {
        enabled: true
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wav}"]
      }
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: {},
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
