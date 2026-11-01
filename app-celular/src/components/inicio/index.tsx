// O Início (a primeira aba da casca, src/app/index.tsx): a aurora no topo, o cabeçalho com a saudação, o carrossel
// de destaques e os cartões que a pessoa escolheu (lib/widgets.ts), na ordem dela, entrando em cascata.
// - Rolar para baixo esconde a pílula "Pergunte à Bolinha" da barra; rolar para cima traz de volta ("pilula").
// - Puxar para baixo atualiza: pede ao site para sincronizar com a nuvem e relê os saldos do banco.
// - Conta nova (sem lançamentos): as boas-vindas da Bolinha no lugar dos cartões que dependem de lançamentos.
// - Pessoal desligado: o carrossel e os cartões mostram o consultório e as áreas (os do Pessoal não aparecem).
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type AnimatedRef, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALTURA_BARRA, useBaseBarra } from '@/components/barra';
import { BoasVindas, CartaoAreas, CartaoCombustivel } from '@/components/inicio/atalhos';
import { Cabecalho } from '@/components/inicio/cabecalho';
import { Carrossel } from '@/components/inicio/carrossel';
import {
  CartaoBancos, CartaoCaixinhas, CartaoCategorias, CartaoContas, CartaoFluxo, CartaoGastosMes, CartaoRecentes, CartaoTetos,
} from '@/components/inicio/cartoes';
import { primeiroNome, resumirMes, type ResumoMes } from '@/components/inicio/comum';
import { CartaoConsultorio } from '@/components/inicio/consultorio';
import { Aurora, Botao, comAlfa, entradaCascata, LuzDeFundo } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';
import { atualizarBanco, useBanco } from '@/hooks/use-banco';
import { pedirSite, useEstado } from '@/lib/motor';
import { useEscolhaWidgets, widgetsVisiveis, type IdWidget, type InfoWidget } from '@/lib/widgets';

// cartões que só fazem sentido com lançamentos (na conta nova, ficam para depois do primeiro gasto)
const SO_COM_LANC = new Set<IdWidget>(['gastosMes', 'categorias', 'recentes', 'fluxo']);

// os cartões de meia largura vão aos pares, lado a lado; um sozinho ocupa a linha toda
function emLinhas(lista: InfoWidget[]) {
  const linhas: InfoWidget[][] = [];
  for (let i = 0; i < lista.length; i++) {
    const w = lista[i], prox = lista[i + 1];
    if (w.meia && prox?.meia) { linhas.push([w, prox]); i++; } else linhas.push([w]);
  }
  return linhas;
}

function Widget({ id, r, aoVerAtividades }: { id: IdWidget; r: ResumoMes; aoVerAtividades: () => void }) {
  switch (id) {
    case 'bancos': return <CartaoBancos />;
    case 'gastosMes': return <CartaoGastosMes r={r} />;
    case 'categorias': return <CartaoCategorias r={r} />;
    case 'consultorio': return <CartaoConsultorio />;
    case 'recentes': return r.recentes.length ? <CartaoRecentes r={r} aoVerTudo={aoVerAtividades} /> : null;
    case 'fluxo': return <CartaoFluxo r={r} aoVerTudo={aoVerAtividades} />;
    case 'contas': return <CartaoContas r={r} />;
    case 'tetos': return <CartaoTetos r={r} />;
    case 'caixinhas': return <CartaoCaixinhas />;
    case 'combustivel': return <CartaoCombustivel />;
    case 'areas': return <CartaoAreas />;
    default: return null;
  }
}

export type InicioProps = {
  pilula: SharedValue<number>; // a pílula "Pergunte à Bolinha" da barra (1 aparece, 0 some)
  rolagem: AnimatedRef<Animated.ScrollView>; // a casca sobe para o topo ao tocar de novo em Início
  aoVerAtividades: () => void;
};

