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
import "./modais.css"; // modais: topo e botão à vista, sem rolar de lado
import App from "./App.jsx";
import AvisosSistema, { avisarNovaVersao } from "./avisos.jsx";

// Quem não está logado e abriu pelo navegador vê primeiro a página de apresentação (avina.com.br, publicada à parte: veja site/).
// Quem já está logado, ou abriu pelo app instalado, vai direto para o app.
// Os links da apresentação usam #entrar ou #criar para entrar no app sem voltar para ela (#demo, dos links antigos, abre o criar conta).
const BASE = import.meta.env.BASE_URL;
const SITE = import.meta.env.VITE_SITE_URL || "https://avina.com.br/";
let logado = false;
try { logado = !!JSON.parse(localStorage.getItem("agenda-sessao") || "null"); } catch (e) {}
const instalado = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
// Convite para a casa (#casa=...): guarda o convite; sem login, abre a tela de entrar e ele é usado depois
const convite = location.hash.startsWith("#casa=") ? location.hash.slice(6) : "";
if (convite) { try { localStorage.setItem("agenda-convite-casa", JSON.stringify(convite)); } catch (e) {} }
// Convite para ajudar numa loja (#loja=...): do mesmo jeito
const conviteLoja = location.hash.startsWith("#loja=") ? location.hash.slice(6) : "";
if (conviteLoja) { try { localStorage.setItem("agenda-convite-loja", JSON.stringify(conviteLoja)); } catch (e) {} }
const vemDaApresentacao = ["#entrar", "#criar", "#demo"].includes(location.hash) || !!convite || !!conviteLoja;
// Links dos e-mails da conta (confirmar cadastro, criar senha nova) também abrem direto no app
const vemDoEmail = /access_token=|error_description=|type=recovery/.test(location.hash);

// Logo depois de publicar uma versão nova, uma tela que abre sob demanda pode procurar um arquivo da versão
// antiga, que já não existe: recarrega sozinho para pegar a nova (no máximo uma vez a cada 30 segundos).
window.addEventListener("vite:preloadError", e => {
  try {
    const ultima = Number(sessionStorage.getItem("avina-recarregou") || 0);
    if (Date.now() - ultima < 30000) return;
    sessionStorage.setItem("avina-recarregou", String(Date.now()));
  } catch (x) {}
  e.preventDefault();
  location.reload();
});

// Se alguma tela quebrar, mostra um aviso com "Recarregar" em vez de deixar tudo em branco.
// Fica fora do App: o aviso de versão nova (AvisosSistema) continua aparecendo, e é ele que traz a correção.
class Protecao extends React.Component {
  constructor(p) { super(p); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro) { console.error("O app quebrou:", erro); }
  render() {
    if (!this.state.erro) return this.props.children;
    // com versão nova esperando, atualizar(true) troca para ela e recarrega; senão, só recarrega
    const recarregar = () => { try { this.props.atualizar && this.props.atualizar(true); } catch (e) {} setTimeout(() => location.reload(), 1500); };
    const msg = String((this.state.erro && this.state.erro.message) || "").slice(0, 120);
    return (
      <div role="alert" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif", background: "#F4F5F8", color: "#14161C" }}>
        <b style={{ fontSize: 22 }}>Algo deu errado nesta tela</b>
        <span style={{ maxWidth: 340, color: "#5E6575" }}>Seus dados estão guardados. Toque em recarregar: se tiver uma versão nova do app, ela já entra junto.</span>
        {msg && <small style={{ maxWidth: 340, color: "#8A90A0", fontSize: 12, wordBreak: "break-word" }}>Detalhe: {msg}</small>}
        <button onClick={recarregar} style={{ height: 52, padding: "0 28px", border: 0, borderRadius: 16, background: "#2B46FF", color: "#fff", fontWeight: 800, fontSize: 16 }}>Recarregar</button>
        <a href={`https://wa.me/5543988208714?text=${encodeURIComponent(`Oi! O Avina mostrou "Algo deu errado": ${msg}`)}`} target="_blank" rel="noopener" style={{ color: "#2B46FF", fontWeight: 700 }}>Avisar a gente no WhatsApp</a>
      </div>
    );
  }
}

if (!logado && !instalado && !vemDaApresentacao && !vemDoEmail) {
  location.replace(SITE);
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
      <Protecao atualizar={atualizar}><App /></Protecao>
      <AvisosSistema />
    </React.StrictMode>
  );
}
