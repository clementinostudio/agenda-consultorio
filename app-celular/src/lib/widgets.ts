// Os cartões do Início ("widgets"): quais aparecem e em que ordem. A pessoa escolhe em /widgets e fica guardado
// no aparelho. Cartão de uma área desligada (consultório, banco) não aparece mesmo se estiver na lista.
import { useSyncExternalStore } from 'react';

import type { Estado } from '@/lib/motor';

export type IdWidget =
  | 'bancos' // saldo em contas (Open Finance)
  | 'gastosMes' // gráfico do mês x mês passado
  | 'categorias' // gastos por categoria
  | 'recentes' // últimas movimentações
  | 'fluxo' // entrou x saiu (meia largura)
  | 'contas' // próximas contas fixas (meia largura)
  | 'tetos' // anéis dos tetos por categoria
  | 'caixinhas' // caixinhas e metas
  | 'consultorio' // hoje no consultório
  | 'combustivel' // posto mais barato perto
  | 'areas'; // atalhos para as áreas do Avina

export type InfoWidget = { id: IdWidget; nome: string; descricao: string; meia?: boolean; precisa?: (e: Estado) => boolean };

export const WIDGETS: InfoWidget[] = [
  { id: 'bancos', nome: 'Saldo em contas', descricao: 'Quanto tem em cada banco conectado', precisa: (e) => e.bancoLigado },
  { id: 'gastosMes', nome: 'Gastos do mês', descricao: 'O mês até hoje comparado com o mês passado', precisa: (e) => !!e.pessoal },
  { id: 'categorias', nome: 'Gastos por categoria', descricao: 'Para onde foi o dinheiro este mês', precisa: (e) => !!e.pessoal },
  { id: 'consultorio', nome: 'Hoje no consultório', descricao: 'Sessões de hoje, recebido e a receber', precisa: (e) => !!e.consultorio },
  { id: 'recentes', nome: 'Transações recentes', descricao: 'As últimas movimentações', precisa: (e) => !!e.pessoal },
  { id: 'fluxo', nome: 'Fluxo de caixa', descricao: 'Entrou e saiu no mês', meia: true, precisa: (e) => !!e.pessoal },
  { id: 'contas', nome: 'Contas a pagar', descricao: 'As contas fixas que vencem logo', meia: true, precisa: (e) => !!e.pessoal },
  { id: 'tetos', nome: 'Tetos do mês', descricao: 'Quanto já foi de cada teto por categoria', precisa: (e) => !!e.pessoal && Object.keys(e.pessoal.limites).length > 0 },
  { id: 'caixinhas', nome: 'Caixinhas', descricao: 'O que você está guardando', precisa: (e) => !!e.pessoal && e.pessoal.caixinhas.length > 0 },
  { id: 'combustivel', nome: 'Combustível agora', descricao: 'O posto mais barato perto de você' },
  { id: 'areas', nome: 'Áreas do Avina', descricao: 'Consultório, loja, casa, transporte e o resto' },
];

const PADRAO: IdWidget[] = ['bancos', 'gastosMes', 'consultorio', 'categorias', 'recentes', 'fluxo', 'contas', 'tetos', 'caixinhas', 'combustivel', 'areas'];
const K = 'avina-nativo-widgets';

type Escolha = { ordem: IdWidget[]; escondidos: IdWidget[] };
const valido = (x: unknown): x is IdWidget => WIDGETS.some((w) => w.id === x);

function ler(): Escolha {
  try {
    const g = JSON.parse(localStorage.getItem(K) || 'null') as Escolha | null;
    if (g && Array.isArray(g.ordem)) {
      const ordem = g.ordem.filter(valido);
      // cartões novos (de uma versão mais nova do app) entram no fim
      PADRAO.forEach((id) => { if (!ordem.includes(id)) ordem.push(id); });
      return { ordem, escondidos: (g.escondidos || []).filter(valido) };
    }
  } catch {}
  return { ordem: [...PADRAO], escondidos: [] };
}

let atual = ler();
const ouvintes = new Set<() => void>();
const ouvir = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export const useEscolhaWidgets = () => useSyncExternalStore(ouvir, () => atual);
export function mudarEscolhaWidgets(n: Escolha) {
  atual = n;
  try { localStorage.setItem(K, JSON.stringify(n)); } catch {}
  ouvintes.forEach((f) => f());
}
export const restaurarWidgets = () => mudarEscolhaWidgets({ ordem: [...PADRAO], escondidos: [] });

// Os cartões que o Início mostra agora, na ordem escolhida
export function widgetsVisiveis(e: Estado | null, escolha: Escolha): InfoWidget[] {
  if (!e) return [];
  return escolha.ordem
    .filter((id) => !escolha.escondidos.includes(id))
    .map((id) => WIDGETS.find((w) => w.id === id)!)
    .filter((w) => !w.precisa || w.precisa(e));
}
