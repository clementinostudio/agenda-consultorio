// O menu do toque longo num lançamento, no jeito do iPhone: a tela escurece, a linha se destaca num cartão e o
// menu aparece embaixo dela (ou em cima, quando não cabe). Tocar no cartão abre o detalhe; tocar fora fecha.
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ConteudoLanc, MARGEM, type Retangulo } from '@/components/atividades/linha';
import { Icone, type NomeIcone } from '@/components/icone';
import { Tocavel, comAlfa } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { useSemTransparencia } from '@/components/ui/vidro';
import { Fontes, useCores } from '@/constants/theme';
import type { Categoria, Lanc } from '@/lib/motor';

export type AlvoMenu = { l: Lanc; cat: Categoria | null; onde: Retangulo };

// no iPhone, o desfoque aparece aumentando a intensidade (o efeito do sistema não aceita ficar meio transparente)
const DesfoqueAnimado = Animated.createAnimatedComponent(BlurView);

const ITEM = 50;
const LARGURA_MENU = 250;
const RECUO = 12; // o cartão da prévia fica 12 pt para dentro da tela (o conteúdo não sai do lugar)

export function MenuLanc({ alvo, oculto, aoFechar, aoAbrir, aoEditar, aoApagar }: {
  alvo: AlvoMenu | null;
  oculto: boolean;
  aoFechar: () => void;
  aoAbrir: (l: Lanc) => void;
  aoEditar: (l: Lanc) => void;
  aoApagar: (l: Lanc) => void;
}) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const reduzir = useReducedMotion();
  const semTransp = useSemTransparencia();
  // guarda o último alvo para o menu sumir com o conteúdo ainda na tela
  const [visto, setVisto] = useState<AlvoMenu | null>(alvo);
  if (alvo && alvo !== visto) setVisto(alvo);
  const p = useSharedValue(0);

  useEffect(() => {
    if (alvo) p.set(reduzir ? withTiming(1, { duration: 140 }) : withSpring(1, { damping: 18, stiffness: 240, mass: 0.8 }));
    else if (visto) p.set(withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }, (fim) => { if (fim) scheduleOnRN(setVisto, null); }));
  }, [alvo, visto, reduzir, p]);

  const itens: { id: string; titulo: string; icone: NomeIcone; perigo?: boolean; fazer: (l: Lanc) => void }[] = [
    { id: 'ver', titulo: 'Ver detalhes', icone: 'info', fazer: aoAbrir },
    { id: 'editar', titulo: 'Editar no site', icone: 'editar', fazer: aoEditar },
    { id: 'apagar', titulo: 'Apagar', icone: 'lixo', perigo: true, fazer: aoApagar },
  ];
  const alturaMenu = itens.length * ITEM;

  // onde a prévia fica: no lugar da linha, mas subindo o bastante para o menu caber embaixo (ou indo para cima)
  const onde = visto?.onde ?? { x: 0, y: 0, w: 0, h: 0 };
  const cima = ins.top + 12, baixo = H - ins.bottom - 12;
  const cabeEmbaixo = onde.y + onde.h + 10 + alturaMenu <= baixo;
  const cabeEmCima = onde.y - 10 - alturaMenu >= cima;
  const menuEmCima = !cabeEmbaixo && cabeEmCima;
  const topoPrevia = cabeEmbaixo || cabeEmCima ? onde.y : Math.max(cima, baixo - alturaMenu - 10 - onde.h);
  const deslocar = topoPrevia - onde.y;
  const topoMenu = menuEmCima ? topoPrevia - 10 - alturaMenu : topoPrevia + onde.h + 10;

  const fundo = useAnimatedStyle(() => ({ opacity: Math.min(1, p.get()) }));
  const desfoque = useAnimatedProps(() => ({ intensity: Math.min(1, p.get()) * 40 }));
  const previa = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get() * 3),
    transform: reduzir ? [{ translateY: deslocar }] : [{ translateY: deslocar * p.get() }, { scale: 1 + 0.02 * p.get() }],
  }));
  const menu = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get()),
    transform: reduzir ? [] : [{ translateY: (1 - p.get()) * (menuEmCima ? 12 : -12) }, { scale: 0.86 + 0.14 * p.get() }],
  }));

  if (!visto) return null;
  const { l, cat } = visto;
  const fechar = aoFechar;
  const fundoCartao = c.escuro ? c.cartao2 : c.cartao;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={fechar}>
      {Platform.OS === 'ios' && !semTransp ? (
        <DesfoqueAnimado pointerEvents="none" tint={c.escuro ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} animatedProps={desfoque} style={StyleSheet.absoluteFill} />
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.escuro ? 'rgba(0,0,0,0.55)' : 'rgba(17,17,20,0.22)' }, fundo]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={fechar} accessibilityRole="button" accessibilityLabel="Fechar o menu" />

      {/* a linha destacada: tocar abre o detalhe */}
      <Animated.View style={[estilos.previa, { top: onde.y, height: onde.h, left: onde.x + RECUO, width: onde.w - 2 * RECUO }, previa]}>
        <Tocavel
          onPress={() => { fechar(); aoAbrir(l); }}
          escala={0.98}
          accessibilityLabel={`Ver detalhes de ${l.desc || 'lançamento'}`}
          style={[estilos.previaCartao, { backgroundColor: fundoCartao, borderColor: c.linha }, !c.escuro && { boxShadow: `0px 10px 30px ${comAlfa(c.sombra, 0.16)}` }]}>
          <ConteudoLanc l={l} cat={cat} oculto={oculto} fundo={fundoCartao} />
        </Tocavel>
      </Animated.View>

      {/* o menu */}
      <Animated.View
        accessibilityViewIsModal
        style={[
          estilos.menu,
          { top: topoMenu, left: onde.x + RECUO, width: Math.min(LARGURA_MENU, onde.w - 2 * RECUO), backgroundColor: fundoCartao, borderColor: c.linhaForte, transformOrigin: menuEmCima ? 'left bottom' : 'left top' },
          !c.escuro && { boxShadow: `0px 12px 36px ${comAlfa(c.sombra, 0.18)}` },
          menu,
        ]}>
        {itens.map((it, i) => (
          <Tocavel
            key={it.id}
            onPress={() => { fechar(); it.fazer(l); }}
            vibra={it.perigo ? 'firme' : 'toque'}
            escala={0.98}
            accessibilityLabel={it.titulo}
            style={[estilos.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.linhaForte }]}>
            <Texto numberOfLines={1} maxFontSizeMultiplier={1.3} cor={it.perigo ? c.negativo : c.texto} style={estilos.itemTexto}>{it.titulo}</Texto>
            <Icone nome={it.icone} tamanho={19} cor={it.perigo ? c.negativo : c.texto} />
          </Tocavel>
        ))}
      </Animated.View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  previa: { position: 'absolute' },
  previaCartao: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: MARGEM - RECUO, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1 },
  menu: { position: 'absolute', borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden' },
  item: { height: ITEM, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  itemTexto: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 16, lineHeight: 21 },
});
