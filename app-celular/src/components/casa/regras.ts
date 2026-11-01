// As contas da Nossa casa que a tela faz sozinha: quem é quem (nome e cor de cada pessoa), o mês da casa (o total, a
// parte de cada um e quanto cada um pagou), a comparação com o mês passado, a situação das contas da casa e a lista
// de compras por corredor. E, para as mudanças que o site ainda não confirmou, os saldos e as dívidas de novo.
// As regras são as do site (@site/casa-contas.js e @site/nota.js): aqui só o que o retrato não traz pronto.
import { partes as partesDoSite, pesosDe as pesosDoSite } from '@site/casa-contas.js';
import { juntarNaLista as juntarDoSite, lerItem as lerItemDoSite, nomeSecao as nomeSecaoDoSite, SECOES, secaoDe as secaoDoSite } from '@site/nota.js';

import type { Paleta } from '@/constants/theme';
import { chaveMes, dataCurta, diasNoMes, dinheiro, mesAnterior, mesNome, soma } from '@/lib/formato';
import type { ContaCasa, DadosCasa, GastoCasa, ItemCompra, SituacaoConta } from '@/lib/motor';

export const centavos = (v: number) => Math.round(v * 100) / 100;
export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Um id feito no app: o site aceita o id mandado, e repetir o pedido (depois de um "tempo esgotado") não duplica
export const novoId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---------- Quem é quem ---------- */

export const primeiroNome = (nome: string) => (nome || '').trim().split(/\s+/)[0] || 'Alguém';
// "Você" para a própria pessoa; os outros pelo primeiro nome
export const nomeDe = (C: Pick<DadosCasa, 'eu' | 'membros'>, id: string) => (id === C.eu ? 'Você' : primeiroNome(C.membros.find((m) => m.id === id)?.nome ?? ''));
// "Você e Ana", "Você, Ana e Rafa"
export function juntarNomes(nomes: string[]) {
  if (nomes.length < 2) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

// A cor de cada pessoa (a mesma no avatar, na barra da parte de cada um e na legenda): você no azul do Avina, os
// outros na ordem em que entraram na casa
export function coresDaCasa(C: Pick<DadosCasa, 'eu' | 'membros'>, c: Paleta): Record<string, string> {
  const outras = [c.roxo, c.ciano, c.ambar, c.rosa, c.menta];
  const r: Record<string, string> = {};
  let i = 0;
  for (const m of C.membros) r[m.id] = m.id === C.eu ? c.azul : outras[i++ % outras.length];
  return r;
}

// Para o topo: "dividem igual" ou "dividem 60% e 40%" (na ordem de quem mora, que é a dos avatares)
export function textoDivisaoCurto(C: DadosCasa) {
  const pcts = C.divisao.pcts;
  if (C.membros.length < 2) return '';
  if (C.divisao.modo !== 'proporcional' || !pcts) return 'dividem igual';
  return `dividem ${juntarNomes(C.membros.map((m) => `${Math.round(Number(pcts[m.id]) || 0)}%`))}`;
}

// "Dividem igual" ou "Você 60% · Ana 40%"
export function textoDivisao(C: DadosCasa) {
  const pcts = C.divisao.pcts;
  if (C.divisao.modo !== 'proporcional' || !pcts) return C.membros.length > 1 ? 'dividem igual' : '';
  return C.membros.map((m) => `${nomeDe(C, m.id)} ${Math.round(Number(pcts[m.id]) || 0)}%`).join(' · ');
}

/* ---------- A parte de cada um ---------- */

// A parte de cada um num gasto (com os pesos da casa, ou os do próprio gasto quando os participantes não mudaram)
export function partesDoGasto(C: DadosCasa, valor: number, participantes: string[], antes?: GastoCasa): Record<string, number> {
  const mesmos = !!antes && antes.participantes.length === participantes.length && antes.participantes.every((p) => participantes.includes(p));
  const pesos = mesmos && antes!.proporcional ? antes!.partes : (pesosDoSite(C.divisao, participantes) as Record<string, number> | undefined);
  const r = partesDoSite({ valor, participantes, pesos }, C.membros) as Record<string, number>;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, centavos(v)]));
}

/* ---------- Saldos e dívidas (para as mudanças que o site ainda não confirmou) ---------- */

type Saldo = Record<string, number>;

