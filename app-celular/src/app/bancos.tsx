// Bancos (tela empurrada): o que está nos bancos conectados pelo Open Finance, em três abas (Contas, Cartões e
// Investimentos) sobre uma aurora suave. Os saldos vêm do site (hooks/use-banco.ts), que guarda a chave e pergunta
// ao servidor; a última leitura aparece na hora e a nova chega por trás. Puxar para baixo pede uma leitura nova.
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AbaCartoes, AbaContas, AbaInvestimentos } from '@/components/bancos/abas';
import { conectarBanco } from '@/components/bancos/acoes';
import { ALTURA_TOPO, MARGEM, Topo } from '@/components/bancos/comum';
import { AvisoAutorizar, BancosConectados, RodapeBanco } from '@/components/bancos/conectados';
import { Aurora, Botao, Cartao, Chips, entradaCascata, Esqueleto, EsqueletoLista, Icone, LuzDeFundo, Texto, Vazio, type OpcaoChip } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';
import { totaisBanco, useBanco } from '@/hooks/use-banco';
import { useEstado } from '@/lib/motor';

type Aba = 'contas' | 'cartoes' | 'investimentos';

export default function Bancos() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const e = useEstado();
  const b = useBanco();
  const reduzir = useReducedMotion();
  const [aba, setAba] = useState<Aba>('contas');
  const [puxando, setPuxando] = useState(false);
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((ev) => { rolagem.set(ev.contentOffset.y); });

  const r = b.resumo;
  const t = totaisBanco(r);
  const conectados = r?.bancos ?? [];

  const puxar = async () => { setPuxando(true); await b.recarregar(); setPuxando(false); };

  let corpo;
  if (!b.ligado || r?.ligado === false) {
    corpo = (
      <Vazio
        icone="banco"
        titulo="Conexão com bancos"
        texto="A conexão com bancos pelo Open Finance não está disponível na sua conta. Os gastos e as entradas continuam no Pessoal, anotados por você ou pela Bolinha."
      />
    );
  } else if (!r && b.carregando) {
    corpo = <Carregando />;
  } else if (!r || (r.erro && !conectados.length)) {
    corpo = (
      <Vazio
        icone="alerta"
        cor={c.ambar}
        titulo="Não deu para ler os bancos"
        texto="Confira a internet e tente de novo. Os dados ficam guardados com segurança no Avina."
        acao={{ titulo: 'Tentar de novo', icone: 'atualizar', onPress: () => { b.recarregar(); } }}
      />
    );
  } else if (!conectados.length) {
    corpo = (
      <Vazio
        icone="banco"
        titulo="Conecte seu banco"
        texto="Os saldos das contas, as faturas dos cartões e os investimentos num lugar só, pelo Open Finance. Só leitura: nada sai da sua conta."
        acao={{ titulo: 'Conectar banco', icone: 'mais', onPress: () => conectarBanco() }}
      />
    );
  } else {
    const opcoes: OpcaoChip<Aba>[] = [
      { id: 'contas', nome: 'Contas' },
      { id: 'cartoes', nome: 'Cartões' },
      { id: 'investimentos', nome: 'Investimentos' },
    ];
    corpo = (
      <View style={{ gap: Espaco.seis }}>
        <Chips opcoes={opcoes} valor={aba} onTrocar={setAba} rotulo="O que ver" margem={MARGEM} style={{ marginHorizontal: -MARGEM, flexGrow: 0 }} />
        {t.pedeAutorizar.map((x) => <AvisoAutorizar key={x.id} b={x} />)}
        {r.erro ? <AvisoErro carregando={b.carregando} tentar={() => { b.recarregar(); }} /> : null}
        <Animated.View key={aba} entering={reduzir ? undefined : entradaCascata(0, 240)}>
          {aba === 'contas' ? <AbaContas r={r} /> : aba === 'cartoes' ? <AbaCartoes r={r} /> : <AbaInvestimentos r={r} />}
        </Animated.View>
        <BancosConectados bancos={conectados} pessoal={!!e?.pessoal} />
        <RodapeBanco />
      </View>
    );
  }

  // com as abas (ou o esqueleto delas), o conteúdo começa no topo; os avisos de vazio ficam no meio da tela
  const noTopo = b.ligado && r?.ligado !== false && ((!!r && conectados.length > 0) || (!r && b.carregando));
  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <Aurora altura={340} rolagem={rolagem} forca={0.62} />
      <LuzDeFundo />
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: ins.top + ALTURA_TOPO + Espaco.dois, paddingBottom: ins.bottom + Espaco.oito, paddingHorizontal: MARGEM, flexGrow: 1 }}
        refreshControl={b.ligado && r?.ligado !== false ? <RefreshControl refreshing={puxando} onRefresh={puxar} tintColor={c.apoio} colors={[c.azul]} progressViewOffset={ins.top + ALTURA_TOPO} /> : undefined}>
        {noTopo ? corpo : <View style={estilos.centro}>{corpo}</View>}
      </Animated.ScrollView>
      <Topo titulo="Bancos" rolagem={rolagem} />
    </View>
  );
}

// Lendo os bancos pela primeira vez: o esqueleto das abas, do número grande e da lista
function Carregando() {
  return (
    <View style={{ gap: Espaco.seis, paddingTop: Espaco.dois }}>
      <View style={{ flexDirection: 'row', gap: Espaco.dois }}>
        <Esqueleto largura={84} altura={40} raio={20} />
        <Esqueleto largura={92} altura={40} raio={20} />
        <Esqueleto largura={130} altura={40} raio={20} />
      </View>
      <View style={{ gap: Espaco.dois }}>
        <Esqueleto largura={120} altura={14} />
        <Esqueleto largura={210} altura={40} raio={12} />
        <Esqueleto altura={12} raio={6} style={{ marginTop: Espaco.tres }} />
      </View>
      <Cartao><EsqueletoLista linhas={3} /></Cartao>
    </View>
  );
}

function AvisoErro({ carregando, tentar }: { carregando: boolean; tentar: () => void }) {
  const c = useCores();
  return (
    <View style={[estilos.erro, { backgroundColor: c.cartao2, borderColor: c.linha }]}>
      <Icone nome="info" tamanho={18} cor={c.apoio} />
      <Texto v="apoio" style={{ flex: 1 }}>Não deu para atualizar agora. Estes são os últimos valores lidos.</Texto>
      <Botao titulo="Tentar" variante="texto" tamanho="pequeno" carregando={carregando} onPress={tentar} rotulo="Tentar atualizar de novo" />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', paddingBottom: Espaco.oito * 2 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2, paddingLeft: Espaco.quatro, paddingRight: Espaco.um, paddingVertical: Espaco.dois, borderRadius: 16, borderWidth: 1 },
});
