// As linhas da lista de Atividades: o título de cada dia (com o total discreto) e o lançamento (logo com o selo do
// banco, descrição, "17 de out · Categoria", o banco embaixo e o valor à direita).
// As duas têm altura fixa (que cresce com a letra do aparelho até 1,35×): a lista calcula a posição de cada linha
// sem medir (getItemLayout), e rolar para longe fica leve mesmo com um ano de lançamentos.
import { memo, useRef, type ComponentRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native';

import { dataCurtaLista, rotuloLanc, valorEstrangeiro } from '@/components/atividades/acoes';
import { Tocavel } from '@/components/ui/comum';
import { Logo } from '@/components/ui/logo';
import { Fontes, useCores } from '@/constants/theme';
import { dataRelativa, dinheiro } from '@/lib/formato';
import type { Categoria, Lanc } from '@/lib/motor';

export const ESCALA_MAX = 1.35; // até quanto a letra do aparelho aumenta o texto das linhas
export const LOGO = 46;
export const MARGEM = 20; // a margem das laterais da tela

// As alturas das linhas para a letra de agora do aparelho
export function useAlturas() {
  const { fontScale } = useWindowDimensions();
  const k = Math.min(Math.max(fontScale || 1, 0.8), ESCALA_MAX);
  return {
    linha: Math.round(Math.max(LOGO + 24, 18 + (21 + 18 + 17 + 2) * k)),
    dia: Math.round(30 + 23 * k),
  };
}

export type Retangulo = { x: number; y: number; w: number; h: number };

export type LinhaLancProps = {
  l: Lanc;
  cat: Categoria | null;
  oculto: boolean;
  altura: number;
  aoAbrir: (l: Lanc) => void;
  aoSegurar?: (l: Lanc, onde: Retangulo) => void; // o menu do toque longo (onde: a linha na tela)
  aoEditar?: (l: Lanc) => void; // ações do leitor de tela
  aoApagar?: (l: Lanc) => void;
  fundo?: string; // a cor atrás da linha (o anel do selo do banco)
};

// O conteúdo da linha (a lista e a prévia do menu usam o mesmo)
export function ConteudoLanc({ l, cat, oculto, fundo }: { l: Lanc; cat: Categoria | null; oculto: boolean; fundo?: string }) {
  const c = useCores();
  const entrada = l.tipo === 'entrada';
  const sub = [dataCurtaLista(l.data), cat?.nome].filter(Boolean).join(' · ');
  return (
    <>
      <Logo marca={l.marca} site={l.site} nome={l.desc} cat={cat} banco={l.banco} tamanho={LOGO} anel={fundo ?? c.fundo} />
      <View style={estilos.meio}>
        <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.titulo, { color: c.texto }]}>{l.desc || cat?.nome || 'Sem descrição'}</Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.sub, { color: c.apoio }]}>{sub}</Text>
        {l.banco ? <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.sub2, { color: c.fraco }]}>{l.banco}</Text> : null}
      </View>
      <View style={estilos.direita}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={ESCALA_MAX}
          style={[estilos.valor, { color: oculto ? c.apoio : entrada ? c.positivo : c.texto }]}>
          {oculto ? 'R$ ••••' : dinheiro(entrada ? l.valor : -l.valor, { sinal: true })}
        </Text>
        {l.moeda && l.valorOrig && !oculto ? (
          <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.sub2, { color: c.fraco }]}>{valorEstrangeiro(l.moeda, l.valorOrig)}</Text>
        ) : null}
      </View>
    </>
  );
}

const ACOES_LEITOR = [
  { name: 'activate', label: 'Ver detalhes' },
  { name: 'editar', label: 'Editar no site' },
  { name: 'apagar', label: 'Apagar' },
];

export const LinhaLanc = memo(function LinhaLanc({ l, cat, oculto, altura, aoAbrir, aoSegurar, aoEditar, aoApagar, fundo }: LinhaLancProps) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const segurar = () => {
    const v = ref.current;
    if (!v || !aoSegurar) return;
    v.measureInWindow((x, y, w, h) => aoSegurar(l, { x, y, w, h }));
  };
  const acaoLeitor = (e: AccessibilityActionEvent) => {
    const n = e.nativeEvent.actionName;
    if (n === 'activate') aoAbrir(l);
    else if (n === 'editar') aoEditar?.(l);
    else if (n === 'apagar') aoApagar?.(l);
  };
  return (
    <View ref={ref} collapsable={false} style={{ height: altura }}>
      <Tocavel
        onPress={() => aoAbrir(l)}
        onLongPress={aoSegurar ? segurar : undefined}
        delayLongPress={320}
        escala={0.985}
        accessibilityLabel={rotuloLanc(l, cat, oculto)}
        accessibilityHint="Toque para ver os detalhes. Toque e segure para editar ou apagar."
        accessibilityActions={ACOES_LEITOR}
        onAccessibilityAction={acaoLeitor}
        style={[estilos.linha, { height: altura }]}>
        <ConteudoLanc l={l} cat={cat} oculto={oculto} fundo={fundo} />
      </Tocavel>
    </View>
  );
});

// O título do dia ("Hoje", "Ontem", "Quinta-feira", "17 de out.") com o quanto saiu e entrou no dia, discreto
export const CabecalhoDia = memo(function CabecalhoDia({ data, saiu, entrou, oculto, altura }: { data: string; saiu: number; entrou: number; oculto: boolean; altura: number }) {
  const c = useCores();
  const titulo = dataRelativa(data);
  const falar = oculto
    ? titulo
    : [titulo, saiu > 0 ? `saíram ${dinheiro(saiu)}` : null, entrou > 0 ? `entraram ${dinheiro(entrou)}` : null].filter(Boolean).join(', ');
  return (
    <View style={[estilos.dia, { height: altura }]} accessible accessibilityRole="header" accessibilityLabel={falar}>
      <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.diaTitulo, { color: c.texto }]}>{titulo}</Text>
      <View style={estilos.diaTotais}>
        {oculto ? (
          <Text maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.diaTotal, { color: c.fraco }]}>R$ ••••</Text>
        ) : (
          <>
            {entrou > 0 ? <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.diaTotal, { color: c.positivo }]}>{dinheiro(entrou, { sinal: true })}</Text> : null}
            {saiu > 0 ? <Text numberOfLines={1} maxFontSizeMultiplier={ESCALA_MAX} style={[estilos.diaTotal, { color: c.apoio }]}>{dinheiro(-saiu)}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
});

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: MARGEM },
  meio: { flex: 1, minWidth: 0, gap: 1 },
  titulo: { fontFamily: Fontes.textoForte, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  sub: { fontFamily: Fontes.texto, fontSize: 13.5, lineHeight: 18 },
  sub2: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 17 },
  direita: { alignItems: 'flex-end', gap: 1, maxWidth: '42%' },
  valor: { fontFamily: Fontes.numero, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  dia: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: MARGEM, paddingBottom: 8 },
  diaTitulo: { flex: 1, fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  diaTotais: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 1 },
  diaTotal: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
