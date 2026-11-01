// Linhas de lista (atividades, contas, ajustes), separador e o título de seção ("Personalização", "Conta").
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { Tocavel } from '@/components/ui/comum';
import { Dinheiro } from '@/components/ui/dinheiro';
import { Texto } from '@/components/ui/texto';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

export type LinhaProps = {
  titulo: string;
  sub?: string; // "21 de out. · Mercado"
  sub2?: string; // terceira linha, mais apagada (ex.: o banco)
  esquerda?: ReactNode; // <Logo />, <IconeCategoria />...
  icone?: NomeIcone; // atalho: ícone num quadradinho redondo (linhas de ajustes)
  corIcone?: string;
  valor?: number; // em reais; com sinal e cor (entrada +menta, saída −vermelho)
  tipo?: 'entrada' | 'saida'; // com "valor": decide o sinal
  direita?: ReactNode; // no lugar do valor
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  rotulo?: string;
  perigo?: boolean; // texto vermelho (Sair, Excluir conta)
  riscado?: boolean; // conta já paga, item cancelado
  style?: StyleProp<ViewStyle>;
};

export function Linha({ titulo, sub, sub2, esquerda, icone, corIcone, valor, tipo, direita, chevron, onPress, onLongPress, rotulo, perigo, riscado, style }: LinhaProps) {
  const c = useCores();
  const assinado = valor == null ? null : tipo === 'entrada' ? Math.abs(valor) : tipo === 'saida' ? -Math.abs(valor) : valor;
  const conteudo = (
    <>
      {esquerda ?? (icone ? (
        <View style={[estilos.icone, { backgroundColor: c.cartao2 }]}>
          <Icone nome={icone} tamanho={19} cor={perigo ? c.negativo : corIcone ?? c.texto} />
        </View>
      ) : null)}
      <View style={estilos.meio}>
        <Texto v="forte" numberOfLines={1} cor={perigo ? c.negativo : undefined} style={[estilos.titulo, riscado && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{titulo}</Texto>
        {sub ? <Texto v="apoio" numberOfLines={1}>{sub}</Texto> : null}
        {sub2 ? <Texto v="apoio" numberOfLines={1} cor={c.fraco}>{sub2}</Texto> : null}
      </View>
      {direita ?? (assinado != null ? (
        <Dinheiro valor={assinado} tamanho={16} sinal corPorSinal={assinado > 0} animar={false} fonte={Fontes.tituloForte} style={riscado ? { opacity: 0.5 } : undefined} />
      ) : null)}
      {chevron ? <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" /> : null}
    </>
  );
  if (!onPress && !onLongPress) return <View style={[estilos.linha, style]}>{conteudo}</View>;
  return (
    <Tocavel onPress={onPress} onLongPress={onLongPress} escala={0.985} accessibilityLabel={rotulo} style={[estilos.linha, style]}>
      {conteudo}
    </Tocavel>
  );
}

// Linha fininha entre itens. recuo: começa depois da logo (52 + espaço)
export function Separador({ recuo = 0, style }: { recuo?: number; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.linhaForte, marginLeft: recuo }, style]} />;
}

// Título de seção em cinza ("Personalização"), com uma ação opcional à direita ("Ver tudo")
export function Secao({ titulo, acao, children, style }: { titulo: string; acao?: { titulo: string; onPress: () => void }; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const topo = (
    <View style={estilos.secao}>
      <Texto accessibilityRole="header" numberOfLines={1} cor={c.apoio} style={estilos.secaoTitulo}>{titulo}</Texto>
      {acao ? (
        <Tocavel onPress={acao.onPress} hitSlop={10} escala={0.95} accessibilityLabel={acao.titulo}>
          <Texto cor={c.azulTinta} style={estilos.secaoAcao}>{acao.titulo}</Texto>
        </Tocavel>
      ) : null}
    </View>
  );
  if (!children) return <View style={style}>{topo}</View>;
  return <View style={[{ gap: Espaco.dois }, style]}>{topo}{children}</View>;
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 64, paddingVertical: Espaco.dois },
  icone: { width: 40, height: 40, borderRadius: Raio.pequeno, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  meio: { flex: 1, gap: 2 },
  titulo: { fontSize: 16, lineHeight: 21 },
  secao: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Espaco.tres, paddingHorizontal: Espaco.um },
  secaoTitulo: { flex: 1, fontFamily: Fontes.texto, fontSize: 15, lineHeight: 20 },
  secaoAcao: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 20 },
});
