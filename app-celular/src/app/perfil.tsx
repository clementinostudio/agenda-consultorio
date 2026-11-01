// Perfil (tela empurrada): a foto e o nome, a situação do plano e as conexões, e os ajustes do app.
// O que é do site (editar o perfil, avisos, excluir a conta) abre no Avina do site, por cima do Início.
// Regras das lojas: aqui não há preço, plano para escolher nem botão de assinar; o plano só aparece como situação.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, avisar, CartaoLista, confirmar, MARGEM, motivoFalha, Topo } from '@/components/bancos/comum';
import { Cabeca, Resumo } from '@/components/perfil/cabeca';
import { Interruptor } from '@/components/perfil/interruptor';
import { Segmento, type OpcaoSegmento } from '@/components/perfil/segmento';
import { entradaCascata, Icone, Linha, LuzDeFundo, Mascote, Secao, Separador, Texto, vibrar } from '@/components/ui';
import { Cores, Espaco, Fontes, useCores } from '@/constants/theme';
import { alternarOculto, pedirSite, useEstado, useOculto, type TemaEscolhido } from '@/lib/motor';
import { estadoTrava, ligarTrava } from '@/lib/trava';

// O atendimento do Avina (o mesmo "Fale com a gente" do site, src/plano.js)
const WHATSAPP_SUPORTE = '5543988208714';
const SUPORTE = `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent('Oi! Vim pelo app Avina e queria uma ajuda.')}`;
const PRIVACIDADE = 'https://app.avina.com.br/privacidade/';
const TERMOS = 'https://app.avina.com.br/termos/';

const TEMAS: OpcaoSegmento<TemaEscolhido>[] = [
  { id: 'auto', nome: 'Sistema', icone: 'celular' },
  { id: 'light', nome: 'Claro', icone: 'sol' },
  { id: 'dark', nome: 'Escuro', icone: 'lua' },
];

const abrirPagina = (url: string) => {
  WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, controlsColor: Cores.dark.azul })
    .catch(() => Linking.openURL(url).catch(() => {}));
};

type Trava = { disponivel: boolean; ligado: boolean; nome: string };

