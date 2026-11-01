// A barra de cima do Início, que entra quando a pessoa rola (a saudação já saiu da tela): a foto redonda, o primeiro
// nome, o olho e o "+" e, embaixo, a troca de área (só com mais de uma ligada). Fica presa no topo, logo abaixo da
// barra de status, por cima dos cartões.
// - Fundo: no iPhone com o Liquid Glass, o desfoque do sistema, que vai ficando mais fraco até sumir embaixo (faixas
//   de desfoque cada vez mais leves, com o fundo do tema por cima); fora dele (Android, iPhones antigos, "Reduzir
//   transparência", a prévia), o fundo do tema sólido em cima, esmaecendo para baixo, com uma sombra bem leve.
// - "mostrar" (0 a 1) vem do Início (a rolagem). Sem o vidro, a barra desce de leve e aparece; com o vidro, só desce
//   (o vidro e o desfoque não aparecem meio transparentes); com "reduzir movimento", aparece e some sem animar.
// - Escondida, não recebe toques nem aparece para o leitor de tela. Tocar no nome sobe para o topo.
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { primeiroNome } from '@/components/inicio/comum';
import { areasDoInicio, type AreaFoco } from '@/components/inicio/foco';
import { ALTURA_CHIP, TrocaArea } from '@/components/inicio/troca-area';
import { Avatar, BotaoRedondo, comAlfa, Texto, Tocavel, useVidroAtivo } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { alternarOculto, useOculto, type Estado, type Modo } from '@/lib/motor';

const LINHA = 44; // a linha da foto, do nome e dos botões
const ESMAECER = 40; // o pedaço de baixo, que vai sumindo sobre os cartões
// as faixas de desfoque abaixo da barra (de cima para baixo): cada vez mais fraco, até não ter nada
const FAIXAS = [44, 30, 18, 8];

// A altura da barra até o fim do conteúdo (os chips, quando há), sem o esmaecer
function alturaTopo(e: Estado, topoSeguro: number) {
  return topoSeguro + Espaco.dois + LINHA + (areasDoInicio(e).length > 1 ? Espaco.tres + ALTURA_CHIP : 0);
}

function Fundo({ conteudo, altura }: { conteudo: number; altura: number }) {
  const c = useCores();
  const vidro = useVidroAtivo();
  const meio = (conteudo + 4) / altura; // até um pouco abaixo dos chips, o fundo fica cheio
  if (vidro) {
    const faixa = ESMAECER / FAIXAS.length;
    const tinta = c.escuro ? 'systemThinMaterialDark' : 'systemThinMaterialLight';
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <BlurView tint={tinta} intensity={64} style={[estilos.faixa, { top: 0, height: conteudo }]} />
        {FAIXAS.map((forca, i) => (
          <BlurView key={forca} tint={tinta} intensity={forca} style={[estilos.faixa, { top: conteudo + i * faixa, height: faixa }]} />
        ))}
        {/* o fundo do tema por cima: o preto fosco (ou o cinza-gelo) continua lá, e o esmaecer fica liso */}
        <LinearGradient
          colors={[comAlfa(c.fundo, c.escuro ? 0.5 : 0.4), comAlfa(c.fundo, c.escuro ? 0.32 : 0.24), comAlfa(c.fundo, 0)]}
          locations={[0, meio, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[c.fundo, c.fundo, comAlfa(c.fundo, 0.9), comAlfa(c.fundo, 0)]}
        locations={[0, meio, meio + (1 - meio) * 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* a sombra suave logo abaixo da barra (o que passa por baixo parece entrar embaixo dela) */}
      <LinearGradient
        colors={[comAlfa(c.sombra, 0), comAlfa(c.sombra, c.escuro ? 0.2 : 0.035), comAlfa(c.sombra, 0)]}
        locations={[0, 0.4, 1]}
        style={[estilos.faixa, { top: conteudo - 6, height: altura - conteudo + 6 }]}
      />
    </View>
  );
}

export function TopoFixo({ e, mostrar, area, aoTrocarArea, aoSubir }: {
  e: Estado;
  mostrar: SharedValue<number>; // 0 escondida, 1 à vista
  area: AreaFoco | null;
  aoTrocarArea: (a: Modo) => void;
  aoSubir: () => void;
}) {
  const ins = useSafeAreaInsets();
  const vidro = useVidroAtivo();
  const oculto = useOculto();
  const conteudo = alturaTopo(e, ins.top);
  const altura = conteudo + ESMAECER;
  const nome = primeiroNome(e.conta?.nome) || 'Início';

  const [ativa, setAtiva] = useState(false);
  useAnimatedReaction(
    () => mostrar.get() > 0.5,
    (agora, antes) => { if (agora !== antes) scheduleOnRN(setAtiva, agora); },
  );
  const estilo = useAnimatedStyle(() => {
    const v = mostrar.get();
    // com o vidro, só desce (de fora da tela); sem ele, desce um pouco e aparece
    return vidro
      ? { transform: [{ translateY: (1 - v) * -altura }] }
      : { opacity: v, transform: [{ translateY: (1 - v) * -12 }] };
  });

  return (
    <Animated.View
      pointerEvents={ativa ? 'box-none' : 'none'}
      accessibilityElementsHidden={!ativa}
      importantForAccessibility={ativa ? 'auto' : 'no-hide-descendants'}
      style={[estilos.topo, { height: altura }, estilo]}>
      <Fundo conteudo={conteudo} altura={altura} />
      <View pointerEvents="box-none" style={{ paddingTop: ins.top + Espaco.dois, gap: Espaco.tres }}>
        <View pointerEvents="box-none" style={estilos.linha}>
          <Tocavel onPress={() => router.push('/perfil')} accessibilityLabel="Perfil e ajustes" escala={0.94} hitSlop={3}>
            <Avatar nome={e.conta?.nome || e.conta?.email || '?'} foto={e.conta?.foto ?? null} tamanho={38} />
          </Tocavel>
          <Tocavel onPress={aoSubir} vibra={false} escala={0.98} accessibilityLabel={`${nome}. Voltar ao topo`} style={estilos.nomeCaixa}>
            <Texto numberOfLines={1} maxFontSizeMultiplier={1.25} style={estilos.nome}>{nome}</Texto>
          </Tocavel>
          <BotaoRedondo
            icone={oculto ? 'olhoFechado' : 'olho'}
            rotulo={oculto ? 'Mostrar os valores' : 'Esconder os valores'}
            tamanho={40}
            onPress={alternarOculto}
          />
          {e.pessoal ? <BotaoRedondo icone="mais" variante="azul" rotulo="Anotar gasto ou entrada" tamanho={40} onPress={() => router.push('/novo')} /> : null}
        </View>
        <TrocaArea e={e} area={area} aoTrocar={aoTrocarArea} />
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  topo: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  faixa: { position: 'absolute', left: 0, right: 0 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2, height: LINHA, paddingHorizontal: Espaco.quatro },
  nomeCaixa: { flex: 1, minHeight: LINHA, justifyContent: 'center' },
  nome: { fontFamily: Fontes.tituloForte, fontSize: 23, lineHeight: 29, letterSpacing: -0.5 },
});
