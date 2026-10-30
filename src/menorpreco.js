// Onde está mais barato perto de você: os preços das notas fiscais do Paraná (Menor Preço, da Nota Paraná).
// É a mesma fonte do app oficial: cada compra com nota vira preço, quase na hora. Grátis e sem cadastro.
// Só existe no Paraná, e não é uma API documentada: se mudar ou cair, o app simplesmente não mostra os preços.
import { palavras, nomeLoja } from "./nota.js";
import { acharMarca } from "./marcas.js";

const API = "https://menorpreco.notaparana.pr.gov.br/api/v1/produtos";
// o Paraná num retângulo (sobra um pouco de SP e SC na borda: lá a busca só volta vazia)
export const noParana = (lat, lon) => lat <= -22.4 && lat >= -26.8 && lon >= -54.7 && lon <= -48.0;

// A API pede o lugar em geohash (um código que vai afinando a cada letra; 9 letras ≈ 5 metros)
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function geohash(lat, lon, n = 9) {
  let la = [-90, 90], lo = [-180, 180], s = "", bit = 0, ch = 0, par = true;
  while (s.length < n) {
    const r = par ? lo : la, v = par ? lon : lat, meio = (r[0] + r[1]) / 2;
    if (v >= meio) { ch = (ch << 1) | 1; r[0] = meio; } else { ch <<= 1; r[1] = meio; }
    par = !par;
    if (++bit === 5) { s += B32[ch]; bit = 0; ch = 0; }
  }
  return s;
}

/* ---------- o produto certo e o preço por kg/litro ---------- */
const sem = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const raiz = w => (w.length > 4 ? w.replace(/(oes|aes|ais|eis|res|ns|s)$/, "") : w.replace(/s$/, ""));
const parece = (a, b) => { const x = raiz(a), y = raiz(b); return x === y || (y.length >= 3 && x.startsWith(y)) || (x.length >= 3 && y.startsWith(x)); };

// "leite condensado" bate com "LEITE COND MOCA 395G", mas não com "BOMBOM DE LEITE CONDENSADO" nem "SEDA ... ARROZ":
// a 1ª palavra procurada tem que ser a 1ª do produto (é assim que as notas escrevem: o tipo vem antes da marca)
// Palavras que fazem do "leite" outro produto (leite condensado, fermentado, em pó…): só valem se você escreveu
const OUTRO = ["cond", "condensado", "ferm", "fermentado", "po", "creme", "achocolatado", "bebida", "doce", "pudim", "bombom", "biscoito", "bolacha", "iogurte", "sorvete", "picole", "bolo", "molho", "tempero", "refresco", "sabor", "recheado", "chips", "farinha", "flocos"];
export function mesmoProduto(item, desc) {
  const q = palavras(item), d = palavras(desc);
  if (!q.length || !d.length || !parece(d[0], q[0])) return false;
  if (d.slice(1).some(x => OUTRO.includes(x) && !q.some(w => parece(x, w)))) return false;
  return q.slice(1).every(w => d.some(x => parece(x, w)));
}

// Tamanho escrito no nome: "395G" → 0,395 kg; "2 L" → 2 l; "LEITE 1L C/12" → 12 l; "C12" (papel) → 12 un
export function medida(desc) {
  const t = sem(desc).replace(/(\d),(\d)/g, "$1.$2");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gr|grs|l|lt|lts|litros?|ml)\b/);
  const pc = t.match(/\b(?:c|cx|lv|leve|com|c\/|pct|fd|pack)\s*\/?\s*(\d{1,3})\b/) || t.match(/\b(\d{1,3})\s*(?:un|und|unid|unidades|rolos|latas|garrafas)\b/);
  const n = pc ? Number(pc[1]) : 1;
  if (m) {
    const v = Number(m[1]), u = m[2];
    if (!(v > 0)) return null;
    const qtd = /^(g|gr|grs)$/.test(u) ? v / 1000 : u === "ml" ? v / 1000 : v;
    return { qtd: qtd * (n > 1 && n <= 48 ? n : 1), un: /^(kg|kgs|g|gr|grs)$/.test(u) ? "kg" : "l" };
  }
  return n > 1 ? { qtd: n, un: "un" } : null;
}

// Nome da loja como as pessoas falam ("CONDOR SUPER CENTER LIMITADA" → "Condor")
const lojaDe = e => {
  const nome = String((e && (e.nm_fan || e.nm_emp)) || "").replace(/\blimitada\b/gi, "").trim();
  const m = acharMarca(nome);
  return m ? m.nome : nomeLoja(nome).slice(0, 40);
};

