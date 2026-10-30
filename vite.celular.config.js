// A cópia do Avina que vai dentro do app de celular (app-celular/): o mesmo app do site, num arquivo HTML só.
// - Endereço base completo (https://app.avina.com.br/): o app abre o HTML como se estivesse nesse endereço, então
//   o login, o servidor de avisos e as imagens da pasta public/ funcionam igual ao site.
// - Tudo num arquivo só (código, estilos, fontes e imagens pequenas): abre até sem internet. Os leitores de código de
//   barras e de PDF (pesados) continuam vindo do site, e só quando alguém usa.
// - Sem service worker: quem guarda e atualiza o Avina no celular é o próprio app.
// Monte com: npm run build:celular   (o scripts/montar-celular.mjs roda este build e junta tudo no HTML)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "https://app.avina.com.br/",
  publicDir: false,
  plugins: [
    react(),
    // o main.jsx importa o registro do service worker do PWA; aqui ele não faz nada
    { name: "sem-service-worker", resolveId: id => (id === "virtual:pwa-register" ? "\0pwa-register" : null), load: id => (id === "\0pwa-register" ? "export const registerSW = () => () => {};" : null) },
  ],
  build: {
    outDir: "dist-celular",
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    // tudo vira texto dentro do HTML, menos os leitores pesados (.wasm e o pdf.worker .mjs) e as fontes que quase
    // nunca aparecem (alfabetos cirílico, grego e vietnamita, e o .woff antigo): essas seguem a regra do site (as
    // pequenas entram, as grandes vêm do site se precisar, com o mesmo nome de arquivo que o site publica)
    assetsInlineLimit: arquivo => (/\.(wasm|mjs|woff)$/i.test(arquivo) || /-(cyrillic|greek|vietnamese)/i.test(arquivo) ? undefined : true),
    rollupOptions: { input: "index.html", output: { codeSplitting: false } },
  },
});
