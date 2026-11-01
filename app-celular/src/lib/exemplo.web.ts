// Prévia no navegador: a conta de exemplo que a camada do site de mentira (components/camada-web.web.tsx) manda para
// as telas nativas, no mesmo formato do retrato do site (retratoNativo em ../src/App.jsx). Só entra no build web: o
// celular nunca carrega este arquivo.
// - Os dados são sempre os mesmos (sorteio com semente) e andam com a data de hoje da página (o tirar.mjs dos prints
//   congela o relógio num dia do meio do mês, para os gráficos terem o que mostrar).
// - Parâmetros da URL: ?tema=dark|light|auto (padrão dark) · ?vazio=1 (conta nova, sem lançamentos) · ?logado=0
//   (sem login: o site fica na frente).
import { acharMarca, marcaPorId } from '@site/marcas.js';

import { SERVIDOR } from '@/lib/ambiente';
import type {
  BancoConectado, Caixinha, Categoria, ContaBanco, ContaFixa, Estado, Investimento, Lanc, RespostaBolinha, ResumoBanco, TemaEscolhido,
} from '@/lib/motor';

/* ---------- Os parâmetros da URL ---------- */

const busca = (() => { try { return new URLSearchParams(globalThis.location?.search || ''); } catch { return new URLSearchParams(); } })();
const temaPedido = busca.get('tema');
export const PREVIA = {
  tema: (temaPedido === 'light' || temaPedido === 'auto' ? temaPedido : 'dark') as TemaEscolhido,
  vazio: busca.get('vazio') === '1',
  logado: busca.get('logado') !== '0',
};

/* ---------- Datas (no fuso da página) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const diasAtras = (hoje: Date, n: number) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return d; };
const dentroDoMes = (a: number, m: number, dia: number) => Math.min(dia, new Date(a, m + 1, 0).getDate());
const centavos = (v: number) => Math.round(v * 100) / 100;

// Sorteio com semente: os mesmos dados toda vez (prints de antes e depois ficam comparáveis)
function sorteio(semente: number) {
  let a = semente >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // um preço entre x e y; às vezes termina em ,90 (como os preços de verdade)
  const preco = (x: number, y: number) => { const v = x + r() * (y - x); return r() < 0.3 ? Math.floor(v) + 0.9 : centavos(v); };
  return { r, preco, um: <T,>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)] };
}

/* ---------- As categorias do site (src/App.jsx: CATEGORIAS, CAT_ENTRADA e CORES, já resolvidas) ---------- */

const COR = {
  azul: ['#4A62FF', '#FFFFFF'], roxo: ['#8B6CFF', '#FFFFFF'], rosa: ['#FF6FA8', '#FFFFFF'], coral: ['#FF6B5E', '#FFFFFF'],
  laranja: ['#FF9A4C', '#2A1405'], amarelo: ['#FFC93D', '#2A1F00'], verde: ['#2FCB8E', '#04261A'], ciano: ['#3CC4E6', '#04232C'],
} as const;
const cat = (id: string, nome: string, cor: keyof typeof COR, ic: string): Categoria => ({ id, nome, cor: COR[cor][0], ink: COR[cor][1], ic });

export const CATEGORIAS: Categoria[] = [
  cat('mercado', 'Mercado', 'verde', 'cart'),
  cat('casa', 'Casa', 'azul', 'home'),
  cat('transporte', 'Transporte', 'ciano', 'car'),
  cat('comida', 'Comida fora', 'laranja', 'food'),
  cat('saude', 'Saúde', 'rosa', 'heart'),
  cat('lazer', 'Lazer', 'roxo', 'star'),
  cat('compras', 'Compras', 'coral', 'bag'),
  cat('outros', 'Outros', 'amarelo', 'more'),
];
export const CAT_ENTRADA: Categoria[] = [
  cat('trabalho', 'Trabalho', 'verde', 'money'),
  cat('extra', 'Extra', 'ciano', 'star'),
  cat('presente', 'Presente', 'rosa', 'heart'),
  cat('outros-e', 'Outros', 'amarelo', 'more'),
];

/* ---------- A logo, do jeito que o site manda (logoParaApp) ---------- */

