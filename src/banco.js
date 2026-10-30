/* =========================================================
   Conectar o banco (Open Finance pela Pluggy)
   A pessoa autoriza no app do próprio banco; o servidor (servidor-avisos/src/banco.js)
   guarda a chave da Pluggy e entrega os lançamentos, que entram pela mesma conferência
   do "Importar extrato" (o que já está no app vem desmarcado).
   ========================================================= */
import { servidorAvisos } from "./App.jsx";
import { cliente, NUVEM } from "./nuvem.js";

async function pedir(rota, corpo = {}) {
  if (!NUVEM) throw new Error("Entre na sua conta para conectar o banco.");
  const { data } = await (await cliente()).auth.getSession();
  if (!data.session) throw new Error("Entre na sua conta para conectar o banco.");
  const r = await fetch(`${servidorAvisos()}/banco/${rota}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "O servidor não respondeu. Tente de novo.");
  return j;
}

// { ligado, bancos }: ligado = false quando ainda não está aberto para esta conta (ou sem internet)
export const estadoBanco = () => pedir("estado").catch(() => ({ ligado: false, bancos: [] }));
export const lancamentosBanco = dias => pedir("lancamentos", { dias });

// Saldos de agora (contas, cartões, investimentos). Fica 15 minutos guardado no aparelho para não pedir
// ao banco a cada tela; quem não tem a opção liberada só pergunta de novo no dia seguinte.
const K_RESUMO = "avina-banco-resumo";
export function resumoGuardado() { try { return JSON.parse(localStorage.getItem(K_RESUMO) || "null"); } catch (e) { return null; } }
export async function resumoBanco(forcar) {
  const g = resumoGuardado();
  const validade = g && g.dados && g.dados.ligado ? 15 * 60e3 : 24 * 3600e3;
  if (!forcar && g && Date.now() - g.em < validade) return g.dados;
  if (!NUVEM) return { ligado: false };
  const dados = await pedir("resumo").catch(e => (g && g.dados && g.dados.ligado ? { ...g.dados, erro: e.message } : { ligado: false }));
  if (!dados.erro) try { localStorage.setItem(K_RESUMO, JSON.stringify({ em: Date.now(), dados })); } catch (e) {}
  return dados;
}
export const esquecerResumo = () => { try { localStorage.removeItem(K_RESUMO); } catch (e) {} };
export const desligarBanco = itemId => pedir("desligar", { itemId });

// Abre a janela da Pluggy (escolher o banco e autorizar). itemId = reconectar um banco que pediu autorização de novo.
// Devolve o banco conectado, ou null se a pessoa fechou.
export async function conectarBanco({ itemId, escuro, teste } = {}) {
  const [{ token }, { PluggyConnect }] = await Promise.all([pedir("token", itemId ? { itemId } : {}), import("pluggy-connect-sdk")]);
  return new Promise((ok, falhou) => {
    let feito = false;
    const pc = new PluggyConnect({
      connectToken: token, updateItem: itemId, includeSandbox: !!teste, language: "pt", theme: escuro ? "dark" : "light", countries: ["BR"],
      onSuccess: async ({ item }) => { feito = true; try { ok((await pedir("guardar", { itemId: item.id })).banco); } catch (e) { falhou(e); } },
      // erro no banco: a própria janela mostra e deixa tentar de novo; fechando, conta como desistência
      onClose: () => { if (!feito) ok(null); },
    });
    pc.init().catch(() => falhou(new Error("Não consegui abrir a janela do banco.")));
  });
}
