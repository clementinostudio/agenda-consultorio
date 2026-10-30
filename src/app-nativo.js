// O Avina dentro do app de celular (pasta app-celular/). O app nativo abre este mesmo site numa tela própria e,
// antes de qualquer código daqui rodar, coloca window.AvinaApp: { plataforma, versao, ponte, chamar(acao, dados) }.
// - chamar() pede algo ao celular (vibrar, avisos, Face ID, abrir uma tela nativa...) e devolve uma Promise.
// - O app nativo também cuida, sozinho, da localização, do Compartilhar, dos PDFs baixados e dos links externos.
// Fora do app (navegador ou PWA instalado), noApp é false e nada disto é usado.
export const noApp = typeof window !== "undefined" && !!window.AvinaApp;
export const appIOS = noApp && window.AvinaApp.plataforma === "ios";

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
