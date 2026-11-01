// "Estou no mercado" (tela cheia): a lista de compras em letra e caixas grandes, por corredor, com a tela sempre
// acesa (expo-keep-awake, só enquanto esta tela está aberta). Um toque põe no carrinho; o campo de cima coloca o que
// lembrou na hora. Embaixo, quanto já está no carrinho e quanto falta pegar (pelo último preço) contra o limite da
// lista, "Avisar a casa" (o aviso no celular de quem mora junto) e "Ler a nota" (no Avina completo).
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirCasaNoSite, avisarMercado, useCasa } from '@/components/casa/acoes';
import { CampoAdicionar, LinhaItem } from '@/components/casa/lista';
import { organizarLista } from '@/components/casa/regras';
import { BarraProgresso } from '@/components/graficos';
import { Botao, BotaoRedondo, Icone, Recado, Separador, Vazio, comAlfa } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { dinheiro } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

const MARGEM = 20;

// O último preço de cada item enquanto ele ainda faltava: o retrato só traz o preço dos que faltam, e o carrinho
// soma o que foi pego nesta ida ao mercado
const precosVistos = new Map<string, number>();

export default function ModoMercado() {
  useKeepAwake('avina-mercado');
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const oculto = useOculto();
  const { C, nuvem } = useCasa();
  const L = useMemo(() => (C ? organizarLista(C.compras) : null), [C]);
  const [avisando, setAvisando] = useState<'' | 'indo' | 'ok'>('');

  const fechar = () => { if (router.canGoBack()) router.back(); else router.replace('/casa'); };
  const barra = <StatusBar style={c.escuro ? 'light' : 'dark'} />;

  if (!C || !L) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundo, justifyContent: 'center', paddingTop: ins.top }]}>
        {barra}
        <Vazio icone="carrinho" titulo="A lista não está aqui" texto="A casa ainda está abrindo. Tente de novo em alguns segundos." acao={{ titulo: 'Voltar', onPress: fechar }} />
      </View>
    );
  }

  const total = L.abertos.length + L.feitos.length;
  for (const x of L.abertos) if (x.preco) precosVistos.set(x.id, x.preco.total);
  const noCarrinho = L.feitos.reduce((t, x) => t + (x.preco?.total ?? precosVistos.get(x.id) ?? 0), 0);
  const falta = L.estimado;
  const limite = C.listaLimite ?? 0;
  const passou = limite > 0 && noCarrinho + falta > limite;
  const v = (n: number) => (oculto ? 'R$ ••••' : dinheiro(n, { centavos: false }));
  const mexe = reduzir ? undefined : LinearTransition.duration(220);
  const entra = reduzir ? undefined : FadeIn.duration(200);
  const sai = reduzir ? undefined : FadeOut.duration(150);
  const podeAvisar = nuvem && C.membros.length > 1;

  const avisar = async () => {
    if (avisando) return;
    setAvisando('indo');
    const ok = await avisarMercado();
    setAvisando(ok ? 'ok' : '');
  };

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      {barra}
      <View style={[estilos.topo, { paddingTop: ins.top + 8, borderBottomColor: c.linha, backgroundColor: c.fundo }]}>
        <View style={estilos.topoLinha}>
          <BotaoRedondo icone="fechar" rotulo="Sair do modo mercado" variante="solido" tamanho={40} onPress={fechar} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[estilos.titulo, { color: c.texto }]}>No mercado</Text>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.sub, { color: c.apoio }]}>{L.feitos.length} de {total} no carrinho · a tela fica acesa</Text>
          </View>
          <View style={[estilos.acesa, { backgroundColor: comAlfa(c.ambar, c.escuro ? 0.16 : 0.12) }]} accessible accessibilityLabel="A tela fica acesa enquanto você está no mercado">
            <Icone nome="sol" tamanho={16} cor={c.ambar} cheio />
          </View>
        </View>
        <BarraProgresso progresso={total ? L.feitos.length / total : 0} cor={c.positivo} altura={6} fundo={c.escuro ? c.cartao2 : c.cartao3} rotulo={`${L.feitos.length} de ${total} no carrinho`} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={estilos.corpo} showsVerticalScrollIndicator={false}>
        <CampoAdicionar C={C} dica="Lembrei de mais uma coisa…" grande />
        {!L.abertos.length ? (
          <Animated.View entering={entra} style={[estilos.fim, { backgroundColor: comAlfa(c.positivo, c.escuro ? 0.12 : 0.08), borderColor: comAlfa(c.positivo, 0.3) }]}>
            <View style={[estilos.fimIcone, { backgroundColor: comAlfa(c.positivo, 0.2) }]}>
              <Icone nome="check" tamanho={24} cor={c.positivo} peso="bold" />
            </View>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.fimTitulo, { color: c.texto }]}>{total ? 'Tudo no carrinho!' : 'A lista está vazia'}</Text>
            <Text maxFontSizeMultiplier={1.4} style={[estilos.fimTexto, { color: c.apoio }]}>{total ? 'No caixa, leia a nota: os preços ficam guardados para a próxima compra.' : 'Coloque o que precisa no campo de cima.'}</Text>
          </Animated.View>
        ) : null}
        {L.grupos.map((g) => (
          <Animated.View key={g.secao} layout={mexe} entering={entra} exiting={sai} style={{ gap: 2 }}>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.corredor, { color: c.apoio }]}>{g.nome}</Text>
            <View style={[estilos.bloco, { backgroundColor: c.cartao, borderColor: c.linha }]}>
              {g.itens.map((x, i) => (
                <Animated.View key={x.id} layout={mexe} entering={entra} exiting={sai}>
                  {i ? <Separador recuo={44} /> : null}
                  <LinhaItem C={C} x={x} grande />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ))}
        {L.feitos.length ? (
          <Animated.View layout={mexe} style={{ gap: 2 }}>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.corredor, { color: c.positivo }]}>No carrinho</Text>
            <View style={[estilos.bloco, { backgroundColor: c.cartao, borderColor: c.linha }]}>
              {L.feitos.map((x, i) => (
                <Animated.View key={x.id} layout={mexe} entering={entra} exiting={sai}>
                  {i ? <Separador recuo={44} /> : null}
                  <LinhaItem C={C} x={x} grande />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[estilos.rodape, { paddingBottom: Math.max(ins.bottom, 12) + 4, borderTopColor: c.linha, backgroundColor: c.escuro ? c.fundoAlto : c.cartao }]}>
        {total ? (
          <View style={estilos.contas}>
            <Conta rotulo="No carrinho" valor={noCarrinho > 0 ? `~${v(noCarrinho)}` : `${L.feitos.length} ${L.feitos.length === 1 ? 'item' : 'itens'}`} />
            <Conta rotulo="Falta pegar" valor={`~${v(falta)}`} />
            {limite > 0 ? <Conta rotulo={passou ? 'Passa do limite' : 'Limite'} valor={passou ? `+${v(noCarrinho + falta - limite)}` : v(limite)} cor={passou ? c.negativo : undefined} /> : null}
          </View>
        ) : null}
        <View style={estilos.botoes}>
          {podeAvisar ? (
            <Botao
              titulo={avisando === 'ok' ? 'Casa avisada' : 'Avisar a casa'}
              icone={avisando === 'ok' ? 'check' : 'sino'}
              variante="secundario"
              tamanho="medio"
              carregando={avisando === 'indo'}
              desativado={avisando === 'ok'}
              onPress={avisar}
              rotulo="Avisar quem mora junto que você está no mercado"
              style={{ flex: 1 }}
            />
          ) : null}
          <Botao titulo="Ler a nota" icone="recibo" tamanho="medio" onPress={() => { fechar(); abrirCasaNoSite('casa-nota'); }} rotulo="Ler a nota do mercado (abre no Avina completo)" style={{ flex: 1 }} />
        </View>
      </View>
      <Recado base={Math.max(ins.bottom, 12) + 128} />
    </View>
  );
}

function Conta({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  const c = useCores();
  return (
    <View style={{ flex: 1, gap: 1 }} accessible accessibilityLabel={`${rotulo}: ${valor.replace('~', 'cerca de ')}`}>
      <Text maxFontSizeMultiplier={1.3} style={[estilos.contaRotulo, { color: c.apoio }]}>{rotulo}</Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={[estilos.contaValor, { color: cor ?? c.texto }]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { paddingHorizontal: MARGEM, paddingBottom: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 2 },
  topoLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontFamily: Fontes.tituloForte, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  sub: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18 },
  acesa: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  corpo: { paddingHorizontal: MARGEM, paddingTop: 16, paddingBottom: 24, gap: 16 },
  corredor: { fontFamily: Fontes.textoPesado, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 4, marginBottom: 4 },
  bloco: { borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 14 },
  fim: { alignItems: 'center', gap: 8, padding: 24, borderRadius: Raio.cartao, borderCurve: 'continuous', borderWidth: 1 },
  fimIcone: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  fimTitulo: { fontFamily: Fontes.tituloForte, fontSize: 20, lineHeight: 26 },
  fimTexto: { fontFamily: Fontes.texto, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  rodape: { paddingHorizontal: MARGEM, paddingTop: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  contas: { flexDirection: 'row', gap: 12 },
  contaRotulo: { fontFamily: Fontes.texto, fontSize: 12.5, lineHeight: 16 },
  contaValor: { fontFamily: Fontes.tituloForte, fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
  botoes: { flexDirection: 'row', gap: 10 },
});
