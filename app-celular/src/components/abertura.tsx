// A abertura animada do Avina, a mesma do PWA (o #intro do ../index.html), refeita nativa:
// - fundo off-white com três manchas de luz (azul, ciano e roxo) flutuando devagar;
// - o nome "avina" se desenha traço a traço (o primeiro "a" em degradê), cada letra deslizando de um pouco mais
//   longe até o lugar (o nome "se fecha" no centro);
// - um reflexo de luz passa pelas letras;
// - na saída, o nome cresce de leve e some, as luzes "mergulham" e o fundo se dissolve no app (uns 4 s ao todo).
// A abertura estática do sistema (app.json, expo-splash-screen) tem o mesmo fundo e uma imagem transparente:
// esta aqui assume no lugar dela sem piscar. Toques não pulam a abertura; na saída, já passam para o app.
// Com "reduzir movimento": o nome já aparece desenhado, sem luzes se mexendo, e some em 1,2 s.
// Todos os tempos e curvas são os do CSS do PWA; um relógio só (t, em ms) move tudo na thread de interface.
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

const FUNDO = '#F7F6F2'; // o mesmo do splash do sistema (app.json) e do PWA
const AZUL = '#1F3BEF';
const CAIXA = '-48 -94 616 242'; // viewBox do nome
const LARG_CAIXA = 616, ALT_CAIXA = 242;

// Os 6 traços do nome (os paths do index.html). L: comprimento + 1 (o --L do PWA); x: de onde a letra desliza;
// atraso em ms (.2s, .31s, .42s...)
const TRACOS = [
  { d: 'M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50M100 0V100', L: 416, x: -39, atraso: 200 },
  { d: 'M136 0L178 100L220 0', L: 218, x: -27, atraso: 310 },
  { d: 'M256 0V100', L: 101, x: -16, atraso: 420 },
  { d: 'M256 -37V-35', L: 3, x: 2, atraso: 530 },
  { d: 'M292 100V46A46 46 0 0 1 384 46V100', L: 254, x: 20, atraso: 640 },
  { d: 'M520 50A50 50 0 1 1 420 50A50 50 0 1 1 520 50M520 0V100', L: 416, x: 39, atraso: 750 },
] as const;

// As curvas do CSS (cubic-bezier) e os tempos (ms)
const E_SOBE = Easing.bezierFn(0.22, 1, 0.36, 1); // intro-sobe 1.5s, .1s
const E_VAI = Easing.bezierFn(0.65, 0, 0.35, 1); // intro-vai 1s, 2.8s · intro-traco 1.05s · intro-sai .9s, 3.2s
const E_JUNTA = Easing.bezierFn(0.16, 1, 0.3, 1); // intro-junta 1.45s
const E_BRILHO = Easing.bezierFn(0.45, 0, 0.55, 1); // reflexo .9s, 1.95s
const E_MERGULHO = Easing.bezierFn(0.33, 0, 0.2, 1); // intro-mergulho 1.3s, 2.85s
const E_FLUTUA = Easing.bezierFn(0.42, 0, 0.58, 1); // ease-in-out das luzes (6, 7 e 8 s)

const TOTAL = 4100, SAIDA = 2800, SOLTA_BARRA = 3350;
const TOTAL_CALMO = 2100, SAI_CALMO = 1200; // com "reduzir movimento"
// Prévia no navegador (components/camada-web.web.tsx): ?abertura=0 pula a abertura, para prints rápidos
const PULAR = Platform.OS === 'web' && /[?&]abertura=0\b/.test(globalThis.location?.search ?? '');

// quanto de uma etapa já passou (0 a 1), no relógio t
const fase = (t: number, atraso: number, dur: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (t - atraso) / dur));
};

const PathAnimado = Animated.createAnimatedComponent(Path);
const GradienteAnimado = Animated.createAnimatedComponent(LinearGradient);

type Relogio = { t: SharedValue<number>; calmo: boolean };

/* ---------- As luzes do fundo ---------- */

type LuzCfg = { id: string; cor: string; forte: number; fraco: number; tam: number; left: number; top: number; dx: number; dy: number; esc: number; dur: number };

