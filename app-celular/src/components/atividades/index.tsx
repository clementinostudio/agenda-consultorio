// A aba Atividades (dentro da casca do Início, src/app/index.tsx): todos os lançamentos do Pessoal, agrupados por dia.
// - Topo: o olho (esconder valores) e o "+" (anotar); o título grande encolhe para a barra de cima ao rolar, e a
//   barra ganha o vidro.
// - Busca em pílula e chips de filtro (Filtros abre a folha com período, tipo e categorias; Entradas; Saídas; as
//   categorias com a contagem).
// - Lista grande e leve: FlatList com altura fixa por linha (getItemLayout) e só o que está perto da tela montado.
// - Toque abre o detalhe (/lancamento/[id]); tocar e segurar abre o menu (Editar no site, Apagar).
// - Puxar para baixo sincroniza com a nuvem (o mesmo que o site faz quando o app volta para a frente).
// visivel: a aba está na tela agora; aoRolar: a casca usa para esconder a pílula "Pergunte à Bolinha".
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useRef, useState, type ReactElement } from 'react';
import { Keyboard, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type FlatList, type ListRenderItem, type TextInputInstance } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { apagarLancamento, editarNoSite, normalizarBusca } from '@/components/atividades/acoes';
import { FILTRO_VAZIO, FiltrosConteudo, noPeriodo, quantosFiltros, type Filtro } from '@/components/atividades/filtros';
import { Folha } from '@/components/atividades/folha';
import { CabecalhoDia, LinhaLanc, MARGEM, useAlturas, type Retangulo } from '@/components/atividades/linha';
import { MenuLanc, type AlvoMenu } from '@/components/atividades/menu';
import { Icone } from '@/components/icone';
import { Botao, BotaoRedondo, Chip, comAlfa, EsqueletoLista, Mascote, Tocavel, useSemTransparencia, vibrar, Vazio } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { agruparPorDia, dinheiro, hojeIso, numero, somarDias } from '@/lib/formato';
import { abrirNoSite, alternarOculto, pedirSite, useEstado, useOculto, type Categoria, type Lanc } from '@/lib/motor';

const BARRA = 52; // a barra de cima (olho, título pequeno e "+"), sem a área da câmera
const IOS = Platform.OS === 'ios';
// no iPhone, o desfoque aparece aumentando a intensidade (o efeito do sistema não aceita ficar meio transparente)
const DesfoqueAnimado = Animated.createAnimatedComponent(BlurView);

type Item =
  | { k: string; t: 'dia'; data: string; saiu: number; entrou: number }
  | { k: string; t: 'l'; l: Lanc };

// O texto em que a busca procura (descrição, categoria, banco, observação e o valor), guardado por lançamento
const textoBusca = new WeakMap<Lanc, string>();
function combina(l: Lanc, q: string, cats: Map<string, Categoria>) {
  let t = textoBusca.get(l);
  if (t === undefined) {
    t = normalizarBusca([l.desc, cats.get(l.cat)?.nome, l.banco, l.obs, numero(l.valor, 2), l.moeda].filter(Boolean).join(' · '));
    textoBusca.set(l, t);
  }
  return t.includes(q);
}

