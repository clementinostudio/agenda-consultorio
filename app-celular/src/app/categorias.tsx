// Gastos por categoria (tela empurrada): o mês escolhido (os últimos 6, em chips), a rosca com o total no meio, a
// comparação com o mês anterior e a lista das categorias com a parte de cada uma e o teto do mês, quando houver.
// Tocar numa categoria abre, logo abaixo dela, os lançamentos dela no mês (e a rosca mostra só ela no meio).
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, CartaoLista, MARGEM, Topo } from '@/components/bancos/comum';
import { BarraProgresso, Rosca } from '@/components/graficos';
import { Botao, Chips, comAlfa, Dinheiro, Icone, IconeCategoria, Logo, LuzDeFundo, Secao, Separador, Texto, Tocavel, useDizerValor, Vazio, type OpcaoChip } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { chaveMes, dataRelativa, diasNoMes, dinheiro, mesAnterior, mesNome, porcento, soma } from '@/lib/formato';
import { useEstado, useOculto, type Categoria, type Lanc } from '@/lib/motor';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const POR_VEZ = 6; // lançamentos que aparecem de cara quando a categoria abre

type Grupo = { id: string; cat: Categoria; valor: number; itens: Lanc[] };

export default function Categorias() {
  const dizer = useDizerValor();
  const c = useCores();
  const ins = useSafeAreaInsets();
  const e = useEstado();
  const reduzir = useReducedMotion();
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((ev) => { rolagem.set(ev.contentOffset.y); });

  const atual = chaveMes();
  const meses = useMemo(() => { const m = [atual]; while (m.length < 6) m.push(mesAnterior(m[m.length - 1])); return m; }, [atual]);
  const [mes, setMes] = useState(atual);
  const [aberta, setAberta] = useState<string | null>(null);

  const P = e?.pessoal ?? null;
  const dados = useMemo(() => {
    const lanc = P?.lanc ?? [];
    const outros: Categoria = { id: 'outros', nome: 'Outros', cor: c.apoio, ink: c.apoio, ic: 'more' };
    const catDe = (id: string) => e?.categorias.find((x) => x.id === id) ?? e?.catEntrada.find((x) => x.id === id) ?? { ...outros, id };
    const saidas = lanc.filter((l) => l.tipo !== 'entrada');
    const doMes = saidas.filter((l) => l.data.slice(0, 7) === mes);
    const mapa = new Map<string, Grupo>();
    doMes.forEach((l) => {
      const g = mapa.get(l.cat);
      if (g) { g.valor += l.valor; g.itens.push(l); } else mapa.set(l.cat, { id: l.cat, cat: catDe(l.cat), valor: l.valor, itens: [l] });
    });
    const grupos = [...mapa.values()].sort((a, z) => z.valor - a.valor);
    grupos.forEach((g) => g.itens.sort((a, z) => (a.data < z.data ? 1 : a.data > z.data ? -1 : z.valor - a.valor)));
    const total = soma(doMes, (l) => l.valor);
    // comparação: o mês de agora vai até hoje, então compara com o mês anterior até o mesmo dia
    const antes = mesAnterior(mes);
    const ateDia = mes === atual ? Math.min(new Date().getDate(), diasNoMes(antes)) : 31;
    const totalAntes = soma(saidas.filter((l) => l.data.slice(0, 7) === antes && Number(l.data.slice(8, 10)) <= ateDia), (l) => l.valor);
    return { grupos, total, totalAntes, antes };
  }, [P, e?.categorias, e?.catEntrada, mes, atual, c.apoio]);

  const opcoes: OpcaoChip<string>[] = meses.map((k) => {
    const ano = Number(k.slice(0, 4));
    return { id: k, nome: ano === new Date().getFullYear() ? maiuscula(mesNome(k)) : `${maiuscula(mesNome(k, true))}. ${ano}` };
  });
  const trocarMes = (k: string) => { setMes(k); setAberta(null); };
  const selecionada = dados.grupos.find((g) => g.id === aberta) ?? null;

  let corpo;
  if (!P) {
    corpo = (
      <View style={estilos.centro}>
        <Vazio
          icone="categoria"
          titulo="O Pessoal está desligado"
          texto="Ligue a área Pessoal nos ajustes do Avina para ver para onde vai o seu dinheiro, separado por categoria."
          acao={{ titulo: 'Abrir os ajustes', icone: 'configuracoes', onPress: () => abrirNoSiteDaqui({ tela: 'ajustes' }, 'ajustes') }}
        />
      </View>
    );
  } else {
    corpo = (
      <>
        <Chips opcoes={opcoes} valor={mes} onTrocar={trocarMes} rotulo="Mês" margem={MARGEM} style={{ marginHorizontal: -MARGEM, flexGrow: 0 }} />
        {dados.grupos.length ? (
          <>
            <Animated.View key={mes} entering={reduzir ? undefined : FadeIn.duration(260)} style={estilos.grafico}>
              <Rosca
                segmentos={fatias(dados.grupos, dados.total, aberta, c.fraco)}
                tamanho={236}
                espessura={24}
                espaco={5}
                rotulo={`Gastos de ${mesNome(mes)}: ${dizer(dados.total)}. ${dados.grupos.map((g) => `${g.cat.nome} ${porcento(g.valor / dados.total)}`).join(', ')}`}>
                {selecionada ? (
                  <View style={estilos.meio}>
                    <Texto v="apoio" numberOfLines={1} style={{ maxWidth: 150 }}>{selecionada.cat.nome}</Texto>
                    <Dinheiro valor={selecionada.valor} tamanho={26} />
                    <Texto v="apoio" cor={c.texto} style={{ fontFamily: Fontes.textoForte }}>{porcento(selecionada.valor / dados.total)} do mês</Texto>
                  </View>
                ) : (
                  <View style={estilos.meio}>
                    <Texto v="apoio">Gastos de {mesNome(mes)}</Texto>
                    <Dinheiro valor={dados.total} tamanho={26} />
                    <Texto v="apoio">{dados.grupos.length === 1 ? '1 categoria' : `${dados.grupos.length} categorias`}</Texto>
                  </View>
                )}
              </Rosca>
              <Comparacao total={dados.total} antes={dados.totalAntes} mesAntes={dados.antes} parcial={mes === atual} />
            </Animated.View>

            <Secao titulo="Categorias">
              <CartaoLista>
                {dados.grupos.map((g, i) => (
                  <Animated.View key={g.id} layout={reduzir ? undefined : LinearTransition.duration(240)}>
                    {i ? <Separador recuo={56} /> : null}
                    <LinhaCategoria
                      g={g}
                      total={dados.total}
                      teto={P.limites[g.id]}
                      aberta={aberta === g.id}
                      aoTocar={() => setAberta(aberta === g.id ? null : g.id)}
                    />
                  </Animated.View>
                ))}
              </CartaoLista>
            </Secao>
          </>
        ) : (
          <View style={[estilos.centro, { paddingTop: Espaco.oito }]}>
            <Vazio
              icone="categoria"
              titulo={`Nenhum gasto em ${mesNome(mes)}`}
              texto="Os gastos anotados aparecem aqui, separados por categoria."
              acao={mes === atual ? { titulo: 'Anotar gasto', icone: 'mais', onPress: () => router.push('/novo') } : undefined}
            />
          </View>
        )}
      </>
    );
  }

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <LuzDeFundo />
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: ins.top + ALTURA_TOPO + Espaco.dois, paddingBottom: ins.bottom + Espaco.oito, paddingHorizontal: MARGEM, gap: Espaco.seis, flexGrow: 1 }}>
        {corpo}
      </Animated.ScrollView>
      <Topo titulo="Gastos por categoria" rolagem={rolagem} />
    </View>
  );
}

