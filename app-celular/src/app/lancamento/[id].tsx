// O detalhe de um lançamento (folha que sobe de baixo, aberta pela lista de Atividades ou pelo Início):
// a logo grande, a descrição, o valor enorme, a data, a categoria, o banco, a moeda original e a observação;
// um resumo útil (quanto foi para a mesma empresa ou categoria no mês, e os últimos 6 meses em barrinhas);
// e embaixo, Editar (abre a edição no Avina do site) e Apagar (com a confirmação do sistema).
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmarApagar, dataCompleta, editarNoSite, pedirApagar, valorEstrangeiro } from '@/components/atividades/acoes';
import { Barrinhas } from '@/components/graficos';
import { Botao, BotaoRedondo, Dinheiro, Esqueleto, Icone, IconeCategoria, Logo, LogoBanco, Vazio, comAlfa, useCategoria, type NomeIcone } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { brlCurto, chaveMes, dinheiro, mesAnterior, mesNome } from '@/lib/formato';
import { useEstado, useOculto, type Lanc } from '@/lib/motor';
import { marcaPorId } from '@site/marcas.js';

const MARGEM = 20;

export default function Lancamento() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const estado = useEstado();
  const oculto = useOculto();
  const P = estado?.pessoal ?? null;
  const achado = P?.lanc.find((x) => x.id === id) ?? null;
  // depois de apagar, o lançamento some do retrato antes da folha fechar: fica o último visto
  const [guardado, setGuardado] = useState<Lanc | null>(achado);
  if (achado && achado !== guardado) setGuardado(achado);
  const [apagando, setApagando] = useState(false);
  const l = achado ?? (apagando ? guardado : null);
  const cat = useCategoria(l?.cat);

  const resumo = useMemo(() => {
    if (!l || !P) return null;
    const porMarca = !!l.marca;
    const mesmo = (x: Lanc) => x.tipo === l.tipo && (porMarca ? x.marca === l.marca : x.cat === l.cat);
    const mes = l.data.slice(0, 7);
    const meses = [mes];
    while (meses.length < 6) meses.unshift(mesAnterior(meses[0]));
    const porMes = meses.map(() => 0);
    let total = 0, vezes = 0;
    for (const x of P.lanc) {
      if (!mesmo(x)) continue;
      const i = meses.indexOf(x.data.slice(0, 7));
      if (i >= 0) porMes[i] += x.valor;
      if (i === 5) { total += x.valor; vezes += 1; }
    }
    const marca = porMarca ? (marcaPorId(l.marca) as { nome: string } | null) : null;
    const nome = marca?.nome ?? (porMarca ? l.desc : cat?.nome ?? 'Outros');
    return { nome, total, vezes, mes, meses, porMes, comHistorico: porMes.filter((v) => v > 0).length >= 2 };
  }, [l, P, cat?.nome]);

  // a folha ainda está aberta? (depois de apagar, só fecha se a pessoa não fechou antes)
  const aberta = useRef(true);
  useEffect(() => { aberta.current = true; return () => { aberta.current = false; }; }, []);
  const fechar = () => {
    if (!aberta.current) return;
    if (router.canGoBack()) router.back(); else router.replace('/'); // aberta por um link direto: vai ao Início
  };
  const editar = () => { if (!l) return; fechar(); editarNoSite(l.id); };
  const apagar = async () => {
    if (!l || apagando) return;
    if (!(await confirmarApagar(l))) return;
    setApagando(true);
    if (await pedirApagar(l)) fechar();
    else setApagando(false);
  };

  const barra = <StatusBar style={c.escuro ? 'light' : 'dark'} />;
  const botaoFechar = (
    <BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={fechar} style={estilos.fechar} />
  );

  if (!estado) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto }]}>
        {barra}
        <View style={estilos.heroi}>
          <Esqueleto largura={76} altura={76} raio={38} />
          <Esqueleto largura={160} altura={20} />
          <Esqueleto largura={200} altura={40} raio={12} />
        </View>
      </View>
    );
  }
  if (!l) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, justifyContent: 'center' }]}>
        {barra}
        {botaoFechar}
        <Vazio icone="documento" titulo="Este lançamento não está mais aqui" texto="Ele pode ter sido apagado em outro aparelho." acao={{ titulo: 'Fechar', onPress: fechar }} />
      </View>
    );
  }

  const entrada = l.tipo === 'entrada';
  const corCat = cat?.cor ?? c.azul;
  const fundoCartao = c.escuro ? c.cartao : c.cartao2;
  const mesAgora = chaveMes(new Date());
  const quando = resumo && resumo.mes === mesAgora ? 'este mês' : resumo ? `em ${mesNome(resumo.mes)}${resumo.mes.slice(0, 4) !== mesAgora.slice(0, 4) ? ` de ${resumo.mes.slice(0, 4)}` : ''}` : '';

  const linhas: { rotulo: string; valor: string; esquerda?: ReactNode; icone?: NomeIcone; longo?: boolean }[] = [
    { rotulo: 'Categoria', valor: cat?.nome ?? 'Outros', esquerda: <IconeCategoria cat={cat ?? l.cat} tamanho={28} /> },
    ...(l.banco ? [{ rotulo: 'Banco', valor: l.banco, esquerda: <LogoBanco banco={l.banco} tamanho={28} /> }] : []),
    ...(l.moeda && l.valorOrig ? [{ rotulo: 'Valor original', valor: oculto ? '••••' : valorEstrangeiro(l.moeda, l.valorOrig), icone: 'transferir' as NomeIcone }] : []),
    { rotulo: 'Tipo', valor: entrada ? 'Entrada' : 'Saída', icone: (entrada ? 'entrada' : 'saida') as NomeIcone },
    ...(l.obs ? [{ rotulo: 'Observação', valor: l.obs, longo: true }] : []),
  ];

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundoAlto }]}>
      {barra}
      <ScrollView contentContainerStyle={estilos.corpo} showsVerticalScrollIndicator={false}>
        {/* a logo, a descrição, o valor e a data */}
        <View style={estilos.heroi}>
          <Logo marca={l.marca} site={l.site} nome={l.desc} cat={cat ?? l.cat} banco={l.banco} tamanho={76} anel={c.fundoAlto} />
          <Text numberOfLines={2} maxFontSizeMultiplier={1.4} accessibilityRole="header" style={[estilos.desc, { color: c.texto }]}>{l.desc || cat?.nome || 'Sem descrição'}</Text>
          <Dinheiro valor={entrada ? l.valor : -l.valor} sinal tamanho={44} cor={entrada ? c.positivo : c.texto} style={estilos.valor} />
          <Text maxFontSizeMultiplier={1.4} style={[estilos.data, { color: c.apoio }]}>{dataCompleta(l.data)}</Text>
        </View>

        {/* os detalhes */}
        <Animated.View entering={FadeInDown.duration(320).delay(60)} style={[estilos.cartao, { backgroundColor: fundoCartao, borderColor: c.linha }]}>
          {linhas.map((x, i) => (
            <View
              key={x.rotulo}
              accessible
              accessibilityLabel={`${x.rotulo}: ${x.valor}`}
              style={[x.longo ? estilos.linhaLonga : estilos.linha, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.linhaForte }]}>
              <Text maxFontSizeMultiplier={1.4} style={[estilos.rotulo, { color: c.apoio }]}>{x.rotulo}</Text>
              <View style={x.longo ? null : estilos.linhaValor}>
                {x.esquerda ?? (x.icone ? <Icone nome={x.icone} tamanho={16} cor={x.icone === 'entrada' ? c.positivo : c.apoio} peso="semibold" /> : null)}
                <Text numberOfLines={x.longo ? undefined : 1} maxFontSizeMultiplier={1.4} style={[estilos.linhaTexto, { color: c.texto }, x.longo && { textAlign: 'left' }]}>{x.valor}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* o resumo: quanto foi para a mesma empresa (ou categoria) no mês, e os últimos 6 meses */}
        {resumo ? (
          <Animated.View entering={FadeInDown.duration(320).delay(120)} style={[estilos.cartao, estilos.resumo, { backgroundColor: fundoCartao, borderColor: c.linha }]}>
            <View style={estilos.resumoTopo}>
              <View style={[estilos.resumoIcone, { backgroundColor: comAlfa(corCat, c.escuro ? 0.18 : 0.14) }]}>
                <Icone nome="faisca" tamanho={16} cor={corCat} cheio />
              </View>
              <Text maxFontSizeMultiplier={1.4} style={[estilos.resumoTexto, { color: c.apoio }]}>
                {entrada ? 'Você recebeu ' : 'Você gastou '}
                <Text style={[estilos.resumoForte, { color: c.texto }]}>{oculto ? 'R$ ••••' : dinheiro(resumo.total)}</Text>
                {' em '}
                <Text style={[estilos.resumoForte, { color: c.texto }]}>{resumo.nome}</Text>
                {` ${quando} (${resumo.vezes === 1 ? '1 vez' : `${resumo.vezes} vezes`}).`}
              </Text>
            </View>
            {resumo.comHistorico ? (
              <View style={{ gap: 8 }}>
                <Text maxFontSizeMultiplier={1.3} style={[estilos.resumoRotulo, { color: c.fraco }]}>Últimos 6 meses</Text>
                <Barrinhas
                  valores={resumo.porMes}
                  rotulos={resumo.meses.map((m) => mesNome(m, true))}
                  cor={corCat}
                  altura={56}
                  formatar={(v) => (oculto ? 'valor escondido' : brlCurto(v))}
                />
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Editar e Apagar */}
      <View style={[estilos.rodape, { paddingBottom: Math.max(ins.bottom, 12) + 8, borderTopColor: c.linha, backgroundColor: c.fundoAlto }]}>
        <Botao titulo="Editar" icone="editar" variante="secundario" onPress={editar} rotulo="Editar no Avina" style={estilos.botao} />
        <Botao titulo="Apagar" icone="lixo" variante="perigo" onPress={apagar} carregando={apagando} style={estilos.botao} />
      </View>
      {botaoFechar}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  fechar: { position: 'absolute', top: 16, right: 16 },
  corpo: { paddingHorizontal: MARGEM, paddingTop: 28, paddingBottom: 20, gap: 14 },
  heroi: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 14 },
  desc: { fontFamily: Fontes.titulo, fontSize: 19, lineHeight: 25, letterSpacing: -0.2, textAlign: 'center', marginTop: 10, paddingHorizontal: 24 },
  valor: { marginTop: 2 },
  data: { fontFamily: Fontes.texto, fontSize: 14.5, lineHeight: 20, textAlign: 'center' },
  cartao: { borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 16 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 54 },
  linhaLonga: { gap: 4, paddingVertical: 14 },
  linhaValor: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rotulo: { fontFamily: Fontes.texto, fontSize: 15, lineHeight: 20 },
  linhaTexto: { flexShrink: 1, fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20, textAlign: 'right' },
  resumo: { paddingVertical: 16, gap: 16 },
  resumoTopo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  resumoIcone: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  resumoTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 15, lineHeight: 21 },
  resumoForte: { fontFamily: Fontes.textoForte },
  resumoRotulo: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  rodape: { flexDirection: 'row', gap: 10, paddingHorizontal: MARGEM, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  botao: { flex: 1 },
});
