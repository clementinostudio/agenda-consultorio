// Estados de espera e de "nada aqui ainda": a ilustração simples com texto e ação, e o esqueleto que brilha.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Icone, type NomeIcone } from '@/components/icone';
import { Botao } from '@/components/ui/botao';
import { comAlfa } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Espaco, Raio, useCores } from '@/constants/theme';

export type VazioProps = {
  icone?: NomeIcone;
  ilustracao?: ReactNode; // no lugar do ícone (ex.: <Mascote />)
  titulo: string;
  texto?: string;
  acao?: { titulo: string; onPress: () => void; icone?: NomeIcone };
  cor?: string;
  style?: StyleProp<ViewStyle>;
};

// Círculos de luz com o ícone no meio, título, texto e um botão
export function Vazio({ icone = 'faisca', ilustracao, titulo, texto, acao, cor, style }: VazioProps) {
  const c = useCores();
  const tinta = cor ?? c.azul;
  return (
    <View style={[estilos.vazio, style]}>
      <View style={estilos.ilustra} accessible={false} importantForAccessibility="no-hide-descendants">
        <Svg width={132} height={132} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="vazio-luz" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tinta} stopOpacity={c.escuro ? 0.32 : 0.2} />
              <Stop offset="1" stopColor={tinta} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={66} cy={66} r={66} fill="url(#vazio-luz)" />
          <Circle cx={66} cy={66} r={50} fill="none" stroke={comAlfa(tinta, 0.18)} strokeWidth={1} strokeDasharray="3 5" />
        </Svg>
        {ilustracao ?? (
          <View style={[estilos.medalha, { backgroundColor: c.cartao, borderColor: comAlfa(tinta, 0.35) }]}>
            <Icone nome={icone} tamanho={28} cor={tinta} cheio />
          </View>
        )}
      </View>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <Texto v="subtitulo" style={{ textAlign: 'center' }}>{titulo}</Texto>
        {texto ? <Texto v="apoio" style={{ textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 300 }}>{texto}</Texto> : null}
      </View>
      {acao ? <Botao titulo={acao.titulo} icone={acao.icone} onPress={acao.onPress} tamanho="medio" style={{ alignSelf: 'center', marginTop: Espaco.dois }} /> : null}
    </View>
  );
}

// Bloco cinza com um brilho passando (carregando). largura/altura em pt ou "%".
export function Esqueleto({ largura = '100%', altura = 16, raio = 8, style }: { largura?: DimensionValue; altura?: number; raio?: number; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduzir || !w) return;
    p.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false));
  }, [p, reduzir, w]);
  const brilho = useAnimatedStyle(() => ({ transform: [{ translateX: -w + p.get() * w * 2 }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      style={[{ width: largura, height: altura, borderRadius: raio, backgroundColor: c.cartao2, overflow: 'hidden' }, style]}>
      {!reduzir && w ? (
        <Animated.View style={[StyleSheet.absoluteFill, brilho]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', c.escuro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Lista carregando: linhas com a bolinha da logo, duas linhas de texto e o valor
export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <View style={{ gap: Espaco.quatro }} accessible accessibilityRole="progressbar" accessibilityLabel="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.tres }}>
          <Esqueleto largura={44} altura={44} raio={22} />
          <View style={{ flex: 1, gap: 8 }}>
            <Esqueleto largura={`${70 - (i % 3) * 12}%`} altura={14} />
            <Esqueleto largura="40%" altura={11} />
          </View>
          <Esqueleto largura={64} altura={14} />
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  vazio: { alignItems: 'center', gap: Espaco.tres, paddingVertical: Espaco.seis, paddingHorizontal: Espaco.cinco },
  ilustra: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  medalha: { width: 64, height: 64, borderRadius: Raio.pilula, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