// O que um gasto muda nos saldos (sinal -1: o gasto sai). Quem pagou "adianta" o valor; cada um deve a sua parte.
export function somarGasto(s: Saldo, g: Pick<GastoCasa, 'valor' | 'pagou' | 'partes'>, sinal: 1 | -1) {
  if (!(g.pagou in s)) return;
  const ps = Object.entries(g.partes).filter(([p]) => p in s);
  if (!ps.length) return;
  s[g.pagou] += sinal * g.valor;
  for (const [p, v] of ps) s[p] -= sinal * v;
}
// Um acerto: quem pagou a dívida (de) para quem recebeu (para)
export function somarAcerto(s: Saldo, a: { de: string; para: string; valor: number }, sinal: 1 | -1) {
  if (!(a.de in s) || !(a.para in s)) return;
  s[a.de] += sinal * a.valor;
  s[a.para] -= sinal * a.valor;
}
// Quem deve para quem a partir dos saldos: o mesmo jeito de saldos() do site (quem deve mais paga primeiro a quem
// tem mais a receber, o menor número de transferências)
export function dividasDe(s: Saldo): DadosCasa['dividas'] {
  const dev = Object.entries(s).filter(([, v]) => v < -0.01).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const cred = Object.entries(s).filter(([, v]) => v > 0.01).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const r: DadosCasa['dividas'] = [];
  for (const d of dev) {
    for (const c of cred) {
      if (d.v < 0.01) break;
      if (c.v < 0.01) continue;
      const x = Math.min(d.v, c.v);
      r.push({ de: d.id, para: c.id, valor: centavos(x) });
      d.v -= x;
      c.v -= x;
    }
  }
  return r;
}

/* ---------- O mês da casa ---------- */

export type MesDaCasa = {
  chave: string;
  itens: GastoCasa[]; // do mais novo ao mais velho
  total: number;
  parte: Record<string, number>; // quanto cabe a cada um
  pagou: Record<string, number>; // quanto cada um pagou
};

export function resumoDoMes(C: DadosCasa, chave: string): MesDaCasa {
  const itens = C.gastos.filter((g) => g.data.startsWith(chave));
  const parte: Record<string, number> = {}, pagou: Record<string, number> = {};
  for (const m of C.membros) { parte[m.id] = 0; pagou[m.id] = 0; }
  for (const g of itens) {
    pagou[g.pagou] = (pagou[g.pagou] ?? 0) + g.valor;
    for (const [p, v] of Object.entries(g.partes)) parte[p] = (parte[p] ?? 0) + v;
  }
  return { chave, itens, total: soma(itens, (g) => g.valor), parte, pagou };
}

// Os meses que a lista mostra: o de agora e os 2 anteriores (o retrato traz os gastos de 3 meses)
export function mesesDaLista(hoje: string) {
  const a = chaveMes(hoje), b = mesAnterior(a);
  return [a, b, mesAnterior(b)];
}

// A comparação justa com o mês anterior: no mês de agora, até o mesmo dia (senão o mês corrente sempre "gasta menos")
export function compararMes(C: DadosCasa, mes: MesDaCasa, hoje: string) {
  const ant = mesAnterior(mes.chave);
  const atual = mes.chave === chaveMes(hoje);
  const ateDia = atual ? Number(hoje.slice(8, 10)) : 31;
  const doAnt = C.gastos.filter((g) => g.data.startsWith(ant));
  const totalAnt = atual
    ? soma(doAnt.filter((g) => Number(g.data.slice(8, 10)) <= ateDia), (g) => g.valor)
    : C.meses.find((m) => m.chave === ant)?.total ?? soma(doAnt, (g) => g.valor);
  const dif = mes.total - totalAnt;
  const ateQuando = atual ? ` até o dia ${ateDia}` : '';
  let frase: string;
  if (!mes.total && !totalAnt) frase = 'Nada anotado ainda';
  else if (!totalAnt) frase = `Nada anotado em ${mesNome(ant)}${ateQuando}`;
  else if (Math.abs(dif) < 1) frase = `Igual a ${mesNome(ant)}${ateQuando}`;
  else frase = `${dinheiro(Math.abs(dif), { centavos: false })} ${dif > 0 ? 'a mais' : 'a menos'} que ${mesNome(ant)}${ateQuando}`;
  return { ant, totalAnt, dif, frase, sobe: totalAnt > 0 && dif >= 1, desce: totalAnt > 0 && dif <= -1 };
}

/* ---------- Contas da casa ---------- */

