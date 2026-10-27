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
import AvisosSistema, { avisarNovaVersao } from "./avisos.jsx";

// Quem não está logado e abriu pelo navegador vê primeiro a página de apresentação (sobre/).
// Quem já está logado, ou abriu pelo app instalado, vai direto para o app.
// Os links da apresentação usam #entrar, #criar ou #demo para entrar no app sem voltar para ela.
const BASE = import.meta.env.BASE_URL;
let logado = false;
try { logado = !!JSON.parse(localStorage.getItem("agenda-sessao") || "null"); } catch (e) {}
const instalado = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
// Convite para a casa (#casa=...): guarda o convite; sem login, abre a tela de entrar e ele é usado depois
const convite = location.hash.startsWith("#casa=") ? location.hash.slice(6) : "";
if (convite) { try { localStorage.setItem("agenda-convite-casa", JSON.stringify(convite)); } catch (e) {} }
const vemDaApresentacao = ["#entrar", "#criar", "#demo"].includes(location.hash) || !!convite;
// Links dos e-mails da conta (confirmar cadastro, criar senha nova) também abrem direto no app
const vemDoEmail = /access_token=|error_description=|type=recovery/.test(location.hash);

if (!logado && !instalado && !vemDaApresentacao && !vemDoEmail) {
  location.replace(`${BASE}sobre/`);
} else {
  // Service worker do PWA: deixa o app abrir offline. Quando sai uma versão nova, mostra o aviso "Atualizar"
  // (em vez de trocar sozinho no meio do uso). Procura novidades ao abrir, ao voltar para o app e a cada 30 min.
  const atualizar = registerSW({
    immediate: true,
    onNeedRefresh() { avisarNovaVersao(atualizar); },
    onRegisteredSW(url, reg) {
      if (!reg) return;
      const procurar = () => { if (navigator.onLine !== false) reg.update().catch(() => {}); };
      setInterval(procurar, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") procurar(); });
    },
  });
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
      <AvisosSistema />
    </React.StrictMode>
  );
}
