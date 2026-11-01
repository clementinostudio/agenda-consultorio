// Anotar um gasto ou uma entrada (folha que sobe de baixo), como num app de banco:
// - Gasto | Entrada no topo; o valor grande, digitado no teclado próprio (com vírgula e apagar).
// - A descrição reconhece a empresa (marcas.js): mostra a logo e já escolhe a categoria dela; enquanto digita,
//   sugere as empresas parecidas.
// - Categoria e dia em chips (Hoje, Ontem, Outro dia); tocar abre a grade de categorias ou os dias no lugar do teclado.
// - Salvar pede ao site para anotar (pedirSite('lancar')): deu certo, vibra e fecha; não deu (o limite do plano
//   grátis, por exemplo), mostra o texto do site, neutro.
// Parâmetro opcional: ?tipo=entrada abre já na Entrada.
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dataCompleta, dataCurtaLista, diaDaSemanaCurto, motivoFalha, normalizarBusca } from '@/components/atividades/acoes';
import { Segmentos } from '@/components/atividades/segmentos';
import { Teclado, Visor, falarValor, teclar, valorDoTexto, type Tecla } from '@/components/atividades/teclado';
import { Botao, BotaoRedondo, Chip, Esqueleto, Icone, IconeCategoria, Logo, Tocavel, Vazio, comAlfa, vibrar } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { hojeIso, mesNome, somarDias } from '@/lib/formato';
import { abrirNoSite, pedirSite, useEstado, type Categoria } from '@/lib/motor';
import { acharMarca, buscarMarcas } from '@site/marcas.js';

type Marca = { id: string; nome: string; site: string; cat: string };
type Painel = 'teclado' | 'categoria' | 'data';
type Tipo = 'saida' | 'entrada';

const MARGEM = 20;
const DIAS_NA_LISTA = 120; // até quanto tempo atrás dá para escolher o dia

// O teclado do sistema: se está aberto e quanto ele cobre da tela (medido na janela, porque numa folha a
// tela não começa no topo). No iPhone, mede de novo quando ele termina de abrir (a folha pode subir junto).
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

