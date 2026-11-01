// A lista dos cartões do Início que dá para reordenar arrastando a alça (≡). Cada linha fica numa posição fixa
// (altura igual para todas); a que está sendo arrastada segue o dedo, um pouco erguida, e as outras abrem espaço com
// uma mola. Com leitor de tela, a alça é "ajustável": deslizar para cima ou para baixo sobe ou desce o cartão.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Icone, Separador, vibrar } from '@/components/ui';
import { Espaco, Raio, useCores } from '@/constants/theme';

export const ALTURA_LINHA = 80;
const MOLA = { damping: 22, stiffness: 280, mass: 0.7 };

type LinhaProps = {
  id: string;
  indice: number;
  total: number;
  nome: string;
  posicaoAgora: (id: string) => number; // a posição na ordem de agora (pode estar à frente do que já foi desenhado)
  aoComecar: (id: string) => void;
  aoMover: (id: string, y: number) => void;
  aoSoltar: (id: string) => void;
  aoPasso: (id: string, passo: -1 | 1) => void; // leitor de tela: sobe ou desce uma posição
  children: ReactNode;
};

function LinhaOrdenavel({ id, indice, total, nome, posicaoAgora, aoComecar, aoMover, aoSoltar, aoPasso, children }: LinhaProps) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const y = useSharedValue(indice * ALTURA_LINHA);
  const segurando = useSharedValue(0); // 1 enquanto o dedo está na alça (decide quem manda na posição)
  const ergue = useSharedValue(0); // 0 a 1: o quanto a linha está erguida (sombra e escala)
  const base = useSharedValue(0);

  // as outras linhas abrem espaço; a que está no dedo não obedece à posição até soltar
  useEffect(() => {
    if (segurando.get()) return;
    const alvo = indice * ALTURA_LINHA;
    y.set(reduzir ? alvo : withSpring(alvo, MOLA));
  }, [indice, reduzir, segurando, y]);

  const comecar = () => {
    segurando.set(1);
    base.set(y.get());
    ergue.set(reduzir ? 1 : withTiming(1, { duration: 140 }));
    aoComecar(id);
  };
  const mover = (dy: number) => {
    if (!segurando.get()) return;
    const max = (total - 1) * ALTURA_LINHA;
    const ny = Math.max(-ALTURA_LINHA * 0.35, Math.min(max + ALTURA_LINHA * 0.35, base.get() + dy));
    y.set(ny);
    aoMover(id, ny);
  };
  const soltar = () => {
    if (!segurando.get()) return;
    segurando.set(0);
    const alvo = posicaoAgora(id) * ALTURA_LINHA;
    y.set(reduzir ? alvo : withSpring(alvo, MOLA));
    ergue.set(reduzir ? 0 : withTiming(0, { duration: 180 }));
    aoSoltar(id);
  };
  const arrasto = usePanGesture({
    runOnJS: true,
    minDistance: 2,
    onActivate: () => comecar(),
    onUpdate: (e) => mover(e.translationY),
    onFinalize: () => soltar(),
  });

  const estilo = useAnimatedStyle(() => ({
    zIndex: segurando.get() || ergue.get() > 0.01 ? 10 : 1,
    transform: [{ translateY: y.get() }, { scale: 1 + ergue.get() * 0.025 }],
  }));
  const fundo = useAnimatedStyle(() => ({ opacity: ergue.get() }));

  return (
    <Animated.View style={[estilos.linha, estilo]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, estilos.erguida, { backgroundColor: c.escuro ? c.cartao3 : '#FFFFFF', boxShadow: `0px 10px 24px rgba(0,0,0,${c.escuro ? 0.55 : 0.14})` }, fundo]}
      />
      <View style={estilos.conteudo}>{children}</View>
      <GestureDetector gesture={arrasto}>
        <View
          collapsable={false}
          style={estilos.alca}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Mover ${nome}`}
          accessibilityValue={{ text: `posição ${indice + 1} de ${total}` }}
          accessibilityActions={[{ name: 'increment', label: 'Subir' }, { name: 'decrement', label: 'Descer' }]}
          onAccessibilityAction={(ev) => {
            if (ev.nativeEvent.actionName === 'increment') aoPasso(id, -1);
            else if (ev.nativeEvent.actionName === 'decrement') aoPasso(id, 1);
          }}>
          <Icone nome="arrastar" tamanho={20} cor={c.fraco} peso="semibold" />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// A lista inteira: ordem (ids), o que desenhar em cada linha e o aviso quando a ordem muda
export function ListaOrdenavel({ ordem, nomes, aoMudar, aoArrastar, linha }: {
  ordem: string[];
  nomes: Record<string, string>;
  aoMudar: (ordem: string[]) => void; // ao soltar (ou no passo do leitor de tela)
  aoArrastar?: (arrastando: boolean) => void; // para travar a rolagem da tela enquanto arrasta
  linha: (id: string, indice: number) => ReactNode;
}) {
  // enquanto arrasta, a ordem que vale é a do dedo (vivo); o gesto lê a cópia em "agora", sempre a mais nova
  const [vivo, setVivo] = useState<string[] | null>(null);
  const agora = useRef(ordem);
  const daProp = useRef(ordem);
  useEffect(() => { daProp.current = ordem; }, [ordem]);

  const comecar = () => { agora.current = daProp.current; setVivo(agora.current); aoArrastar?.(true); vibrar('leve'); };
  const mover = (id: string, y: number) => {
    const lista = agora.current;
    const de = lista.indexOf(id);
    const para = Math.max(0, Math.min(lista.length - 1, Math.round(y / ALTURA_LINHA)));
    if (de < 0 || para === de) return;
    const n = [...lista];
    n.splice(de, 1);
    n.splice(para, 0, id);
    agora.current = n;
    setVivo(n);
    vibrar('toque');
  };
  const soltar = () => {
    const final = agora.current;
    setVivo(null);
    aoArrastar?.(false);
    vibrar('leve');
    aoMudar(final);
  };
  const passo = (id: string, p: -1 | 1) => {
    const lista = [...daProp.current];
    const de = lista.indexOf(id);
    const para = de + p;
    if (de < 0 || para < 0 || para >= lista.length) return;
    lista.splice(de, 1);
    lista.splice(para, 0, id);
    vibrar('toque');
    aoMudar(lista);
  };
  const posicaoAgora = (id: string) => agora.current.indexOf(id);

  const lista = vivo ?? ordem;
  // as linhas ficam sempre na mesma ordem na árvore (a posição é só o deslocamento): nada é recriado ao trocar
  const fixas = [...lista].sort();
  return (
    <View style={{ height: lista.length * ALTURA_LINHA }}>
      {/* as linhas finas entre os lugares ficam paradas; a linha erguida passa por cima delas */}
      {lista.slice(1).map((_, i) => (
        <Separador key={`s${i}`} recuo={Espaco.quatro + 52} style={{ position: 'absolute', left: 0, right: Espaco.quatro, top: (i + 1) * ALTURA_LINHA }} />
      ))}
      {fixas.map((id) => (
        <LinhaOrdenavel
          key={id}
          id={id}
          indice={lista.indexOf(id)}
          total={lista.length}
          nome={nomes[id] ?? id}
          posicaoAgora={posicaoAgora}
          aoComecar={comecar}
          aoMover={mover}
          aoSoltar={soltar}
          aoPasso={passo}>
          {linha(id, lista.indexOf(id))}
        </LinhaOrdenavel>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { position: 'absolute', left: 0, right: 0, top: 0, height: ALTURA_LINHA, flexDirection: 'row', alignItems: 'center' },
  erguida: { borderRadius: Raio.medio, borderCurve: 'continuous' },
  conteudo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingLeft: Espaco.quatro },
  alca: { width: 48, height: ALTURA_LINHA, alignItems: 'center', justifyContent: 'center' },
});
