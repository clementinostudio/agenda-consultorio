// Contas da loja (sem dependências: dá para testar fora do app e o app de celular importa direto, como
// "@site/loja-contas.js", sem levar a nuvem junto). src/loja.js reexporta tudo daqui.
const pad = n => String(n).padStart(2, "0");

/* ---------- formas de pagamento, categorias de gasto, cédulas ---------- */
export const PAGAMENTOS = [
  { id: "dinheiro", nome: "Dinheiro", curto: "Dinheiro" },
  { id: "pix", nome: "Pix", curto: "Pix" },
  { id: "debito", nome: "Cartão de débito", curto: "Débito" },
  { id: "credito", nome: "Cartão de crédito", curto: "Crédito" },
];
export const pagDe = id => PAGAMENTOS.find(p => p.id === id) || PAGAMENTOS[0];
// cor vem da lista de cores do app (CORES), ícone do conjunto I
export const CATS_LOJA = [
  { id: "insumos",   nome: "Insumos",     cor: "verde",   ic: "cart",    dica: "Leite, chocolate, farinha, frutas" },
  { id: "embalagem", nome: "Embalagem",   cor: "ciano",   ic: "bag",     dica: "Potes, sacolas, copos, colheres" },
  { id: "contas",    nome: "Gás e luz",   cor: "amarelo", ic: "bill",    dica: "Gás, luz, água, internet" },
  { id: "aluguel",   nome: "Aluguel",     cor: "azul",    ic: "home",    dica: "Aluguel do ponto, condomínio" },
  { id: "ajudante",  nome: "Ajudante",    cor: "rosa",    ic: "users",   dica: "Diária, salário, comissão" },
  { id: "entrega",   nome: "Entrega",     cor: "roxo",    ic: "car",     dica: "Motoboy, gasolina, aplicativo" },
  { id: "manut",     nome: "Manutenção",  cor: "coral",   ic: "gear",    dica: "Freezer, máquina, conserto" },
  { id: "imposto",   nome: "Impostos",    cor: "laranja", ic: "receipt", dica: "DAS do MEI, taxas, maquininha" },
  { id: "outros",    nome: "Outros",      cor: "amarelo", ic: "more",    dica: "" },
];
export const catLoja = id => CATS_LOJA.find(c => c.id === id) || CATS_LOJA[CATS_LOJA.length - 1];
export const CEDULAS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];
export const CORES_PRODUTO = ["rosa", "laranja", "amarelo", "verde", "ciano", "azul", "roxo", "coral"];
// os produtos rápidos (sugestões de nome ao cadastrar um produto)
export const PRODUTOS_SUGERIDOS = ["Brigadeiro", "Bolo (fatia)", "Sorvete 1 bola", "Açaí 300 ml", "Coxinha", "Pastel", "Refrigerante lata", "Água", "Café"];

/* ---------- contas do caixa (funções puras: dá para testar sem tela) ---------- */
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
export const somaV = (xs, f) => r2(xs.reduce((s, x) => s + (Number(f(x)) || 0), 0));
const doDia = (xs, dia) => xs.filter(x => x.dia === dia);
const noPeriodo = (xs, de, ate) => xs.filter(x => x.dia && x.dia >= de && x.dia <= ate);

// Um dia da loja: quanto entrou (e por forma), quanto saiu, o que sobrou
export function totaisDia(L, dia) {
  const vs = doDia(L.vendas, dia), gs = doDia(L.gastos, dia), ms = doDia(L.movs, dia);
  const porPag = Object.fromEntries(PAGAMENTOS.map(p => [p.id, 0]));
  vs.forEach(v => { porPag[v.pag] = r2((porPag[v.pag] || 0) + v.total); });
  const entrou = somaV(vs, v => v.total), saiu = somaV(gs, g => g.valor);
  return { dia, vendas: vs.length, entrou, porPag, saiu, sobrou: r2(entrou - saiu), gastos: gs, movs: ms };
}

