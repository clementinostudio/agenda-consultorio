// A folha das conversas (o relógio do topo do chat): as conversas guardadas no aparelho, da mais recente para a
// mais antiga, e "Nova conversa". Tocar abre; deslizar para a esquerda apaga; segurar pergunta se apaga.
// Sobe por cima do chat (sem Modal: o chat já é uma tela cheia) e fecha tocando fora, arrastando para baixo,
// pelo X ou pelo voltar do Android. Com "reduzir movimento", aparece e some só com o esmaecer.
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { quandoFoi, type Conversa } from '@/components/chat/conversas';
import { Botao, BotaoRedondo, Icone, Mascote, Texto, Tocavel, vibrar } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

const SAIDA = Easing.bezier(0.2, 0.9, 0.1, 1);
const APAGA = 96; // quanto deslizar para apagar

function LinhaConversa({ conversa, aberta, agora, aoAbrir, aoApagar }: { conversa: Conversa; aberta: boolean; agora: Date; aoAbrir: () => void; aoApagar: () => void }) {
  const c = useCores();
  const { width: W } = useWindowDimensions();
  const [confirmar, setConfirmar] = useState(false);
  const x = useSharedValue(0);
  const perguntas = conversa.falas.filter((f) => f.quem === 'eu').length;
  const quando = quandoFoi(conversa.mudou, agora);

  const apagar = () => { vibrar('firme'); aoApagar(); };
  const arrasto = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-14, 14],
    failOffsetY: [-10, 10],
    onUpdate: (e) => { x.set(Math.min(0, e.translationX)); },
    onDeactivate: (e) => {
      const foi = !e.canceled && (e.translationX < -APAGA || (e.velocityX < -900 && e.translationX < -40));
      if (foi) x.set(withTiming(-W, { duration: 180, easing: Easing.in(Easing.cubic) }, (fim) => { if (fim) scheduleOnRN(apagar); }));
      else x.set(withSpring(0, { damping: 20, stiffness: 260 }));
    },
  });
  const frente = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const atras = useAnimatedStyle(() => ({ opacity: Math.min(1, -x.get() / 40) }));

  const acoes = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate') aoAbrir();
    else if (e.nativeEvent.actionName === 'delete') apagar();
  };

  if (confirmar) {
    return (
      <Animated.View entering={FadeIn.duration(160)} style={[estilos.linha, estilos.confirmar, { backgroundColor: c.escuro ? c.cartao2 : c.cartao3 }]}>
        <Texto v="forte" numberOfLines={1} style={{ flex: 1 }}>Apagar esta conversa?</Texto>
        <Botao titulo="Cancelar" variante="texto" tamanho="pequeno" onPress={() => setConfirmar(false)} />
        <Botao titulo="Apagar" variante="perigo" tamanho="pequeno" onPress={apagar} />
      </Animated.View>
    );
  }
  return (
    <View style={estilos.envolta}>
      <Animated.View style={[StyleSheet.absoluteFill, estilos.fundoApagar, { backgroundColor: c.negativo }, atras]} accessible={false} importantForAccessibility="no-hide-descendants">
        <Icone nome="lixo" tamanho={20} cor="#FFFFFF" peso="semibold" />
        <Texto cor="#FFFFFF" style={estilos.apagarTexto}>Apagar</Texto>
      </Animated.View>
      <GestureDetector gesture={arrasto}>
        <Animated.View style={frente}>
          <Tocavel
            onPress={aoAbrir}
            onLongPress={() => { vibrar('firme'); setConfirmar(true); }}
            delayLongPress={380}
            vibra={false}
            escala={0.985}
            accessibilityLabel={`${conversa.titulo || 'Conversa'}, ${quando}${aberta ? ', aberta agora' : ''}`}
            accessibilityHint="Abre a conversa"
            accessibilityActions={[{ name: 'activate', label: 'Abrir' }, { name: 'delete', label: 'Apagar a conversa' }]}
            onAccessibilityAction={acoes}
            style={[estilos.linha, { backgroundColor: c.fundoAlto }]}>
            <View style={[estilos.icone, { backgroundColor: aberta ? c.azulFundo : c.escuro ? c.cartao2 : c.cartao2 }]}>
              <Icone nome="chat" tamanho={17} cor={aberta ? c.azulTinta : c.apoio} cheio={aberta} peso="semibold" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto v="forte" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>{conversa.titulo || 'Conversa'}</Texto>
              <Texto v="apoio" numberOfLines={1}>
                {quando}
                {perguntas > 1 ? ` · ${perguntas} perguntas` : ''}
                {aberta ? ' · aberta agora' : ''}
              </Texto>
            </View>
            <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" />
          </Tocavel>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export type FolhaHistoricoProps = {
  visivel: boolean;
  aoFechar: () => void;
  conversas: Conversa[];
  aberta: string | null; // id da conversa na tela
  aoAbrir: (c: Conversa) => void;
  aoApagar: (id: string) => void;
  aoNova: () => void;
};

export function FolhaHistorico({ visivel, aoFechar, conversas, aberta, aoAbrir, aoApagar, aoNova }: FolhaHistoricoProps) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const reduzir = useReducedMotion();
  const [montada, setMontada] = useState(visivel);
  const [agora, setAgora] = useState(() => new Date());
  const p = useSharedValue(0);
  const arrasto = useSharedValue(0);

  // abre: monta e sobe (e acerta o "agora" das datas); fecha: desce e só então desmonta
  if (visivel && !montada) { setMontada(true); setAgora(new Date()); }
  useEffect(() => {
    if (!montada) return;
    if (visivel) {
      arrasto.set(0);
      p.set(withTiming(1, { duration: reduzir ? 160 : 380, easing: SAIDA }));
    } else {
      p.set(withTiming(0, { duration: reduzir ? 140 : 240, easing: Easing.in(Easing.cubic) }, (fim) => { if (fim) scheduleOnRN(setMontada, false); }));
    }
  }, [visivel, montada, reduzir, p, arrasto]);

  // Android: o voltar fecha a folha
  useEffect(() => {
    if (!visivel) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { aoFechar(); return true; });
    return () => sub.remove();
  }, [visivel, aoFechar]);

  const fundo = useAnimatedStyle(() => ({ opacity: p.get() }));
  const painel = useAnimatedStyle(() => (reduzir
    ? { opacity: p.get(), transform: [{ translateY: arrasto.get() }] }
    : { transform: [{ translateY: (1 - p.get()) * H * 0.8 + arrasto.get() }] }));

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

  if (!montada) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visivel ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.escuro ? 'rgba(0,0,0,0.62)' : 'rgba(17,17,20,0.32)' }, fundo]}>
        <Tocavel style={StyleSheet.absoluteFill} onPress={aoFechar} vibra={false} escala={1} accessibilityLabel="Fechar as conversas" />
      </Animated.View>
      <View style={estilos.base} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[
            estilos.painel,
            { backgroundColor: c.fundoAlto, borderColor: c.linha, paddingBottom: ins.bottom + Espaco.tres, maxHeight: H - ins.top - 40 },
            !c.escuro && { boxShadow: '0px -8px 32px rgba(17,17,20,0.12)' },
            painel,
          ]}>
          <GestureDetector gesture={puxar}>
            <View collapsable={false}>
              <View style={[estilos.alca, { backgroundColor: c.linhaForte }]} />
              <View style={estilos.topo}>
                <Texto v="subtitulo" accessibilityRole="header" style={estilos.titulo}>Conversas</Texto>
                <BotaoRedondo icone="fechar" rotulo="Fechar" tamanho={36} variante="solido" onPress={aoFechar} />
              </View>
            </View>
          </GestureDetector>
          <View style={estilos.nova}>
            <Botao titulo="Nova conversa" icone="editar" variante="secundario" largo onPress={aoNova} />
          </View>
          {conversas.length ? (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={estilos.lista} showsVerticalScrollIndicator={false}>
              {conversas.map((k) => (
                <Animated.View key={k.id} layout={reduzir ? undefined : LinearTransition.duration(220)} exiting={FadeOut.duration(140)}>
                  <LinhaConversa conversa={k} aberta={k.id === aberta} agora={agora} aoAbrir={() => aoAbrir(k)} aoApagar={() => aoApagar(k.id)} />
                </Animated.View>
              ))}
              <Texto v="apoio" cor={c.fraco} style={estilos.nota}>Ficam só neste aparelho, até 30 conversas. Deslize para a esquerda para apagar.</Texto>
            </ScrollView>
          ) : (
            <View style={estilos.vazio}>
              <Mascote tamanho={48} sombra={false} />
              <Texto v="forte" style={{ textAlign: 'center' }}>Nenhuma conversa ainda</Texto>
              <Texto v="apoio" style={{ textAlign: 'center', maxWidth: 280 }}>As conversas com a Bolinha ficam guardadas aqui, só neste aparelho.</Texto>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: { flex: 1, justifyContent: 'flex-end' },
  painel: { borderTopLeftRadius: Raio.cartao, borderTopRightRadius: Raio.cartao, borderCurve: 'continuous', borderWidth: 1, borderBottomWidth: 0, paddingTop: 8, overflow: 'hidden' },
  alca: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 6 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingLeft: Espaco.cinco, paddingRight: Espaco.quatro, minHeight: 48 },
  titulo: { flex: 1, fontSize: 20, lineHeight: 26 },
  nova: { paddingHorizontal: Espaco.cinco, paddingTop: Espaco.dois, paddingBottom: Espaco.tres },
  lista: { paddingBottom: Espaco.dois },
  envolta: { overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 68, paddingHorizontal: Espaco.cinco, paddingVertical: Espaco.dois },
  confirmar: { gap: Espaco.um, paddingRight: Espaco.tres },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fundoApagar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: Espaco.seis },
  apagarTexto: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  nota: { fontSize: 12, lineHeight: 17, paddingHorizontal: Espaco.cinco, paddingTop: Espaco.tres, textAlign: 'center' },
  vazio: { alignItems: 'center', gap: Espaco.dois, paddingHorizontal: Espaco.seis, paddingTop: Espaco.quatro, paddingBottom: Espaco.seis },
});
