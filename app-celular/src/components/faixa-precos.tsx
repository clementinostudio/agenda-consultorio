// A faixa de preços da região: do mais barato (verde) ao mais caro (vermelho), com o "comum daqui" marcado.
// Inspirada na barra do nascer do sol: dá para ver de relance o quanto o mais barato está longe do resto.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Texto } from '@/components/base';
import { useCores } from '@/constants/theme';
import { preco } from '@/lib/formato';

export function FaixaPrecos({ menor, tipico, maior }: { menor: number; tipico: number; maior: number }) {
  const c = useCores();
  const pos = maior > menor ? (tipico - menor) / (maior - menor) : 0.5;
  const x = useSharedValue(0);
  useEffect(() => { x.value = withDelay(150, withSpring(pos, { damping: 16 })); }, [pos, x]);
  const marca = useAnimatedStyle(() => ({ left: `${x.value * 100}%` }));
  return (
    <View style={{ gap: 6, marginTop: 6 }} accessible accessibilityLabel={`De ${preco(menor)} a ${preco(maior)}; o comum daqui é ${preco(tipico)}`}>
      <View style={{ height: 14, justifyContent: 'center' }}>
        <LinearGradient colors={[c.menta, c.ambar, c.rosa]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={estilos.barra} />
        <View style={[estilos.ponto, { left: 0, backgroundColor: c.menta, borderColor: c.cartao }]} />
        <Animated.View style={[estilos.ponto, estilos.marca, { backgroundColor: c.texto, borderColor: c.cartao }, marca]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Texto v="apoio" cor={c.menta} style={{ fontSize: 12 }}>{preco(menor)}</Texto>
        <Texto v="apoio" style={{ fontSize: 12 }}>comum {preco(tipico)}</Texto>
        <Texto v="apoio" cor={c.rosa} style={{ fontSize: 12 }}>{preco(maior)}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { height: 6, borderRadius: 3 },
  ponto: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  marca: { marginLeft: -7 },
});
