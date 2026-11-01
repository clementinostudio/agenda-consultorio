// A régua do mês (como a do site, ReguaContas em ../src/telas/pessoal.jsx): do dia 1 ao último dia, cada conta é um
// alfinete com a logo no dia do vencimento; a linha vai se enchendo até hoje. Contas que vencem perto umas das
// outras viram uma pilha só, com a que mais importa na frente (atrasada, depois a que falta pagar) e um "+2".
// Pagas ficam apagadas com o visto; atrasadas, com o aro vermelho.
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import type { ContaMes } from '@/components/contas/regras';
import { comAlfa, Icone, Logo } from '@/components/ui';
import { Fontes, useCores } from '@/constants/theme';
import { chaveMes, diasNoMes } from '@/lib/formato';

const LOGO = 30;
const MIN_PX = 40; // a distância mínima entre os centros de duas logos (a logo e o "+2")

type Grupo = { itens: ContaMes[]; meio: number };

export function ReguaContas({ contas, hoje }: { contas: ContaMes[]; hoje: string }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [W, setW] = useState(0);
  const n = diasNoMes(chaveMes(hoje));
  const dh = Number(hoje.slice(8, 10));
  const util = Math.max(1, W - LOGO);
  const x = (d: number) => LOGO / 2 + ((Math.min(d, n) - 1) / (n - 1)) * util;

  const grupos = useMemo(() => {
    if (!W) return [];
    const minDias = MIN_PX / (util / (n - 1));
    const dia = (k: ContaMes) => Number(k.vence.slice(8, 10));
    let g: Grupo[] = [...contas].sort((a, b) => dia(a) - dia(b)).map((k) => ({ itens: [k], meio: dia(k) }));
    for (let i = 1; i < g.length;) {
      const a = g[i - 1], b = g[i];
      if (b.meio - a.meio < minDias) {
        const itens = [...a.itens, ...b.itens];
        g = [...g.slice(0, i - 1), { itens, meio: itens.reduce((s, k) => s + dia(k), 0) / itens.length }, ...g.slice(i + 1)];
        i = Math.max(1, i - 1);
      } else i++;
    }
    return g;
  }, [contas, W, util, n]);

  const peso = (k: ContaMes) => (k.paga ? 2 : k.st === 'atrasada' ? 0 : 1);
  const abertas = contas.filter((k) => !k.paga);
  const prox = abertas.filter((k) => k.st !== 'atrasada').sort((a, b) => (a.vence < b.vence ? -1 : 1))[0];
  const rotulo = abertas.length
    ? `Régua do mês: ${abertas.length === 1 ? 'falta 1 conta' : `faltam ${abertas.length} contas`}${prox ? `, a próxima vence dia ${Number(prox.vence.slice(8, 10))}` : ''}`
    : 'Régua do mês: todas as contas pagas';

  return (
    <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={estilos.regua} accessible accessibilityRole="image" accessibilityLabel={rotulo}>
      {/* o trilho do mês e o pedaço que já passou */}
      <View style={[estilos.trilho, { backgroundColor: c.escuro ? c.cartao3 : c.cartao3, left: LOGO / 2, right: LOGO / 2 }]} />
      {W ? <View style={[estilos.trilho, { backgroundColor: comAlfa(c.azul, 0.75), left: LOGO / 2, width: x(dh) - LOGO / 2 }]} /> : null}
      {W ? (
        <>
          {/* hoje */}
          <View style={[estilos.hojePonto, { left: x(dh) - 6, backgroundColor: c.azul, borderColor: c.escuro ? c.fundo : '#FFFFFF' }]} />
          <Text allowFontScaling={false} style={[estilos.legenda, estilos.hoje, { left: Math.min(Math.max(0, x(dh) - 30), W - 60), color: c.azulTinta }]}>hoje</Text>
          {/* o primeiro e o último dia, quando não há alfinete ali */}
          {grupos.every((g) => x(g.meio) > LOGO / 2 + 26) ? <Text allowFontScaling={false} style={[estilos.legenda, { left: 0, width: LOGO, color: c.fraco }]}>1</Text> : null}
          {grupos.every((g) => x(g.meio) < W - LOGO / 2 - 26) ? <Text allowFontScaling={false} style={[estilos.legenda, { right: 0, width: LOGO, color: c.fraco }]}>{n}</Text> : null}
        </>
      ) : null}
      {grupos.map((g, i) => {
        const frente = [...g.itens].sort((a, b) => peso(a) - peso(b) || (a.vence < b.vence ? -1 : 1))[0];
        const todasPagas = g.itens.every((k) => k.paga);
        const atrasada = g.itens.some((k) => k.st === 'atrasada');
        const dias = g.itens.map((k) => Number(k.vence.slice(8, 10)));
        const cx = x(g.meio);
        const aro = atrasada ? c.negativo : todasPagas ? 'transparent' : c.escuro ? c.linhaForte : c.cartao3;
        return (
          <Animated.View key={`${frente.id}-${g.itens.length}`} entering={reduzir ? undefined : ZoomIn.delay(80 + i * 45).springify().damping(14)} style={[estilos.alfinete, { left: cx - LOGO / 2 - 2 }]}>
            <View style={[estilos.aro, { borderColor: aro, opacity: todasPagas ? 0.5 : 1 }]}>
              <Logo marca={frente.marca} site={frente.site} nome={frente.nome} cat={frente.cat} tamanho={LOGO} />
            </View>
            {todasPagas ? (
              <View style={[estilos.selo, { backgroundColor: c.positivo, borderColor: c.cartao }]}>
                <Icone nome="check" tamanho={8} cor={c.escuro ? '#06150F' : '#FFFFFF'} peso="bold" />
              </View>
            ) : g.itens.length > 1 ? (
              <View style={[estilos.selo, estilos.mais, { backgroundColor: atrasada ? c.negativo : c.texto, borderColor: c.cartao }]}>
                <Text allowFontScaling={false} style={[estilos.maisTexto, { color: atrasada ? '#FFFFFF' : c.fundo }]}>+{g.itens.length - 1}</Text>
              </View>
            ) : null}
            <View style={[estilos.haste, { backgroundColor: atrasada ? c.negativo : c.escuro ? c.linhaForte : c.cartao3 }]} />
            <Animated.Text entering={reduzir ? undefined : FadeIn.delay(160 + i * 45)} allowFontScaling={false} style={[estilos.diaTexto, { color: atrasada ? c.negativo : todasPagas ? c.fraco : c.apoio }]}>
              {dias.length > 1 && dias[0] !== dias[dias.length - 1] ? `${dias[0]}–${dias[dias.length - 1]}` : dias[0]}
            </Animated.Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const TOPO_TRILHO = LOGO + 4 + 12; // a logo, o aro e a haste

const estilos = StyleSheet.create({
  regua: { height: TOPO_TRILHO + 44, marginTop: 4 },
  trilho: { position: 'absolute', top: TOPO_TRILHO, height: 6, borderRadius: 3 },
  hojePonto: { position: 'absolute', top: TOPO_TRILHO - 3, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  legenda: { position: 'absolute', top: TOPO_TRILHO + 12, fontFamily: Fontes.textoForte, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  hoje: { top: TOPO_TRILHO + 27, width: 60, fontFamily: Fontes.textoPesado },
  alfinete: { position: 'absolute', top: 0, width: LOGO + 4, alignItems: 'center' },
  aro: { width: LOGO + 4, height: LOGO + 4, borderRadius: (LOGO + 4) / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  haste: { width: 2, height: 12, borderRadius: 1 },
  selo: { position: 'absolute', top: -3, right: -5, width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mais: { width: undefined, minWidth: 20, paddingHorizontal: 3 },
  maisTexto: { fontFamily: Fontes.textoPesado, fontSize: 9.5, lineHeight: 12 },
  diaTexto: { position: 'absolute', top: TOPO_TRILHO + 12, left: (LOGO + 4 - 60) / 2, width: 60, textAlign: 'center', fontFamily: Fontes.textoForte, fontSize: 11, lineHeight: 14 },
});