// As partes da rosca: cada categoria tem pelo menos 5,5% da volta (as bem pequenas viravam um pontinho em cima da
// vizinha); passando de 8 categorias, as menores viram uma parte só. A lista embaixo mostra os valores de verdade.
function fatias(grupos: Grupo[], total: number, aberta: string | null, corResto: string) {
  const MAX = 8;
  const principais = grupos.length > MAX ? grupos.slice(0, MAX - 1) : grupos;
  const resto = grupos.length > MAX ? grupos.slice(MAX - 1) : [];
  const partes = principais.map((g) => ({ id: g.id, valor: g.valor, cor: g.cat.cor, nome: g.cat.nome }));
  if (resto.length) partes.push({ id: 'resto', valor: soma(resto, (g) => g.valor), cor: corResto, nome: 'Outras' });
  const destaque = aberta && resto.some((g) => g.id === aberta) ? 'resto' : aberta;
  return partes.map((p) => ({
    id: p.id,
    valor: Math.max(p.valor, total * 0.055),
    cor: !destaque || destaque === p.id ? p.cor : comAlfa(p.cor, 0.22),
    rotulo: `${p.nome} ${porcento(total ? p.valor / total : 0)}`,
  }));
}

// "12% a menos que outubro até o mesmo dia" (menta) ou "8% a mais que outubro" (vermelho)
function Comparacao({ total, antes, mesAntes, parcial }: { total: number; antes: number; mesAntes: string; parcial: boolean }) {
  const c = useCores();
  const oculto = useOculto();
  if (antes <= 0) return <Texto v="apoio" style={{ textAlign: 'center' }}>{maiuscula(mesNome(mesAntes))} não tem gastos para comparar</Texto>;
  const dif = (total - antes) / antes;
  const igual = Math.abs(dif) < 0.005;
  const cor = igual ? c.apoio : dif > 0 ? c.negativo : c.positivo;
  const quando = `${mesNome(mesAntes)}${parcial ? ' até o mesmo dia' : ''}`;
  const texto = igual ? `O mesmo que ${quando}` : `${porcento(Math.abs(dif))} a ${dif > 0 ? 'mais' : 'menos'} que ${quando}`;
  return (
    <View style={[estilos.comparacao, { backgroundColor: comAlfa(cor, c.escuro ? 0.14 : 0.1) }]} accessible accessibilityLabel={`${texto}${oculto ? '' : `: ${dinheiro(antes)} em ${mesNome(mesAntes)}`}`}>
      {!igual ? <Icone nome={dif > 0 ? 'setaCima' : 'setaBaixo'} tamanho={13} cor={cor} peso="bold" /> : null}
      <Texto cor={cor} numberOfLines={1} style={estilos.comparacaoTexto}>{texto}</Texto>
    </View>
  );
}

