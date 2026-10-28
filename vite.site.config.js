import { defineConfig } from "vite";
import { resolve } from "node:path";

// Página de apresentação (avina.com.br): sai em dist-site/ e é publicada na Cloudflare pela pasta site/.
// O app (app.avina.com.br) é o vite.config.js. Rodar local: npm run dev:site
export default defineConfig({
  root: "sobre",
  base: "/",
  publicDir: "../public", // mesmas imagens e ícones do app
  envDir: "..",
  server: { port: 5174, fs: { allow: [".."] } },
  // duas páginas: avina.com.br ("Para você") e avina.com.br/consultorio/ ("Para profissionais")
  build: {
    outDir: "../dist-site", emptyOutDir: true,
    rollupOptions: { input: { inicio: resolve(import.meta.dirname, "sobre/index.html"), consultorio: resolve(import.meta.dirname, "sobre/consultorio/index.html") } },
  },
});
