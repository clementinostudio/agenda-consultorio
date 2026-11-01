// As falas do chat da Bolinha:
// - a sua, numa pílula escura à direita;
// - a dela, em texto corrido à esquerda (negrito e listas simples), aparecendo palavra por palavra, com o rodapé de
//   ações quando termina (a Bolinha pequena, copiar, gostei e não gostei);
// - a proposta de lançamento (cartão com os itens e "Anotar" / "Agora não");
// - o erro, num tom gentil, com "Tentar de novo";
// - o "pensando": a Bolinha pensando e um texto que troca, com um brilho passando.
// Com "reduzir movimento": a resposta aparece de uma vez, sem o brilho e sem as entradas.
import * as Clipboard from 'expo-clipboard';
import { memo, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { contarPalavras, lerMarkdown, textoSimples, type Bloco, type Fala, type FalaEla, type ItemProposta, type Nota } from '@/components/chat/conversas';
import { Botao, Cartao, comAlfa, Dinheiro, entradaCascata, Icone, Logo, Mascote, Separador, Texto, Tocavel, useCategoria, vibrar, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { dataRelativa, dinheiro } from '@/lib/formato';

export const MARGEM_CHAT = 20; // a margem das laterais

const CORPO: TextStyle = { fontFamily: Fontes.texto, fontSize: 16, lineHeight: 24 };
const NEGRITO: TextStyle = { fontFamily: Fontes.textoPesado };

/* ---------- A sua fala ---------- */

export const MsgEu = memo(function MsgEu({ texto, nova }: { texto: string; nova: boolean }) {
  const c = useCores();
  return (
    <Animated.View
      entering={nova ? FadeInDown.duration(260) : undefined}
      accessible
      accessibilityLabel={`Você: ${texto}`}
      style={[estilos.eu, { backgroundColor: c.escuro ? c.cartao2 : c.cartao3, borderColor: c.escuro ? c.linha : 'transparent' }]}>
      <Text maxFontSizeMultiplier={1.6} style={[CORPO, { color: c.texto }]}>{texto}</Text>
    </Animated.View>
  );
});

/* ---------- O texto dela, palavra por palavra ---------- */

// Os blocos com só as "n" primeiras palavras
function cortar(blocos: Bloco[], n: number): Bloco[] {
  const r: Bloco[] = [];
  let falta = n;
  for (const b of blocos) {
    if (falta <= 0) break;
    const trechos = [];
    for (const t of b.trechos) {
      if (falta <= 0) break;
      const partes = t.t.split(/(\s+)/);
      let s = '';
      for (const p of partes) {
        if (/\S/.test(p)) { if (falta <= 0) break; falta--; }
        s += p;
      }
      trechos.push({ ...t, t: s.replace(/\s+$/, '') });
    }
    r.push({ ...b, trechos });
  }
  return r;
}

function Blocos({ blocos }: { blocos: Bloco[] }) {
  const c = useCores();
  return (
    <View>
      {blocos.map((b, i) => {
        const corpo = b.trechos.map((t, k) => (t.negrito ? <Text key={k} style={NEGRITO}>{t.t}</Text> : t.t));
        // os itens de uma lista ficam juntinhos; entre parágrafos, mais respiro
        const antes = i === 0 ? 0 : b.tipo === 'item' && blocos[i - 1].tipo === 'item' ? 4 : 12;
        if (b.tipo === 'item') {
          return (
            <View key={i} style={[estilos.item, { marginTop: antes }]}>
              <Text maxFontSizeMultiplier={1.6} style={[CORPO, estilos.marca, { color: c.apoio }]}>{b.marca}</Text>
              <Text maxFontSizeMultiplier={1.6} style={[CORPO, estilos.itemTexto, { color: c.texto }]}>{corpo}</Text>
            </View>
          );
        }
        return (
          <Text key={i} maxFontSizeMultiplier={1.6} style={[CORPO, b.tipo === 'titulo' && estilos.titulo, { color: c.texto, marginTop: antes }]}>{corpo}</Text>
        );
      })}
    </View>
  );
}

// surgir: aparece palavra por palavra (~25 ms cada; respostas longas andam mais rápido, no máximo ~1,5 s)
function TextoQueSurge({ texto, surgir, aoFim }: { texto: string; surgir: boolean; aoFim?: () => void }) {
  const reduzir = useReducedMotion();
  const blocos = useMemo(() => lerMarkdown(texto), [texto]);
  const total = useMemo(() => contarPalavras(blocos), [blocos]);
  const [n, setN] = useState(() => (surgir && !reduzir ? 0 : total));
  const acabou = useEffectEvent(() => aoFim?.());
  useEffect(() => {
    if (n >= total) { acabou(); return; }
    const porVez = Math.max(1, Math.ceil(total / 60));
    const t = setTimeout(() => setN((x) => Math.min(total, x + porVez)), 25);
    return () => clearTimeout(t);
  }, [n, total]);
  const visiveis = useMemo(() => (n >= total ? blocos : cortar(blocos, n)), [blocos, n, total]);
  return <Blocos blocos={visiveis} />;
}

/* ---------- O rodapé de ações ---------- */

function BotaoAcao({ icone, rotulo, ativo, cheio, onPress }: { icone: NomeIcone; rotulo: string; ativo?: boolean; cheio?: boolean; onPress: () => void }) {
  const c = useCores();
  return (
    <Tocavel
      onPress={onPress}
      accessibilityLabel={rotulo}
      accessibilityState={ativo != null ? { selected: ativo } : undefined}
      escala={0.88}
      hitSlop={{ top: 4, bottom: 4 }}
      style={estilos.acao}>
      <Icone nome={icone} tamanho={18} cor={ativo ? c.texto : c.apoio} cheio={cheio} peso="medium" />
    </Tocavel>
  );
}

function Rodape({ texto, nota, aoNota }: { texto: string; nota: Nota | null | undefined; aoNota: (n: Nota | null) => void }) {
  const c = useCores();
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1800);
    return () => clearTimeout(t);
  }, [copiado]);
  const copiar = async () => {
    let ok = false;
    try { ok = await Clipboard.setStringAsync(textoSimples(texto)); } catch {}
    if (ok) { vibrar('ok'); setCopiado(true); AccessibilityInfo.announceForAccessibility('Copiado'); }
    else vibrar('aviso');
  };
  const marcar = (n: Nota) => aoNota(nota === n ? null : n);
  return (
    <Animated.View entering={FadeIn.duration(220)} style={estilos.rodape}>
      <Mascote tamanho={24} animado={false} sombra={false} />
      <View style={{ flex: 1 }} />
      {copiado ? (
        <Animated.View entering={FadeIn.duration(160)} style={[estilos.copiado, { backgroundColor: c.cartao2 }]}>
          <Texto cor={c.texto} maxFontSizeMultiplier={1.3} style={estilos.copiadoTexto}>Copiado</Texto>
        </Animated.View>
      ) : null}
      <BotaoAcao icone={copiado ? 'check' : 'copiar'} rotulo={copiado ? 'Copiado' : 'Copiar a resposta'} onPress={copiar} />
      <BotaoAcao icone="gostei" rotulo="Gostei da resposta" ativo={nota === 'bom'} cheio={nota === 'bom'} onPress={() => marcar('bom')} />
      <BotaoAcao icone="naoGostei" rotulo="Não gostei da resposta" ativo={nota === 'ruim'} cheio={nota === 'ruim'} onPress={() => marcar('ruim')} />
    </Animated.View>
  );
}

