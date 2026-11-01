// A foto da conta: sempre um círculo perfeito. A foto (data URL que o site manda) cobre o círculo todo (cover, sem
// faixa nem canto aparecendo); sem foto, as iniciais num círculo azul e roxo do Avina.
// - O recorte é feito duas vezes (a caixa com overflow e a própria imagem com o raio): no Android e no iPhone uma
//   foto quadrada com fundo branco não deixa ponta para fora.
// - borderCurve 'circular' de propósito: o 'continuous' (o dos cartões) num quadrado com raio da metade vira um
//   "squircle", que no iPhone parece um quadrado de cantos moles.
// - O anel fica por cima, numa camada à parte (não come a foto nem muda o tamanho).
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fontes, useCores } from '@/constants/theme';

// "Felipe Clementino" → "FC"; "felipe@exemplo.com" → "F"
export const iniciais = (nome: string) => {
  const p = nome.trim().split(/[\s@]+/).filter(Boolean);
  const duas = p.length > 1 && !nome.includes('@');
  return ((p[0]?.[0] ?? '') + (duas ? p[p.length - 1][0] : '')).toUpperCase() || '?';
};

export type AvatarProps = {
  nome: string; // para as iniciais (o nome, ou o e-mail)
  foto: string | null;
  tamanho?: number;
  anel?: string | false; // a cor do anel fininho em volta (padrão: a linha do tema); false: sem anel
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ nome, foto, tamanho = 44, anel, style }: AvatarProps) {
  const c = useCores();
  const r = tamanho / 2;
  const circulo: ViewStyle = { width: tamanho, height: tamanho, borderRadius: r, borderCurve: 'circular', overflow: 'hidden' };
  return (
    <View style={[circulo, estilos.meio, { backgroundColor: c.cartao2 }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      {foto ? (
        <Image
          source={{ uri: foto }}
          contentFit="cover"
          contentPosition="center"
          transition={160}
          accessible={false}
          style={{ width: tamanho, height: tamanho, borderRadius: r }}
        />
      ) : (
        <>
          <LinearGradient colors={[c.azul, c.roxo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
          <Text allowFontScaling={false} style={[estilos.iniciais, { fontSize: Math.round(tamanho * 0.36), letterSpacing: -tamanho * 0.008 }]}>{iniciais(nome)}</Text>
        </>
      )}
      {anel === false ? null : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: r, borderCurve: 'circular', borderWidth: tamanho >= 80 ? 2 : 1.5, borderColor: anel ?? c.linhaForte }]}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  meio: { alignItems: 'center', justifyContent: 'center' },
  iniciais: { color: '#FFFFFF', fontFamily: Fontes.tituloForte },
});
