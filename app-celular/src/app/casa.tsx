// Nossa casa (tela empurrada): onde quem mora junto divide as contas.
// - Topo com o nome da casa e quem mora (avatares sobrepostos; o + convida), os atalhos (anotar gasto, ler a nota,
//   trazer dos meus gastos, convidar) e "Quem deve quanto" com o valor grande e o Acertar.
// - O mês da casa (chips dos 3 meses do retrato): o total, a comparação justa com o mês anterior, a parte de cada um
//   na barra e o mês a mês; embaixo, os gastos por dia com quem pagou e a sua parte (tocar abre o gasto).
// - Contas da casa com o "Paguei", a lista de compras (com o modo mercado) e os preços que mudaram.
// - O que fica no site (convidar, a divisão, as pessoas, as listas prontas, ler a nota) abre lá e volta para cá.
// - Tudo o que muda aparece na hora (components/casa/acoes.ts); puxar para baixo pede ao site para recarregar a casa.
// - Abre só quando o site atende a casa nativa (Estado.recursos com 'casa'); senão o atalho abre a casa no site.
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, MARGEM, Topo } from '@/components/bancos/comum';
import { abrirCasaNoSite, useCasa } from '@/components/casa/acoes';
import { AtalhosCasa, CartaoDividas, CartaoMercado, CartaoMes, ContasDaCasa, GastosDoMes, MaisDaCasa, TopoCasa } from '@/components/casa/cartoes';
import { ListaCompras } from '@/components/casa/lista';
import { coresDaCasa, maiuscula, mesesDaLista, organizarLista, resumoDoMes } from '@/components/casa/regras';
import { Aurora, Botao, BotaoRedondo, Cartao, Chips, entradaCascata, Esqueleto, EsqueletoLista, Icone, LuzDeFundo, Recado, Texto, Vazio, comAlfa, type OpcaoChip } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { chaveMes, mesNome } from '@/lib/formato';
import { pedirSite } from '@/lib/motor';

export default function Casa() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const { estado, C, hoje } = useCasa();
  const [puxando, setPuxando] = useState(false);
  // o site ainda não mandou a casa: normalmente é questão de segundos (o arquivo dela carrega depois). Uma cópia
  // antiga do site nunca manda; depois de um tempo, aparece o caminho para abrir a casa no site
  const [demorou, setDemorou] = useState(false);
  useEffect(() => {
    if (estado !== 'sem-site') return;
    const t = setTimeout(() => setDemorou(true), 8000);
    return () => clearTimeout(t);
  }, [estado]);
  const mesAtual = chaveMes(hoje);
  const [mesEscolhido, setMes] = useState<string | null>(null); // null: o mês de agora
  // o escolhido, enquanto ele está entre os 3 do retrato (o mês pode virar com a tela aberta)
  const mesVale = mesEscolhido && mesesDaLista(hoje).includes(mesEscolhido) ? mesEscolhido : mesAtual;
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((ev) => { rolagem.set(ev.contentOffset.y); });

  const cores = useMemo(() => (C ? coresDaCasa(C, c) : {}), [C, c]);
  const mes = useMemo(() => (C ? resumoDoMes(C, mesVale) : null), [C, mesVale]);
  const agora = useMemo(() => (C ? resumoDoMes(C, mesAtual) : null), [C, mesAtual]);
  const lista = useMemo(() => (C ? organizarLista(C.compras) : null), [C]);

  const puxar = async () => {
    setPuxando(true);
    try { await pedirSite('sincronizar', null, 15_000); } catch {}
    setPuxando(false);
  };
  const entra = (i: number) => (reduzir ? undefined : entradaCascata(60 + i * 60, 380));

  let corpo;
  if (estado === 'sem-pessoal') {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="casa"
          cor={c.roxo}
          titulo="O Pessoal está desligado"
          texto="A Nossa casa fica dentro do Pessoal. Ligue nos ajustes do Avina para dividir as contas com quem mora com você."
          acao={{ titulo: 'Abrir os ajustes', icone: 'configuracoes', onPress: () => abrirNoSiteDaqui({ tela: 'ajustes' }, 'ajustes') }}
        />
      </View>
    );
  } else if (estado === 'sem-site' && demorou) {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="casa"
          cor={c.roxo}
          titulo="Nossa casa"
          texto="Dinheiro a dois ou em família: quem pagou o quê, quem deve quanto e a lista de compras."
          acao={{ titulo: 'Abrir a Nossa casa', icone: 'casa', onPress: () => abrirNoSiteDaqui({ area: 'casa' }) }}
        />
      </View>
    );
  } else if (estado === 'carregando' || estado === 'sem-site') {
    corpo = <Carregando />;
  } else if (estado === 'erro' || estado === 'indisponivel') {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="casa"
          cor={c.ambar}
          titulo="Não deu para abrir a casa agora"
          texto={estado === 'erro' ? 'Confira a internet e tente de novo. O que você já anotou está guardado.' : 'A Nossa casa não abriu nesta conta. Tente de novo daqui a pouco.'}
          acao={{ titulo: 'Tentar de novo', icone: 'atualizar', onPress: puxar }}
        />
      </View>
    );
  } else if (estado === 'sem' || !C || !mes || !agora || !lista) {
    corpo = <SemCasa />;
  } else {
    const opcoes: OpcaoChip<string>[] = mesesDaLista(hoje).map((k, i) => ({ id: k, nome: i === 0 ? 'Este mês' : maiuscula(mesNome(k)), contagem: C.gastos.filter((g) => g.data.startsWith(k)).length || undefined }));
    corpo = (
      <>
        <Animated.View entering={entra(0)}><TopoCasa C={C} cores={cores} /></Animated.View>
        <Animated.View entering={entra(1)}><CartaoDividas C={C} cores={cores} mes={agora} /></Animated.View>
        <Animated.View entering={entra(2)}><AtalhosCasa C={C} /></Animated.View>
        <Animated.View entering={entra(3)} style={{ gap: Espaco.tres }}>
          <View style={estilos.secao}>
            <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secaoTitulo}>Gastos da casa</Texto>
          </View>
          <Chips opcoes={opcoes} valor={mesVale} onTrocar={setMes} rotulo="Qual mês ver" margem={MARGEM} style={{ marginHorizontal: -MARGEM, flexGrow: 0 }} />
          <CartaoMes C={C} cores={cores} mes={mes} hoje={hoje} />
          <GastosDoMes C={C} cores={cores} mes={mes} hoje={hoje} />
        </Animated.View>
        <Animated.View entering={entra(4)}><ContasDaCasa C={C} hoje={hoje} /></Animated.View>
        <Animated.View entering={entra(5)}><ListaCompras C={C} L={lista} /></Animated.View>
        {C.mercado ? <Animated.View entering={entra(6)}><CartaoMercado C={C} /></Animated.View> : null}
        <Animated.View entering={entra(7)}><MaisDaCasa C={C} /></Animated.View>
      </>
    );
  }

  const comCasa = estado === 'ok' && !!C;
  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <Aurora altura={340} rolagem={rolagem} forca={0.55} cores={[c.roxo, c.azul, c.ciano]} />
      <LuzDeFundo />
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: ins.top + ALTURA_TOPO + Espaco.dois, paddingBottom: ins.bottom + Espaco.oito * 3, paddingHorizontal: MARGEM, gap: Espaco.seis, flexGrow: 1 }}
        refreshControl={estado !== 'sem-pessoal' ? <RefreshControl refreshing={puxando} onRefresh={puxar} tintColor={c.apoio} colors={[c.azul]} progressViewOffset={ins.top + ALTURA_TOPO} /> : undefined}>
        {corpo}
      </Animated.ScrollView>
      <Topo
        titulo="Nossa casa"
        rolagem={rolagem}
        direita={comCasa ? <BotaoRedondo icone="mais" rotulo="Anotar gasto da casa" tamanho={44} onPress={() => router.push('/casa/gasto')} /> : undefined}
      />
      {comCasa ? <Recado /> : null}
    </View>
  );
}

