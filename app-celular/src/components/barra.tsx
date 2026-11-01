// A barra flutuante da casca (src/app/index.tsx): uma cápsula de vidro com Início, Atividades e Avina (a grade de
// áreas), com o destaque deslizando para a aba ativa, e o botão redondo da Bolinha à direita (abre o chat).
// No Início, acima da barra, a pílula "Pergunte à Bolinha": some ao rolar para baixo e volta ao rolar para cima
// (o Início mexe em "pilula", de 0 a 1). Também daqui: a folha com as áreas do Avina.
// No Android, o ícone cheio das Atividades vira um quadrado sem as linhas: lá ele fica só aceso na cor.
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { areasDe, GradeAreas } from '@/components/inicio/areas';
import { Avatar, BotaoRedondo, CamadaVidro, comAlfa, Icone, Linha, Mascote, Texto, Tocavel, useVidroAtivo, Vidro, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { useEstado } from '@/lib/motor';

export type Aba = 'inicio' | 'atividades';

const ALTURA = 64; // a cápsula e o botão da Bolinha
const FOLGA = 4; // o espaço entre a borda da cápsula e o destaque
export const ALTURA_BARRA = ALTURA + 12 + 50; // a barra com a pílula: para o fim das listas não ficar escondido

// a distância da barra até a borda de baixo (acima da linha de gestos do iPhone e do Android)
export const useBaseBarra = () => Math.max(Espaco.tres, useSafeAreaInsets().bottom - 6);

type Item = { id: Aba | 'avina'; nome: string; icone: NomeIcone; rotulo: string };
const ITENS: Item[] = [
  { id: 'inicio', nome: 'Início', icone: 'inicio', rotulo: 'Início' },
  { id: 'atividades', nome: 'Atividades', icone: 'atividades', rotulo: 'Atividades' },
  { id: 'avina', nome: 'Avina', icone: 'areas', rotulo: 'Áreas do Avina' },
];

export type BarraProps = {
  aba: Aba;
  aoTrocar: (a: Aba) => void; // também quando toca na aba que já está aberta (o Início sobe para o topo)
  aoAbrirAreas: () => void;
  areasAberta: boolean;
  pilula: SharedValue<number>; // 1: a pílula aparece; 0: escondida (o Início muda ao rolar)
};

export function Barra({ aba, aoTrocar, aoAbrirAreas, areasAberta, pilula }: BarraProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const base = useBaseBarra();
  const [largura, setLargura] = useState(0);
  const passo = largura ? (largura - FOLGA * 2) / ITENS.length : 0;
  const ativo = areasAberta ? 2 : aba === 'atividades' ? 1 : 0;

  // o destaque desliza até a aba ativa (com "reduzir movimento", só troca de lugar)
  const x = useSharedValue(0);
  useEffect(() => {
    const alvo = ativo * passo;
    x.set(reduzir ? alvo : withSpring(alvo, { damping: 20, stiffness: 240, mass: 0.8 }));
  }, [ativo, passo, reduzir, x]);
  const destaque = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  // a pílula: some no Atividades e ao rolar o Início para baixo
  const noInicio = useSharedValue(aba === 'inicio' ? 1 : 0);
  useEffect(() => { noInicio.set(withTiming(aba === 'inicio' ? 1 : 0, { duration: reduzir ? 0 : 180 })); }, [aba, reduzir, noInicio]);
  const estiloPilula = useAnimatedStyle(() => {
    const v = pilula.get() * noInicio.get();
    return { opacity: v, transform: [{ translateY: reduzir ? 0 : (1 - v) * 18 }, { scale: reduzir ? 1 : 0.94 + v * 0.06 }] };
  });
  // escondida, a pílula não recebe toques nem aparece para o leitor de tela
  const [pilulaVisivel, setPilulaVisivel] = useState(aba === 'inicio');
  useAnimatedReaction(
    () => pilula.get() * noInicio.get() > 0.5,
    (agora, antes) => { if (agora !== antes) scheduleOnRN(setPilulaVisivel, agora); },
  );

  return (
    // zIndex: a barra fica sempre por cima das abas da casca (que usam zIndex para a aba ativa)
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 10 }]}>
      {/* o fim da tela vai sumindo atrás da barra (no Android e sem o vidro, a barra fica legível sobre os cartões) */}
      <LinearGradient
        pointerEvents="none"
        colors={[comAlfa(c.fundo, 0), comAlfa(c.fundo, c.escuro ? 0.92 : 0.86)]}
        style={[estilos.esmaecer, { height: base + ALTURA + 56 }]}
      />
      <View pointerEvents="box-none" style={[estilos.barra, { paddingBottom: base }]}>
        <Animated.View
          pointerEvents={pilulaVisivel ? 'auto' : 'none'}
          accessibilityElementsHidden={!pilulaVisivel}
          importantForAccessibility={pilulaVisivel ? 'auto' : 'no-hide-descendants'}
          style={[estilos.pilulaFora, estiloPilula]}>
          <Tocavel onPress={() => router.push('/chat')} accessibilityLabel="Pergunte à Bolinha" accessibilityHint="Abre a conversa com a Bolinha" escala={0.97} vibra="leve">
            <Vidro interativo style={estilos.pilula}>
              <View style={[estilos.faisca, { backgroundColor: c.azul }]}>
                <Icone nome="faisca" tamanho={15} cor="#FFFFFF" peso="semibold" />
              </View>
              <Texto numberOfLines={1} cor={c.apoio} style={estilos.pilulaTexto}>Pergunte à Bolinha</Texto>
            </Vidro>
          </Tocavel>
        </Animated.View>

        <View style={estilos.linha} pointerEvents="box-none">
          <Vidro style={estilos.capsula}>
            <View style={estilos.abas} accessibilityRole="tablist" onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
              {passo ? (
                <Animated.View
                  pointerEvents="none"
                  style={[estilos.destaque, { width: passo, backgroundColor: comAlfa(c.azul, c.escuro ? 0.24 : 0.12) }, destaque]}
                />
              ) : null}
              {ITENS.map((it, i) => {
                const aceso = i === ativo;
                const tinta = aceso ? c.azulTinta : c.apoio;
                const ehAba = it.id !== 'avina';
                return (
                  <Tocavel
                    key={it.id}
                    onPress={() => (it.id === 'avina' ? aoAbrirAreas() : aoTrocar(it.id))}
                    accessibilityRole={ehAba ? 'tab' : 'button'}
                    accessibilityLabel={it.rotulo}
                    accessibilityState={ehAba ? { selected: aceso } : { expanded: areasAberta }}
                    escala={0.92}
                    vibra="leve"
                    style={estilos.aba}>
                    <Icone nome={it.icone} tamanho={22} cor={tinta} cheio={aceso && (Platform.OS === 'ios' || it.id !== 'atividades')} peso={aceso ? 'semibold' : 'medium'} />
                    <Texto numberOfLines={1} maxFontSizeMultiplier={1.15} cor={tinta} style={[estilos.abaNome, aceso && { fontFamily: Fontes.textoPesado }]}>{it.nome}</Texto>
                  </Tocavel>
                );
              })}
            </View>
          </Vidro>
          <BotaoRedondo tamanho={ALTURA} rotulo="Conversar com a Bolinha" onPress={() => router.push('/chat')}>
            <Mascote tamanho={44} sombra={false} />
          </BotaoRedondo>
        </View>
      </View>
    </View>
  );
}

