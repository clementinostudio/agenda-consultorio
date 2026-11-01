import '@/lib/ambiente'; // primeiro de tudo: localStorage e o resto que a lógica do site espera

import { Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Abertura } from '@/components/abertura';
import { CamadaWeb } from '@/components/camada-web';
import { Trava } from '@/components/trava';
import { useCores } from '@/constants/theme';

// A abertura estática (splash do sistema) fica até a abertura animada assumir (components/abertura.tsx).
// Garantia: some em 8 s, aconteça o que acontecer.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

// Folhas que sobem de baixo (lançamento, anotar, widgets, detalhe e edição da conta fixa): alça no topo e os cantos do Avina
// As folhas abrem como o modal padrão do iPhone (cartão que sobe e fecha puxando para baixo), igual ao posto mais
// barato. O formSheet com alturas fracionadas deixava o conteúdo que rola sem altura num iPhone de verdade (a folha
// do lançamento abria preta, só com os botões de baixo); na prévia web isso não aparece.
const FOLHA = { presentation: 'modal' } as const;

export default function Raiz() {
  const c = useCores();
  const [fontes, erro] = useFonts({ Sora_600SemiBold, Sora_700Bold, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  useEffect(() => { const t = setTimeout(() => SplashScreen.hideAsync(), 8000); return () => clearTimeout(t); }, []);
  if (!fontes && !erro) return <View style={{ flex: 1, backgroundColor: c.fundo }} />;
  const base = c.escuro ? DarkTheme : DefaultTheme;
  const folha = { ...FOLHA, contentStyle: { backgroundColor: c.fundoAlto } };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.fundo }}>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.fundo, card: c.cartao, text: c.texto, border: c.linha, primary: c.menta } }}>
        {/* nas telas nativas, a barra de status segue o tema; com o site na frente, a CamadaWeb põe a dela por cima */}
        <StatusBar style={c.escuro ? 'light' : 'dark'} />
        <View style={estilos.palco}>
          {/* o site fica sempre montado: atrás das telas nativas, ou na frente delas (mostrarWeb, sem login) */}
          <CamadaWeb />
          <View style={[estilos.telas, { backgroundColor: c.fundo }]}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fundo } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="chat" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="bancos" />
              <Stack.Screen name="perfil" />
              <Stack.Screen name="categorias" />
              <Stack.Screen name="contas" />
              <Stack.Screen name="transporte" />
              <Stack.Screen name="casa" />
              <Stack.Screen name="casa/gasto" options={folha} />
              <Stack.Screen name="casa/acertar" options={folha} />
              <Stack.Screen name="casa/mercado" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="lancamento/[id]" options={folha} />
              <Stack.Screen name="conta/[id]" options={folha} />
              <Stack.Screen name="conta/editar" options={folha} />
              <Stack.Screen name="veiculo/gasto" options={folha} />
              <Stack.Screen name="veiculo/documento" options={folha} />
              <Stack.Screen name="novo" options={folha} />
              <Stack.Screen name="widgets" options={folha} />
              <Stack.Screen name="postos" options={{ presentation: 'modal' }} />
            </Stack>
          </View>
        </View>
        <Abertura />
        <Trava />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  palco: { flex: 1 },
  telas: { flex: 1, zIndex: 1 },
});
