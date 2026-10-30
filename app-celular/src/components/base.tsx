// Peças de tela do Avina: texto, cartão, chips, botão de vidro e a tela que rola.
// O vidro é o Liquid Glass do iOS 26; no Android e em iPhones mais antigos vira um botão sólido.
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

export const temVidro = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

// Vibração leve: "toque" nos chips, "ok" ao concluir, "aviso" quando algo dá errado
export function vibrar(tipo: 'toque' | 'ok' | 'aviso' = 'toque') {
  if (Platform.OS === 'web') return;
  if (tipo === 'toque') Haptics.selectionAsync().catch(() => {});
  else if (tipo === 'ok') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

type Variante = 'titulo' | 'subtitulo' | 'texto' | 'forte' | 'apoio' | 'rotulo' | 'numero';
const ESTILO: Record<Variante, TextStyle> = {
  titulo: { fontFamily: Fontes.tituloForte, fontSize: 30, letterSpacing: -0.6 },
  subtitulo: { fontFamily: Fontes.titulo, fontSize: 18 },
  texto: { fontFamily: Fontes.texto, fontSize: 15, lineHeight: 21 },
  forte: { fontFamily: Fontes.textoForte, fontSize: 15 },
  apoio: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: Fontes.textoPesado, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  numero: { fontFamily: Fontes.tituloForte, fontSize: 40, letterSpacing: -1, fontVariant: ['tabular-nums'] },
};
export function Texto({ v = 'texto', cor, style, ...p }: TextProps & { v?: Variante; cor?: string }) {
  const c = useCores();
  return <Text {...p} style={[ESTILO[v], { color: cor ?? (v === 'apoio' ? c.apoio : c.texto) }, style]} />;
}

export function Cartao({ children, style, onPress, destaque }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; destaque?: string }) {
  const c = useCores();
  const fundo: ViewStyle = {
    backgroundColor: c.cartao, borderRadius: Raio.cartao, padding: Espaco.cinco, gap: Espaco.dois, borderCurve: 'continuous',
    borderWidth: destaque ? 1.5 : c.escuro ? 0 : StyleSheet.hairlineWidth, borderColor: destaque ?? c.linha,
  };
  if (!onPress) return <View style={[fundo, style]}>{children}</View>;
  return (
    <Pressable onPress={() => { vibrar(); onPress(); }} style={({ pressed }) => [fundo, style, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}>
      {children}
    </Pressable>
  );
}

export function Chips<T extends string | number>({ opcoes, valor, onTrocar, rotulo }: { opcoes: { id: T; nome: string }[]; valor: T; onTrocar: (v: T) => void; rotulo: string }) {
  const c = useCores();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Espaco.dois, paddingHorizontal: Espaco.cinco }} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
      {opcoes.map((o) => {
        const on = o.id === valor;
        return (
          <Pressable
            key={String(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => { if (!on) { vibrar(); onTrocar(o.id); } }}
            style={({ pressed }) => [estilos.chip, { backgroundColor: on ? c.mentaFundo : c.cartao2, borderColor: on ? c.menta : 'transparent' }, pressed && { opacity: 0.7 }]}>
            <Texto v="forte" cor={on ? c.menta : c.texto} style={{ fontSize: 14 }}>{o.nome}</Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Botão principal: vidro com a cor da área no iOS 26, sólido no resto
export function BotaoVidro({ children, onPress, cor, rotulo }: { children: ReactNode; onPress: () => void; cor?: string; rotulo: string }) {
  const c = useCores();
  const tinta = cor ?? c.menta;
  const dentro = <View style={estilos.botaoDentro}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} onPress={() => { vibrar(); onPress(); }} style={({ pressed }) => [pressed && !temVidro && { opacity: 0.8 }]}>
      {temVidro
        ? <GlassView isInteractive tintColor={tinta} glassEffectStyle="regular" style={estilos.botao}>{dentro}</GlassView>
        : <View style={[estilos.botao, { backgroundColor: tinta }]}>{dentro}</View>}
    </Pressable>
  );
}

// A tela que rola, com o título grande no topo e espaço para a barra de abas embaixo
export function Tela({ titulo, sub, children, atualizando, aoAtualizar, direita }: { titulo: string; sub?: string; children: ReactNode; atualizando?: boolean; aoAtualizar?: () => void; direita?: ReactNode }) {
  const c = useCores();
  const topo = useSafeAreaInsets().top;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fundo }}
      contentContainerStyle={{ paddingTop: topo + Espaco.quatro, paddingBottom: 120, gap: Espaco.quatro }}
      refreshControl={aoAtualizar ? <RefreshControl refreshing={!!atualizando} onRefresh={aoAtualizar} tintColor={c.apoio} /> : undefined}>
      <View style={{ paddingHorizontal: Espaco.cinco, flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.tres }}>
        <View style={{ flex: 1 }}>
          {sub ? <Texto v="apoio" style={{ fontFamily: Fontes.textoForte }}>{sub}</Texto> : null}
          <Texto v="titulo" accessibilityRole="header">{titulo}</Texto>
        </View>
        {direita}
      </View>
      {children}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  chip: { paddingHorizontal: 14, height: 38, borderRadius: Raio.pilula, borderWidth: 2, justifyContent: 'center' },
  botao: { borderRadius: Raio.pilula, overflow: 'hidden' },
  botaoDentro: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, height: 44 },
});