export function Atividades({ visivel, aoRolar }: { visivel: boolean; aoRolar?: (y: number) => void }) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const estado = useEstado();
  const oculto = useOculto();
  const alt = useAlturas();
  const semTransp = useSemTransparencia();

  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca);
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VAZIO);
  const [folha, setFolha] = useState(false);
  const [menu, setMenu] = useState<AlvoMenu | null>(null);
  const [apagados, setApagados] = useState<ReadonlySet<string>>(() => new Set());
  const [atualizando, setAtualizando] = useState(false);
  const [alturaTopo, setAlturaTopo] = useState(0);
  const lista = useRef<FlatList<Item>>(null);
  const y = useSharedValue(0);

  const P = estado?.pessoal ?? null;
  const categorias = useMemo(() => estado?.categorias ?? [], [estado?.categorias]);
  const catEntrada = useMemo(() => estado?.catEntrada ?? [], [estado?.catEntrada]);
  const cats = useMemo(() => new Map([...categorias, ...catEntrada].map((k) => [k.id, k])), [categorias, catEntrada]);
  const hoje = hojeIso();
  const nFiltros = quantosFiltros(filtro);
  const q = normalizarBusca(buscaAdiada);
  const filtrando = nFiltros > 0 || !!q;

  // período, tipo e busca (a base das contagens dos chips de categoria)
  const base = useMemo(() => {
    if (!P) return [];
    return P.lanc.filter((l) => !apagados.has(l.id)
      && (filtro.tipo === 'todos' || l.tipo === filtro.tipo)
      && noPeriodo(l.data, filtro.periodo, hoje)
      && (!q || combina(l, q, cats)));
  }, [P, apagados, filtro.tipo, filtro.periodo, hoje, q, cats]);
  const contagem = useMemo(() => {
    const r: Record<string, number> = {};
    for (const l of base) r[l.cat] = (r[l.cat] || 0) + 1;
    return r;
  }, [base]);
  const visiveis = useMemo(() => (filtro.cats.length ? base.filter((l) => filtro.cats.includes(l.cat)) : base), [base, filtro.cats]);
  // os chips de categoria: as que aparecem, da mais usada para a menos (e as escolhidas, mesmo sem nada)
  const chipsCat = useMemo(() => [...cats.values()]
    .filter((k) => (contagem[k.id] ?? 0) > 0 || filtro.cats.includes(k.id))
    .sort((a, b) => (contagem[b.id] ?? 0) - (contagem[a.id] ?? 0)), [cats, contagem, filtro.cats]);

  // a lista: o título de cada dia e os lançamentos, com a posição de cada linha já calculada
  const { itens, posicao, totais } = useMemo(() => {
    const itens: Item[] = [];
    const posicao: { o: number; h: number }[] = [];
    let o = 0, saiu = 0, entrou = 0;
    for (const g of agruparPorDia(visiveis)) {
      itens.push({ k: `d${g.data}`, t: 'dia', data: g.data, saiu: g.saiu, entrou: g.entrou });
      posicao.push({ o, h: alt.dia }); o += alt.dia;
      saiu += g.saiu; entrou += g.entrou;
      for (const l of g.itens) { itens.push({ k: l.id, t: 'l', l }); posicao.push({ o, h: alt.linha }); o += alt.linha; }
    }
    return { itens, posicao, totais: { saiu, entrou } };
  }, [visiveis, alt.dia, alt.linha]);

  const getItemLayout = useCallback((_: unknown, i: number) => {
    const p = posicao[i] ?? { o: 0, h: alt.linha };
    return { length: p.h, offset: alturaTopo + p.o, index: i };
  }, [posicao, alturaTopo, alt.linha]);

  /* ---------- Ações ---------- */

  const abrir = useCallback((l: Lanc) => {
    Keyboard.dismiss();
    router.push({ pathname: '/lancamento/[id]', params: { id: l.id } });
  }, []);
  const segurar = useCallback((l: Lanc, onde: Retangulo) => {
    vibrar('firme');
    Keyboard.dismiss();
    setMenu({ l, cat: cats.get(l.cat) ?? null, onde });
  }, [cats]);
  const editar = useCallback((l: Lanc) => { editarNoSite(l.id); }, []);
  const apagar = useCallback((l: Lanc) => {
    apagarLancamento(l).then((ok) => { if (ok) setApagados((s) => new Set(s).add(l.id)); });
  }, []);
  const limpar = () => { setBusca(''); setFiltro(FILTRO_VAZIO); };
  const atualizar = () => {
    setAtualizando(true);
    pedirSite('sincronizar', null, 20_000).catch(() => {}).finally(() => setAtualizando(false));
  };
  const alternarTipo = (t: 'saida' | 'entrada') => {
    const tipo = filtro.tipo === t ? 'todos' : t;
    // as categorias que não são do tipo novo saem do filtro
    setFiltro({ ...filtro, tipo, cats: tipo === 'todos' ? filtro.cats : filtro.cats.filter((id) => (tipo === 'entrada' ? catEntrada : categorias).some((k) => k.id === id)) });
  };
  const alternarCat = (id: string) => setFiltro({ ...filtro, cats: filtro.cats.includes(id) ? filtro.cats.filter((x) => x !== id) : [...filtro.cats, id] });

  /* ---------- Rolagem: o título grande vai para a barra e a barra ganha o vidro ---------- */

  const rolar = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
      if (aoRolar) scheduleOnRN(aoRolar, e.contentOffset.y);
    },
  }, [aoRolar]);
  const tituloGrande = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, 34], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.get(), [-160, 0], [1.12, 1], Extrapolation.CLAMP) }],
  }));
  const tituloPequeno = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [30, 54], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.get(), [30, 54], [6, 0], Extrapolation.CLAMP) }],
  }));
  const fundoBarra = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [6, 46], [0, 1], Extrapolation.CLAMP) }));
  const desfoque = useAnimatedProps(() => ({ intensity: interpolate(y.get(), [6, 46], [0, 90], Extrapolation.CLAMP) }));

  /* ---------- As partes ---------- */

  const renderItem: ListRenderItem<Item> = useCallback(({ item }) => (item.t === 'dia'
    ? <CabecalhoDia data={item.data} saiu={item.saiu} entrou={item.entrou} oculto={oculto} altura={alt.dia} />
    : <LinhaLanc l={item.l} cat={cats.get(item.l.cat) ?? null} oculto={oculto} altura={alt.linha} aoAbrir={abrir} aoSegurar={segurar} aoEditar={editar} aoApagar={apagar} />
  ), [oculto, alt.dia, alt.linha, cats, abrir, segurar, editar, apagar]);

  const temLanc = !!P && P.lanc.length > 0;
  const topo = (
    <View onLayout={(e) => setAlturaTopo(Math.round(e.nativeEvent.layout.height))} style={{ paddingTop: ins.top + BARRA }}>
      <Animated.Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[estilos.tituloGrande, { color: c.texto }, tituloGrande]}>Atividades</Animated.Text>
      {temLanc ? (
        <>
          <Busca valor={busca} onTrocar={setBusca} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.chips} style={estilos.chipsRolagem}>
            <Chip titulo="Filtros" icone="filtro" papel="button" ativo={nFiltros > 0} contagem={nFiltros || undefined} onPress={() => { Keyboard.dismiss(); setFolha(true); }} />
            <Chip titulo="Entradas" papel="checkbox" ativo={filtro.tipo === 'entrada'} onPress={() => alternarTipo('entrada')} />
            <Chip titulo="Saídas" papel="checkbox" ativo={filtro.tipo === 'saida'} onPress={() => alternarTipo('saida')} />
            {chipsCat.map((k) => (
              <Chip
                key={k.id}
                titulo={k.nome}
                papel="checkbox"
                ativo={filtro.cats.includes(k.id)}
                contagem={contagem[k.id] ?? 0}
                esquerda={<View style={[estilos.bolinha, { backgroundColor: k.cor }]} />}
                onPress={() => alternarCat(k.id)}
              />
            ))}
          </ScrollView>
          {filtrando && visiveis.length ? (
            <View style={[estilos.resumo, { backgroundColor: c.cartao, borderColor: c.linha }]} accessible accessibilityLabel={`${visiveis.length} lançamentos${oculto ? '' : `, saíram ${dinheiro(totais.saiu)}, entraram ${dinheiro(totais.entrou)}`}`}>
              <Text maxFontSizeMultiplier={1.3} style={[estilos.resumoTexto, { color: c.apoio, flex: 1 }]}>
                {visiveis.length === 1 ? '1 lançamento' : `${visiveis.length} lançamentos`}
              </Text>
              {oculto ? null : (
                <>
                  {totais.entrou > 0 ? <Text maxFontSizeMultiplier={1.3} style={[estilos.resumoValor, { color: c.positivo }]}>{dinheiro(totais.entrou, { sinal: true })}</Text> : null}
                  {totais.saiu > 0 ? <Text maxFontSizeMultiplier={1.3} style={[estilos.resumoValor, { color: c.texto }]}>{dinheiro(-totais.saiu)}</Text> : null}
                </>
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  let vazio: ReactElement | undefined;
  if (!estado) {
    vazio = <View style={{ paddingHorizontal: MARGEM, paddingTop: 28 }}><EsqueletoLista linhas={6} /></View>;
  } else if (!P) {
    vazio = (
      <Vazio
        icone="carteira"
        titulo="O Pessoal está desligado"
        texto="Ligue o Pessoal no seu Perfil do Avina para anotar gastos e ver suas atividades aqui."
        acao={{ titulo: 'Abrir o Perfil', onPress: () => { abrirNoSite({ tela: 'ajustes' }, 'ajustes'); } }}
        style={estilos.vazio}
      />
    );
  } else if (!temLanc) {
    vazio = (
      <View style={estilos.vazio}>
        <Vazio
          ilustracao={<Mascote tamanho={76} estado="feliz" />}
          titulo="Suas atividades aparecem aqui"
          texto={estado.bancoLigado
            ? 'Anote um gasto ou uma entrada e ele aparece na hora. Com o banco conectado, as compras chegam sozinhas.'
            : 'Anote um gasto ou uma entrada e ele aparece na hora, agrupado por dia.'}
          acao={{ titulo: 'Anotar agora', icone: 'mais', onPress: () => router.push('/novo') }}
        />
        {estado.bancoLigado ? <Botao titulo="Conectar meu banco" variante="texto" icone="banco" onPress={() => router.push('/bancos')} style={{ alignSelf: 'center', marginTop: -8 }} /> : null}
      </View>
    );
  } else if (!visiveis.length) {
    vazio = (
      <Vazio
        icone="busca"
        titulo="Nada encontrado"
        texto={q ? `Nenhum lançamento com "${buscaAdiada.trim()}"${nFiltros ? ' nesses filtros' : ''}.` : 'Nenhum lançamento nesses filtros.'}
        acao={{ titulo: q && nFiltros ? 'Limpar busca e filtros' : q ? 'Limpar a busca' : 'Limpar os filtros', onPress: limpar }}
        style={estilos.vazio}
      />
    );
  }

  // no fim da lista: os mais antigos (o retrato traz os últimos 400 dias) ficam no Avina completo
  const maisAntigo = P?.lanc.length ? P.lanc[P.lanc.length - 1].data : null;
  const rodape = (
    <View style={{ paddingBottom: ins.bottom + 120 }}>
      {!filtrando && maisAntigo && maisAntigo <= somarDias(hoje, -300) && itens.length ? (
        <View style={estilos.fim}>
          <Text maxFontSizeMultiplier={1.3} style={[estilos.fimTexto, { color: c.fraco }]}>Aqui ficam os últimos 13 meses.</Text>
          <Botao titulo="Ver os mais antigos no Avina" variante="texto" tamanho="pequeno" onPress={() => { abrirNoSite({ area: 'pessoal', tela: 'gastos' }); }} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={[estilos.tela, { backgroundColor: c.fundo }]}
      accessibilityElementsHidden={!visivel}
      importantForAccessibility={visivel ? 'auto' : 'no-hide-descendants'}>
      <Animated.FlatList
        ref={lista}
        data={estado && temLanc ? itens : []}
        keyExtractor={(it) => it.k}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        extraData={oculto}
        ListHeaderComponent={topo}
        ListEmptyComponent={vazio}
        ListFooterComponent={rodape}
        onScroll={rolar}
        scrollEventThrottle={16}
        scrollsToTop={visivel}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        maxToRenderPerBatch={16}
        updateCellsBatchingPeriod={40}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        refreshControl={P ? (
          <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={c.apoio} colors={[c.azul]} progressBackgroundColor={c.cartao2} progressViewOffset={ins.top + BARRA} />
        ) : undefined}
      />

      {/* a barra de cima: transparente no topo; com vidro (ou fundo quase sólido) depois de rolar */}
      <View style={[estilos.barra, { paddingTop: ins.top, height: ins.top + BARRA }]} pointerEvents="box-none">
        {IOS && !semTransp ? (
          <DesfoqueAnimado pointerEvents="none" tint={c.escuro ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} animatedProps={desfoque} style={StyleSheet.absoluteFill} />
        ) : (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: comAlfa(c.fundo, 0.96) }, fundoBarra]} />
        )}
        <Animated.View pointerEvents="none" style={[estilos.barraLinha, { backgroundColor: c.linha }, fundoBarra]} />
        <View style={estilos.barraDentro} pointerEvents="box-none">
          <BotaoRedondo icone={oculto ? 'olhoFechado' : 'olho'} rotulo={oculto ? 'Mostrar os valores' : 'Esconder os valores'} tamanho={44} onPress={alternarOculto} />
          <Animated.View style={[estilos.tituloPequenoCaixa, tituloPequeno]}>
            <Pressable
              onPress={() => lista.current?.scrollToOffset({ offset: 0, animated: true })}
              accessibilityRole="button"
              accessibilityLabel="Voltar ao topo das atividades"
              hitSlop={8}>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.tituloPequeno, { color: c.texto }]}>Atividades</Text>
            </Pressable>
          </Animated.View>
          <BotaoRedondo icone="mais" rotulo="Anotar gasto ou entrada" variante="azul" tamanho={44} onPress={() => { Keyboard.dismiss(); router.push('/novo'); }} />
        </View>
      </View>

      <Folha
        visivel={folha}
        aoFechar={() => setFolha(false)}
        titulo="Filtros"
        direita={nFiltros ? <Botao titulo="Limpar" variante="texto" tamanho="pequeno" onPress={() => setFiltro(FILTRO_VAZIO)} /> : null}>
        <FiltrosConteudo
          filtro={filtro}
          onTrocar={setFiltro}
          categorias={categorias}
          catEntrada={catEntrada}
          contagem={contagem}
          total={visiveis.length}
          aoFechar={() => setFolha(false)}
        />
      </Folha>

      <MenuLanc alvo={menu} oculto={oculto} aoFechar={() => setMenu(null)} aoAbrir={abrir} aoEditar={editar} aoApagar={apagar} />
    </View>
  );
}

// A busca em pílula: tocar em qualquer lugar dela põe o cursor no campo; o "x" limpa
function Busca({ valor, onTrocar }: { valor: string; onTrocar: (v: string) => void }) {
  const c = useCores();
  const campo = useRef<TextInputInstance>(null);
  return (
    <Pressable
      onPress={() => campo.current?.focus()}
      accessible={false}
      style={[estilos.busca, { backgroundColor: c.cartao, borderColor: c.linhaForte }, !c.escuro && { boxShadow: `0px 2px 10px ${comAlfa(c.sombra, 0.05)}` }]}>
      <Icone nome="busca" tamanho={18} cor={c.apoio} peso="semibold" />
      <TextInput
        ref={campo}
        value={valor}
        onChangeText={onTrocar}
        placeholder="Buscar"
        placeholderTextColor={c.apoio}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        enterKeyHint="search"
        selectionColor={c.azul}
        cursorColor={c.azul}
        maxFontSizeMultiplier={1.3}
        accessibilityLabel="Buscar nas atividades"
        style={[estilos.buscaCampo, { color: c.texto }]}
      />
      {valor ? (
        <Tocavel onPress={() => onTrocar('')} hitSlop={12} escala={0.9} accessibilityLabel="Limpar a busca" style={[estilos.limpar, { backgroundColor: c.cartao3 }]}>
          <Icone nome="fechar" tamanho={10} cor={c.texto} peso="bold" />
        </Tocavel>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  tituloGrande: { fontFamily: Fontes.tituloForte, fontSize: 34, lineHeight: 42, letterSpacing: -1, paddingHorizontal: MARGEM, marginTop: 6, transformOrigin: 'left center' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginTop: 16, marginHorizontal: MARGEM, paddingLeft: 16, paddingRight: 12, borderRadius: Raio.pilula, borderCurve: 'continuous', borderWidth: 1 },
  buscaCampo: { flex: 1, height: 46, fontFamily: Fontes.texto, fontSize: 16, padding: 0, outlineWidth: 0 },
  limpar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipsRolagem: { marginTop: 14, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: MARGEM },
  bolinha: { width: 9, height: 9, borderRadius: 5, marginLeft: -2 },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginHorizontal: MARGEM, paddingHorizontal: 16, minHeight: 46, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  resumoTexto: { fontFamily: Fontes.textoForte, fontSize: 13.5, lineHeight: 18 },
  resumoValor: { fontFamily: Fontes.numero, fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
  vazio: { paddingTop: 36 },
  fim: { alignItems: 'center', gap: 2, paddingTop: 28 },
  fimTexto: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  barra: { position: 'absolute', top: 0, left: 0, right: 0 },
  barraLinha: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  barraDentro: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  tituloPequenoCaixa: { position: 'absolute', left: 80, right: 80, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  tituloPequeno: { fontFamily: Fontes.tituloForte, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
});
