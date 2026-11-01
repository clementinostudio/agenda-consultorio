// O chat da Bolinha (modal em tela cheia), com cara de chat de IA:
// - topo: fechar (X), "Bolinha" discreto no meio e o relógio (as conversas guardadas);
// - vazia: a Bolinha grande, "Olá, Fulano / Como posso te ajudar?" e sugestões em chips acima do campo
//   (conforme os modos ligados e os números do mês); tocar numa sugestão já envia;
// - as suas falas em pílula à direita; as dela em texto corrido à esquerda, palavra por palavra;
// - quem responde é o site (pedirSite('bolinha')): pergunta vira resposta; gasto ou entrada vira uma proposta que
//   só é anotada quando a pessoa toca "Anotar" (pedirSite('lancar'));
// - as conversas ficam guardadas no aparelho (até 30), com o título da primeira pergunta.
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type TextInputInstance,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Campo, MenuMais, type Atalho } from '@/components/chat/campo';
import {
  apagarConversa, falaDaResposta, falaDoErro, guardarConversa, historicoDe, lerConversas, novoId, sugestoesDe, textoSimples, tituloDe,
  type Conversa, type Fala, type FalaEla, type Nota, type Sugestao,
} from '@/components/chat/conversas';
import { FolhaHistorico } from '@/components/chat/historico';
import { MARGEM_CHAT, MsgBolinha, MsgEu, Pensando } from '@/components/chat/mensagens';
import { BotaoRedondo, comAlfa, Icone, Mascote, Texto, Tocavel, vibrar } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { pedirSite, useEstado } from '@/lib/motor';

const BOTAO_TOPO = 44;

/* ---------- A tela vazia ---------- */

function Saudacao({ nome }: { nome: string | null }) {
  const c = useCores();
  const [cabe, setCabe] = useState(true); // com o teclado aberto e pouco espaço, a Bolinha sai e fica só o texto
  const luz = 220;
  return (
    <View
      style={estilos.vazia}
      onLayout={(e: LayoutChangeEvent) => setCabe(e.nativeEvent.layout.height > 300)}>
      {cabe ? (
        <View style={estilos.mascote} accessible={false} importantForAccessibility="no-hide-descendants">
          <Svg width={luz} height={luz} style={estilos.luz}>
            <Defs>
              <RadialGradient id="chat-luz" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c.azul} stopOpacity={c.escuro ? 0.3 : 0.16} />
                <Stop offset="0.45" stopColor={c.roxo} stopOpacity={c.escuro ? 0.1 : 0.06} />
                <Stop offset="1" stopColor={c.azul} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={luz / 2} cy={luz / 2} r={luz / 2} fill="url(#chat-luz)" />
          </Svg>
          <Mascote tamanho={92} />
        </View>
      ) : null}
      <View style={estilos.ola} accessible accessibilityRole="header" accessibilityLabel={`Olá${nome ? `, ${nome}` : ''}. Como posso te ajudar?`}>
        <Texto maxFontSizeMultiplier={1.3} style={[estilos.olaTexto, { color: c.texto }]}>{nome ? `Olá, ${nome}` : 'Olá!'}</Texto>
        <Texto maxFontSizeMultiplier={1.3} style={[estilos.olaTexto, estilos.olaPergunta, { color: c.apoio }]}>Como posso te ajudar?</Texto>
      </View>
    </View>
  );
}

function Sugestoes({ lista, aoEscolher }: { lista: Sugestao[]; aoEscolher: (s: Sugestao) => void }) {
  const c = useCores();
  if (!lista.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0 }}
      contentContainerStyle={estilos.sugestoes}
      accessibilityLabel="Sugestões">
      {lista.map((s) => (
        <Tocavel
          key={s.titulo}
          onPress={() => aoEscolher(s)}
          accessibilityLabel={s.titulo}
          accessibilityHint="Envia para a Bolinha"
          escala={0.95}
          style={[estilos.sugestao, { backgroundColor: c.escuro ? c.cartao : c.cartao, borderColor: c.escuro ? c.linhaForte : c.linha }, !c.escuro && { boxShadow: `0px 2px 8px ${comAlfa(c.sombra, 0.05)}` }]}>
          <Icone nome={s.icone} tamanho={16} cor={c.apoio} peso="semibold" />
          <Texto numberOfLines={1} maxFontSizeMultiplier={1.3} style={estilos.sugestaoTexto}>{s.titulo}</Texto>
        </Tocavel>
      ))}
    </ScrollView>
  );
}

/* ---------- A tela ---------- */

