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
  ["pecas", "Peças"], ["acessorios", "Acessórios e melhorias"], ["alinhamento", "Alinhamento e rodízio"],
];
// Tipos de carro, cada um com o seu desenho (todos no mesmo ângulo): [chave, nome, arquivo, o que é, exemplos]
export const FOTOS = [
  ["hatch", "Hatch", "carro-hatch", "Carro comum, com a traseira curta (sem porta-malas saliente).", "Onix, HB20, Polo, Argo, Gol"],
  ["compacto", "Compacto", "carro-compacto", "Os bem pequenos, de cidade.", "Mobi, Kwid, Up!, Uno, Celta"],
  ["sedan", "Sedã", "carro-sedan", "Carro com o porta-malas separado, saliente atrás.", "Corolla, Virtus, Onix Plus, Civic, Cronos"],
  ["suv-compacto", "SUV compacto", "carro-suv-compacto", "Mais alto que um carro comum, mas de porte pequeno.", "Tracker, Creta, Kicks, T-Cross, Pulse"],
  ["suv", "SUV", "carro-suv", "Alto e espaçoso, de porte médio ou grande.", "Compass, Corolla Cross, Tiguan, SW4"],
  ["jipe", "Jipe / 4x4", "carro-jipe", "Feito para terra e trilha, quadradão.", "Jimny, Wrangler, Troller, Defender"],
  ["minivan", "Minivan", "carro-minivan", "Carro de família, alto, muitas vezes com 7 lugares.", "Spin, Livina, Zafira, Doblò"],
  ["van", "Van / furgão", "carro-van", "Para carga ou muita gente.", "Kombi, Fiorino, Sprinter, Master"],
  ["caminhao", "Caminhão", "carro-caminhao", "Caminhão leve ou de carga.", "Accelo, Delivery, HR, Bongo"],
];
export const FOTO_MOTO = ["moto", "Moto", "moto"];
export const FOTO_ONIBUS = ["onibus", "Transporte público", "onibus"];

// Descobre o tipo de carro pelo nome do modelo (da FIPE ou do apelido). A ordem importa: "Corolla Cross" é SUV antes de ser Corolla.
const CARROCERIAS = [
  ["caminhao", /\b(accelo|atego|axor|actros|constellation|delivery|worker|cargo \d|tector|stralis|vm \d|fh ?\d|fm ?\d|bongo|hr 2|hd ?\d|f-?4000|f-?350|caminh)/],
  ["van", /\b(kombi|fiorino|sprinter|master|ducato|daily|transit|boxer|jumper|trafic|kangoo|partner|berlingo|expert|express|vito|besta|topic|towner|scudo|jumpy|h-?100|e-?delivery|furg[aã]o|van)\b/],
  ["minivan", /\b(spin|livina|zafira|meriva|idea|dobl[oò]|picasso|scenic|sc[eé]nic|touran|carens|sharan|freemont|journey|odyssey|sienna|carnival|caravan|minivan)\b/],
  ["jipe", /\b(jimny|wrangler|troller|defender|pajero|tr4|niva|bandeirante|land cruiser|gladiator|cherokee|bronco|classe g|g ?63|samurai|vitara|jipe)\b/],
  ["suv", /\b(compass|commander|corolla cross|sw4|tiguan|taos|cr-?v|rav ?4|tucson|ix35|santa fe|sorento|sportage|outlander|equinox|trailblazer|territory|edge|explorer|discovery|evoque|velar|range rover|x[3-7]|q[3-8]|glc|gle|glk|xc ?[69]0|model y|tang|song|haval|h6|tiggo ?[5-9]|3008|5008|c5 aircross|koleos|captiva|eclipse cross|forester|4runner|mach-?e|id\.?4|ioniq 5|ev9|suv)\b/],
  ["picape", /\b(strada|toro|saveiro|montana|s-?10|hilux|ranger|amarok|frontier|l200|triton|oroch|rampage|maverick|ram|f-?250|f-?150|f-?1000|titano|d-?20|silverado|hoggar|courier|tacoma|tundra|colorado|shark|pick-?up|picape|cabine dupla|cab\. ?dupla)\b/],
  ["suv-compacto", /\b(tracker|creta|kicks|t-?cross|nivus|pulse|fastback|renegade|duster|captur|2008|cactus|ecosport|hr-?v|wr-?v|kona|seltos|stonic|tiggo ?[2-4]|jolion|yuan|ex30|xc ?40|aircross|basalt|kardian|bz4x|yaris cross|ix25|soul|tera|gla|glb|x1|q2|asx|crossfox)\b/],
  ["hatch", /\bhatch/],
  ["sedan", /\b(corolla|civic|cruze|onix plus|prisma|cobalt|virtus|voyage|jetta|passat|city|sentra|versa|hb20s|cronos|siena|logan|fluence|408|c4 lounge|accord|camry|fusion|elantra|azera|cerato|optima|linea|vectra|classic|a[4-8]|s[eé]rie [3-7]|3[12]\di|5[23]\di|classe [ce]|c ?[1-3]\d\d|model [3s]|seal|bora|santana|sonata|altima|premio|monza|omega|sed[aã]n?)\b/],
  ["compacto", /\b(mobi|kwid|up|uno|picanto|i10|smart|fusca|147|celta|ka|march|qq|e-?js1|mini|500|twingo|clio|dolphin mini|spark)\b/],
];
// por enquanto ainda não há desenho de picape: usa o do SUV
const SEM_DESENHO = { picape: "suv" };
export function carroceria(texto) {
  const t = String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t.trim()) return null;
  const achou = CARROCERIAS.find(([, re]) => re.test(t));
  return achou ? achou[0] : null;
}
// O desenho que aparece para o veículo: o que a pessoa escolheu ou, no automático, pelo modelo
export function fotoDoVeiculo(v) {
  if (!v) return FOTOS.find(f => f[0] === "sedan");
  if (v.tipo === "moto") return FOTO_MOTO;
  if (v.tipo === "nenhum") return FOTO_ONIBUS;
  if (v.tipo && v.tipo !== "carro") return null;
  const escolhida = FOTOS.find(f => f[0] === v.foto);
  if (escolhida) return escolhida;
  const k = carroceria(v.fipe && v.fipe.modelo) || carroceria(v.nome) || "hatch";
  return FOTOS.find(f => f[0] === (SEM_DESENHO[k] || k));
}
// Para mostrar na escolha: "SUV compacto" (ou "Picape", que ainda usa outro desenho)
export const NOME_CARROCERIA = { picape: "Picape" };
export const COMBUSTIVEIS = [["flex", "Flex"], ["gasolina", "Gasolina"], ["etanol", "Etanol"], ["diesel", "Diesel"], ["gnv", "GNV"], ["eletrico", "Elétrico"]];

