// Mudanças que a tela nativa já mostra antes de o site confirmar. O retrato com a mudança chega uns 400 ms depois
// da resposta (a espera do site para juntar mudanças), e um retrato atrasado, montado antes do pedido, poderia
// "desfazer" a mudança por um instante. Então a mudança local vale até chegar um retrato montado depois da resposta.
// - marcar(chave, valor) devolve uma ficha; confirmar(chave, ficha) quando o site respondeu que deu certo; tirar(chave,
//   ficha) quando não deu. A ficha evita que a resposta de um pedido antigo mexa na mudança mais nova (pagar e,
//   antes da resposta, desfazer).
// - usePendentes() devolve só as que ainda valem: as sem resposta e as confirmadas depois do último retrato.
// Ex.: const pagas = criarPendentes<string | null>(); ... const vivas = pagas.usePendentes(); vivas.get('cf3|2026-11')
import { useMemo, useSyncExternalStore } from 'react';

import { useEstado } from '@/lib/motor';

type Pendente<V> = { v: V; ficha: number; ate: number }; // ate: o retrato montado depois disso já tem a mudança

export function criarPendentes<V>() {
  let mapa = new Map<string, Pendente<V>>();
  let fichas = 0;
  const ouvintes = new Set<() => void>();
  const mudar = (f: (m: Map<string, Pendente<V>>) => void) => { const m = new Map(mapa); f(m); mapa = m; ouvintes.forEach((o) => o()); };
  const ouvir = (o: () => void) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; };
  return {
    marcar(chave: string, v: V) {
      const ficha = ++fichas;
      mudar((m) => m.set(chave, { v, ficha, ate: Infinity }));
      return ficha;
    },
    confirmar(chave: string, ficha: number) {
      if (mapa.get(chave)?.ficha !== ficha) return;
      const agora = Date.now();
      mudar((m) => { const p = m.get(chave)!; m.set(chave, { ...p, ate: agora }); });
    },
    tirar(chave: string, ficha?: number) {
      const p = mapa.get(chave);
      if (!p || (ficha !== undefined && p.ficha !== ficha)) return;
      mudar((m) => { m.delete(chave); });
    },
    ler: (chave: string) => mapa.get(chave)?.v,
    usePendentes(): Map<string, V> {
      const m = useSyncExternalStore(ouvir, () => mapa);
      const em = useEstado()?.em ?? 0;
      return useMemo(() => {
        const vivas = new Map<string, V>();
        m.forEach((p, k) => { if (p.ate > em) vivas.set(k, p.v); });
        return vivas;
      }, [m, em]);
    },
  };
}
