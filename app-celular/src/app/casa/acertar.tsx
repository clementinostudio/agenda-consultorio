// Acertar uma dívida da casa (folha que sobe de baixo, aberta por "Recebi" ou "Já paguei" em Quem deve quanto):
// quem paga para quem, o valor grande (a dívida inteira; "Outro valor" abre o teclado para acertar só uma parte) e,
// quando é você quem recebe, a sua chave Pix para copiar e o lembrete pelo WhatsApp. Confirmar fecha na hora; o
// recado traz o Desfazer (components/casa/acoes.ts).
// Parâmetros: ?de=&para=&valor= (a dívida como aparece em Estado.casa.casa.dividas).
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Teclado, Visor, falarValor, teclar, valorDoTexto, type Tecla } from '@/components/atividades/teclado';
import { acertar, lembrarNoWhatsApp, useCasa } from '@/components/casa/acoes';
import { AvatarMembro } from '@/components/casa/pessoas';
import { coresDaCasa, nomeDe } from '@/components/casa/regras';
import { Botao, BotaoRedondo, Chip, Dinheiro, Icone, Recado, Tocavel, Vazio, comAlfa, mostrarRecado, vibrar } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { dinheiro } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

const MARGEM = 20;
const textoDoValor = (v: number) => (v > 0 ? v.toFixed(2).replace('.', ',').replace(/,00$/, '') : '');