// Vários veículos: a lista fica em pessoal.veiculos (quem tinha um só, em pessoal.veiculo, vira o primeiro)
export function veiculosDe(db) {
  const P = (db && db.pessoal) || {};
  if (Array.isArray(P.veiculos)) return P.veiculos;
  return P.veiculo ? [{ id: "v1", ...P.veiculo }] : [];
}
// De qual veículo é um gasto: o marcado nele; sem marca, apps e ônibus vão para o "sem veículo" (se houver) e o resto para o primeiro com motor
export function donoDoGasto(l, vs) {
  if (!vs.length) return null;
  if (l.veiculoId && vs.some(v => v.id === l.veiculoId)) return l.veiculoId;
  const sub = subDe(l), semVeiculo = vs.find(v => v.tipo === "nenhum");
  if (semVeiculo && (sub === "app" || sub === "publico")) return semVeiculo.id;
  return (vs.find(v => v.tipo !== "nenhum") || vs[0]).id;
}
// Gastos de transporte de um veículo (sem veículo informado: todos)
export function lancTransp(db, veiculo) {
  const todos = (db.pessoal ? db.pessoal.lanc : []).filter(l => l.cat === "transporte");
  const vs = veiculosDe(db);
  if (!veiculo || !veiculo.id || vs.length < 2) return todos;
  return todos.filter(l => donoDoGasto(l, vs) === veiculo.id);
}

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
export function gastosTransporte(db, chave, veiculo) {
  const P = db.pessoal || { lanc: [], contas: [] };
  const lanc = lancTransp(db, veiculo).filter(l => l.tipo === "saida" && l.data.startsWith(chave)).map(l => ({ ...l, sub: subDe(l) }));
  const vs = veiculosDe(db);
  const fixas = P.contas.filter(c => c.cat === "transporte" && c.pagas && c.pagas[chave] && (!veiculo || !veiculo.id || !vs.length || donoDoGasto(c, vs) === veiculo.id)).map(c => ({ id: "c:" + c.id, conta: true, desc: c.nome, valor: c.valor, data: c.pagas[chave], sub: subDe(c) }));
  const itens = [...lanc, ...fixas].sort((a, b) => b.data.localeCompare(a.data));
  const porSub = {}; itens.forEach(i => { porSub[i.sub] = porSub[i.sub] || { total: 0, n: 0 }; porSub[i.sub].total += i.valor; porSub[i.sub].n++; });
  return { itens, porSub, total: itens.reduce((s, i) => s + i.valor, 0) };
}