export default function Novo() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const estado = useEstado();
  const params = useLocalSearchParams<{ tipo?: string }>();
  const raiz = useRef<ComponentRef<typeof View>>(null);
  const campo = useRef<TextInputInstance>(null);
  const teclado = useTecladoDoSistema(raiz);
  // no Android, fechar o teclado pelo voltar não tira o foco do campo: tira aqui, para o painel voltar
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => campo.current?.blur());
    return () => sub.remove();
  }, []);

  const [tipo, setTipo] = useState<Tipo>(params.tipo === 'entrada' ? 'entrada' : 'saida');
  const [txt, setTxt] = useState('');
  const [tremor, setTremor] = useState(0);
  const [desc, setDesc] = useState('');
  const [catEscolhida, setCatEscolhida] = useState<string | null>(null);
  const [data, setData] = useState(hojeIso);
  const [painel, setPainel] = useState<Painel>('teclado');
  const [focoDesc, setFocoDesc] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // fechar depois do "Anotado" só se a folha ainda está aberta (a pessoa pode ter arrastado para fechar antes)
  const aberta = useRef(true);
  const fechamento = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    aberta.current = true;
    return () => { aberta.current = false; clearTimeout(fechamento.current); };
  }, []);

  const hoje = hojeIso();
  const ontem = somarDias(hoje, -1);
  const lista: Categoria[] = useMemo(() => (tipo === 'entrada' ? estado?.catEntrada : estado?.categorias) ?? [], [tipo, estado?.catEntrada, estado?.categorias]);
  // a empresa da descrição (só nos gastos) e a categoria dela, quando a pessoa ainda não escolheu outra
  const marca = useMemo(() => (tipo === 'saida' && desc.trim().length >= 2 ? (acharMarca(desc) as Marca | null) : null), [desc, tipo]);
  const catAuto = marca && lista.some((k) => k.id === marca.cat) ? marca.cat : null;
  const catId = catEscolhida ?? catAuto;
  const cat = lista.find((k) => k.id === catId) ?? null;
  const sugestoes = useMemo(() => {
    if (tipo !== 'saida' || !focoDesc || desc.trim().length < 2) return [];
    const q = normalizarBusca(desc);
    return (buscarMarcas(desc, 4) as { m: Marca }[]).map((r) => r.m).filter((m) => normalizarBusca(m.nome) !== q);
  }, [desc, tipo, focoDesc]);
  const valor = valorDoTexto(txt);

  // As teclas acompanham a altura da folha (o degrau de 75% num iPhone pequeno é baixo): o que sobra depois do
  // resto vai para o teclado, entre 42 e 56 pt por tecla. Folha baixa: sem a pergunta e com o valor menor.
  const [alturaFolha, setAlturaFolha] = useState(0);
  const baixa = alturaFolha > 0 && alturaFolha < 580;
  const resto = (baixa ? 54 + 56 + 54 + 48 + 10 + 62 : 62 + 96 + 54 + 52 + 14 + 66) + Math.max(ins.bottom, 12) + 8;
  const alturaTecla = alturaFolha ? Math.max(42, Math.min(56, Math.floor((alturaFolha - resto - 18) / 4))) : 54;
  const alturaPainel = alturaTecla * 4 + 6 * 3;
  const comTeclado = teclado.aberto || focoDesc;

  // aberta por um link direto (sem tela atrás), fechar leva ao Início
  const fechar = () => { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  const trocarTipo = (t: Tipo) => { setTipo(t); setCatEscolhida(null); setErro(null); };
  const aoTeclar = (t: Tecla) => {
    const n = teclar(txt, t);
    if (n === null) { if (t !== 'apagar') { vibrar('aviso'); setTremor((x) => x + 1); } return; }
    setTxt(n);
    setErro(null);
  };
  const abrirPainel = (p: Painel) => {
    Keyboard.dismiss();
    campo.current?.blur();
    setPainel((atual) => (atual === p && p !== 'teclado' ? 'teclado' : p));
  };
  const escolherCat = (id: string) => { setCatEscolhida(id); setPainel('teclado'); };
  const escolherDia = (d: string) => { setData(d); setPainel('teclado'); };
  const escolherMarca = (m: Marca) => {
    setDesc(m.nome);
    vibrar('toque');
    Keyboard.dismiss();
    campo.current?.blur();
  };

  const salvar = async () => {
    if (valor <= 0 || salvando || salvo) return;
    Keyboard.dismiss();
    setSalvando(true);
    setErro(null);
    const k = cat?.id ?? (tipo === 'entrada' ? 'outros-e' : 'outros');
    const nomeCat = lista.find((x) => x.id === k)?.nome;
    const item = {
      tipo, valor: Math.round(valor * 100) / 100, data, cat: k,
      // "carrefour" digitado vira "Carrefour", o nome da empresa reconhecida
      desc: (marca && normalizarBusca(desc) === normalizarBusca(marca.nome) ? marca.nome : desc.trim()) || nomeCat || (tipo === 'entrada' ? 'Entrada' : 'Gasto'),
      marca: marca?.id ?? null, banco: null,
    };
    try {
      const r = await pedirSite('lancar', { itens: [item] });
      if (!aberta.current) return; // a pessoa fechou a folha antes da resposta: não mexe em mais nada
      if (r.ok) {
        vibrar('ok');
        setSalvando(false);
        setSalvo(true);
        fechamento.current = setTimeout(fechar, 420);
        return;
      }
      vibrar('aviso');
      setErro(r.texto || 'Não deu para anotar agora.');
    } catch (e) {
      if (!aberta.current) return;
      vibrar('erro');
      setErro(motivoFalha(e));
    }
    setSalvando(false);
  };

  const barra = <StatusBar style={c.escuro ? 'light' : 'dark'} />;
  const fundoCampo = c.escuro ? c.cartao : c.cartao2;

  if (!estado || estado.pessoal === null) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: ins.bottom + 12 }]}>
        {barra}
        <View style={estilos.topo}>
          <BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={fechar} />
        </View>
        {!estado ? (
          <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
            <Esqueleto largura={180} altura={52} raio={14} />
            <Esqueleto largura="80%" altura={48} raio={24} />
          </View>
        ) : (
          <Vazio
            icone="carteira"
            titulo="O Pessoal está desligado"
            texto="Para anotar gastos, ligue o Pessoal no seu Perfil do Avina."
            acao={{ titulo: 'Abrir o Perfil', onPress: () => { fechar(); abrirNoSite({ tela: 'ajustes' }, 'ajustes'); } }}
            style={{ flex: 1, justifyContent: 'center' }}
          />
        )}
      </View>
    );
  }

  const corValor = tipo === 'entrada' ? c.positivo : c.texto;
  const outroDia = data !== hoje && data !== ontem;

  return (
    <View
      ref={raiz}
      collapsable={false}
      onLayout={(e) => setAlturaFolha(Math.round(e.nativeEvent.layout.height))}
      style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: teclado.aberto ? teclado.cobre + 10 : Math.max(ins.bottom, 12) + 8 }]}>
      {barra}

      {/* Fechar e Gasto | Entrada */}
      <View style={[estilos.topo, baixa && estilos.topoBaixo]}>
        <BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={fechar} />
        <Segmentos
          rotulo="Tipo do lançamento"
          opcoes={[{ id: 'saida', nome: 'Gasto' }, { id: 'entrada', nome: 'Entrada' }]}
          valor={tipo}
          onTrocar={trocarTipo}
          cores={{ entrada: c.positivo }}
          style={estilos.segmentos}
        />
        <View style={{ width: 36 }} />
      </View>

      {/* o valor (tocar volta para o teclado do valor) */}
      <Pressable
        onPress={() => abrirPainel('teclado')}
        accessibilityRole="button"
        accessibilityLabel={`Valor: ${falarValor(txt)}`}
        accessibilityHint={painel === 'teclado' && !comTeclado ? undefined : 'Toque para digitar o valor'}
        style={[estilos.visorArea, baixa && { minHeight: 56, paddingVertical: 4 }]}>
        {!teclado.aberto && !baixa ? (
          <Text maxFontSizeMultiplier={1.3} style={[estilos.pergunta, { color: c.apoio }]}>{tipo === 'entrada' ? 'Quanto você recebeu?' : 'Quanto você gastou?'}</Text>
        ) : null}
        <Visor txt={txt} cor={corValor} ativo={painel === 'teclado' && !comTeclado} tremor={tremor} compacto={teclado.aberto || baixa} />
      </Pressable>

      {/* a descrição, com a logo da empresa quando reconhece */}
      <View style={[estilos.campo, { backgroundColor: fundoCampo, borderColor: focoDesc ? comAlfa(c.azul, 0.6) : c.linha }]}>
        {marca ? (
          <Animated.View key={marca.id} entering={FadeIn.duration(200)}>
            <Logo marca={marca.id} nome={marca.nome} tamanho={30} />
          </Animated.View>
        ) : cat ? <IconeCategoria cat={cat} tamanho={30} /> : (
          <View style={[estilos.campoIcone, { backgroundColor: c.escuro ? c.cartao3 : c.cartao3 }]}>
            <Icone nome="editar" tamanho={14} cor={c.apoio} />
          </View>
        )}
        <TextInput
          ref={campo}
          value={desc}
          onChangeText={(t) => { setDesc(t); setErro(null); }}
          onFocus={() => setFocoDesc(true)}
          onBlur={() => setFocoDesc(false)}
          placeholder={tipo === 'entrada' ? 'Descrição (ex.: Salário, Pix)' : 'Descrição (ex.: Mercado, Uber)'}
          placeholderTextColor={c.apoio}
          maxLength={80}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          autoCapitalize="sentences"
          selectionColor={c.azul}
          cursorColor={c.azul}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Descrição"
          style={[estilos.campoTexto, { color: c.texto }]}
        />
        {desc ? (
          <Tocavel onPress={() => setDesc('')} hitSlop={12} escala={0.9} accessibilityLabel="Limpar a descrição" style={[estilos.limpar, { backgroundColor: c.cartao3 }]}>
            <Icone nome="fechar" tamanho={10} cor={c.texto} peso="bold" />
          </Tocavel>
        ) : null}
      </View>

      {/* as empresas parecidas com o que está digitando */}
      {sugestoes.length ? (
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={estilos.faixa} contentContainerStyle={estilos.faixaDentro}>
          {sugestoes.map((m) => (
            <Chip key={m.id} titulo={m.nome} papel="button" esquerda={<Logo marca={m.id} nome={m.nome} tamanho={24} style={{ marginLeft: -8 }} />} onPress={() => escolherMarca(m)} />
          ))}
        </ScrollView>
      ) : null}

      {/* categoria e dia */}
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={[estilos.faixa, baixa && { marginTop: 8 }]} contentContainerStyle={estilos.faixaDentro}>
        <Tocavel
          onPress={() => abrirPainel('categoria')}
          escala={0.95}
          accessibilityLabel={cat ? `Categoria: ${cat.nome}${catEscolhida ? '' : ', escolhida pela empresa'}` : 'Escolher a categoria'}
          accessibilityState={{ expanded: painel === 'categoria' }}
          style={[estilos.chipCat, { backgroundColor: c.cartao, borderColor: painel === 'categoria' ? c.azul : cat ? comAlfa(cat.cor, 0.55) : c.linhaForte }]}>
          {cat ? <IconeCategoria cat={cat} tamanho={26} /> : <Icone nome="categoria" tamanho={16} cor={c.apoio} />}
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.chipTexto, { color: cat ? c.texto : c.apoio }]}>{cat ? cat.nome : 'Categoria'}</Text>
          <Icone nome="chevronBaixo" tamanho={11} cor={c.apoio} peso="bold" />
        </Tocavel>
        <View style={[estilos.divisor, { backgroundColor: c.linhaForte }]} />
        <Chip titulo="Hoje" ativo={data === hoje} onPress={() => { setData(hoje); setPainel('teclado'); }} />
        <Chip titulo="Ontem" ativo={data === ontem} onPress={() => { setData(ontem); setPainel('teclado'); }} />
        <Chip titulo={outroDia ? dataCurtaLista(data) : 'Outro dia'} icone="calendario" ativo={outroDia} papel="button" onPress={() => abrirPainel('data')} />
      </ScrollView>

      {/* o painel de baixo: o teclado do valor, a grade de categorias ou os dias (some com o teclado do sistema) */}
      {!comTeclado ? (
        <View style={[estilos.painel, { height: alturaPainel }, baixa && { marginTop: 10 }]}>
          {painel === 'teclado' ? (
            <Animated.View key="teclado" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <Teclado altura={alturaTecla} aoTeclar={aoTeclar} aoLimpar={() => { if (txt) { vibrar('firme'); setTxt(''); } }} />
            </Animated.View>
          ) : painel === 'categoria' ? (
            <Animated.View key="categoria" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <GradeCategorias lista={lista} escolhida={cat?.id ?? null} aoEscolher={escolherCat} />
            </Animated.View>
          ) : (
            <Animated.View key="data" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <EscolherDia data={data} aoEscolher={escolherDia} />
            </Animated.View>
          )}
        </View>
      ) : null}

      {erro ? (
        <View style={[estilos.aviso, { backgroundColor: c.escuro ? c.cartao2 : c.cartao2, borderColor: c.linha }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icone nome="info" tamanho={18} cor={c.azulTinta} cheio />
          <Text maxFontSizeMultiplier={1.4} style={[estilos.avisoTexto, { color: c.texto }]}>{erro}</Text>
        </View>
      ) : null}

      <View style={[estilos.rodape, baixa && { paddingTop: 8 }]}>
        <Botao
          titulo={salvo ? 'Anotado' : tipo === 'entrada' ? 'Salvar entrada' : 'Salvar gasto'}
          icone={salvo ? 'check' : undefined}
          onPress={salvar}
          carregando={salvando}
          desativado={valor <= 0}
          vibra={false}
          largo
          rotulo={valor > 0 ? `Salvar ${tipo === 'entrada' ? 'entrada' : 'gasto'} de ${falarValor(txt)}` : 'Salvar (digite o valor primeiro)'}
        />
      </View>
    </View>
  );
}

