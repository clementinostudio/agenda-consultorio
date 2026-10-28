import { defineConfig } from "vite";

// Página de apresentação (avina.com.br): sai em dist-site/ e é publicada na Cloudflare pela pasta site/.
// O app (app.avina.com.br) é o vite.config.js. Rodar local: npm run dev:site
export default defineConfig({
  root: "sobre",
  base: "/",
  publicDir: "../public", // mesmas imagens e ícones do app
  envDir: "..",
  server: { port: 5174, fs: { allow: [".."] } },
  build: { outDir: "../dist-site", emptyOutDir: true },
});
