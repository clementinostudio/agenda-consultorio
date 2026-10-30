import '@/lib/ambiente'; // primeiro de tudo: localStorage e o resto que a lógica do site espera

import { Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Trava } from '@/components/trava';
import { Cores, useCores } from '@/constants/theme';

// A abertura (splash) fica até o Avina terminar de carregar (app/index.tsx). Garantia: some em 8 s.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function Raiz() {
  const c = useCores();
  const [fontes, erro] = useFonts({ Sora_600SemiBold, Sora_700Bold, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  useEffect(() => { const t = setTimeout(() => SplashScreen.hideAsync(), 8000); return () => clearTimeout(t); }, []);
  if (!fontes && !erro) return <View style={{ flex: 1, backgroundColor: Cores.dark.fundo }} />;
  const base = c.escuro ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.fundo, card: c.cartao, text: c.texto, border: c.linha, primary: c.menta } }}>
      {/* o topo do Avina é sempre escuro (nos dois temas), então a barra de status fica clara */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.dark.fundo } }}>
        <Stack.Screen name="index" />
        {/* telas nativas que abrem por cima do Avina */}
        <Stack.Screen name="postos" options={{ presentation: 'modal', contentStyle: { backgroundColor: c.fundo } }} />
      </Stack>
      <Trava />
    </ThemeProvider>
  );
}
