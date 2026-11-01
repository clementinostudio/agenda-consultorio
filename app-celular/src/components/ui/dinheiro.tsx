// Valor em reais do jeito dos bancos: "R$" e centavos menores e mais apagados que os reais.
// - Conta até o valor quando aparece ou muda (sem animação com "reduzir movimento").
// - Respeita o "olho" do topo (useOculto): mostra "R$ ••••".
// - sinal: "+R$" nas entradas e "−R$" nas saídas; corPorSinal pinta de menta (entrada) ou vermelho (saída).
// - Sem espaço (um saldo de milhões, letra grande no aparelho), encolhe até 60% em vez de cortar.
import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Fontes, useCores } from '@/constants/theme';
import { dinheiro, separarCentavos } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

const facil = (k: number) => 1 - Math.pow(1 - k, 3);

// O número que vai contando até "alvo" (do valor anterior, ou do zero na primeira vez)
export function useContagem(alvo: number, { ativo = true, duracao = 750 }: { ativo?: boolean; duracao?: number } = {}) {
  const reduzir = useReducedMotion();
  const animar = ativo && !reduzir;
  const [v, setV] = useState(animar ? 0 : alvo);
  const ultimo = useRef(animar ? 0 : alvo); // o número na tela agora (de onde a próxima contagem parte)
  useEffect(() => {
    if (!animar) { ultimo.current = alvo; return; }
    const de = ultimo.current, t0 = Date.now();
    let raf = 0;
    const passo = () => {
      const k = de === alvo ? 1 : Math.min(1, (Date.now() - t0) / duracao);
      const x = de + (alvo - de) * facil(k);
      ultimo.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, animar, duracao]);
  return animar ? v : alvo;
}

// O valor para o leitor de tela: respeita o olho do topo ("valor escondido"), como o que aparece na tela
export function useDizerValor() {
  const oculto = useOculto();
  return (v: number, op?: Parameters<typeof dinheiro>[1]) => (oculto ? 'valor escondido' : dinheiro(v, op));
}

export type DinheiroProps = {
  valor: number;
  tamanho?: number; // tamanho dos reais (o "R$" e os centavos ficam com ~55%)
  sinal?: boolean; // "+R$ 10,00" / "−R$ 10,00"
  corPorSinal?: boolean; // menta quando positivo, vermelho quando negativo
  cor?: string;
  centavos?: boolean; // false: "R$ 1.234"
  animar?: boolean;
  mostrar?: boolean; // ignora o "olho" (ex.: o valor que a pessoa está digitando)
  fonte?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function Dinheiro({ valor, tamanho = 34, sinal, corPorSinal, cor, centavos = true, animar = true, mostrar, fonte, style, numberOfLines = 1 }: DinheiroProps) {
  const c = useCores();
  const oculto = useOculto() && !mostrar;
  const v = useContagem(valor, { ativo: animar && !oculto });
  const tinta = cor ?? (corPorSinal && valor > 0 ? c.positivo : corPorSinal && valor < 0 ? c.negativo : c.texto);
  const pequeno = Math.round(tamanho * 0.56);
  const base: TextStyle = {
    fontFamily: fonte ?? Fontes.tituloForte, fontSize: tamanho, color: tinta,
    letterSpacing: -tamanho * 0.025, fontVariant: ['tabular-nums'],
  };
  const menor: TextStyle = { fontSize: pequeno, letterSpacing: 0, fontFamily: Fontes.titulo };

  if (oculto) {
    return (
      <Text style={[base, style]} maxFontSizeMultiplier={1.3} numberOfLines={numberOfLines} adjustsFontSizeToFit={numberOfLines === 1} minimumFontScale={0.6} accessibilityLabel="Valor escondido">
        <Text style={[menor, { opacity: 0.75 }]}>R$ </Text>••••
      </Text>
    );
  }
  // durante a contagem, o sinal segue o valor final (não pisca "−" quando passa do zero)
  const s = separarCentavos(centavos ? v : Math.round(v));
  const negativo = valor < 0 && Math.abs(v) >= 0.005;
  const pre = negativo ? '−' : sinal && valor > 0 ? '+' : '';
  return (
    <Text style={[base, style]} maxFontSizeMultiplier={1.3} numberOfLines={numberOfLines} adjustsFontSizeToFit={numberOfLines === 1} minimumFontScale={0.6} accessibilityLabel={dinheiro(valor, { sinal, centavos })}>
      {pre ? <Text style={{ fontSize: Math.round(tamanho * 0.8) }}>{pre}</Text> : null}
      <Text style={[menor, { opacity: 0.75 }]}>R$ </Text>
      {s.reais}
      {centavos ? <Text style={[menor, { opacity: 0.55 }]}>,{s.centavos}</Text> : null}
    </Text>
  );
}
