// Barras: a barra segmentada por categoria (cantos redondos e um espacinho entre as partes), as barrinhas por
// dia ou semana (a atual acesa) e a barra de progresso (teto do mês, meta da caixinha).
// Todas crescem ao aparecer (sem animação com "reduzir movimento").
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { comAlfa, Tocavel } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Fontes, useCores } from '@/constants/theme';

const curva = Easing.out(Easing.cubic);

/* ---------- Barra segmentada ---------- */

export type Segmento = { valor: number; cor: string; id?: string; rotulo?: string };

function Pedaco({ largura, cor, altura, atraso, animar }: { largura: number; cor: string; altura: number; atraso: number; animar: boolean }) {
  const w = useSharedValue(animar ? 0 : largura);
  useEffect(() => {
    w.set(animar ? withDelay(atraso, withTiming(largura, { duration: 650, easing: curva })) : largura);
  }, [largura, atraso, animar, w]);
  const estilo = useAnimatedStyle(() => ({ width: w.get() }));
  return <Animated.View style={[{ height: altura, borderRadius: altura / 2, borderCurve: 'continuous', backgroundColor: cor }, estilo]} />;
}

export function BarraSegmentada({ segmentos, altura = 12, espaco = 4, animar = true, rotulo, style }: { segmentos: Segmento[]; altura?: number; espaco?: number; animar?: boolean; rotulo?: string; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [W, setW] = useState(0);
  const segs = segmentos.filter((s) => s.valor > 0);
  const total = segs.reduce((t, s) => t + s.valor, 0);
  // cada parte tem pelo menos a largura de uma bolinha, para as pequenas não sumirem
  const livre = Math.max(0, W - espaco * Math.max(0, segs.length - 1));
  const pequenos = segs.filter((s) => (s.valor / total) * livre < altura);
  const resto = livre - pequenos.length * altura;
  const somaGrandes = total - pequenos.reduce((t, s) => t + s.valor, 0);
  const larguras = segs.map((s) => (pequenos.includes(s) ? altura : Math.max(altura, (s.valor / (somaGrandes || 1)) * resto)));
  return (
    <View
      onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}
      style={[{ flexDirection: 'row', gap: espaco, height: altura }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotulo ?? segs.map((s) => s.rotulo).filter(Boolean).join(', ')}>
      {!segs.length ? <View style={{ flex: 1, height: altura, borderRadius: altura / 2, backgroundColor: c.cartao2 }} /> : null}
      {W ? segs.map((s, i) => (
        <Pedaco key={s.id ?? i} largura={larguras[i]} cor={s.cor} altura={altura} atraso={i * 70} animar={animar && !reduzir} />
      )) : null}
    </View>
  );
}

/* ---------- Barrinhas ---------- */

function Barrinha({ h, cor, atraso, animar, raio }: { h: number; cor: string; atraso: number; animar: boolean; raio: number }) {
  const a = useSharedValue(animar ? 0 : h);
  useEffect(() => { a.set(animar ? withDelay(atraso, withTiming(h, { duration: 600, easing: curva })) : h); }, [h, atraso, animar, a]);
  const estilo = useAnimatedStyle(() => ({ height: a.get() }));
  return <Animated.View style={[{ width: '100%', borderRadius: raio, borderCurve: 'continuous', backgroundColor: cor }, estilo]} />;
}

export type BarrinhasProps = {
  valores: number[];
  destaque?: number; // a barra acesa (padrão: a última, que é a de agora)
  cor?: string;
  altura?: number; // altura das barras (sem os rótulos)
  rotulos?: string[]; // embaixo de cada barra ("S", "T", "Q"... ou "1", "8", "15")
  aoTocar?: (i: number) => void;
  formatar?: (v: number) => string; // para o leitor de tela
  animar?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Barrinhas({ valores, destaque, cor, altura = 88, rotulos, aoTocar, formatar = (v) => String(Math.round(v)), animar = true, style }: BarrinhasProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const tinta = cor ?? c.azul;
  const acesa = destaque ?? valores.length - 1;
  const maior = Math.max(1, ...valores);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }, style]}>
      {valores.map((v, i) => {
        const h = v > 0 ? Math.max(6, (v / maior) * altura) : 4;
        const corBarra = v <= 0 ? c.cartao3 : i === acesa ? tinta : comAlfa(tinta, c.escuro ? 0.3 : 0.24);
        const coluna = (
          <>
            <View style={{ height: altura, width: '100%', justifyContent: 'flex-end' }}>
              <Barrinha h={h} cor={corBarra} atraso={i * 35} animar={animar && !reduzir} raio={Math.min(6, h / 2)} />
            </View>
            {rotulos ? (
              <Texto v="apoio" maxFontSizeMultiplier={1.2} numberOfLines={1} cor={i === acesa ? c.texto : c.apoio} style={[estilos.rotulo, i === acesa && { fontFamily: Fontes.textoForte }]}>{rotulos[i] ?? ''}</Texto>
            ) : null}
          </>
        );
        const nome = `${rotulos?.[i] ?? i + 1}: ${formatar(v)}`;
        return aoTocar ? (
          <Tocavel key={i} onPress={() => aoTocar(i)} escala={0.96} accessibilityLabel={nome} style={estilos.coluna}>{coluna}</Tocavel>
        ) : (
          <View key={i} style={estilos.coluna} accessible accessibilityLabel={nome}>{coluna}</View>
        );
      })}
    </View>
  );
}

/* ---------- Barra de progresso ---------- */

export type BarraProgressoProps = {
  progresso: number; // 0 a 1 (passa de 1 quando estourou)
  cor?: string;
  corExcedido?: string; // a cor quando passa de 100% (padrão: vermelho)
  altura?: number;
  fundo?: string;
  animar?: boolean;
  rotulo?: string;
  style?: StyleProp<ViewStyle>;
};

export function BarraProgresso({ progresso, cor, corExcedido, altura = 8, fundo, animar = true, rotulo, style }: BarraProgressoProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const alvo = Math.max(0, Math.min(1, progresso || 0));
  const p = useSharedValue(animar && !reduzir ? 0 : alvo);
  useEffect(() => { p.set(animar && !reduzir ? withDelay(100, withTiming(alvo, { duration: 800, easing: curva })) : alvo); }, [alvo, animar, reduzir, p]);
  const estilo = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));
  const tinta = progresso > 1 ? corExcedido ?? c.negativo : cor ?? c.azul;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round((progresso || 0) * 100) }}
      style={[{ height: altura, borderRadius: altura / 2, backgroundColor: fundo ?? c.cartao2, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height: altura, borderRadius: altura / 2, minWidth: alvo > 0 ? altura : 0, backgroundColor: tinta }, estilo]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { flex: 1, alignItems: 'center', gap: 6 },
  rotulo: { fontSize: 11, lineHeight: 14 },
});
