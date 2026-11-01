// Contas fixas (tela empurrada): o que falta pagar no mês, a barra do que já foi pago e a régua do mês; a conta que
// mais pede atenção em destaque; a lista em grupos (atrasadas, nos próximos 7 dias, mais para a frente e pagas), com
// o círculo de marcar como paga em cada linha; e as assinaturas, com o total por mês e por ano.
// - Marcar vibra, aparece na hora e mostra o recado com Desfazer; o site confirma por trás (components/contas/acoes.ts).
// - Tocar numa conta abre o detalhe (/conta/[id]); o + abre a conta nova (/conta/editar).
// - Puxar para baixo pede ao site para sincronizar com a nuvem.
// - Abre só quando o site atende as contas nativas (Estado.recursos com 'contas2'); senão os atalhos abrem no site.
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, MARGEM, Topo } from '@/components/bancos/comum';
import { lerBoletoNoSite, useContas } from '@/components/contas/acoes';
import { CartaoAssinaturas, CartaoProxima, CartaoTudoPago, GrupoContas, TopoContas } from '@/components/contas/cartoes';
import { Aurora, Botao, BotaoRedondo, Chips, entradaCascata, LuzDeFundo, Recado, Vazio, type OpcaoChip } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';
import { pedirSite } from '@/lib/motor';

type Filtro = 'todas' | 'apagar' | 'pagas' | 'assinaturas';

export default function Contas() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const dados = useContas();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [puxando, setPuxando] = useState(false);
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((ev) => { rolagem.set(ev.contentOffset.y); });

  const nova = () => router.push('/conta/editar');
  const puxar = async () => {
    setPuxando(true);
    try { await pedirSite('sincronizar', null, 15_000); } catch {}
    setPuxando(false);
  };
  const entra = (i: number) => (reduzir ? undefined : entradaCascata(60 + i * 60, 380));

  let corpo;
  if (!dados) {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="conta"
          titulo="O Pessoal está desligado"
          texto="Ligue a área Pessoal nos ajustes do Avina para anotar as contas que se repetem todo mês e ser lembrado antes de vencerem."
          acao={{ titulo: 'Abrir os ajustes', icone: 'configuracoes', onPress: () => abrirNoSiteDaqui({ tela: 'ajustes' }, 'ajustes') }}
        />
      </View>
    );
  } else if (!dados.lista.length) {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="calendario"
          cor={c.ambar}
          titulo="Nenhuma conta fixa ainda"
          texto="Aluguel, luz, internet, streaming: anote uma vez e o Avina mostra o que vence no mês e lembra antes de cada vencimento."
          acao={{ titulo: 'Adicionar conta', icone: 'mais', onPress: nova }}
        />
        <Botao titulo="Ler um boleto" icone="codigoBarras" variante="texto" tamanho="pequeno" onPress={lerBoletoNoSite} rotulo="Ler um boleto com a câmera" style={{ alignSelf: 'center' }} />
      </View>
    );
  } else {
    const r = dados.resumo;
    const abertas = r.atrasadas.length + r.semana.length + r.depois.length;
    const opcoes: OpcaoChip<Filtro>[] = [
      { id: 'todas', nome: 'Todas', contagem: r.todas.length },
      { id: 'apagar', nome: 'A pagar', contagem: abertas },
      { id: 'pagas', nome: 'Pagas', contagem: r.pagas.length },
      ...(r.assinaturas.length ? [{ id: 'assinaturas' as const, nome: 'Assinaturas', contagem: r.assinaturas.length }] : []),
    ];
    const aPagar = (
      <>
        <GrupoContas titulo="Atrasadas" contas={r.atrasadas} cor={c.negativo} />
        <GrupoContas titulo="Nos próximos 7 dias" contas={r.semana} cor={r.semana.some((k) => k.st === 'hoje' || k.st === 'breve') ? c.ambar : undefined} />
        <GrupoContas titulo="Mais para a frente" contas={r.depois} />
      </>
    );
    corpo = (
      <>
        <Animated.View entering={entra(0)}>
          <TopoContas r={r} hoje={dados.hoje} />
        </Animated.View>
        <Animated.View entering={entra(1)}>
          {r.proxima ? <CartaoProxima conta={r.proxima} /> : <CartaoTudoPago mes={r.mes} />}
        </Animated.View>
        <Animated.View entering={entra(2)} style={{ gap: Espaco.cinco }}>
          <Chips opcoes={opcoes} valor={filtro} onTrocar={setFiltro} rotulo="Quais contas ver" margem={MARGEM} style={{ marginHorizontal: -MARGEM, flexGrow: 0 }} />
          {filtro === 'todas' ? (
            <>
              {aPagar}
              <GrupoContas titulo="Pagas" contas={r.pagas} cor={c.positivo} recolhivel aberto={false} />
              <CartaoAssinaturas r={r} lista={false} aoAbrir={() => setFiltro('assinaturas')} />
            </>
          ) : filtro === 'apagar' ? (
            abertas ? aPagar : <Vazio icone="check" cor={c.positivo} titulo="Nada a pagar" texto="Todas as contas deste mês já foram pagas." />
          ) : filtro === 'pagas' ? (
            r.pagas.length ? <GrupoContas titulo="Pagas" contas={r.pagas} cor={c.positivo} /> : <Vazio icone="calendario" titulo="Nenhuma paga ainda" texto="Toque no círculo de uma conta para marcar como paga." />
          ) : (
            <CartaoAssinaturas r={r} />
          )}
        </Animated.View>
      </>
    );
  }

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <Aurora altura={320} rolagem={rolagem} forca={0.5} />
      <LuzDeFundo />
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: ins.top + ALTURA_TOPO + Espaco.dois, paddingBottom: ins.bottom + Espaco.oito * 3, paddingHorizontal: MARGEM, gap: Espaco.seis, flexGrow: 1 }}
        refreshControl={dados ? <RefreshControl refreshing={puxando} onRefresh={puxar} tintColor={c.apoio} colors={[c.azul]} progressViewOffset={ins.top + ALTURA_TOPO} /> : undefined}>
        {corpo}
      </Animated.ScrollView>
      <Topo
        titulo="Contas fixas"
        rolagem={rolagem}
        direita={dados ? <BotaoRedondo icone="mais" rotulo="Nova conta fixa" tamanho={44} onPress={nova} /> : undefined}
      />
      {dados ? <Recado /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', paddingBottom: Espaco.oito * 2 },
});
