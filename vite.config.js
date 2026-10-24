import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE_PATH: no GitHub Pages o app fica em /nome-do-repositorio/ (o workflow já preenche isso).
// Na Vercel, Netlify ou rodando local, fica "/".
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate", // atualiza sozinho quando você publica uma versão nova
      includeAssets: ["icons/favicon.svg", "icons/apple-touch-icon.png", "fundos/*.jpg"],
      manifest: {
        name: "Agenda do Consultório",
        short_name: "Agenda",
        description: "Sua agenda, seus pagamentos e suas contas num lugar só.",
        lang: "pt-BR",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0A0C11",
        theme_color: "#0A0C11",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Segurar o ícone do app no Android mostra estes atalhos
        shortcuts: [
          { name: "Anotar gasto falando", short_name: "Gasto", url: "./#gasto", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Só o agora", short_name: "Agora", url: "./#agora", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Fechar o dia", short_name: "Fechar", url: "./#fechar", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Guarda o app para abrir offline (só as fontes .woff2 dos alfabetos latinos, para ficar leve)
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
        globIgnores: ["**/*-cyrillic*", "**/*-greek*", "**/*-vietnamese*"],
        navigateFallback: "index.html",
        importScripts: ["sw-extra.js"], // abre o app ao tocar numa notificação
        runtimeCaching: [
          { // Clima (Open-Meteo): tenta a internet, usa o último resultado se estiver offline
            urlPattern: /^https:\/\/(api|geocoding-api)\.open-meteo\.com\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "clima", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 6 }, networkTimeoutSeconds: 6 },
          },
          { // Feriados (BrasilAPI): mudam pouco
            urlPattern: /^https:\/\/brasilapi\.com\.br\/api\/feriados\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "feriados", expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
