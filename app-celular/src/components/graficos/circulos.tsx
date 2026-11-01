// Gráficos redondos: a rosca (partes por categoria, com espaço entre elas e pontas redondas, o centro livre para
// o total) e os anéis de progresso no estilo do app Atividade (passou de 100%: a volta a mais fica num tom
// mais escuro, ou na cor de excedido).
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import type { Segmento } from '@/components/graficos/barras';
import { arco } from '@/components/graficos/curva';
import { comAlfa, misturar } from '@/components/ui/comum';
import { useCores } from '@/constants/theme';

const PathAnimado = Animated.createAnimatedComponent(Path);
const CircleAnimado = Animated.createAnimatedComponent(Circle);
const curva = Easing.out(Easing.cubic);

/* ---------- Rosca ---------- */


function Fatia({ d, comp, cor, espessura, atraso, duracao, animar }: { d: string; comp: number; cor: string; espessura: number; atraso: number; duracao: number; animar: boolean }) {
  const p = useSharedValue(animar ? 0 : 1);
  useEffect(() => { p.set(animar ? withDelay(atraso, withTiming(1, { duration: duracao, easing: curva })) : 1); }, [animar, atraso, duracao, p]);
  const L = comp + 1;
  const props = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - p.get()), opacity: p.get() > 0.01 ? 1 : 0 }));
  return <PathAnimado animatedProps={props} d={d} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" strokeDasharray={[L, L]} />;
}

export type RoscaProps = {
  segmentos: Segmento[]; // as mesmas partes da BarraSegmentada: { valor, cor, id?, rotulo? }
  tamanho?: number;
  espessura?: number;
  espaco?: number; // espaço entre as partes, em pt
  children?: ReactNode; // no meio (o total, o nome da categoria tocada...)
  animar?: boolean;
  rotulo?: string;
  style?: StyleProp<ViewStyle>;
};

// As partes da rosca: o arco de cada uma, o comprimento (para se desenhar) e quando começa a aparecer
function desenharRosca(partes: Segmento[], r: number, cx: number, espessura: number, espaco: number) {
  const total = partes.reduce((t, f) => t + f.valor, 0);
  // as pontas redondas avançam meia espessura de cada lado: o espaço desconta isso
  const folga = partes.length > 1 ? (espaco + espessura) / r : 0;
  const saida: { key: string; d: string; comp: number; cor: string; atraso: number; duracao: number }[] = [];
  let acum = 0;
  partes.forEach((f, i) => {
    const fr = f.valor / total;
    const de = -Math.PI / 2 + acum * Math.PI * 2 + folga / 2;
    const varre = Math.max(0.0001, fr * Math.PI * 2 - folga);
    // uma parte só: a volta inteira (dois arcos, porque um arco de 360° não existe no SVG)
    const d = partes.length === 1 ? `${arco(cx, cx, r, -Math.PI / 2, Math.PI / 2)}${arco(cx, cx, r, Math.PI / 2, Math.PI * 1.5).replace(/^M[^A]+/, '')}` : arco(cx, cx, r, de, de + varre);
    saida.push({ key: f.id ?? String(i), d, comp: r * (partes.length === 1 ? Math.PI * 2 : varre), cor: f.cor, atraso: acum * 700, duracao: Math.max(250, fr * 700 + 200) });
    acum += fr;
  });
  return saida;
}

export function Rosca({ segmentos, tamanho = 188, espessura = 18, espaco = 5, children, animar = true, rotulo, style }: RoscaProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const mexe = animar && !reduzir;
  const r = (tamanho - espessura) / 2, cx = tamanho / 2;
  const partes = segmentos.filter((f) => f.valor > 0);
  const desenho = desenharRosca(partes, r, cx, espessura, espaco);
  return (
    <View style={[{ width: tamanho, height: tamanho }, style]} accessible accessibilityRole="image" accessibilityLabel={rotulo ?? partes.map((f) => f.rotulo).filter(Boolean).join(', ')}>
      <Svg width={tamanho} height={tamanho}>
        {!partes.length ? <Circle cx={cx} cy={cx} r={r} fill="none" stroke={c.cartao2} strokeWidth={espessura} /> : null}
        {desenho.map((x) => <Fatia key={x.key} d={x.d} comp={x.comp} cor={x.cor} espessura={espessura} atraso={x.atraso} duracao={x.duracao} animar={mexe} />)}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, estilos.meio, { padding: espessura + 8 }]}>{children}</View> : null}
    </View>
  );
}

/* ---------- Anéis ---------- */