export default function Chat() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const estado = useEstado();

  const [conversas, setConversas] = useState<Conversa[]>(lerConversas);
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [esperando, setEsperando] = useState(false);
  const [texto, setTexto] = useState('');
  const [menu, setMenu] = useState(false);
  const [folha, setFolha] = useState(false);
  const [teclado, setTeclado] = useState(false);
  const [descer, setDescer] = useState(false);
  const [alturaBaixo, setAlturaBaixo] = useState(80);

  // o que os pedidos (que voltam depois) precisam ler na hora: a conversa da tela
  const atual = useRef<Conversa | null>(null);
  const montado = useRef(true);
  const vez = useRef(0); // cada pergunta tem a sua vez; parar ou trocar de conversa faz a resposta antiga ser ignorada
  const rolagem = useRef<ScrollViewInstance>(null);
  const grudado = useRef(true); // a lista está no fim: acompanha a resposta
  const campo = useRef<TextInputInstance>(null);

  const nome = estado?.conta?.nome?.trim().split(/\s+/)[0] || null;
  const sugestoes = useMemo(() => sugestoesDe(estado), [estado]);
  const falas = conversa?.falas ?? [];
  const vazia = !falas.length && !esperando;
  const temPessoal = !!estado?.pessoal;

  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);

  // Android: o voltar fecha o menu do "+" antes de fechar o chat (a folha das conversas cuida do dela)
  useEffect(() => {
    if (!menu) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setMenu(false); return true; });
    return () => sub.remove();
  }, [menu]);

  // o teclado aberto: o campo encosta nele (sem o espaço da barra de gestos)
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setTeclado(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTeclado(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  /* ----- guardar ----- */

  const mostrar = (n: Conversa | null) => { atual.current = n; setConversa(n); };
  const guardar = (n: Conversa) => setConversas(guardarConversa(n));
  // muda uma conversa (a da tela ou outra da lista, se a pessoa trocou enquanto esperava) e guarda.
  // andou: entrou fala nova (a conversa sobe para o topo da lista)
  const mudar = (id: string, f: (k: Conversa) => Conversa, andou = true) => {
    const k = atual.current?.id === id ? atual.current : lerConversas().find((x) => x.id === id);
    if (!k) return;
    const n = { ...f(k), ...(andou ? { mudou: Date.now() } : null) };
    if (atual.current?.id === id) mostrar(n);
    guardar(n);
  };
  const mudarFala = (idConversa: string, idFala: string, campos: Partial<Fala>, andou = false) =>
    mudar(idConversa, (k) => ({ ...k, falas: k.falas.map((x) => (x.id === idFala ? ({ ...x, ...campos } as Fala) : x)) }), andou);

  /* ----- perguntar ----- */

  // repetir: o id do erro que dá lugar à nova tentativa (a pergunta já está na conversa)
  const perguntar = (bruto: string, repetir?: string) => {
    const t = bruto.trim();
    if (!t || esperando) return;
    setMenu(false);
    const agora = Date.now();
    const k = atual.current ?? { id: novoId(), titulo: tituloDe(t), criada: agora, mudou: agora, falas: [] };
    const base = repetir ? k.falas.filter((f) => f.id !== repetir) : k.falas;
    const ultima = base[base.length - 1];
    const antes = repetir && ultima?.quem === 'eu' ? base.slice(0, -1) : base; // o histórico é o que veio antes da pergunta
    const historico = historicoDe(antes);
    const n: Conversa = { ...k, falas: repetir ? base : [...base, { id: novoId(), quem: 'eu', texto: t, em: agora, viva: true }], mudou: agora };
    mostrar(n);
    guardar(n);
    if (!repetir) setTexto('');
    grudado.current = true;
    const minha = ++vez.current;
    setEsperando(true);
    pedirSite('bolinha', { texto: t, historico }, 90_000)
      .then((r) => falaDaResposta(r, t), (e) => falaDoErro(e, t))
      .then((f: FalaEla) => {
        if (vez.current !== minha) return; // parou ou trocou de conversa
        setEsperando(false);
        // com o chat fechado, a resposta só fica guardada na conversa (sem vibrar nem falar fora de hora)
        mudar(n.id, (x) => ({ ...x, falas: [...x.falas, montado.current ? f : { ...f, viva: false }] }));
        if (!montado.current) return;
        vibrar(f.tipo === 'erro' ? 'aviso' : 'leve');
        AccessibilityInfo.announceForAccessibility(`Bolinha: ${textoSimples(f.texto)}`);
      });
  };

  const parar = () => { vez.current++; setEsperando(false); };

  const tentar = (idFala: string) => {
    const f = atual.current?.falas.find((x) => x.id === idFala);
    if (f && f.quem === 'ela' && f.tipo === 'erro') perguntar(f.pergunta, idFala);
  };

  const anotar = async (idFala: string) => {
    const k = atual.current;
    const f = k?.falas.find((x) => x.id === idFala);
    if (!k || !f || f.quem !== 'ela' || f.tipo !== 'gastos' || f.situacao === 'anotando' || f.situacao === 'anotada') return;
    mudarFala(k.id, idFala, { situacao: 'anotando', aviso: null });
    try {
      // os itens vão como vieram do site (com cotacao e iof nas compras em outra moeda), mais o id de cada um
      const r = await pedirSite('lancar', { itens: f.itens });
      if (r.ok) {
        vibrar('ok');
        mudarFala(k.id, idFala, { situacao: 'anotada', aviso: null });
        AccessibilityInfo.announceForAccessibility(f.itens.length > 1 ? 'Anotados' : 'Anotado');
      } else {
        vibrar('aviso');
        mudarFala(k.id, idFala, { situacao: 'recusada', aviso: r.texto || null });
      }
    } catch {
      vibrar('erro');
      mudarFala(k.id, idFala, { situacao: 'falhou', aviso: 'Não consegui anotar agora. Tente de novo em instantes.' });
    }
  };

  const dispensar = (idFala: string) => { const k = atual.current; if (k) mudarFala(k.id, idFala, { situacao: 'dispensada' }); };
  const marcarNota = (idFala: string, nota: Nota | null) => { const k = atual.current; if (k) mudarFala(k.id, idFala, { nota }); };

  /* ----- conversas ----- */

  const novaConversa = () => {
    vez.current++;
    setEsperando(false);
    mostrar(null);
    setFolha(false);
    setDescer(false);
  };
  const abrirConversa = (k: Conversa) => {
    vez.current++;
    setEsperando(false);
    grudado.current = true;
    mostrar(lerConversas().find((x) => x.id === k.id) ?? k);
    setFolha(false);
  };
  const apagar = (id: string) => {
    setConversas(apagarConversa(id));
    if (atual.current?.id === id) novaConversa();
  };

  /* ----- rolagem ----- */

  const aoRolar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const falta = contentSize.height - contentOffset.y - layoutMeasurement.height;
    grudado.current = falta < 80;
    setDescer(falta > 280);
  };
  const irAoFim = (animado: boolean) => rolagem.current?.scrollToEnd({ animated: animado && !reduzir });

  /* ----- atalhos do "+" ----- */

  const atalhos: Atalho[] = temPessoal ? [
    { id: 'gasto', titulo: 'Anotar gasto', sub: 'Valor, categoria e dia', icone: 'saida', cor: c.texto, aoTocar: () => { Keyboard.dismiss(); router.push('/novo'); } },
    { id: 'entrada', titulo: 'Anotar entrada', sub: 'Salário, Pix recebido…', icone: 'entrada', cor: c.positivo, aoTocar: () => { Keyboard.dismiss(); router.push({ pathname: '/novo', params: { tipo: 'entrada' } }); } },
  ] : [];

  const alturaTopo = ins.top + Espaco.dois + BOTAO_TOPO + Espaco.dois;
  const ultimaId = falas.length ? falas[falas.length - 1].id : null;

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {vazia ? (
            <Animated.View key="vazia" entering={reduzir ? undefined : FadeIn.duration(260)} style={{ flex: 1, paddingTop: alturaTopo }}>
              <Saudacao nome={nome} />
            </Animated.View>
          ) : (
            <ScrollView
              ref={rolagem}
              style={{ flex: 1 }}
              contentContainerStyle={[estilos.lista, { paddingTop: alturaTopo + Espaco.tres }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              onScroll={aoRolar}
              scrollEventThrottle={64}
              onContentSizeChange={() => { if (grudado.current) irAoFim(false); }}
              onLayout={() => { if (grudado.current) irAoFim(false); }}>
              {falas.map((f) => (
                <View key={f.id} style={f.quem === 'eu' ? estilos.vezEu : estilos.vezEla}>
                  {f.quem === 'eu' ? (
                    <MsgEu texto={f.texto} nova={!!f.viva && !reduzir} />
                  ) : (
                    <MsgBolinha
                      fala={f}
                      surgir={!!f.viva && f.id === ultimaId}
                      aoNota={marcarNota}
                      aoTentar={tentar}
                      aoAnotar={anotar}
                      aoDispensar={dispensar}
                    />
                  )}
                </View>
              ))}
              {esperando ? <View style={estilos.vezEla}><Pensando /></View> : null}
            </ScrollView>
          )}

          {/* o topo: os botões flutuam e a conversa some atrás de um degradê do fundo */}
          <View pointerEvents="box-none" style={[estilos.topo, { height: alturaTopo + Espaco.seis }]}>
            {/* opaco até o fim dos botões (o título fica limpo) e some nos últimos 24 pt */}
            <LinearGradient
              pointerEvents="none"
              colors={[c.fundo, c.fundo, comAlfa(c.fundo, 0)]}
              locations={[0, (alturaTopo - Espaco.dois) / (alturaTopo + Espaco.seis), 1]}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="box-none" style={[estilos.topoBotoes, { marginTop: ins.top + Espaco.dois }]}>
              <BotaoRedondo icone="fechar" rotulo="Fechar" tamanho={BOTAO_TOPO} onPress={() => router.back()} />
              <View pointerEvents="none" style={estilos.titulo}>
                <Texto accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[estilos.tituloTexto, { color: c.apoio }]}>Bolinha</Texto>
              </View>
              <BotaoRedondo icone="relogio" rotulo="Conversas anteriores" tamanho={BOTAO_TOPO} onPress={() => { Keyboard.dismiss(); setMenu(false); setFolha(true); }} />
            </View>
          </View>

          {/* o fim da conversa some de leve antes do campo, em vez de cortar seco */}
          {!vazia ? (
            <LinearGradient pointerEvents="none" colors={[comAlfa(c.fundo, 0), c.fundo]} style={estilos.fimLista} />
          ) : null}

          {descer && !vazia ? (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={estilos.descer}>
              <BotaoRedondo icone="setaBaixo" rotulo="Ir para o fim da conversa" tamanho={40} onPress={() => { grudado.current = true; irAoFim(true); }} />
            </Animated.View>
          ) : null}
        </View>

        <View onLayout={(e) => setAlturaBaixo(e.nativeEvent.layout.height)} style={{ paddingBottom: teclado ? Espaco.dois : Math.max(ins.bottom, Espaco.tres) }}>
          {vazia ? (
            <Animated.View entering={reduzir ? undefined : FadeInDown.duration(320).delay(120)}>
              <Sugestoes lista={sugestoes} aoEscolher={(s) => perguntar(s.enviar)} />
            </Animated.View>
          ) : null}
          <View style={estilos.campo}>
            <Campo
              ref={campo}
              valor={texto}
              aoMudar={setTexto}
              aoEnviar={() => perguntar(texto)}
              aoParar={parar}
              esperando={esperando}
              aoMais={atalhos.length ? () => setMenu((m) => !m) : undefined}
              menuAberto={menu}
              dica={temPessoal ? 'Pergunte ou anote um gasto' : 'Pergunte à Bolinha'}
            />
          </View>
        </View>
        <MenuMais aberto={menu} aoFechar={() => setMenu(false)} atalhos={atalhos} embaixo={alturaBaixo - Espaco.um} />
      </KeyboardAvoidingView>

      <FolhaHistorico
        visivel={folha}
        aoFechar={() => setFolha(false)}
        conversas={conversas}
        aberta={conversa?.id ?? null}
        aoAbrir={abrirConversa}
        aoApagar={apagar}
        aoNova={novaConversa}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { position: 'absolute', top: 0, left: 0, right: 0 },
  topoBotoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Espaco.quatro },
  titulo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tituloTexto: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  lista: { paddingHorizontal: MARGEM_CHAT, paddingBottom: Espaco.cinco },
  vezEu: { marginTop: Espaco.seis },
  vezEla: { marginTop: Espaco.cinco },
  fimLista: { position: 'absolute', left: 0, right: 0, bottom: 0, height: Espaco.quatro },
  descer: { position: 'absolute', bottom: Espaco.tres, alignSelf: 'center' },
  vazia: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Espaco.seis, paddingBottom: Espaco.seis, gap: Espaco.cinco },
  mascote: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  luz: { position: 'absolute', left: (92 - 220) / 2, top: (92 - 220) / 2 },
  ola: { alignItems: 'center', gap: 2 },
  olaTexto: { fontFamily: Fontes.tituloForte, fontSize: 26, lineHeight: 33, letterSpacing: -0.5, textAlign: 'center' },
  olaPergunta: { fontFamily: Fontes.texto, fontSize: 24, letterSpacing: -0.4 },
  sugestoes: { gap: Espaco.dois, paddingHorizontal: Espaco.quatro, paddingBottom: Espaco.tres },
  sugestao: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 16, borderRadius: Raio.pilula, borderWidth: 1 },
  sugestaoTexto: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  campo: { paddingHorizontal: Espaco.tres },
});
