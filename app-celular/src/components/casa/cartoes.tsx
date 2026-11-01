// Os blocos da tela da Nossa casa: o topo (o nome e quem mora), os atalhos, "Quem deve quanto", o mês da casa (o total,
// a parte de cada um e o mês a mês), os gastos do mês por dia, as contas da casa, o mercado (preços que mudaram) e o
// que fica no site. A lista de compras fica em components/casa/lista.tsx.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { CartaoLista } from '@/components/bancos/comum';
import { abrirCasaNoSite, lembrarNoWhatsApp, pagarContaCasa } from '@/components/casa/acoes';
import { AvatarMembro, PilhaAvatares } from '@/components/casa/pessoas';
import {
  compararMes, juntarNomes, maiuscula, nomeDe, primeiroNome, situacaoContaCasa, textoContaCasa, textoDivisao, textoDivisaoCurto, type MesDaCasa,
} from '@/components/casa/regras';
import { corDaSituacao, Marcador } from '@/components/contas/linha';
import { BarraSegmentada, Barrinhas } from '@/components/graficos';
import {
  Botao, Cartao, CartaoTitulo, comAlfa, Dinheiro, Icone, Linha, Logo, Pilula, Separador, Texto, Tocavel, useCategoria, useDizerValor, type NomeIcone,
} from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { agruparPorDia, brlCurto, chaveMes, dataCurta, dataRelativa, dinheiro, mesNome, porcento } from '@/lib/formato';
import { useOculto, type ContaCasa, type DadosCasa, type GastoCasa } from '@/lib/motor';
import { acharMarca } from '@site/marcas.js';

type Cores = Record<string, string>;

// A empresa pela descrição ("Carrefour", "Drogasil"): a logo de verdade na lista. Guardada (a lista repete nomes).
const marcas = new Map<string, { id: string } | null>();
export function marcaDe(desc: string) {
  const k = (desc || '').trim().toLowerCase();
  if (k.length < 2) return null;
  if (!marcas.has(k)) marcas.set(k, (acharMarca(desc) as { id: string } | null) ?? null);
  return marcas.get(k)?.id ?? null;
}

/* ---------- O topo ---------- */

export function TopoCasa({ C, cores }: { C: DadosCasa; cores: Cores }) {
  const c = useCores();
  const sozinho = C.membros.length < 2;
  const podeConvidar = C.membros.length < C.max;
  const nomes = juntarNomes(C.membros.map((m) => nomeDe(C, m.id)));
  const div = textoDivisaoCurto(C);
  const pilha = <PilhaAvatares membros={C.membros} cores={cores} tamanho={40} anel={c.fundo} mais={podeConvidar} />;
  return (
    <View style={{ gap: Espaco.tres }}>
      {podeConvidar ? (
        <Tocavel onPress={() => abrirCasaNoSite('casa-convidar')} escala={0.96} accessibilityLabel={`${nomes}. Convidar alguém para a casa`} style={{ alignSelf: 'flex-start' }}>
          {pilha}
        </Tocavel>
      ) : <View accessible accessibilityLabel={nomes}>{pilha}</View>}
      <View style={{ gap: 2 }}>
        <Texto v="rotulo">{sozinho ? 'Nossa casa' : `Nossa casa · ${C.membros.length} pessoas`}</Texto>
        <Texto v="titulo" accessibilityRole="header" numberOfLines={2}>{C.nome}</Texto>
        <Texto v="apoio" numberOfLines={2} style={estilos.sub}>{sozinho ? 'Só você por enquanto. Chame quem mora com você.' : `${nomes}${div ? ` · ${div}` : ''}`}</Texto>
      </View>
    </View>
  );
}

/* ---------- Os atalhos ---------- */

type Atalho = { id: string; nome: string; icone: NomeIcone; principal?: boolean; rotulo: string; onPress: () => void };