type Marca = { id: string; nome: string; site: string; cat: string };
const marcaDe = (id?: string | null) => (id ? (marcaPorId(id) as Marca | null) : null);
export function logoDe(desc: string, marca?: string | null) {
  const m = marcaDe(marca) ?? (acharMarca(desc) as Marca | null);
  return { marca: m ? m.id : null, site: m ? m.site : null };
}

/* ---------- Os lançamentos dos últimos 3 meses ---------- */

type Molde = { desc: string; marca?: string; cat: string; min: number; max: number; chance: number; obs?: string };

// O dia a dia: a chance de aparecer em cada dia e a faixa de valor
const DIA_A_DIA: Molde[] = [
  { desc: 'Carrefour', marca: 'carrefour', cat: 'mercado', min: 140, max: 480, chance: 0.06 },
  { desc: 'Pão de Açúcar', marca: 'paodeacucar', cat: 'mercado', min: 60, max: 260, chance: 0.05 },
  { desc: 'Assaí', marca: 'assai', cat: 'mercado', min: 180, max: 520, chance: 0.025 },
  { desc: 'Hortifruti', marca: 'hortifruti', cat: 'mercado', min: 38, max: 120, chance: 0.04 },
  { desc: 'Padaria Real', cat: 'mercado', min: 12, max: 38, chance: 0.05 },
  { desc: 'iFood', marca: 'ifood', cat: 'comida', min: 38, max: 96, chance: 0.2 },
  { desc: 'Starbucks', marca: 'starbucks', cat: 'comida', min: 18, max: 34, chance: 0.07 },
  { desc: "McDonald's", marca: 'mcdonalds', cat: 'comida', min: 32, max: 62, chance: 0.04 },
  { desc: 'Outback', marca: 'outback', cat: 'comida', min: 190, max: 280, chance: 0.025, obs: 'Aniversário da Ana' },
  { desc: 'Madero', marca: 'madero', cat: 'comida', min: 120, max: 180, chance: 0.02 },
  { desc: 'Uber', marca: 'uber', cat: 'transporte', min: 14, max: 46, chance: 0.28 },
  { desc: '99', marca: '99', cat: 'transporte', min: 12, max: 30, chance: 0.06 },
  { desc: 'Posto Shell', marca: 'shell', cat: 'transporte', min: 180, max: 260, chance: 0.04 },
  { desc: 'Posto Ipiranga', marca: 'ipiranga', cat: 'transporte', min: 160, max: 240, chance: 0.025 },
  { desc: 'Estacionamento', cat: 'transporte', min: 15, max: 32, chance: 0.04 },
  { desc: 'Drogasil', marca: 'drogasil', cat: 'saude', min: 25, max: 140, chance: 0.045 },
  { desc: 'Droga Raia', marca: 'drogaraia', cat: 'saude', min: 22, max: 90, chance: 0.025 },
  { desc: 'Amazon', marca: 'amazon', cat: 'compras', min: 39, max: 320, chance: 0.05 },
  { desc: 'Mercado Livre', marca: 'mercadolivre', cat: 'compras', min: 45, max: 260, chance: 0.035 },
  { desc: 'Renner', marca: 'renner', cat: 'compras', min: 120, max: 340, chance: 0.012 },
  { desc: 'Zara', marca: 'zara', cat: 'compras', min: 180, max: 420, chance: 0.01 },
  { desc: 'Cinemark', marca: 'cinemark', cat: 'lazer', min: 56, max: 92, chance: 0.03 },
];

