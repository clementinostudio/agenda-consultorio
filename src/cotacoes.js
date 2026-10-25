import { useEffect, useState } from "react";

/* =========================================================
   Cotações e índices (gratuitos, sem cadastro)
   - Câmbio: AwesomeAPI (economia.awesomeapi.com.br). Reserva: Frankfurter (cotações do Banco Central Europeu).
   - CDI, Selic e IPCA: API de dados abertos do Banco Central (api.bcb.gov.br).
     Se o navegador não puder consultar direto, passa pelo servidor de avisos (rota /indices).
   Tudo fica guardado no aparelho: sem internet, o app usa os últimos valores buscados.
   Se nunca buscou, usa os valores de referência abaixo (marcados como aproximados).
   ========================================================= */

export const IOF_CARTAO = 3.5; // % sobre compras internacionais no cartão (crédito, débito e pré-pago) desde jul/2025

export const MOEDAS = {
  USD: { nome: "Dólar americano", curto: "Dólar", bandeira: "🇺🇸" },
  EUR: { nome: "Euro", curto: "Euro", bandeira: "🇪🇺" },
  GBP: { nome: "Libra esterlina", curto: "Libra", bandeira: "🇬🇧" },
  ARS: { nome: "Peso argentino", curto: "Peso arg.", bandeira: "🇦🇷" },
  CLP: { nome: "Peso chileno", curto: "Peso chil.", bandeira: "🇨🇱" },
  UYU: { nome: "Peso uruguaio", curto: "Peso uru.", bandeira: "🇺🇾" },
  MXN: { nome: "Peso mexicano", curto: "Peso mex.", bandeira: "🇲🇽" },
  CAD: { nome: "Dólar canadense", curto: "Dólar can.", bandeira: "🇨🇦" },
  AUD: { nome: "Dólar australiano", curto: "Dólar aus.", bandeira: "🇦🇺" },
  JPY: { nome: "Iene", curto: "Iene", bandeira: "🇯🇵" },
  CHF: { nome: "Franco suíço", curto: "Franco", bandeira: "🇨🇭" },
  CNY: { nome: "Yuan", curto: "Yuan", bandeira: "🇨🇳" },
};
export const CODIGOS = Object.keys(MOEDAS);

// Valores de referência (out/2026), só para quando o app nunca conseguiu buscar
const REFERENCIA = {
  moedas: { USD: 5.05, EUR: 5.86, GBP: 6.75, ARS: 0.0036, CLP: 0.0054, UYU: 0.125, MXN: 0.27, CAD: 3.62, AUD: 3.28, JPY: 0.034, CHF: 6.3, CNY: 0.71 },
  cdi: 13.65, selic: 13.75, ipca: 4.58,
  quandoMoedas: null, quandoIndices: null, aprox: true,
};

const CHAVE = "agenda-cotacoes";
let SERVIDOR = "";
export const definirServidor = url => { SERVIDOR = String(url || "").replace(/\/+$/, ""); };

let cache = null;
export function lerCotacoes() {
  if (cache) return cache;
  try { const s = JSON.parse(localStorage.getItem(CHAVE) || "null"); if (s && s.moedas) cache = { ...REFERENCIA, ...s, moedas: { ...REFERENCIA.moedas, ...s.moedas } }; } catch (e) {}
  return cache || REFERENCIA;
}
function guardar(c) {
  cache = c;
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch (e) {}
  try { window.dispatchEvent(new Event("cotacoes")); } catch (e) {}
}

const comTempo = (url, ms = 8000) => {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
};

async function buscarMoedas() {
  // 1) AwesomeAPI: cotação comercial (compra) de cada moeda em reais
  try {
    const pares = CODIGOS.map(c => `${c}-BRL`).join(",");
    const j = await (await comTempo(`https://economia.awesomeapi.com.br/json/last/${pares}`)).json();
    const out = {};
    CODIGOS.forEach(c => { const x = j[`${c}BRL`]; if (x && Number(x.bid) > 0) out[c] = Number(x.bid); });
    if (out.USD) return { moedas: out, fonte: "AwesomeAPI" };
  } catch (e) {}
  // 2) Frankfurter (Banco Central Europeu): vem "quanto vale 1 real" em cada moeda; aqui inverte
  for (const base of ["https://api.frankfurter.dev/v1", "https://api.frankfurter.app"]) {
    try {
      const j = await (await comTempo(`${base}/latest?from=BRL`)).json();
      const out = {};
      CODIGOS.forEach(c => { const r = j.rates && j.rates[c]; if (r > 0) out[c] = 1 / r; });
      if (out.USD) return { moedas: out, fonte: "Frankfurter (BCE)" };
    } catch (e) {}
  }
  return null;
}