export function AtalhosCasa({ C }: { C: DadosCasa }) {
  const c = useCores();
  const lista: Atalho[] = [
    { id: 'gasto', nome: 'Anotar gasto', icone: 'mais', principal: true, rotulo: 'Anotar um gasto da casa', onPress: () => router.push('/casa/gasto') },
    { id: 'nota', nome: 'Ler a nota', icone: 'recibo', rotulo: 'Ler a nota do mercado (abre no Avina completo)', onPress: () => abrirCasaNoSite('casa-nota') },
    { id: 'trazer', nome: 'Dos meus gastos', icone: 'carteira', rotulo: 'Trazer gastos seus para a casa (abre no Avina completo)', onPress: () => abrirCasaNoSite('casa-trazer') },
    C.membros.length < C.max
      ? { id: 'convidar', nome: 'Convidar', icone: 'pessoas', rotulo: 'Convidar alguém para a casa (abre no Avina completo)', onPress: () => abrirCasaNoSite('casa-convidar') }
      : { id: 'divisao', nome: 'Divisão', icone: 'categoria', rotulo: 'Como vocês dividem (abre no Avina completo)', onPress: () => abrirCasaNoSite('casa-divisao') },
  ];
  return (
    <View style={estilos.atalhos}>
      {lista.map((a) => (
        <Tocavel key={a.id} onPress={a.onPress} escala={0.94} accessibilityLabel={a.rotulo} style={estilos.atalho}>
          <View style={[estilos.atalhoBola, a.principal
            ? { backgroundColor: c.azul, borderColor: c.azul, boxShadow: c.escuro ? undefined : `0px 6px 16px ${comAlfa(c.azul, 0.3)}` }
            : { backgroundColor: c.cartao, borderColor: c.linhaForte }]}>
            <Icone nome={a.icone} tamanho={22} cor={a.principal ? '#FFFFFF' : c.texto} peso="semibold" />
          </View>
          <Texto numberOfLines={2} maxFontSizeMultiplier={1.3} style={estilos.atalhoNome}>{a.nome}</Texto>
        </Tocavel>
      ))}
    </View>
  );
}

/* ---------- Quem deve quanto ---------- */