// A situação no mês de agora (as mesmas cores das Contas fixas): ≤ 5 dias para vencer é "breve"
export function situacaoContaCasa(k: ContaCasa, hoje: string): { st: SituacaoConta; dias: number } {
  if (k.paga) return { st: 'paga', dias: 0 };
  const vence = Math.min(k.dia, diasNoMes(chaveMes(hoje)));
  const dias = vence - Number(hoje.slice(8, 10));
  return { st: dias < 0 ? 'atrasada' : dias === 0 ? 'hoje' : dias <= 5 ? 'breve' : 'ok', dias };
}
export function textoContaCasa(C: DadosCasa, k: ContaCasa, hoje: string) {
  const { st, dias } = situacaoContaCasa(k, hoje);
  if (st === 'paga' && k.paga) return `Paga por ${k.paga.por === C.eu ? 'você' : nomeDe(C, k.paga.por)} · ${dataCurta(k.paga.data)}`;
  if (st === 'atrasada') return dias === -1 ? 'Venceu ontem' : `Venceu há ${-dias} dias`;
  if (st === 'hoje') return 'Vence hoje';
  if (st === 'breve') return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
  return `Vence dia ${k.dia}`;
}

/* ---------- Lista de compras ---------- */

const ORDEM: Record<string, number> = Object.fromEntries([...(SECOES as [string, string, RegExp][]).map((s) => s[0]), 'outros'].map((s, i) => [s, i]));
export const nomeSecao = (id: string) => nomeSecaoDoSite(id) as string;
export const secaoDe = (texto: string) => secaoDoSite(texto) as string;

export type GrupoLista = { secao: string; nome: string; itens: ItemCompra[] };
export type ListaOrganizada = { abertos: ItemCompra[]; feitos: ItemCompra[]; grupos: GrupoLista[]; estimado: number; comPreco: number };

// A lista na ordem em que se anda no mercado (por corredor, e na ordem em que foram colocados); os comprados no fim
export function organizarLista(compras: ItemCompra[]): ListaOrganizada {
  const abertos = compras.filter((x) => !x.feito).sort((a, b) => (ORDEM[a.secao] ?? 99) - (ORDEM[b.secao] ?? 99) || (a.criado ?? 0) - (b.criado ?? 0));
  const feitos = compras.filter((x) => x.feito).sort((a, b) => (a.criado ?? 0) - (b.criado ?? 0));
  const grupos: GrupoLista[] = [];
  for (const x of abertos) {
    const g = grupos[grupos.length - 1];
    if (g && g.secao === x.secao) g.itens.push(x); else grupos.push({ secao: x.secao, nome: nomeSecao(x.secao), itens: [x] });
  }
  const comPreco = abertos.filter((x) => x.preco);
  return { abertos, feitos, grupos, estimado: soma(comPreco, (x) => x.preco!.total), comPreco: comPreco.length };
}

// "2 leite, pão; café" → [{ texto: 'leite', qtd: 2 }, { texto: 'pão', qtd: 1 }, ...] (o mesmo do site: lerItem)
export function lerTextoDaLista(t: string): { texto: string; qtd: number }[] {
  return t.split(/[,;\n]+/).map((s) => lerItemDoSite(s.trim()) as { texto: string; qtd: number })
    .map((x) => ({ texto: x.texto.trim().slice(0, 80), qtd: Math.min(99, Math.max(1, Math.round(x.qtd) || 1)) }))
    .filter((x) => x.texto);
}

// Como a lista fica depois de colocar estes itens (juntarNaLista do site: o que já está não repete, soma a quantidade)
// mudados: os itens que já estavam, com a quantidade nova; novos: os que entram (ainda sem id)
export function juntarNaLista(compras: ItemCompra[], novos: { texto: string; qtd: number; obs?: string }[], somar: boolean, eu: string) {
  type Juntar = (c: ItemCompra[], n: typeof novos, o: { somar: boolean; eu: string }) => { salvar: (Partial<ItemCompra> & { texto: string; qtd: number; obs?: string })[] };
  const r = (juntarDoSite as unknown as Juntar)(compras, novos, { somar, eu });
  return {
    mudados: r.salvar.filter((x) => x.id) as ItemCompra[],
    novos: r.salvar.filter((x) => !x.id),
  };
}

// "6× Leite"
export const textoItem = (x: Pick<ItemCompra, 'texto' | 'qtd'>) => `${x.qtd > 1 ? `${x.qtd}× ` : ''}${x.texto}`;
