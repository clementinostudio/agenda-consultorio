/* =========================================================
   Posto mais barato perto: o preço do litro em cada posto, de graça.
   - No Paraná: as notas fiscais de agora (Menor Preço, da Nota Paraná). Cada abastecimento com nota vira
     preço em minutos, com a distância até você.
   - Fora do Paraná: a pesquisa semanal da ANP, posto por posto, na sua cidade (cerca de 460 cidades).
     A planilha passa pelo servidor (o site da ANP não deixa o navegador baixar direto) e quem lê é o aparelho.
   Este arquivo não usa nada da tela: o app do celular usa o mesmo.
   ========================================================= */
import { pegar, geohash, noParana } from "./menorpreco.js";
import { lerZip, linhasDaPlanilha, xmlTexto, chaveNome } from "./transporte.js";

export const COMBS = [
  { id: "gasolina", nome: "Gasolina" },
  { id: "aditivada", nome: "Aditivada" },
  { id: "etanol", nome: "Etanol" },
  { id: "diesel", nome: "Diesel S10" },
  { id: "gnv", nome: "GNV" },
];
export const combNome = id => (COMBS.find(c => c.id === id) || COMBS[0]).nome;
// o combustível de cada veículo (o flex começa na gasolina; a tela troca para o etanol quando ele compensa)
export const combDoVeiculo = v => ({ etanol: "etanol", diesel: "diesel", gnv: "gnv" })[v && v.combustivel] || "gasolina";

/* ---------- Paraná: notas fiscais de agora ---------- */
const sem = s => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ADITIVADA = /ADIT|GRID|V.?POWER|DT CLEAN|IPIMAX|PODIUM|PREMIUM|SUPRA|EVOLUX|OCTAPRO|ACTIVE/;
// O que cada nota vendeu (as descrições variam de posto para posto: "GASOLINA C COMUM", "ETANOL HIDRATADO"...)
export function tipoDaNota(desc, cdanp) {
  if (!cdanp || cdanp === "0") return null; // sem código da ANP não é combustível (aditivo de frasco, óleo de motor)
  const d = sem(desc);
  if (/OLEO LUBR|LUBRIFICANTE|ARLA|\bFRASCO\b|\bML\b/.test(d)) return null;
  if (/DIESEL/.test(d)) return /S\s?-?10\b/.test(d) && !ADITIVADA.test(d) ? "diesel" : null;
  if (/\bGNV\b|GAS NATURAL/.test(d)) return "gnv";
  if (/GASOLINA/.test(d)) return ADITIVADA.test(d) ? "aditivada" : "gasolina";
  if (/ETANOL|ALCOOL/.test(d)) return ADITIVADA.test(d) ? null : "etanol";
  return null;
}
const TERMO = { gasolina: "gasolina", aditivada: "gasolina aditivada", etanol: "etanol", diesel: "diesel s10", gnv: "gnv" };
const FAIXA = { gnv: [2, 10] }; // preço que faz sentido (fora disso é erro de digitação na nota)
const plausivel = (comb, v) => { const [a, b] = FAIXA[comb] || [2.5, 12]; return v >= a && v <= b; };

