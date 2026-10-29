// Quem é a empresa de um CNPJ: o nome que as pessoas conhecem e o ramo (para escolher a categoria sozinho).
// Fonte: BrasilAPI (dados abertos da Receita, grátis e sem cadastro). Reserva: minhareceita.org (mesmos dados).
// O CNPJ vem da nota (a chave de acesso tem o CNPJ da loja, mesmo quando a Sefaz não deixa ler os itens)
// ou do comprovante lido pela IA. Fica guardado no aparelho: o mesmo CNPJ não é buscado de novo.
import { acharMarca } from "./marcas.js";
import { nomeLoja } from "./nota.js";

const so = s => String(s || "").replace(/\D/g, "");
// CNPJ só com números e letras (desde jul/2026 a Receita também dá CNPJ com letras nas 12 primeiras posições)
export const limparCnpj = s => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

// Confere os dois dígitos verificadores (um CNPJ lido errado pela IA não vira consulta à toa).
// Letra vale o código dela menos 48 (regra da Receita para o CNPJ alfanumérico); número vale ele mesmo.
export function cnpjValido(c) {
  const n = limparCnpj(c);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(n) || /^(\d)\1+$/.test(n)) return false;
  const dv = len => {
    let t = 0, p = len - 7;
    for (let i = 0; i < len; i++) { t += (n.charCodeAt(i) - 48) * p--; if (p < 2) p = 9; }
    const r = t % 11; return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(n[12]) && dv(13) === Number(n[13]);
}

/* ---------- ramo (CNAE) → categoria ----------
   Pelos 4 primeiros números da atividade principal. Só o que dá para dizer com segurança:
   "comércio varejista de outros produtos" (4789) não diz nada, então fica a categoria de sempre. */
const RAMOS = [
  // [começo do CNAE, categoria do Pessoal, categoria da Loja]
  ["4711", "mercado", "insumos"], ["4712", "mercado", "insumos"], ["4722", "mercado", "insumos"], ["4723", "mercado", "insumos"],
  ["4724", "mercado", "insumos"], ["4729", "mercado", "insumos"], ["4691", "mercado", "insumos"], ["463", "mercado", "insumos"],
  ["01", "mercado", "insumos"], ["105", "mercado", "insumos"], ["1061", "mercado", "insumos"], ["1062", "mercado", "insumos"], ["1066", "mercado", "insumos"],
  ["4721", "comida", "insumos"], ["1091", "comida", "insumos"], ["1093", "comida", "insumos"], ["5611", "comida", null], ["5612", "comida", null], ["5620", "comida", null],
  ["4771", "saude", null], ["4773", "saude", null], ["4774", "saude", null], ["86", "saude", null], ["6550", "saude", null], ["9313", "saude", null], ["7500", "saude", null],
  ["4731", "transporte", "entrega"], ["4732", "transporte", "entrega"], ["5223", "transporte", "entrega"], ["4921", "transporte", "entrega"], ["4922", "transporte", "entrega"],
  ["4923", "transporte", "entrega"], ["4929", "transporte", "entrega"], ["5221", "transporte", "entrega"], ["5111", "transporte", null], ["5112", "transporte", null],
  ["4520", "transporte", "manut"], ["4530", "transporte", "manut"], ["4541", "transporte", null], ["4543", "transporte", "manut"], ["5320", "transporte", "entrega"], ["4930", "transporte", "entrega"],
  ["3514", "casa", "contas"], ["3513", "casa", "contas"], ["3600", "casa", "contas"], ["3520", "casa", "contas"], ["4784", "casa", "contas"], ["61", "casa", "contas"],
  ["4744", "casa", "manut"], ["4754", "casa", null], ["4759", "casa", "embalagem"], ["6810", "casa", "aluguel"], ["6821", "casa", "aluguel"], ["6822", "casa", "aluguel"],
  ["8121", "casa", "manut"], ["3314", null, "manut"], ["3321", null, "manut"], ["4321", "casa", "manut"], ["4322", "casa", "manut"], ["4330", "casa", "manut"], ["9521", "casa", "manut"], ["9529", null, "manut"],
  ["5914", "lazer", null], ["9001", "lazer", null], ["9329", "lazer", null], ["9311", "lazer", null], ["9319", "lazer", null], ["7911", "lazer", null], ["7912", "lazer", null],
  ["5510", "lazer", null], ["5590", "lazer", null], ["4761", "lazer", null], ["4762", "lazer", null], ["9102", "lazer", null], ["9103", "lazer", null],
  ["4713", "compras", null], ["4751", "compras", null], ["4752", "compras", null], ["4753", "compras", null], ["4755", "compras", null], ["4756", "compras", null],
  ["4757", "compras", "manut"], ["4763", "compras", null], ["4772", "compras", null], ["4781", "compras", null], ["4782", "compras", null], ["4783", "compras", null],
  ["4686", null, "embalagem"], ["1731", null, "embalagem"], ["1732", null, "embalagem"], ["1733", null, "embalagem"], ["2222", null, "embalagem"], ["4687", null, "embalagem"],
  ["6619", null, "imposto"], ["8291", null, "imposto"],
];
const ramoDe = cnae => { const c = so(cnae); return c ? RAMOS.filter(r => c.startsWith(r[0])).sort((a, b) => b[0].length - a[0].length)[0] || null : null; };
export const catDoCnae = cnae => (ramoDe(cnae) || [])[1] || null;
export const catLojaDoCnae = cnae => (ramoDe(cnae) || [])[2] || null;