/* ---------- A proposta de lançamento ---------- */

function ItemDaProposta({ it, fundo }: { it: ItemProposta; fundo: string }) {
  const cat = useCategoria(it.cat);
  const entrada = it.tipo === 'entrada';
  const fora = it.moeda && it.moeda !== 'BRL' && it.valorOrig ? ` · ${it.moeda} ${String(it.valorOrig).replace('.', ',')}` : '';
  const sub = `${cat?.nome ?? (entrada ? 'Entrada' : 'Outros')} · ${dataRelativa(it.data)}${fora}`;
  const titulo = it.desc || cat?.nome || (entrada ? 'Entrada' : 'Gasto');
  return (
    <View
      style={estilos.itemProposta}
      accessible
      accessibilityLabel={`${titulo}, ${sub.replace(/ · /g, ', ')}, ${entrada ? 'entrada de ' : ''}${dinheiro(it.valor)}`}>
      <Logo marca={it.marca} site={it.site} nome={it.desc} cat={it.cat} banco={it.banco} tamanho={42} anel={fundo} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto v="forte" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>{titulo}</Texto>
        <Texto v="apoio" numberOfLines={1}>{sub}</Texto>
      </View>
      {/* o valor que a pessoa acabou de dizer aparece mesmo com o olho fechado: é o que ela está conferindo */}
      <Dinheiro valor={entrada ? it.valor : -it.valor} tamanho={17} sinal corPorSinal={entrada} animar={false} mostrar />
    </View>
  );
}

