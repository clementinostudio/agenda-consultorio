import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE_PATH: o workflow preenche sozinho ("/" com o domínio app.avina.com.br, /nome-do-repositorio/ sem domínio próprio).
// Rodando local, fica "/". A página de apresentação (avina.com.br) tem o build dela: vite.site.config.js.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      // O React fica num arquivo separado: quase nunca muda, então o celular não precisa baixar de novo a cada atualização
      output: { manualChunks: id => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? "react" : undefined) },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // versão nova: o app mostra o aviso "Atualizar" (veja src/avisos.jsx)
      includeAssets: ["icons/favicon.svg", "icons/apple-touch-icon.png", "fundos/*.jpg"],
      manifest: {
        id: "agenda-do-consultorio",
        name: "Avina",
        short_name: "Avina",
        description: "Sua agenda, seus pagamentos e suas contas num lugar só.",
        lang: "pt-BR",
        start_url: ".",
        scope: ".",
        display: "standalone",
        display_override: ["standalone"],
        orientation: "portrait",
        categories: ["productivity", "medical", "finance"],
        prefer_related_applications: false,
        launch_handler: { client_mode: ["focus-existing", "auto"] },
        // Android: o Avina aparece no "Compartilhar" (foto de comprovante, código de boleto, texto)
        share_target: {
          action: "./compartilhar", method: "POST", enctype: "multipart/form-data",
          params: { title: "title", text: "text", url: "url", files: [{ name: "arquivo", accept: ["image/*"] }] },
        },
        // Fotos que o Android mostra na janela de instalar (fica com cara de loja de apps)
        screenshots: [
          { src: "screenshots/inicio.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Início: o que importa hoje" },
          { src: "screenshots/agenda.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Agenda do dia" },
          { src: "screenshots/pessoal.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Gastos e contas da casa" },
          { src: "screenshots/computador.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "No computador" },
        ],
        background_color: "#070B1A",
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
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,woff2}"],
        globIgnores: ["**/*-cyrillic*", "**/*-greek*", "**/*-vietnamese*", "**/splash/**", "**/screenshots/**", "**/landing/**"],
        navigateFallback: "index.html",
        importScripts: ["sw-extra.js"], // abre o app ao tocar numa notificação
        runtimeCaching: [
          { // Leitor de código de barras (boleto): baixa só quando usado e fica guardado para funcionar offline
            urlPattern: /\.wasm$/i,
            handler: "CacheFirst",
            options: { cacheName: "leitor-boleto", expiration: { maxEntries: 3 } },
          },
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
          { // Logos das empresas (Uber, iFood...): guarda no aparelho, depois aparecem até sem internet
            urlPattern: /^https:\/\/((www\.google\.com\/s2\/favicons|t3\.gstatic\.com\/faviconV2)|[^/]+\/apple-touch-icon\.png$)/i,
            handler: "CacheFirst",
            options: { cacheName: "logos", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