function LinhaCategoria({ g, total, teto, aberta, aoTocar }: { g: Grupo; total: number; teto?: number; aberta: boolean; aoTocar: () => void }) {
  const dizer = useDizerValor();
  const c = useCores();
  const reduzir = useReducedMotion();
  const oculto = useOculto();
  const [todos, setTodos] = useState(false);
  const giro = useSharedValue(aberta ? 1 : 0);
  useEffect(() => { giro.set(reduzir ? (aberta ? 1 : 0) : withTiming(aberta ? 1 : 0, { duration: 220 })); }, [aberta, reduzir, giro]);
  const seta = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.get() * 180}deg` }] }));

  const parte = total > 0 ? g.valor / total : 0;
  const n = g.itens.length;
  const temTeto = !!teto && teto > 0;
  const passou = temTeto && g.valor > teto!;
  const resto = temTeto ? teto! - g.valor : 0;
  const linhaTeto = !temTeto ? null : oculto
    ? (passou ? 'Passou do teto' : `${porcento(g.valor / teto!)} do teto`)
    : passou ? `Passou ${dinheiro(-resto)} do teto de ${dinheiro(teto!, { centavos: false })}` : `Faltam ${dinheiro(resto)} para o teto de ${dinheiro(teto!, { centavos: false })}`;
  const visiveis = todos ? g.itens : g.itens.slice(0, POR_VEZ);

  return (
    <View>
      <Tocavel
        onPress={aoTocar}
        escala={0.985}
        accessibilityLabel={`${g.cat.nome}: ${dizer(g.valor)}, ${porcento(parte)} do mês, ${n === 1 ? '1 lançamento' : `${n} lançamentos`}${linhaTeto ? `. ${linhaTeto}` : ''}`}
        accessibilityHint={aberta ? 'Fecha os lançamentos' : 'Mostra os lançamentos'}
        accessibilityState={{ expanded: aberta }}
        style={estilos.linha}>
        <IconeCategoria cat={g.cat} tamanho={44} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={estilos.linhaTopo}>
            <Texto v="forte" numberOfLines={1} style={{ flex: 1, fontSize: 16, lineHeight: 21 }}>{g.cat.nome}</Texto>
            <Dinheiro valor={g.valor} tamanho={16} animar={false} />
          </View>
          <View style={estilos.linhaTopo}>
            <Texto v="apoio" numberOfLines={1} style={{ flex: 1 }}>{n === 1 ? '1 lançamento' : `${n} lançamentos`} · {porcento(parte)}</Texto>
            <Animated.View style={seta}>
              <Icone nome="chevronBaixo" tamanho={12} cor={c.fraco} peso="bold" />
            </Animated.View>
          </View>
          {temTeto ? (
            <View style={{ gap: 5, marginTop: 4 }}>
              <BarraProgresso progresso={g.valor / teto!} cor={g.cat.cor} altura={6} rotulo={linhaTeto ?? undefined} />
              <Texto v="apoio" numberOfLines={1} cor={passou ? c.negativo : c.apoio} style={{ fontSize: 12, lineHeight: 16, fontFamily: passou ? Fontes.textoForte : Fontes.texto }}>{linhaTeto}</Texto>
            </View>
          ) : null}
        </View>
      </Tocavel>
      {aberta ? (
        <Animated.View entering={reduzir ? undefined : FadeInDown.duration(220)} style={[estilos.abertos, { backgroundColor: c.cartao2 }]}>
          {visiveis.map((l, i) => (
            <View key={l.id}>
              {i ? <Separador recuo={48} /> : null}
              <Tocavel
                onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: l.id } })}
                escala={0.985}
                accessibilityLabel={`${l.desc || g.cat.nome}, ${dataRelativa(l.data)}: ${dizer(l.valor)}${l.banco ? `, ${l.banco}` : ''}`}
                style={estilos.lanc}>
                <Logo marca={l.marca} site={l.site} nome={l.desc} cat={g.cat} banco={l.banco} tamanho={36} anel={c.cartao2} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Texto v="forte" numberOfLines={1} style={{ fontSize: 15 }}>{l.desc || g.cat.nome}</Texto>
                  <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{[dataRelativa(l.data), l.banco].filter(Boolean).join(' · ')}</Texto>
                </View>
                <Dinheiro valor={l.valor} tamanho={15} animar={false} />
              </Tocavel>
            </View>
          ))}
          {n > POR_VEZ ? (
            <Botao
              titulo={todos ? 'Mostrar menos' : `Ver todos os ${n}`}
              variante="texto"
              tamanho="pequeno"
              icone={todos ? 'setaCima' : 'chevronBaixo'}
              onPress={() => setTodos(!todos)}
              style={{ alignSelf: 'center', marginTop: Espaco.um }}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center' },
  grafico: { alignItems: 'center', gap: Espaco.quatro, paddingTop: Espaco.dois },
  meio: { alignItems: 'center', gap: 2 },
  comparacao: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 12, borderRadius: Raio.pilula, maxWidth: '100%' },
  comparacaoTexto: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 17, flexShrink: 1 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.tres, paddingVertical: Espaco.tres + 2, minHeight: 68 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois },
  abertos: { borderRadius: Raio.medio, borderCurve: 'continuous', paddingHorizontal: Espaco.tres, paddingVertical: Espaco.um, marginBottom: Espaco.tres },
  lanc: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 56, paddingVertical: Espaco.dois },
});