// O que deveria estar na gaveta: o troco do começo + vendas em dinheiro + o que foi posto
// − os gastos pagos com o dinheiro da gaveta − o que foi tirado (retiradas)
export function gaveta(L, dia) {
  const c = L.caixas.find(x => x.id === dia) || {};
  const troco = c.troco != null ? Number(c.troco) : trocoSugerido(L, dia);
  const vendas = somaV(doDia(L.vendas, dia).filter(v => v.pag === "dinheiro"), v => v.total);
  const gastos = somaV(doDia(L.gastos, dia).filter(g => g.daGaveta), g => g.valor);
  const ms = doDia(L.movs, dia);
  const reforcos = somaV(ms.filter(m => m.tipo === "reforco"), m => m.valor);
  const retiradas = somaV(ms.filter(m => m.tipo === "retirada"), m => m.valor);
  return { troco: r2(troco), vendas, gastos, reforcos, retiradas, esperado: r2(troco + vendas + reforcos - gastos - retiradas), fechado: c.contado != null ? c : null };
}
// o troco que ficou na gaveta no último dia fechado antes deste
export function trocoSugerido(L, dia) {
  const ant = L.caixas.filter(x => x.id < dia && x.contado != null).sort((a, b) => b.id.localeCompare(a.id))[0];
  return ant ? Number(ant.deixou != null ? ant.deixou : ant.contado) || 0 : 0;
}

// Os produtos que mais saíram no período (pela quantidade)
export function maisVendidos(vendas, n = 5) {
  const por = {};
  vendas.forEach(v => (v.itens || []).forEach(it => {
    const k = it.p || it.nome; if (!k) return;
    const x = por[k] || (por[k] = { id: it.p, nome: it.nome, q: 0, total: 0 });
    x.q += Number(it.q) || 0; x.total = r2(x.total + (Number(it.q) || 0) * (Number(it.preco) || 0));
  }));
  return Object.values(por).sort((a, b) => b.q - a.q || b.total - a.total).slice(0, n);
}

// Totais de um período: o que está guardado no aparelho + (para os dias antes da janela) os totais da nuvem
export function totaisPeriodo(L, de, ate, antigos = []) {
  const vs = noPeriodo(L.vendas, de, ate), gs = noPeriodo(L.gastos, de, ate);
  const ant = antigos.filter(x => x.dia >= de && x.dia <= ate);
  const entrou = r2(somaV(vs, v => v.total) + somaV(ant.filter(x => x.colecao === "venda"), x => x.total));
  const saiu = r2(somaV(gs, g => g.valor) + somaV(ant.filter(x => x.colecao === "gasto"), x => x.total));
  const nVendas = vs.length + ant.filter(x => x.colecao === "venda").reduce((s, x) => s + x.n, 0);
  const porCat = {}; gs.forEach(g => { porCat[g.cat || "outros"] = r2((porCat[g.cat || "outros"] || 0) + g.valor); });
  return { entrou, saiu, sobrou: r2(entrou - saiu), vendas: nVendas, ticket: nVendas ? r2(entrou / nVendas) : 0, porCat };
}

// Entradas e saídas por dia (para o gráfico do período)
export function porDia(L, de, ate, antigos = []) {
  const dias = {};
  const d = (k) => dias[k] || (dias[k] = { dia: k, entrou: 0, saiu: 0 });
  noPeriodo(L.vendas, de, ate).forEach(v => { d(v.dia).entrou = r2(d(v.dia).entrou + v.total); });
  noPeriodo(L.gastos, de, ate).forEach(g => { d(g.dia).saiu = r2(d(g.dia).saiu + g.valor); });
  antigos.filter(x => x.dia >= de && x.dia <= ate).forEach(x => { if (x.colecao === "venda") d(x.dia).entrou = r2(d(x.dia).entrou + x.total); if (x.colecao === "gasto") d(x.dia).saiu = r2(d(x.dia).saiu + x.total); });
  return dias;
}

// As vendas de um dia por hora (pela hora "HH:MM" de cada venda): da primeira à última hora com venda, sem buracos,
// para as barrinhas do caixa. [{ h: 14, total, n }]
export function vendasPorHora(vendas, dia) {
  const por = {};
  vendas.forEach(v => {
    if (v.dia !== dia) return;
    const h = Number(String(v.hora || "").slice(0, 2));
    if (!(h >= 0 && h <= 23)) return;
    const x = por[h] || (por[h] = { h, total: 0, n: 0 });
    x.total = r2(x.total + (Number(v.total) || 0)); x.n++;
  });
  const hs = Object.keys(por).map(Number);
  if (!hs.length) return [];
  const out = [];
  for (let h = Math.min(...hs); h <= Math.max(...hs); h++) out.push(por[h] || { h, total: 0, n: 0 });
  return out;
}

