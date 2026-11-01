// Prévia no navegador: a conta de exemplo que a camada do site de mentira (components/camada-web.web.tsx) manda para
// as telas nativas, no mesmo formato do retrato do site (retratoNativo em ../src/App.jsx). Só entra no build web: o
// celular nunca carrega este arquivo.
// - Os dados são sempre os mesmos (sorteio com semente) e andam com a data de hoje da página (o tirar.mjs dos prints
//   congela o relógio num dia do meio do mês, para os gráficos terem o que mostrar).
// - Parâmetros da URL: ?tema=dark|light|auto (padrão dark) · ?vazio=1 (conta nova, sem lançamentos) · ?logado=0
//   (sem login: o site fica na frente) · ?casa=sem|erro|carregando|indisponivel (a Nossa casa nesse estado).
// - Contas fixas, Transporte (o Onix e os apps) e Nossa casa (Felipe e Ana, 60/40) vêm com os campos novos do retrato
//   e Estado.recursos com as três telas nativas.
import { partes, saldos } from '@site/casa-contas.js';
import { acharMarca, marcaPorId } from '@site/marcas.js';
import { secaoDe } from '@site/nota.js';
import { subDe } from '@site/transporte.js';

import { SERVIDOR } from '@/lib/ambiente';
import type {
  AcertoCasa, BancoConectado, Caixinha, CasaRetrato, Categoria, ContaBanco, ContaFixa, Estado, GastoCasa, Investimento, Lanc, MembroCasa,
  MesTransp, Recurso, RespostaBolinha, ResumoBanco, SubTransp, TemaEscolhido, Transporte, Veiculo,
} from '@/lib/motor';

/* ---------- Os parâmetros da URL ---------- */

const busca = (() => { try { return new URLSearchParams(globalThis.location?.search || ''); } catch { return new URLSearchParams(); } })();
const temaPedido = busca.get('tema');
const casaPedida = busca.get('casa');
export const PREVIA = {
  tema: (temaPedido === 'light' || temaPedido === 'auto' ? temaPedido : 'dark') as TemaEscolhido,
  vazio: busca.get('vazio') === '1',
  logado: busca.get('logado') !== '0',
  casa: (['sem', 'erro', 'carregando', 'indisponivel'].includes(casaPedida || '') ? casaPedida : null) as CasaRetrato['estado'] | null,
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
    // as manutenções do Onix (a troca de óleo e o rodízio alimentam os lembretes do Transporte)
    if (n === 34) pos({ tipo: 'saida', valor: 289.9, data, cat: 'transporte', desc: 'Troca de óleo', marca: null }, null);
    if (n === 61) pos({ tipo: 'saida', valor: 140, data, cat: 'transporte', desc: 'Alinhamento e balanceamento', marca: null }, null);
  }
  // do mais novo para o mais velho; o id l1 é o mais recente (para abrir /lancamento/l1 nos prints)
  return comTransporte(lista
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.data === b.l.data ? b.i - a.i : a.l.data < b.l.data ? 1 : -1))
    .map(({ l }, i) => ({ id: `l${i + 1}`, ...l })));
}

/* ---------- As contas fixas (como retratoNativo manda: a situação do mês e os pagamentos de 12 meses) ---------- */

