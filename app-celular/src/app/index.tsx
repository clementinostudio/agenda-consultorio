// O Avina inteiro: o mesmo app do site (../src), guardado dentro do app e aberto numa WebView, com os recursos
// do celular por cima (Face ID, avisos do aparelho, vibração, localização, Compartilhar, telas nativas).
// - O HTML abre como se estivesse em https://app.avina.com.br/: o login, a nuvem e o servidor funcionam igual ao site.
// - Os pedidos do site chegam pela ponte (lib/ponte.ts) e são atendidos em `atender`, logo abaixo.
// - Links de fora (WhatsApp, mapa, Sefaz, termos) abrem fora da WebView: o Avina nunca sai da própria tela.
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as SplashScreen from 'expo-splash-screen';
import { File, Paths } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Alert, AppState, BackHandler, Keyboard, Linking, Platform, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import Constants from 'expo-constants';

import { Cores } from '@/constants/theme';
import * as avisos from '@/lib/avisos';
import { resposta, scriptDaPonte, type Pedido } from '@/lib/ponte';
import { carregarSite, ENDERECO, procurarVersaoNova } from '@/lib/site';
import { estadoTrava, ligarTrava } from '@/lib/trava';

// os tipos da biblioteca juntam as props com "undefined" (no TypeScript 6 isso vira never): usa as props direto
const Vista = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

const VERSAO_APP = Constants.expoConfig?.version ?? '1.0.0';
const PONTE_JS = scriptDaPonte(Platform.OS, VERSAO_APP);
// fora por mais que isso, e com uma versão nova baixada: abre a versão nova ao voltar
const TROCAR_VERSAO_APOS = 30 * 60_000;

// Links que abrem nos apps do celular (WhatsApp, mapas, telefone, e-mail); o resto abre no navegador do app
const NOS_APPS = /^(tel|mailto|sms|geo|whatsapp|maps|comgooglemaps):|^https:\/\/(wa\.me|api\.whatsapp\.com|maps\.apple\.com|maps\.google\.|www\.google\.com\/maps|goo\.gl\/maps)/i;
function abrirFora(url: string) {
  if (!url || /^(about|blob|data|javascript):/i.test(url)) return;
  if (NOS_APPS.test(url) || !/^https?:/i.test(url)) { Linking.openURL(url).catch(() => {}); return; }
  WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, controlsColor: Cores.dark.azul }).catch(() => Linking.openURL(url).catch(() => {}));
}

const nomeSeguro = (s: string) => String(s || 'arquivo').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'arquivo';

