// O carrossel do topo do Início: cartões grandes, um por página (com encaixe), e as bolinhas de página que
// acompanham o dedo. "Este mês" (quanto sobrou) e, com o banco ligado, "Saldo em contas", "Faturas" e "Investido".
// Com o Consultório em foco (foco.ts), ou sem o Pessoal, o primeiro cartão é o mês do consultório (recebido, a
// receber, sessões e faltas); o do Pessoal vai para o fim.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { BarraProgresso } from '@/components/graficos';
import { useIdSvg } from '@/components/graficos/curva';
import { listaNomes, quandoVence, useCurto, ValorCurto, type ResumoMes } from '@/components/inicio/comum';
import type { AreaFoco } from '@/components/inicio/foco';
import { BolinhasPagina, Cartao, comAlfa, Dinheiro, Esqueleto, Icone, LogoBanco, Texto, useDizerValor, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { totaisBanco, useBanco } from '@/hooks/use-banco';
import { dataCurta, haQuanto, mesNome, porcento } from '@/lib/formato';
import { abrirNoSite, type Estado } from '@/lib/motor';

const ALTURA = 214;
export const MARGEM = Espaco.quatro;
const ESPACO = MARGEM; // o próximo cartão começa logo depois da borda da tela (nada dele aparece antes de deslizar)

/* ---------- O cartão grande ---------- */

function Grande({ rotulo, icone, cor, onPress, falar, children, comBolinhas }: {
  rotulo: string; icone: NomeIcone; cor: string; onPress?: () => void; falar: string; children: ReactNode; comBolinhas: boolean;
}) {
  const c = useCores();
  const id = useIdSvg('brilho');
  const [w, setW] = useState(0);
  return (
    <Cartao onPress={onPress} rotulo={falar} style={{ height: ALTURA, paddingBottom: comBolinhas ? 34 : Espaco.cinco }}>
      {/* um brilho da cor do cartão no canto de cima (as luzes da aurora) */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: Raio.cartao, overflow: 'hidden' }]} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
        {w ? (
          <Svg width={w} height={ALTURA}>
            <Defs>
              <RadialGradient id={id} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={cor} stopOpacity={c.escuro ? 0.26 : 0.14} />
                <Stop offset="1" stopColor={cor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={w * 0.92} cy={-10} r={w * 0.55} fill={`url(#${id})`} />
          </Svg>
        ) : null}
      </View>
      <View style={estilos.topo}>
        <View style={[estilos.chip, { backgroundColor: comAlfa(cor, c.escuro ? 0.18 : 0.12) }]}>
          <Icone nome={icone} tamanho={15} cor={cor} peso="semibold" />
        </View>
        <Texto numberOfLines={1} cor={c.apoio} style={estilos.rotulo}>{rotulo}</Texto>
        {onPress ? <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" /> : null}
      </View>
      {children}
    </Cartao>
  );
}

// "Entrou ▬▬▬▬▬▬ R$ 9,5 mil"
function LinhaBarra({ rotulo, valor, maior, cor }: { rotulo: string; valor: number; maior: number; cor: string }) {
  const c = useCores();
  return (
    <View style={estilos.linhaBarra}>
      <Texto v="apoio" style={estilos.barraRotulo}>{rotulo}</Texto>
      <BarraProgresso progresso={maior > 0 ? valor / maior : 0} cor={cor} altura={8} fundo={comAlfa(cor, c.escuro ? 0.12 : 0.1)} rotulo={rotulo} style={{ flex: 1 }} />
      <ValorCurto valor={valor} tamanho={14} style={estilos.barraValor} />
    </View>
  );
}

// As logos dos bancos, uma por cima da outra
function Logos({ bancos }: { bancos: string[] }) {
  const c = useCores();
  return (
    <View style={{ flexDirection: 'row' }}>
      {bancos.slice(0, 4).map((b, i) => (
        <View key={b} style={[estilos.logo, { marginLeft: i ? -8 : 0, borderColor: c.cartao, zIndex: 10 - i }]}>
          <LogoBanco banco={b} tamanho={26} />
        </View>
      ))}
    </View>
  );
}

/* ---------- O carrossel ---------- */

export function Carrossel({ e, r, foco, aoVerAtividades }: { e: Estado; r: ResumoMes; foco: AreaFoco | null; aoVerAtividades: () => void }) {
  const dizer = useDizerValor();
  const c = useCores();
  const { width: W } = useWindowDimensions();
  const banco = useBanco();
  const curto = useCurto();
  const L = W - MARGEM * 2;
  const passo = L + ESPACO;
  const x = useSharedValue(0);
  const progresso = useDerivedValue(() => x.get() / passo);
  const [pagina, setPagina] = useState(0);
  const rolar = useAnimatedScrollHandler({ onScroll: (ev) => { x.set(ev.contentOffset.x); } });

  const t = totaisBanco(banco.resumo);
  const nomes = (lista: { banco: string }[]) => [...new Set(lista.map((k) => k.banco))];
  const temBanco = banco.ligado && !!banco.resumo?.bancos?.length;
  type Pagina = { id: string; montar: (bolinhas: boolean) => ReactNode };
  const cartoes: Pagina[] = [];
  let mes: Pagina | null = null;
  let consultorio: Pagina | null = null;

  if (e.pessoal && r.temLanc) {
    const maior = Math.max(r.entrou, r.saiu);
    const sobrou = r.sobrou;
    mes = {
      id: 'mes',
      montar: (b) => (
        <Grande
          rotulo={sobrou >= 0 ? `Sobrou em ${mesNome(r.mes)}` : `Passou do que entrou em ${mesNome(r.mes)}`}
          icone="carteira" cor={c.azul} comBolinhas={b} onPress={aoVerAtividades}
          falar={`${sobrou >= 0 ? 'Sobrou' : 'Passou do que entrou'} ${dizer(Math.abs(sobrou))} em ${mesNome(r.mes)}. Entrou ${dizer(r.entrou)}, saiu ${dizer(r.saiu)}. Abre as atividades`}>
          <Dinheiro valor={sobrou} tamanho={38} cor={sobrou < 0 ? c.negativo : undefined} style={{ marginTop: Espaco.um }} />
          <Texto v="apoio" numberOfLines={1} style={{ marginTop: -2 }}>
            {r.entrou <= 0 ? `Nenhuma entrada anotada em ${mesNome(r.mes)}`
              : sobrou >= 0 ? `${porcento(sobrou / r.entrou)} do que entrou ficou com você`
              : `Saiu ${porcento(r.saiu / r.entrou - 1)} a mais do que entrou`}
          </Texto>
          <View style={{ flex: 1 }} />
          <View style={{ gap: Espaco.dois }}>
            <LinhaBarra rotulo="Entrou" valor={r.entrou} maior={maior} cor={c.positivo} />
            <LinhaBarra rotulo="Saiu" valor={r.saiu} maior={maior} cor={c.negativo} />
          </View>
        </Grande>
      ),
    };
  }
  if (e.consultorio && (!e.pessoal || foco === 'consultorio')) {
    const k = e.consultorio;
    consultorio = {
      id: 'consultorio',
      montar: (b) => (
        <Grande
          rotulo={`Recebido em ${mesNome(r.mes)}`} icone="consultorio" cor={c.azul} comBolinhas={b}
          onPress={() => abrirNoSite({ area: 'consultorio', tela: 'financas' })}
          falar={`Recebido em ${mesNome(r.mes)}: ${dizer(k.recebidoMes)}. A receber ${dizer(k.aReceber)}. Abre as finanças do consultório`}>
          <Dinheiro valor={k.recebidoMes} tamanho={38} style={{ marginTop: Espaco.um }} />
          <View style={{ flex: 1 }} />
          <View style={estilos.trio}>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto v="apoio" style={{ fontSize: 12.5 }}>A receber</Texto>
              <ValorCurto valor={k.aReceber} tamanho={16} cor={k.aReceber > 0 ? c.ambar : c.texto} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto v="apoio" style={{ fontSize: 12.5 }}>Sessões</Texto>
              <Texto style={estilos.numero}>{k.sessoesMes}</Texto>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto v="apoio" style={{ fontSize: 12.5 }}>Faltas</Texto>
              <Texto style={estilos.numero}>{k.faltasMes}</Texto>
            </View>
          </View>
        </Grande>
      ),
    };
  }
  // o da área em foco abre o carrossel
  if (foco === 'consultorio') { if (consultorio) cartoes.push(consultorio); } else { if (mes) cartoes.push(mes); if (consultorio) cartoes.push(consultorio); }

  if (banco.ligado && !banco.resumo && banco.carregando) {
    cartoes.push({
      id: 'banco-carregando',
      montar: (b) => (
        <Grande rotulo="Saldo em contas" icone="banco" cor={c.menta} comBolinhas={b} falar="Saldo em contas, carregando">
          <Esqueleto largura={180} altura={36} raio={10} style={{ marginTop: Espaco.dois }} />
          <View style={{ flex: 1 }} />
          <Esqueleto largura="55%" altura={14} />
        </Grande>
      ),
    });
  }
  if (temBanco && t.contas.length) {
    const bancos = nomes(t.contas);
    const atualizado = haQuanto(banco.resumo?.em);
    cartoes.push({
      id: 'saldo',
      montar: (b) => (
        <Grande rotulo="Saldo em contas" icone="banco" cor={c.menta} comBolinhas={b} onPress={() => router.push('/bancos')} falar={`Saldo em contas: ${dizer(t.emConta)}. Abre os bancos`}>
          <Dinheiro valor={t.emConta} tamanho={38} style={{ marginTop: Espaco.um }} />
          <View style={{ flex: 1 }} />
          <View style={estilos.rodape}>
            <Logos bancos={bancos} />
            <View style={{ flex: 1 }}>
              <Texto v="forte" numberOfLines={1} style={{ fontSize: 14 }}>{listaNomes(bancos)}</Texto>
              <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5 }}>
                {t.contas.length === 1 ? '1 conta' : `${t.contas.length} contas`}{atualizado ? ` · atualizado ${atualizado}` : ''}
              </Texto>
            </View>
          </View>
        </Grande>
      ),
    });
  }
  if (temBanco && t.cartoes.length) {
    const limite = t.cartoes.reduce((s, k) => s + (k.limite ?? 0), 0);
    const livre = t.cartoes.reduce((s, k) => s + (k.livre ?? Math.max(0, (k.limite ?? 0) - Math.max(0, k.saldo))), 0);
    const vence = t.cartoes.map((k) => k.vence).filter((v): v is string => !!v).sort()[0];
    cartoes.push({
      id: 'faturas',
      montar: (b) => (
        <Grande rotulo="Faturas" icone="cartao" cor={c.roxo} comBolinhas={b} onPress={() => router.push('/bancos')} falar={`Faturas: ${dizer(t.faturas)}${vence ? `, ${quandoVence(vence)}` : ''}. Abre os bancos`}>
          <Dinheiro valor={t.faturas} tamanho={38} style={{ marginTop: Espaco.um }} />
          {vence ? <Texto v="apoio" style={{ marginTop: -2 }}>{`${quandoVence(vence)[0].toUpperCase()}${quandoVence(vence).slice(1)} · ${dataCurta(vence)}`}</Texto> : null}
          <View style={{ flex: 1 }} />
          {limite > 0 ? (
            <View style={{ gap: 6 }}>
              <BarraProgresso progresso={(limite - livre) / limite} cor={c.roxo} altura={8} fundo={comAlfa(c.roxo, c.escuro ? 0.14 : 0.1)} rotulo="Limite usado" />
              <View style={estilos.entre}>
                <Texto v="apoio" style={{ fontSize: 12.5 }}>Limite livre</Texto>
                <Texto v="apoio" cor={c.texto} style={{ fontSize: 12.5, fontFamily: Fontes.textoForte }}>{curto(livre)} de {curto(limite)}</Texto>
              </View>
            </View>
          ) : null}
        </Grande>
      ),
    });
  }
  if (temBanco && t.investimentos.length) {
    const rendeu = t.investimentos.reduce((s, k) => s + (k.rendeu ?? 0), 0);
    const n = t.investimentos.length;
    cartoes.push({
      id: 'investido',
      montar: (b) => (
        <Grande rotulo="Investido" icone="investimento" cor={c.ciano} comBolinhas={b} onPress={() => router.push('/bancos')} falar={`Investido: ${dizer(t.investido)}${rendeu ? `, rendeu ${dizer(rendeu)}` : ''}. Abre os bancos`}>
          <Dinheiro valor={t.investido} tamanho={38} style={{ marginTop: Espaco.um }} />
          {rendeu ? (
            <View style={estilos.rendeu}>
              <Icone nome="setaCima" tamanho={12} cor={c.positivo} peso="bold" />
              <ValorCurto valor={rendeu} tamanho={14} cor={c.positivo} sinal fonte={Fontes.textoForte} />
              <Texto v="apoio">de rendimento</Texto>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <View style={estilos.rodape}>
            <Logos bancos={nomes(t.investimentos)} />
            <Texto v="apoio" numberOfLines={1} style={{ flex: 1, fontSize: 12.5 }}>{n === 1 ? '1 aplicação' : `${n} aplicações`} · {listaNomes(nomes(t.investimentos))}</Texto>
          </View>
        </Grande>
      ),
    });
  }

  if (foco === 'consultorio' && mes) cartoes.push(mes);

  if (!cartoes.length) return null;
  const varios = cartoes.length > 1;
  if (!varios) return <View style={{ paddingHorizontal: MARGEM }}>{cartoes[0].montar(false)}</View>;
  return (
    <View>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={passo}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={rolar}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(ev) => setPagina(Math.round(ev.nativeEvent.contentOffset.x / passo))}
        contentContainerStyle={{ paddingHorizontal: MARGEM, gap: ESPACO }}
        accessibilityLabel="Destaques do mês">
        {cartoes.map((k) => <View key={k.id} style={{ width: L }}>{k.montar(true)}</View>)}
      </Animated.ScrollView>
      <View pointerEvents="none" style={estilos.bolinhas}>
        <BolinhasPagina total={cartoes.length} atual={pagina} progresso={progresso} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois },
  chip: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rotulo: { flex: 1, fontFamily: Fontes.texto, fontSize: 15, lineHeight: 20 },
  linhaBarra: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2 },
  barraRotulo: { width: 44, fontSize: 12.5 },
  barraValor: { minWidth: 76, textAlign: 'right' },
  logo: { borderRadius: 16, borderWidth: 2 },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2 },
  rendeu: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 },
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trio: { flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.tres },
  numero: { fontFamily: Fontes.tituloForte, fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  bolinhas: { position: 'absolute', left: 0, right: 0, bottom: 16 },
});
