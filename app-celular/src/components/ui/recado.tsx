// O recado que aparece embaixo por uns segundos depois de uma ação, com "Desfazer" ("Conta paga · Desfazer").
// - mostrarRecado({ titulo, texto, acao }) de qualquer lugar; um recado novo troca o anterior.
// - Cada tela que usa põe um <Recado /> por cima do conteúdo (no fim da View da tela): ele aparece na tela que está
//   na frente. base: a distância até a borda de baixo (padrão: acima da barra de gestos).
// - Some sozinho (6 s com ação, 3,5 s sem) ou ao tocar na ação. O leitor de tela lê o recado.
// - Escuro no claro e grafite no escuro: aparece sobre qualquer cartão.
import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, type NomeIcone } from '@/components/icone';
import { comAlfa, Tocavel } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

export type DadosRecado = {
  titulo: string; // "Conta paga"
  texto?: string; // "Conta de luz · R$ 212,40"
  icone?: NomeIcone;
  cor?: string; // a cor do ícone (padrão: menta)
  acao?: { titulo: string; onPress: () => void }; // "Desfazer"
  duracao?: number; // ms
};

let atual: (DadosRecado & { n: number }) | null = null;
let contador = 0;
let montados = 0; // quantos <Recado /> estão na tela agora
let timer: ReturnType<typeof setTimeout> | undefined;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function mostrarRecado(r: DadosRecado) {
  clearTimeout(timer);
  atual = { ...r, n: ++contador };
  avisar();
  timer = setTimeout(esconderRecado, r.duracao ?? (r.acao ? 6000 : 3500));
  // o leitor de tela fala na hora (no Android, a região "viva" do recado já fala)
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility([r.titulo, r.texto].filter(Boolean).join('. '));
}

export function esconderRecado() {
  clearTimeout(timer);
  if (!atual) return;
  atual = null;
  avisar();
}

const useRecadoAtual = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => atual);

export function Recado({ base }: { base?: number }) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const r = useRecadoAtual();
  // a última tela com recado saiu (voltou ao Início): o recado não fica para depois. Fechar a folha do detalhe não
  // apaga o recado, que continua na tela de baixo ("Conta apagada")
  useEffect(() => { montados += 1; return () => { montados -= 1; if (!montados) esconderRecado(); }; }, []);
  if (!r) return null;
  // no claro, o recado é escuro (aparece sobre os cartões brancos); no escuro, um grafite mais claro que os cartões
  const fundo = c.escuro ? c.cartao3 : '#1C1C1F';
  const tinta = '#F4F4F5';
  const corAcao = c.escuro ? c.azulTinta : '#9DB0FF';
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, estilos.fora, { paddingBottom: base ?? Math.max(ins.bottom, Espaco.quatro) + Espaco.dois }]}>
      <Animated.View
        key={r.n}
        entering={reduzir ? undefined : FadeInDown.duration(240)}
        exiting={FadeOut.duration(160)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[estilos.recado, { backgroundColor: fundo, borderColor: c.escuro ? c.linhaForte : 'transparent' }, !c.escuro && { boxShadow: `0px 10px 28px ${comAlfa('#000000', 0.22)}` }]}>
        <View style={[estilos.icone, { backgroundColor: comAlfa(r.cor ?? c.menta, 0.2) }]}>
          <Icone nome={r.icone ?? 'check'} tamanho={15} cor={r.cor ?? (c.escuro ? c.menta : '#46E0A4')} peso="bold" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Texto numberOfLines={1} cor={tinta} maxFontSizeMultiplier={1.3} style={estilos.titulo}>{r.titulo}</Texto>
          {r.texto ? <Texto numberOfLines={1} cor={comAlfa(tinta, 0.68)} maxFontSizeMultiplier={1.3} style={estilos.texto}>{r.texto}</Texto> : null}
        </View>
        {r.acao ? (
          <Tocavel
            onPress={() => { const f = r.acao!.onPress; esconderRecado(); f(); }}
            vibra="leve"
            escala={0.94}
            hitSlop={8}
            accessibilityLabel={`${r.acao.titulo}: ${r.titulo}`}
            style={estilos.acao}>
            <Texto cor={corAcao} maxFontSizeMultiplier={1.3} style={estilos.acaoTexto}>{r.acao.titulo}</Texto>
          </Tocavel>
        ) : (
          <Tocavel onPress={esconderRecado} vibra={false} escala={0.9} hitSlop={10} accessibilityLabel="Fechar o recado" style={estilos.fechar}>
            <Icone nome="fechar" tamanho={12} cor={comAlfa(tinta, 0.6)} peso="bold" />
          </Tocavel>
        )}
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fora: { justifyContent: 'flex-end', paddingHorizontal: Espaco.quatro, zIndex: 20 },
  recado: {
    flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 58, paddingLeft: Espaco.tres, paddingRight: Espaco.um,
    paddingVertical: Espaco.dois, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1,
  },
  icone: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  texto: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 17 },
  acao: { minHeight: 44, minWidth: 44, paddingHorizontal: Espaco.tres, alignItems: 'center', justifyContent: 'center', borderRadius: Raio.pilula },
  acaoTexto: { fontFamily: Fontes.textoPesado, fontSize: 15, lineHeight: 20 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
