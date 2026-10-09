import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: "prompt",
    includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
    manifest: {
      name: "TripSync — วางแผนเที่ยวด้วยกัน",
      short_name: "TripSync", lang: "th", start_url: "/", scope: "/", display: "standalone",
      background_color: "#f6f7fb", theme_color: "#202948",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/auth\/callback/, /^\/api\//],
      runtimeCaching: [], cleanupOutdatedCaches: true,
    },
  })],
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