export default function Avina() {
  const web = useRef<WebView>(null);
  const [site, setSite] = useState<{ html: string; versao: number } | null>(null);
  const [chave, setChave] = useState(0);
  const [cores, setCores] = useState({ topo: Cores.dark.fundo, fundo: Cores.dark.fundo });
  const [teclado, setTeclado] = useState(0);
  const novaPronta = useRef(false);
  const saiu = useRef(0);
  const ins = useSafeAreaInsets();
  const android = Platform.OS === 'android';

  useEffect(() => { carregarSite().then(setSite).catch(() => SplashScreen.hideAsync()); }, []);

  // versão nova do Avina: procura ao abrir e ao voltar para o app; entra depois de um tempo fora (ou na próxima abertura)
  useEffect(() => {
    if (!site) return;
    procurarVersaoNova(site.versao).then((n) => { novaPronta.current = n; });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') { saiu.current = Date.now(); return; }
      if (st !== 'active') return;
      const longe = saiu.current && Date.now() - saiu.current > TROCAR_VERSAO_APOS;
      saiu.current = 0;
      if (longe && novaPronta.current) { novaPronta.current = false; carregarSite().then(setSite); return; }
      procurarVersaoNova(site.versao).then((n) => { novaPronta.current = n; });
    });
    return () => sub.remove();
  }, [site]);

  // Android: o teclado não empurra a WebView sozinho (tela de ponta a ponta); a gente encolhe ela
  useEffect(() => {
    if (!android) return;
    const a = Keyboard.addListener('keyboardDidShow', (e) => setTeclado(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardDidHide', () => setTeclado(0));
    return () => { a.remove(); b.remove(); };
  }, [android]);

  // Android: o voltar fecha a camada de cima do Avina (o site guarda uma entrada no histórico); sem camada, sai do app
  useEffect(() => {
    if (!android) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      web.current?.injectJavaScript(`(function(){ if (history.state && history.state.alvenaGuarda) history.back(); else window.ReactNativeWebView.postMessage(JSON.stringify({ acao: "sair" })); })(); true;`);
      return true;
    });
    return () => sub.remove();
  }, [android]);

  const atender = useCallback(async (p: Pedido): Promise<unknown> => {
    const d = p.dados || {};
    switch (p.acao) {
      case 'vibrar': {
        const t = String(d || 'toque');
        if (t === 'ok') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else if (t === 'erro') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        else if (t === 'aviso') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return null;
      }
      case 'local': {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('negado');
        const ultimo = d.maximumAge > 0 ? await Location.getLastKnownPositionAsync({ maxAge: d.maximumAge, requiredAccuracy: 3000 }) : null;
        const pos = ultimo ?? (await Location.getCurrentPositionAsync({ accuracy: d.alta ? Location.Accuracy.High : Location.Accuracy.Balanced }));
        return { lat: pos.coords.latitude, lon: pos.coords.longitude, precisao: pos.coords.accuracy, t: pos.timestamp };
      }
      case 'compartilhar': {
        const arqs: { nome: string; tipo: string; base64: string }[] = d.arquivos || [];
        if (arqs.length) {
          const f = arqs[0];
          const arq = new File(Paths.cache, nomeSeguro(f.nome));
          if (arq.exists) arq.delete();
          arq.create();
          await arq.write(f.base64, { encoding: 'base64' });
          await Sharing.shareAsync(arq.uri, { mimeType: f.tipo || undefined, dialogTitle: d.titulo || f.nome });
          return 'ok';
        }
        const texto = [d.texto, Platform.OS === 'ios' ? '' : d.url].filter(Boolean).join('\n');
        const r = await Share.share(Platform.OS === 'ios' ? { message: texto || undefined, url: d.url || undefined } : { message: texto, title: d.titulo || undefined });
        return r.action === Share.dismissedAction ? 'cancelou' : 'ok';
      }
      case 'confirmar':
        return new Promise((ok) => Alert.alert(d.titulo || '', d.texto || '', [
          { text: d.nao || 'Cancelar', style: 'cancel', onPress: () => ok(false) },
          { text: d.sim || 'OK', onPress: () => ok(true) },
        ], { cancelable: true, onDismiss: () => ok(false) }));
      case 'avisos:permissao': return avisos.permissao(!!d.pedir);
      case 'avisos:agendar': return avisos.agendar(d.avisos || []);
      case 'avisos:cancelar': await avisos.cancelar(); return null;
      case 'avisos:mostrar': return avisos.mostrar(d.titulo || 'Avina', d.corpo || '', !!d.pedir);
      case 'avisos:teste': return avisos.mostrar(d.titulo || 'Teste de aviso', d.corpo || '', true, Number(d.atraso) || 0);
      case 'trava:estado': return estadoTrava();
      case 'trava:ligar': return ligarTrava(!!d.ligar);
      case 'abrir':
        if (d.tela === 'postos') router.push({ pathname: '/postos', params: { comb: d.comb || '', consumo: String(d.consumo || '') } });
        else throw new Error('tela');
        return null;
      case 'cores': setCores((c) => ({ topo: d.topo || c.topo, fundo: d.fundo || c.fundo })); return null;
      case 'recarregar': setChave((k) => k + 1); return null;
      case 'sair': BackHandler.exitApp(); return null;
      default: throw new Error('acao-desconhecida');
    }
  }, []);

  const aoMensagem = useCallback((e: WebViewMessageEvent) => {
    let p: Pedido;
    try { p = JSON.parse(e.nativeEvent.data); } catch { return; }
    atender(p).then(
      (v) => p.id && web.current?.injectJavaScript(resposta(p.id, null, v)),
      (err) => p.id && web.current?.injectJavaScript(resposta(p.id, String((err && err.message) || err || 'erro'))),
    );
  }, [atender]);

  // A WebView só navega dentro do próprio Avina (mudança de #); qualquer outro endereço abre fora
  const podeAbrir = useCallback((r: ShouldStartLoadRequest) => {
    if (r.isTopFrame === false) return true; // quadros de dentro (ex.: o leitor de PDF)
    const u = r.url || '';
    if (u.startsWith(ENDERECO) && (u === ENDERECO || u.startsWith(ENDERECO + '#') || u.startsWith(ENDERECO + '?'))) return true;
    if (/^(about:blank|blob:|data:)/i.test(u)) return true;
    abrirFora(u);
    return false;
  }, []);

  if (!site) return <View style={{ flex: 1, backgroundColor: Cores.dark.fundo }} />;
  return (
    // iPhone: o Avina vai de ponta a ponta (o site já respeita o entalhe e a barra de baixo).
    // Android: a WebView fica entre as barras do sistema, com a cor da tela por trás delas.
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: android ? ins.top : 0, paddingBottom: android ? Math.max(ins.bottom, teclado) : 0 }}>
      {android && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ins.top, backgroundColor: cores.topo }} />}
      <Vista
        key={`${site.versao}-${chave}`}
        ref={web}
        source={{ html: site.html, baseUrl: ENDERECO }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={PONTE_JS}
        onMessage={aoMensagem}
        onShouldStartLoadWithRequest={podeAbrir}
        onOpenWindow={(e: WebViewOpenWindowEvent) => abrirFora(e.nativeEvent.targetUrl)}
        javaScriptCanOpenWindowsAutomatically
        onLoadEnd={() => SplashScreen.hideAsync()}
        // o sistema derrubou a WebView para liberar memória: abre de novo (os dados ficam guardados)
        onContentProcessDidTerminate={() => setChave((k) => k + 1)}
        onRenderProcessGone={() => setChave((k) => k + 1)}
        applicationNameForUserAgent={`AvinaApp/${VERSAO_APP}`}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: cores.fundo }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        overScrollMode="never"
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        allowsInlineMediaPlayback
        // câmera (QR da nota, código de barras) e microfone (falar com a Bolinha): a permissão é a do celular
        mediaCapturePermissionGrantType="grant"
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows
        allowFileAccess={false}
        webviewDebuggingEnabled={__DEV__}
        pullToRefreshEnabled={false}
      />
    </View>
  );
}