/* ---------- Carregando ---------- */

function Carregando() {
  return (
    <View style={{ gap: Espaco.seis }} accessible accessibilityRole="progressbar" accessibilityLabel="Abrindo a casa">
      <View style={{ gap: Espaco.tres }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Esqueleto largura={44} altura={44} raio={22} />
          <Esqueleto largura={44} altura={44} raio={22} />
        </View>
        <Esqueleto largura="40%" altura={12} />
        <Esqueleto largura="70%" altura={28} raio={10} />
        <Esqueleto largura="55%" altura={14} />
      </View>
      <Esqueleto altura={190} raio={Raio.cartao} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[0, 1, 2, 3].map((i) => <Esqueleto key={i} largura={58} altura={58} raio={29} />)}
      </View>
      <EsqueletoLista linhas={4} />
    </View>
  );
}

/* ---------- Sem casa ---------- */

const VANTAGENS = [
  { icone: 'pessoas', titulo: 'Até 5 pessoas', texto: 'Cada uma no próprio celular' },
  { icone: 'categoria', titulo: 'Divide igual ou pela renda', texto: 'E faz as contas sozinho: quem deve quanto' },
  { icone: 'carrinho', titulo: 'Contas e lista de compras', texto: 'A lista aparece na hora no celular de todos' },
  { icone: 'cadeado', titulo: 'Seus gastos continuam seus', texto: 'Só vai para a casa o que você escolher' },
] as const;

function SemCasa() {
  const c = useCores();
  return (
    <View style={estilos.centro}>
      <Vazio
        icone="casa"
        cor={c.roxo}
        titulo="As contas da casa, sem planilha"
        texto="Para quem mora junto: cada um anota o que pagou e o Avina mostra quem deve quanto."
        style={{ paddingBottom: Espaco.dois }}
      />
      <Cartao style={{ gap: Espaco.quatro }}>
        {VANTAGENS.map((v) => (
          <View key={v.titulo} style={estilos.vantagem}>
            <View style={[estilos.vantagemIcone, { backgroundColor: comAlfa(c.roxo, c.escuro ? 0.18 : 0.12) }]}>
              <Icone nome={v.icone} tamanho={18} cor={c.roxo} peso="semibold" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Texto v="forte">{v.titulo}</Texto>
              <Texto v="apoio">{v.texto}</Texto>
            </View>
          </View>
        ))}
      </Cartao>
      <Botao titulo="Criar a casa" icone="casa" largo onPress={() => abrirCasaNoSite()} rotulo="Criar a casa (abre no Avina completo)" style={{ marginTop: Espaco.cinco }} />
      <Texto v="apoio" cor={c.fraco} style={estilos.nota}>Você dá o nome da casa no Avina completo e depois chama quem mora com você.</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', paddingBottom: Espaco.oito },
  secao: { flexDirection: 'row', alignItems: 'center', minHeight: 28, paddingHorizontal: Espaco.um },
  secaoTitulo: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  vantagem: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres },
  vantagemIcone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nota: { textAlign: 'center', fontSize: 12.5, marginTop: Espaco.tres, paddingHorizontal: Espaco.quatro },
});
