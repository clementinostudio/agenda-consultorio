// Os cartões do Pessoal e do banco no Início (os "widgets" que a pessoa escolhe em /widgets, lib/widgets.ts):
// saldo em contas, gastos do mês, categorias, transações recentes, fluxo de caixa, próximas contas, tetos e caixinhas.
// Cada um lê o retrato do site (useEstado) já resumido (resumirMes, em comum.tsx) e abre a tela que aprofunda.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Aneis, Anel, BarraProgresso, BarraSegmentada, GraficoArea } from '@/components/graficos';
import { maiuscula, quandoVence, useCurto, ValorCurto, type ResumoMes } from '@/components/inicio/comum';
import {
  Botao, Cartao, CartaoTitulo, comAlfa, corDoBanco, Dinheiro, Esqueleto, Icone, IconeCategoria, Linha, Logo, LogoBanco, Pilula, Separador, Texto, Tocavel, useDizerValor,
} from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { totaisBanco, useBanco } from '@/hooks/use-banco';
import { dataRelativa, diasAte, dinheiro, haQuanto, mesAnterior, mesNome, porcento } from '@/lib/formato';
import { abrirNoSite, useEstado, useRecurso, type Categoria, type Estado } from '@/lib/motor';

// os cartões de meia largura têm um pouco menos de borda: sobra espaço para o valor num iPhone pequeno
const MEIA = Espaco.quatro + 2;

const categoriaDe = (e: Estado | null, id: string): Categoria | null =>
  e?.categorias.find((x) => x.id === id) ?? e?.catEntrada.find((x) => x.id === id) ?? null;

/* ---------- Saldo em contas (Open Finance) ---------- */

export function CartaoBancos() {
  const dizer = useDizerValor();
  const c = useCores();
  const b = useBanco();
  const t = totaisBanco(b.resumo);
  const conectados = b.resumo?.bancos ?? [];

  // carregando pela primeira vez: o esqueleto do cartão
  if (!b.resumo && b.carregando) {
    return (
      <Cartao>
        <CartaoTitulo rotulo="Saldo em contas" />
        <Esqueleto largura={170} altura={34} raio={10} />
        <Esqueleto altura={12} raio={6} style={{ marginTop: Espaco.dois }} />
        <Esqueleto largura="60%" altura={14} style={{ marginTop: Espaco.dois }} />
      </Cartao>
    );
  }
  if (!b.resumo) {
    return (
      <Cartao>
        <CartaoTitulo rotulo="Saldo em contas" />
        <Texto v="apoio" style={{ fontSize: 14, lineHeight: 20 }}>Não deu para ler os saldos agora. Confira a internet e tente de novo.</Texto>
        <Botao titulo="Tentar de novo" icone="atualizar" variante="secundario" tamanho="pequeno" carregando={b.carregando} onPress={() => { b.recarregar(); }} style={{ marginTop: Espaco.dois }} />
      </Cartao>
    );
  }
  if (!conectados.length) {
    return (
      <Cartao onPress={() => router.push('/bancos')} rotulo="Conectar banco. Veja os saldos de todas as contas aqui">
        <CartaoTitulo rotulo="Saldo em contas" icone="banco" tocavel />
        <Texto v="subtitulo" style={{ marginTop: Espaco.um }}>Conecte seu banco</Texto>
        <Texto v="apoio" style={{ fontSize: 14, lineHeight: 20 }}>Os saldos de todas as contas num lugar só, pelo Open Finance. Só leitura: nada sai da sua conta.</Texto>
        <View style={[estilos.cta, { backgroundColor: c.azul }]}>
          <Icone nome="mais" tamanho={16} cor="#FFFFFF" peso="bold" />
          <Texto cor="#FFFFFF" style={estilos.ctaTexto}>Conectar banco</Texto>
        </View>
      </Cartao>
    );
  }

  // soma por banco (as contas; os cartões ficam no carrossel)
  const porBanco = new Map<string, { nome: string; saldo: number; itemId: string }>();
  t.contas.forEach((k) => {
    const g = porBanco.get(k.banco);
    if (g) g.saldo += k.saldo; else porBanco.set(k.banco, { nome: k.banco, saldo: k.saldo, itemId: k.itemId });
  });
  const linhas = [...porBanco.values()].sort((a, z) => z.saldo - a.saldo);
  const base = linhas.reduce((s, x) => s + Math.max(0, x.saldo), 0);
  return (
    <Cartao onPress={() => router.push('/bancos')} rotulo={`Saldo em contas, ${dizer(t.emConta)}. Abre os bancos`}>
      <CartaoTitulo rotulo="Saldo em contas" tocavel />
      <Dinheiro valor={t.emConta} tamanho={34} />
      <BarraSegmentada
        segmentos={linhas.map((x) => ({ id: x.nome, valor: Math.max(0, x.saldo), cor: corDoBanco(x.nome), rotulo: `${x.nome} ${dinheiro(x.saldo)}` }))}
        altura={10}
        style={{ marginTop: Espaco.dois, marginBottom: Espaco.um }}
      />
      {linhas.map((x) => {
        const quando = haQuanto(conectados.find((k) => k.id === x.itemId)?.atualizado);
        return (
          <View key={x.nome} style={estilos.banco}>
            <LogoBanco banco={x.nome} tamanho={40} />
            <View style={{ flex: 1, gap: 1 }}>
              <Texto v="forte" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>{x.nome}</Texto>
              <Texto v="apoio" numberOfLines={1}>{quando ? `Atualizado ${quando}` : 'Conectado'}</Texto>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 1 }}>
              <Dinheiro valor={x.saldo} tamanho={16} animar={false} />
              <Texto v="apoio">{base > 0 ? porcento(Math.max(0, x.saldo) / base) : '—'}</Texto>
            </View>
          </View>
        );
      })}
      {t.pedeAutorizar.length ? <Pilula texto={`Reconectar ${t.pedeAutorizar.map((x) => x.nome).join(', ')}`} cor={c.ambar} icone="alerta" style={{ marginTop: Espaco.um }} /> : null}
    </Cartao>
  );
}