// Todo mês, no mesmo dia (as contas fixas pagas e as assinaturas)
type Fixo = { desc: string; marca?: string; cat: string; valor: number | [number, number]; dia: number; tipo?: 'entrada' };
const TODO_MES: Fixo[] = [
  { desc: 'Retirada do consultório', cat: 'trabalho', valor: 9200, dia: 5, tipo: 'entrada' },
  { desc: 'Aluguel', cat: 'casa', valor: 2800, dia: 5 },
  { desc: 'Spotify', marca: 'spotify', cat: 'lazer', valor: 21.9, dia: 8 },
  { desc: 'Smart Fit', marca: 'smartfit', cat: 'saude', valor: 129.9, dia: 10 },
  { desc: 'Conta de luz', marca: 'enel', cat: 'casa', valor: [168, 236], dia: 12 },
  { desc: 'Vivo Fibra', marca: 'vivo', cat: 'casa', valor: 129.9, dia: 25 },
  { desc: 'Rendimento da reserva', cat: 'extra', valor: [118, 142], dia: 16, tipo: 'entrada' },
  { desc: 'Netflix', marca: 'netflix', cat: 'lazer', valor: 44.9, dia: 28 },
  { desc: 'Disney+', marca: 'disney', cat: 'lazer', valor: 43.9, dia: 22 },
];

const DIAS = 92;

function lancamentos(hoje: Date): Lanc[] {
  const s = sorteio(20261101);
  const lista: Omit<Lanc, 'id'>[] = [];
  const pos = (m: Omit<Lanc, 'id' | 'marca' | 'site' | 'banco'> & { marca?: string | null }, banco: string | null) => {
    const logo = m.marca ? logoDe(m.desc, m.marca) : { marca: null, site: null };
    lista.push({ ...m, ...logo, banco });
  };
  for (let n = DIAS; n >= 0; n--) {
    const d = diasAtras(hoje, n), dia = d.getDate(), data = iso(d);
    for (const f of TODO_MES) {
      if (dentroDoMes(d.getFullYear(), d.getMonth(), f.dia) !== dia) continue;
      const valor = typeof f.valor === 'number' ? f.valor : s.preco(f.valor[0], f.valor[1]);
      pos({ tipo: f.tipo ?? 'saida', valor, data, cat: f.cat, desc: f.desc, marca: f.marca ?? null }, null);
    }
    for (const m of DIA_A_DIA) {
      if (s.r() >= m.chance) continue;
      // uns 30% dos gastos vieram do Open Finance (o selo do Nubank no canto da logo)
      pos({ tipo: 'saida', valor: s.preco(m.min, m.max), data, cat: m.cat, desc: m.desc, marca: m.marca ?? null, ...(m.obs ? { obs: m.obs } : {}) }, s.r() < 0.33 ? 'Nubank' : null);
    }
    // hoje e ontem sempre têm movimento (o "Hoje" e o "Ontem" da lista)
    if (n === 0) {
      pos({ tipo: 'saida', valor: 24.9, data, cat: 'comida', desc: 'Starbucks', marca: 'starbucks' }, 'Nubank');
      pos({ tipo: 'saida', valor: 18.7, data, cat: 'transporte', desc: 'Uber', marca: 'uber' }, null);
    }
    if (n === 1) pos({ tipo: 'saida', valor: 312.48, data, cat: 'mercado', desc: 'Carrefour', marca: 'carrefour' }, 'Nubank');
    // uma compra em dólar e um Pix recebido
    if (n === 18) pos({ tipo: 'saida', valor: 16.9, data, cat: 'compras', desc: 'iCloud+', marca: 'apple', moeda: 'USD', valorOrig: 2.99 }, 'Nubank');
    if (n === 26) pos({ tipo: 'entrada', valor: 350, data, cat: 'presente', desc: 'Pix da tia Lúcia', obs: 'Presente de aniversário' }, null);
  }
  // do mais novo para o mais velho; o id l1 é o mais recente (para abrir /lancamento/l1 nos prints)
  return lista
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.data === b.l.data ? b.i - a.i : a.l.data < b.l.data ? 1 : -1))
    .map(({ l }, i) => ({ id: `l${i + 1}`, ...l }));
}

/* ---------- O resto do retrato ---------- */