// A dívida que envolve você em destaque (com o valor grande e "Recebi" ou "Já paguei"); as outras numa linha cada.
// mes: o mês de agora (quanto você pagou dos gastos da casa contra a sua parte)
export function CartaoDividas({ C, cores, mes }: { C: DadosCasa; cores: Cores; mes: MesDaCasa }) {
  const c = useCores();
  const dizer = useDizerValor();
  const minhas = C.dividas.filter((d) => d.de === C.eu || d.para === C.eu);
  const outras = C.dividas.filter((d) => !minhas.includes(d));
  const principal = minhas[0];
  const membro = (id: string) => C.membros.find((m) => m.id === id);
  const pagou = mes.pagou[C.eu] ?? 0, parte = mes.parte[C.eu] ?? 0;
  const frase = mes.total > 0
    ? `Em ${mesNome(mes.chave)}, você pagou ${porcento(pagou / mes.total)} dos gastos da casa. A sua parte é ${porcento(parte / mes.total)}.`
    : `Nenhum gasto da casa em ${mesNome(mes.chave)} ainda.`;
  const ultimo = C.acertos[0];
  const abrirAcerto = (d: DadosCasa['dividas'][number]) => router.push({ pathname: '/casa/acertar', params: { de: d.de, para: d.para, valor: String(d.valor) } });

  if (C.membros.length < 2) {
    return (
      <Cartao destaque={c.roxo}>
        <CartaoTitulo rotulo="Quem deve quanto" icone="pessoas" />
        <Texto v="subtitulo">A casa fica boa com mais gente</Texto>
        <Texto v="apoio" style={estilos.sub}>Cada um anota o que pagou no próprio celular e o Avina divide. Quem você chamar só vê os gastos da casa, nunca os seus.</Texto>
        <Botao titulo="Convidar alguém" icone="pessoas" tamanho="medio" onPress={() => abrirCasaNoSite('casa-convidar')} rotulo="Convidar alguém para a casa (abre no Avina completo)" style={{ marginTop: Espaco.dois }} />
      </Cartao>
    );
  }

  if (!principal) {
    return (
      <Cartao destaque={c.positivo}>
        <View style={estilos.okLinha}>
          <View style={[estilos.ok, { backgroundColor: comAlfa(c.positivo, c.escuro ? 0.18 : 0.14) }]}>
            <Icone nome="check" tamanho={22} cor={c.positivo} peso="bold" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto v="subtitulo">{C.dividas.length ? 'Com você, tudo certo' : 'Tudo acertado entre vocês'}</Texto>
            <Texto v="apoio" style={estilos.sub}>{frase}</Texto>
          </View>
        </View>
        {outras.map((d, i) => <LinhaOutraDivida key={i} C={C} d={d} onPress={() => abrirAcerto(d)} />)}
        {ultimo ? <UltimoAcerto C={C} /> : null}
      </Cartao>
    );
  }

  const meDevem = principal.para === C.eu;
  const outro = membro(meDevem ? principal.de : principal.para);
  const cor = meDevem ? c.positivo : c.ambar;
  const titulo = meDevem ? `${nomeDe(C, principal.de)} te deve` : `Você deve para ${nomeDe(C, principal.para)}`;
  return (
    <Cartao destaque={cor}>
      <CartaoTitulo rotulo="Quem deve quanto" icone="pessoas" cor={c.apoio} />
      <View style={estilos.dividaTopo} accessible accessibilityLabel={`${titulo} ${dizer(principal.valor)}`}>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="forte" style={{ fontSize: 16, lineHeight: 21 }}>{titulo}</Texto>
          <Dinheiro valor={principal.valor} tamanho={38} cor={cor} />
        </View>
        {/* quem paga → quem recebe */}
        <View style={estilos.setaPessoas} importantForAccessibility="no-hide-descendants">
          {membro(principal.de) ? <AvatarMembro m={membro(principal.de)!} cor={cores[principal.de]} tamanho={34} anel={c.cartao} /> : null}
          <View style={[estilos.setaLinha, { backgroundColor: comAlfa(cor, 0.5) }]} />
          <Icone nome="chevron" tamanho={12} cor={cor} peso="bold" style={{ marginLeft: -6 }} />
          {membro(principal.para) ? <AvatarMembro m={membro(principal.para)!} cor={cores[principal.para]} tamanho={34} anel={c.cartao} /> : null}
        </View>
      </View>
      <Texto v="apoio" style={estilos.sub}>{frase}</Texto>
      <View style={estilos.dividaBotoes}>
        <Botao
          titulo={meDevem ? 'Recebi' : 'Já paguei'}
          icone="check"
          tamanho="medio"
          onPress={() => abrirAcerto(principal)}
          rotulo={meDevem ? `Recebi de ${outro ? primeiroNome(outro.nome) : 'alguém'}: acertar ${dizer(principal.valor)}` : `Já paguei ${dizer(principal.valor)}: acertar`}
          style={{ flex: 1 }}
        />
        {meDevem ? (
          <Botao titulo="Lembrar" icone="chat" variante="secundario" tamanho="medio" onPress={() => lembrarNoWhatsApp(C, principal)} rotulo={`Lembrar ${outro ? primeiroNome(outro.nome) : ''} no WhatsApp`} />
        ) : null}
      </View>
      {minhas.slice(1).map((d, i) => <LinhaOutraDivida key={`m${i}`} C={C} d={d} onPress={() => abrirAcerto(d)} />)}
      {outras.map((d, i) => <LinhaOutraDivida key={`o${i}`} C={C} d={d} onPress={() => abrirAcerto(d)} />)}
      {ultimo ? <UltimoAcerto C={C} /> : null}
    </Cartao>
  );
}

function LinhaOutraDivida({ C, d, onPress }: { C: DadosCasa; d: DadosCasa['dividas'][number]; onPress: () => void }) {
  const c = useCores();
  const oculto = useOculto();
  const t = `${nomeDe(C, d.de)} deve ${oculto ? 'R$ ••••' : dinheiro(d.valor)} para ${d.para === C.eu ? 'você' : nomeDe(C, d.para)}`;
  return (
    <Tocavel onPress={onPress} escala={0.98} accessibilityLabel={`${t}. Acertar`} style={[estilos.outra, { borderColor: c.linha }]}>
      <Icone nome="transferir" tamanho={15} cor={c.apoio} />
      <Texto v="apoio" numberOfLines={2} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>{t}</Texto>
      <Texto cor={c.azulTinta} style={estilos.outraAcao}>Acertar</Texto>
    </Tocavel>
  );
}