/* ---------- Gastos do mês (gráfico) ---------- */

export function CartaoGastosMes({ r }: { r: ResumoMes }) {
  const dizer = useDizerValor();
  const c = useCores();
  const curto = mesNome(r.mes, true);
  const dif = r.mesmoDiaAntes > 0 ? (r.ateHoje - r.mesmoDiaAntes) / r.mesmoDiaAntes : null;
  const igual = dif != null && Math.abs(dif) < 0.005;
  const frase = dif == null ? 'O mês passado não tem gastos para comparar'
    : igual ? 'O mesmo que no mesmo dia do mês passado'
    : `${porcento(Math.abs(dif))} a ${dif > 0 ? 'mais' : 'menos'} que no mesmo dia do mês passado`;
  const tinta = dif == null || igual ? c.apoio : dif > 0 ? c.negativo : c.positivo;
  return (
    <Cartao>
      <Tocavel onPress={() => router.push('/categorias')} accessibilityLabel={`Gastos de ${mesNome(r.mes)}, ${dizer(r.ateHoje)}. ${frase}. Abre os gastos por categoria`} escala={0.985} style={{ gap: Espaco.dois }}>
        <CartaoTitulo rotulo={`Gastos de ${mesNome(r.mes)}`} tocavel />
        <Dinheiro valor={r.ateHoje} tamanho={34} />
        <View style={estilos.comparar}>
          {dif != null && !igual ? (
            <View style={[estilos.seta, { backgroundColor: comAlfa(tinta, c.escuro ? 0.16 : 0.12) }]}>
              <Icone nome={dif > 0 ? 'setaCima' : 'setaBaixo'} tamanho={11} cor={tinta} peso="bold" />
            </View>
          ) : null}
          <Texto v="apoio" numberOfLines={2} cor={tinta === c.apoio ? c.apoio : tinta} style={{ flex: 1, fontFamily: Fontes.textoForte }}>{frase}</Texto>
        </View>
      </Tocavel>
      <GraficoArea
        serie={r.serie}
        comparacao={r.comparacao}
        dias={r.dias}
        altura={128}
        rotuloDia={(i) => `${i + 1} de ${curto}.`}
        rotuloComparacao={maiuscula(mesNome(mesAnterior(r.mes)))}
        style={{ marginTop: Espaco.tres, marginHorizontal: -Espaco.um }}
      />
      <View style={estilos.legenda}>
        <View style={estilos.legendaItem}>
          <View style={[estilos.legendaLinha, { backgroundColor: c.azul }]} />
          <Texto v="apoio" style={estilos.legendaTexto}>{maiuscula(mesNome(r.mes))}</Texto>
        </View>
        <View style={estilos.legendaItem}>
          <View style={[estilos.legendaTraco, { borderColor: c.apoio }]} />
          <Texto v="apoio" style={estilos.legendaTexto}>{maiuscula(mesNome(mesAnterior(r.mes)))}</Texto>
        </View>
        <Texto v="apoio" style={[estilos.legendaTexto, { marginLeft: 'auto' }]}>1–{r.dias} {curto}</Texto>
      </View>
    </Cartao>
  );
}