const isoMais = (s: string, n: number) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const diffDias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / 864e5);
const mesAtras = (hoje: Date, k: number) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1); return { a: d.getFullYear(), m: d.getMonth(), ch: `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }; };
const venceNo = (a: number, m: number, dia: number) => `${a}-${pad(m + 1)}-${pad(dentroDoMes(a, m, dia))}`;

type MoldeConta = {
  id: string; nome: string; valor: number; dia: number; cat: string; marca?: string; assinatura?: boolean;
  codigo?: string; moeda?: string; valorOrig?: number; transp?: ContaFixa['transp'];
  desde?: number; // há quantos meses começou (padrão: 11, o ano todo)
  antes?: number; // paga quantos dias antes do vencimento
  atraso?: Record<number, number | null>; // k meses atrás → dias de atraso (null: ficou sem pagar)
  aberta?: boolean; // ainda não foi paga neste mês, mesmo vencida
};
const CONTAS: MoldeConta[] = [
  { id: 'cf1', nome: 'Aluguel', valor: 2800, dia: 5, cat: 'casa', antes: 1 },
  { id: 'cf2', nome: 'Condomínio', valor: 680, dia: 10, cat: 'casa', antes: 2 },
  { id: 'cf3', nome: 'Conta de luz', valor: 212.4, dia: 12, cat: 'casa', marca: 'enel', codigo: '83650000002-3 12400138001-8 10052026110-3 47318822601-4', atraso: { 3: 4 }, aberta: true },
  { id: 'cf4', nome: 'Água', valor: 96.3, dia: 15, cat: 'casa', marca: 'sanepar', codigo: '82680000000-9 96300072100-4 24600110526-7 11202611000-5', atraso: { 0: 1, 1: 2, 5: 1 } },
  { id: 'cf5', nome: 'Vivo Fibra', valor: 129.9, dia: 25, cat: 'casa', marca: 'vivo' },
  { id: 'cf6', nome: 'Smart Fit', valor: 129.9, dia: 10, cat: 'saude', marca: 'smartfit', assinatura: true },
  { id: 'cf7', nome: 'Netflix', valor: 44.9, dia: 28, cat: 'lazer', marca: 'netflix', assinatura: true, desde: 5 },
  { id: 'cf8', nome: 'Spotify', valor: 21.9, dia: 8, cat: 'lazer', marca: 'spotify', assinatura: true },
  { id: 'cf9', nome: 'iCloud+', valor: 16.71, dia: 18, cat: 'compras', marca: 'apple', assinatura: true, moeda: 'USD', valorOrig: 2.99 },
  { id: 'cf10', nome: 'Seguro do carro', valor: 189.5, dia: 20, cat: 'transporte', marca: 'porto', transp: { sub: 'documentos', veiculoId: 'v1' } },
  { id: 'cf11', nome: 'Unimed', valor: 612.4, dia: 30, cat: 'saude', marca: 'unimed', atraso: { 7: null } },
];

// A situação de uma conta no mês (situacaoConta do site): paga, atrasada, vence hoje, breve (até 5 dias) ou ok
export function situacaoDe(vence: string, pagaEm: string | null | undefined, hoje: string) {
  const dias = diffDias(hoje, vence);
  const st: ContaFixa['st'] = pagaEm ? 'paga' : dias < 0 ? 'atrasada' : dias === 0 ? 'hoje' : dias <= 5 ? 'breve' : 'ok';
  return { st, dias };
}

function contasFixas(hoje: Date): ContaFixa[] {
  const h = iso(hoje);
  return CONTAS.map((k) => {
    const pagas: Record<string, string> = {};
    for (let i = Math.min(11, k.desde ?? 11); i >= 0; i--) {
      const { a, m, ch } = mesAtras(hoje, i);
      const atraso = k.atraso && i in k.atraso ? k.atraso[i] : 0;
      if (atraso === null || (i === 0 && k.aberta)) continue;
      const quando = isoMais(venceNo(a, m, k.dia), atraso || -(k.antes ?? 0));
      if (quando <= h) pagas[ch] = quando;
    }
    const { a, m, ch } = mesAtras(hoje, 0);
    const vence = venceNo(a, m, k.dia);
    const pagaEm = pagas[ch] ?? null;
    return {
      id: k.id, nome: k.nome, valor: k.valor, dia: k.dia, cat: k.cat, paga: !!pagaEm, vence, assinatura: !!k.assinatura,
      ...(k.marca ? logoDe(k.nome, k.marca) : { marca: null, site: null }),
      ...situacaoDe(vence, pagaEm, h), pagaEm, pagas,
      codigo: k.codigo ?? null,
      ...(k.moeda ? { moeda: k.moeda, valorOrig: k.valorOrig ?? null, iof: true } : {}),
      ...(k.transp ? { transp: k.transp } : {}),
    };
  });
}

/* ---------- Transporte: o Onix e os apps (Uber, 99), com os preços da semana ---------- */

const COMB_PRECO: Record<'gasolina' | 'etanol', [number, number]> = { gasolina: [6.09, 6.39], etanol: [4.09, 4.39] };
const KM_INICIO = 41200; // o painel do Onix no primeiro dia da conta de exemplo
const CONSUMO = 12.4;

// Os campos de transporte dos lançamentos (como retratoNativo manda): a subcategoria, de qual veículo e, nos
// abastecimentos, os litros, o preço do litro e o km do painel (andando com o consumo de verdade)
function comTransporte(lanc: Lanc[]): Lanc[] {
  const s = sorteio(7310);
  let km = KM_INICIO;
  const doMaisVelho = [...lanc].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const extra = new Map<string, Lanc['transp']>();
  for (const l of doMaisVelho) {
    if (l.cat !== 'transporte') continue;
    const sub = subDe(l) as SubTransp;
    const veiculoId = sub === 'app' || sub === 'publico' ? 'v2' : 'v1';
    if (sub === 'combustivel') {
      const comb = s.r() < 0.3 ? 'etanol' : 'gasolina';
      const precoLitro = Math.round((COMB_PRECO[comb][0] + s.r() * (COMB_PRECO[comb][1] - COMB_PRECO[comb][0])) * 1000) / 1000;
      const litros = Math.round((l.valor / precoLitro) * 100) / 100;
      km += Math.round(litros * (comb === 'etanol' ? CONSUMO * 0.7 : CONSUMO));
      extra.set(l.id, { sub, veiculoId, litros, precoLitro, combustivel: comb, km });
    } else if (sub === 'manutencao') {
      extra.set(l.id, { sub, veiculoId, km: km + 40, manut: /alinhamento/i.test(l.desc) ? 'alinhamento' : /óleo|oleo/i.test(l.desc) ? 'oleo' : 'revisao' });
    } else extra.set(l.id, { sub, veiculoId });
  }
  return lanc.map((l) => (extra.has(l.id) ? { ...l, transp: extra.get(l.id) } : l));
}

function transporteExemplo(hoje: Date, lanc: Lanc[], contas: ContaFixa[]): Transporte {
  const h = iso(hoje);
  const s = sorteio(2026);
  const meses12 = Array.from({ length: 12 }, (_, i) => mesAtras(hoje, 11 - i).ch);
  const doTransp = lanc.filter((l) => l.cat === 'transporte' && l.tipo === 'saida' && l.transp);
  const primeiroMesCheio = mesAtras(hoje, 2).ch; // os lançamentos de exemplo cobrem os 2 meses anteriores inteiros
  // um mês: dos lançamentos (os 3 mais novos) ou inventado com a mesma cara (os mais velhos)
  const mesDe = (ch: string, veiculo: string | null): MesTransp => {
    const porSub: MesTransp['porSub'] = {};
    const somar = (sub: SubTransp, v: number) => { const x = porSub[sub] ?? { total: 0, n: 0 }; x.total = centavos(x.total + v); x.n += 1; porSub[sub] = x; };
    if (ch >= primeiroMesCheio) {
      doTransp.filter((l) => l.data.startsWith(ch) && (!veiculo || l.transp!.veiculoId === veiculo)).forEach((l) => somar(l.transp!.sub, l.valor));
      contas.filter((c) => c.transp && c.pagas?.[ch] && (!veiculo || c.transp.veiculoId === veiculo)).forEach((c) => somar(c.transp!.sub, c.valor));
    } else {
      if (!veiculo || veiculo === 'v1') {
        for (let i = 0; i < 2; i++) somar('combustivel', s.preco(190, 250));
        if (s.r() < 0.6) somar('combustivel', s.preco(150, 230));
        for (let i = 0; i < 3; i++) if (s.r() < 0.7) somar('estacionamento', s.preco(15, 30));
        somar('documentos', 189.5);
        if (s.r() < 0.25) somar('manutencao', s.preco(120, 480));
      }
      if (!veiculo || veiculo === 'v2') for (let i = 0; i < 8; i++) if (s.r() < 0.8) somar('app', s.preco(14, 42));
    }
    return { chave: ch, total: centavos(Object.values(porSub).reduce((t, x) => t + (x?.total ?? 0), 0)), porSub };
  };
  const abast = doTransp.filter((l) => l.transp!.sub === 'combustivel').sort((a, b) => (a.data < b.data ? 1 : -1));
  const ultimo = abast[0];
  const km = Math.max(KM_INICIO, ...doTransp.map((l) => l.transp!.km ?? 0));
  const oleo = doTransp.find((l) => l.transp!.manut === 'oleo');
  const rodizio = doTransp.find((l) => l.transp!.manut === 'alinhamento');
  const litros = abast.reduce((t, l) => t + (l.transp!.litros ?? 0), 0);
  const gastoComb = abast.reduce((t, l) => t + l.valor, 0);
  const lembrete = (ultima: Lanc | undefined, cadaKm: number, cadaMeses: number) => {
    if (!ultima) return null;
    const kmUlt = ultima.transp!.km ?? km;
    const d = new Date(`${ultima.data}T12:00:00`); d.setMonth(d.getMonth() + cadaMeses);
    const ate = iso(d), proxKm = kmUlt + cadaKm, faltamKm = proxKm - km, faltamDias = diffDias(h, ate);
    return { ate, proxKm, faltamKm, faltamDias, urgente: faltamKm < 800 || faltamDias < 20, ultima: { data: ultima.data, km: kmUlt } };
  };
  const ano = hoje.getFullYear();
  const doc = (k: 'ipva' | 'licenc' | 'seguro', nome: string, data: string, valor: number) => ({ k, nome, data, valor, dias: diffDias(h, data) });
  const porSub12 = meses12.map((ch) => mesDe(ch, 'v1'));
  const somaSub = (sub: SubTransp) => centavos(porSub12.reduce((t, m) => t + (m.porSub[sub]?.total ?? 0), 0));
  const totalAno = centavos(porSub12.reduce((t, m) => t + m.total, 0));
  const postos = ['Posto Shell', 'Posto Ipiranga'].map((nome) => {
    const doPosto = abast.filter((l) => l.desc === nome);
    const lt = doPosto.reduce((t, l) => t + (l.transp!.litros ?? 0), 0), gasto = doPosto.reduce((t, l) => t + l.valor, 0);
    return { nome, n: doPosto.length, gasto: centavos(gasto), litros: centavos(lt), preco: lt ? Math.round((gasto / lt) * 1000) / 1000 : null, ultimo: doPosto[0]?.data ?? h };
  }).filter((p) => p.n > 0);
  const onix: Veiculo = {
    id: 'v1', nome: 'Onix', tipo: 'carro', combustivel: 'flex', desenho: 'carro-hatch', fotoK: null, km,
    consumo: CONSUMO, consumoReal: true, precoPago: litros ? Math.round((gastoComb / litros) * 1000) / 1000 : null, custoKm: litros ? centavos(gastoComb / (litros * CONSUMO)) : null,
    ultimoAbast: ultimo ? { data: ultimo.data, litros: ultimo.transp!.litros ?? 0, precoLitro: ultimo.transp!.precoLitro ?? null, combustivel: ultimo.transp!.combustivel ?? null, km: ultimo.transp!.km ?? null, desc: ultimo.desc } : null,
    fipe: { valor: 'R$ 72.340,00', mes: `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][hoje.getMonth()]} de ${ano}`, modelo: 'Onix Hatch LT 1.0 12V Flex 5p Mec.' },
    oleo: lembrete(oleo, 10000, 12),
    rodizio: lembrete(rodizio, 10000, 12),
    oleoKm: 10000, oleoMeses: 12,
    docs: [
      doc('ipva', 'IPVA', `${ano + 1}-01-20`, 1380.6),
      doc('licenc', 'Licenciamento', `${ano + 1}-03-18`, 160.22),
      doc('seguro', 'Seguro', isoMais(h, 47), 2274),
    ],
    custo: {
      total: totalAno, porMes: centavos(totalAno / 12), porDia: centavos(totalAno / 365), nMeses: 12,
      porKm: centavos(totalAno / 14800), rodados: 14800,
      porSub: { combustivel: somaSub('combustivel'), manutencao: somaSub('manutencao'), estacionamento: somaSub('estacionamento'), documentos: somaSub('documentos') },
      perdeu: { valor: 4860, desde: mesAtras(hoje, 12).ch },
    },
    appRef: { valor: 24, km: 8 },
    postos,
    meses: porSub12,
  };
  const apps: Veiculo = {
    id: 'v2', nome: 'Apps e transporte público', tipo: 'nenhum', combustivel: null, desenho: 'onibus', fotoK: null, km: null,
    consumo: null, consumoReal: false, precoPago: null, custoKm: null, ultimoAbast: null, fipe: null, oleo: null, rodizio: null,
    oleoKm: 10000, oleoMeses: 12, docs: [], custo: null, appRef: null, postos: [],
    meses: meses12.map((ch) => mesDe(ch, 'v2')),
  };
  // a semana da ANP: de domingo a sábado, a anterior à de hoje
  const fim = isoMais(h, -hoje.getDay() - 1);
  return {
    veiculos: [onix, apps],
    meses: meses12.map((ch, i) => {
      const a = onix.meses![i], b = apps.meses![i];
      const porSub: MesTransp['porSub'] = { ...a.porSub };
      Object.entries(b.porSub).forEach(([k, v]) => { if (v) porSub[k as SubTransp] = v; });
      return { chave: ch, total: centavos(a.total + b.total), porSub };
    }),
    precos: { p: { gasolina: 6.29, aditivada: 6.49, etanol: 4.19, diesel: 6.07, gnv: 4.79 }, onde: 'cidade', nome: 'Curitiba', ini: isoMais(fim, -6), fim, em: Date.now() - 2 * 864e5 },
    cidade: 'Curitiba',
  };
}

/* ---------- Nossa casa: Felipe e Ana, dividindo 60/40 ---------- */

const EU = 'exemplo'; // o uid da conta de exemplo
const ANA = 'm-ana';
const MEMBROS: MembroCasa[] = [
  { id: EU, nome: 'Felipe', papel: 'dono', foto: null, fotoK: null },
  { id: ANA, nome: 'Ana', papel: 'membro', foto: null, fotoK: null },
];
const PCTS = { [EU]: 60, [ANA]: 40 };

type MoldeGastoCasa = { desc: string; cat: string; min: number; max: number; dia: number; quem: 'eu' | 'ana' | 'vez'; nota?: number };
const GASTOS_CASA: MoldeGastoCasa[] = [
  { desc: 'Carrefour', cat: 'mercado', min: 380, max: 520, dia: 3, quem: 'eu', nota: 34 },
  { desc: 'Hortifruti', cat: 'mercado', min: 60, max: 110, dia: 6, quem: 'ana' },
  { desc: 'Padaria Real', cat: 'mercado', min: 18, max: 36, dia: 9, quem: 'vez' },
  { desc: 'Assaí', cat: 'mercado', min: 240, max: 360, dia: 14, quem: 'ana', nota: 21 },
  { desc: 'Gás', cat: 'casa', min: 118, max: 118, dia: 15, quem: 'eu' },
  { desc: 'Drogasil', cat: 'saude', min: 40, max: 95, dia: 17, quem: 'ana' },
  { desc: 'Pão de Açúcar', cat: 'mercado', min: 120, max: 210, dia: 20, quem: 'eu', nota: 12 },
  { desc: 'Pizza de sexta', cat: 'comida', min: 78, max: 96, dia: 24, quem: 'vez' },
  { desc: 'Leroy Merlin', cat: 'casa', min: 90, max: 260, dia: 27, quem: 'ana' },
];

function casaExemplo(hoje: Date): CasaRetrato {
  const s = sorteio(4242);
  const h = iso(hoje);
  const gastos: GastoCasa[] = [];
  for (let k = 2; k >= 0; k--) {
    const { a, m, ch } = mesAtras(hoje, k);
    GASTOS_CASA.forEach((g, i) => {
      const data = venceNo(a, m, g.dia);
      const valor = s.preco(g.min, g.max);
      if (data > h) return;
      const pagou = g.quem === 'eu' ? EU : g.quem === 'ana' ? ANA : (i + k) % 2 ? EU : ANA;
      const base = { valor, participantes: [EU, ANA], pesos: PCTS };
      gastos.push({
        id: `gc-${ch}-${i}`, valor, desc: g.desc, cat: g.cat, data, criado: Date.parse(`${data}T19:00:00`), pagou, autor: pagou,
        participantes: [EU, ANA], partes: partes(base, MEMBROS) as Record<string, number>, proporcional: true,
        contaId: null, origem: null,
        nota: g.nota ? { loja: g.desc, itens: g.nota, fonte: 'sefaz', temFoto: false, temLink: true } : null,
      });
    });
    // a diarista (conta da casa), paga pela Ana no dia 5
    const dDiarista = venceNo(a, m, 5);
    if (dDiarista <= h) {
      gastos.push({
        id: `gc-${ch}-diarista`, valor: 480, desc: 'Diarista', cat: 'casa', data: dDiarista, criado: Date.parse(`${dDiarista}T09:00:00`), pagou: ANA, autor: ANA,
        participantes: [EU, ANA], partes: partes({ valor: 480, participantes: [EU, ANA], pesos: PCTS }, MEMBROS) as Record<string, number>, proporcional: true,
        contaId: 'cc1', origem: null, nota: null,
      });
    }
  }
  gastos.sort((x, y) => (x.data < y.data ? 1 : x.data > y.data ? -1 : 0));
  const acertos: AcertoCasa[] = [{ id: 'ac1', de: ANA, para: EU, valor: 180, data: isoMais(h, -24), criado: Date.parse(`${isoMais(h, -24)}T20:00:00`) }];
  const sd = saldos(gastos.map((g) => ({ valor: g.valor, pagou: g.pagou, participantes: g.participantes, pesos: PCTS })), acertos, MEMBROS) as { saldo: Record<string, number>; dividas: { de: string; para: string; valor: number }[] };
  const ch = mesAtras(hoje, 0).ch;
  const pagaDiarista = gastos.find((g) => g.contaId === 'cc1' && g.data.startsWith(ch));
  const item = (id: string, texto: string, qtd: number, feito = false, preco?: [number, string]) => ({
    id, texto, qtd, obs: null, secao: secaoDe(texto) as string, feito, por: feito ? ANA : null, autor: EU, criado: Date.now() - 3 * 864e5,
    preco: preco && !feito ? { unit: preco[0], total: centavos(preco[0] * qtd), loja: preco[1], data: isoMais(h, -12) } : null,
  });
  const meses = Array.from({ length: 6 }, (_, i) => {
    const c = mesAtras(hoje, 5 - i).ch;
    const doMes = gastos.filter((g) => g.data.startsWith(c));
    return { chave: c, total: doMes.length ? centavos(doMes.reduce((t, g) => t + g.valor, 0)) : centavos(1500 + s.r() * 700) };
  });
  return {
    estado: 'ok', nuvem: true,
    casa: {
      id: 'casa-exemplo', nome: 'Apê da Augusta', dono: EU, eu: EU, souDono: true, max: 5,
      membros: MEMBROS,
      divisao: { modo: 'proporcional', pcts: PCTS },
      saldo: sd.saldo, dividas: sd.dividas,
      gastos, meses, acertos,
      contas: [
        { id: 'cc1', nome: 'Diarista', valor: 480, dia: 5, cat: 'casa', paga: pagaDiarista ? { por: ANA, data: pagaDiarista.data, gastoId: pagaDiarista.id } : null },
        { id: 'cc2', nome: 'Gás', valor: 118, dia: 15, cat: 'casa', paga: null },
        { id: 'cc3', nome: 'Internet da casa', valor: 99.9, dia: 22, cat: 'casa', paga: null },
      ],
      compras: [
        item('i1', 'Leite', 6, false, [4.89, 'Assaí']),
        item('i2', 'Pão de forma', 1, false, [8.99, 'Carrefour']),
        item('i3', 'Café', 2, false, [18.9, 'Carrefour']),
        item('i4', 'Banana', 1),
        item('i5', 'Tomate', 1, false, [7.98, 'Hortifruti']),
        item('i6', 'Frango', 1, false, [21.9, 'Assaí']),
        item('i7', 'Detergente', 3, true),
        item('i8', 'Papel higiênico', 1, false, [22.9, 'Pão de Açúcar']),
        item('i9', 'Ração do Thor', 1, false, [89.9, 'Petz']),
        item('i10', 'Iogurte', 4, true),
      ],
      listaLimite: 300,
      modelos: [
        { id: 'md1', nome: 'Compra do mês', itens: [{ texto: 'Arroz', qtd: 1 }, { texto: 'Feijão', qtd: 2 }, { texto: 'Café', qtd: 2 }, { texto: 'Leite', qtd: 6 }, { texto: 'Papel higiênico', qtd: 1 }] },
        { id: 'md2', nome: 'Churrasco', itens: [{ texto: 'Picanha', qtd: 1 }, { texto: 'Linguiça', qtd: 1 }, { texto: 'Pão de alho', qtd: 2 }, { texto: 'Cerveja', qtd: 12 }] },
      ],
      mercado: {
        mes: centavos(gastos.filter((g) => g.cat === 'mercado' && g.data.startsWith(ch)).reduce((t, g) => t + g.valor, 0)),
        notas: gastos.filter((g) => g.nota && g.data.startsWith(ch)).length,
        mudou: [
          { nome: 'Café', de: { unit: 16.9, loja: 'Carrefour', data: isoMais(h, -40) }, para: { unit: 18.9, loja: 'Carrefour', data: isoMais(h, -12) }, pct: 11.8 },
          { nome: 'Leite', de: { unit: 5.29, loja: 'Pão de Açúcar', data: isoMais(h, -38) }, para: { unit: 4.89, loja: 'Assaí', data: isoMais(h, -9) }, pct: -7.6 },
          { nome: 'Azeite', de: { unit: 39.9, loja: 'Carrefour', data: isoMais(h, -45) }, para: { unit: 44.9, loja: 'Carrefour', data: isoMais(h, -12) }, pct: 12.5 },
        ],
      },
      pix: 'felipe@exemplo.com',
    },
  };
}

// As telas nativas que o "site" da prévia atende (Estado.recursos)
export const RECURSOS: Recurso[] = ['contas2', 'transporte', 'casa'];

/* ---------- O resto do retrato ---------- */

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
  // ?casa=sem|erro|carregando|indisponivel: a Nossa casa nesse estado (para ver cada tela dela)
  const casaNoEstado = (estado: CasaRetrato['estado']): CasaRetrato => ({ estado, nuvem: true, casa: null });
  if (vazio) {
    return {
      ...base,
      pessoal: { lanc: [], contas: [], caixinhas: [], limites: {}, renda: null },
      consultorio: { hoje: [], recebidoMes: 0, aReceber: 0, sessoesMes: 0, faltasMes: 0, pacientesAtivos: 0 },
      transporte: { veiculos: [], meses: [], precos: null, cidade: null },
      casa: casaNoEstado(PREVIA.casa ?? 'sem'),
      recursos: RECURSOS,
    };
  }
  const lanc = lancamentos(hoje);
  const contas = contasFixas(hoje);
  return {
    ...base,
    pessoal: { lanc, contas, caixinhas: CAIXINHAS, limites: { comida: 900, lazer: 350, compras: 600 }, renda: null },
    transporte: transporteExemplo(hoje, lanc, contas),
    casa: PREVIA.casa ? casaNoEstado(PREVIA.casa) : casaExemplo(hoje),
    recursos: RECURSOS,
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
  servidor: SERVIDOR, bancoLigado: false, categorias: [], catEntrada: [], pessoal: null, consultorio: null, transporte: null, casa: null,
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