function UltimoAcerto({ C }: { C: DadosCasa }) {
  const c = useCores();
  const oculto = useOculto();
  const a = C.acertos[0];
  if (!a) return null;
  return (
    <View style={[estilos.ultimo, { borderTopColor: c.linha }]}>
      <Icone nome="relogio" tamanho={13} cor={c.fraco} />
      <Texto v="apoio" numberOfLines={1} cor={c.fraco} style={{ flex: 1, fontSize: 12.5, lineHeight: 17 }}>
        Último acerto: {nomeDe(C, a.de)} → {a.para === C.eu ? 'você' : nomeDe(C, a.para)} · {oculto ? 'R$ ••••' : dinheiro(a.valor)} · {dataCurta(a.data)}
      </Texto>
    </View>
  );
}

/* ---------- O mês da casa ---------- */

// O total do mês escolhido, a comparação com o mês anterior, a parte de cada um (e quanto cada um pagou) e o mês a mês
export function CartaoMes({ C, cores, mes, hoje }: { C: DadosCasa; cores: Cores; mes: MesDaCasa; hoje: string }) {
  const c = useCores();
  const oculto = useOculto();
  const dizer = useDizerValor();
  const comp = compararMes(C, mes, hoje);
  const sozinho = C.membros.length < 2;
  const corComp = comp.sobe ? c.ambar : comp.desce ? c.positivo : undefined;
  const segmentos = C.membros.map((m) => ({ id: m.id, valor: mes.parte[m.id] ?? 0, cor: cores[m.id], rotulo: `${nomeDe(C, m.id)}: ${dizer(mes.parte[m.id] ?? 0)}` }));
  const meses = C.meses;
  const comGasto = meses.filter((m) => m.total > 0);
  const media = comGasto.length ? comGasto.reduce((t, m) => t + m.total, 0) / comGasto.length : 0;
  const atual = mes.chave === chaveMes(hoje);
  return (
    <Cartao>
      <Texto v="apoio" style={estilos.rotuloGrande}>{atual ? 'Gasto da casa este mês' : `Gasto da casa em ${mesNome(mes.chave)}`}</Texto>
      <Dinheiro valor={mes.total} tamanho={36} />
      <Pilula texto={comp.frase} cor={corComp} icone={comp.sobe ? 'setaCima' : comp.desce ? 'setaBaixo' : undefined} />
      {!sozinho && mes.total > 0 ? (
        <View style={{ gap: Espaco.tres, marginTop: Espaco.tres }}>
          <BarraSegmentada segmentos={segmentos} altura={10} rotulo={`A parte de cada um: ${segmentos.map((s) => s.rotulo).join(', ')}`} />
          {C.membros.map((m) => {
            const p = mes.parte[m.id] ?? 0, pg = mes.pagou[m.id] ?? 0, dif = pg - p;
            const curto = (v: number) => (oculto ? 'R$ ••••' : dinheiro(v, { centavos: false }));
            const sub = `pagou ${curto(pg)}${Math.abs(dif) < 0.5 ? ' · na medida' : oculto ? '' : ` · ${curto(Math.abs(dif))} ${dif > 0 ? 'a mais' : 'a menos'}`}`;
            return (
              <View key={m.id} style={estilos.legenda} accessible accessibilityLabel={`${nomeDe(C, m.id)}: a parte é ${dizer(p)}, ${porcento(mes.total ? p / mes.total : 0)}. ${sub}`}>
                <AvatarMembro m={m} cor={cores[m.id]} tamanho={30} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Texto v="forte" numberOfLines={1}>{nomeDe(C, m.id)}</Texto>
                  <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17 }}>{sub}</Texto>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 1 }}>
                  <Dinheiro valor={p} tamanho={16} animar={false} />
                  <Texto v="apoio" style={{ fontSize: 12, lineHeight: 16 }}>{porcento(mes.total ? p / mes.total : 0)} da casa</Texto>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {comGasto.length >= 2 ? (
        <View style={[estilos.mesAMes, { borderTopColor: c.linha }]}>
          <View style={estilos.mesAMesTopo}>
            <Texto v="apoio" style={{ flex: 1 }}>Mês a mês</Texto>
            <Texto v="apoio">média {oculto ? 'R$ ••••' : brlCurto(media)}</Texto>
          </View>
          <Barrinhas
            valores={meses.map((m) => m.total)}
            rotulos={meses.map((m) => mesNome(m.chave, true))}
            destaque={Math.max(0, meses.findIndex((m) => m.chave === mes.chave))}
            cor={c.roxo}
            altura={44}
            formatar={(v) => (oculto ? 'valor escondido' : dinheiro(v))}
          />
        </View>
      ) : null}
    </Cartao>
  );
}

/* ---------- Os gastos do mês, por dia ---------- */

const LIMITE = 8; // linhas antes do "Ver todos"

export function GastosDoMes({ C, cores, mes, hoje }: { C: DadosCasa; cores: Cores; mes: MesDaCasa; hoje: string }) {
  const c = useCores();
  const oculto = useOculto();
  const reduzir = useReducedMotion();
  const [todos, setTodos] = useState(false);
  if (!mes.itens.length) {
    return (
      <Cartao>
        <View style={estilos.okLinha}>
          <View style={[estilos.ok, { backgroundColor: comAlfa(c.roxo, c.escuro ? 0.18 : 0.12) }]}>
            <Icone nome="carrinho" tamanho={20} cor={c.roxo} peso="semibold" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto v="forte">Nenhum gasto da casa em {mesNome(mes.chave)}</Texto>
            <Texto v="apoio" style={estilos.sub}>{C.membros.length > 1 ? 'Quem pagar, anota aqui. O Avina divide e mostra quem deve quanto.' : 'Anote os gastos da casa e convide quem mora com você.'}</Texto>
          </View>
        </View>
        <Botao titulo="Anotar gasto da casa" icone="mais" tamanho="medio" onPress={() => router.push('/casa/gasto')} style={{ marginTop: Espaco.dois }} />
      </Cartao>
    );
  }
  // os primeiros dias até dar o limite de linhas (todos: a lista inteira)
  const grupos: ReturnType<typeof agruparPorDia<GastoCasa>> = [];
  let restam = todos ? Infinity : LIMITE;
  for (const g of agruparPorDia(mes.itens)) {
    if (restam <= 0) break;
    const itens = g.itens.slice(0, restam);
    restam -= itens.length;
    grupos.push({ ...g, itens });
  }
  const escondidos = mes.itens.length - grupos.reduce((t, g) => t + g.itens.length, 0);
  return (
    <Animated.View layout={reduzir ? undefined : LinearTransition.duration(240)} style={{ gap: Espaco.dois }}>
      <CartaoLista>
        {grupos.map((g, gi) => (
          <View key={g.data}>
            {gi ? <Separador /> : null}
            <View style={estilos.dia}>
              <Texto accessibilityRole="header" cor={c.apoio} style={estilos.diaNome}>{maiuscula(dataRelativa(g.data, hoje))}</Texto>
              {g.itens.length > 1 ? <Texto cor={c.fraco} style={estilos.diaTotal}>{oculto ? 'R$ ••••' : dinheiro(g.saiu)}</Texto> : null}
            </View>
            {g.itens.map((x, i) => (
              <Animated.View key={x.id} entering={reduzir || !todos ? undefined : FadeIn.duration(200)}>
                {i ? <Separador recuo={56} /> : null}
                <LinhaGasto C={C} g={x} cores={cores} />
              </Animated.View>
            ))}
          </View>
        ))}
      </CartaoLista>
      {escondidos > 0 || todos ? (
        <Botao
          titulo={todos ? 'Mostrar menos' : `Ver todos os ${mes.itens.length} gastos`}
          variante="texto"
          tamanho="pequeno"
          onPress={() => setTodos(!todos)}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
    </Animated.View>
  );
}

// Um gasto: a logo da empresa (ou o ícone da categoria) com quem pagou no canto, o que foi, quem pagou e a sua parte
function LinhaGasto({ C, g, cores }: { C: DadosCasa; g: GastoCasa; cores: Cores }) {
  const c = useCores();
  const oculto = useOculto();
  const dizer = useDizerValor();
  const cat = useCategoria(g.cat);
  const quem = C.membros.find((m) => m.id === g.pagou);
  const sozinho = C.membros.length < 2;
  const minha = g.partes[C.eu] ?? 0;
  const soMostrar = g.participantes.length === 1 && g.participantes[0] === g.pagou;
  // a sua parte fica embaixo do valor (é o que o gasto muda para você); o resto, embaixo do nome
  const suaParte = !sozinho && !soMostrar && minha > 0 && Math.abs(minha - g.valor) >= 0.005 ? minha : null;
  const nota = sozinho ? null : soMostrar ? 'só para mostrar' : minha > 0 ? null : 'fora da sua parte';
  const sub = [sozinho ? cat?.nome : `${nomeDe(C, g.pagou)} pagou`, nota, g.nota ? 'com nota' : null].filter(Boolean).join(' · ');
  const titulo = g.desc || cat?.nome || 'Gasto da casa';
  return (
    <Tocavel
      onPress={() => router.push({ pathname: '/casa/gasto', params: { id: g.id } })}
      escala={0.985}
      accessibilityLabel={`${titulo}, ${dizer(g.valor)}. ${sub}${suaParte ? `. Sua parte: ${dizer(suaParte)}` : ''}`}
      accessibilityHint="Abre o gasto para ver ou mudar"
      style={estilos.linhaGasto}>
      <View style={{ width: 44, height: 44 }}>
        <Logo marca={marcaDe(g.desc)} nome={g.desc} cat={g.cat} tamanho={44} />
        {quem && !sozinho ? <AvatarMembro m={quem} cor={cores[quem.id]} tamanho={18} anel={c.cartao} style={estilos.quemPagou} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto v="forte" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>{titulo}</Texto>
        <Texto v="apoio" numberOfLines={1}>{sub}</Texto>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Dinheiro valor={g.valor} tamanho={16} animar={false} />
        {suaParte ? <Texto v="apoio" numberOfLines={1} style={estilos.suaParte}>sua parte {oculto ? 'R$ ••••' : dinheiro(suaParte)}</Texto> : null}
      </View>
    </Tocavel>
  );
}

/* ---------- Contas da casa ---------- */

export function ContasDaCasa({ C, hoje }: { C: DadosCasa; hoje: string }) {
  const c = useCores();
  const oculto = useOculto();
  const reduzir = useReducedMotion();
  const aPagar = C.contas.filter((k) => !k.paga).reduce((t, k) => t + k.valor, 0);
  const nova = () => abrirCasaNoSite('casa-conta');
  return (
    <View style={{ gap: Espaco.dois }}>
      <View style={estilos.secao}>
        <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secaoTitulo}>Contas da casa</Texto>
        {C.contas.length ? (
          <Texto cor={aPagar > 0 ? c.apoio : c.positivo} style={estilos.secaoDireita}>{aPagar > 0 ? `${oculto ? 'R$ ••••' : dinheiro(aPagar)} a pagar` : 'Tudo pago'}</Texto>
        ) : null}
      </View>
      <CartaoLista>
        {!C.contas.length ? (
          <Texto v="apoio" style={[estilos.sub, { paddingVertical: Espaco.tres }]}>Aluguel, luz, internet: coloque as contas fixas da casa. Quem pagar marca, e o valor já entra dividido.</Texto>
        ) : null}
        {C.contas.map((k, i) => (
          <Animated.View key={k.id} layout={reduzir ? undefined : LinearTransition.duration(220)}>
            {i ? <Separador recuo={56} /> : null}
            <LinhaContaCasa C={C} k={k} hoje={hoje} />
          </Animated.View>
        ))}
        {C.contas.length ? <Separador /> : null}
        <Linha titulo="Nova conta da casa" icone="mais" corIcone={c.azulTinta} onPress={nova} rotulo="Nova conta da casa (abre no Avina completo)" chevron style={{ minHeight: 56 }} />
      </CartaoLista>
    </View>
  );
}

function LinhaContaCasa({ C, k, hoje }: { C: DadosCasa; k: ContaCasa; hoje: string }) {
  const c = useCores();
  const dizer = useDizerValor();
  const { st } = situacaoContaCasa(k, hoje);
  const cor = corDaSituacao(st, c);
  const texto = textoContaCasa(C, k, hoje);
  return (
    <View style={estilos.linhaConta}>
      <Tocavel
        onPress={() => abrirCasaNoSite('casa-conta', k.id)}
        escala={0.985}
        accessibilityLabel={`${k.nome}, ${dizer(k.valor)}, ${texto}`}
        accessibilityHint="Abre a conta para mudar (no Avina completo)"
        style={estilos.contaToque}>
        <Logo marca={marcaDe(k.nome)} nome={k.nome} cat={k.cat} tamanho={44} />
        <View style={{ flex: 1, gap: 5 }}>
          <View style={estilos.contaNomeLinha}>
            <Texto v="forte" numberOfLines={1} style={{ flex: 1, fontSize: 16, lineHeight: 21 }}>{k.nome}</Texto>
            <Dinheiro valor={k.valor} tamanho={16} animar={false} style={k.paga ? { opacity: 0.55 } : undefined} />
          </View>
          <Pilula texto={texto} cor={cor} icone={st === 'paga' ? 'check' : st === 'atrasada' ? 'alerta' : undefined} style={{ maxWidth: '100%' }} />
        </View>
      </Tocavel>
      {k.paga ? (
        <View style={estilos.contaFeita} accessible accessibilityLabel={`${k.nome} paga`}>
          <Marcador paga tamanho={28} />
        </View>
      ) : (
        <Tocavel
          onPress={() => { pagarContaCasa(C, k); }}
          vibra={false}
          escala={0.92}
          hitSlop={6}
          accessibilityLabel={`Paguei ${k.nome}: anota ${dizer(k.valor)} dividido na casa`}
          style={[estilos.paguei, { backgroundColor: comAlfa(c.azul, c.escuro ? 0.2 : 0.1) }]}>
          <Texto cor={c.azulTinta} maxFontSizeMultiplier={1.3} style={estilos.pagueiTexto}>Paguei</Texto>
        </Tocavel>
      )}
    </View>
  );
}

/* ---------- O mercado da casa ---------- */

// Só quando há nota guardada: o que foi em mercado no mês e os preços que mudaram entre as duas últimas compras
export function CartaoMercado({ C }: { C: DadosCasa }) {
  const c = useCores();
  const oculto = useOculto();
  const M = C.mercado;
  if (!M) return null;
  return (
    <Cartao>
      <CartaoTitulo rotulo="Mercado da casa" icone="carrinho" />
      <View style={estilos.mercadoTopo}>
        <View style={{ flex: 1 }}>
          <Dinheiro valor={M.mes} tamanho={26} />
          <Texto v="apoio">em mercado este mês</Texto>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Texto style={estilos.mercadoN}>{M.notas}</Texto>
          <Texto v="apoio">{M.notas === 1 ? 'nota guardada' : 'notas guardadas'}</Texto>
        </View>
      </View>
      {M.mudou.length ? (
        <View style={{ gap: 2, marginTop: Espaco.dois }}>
          <Texto v="rotulo" style={{ marginBottom: 4 }}>Preços que mudaram</Texto>
          {M.mudou.map((x, i) => {
            // a variação pelas duas compras (o mesmo de precosQueMudaram, em nota.js)
            const pct = x.de.unit > 0 ? (x.para.unit - x.de.unit) / x.de.unit : 0;
            const subiu = pct > 0;
            const cor = subiu ? c.negativo : c.positivo;
            return (
              <View key={x.nome + i}>
                {i ? <Separador /> : null}
                <View style={estilos.preco} accessible accessibilityLabel={`${x.nome}: ${subiu ? 'subiu' : 'caiu'} ${porcento(Math.abs(pct))}, de ${dinheiro(x.de.unit)} para ${dinheiro(x.para.unit)}`}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Texto v="forte" numberOfLines={1}>{maiuscula(x.nome.toLowerCase())}</Texto>
                    <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17 }}>era {oculto ? 'R$ ••••' : dinheiro(x.de.unit)} · {x.de.loja}, {dataCurta(x.de.data)}</Texto>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Texto style={estilos.precoValor}>{oculto ? 'R$ ••••' : dinheiro(x.para.unit)}</Texto>
                    <Pilula texto={porcento(Math.abs(pct))} cor={cor} icone={subiu ? 'setaCima' : 'setaBaixo'} style={{ alignSelf: 'flex-end' }} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Cartao>
  );
}

/* ---------- O que fica no site ---------- */

export function MaisDaCasa({ C }: { C: DadosCasa }) {
  const c = useCores();
  const div = textoDivisao(C);
  const itens: { titulo: string; sub: string; icone: NomeIcone; acao: Parameters<typeof abrirCasaNoSite>[0] }[] = [
    ...(C.membros.length < C.max ? [{ titulo: 'Convidar alguém', sub: 'Mandar o link ou mostrar o QR code', icone: 'pessoas' as const, acao: 'casa-convidar' as const }] : []),
    ...(C.membros.length > 1 ? [{ titulo: 'Como vocês dividem', sub: div ? maiuscula(div) : 'Igual ou pela renda de cada um', icone: 'categoria' as const, acao: 'casa-divisao' as const }] : []),
    { titulo: 'Listas prontas', sub: C.modelos.length ? `${C.modelos.length} ${C.modelos.length === 1 ? 'guardada' : 'guardadas'} · guardar e apagar` : 'Guarde a lista de agora com um nome', icone: 'estrela', acao: 'casa-listas' },
    { titulo: 'Pessoas e ajustes da casa', sub: C.souDono ? 'Nome da casa, quem mora aqui, sair' : 'Quem mora aqui, sair da casa', icone: 'configuracoes', acao: 'casa-pessoas' },
  ];
  return (
    <View style={{ gap: Espaco.dois }}>
      <View style={estilos.secao}>
        <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secaoTitulo}>Mais da casa</Texto>
      </View>
      <CartaoLista>
        {itens.map((x, i) => (
          <View key={x.acao}>
            {i ? <Separador recuo={52} /> : null}
            <Linha titulo={x.titulo} sub={x.sub} icone={x.icone} corIcone={c.roxo} chevron onPress={() => abrirCasaNoSite(x.acao)} rotulo={`${x.titulo}. ${x.sub}. Abre no Avina completo`} />
          </View>
        ))}
      </CartaoLista>
      <Texto v="apoio" cor={c.fraco} style={{ textAlign: 'center', fontSize: 12.5, paddingHorizontal: Espaco.quatro }}>Estes abrem no Avina completo e voltam para cá.</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  sub: { fontSize: 14, lineHeight: 20 },
  rotuloGrande: { fontSize: 15, lineHeight: 20 },
  atalhos: { flexDirection: 'row', justifyContent: 'space-between', gap: Espaco.dois },
  atalho: { flex: 1, alignItems: 'center', gap: 8, minHeight: 44 },
  atalhoBola: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  atalhoNome: { fontFamily: Fontes.textoForte, fontSize: 12.5, lineHeight: 16, textAlign: 'center' },
  okLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres + 2 },
  ok: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dividaTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, marginTop: Espaco.um },
  setaPessoas: { flexDirection: 'row', alignItems: 'center' },
  setaLinha: { width: 18, height: 2, borderRadius: 1, marginLeft: 4 },
  dividaBotoes: { flexDirection: 'row', gap: Espaco.dois, marginTop: Espaco.dois },
  outra: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: Espaco.tres, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1, marginTop: Espaco.dois },
  outraAcao: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 19 },
  ultimo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Espaco.dois, paddingTop: Espaco.tres, borderTopWidth: StyleSheet.hairlineWidth },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres },
  mesAMes: { gap: Espaco.tres, marginTop: Espaco.tres, paddingTop: Espaco.tres + 2, borderTopWidth: StyleSheet.hairlineWidth },
  mesAMesTopo: { flexDirection: 'row', alignItems: 'center' },
  dia: { flexDirection: 'row', alignItems: 'center', paddingTop: Espaco.tres, paddingBottom: 2 },
  diaNome: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 18 },
  diaTotal: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  linhaGasto: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 10 },
  quemPagou: { position: 'absolute', right: -6, bottom: -5 },
  suaParte: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  secao: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, paddingHorizontal: Espaco.um },
  secaoTitulo: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  secaoDireita: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  linhaConta: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  contaToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  contaNomeLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contaFeita: { width: 46, height: 48, alignItems: 'flex-end', justifyContent: 'center' },
  paguei: { minWidth: 72, height: 36, marginLeft: 10, paddingHorizontal: 14, borderRadius: Raio.pilula, alignItems: 'center', justifyContent: 'center' },
  pagueiTexto: { fontFamily: Fontes.textoPesado, fontSize: 14, lineHeight: 18 },
  mercadoTopo: { flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.tres },
  mercadoN: { fontFamily: Fontes.tituloForte, fontSize: 26, lineHeight: 32 },
  preco: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingVertical: 10 },
  precoValor: { fontFamily: Fontes.tituloForte, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