/* ---------- Gastos por categoria ---------- */

export function CartaoCategorias({ r }: { r: ResumoMes }) {
  const dizer = useDizerValor();
  const c = useCores();
  const e = useEstado();
  const total = r.porCat.reduce((s, x) => s + x.valor, 0);
  const cats = r.porCat.map((x) => ({ ...x, k: categoriaDe(e, x.id) }));
  const n = cats.length;
  return (
    <Cartao onPress={() => router.push('/categorias')} rotulo={`Gastos por categoria em ${mesNome(r.mes)}, ${dizer(total)}. Abre a lista completa`}>
      <CartaoTitulo rotulo={`Gastos por categoria · ${mesNome(r.mes)}`} tocavel />
      <Dinheiro valor={total} tamanho={34} />
      {n ? (
        <>
          <BarraSegmentada
            segmentos={cats.map((x) => ({ id: x.id, valor: x.valor, cor: x.k?.cor ?? c.fraco, rotulo: `${x.k?.nome ?? 'Outros'} ${dinheiro(x.valor)}` }))}
            altura={12}
            style={{ marginTop: Espaco.dois }}
          />
          <View style={estilos.cats}>
            {cats.slice(0, 4).map((x) => (
              <View key={x.id} style={estilos.cat}>
                <IconeCategoria cat={x.k ?? x.id} tamanho={34} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Texto v="apoio" numberOfLines={1}>{x.k?.nome ?? 'Outros'} · {porcento(x.valor / total)}</Texto>
                  <ValorCurto valor={x.valor} tamanho={15} />
                </View>
              </View>
            ))}
          </View>
          <Texto v="apoio" style={{ alignSelf: 'flex-end' }}>{n === 1 ? '1 categoria' : `${n} categorias`}</Texto>
        </>
      ) : (
        <Texto v="apoio" style={{ fontSize: 14 }}>Nenhum gasto em {mesNome(r.mes)} ainda.</Texto>
      )}
    </Cartao>
  );
}

/* ---------- Transações recentes ---------- */

export function CartaoRecentes({ r, aoVerTudo }: { r: ResumoMes; aoVerTudo: () => void }) {
  const c = useCores();
  const e = useEstado();
  const n = r.doMes.length;
  return (
    <Cartao onPress={aoVerTudo} rotulo={`Transações recentes: ${n} em ${mesNome(r.mes)}. Abre as atividades`} padding={Espaco.cinco}>
      <CartaoTitulo rotulo="Transações recentes" tocavel />
      <View style={estilos.contagem}>
        <Texto v="numero" style={{ fontSize: 30, lineHeight: 36 }}>{n}</Texto>
        <Texto v="apoio" style={{ fontSize: 14 }}>{n === 1 ? 'movimentação' : 'movimentações'} em {mesNome(r.mes)}</Texto>
      </View>
      <View style={{ marginTop: Espaco.um }}>
        {r.recentes.map((l, i) => {
          const k = categoriaDe(e, l.cat);
          return (
            <View key={l.id}>
              {i ? <Separador recuo={56} /> : null}
              <Linha
                titulo={l.desc}
                sub={`${dataRelativa(l.data)}${k ? ` · ${k.nome}` : ''}`}
                sub2={l.banco ?? undefined}
                esquerda={<Logo marca={l.marca} site={l.site} nome={l.desc} cat={k ?? l.cat} banco={l.banco} tamanho={44} anel={c.cartao} />}
                valor={l.valor}
                tipo={l.tipo}
              />
            </View>
          );
        })}
      </View>
    </Cartao>
  );
}

/* ---------- Fluxo de caixa e próximas contas (meia largura) ---------- */

