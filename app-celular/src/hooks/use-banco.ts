// Saldos do Open Finance (Pluggy): contas, cartões e investimentos de agora, pedidos ao site (que guarda a chave e
// pergunta ao servidor; src/banco.js). Uma cópia fica na memória e no aparelho: o Início e a tela de Bancos
// mostram na hora o último valor e atualizam por trás. O site já segura os pedidos por 15 minutos.
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { pedirSite, useEstado, type ResumoBanco } from '@/lib/motor';

const K = 'avina-nativo-banco';
type Guardado = { resumo: ResumoBanco | null; carregando: boolean; erro: string | null };

const lerLocal = (): ResumoBanco | null => { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch { return null; } };
let atual: Guardado = { resumo: lerLocal(), carregando: false, erro: null };
const ouvintes = new Set<() => void>();
const mudar = (m: Partial<Guardado>) => { atual = { ...atual, ...m }; ouvintes.forEach((f) => f()); };
const ouvir = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

let emCurso: Promise<void> | null = null;
export function atualizarBanco(forcar = false): Promise<void> {
  if (emCurso && !forcar) return emCurso;
  mudar({ carregando: true, erro: null });
  emCurso = pedirSite('banco', { rota: 'resumo', forcar }, 45_000)
    .then((r) => {
      mudar({ resumo: r, carregando: false, erro: r.erro || null });
      try { localStorage.setItem(K, JSON.stringify(r)); } catch {}
    })
    .catch((e: Error) => mudar({ carregando: false, erro: e.message || 'erro' }))
    .finally(() => { emCurso = null; });
  return emCurso;
}

// Esquecer (ao desligar um banco ou sair da conta)
export function esquecerBanco() {
  try { localStorage.removeItem(K); } catch {}
  mudar({ resumo: null, erro: null });
}

// Somas prontas para as telas
export function totaisBanco(r: ResumoBanco | null) {
  const contas = (r?.contas || []).filter((c) => c.tipo === 'conta');
  const cartoes = (r?.contas || []).filter((c) => c.tipo === 'cartao');
  const inv = r?.investimentos || [];
  return {
    contas, cartoes, investimentos: inv,
    emConta: contas.reduce((s, c) => s + c.saldo, 0),
    faturas: cartoes.reduce((s, c) => s + Math.max(0, c.saldo), 0),
    investido: inv.reduce((s, i) => s + i.saldo, 0),
    pedeAutorizar: (r?.bancos || []).filter((b) => b.status === 'LOGIN_ERROR' || b.status === 'OUTDATED'),
  };
}

// ligado: o Open Finance está liberado para esta conta (Estado.bancoLigado). Sem isso, não pergunta nada.
export function useBanco() {
  const e = useEstado();
  const ligado = !!(e && e.logado && e.bancoLigado);
  const g = useSyncExternalStore(ouvir, () => atual);
  useEffect(() => { if (ligado) atualizarBanco(false); }, [ligado]);
  const recarregar = useCallback(() => atualizarBanco(true), []);
  return { ligado, ...g, recarregar };
}
