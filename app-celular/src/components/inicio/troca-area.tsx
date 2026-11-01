// A troca de área do Início (Consultório, Pessoal, Loja): chips que rolam para o lado, no topo grande (embaixo da
// saudação) e na barra de cima que aparece ao rolar (topo.tsx). Só aparece com mais de uma área ligada.
// - A escolhida fica acesa na cor da área (o azul do Consultório, a menta do Pessoal), como a pílula do site.
// - Loja ainda não tem tela nativa: o chip dela tem a setinha e abre a loja no site (quem decide é o Início).
import { Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { areasDoInicio, type AreaFoco } from '@/components/inicio/foco';
import { comAlfa, Icone, Texto, Tocavel, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores, type Paleta } from '@/constants/theme';
import type { Estado, Modo } from '@/lib/motor';

export const INFO_AREA: Record<Modo, { nome: string; icone: NomeIcone; cor: (c: Paleta) => string; tinta: (c: Paleta) => string }> = {
  consultorio: { nome: 'Consultório', icone: 'consultorio', cor: (c) => c.azul, tinta: () => '#FFFFFF' },
  pessoal: { nome: 'Pessoal', icone: 'carteira', cor: (c) => c.menta, tinta: (c) => c.tintaBotao },
  loja: { nome: 'Loja', icone: 'loja', cor: (c) => c.loja, tinta: (c) => c.tintaBotao },
};

export const ALTURA_CHIP = 36;
const FOLGA = 10;

export function TrocaArea({ e, area, aoTrocar, margem = Espaco.quatro, style }: {
  e: Estado;
  area: AreaFoco | null;
  aoTrocar: (a: Modo) => void; // 'loja': abrir no site
  margem?: number; // o espaço nas pontas (o mesmo da tela)
  style?: StyleProp<ViewStyle>;
}) {
  const c = useCores();
  const areas = areasDoInicio(e);
  if (areas.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // o brilho do chip aceso passa da altura dele: a folga em cima e embaixo não deixa a rolagem cortar o brilho
      style={[{ flexGrow: 0, marginVertical: -FOLGA }, style]}
      contentContainerStyle={{ gap: Espaco.dois, paddingHorizontal: margem, paddingVertical: FOLGA }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Área do Início">
      {areas.map((m) => {
        const info = INFO_AREA[m];
        const nativa = m !== 'loja';
        const ativo = nativa && m === area;
        const cor = info.cor(c);
        const tinta = ativo ? info.tinta(c) : c.texto;
        return (
          <Tocavel
            key={m}
            onPress={() => { if (!ativo) aoTrocar(m); }}
            escala={0.95}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole={nativa ? 'radio' : 'button'}
            accessibilityLabel={info.nome}
            accessibilityHint={nativa ? `Mostra primeiro o que é do ${info.nome}` : 'Abre a loja no Avina completo'}
            accessibilityState={nativa ? { checked: ativo } : undefined}
            style={[
              estilos.chip,
              ativo
                ? { backgroundColor: cor, borderColor: cor, boxShadow: `0px 3px 10px ${comAlfa(cor, c.escuro ? 0.3 : 0.24)}` }
                : { backgroundColor: c.escuro ? comAlfa('#FFFFFF', 0.07) : comAlfa('#FFFFFF', 0.92), borderColor: c.linhaForte },
            ]}>
            {/* o ícone cheio só no iPhone (o desenho cheio da carteira, no Android, vira um quadrado) */}
            <Icone nome={info.icone} tamanho={15} cor={ativo ? tinta : cor} cheio={ativo && Platform.OS === 'ios'} peso="semibold" />
            <Texto numberOfLines={1} cor={tinta} maxFontSizeMultiplier={1.3} style={estilos.texto}>{info.nome}</Texto>
            {nativa ? null : <Icone nome="chevron" tamanho={10} cor={c.fraco} peso="bold" />}
          </Tocavel>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: ALTURA_CHIP, paddingHorizontal: 14, borderRadius: Raio.pilula, borderWidth: 1 },
  texto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
});