export function CartaoFluxo({ r, aoVerTudo }: { r: ResumoMes; aoVerTudo: () => void }) {
  const dizer = useDizerValor();
  const c = useCores();
  const maior = Math.max(r.entrou, r.saiu, 1);
  return (
    <Cartao onPress={aoVerTudo} rotulo={`Fluxo de caixa: entrou ${dizer(r.entrou)}, saiu ${dizer(r.saiu)}. Abre as atividades`} padding={MEIA} style={estilos.meia}>
      <CartaoTitulo rotulo="Fluxo de caixa" tocavel />
      <View style={{ gap: 2, marginTop: Espaco.um }}>
        <Texto v="apoio" style={{ fontSize: 12 }}>Entrou</Texto>
        <ValorCurto valor={r.entrou} cor={c.positivo} tamanho={21} sinal />
      </View>
      <View style={{ gap: 2 }}>
        <Texto v="apoio" style={{ fontSize: 12 }}>Saiu</Texto>
        <ValorCurto valor={-r.saiu} cor={c.negativo} tamanho={21} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ gap: 6 }}>
        <BarraProgresso progresso={r.entrou / maior} cor={c.positivo} altura={9} fundo={comAlfa(c.positivo, c.escuro ? 0.1 : 0.08)} rotulo="Entrou" />
        <BarraProgresso progresso={r.saiu / maior} cor={c.negativo} altura={9} fundo={comAlfa(c.negativo, c.escuro ? 0.1 : 0.08)} rotulo="Saiu" />
      </View>
    </Cartao>
  );
}

export function CartaoContas({ r }: { r: ResumoMes }) {
  const dizer = useDizerValor();
  const c = useCores();
  const curto = useCurto();
  const nativa = useRecurso('contas2');
  const [proxima, ...outras] = r.contasAbertas;
  // a tela nativa de Contas fixas, quando o site atende; senão, as contas no site
  const abrir = () => (nativa ? router.push('/contas') : abrirNoSite({ area: 'pessoal', tela: 'contas' }));
  if (!proxima) {
    return (
      <Cartao onPress={abrir} rotulo="Contas a pagar: tudo pago este mês. Abre as contas" padding={MEIA} style={estilos.meia}>
        <CartaoTitulo rotulo="A pagar" tocavel />
        <View style={{ flex: 1 }} />
        <View style={[estilos.ok, { backgroundColor: comAlfa(c.positivo, c.escuro ? 0.16 : 0.12) }]}>
          <Icone nome="check" tamanho={20} cor={c.positivo} peso="bold" />
        </View>
        <Texto v="forte" style={{ fontSize: 16 }}>Tudo pago</Texto>
        <Texto v="apoio">As contas fixas de {mesNome(r.mes)} estão em dia.</Texto>
      </Cartao>
    );
  }
  const d = diasAte(proxima.vence, r.hoje);
  const cor = d < 0 ? c.negativo : d <= 3 ? c.ambar : c.apoio;
  return (
    <Cartao onPress={abrir} rotulo={`Próxima conta: ${proxima.nome}, ${dizer(proxima.valor)}, ${quandoVence(proxima.vence, r.hoje)}. Abre as contas`} padding={MEIA} style={estilos.meia}>
      <CartaoTitulo rotulo="A pagar" tocavel />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.dois, marginTop: Espaco.um }}>
        <Logo marca={proxima.marca} site={proxima.site} nome={proxima.nome} cat={proxima.cat} tamanho={32} />
        <Texto v="forte" numberOfLines={1} style={{ flex: 1 }}>{proxima.nome}</Texto>
      </View>
      <ValorCurto valor={proxima.valor} tamanho={21} />
      <Pilula texto={quandoVence(proxima.vence, r.hoje)} cor={cor === c.apoio ? undefined : cor} icone={d < 0 ? 'alerta' : 'calendario'} />
      <View style={{ flex: 1 }} />
      {outras.slice(0, 2).map((x) => (
        <View key={x.id} style={estilos.outra}>
          <Texto v="apoio" numberOfLines={1} style={{ flex: 1 }}>{x.nome}</Texto>
          <Texto v="apoio" cor={c.texto} style={{ fontFamily: Fontes.textoForte }}>{curto(x.valor)}</Texto>
        </View>
      ))}
    </Cartao>
  );
}

/* ---------- Tetos do mês ---------- */

