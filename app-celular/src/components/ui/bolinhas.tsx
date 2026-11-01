// As bolinhas de página do carrossel: a da página atual estica e acende.
// progresso: a posição da rolagem em páginas (scrollX / largura da página), para acompanhar o dedo;
// sem ele, usa "atual" (número da página) e anima ao trocar.
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { useCores } from '@/constants/theme';

function Bolinha({ i, pos, acesa, apagada }: { i: number; pos: SharedValue<number>; acesa: string; apagada: string }) {
  const estilo = useAnimatedStyle(() => {
    const perto = interpolate(Math.abs(pos.get() - i), [0, 1], [1, 0], Extrapolation.CLAMP);
    return { width: 7 + perto * 13, backgroundColor: interpolateColor(perto, [0, 1], [apagada, acesa]) };
  });
  return <Animated.View style={[estilos.bolinha, estilo]} />;
}

export function BolinhasPagina({ total, atual = 0, progresso, style }: { total: number; atual?: number; progresso?: SharedValue<number>; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const interno = useSharedValue(atual);
  useEffect(() => { interno.set(withSpring(atual, { damping: 18, stiffness: 200 })); }, [atual, interno]);
  const pos = progresso ?? interno;
  if (total < 2) return null;
  return (
    <View style={[estilos.linha, style]} accessible accessibilityLabel={`Página ${Math.round(atual) + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => <Bolinha key={i} i={i} pos={pos} acesa={c.texto} apagada={c.cartao3} />)}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 12 },
  bolinha: { height: 7, borderRadius: 4 },
});