const mediana = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Da lista que a API devolve: só o produto certo, dos últimos 15 dias, o mais recente de cada loja,
// e os 3 mais baratos (por kg/litro quando a maioria tem o tamanho no nome).
// Num mercado só (umaLoja): as 3 opções mais baratas dele (marcas e tamanhos diferentes), em vez de uma por rede.
export function melhores(item, produtos, agora = Date.now(), { dias = 15, umaLoja = false } = {}) {
  const vistos = {};
  (produtos || []).forEach(p => {
    const valor = Number(p.valor), quando = Date.parse(p.datahora);
    if (!(valor > 0) || !mesmoProduto(item, p.desc) || !(agora - quando < dias * 864e5)) return;
    const k = `${p.estabelecimento && p.estabelecimento.codigo}|${sem(p.desc)}`;
    if (!vistos[k] || vistos[k].quando < quando) vistos[k] = { valor, quando, desc: p.desc, loja: lojaDe(p.estabelecimento), bairro: (p.estabelecimento && p.estabelecimento.bairro) || "", dist: Number(p.distkm) || null, codigo: p.estabelecimento && p.estabelecimento.codigo, med: medida(p.desc) };
  });
  let xs = Object.values(vistos);
  if (!xs.length) return [];
  // Com tamanho no nome (2KG, 395G, C12), compara por kg, litro ou unidade: arroz de 1 kg e de 5 kg ficam comparáveis.
  // E fica só com quem tem tamanho: o "ARROZ ADICIONAL" do restaurante não é o arroz do mercado.
  const uns = {}; xs.forEach(x => { if (x.med) uns[x.med.un] = (uns[x.med.un] || 0) + 1; });
  const un = Object.keys(uns).sort((a, b) => uns[b] - uns[a])[0];
  if (un && uns[un] >= 2) xs = xs.filter(x => x.med && x.med.un === un).map(x => ({ ...x, unit: x.valor / x.med.qtd, un }));
  const preco = x => x.unit || x.valor;
  const md = mediana(xs.map(preco));
  xs = xs.filter(x => preco(x) >= md * 0.4) // preço baixo demais costuma ser outro produto (ou erro na nota)
    .sort((a, b) => preco(a) - preco(b) || (a.dist || 99) - (b.dist || 99));
  // uma linha por rede (três filiais do mesmo mercado não ajudam): fica a mais barata, e a mais perto no empate
  if (umaLoja) return xs.slice(0, 3);
  const redes = new Set();
  return xs.filter(x => { const k = sem(x.loja); if (redes.has(k)) return false; redes.add(k); return true; }).slice(0, 3);
}

/* ---------- busca (guardada no aparelho por 6 horas) ---------- */
const K = "agenda-precos", VALE = 6 * 3600e3;
const lerCache = () => { try { return JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) { return {}; } };
function guardar(chave, r) {
  try {
    const c = lerCache(); c[chave] = { t: Date.now(), r };
    const ks = Object.keys(c); if (ks.length > 150) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - 150).forEach(k => delete c[k]);
    localStorage.setItem(K, JSON.stringify(c));
  } catch (e) {}
}
// a chave lembra também o raio e o mercado escolhidos (preço "perto, 5 km" não serve para "só no Condor")
const chaveDe = (item, gh, raio = 5, estab = "") => `${gh.slice(0, 6)}|${raio}|${estab}|${sem(item)}`;
export const precoGuardado = (item, gh, raio, estab) => { const c = lerCache()[chaveDe(item, gh, raio, estab)]; return c && Date.now() - c.t < VALE ? c.r : null; };

const espera = ms => new Promise(r => setTimeout(r, ms));
// O site recusa muitas buscas de uma vez (e a recusa chega como "falha de rede"): uma tentativa a mais, com calma
async function pegar(url) {
  for (let i = 0; i < 2; i++) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12000);
    try { const r = await fetch(url, { signal: ctrl.signal }); if (r.ok) return await r.json(); } catch (e) {} finally { clearTimeout(t); }
    if (i === 0) await espera(1500);
  }
  return null;
}

