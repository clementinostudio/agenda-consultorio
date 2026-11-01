// O que todas as peças de tela usam: a vibração, as contas de cor e o toque que afunda de leve.
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

/* ---------- Vibração ---------- */

// toque: chips, abas, cartões · leve/firme: um impacto (arrastar no gráfico, soltar) · ok: deu certo · aviso/erro: deu errado
export type Vibracao = 'toque' | 'leve' | 'firme' | 'ok' | 'aviso' | 'erro';
export function vibrar(tipo: Vibracao = 'toque') {
  if (Platform.OS === 'web') return;
  const f =
    tipo === 'toque' ? Haptics.selectionAsync()
    : tipo === 'leve' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : tipo === 'firme' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : tipo === 'ok' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : tipo === 'aviso' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  f.catch(() => {});
}

/* ---------- Cores ---------- */

const hex = (c: string) => {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// "#4A62FF" com 20% → "rgba(74,98,255,0.2)". Cores que não são hex voltam como estão.
export function comAlfa(cor: string, a: number) {
  const r = hex(cor);
  return r ? `rgba(${r[0]},${r[1]},${r[2]},${Math.max(0, Math.min(1, a))})` : cor;
}
// Mistura duas cores hex (t = 0 é a primeira, 1 é a segunda): para escurecer ou clarear um tom
export function misturar(a: string, b: string, t: number) {
  const x = hex(a), y = hex(b);
  if (!x || !y) return a;
  const m = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

/* ---------- O toque que afunda ---------- */

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

export type TocavelProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  escala?: number; // quanto afunda (0.98 nos cartões, 0.94 nos botões redondos)
  vibra?: Vibracao | false;
};

// Pressable que afunda (escala 0.98) e vibra de leve. Com "reduzir movimento", só fica um pouco mais apagado.
export function Tocavel({ children, style, escala = 0.98, vibra = 'toque', onPress, onPressIn, onPressOut, disabled, ...resto }: TocavelProps) {
  const reduzir = useReducedMotion();
  const p = useSharedValue(0);
  const animado = useAnimatedStyle(() => (reduzir
    ? { opacity: 1 - p.get() * 0.25 }
    : { transform: [{ scale: 1 - p.get() * (1 - escala) }] }));
  return (
    <PressableAnimado
      accessibilityRole="button"
      {...resto}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...resto.accessibilityState }}
      onPressIn={(e: GestureResponderEvent) => { p.set(withTiming(1, { duration: 90 })); onPressIn?.(e); }}
      onPressOut={(e: GestureResponderEvent) => { p.set(withSpring(0, { damping: 14, stiffness: 260 })); onPressOut?.(e); }}
      onPress={onPress ? (e: GestureResponderEvent) => { if (vibra) vibrar(vibra); onPress(e); } : undefined}
      style={[style, animado, disabled && { opacity: 0.45 }]}>
      {children}
    </PressableAnimado>
  );
}
