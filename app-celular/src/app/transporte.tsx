// Transporte (tela empurrada): o veículo escolhido em cima (chips para trocar, o desenho ou a foto, km no painel e
// consumo), as ações rápidas (Abastecer, Manutenção, Outro gasto, Posto mais barato), o gasto do mês com os 12 meses e
// a divisão por tipo, os próximos cuidados (óleo, rodízio, IPVA, licenciamento e seguro, com o "Paguei"), o
// combustível na cidade (ANP), quanto o veículo custa de verdade e os gastos do mês.
// - O que a pessoa anota aparece na hora, com Desfazer; o site confirma por trás (components/transporte/acoes.ts).
// - O veículo em si (modelo, FIPE, foto, vencimentos) é editado no site, que volta para cá quando fecha.
// - Abre só quando o site atende o Transporte nativo (Estado.recursos com 'transporte'); senão, o atalho abre no site.
// - Puxar para baixo pede ao site para sincronizar; ao abrir, o site confere os preços da semana (e a FIPE do mês).
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, MARGEM, Topo } from '@/components/bancos/comum';
import { abrirGasto, buscarPrecos, editarVeiculoNoSite, useTransporte, useVeiculoEscolhido, type DadosTransporte } from '@/components/transporte/acoes';
import { CartaoCombustivel, CartaoCuidados, CartaoCusto, CartaoMes } from '@/components/transporte/cartoes';
import { ListaGastos, RodapeVeiculo } from '@/components/transporte/lista';
import { gastosDoMes, mesesDo, temMotor } from '@/components/transporte/regras';
import { AcoesRapidas, ChipsVeiculos, TopoVeiculo } from '@/components/transporte/topo';
import { Aurora, Botao, BotaoRedondo, entradaCascata, Esqueleto, LuzDeFundo, Recado, Vazio } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';
import { pedirSite, useRecurso, type Veiculo } from '@/lib/motor';

// os preços da semana: uma conferida por abertura do app (o site só busca de novo depois de 3 dias)
let conferiuPrecos = false;
const SEM_VEICULOS: Veiculo[] = [];

export default function Transporte() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const atende = useRecurso('transporte');
  const dados = useTransporte();
  const [puxando, setPuxando] = useState(false);
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((ev) => { rolagem.set(ev.contentOffset.y); });

  const ok = dados.st === 'ok' ? dados : null;
  const v = useVeiculoEscolhido(ok?.veiculos ?? SEM_VEICULOS);
  const temCidade = !!ok?.T.cidade;
  useEffect(() => {
    if (!temCidade || conferiuPrecos) return;
    conferiuPrecos = true;
    buscarPrecos(false).catch(() => {});
  }, [temCidade]);

  const puxar = async () => {
    setPuxando(true);
    try { await pedirSite('sincronizar', null, 15_000); } catch {}
    setPuxando(false);
  };

  let corpo;
  if (!atende && dados.st !== 'carregando') {
    // uma cópia do site de antes do Transporte nativo: abre a área no site
    corpo = (
      <View style={estilos.centro}>
        <Vazio icone="carro" cor={c.ciano} titulo="Transporte" texto="Combustível, manutenção, documentos e quanto o carro custa de verdade."
          acao={{ titulo: 'Abrir o Transporte', icone: 'carro', onPress: () => abrirNoSiteDaqui({ area: 'transporte' }) }} />
      </View>
    );
  } else if (dados.st === 'carregando') {
    corpo = <Carregando />;
  } else if (dados.st === 'desligado') {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="carro"
          cor={c.ciano}
          titulo="O Pessoal está desligado"
          texto="Ligue a área Pessoal nos ajustes do Avina para acompanhar o combustível, a manutenção e os documentos do seu veículo."
          acao={{ titulo: 'Abrir os ajustes', icone: 'configuracoes', onPress: () => abrirNoSiteDaqui({ tela: 'ajustes' }, 'ajustes') }}
        />
      </View>
    );
  } else {
    corpo = <Conteudo d={dados} v={v} />;
  }

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <Aurora altura={360} rolagem={rolagem} forca={0.55} cores={[c.ciano, c.azul, c.roxo]} />
      <LuzDeFundo />
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: ins.top + ALTURA_TOPO + Espaco.dois, paddingBottom: ins.bottom + Espaco.oito * 3, paddingHorizontal: MARGEM, gap: Espaco.seis, flexGrow: 1 }}
        refreshControl={ok ? <RefreshControl refreshing={puxando} onRefresh={puxar} tintColor={c.apoio} colors={[c.azul]} progressViewOffset={ins.top + ALTURA_TOPO} /> : undefined}>
        {corpo}
      </Animated.ScrollView>
      <Topo
        titulo="Transporte"
        rolagem={rolagem}
        direita={v && atende ? <BotaoRedondo icone="editar" rotulo={`Editar ${v.nome} no Avina completo`} tamanho={44} onPress={() => editarVeiculoNoSite(v.id)} /> : undefined}
      />
      {ok ? <Recado /> : null}
    </View>
  );
}