const SERIES = { cdi: 4389, selic: 432, ipca: 13522 }; // CDI anualizado, meta Selic, IPCA acumulado em 12 meses
async function buscarIndices() {
  // 1) direto no Banco Central
  try {
    const vals = await Promise.all(Object.values(SERIES).map(async n => {
      const j = await (await comTempo(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${n}/dados/ultimos/1?formato=json`)).json();
      return Number(String(j[0].valor).replace(",", "."));
    }));
    if (vals.every(v => v > 0)) return { cdi: vals[0], selic: vals[1], ipca: vals[2], fonteIndices: "Banco Central" };
  } catch (e) {}
  // 2) pelo servidor de avisos (quando o navegador não pode consultar o Banco Central direto)
  if (SERVIDOR) {
    try {
      const j = await (await comTempo(`${SERVIDOR}/indices`)).json();
      if (j && j.cdi > 0 && j.ipca > 0) return { cdi: j.cdi, selic: j.selic, ipca: j.ipca, fonteIndices: "Banco Central" };
    } catch (e) {}
  }
  return null;
}

const SEIS_HORAS = 6 * 3600 * 1000;
let emAndamento = null;
export function atualizarCotacoes(forcar = false) {
  if (emAndamento) return emAndamento;
  const c = lerCotacoes(); const agora = Date.now();
  const precisaMoedas = forcar || !c.quandoMoedas || agora - c.quandoMoedas > SEIS_HORAS;
  const precisaIndices = forcar || !c.quandoIndices || agora - c.quandoIndices > 4 * SEIS_HORAS;
  if (!precisaMoedas && !precisaIndices) return Promise.resolve(c);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(c);
  emAndamento = (async () => {
    const [m, i] = await Promise.all([precisaMoedas ? buscarMoedas() : null, precisaIndices ? buscarIndices() : null]);
    let novo = { ...lerCotacoes() };
    if (m) novo = { ...novo, moedas: { ...novo.moedas, ...m.moedas }, quandoMoedas: Date.now(), fonte: m.fonte };
    if (i) novo = { ...novo, ...i, quandoIndices: Date.now() };
    if (m || i) { novo.aprox = !(novo.quandoMoedas && novo.quandoIndices); guardar(novo); }
    return novo;
  })().finally(() => { emAndamento = null; });
  return emAndamento;
}

// Hook: devolve as cotações e atualiza a tela quando chegam valores novos
export function useCotacoes() {
  const [c, setC] = useState(lerCotacoes);
  useEffect(() => {
    const f = () => setC(lerCotacoes());
    window.addEventListener("cotacoes", f);
    atualizarCotacoes().catch(() => {});
    return () => window.removeEventListener("cotacoes", f);
  }, []);
  return c;
}

// Conversões e formatos
export const cotacaoDe = (moeda, c = lerCotacoes()) => (moeda === "BRL" ? 1 : c.moedas[moeda] || 0);
export const emReais = (valor, moeda, iof = false, cot = null) => {
  if (!moeda || moeda === "BRL") return valor;
  const taxa = cot || cotacaoDe(moeda);
  return Math.round(valor * taxa * (iof ? 1 + IOF_CARTAO / 100 : 1) * 100) / 100;
};
export const fmtMoeda = (v, moeda) => {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda, maximumFractionDigits: moeda === "JPY" || moeda === "CLP" ? 0 : 2 }).format(v || 0); }
  catch (e) { return `${moeda} ${(v || 0).toFixed(2)}`; }
};
export const fmtTaxa = v => {
  const casas = v < 0.1 ? 4 : v < 1 ? 3 : 2;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
};
export const fmtPct = (v, casas = 2) => `${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const quandoTxt = ts => {
  if (!ts) return "valor de referência";
  const d = new Date(ts), hoje = new Date();
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toDateString() === hoje.toDateString() ? `hoje, ${hh}` : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}, ${hh}`;
};

// Fala: reconhece a moeda ("20 dólares", "us$ 20", "€ 15", "30 euros"...) e o valor ao lado dela
const PALAVRAS = [
  ["CAD", /dolar(?:es)? canadense(?:s)?|cad\b/], ["AUD", /dolar(?:es)? australiano(?:s)?|aud\b/],
  ["USD", /us\$|u\$|usd\b|dolar(?:es)?\b|doletas?\b/], ["EUR", /€|eur\b|euros?\b/], ["GBP", /£|gbp\b|libras?\b/],
  ["ARS", /pesos? argentinos?|ars\b/], ["CLP", /pesos? chilenos?|clp\b/], ["UYU", /pesos? uruguaios?|uyu\b/], ["MXN", /pesos? mexicanos?|mxn\b/],
  ["JPY", /ienes?\b|yens?\b|jpy\b/], ["CHF", /francos?(?: suicos?)?\b|chf\b/], ["CNY", /yuans?\b|iuanes?\b|cny\b/],
];
export function moedaNaFala(t, viagem) {
  for (const [cod, re] of PALAVRAS) {
    const m = t.match(re); if (!m) continue;
    const i = m.index, fim = i + m[0].length;
    // número logo antes ("20 dolares", "20,50 euros") ou logo depois ("us$ 20", "€15")
    const antes = t.slice(Math.max(0, i - 16), i).match(/(\d[\d\.]*(?:,\d{1,2})?)\s*$/);
    const depois = t.slice(fim, fim + 16).match(/^\s*(\d[\d\.]*(?:,\d{1,2})?)/);
    const n = (antes && antes[1]) || (depois && depois[1]);
    if (!n) continue; // só vale com número junto ("Bar do Franco" não é franco suíço)
    return { moeda: cod, valor: Number(n.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) };
  }
  // "pesos" sozinho, ou nenhuma moeda dita: em viagem, vale a moeda da viagem (a menos que fale "reais")
  if (viagem && viagem.moeda) {
    if (/\b(reais|real|rs)\b/.test(t)) return null;
    if (/\bpesos?\b/.test(t) && !/^(ARS|CLP|UYU|MXN)$/.test(viagem.moeda)) return null;
    return { moeda: viagem.moeda, valor: 0 };
  }
  const p = t.match(/(\d[\d\.]*(?:,\d{1,2})?)\s*pesos?\b/);
  if (p) return { moeda: "ARS", valor: Number(p[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) };
  return null;
}