function Luz({ cfg, t, calmo }: { cfg: LuzCfg } & Relogio) {
  const estilo = useAnimatedStyle(() => {
    const k = calmo ? 0 : E_FLUTUA(fase(t.get(), 0, cfg.dur));
    return { transform: [{ translateX: cfg.dx * k }, { translateY: cfg.dy * k }, { scale: 1 + (cfg.esc - 1) * k }] };
  });
  const r = cfg.tam / 2;
  return (
    <Animated.View style={[{ position: 'absolute', left: cfg.left, top: cfg.top, width: cfg.tam, height: cfg.tam }, estilo]}>
      <Svg width={cfg.tam} height={cfg.tam}>
        <Defs>
          {/* radial-gradient(closest-side, cor .13, cor .05 55%, transparente) */}
          <RadialGradient id={cfg.id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={cfg.cor} stopOpacity={cfg.forte} />
            <Stop offset="0.55" stopColor={cfg.cor} stopOpacity={cfg.fraco} />
            <Stop offset="1" stopColor={cfg.cor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${cfg.id})`} />
      </Svg>
    </Animated.View>
  );
}

/* ---------- O nome ---------- */

// Uma letra: desliza até o lugar enquanto o traço se desenha
function Traco({ i, escala, w, h, t, calmo }: { i: number; escala: number; w: number; h: number } & Relogio) {
  const tr = TRACOS[i];
  const camada = useAnimatedStyle(() => {
    if (calmo) return { opacity: 1, transform: [{ translateX: 0 }] };
    const tt = t.get();
    // intro-traco: a opacidade chega a 1 nos primeiros 5% (52 ms); intro-junta: o deslize
    return { opacity: fase(tt, tr.atraso, 52), transform: [{ translateX: tr.x * escala * (1 - E_JUNTA(fase(tt, tr.atraso, 1450))) }] };
  });
  const traco = useAnimatedProps(() => ({ strokeDashoffset: calmo ? 0 : tr.L * (1 - E_VAI(fase(t.get(), tr.atraso, 1050))) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, camada]}>
      <Svg width={w} height={h} viewBox={CAIXA}>
        {i === 0 ? (
          <Defs>
            {/* o primeiro "a" surge em degradê */}
            <LinearGradient id="nvf" x1={-18} y1={0} x2={100} y2={0} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={AZUL} stopOpacity={0} />
              <Stop offset="0.45" stopColor={AZUL} stopOpacity={0.45} />
              <Stop offset="1" stopColor={AZUL} stopOpacity={1} />
            </LinearGradient>
          </Defs>
        ) : null}
        <PathAnimado
          animatedProps={traco}
          d={tr.d}
          fill="none"
          stroke={i === 0 ? 'url(#nvf)' : AZUL}
          strokeWidth={18}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[tr.L, tr.L]}
        />
      </Svg>
    </Animated.View>
  );
}

// O reflexo de luz que passa pelas letras (o degradê anda de -328 a 618 em .9 s, a partir de 1,95 s)
function Reflexo({ w, h, t }: { w: number; h: number; t: SharedValue<number> }) {
  const faixa = useAnimatedProps(() => {
    const x1 = -328 + 946 * E_BRILHO(fase(t.get(), 1950, 900));
    return { x1, x2: x1 + 230 };
  });
  return (
    <Svg width={w} height={h} viewBox={CAIXA} style={StyleSheet.absoluteFill}>
      <Defs>
        <GradienteAnimado animatedProps={faixa} id="nvb" x1={-328} y1={0} x2={-98} y2={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#8FA6FF" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#D6DEFF" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#8FA6FF" stopOpacity={0} />
        </GradienteAnimado>
      </Defs>
      <G fill="none" stroke="url(#nvb)" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round">
        {TRACOS.map((tr) => <Path key={tr.d} d={tr.d} />)}
      </G>
    </Svg>
  );
}

/* ---------- A abertura ---------- */

export function Abertura() {
  const calmo = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const t = useSharedValue(0);
  // 0: cobrindo (segura os toques) · 1: saindo (os toques já vão para o app) · 2: barra de status liberada · 3: fim
  const [etapa, setEtapa] = useState(0);

  useEffect(() => {
    // a abertura já está desenhada por cima (mesmo fundo do splash do sistema): troca sem piscar
    SplashScreen.hideAsync().catch(() => {});
    const total = calmo ? TOTAL_CALMO : TOTAL;
    t.set(withTiming(total, { duration: total, easing: Easing.linear }));
    const ts = [
      setTimeout(() => setEtapa(1), calmo ? SAI_CALMO : SAIDA),
      setTimeout(() => setEtapa(2), calmo ? SAI_CALMO + 450 : SOLTA_BARRA),
      setTimeout(() => setEtapa(3), total + 80),
    ];
    return () => ts.forEach(clearTimeout);
  }, [calmo, t]);

  // o fundo se dissolve no app (intro-sai)
  const fundo = useAnimatedStyle(() => ({ opacity: 1 - E_VAI(fase(t.get(), calmo ? SAI_CALMO : 3200, 900)) }));
  // as luzes "mergulham" (intro-mergulho)
  const luzes = useAnimatedStyle(() => {
    const k = calmo ? 0 : E_MERGULHO(fase(t.get(), 2850, 1300));
    return { opacity: 1 - 0.4 * k, transform: [{ scale: 1 + 0.1 * k }] };
  });
  // o nome sobe, aparece (intro-sobe) e, na saída, cresce e some (intro-vai)
  const nome = useAnimatedStyle(() => {
    if (calmo) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const tt = t.get();
    const sobe = E_SOBE(fase(tt, 100, 1500));
    const vai = E_VAI(fase(tt, SAIDA, 1000));
    return {
      opacity: sobe * (1 - vai),
      transform: [{ translateY: 10 * (1 - sobe) }, { scale: (0.97 + 0.03 * sobe) * (1 + 0.06 * vai) }],
    };
  });

  if (etapa >= 3 || PULAR) return null;

  // as luzes em vmax, como no CSS
  const vmax = Math.max(W, H) / 100;
  const cfgs: LuzCfg[] = [
    { id: 'luz1', cor: '#1F3BEF', forte: 0.13, fraco: 0.05, tam: 120 * vmax, left: -55 * vmax, top: -62 * vmax, dx: 9 * vmax, dy: 6 * vmax, esc: 1.06, dur: 6000 },
    { id: 'luz2', cor: '#22B5DA', forte: 0.1, fraco: 0.04, tam: 100 * vmax, left: -48 * vmax, top: H + 62 * vmax - 100 * vmax, dx: 7 * vmax, dy: -8 * vmax, esc: 1.1, dur: 7000 },
    { id: 'luz3', cor: '#7B5CFF', forte: 0.1, fraco: 0.04, tam: 90 * vmax, left: W + 52 * vmax - 90 * vmax, top: 8 * vmax, dx: -8 * vmax, dy: 7 * vmax, esc: 0.95, dur: 8000 },
  ];
  const nomeW = Math.min(W * 0.64, 320);
  const nomeH = (nomeW * ALT_CAIXA) / LARG_CAIXA;
  const escala = nomeW / LARG_CAIXA; // os deslizes do CSS estão nas unidades do desenho

  return (
    <Animated.View
      pointerEvents={etapa >= 1 ? 'none' : 'auto'}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, estilos.abertura, fundo]}>
      {etapa < 2 ? <StatusBar style="dark" animated /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, luzes]}>
        {cfgs.map((cfg) => <Luz key={cfg.id} cfg={cfg} t={t} calmo={calmo} />)}
      </Animated.View>
      <View style={estilos.meio}>
        <Animated.View style={[{ width: nomeW, height: nomeH }, nome]}>
          {TRACOS.map((tr, i) => <Traco key={tr.d} i={i} escala={escala} w={nomeW} h={nomeH} t={t} calmo={calmo} />)}
          {!calmo ? <Reflexo w={nomeW} h={nomeH} t={t} /> : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  abertura: { backgroundColor: FUNDO, overflow: 'hidden', zIndex: 9999, elevation: 9999 },
  meio: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
