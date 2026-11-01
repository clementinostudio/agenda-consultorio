// A Bolinha, o mascote do Avina (a mesma do site, src/App.jsx): uma bola azul com dois olhinhos em pílula.
// Toda a expressão está nos olhos.
// - parado: flutua, pisca e de vez em quando olha em volta
// - pensando: olhos para cima, indo de um lado para o outro (esperando a resposta)
// - falando: os olhos pulam e a bola estica de leve (escrevendo a resposta)
// - feliz: olhos viram dois arquinhos (deu certo)
// Com "reduzir movimento": só pisca.
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { misturar } from '@/components/ui/comum';
import { useCores } from '@/constants/theme';

export type EstadoMascote = 'parado' | 'pensando' | 'falando' | 'feliz';

const RectAnimado = Animated.createAnimatedComponent(Rect);
const MODO: Record<EstadoMascote, number> = { parado: 0, pensando: 1, falando: 2, feliz: 3 };

function Olho({ x0, olharX, olharY, pisca, voz, modo }: { x0: number; olharX: SharedValue<number>; olharY: SharedValue<number>; pisca: SharedValue<number>; voz: SharedValue<number>; modo: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const m = modo.get();
    const base = m === 2 ? 0.85 + voz.get() * 0.45 : m === 1 ? 1.08 : 1;
    const h = 13 * base * (1 - 0.88 * pisca.get());
    return { x: x0 + olharX.get(), y: 29.5 - h / 2 + olharY.get(), height: h };
  });
  return <RectAnimado animatedProps={props} x={x0} y={23} width={6} height={13} rx={3} fill="#FFFFFF" />;
}

export type MascoteProps = {
  estado?: EstadoMascote;
  tamanho?: number;
  cor?: string; // padrão: o azul do Avina
  sombra?: boolean;
  animado?: boolean; // false: parada (ícones pequenos)
  style?: StyleProp<ViewStyle>;
};

