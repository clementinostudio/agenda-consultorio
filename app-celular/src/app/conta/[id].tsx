// O detalhe de uma conta fixa (folha que sobe de baixo, aberta pela lista de Contas fixas): a logo, o nome, o valor
// grande e a situação do mês; marcar como paga (ou desmarcar); o histórico dos últimos 12 meses, com o "Marcar
// outubro como pago" quando o mês passado ficou sem pagamento; o código do boleto para copiar; a categoria, o
// vencimento e a assinatura; e embaixo Editar (folha nativa), Apagar e as opções que ficam no site.
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apagarConta, desmarcarConta, editarContaNoSite, pagarConta, useContas } from '@/components/contas/acoes';
import { HistoricoConta } from '@/components/contas/historico';
import { corDaSituacao, LogoConta } from '@/components/contas/linha';
import { historicoConta, mesPassadoEmAberto, soDigitos, textoSituacao, todoDia, valorNaMoeda, type ContaMes } from '@/components/contas/regras';
import { Botao, BotaoRedondo, Dinheiro, Esqueleto, Icone, IconeCategoria, Linha, Pilula, Recado, Tocavel, Vazio, comAlfa, mostrarRecado, useCategoria, vibrar, type NomeIcone } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { dinheiro, mesNome } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

const MARGEM = 20;

