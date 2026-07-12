import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (bukan generateSW default) — dibutuhkan supaya bisa
      // pakai service worker custom (src/sw.js) dengan push/notificationclick
      // handler sendiri untuk notifikasi budget. Plugin cuma menyuntik
      // precache manifest ke dalamnya, sisanya kode kita.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "FinePro",
        short_name: "FinePro",
        description: "Aplikasi catatan keuangan pribadi untuk mencatat, melacak, dan merapikan arus uang harian.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f6f5f2",
        theme_color: "#0f1f3d",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      injectManifest: {
        // jsPDF (+ html2canvas/purify) di-lazy-load lewat dynamic import
        // hanya saat tombol Export PDF ditekan — jangan ikut di-precache
        // saat install SW, supaya tetap benar-benar "on demand", bukan
        // diam-diam diunduh semua orang di background (~780KB gzip kalau
        // ikut precache, vs 146KB kalau tidak).
        globIgnores: ["**/jspdf*.js", "**/html2canvas*.js", "**/purify*.js"]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true
      },
      "/uploads": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
