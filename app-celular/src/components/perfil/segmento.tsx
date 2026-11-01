// Controle de segmentos (Sistema · Claro · Escuro): a opção escolhida fica numa pílula que desliza até ela.
// Com "reduzir movimento", a pílula só aparece no lugar.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icone, Texto, Tocavel, type NomeIcone } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';

export type OpcaoSegmento<T> = { id: T; nome: string; icone?: NomeIcone };

export function Segmento<T extends string>({ opcoes, valor, onTrocar, rotulo }: { opcoes: OpcaoSegmento<T>[]; valor: T; onTrocar: (v: T) => void; rotulo: string }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [W, setW] = useState(0);
  const i = Math.max(0, opcoes.findIndex((o) => o.id === valor));
  // a largura de dentro do trilho: tira a borda (1 + 1) e o espaço de dentro (4 + 4), senão a pílula passa da borda
  const largura = W ? (W - 10) / opcoes.length : 0;
  const x = useSharedValue(i * largura);
  useEffect(() => {
    const alvo = i * largura;
    x.set(reduzir || !largura ? alvo : withSpring(alvo, { damping: 20, stiffness: 240 }));
  }, [i, largura, reduzir, x]);
  const pilula = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={rotulo}
      style={[estilos.trilho, { backgroundColor: c.cartao2, borderColor: c.linha }]}>
      {largura ? (
        <Animated.View
          pointerEvents="none"
          style={[estilos.pilula, { width: largura, backgroundColor: c.escuro ? c.cartao3 : '#FFFFFF', boxShadow: c.escuro ? undefined : `0px 2px 8px rgba(17,17,20,0.12)` }, pilula]}
        />
      ) : null}
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        const tinta = ativo ? c.texto : c.apoio;
        return (
          <Tocavel
            key={o.id}
            onPress={() => { if (!ativo) onTrocar(o.id); }}
            escala={0.96}
            accessibilityRole="radio"
            accessibilityLabel={o.nome}
            accessibilityState={{ checked: ativo }}
            style={estilos.opcao}>
            {o.icone ? <Icone nome={o.icone} tamanho={15} cor={tinta} cheio={ativo} peso="semibold" /> : null}
            <Texto numberOfLines={1} cor={tinta} maxFontSizeMultiplier={1.3} style={estilos.texto}>{o.nome}</Texto>
          </Tocavel>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: { flexDirection: 'row', padding: 4, borderRadius: Raio.pilula, borderWidth: 1 },
  pilula: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: Raio.pilula, borderCurve: 'continuous' },
  opcao: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  texto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
});
