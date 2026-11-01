// A camada do site: o Avina inteiro (o mesmo app do site, ../src), guardado dentro do app e aberto numa WebView
// que fica SEMPRE montada, atrás das telas nativas (montada uma vez em src/app/_layout.tsx, irmã do <Stack>).
// - O site é o motor: login, dados, nuvem, banco, IA. As telas nativas leem o retrato que ele manda (pedido
//   "estado") e pedem as ações a ele (lib/motor.ts, pedirSite). Aqui só se liga o fio dos dois lados.
// - Escondida: fica atrás do <Stack> (que tem fundo opaco), transparente e sem receber toques. mostrarWeb() traz para
//   a frente com um fade e uma escala bem leve; esconderWeb() devolve. A WebView nunca desmonta por isso.
// - Sem login, o site fica na frente (a tela de entrar e o cadastro são as do site).
// - O HTML abre como se estivesse em https://app.avina.com.br/: o login, a nuvem e o servidor funcionam igual ao site.
// - Os pedidos do site chegam pela ponte (lib/ponte.ts) e são atendidos em `atender`, logo abaixo.
// - Links de fora (WhatsApp, mapa, Sefaz, termos) abrem fora da WebView: o Avina nunca sai da própria tela.
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, usePathname } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Alert, AppState, BackHandler, Keyboard, Linking, Platform, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';

import { Cores } from '@/constants/theme';
import * as avisos from '@/lib/avisos';
import {
  esconderWeb, lerEstado, lerWeb, ligarInjetor, mostrarWeb, receberEstado, receberResposta, siteProntoParaPedidos,
  siteReiniciou, useLogado, useWeb, type Estado,
} from '@/lib/motor';
import { resposta, scriptDaPonte, type Pedido } from '@/lib/ponte';
import { carregarSite, ENDERECO, procurarVersaoNova } from '@/lib/site';
import { estadoTrava, ligarTrava } from '@/lib/trava';

// os tipos da biblioteca juntam as props com "undefined" (no TypeScript 6 isso vira never): usa as props direto
const Vista = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

const VERSAO_APP = Constants.expoConfig?.version ?? '1.0.0';
const PONTE_JS = scriptDaPonte(Platform.OS, VERSAO_APP);
// fora por mais que isso, e com uma versão nova baixada: abre a versão nova ao voltar
const TROCAR_VERSAO_APOS = 30 * 60_000;
const IOS = Platform.OS === 'ios';
const ANDROID = Platform.OS === 'android';
const ENTRAR_MS = 260;
const SAIR_MS = 200;
const BORDA = 18; // iPhone: a faixa da borda esquerda onde o gesto de voltar começa

// Android: o voltar fecha a camada de cima do site (ele guarda uma entrada no histórico); sem camada, avisa o app
const VOLTAR_JS = `(function(){ if (history.state && history.state.alvenaGuarda) history.back(); else window.ReactNativeWebView.postMessage(JSON.stringify({ acao: "voltar:raiz" })); })(); true;`;

// iPhone: modais e folhas (presentation modal/formSheet em _layout.tsx) o iOS apresenta por cima de tudo, até da
// camada do site; com elas abertas o site pode continuar na frente, atrás da folha. As telas empurradas (e todas
// no Android) ficam dentro do <Stack>: com elas abertas o site vai para trás, senão ficariam escondidas.
const POR_CIMA_IOS = /^\/(postos|chat|novo|widgets|lancamento)(\/|$)/;

// Links que abrem nos apps do celular (WhatsApp, mapas, telefone, e-mail); o resto abre no navegador do app
const NOS_APPS = /^(tel|mailto|sms|geo|whatsapp|maps|comgooglemaps):|^https:\/\/(wa\.me|api\.whatsapp\.com|maps\.apple\.com|maps\.google\.|www\.google\.com\/maps|goo\.gl\/maps)/i;
function abrirFora(url: string) {
  if (!url || /^(about|blob|data|javascript):/i.test(url)) return;
  if (NOS_APPS.test(url) || !/^https?:/i.test(url)) { Linking.openURL(url).catch(() => {}); return; }
  WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, controlsColor: Cores.dark.azul }).catch(() => Linking.openURL(url).catch(() => {}));
}

const nomeSeguro = (s: string) => String(s || 'arquivo').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'arquivo';

// "#0A0C11" ou "rgb(242, 242, 245)": a cor é clara? (aí os ícones da barra de status ficam escuros)
function corClara(cor: string): boolean {
  let rgb: number[] = [];
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(cor || '').trim());
  if (h) {
    const x = h[1].length === 3 ? h[1].replace(/./g, (d) => d + d) : h[1];
    rgb = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  } else rgb = (String(cor || '').match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  if (rgb.length < 3 || rgb.some((n) => !Number.isFinite(n))) return false;
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 160;
}

