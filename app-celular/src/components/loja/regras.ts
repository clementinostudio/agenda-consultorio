// As contas da Loja que a tela faz sozinha: as tabelas do site (formas de pagamento, categorias de gasto, cédulas)
// já com as cores do app, quem é quem, os textos de "Mandar" (lista, resumo do dia, resumo do período) e as contas
// pequenas (troco, notas para o troco, o mês passado até o mesmo dia).
// As regras são as do site (@site/loja-contas.js): aqui só o que o retrato não traz pronto.
import { CATS_LOJA, CEDULAS as CEDULAS_SITE, PAGAMENTOS } from '@site/loja-contas.js';

import type { NomeIcone } from '@/components/icone';
import type { Paleta } from '@/constants/theme';
import { dataCurta, deIso, dinheiro, mesNome } from '@/lib/formato';
import type { Categoria, DadosLoja, PagLoja, ResumoLoja } from '@/lib/motor';

export const centavos = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
// Um id feito no app: o site aceita o id mandado, e repetir o pedido (depois de um "tempo esgotado") não duplica
export const novoId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const horaAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/* ---------- Formas de pagamento ---------- */

type InfoPag = { id: PagLoja; nome: string; curto: string; no: string; icone: NomeIcone | 'pix'; cor: (c: Paleta) => string };
const NO_PAG: Record<PagLoja, string> = { dinheiro: 'no dinheiro', pix: 'no Pix', debito: 'no débito', credito: 'no crédito' };
const COR_PAG: Record<PagLoja, (c: Paleta) => string> = { dinheiro: (c) => c.menta, pix: (c) => c.ciano, debito: (c) => c.azul, credito: (c) => c.roxo };
export const FORMAS: InfoPag[] = (PAGAMENTOS as { id: PagLoja; nome: string; curto: string }[]).map((p) => ({
  ...p, no: NO_PAG[p.id], icone: p.id === 'dinheiro' ? 'dinheiro' : p.id === 'pix' ? 'pix' : 'cartao', cor: COR_PAG[p.id],
}));
export const formaDe = (id: PagLoja) => FORMAS.find((f) => f.id === id) ?? FORMAS[0];

/* ---------- Categorias de gasto (as do site, com as cores do app) ---------- */

// A paleta do site (CORES em ../src/App.jsx), a mesma dos produtos do caixa
const CORES_SITE: Record<string, [string, string]> = {
  azul: ['#4A62FF', '#FFFFFF'], roxo: ['#8B6CFF', '#FFFFFF'], rosa: ['#FF6FA8', '#FFFFFF'], coral: ['#FF6B5E', '#FFFFFF'],
  laranja: ['#FF9A4C', '#2A1405'], amarelo: ['#FFC93D', '#2A1F00'], verde: ['#2FCB8E', '#04261A'], ciano: ['#3CC4E6', '#04232C'],
};
type CatSite = { id: string; nome: string; cor: string; ic: string; dica: string };
export type CatLoja = Categoria & { dica: string };
export const CATS: CatLoja[] = (CATS_LOJA as CatSite[]).map((k) => ({
  id: k.id, nome: k.nome, ic: k.ic, dica: k.dica, cor: (CORES_SITE[k.cor] ?? CORES_SITE.amarelo)[0], ink: (CORES_SITE[k.cor] ?? CORES_SITE.amarelo)[1],
}));
export const catDe = (id: string | null | undefined) => CATS.find((k) => k.id === id) ?? CATS[CATS.length - 1];
// "Outros" tem a mesma cor de "Gás e luz" no site: no gráfico, um cinza para não confundir
export const corNoGrafico = (id: string, c: Paleta) => (id === 'outros' ? c.fraco : catDe(id).cor);

/* ---------- Cédulas ---------- */

export const CEDULAS: number[] = CEDULAS_SITE as number[];
export const nomeCedula = (v: number) => (v >= 1 ? `R$ ${v}` : `${Math.round(v * 100)} centavos`);
export const curtoCedula = (v: number) => (v >= 1 ? String(v) : `0,${String(Math.round(v * 100)).padStart(2, '0')}`);

// As notas que o cliente pode entregar para um total: a primeira de cada tamanho que cobre o valor (ex.: R$ 13 → 15?
// não: 20, 50, 100). No máximo 3, sem o valor certo (esse é o botão "Valor certo").
export function notasParaTroco(total: number): number[] {
  if (!(total > 0)) return [];
  const r: number[] = [];
  for (const n of [5, 10, 20, 50, 100, 200]) if (n > total + 0.004 && r.length < 3) r.push(n);
  // uma soma redonda também ajuda (R$ 32 → 35 e 40), quando as notas grandes passam muito
  const dez = Math.ceil((total + 0.004) / 10) * 10;
  if (!r.includes(dez) && dez - total < 10 && dez < (r[0] ?? Infinity)) r.unshift(dez);
  return r.slice(0, 3);
}