function Proposta({ fala, aoAnotar, aoDispensar }: { fala: Extract<Fala, { tipo: 'gastos' }>; aoAnotar: () => void; aoDispensar: () => void }) {
  const c = useCores();
  const { itens, situacao, aviso } = fala;
  const total = itens.reduce((t, it) => t + (it.tipo === 'entrada' ? it.valor : -it.valor), 0);
  const anotada = situacao === 'anotada';
  const fechada = situacao === 'dispensada' || situacao === 'recusada';
  const fundo = c.cartao;
  return (
    // dispensada: apagada (e sem o vidro, que não aparece meio transparente)
    <Cartao padding={0} destaque={anotada ? c.positivo : undefined} vidro={situacao !== 'dispensada'} style={[estilos.proposta, situacao === 'dispensada' && { opacity: 0.6 }]}>
      <View style={estilos.propostaItens}>
        {itens.map((it, i) => (
          <View key={i}>
            {i > 0 ? <Separador recuo={54} /> : null}
            <ItemDaProposta it={it} fundo={fundo} />
          </View>
        ))}
        {itens.length > 1 ? (
          <>
            <Separador />
            <View style={estilos.total} accessible accessibilityLabel={`Total: ${dinheiro(total)}`}>
              <Texto v="apoio" style={{ flex: 1, fontSize: 14 }}>Total</Texto>
              <Dinheiro valor={total} tamanho={17} sinal corPorSinal={total > 0} animar={false} mostrar />
            </View>
          </>
        ) : null}
      </View>

      {anotada ? (
        <Animated.View entering={FadeIn.duration(220)} style={[estilos.propostaFim, { borderTopColor: c.linha }]} accessibilityLiveRegion="polite">
          <View style={[estilos.selo, { backgroundColor: comAlfa(c.positivo, c.escuro ? 0.18 : 0.14) }]}>
            <Icone nome="check" tamanho={14} cor={c.positivo} peso="bold" />
          </View>
          <Texto v="forte" cor={c.positivo}>{itens.length > 1 ? 'Anotados' : 'Anotado'}</Texto>
        </Animated.View>
      ) : fechada ? (
        <View style={[estilos.propostaFim, { borderTopColor: c.linha }]} accessibilityLiveRegion="polite">
          <Icone nome={situacao === 'recusada' ? 'info' : 'fechar'} tamanho={16} cor={c.apoio} peso="semibold" />
          <Texto v="apoio" style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>{situacao === 'recusada' ? aviso || 'Não deu para anotar.' : 'Não anotei.'}</Texto>
        </View>
      ) : (
        <View style={[estilos.propostaBotoes, { borderTopColor: c.linha }]}>
          {aviso ? <Texto v="apoio" accessibilityLiveRegion="polite" style={estilos.aviso}>{aviso}</Texto> : null}
          <View style={estilos.botoes}>
            <Botao titulo="Agora não" variante="secundario" tamanho="medio" onPress={aoDispensar} desativado={situacao === 'anotando'} style={{ flex: 1 }} />
            <Botao
              titulo={situacao === 'falhou' ? 'Tentar de novo' : 'Anotar'}
              rotulo={itens.length > 1 ? `Anotar os ${itens.length} lançamentos` : 'Anotar'}
              tamanho="medio"
              carregando={situacao === 'anotando'}
              onPress={aoAnotar}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </Cartao>
  );
}

/* ---------- A fala dela ---------- */

export type MsgBolinhaProps = {
  fala: FalaEla;
  surgir: boolean; // a resposta acabou de chegar: aparece palavra por palavra (a lista rola junto, pelo tamanho)
  aoNota: (id: string, n: Nota | null) => void;
  aoTentar: (id: string) => void;
  aoAnotar: (id: string) => void;
  aoDispensar: (id: string) => void;
};

export const MsgBolinha = memo(function MsgBolinha({ fala, surgir, aoNota, aoTentar, aoAnotar, aoDispensar }: MsgBolinhaProps) {
  const [pronta, setPronta] = useState(!surgir);
  const simples = useMemo(() => textoSimples(fala.texto), [fala.texto]);
  return (
    <View style={estilos.ela}>
      {/* o leitor de tela lê a resposta inteira de uma vez, e não pedaço por pedaço */}
      <View accessible accessibilityLabel={`Bolinha: ${simples}`}>
        <TextoQueSurge texto={fala.texto} surgir={surgir} aoFim={() => setPronta(true)} />
      </View>
      {pronta && fala.tipo === 'gastos' ? (
        <Animated.View entering={surgir ? entradaCascata(0, 280) : undefined}>
          <Proposta fala={fala} aoAnotar={() => aoAnotar(fala.id)} aoDispensar={() => aoDispensar(fala.id)} />
        </Animated.View>
      ) : null}
      {pronta && fala.tipo === 'erro' ? (
        <Animated.View entering={surgir ? FadeIn.duration(220) : undefined} style={{ alignSelf: 'flex-start' }}>
          <Botao titulo="Tentar de novo" icone="atualizar" variante="secundario" tamanho="pequeno" onPress={() => aoTentar(fala.id)} />
        </Animated.View>
      ) : null}
      {pronta && fala.tipo === 'resposta' ? <Rodape texto={fala.texto} nota={fala.nota} aoNota={(n) => aoNota(fala.id, n)} /> : null}
    </View>
  );
});

/* ---------- Pensando ---------- */

const PENSANDO = ['Lendo seu pedido…', 'Olhando seus números…', 'Fazendo as contas…', 'Escrevendo a resposta…'];

// Uma letra do texto "pensando": acende quando a onda passa por ela
function Letra({ ch, i, n, onda, base, luz }: { ch: string; i: number; n: number; onda: SharedValue<number>; base: string; luz: string }) {
  const estilo = useAnimatedStyle(() => {
    const pos = -6 + onda.get() * (n + 12);
    const k = Math.max(0, 1 - Math.abs(i - pos) / 5);
    return { color: interpolateColor(k * k * (3 - 2 * k), [0, 1], [base, luz]) };
  });
  return <Animated.Text maxFontSizeMultiplier={1.5} style={[estilos.pensandoTexto, estilo]}>{ch === ' ' ? ' ' : ch}</Animated.Text>;
}

function TextoBrilhando({ texto }: { texto: string }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const onda = useSharedValue(0);
  useEffect(() => {
    if (reduzir) return;
    onda.set(0);
    onda.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, false));
  }, [onda, reduzir, texto]);
  if (reduzir) return <Text maxFontSizeMultiplier={1.5} style={[estilos.pensandoTexto, { color: c.apoio }]}>{texto}</Text>;
  const letras = [...texto];
  return (
    <View style={estilos.letras}>
      {letras.map((ch, i) => <Letra key={i} ch={ch} i={i} n={letras.length} onda={onda} base={c.escuro ? c.fraco : c.apoio} luz={c.texto} />)}
    </View>
  );
}

