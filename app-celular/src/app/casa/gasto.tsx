// Anotar um gasto da casa (folha que sobe de baixo; ?id= abre um gasto para ver e mudar), como o Anotar:
// - o valor grande no teclado próprio; o que foi (reconhece a empresa: a logo e a categoria dela);
// - quem pagou e entre quem dividir (com a parte de cada um na hora, pela divisão da casa);
// - a categoria e o dia (tocar abre a grade ou os dias no lugar do teclado).
// Salvar fecha na hora: o gasto aparece na casa e o site confirma por trás (components/casa/acoes.ts). Num gasto que já
// existe, a lixeira apaga (para todos) e a nota do mercado, quando há, abre no Avina completo.
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dataCurtaLista, normalizarBusca } from '@/components/atividades/acoes';
import { Teclado, Visor, falarValor, teclar, valorDoTexto, type Tecla } from '@/components/atividades/teclado';
import { abrirCasaNoSite, anotarGasto, apagarGasto, querApagarGasto, useCasa } from '@/components/casa/acoes';
import { EscolherDia, FileiraPessoas, GradeCategorias, MARGEM_FOLHA as MARGEM } from '@/components/casa/folha';
import { coresDaCasa, nomeDe, partesDoGasto } from '@/components/casa/regras';
import { Botao, BotaoRedondo, Chip, Esqueleto, Icone, IconeCategoria, Logo, Tocavel, Vazio, comAlfa, vibrar } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { dataCurta, dinheiro, hojeIso, somarDias } from '@/lib/formato';
import { useEstado, type Categoria } from '@/lib/motor';
import { acharMarca, buscarMarcas } from '@site/marcas.js';

type Marca = { id: string; nome: string; site: string; cat: string };
type Painel = 'teclado' | 'categoria' | 'data';

const textoDoValor = (v: number) => (v > 0 ? v.toFixed(2).replace('.', ',').replace(/,00$/, '') : '');

// O teclado do sistema (na descrição): quanto ele cobre da folha (medido na janela: a folha não começa no topo)
function useTecladoDoSistema(raiz: RefObject<ComponentRef<typeof View> | null>) {
  const [estado, setEstado] = useState({ aberto: false, cobre: 0 });
  useEffect(() => {
    const medir = (topo: number) => {
      const v = raiz.current;
      if (!v) { setEstado({ aberto: true, cobre: 0 }); return; }
      v.measureInWindow((_x, y, _w, h) => setEstado({ aberto: true, cobre: Math.max(0, y + h - topo) }));
    };
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => medir(e.endCoordinates.screenY)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setEstado({ aberto: false, cobre: 0 })),
    ];
    if (ios) subs.push(Keyboard.addListener('keyboardDidShow', (e) => medir(e.endCoordinates.screenY)));
    return () => subs.forEach((s) => s.remove());
  }, [raiz]);
  return estado;
}

