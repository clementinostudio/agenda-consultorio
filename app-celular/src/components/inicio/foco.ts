// A área em foco no Início (Consultório ou Pessoal): a pessoa troca nos chips do topo (troca-area.tsx) e a escolha fica
// guardada no aparelho.
// - Sem escolha guardada: a área aberta no site (Estado.modo) ou a primeira ligada (Estado.modos). Uma escolha de uma
//   área que foi desligada depois não vale mais (volta para o padrão).
// - A Loja ainda não tem tela nativa: tocar nela abre a loja no site e o foco do Início não muda.
// - O foco muda a ordem e o destaque, nunca esconde um cartão que a pessoa ligou em /widgets: os da área em foco (e os
//   que são de todas, como "Áreas do Avina") vêm primeiro, na ordem dela; os da outra área vão para o fim, debaixo de
//   um título com o nome da área (separarPorFoco).
import { useSyncExternalStore } from 'react';

import type { Estado, Modo } from '@/lib/motor';
import type { IdWidget, InfoWidget } from '@/lib/widgets';

export type AreaFoco = 'consultorio' | 'pessoal';

const K = 'avina-nativo-area-inicio';
const valida = (v: unknown): v is AreaFoco => v === 'consultorio' || v === 'pessoal';

function ler(): AreaFoco | null {
  try { const v = localStorage.getItem(K); return valida(v) ? v : null; } catch { return null; }
}

let guardada = ler();
const ouvintes = new Set<() => void>();
const ouvir = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export function escolherArea(a: AreaFoco) {
  if (a === guardada) return;
  guardada = a;
  try { localStorage.setItem(K, a); } catch {}
  ouvintes.forEach((f) => f());
}

// As áreas que aparecem nos chips, na ordem do site (só as ligadas; Consultório e Pessoal só com os dados no retrato)
export function areasDoInicio(e: Estado | null): Modo[] {
  const modos = e?.modos ?? [];
  return (['consultorio', 'pessoal', 'loja'] as Modo[]).filter((m) => modos.includes(m) && (m === 'loja' || (m === 'consultorio' ? !!e?.consultorio : !!e?.pessoal)));
}

// A área em foco agora (null: nenhuma das duas está ligada, o Início fica como sempre)
export function areaEmFoco(e: Estado | null, escolhida: AreaFoco | null = guardada): AreaFoco | null {
  const focaveis = areasDoInicio(e).filter(valida);
  if (!focaveis.length) return null;
  if (escolhida && focaveis.includes(escolhida)) return escolhida;
  const doSite = e?.modo;
  if (valida(doSite) && focaveis.includes(doSite)) return doSite;
  return focaveis[0];
}

export function useAreaInicio(e: Estado | null): AreaFoco | null {
  const escolhida = useSyncExternalStore(ouvir, () => guardada);
  return areaEmFoco(e, escolhida);
}

/* ---------- Os cartões por área ---------- */

// De que área é cada cartão; os que não estão aqui ("Áreas do Avina") são de todas
const AREA_DO_CARTAO: Partial<Record<IdWidget, AreaFoco>> = {
  consultorio: 'consultorio',
  bancos: 'pessoal', gastosMes: 'pessoal', categorias: 'pessoal', recentes: 'pessoal', fluxo: 'pessoal',
  contas: 'pessoal', tetos: 'pessoal', caixinhas: 'pessoal', combustivel: 'pessoal',
};

// primeiro: os da área em foco e os de todas, na ordem da pessoa; depois: os da outra área (outra), também na ordem
export function separarPorFoco(lista: InfoWidget[], foco: AreaFoco | null): { primeiro: InfoWidget[]; depois: InfoWidget[]; outra: AreaFoco | null } {
  if (!foco) return { primeiro: lista, depois: [], outra: null };
  const daOutra = (w: InfoWidget) => { const a = AREA_DO_CARTAO[w.id]; return !!a && a !== foco; };
  const depois = lista.filter(daOutra);
  return { primeiro: lista.filter((w) => !daOutra(w)), depois, outra: depois.length ? (foco === 'pessoal' ? 'consultorio' : 'pessoal') : null };
}