export default function Perfil() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const e = useEstado();
  const oculto = useOculto();
  const reduzir = useReducedMotion();
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler((ev) => { rolagem.set(ev.contentOffset.y); });

  // o tema escolhido aparece na hora (o site confirma e manda o retrato novo logo depois)
  const [pedido, setPedido] = useState<TemaEscolhido | null>(null);
  const [visto, setVisto] = useState(e?.tema);
  if (e?.tema !== visto) { setVisto(e?.tema); setPedido(null); } // chegou o retrato com o tema novo
  const tema = pedido ?? e?.tema ?? 'auto';
  const trocarTema = (modo: TemaEscolhido) => {
    setPedido(modo);
    pedirSite('tema', { modo }).catch((er) => { setPedido(null); avisar('Não deu para trocar a aparência', motivoFalha(er)); });
  };

  // o bloqueio com Face ID ou digital (só aparece quando o aparelho tem e a pessoa cadastrou)
  const [trava, setTrava] = useState<Trava | null>(null);
  useEffect(() => {
    let vivo = true;
    estadoTrava().then((t) => { if (vivo) setTrava(t); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const trocarTrava = async (ligar: boolean) => {
    setTrava((t) => t && { ...t, ligado: ligar });
    try {
      setTrava(await ligarTrava(ligar));
      vibrar('ok');
    } catch (er) {
      setTrava((t) => t && { ...t, ligado: !ligar });
      if ((er as Error)?.message !== 'cancelou') avisar('Não deu para mudar o bloqueio', 'Tente de novo em instantes.');
    }
  };

  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    const sim = await confirmar({
      titulo: 'Sair da conta?',
      texto: 'Seus dados continuam guardados na nuvem. Para voltar, é só entrar de novo com o seu e-mail.',
      sim: 'Sair',
      perigo: true,
    });
    if (!sim) return;
    setSaindo(true);
    try {
      await pedirSite('sair', null);
    } catch (er) {
      avisar('Não deu para sair agora', motivoFalha(er));
    } finally {
      setSaindo(false);
    }
  };

  const versao = Constants.expoConfig?.version;
  const entra = (i: number) => (reduzir ? undefined : entradaCascata(40 + i * 45, 360));

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo }]}>
      <LuzDeFundo />
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: ins.top + ALTURA_TOPO, paddingBottom: ins.bottom + Espaco.oito, paddingHorizontal: MARGEM, gap: Espaco.seis }}>
        {e && e.logado ? (
          <>
            <Animated.View entering={entra(0)} style={{ gap: Espaco.seis }}>
              <Cabeca e={e} />
              <Resumo e={e} />
            </Animated.View>

            <Animated.View entering={entra(1)}>
              <Secao titulo="Personalização">
                <CartaoLista>
                  <View style={estilos.aparencia}>
                    <View style={estilos.aparenciaTopo}>
                      <View style={[estilos.icone, { backgroundColor: c.cartao2 }]}>
                        <Icone nome={c.escuro ? 'lua' : 'sol'} tamanho={19} cor={c.texto} />
                      </View>
                      <Texto v="forte" style={estilos.tituloLinha}>Aparência</Texto>
                    </View>
                    <Segmento opcoes={TEMAS} valor={tema} onTrocar={trocarTema} rotulo="Aparência do Avina" />
                  </View>
                  <Separador recuo={52} />
                  <Linha icone="widgets" titulo="Cartões do Início" sub="Escolha o que aparece e em que ordem" chevron onPress={() => router.push('/widgets')} />
                </CartaoLista>
              </Secao>
            </Animated.View>

            <Animated.View entering={entra(2)}>
              <Secao titulo="Segurança">
                <CartaoLista>
                  {trava?.disponivel ? (
                    <>
                      <Linha
                        icone={Platform.OS === 'ios' && trava.nome === 'Face ID' ? 'faceid' : 'cadeado'}
                        titulo={`Bloqueio com ${trava.nome}`}
                        sub={`Pede ${/^(a|o) /.test(trava.nome) ? trava.nome : `o ${trava.nome}`} para abrir o Avina`}
                        direita={<Interruptor valor={trava.ligado} aoMudar={trocarTrava} rotulo={`Bloqueio com ${trava.nome}`} />}
                      />
                      <Separador recuo={52} />
                    </>
                  ) : null}
                  <Linha
                    icone={oculto ? 'olhoFechado' : 'olho'}
                    titulo="Esconder os valores"
                    sub="Vale para todas as telas"
                    direita={<Interruptor valor={oculto} aoMudar={() => { vibrar('toque'); alternarOculto(); }} rotulo="Esconder os valores" />}
                  />
                </CartaoLista>
              </Secao>
            </Animated.View>

            <Animated.View entering={entra(3)}>
              <Secao titulo="Conta">
                <CartaoLista>
                  <Linha icone="pessoa" titulo="Perfil e ajustes" sub="Nome, foto, profissão e preferências" chevron onPress={() => abrirNoSiteDaqui({ tela: 'ajustes' }, 'ajustes')} />
                  <Separador recuo={52} />
                  <Linha icone="sino" titulo="Avisos" sub="Lembretes de contas, sessões e metas" chevron onPress={() => abrirNoSiteDaqui({ tela: 'avisos' }, 'ajustes')} />
                </CartaoLista>
              </Secao>
            </Animated.View>

            <Animated.View entering={entra(4)}>
              <Secao titulo="Ajuda">
                <CartaoLista>
                  <Linha icone="chat" titulo="Falar com o suporte" sub="Direto no WhatsApp" chevron onPress={() => Linking.openURL(SUPORTE).catch(() => avisar('Não deu para abrir o WhatsApp', `O número do suporte é +55 43 98820-8714.`))} />
                  <Separador recuo={52} />
                  <Linha icone="escudo" titulo="Privacidade" sub="Como o Avina cuida dos seus dados" chevron onPress={() => abrirPagina(PRIVACIDADE)} />
                  <Separador recuo={52} />
                  <Linha icone="documento" titulo="Termos de uso" chevron onPress={() => abrirPagina(TERMOS)} />
                </CartaoLista>
              </Secao>
            </Animated.View>

            <Animated.View entering={entra(5)}>
              <CartaoLista>
                <Linha icone="sair" titulo={saindo ? 'Saindo…' : 'Sair da conta'} chevron={!saindo} onPress={saindo ? undefined : sair} rotulo="Sair da conta" />
                {e.conta?.uid ? (
                  <>
                    <Separador recuo={52} />
                    <Linha icone="lixo" titulo="Excluir conta" sub="Apaga a conta e todos os dados" perigo chevron onPress={() => abrirNoSiteDaqui({ tela: 'excluir-conta' }, 'ajustes')} />
                  </>
                ) : null}
              </CartaoLista>
            </Animated.View>

            <View style={estilos.rodape} accessible accessibilityLabel={`Avina${versao ? `, versão ${versao}` : ''}`}>
              <Mascote tamanho={30} animado={false} sombra={false} />
              <Texto v="apoio" cor={c.fraco} style={{ fontFamily: Fontes.textoForte, fontSize: 12 }}>Avina{versao ? ` · versão ${versao}` : ''}</Texto>
            </View>
          </>
        ) : null}
      </Animated.ScrollView>
      <Topo titulo={e?.conta?.nome?.trim() || 'Perfil'} rolagem={rolagem} tituloAoRolar />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  aparencia: { gap: Espaco.tres, paddingVertical: Espaco.tres },
  aparenciaTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres },
  icone: { width: 40, height: 40, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  tituloLinha: { fontSize: 16, lineHeight: 21 },
  rodape: { alignItems: 'center', gap: Espaco.dois, paddingTop: Espaco.dois },
});
