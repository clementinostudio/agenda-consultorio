// Os postos perto, do mais barato ao mais caro. A busca é a mesma do site (../src/postos.js):
// no Paraná, as notas fiscais de agora; fora, a pesquisa da ANP na cidade, com a distância pelo CEP.
import { useEffect, useState } from 'react';

import { SERVIDOR } from '@/lib/ambiente';
import { lugarAgora, type Lugar } from '@/lib/local';
import { cidadeDoLugar, comDistancia, localizarCeps, noParana, postosANP, postosPR } from '@site/postos.js';

export type Posto = {
  id: string; nome: string; preco: number; dist?: number | null; t?: number; endereco?: string; bairro?: string;
  cidade?: string; bandeira?: string; lat?: number | null; lon?: number | null; fonte: 'nota' | 'anp'; cep?: string;
};
type Resultado = {
  chave: string;
  st: 'ok' | 'semLocal' | 'erro';
  fonte?: 'nota' | 'anp';
  bruto: Posto[];
  lugar?: Lugar;
  cidade?: string; ini?: string; fim?: string; velho?: boolean; localizando?: boolean;
};

export function usePostos(comb: string, raio: number) {
  const [pedido, setPedido] = useState(0);
  const chave = `${comb}|${raio}|${pedido}`;
  const [res, setRes] = useState<Resultado>({ chave: '', st: 'ok', bruto: [] });
  const [, setTick] = useState(0); // redesenha enquanto os postos da ANP vão sendo localizados

  useEffect(() => {
    let vivo = true;
    (async () => {
      const lugar = await lugarAgora();
      if (!vivo) return;
      if (!lugar) return setRes({ chave, st: 'semLocal', bruto: [] });
      try {
        if (noParana(lugar.lat, lugar.lon)) {
          const bruto = (await postosPR(lugar.lat, lugar.lon, raio, comb)) as Posto[];
          if (vivo) setRes({ chave, st: 'ok', fonte: 'nota', bruto, lugar });
          return;
        }
        const onde = await cidadeDoLugar(lugar.lat, lugar.lon);
        if (!onde.cidade) throw new Error('cidade');
        const d = await postosANP(SERVIDOR, onde.uf, onde.cidade, comb);
        if (!vivo) return;
        setRes({ chave, st: 'ok', fonte: 'anp', bruto: d.lista, lugar, cidade: onde.cidade, ini: d.ini, fim: d.fim, velho: d.velho, localizando: true });
        await localizarCeps(d.lista.map((p: Posto) => p.cep), () => vivo && setTick((t) => t + 1));
        if (vivo) setRes((s) => ({ ...s, localizando: false }));
      } catch {
        if (vivo) setRes({ chave, st: 'erro', bruto: [] });
      }
    })();
    return () => { vivo = false; };
  }, [chave, comb, raio]);

  // enquanto a busca nova não chega, a lista anterior continua na tela (meio apagada)
  const buscando = res.chave !== chave;
  // na ANP, a distância vem do CEP; 20 km = "Cidade toda", que mostra também os que ainda não têm lugar
  const lista: Posto[] = res.fonte === 'anp'
    ? (comDistancia(res.bruto, res.lugar) as Posto[]).filter((p) => raio === 20 || (p.dist != null && p.dist <= raio))
    : res.bruto;
  return { ...res, st: buscando ? ('buscando' as const) : res.st, lista, buscar: () => setPedido((n) => n + 1) };
}