/* ---------- A folha com as áreas do Avina ---------- */

// No iOS 26, a folha é de vidro (o Início escurecido aparece através dela); fora dele, sólida. Embaixo, a linha do
// Perfil com a foto da conta (redonda) e o nome.
export function FolhaAreas({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const c = useCores();
  const e = useEstado();
  const base = useBaseBarra();
  const vidro = useVidroAtivo();
  const areas = areasDe(e);
  if (!aberta) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: c.escuro ? 'rgba(0,0,0,0.62)' : 'rgba(17,17,30,0.32)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar as áreas" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(220)}
        exiting={SlideOutDown.duration(200)}
        accessibilityViewIsModal
        style={[estilos.folha, { bottom: base, backgroundColor: vidro ? 'transparent' : c.fundoAlto, borderColor: c.linhaForte }]}>
        {vidro ? <CamadaVidro raio={31} /> : null}
        <View style={[estilos.alca, { backgroundColor: c.cartao3 }]} />
        <View style={estilos.folhaTopo}>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto v="subtitulo" accessibilityRole="header" style={{ fontSize: 20, lineHeight: 26 }}>O Avina completo</Texto>
            <Texto v="apoio">Abra uma área com tudo o que ela tem</Texto>
          </View>
          <BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={aoFechar} />
        </View>
        {areas.length ? <GradeAreas areas={areas} antesDeAbrir={aoFechar} /> : null}
        <View style={[estilos.perfil, { backgroundColor: c.cartao, borderColor: c.linha }]}>
          <Linha
            titulo={e?.conta?.nome?.trim() || 'Perfil e ajustes'}
            sub={e?.conta?.nome?.trim() ? 'Perfil, aparência, bloqueio e avisos' : 'Conta, aparência, bloqueio e avisos'}
            esquerda={e?.conta ? <Avatar nome={e.conta.nome || e.conta.email || '?'} foto={e.conta.foto ?? null} tamanho={40} /> : undefined}
            icone="configuracoes"
            chevron
            onPress={() => { aoFechar(); router.push('/perfil'); }}
            rotulo="Perfil e ajustes"
            style={{ paddingHorizontal: Espaco.quatro, minHeight: 60 }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  esmaecer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  barra: { paddingHorizontal: Espaco.quatro, gap: Espaco.tres },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2 },
  capsula: { flex: 1, height: ALTURA },
  abas: { flex: 1, flexDirection: 'row', padding: FOLGA },
  destaque: { position: 'absolute', top: FOLGA, bottom: FOLGA, left: FOLGA, borderRadius: Raio.pilula, borderCurve: 'continuous' },
  aba: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: Raio.pilula },
  abaNome: { fontFamily: Fontes.textoForte, fontSize: 11, lineHeight: 14 },
  pilulaFora: { alignSelf: 'stretch' },
  pilula: { height: 50, flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingLeft: 8, paddingRight: Espaco.cinco },
  faisca: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pilulaTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 16, lineHeight: 21 },
  folha: { position: 'absolute', left: Espaco.dois + 2, right: Espaco.dois + 2, borderRadius: 32, borderCurve: 'continuous', borderWidth: 1, padding: Espaco.quatro, paddingTop: Espaco.dois, gap: Espaco.quatro },
  alca: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  folhaTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingHorizontal: Espaco.um },
  perfil: { borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden' },
});
