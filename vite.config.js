import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Keuangan Keluarga - Coach Arifin",
        short_name: "Keuangan",
        description: "Aplikasi pencatatan keuangan untuk keluarga & mahasiswa",
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
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.includes("supabase.co"),
            handler: "NetworkOnly"
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