export function Inicio({ pilula, rolagem, aoVerAtividades }: InicioProps) {
  const c = useCores();
  const e = useEstado();
  const ins = useSafeAreaInsets();
  const base = useBaseBarra();
  const reduzir = useReducedMotion();
  const banco = useBanco();
  const escolha = useEscolhaWidgets();

  // a rolagem: a aurora some, o topo escurece (a barra de status fica legível) e a pílula some ou volta
  const y = useSharedValue(0);
  const antes = useSharedValue(0);
  const alvoPilula = useSharedValue(1);
  const rolar = useAnimatedScrollHandler({
    onScroll: (ev) => {
      const yy = ev.contentOffset.y;
      const fim = ev.contentSize.height - ev.layoutMeasurement.height;
      const d = yy - antes.get();
      y.set(yy);
      antes.set(yy);
      // perto do topo, sempre à vista; no fim (o "quique" da rolagem), não mexe
      const alvo = yy < 60 ? 1 : yy > fim - 4 ? -1 : d > 4 ? 0 : d < -4 ? 1 : -1;
      if (alvo >= 0 && alvo !== alvoPilula.get()) { alvoPilula.set(alvo); pilula.set(withTiming(alvo, { duration: 220 })); }
    },
  });
  const topo = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [10, 70], [0, 1], Extrapolation.CLAMP) }));

  const [atualizando, setAtualizando] = useState(false);
  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await Promise.allSettled([pedirSite('sincronizar', null), banco.ligado ? atualizarBanco(true) : Promise.resolve()]);
    setAtualizando(false);
  }, [banco.ligado]);

  if (!e) return <View style={{ flex: 1 }} />;
  const r = resumirMes(e);
  const novo = !!e.pessoal && !r.temLanc;
  const lista = widgetsVisiveis(e, escolha).filter((w) => !(novo && SO_COM_LANC.has(w.id)));
  const linhas = emLinhas(lista);

  // cada bloco entra de baixo, um pouco depois do anterior (sem animação com "reduzir movimento"; com o vidro, sem
  // esmaecer: components/ui/vidro.tsx)
  let ordem = 0;
  const bloco = (key: string, filho: ReactNode, style?: object) => {
    const i = ordem++;
    return (
      <Animated.View key={key} entering={reduzir ? undefined : entradaCascata(80 + Math.min(i, 8) * 55, 460)} style={style}>
        {filho}
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Aurora rolagem={y} altura={360 + ins.top} />
      {/* por cima da aurora: o fim dela (que se funde com o fundo) não vira uma faixa escura antes da luz */}
      <LuzDeFundo />
      <Animated.ScrollView
        ref={rolagem}
        onScroll={rolar}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: ins.top + Espaco.dois, paddingBottom: base + ALTURA_BARRA + Espaco.seis }}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={c.apoio} colors={[c.azul]} progressBackgroundColor={c.cartao} progressViewOffset={ins.top} />
        }>
        {bloco('cabecalho', <Cabecalho e={e} />)}
        <View style={{ height: Espaco.seis }} />
        {novo ? bloco('boas-vindas', <BoasVindas nome={primeiroNome(e.conta?.nome)} />, estilos.lado) : null}
        {novo ? <View style={{ height: Espaco.tres + 2 }} /> : null}
        {bloco('carrossel', <Carrossel e={e} r={r} aoVerAtividades={aoVerAtividades} />)}
        <View style={estilos.cartoes}>
          {linhas.map((l) => (l.length === 2
            ? bloco(`${l[0].id}+${l[1].id}`, (
              <View style={estilos.par}>
                <Widget id={l[0].id} r={r} aoVerAtividades={aoVerAtividades} />
                <Widget id={l[1].id} r={r} aoVerAtividades={aoVerAtividades} />
              </View>
            ))
            : bloco(l[0].id, <Widget id={l[0].id} r={r} aoVerAtividades={aoVerAtividades} />)))}
          {bloco('personalizar', (
            <Botao
              titulo="Personalizar início"
              icone="widgets"
              variante="secundario"
              tamanho="medio"
              onPress={() => router.push('/widgets')}
              rotulo="Personalizar o início: escolher e ordenar os cartões"
              style={{ alignSelf: 'center', marginTop: Espaco.tres }}
            />
          ))}
        </View>
      </Animated.ScrollView>
      {/* ao rolar, o topo escurece por trás da barra de status */}
      <Animated.View pointerEvents="none" style={[estilos.topo, { height: ins.top + Espaco.cinco }, topo]}>
        <LinearGradient colors={[c.fundo, c.fundo, comAlfa(c.fundo, 0)]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  lado: { paddingHorizontal: Espaco.quatro },
  cartoes: { paddingHorizontal: Espaco.quatro, gap: Espaco.tres + 2, marginTop: Espaco.tres + 2 },
  par: { flexDirection: 'row', gap: Espaco.tres + 2, alignItems: 'stretch' },
  topo: { position: 'absolute', top: 0, left: 0, right: 0 },
});