// Abastecimentos com litros: consumo real (método do tanque cheio) e custo por km
export function estatisticasCombustivel(db, veiculo) {
  const ab = lancTransp(db, veiculo).filter(l => subDe(l) === "combustivel" && l.litros > 0)
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
  const ks = lancTransp(db, veiculo).filter(l => l.km > 0).map(l => l.km);
  return Math.max(veiculo && veiculo.km > 0 ? veiculo.km : 0, ...ks, 0) || null;
}

// Próxima troca de óleo: pela km (padrão 10.000) ou pelo tempo (padrão 12 meses), o que vier primeiro
export function proximaTrocaOleo(db, veiculo, hojeISO) {
  const trocas = lancTransp(db, veiculo).filter(l => (l.manut === "oleo" || /\boleo\b/.test(semAcento(l.desc)))).sort((a, b) => b.data.localeCompare(a.data));
  const ult = trocas[0]; if (!ult) return null;
  const cadaKm = (veiculo && veiculo.oleoKm) || 10000, cadaMeses = (veiculo && veiculo.oleoMeses) || 12;
  const d = new Date(ult.data + "T12:00:00"); d.setMonth(d.getMonth() + cadaMeses);
  const ate = d.toISOString().slice(0, 10), km = kmAtual(db, veiculo);
  const proxKm = ult.km > 0 ? ult.km + cadaKm : null;
  const faltamKm = proxKm && km ? proxKm - km : null;
  const faltamDias = Math.round((new Date(ate + "T12:00:00") - new Date(hojeISO + "T12:00:00")) / 864e5);
  return { ultima: ult, ate, proxKm, faltamKm, faltamDias, urgente: (faltamKm != null && faltamKm <= 500) || faltamDias <= 15 };
}

// Rodízio e alinhamento dos pneus: a cada 10.000 km ou 12 meses, contando do último anotado
export function proximoRodizio(db, veiculo, hojeISO) {
  const feitos = lancTransp(db, veiculo).filter(l => (["alinhamento", "pneus"].includes(l.manut) || /\b(rodizio|alinhamento|balanceamento)\b/.test(semAcento(l.desc)))).sort((a, b) => b.data.localeCompare(a.data));
  const ult = feitos[0]; if (!ult) return null;
  const d = new Date(ult.data + "T12:00:00"); d.setMonth(d.getMonth() + 12);
  const ate = d.toISOString().slice(0, 10), km = kmAtual(db, veiculo);
  const proxKm = ult.km > 0 ? ult.km + 10000 : null;
  const faltamKm = proxKm && km ? proxKm - km : null;
  const faltamDias = Math.round((new Date(ate + "T12:00:00") - new Date(hojeISO + "T12:00:00")) / 864e5);
  return { ultima: ult, ate, proxKm, faltamKm, faltamDias, urgente: (faltamKm != null && faltamKm <= 500) || faltamDias <= 15 };
}

