// Gráfico de área do mês: a linha do mês atual se desenha da esquerda para a direita, com a área em degradê
// por baixo; o mês passado aparece tracejado para comparar; um ponto pulsa no último valor.
// Tocar e arrastar para o lado mostra o dia e o valor (linha vertical + balão), com uma vibração leve a cada dia.
// O arrastar só começa com o dedo indo para o lado: na vertical, a tela rola normalmente.
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming, Extrapolation } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { curvaSuave, useIdSvg, type Ponto } from '@/components/graficos/curva';
import { vibrar } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { brlCurto, dinheiro } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

const PathAnimado = Animated.createAnimatedComponent(Path);
const CircleAnimado = Animated.createAnimatedComponent(Circle);

export type GraficoAreaProps = {
  serie: number[]; // um valor por dia (já acumulado), do dia 1 até hoje
  comparacao?: number[]; // o mês passado, um valor por dia (tracejado)
  dias?: number; // quantos dias o eixo tem (padrão: a série mais longa). Ex.: 30, com a série parando em hoje
  cor?: string;
  altura?: number;
  aoTocar?: (i: number | null) => void; // dia tocado (0 = dia 1); null ao soltar
  formatar?: (v: number) => string; // valor no balão (padrão: "R$ 1.234,56")
  rotuloDia?: (i: number) => string; // texto do dia no balão (padrão: "Dia 12")
  rotuloComparacao?: string; // "Mês passado"
  animar?: boolean;
  rotulo?: string; // resumo para o leitor de tela
  style?: StyleProp<ViewStyle>;
};

const TOPO = 12, BAIXO = 4, LADO = 6;