export default function Acertar() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const reduzir = useReducedMotion();
  const oculto = useOculto();
  const { C } = useCasa();
  const p = useLocalSearchParams<{ de?: string; para?: string; valor?: string }>();
  const divida = Number(p.valor) || 0;
  const [outro, setOutro] = useState(false);
  const [txt, setTxt] = useState(() => textoDoValor(divida));
  const [tremor, setTremor] = useState(0);
  const [intocado, setIntocado] = useState(true); // a primeira tecla começa um valor novo (o da dívida fica de referência)

  const fechar = () => { if (router.canGoBack()) router.back(); else router.replace('/casa'); };
  const de = C?.membros.find((m) => m.id === p.de);
  const para = C?.membros.find((m) => m.id === p.para);

  if (!C || !de || !para || !(divida > 0)) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, justifyContent: 'center' }]}>
        <StatusBar style={c.escuro ? 'light' : 'dark'} />
        <Vazio icone="check" cor={c.positivo} titulo="Nada para acertar aqui" texto="Essa conta pode já ter sido acertada em outro celular da casa." acao={{ titulo: 'Fechar', onPress: fechar }} />
      </View>
    );
  }

  const cores = coresDaCasa(C, c);
  const valor = outro ? valorDoTexto(txt) : divida;
  const souEuQuemRecebe = para.id === C.eu;
  const souEuQuemPaga = de.id === C.eu;
  const frase = souEuQuemRecebe ? `${nomeDe(C, de.id)} paga para você` : souEuQuemPaga ? `Você paga para ${nomeDe(C, para.id)}` : `${nomeDe(C, de.id)} paga para ${nomeDe(C, para.id)}`;
  const acao = souEuQuemRecebe ? 'Recebi' : souEuQuemPaga ? 'Já paguei' : 'Marcar como acertado';
  const pode = valor > 0;

  const aoTeclar = (t: Tecla) => {
    const n = teclar(intocado && t !== 'apagar' ? '' : txt, t);
    setIntocado(false);
    if (n === null) { if (t !== 'apagar') { vibrar('aviso'); setTremor((x) => x + 1); } return; }
    setTxt(n);
  };
  const confirmar = () => {
    if (!pode) { vibrar('aviso'); setTremor((x) => x + 1); return; }
    acertar(C, { de: de.id, para: para.id, valor: Math.round(valor * 100) / 100 });
    fechar();
  };
  const copiarPix = async () => {
    if (!C.pix) return;
    await Clipboard.setStringAsync(C.pix);
    vibrar('ok');
    mostrarRecado({ titulo: 'Chave Pix copiada', texto: `Mande para ${nomeDe(C, de.id)}`, icone: 'copiar' });
  };

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: Math.max(ins.bottom, 12) + 8 }]}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />
      <View style={estilos.topo}>
        <BotaoRedondo icone="fechar" rotulo="Fechar sem acertar" variante="solido" tamanho={36} onPress={fechar} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[estilos.titulo, { color: c.texto }]}>Acertar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.corpo} showsVerticalScrollIndicator={false}>
        {/* quem paga → quem recebe */}
        <Animated.View entering={reduzir ? undefined : FadeInDown.duration(320)} style={estilos.pessoas} accessible accessibilityLabel={frase}>
          <View style={estilos.pessoa}>
            <AvatarMembro m={de} cor={cores[de.id]} tamanho={64} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.pessoaNome, { color: c.texto }]}>{nomeDe(C, de.id)}</Text>
          </View>
          <View style={estilos.caminho}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={[estilos.ponto, { backgroundColor: comAlfa(c.positivo, 0.25 + i * 0.2) }]} />)}
            <Icone nome="chevron" tamanho={16} cor={c.positivo} peso="bold" />
          </View>
          <View style={estilos.pessoa}>
            <AvatarMembro m={para} cor={cores[para.id]} tamanho={64} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.pessoaNome, { color: c.texto }]}>{nomeDe(C, para.id)}</Text>
          </View>
        </Animated.View>
        <Text maxFontSizeMultiplier={1.3} style={[estilos.frase, { color: c.apoio }]}>{frase}</Text>

        {/* o valor: a dívida inteira, ou outro (só uma parte) */}
        <Pressable onPress={() => { if (!outro) { setOutro(true); vibrar('toque'); } }} accessibilityRole="button" accessibilityLabel={`Valor do acerto: ${outro ? falarValor(txt) : dinheiro(divida)}`} style={estilos.valor}>
          {outro ? (
            <Visor txt={txt} cor={c.texto} ativo tremor={tremor} />
          ) : (
            <Dinheiro valor={divida} tamanho={46} />
          )}
        </Pressable>
        <View style={estilos.opcoes}>
          <Chip titulo="Tudo" ativo={!outro} onPress={() => { setOutro(false); setTxt(textoDoValor(divida)); setIntocado(true); }} />
          <Chip titulo="Outro valor" icone="editar" ativo={outro} onPress={() => setOutro(true)} />
        </View>
        {outro && valor > divida + 0.005 ? (
          <Text maxFontSizeMultiplier={1.3} style={[estilos.dica, { color: c.ambar }]}>É mais do que a dívida ({dinheiro(divida)}): a diferença vira crédito do outro lado.</Text>
        ) : null}

        {/* a chave Pix (a sua: é você quem recebe) */}
        {!outro && souEuQuemRecebe ? (
          <Animated.View entering={reduzir ? undefined : FadeIn.duration(240)} style={[estilos.pix, { backgroundColor: c.escuro ? c.cartao : c.cartao2, borderColor: c.linha }]}>
            {C.pix ? (
              <View style={estilos.pixLinha}>
                <View style={[estilos.pixIcone, { backgroundColor: comAlfa(c.menta, c.escuro ? 0.16 : 0.12) }]}>
                  <Icone nome="dinheiro" tamanho={18} cor={c.positivo} peso="semibold" />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text maxFontSizeMultiplier={1.3} style={[estilos.pixRotulo, { color: c.apoio }]}>Sua chave Pix</Text>
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.pixChave, { color: c.texto }]}>{C.pix}</Text>
                </View>
                <Tocavel onPress={copiarPix} escala={0.92} accessibilityLabel="Copiar a sua chave Pix" style={[estilos.copiar, { borderColor: c.linhaForte }]}>
                  <Icone nome="copiar" tamanho={17} cor={c.texto} peso="semibold" />
                </Tocavel>
              </View>
            ) : (
              <Text maxFontSizeMultiplier={1.4} style={[estilos.pixRotulo, { color: c.apoio }]}>Coloque sua chave Pix nos ajustes do Avina e ela vai junto no lembrete.</Text>
            )}
            <Botao titulo="Lembrar no WhatsApp" icone="chat" variante="secundario" tamanho="medio" largo onPress={() => lembrarNoWhatsApp(C, { de: de.id, valor: divida })} rotulo={`Lembrar ${nomeDe(C, de.id)} no WhatsApp`} />
          </Animated.View>
        ) : null}
        {!outro && souEuQuemPaga ? (
          <Text maxFontSizeMultiplier={1.4} style={[estilos.dica, { color: c.apoio }]}>Passe o valor para {nomeDe(C, para.id)} pelo app do seu banco e confirme aqui. Fica anotado para os dois.</Text>
        ) : null}
      </ScrollView>

      {outro ? (
        <Animated.View entering={reduzir ? undefined : FadeIn.duration(180)} style={estilos.teclado}>
          <Teclado altura={50} aoTeclar={aoTeclar} aoLimpar={() => { if (txt) { vibrar('firme'); setTxt(''); } }} />
        </Animated.View>
      ) : null}

      <View style={estilos.rodape}>
        <Botao
          titulo={pode ? `${acao} ${oculto ? '' : dinheiro(valor)}`.trim() : acao}
          icone="check"
          largo
          vibra={false}
          desativado={!pode}
          onPress={confirmar}
          rotulo={pode ? `${acao}: acertar ${dinheiro(valor)}` : `${acao} (digite o valor)`}
        />
      </View>
      {/* o "Chave Pix copiada" aparece aqui, por cima da folha */}
      <Recado base={Math.max(ins.bottom, 12) + 80} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, minHeight: 62 },
  titulo: { fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  corpo: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: MARGEM, paddingTop: 12, paddingBottom: 32, alignItems: 'center', gap: 14 },
  pessoas: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pessoa: { alignItems: 'center', gap: 8, width: 92 },
  pessoaNome: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  caminho: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -26 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  frase: { fontFamily: Fontes.texto, fontSize: 15, lineHeight: 20, textAlign: 'center' },
  valor: { minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  opcoes: { flexDirection: 'row', gap: 8 },
  dica: { fontFamily: Fontes.texto, fontSize: 13.5, lineHeight: 19, textAlign: 'center', maxWidth: 320 },
  pix: { alignSelf: 'stretch', gap: 14, marginTop: 6, padding: 16, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1 },
  pixLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pixIcone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pixRotulo: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18 },
  pixChave: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  copiar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  teclado: { marginHorizontal: 14, marginBottom: 4 },
  rodape: { paddingHorizontal: MARGEM, paddingTop: 12 },
});