export function Pensando() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= PENSANDO.length - 1) return;
    const t = setTimeout(() => setI(i + 1), i === 0 ? 1400 : 2200);
    return () => clearTimeout(t);
  }, [i]);
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={estilos.pensando}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="A Bolinha está pensando"
      accessibilityLiveRegion="polite">
      <Mascote estado="pensando" tamanho={30} sombra={false} />
      <Animated.View key={i} entering={FadeIn.duration(240)}>
        <TextoBrilhando texto={PENSANDO[i]} />
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  eu: { alignSelf: 'flex-end', maxWidth: '82%', borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  ela: { alignSelf: 'stretch', gap: Espaco.tres },
  item: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
  marca: { minWidth: 16 },
  itemTexto: { flex: 1 },
  titulo: { fontFamily: Fontes.textoPesado, fontSize: 17 },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: -2, minHeight: 40 },
  acao: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  copiado: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', marginRight: 2 },
  copiadoTexto: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  proposta: { gap: 0, overflow: 'hidden' },
  propostaItens: { paddingHorizontal: Espaco.quatro, paddingVertical: Espaco.um },
  itemProposta: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 64, paddingVertical: Espaco.dois },
  total: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  propostaBotoes: { borderTopWidth: StyleSheet.hairlineWidth, padding: Espaco.tres, gap: Espaco.dois },
  botoes: { flexDirection: 'row', gap: Espaco.dois },
  aviso: { fontSize: 14, lineHeight: 19, paddingHorizontal: Espaco.um },
  propostaFim: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Espaco.quatro, minHeight: 52 },
  selo: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, marginLeft: -4 },
  letras: { flexDirection: 'row', flexWrap: 'nowrap' },
  pensandoTexto: { fontFamily: Fontes.textoForte, fontSize: 16, lineHeight: 22 },
});