function contasFixas(hoje: Date): ContaFixa[] {
  const a = hoje.getFullYear(), m = hoje.getMonth(), ch = `${a}-${pad(m + 1)}`;
  const conta = (id: string, nome: string, valor: number, dia: number, c: string, assinatura: boolean, marca: string | null): ContaFixa => {
    const venceDia = dentroDoMes(a, m, dia);
    return { id, nome, valor, dia, cat: c, paga: venceDia <= hoje.getDate(), vence: `${ch}-${pad(venceDia)}`, assinatura, ...(marca ? logoDe(nome, marca) : { marca: null, site: null }) };
  };
  return [
    conta('cf1', 'Aluguel', 2800, 5, 'casa', false, null),
    conta('cf2', 'Smart Fit', 129.9, 10, 'saude', true, 'smartfit'),
    conta('cf3', 'Conta de luz', 212.4, 12, 'casa', false, 'enel'),
    conta('cf4', 'Vivo Fibra', 129.9, 25, 'casa', false, 'vivo'),
    conta('cf5', 'Netflix', 44.9, 28, 'lazer', true, 'netflix'),
  ];
}

const CAIXINHAS: Caixinha[] = [
  { id: 'cx1', nome: 'Reserva de emergência', emoji: '🛟', guardado: 18450.32, meta: 30000, doBanco: true },
  { id: 'cx2', nome: 'Viagem para o Chile', emoji: '✈️', guardado: 2350, meta: 6000, doBanco: false },
];

export function retratoExemplo(tema: TemaEscolhido = PREVIA.tema, vazio = PREVIA.vazio): Estado {
  const hoje = new Date();
  const base = {
    v: 1 as const, em: Date.now(), logado: true, tema,
    conta: { nome: 'Felipe Clementino', email: 'felipe@exemplo.com', foto: null, uid: 'exemplo' },
    modos: ['consultorio', 'pessoal'] as Estado['modos'], modo: 'pessoal' as const, termo: 'Paciente',
    plano: vazio ? { pro: false, estado: null, ate: null } : { pro: true, estado: 'ativa', ate: iso(diasAtras(hoje, -42)) },
    servidor: SERVIDOR, bancoLigado: true, categorias: CATEGORIAS, catEntrada: CAT_ENTRADA,
  };
  if (vazio) {
    return {
      ...base,
      pessoal: { lanc: [], contas: [], caixinhas: [], limites: {}, renda: null },
      consultorio: { hoje: [], recebidoMes: 0, aReceber: 0, sessoesMes: 0, faltasMes: 0, pacientesAtivos: 0 },
    };
  }
  return {
    ...base,
    pessoal: { lanc: lancamentos(hoje), contas: contasFixas(hoje), caixinhas: CAIXINHAS, limites: { comida: 900, lazer: 350, compras: 600 }, renda: null },
    consultorio: {
      hoje: [
        { hora: '08:00', nome: 'Ana', status: 'feita', valor: 180 },
        { hora: '09:00', nome: 'Bruno', status: 'feita', valor: 200 },
        { hora: '10:00', nome: 'Carla', status: 'faltou', valor: 180 },
        { hora: '14:00', nome: 'Diego', status: 'proxima', valor: 220 },
        { hora: '16:30', nome: 'Elisa', status: 'proxima', valor: 180 },
      ],
      recebidoMes: 8640, aReceber: 1260, sessoesMes: 48, faltasMes: 3, pacientesAtivos: 22,
    },
  };
}

// Sem login (src/App.jsx, retratoSemLogin)
export const retratoSemLogin = (tema: TemaEscolhido): Estado => ({
  v: 1, em: Date.now(), logado: false, tema, conta: null, modos: [], modo: null, termo: 'Paciente', plano: null,
  servidor: SERVIDOR, bancoLigado: false, categorias: [], catEntrada: [], pessoal: null, consultorio: null,
});

/* ---------- Os bancos conectados (Open Finance) ---------- */

export function bancosExemplo(): BancoConectado[] {
  const agora = Date.now();
  return [
    { id: 'item-nubank', nome: 'Nubank', status: 'UPDATED', atualizado: new Date(agora - 12 * 60e3).toISOString(), logo: 'nubank.com.br' },
    { id: 'item-itau', nome: 'Itaú', status: 'UPDATED', atualizado: new Date(agora - 2 * 3600e3).toISOString(), logo: 'itau.com.br' },
  ];
}

