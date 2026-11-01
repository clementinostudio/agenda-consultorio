// O Avina dentro do app de celular (pasta app-celular/). O app nativo abre este mesmo site numa tela própria e,
// antes de qualquer código daqui rodar, coloca window.AvinaApp: { plataforma, versao, ponte, chamar(acao, dados) }.
// - chamar() pede algo ao celular (vibrar, avisos, Face ID, abrir uma tela nativa...) e devolve uma Promise.
// - O app nativo também cuida, sozinho, da localização, do Compartilhar, dos PDFs baixados e dos links externos.
// Fora do app (navegador ou PWA instalado), noApp é false e nada disto é usado.
export const noApp = typeof window !== "undefined" && !!window.AvinaApp;
export const appIOS = noApp && window.AvinaApp.plataforma === "ios";
// Ponte 2: o app tem telas nativas (Início, Atividades, chat da Bolinha) e o site fica por trás, como o "motor":
// manda o retrato dos dados (enviarEstado) e atende os pedidos das telas nativas (registrarNativo)
export const nativoV2 = noApp && Number(window.AvinaApp.ponte) >= 2;

export const chamarApp = (acao, dados) => noApp ? window.AvinaApp.chamar(acao, dados) : Promise.reject(new Error("fora-do-app"));

// Apple (regra 5.1.2): antes de mandar algo para uma IA de fora, o app precisa avisar e pedir permissão.
// Vale para a Bolinha (perguntas e fala), leitura de foto de nota e de comprovante. Pede uma vez só.
const K_IA = "avina-ia-permitida";
export async function permitirIA() {
  if (!noApp) return true;
  try { if (localStorage.getItem(K_IA) === "1") return true; } catch (e) {}
  const ok = await chamarApp("confirmar", {
    titulo: "Usar a IA do Avina?",
    texto: "Para entender o que você fala ou fotografa, o Avina manda o áudio, a foto ou a pergunta para a IA da Cloudflare (Workers AI). Ela só lê e devolve a resposta: nada fica guardado lá, nem é usado para treinar a IA.",
    sim: "Permitir",
    nao: "Agora não",
  }).catch(() => false);
  if (ok) try { localStorage.setItem(K_IA, "1"); } catch (e) {}
  return !!ok;
}

/* ---------- Pedidos das telas nativas (ponte 2) ----------
   O app injeta window.__avinaNativo(id, acao, dados); a resposta volta pela mensagem da WebView:
   { resp: id, erro, valor }. Quem atende são as ações registradas por src/App.jsx (registrarNativo).
   Cada registro é uma camada: a mais nova vence (o Painel, com login, por cima do mínimo sem login),
   e a função devolvida tira a camada. */
const CAMADAS_NATIVAS = [];
let avisouPronto = false;
const acaoNativa = nome => {
  for (let i = CAMADAS_NATIVAS.length - 1; i >= 0; i--) { const f = CAMADAS_NATIVAS[i][nome]; if (typeof f === "function") return f; }
  return null;
};
export function registrarNativo(acoes) {
  const camada = { ...acoes };
  CAMADAS_NATIVAS.push(camada);
  // a primeira vez que há quem atenda: o app solta os pedidos que estavam esperando
  if (nativoV2 && !avisouPronto) { avisouPronto = true; chamarApp("nativo:pronto").catch(() => {}); }
  return () => { const i = CAMADAS_NATIVAS.indexOf(camada); if (i >= 0) CAMADAS_NATIVAS.splice(i, 1); };
}
function responder(id, erro, valor) {
  try {
    const rn = window.ReactNativeWebView;
    if (rn) rn.postMessage(JSON.stringify({ resp: id, erro: erro || null, valor: valor === undefined ? null : valor }));
  } catch (e) {
    // a resposta não virou JSON (algo que não dá para mandar): avisa o erro, para o app não ficar esperando
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ resp: id, erro: "resposta-invalida", valor: null })); } catch (e2) {}
  }
}
if (noApp) {
  window.__avinaNativo = async (id, acao, dados) => {
    const f = acaoNativa(acao);
    if (!f) { responder(id, "site-carregando"); return; }
    try { responder(id, null, await f(dados || {})); }
    catch (e) { responder(id, String((e && e.message) || e || "erro")); }
  };
  // Voltar do Android: fecha a camada de cima do site (painel, folha); sem camada, quem decide é o app
  // (ponte 2: volta para as telas nativas; ponte 1: sai do app). O app pode chamar window.__avinaVoltar().
  window.__avinaVoltar = () => {
    if (history.state && history.state.alvenaGuarda) { history.back(); return "camada"; }
    chamarApp(nativoV2 ? "nativo:voltar" : "sair").catch(() => {});
    return nativoV2 ? "nativo" : "sair";
  };
}

/* ---------- O retrato dos dados para as telas nativas ----------
   enviarEstado(retrato) manda chamarApp("estado", retrato) depois de ~400 ms sem mudança, e só quando mudou algo
   (o "em" não conta). retrato pode ser uma função: só é montado quando sai de fato. */
let tEstado = 0, ultimoEstado = "", proximoEstado = null;
export function enviarEstado(retrato) {
  if (!nativoV2) return;
  proximoEstado = retrato;
  clearTimeout(tEstado);
  tEstado = setTimeout(() => {
    try {
      const r = typeof proximoEstado === "function" ? proximoEstado() : proximoEstado;
      proximoEstado = null;
      if (!r) return;
      const chave = JSON.stringify({ ...r, em: 0 });
      if (chave === ultimoEstado) return;
      ultimoEstado = chave;
      chamarApp("estado", r).catch(() => { ultimoEstado = ""; }); // não chegou: manda de novo na próxima mudança
    } catch (e) {}
  }, 400);
}