export function CartaoTetos({ r }: { r: ResumoMes }) {
  const c = useCores();
  const e = useEstado();
  const curto = useCurto();
  const gasto = new Map(r.porCat.map((x) => [x.id, x.valor]));
  const tetos = Object.entries(e?.pessoal?.limites ?? {})
    .filter(([, teto]) => teto > 0)
    .map(([id, teto]) => ({ id, teto, gasto: gasto.get(id) ?? 0, k: categoriaDe(e, id) }))
    .sort((a, z) => z.gasto / z.teto - a.gasto / a.teto)
    .slice(0, 3);
  if (!tetos.length) return null;
  return (
    <Cartao onPress={() => router.push('/categorias')} rotulo="Tetos do mês. Abre os gastos por categoria">
      <CartaoTitulo rotulo="Tetos do mês" tocavel />
      <View style={estilos.tetos}>
        <Aneis
          aneis={tetos.map((t) => ({ progresso: t.gasto / t.teto, cor: t.k?.cor ?? c.azul, corExcedido: c.negativo, rotulo: t.k?.nome ?? 'Categoria' }))}
          tamanho={124}
          espessura={13}
          espaco={3}
        />
        <View style={{ flex: 1, gap: Espaco.tres }}>
          {tetos.map((t) => {
            const p = t.gasto / t.teto;
            const passou = p > 1;
            return (
              <View key={t.id} style={{ gap: 1 }}>
                <View style={estilos.tetoTopo}>
                  <View style={[estilos.ponto, { backgroundColor: passou ? c.negativo : t.k?.cor ?? c.azul }]} />
                  <Texto v="forte" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>{t.k?.nome ?? 'Categoria'}</Texto>
                  <Texto style={[estilos.pct, { color: passou ? c.negativo : c.texto }]}>{porcento(p)}</Texto>
                </View>
                <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5, paddingLeft: 16 }}>
                  {passou ? `${curto(t.gasto - t.teto)} acima do teto` : `${curto(t.gasto)} de ${curto(t.teto)}`}
                </Texto>
              </View>
            );
          })}
        </View>
      </View>
    </Cartao>
  );
}

/* ---------- Caixinhas ---------- */

export function CartaoCaixinhas() {
  const dizer = useDizerValor();
  const c = useCores();
  const e = useEstado();
  const curto = useCurto();
  const lista = e?.pessoal?.caixinhas ?? [];
  if (!lista.length) return null;
  const total = lista.reduce((s, k) => s + k.guardado, 0);
  const tons = [c.menta, c.azul, c.roxo, c.ciano];
  return (
    <Cartao>
      <CartaoTitulo rotulo="Caixinhas" />
      <Dinheiro valor={total} tamanho={30} />
      <Texto v="apoio" style={{ marginTop: -4 }}>guardados em {lista.length === 1 ? '1 caixinha' : `${lista.length} caixinhas`}</Texto>
      <View style={{ marginTop: Espaco.dois }}>
        {lista.slice(0, 4).map((k, i) => {
          const p = k.meta ? k.guardado / k.meta : 0;
          const cor = tons[i % tons.length];
          return (
            <View key={k.id}>
              {i ? <Separador recuo={64} /> : null}
              <Tocavel
                onPress={() => abrirNoSite({ area: 'pessoal', acao: 'caixinha', id: k.id })}
                accessibilityLabel={`${k.nome}: ${dizer(k.guardado)}${k.meta ? ` de ${dizer(k.meta)}, ${porcento(p)}` : ''}. Abre a caixinha`}
                escala={0.985}
                style={estilos.caixinha}>
                <Anel progresso={p} cor={cor} tamanho={50} espessura={5} fundo={k.meta ? undefined : c.cartao2}>
                  <Text allowFontScaling={false} style={{ fontSize: 20 }}>{k.emoji || '🛟'}</Text>
                </Anel>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto v="forte" numberOfLines={1}>{k.nome}</Texto>
                  <Texto v="apoio" numberOfLines={1}>{k.meta ? `${curto(k.guardado)} de ${curto(k.meta)}` : `${curto(k.guardado)} guardados`}</Texto>
                </View>
                {k.meta ? <Texto style={[estilos.pct, { color: cor }]}>{porcento(Math.min(p, 9.99))}</Texto> : null}
                <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" />
              </Tocavel>
            </View>
          );
        })}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 40, paddingHorizontal: 16, borderRadius: 20, marginTop: Espaco.dois },
  ctaTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
  banco: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 58 },
  comparar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seta: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: Espaco.quatro, marginTop: Espaco.dois },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaLinha: { width: 14, height: 3, borderRadius: 2 },
  legendaTraco: { width: 14, borderTopWidth: 2, borderStyle: 'dashed' },
  legendaTexto: { fontSize: 12, lineHeight: 16 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Espaco.quatro, columnGap: Espaco.tres, marginTop: Espaco.tres },
  cat: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois, width: '47%' },
  contagem: { flexDirection: 'row', alignItems: 'baseline', gap: Espaco.dois },
  meia: { flex: 1, minHeight: 214 },
  ok: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  outra: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois },
  tetos: { flexDirection: 'row', alignItems: 'center', gap: Espaco.cinco, marginTop: Espaco.dois },
  tetoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  pct: { fontFamily: Fontes.tituloForte, fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
  caixinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, minHeight: 68, paddingVertical: Espaco.dois },
});
