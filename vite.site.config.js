import { defineConfig } from "vite";
import { resolve } from "node:path";
import seo, { paginas } from "./seo.site.js";

// Página de apresentação (avina.com.br): sai em dist-site/ e é publicada na Cloudflare pela pasta site/.
// O app (app.avina.com.br) é o vite.config.js. Rodar local: npm run dev:site
const raiz = resolve(import.meta.dirname, "sobre");
const publico = resolve(import.meta.dirname, "public");

export default defineConfig({
  root: "sobre",
  base: "/",
  publicDir: "../public", // mesmas imagens e ícones do app
  envDir: "..",
  server: { port: 5174, fs: { allow: [".."] } },
  // cada sobre/<endereço>/index.html vira uma página: avina.com.br ("Para você"), avina.com.br/consultorio/ ("Para profissionais")...
  // sitemap.xml, robots.txt e dados estruturados saem do seo.site.js
  build: {
    outDir: "../dist-site", emptyOutDir: true,
    rollupOptions: { input: paginas(raiz) },
  },
  plugins: [seo({ publico })],
});