export function resumoExemplo(bancos: BancoConectado[], vazio = PREVIA.vazio): ResumoBanco {
  if (vazio) return { ligado: true, bancos: [], contas: [], investimentos: [], em: new Date().toISOString() };
  const hoje = new Date();
  // a fatura do cartão fecha no dia 3 e vence no dia 10 (do mês que vem, se já passou)
  const proximo = (dia: number) => { const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia); if (d < hoje) d.setMonth(d.getMonth() + 1); return iso(d); };
  const contas: ContaBanco[] = [
    { id: 'conta-nubank', itemId: 'item-nubank', banco: 'Nubank', nome: 'Conta', final: '4821', tipo: 'conta', saldo: 4820.35, especial: null, especialUsado: null },
    { id: 'conta-itau', itemId: 'item-itau', banco: 'Itaú', nome: 'Conta corrente', final: '0937', tipo: 'conta', saldo: 12340.1, especial: 5000, especialUsado: 0 },
    { id: 'cartao-nubank', itemId: 'item-nubank', banco: 'Nubank', nome: 'Nubank Ultravioleta', final: '7710', tipo: 'cartao', saldo: 2384.9, limite: 12000, livre: 9615.1, vence: proximo(10), fecha: proximo(3), minimo: 357.74 },
  ];
  const investimentos: Investimento[] = [
    { id: 'inv-nubank', itemId: 'item-nubank', banco: 'Nubank', nome: 'Caixinha Reserva', tipo: 'FIXED_INCOME', subtipo: 'CDB', saldo: 18450.32, aplicado: 17200, rendeu: 1250.32, vence: null },
    { id: 'inv-itau', itemId: 'item-itau', banco: 'Itaú', nome: 'Tesouro Selic 2029', tipo: 'FIXED_INCOME', subtipo: 'TREASURY', saldo: 15230.8, aplicado: 14000, rendeu: 1230.8, vence: '2029-03-01' },
  ];
  const ligados = new Set(bancos.map((b) => b.id));
  return {
    ligado: true,
    bancos,
    contas: contas.filter((c) => ligados.has(c.itemId)),
    investimentos: investimentos.filter((i) => ligados.has(i.itemId)),
    em: new Date().toISOString(),
  };
}

/* ---------- A Bolinha de mentira ---------- */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "gastei 30 no uber e 45,90 no ifood" → os itens (como o entenderFrase do site, bem mais simples)
function entenderGastos(texto: string): Omit<Lanc, 'id'>[] {
  const s = semAcento(texto);
  const entrada = /\b(recebi|ganhei|entrou|caiu)\b/.test(s);
  const hoje = iso(new Date());
  return texto
    .split(/\s+e\s+|,\s+|;/i)
    .map((parte) => {
      const n = /(\d+(?:[.,]\d{1,2})?)/.exec(parte);
      if (!n) return null;
      const valor = centavos(Number(n[1].replace(',', '.')));
      const resto = parte.slice(n.index + n[0].length).replace(/^\s*(reais|real|conto|contos|pila)\b/i, '');
      const onde = /\b(?:no|na|em|com|do|da|de|pro|pra)\s+(.+)$/i.exec(resto);
      const bruto = (onde ? onde[1] : resto).trim().replace(/[.!?]+$/, '');
      const m = acharMarca(bruto || parte) as Marca | null;
      const desc = m ? m.nome : bruto ? bruto[0].toUpperCase() + bruto.slice(1) : entrada ? 'Entrada' : 'Gasto';
      const c = entrada ? 'outros-e' : m && CATEGORIAS.some((x) => x.id === m.cat) ? m.cat : 'outros';
      return { tipo: entrada ? 'entrada' : 'saida', valor, data: hoje, cat: c, desc, marca: m ? m.id : null, site: m ? m.site : null, banco: null } as Omit<Lanc, 'id'>;
    })
    .filter((x): x is Omit<Lanc, 'id'> => !!x && x.valor > 0);
}

