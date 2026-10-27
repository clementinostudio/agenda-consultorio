/* =========================================================
   Transporte: para onde vai o dinheiro do carro (ou dos apps),
   consumo real, custo por km, troca de óleo e preço do combustível da ANP.
   Os gastos continuam sendo lançamentos da categoria "transporte" (somam em Gastos,
   nos tetos e nas perguntas à Bolinha); aqui eles ganham uma subcategoria.
   ========================================================= */
const semAcento = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const SUBS = [
  { id: "combustivel", nome: "Combustível", cor: "#F59E0B" },
  { id: "app", nome: "Apps de corrida", cor: "#6366F1" },
  { id: "publico", nome: "Ônibus e metrô", cor: "#06B6D4" },
  { id: "manutencao", nome: "Manutenção", cor: "#EF4444" },
  { id: "melhorias", nome: "Peças e melhorias", cor: "#A855F7" },
  { id: "estacionamento", nome: "Estacionamento e pedágio", cor: "#10B981" },
  { id: "documentos", nome: "IPVA, seguro e multas", cor: "#64748B" },
  { id: "outros", nome: "Outros", cor: "#94A3B8" },
];
export const subInfo = id => SUBS.find(s => s.id === id) || SUBS[SUBS.length - 1];

// Tipos de manutenção (o de troca de óleo alimenta o lembrete)
export const MANUTENCOES = [
  ["revisao", "Revisão"], ["oleo", "Troca de óleo"], ["pneus", "Pneus"], ["freios", "Freios"], ["bateria", "Bateria"],
  ["conserto", "Conserto / mecânico"], ["funilaria", "Funilaria e pintura"], ["lavagem", "Lavagem"],
  ["pecas", "Peças"], ["acessorios", "Acessórios e melhorias"],
];
export const FOTOS = [["sedan", "Sedã", "carro-sedan"], ["compacto", "Compacto", "carro-compacto"]];
export const COMBUSTIVEIS = [["flex", "Flex"], ["gasolina", "Gasolina"], ["etanol", "Etanol"], ["diesel", "Diesel"], ["gnv", "GNV"], ["eletrico", "Elétrico"]];

// Descobre a subcategoria de um gasto de transporte pela loja e pela descrição
const REGRAS = [
  ["app", /\b(uber|99|99 ?pop|99app|indrive|cabify|taxi|tax[ií]|corrida)\b/],
  ["combustivel", /\b(posto|gasolina|etanol|alcool|diesel|gnv|abasteci\w*|shell|ipiranga|petrobras|br mania|raizen|combustivel)\b/],
  ["publico", /\b(onibus|metro|trem|bilhete|passagem|brt|vlt|cartao transporte|riocard|sptrans|buser|rodoviaria)\b/],
  ["estacionamento", /\b(estacionamento|estacionei|zona azul|pedagio|sem parar|conectcar|veloe|parking|valet|estapar)\b/],
  ["documentos", /\b(ipva|licenciamento|multa|detran|seguro|dpvat|vistoria|cnh|emplacamento|financiamento)\b/],
  ["manutencao", /\b(oficina|mecanic\w*|revisao|oleo|pneu\w*|borracharia|freio\w*|bateria|alinhamento|balanceamento|lavagem|lava ?jato|funilaria|pintura|conserto|guincho|auto ?center)\b/],
  ["melhorias", /\b(peca\w*|acessorio\w*|insulfilm|pelicula|tapete|capa|farol|lampada|led|som automotivo|melhoria)\b/],
];
export function subDe(l) {
  if (l.sub && SUBS.some(s => s.id === l.sub)) return l.sub;
  const t = " " + semAcento(`${l.desc || l.nome || ""} ${l.marca || ""}`) + " ";
  for (const [id, re] of REGRAS) if (re.test(t)) return id;
  return "outros";
}

// Tudo o que saiu com transporte num mês (lançamentos + contas fixas pagas da categoria)
export function gastosTransporte(db, chave) {
  const P = db.pessoal || { lanc: [], contas: [] };
  const lanc = P.lanc.filter(l => l.tipo === "saida" && l.cat === "transporte" && l.data.startsWith(chave)).map(l => ({ ...l, sub: subDe(l) }));
  const fixas = P.contas.filter(c => c.cat === "transporte" && c.pagas && c.pagas[chave]).map(c => ({ id: "c:" + c.id, conta: true, desc: c.nome, valor: c.valor, data: c.pagas[chave], sub: subDe(c) }));
  const itens = [...lanc, ...fixas].sort((a, b) => b.data.localeCompare(a.data));
  const porSub = {}; itens.forEach(i => { porSub[i.sub] = porSub[i.sub] || { total: 0, n: 0 }; porSub[i.sub].total += i.valor; porSub[i.sub].n++; });
  return { itens, porSub, total: itens.reduce((s, i) => s + i.valor, 0) };
}

