import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

// Fontes guardadas junto com o app (funcionam sem internet)
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";

import "./styles.css";
import App from "./App.jsx";

// Quem não está logado e abriu pelo navegador vê primeiro a página de apresentação (sobre/).
// Quem já está logado, ou abriu pelo app instalado, vai direto para o app.
// Os links da apresentação usam #entrar, #criar ou #demo para entrar no app sem voltar para ela.
const BASE = import.meta.env.BASE_URL;
let logado = false;
try { logado = !!JSON.parse(localStorage.getItem("agenda-sessao") || "null"); } catch (e) {}
const instalado = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const vemDaApresentacao = ["#entrar", "#criar", "#demo"].includes(location.hash);

if (!logado && !instalado && !vemDaApresentacao) {
  location.replace(`${BASE}sobre/`);
} else {
  // Service worker do PWA: deixa o app abrir offline e atualiza sozinho
  registerSW({ immediate: true });
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