// O resumo de um período do jeito que a aba Resumo mostra: totais, o que mais vendeu e os dias (no máximo 31)
export function resumoDoPeriodo(L, de, ate, antigos = [], nTop = 6) {
  const P = totaisPeriodo(L, de, ate, antigos), por = porDia(L, de, ate, antigos);
  const top = maisVendidos(L.vendas.filter(v => v.dia >= de && v.dia <= ate), nTop);
  const dias = [];
  for (let d = de; d <= ate && dias.length < 31; ) {
    dias.push(por[d] || { dia: d, entrou: 0, saiu: 0 });
    const [y, m, dd] = d.split("-").map(Number), x = new Date(y, m - 1, dd + 1);
    d = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  }
  return { de, ate, ...P, top: top.map(x => ({ nome: x.nome, q: x.q, total: x.total })), dias };
}

// Equipe sem o Pro de quem criou a loja: só a dona anota (os ajudantes continuam vendo o que já foi anotado)
export const lojaTravada = (L, pro) => !pro && !L.souDona && L.membros.length > 1;
// O aviso da equipe do jeito que aparece dentro do app de celular (o mesmo texto do AvisoEquipe de telas/loja.jsx no
// app: neutro, lá não se fala em assinar). null quando não há aviso
export function avisoEquipeApp(L, pro) {
  if (pro || !L.loja || L.membros.length < 2) return null;
  if (L.souDona) return "Na versão grátis, só você anota na loja. Os ajudantes continuam vendo o que já foi anotado.";
  const dono = L.membros.find(m => m.id === L.loja.dono);
  return `Por enquanto, só ${(dono && dono.nome) || "Alguém"} anota na loja. Fale com quem cuida da loja.`;
}

/* ---------- Pix com valor: o "copia e cola" e o QR code (padrão BR Code do Banco Central) ---------- */
// Feito aqui mesmo, sem nenhum serviço: é só um texto com campos e um código de conferência (CRC16).
const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const campo = (id, v) => `${id}${pad(v.length)}${v}`;
function crc16(t) {
  let c = 0xFFFF;
  for (let i = 0; i < t.length; i++) { c ^= t.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
  return c.toString(16).toUpperCase().padStart(4, "0");
}
const cpfValido = d => {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
};
// A chave do jeito que a pessoa digitou -> do jeito que o Pix espera (telefone com +55, CPF/CNPJ só números)
export function chavePix(ch) {
  const t = String(ch || "").trim();
  if (!t) return "";
  if (/@/.test(t)) return t.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return t.toLowerCase(); // chave aleatória
  const d = t.replace(/\D/g, "");
  if (/^\+/.test(t)) return "+" + d;
  if (d.length === 14) return d;                                   // CNPJ
  if (d.length === 11 && (cpfValido(d) && !/[()\s-]{2,}/.test(t) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(t))) return d; // CPF
  if (d.length === 10 || d.length === 11) return "+55" + d;        // celular com DDD
  if (d.length === 13 && d.startsWith("55")) return "+" + d;
  return t;
}
export function pixCopiaECola({ chave, nome, cidade, valor, txid }) {
  const k = chavePix(chave); if (!k) return "";
  const limpo = (s, n) => semAcento(s).replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, n).toUpperCase() || "LOJA";
  let t = campo("00", "01") + campo("26", campo("00", "br.gov.bcb.pix") + campo("01", k)) + campo("52", "0000") + campo("53", "986");
  if (valor > 0) t += campo("54", r2(valor).toFixed(2));
  t += campo("58", "BR") + campo("59", limpo(nome, 25)) + campo("60", limpo(cidade || "BRASIL", 15));
  t += campo("62", campo("05", (String(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25)) || "***"));
  t += "6304";
  return t + crc16(t);
}