function Conteudo({ d, v }: { d: DadosTransporte; v: Veiculo | null }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [mes, setMes] = useState(d.hoje.slice(0, 7));
  // trocou de veículo: volta para o mês de agora
  const [vid, setVid] = useState(v?.id ?? null);
  if ((v?.id ?? null) !== vid) { setVid(v?.id ?? null); setMes(d.hoje.slice(0, 7)); }
  const entra = (i: number) => (reduzir ? undefined : entradaCascata(40 + i * 55, 380));

  const multi = d.veiculos.length >= 2;
  const meses = mesesDo(d.T, v);
  const itens = gastosDoMes(d.lanc, d.contas, mes, multi && v ? v.id : null);
  const doMesAgora = mes === d.hoje.slice(0, 7) ? itens : gastosDoMes(d.lanc, d.contas, d.hoje.slice(0, 7), multi && v ? v.id : null);
  const algumGasto = meses.some((m) => m.total > 0);

  if (!v) {
    // sem veículo: o caminho é escolher um (no site); os gastos de transporte que já existem continuam aqui
    return (
      <>
        <Animated.View entering={entra(0)} style={algumGasto ? undefined : estilos.centro}>
          <Vazio
            icone="carro"
            cor={c.ciano}
            titulo="Escolha o seu veículo"
            texto="Carro, moto, bike ou só apps e ônibus: o Avina acompanha o consumo, lembra da troca de óleo e do IPVA e mostra quanto ele custa de verdade."
            acao={{ titulo: 'Escolher o meu veículo', icone: 'carro', onPress: () => editarVeiculoNoSite('novo') }}
          />
          <Botao titulo="Anotar um gasto com transporte" icone="mais" variante="texto" tamanho="pequeno" onPress={() => abrirGasto(null, 'outro')} style={{ alignSelf: 'center' }} />
        </Animated.View>
        {algumGasto ? (
          <>
            <Animated.View entering={entra(1)}><CartaoMes meses={meses} mes={mes} aoEscolher={setMes} hoje={d.hoje} /></Animated.View>
            <Animated.View entering={entra(2)}><ListaGastos key={mes} itens={itens} mes={mes} hoje={d.hoje} /></Animated.View>
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      {multi ? <Animated.View entering={entra(0)}><ChipsVeiculos veiculos={d.veiculos} v={v} /></Animated.View> : null}
      <Animated.View key={`topo-${v.id}`} entering={entra(1)}>
        <TopoVeiculo v={v} doMes={doMesAgora} />
      </Animated.View>
      <Animated.View entering={entra(2)}>
        <AcoesRapidas v={v} />
      </Animated.View>
      <Animated.View entering={entra(3)}>
        <CartaoMes meses={meses} mes={mes} aoEscolher={setMes} hoje={d.hoje} />
      </Animated.View>
      {temMotor(v) ? (
        <Animated.View entering={entra(4)}>
          <CartaoCuidados v={v} hoje={d.hoje} />
        </Animated.View>
      ) : null}
      {temMotor(v) ? (
        <Animated.View entering={entra(5)}>
          <CartaoCombustivel v={v} T={d.T} />
        </Animated.View>
      ) : null}
      {v.custo ? (
        <Animated.View entering={entra(6)}>
          <CartaoCusto v={v} />
        </Animated.View>
      ) : null}
      <Animated.View entering={entra(7)}>
        <ListaGastos key={`${v.id}-${mes}`} itens={itens} mes={mes} hoje={d.hoje} />
      </Animated.View>
      <Animated.View entering={entra(8)}>
        <RodapeVeiculo v={v} />
      </Animated.View>
    </>
  );
}

// Enquanto o retrato do Transporte não chega (a primeira abertura, ou o site ainda carregando a parte do app)
function Carregando() {
  return (
    <View style={{ gap: Espaco.cinco, alignItems: 'center', paddingTop: Espaco.cinco }} accessible accessibilityRole="progressbar" accessibilityLabel="Carregando o Transporte">
      <Esqueleto largura={260} altura={130} raio={28} />
      <Esqueleto largura={150} altura={26} raio={10} />
      <Esqueleto altura={78} raio={28} />
      <View style={{ flexDirection: 'row', gap: Espaco.quatro }}>
        {[0, 1, 2, 3].map((i) => <Esqueleto key={i} largura={60} altura={60} raio={30} />)}
      </View>
      <Esqueleto altura={220} raio={28} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', paddingBottom: Espaco.oito * 2 },
});
