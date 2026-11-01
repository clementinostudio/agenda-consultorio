// Peças da tela de Bancos: o número grande do topo de cada aba, a linha de uma conta (logo, nome, detalhe, valor e
// a parte do total) e o valor em texto que respeita o olho.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Dinheiro, Texto, Tocavel } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { dinheiro } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

// O número grande da aba (Saldo em contas, Total em faturas, Investido), com o que vier embaixo
export function Destaque({ rotulo, valor, children, corValor }: { rotulo: string; valor: number; children?: ReactNode; corValor?: string }) {
  return (
    <View style={estilos.destaque}>
      <Texto v="apoio" style={estilos.destaqueRotulo}>{rotulo}</Texto>
      <Dinheiro valor={valor} tamanho={40} cor={corValor} />
      {children}
    </View>
  );
}

// O valor em texto simples ("+R$ 1.250,32"), ou "R$ ••••" com o olho fechado
export function ValorTexto({ valor, sinal, cor, style }: { valor: number; sinal?: boolean; cor?: string; style?: StyleProp<TextStyle> }) {
  const oculto = useOculto();
  return (
    <Texto
      numberOfLines={1}
      cor={cor}
      maxFontSizeMultiplier={1.3}
      accessibilityLabel={oculto ? 'Valor escondido' : undefined}
      style={style}>
      {oculto ? 'R$ ••••' : dinheiro(valor, { sinal })}
    </Texto>
  );
}

// Bolinha de cor (liga a linha à parte dela na barra)
export const Ponto = ({ cor }: { cor: string }) => <View style={[estilos.ponto, { backgroundColor: cor }]} />;

export type LinhaContaProps = {
  esquerda: ReactNode;
  titulo: string;
  sub?: string;
  sub2?: string; // linha a mais, mais apagada (o vencimento do investimento)
  aviso?: { texto: string; cor: string }; // terceira linha colorida (cheque especial em uso, autorizar de novo)
  valor?: number;
  corValor?: string;
  abaixoValor?: ReactNode; // a porcentagem, o quanto rendeu
  direita?: ReactNode; // no lugar do valor
  onPress?: () => void;
  onLongPress?: () => void;
  rotulo?: string;
  style?: StyleProp<ViewStyle>;
};

export function LinhaConta({ esquerda, titulo, sub, sub2, aviso, valor, corValor, abaixoValor, direita, onPress, onLongPress, rotulo, style }: LinhaContaProps) {
  const c = useCores();
  const corpo = (
    <>
      {esquerda}
      <View style={estilos.meio}>
        <Texto v="forte" numberOfLines={1} style={estilos.titulo}>{titulo}</Texto>
        {sub ? <Texto v="apoio" numberOfLines={1}>{sub}</Texto> : null}
        {sub2 ? <Texto v="apoio" numberOfLines={1} cor={c.fraco}>{sub2}</Texto> : null}
        {aviso ? <Texto v="apoio" numberOfLines={2} cor={aviso.cor} style={{ fontFamily: Fontes.textoForte }}>{aviso.texto}</Texto> : null}
      </View>
      {direita ?? (valor != null ? (
        <View style={estilos.direita}>
          <Dinheiro valor={valor} tamanho={16} cor={corValor} animar={false} />
          {abaixoValor}
        </View>
      ) : null)}
    </>
  );
  if (!onPress && !onLongPress) {
    return <View style={[estilos.linha, style]} accessible accessibilityLabel={rotulo}>{corpo}</View>;
  }
  return (
    <Tocavel onPress={onPress} onLongPress={onLongPress} escala={0.985} accessibilityLabel={rotulo} style={[estilos.linha, style]}>
      {corpo}
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  destaque: { gap: 2 },
  destaqueRotulo: { fontSize: 15, lineHeight: 20 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 68, paddingVertical: Espaco.dois + 2 },
  meio: { flex: 1, gap: 2 },
  titulo: { fontSize: 16, lineHeight: 21 },
  direita: { alignItems: 'flex-end', gap: 3 },
});