/* ---------- Quem é quem ---------- */

export const primeiroNome = (nome: string) => (nome || '').trim().split(/\s+/)[0] || 'Alguém';
export const nomeDe = (L: Pick<DadosLoja, 'eu' | 'membros'>, id: string | null | undefined) =>
  !id ? 'Alguém' : id === L.eu ? 'Você' : primeiroNome(L.membros.find((m) => m.id === id)?.nome ?? '');
// A cor de cada pessoa da loja (avatar sem foto): você no laranja da Loja, os outros na ordem em que entraram
export function coresDaLoja(L: Pick<DadosLoja, 'eu' | 'membros'>, c: Paleta): Record<string, string> {
  const outras = [c.azul, c.roxo, c.ciano, c.rosa, c.menta];
  const r: Record<string, string> = {};
  let i = 0;
  for (const m of L.membros) r[m.id] = m.id === L.eu ? c.loja : outras[i++ % outras.length];
  return r;
}

/* ---------- Datas ---------- */

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// "sábado, 1 de nov."
export const diaDaLoja = (iso: string) => `${DIAS[deIso(iso).getDay()]}, ${dataCurta(iso)}`;

/* ---------- A lista do que falta ---------- */

// "2 leite condensado, copos; açúcar" → ["2 leite condensado", "copos", "açúcar"] (o site lê a quantidade)
export const separarFaltas = (t: string) => t.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 30);

/* ---------- Os textos de "Mandar" ---------- */

export function textoDaLista(L: DadosLoja) {
  const abertos = L.faltas.filter((x) => !x.feito);
  return `Está faltando na ${L.nome}:\n${abertos.map((x) => `• ${x.qtd > 1 ? `${x.qtd}× ` : ''}${x.texto}`).join('\n')}`;
}

// O resumo do caixa do dia (como o "Mandar o resumo do dia" do site)
export function textoDoCaixa(L: DadosLoja, f: { contado: number; esperado: number; deixou: number; quem: string }) {
  const T = L.hoje, dif = centavos(f.contado - f.esperado);
  const cartao = centavos(T.porPag.debito + T.porPag.credito);
  return [
    `${L.nome} · caixa de ${diaDaLoja(T.dia)}`,
    `Vendas: ${dinheiro(T.entrou)} (${T.vendas})`,
    `• Dinheiro: ${dinheiro(T.porPag.dinheiro)}`,
    `• Pix: ${dinheiro(T.porPag.pix)}`,
    `• Cartão: ${dinheiro(cartao)}`,
    T.saiu != null ? `Gastos: ${dinheiro(T.saiu)}` : null,
    `Na gaveta: ${dinheiro(f.contado)} (deveria ter ${dinheiro(f.esperado)}${Math.abs(dif) < 0.01 ? ', bateu' : dif > 0 ? `, sobrou ${dinheiro(dif)}` : `, faltou ${dinheiro(-dif)}`})`,
    `Troco para amanhã: ${dinheiro(f.deixou)}`,
    `Fechado por ${f.quem}`,
  ].filter(Boolean).join('\n');
}

export const qtdTexto = (q: number) => String(Math.round(q * 1000) / 1000).replace('.', ',');

export function textoDoResumo(L: DadosLoja, R: ResumoLoja, periodo: string) {
  return [
    `${L.nome}: resumo ${periodo}`,
    `Entrou: ${dinheiro(R.entrou)} (${R.vendas} ${R.vendas === 1 ? 'venda' : 'vendas'})`,
    `Gastos: ${dinheiro(R.saiu)}`,
    `Sobrou: ${dinheiro(R.sobrou)}`,
    R.top.length ? `Mais vendido: ${R.top[0].nome} (${qtdTexto(R.top[0].q)})` : null,
  ].filter(Boolean).join('\n');
}

/* ---------- O mês ---------- */

// O mês anterior até o mesmo dia (comparação justa): soma os dias do resumo do mês passado até "dia"
export function ateODia(R: ResumoLoja | null, dia: number) {
  if (!R) return null;
  const d = R.dias.filter((x) => Number(x.dia.slice(8, 10)) <= dia);
  return { entrou: centavos(d.reduce((s, x) => s + x.entrou, 0)), saiu: centavos(d.reduce((s, x) => s + x.saiu, 0)) };
}
// Acumulado por dia (para o gráfico): [dia 1, dia 1+2, ...] até "ate" dias
export function acumulado(R: ResumoLoja, campo: 'entrou' | 'saiu', ate: number) {
  const por = new Array<number>(ate).fill(0);
  for (const x of R.dias) { const i = Number(x.dia.slice(8, 10)) - 1; if (i >= 0 && i < ate) por[i] += x[campo]; }
  for (let i = 1; i < ate; i++) por[i] += por[i - 1];
  return por.map(centavos);
}
export const nomeDoMes = (ch: string) => `${maiuscula(mesNome(ch))} de ${ch.slice(0, 4)}`;
