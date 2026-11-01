// Pílulas (selos de situação: "Hoje", "Pro · ativo", "3 categorias") e chips de filtro que rolam para o lado.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { comAlfa, Tocavel } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

// Selo pequeno, sem toque. cor: a cor do texto (o fundo é a mesma cor, bem clarinha)
export function Pilula({ texto, cor, icone, style }: { texto: string; cor?: string; icone?: NomeIcone; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const tinta = cor ?? c.apoio;
  return (
    <View style={[estilos.pilula, { backgroundColor: cor ? comAlfa(cor, c.escuro ? 0.16 : 0.12) : c.cartao2 }, style]}>
      {icone ? <Icone nome={icone} tamanho={12} cor={tinta} peso="bold" /> : null}
      <Texto numberOfLines={1} cor={tinta} maxFontSizeMultiplier={1.3} style={estilos.pilulaTexto}>{texto}</Texto>
    </View>
  );
}

export type ChipProps = {
  titulo: string;
  ativo?: boolean;
  onPress?: () => void;
  icone?: NomeIcone;
  esquerda?: ReactNode; // no lugar do ícone (ex.: uma bolinha de cor ou uma logo pequena)
  contagem?: number;
  papel?: 'radio' | 'checkbox' | 'button';
};

// Chip de filtro: o escolhido fica "aceso" (cor do texto no fundo, como nos apps de banco)
export function Chip({ titulo, ativo, onPress, icone, esquerda, contagem, papel = 'radio' }: ChipProps) {
  const c = useCores();
  const tinta = ativo ? c.fundo : c.texto;
  return (
    <Tocavel
      onPress={onPress}
      escala={0.95}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole={papel}
      accessibilityLabel={contagem != null ? `${titulo}, ${contagem}` : titulo}
      accessibilityState={papel === 'button' ? undefined : { checked: !!ativo }}
      style={[estilos.chip, ativo ? { backgroundColor: c.texto, borderColor: c.texto } : { backgroundColor: c.cartao, borderColor: c.linhaForte }]}>
      {esquerda ?? (icone ? <Icone nome={icone} tamanho={15} cor={tinta} peso="semibold" /> : null)}
      <Texto numberOfLines={1} cor={tinta} maxFontSizeMultiplier={1.3} style={estilos.chipTexto}>{titulo}</Texto>
      {contagem != null ? (
        <View style={[estilos.contagem, { backgroundColor: ativo ? comAlfa(c.escuro ? '#000000' : '#FFFFFF', 0.16) : c.cartao3 }]}>
          <Texto cor={tinta} maxFontSizeMultiplier={1.2} style={estilos.contagemTexto}>{contagem}</Texto>
        </View>
      ) : null}
    </Tocavel>
  );
}

export type OpcaoChip<T> = { id: T; nome: string; icone?: NomeIcone; contagem?: number };

// Um grupo de chips (só um escolhido) que rola para o lado. A mesma API do Chips antigo (components/base.tsx).
export function Chips<T extends string | number>({ opcoes, valor, onTrocar, rotulo, margem = Espaco.cinco, style }: {
  opcoes: OpcaoChip<T>[];
  valor: T;
  onTrocar: (v: T) => void;
  rotulo: string;
  margem?: number; // espaço nas pontas (o mesmo da tela)
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={{ gap: Espaco.dois, paddingHorizontal: margem }}
      accessibilityRole="radiogroup"
      accessibilityLabel={rotulo}>
      {opcoes.map((o) => (
        <Chip key={String(o.id)} titulo={o.nome} icone={o.icone} contagem={o.contagem} ativo={o.id === valor} onPress={() => { if (o.id !== valor) onTrocar(o.id); }} />
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pilula: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: Raio.pilula },
  pilulaTexto: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 40, borderRadius: Raio.pilula, borderWidth: 1 },
  chipTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
  contagem: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contagemTexto: { fontFamily: Fontes.textoPesado, fontSize: 11, lineHeight: 14 },
});