// Abastecimentos com litros: consumo real (método do tanque cheio) e custo por km
export function estatisticasCombustivel(db, veiculo) {
  const ab = (db.pessoal ? db.pessoal.lanc : []).filter(l => l.cat === "transporte" && subDe(l) === "combustivel" && l.litros > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.km || 0) - (b.km || 0));
  const consumos = [];
  for (let i = 1; i < ab.length; i++) {
    const a = ab[i - 1], b = ab[i];
    if (!(a.km > 0 && b.km > a.km)) continue;
    const c = (b.km - a.km) / b.litros;
    if (c > 2 && c < 40 && b.km - a.km < 3000) consumos.push(c);
  }
  const ult = consumos.slice(-5);
  const real = ult.length ? ult.reduce((s, c) => s + c, 0) / ult.length : null;
  const consumo = real || (veiculo && veiculo.consumo > 0 ? veiculo.consumo : null);
  const ultimo = ab[ab.length - 1] || null;
  const precoPago = ultimo ? (ultimo.precoLitro || ultimo.valor / ultimo.litros) : null;
  return { abastecimentos: ab, consumo, consumoReal: !!real, precoPago, custoKm: consumo && precoPago ? precoPago / consumo : null, ultimo };
}

// Quilometragem mais recente que se conhece (abastecimentos, manutenções ou a informada no veículo)
export function kmAtual(db, veiculo) {
  const ks = (db.pessoal ? db.pessoal.lanc : []).filter(l => l.cat === "transporte" && l.km > 0).map(l => l.km);
  return Math.max(veiculo && veiculo.km > 0 ? veiculo.km : 0, ...ks, 0) || null;
}

// Próxima troca de óleo: pela km (padrão 10.000) ou pelo tempo (padrão 12 meses), o que vier primeiro
export function proximaTrocaOleo(db, veiculo, hojeISO) {
  const trocas = (db.pessoal ? db.pessoal.lanc : []).filter(l => l.cat === "transporte" && (l.manut === "oleo" || /\boleo\b/.test(semAcento(l.desc)))).sort((a, b) => b.data.localeCompare(a.data));
  const ult = trocas[0]; if (!ult) return null;
  const cadaKm = (veiculo && veiculo.oleoKm) || 10000, cadaMeses = (veiculo && veiculo.oleoMeses) || 12;
  const d = new Date(ult.data + "T12:00:00"); d.setMonth(d.getMonth() + cadaMeses);
  const ate = d.toISOString().slice(0, 10), km = kmAtual(db, veiculo);
  const proxKm = ult.km > 0 ? ult.km + cadaKm : null;
  const faltamKm = proxKm && km ? proxKm - km : null;
  const faltamDias = Math.round((new Date(ate + "T12:00:00") - new Date(hojeISO + "T12:00:00")) / 864e5);
  return { ultima: ult, ate, proxKm, faltamKm, faltamDias, urgente: (faltamKm != null && faltamKm <= 500) || faltamDias <= 15 };
}

/* ---------- Preço do combustível (ANP, levantamento semanal oficial) ----------
   O servidor só busca a planilha da semana (o plano grátis da Cloudflare não aguenta ler o arquivo);
   quem lê é o próprio aparelho, uma vez por semana, e guarda só o que interessa (seu estado e sua cidade). */
const K_ANP = "agenda-anp";
const PRODUTOS = { "GASOLINA COMUM": "gasolina", "GASOLINA ADITIVADA": "aditivada", "ETANOL HIDRATADO": "etanol", "OLEO DIESEL S10": "diesel", "GNV": "gnv" };
const chaveNome = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// .xlsx é um zip: lê o diretório central e descompacta só os arquivos pedidos (DecompressionStream do navegador)
async function lerZip(buf, nomes) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), out = {};
  let fim = u8.length - 22; while (fim >= 0 && dv.getUint32(fim, true) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error("zip");
  let p = dv.getUint32(fim + 16, true); const n = dv.getUint16(fim + 10, true);
  for (let i = 0; i < n; i++) {
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), lNome = dv.getUint16(p + 28, true), lExtra = dv.getUint16(p + 30, true), lCom = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + lNome));
    p += 46 + lNome + lExtra + lCom;
    if (!nomes.some(f => f === nome || (f.endsWith("/") && nome.startsWith(f)))) continue;
    const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true), dados = u8.subarray(ini, ini + tam);
    if (metodo === 0) out[nome] = new TextDecoder().decode(dados);
    else out[nome] = await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