// Uma resposta de umas 3 frases, com as contas feitas nos dados do exemplo
function responderPergunta(texto: string, e: Estado): string {
  const lanc = e.pessoal?.lanc ?? [];
  const hoje = new Date(), dia = hoje.getDate();
  const ch = iso(hoje).slice(0, 7);
  const antes = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const chAntes = iso(antes).slice(0, 7);
  const gastos = lanc.filter((l) => l.tipo === 'saida');
  const doMes = gastos.filter((l) => l.data.startsWith(ch));
  const mesmoPonto = gastos.filter((l) => l.data.startsWith(chAntes) && Number(l.data.slice(8, 10)) <= dia);
  const s = semAcento(texto);
  // pergunta de uma empresa ("quanto gastei de uber?") ou de uma categoria ("e com mercado?")
  const m = acharMarca(texto) as Marca | null;
  const k = CATEGORIAS.find((x) => s.includes(semAcento(x.nome)) || s.includes(x.id));
  if (m || k) {
    const nome = m ? m.nome : k!.nome.toLowerCase();
    const filtro = (l: Lanc) => (m ? l.marca === m.id : l.cat === k!.id);
    const agora = doMes.filter(filtro), passado = mesmoPonto.filter(filtro);
    const total = agora.reduce((t, l) => t + l.valor, 0), totalAntes = passado.reduce((t, l) => t + l.valor, 0);
    if (!agora.length) return `Neste mês você ainda não gastou nada com ${nome}. No mês passado, até o dia ${dia}, tinham sido ${brl(totalAntes)}. Quer que eu avise quando aparecer o primeiro gasto?`;
    const dif = totalAntes ? Math.round(((total - totalAntes) / totalAntes) * 100) : 0;
    const comp = !totalAntes ? 'No mês passado, até hoje, não tinha nada.' : dif === 0 ? 'É o mesmo que no mês passado até hoje.' : `É ${Math.abs(dif)}% ${dif > 0 ? 'a mais' : 'a menos'} que no mês passado até hoje (${brl(totalAntes)}).`;
    return `Em ${MESES[hoje.getMonth()]} você gastou ${brl(total)} com ${nome}, em ${agora.length} ${agora.length === 1 ? 'vez' : 'vezes'}. ${comp} Em média, cada uma saiu por ${brl(total / agora.length)}.`;
  }
  const total = doMes.reduce((t, l) => t + l.valor, 0), totalAntes = mesmoPonto.reduce((t, l) => t + l.valor, 0);
  const porCat = new Map<string, number>();
  doMes.forEach((l) => porCat.set(l.cat, (porCat.get(l.cat) ?? 0) + l.valor));
  const top = [...porCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id, v]) => `${(CATEGORIAS.find((x) => x.id === id) ?? { nome: id }).nome} (${brl(v)})`);
  const dias = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const dif = totalAntes ? Math.round(((total - totalAntes) / totalAntes) * 100) : 0;
  return `Em ${MESES[hoje.getMonth()]} você gastou ${brl(total)} até agora, ${Math.abs(dif)}% ${dif > 0 ? 'a mais' : 'a menos'} que no mesmo ponto do mês passado. A maior parte foi em ${top.join(' e em ') || 'contas fixas'}. Se continuar nesse ritmo, o mês fecha perto de ${brl((total / Math.max(1, dia)) * dias)}.`;
}

export function responderBolinhaExemplo(texto: string, e: Estado | null): RespostaBolinha {
  const t = String(texto || '').trim();
  if (!t) return { tipo: 'erro', texto: 'Escreva o que você quer anotar ou perguntar.' };
  const s = semAcento(t);
  if (/^\s*(cancela|cancelar|esquece)\b/.test(s)) return { tipo: 'resposta', texto: 'Tudo bem, não anotei nada.' };
  const pergunta = /\?\s*$/.test(t) || /^(quanto|quantos|quantas|qual|quais|como|onde|quando|posso|devo|por que|o que|me diga|resumo)\b/.test(s);
  if (!pergunta && /\d/.test(s)) {
    const itens = entenderGastos(t);
    if (itens.length) return { tipo: 'gastos', texto: itens.length > 1 ? `Anoto estes ${itens.length} lançamentos?` : 'Anoto assim?', itens };
    return { tipo: 'erro', texto: 'Não peguei o valor. Ex.: “gastei 30 no uber”.' };
  }
  if (!e || !e.pessoal) return { tipo: 'erro', texto: 'Para anotar gastos, ligue o Pessoal em Perfil → Como você usa o app.' };
  return { tipo: 'resposta', texto: responderPergunta(t, e) };
}