export default function ContaDetalhe() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const oculto = useOculto();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dados = useContas();
  const achada = dados?.lista.find((x) => x.id === id) ?? null;
  // depois de apagar, a conta some do retrato antes da folha fechar: fica a última vista
  const [guardada, setGuardada] = useState<ContaMes | null>(achada);
  if (achada && achada !== guardada) setGuardada(achada);
  const [apagando, setApagando] = useState(false);
  const conta = achada ?? (apagando ? guardada : null);
  const cat = useCategoria(conta?.cat);

  const aberta = useRef(true);
  useEffect(() => { aberta.current = true; return () => { aberta.current = false; }; }, []);
  const fechar = () => {
    if (!aberta.current) return;
    if (router.canGoBack()) router.back(); else router.replace('/contas');
  };

  const barra = <StatusBar style={c.escuro ? 'light' : 'dark'} />;
  const botaoFechar = <BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={fechar} style={estilos.fechar} />;

  if (!dados) {
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
  if (!conta) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, justifyContent: 'center' }]}>
        {barra}
        {botaoFechar}
        <Vazio icone="conta" titulo="Esta conta não está mais aqui" texto="Ela pode ter sido apagada em outro aparelho." acao={{ titulo: 'Fechar', onPress: fechar }} />
      </View>
    );
  }

  const hist = historicoConta(conta, dados.hoje);
  const mesAberto = mesPassadoEmAberto(hist);
  const cor = corDaSituacao(conta.st, c);
  const situacao = textoSituacao(conta);
  const fundoCartao = c.escuro ? c.cartao : c.cartao2;

  const copiar = async () => {
    if (!conta.codigo) return;
    await Clipboard.setStringAsync(soDigitos(conta.codigo));
    vibrar('ok');
    mostrarRecado({ titulo: 'Código copiado', texto: 'Cole no app do seu banco para pagar', icone: 'copiar' });
  };
  const editar = () => router.push({ pathname: '/conta/editar', params: { id: conta.id } });
  const noSite = () => { editarContaNoSite(conta.id); };
  const apagar = async () => {
    if (apagando) return;
    setApagando(true);
    if (await apagarConta(conta)) fechar();
    else setApagando(false);
  };

  const linhas: { rotulo: string; valor: string; esquerda?: ReactNode; icone?: NomeIcone }[] = [
    { rotulo: 'Categoria', valor: cat?.nome ?? 'Outros', esquerda: <IconeCategoria cat={cat ?? conta.cat} tamanho={28} /> },
    { rotulo: 'Vencimento', valor: todoDia(conta.dia).replace(' (ou o último dia do mês)', ''), icone: 'calendario' },
    ...(conta.moeda && conta.valorOrig ? [{ rotulo: 'Cobrada em', valor: oculto ? '••••' : `${valorNaMoeda(conta.moeda, conta.valorOrig)}${conta.iof !== false ? ' + IOF' : ''}`, icone: 'transferir' as NomeIcone }] : []),
    ...(conta.assinatura ? [{ rotulo: 'Assinatura', valor: oculto ? 'R$ •••• por ano' : `${dinheiro(conta.valor * 12, { centavos: false })} por ano`, icone: 'estrela' as NomeIcone }] : []),
  ];
  const entra = (i: number) => (reduzir ? undefined : FadeInDown.duration(320).delay(40 + i * 50));

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundoAlto }]}>
      {barra}
      <ScrollView contentContainerStyle={estilos.corpo} showsVerticalScrollIndicator={false}>
        {/* a logo, o nome, o valor e a situação */}
        <View style={estilos.heroi}>
          <LogoConta c={conta} tamanho={76} anel={c.fundoAlto} />
          <Text numberOfLines={2} maxFontSizeMultiplier={1.4} accessibilityRole="header" style={[estilos.nome, { color: c.texto }]}>{conta.nome}</Text>
          <Dinheiro valor={conta.valor} tamanho={44} />
          {conta.moeda ? <Text maxFontSizeMultiplier={1.4} style={[estilos.apoio, { color: c.apoio }]}>O valor segue a cotação do dia</Text> : null}
          <Pilula texto={situacao} cor={cor} icone={conta.st === 'paga' ? 'check' : conta.st === 'atrasada' ? 'alerta' : 'calendario'} style={{ alignSelf: 'center', marginTop: 6 }} />
        </View>

        {conta.paga ? (
          <Botao titulo="Desmarcar o pagamento" icone="relogio" variante="secundario" largo vibra={false} onPress={() => { desmarcarConta(conta, { dataAntes: conta.pagaEm }); }} rotulo={`Desmarcar o pagamento de ${conta.nome} deste mês`} />
        ) : (
          <Botao titulo="Marcar como paga" icone="check" largo vibra={false} onPress={() => { pagarConta(conta); }} rotulo={`Marcar ${conta.nome} como paga`} />
        )}

        {/* o histórico de pagamentos */}
        <Animated.View entering={entra(0)} style={[estilos.cartao, estilos.historico, { backgroundColor: fundoCartao, borderColor: c.linha }]}>
          <HistoricoConta meses={hist} atrasadaAgora={conta.st === 'atrasada'} />
          {mesAberto ? (
            <Botao
              titulo={`Marcar ${mesNome(mesAberto.mes)} como pago`}
              icone="check"
              variante="secundario"
              tamanho="pequeno"
              vibra={false}
              onPress={() => { pagarConta(conta, { mes: mesAberto.mes }); }}
              rotulo={`Marcar ${mesNome(mesAberto.mes)} como pago, com a data de hoje`}
            />
          ) : null}
        </Animated.View>

        {/* o código do boleto */}
        {conta.codigo ? (
          <Animated.View entering={entra(1)} style={[estilos.cartao, estilos.codigo, { backgroundColor: fundoCartao, borderColor: c.linha }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text maxFontSizeMultiplier={1.4} style={[estilos.rotulo, { color: c.apoio }]}>Código do boleto</Text>
              {/* os blocos da linha digitável não quebram no meio */}
              <View style={estilos.blocos} accessible accessibilityLabel={`Código: ${conta.codigo}`}>
                {conta.codigo.split(/\s+/).filter(Boolean).map((b, i) => (
                  <Text key={i} selectable maxFontSizeMultiplier={1.3} style={[estilos.codigoTexto, { color: c.texto }]}>{b}</Text>
                ))}
              </View>
            </View>
            <Tocavel onPress={copiar} escala={0.94} accessibilityLabel="Copiar o código do boleto" style={[estilos.copiar, { backgroundColor: comAlfa(c.azul, c.escuro ? 0.2 : 0.1) }]}>
              <Icone nome="copiar" tamanho={16} cor={c.azulTinta} peso="semibold" />
              <Text maxFontSizeMultiplier={1.3} style={[estilos.copiarTexto, { color: c.azulTinta }]}>Copiar</Text>
            </Tocavel>
          </Animated.View>
        ) : null}

        {/* os detalhes */}
        <Animated.View entering={entra(2)} style={[estilos.cartao, { backgroundColor: fundoCartao, borderColor: c.linha }]}>
          {linhas.map((x, i) => (
            <View key={x.rotulo} accessible accessibilityLabel={`${x.rotulo}: ${x.valor}`} style={[estilos.linha, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.linhaForte }]}>
              <Text maxFontSizeMultiplier={1.4} style={[estilos.rotuloLinha, { color: c.apoio }]}>{x.rotulo}</Text>
              <View style={estilos.linhaValor}>
                {x.esquerda ?? (x.icone ? <Icone nome={x.icone} tamanho={16} cor={c.apoio} peso="semibold" /> : null)}
                <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={[estilos.linhaTexto, { color: c.texto }]}>{x.valor}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* o que fica no site */}
        <Animated.View entering={entra(3)} style={[estilos.cartao, { backgroundColor: fundoCartao, borderColor: c.linha }]}>
          <Linha
            icone="link"
            titulo="Mais opções no Avina completo"
            sub={conta.moeda ? 'Moeda, logo e código do boleto' : 'Logo, moeda e código do boleto'}
            chevron
            onPress={noSite}
            rotulo="Mais opções no Avina completo: logo, moeda estrangeira e código do boleto"
          />
        </Animated.View>
      </ScrollView>

      {/* Editar e Apagar */}
      <View style={[estilos.rodape, { paddingBottom: Math.max(ins.bottom, 12) + 8, borderTopColor: c.linha, backgroundColor: c.fundoAlto }]}>
        <Botao titulo="Editar" icone="editar" variante="secundario" onPress={editar} rotulo={`Editar ${conta.nome}`} style={estilos.botao} />
        <Botao titulo="Apagar" icone="lixo" variante="perigo" onPress={apagar} carregando={apagando} rotulo={`Apagar ${conta.nome}`} style={estilos.botao} />
      </View>
      {botaoFechar}
      {/* o recado (código copiado, conta paga) fica acima do Editar e Apagar */}
      <Recado base={Math.max(ins.bottom, 12) + 8 + 54 + 12 + 10} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  fechar: { position: 'absolute', top: 16, right: 16 },
  corpo: { paddingHorizontal: MARGEM, paddingTop: 28, paddingBottom: 20, gap: 14 },
  heroi: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 10 },
  nome: { fontFamily: Fontes.titulo, fontSize: 19, lineHeight: 25, letterSpacing: -0.2, textAlign: 'center', marginTop: 10, paddingHorizontal: 24 },
  apoio: { fontFamily: Fontes.texto, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  cartao: { borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 16 },
  historico: { paddingVertical: 16, gap: 14 },
  codigo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rotulo: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18 },
  blocos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  codigoTexto: { fontFamily: Fontes.textoForte, fontSize: 13.5, lineHeight: 20, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  copiar: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: Raio.pilula },
  copiarTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 54 },
  rotuloLinha: { fontFamily: Fontes.texto, fontSize: 15, lineHeight: 20 },
  linhaValor: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  linhaTexto: { flexShrink: 1, fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20, textAlign: 'right' },
  rodape: { flexDirection: 'row', gap: 10, paddingHorizontal: MARGEM, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  botao: { flex: 1 },
});
