import { useEffect, useState } from "react";

/* =========================================================
   Inflação mês a mês (IPCA e IGP-M), da API de dados abertos do Banco Central (grátis, sem cadastro).
   Serve para os reajustes: o da sessão ("desde o último reajuste a inflação foi X%") e o do aluguel.
   Fica guardada no aparelho (funciona offline) e é atualizada no máximo uma vez a cada 12 horas:
   os índices saem uma vez por mês.
   ========================================================= */

export const INDICES = {
  ipca: { serie: 433, nome: "IPCA", sobre: "a inflação oficial (IBGE)" },
  igpm: { serie: 189, nome: "IGP-M", sobre: "o índice que muitos contratos de aluguel usam (FGV)" },
};
const CHAVE = "agenda-inflacao";
const DOZE_HORAS = 12 * 3600 * 1000;

let cache = null;
export function lerInflacao() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) {}
  return cache || { ipca: [], igpm: [], quando: null };
}
function guardar(c) {
  cache = c;
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch (e) {}
  try { window.dispatchEvent(new Event("inflacao")); } catch (e) {}
}

// [{ data: "01/09/2026", valor: "0.82" }] → [{ m: "2026-09", v: 0.82 }]
const arrumar = j => (Array.isArray(j) ? j : []).map(x => {
  const d = String(x.data || "").match(/^\d{2}\/(\d{2})\/(\d{4})$/), v = Number(String(x.valor).replace(",", "."));
  return d && Number.isFinite(v) ? { m: `${d[2]}-${d[1]}`, v } : null;
}).filter(Boolean);

const comTempo = (url, ms = 9000) => { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms); return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t)); };

let andando = null;
export function atualizarInflacao(forcar = false) {
  const c = lerInflacao();
  if (andando) return andando;
  if (!forcar && c.quando && Date.now() - c.quando < DOZE_HORAS && c.ipca.length && c.igpm.length) return Promise.resolve(c);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(c);
  // 10 anos de meses: dá para calcular o reajuste de um contrato antigo também
  const inicio = `01/01/${new Date().getFullYear() - 10}`;
  andando = (async () => {
    const res = await Promise.all(Object.values(INDICES).map(async ({ serie }) => {
      try { return arrumar(await (await comTempo(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${inicio}`)).json()); } catch (e) { return []; }
    }));
    const [ipca, igpm] = res;
    if (!ipca.length && !igpm.length) return c;
    const novo = { ipca: ipca.length ? ipca : c.ipca, igpm: igpm.length ? igpm : c.igpm, quando: Date.now() };
    guardar(novo);
    return novo;
  })().finally(() => { andando = null; });
  return andando;
}

// Hook: os índices guardados, e a tela atualiza quando chegam os novos
export function useInflacao() {
  const [c, setC] = useState(lerInflacao);
  useEffect(() => {
    const f = () => setC(lerInflacao());
    window.addEventListener("inflacao", f);
    atualizarInflacao().catch(() => {});
    return () => window.removeEventListener("inflacao", f);
  }, []);
  return c;
}

/* ---------- contas (funções puras) ---------- */
export const mesDe = iso => String(iso || "").slice(0, 7); // "2025-10-20" → "2025-10"
export const nomeMesCurto = m => { const [a, n] = String(m).split("-"); return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(n) - 1]}/${a}`; };

// Inflação acumulada de um mês (incluído) até o último mês publicado (ou até "ate", incluído).
// Ex.: reajustou em out/2025 → soma out/2025 até set/2026 (12 meses), como no aniversário de um contrato.
export function acumulado(serie, desde, ate = null) {
  const de = mesDe(desde) || desde;
  const meses = (serie || []).filter(x => x.m >= de && (!ate || x.m <= ate));
  if (!meses.length) return null;
  const fator = meses.reduce((f, x) => f * (1 + x.v / 100), 1);
  return { pct: Math.round((fator - 1) * 10000) / 100, fator, meses: meses.length, de: meses[0].m, ate: meses[meses.length - 1].m };
}

// Valor novo para combinar com o paciente: arredonda PARA CIMA de 5 em 5 reais (R$ 209,20 → R$ 210),
// de 1 em 1 abaixo de R$ 100. Nunca sugere menos do que já é.
export function valorSugerido(valor, pct) {
  if (!(valor > 0) || !(pct > 0)) return valor;
  const corrigido = valor * (1 + pct / 100), passo = valor >= 100 ? 5 : 1;
  return Math.max(valor, Math.ceil(corrigido / passo - 1e-9) * passo);
}
