// Peças comuns das telas empurradas (Bancos, Perfil, Categorias): o topo com o voltar, as perguntas do sistema e o
// caminho para abrir uma parte do site a partir delas.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotaoRedondo, Cartao, Texto } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { abrirNoSite, type PedidosSite } from '@/lib/motor';

export const MARGEM = Espaco.quatro; // o espaço dos lados, o mesmo do Início
export const ALTURA_TOPO = 56; // a barra do topo (o conteúdo começa abaixo dela)

/* ---------- O topo das telas empurradas ---------- */

// Voltar à esquerda, título no meio e uma ação opcional à direita. O fundo aparece ao rolar (a aurora e o conteúdo
// passam por baixo dele). tituloAoRolar: o título só aparece depois de rolar (o Perfil já tem o nome grande).
export function Topo({ titulo, rolagem, tituloAoRolar, direita }: { titulo?: string; rolagem?: SharedValue<number>; tituloAoRolar?: boolean; direita?: ReactNode }) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const fundo = useAnimatedStyle(() => ({ opacity: interpolate(rolagem ? rolagem.get() : 0, [0, 40], [0, 1], Extrapolation.CLAMP) }));
  const nome = useAnimatedStyle(() => (tituloAoRolar
    ? { opacity: interpolate(rolagem ? rolagem.get() : 0, [120, 170], [0, 1], Extrapolation.CLAMP) }
    : { opacity: 1 }));
  return (
    <View style={[estilos.topo, { paddingTop: ins.top, height: ins.top + ALTURA_TOPO }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.fundo, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.linhaForte }, fundo]} />
      <BotaoRedondo icone="voltar" rotulo="Voltar" tamanho={44} onPress={voltar} />
      <Animated.View style={[estilos.titulo, nome]} pointerEvents="none">
        {titulo ? <Texto accessibilityRole="header" numberOfLines={1} style={estilos.tituloTexto}>{titulo}</Texto> : null}
      </Animated.View>
      <View style={estilos.direita}>{direita}</View>
    </View>
  );
}

// O cartão de uma lista (linhas com separador): o espaço dos lados fica num miolo próprio, para não brigar com o
// padding do cartão (no navegador da prévia, o estilo de dentro do Cartao venceria)
export function CartaoLista({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Cartao padding={0} style={style}><View style={estilos.lista}>{children}</View></Cartao>;
}

export function voltar() {
  if (router.canGoBack()) router.back(); else router.replace('/');
}

// As telas empurradas ficam por cima do site (só o Início deixa o site aparecer): para mostrar uma parte do site
// a partir delas, primeiro volta ao Início, e o site aparece por cima dele.
export function voltarAoInicio() {
  try { if (router.canDismiss()) router.dismissTo('/'); } catch {}
}
export function abrirNoSiteDaqui(dados: PedidosSite['abrir']['dados'], motivo = 'area') {
  voltarAoInicio();
  return abrirNoSite(dados, motivo);
}

/* ---------- Perguntas do sistema ---------- */

// A pergunta com os botões do sistema (no navegador da prévia, o confirm do navegador)
export function confirmar({ titulo, texto, sim, perigo }: { titulo: string; texto?: string; sim: string; perigo?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') {
    try { return Promise.resolve(window.confirm([titulo, texto].filter(Boolean).join('\n\n'))); } catch { return Promise.resolve(false); }
  }
  return new Promise((ok) => Alert.alert(titulo, texto, [
    { text: 'Cancelar', style: 'cancel', onPress: () => ok(false) },
    { text: sim, style: perigo ? 'destructive' : 'default', onPress: () => ok(true) },
  ], { cancelable: true, onDismiss: () => ok(false) }));
}

export function avisar(titulo: string, texto?: string) {
  if (Platform.OS === 'web') { try { window.alert([titulo, texto].filter(Boolean).join('\n\n')); } catch {} return; }
  Alert.alert(titulo, texto);
}

// Um menu curto de opções (a folha de ações do iPhone; no Android, a caixa do sistema). Devolve o índice escolhido.
// No navegador da prévia não há menu: vale a primeira opção, com a confirmação de quem chamou.
export function menu({ titulo, opcoes, perigo }: { titulo: string; opcoes: string[]; perigo?: number }): Promise<number | null> {
  if (Platform.OS === 'web') return Promise.resolve(opcoes.length ? 0 : null);
  if (Platform.OS === 'ios') {
    return new Promise((ok) => ActionSheetIOS.showActionSheetWithOptions(
      { title: titulo, options: [...opcoes, 'Cancelar'], cancelButtonIndex: opcoes.length, destructiveButtonIndex: perigo },
      (i) => ok(i < opcoes.length ? i : null),
    ));
  }
  return new Promise((ok) => Alert.alert(titulo, undefined, [
    ...opcoes.map((t, i) => ({ text: t, style: i === perigo ? ('destructive' as const) : ('default' as const), onPress: () => ok(i) })),
    { text: 'Cancelar', style: 'cancel' as const, onPress: () => ok(null) },
  ], { cancelable: true, onDismiss: () => ok(null) }));
}

// O motivo de um pedido ao site não ter dado certo, em palavras de gente
export function motivoFalha(e: unknown) {
  const m = e instanceof Error ? e.message : String(e ?? '');
  if (m === 'site-carregando' || m === 'sem-site' || m === 'site-reiniciou') return 'O Avina ainda está abrindo. Tente de novo em alguns segundos.';
  if (m === 'tempo') return 'O Avina demorou para responder. Tente de novo.';
  return m && m.length < 140 && !/^[a-z-]+$/.test(m) ? m : 'Tente de novo em instantes.';
}

/* ---------- Bancos ---------- */

// A cor é clara (amarelo do BB, por exemplo)? Aí o texto por cima dela fica escuro
export function corClara(cor: string) {
  const h = cor.replace('#', '');
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
}

// O banco pede para autorizar de novo (a conexão do Open Finance venceu ou a senha mudou)
export const pedeAutorizar = (status: string) => status === 'LOGIN_ERROR' || status === 'OUTDATED';

const estilos = StyleSheet.create({
  topo: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: MARGEM, gap: Espaco.dois },
  titulo: { flex: 1, alignItems: 'center' },
  tituloTexto: { fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  lista: { paddingHorizontal: Espaco.quatro, paddingVertical: Espaco.um },
  direita: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
