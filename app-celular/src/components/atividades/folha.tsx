// Folha que sobe de baixo por cima da tela (os filtros das Atividades): fundo escurecido, alça, título e uma ação
// à direita. Fecha tocando fora, arrastando para baixo ou pelo voltar do Android.
// Com "reduzir movimento", aparece e some só com o esmaecer (sem subir). No iOS 26, a folha é de vidro (menos com
// "reduzir movimento": o vidro não aparece enquanto a folha está meio transparente).
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Texto } from '@/components/ui/texto';
import { CamadaVidro, useVidroAtivo } from '@/components/ui/vidro';
import { Espaco, Raio, useCores } from '@/constants/theme';

const SAIDA = Easing.bezier(0.2, 0.9, 0.1, 1);

export function Folha({ visivel, aoFechar, titulo, direita, children }: {
  visivel: boolean;
  aoFechar: () => void;
  titulo: string;
  direita?: ReactNode; // ex.: "Limpar"
  children: ReactNode;
}) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const reduzir = useReducedMotion();
  const vidro = useVidroAtivo() && !reduzir;
  const [montada, setMontada] = useState(visivel);
  const p = useSharedValue(0); // 0 fechada, 1 aberta
  const arrasto = useSharedValue(0);

  // abre: monta o Modal e sobe; fecha: desce e só então desmonta
  if (visivel && !montada) setMontada(true);
  useEffect(() => {
    if (!montada) return;
    if (visivel) {
      arrasto.set(0);
      p.set(withTiming(1, { duration: reduzir ? 160 : 380, easing: SAIDA }));
    } else {
      p.set(withTiming(0, { duration: reduzir ? 140 : 240, easing: Easing.in(Easing.cubic) }, (fim) => { if (fim) scheduleOnRN(setMontada, false); }));
    }
  }, [visivel, montada, reduzir, p, arrasto]);

  const fundo = useAnimatedStyle(() => ({ opacity: p.get() }));
  const painel = useAnimatedStyle(() => (reduzir
    ? { opacity: p.get(), transform: [{ translateY: arrasto.get() }] }
    : { transform: [{ translateY: (1 - p.get()) * H * 0.7 + arrasto.get() }] }));

  const puxar = usePanGesture({
    runOnJS: true,
    activeOffsetY: 8,
    failOffsetX: [-24, 24],
    onUpdate: (e) => { arrasto.set(Math.max(0, e.translationY)); },
    onDeactivate: (e) => {
      if (!e.canceled && (e.translationY > 110 || (e.velocityY > 800 && e.translationY > 20))) aoFechar();
      else arrasto.set(withTiming(0, { duration: 200, easing: SAIDA }));
    },
  });

  return (
    <Modal visible={montada} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={aoFechar}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.escuro ? 'rgba(0,0,0,0.62)' : 'rgba(17,17,20,0.32)' }, fundo]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar os filtros" />
        </Animated.View>
        <View style={estilos.base} pointerEvents="box-none">
          <GestureDetector gesture={puxar}>
            <Animated.View
              accessibilityViewIsModal
              style={[
                estilos.painel,
                { backgroundColor: vidro ? 'transparent' : c.fundoAlto, borderColor: c.linha, paddingBottom: ins.bottom + Espaco.quatro, maxHeight: H - ins.top - 24 },
                !c.escuro && !vidro && { boxShadow: '0px -8px 32px rgba(17,17,20,0.12)' },
                painel,
              ]}>
              {vidro ? <CamadaVidro raio={Raio.cartao - 1} cantos="cima" /> : null}
              <View style={[estilos.alca, { backgroundColor: c.linhaForte }]} />
              <View style={estilos.topo}>
                <Texto v="subtitulo" accessibilityRole="header" style={estilos.titulo}>{titulo}</Texto>
                {direita}
              </View>
              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  base: { flex: 1, justifyContent: 'flex-end' },
  painel: { borderTopLeftRadius: Raio.cartao, borderTopRightRadius: Raio.cartao, borderCurve: 'continuous', borderWidth: 1, borderBottomWidth: 0, paddingTop: 8, overflow: 'hidden' },
  alca: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 6 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingHorizontal: Espaco.cinco, minHeight: 48 },
  titulo: { flex: 1, fontSize: 20, lineHeight: 26 },
});
