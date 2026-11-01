// O teclado de valor do Anotar (como nos apps de banco): grade 3×4 com vírgula e apagar, vibração leve a cada
// tecla, e o visor com o valor grande (os centavos menores à direita, os que faltam digitar bem apagados).
// - Segurar o apagar limpa tudo.
// - Passou do limite (7 dígitos ou 2 casas): o visor treme de leve e o celular vibra de aviso.
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { vibrar } from '@/components/ui/comum';
import { Fontes, useCores } from '@/constants/theme';
import { dinheiro } from '@/lib/formato';

export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'apagar';

const MAX_INTEIRO = 7; // R$ 9.999.999,99

// A tecla aplicada ao texto do valor ("1234,5"); null quando não cabe
export function teclar(txt: string, t: Tecla): string | null {
  if (t === 'apagar') return txt ? txt.slice(0, -1) : null;
  if (t === ',') return txt.includes(',') ? null : `${txt || '0'},`;
  const [inteiro, dec] = txt.split(',');
  if (dec !== undefined) return dec.length >= 2 ? null : txt + t;
  if (inteiro === '0') return t === '0' ? null : t; // sem zero à esquerda
  if (inteiro.length >= MAX_INTEIRO) return null;
  return txt + t;
}
export const valorDoTexto = (txt: string) => Number((txt || '0').replace(',', '.')) || 0;
const milhar = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* ---------- O visor ---------- */

export function Visor({ txt, cor, ativo, tremor, compacto }: {
  txt: string;
  cor: string; // a cor do valor (texto no gasto, menta na entrada)
  ativo: boolean; // o teclado está aberto: mostra o cursor piscando
  tremor: number; // muda a cada tecla que não coube (o visor treme)
  compacto?: boolean; // menor (com o teclado do sistema aberto)
}) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [inteiro, dec] = txt.split(',');
  const vazio = !txt;
  const tam = compacto ? 38 : (inteiro || '').length <= 4 ? 58 : (inteiro || '').length <= 6 ? 50 : 42;
  const pequeno = Math.round(tam * 0.56);
  const tinta = vazio ? c.fraco : cor;

  const pisca = useSharedValue(1);
  useEffect(() => {
    if (!ativo || reduzir) { pisca.set(1); return; }
    pisca.set(withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 350, easing: Easing.inOut(Easing.quad) })), -1, true));
  }, [ativo, reduzir, pisca]);
  const cursor = useAnimatedStyle(() => ({ opacity: ativo ? pisca.get() : 0 }));

  const x = useSharedValue(0);
  useEffect(() => {
    if (!tremor || reduzir) return;
    x.set(withSequence(withTiming(-7, { duration: 50 }), withTiming(7, { duration: 70 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 60 })));
  }, [tremor, reduzir, x]);
  const tremer = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const base = { fontFamily: Fontes.tituloForte, fontVariant: ['tabular-nums' as const] };
  const faltam = dec === undefined ? ',00' : '0'.repeat(2 - dec.length);
  return (
    <Animated.View style={[estilos.visor, tremer]}>
      <Text maxFontSizeMultiplier={1.2} style={[base, { fontSize: pequeno, color: c.apoio, marginRight: 6, fontFamily: Fontes.titulo }]}>R$</Text>
      <Text maxFontSizeMultiplier={1.2} style={[base, { fontSize: tam, color: tinta, letterSpacing: -tam * 0.03 }]}>{milhar(inteiro || '0')}</Text>
      {dec !== undefined ? <Text maxFontSizeMultiplier={1.2} style={[base, { fontSize: pequeno, color: tinta }]}>,{dec}</Text> : null}
      <Animated.View style={[estilos.cursor, { height: Math.round(pequeno * 1.05), backgroundColor: c.azul }, !ativo && estilos.semCursor, cursor]} />
      {faltam ? <Text maxFontSizeMultiplier={1.2} style={[base, { fontSize: pequeno, color: c.fraco, opacity: c.escuro ? 0.7 : 0.8 }]}>{faltam}</Text> : null}
    </Animated.View>
  );
}

/* ---------- O teclado ---------- */

const LINHAS: Tecla[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], [',', '0', 'apagar']];

// O ícone de apagar (no iPhone, o do sistema)
function IconeApagar({ cor }: { cor: string }) {
  const svg = (
    <Svg width={28} height={22} viewBox="0 0 28 22">
      <Path d="M9.2 2h14.3A2.5 2.5 0 0 1 26 4.5v13a2.5 2.5 0 0 1-2.5 2.5H9.2a2.5 2.5 0 0 1-1.9-.9L2 11l5.3-8.1A2.5 2.5 0 0 1 9.2 2z" fill="none" stroke={cor} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M13 7.5l7 7M20 7.5l-7 7" stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
  if (Platform.OS !== 'ios') return svg;
  return <SymbolView name="delete.left" size={24} tintColor={cor} weight="medium" style={{ width: 30, height: 24 }} fallback={svg} />;
}

function BotaoTecla({ t, altura, aoTeclar, aoLimpar }: { t: Tecla; altura: number; aoTeclar: (t: Tecla) => void; aoLimpar: () => void }) {
  const c = useCores();
  const rotulo = t === 'apagar' ? 'Apagar' : t === ',' ? 'Vírgula' : t;
  return (
    <Pressable
      onPressIn={() => vibrar('toque')}
      onPress={() => aoTeclar(t)}
      onLongPress={t === 'apagar' ? aoLimpar : undefined}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={t === 'apagar' ? 'Segure para limpar o valor' : undefined}
      style={({ pressed }) => [estilos.tecla, { height: altura, backgroundColor: pressed ? (c.escuro ? c.cartao3 : c.cartao3) : 'transparent' }]}>
      {t === 'apagar' ? <IconeApagar cor={c.texto} /> : (
        <Text allowFontScaling={false} style={[estilos.teclaTexto, { color: c.texto }, t === ',' && { fontSize: 32, lineHeight: 34, marginTop: -10 }]}>{t}</Text>
      )}
    </Pressable>
  );
}

export function Teclado({ altura = 54, aoTeclar, aoLimpar }: { altura?: number; aoTeclar: (t: Tecla) => void; aoLimpar: () => void }) {
  return (
    <View style={estilos.teclado}>
      {LINHAS.map((linha, i) => (
        <View key={i} style={estilos.teclaLinha}>
          {linha.map((t) => <BotaoTecla key={t} t={t} altura={altura} aoTeclar={aoTeclar} aoLimpar={aoLimpar} />)}
        </View>
      ))}
    </View>
  );
}

// O valor para o leitor de tela
export const falarValor = (txt: string) => (txt ? dinheiro(valorDoTexto(txt)) : 'vazio');

const estilos = StyleSheet.create({
  visor: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  cursor: { width: 3, borderRadius: 2, marginHorizontal: 2, alignSelf: 'center' },
  semCursor: { width: 0, marginHorizontal: 0 },
  teclado: { gap: 6 },
  teclaLinha: { flexDirection: 'row', gap: 8 },
  tecla: { flex: 1, borderRadius: 18, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  teclaTexto: { fontFamily: Fontes.titulo, fontSize: 28, lineHeight: 34 },
});