// Nome fantasia que não é nome ("MATRIZ", "LOJA 12", só números) não serve
const fantasiaBoa = f => { const t = String(f || "").trim(); return t.length >= 3 && !/^(matriz|filial|loja|unidade|\*+|-+)(\s*\d+)?$/i.test(t) && /[a-z]/i.test(t); };

// Os dados da Receita → o que o app usa
function resumir(j, cnpj) {
  const razao = String(j.razao_social || "").trim(), fantasia = String(j.nome_fantasia || "").trim();
  // marca conhecida (Drogasil, Assaí, Shell…) ganha: nome certo, logo e categoria do app
  const marca = (fantasiaBoa(fantasia) && acharMarca(fantasia)) || acharMarca(razao);
  const nome = marca ? marca.nome : nomeLoja(fantasiaBoa(fantasia) ? fantasia : razao);
  const cnae = so(j.cnae_fiscal);
  return {
    cnpj, nome: nome.slice(0, 60), razao: razao.slice(0, 120), cnae,
    ramo: String(j.cnae_fiscal_descricao || "").trim().slice(0, 120),
    cat: (marca && marca.cat) || catDoCnae(cnae), catLoja: catLojaDoCnae(cnae),
    cidade: String(j.municipio || "").trim(), uf: String(j.uf || "").trim(),
    ativa: !j.descricao_situacao_cadastral || /ativa/i.test(j.descricao_situacao_cadastral),
  };
}

/* ---------- guardado no aparelho ---------- */
const CHAVE = "agenda-cnpj", MAX = 300, VALIDADE = 180 * 864e5;
const lerCache = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { return {}; } };
function guardar(cnpj, info) {
  try {
    const c = lerCache(); c[cnpj] = { ...info, t: Date.now() };
    const ks = Object.keys(c);
    if (ks.length > MAX) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - MAX).forEach(k => delete c[k]);
    localStorage.setItem(CHAVE, JSON.stringify(c));
  } catch (e) {}
}

const comTempo = (url, ms) => { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms); return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t)); };
const andando = {};

// Busca (ou lê do aparelho) quem é o CNPJ. Devolve null quando não acha ou está sem internet: o app segue sem.
export function buscarCnpj(c, ms = 7000) {
  const cnpj = limparCnpj(c);
  if (!cnpjValido(cnpj)) return Promise.resolve(null);
  const salvo = lerCache()[cnpj];
  if (salvo && Date.now() - salvo.t < VALIDADE) return Promise.resolve(salvo);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(salvo || null);
  if (andando[cnpj]) return andando[cnpj];
  andando[cnpj] = (async () => {
    for (const url of [`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, `https://minhareceita.org/${cnpj}`]) {
      try {
        const r = await comTempo(url, ms);
        if (r.status === 404) break; // a Receita não conhece: não adianta perguntar na reserva
        if (!r.ok) continue;
        const j = await r.json();
        if (!j || !(j.razao_social || j.nome_fantasia)) continue;
        const info = resumir(j, cnpj);
        guardar(cnpj, info);
        return info;
      } catch (e) {}
    }
    return salvo || null;
  })().finally(() => { delete andando[cnpj]; });
  return andando[cnpj];
}