export default function GastoDaCasa() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const estado = useEstado();
  const { C } = useCasa();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const antes = id && C ? C.gastos.find((g) => g.id === id) : undefined;
  const raiz = useRef<ComponentRef<typeof View>>(null);
  const campo = useRef<TextInputInstance>(null);
  const teclado = useTecladoDoSistema(raiz);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => campo.current?.blur());
    return () => sub.remove();
  }, []);

  const [txt, setTxt] = useState(() => (antes ? textoDoValor(antes.valor) : ''));
  const [tremor, setTremor] = useState(0);
  const [intocado, setIntocado] = useState(!!antes); // num gasto que já existe, a primeira tecla começa um valor novo
  const [desc, setDesc] = useState(antes?.desc ?? '');
  const [catEscolhida, setCatEscolhida] = useState<string | null>(antes?.cat ?? null);
  const [data, setData] = useState(antes?.data ?? hojeIso());
  const [pagou, setPagou] = useState(antes?.pagou ?? C?.eu ?? '');
  const [parts, setParts] = useState<string[]>(antes?.participantes ?? C?.membros.map((m) => m.id) ?? []);
  const [painel, setPainel] = useState<Painel>('teclado');
  const [focoDesc, setFocoDesc] = useState(false);
  const [alturaFolha, setAlturaFolha] = useState(0);
  const [alturaPainel, setAlturaPainel] = useState(0);

  const cores = useMemo(() => (C ? coresDaCasa(C, c) : {}), [C, c]);
  const lista: Categoria[] = useMemo(() => estado?.categorias ?? [], [estado?.categorias]);
  const marca = useMemo(() => (desc.trim().length >= 2 ? (acharMarca(desc) as Marca | null) : null), [desc]);
  const catAuto = marca && lista.some((k) => k.id === marca.cat) ? marca.cat : null;
  const catId = catEscolhida ?? catAuto ?? 'mercado';
  const cat = lista.find((k) => k.id === catId) ?? null;
  const sugestoes = useMemo(() => {
    if (!focoDesc || desc.trim().length < 2) return [];
    const q = normalizarBusca(desc);
    return (buscarMarcas(desc, 4) as { m: Marca }[]).map((r) => r.m).filter((m) => normalizarBusca(m.nome) !== q);
  }, [desc, focoDesc]);
  const valor = valorDoTexto(txt);

  const fechar = () => { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/casa'); };

  if (!C) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: ins.bottom + 12 }]}>
        <StatusBar style={c.escuro ? 'light' : 'dark'} />
        <View style={estilos.topo}><BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={fechar} /></View>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
          <Esqueleto largura={180} altura={52} raio={14} />
          <Esqueleto largura="80%" altura={48} raio={24} />
        </View>
      </View>
    );
  }
  if (id && !antes) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, justifyContent: 'center' }]}>
        <StatusBar style={c.escuro ? 'light' : 'dark'} />
        <Vazio icone="casa" cor={c.roxo} titulo="Este gasto não está mais aqui" texto="Ele pode ter sido apagado em outro celular da casa." acao={{ titulo: 'Fechar', onPress: fechar }} />
      </View>
    );
  }

  const sozinho = C.membros.length < 2;
  const hoje = hojeIso();
  const ontem = somarDias(hoje, -1);
  const outroDia = data !== hoje && data !== ontem;
  const baixa = alturaFolha > 0 && alturaFolha < 700;
  const alturaTecla = alturaPainel ? Math.max(38, Math.min(56, Math.floor((alturaPainel - 18) / 4))) : 50;
  const comTeclado = teclado.aberto || focoDesc;
  const partsOk = sozinho ? [C.eu] : parts;
  const pode = valor > 0 && partsOk.length > 0;

  // a parte de cada um, na hora (pela divisão da casa, ou pelos pesos do próprio gasto)
  const nome = (p: string) => nomeDe(C, p);
  let previa = '';
  if (!sozinho) {
    if (!parts.length) previa = 'Escolha entre quem dividir';
    else if (parts.length === 1 && parts[0] === pagou) previa = 'Ninguém fica devendo: o gasto só aparece para a casa.';
    else if (parts.length === 1) previa = `${nome(parts[0])} fica com tudo${valor > 0 ? `: ${dinheiro(valor)}` : ''}.`;
    else if (valor > 0) {
      const ps = partesDoGasto(C, valor, parts, antes);
      previa = `${C.divisao.modo === 'proporcional' ? 'Pela divisão da casa' : 'Igual'}: ${parts.map((p) => `${nome(p)} ${dinheiro(ps[p] ?? 0)}`).join(' · ')}`;
    } else previa = C.divisao.modo === 'proporcional' ? 'Dividido pela porcentagem de cada um' : `Dividido igual entre ${parts.length}`;
  }

  const aoTeclar = (t: Tecla) => {
    const n = teclar(intocado && t !== 'apagar' ? '' : txt, t);
    setIntocado(false);
    if (n === null) { if (t !== 'apagar') { vibrar('aviso'); setTremor((x) => x + 1); } return; }
    setTxt(n);
  };
  const abrirPainel = (p: Painel) => {
    Keyboard.dismiss();
    campo.current?.blur();
    setPainel((atual) => (atual === p && p !== 'teclado' ? 'teclado' : p));
  };
  const escolherMarca = (m: Marca) => { setDesc(m.nome); vibrar('toque'); Keyboard.dismiss(); campo.current?.blur(); };
  const alternarParte = (p: string) => setParts((s) => (s.includes(p) ? s.filter((x) => x !== p) : C.membros.map((m) => m.id).filter((x) => x === p || s.includes(x))));

  const salvar = () => {
    if (!pode) { vibrar('aviso'); setTremor((x) => x + 1); return; }
    const d = (marca && normalizarBusca(desc) === normalizarBusca(marca.nome) ? marca.nome : desc.trim()) || cat?.nome || 'Gasto da casa';
    anotarGasto(C, { valor: Math.round(valor * 100) / 100, desc: d, cat: catId, data, pagou: sozinho ? C.eu : pagou, participantes: partsOk }, antes);
    fechar();
  };
  const apagar = async () => {
    if (!antes || !(await querApagarGasto())) return;
    fechar();
    apagarGasto(antes, { perguntar: false });
  };

  const fundoCampo = c.escuro ? c.cartao : c.cartao2;
  const titulo = antes ? 'Gasto da casa' : 'Anotar gasto da casa';
  const sub = antes ? `${nomeDe(C, antes.autor ?? antes.pagou)} anotou · ${dataCurta(antes.data)}` : C.nome;

  return (
    <View
      ref={raiz}
      collapsable={false}
      onLayout={(e) => setAlturaFolha(Math.round(e.nativeEvent.layout.height))}
      style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: teclado.aberto ? teclado.cobre + 10 : Math.max(ins.bottom, 12) + 8 }]}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />

      <View style={[estilos.topo, baixa && { paddingTop: 12 }]}>
        <BotaoRedondo icone="fechar" rotulo="Fechar sem salvar" variante="solido" tamanho={36} onPress={fechar} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.titulo, { color: c.texto }]}>{titulo}</Text>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.sub, { color: c.apoio }]}>{sub}</Text>
        </View>
        {antes ? <BotaoRedondo icone="lixo" rotulo="Apagar este gasto da casa" variante="solido" tamanho={36} cor={c.negativo} onPress={apagar} /> : <View style={{ width: 36 }} />}
      </View>

      {/* o valor (tocar volta para o teclado do valor) */}
      <Pressable
        onPress={() => abrirPainel('teclado')}
        accessibilityRole="button"
        accessibilityLabel={`Valor: ${falarValor(txt)}`}
        style={[estilos.visorArea, baixa && { minHeight: 60, paddingVertical: 4 }]}>
        {!teclado.aberto && !baixa ? <Text maxFontSizeMultiplier={1.3} style={[estilos.pergunta, { color: c.apoio }]}>Quanto foi?</Text> : null}
        <Visor txt={txt} cor={c.texto} ativo={painel === 'teclado' && !comTeclado} tremor={tremor} compacto={teclado.aberto || baixa} />
      </Pressable>

      {/* o que foi, com a logo da empresa quando reconhece */}
      <View style={[estilos.campo, { backgroundColor: fundoCampo, borderColor: focoDesc ? comAlfa(c.azul, 0.6) : c.linha }]}>
        {marca ? (
          <Animated.View key={marca.id} entering={FadeIn.duration(200)}><Logo marca={marca.id} nome={marca.nome} tamanho={30} /></Animated.View>
        ) : cat ? <IconeCategoria cat={cat} tamanho={30} /> : null}
        <TextInput
          ref={campo}
          value={desc}
          onChangeText={setDesc}
          onFocus={() => setFocoDesc(true)}
          onBlur={() => setFocoDesc(false)}
          placeholder="O que foi (ex.: Mercado, Gás, Pizza)"
          placeholderTextColor={c.apoio}
          maxLength={80}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          autoCapitalize="sentences"
          selectionColor={c.azul}
          cursorColor={c.azul}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="O que foi"
          style={[estilos.campoTexto, { color: c.texto }]}
        />
        {desc ? (
          <Tocavel onPress={() => setDesc('')} hitSlop={12} escala={0.9} accessibilityLabel="Limpar o que foi" style={[estilos.limpar, { backgroundColor: c.cartao3 }]}>
            <Icone nome="fechar" tamanho={10} cor={c.texto} peso="bold" />
          </Tocavel>
        ) : null}
      </View>

      {sugestoes.length ? (
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={estilos.faixa} contentContainerStyle={estilos.faixaDentro}>
          {sugestoes.map((m) => (
            <Chip key={m.id} titulo={m.nome} papel="button" esquerda={<Logo marca={m.id} nome={m.nome} tamanho={24} style={{ marginLeft: -8 }} />} onPress={() => escolherMarca(m)} />
          ))}
        </ScrollView>
      ) : null}

      {/* quem pagou e entre quem dividir */}
      {!sozinho && !comTeclado ? (
        <View style={[estilos.pessoas, baixa && { marginTop: 8, gap: 6 }]}>
          <FileiraPessoas C={C} cores={cores} rotulo="Pagou" escolhidos={[pagou]} aoTocar={setPagou} radio />
          <FileiraPessoas C={C} cores={cores} rotulo="Dividir" escolhidos={parts} aoTocar={alternarParte} />
          <Text numberOfLines={2} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite" style={[estilos.previa, { color: parts.length ? c.apoio : c.ambar }]}>{previa}</Text>
        </View>
      ) : null}

      {/* categoria e dia */}
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={[estilos.faixa, baixa && { marginTop: 6 }]} contentContainerStyle={estilos.faixaDentro}>
        <Tocavel
          onPress={() => abrirPainel('categoria')}
          escala={0.95}
          accessibilityLabel={cat ? `Categoria: ${cat.nome}` : 'Escolher a categoria'}
          accessibilityState={{ expanded: painel === 'categoria' }}
          style={[estilos.chipCat, { backgroundColor: c.cartao, borderColor: painel === 'categoria' ? c.azul : cat ? comAlfa(cat.cor, 0.55) : c.linhaForte }]}>
          {cat ? <IconeCategoria cat={cat} tamanho={26} /> : <Icone nome="categoria" tamanho={16} cor={c.apoio} />}
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.chipTexto, { color: c.texto }]}>{cat ? cat.nome : 'Categoria'}</Text>
          <Icone nome="chevronBaixo" tamanho={11} cor={c.apoio} peso="bold" />
        </Tocavel>
        <View style={[estilos.divisor, { backgroundColor: c.linhaForte }]} />
        {/* um dia escolhido fora de hoje e ontem vem antes deles (à vista, sem rolar) */}
        {outroDia ? <Chip titulo={dataCurtaLista(data)} icone="calendario" ativo papel="button" onPress={() => abrirPainel('data')} /> : null}
        <Chip titulo="Hoje" ativo={data === hoje} onPress={() => { setData(hoje); setPainel('teclado'); }} />
        <Chip titulo="Ontem" ativo={data === ontem} onPress={() => { setData(ontem); setPainel('teclado'); }} />
        {!outroDia ? <Chip titulo="Outro dia" icone="calendario" papel="button" onPress={() => abrirPainel('data')} /> : null}
      </ScrollView>

      {/* a nota do mercado deste gasto (os itens e a foto ficam no Avina completo) */}
      {antes?.nota && !comTeclado ? (
        <Tocavel onPress={() => { fechar(); abrirCasaNoSite('casa-nota-ver', antes.id); }} escala={0.98} accessibilityLabel={`Ver a nota de ${antes.nota.loja}, ${antes.nota.itens} itens (abre no Avina completo)`} style={[estilos.nota, { borderColor: c.linha, backgroundColor: fundoCampo }]}>
          <Icone nome="recibo" tamanho={16} cor={c.azulTinta} peso="semibold" />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.notaTexto, { color: c.texto }]}>Nota de {antes.nota.loja} · {antes.nota.itens} itens</Text>
          <Text maxFontSizeMultiplier={1.3} style={[estilos.notaVer, { color: c.azulTinta }]}>Ver</Text>
        </Tocavel>
      ) : null}

      {/* o painel de baixo: o teclado do valor, a grade de categorias ou os dias (some com o teclado do sistema) */}
      {!comTeclado ? (
        <View onLayout={(e) => setAlturaPainel(Math.round(e.nativeEvent.layout.height))} style={[estilos.painel, baixa && { marginTop: 8 }]}>
          {painel === 'teclado' ? (
            <Animated.View key="teclado" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
              <Teclado altura={alturaTecla} aoTeclar={aoTeclar} aoLimpar={() => { if (txt) { vibrar('firme'); setTxt(''); } }} />
            </Animated.View>
          ) : painel === 'categoria' ? (
            <Animated.View key="categoria" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <GradeCategorias lista={lista} escolhida={catId} aoEscolher={(k) => { setCatEscolhida(k); setPainel('teclado'); }} />
            </Animated.View>
          ) : (
            <Animated.View key="data" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <EscolherDia data={data} aoEscolher={(d) => { setData(d); setPainel('teclado'); }} />
            </Animated.View>
          )}
        </View>
      ) : <View style={{ flex: 1 }} />}

      <View style={[estilos.rodape, baixa && { paddingTop: 8 }]}>
        <Botao
          titulo={antes ? 'Salvar' : valor > 0 ? `Anotar ${dinheiro(valor)}` : 'Anotar gasto da casa'}
          icone={antes ? 'check' : undefined}
          onPress={salvar}
          desativado={!pode}
          vibra={false}
          largo
          rotulo={pode ? `${antes ? 'Salvar' : 'Anotar'} gasto da casa de ${falarValor(txt)}` : valor > 0 ? 'Escolha entre quem dividir' : 'Anotar (digite o valor primeiro)'}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 18, minHeight: 62 },
  titulo: { fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  sub: { fontFamily: Fontes.texto, fontSize: 12.5, lineHeight: 16 },
  visorArea: { flex: 1, minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: MARGEM },
  pergunta: { fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, marginHorizontal: MARGEM, paddingLeft: 12, paddingRight: 14, borderRadius: Raio.pilula, borderCurve: 'continuous', borderWidth: 1 },
  campoTexto: { flex: 1, height: 50, fontFamily: Fontes.textoForte, fontSize: 16, padding: 0, outlineWidth: 0 },
  limpar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pessoas: { gap: 8, marginTop: 12 },
  previa: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18, paddingHorizontal: MARGEM },
  faixa: { flexGrow: 0, marginTop: 10 },
  faixaDentro: { gap: 8, paddingHorizontal: MARGEM, alignItems: 'center' },
  chipCat: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 7, paddingRight: 14, borderRadius: Raio.pilula, borderWidth: 1 },
  chipTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18, maxWidth: 150 },
  divisor: { width: 1, height: 22, marginHorizontal: 2 },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, marginHorizontal: MARGEM, marginTop: 10, paddingHorizontal: 14, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  notaTexto: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
  notaVer: { fontFamily: Fontes.textoPesado, fontSize: 14, lineHeight: 18 },
  painel: { flex: 3, minHeight: 4 * 38 + 18, maxHeight: 4 * 56 + 18, marginTop: 12, marginHorizontal: 14 },
  rodape: { paddingHorizontal: MARGEM, paddingTop: 12 },
});
