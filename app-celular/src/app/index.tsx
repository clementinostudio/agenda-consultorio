// A casca nativa: o Início e as Atividades (as duas ficam montadas e trocam com um fade rápido, sem deslizar; com o
// Liquid Glass do iOS 26, a troca é seca, como nas abas do sistema, porque o vidro não aparece meio transparente) e a
// barra flutuante de vidro (components/barra.tsx), com a folha das áreas do Avina por cima.
// - Sem login (ou antes do primeiro retrato do site), só o fundo: a camada do site está na frente (entrar, cadastro).
// - ?aba=atividades abre direto nas Atividades (os prints da prévia usam).
// - Android, voltar: fecha a folha das áreas; nas Atividades, volta ao Início (no Início, o sistema cuida).
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Atividades } from '@/components/atividades';
import { Barra, FolhaAreas, type Aba } from '@/components/barra';
import { Inicio } from '@/components/inicio';
import { useVidroAtivo } from '@/components/ui';
import { useCores } from '@/constants/theme';
import { useLogado, useWeb } from '@/lib/motor';

// Uma aba da casca: fica sempre montada; a escondida some (fade) e não recebe toques nem o leitor de tela
function Painel({ visivel, children }: { visivel: boolean; children: ReactNode }) {
  const reduzir = useReducedMotion();
  const vidro = useVidroAtivo();
  const o = useSharedValue(visivel ? 1 : 0);
  useEffect(() => { o.set(reduzir || vidro ? (visivel ? 1 : 0) : withTiming(visivel ? 1 : 0, { duration: visivel ? 200 : 140 })); }, [visivel, reduzir, vidro, o]);
  const estilo = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View
      pointerEvents={visivel ? 'auto' : 'none'}
      accessibilityElementsHidden={!visivel}
      importantForAccessibility={visivel ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, { zIndex: visivel ? 1 : 0 }, estilo]}>
      {children}
    </Animated.View>
  );
}

export default function Casca() {
  const c = useCores();
  const logado = useLogado();
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const [aba, setAba] = useState<Aba>(abaPedida === 'atividades' ? 'atividades' : 'inicio');
  const [areas, setAreas] = useState(false);
  const pilula = useSharedValue(1);
  const rolagemInicio = useAnimatedRef<Animated.ScrollView>();
  const web = useWeb();
  const focada = useIsFocused();

  // Android, voltar
  const segurarVoltar = Platform.OS === 'android' && focada && !web.visivel && (areas || aba !== 'inicio');
  useEffect(() => {
    if (!segurarVoltar) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (areas) setAreas(false); else setAba('inicio');
      return true;
    });
    return () => sub.remove();
  }, [segurarVoltar, areas]);

  const trocar = (a: Aba) => {
    setAreas(false);
    // tocar de novo no Início sobe para o topo (como nos apps do iPhone)
    if (a === aba) { if (a === 'inicio') rolagemInicio.current?.scrollTo({ y: 0, animated: true }); return; }
    setAba(a);
  };

  if (logado !== true) return <View style={{ flex: 1, backgroundColor: c.fundo }} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <View style={{ flex: 1 }}>
        <Painel visivel={aba === 'inicio'}>
          <Inicio pilula={pilula} rolagem={rolagemInicio} aoVerAtividades={() => trocar('atividades')} />
        </Painel>
        <Painel visivel={aba === 'atividades'}>
          <Atividades visivel={aba === 'atividades'} />
        </Painel>
      </View>
      <Barra aba={aba} aoTrocar={trocar} aoAbrirAreas={() => setAreas(true)} areasAberta={areas} pilula={pilula} />
      <FolhaAreas aberta={areas} aoFechar={() => setAreas(false)} />
    </View>
  );
}
