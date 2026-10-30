import '@/lib/ambiente'; // primeiro de tudo: localStorage e o resto que a lógica do site espera

import { Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { useCores } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  const c = useCores();
  const [fontes, erro] = useFonts({ Sora_600SemiBold, Sora_700Bold, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  const pronto = fontes || !!erro;
  useEffect(() => { if (pronto) SplashScreen.hideAsync(); }, [pronto]);
  if (!pronto) return null;
  const base = c.escuro ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.fundo, card: c.cartao, text: c.texto, border: c.linha, primary: c.menta } }}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />
      <AppTabs />
    </ThemeProvider>
  );
}