/* ---------- A grade de categorias ---------- */

function GradeCategorias({ lista, escolhida, aoEscolher }: { lista: Categoria[]; escolhida: string | null; aoEscolher: (id: string) => void }) {
  const c = useCores();
  return (
    <ScrollView contentContainerStyle={estilos.grade} showsVerticalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Categoria">
      {lista.map((k) => {
        const ativa = k.id === escolhida;
        return (
          <Tocavel
            key={k.id}
            onPress={() => aoEscolher(k.id)}
            escala={0.94}
            accessibilityRole="radio"
            accessibilityLabel={k.nome}
            accessibilityState={{ checked: ativa }}
            style={estilos.gradeItem}>
            <View style={[estilos.gradeAnel, { borderColor: ativa ? k.cor : 'transparent' }]}>
              <IconeCategoria cat={k} tamanho={50} />
              {ativa ? (
                <View style={[estilos.gradeCheck, { backgroundColor: k.cor, borderColor: c.fundoAlto }]}>
                  <Icone nome="check" tamanho={10} cor="#FFFFFF" peso="bold" />
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.25} style={[estilos.gradeNome, { color: ativa ? c.texto : c.apoio }, ativa && { fontFamily: Fontes.textoForte }]}>{k.nome}</Text>
          </Tocavel>
        );
      })}
    </ScrollView>
  );
}

/* ---------- Os dias (do mais novo para o mais velho) ---------- */

function EscolherDia({ data, aoEscolher }: { data: string; aoEscolher: (d: string) => void }) {
  const c = useCores();
  const hoje = hojeIso();
  const dias = useMemo(() => Array.from({ length: DIAS_NA_LISTA }, (_, i) => somarDias(hoje, -i)), [hoje]);
  const LARGURA = 62, ESPACO = 8;
  // começa mostrando o dia escolhido
  const inicio = Math.max(0, dias.indexOf(data) - 2) * (LARGURA + ESPACO);
  return (
    <View style={estilos.dias}>
      <Text maxFontSizeMultiplier={1.3} style={[estilos.diasTitulo, { color: c.apoio }]}>{dataCompleta(data)}</Text>
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: inicio, y: 0 }}
        contentContainerStyle={{ gap: ESPACO, paddingHorizontal: MARGEM }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Dia">
        {dias.map((d, i) => {
          const ativo = d === data;
          const primeiroDoMes = d.endsWith('-01');
          const semana = i === 0 ? 'hoje' : i === 1 ? 'ontem' : diaDaSemanaCurto(d);
          return (
            <Tocavel
              key={d}
              onPress={() => aoEscolher(d)}
              escala={0.94}
              accessibilityRole="radio"
              accessibilityLabel={dataCompleta(d)}
              accessibilityState={{ checked: ativo }}
              style={[estilos.dia, { width: LARGURA, backgroundColor: ativo ? c.azul : c.escuro ? c.cartao : c.cartao2, borderColor: ativo ? c.azul : c.linha }]}>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaSemana, { color: ativo ? 'rgba(255,255,255,0.8)' : c.apoio }]}>{semana}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaNumero, { color: ativo ? '#FFFFFF' : c.texto }]}>{Number(d.slice(8, 10))}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaMes, { color: ativo ? 'rgba(255,255,255,0.8)' : primeiroDoMes ? c.azulTinta : c.fraco }]}>{mesNome(d, true)}</Text>
            </Tocavel>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, minHeight: 62 },
  topoBaixo: { paddingTop: 12, minHeight: 54 },
  segmentos: { width: 210 },
  visorArea: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: MARGEM },
  pergunta: { fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, marginHorizontal: MARGEM, paddingLeft: 12, paddingRight: 14, borderRadius: Raio.pilula, borderCurve: 'continuous', borderWidth: 1 },
  campoIcone: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  campoTexto: { flex: 1, height: 52, fontFamily: Fontes.textoForte, fontSize: 16, padding: 0, outlineWidth: 0 },
  limpar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  faixa: { flexGrow: 0, marginTop: 12 },
  faixaDentro: { gap: 8, paddingHorizontal: MARGEM, alignItems: 'center' },
  chipCat: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 7, paddingRight: 14, borderRadius: Raio.pilula, borderWidth: 1 },
  chipTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18, maxWidth: 150 },
  divisor: { width: 1, height: 22, marginHorizontal: 2 },
  painel: { marginTop: 14, marginHorizontal: 14 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, paddingTop: 4 },
  gradeItem: { width: '25%', alignItems: 'center', gap: 6 },
  gradeAnel: { padding: 3, borderRadius: 32, borderWidth: 2 },
  gradeCheck: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  gradeNome: { fontFamily: Fontes.texto, fontSize: 12.5, lineHeight: 16, paddingHorizontal: 2 },
  dias: { flex: 1, justifyContent: 'center', gap: 14, marginHorizontal: -14 },
  diasTitulo: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 19, paddingHorizontal: MARGEM + 2 },
  dia: { height: 84, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  diaSemana: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  diaNumero: { fontFamily: Fontes.tituloForte, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  diaMes: { fontFamily: Fontes.texto, fontSize: 12, lineHeight: 16 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: MARGEM, marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  avisoTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
  rodape: { paddingHorizontal: MARGEM, paddingTop: 12 },
});
