// Vidro: o Liquid Glass do iOS 26 (GlassView); nos iPhones mais antigos, o desfoque do sistema (BlurView) com uma
// borda clara; no Android (e com "Reduzir transparência" ligado), um fundo quase sólido com a mesma borda.
// Também daqui: a camada de vidro que fica atrás dos cartões e das folhas no iOS 26 (CamadaVidro) e a entrada em
// cascata que não mexe na opacidade (o vidro some quando ele ou quem está por fora fica meio transparente).
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Easing, FadeInDown, Keyframe } from 'react-native-reanimated';

import { Icone, type NomeIcone } from '@/components/icone';
import { comAlfa, Tocavel } from '@/components/ui/comum';
import { Raio, useCores } from '@/constants/theme';

export const temVidro = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

// "Reduzir transparência" (Acessibilidade do iPhone): o vidro vira fundo sólido. Uma leitura só para o app inteiro
// (cada cartão de vidro pergunta, e não dá para cada um abrir o seu ouvinte do sistema).
let semTransparencia = false;
let ouvindo = false;
const ouvintesTransp = new Set<() => void>();
const avisarTransp = (v: boolean) => { if (v !== semTransparencia) { semTransparencia = v; ouvintesTransp.forEach((f) => f()); } };
function ouvirTransparencia(f: () => void) {
  if (!ouvindo && Platform.OS === 'ios') {
    ouvindo = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then(avisarTransp).catch(() => {});
    AccessibilityInfo.addEventListener('reduceTransparencyChanged', avisarTransp);
  }
  ouvintesTransp.add(f);
  return () => { ouvintesTransp.delete(f); };
}
export const useSemTransparencia = () => useSyncExternalStore(ouvirTransparencia, () => semTransparencia);

// O vidro dos cartões e das folhas vale agora? (iOS 26 com o Liquid Glass e sem "Reduzir transparência")
export function useVidroAtivo() {
  const sem = useSemTransparencia();
  return temVidro && !sem;
}

// A camada de vidro atrás de um cartão ou de uma folha (só quando useVidroAtivo): o Liquid Glass "regular" com uma
// tinta do tema por cima, para o texto continuar legível sobre o que passa atrás. Fica embaixo do conteúdo, que não
// entra no vidro (o texto não ganha o efeito). interativo: o vidro reage ao toque (cartões que abrem algo); a "key"
// recria a camada se isso mudar, porque o sistema só lê essa escolha quando a camada nasce.
export function CamadaVidro({ raio, interativo, cantos }: { raio: number; interativo?: boolean; cantos?: 'todos' | 'cima' }) {
  const c = useCores();
  const forma: ViewStyle = cantos === 'cima'
    ? { borderTopLeftRadius: raio, borderTopRightRadius: raio, borderCurve: 'continuous' }
    : { borderRadius: raio, borderCurve: 'continuous' };
  return (
    <GlassView
      key={interativo ? 'interativo' : 'parado'}
      // interativo: recebe o toque para reagir (o toque continua subindo para o cartão, que abre a tela)
      pointerEvents={interativo ? 'auto' : 'none'}
      glassEffectStyle="regular"
      isInteractive={!!interativo}
      tintColor={comAlfa(c.escuro ? c.cartao : '#FFFFFF', c.escuro ? 0.55 : 0.6)}
      colorScheme={c.escuro ? 'dark' : 'light'}
      style={[StyleSheet.absoluteFill, forma]}
    />
  );
}

// A entrada em cascata dos blocos (sobe de leve, um depois do outro). Com o vidro, só sobe: o vidro não aparece
// enquanto ele, ou quem está por fora, está meio transparente, e o esmaecer faria o fundo do cartão "pipocar".
export function entradaCascata(atraso: number, duracao = 420) {
  if (!temVidro) return FadeInDown.delay(atraso).duration(duracao);
  return new Keyframe({
    0: { transform: [{ translateY: 22 }] },
    100: { transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
  }).delay(atraso).duration(duracao);
}

export type VidroProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  raio?: number;
  tinta?: string; // cor do vidro (ex.: o azul num botão principal)
  interativo?: boolean; // o Liquid Glass reage ao toque
  solido?: boolean; // força o fundo sólido
};

export function Vidro({ children, style, raio = Raio.pilula, tinta, interativo, solido }: VidroProps) {
  const c = useCores();
  const semTransp = useSemTransparencia();
  const forma: ViewStyle = { borderRadius: raio, borderCurve: 'continuous', overflow: 'hidden' };
  if (temVidro && !solido && !semTransp) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interativo} tintColor={tinta} colorScheme={c.escuro ? 'dark' : 'light'} style={[forma, style]}>
        {children}
      </GlassView>
    );
  }
  const borda: ViewStyle = { borderWidth: 1, borderColor: tinta ? comAlfa('#FFFFFF', 0.18) : c.linhaForte };
  if (Platform.OS === 'ios' && !solido && !semTransp && !tinta) {
    return (
      <BlurView tint={c.escuro ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} intensity={80} style={[forma, borda, style]}>
        {children}
      </BlurView>
    );
  }
  // Android, "reduzir transparência" ou vidro colorido fora do iOS 26: fundo quase sólido
  const fundo = tinta ?? (c.escuro ? comAlfa('#1E1E21', 0.96) : comAlfa('#FFFFFF', 0.97));
  const sombra: ViewStyle = c.escuro ? {} : { boxShadow: `0px 8px 24px ${comAlfa(c.sombra, 0.1)}` };
  return <View style={[forma, borda, sombra, { backgroundColor: fundo }, style, { overflow: c.escuro ? 'hidden' : 'visible' }]}>{children}</View>;
}

export type BotaoRedondoProps = {
  icone?: NomeIcone;
  onPress?: () => void;
  rotulo: string; // o que o leitor de tela fala
  tamanho?: number; // 44 a 52
  variante?: 'vidro' | 'solido' | 'azul' | 'transparente';
  cor?: string; // cor do ícone
  cheio?: boolean;
  children?: ReactNode; // no lugar do ícone (ex.: a Bolinha)
  desativado?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Botão redondo do topo e da barra: olho, voltar, fechar, +, a Bolinha...
export function BotaoRedondo({ icone, onPress, rotulo, tamanho = 48, variante = 'vidro', cor, cheio, children, desativado, style }: BotaoRedondoProps) {
  const c = useCores();
  const tintaIcone = cor ?? (variante === 'azul' ? '#FFFFFF' : c.texto);
  const dentro = children ?? (icone ? <Icone nome={icone} tamanho={Math.round(tamanho * 0.4)} cor={tintaIcone} cheio={cheio} peso="semibold" /> : null);
  const caixa: ViewStyle = { width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' };
  const alvo = Math.max(0, (44 - tamanho) / 2); // a área de toque nunca fica menor que 44 pt
  return (
    <Tocavel
      onPress={onPress}
      disabled={desativado}
      accessibilityLabel={rotulo}
      hitSlop={alvo || undefined}
      escala={variante === 'vidro' && temVidro ? 1 : 0.92}
      style={style}>
      {variante === 'vidro' ? (
        <Vidro interativo style={caixa}>{dentro}</Vidro>
      ) : (
        <View style={[caixa, estilos.redondo, variante === 'azul' ? { backgroundColor: c.azul } : variante === 'solido' ? { backgroundColor: c.cartao2, borderWidth: 1, borderColor: c.linha } : null]}>
          {dentro}
        </View>
      )}
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  redondo: { borderRadius: Raio.pilula },
});