export function Mascote({ estado = 'parado', tamanho = 64, cor, sombra = true, animado = true, style }: MascoteProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const mexe = animado && !reduzir;
  const tinta = cor ?? c.azul;

  const flutua = useSharedValue(0);
  const voz = useSharedValue(0);
  const pisca = useSharedValue(0);
  const olharX = useSharedValue(0);
  const olharY = useSharedValue(0);
  const modo = useSharedValue(MODO[estado]);

  // o jeito de cada estado
  useEffect(() => {
    modo.set(MODO[estado]);
    cancelAnimation(voz);
    if (!mexe) { flutua.set(0); voz.set(0); olharX.set(withTiming(0)); olharY.set(withTiming(estado === 'pensando' ? -3 : 0)); return; }
    const vai = (d: number) => withRepeat(withTiming(1, { duration: d, easing: Easing.inOut(Easing.sin) }), -1, true);
    flutua.set(vai(estado === 'pensando' ? 1100 : 1800));
    if (estado === 'falando') {
      voz.set(withRepeat(withSequence(
        withTiming(1, { duration: 120 }), withTiming(0.25, { duration: 140 }), withTiming(0.8, { duration: 110 }),
        withTiming(0.1, { duration: 160 }), withTiming(0.6, { duration: 120 }), withTiming(0, { duration: 180 }),
      ), -1, false));
      olharX.set(withTiming(0, { duration: 200 }));
      olharY.set(withTiming(-2.5, { duration: 200 }));
    } else if (estado === 'pensando') {
      voz.set(0);
      olharY.set(withTiming(-3, { duration: 260 }));
      olharX.set(withRepeat(withSequence(withTiming(-3.5, { duration: 650, easing: Easing.inOut(Easing.quad) }), withTiming(3.5, { duration: 650, easing: Easing.inOut(Easing.quad) })), -1, true));
    } else {
      voz.set(0);
      olharX.set(withTiming(0, { duration: 260 }));
      olharY.set(withTiming(0, { duration: 260 }));
    }
  }, [estado, mexe, flutua, voz, olharX, olharY, modo]);

  // piscar (sempre, mesmo com "reduzir movimento") e, parada, olhar em volta de vez em quando
  useEffect(() => {
    if (!animado || estado === 'feliz') return;
    let vivo = true;
    const ts: ReturnType<typeof setTimeout>[] = [];
    const depois = (f: () => void, ms: number) => { ts.push(setTimeout(() => { if (vivo) f(); }, ms)); };
    const piscar = () => depois(() => {
      const uma = withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 }));
      pisca.set(Math.random() < 0.25 ? withSequence(uma, withTiming(0, { duration: 90 }), withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 })) : uma);
      piscar();
    }, 2000 + Math.random() * 3500);
    const espiar = () => depois(() => {
      const r = Math.random();
      const [x, y] = r < 0.3 ? [-4, 0.5] : r < 0.6 ? [4, 0.5] : r < 0.72 ? [0, 3] : r < 0.82 ? [0, -3] : [0, 0];
      olharX.set(withTiming(x, { duration: 260, easing: Easing.out(Easing.cubic) }));
      olharY.set(withTiming(y, { duration: 260, easing: Easing.out(Easing.cubic) }));
      depois(() => { olharX.set(withTiming(0, { duration: 260 })); olharY.set(withTiming(0, { duration: 260 })); }, 700 + Math.random() * 1000);
      espiar();
    }, 2800 + Math.random() * 3200);
    piscar();
    if (estado === 'parado' && mexe) espiar();
    return () => { vivo = false; ts.forEach(clearTimeout); };
  }, [animado, estado, mexe, pisca, olharX, olharY]);

  const k = tamanho / 64;
  const corpo = useAnimatedStyle(() => {
    const falando = modo.get() === 2;
    return {
      transform: [
        { translateY: (-2.6 * flutua.get() - (falando ? 1.5 : 0)) * k },
        { scaleX: 1 + voz.get() * 0.05 },
        { scaleY: 1 + voz.get() * 0.08 },
      ],
    };
  });
  const somb = useAnimatedStyle(() => ({ opacity: 0.3 - flutua.get() * 0.12, transform: [{ scaleX: 1 - flutua.get() * 0.2 }] }));

  const claro = misturar(tinta, '#FFFFFF', 0.38);
  const escuro = misturar(tinta, '#000000', 0.22);
  return (
    <View style={[{ width: tamanho, height: tamanho }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      {sombra ? (
        <Animated.View style={[{ position: 'absolute', left: 19 * k, top: 59 * k, width: 26 * k, height: 4 * k, borderRadius: 2 * k, backgroundColor: c.escuro ? '#000000' : 'rgba(17,17,40,0.55)' }, somb]} />
      ) : null}
      <Animated.View style={[{ width: tamanho, height: tamanho }, corpo]}>
        <Svg width={tamanho} height={tamanho} viewBox="0 0 64 64">
          <Defs>
            <RadialGradient id="bolinha-luz" cx="38%" cy="30%" r="72%">
              <Stop offset="0" stopColor={claro} />
              <Stop offset="0.55" stopColor={tinta} />
              <Stop offset="1" stopColor={escuro} />
            </RadialGradient>
          </Defs>
          <Circle cx={32} cy={32} r={24} fill="url(#bolinha-luz)" />
          <Ellipse cx={23.5} cy={18.5} rx={6} ry={3.2} fill="#FFFFFF" opacity={0.22} transform="rotate(-28 23.5 18.5)" />
          {estado === 'feliz' ? (
            <Path d="M20.5 32 Q24.5 26.5 28.5 32 M35.5 32 Q39.5 26.5 43.5 32" fill="none" stroke="#FFFFFF" strokeWidth={3.6} strokeLinecap="round" />
          ) : (
            <>
              <Olho x0={21.5} olharX={olharX} olharY={olharY} pisca={pisca} voz={voz} modo={modo} />
              <Olho x0={36.5} olharX={olharX} olharY={olharY} pisca={pisca} voz={voz} modo={modo} />
            </>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}