const xmlTexto = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
function linhasDaPlanilha(xml, comuns) {
  return [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map(r => {
    const linha = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] || "").match(/<v>([^<]*)<\/v>/), is = (c[3] || "").match(/<t[^>]*>([^<]*)<\/t>/);
      linha[c[1]] = v ? (/ t="s"/.test(c[2]) ? comuns[+v[1]] : xmlTexto(v[1])) : is ? xmlTexto(is[1]) : "";
    }
    return linha;
  });
}
// planilha da ANP -> { ini, fim, brasil, estado, cidade } (preços médios por combustível)
export async function lerPlanilhaANP(buf, uf, cidade) {
  const arq = await lerZip(buf, ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml", "xl/worksheets/"]);
  const comuns = [...(arq["xl/sharedStrings.xml"] || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlTexto([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(x => x[1]).join("")));
  const rels = Object.fromEntries([...arq["xl/_rels/workbook.xml.rels"].matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(m => [m[1], m[2].replace(/^\/?xl\//, "")]));
  const abas = Object.fromEntries([...arq["xl/workbook.xml"].matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(m => [chaveNome(m[1]), "xl/" + rels[m[2]]]));
  const ler = nome => {
    const xml = arq[abas[nome]]; if (!xml) return [];
    const linhas = linhasDaPlanilha(xml, comuns);
    const iCab = linhas.findIndex(l => Object.values(l).some(v => /^PRODUTO$/i.test(v)));
    if (iCab < 0) return [];
    const col = re => Object.keys(linhas[iCab]).find(k => re.test(chaveNome(linhas[iCab][k])));
    const c = { ini: col(/^DATA INICIAL/), fim: col(/^DATA FINAL/), uf: col(/^ESTADOS?$/), mun: col(/^MUNICIPIO$/), prod: col(/^PRODUTO$/), preco: col(/^PRECO MEDIO REVENDA/), postos: col(/^NUMERO DE POSTOS/) };
    return linhas.slice(iCab + 1).filter(l => l[c.prod] && l[c.preco]).map(l => ({ ini: l[c.ini], fim: l[c.fim], uf: chaveNome(l[c.uf]), mun: chaveNome(l[c.mun]), prod: PRODUTOS[chaveNome(l[c.prod])], preco: Number(l[c.preco]), postos: Number(l[c.postos]) || 0 })).filter(l => l.prod && l.preco > 0);
  };
  const junta = ls => ls.reduce((o, l) => { o[l.prod] = Math.round(l.preco * 100) / 100; return o; }, {});
  const br = ler("BRASIL"), es = ler("ESTADOS"), mu = ler("MUNICIPIOS");
  const U = chaveNome(uf), C = chaveNome(cidade);
  const dataDe = n => { const d = new Date(Date.UTC(1899, 11, 30) + Number(n) * 864e5); return d.toISOString().slice(0, 10); };
  const ref = br[0] || es[0] || {};
  return {
    ini: ref.ini ? dataDe(ref.ini) : null, fim: ref.fim ? dataDe(ref.fim) : null,
    brasil: junta(br), estado: U ? junta(es.filter(l => l.uf === U)) : {}, cidade: C ? junta(mu.filter(l => l.mun === C && (!U || l.uf === U))) : {},
    uf: U, nomeCidade: C,
  };
}
// Busca (no máximo a cada 3 dias) e guarda só o que interessa
export async function precosCombustivel(servidor, uf, cidade, forcar) {
  const lerLS = () => { try { return JSON.parse(localStorage.getItem(K_ANP) || "null"); } catch (e) { return null; } };
  const salvo = lerLS(), U = chaveNome(uf), C = chaveNome(cidade);
  if (!forcar && salvo && salvo.uf === U && salvo.nomeCidade === C && Date.now() - salvo.em < 3 * 864e5) return salvo;
  if (!servidor) { if (salvo) return { ...salvo, velho: true }; throw new Error("sem-servidor"); }
  try {
    const r = await fetch(`${servidor}/anp`); if (!r.ok) throw new Error("HTTP " + r.status);
    const out = { ...(await lerPlanilhaANP(await r.arrayBuffer(), uf, cidade)), em: Date.now() };
    try { localStorage.setItem(K_ANP, JSON.stringify(out)); } catch (e) {}
    return out;
  } catch (e) { if (salvo) return { ...salvo, velho: true }; throw e; }
}
// O último preço buscado (da cidade, ou do estado), para a janela de abastecer comparar sem esperar a internet
export function precosGuardados() {
  try { const s = JSON.parse(localStorage.getItem(K_ANP) || "null"); if (!s) return null; return Object.keys(s.cidade || {}).length ? s.cidade : Object.keys(s.estado || {}).length ? s.estado : s.brasil || null; } catch (e) { return null; }
}
// Etanol ou gasolina? (regra dos 70%: o etanol rende cerca de 70% da gasolina)
export function etanolOuGasolina(precos) {
  const g = precos && precos.gasolina, e = precos && precos.etanol;
  if (!(g > 0 && e > 0)) return null;
  const r = e / g;
  return { razao: r, veredito: r <= .7 ? "etanol" : r >= .73 ? "gasolina" : "tanto-faz" };
}

/* ---------- Tabela FIPE (API pública gratuita, sem chave) ---------- */
const FIPE = "https://parallelum.com.br/fipe/api/v1";
export const fipe = {
  marcas: tipo => fetch(`${FIPE}/${tipo}/marcas`).then(r => r.json()),
  modelos: (tipo, marca) => fetch(`${FIPE}/${tipo}/marcas/${marca}/modelos`).then(r => r.json()).then(j => j.modelos || []),
  anos: (tipo, marca, modelo) => fetch(`${FIPE}/${tipo}/marcas/${marca}/modelos/${modelo}/anos`).then(r => r.json()),
  valor: (tipo, marca, modelo, ano) => fetch(`${FIPE}/${tipo}/marcas/${marca}/modelos/${modelo}/anos/${ano}`).then(r => r.json()),
};
