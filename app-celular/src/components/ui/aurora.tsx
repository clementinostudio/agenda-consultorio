// Aurora: manchas de luz azul, roxa e ciano, bem desfocadas, que flutuam devagar no topo do Início
// (as mesmas luzes da abertura). No claro fica bem mais suave. Some e sobe de leve ao rolar (rolagem).
// Com "reduzir movimento", fica parada.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { comAlfa } from '@/components/ui/comum';
import { useVidroAtivo } from '@/components/ui/vidro';
import { useCores } from '@/constants/theme';

type Mancha = { cor: string; forca: number; tam: number; x: number; y: number; dx: number; dy: number; esc: number; dur: number };

function Luz({ m, id, t }: { m: Mancha; id: string; t: SharedValue<number> }) {
  const estilo = useAnimatedStyle(() => {
    // cada mancha vai e volta no próprio ritmo (t vai de 0 a 1 em 24 s, sem parar)
    const fase = Math.sin(t.get() * Math.PI * 2 * (24000 / m.dur));
    return { transform: [{ translateX: fase * m.dx }, { translateY: fase * m.dy }, { scale: 1 + fase * m.esc }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: m.x - m.tam / 2, top: m.y - m.tam / 2, width: m.tam, height: m.tam }, estilo]}>
      <Svg width={m.tam} height={m.tam}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={m.cor} stopOpacity={m.forca} />
            <Stop offset="0.5" stopColor={m.cor} stopOpacity={m.forca * 0.42} />
            <Stop offset="1" stopColor={m.cor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={m.tam / 2} cy={m.tam / 2} r={m.tam / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export type AuroraProps = {
  altura?: number;
  rolagem?: SharedValue<number>; // o contentOffset.y da tela (useScrollOffset / useAnimatedScrollHandler)
  cores?: [string, string, string]; // padrão: azul, roxo e ciano do Avina
  forca?: number; // multiplica a intensidade (1 = padrão)
  style?: StyleProp<ViewStyle>;
};

export function Aurora({ altura = 380, rolagem, cores, forca = 1, style }: AuroraProps) {
  const c = useCores();
  const { width: W } = useWindowDimensions();
  const reduzir = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduzir) return;
    t.set(withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false));
  }, [reduzir, t]);

  const [a, b, d] = cores ?? [c.azul, c.roxo, c.ciano];
  const k = (c.escuro ? 1 : 0.42) * forca;
  const manchas: Mancha[] = [
    { cor: a, forca: 0.55 * k, tam: W * 1.25, x: W * 0.12, y: altura * 0.1, dx: W * 0.08, dy: altura * 0.06, esc: 0.05, dur: 12000 },
    { cor: b, forca: 0.45 * k, tam: W * 1.05, x: W * 0.92, y: altura * 0.18, dx: -W * 0.07, dy: altura * 0.08, esc: 0.07, dur: 8000 },
    { cor: d, forca: 0.34 * k, tam: W * 0.95, x: W * 0.5, y: altura * 0.62, dx: W * 0.06, dy: -altura * 0.05, esc: 0.06, dur: 6000 },
  ];

  const sumir = useAnimatedStyle(() => {
    const y = rolagem ? rolagem.get() : 0;
    return {
      opacity: interpolate(y, [0, altura * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(y, [-200, 0, altura], [60, 0, -altura * 0.35], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[estilos.aurora, { height: altura }, sumir, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      {manchas.map((m, i) => <Luz key={i} m={m} id={`aurora-${i}`} t={t} />)}
      {/* a parte de baixo se funde com o fundo da tela */}
      <LinearGradient colors={[comAlfa(c.fundo, 0), c.fundo]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[estilos.linha, { backgroundColor: c.fundo }]} />
    </Animated.View>
  );
}

// A luz de fundo das telas de cartões de vidro (só no iOS 26, com o Liquid Glass): manchas bem fracas de azul, roxo
// e ciano pela tela inteira e um degradê quase sem cor, para o vidro ter o que refratar quando a aurora do topo já
// sumiu. Fica parada: nada se mexe atrás do vidro (mexer obrigaria o sistema a redesenhar todos os cartões).
export function LuzDeFundo() {
  const c = useCores();
  const ativo = useVidroAtivo();
  const { width: W, height: H } = useWindowDimensions();
  if (!ativo) return null;
  const k = c.escuro ? 1 : 0.55;
  const manchas = [
    { cor: c.azul, forca: 0.2 * k, tam: W * 1.4, x: W * 0.05, y: H * 0.45 },
    { cor: c.roxo, forca: 0.16 * k, tam: W * 1.25, x: W * 0.98, y: H * 0.68 },
    { cor: c.ciano, forca: 0.13 * k, tam: W * 1.2, x: W * 0.3, y: H * 0.98 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[comAlfa(c.azul, 0), comAlfa(c.roxo, c.escuro ? 0.06 : 0.04)]} style={StyleSheet.absoluteFill} />
      {manchas.map((m, i) => (
        <Svg key={i} width={m.tam} height={m.tam} style={{ position: 'absolute', left: m.x - m.tam / 2, top: m.y - m.tam / 2 }}>
          <Defs>
            <RadialGradient id={`luz-fundo-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={m.cor} stopOpacity={m.forca} />
              <Stop offset="1" stopColor={m.cor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={m.tam / 2} cy={m.tam / 2} r={m.tam / 2} fill={`url(#luz-fundo-${i})`} />
        </Svg>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  linha: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
});