// Os 3 lugares mais baratos para um item, a até "raio" km (a API vai até uns 20 km: a cidade toda).
// Primeiro as notas mais recentes; se vier pouco do produto certo, também as mais baratas.
// Com "estab" (o código de um mercado), só os preços daquele mercado, dos últimos 30 dias (num mercado só há menos notas).
export async function buscarPrecos(item, gh, raio = 5, estab = "") {
  const termo = palavras(item).join(" ") || sem(item);
  if (!termo) return [];
  const salvo = precoGuardado(item, gh, raio, estab);
  if (salvo) return salvo;
  const url = ordem => `${API}?local=${gh}&termo=${encodeURIComponent(termo)}&offset=0&raio=${raio}&data=-1&ordem=${ordem}${estab ? `&estab=${encodeURIComponent(estab)}` : ""}`;
  const opc = estab ? { dias: 30, umaLoja: true } : {};
  const recentes = await pegar(url(2));
  let produtos = (recentes && recentes.produtos) || [];
  let r = melhores(item, produtos, Date.now(), opc);
  if (r.length < 2) {
    const baratos = await pegar(url(0));
    if (!recentes && !baratos) throw new Error("fora");
    produtos = produtos.concat((baratos && baratos.produtos) || []);
    r = melhores(item, produtos, Date.now(), opc);
  }
  guardar(chaveDe(item, gh, raio, estab), r);
  return r;
}

// Os mercados da região, para a pessoa escolher um: procura alguns itens da lista e o básico (arroz, feijão…),
// dos mais perto e dos mais recentes, e fica com as lojas que vendem pelo menos 2 deles
// (assim saem o restaurante do "arroz à grega" e a loja de pesca do "chumbo arroz"). Guardado por 1 dia.
const BASICOS = ["arroz", "feijao", "leite", "cafe", "acucar", "oleo"];
// quem vende leite e café mas não é onde se faz a compra da semana
const NAO_MERCADO = /farm[aá]cia|drogari|droga ?raia|posto|combust[ií]ve|restaurante|lanchonete|pizzari|churrascari|hotel|choperia|cafeteria/i;
export async function buscarMercados(gh, raio, itens = [], aoAchar) {
  const chave = `${K}-lojas:${gh.slice(0, 6)}|${raio}`;
  try { const c = JSON.parse(localStorage.getItem(chave) || "null"); if (c && Date.now() - c.t < 864e5 && c.r.length) return c.r; } catch (e) {}
  const termos = [...new Set([...itens.map(t => palavras(t)[0]).filter(w => w && w.length >= 3).slice(0, 3), ...BASICOS])].slice(0, 7);
  const lojas = {};
  const lista = () => Object.values(lojas).filter(x => x.achou.size >= 2).map(({ achou, ...x }) => ({ ...x, n: achou.size }))
    .sort((a, b) => b.n - a.n || (a.dist ?? 99) - (b.dist ?? 99));
  let respostas = 0;
  for (const termo of termos) for (const ordem of [1, 2]) {
    const j = await pegar(`${API}?local=${gh}&termo=${encodeURIComponent(termo)}&offset=0&raio=${raio}&data=-1&ordem=${ordem}`);
    if (j) respostas++;
    ((j && j.produtos) || []).forEach(p => {
      const e = p.estabelecimento; if (!e || !e.codigo || !mesmoProduto(termo, p.desc) || NAO_MERCADO.test(`${e.nm_fan || ""} ${e.nm_emp || ""}`)) return;
      const d = Number(p.distkm);
      const c = lojas[e.codigo] || (lojas[e.codigo] = { codigo: e.codigo, loja: lojaDe(e), bairro: e.bairro || "", mun: e.mun || "", dist: null, achou: new Set() });
      c.achou.add(termo); if (d >= 0 && (c.dist == null || d < c.dist)) c.dist = d;
    });
    if (aoAchar) aoAchar(lista());
    await espera(200);
  }
  if (!respostas) throw new Error("fora");
  const r = lista().slice(0, 60);
  try { localStorage.setItem(chave, JSON.stringify({ t: Date.now(), r })); } catch (e) {}
  return r;
}

// A loja que mais aparece como a mais barata na lista toda (vale a pena ir só nela?)
export function melhorLoja(resultados) {
  const conta = {};
  Object.values(resultados).forEach(r => {
    if (!r || !r.length) return;
    const base = r[0].unit || r[0].valor;
    // conta por rede (as filiais do mesmo mercado somam juntas)
    const lojas = new Set();
    r.forEach(x => { const k = sem(x.loja); if ((x.unit || x.valor) <= base * 1.05 && !lojas.has(k)) { lojas.add(k); const c = conta[k] || (conta[k] = { loja: x.loja, bairro: x.bairro, dist: x.dist, n: 0 }); c.n++; if (x.dist != null && (c.dist == null || x.dist < c.dist)) c.dist = x.dist; } });
  });
  const lista = Object.values(conta).sort((a, b) => b.n - a.n || (a.dist || 99) - (b.dist || 99));
  return lista[0] && lista[0].n >= 2 ? lista[0] : null;
}