// O site mudou de login: sem login, ele vem para a frente (fechando as telas nativas abertas); ao entrar, volta
// para trás se só estava na frente por causa do login
function aoMudarLogin(logado: boolean) {
  const w = lerWeb();
  if (!logado) {
    try { if (router.canDismiss()) router.dismissAll(); } catch {}
    if (!w.visivel || w.motivo !== 'login') mostrarWeb('login');
  } else if (w.visivel && w.motivo === 'login') esconderWeb();
}

export function CamadaWeb() {
  const web = useRef<WebView>(null);
  const [site, setSite] = useState<{ html: string; versao: number } | null>(null);
  const [chave, setChave] = useState(0);
  const [cores, setCores] = useState({ topo: Cores.dark.fundo, fundo: Cores.dark.fundo });
  const [teclado, setTeclado] = useState(0);
  const novaPronta = useRef(false);
  const saiu = useRef(0);
  const ins = useSafeAreaInsets();
  const { width: largura } = useWindowDimensions();
  const camada = useWeb();
  const logado = useLogado();
  const rota = usePathname();
  const reduzir = useReducedMotion();

  // Na frente de verdade: pedida (mostrarWeb) e sem uma tela nativa aberta por cima dela
  const frente = camada.visivel && (rota === '/' || (IOS && POR_CIMA_IOS.test(rota)));

  // Ao sair da frente, ela continua na frente (sem toques) até o fade terminar
  const [antes, setAntes] = useState(frente);
  const [saindo, setSaindo] = useState(false);
  if (antes !== frente) { setAntes(frente); setSaindo(!frente); }

  const op = useSharedValue(0);
  const x = useSharedValue(0); // o arrasto da borda (iPhone)
  const estilo = useAnimatedStyle(() => ({
    opacity: op.get(),
    transform: [{ translateX: x.get() }, { scale: 0.985 + 0.015 * op.get() }],
  }));

  useEffect(() => {
    if (frente) {
      x.set(0);
      op.set(reduzir ? 1 : withTiming(1, { duration: ENTRAR_MS, easing: Easing.out(Easing.cubic) }));
      return;
    }
    const ms = reduzir ? 0 : SAIR_MS;
    if (x.get() > 0) x.set(ms ? withTiming(largura, { duration: ms, easing: Easing.out(Easing.cubic) }) : largura);
    op.set(ms ? withTiming(0, { duration: ms, easing: Easing.out(Easing.quad) }) : 0);
    const t = setTimeout(() => { setSaindo(false); x.set(0); }, ms + 40);
    return () => clearTimeout(t);
  }, [frente, reduzir, largura, op, x]);

  // Primeira abertura (sem retrato guardado) ou sem login: o site começa na frente
  useEffect(() => { if (!lerEstado()?.logado) mostrarWeb('login'); }, []);

  // Os pedidos do app ao site (lib/motor.ts) saem por aqui
  useEffect(() => {
    ligarInjetor((js) => web.current?.injectJavaScript(js));
    return () => ligarInjetor(null);
  }, []);

  // O site vai abrir de novo (versão nova, recarregar, sistema derrubou a WebView): os pedidos em andamento caem
  const reiniciar = useCallback(() => { siteReiniciou(); setChave((k) => k + 1); }, []);

  useEffect(() => { carregarSite().then(setSite).catch(() => {}); }, []);

  // versão nova do Avina: procura ao abrir e ao voltar para o app; entra depois de um tempo fora (ou na próxima abertura)
  useEffect(() => {
    if (!site) return;
    procurarVersaoNova(site.versao).then((n) => { novaPronta.current = n; });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') { saiu.current = Date.now(); return; }
      if (st !== 'active') return;
      const longe = saiu.current && Date.now() - saiu.current > TROCAR_VERSAO_APOS;
      saiu.current = 0;
      if (longe && novaPronta.current) {
        novaPronta.current = false;
        carregarSite().then((s) => { siteReiniciou(); setSite(s); }).catch(() => {});
        return;
      }
      procurarVersaoNova(site.versao).then((n) => { novaPronta.current = n; });
    });
    return () => sub.remove();
  }, [site]);

  // Android: o teclado não empurra a WebView sozinho (tela de ponta a ponta); a gente encolhe ela
  useEffect(() => {
    if (!ANDROID) return;
    const a = Keyboard.addListener('keyboardDidShow', (e) => setTeclado(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardDidHide', () => setTeclado(0));
    return () => { a.remove(); b.remove(); };
  }, []);

  // Android, voltar: com o site na frente, ele fecha a camada de cima dele; sem camada, volta às telas nativas (ou
  // sai do app, sem login). Com o site atrás, quem cuida é o Expo Router (e, na raiz, o app sai).
  useEffect(() => {
    if (!ANDROID || !frente) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      web.current?.injectJavaScript(VOLTAR_JS);
      return true;
    });
    return () => sub.remove();
  }, [frente]);

  // iPhone: arrastar da borda esquerda com o site na frente volta às telas nativas (só com login)
  const gesto = IOS && frente && logado === true;
  const borda = usePanGesture({
    enabled: gesto,
    runOnJS: true,
    activeOffsetX: 12,
    failOffsetY: [-24, 24],
    onUpdate: (e) => { x.set(Math.max(0, e.translationX)); },
    onDeactivate: (e) => {
      const foi = !e.canceled && (e.translationX > largura * 0.3 || (e.velocityX > 700 && e.translationX > 40));
      if (foi) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        esconderWeb();
      } else x.set(withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }));
    },
  });

  const atender = useCallback(async (p: Pedido): Promise<unknown> => {
    const d = p.dados || {};
    switch (p.acao) {
      case 'estado':
        if (d.v !== 1 || typeof d.logado !== 'boolean') throw new Error('estado');
        receberEstado(d as Estado);
        aoMudarLogin(!!d.logado);
        return null;
      case 'nativo:pronto': siteProntoParaPedidos(); return null;
      case 'nativo:voltar': if (lerEstado()?.logado) esconderWeb(); return null; // sem login, a tela de entrar fica
      case 'voltar:raiz': // do voltar do Android (VOLTAR_JS), quando o site não tem camada aberta
        if (lerEstado()?.logado) esconderWeb(); else BackHandler.exitApp();
        return null;
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
        const texto = [d.texto, IOS ? '' : d.url].filter(Boolean).join('\n');
        const r = await Share.share(IOS ? { message: texto || undefined, url: d.url || undefined } : { message: texto, title: d.titulo || undefined });
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
        // telas nativas pedidas pelo site; com o site na frente, elas abrem por cima dele (ver POR_CIMA_IOS)
        if (d.tela === 'postos') router.push({ pathname: '/postos', params: { comb: d.comb || '', consumo: String(d.consumo || '') } });
        else if (d.tela === 'chat') router.push('/chat');
        else if (d.tela === 'bancos') router.push('/bancos');
        else if (d.tela === 'inicio') esconderWeb();
        else throw new Error('tela');
        return null;
      case 'cores': setCores((c) => ({ topo: d.topo || c.topo, fundo: d.fundo || c.fundo })); return null;
      case 'recarregar': reiniciar(); return null;
      case 'sair': BackHandler.exitApp(); return null;
      default: throw new Error('acao-desconhecida');
    }
  }, [reiniciar]);

  const aoMensagem = useCallback((e: WebViewMessageEvent) => {
    let m: (Pedido & { resp?: undefined }) | { resp: number; erro?: string | null; valor?: unknown };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    // resposta a um pedido do app (pedirSite em lib/motor.ts)
    if (typeof m.resp === 'number') { receberResposta(m); return; }
    const p = m as Pedido;
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

  return (
    <>
      {/* com o site na frente, a barra de status segue o topo dele (por cima da do tema nativo, em _layout.tsx);
          com uma folha nativa por cima (iPhone), vale a da folha */}
      {frente && rota === '/' && <StatusBar style={corClara(cores.topo) ? 'dark' : 'light'} />}
      <Animated.View
        accessibilityElementsHidden={!frente}
        importantForAccessibility={frente ? 'auto' : 'no-hide-descendants'}
        style={[
          StyleSheet.absoluteFill,
          { zIndex: frente || saindo ? 2 : 0, pointerEvents: frente ? 'auto' : 'none', backgroundColor: cores.fundo },
          // iPhone: o Avina vai de ponta a ponta (o site já respeita o entalhe e a barra de baixo).
          // Android: a WebView fica entre as barras do sistema, com a cor da tela por trás delas.
          ANDROID && { paddingTop: ins.top, paddingBottom: Math.max(ins.bottom, frente ? teclado : 0) },
          estilo,
        ]}>
        {ANDROID && <View style={[estilos.topoAndroid, { height: ins.top, backgroundColor: cores.topo }]} />}
        {site && (
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
            // o sistema derrubou a WebView para liberar memória: abre de novo (os dados ficam guardados)
            onContentProcessDidTerminate={reiniciar}
            onRenderProcessGone={reiniciar}
            applicationNameForUserAgent={`AvinaApp/${VERSAO_APP}`}
            style={estilos.vista}
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
        )}
        {gesto && (
          <GestureDetector gesture={borda}>
            <View style={estilos.borda} accessible={false} />
          </GestureDetector>
        )}
      </Animated.View>
    </>
  );
}

const estilos = StyleSheet.create({
  vista: { flex: 1, backgroundColor: 'transparent' },
  topoAndroid: { position: 'absolute', top: 0, left: 0, right: 0 },
  borda: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BORDA },
});
