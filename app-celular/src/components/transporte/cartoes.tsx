// Os cartões da tela de Transporte:
// - CartaoMes: quanto foi com transporte no mês (número grande e a comparação com o mês anterior), as barrinhas dos
//   12 meses (tocar escolhe o mês) e a divisão por tipo numa barra segmentada com a legenda.
// - CartaoCuidados: troca de óleo, rodízio e documentos, do mais perto de vencer ao mais longe, com o "Paguei".
// - CartaoCombustivel: os preços da semana (ANP) na cidade, o que compensa no flex, o último abastecimento contra a
//   média, o posto mais barato perto e os postos onde a pessoa abastece.
// - CartaoCusto: quanto o veículo custa de verdade (12 meses), a FIPE e o "carro ou app?".
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { abrirNoSiteEVoltar, CartaoLista } from '@/components/bancos/comum';
import { BarraProgresso, BarraSegmentada, Barrinhas } from '@/components/graficos';
import { abrirDocumento, abrirGasto, buscarPrecos, editarVeiculoNoSite, usePrecosAgora } from '@/components/transporte/acoes';
import { CirculoTipo, IconeTransp } from '@/components/transporte/icones';
import {
  carroOuApp, combDoVeiculo, cuidadosDo, etanolOuGasolina, infoSub, litros, nomeCurto, ondePreco, partesDoMes, precoLitro, precosDoVeiculo, textoKm, type Cuidado,
} from '@/components/transporte/regras';
import { Botao, BotaoRedondo, Cartao, CartaoTitulo, comAlfa, Dinheiro, Icone, Linha, Logo, mostrarRecado, Pilula, Separador, Texto, Tocavel, useDizerValor, vibrar } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { brlCurto, dataCurta, dinheiro, dm, mesAnterior, mesNome, porcento } from '@/lib/formato';
import { useOculto, type MesTransp, type PrecosANP, type Transporte, type Veiculo } from '@/lib/motor';
import { acharMarca } from '@site/marcas.js';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const NB = '\u00A0'; // o espaço que não quebra a linha ("R$ 3.700" fica junto)
const inteiro = (v: number) => dinheiro(v, { centavos: false }).replace(' ', NB);
const nomeDoMes = (ch: string, hoje: string) => `${mesNome(ch)}${ch.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${ch.slice(0, 4)}` : ''}`;

/* ---------- O gasto do mês ---------- */

export function CartaoMes({ meses, mes, aoEscolher, hoje }: { meses: MesTransp[]; mes: string; aoEscolher: (ch: string) => void; hoje: string }) {
  const c = useCores();
  const oculto = useOculto();
  const dizer = useDizerValor();
  const i = Math.max(0, meses.findIndex((m) => m.chave === mes));
  const m = meses[i];
  const ant = meses.find((x) => x.chave === mesAnterior(mes));
  const total = m?.total ?? 0;
  const partes = partesDoMes(m);
  // a comparação só faz sentido quando o mês anterior teve gasto de verdade (a mesma regra do site)
  const dif = ant && ant.total >= 50 ? total - ant.total : null;
  const corDif = dif == null ? c.apoio : dif > 0 ? c.ambar : c.positivo;
  const textoDif = dif == null ? null : Math.abs(dif) < 1 ? `Igual a ${mesNome(ant!.chave)}` : oculto
    ? `${dif > 0 ? 'Mais' : 'Menos'} que ${mesNome(ant!.chave)} (${porcento(Math.abs(dif) / ant!.total)})`
    : `${brlCurto(Math.abs(dif))} a ${dif > 0 ? 'mais' : 'menos'} que ${mesNome(ant!.chave)}`;
  const agora = mes === hoje.slice(0, 7);
  return (
    <Cartao>
      <CartaoTitulo rotulo={agora ? 'Gasto com transporte no mês' : `Gasto com transporte em ${nomeDoMes(mes, hoje)}`} icone="carro" />
      <Dinheiro valor={total} tamanho={38} style={{ marginTop: 2 }} />
      {textoDif ? (
        <View style={[estilos.dif, { backgroundColor: comAlfa(corDif, c.escuro ? 0.14 : 0.1) }]} accessible accessibilityLabel={textoDif}>
          {Math.abs(dif!) >= 1 ? <Icone nome={dif! > 0 ? 'setaCima' : 'setaBaixo'} tamanho={12} cor={corDif} peso="bold" /> : null}
          <Texto cor={corDif} numberOfLines={1} style={estilos.difTexto}>{textoDif}</Texto>
        </View>
      ) : <Texto v="apoio">{agora ? `Em ${mesNome(mes)}, até agora` : maiuscula(nomeDoMes(mes, hoje))}</Texto>}
      <Barrinhas
        valores={meses.map((x) => x.total)}
        destaque={i}
        cor={c.ciano}
        altura={74}
        rotulos={meses.map((x) => mesNome(x.chave, true))}
        aoTocar={(k) => { if (meses[k]) aoEscolher(meses[k].chave); }}
        formatar={(v) => dizer(v)}
        style={{ marginTop: Espaco.tres }}
      />
      {partes.length ? (
        <View style={{ gap: Espaco.tres, marginTop: Espaco.tres }}>
          <BarraSegmentada segmentos={partes.map((p) => ({ id: p.id, valor: p.total, cor: p.cor, rotulo: `${p.nome}: ${dizer(p.total)}` }))} altura={10} />
          <View style={{ gap: 2 }}>
            {partes.slice(0, 5).map((p) => (
              <View key={p.id} style={estilos.legenda} accessible accessibilityLabel={`${p.nome}: ${dizer(p.total)}, ${porcento(p.total / (total || 1))}, ${p.n === 1 ? '1 gasto' : `${p.n} gastos`}`}>
                <View style={[estilos.ponto, { backgroundColor: p.cor }]} />
                <Texto numberOfLines={1} style={estilos.legendaNome}>{nomeCurto(p.id)}</Texto>
                <Texto v="apoio" style={estilos.legendaPct}>{porcento(p.total / (total || 1))}</Texto>
                <Dinheiro valor={p.total} tamanho={15} animar={false} style={estilos.legendaValor} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Texto v="apoio" style={{ marginTop: Espaco.dois }}>{agora ? 'Nada anotado com transporte neste mês ainda.' : `Nada anotado com transporte em ${mesNome(mes)}.`}</Texto>
      )}
    </Cartao>
  );
}

/* ---------- Os próximos cuidados ---------- */

const ICONE_CUIDADO = { oleo: 'oleo', rodizio: 'pneu', doc: 'documentos' } as const;

function LinhaCuidado({ k, v }: { k: Cuidado; v: Veiculo }) {
  const c = useCores();
  const dizer = useDizerValor();
  const cor = k.st === 'atrasado' ? c.negativo : k.st === 'perto' ? c.ambar : undefined;
  const corIcone = k.tipo === 'oleo' ? '#F59E0B' : k.tipo === 'rodizio' ? '#8B6CFF' : '#64748B';
  const valor = k.doc?.valor ? dizer(k.doc.valor) : null;
  return (
    <View style={estilos.cuidado} accessible={!k.pagavel} accessibilityLabel={`${k.titulo}: ${k.prazo}. ${k.detalhe}${valor ? `. ${valor}` : ''}${k.ultima ? `. ${k.ultima}` : ''}`}>
      <CirculoTipo nome={ICONE_CUIDADO[k.tipo]} cor={cor ?? corIcone} tamanho={42} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={estilos.cuidadoTopo}>
          <Texto v="forte" numberOfLines={1} style={{ flex: 1, fontSize: 16, lineHeight: 21 }}>{k.titulo}</Texto>
          <Pilula texto={k.prazo} cor={cor} icone={k.st === 'atrasado' ? 'alerta' : undefined} />
        </View>
        <Texto v="apoio" numberOfLines={2}>{k.detalhe}{valor ? ` · ${valor}` : ''}</Texto>
        {k.ultima ? <Texto v="apoio" cor={c.fraco} numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17, marginTop: -2 }}>{k.ultima}</Texto> : null}
        {k.progresso != null ? (
          <BarraProgresso progresso={k.progresso} cor={cor ?? c.ciano} altura={6} fundo={c.escuro ? c.cartao3 : c.cartao2} rotulo={`${porcento(k.progresso)} do intervalo até a próxima`} style={{ marginTop: 4 }} />
        ) : null}
        {k.pagavel && k.doc ? (
          <Botao
            titulo="Paguei"
            icone="check"
            variante={k.st === 'ok' ? 'secundario' : 'primario'}
            tamanho="pequeno"
            onPress={() => abrirDocumento(v.id, k.doc!.k)}
            rotulo={`Marcar ${k.titulo} como pago`}
            style={{ marginTop: 6 }}
          />
        ) : null}
      </View>
    </View>
  );
}

export function CartaoCuidados({ v, hoje }: { v: Veiculo; hoje: string }) {
  const c = useCores();
  const lista = cuidadosDo(v, hoje);
  const faltaDoc = v.docs.length < 3;
  const linhas = [
    ...lista.map((k) => ({ id: k.id, el: <LinhaCuidado k={k} v={v} /> })),
    ...(!v.oleo ? [{ id: 'sem-oleo', el: <SemLembrete titulo="Troca de óleo" texto="Anote a última troca e o Avina avisa quando chegar a próxima." nome="oleo" onPress={() => abrirGasto(v.id, 'manutencao', 'oleo')} /> }] : []),
    ...(!v.rodizio ? [{ id: 'sem-rodizio', el: <SemLembrete titulo="Rodízio e alinhamento" texto="A cada 10.000 km ou 12 meses. Anote o último e o Avina lembra." nome="pneu" onPress={() => abrirGasto(v.id, 'manutencao', 'alinhamento')} /> }] : []),
  ];
  return (
    <View style={{ gap: Espaco.dois }}>
      <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secao}>Próximos cuidados</Texto>
      <CartaoLista>
        {linhas.map((x, i) => (
          <View key={x.id}>
            {i ? <Separador recuo={56} /> : null}
            {x.el}
          </View>
        ))}
        {faltaDoc ? (
          <>
            <Separador recuo={56} />
            <Linha
              esquerda={<CirculoTipo nome="documentos" cor={c.apoio} tamanho={42} />}
              titulo={v.docs.length ? 'Mais um vencimento' : 'IPVA, licenciamento e seguro'}
              sub={v.docs.length ? 'Coloque a data dos outros documentos' : 'Coloque as datas e o Avina avisa antes'}
              chevron
              onPress={() => editarVeiculoNoSite(v.id)}
              rotulo="Colocar as datas do IPVA, do licenciamento e do seguro, no Avina completo"
            />
          </>
        ) : null}
      </CartaoLista>
    </View>
  );
}

function SemLembrete({ titulo, texto, nome, onPress }: { titulo: string; texto: string; nome: 'oleo' | 'pneu'; onPress: () => void }) {
  const c = useCores();
  return (
    <View style={estilos.cuidado}>
      <CirculoTipo nome={nome} cor={c.apoio} tamanho={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto v="forte" style={{ fontSize: 16, lineHeight: 21 }}>{titulo}</Texto>
        <Texto v="apoio">{texto}</Texto>
      </View>
      <Tocavel onPress={onPress} escala={0.94} hitSlop={8} accessibilityLabel={`Anotar ${titulo.toLowerCase()}`} style={[estilos.anotar, { backgroundColor: comAlfa(c.azul, c.escuro ? 0.2 : 0.1) }]}>
        <Texto cor={c.azulTinta} style={estilos.anotarTexto}>Anotar</Texto>
      </Tocavel>
    </View>
  );
}

/* ---------- Combustível ---------- */

export function CartaoCombustivel({ v, T }: { v: Veiculo; T: Transporte }) {
  const c = useCores();
  const oculto = useOculto();
  const agora = usePrecosAgora();
  const [buscando, setBuscando] = useState(false);
  // a resposta do "atualizar" vale até o retrato trazer uma igual ou mais nova
  const P: PrecosANP | null = agora && (!T.precos || agora.em > T.precos.em) ? agora : T.precos;
  const precos = P ? precosDoVeiculo(P.p, v.combustivel) : [];
  const flex = !v.combustivel || v.combustivel === 'flex';
  const ver = P && flex ? etanolOuGasolina(P.p) : null;
  const ult = v.ultimoAbast;
  const comb = combDoVeiculo(v, ult?.combustivel);
  const media = ult && P ? P.p[ult.combustivel ?? comb] : undefined;
  const pagou = ult?.precoLitro ?? null;
  const dif = pagou && media ? pagou - media : null;
  const postos = v.postos.filter((p) => p.preco);
  const barato = postos.length > 1 ? postos.reduce((a, b) => ((b.preco ?? 99) < (a.preco ?? 99) ? b : a)) : null;

  const atualizar = async () => {
    if (buscando) return;
    setBuscando(true);
    const r = await buscarPrecos(true);
    setBuscando(false);
    if (r.ok) { vibrar('ok'); if (r.velho) mostrarRecado({ titulo: 'Sem internet agora', texto: 'Ficaram os preços da última busca', icone: 'info', cor: '#FFB648' }); }
    else { vibrar('aviso'); mostrarRecado({ titulo: 'Não deu para atualizar', texto: r.texto, icone: 'info', cor: '#FFB648' }); }
  };
  const postoBarato = () => router.push({ pathname: '/postos', params: { comb: ver?.veredito === 'etanol' ? 'etanol' : comb, consumo: String(v.consumo || '') } });

  return (
    <View style={{ gap: Espaco.dois }}>
      <View style={estilos.secaoLinha}>
        <Texto accessibilityRole="header" cor={c.apoio} style={[estilos.secao, { flex: 1 }]}>Combustível {P ? ondePreco(P) : ''}</Texto>
        {T.cidade ? (
          buscando ? <View style={estilos.girando}><ActivityIndicator color={c.apoio} /></View>
            : <BotaoRedondo icone="atualizar" rotulo="Atualizar os preços da semana" variante="transparente" tamanho={36} cor={c.apoio} onPress={atualizar} />
        ) : null}
      </View>
      <Cartao padding={Espaco.quatro}>
        {P && precos.length ? (
          <>
            <View style={estilos.precos}>
              {precos.map((p) => {
                const melhor = ver && ver.veredito === p.k;
                return (
                  <View key={p.k} accessible accessibilityLabel={`${p.nome}: ${precoLitro(p.valor)} o litro${melhor ? ', compensa mais' : ''}`}
                    style={[estilos.preco, { backgroundColor: melhor ? comAlfa(c.menta, c.escuro ? 0.12 : 0.1) : c.escuro ? c.cartao2 : c.cartao2, borderColor: melhor ? comAlfa(c.menta, 0.5) : 'transparent' }]}>
                    <Texto v="apoio" numberOfLines={1} cor={melhor ? c.menta : c.apoio} style={{ fontSize: 12.5, fontFamily: melhor ? Fontes.textoForte : Fontes.texto }}>{p.nome}</Texto>
                    <Texto numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3} style={estilos.precoValor}>{precoLitro(p.valor)}</Texto>
                  </View>
                );
              })}
            </View>
            {ver ? (
              <View style={[estilos.veredito, { backgroundColor: c.escuro ? c.cartao2 : c.cartao2 }]}>
                <IconeTransp nome="consumo" tamanho={16} cor={ver.veredito === 'tanto-faz' ? c.apoio : c.menta} />
                <Texto v="apoio" style={{ flex: 1 }}>
                  <Texto v="forte" style={{ fontSize: 13 }}>{ver.veredito === 'etanol' ? 'Etanol compensa. ' : ver.veredito === 'gasolina' ? 'Gasolina compensa. ' : 'Tanto faz. '}</Texto>
                  O etanol está custando {porcento(ver.razao)} da gasolina; ele vale a pena abaixo de 70%, porque rende menos.
                </Texto>
              </View>
            ) : null}
            <Texto v="apoio" cor={c.fraco} style={{ fontSize: 12, lineHeight: 16 }}>
              Preço médio da ANP{P.ini && P.fim ? `, semana de ${dm(P.ini)} a ${dm(P.fim)}` : ''}{P.velho ? ' · pode estar desatualizado' : ''}
            </Texto>
          </>
        ) : (
          <View style={{ gap: Espaco.dois }}>
            <Texto v="apoio">{T.cidade ? 'Busque o preço médio da semana na sua cidade (ANP).' : 'Coloque a sua cidade no Perfil do Avina para ver o preço médio da semana (ANP).'}</Texto>
            {T.cidade ? (
              <Botao titulo="Buscar os preços" icone="atualizar" variante="secundario" tamanho="pequeno" carregando={buscando} onPress={atualizar} />
            ) : (
              <Botao titulo="Colocar a cidade" icone="local" variante="secundario" tamanho="pequeno" onPress={() => abrirNoSiteEVoltar({ tela: 'ajustes' }, '/transporte', 'transporte')} rotulo="Colocar a cidade no Perfil, no Avina completo" />
            )}
          </View>
        )}

        {ult ? (
          <>
            <Separador style={{ marginVertical: Espaco.um }} />
            <View style={estilos.ultimo} accessible accessibilityLabel={`Último abastecimento: ${dataCurta(ult.data)}, ${litros(ult.litros)}${pagou ? ` a ${precoLitro(pagou)}` : ''}${dif != null && Math.abs(dif) >= 0.02 ? `, ${precoLitro(Math.abs(dif))} ${dif > 0 ? 'acima' : 'abaixo'} da média` : ''}`}>
              <CirculoTipo sub="combustivel" tamanho={38} />
              <View style={{ flex: 1, gap: 1 }}>
                <Texto v="forte" numberOfLines={1}>Último abastecimento</Texto>
                <Texto v="apoio" numberOfLines={1}>{dataCurta(ult.data)} · {litros(ult.litros)}{ult.km ? ` · ${textoKm(ult.km)}` : ''}</Texto>
                {dif != null ? (
                  <Texto numberOfLines={1} cor={Math.abs(dif) < 0.02 ? c.apoio : dif > 0 ? c.ambar : c.positivo} style={estilos.difMedia}>
                    {Math.abs(dif) < 0.02 ? 'Na média da semana' : `${dif > 0 ? '↑' : '↓'} ${precoLitro(Math.abs(dif))} ${dif > 0 ? 'acima' : 'abaixo'} da média`}
                  </Texto>
                ) : null}
              </View>
              {pagou ? (
                <View style={{ alignItems: 'flex-end', gap: 1 }}>
                  <Texto numberOfLines={1} style={estilos.postoPreco}>{precoLitro(pagou)}</Texto>
                  <Texto v="apoio" style={{ fontSize: 11.5, lineHeight: 15 }}>o litro</Texto>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <Tocavel onPress={postoBarato} escala={0.98} accessibilityLabel="Posto mais barato perto de você: o preço do litro em cada posto, agora" style={[estilos.postoBarato, { backgroundColor: comAlfa(c.menta, c.escuro ? 0.12 : 0.08), borderColor: comAlfa(c.menta, c.escuro ? 0.3 : 0.25) }]}>
          <View style={[estilos.postoIcone, { backgroundColor: comAlfa(c.menta, c.escuro ? 0.2 : 0.14) }]}>
            <IconeTransp nome="local" tamanho={18} cor={c.menta} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Texto v="forte">Posto mais barato perto</Texto>
            <Texto v="apoio" numberOfLines={1}>O preço do litro em cada posto</Texto>
          </View>
          <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" />
        </Tocavel>
      </Cartao>

      {postos.length ? (
        <CartaoLista>
          <Texto v="apoio" style={estilos.listaTitulo}>Onde você abastece</Texto>
          {postos.slice(0, 4).map((p, i) => {
            const m = acharMarca(p.nome) as { id: string } | null;
            const eBarato = barato === p;
            return (
              <View key={p.nome}>
                {i ? <Separador recuo={52} /> : null}
                <View style={estilos.posto} accessible accessibilityLabel={`${p.nome}: ${p.n} ${p.n === 1 ? 'vez' : 'vezes'}, ${precoLitro(p.preco!)} o litro em média${eBarato ? ', o mais barato' : ''}`}>
                  <Logo marca={m?.id} nome={p.nome} cat="transporte" tamanho={40} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Texto v="forte" numberOfLines={1}>{p.nome}</Texto>
                    <Texto v="apoio" numberOfLines={1}>{p.n} {p.n === 1 ? 'vez' : 'vezes'} · {oculto ? 'R$ ••••' : dinheiro(p.gasto, { centavos: false })}{eBarato ? ' · o mais barato' : ''}</Texto>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Texto numberOfLines={1} cor={eBarato ? c.positivo : c.texto} style={estilos.postoPreco}>{precoLitro(p.preco!)}</Texto>
                    <Texto v="apoio" style={{ fontSize: 11.5, lineHeight: 15 }}>o litro</Texto>
                  </View>
                </View>
              </View>
            );
          })}
        </CartaoLista>
      ) : null}
    </View>
  );
}

/* ---------- Quanto custa de verdade ---------- */

export function CartaoCusto({ v }: { v: Veiculo }) {
  const c = useCores();
  const oculto = useOculto();
  const dizer = useDizerValor();
  const k = v.custo;
  if (!k) return null;
  const partes = Object.entries(k.porSub).filter(([, x]) => (x ?? 0) > 0).map(([id, x]) => ({ ...infoSub(id), total: x! })).sort((a, b) => b.total - a.total);
  const ca = carroOuApp(v);
  const periodo = k.nMeses <= 1 ? 'no último mês' : `nos últimos ${k.nMeses} meses`;
  const numeros = [
    { rotulo: 'por dia', valor: k.porDia },
    ...(k.porKm ? [{ rotulo: 'por km rodado', valor: k.porKm }] : []),
    ...(k.rodados >= 300 ? [{ rotulo: 'km rodados', valor: -1, texto: k.rodados.toLocaleString('pt-BR') }] : []),
  ] as { rotulo: string; valor: number; texto?: string }[];
  return (
    <View style={{ gap: Espaco.dois }}>
      <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secao}>Quanto o {v.tipo === 'moto' ? 'veículo' : 'carro'} custa de verdade</Texto>
      <Cartao>
        <Texto v="apoio">Por mês</Texto>
        <Dinheiro valor={k.porMes} tamanho={34} />
        <Texto v="apoio" style={{ marginTop: -2 }}>{oculto ? 'R$ ••••' : dinheiro(k.total, { centavos: false })} {periodo}</Texto>
        <View style={[estilos.custoNums, { borderColor: c.linhaForte }]}>
          {numeros.map((n, i) => (
            <View key={n.rotulo} style={[estilos.custoNum, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.linhaForte }]} accessible accessibilityLabel={`${n.texto ?? dizer(n.valor)} ${n.rotulo}`}>
              <Texto numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3} style={estilos.custoValor}>{n.texto ?? (oculto ? 'R$ ••' : dinheiro(n.valor))}</Texto>
              <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{n.rotulo}</Texto>
            </View>
          ))}
        </View>
        {partes.length ? (
          <View style={{ gap: Espaco.tres, marginTop: Espaco.um }}>
            <BarraSegmentada segmentos={partes.map((p) => ({ id: p.id, valor: p.total, cor: p.cor, rotulo: `${p.nome}: ${porcento(p.total / k.total)}` }))} altura={10} />
            <View style={estilos.chipsLegenda}>
              {partes.map((p) => (
                <View key={p.id} style={estilos.chipLegenda}>
                  <View style={[estilos.ponto, { backgroundColor: p.cor }]} />
                  <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5 }}>{nomeCurto(p.id)} <Texto v="apoio" cor={c.texto} style={{ fontSize: 12.5, fontFamily: Fontes.textoForte }}>{porcento(p.total / k.total)}</Texto></Texto>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {k.perdeu ? (
          <View style={[estilos.dica, { backgroundColor: c.escuro ? c.cartao2 : c.cartao2 }]}>
            <Icone nome="investimento" tamanho={15} cor={c.ambar} peso="semibold" />
            <Texto v="apoio" style={{ flex: 1 }}>
              Pela FIPE, ele perdeu <Texto v="apoio" cor={c.texto} style={{ fontFamily: Fontes.textoForte }}>{oculto ? 'R$ ••••' : dinheiro(k.perdeu.valor, { centavos: false })}</Texto> de valor desde {mesNome(k.perdeu.desde)} de {k.perdeu.desde.slice(0, 4)}. Também é custo, só que invisível.
            </Texto>
          </View>
        ) : null}
        {!k.porKm ? <Texto v="apoio" cor={c.fraco} style={{ fontSize: 12.5 }}>Anotando o km do painel ao abastecer, aparece o custo de cada km rodado.</Texto> : null}
        {ca ? (
          <View style={{ gap: Espaco.dois, marginTop: Espaco.dois }}>
            <Texto v="forte">Carro ou app?</Texto>
            <View style={{ flexDirection: 'row', gap: Espaco.dois }}>
              {[{ nome: 'Seu carro', valor: ca.carroKm, ganha: ca.carroKm <= ca.appKm, sub: ca.comDesvalor ? 'por km, com a FIPE' : 'por km' }, { nome: 'App de corrida', valor: ca.appKm, ganha: ca.appKm < ca.carroKm, sub: 'por km' }].map((x) => (
                <View key={x.nome} style={[estilos.versus, { backgroundColor: x.ganha ? comAlfa(c.menta, c.escuro ? 0.12 : 0.09) : c.cartao2, borderColor: x.ganha ? comAlfa(c.menta, 0.45) : 'transparent' }]} accessible accessibilityLabel={`${x.nome}: ${dizer(x.valor)} ${x.sub}${x.ganha ? ', sai mais barato' : ''}`}>
                  <Texto v="apoio" cor={x.ganha ? c.menta : c.apoio} style={{ fontSize: 12.5, fontFamily: x.ganha ? Fontes.textoForte : Fontes.texto }}>{x.nome}</Texto>
                  <Texto style={estilos.custoValor}>{oculto ? 'R$ ••' : dinheiro(x.valor)}</Texto>
                  <Texto v="apoio" style={{ fontSize: 12, lineHeight: 16 }}>{x.sub}</Texto>
                </View>
              ))}
            </View>
            <Texto v="apoio">
              Rodando uns {Math.round(ca.kmMes).toLocaleString('pt-BR')}{NB}km por mês, de app sairia {oculto ? `R$${NB}••••` : inteiro(ca.appMes)}
              {oculto ? `, ${ca.diferenca >= 0 ? 'mais' : 'menos'} que o carro.` : `: ${inteiro(Math.abs(ca.diferenca))} ${ca.diferenca >= 0 ? 'a mais' : 'a menos'} que o carro.`}
            </Texto>
          </View>
        ) : null}
      </Cartao>
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20, paddingHorizontal: Espaco.um },
  secaoLinha: { flexDirection: 'row', alignItems: 'center', minHeight: 36, marginVertical: -4 },
  girando: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  dif: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, height: 28, paddingHorizontal: 11, borderRadius: Raio.pilula },
  difTexto: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 17 },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  ponto: { width: 9, height: 9, borderRadius: 5 },
  legendaNome: { flex: 1, fontSize: 14.5, lineHeight: 19 },
  legendaPct: { width: 40, textAlign: 'right', fontSize: 13 },
  legendaValor: { minWidth: 92, textAlign: 'right' },
  cuidado: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  cuidadoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  anotar: { minHeight: 36, paddingHorizontal: 14, borderRadius: Raio.pilula, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  anotarTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
  precos: { flexDirection: 'row', gap: 8 },
  preco: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1, gap: 2 },
  precoValor: { fontFamily: Fontes.tituloForte, fontSize: 19, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  veredito: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: Raio.pequeno, borderCurve: 'continuous' },
  ultimo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  postoBarato: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 4, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1 },
  postoIcone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  listaTitulo: { paddingTop: 12, paddingBottom: 2, fontFamily: Fontes.textoForte },
  posto: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  difMedia: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  postoPreco: { fontFamily: Fontes.tituloForte, fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  custoNums: { flexDirection: 'row', marginTop: Espaco.dois, paddingTop: Espaco.tres, borderTopWidth: StyleSheet.hairlineWidth },
  custoNum: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  custoValor: { fontFamily: Fontes.tituloForte, fontSize: 18, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  chipsLegenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  chipLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dica: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, marginTop: Espaco.dois, borderRadius: Raio.pequeno, borderCurve: 'continuous' },
  versus: { flex: 1, padding: 12, gap: 2, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
});