// "B. BRANCA - PETROBAND COMERCIO DE COMBUSTIVEIS LTDA" → "Petroband"
const TIRAR = /\b(LTDA|EIRELI|ME|EPP|S\/?A|COMERCIO|COM|DE|DO|DA|DERIVADOS|PETROLEO|COMBUSTIVEIS?|LUBRIFICANTES|E|AUTO ?POSTO|POSTO|SERVICOS?|SERV|REVENDEDORA?)\b/g;
const titulo = s => String(s || "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());
export function nomePosto(fantasia, razao) {
  const f = sem(fantasia).replace(/^B\.? ?BRANCA ?-? ?/, "").trim();
  if (f && !/^\d+$/.test(f)) return titulo(f).slice(0, 40);
  const r = sem(razao).replace(/^B\.? ?BRANCA ?-? ?/, "").replace(TIRAR, " ").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const n = titulo(r || razao).slice(0, 40);
  return !n ? "Posto" : /^\d/.test(n) ? `Posto ${n}` : n; // "AUTO POSTO 5300 LTDA" → "Posto 5300"
}

// geohash → lat/lon (o Menor Preço manda o lugar de cada posto assim)
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function deGeohash(gh) {
  let par = true; const lat = [-90, 90], lon = [-180, 180];
  for (const ch of String(gh || "")) {
    const n = B32.indexOf(ch); if (n < 0) return null;
    for (let b = 4; b >= 0; b--) { const r = par ? lon : lat; const bit = (n >> b) & 1; r[bit ? 0 : 1] = (r[0] + r[1]) / 2; par = !par; }
  }
  return { lat: (lat[0] + lat[1]) / 2, lon: (lon[0] + lon[1]) / 2 };
}

const mediana = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const K = "agenda-postos", VALE_PR = 20 * 60e3; // notas de agora: guardado por 20 minutos
const lerK = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const gravarK = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// Os postos a até "raio" km com o preço mais recente de cada um (notas dos últimos 3 dias), do mais barato ao mais caro
export async function postosPR(lat, lon, raio, comb) {
  const gh = geohash(lat, lon), chave = `${K}-pr:${gh.slice(0, 6)}|${raio}|${comb}`;
  const salvo = lerK(chave); if (salvo && Date.now() - salvo.t < VALE_PR) return salvo.r;
  const url = ordem => `https://menorpreco.notaparana.pr.gov.br/api/v1/produtos?local=${gh}&termo=${encodeURIComponent(TERMO[comb])}&offset=0&raio=${raio}&data=-1&ordem=${ordem}`;
  // os mais recentes, os mais baratos e os mais perto (um de cada vez: o site recusa buscas juntas)
  const respostas = [];
  for (const ordem of [2, 0, 1]) respostas.push(await pegar(url(ordem)));
  if (respostas.every(r => !r)) throw new Error("fora");
  const limite = Date.now() - 3 * 864e5, porPosto = {};
  respostas.forEach(r => ((r && r.produtos) || []).forEach(p => {
    const e = p.estabelecimento, v = Number(p.valor), t = Date.parse(p.datahora);
    if (!e || !e.codigo || tipoDaNota(p.desc, p.cdanp) !== comb || !plausivel(comb, v) || !(t > limite)) return;
    const atual = porPosto[e.codigo];
    if (atual && atual.t >= t) return;
    const lugar = deGeohash(p.local);
    porPosto[e.codigo] = {
      id: e.codigo, nome: nomePosto(e.nm_fan, e.nm_emp), preco: v, t, dist: p.distkm != null ? Number(p.distkm) : null,
      endereco: [titulo(`${e.tp_logr || ""} ${e.nm_logr || ""}`.trim()), e.nr_logr].filter(Boolean).join(", "),
      bairro: titulo(e.bairro), cidade: titulo(e.mun), uf: e.uf || "PR", lat: lugar && lugar.lat, lon: lugar && lugar.lon, fonte: "nota",
    };
  }));
  // nota com preço muito abaixo dos outros é erro de digitação (ou desconto de funcionário): fica de fora
  const tipico = mediana(Object.values(porPosto).map(p => p.preco)), noMesmoLugar = new Set();
  const r = Object.values(porPosto).filter(p => p.preco >= tipico * .75).sort((a, b) => a.preco - b.preco || (a.dist ?? 99) - (b.dist ?? 99))
    // dois caixas do mesmo posto (CNPJs diferentes, mesmo endereço) viram um só, o mais barato
    .filter(p => { const k = sem(p.endereco); if (k && noMesmoLugar.has(k)) return false; noMesmoLugar.add(k); return true; });
  gravarK(chave, { t: Date.now(), r });
  return r;
}

/* ---------- Fora do Paraná: pesquisa semanal da ANP, posto por posto ---------- */
const K_ANP = `${K}-anp`; // { uf, cidade, em, ini, fim, postos: [...] } só da cidade da pessoa
const PROD_ANP = { "GASOLINA COMUM": "gasolina", "GASOLINA ADITIVADA": "aditivada", "ETANOL": "etanol", "ETANOL HIDRATADO": "etanol", "DIESEL S10": "diesel", "OLEO DIESEL S10": "diesel", "GNV": "gnv" };
const dataExcel = n => new Date(Date.UTC(1899, 11, 30) + Number(n) * 864e5).toISOString().slice(0, 10);
const BANDEIRA = { RAIZEN: "Shell", VIBRA: "Petrobras", "VIBRA ENERGIA": "Petrobras", IPIRANGA: "Ipiranga", ALE: "Ale", "ALESAT": "Ale", BRANCA: "" };

// planilha "revendas" da ANP → os postos de uma cidade, com o preço de cada combustível
export async function lerPostosANP(buf, uf, cidade) {
  const arq = await lerZip(buf, ["xl/sharedStrings.xml", "xl/worksheets/"]);
  const comuns = [...(arq["xl/sharedStrings.xml"] || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlTexto([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(x => x[1]).join("")));
  const xml = Object.keys(arq).filter(k => k.startsWith("xl/worksheets/")).map(k => arq[k]).join("");
  const U = chaveNome(uf), C = chaveNome(cidade);
  // a planilha tem o Brasil todo (uns 20 mil preços): só lê as linhas que citam a cidade
  const daCidade = new Set(comuns.map((s, i) => chaveNome(s) === C ? String(i) : null).filter(Boolean));
  const cab = [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)];
  const iCab = cab.findIndex(r => /<v>/.test(r[1]) && linhasDaPlanilha(r[0], comuns).some(l => Object.values(l).some(v => /^PRODUTO$/i.test(v))));
  if (iCab < 0) throw new Error("planilha");
  const h = linhasDaPlanilha(cab[iCab][0], comuns)[0];
  const col = re => Object.keys(h).find(k => re.test(chaveNome(h[k])));
  if (!col(/^CNPJ$/) || !col(/^PRECO/)) throw new Error("planilha"); // não é a planilha posto por posto
  const c = { cnpj: col(/^CNPJ$/), razao: col(/^RAZAO/), fant: col(/^FANTASIA/), end: col(/^ENDERECO/), num: col(/^NUMERO/), bairro: col(/^BAIRRO/), cep: col(/^CEP/), mun: col(/^MUNICIPIO/), uf: col(/^ESTADO/), band: col(/^BANDEIRA/), prod: col(/^PRODUTO/), preco: col(/^PRECO/), data: col(/^DATA/) };
  const postos = {};
  let menor = null, maior = null;
  cab.slice(iCab + 1).forEach(r => {
    if (![...r[1].matchAll(/<v>(\d+)<\/v>/g)].some(m => daCidade.has(m[1]))) return;
    const l = linhasDaPlanilha(r[0], comuns)[0];
    if (chaveNome(l[c.mun]) !== C || (U && chaveNome(l[c.uf]) !== U)) return;
    const prod = PROD_ANP[chaveNome(l[c.prod])], preco = Number(l[c.preco]);
    if (!prod || !(preco > 0)) return;
    const id = String(l[c.cnpj] || "") + (l[c.end] || "");
    const p = postos[id] || (postos[id] = {
      id, nome: nomePosto(l[c.fant], l[c.razao]), bandeira: BANDEIRA[chaveNome(l[c.band])] ?? titulo(l[c.band]),
      endereco: [titulo(l[c.end]), l[c.num]].filter(Boolean).join(", "), bairro: titulo(l[c.bairro]), cidade: titulo(l[c.mun]),
      cep: String(l[c.cep] || "").padStart(8, "0"), precos: {}, fonte: "anp",
    });
    p.precos[prod] = preco;
    const d = l[c.data] ? dataExcel(l[c.data]) : null;
    if (d) { if (!menor || d < menor) menor = d; if (!maior || d > maior) maior = d; }
  });
  return { uf: U, cidade: C, ini: menor, fim: maior, postos: Object.values(postos) };
}
// Busca (no máximo a cada 3 dias por cidade) e devolve os postos daquele combustível, do mais barato ao mais caro
export async function postosANP(servidor, uf, cidade, comb, forcar) {
  const U = chaveNome(uf), C = chaveNome(cidade);
  let d = lerK(K_ANP);
  if (forcar || !d || d.uf !== U || d.cidade !== C || Date.now() - d.em > 3 * 864e5) {
    try {
      if (!servidor) throw new Error("sem-servidor");
      const r = await fetch(`${servidor}/anp?postos=1`); if (!r.ok) throw new Error("HTTP " + r.status);
      d = { ...(await lerPostosANP(await r.arrayBuffer(), uf, cidade)), em: Date.now() };
      gravarK(K_ANP, d);
    } catch (e) { if (!d || d.uf !== U || d.cidade !== C) throw e; d = { ...d, velho: true }; }
  }
  const lista = d.postos.filter(p => p.precos[comb]).map(p => ({ ...p, preco: p.precos[comb] })).sort((a, b) => a.preco - b.preco);
  return { ...d, lista };
}

// Onde fica cada posto da ANP (a planilha só traz o CEP): o ponto de cada CEP (AwesomeAPI, grátis e sem chave).
// Guardado para sempre (CEP não muda de lugar); 4 pedidos por vez, e "aoAvancar" redesenha a lista enquanto chega.
const K_CEP = `${K}-cep`;
export const pontoDoCep = cep => { const c = lerK(K_CEP) || {}; return c[cep] || null; };
export async function localizarCeps(ceps, aoAvancar, max = 150) {
  const c = lerK(K_CEP) || {};
  const falta = [...new Set(ceps.filter(x => x && !(x in c)))].slice(0, max);
  let i = 0, feitos = 0;
  const um = async () => {
    while (i < falta.length) {
      const cep = falta[i++];
      try {
        const r = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
        if (r.ok) { const j = await r.json(); c[cep] = j.lat ? [Number(j.lat), Number(j.lng)] : 0; }
        else if (r.status === 404 || r.status === 400) c[cep] = 0;
      } catch (e) {}
      if (++feitos % 8 === 0) { gravarK(K_CEP, c); if (aoAvancar) aoAvancar(feitos, falta.length); }
    }
  };
  await Promise.all([um(), um(), um(), um()]);
  gravarK(K_CEP, c);
  if (aoAvancar) aoAvancar(feitos, falta.length);
  return c;
}
// distância em km entre dois pontos (fórmula de haversine)
export function distancia(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Põe a distância (e o ponto no mapa) em cada posto da ANP cujo CEP já foi localizado
export function comDistancia(lista, local) {
  const c = lerK(K_CEP) || {};
  return lista.map(p => { const pt = c[p.cep]; return pt ? { ...p, lat: pt[0], lon: pt[1], dist: local ? distancia(local, { lat: pt[0], lon: pt[1] }) : null } : p; });
}

/* ---------- onde a pessoa está ---------- */
// Cidade e estado a partir do GPS (BigDataCloud, grátis e sem chave, feito para chamar do aparelho)
export async function cidadeDoLugar(lat, lon) {
  const k = `${K}-cidade:${lat.toFixed(2)},${lon.toFixed(2)}`, salvo = lerK(k);
  if (salvo) return salvo;
  const r = await fetch(`https://api-bdc.io/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`);
  const j = await r.json();
  // o município é o nível 8 ("city" às vezes vem como "Região Metropolitana de São Paulo")
  const mun = ((j.localityInfo && j.localityInfo.administrative) || []).find(a => a.adminLevel === 8);
  const out = { cidade: (mun && mun.name) || j.locality || j.city || "", uf: j.principalSubdivision || "" };
  if (out.cidade) gravarK(k, out);
  return out;
}
export { noParana };

/* ---------- contas ---------- */
// O mais barato, o preço típico da região e quanto se economiza num tanque
export function resumoPostos(lista, litros = 40) {
  if (!lista || !lista.length) return null;
  const menor = lista[0], tipico = mediana(lista.map(p => p.preco)), maior = lista[lista.length - 1].preco;
  return { menor, tipico, maior, economia: Math.max(0, (tipico - menor.preco) * litros), litros };
}
// Vale ir até lá? A economia no tanque menos o combustível gasto na ida e na volta
export function valeIr(posto, precoAqui, litros, consumo) {
  if (!(posto && posto.dist > 0 && precoAqui > posto.preco && consumo > 0)) return null;
  const economia = (precoAqui - posto.preco) * litros, gastoIda = posto.dist * 2 / consumo * posto.preco;
  return { economia, gastoIda, sobra: economia - gastoIda, vale: economia - gastoIda > 1 };
}
// Link para abrir no mapa do aparelho (com o ponto exato quando há; senão, pelo endereço)
export function linkMapa(p, apple) {
  const q = encodeURIComponent([p.nome, p.endereco, p.bairro, p.cidade].filter(Boolean).join(", "));
  if (p.fonte === "anp") p = { ...p, lat: null }; // o ponto do CEP é aproximado: melhor o endereço
  if (apple) return p.lat ? `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${encodeURIComponent(p.nome)}` : `https://maps.apple.com/?q=${q}`;
  return p.lat ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
// "há 27 min", "há 3 h", "ontem"
export function haQuanto(t, agora = Date.now()) {
  const m = Math.max(0, Math.round((agora - t) / 60e3));
  if (m < 60) return m <= 1 ? "agora" : `há ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? "ontem" : `há ${d} dias`;
}