export function GraficoArea({ serie, comparacao, dias, cor, altura = 150, aoTocar, formatar = (v) => dinheiro(v), rotuloDia = (i) => `Dia ${i + 1}`, rotuloComparacao = 'Mês passado', animar = true, rotulo, style }: GraficoAreaProps) {
  const c = useCores();
  const tinta = cor ?? c.azul;
  const reduzir = useReducedMotion();
  const oculto = useOculto();
  const id = useIdSvg('area');
  const [W, setW] = useState(0);
  const [toque, setToque] = useState<number | null>(null);
  const [balaoW, setBalaoW] = useState(0);

  const n = Math.max(dias ?? 0, serie.length, comparacao?.length ?? 0, 2);
  const maximo = Math.max(1, ...serie, ...(comparacao ?? [])) * 1.08;
  const H = altura;
  const xDe = (i: number) => LADO + (i / (n - 1)) * Math.max(1, W - LADO * 2);
  const yDe = (v: number) => TOPO + (1 - Math.max(0, v) / maximo) * (H - TOPO - BAIXO);
  const pontos: Ponto[] = serie.map((v, i) => ({ x: xDe(i), y: yDe(v) }));
  const linha = curvaSuave(pontos);
  const L = Math.ceil(linha.comprimento) + 2;
  const ultimo = pontos[pontos.length - 1];
  const area = pontos.length > 1 ? `${linha.d}L${ultimo.x} ${H}L${pontos[0].x} ${H}Z` : '';
  const comp = comparacao?.length ? curvaSuave(comparacao.map((v, i) => ({ x: xDe(i), y: yDe(v) }))).d : '';

  // a linha se desenha uma vez, quando o gráfico aparece (e não a cada retrato novo do site)
  const p = useSharedValue(animar && !reduzir ? 0 : 1);
  const pulso = useSharedValue(0);
  useEffect(() => {
    if (!W) return;
    if (animar && !reduzir) p.set(withDelay(120, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
    else p.set(1);
  }, [W, animar, reduzir, p]);
  useEffect(() => {
    if (reduzir) { pulso.set(0); return; }
    pulso.set(withDelay(1200, withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [reduzir, pulso]);

  const traco = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - p.get()) }));
  const tracoBrilho = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - p.get()) }));
  const cheio = useAnimatedProps(() => ({ opacity: interpolate(p.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP) }));
  const tracejado = useAnimatedProps(() => ({ opacity: interpolate(p.get(), [0, 0.6], [0, 1], Extrapolation.CLAMP) }));
  const ponto = useAnimatedProps(() => ({ opacity: interpolate(p.get(), [0.9, 1], [0, 1], Extrapolation.CLAMP) }));
  const halo = useAnimatedProps(() => ({ r: 4 + pulso.get() * 11, opacity: p.get() < 1 ? 0 : 0.38 * (1 - pulso.get()) }));

  // arrastar: o dia mais perto do dedo
  const ultimoDia = Math.max(serie.length, comparacao?.length ?? 0) - 1;
  const mover = (x: number) => {
    if (!W || ultimoDia < 0) return;
    const i = Math.max(0, Math.min(ultimoDia, Math.round(((x - LADO) / Math.max(1, W - LADO * 2)) * (n - 1))));
    if (i !== toque) { setToque(i); vibrar('toque'); aoTocar?.(i); }
  };
  const soltar = () => { if (toque !== null) { setToque(null); aoTocar?.(null); } };
  // funções comuns (não worklets) e runOnJS: o arrasto mexe no estado da tela, na thread do JS
  const aoMover = (e: { x: number }) => mover(e.x);
  const aoSoltar = () => soltar();
  const arrasto = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onActivate: aoMover,
    onUpdate: aoMover,
    onFinalize: aoSoltar,
  });

  const xt = toque !== null ? xDe(toque) : 0;
  const vt = toque !== null ? serie[toque] : undefined;
  const ct = toque !== null ? comparacao?.[toque] : undefined;
  const balaoX = Math.max(0, Math.min(W - balaoW, xt - balaoW / 2));
  const resumo = rotulo ?? (serie.length ? `${formatar(serie[serie.length - 1])} até o dia ${serie.length}${comparacao?.[serie.length - 1] != null ? `; no mesmo dia do mês passado, ${formatar(comparacao[serie.length - 1])}` : ''}` : 'Sem dados ainda');

  return (
    <GestureDetector gesture={arrasto}>
      <View
        collapsable={false}
        style={[{ height: H }, style]}
        onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={oculto ? 'Gráfico do mês (valores escondidos)' : resumo}>
        {W ? (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id={`${id}-fundo`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={tinta} stopOpacity={c.escuro ? 0.34 : 0.22} />
                <Stop offset="0.7" stopColor={tinta} stopOpacity={c.escuro ? 0.06 : 0.04} />
                <Stop offset="1" stopColor={tinta} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {comp ? <PathAnimado animatedProps={tracejado} d={comp} fill="none" stroke={c.apoio} strokeOpacity={0.55} strokeWidth={1.8} strokeDasharray="4 6" strokeLinecap="round" /> : null}
            {area ? <PathAnimado animatedProps={cheio} d={area} fill={`url(#${id}-fundo)`} /> : null}
            {linha.d ? (
              <>
                {c.escuro ? <PathAnimado animatedProps={tracoBrilho} d={linha.d} fill="none" stroke={tinta} strokeOpacity={0.22} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[L, L]} /> : null}
                <PathAnimado animatedProps={traco} d={linha.d} fill="none" stroke={tinta} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[L, L]} />
              </>
            ) : null}
            {ultimo ? (
              <>
                <CircleAnimado animatedProps={halo} cx={ultimo.x} cy={ultimo.y} r={4} fill={tinta} />
                <CircleAnimado animatedProps={ponto} cx={ultimo.x} cy={ultimo.y} r={4.5} fill={tinta} stroke={c.cartao} strokeWidth={2} />
              </>
            ) : null}
            {toque !== null ? (
              <>
                <Line x1={xt} x2={xt} y1={0} y2={H} stroke={c.apoio} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 3" />
                {ct != null ? <Circle cx={xt} cy={yDe(ct)} r={3.5} fill={c.apoio} stroke={c.cartao} strokeWidth={1.5} /> : null}
                {vt != null ? <Circle cx={xt} cy={yDe(vt)} r={5.5} fill={tinta} stroke={c.cartao} strokeWidth={2.5} /> : null}
              </>
            ) : null}
          </Svg>
        ) : null}
        {toque !== null ? (
          <View
            pointerEvents="none"
            onLayout={(e) => setBalaoW(Math.round(e.nativeEvent.layout.width))}
            style={[estilos.balao, { left: balaoX, backgroundColor: c.cartao3, borderColor: c.linhaForte, opacity: balaoW ? 1 : 0 }]}>
            <Texto v="apoio" style={estilos.balaoDia}>{rotuloDia(toque)}</Texto>
            <Texto style={[estilos.balaoValor, { color: vt != null ? c.texto : c.apoio }]}>{vt == null ? '—' : oculto ? 'R$ ••••' : formatar(vt)}</Texto>
            {ct != null ? (
              <View style={estilos.balaoComp}>
                <View style={[estilos.traco, { borderColor: c.apoio }]} />
                <Texto v="apoio" style={estilos.balaoDia}>{rotuloComparacao} {oculto ? '••••' : brlCurto(ct)}</Texto>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const estilos = StyleSheet.create({
  balao: { position: 'absolute', top: -6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1, gap: 1 },
  balaoDia: { fontSize: 12, lineHeight: 15 },
  balaoValor: { fontFamily: Fontes.tituloForte, fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  balaoComp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  traco: { width: 12, borderTopWidth: 1.5, borderStyle: 'dashed' },
});
