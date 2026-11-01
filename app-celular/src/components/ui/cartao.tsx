// O cartão do Avina: grafite com borda de 1 px e um reflexo de luz no topo (escuro); branco com sombra suave (claro).
// - No iPhone com iOS 26 (Liquid Glass), o fundo vira vidro com uma tinta do tema (CamadaVidro), sobre a luz de fundo
//   da tela; fora dele (Android, iPhones antigos, "Reduzir transparência", a prévia web), fica sólido como sempre.
//   vidro={false} desliga (folhas que sobem de baixo, que têm fundo liso e nada para o vidro mostrar).
// - onPress: afunda de leve (0,98) e vibra; com o vidro, ele também reage ao toque.
// - destaque: uma cor que tinge o fundo e a borda bem de leve (um cartão de alerta, a área da loja...).
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { comAlfa, Tocavel } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { CamadaVidro, useVidroAtivo } from '@/components/ui/vidro';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

export type CartaoProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  rotulo?: string; // o que o leitor de tela fala quando o cartão inteiro é tocável
  destaque?: string; // cor de destaque (tinge o fundo e a borda)
  variante?: 'normal' | 'destaque' | 'plano'; // plano: sem reflexo nem sombra (dentro de outro cartão)
  padding?: number;
  raio?: number;
  vidro?: boolean; // false: sempre sólido (padrão: vidro no iOS 26)
};

export function Cartao({ children, style, onPress, onLongPress, rotulo, destaque, variante = 'normal', padding = Espaco.cinco, raio = Raio.cartao, vidro = true }: CartaoProps) {
  const c = useCores();
  const tinta = destaque ?? (variante === 'destaque' ? c.azul : null);
  const plano = variante === 'plano';
  const comVidro = useVidroAtivo() && vidro && !plano;
  const tocavel = !!(onPress || onLongPress);
  const fundo: ViewStyle = {
    backgroundColor: comVidro ? 'transparent' : plano ? c.cartao2 : c.cartao,
    borderRadius: raio,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tinta ? comAlfa(tinta, c.escuro ? 0.32 : 0.28) : c.linha,
    padding,
    gap: Espaco.dois,
    // no claro, a sombra bem leve; no escuro, a borda e o reflexo bastam (o vidro já traz a própria luz e sombra)
    boxShadow: !plano && !comVidro && !c.escuro ? `0px 6px 16px ${comAlfa(c.sombra, 0.06)}` : undefined,
  };
  const enfeite = (
    <>
      {comVidro ? <CamadaVidro raio={raio - 1} interativo={tocavel} /> : null}
      {tinta ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: raio, backgroundColor: comAlfa(tinta, c.escuro ? 0.1 : 0.06) }]} /> : null}
      {!plano && !comVidro && c.escuro ? (
        <LinearGradient
          pointerEvents="none"
          colors={[tinta ? comAlfa(tinta, 0.14) : c.brilho, 'rgba(255,255,255,0)']}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.42 }}
          style={[StyleSheet.absoluteFill, { borderRadius: raio, overflow: 'hidden' }]}
        />
      ) : null}
    </>
  );
  if (!tocavel) {
    return <View style={[fundo, style]}>{enfeite}{children}</View>;
  }
  return (
    <Tocavel onPress={onPress} onLongPress={onLongPress} accessibilityLabel={rotulo} style={[fundo, style]}>
      {enfeite}
      {children}
    </Tocavel>
  );
}

// O topo do cartão: rótulo em cinza à esquerda (com ícone opcional) e a setinha quando o cartão abre algo.
// Nos cartões de meia largura (iPhone pequeno, letra grande), o rótulo quebra em duas linhas em vez de cortar.
export function CartaoTitulo({ rotulo, icone, cor, direita, tocavel }: { rotulo: string; icone?: NomeIcone; cor?: string; direita?: ReactNode; tocavel?: boolean }) {
  const c = useCores();
  return (
    <View style={estilos.titulo}>
      {icone ? <Icone nome={icone} tamanho={16} cor={cor ?? c.apoio} peso="semibold" /> : null}
      <Texto numberOfLines={2} style={estilos.rotulo} cor={cor ?? c.apoio}>{rotulo}</Texto>
      {direita}
      {tocavel ? <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  rotulo: { flex: 1, fontFamily: Fontes.texto, fontSize: 15, lineHeight: 20 },
});