// IPVA, licenciamento e seguro: a pessoa informa a data e o valor; o app lembra e, ao pagar, joga para o ano seguinte
export const DOCS_VEICULO = [["ipva", "IPVA"], ["licenc", "Licenciamento"], ["seguro", "Seguro"]];
export function docsVeiculo(veiculo, hojeISO) {
  const d = (veiculo && veiculo.docs) || {};
  return DOCS_VEICULO.filter(([k]) => d[k] && d[k].data).map(([k, nome]) => ({
    k, nome, data: d[k].data, valor: d[k].valor || 0,
    dias: Math.round((new Date(d[k].data + "T12:00:00") - new Date(hojeISO + "T12:00:00")) / 864e5),
  })).sort((a, b) => a.data.localeCompare(b.data));
}
export const umAnoDepois = iso => { const d = new Date(iso + "T12:00:00"); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

// Quanto o carro custa de verdade: tudo o que é do carro nos últimos 12 meses (sem apps e ônibus),
// dividido pelos meses e pelos km rodados; e quanto ele perdeu de valor pela FIPE, se houver histórico
const DO_CARRO = ["combustivel", "manutencao", "melhorias", "estacionamento", "documentos"];
export function custoReal(db, veiculo, hojeISO) {
  const fim = new Date(hojeISO + "T12:00:00"), meses = [];
  for (let i = 0; i < 12; i++) { const m = new Date(fim.getFullYear(), fim.getMonth() - i, 1); meses.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`); }
  const itens = meses.flatMap(ch => gastosTransporte(db, ch, veiculo).itens).filter(i => DO_CARRO.includes(i.sub));
  if (!itens.length) return null;
  const primeiro = itens.reduce((m, i) => typeof i.data === "string" && i.data < m ? i.data : m, hojeISO);
  const nMeses = Math.max(1, Math.min(12, (fim.getFullYear() - Number(primeiro.slice(0, 4))) * 12 + fim.getMonth() + 1 - Number(primeiro.slice(5, 7))));
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const porSub = {}; itens.forEach(i => { porSub[i.sub] = (porSub[i.sub] || 0) + i.valor; });
  const kms = itens.filter(i => i.km > 0).map(i => i.km);
  const rodados = kms.length >= 2 ? Math.max(...kms) - Math.min(...kms) : 0;
  const hist = (veiculo && veiculo.fipeHist) || [];
  const perdeu = hist.length >= 2 && hist[0].valor > hist[hist.length - 1].valor ? { valor: hist[0].valor - hist[hist.length - 1].valor, desde: hist[0].quando } : null;
  return { total, porMes: total / nMeses, porDia: total / (nMeses * 30.4), nMeses, porSub, rodados, porKm: rodados >= 300 ? total / rodados : null, perdeu };
}
export const valorFipe = s => Number(String(s || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

/* ---------- Preço do combustível (ANP, levantamento semanal oficial) ----------
   O servidor só busca a planilha da semana (o plano grátis da Cloudflare não aguenta ler o arquivo);
   quem lê é o próprio aparelho, uma vez por semana, e guarda só o que interessa (seu estado e sua cidade). */
const K_ANP = "agenda-anp";
const PRODUTOS = { "GASOLINA COMUM": "gasolina", "GASOLINA ADITIVADA": "aditivada", "ETANOL HIDRATADO": "etanol", "OLEO DIESEL S10": "diesel", "GNV": "gnv" };
export const chaveNome = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// .xlsx é um zip: lê o diretório central e descompacta só os arquivos pedidos (DecompressionStream do navegador)
export async function lerZip(buf, nomes) {
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
    // no app do celular não há DecompressionStream: ele passa o descompactador dele (fflate) em globalThis.inflarZip
    else if (typeof DecompressionStream === "undefined" && globalThis.inflarZip) out[nome] = new TextDecoder().decode(globalThis.inflarZip(dados));
    else out[nome] = await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
export const xmlTexto = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
export function linhasDaPlanilha(xml, comuns) {
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

// Postos onde a pessoa abastece: pelo nome anotado no abastecimento, com o preço médio do litro
export function postos(db, veiculo) {
  const ab = lancTransp(db, veiculo).filter(l => subDe(l) === "combustivel" && l.desc && !/^abastecimento\b/i.test(l.desc.trim()));
  const g = {};
  ab.forEach(l => {
    const k = semAcento(l.desc).replace(/\s+/g, " ").trim();
    const x = g[k] || (g[k] = { nome: l.desc.trim(), n: 0, gasto: 0, litros: 0, ultimo: l.data, precos: [] });
    x.n++; x.gasto += l.valor; if (l.litros > 0) x.litros += l.litros;
    const p = l.precoLitro || (l.litros > 0 ? l.valor / l.litros : 0); if (p > 0) x.precos.push(p);
    if (l.data > x.ultimo) x.ultimo = l.data;
  });
  return Object.values(g).map(x => ({ ...x, preco: x.precos.length ? x.precos.reduce((s, p) => s + p, 0) / x.precos.length : null }))
    .sort((a, b) => b.n - a.n || b.gasto - a.gasto);
}

// Carro ou app: o custo de verdade do carro por km (gastos + o quanto ele desvalorizou) contra o preço de uma corrida
export function carroOuApp(custo, appRef) {
  if (!custo || !custo.porKm || !appRef || !(appRef.valor > 0) || !(appRef.km > 0)) return null;
  const kmMes = custo.rodados / custo.nMeses;
  const perdaKm = custo.perdeu && custo.rodados ? custo.perdeu.valor / Math.max(custo.rodados, 1) : 0;
  const carroKm = custo.porKm + perdaKm, appKm = appRef.valor / appRef.km;
  return { carroKm, appKm, kmMes, appMes: appKm * kmMes, carroMes: carroKm * kmMes, diferenca: (appKm - carroKm) * kmMes, comDesvalor: perdaKm > 0 };
}
