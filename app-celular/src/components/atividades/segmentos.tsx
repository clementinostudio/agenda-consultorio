// Controle de segmentos (Gasto | Entrada; Tudo | Saídas | Entradas): uma pílula com o escolhido "aceso" por uma
// peça que desliza até ele (sem deslizar com "reduzir movimento").
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';

import { Tocavel, comAlfa } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Fontes, Raio, useCores } from '@/constants/theme';

export function Segmentos<T extends string>({ opcoes, valor, onTrocar, rotulo, cores, altura = 40, style }: {
  opcoes: { id: T; nome: string }[];
  valor: T;
  onTrocar: (v: T) => void;
  rotulo: string;
  cores?: Partial<Record<T, string>>; // a cor do texto do escolhido (ex.: menta na Entrada)
  altura?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [largura, setLargura] = useState(0);
  const i = Math.max(0, opcoes.findIndex((o) => o.id === valor));
  // a largura de dentro: tira a borda (1 + 1) e o espaço de dentro (3 + 3), senão a peça passa da borda
  const cada = largura ? (largura - 8) / opcoes.length : 0;
  const peca = useAnimatedStyle(() => ({
    width: cada,
    transform: [{ translateX: reduzir ? i * cada : withTiming(i * cada, { duration: 260, easing: Easing.bezier(0.3, 0.9, 0.2, 1) }) }],
  }));
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={rotulo}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      style={[estilos.trilho, { height: altura, backgroundColor: c.escuro ? c.cartao2 : c.cartao3, borderColor: c.linha }, style]}>
      {largura ? (
        <Animated.View
          pointerEvents="none"
          style={[
            estilos.peca,
            { height: altura - 8, backgroundColor: c.escuro ? c.cartao3 : c.cartao },
            !c.escuro && { boxShadow: `0px 2px 8px ${comAlfa(c.sombra, 0.12)}` },
            peca,
          ]}
        />
      ) : null}
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        return (
          <Tocavel
            key={o.id}
            onPress={() => { if (!ativo) onTrocar(o.id); }}
            escala={0.96}
            accessibilityRole="radio"
            accessibilityLabel={o.nome}
            accessibilityState={{ checked: ativo }}
            hitSlop={{ top: Math.max(0, (44 - altura) / 2), bottom: Math.max(0, (44 - altura) / 2) }}
            style={estilos.opcao}>
            <Texto
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              cor={ativo ? cores?.[o.id] ?? c.texto : c.apoio}
              style={estilos.texto}>
              {o.nome}
            </Texto>
          </Tocavel>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: { flexDirection: 'row', borderRadius: Raio.pilula, borderCurve: 'continuous', padding: 3, borderWidth: 1 },
  peca: { position: 'absolute', left: 3, top: 3, borderRadius: Raio.pilula, borderCurve: 'continuous' },
  opcao: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  texto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
});