function Arco({ cx, r, espessura, progresso, cor, corExcedido, fundo, atraso, animar }: { cx: number; r: number; espessura: number; progresso: number; cor: string; corExcedido?: string; fundo?: string; atraso: number; animar: boolean }) {
  const c = useCores();
  const C = 2 * Math.PI * r;
  const alvo = Math.max(0, progresso || 0);
  const p = useSharedValue(animar ? 0 : alvo);
  useEffect(() => { p.set(animar ? withDelay(atraso, withTiming(alvo, { duration: 900 + Math.min(alvo, 2) * 300, easing: curva })) : alvo); }, [alvo, animar, atraso, p]);
  const tinta = alvo > 1 && corExcedido ? corExcedido : cor;
  const volta = useAnimatedProps(() => {
    const v = Math.min(1, p.get());
    return { strokeDashoffset: C * (1 - v), opacity: v > 0.003 ? 1 : 0 };
  });
  // a volta a mais (passou de 100%), por cima, num tom mais escuro
  const mais = useAnimatedProps(() => {
    const v = Math.min(1, Math.max(0, p.get() - 1));
    return { strokeDashoffset: C * (1 - v), opacity: v > 0.003 ? 1 : 0 };
  });
  return (
    <G transform={`rotate(-90 ${cx} ${cx})`}>
      <Circle cx={cx} cy={cx} r={r} fill="none" stroke={fundo ?? comAlfa(cor, c.escuro ? 0.2 : 0.16)} strokeWidth={espessura} />
      <CircleAnimado animatedProps={volta} cx={cx} cy={cx} r={r} fill="none" stroke={tinta} strokeWidth={espessura} strokeLinecap="round" strokeDasharray={[C, C]} />
      {alvo > 1 ? (
        <CircleAnimado animatedProps={mais} cx={cx} cy={cx} r={r} fill="none" stroke={misturar(tinta, '#000000', c.escuro ? 0.35 : 0.25)} strokeWidth={espessura} strokeLinecap="round" strokeDasharray={[C, C]} />
      ) : null}
    </G>
  );
}

export type AnelProps = {
  progresso: number; // 0 a 1 (pode passar de 1)
  cor?: string;
  corExcedido?: string; // o anel todo muda para esta cor quando passa de 100% (ex.: teto estourado)
  tamanho?: number;
  espessura?: number;
  fundo?: string; // cor do trilho (padrão: a própria cor, bem clarinha)
  children?: ReactNode;
  animar?: boolean;
  rotulo?: string;
  style?: StyleProp<ViewStyle>;
};

export function Anel({ progresso, cor, corExcedido, tamanho = 64, espessura = 8, fundo, children, animar = true, rotulo, style }: AnelProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const cx = tamanho / 2;
  return (
    <View style={[{ width: tamanho, height: tamanho }, style]} accessible accessibilityRole="progressbar" accessibilityLabel={rotulo} accessibilityValue={{ min: 0, max: 100, now: Math.round((progresso || 0) * 100) }}>
      <Svg width={tamanho} height={tamanho}>
        <Arco cx={cx} r={(tamanho - espessura) / 2} espessura={espessura} progresso={progresso} cor={cor ?? c.azul} corExcedido={corExcedido} fundo={fundo} atraso={80} animar={animar && !reduzir} />
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, estilos.meio]}>{children}</View> : null}
    </View>
  );
}

export type AneisProps = {
  aneis: { progresso: number; cor: string; corExcedido?: string; rotulo?: string }[]; // de fora para dentro
  tamanho?: number;
  espessura?: number;
  espaco?: number;
  children?: ReactNode;
  animar?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Aneis({ aneis, tamanho = 140, espessura = 14, espaco = 3, children, animar = true, style }: AneisProps) {
  const reduzir = useReducedMotion();
  const cx = tamanho / 2;
  const rotulo = aneis.map((a) => `${a.rotulo ?? ''} ${Math.round(a.progresso * 100)}%`.trim()).join(', ');
  return (
    <View style={[{ width: tamanho, height: tamanho }, style]} accessible accessibilityRole="image" accessibilityLabel={rotulo}>
      <Svg width={tamanho} height={tamanho}>
        {aneis.map((a, i) => (
          <Arco key={i} cx={cx} r={(tamanho - espessura) / 2 - i * (espessura + espaco)} espessura={espessura} progresso={a.progresso} cor={a.cor} corExcedido={a.corExcedido} atraso={80 + i * 120} animar={animar && !reduzir} />
        ))}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, estilos.meio]}>{children}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  meio: { alignItems: 'center', justifyContent: 'center' },
});
