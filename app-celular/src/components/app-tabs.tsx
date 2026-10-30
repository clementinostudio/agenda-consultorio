// As abas do app. No iPhone (iOS 26) a barra é de Liquid Glass e encolhe ao rolar; no Android, Material.
// Mais abas entram com as fases do PLANO.md (Dinheiro, Agenda, Perfil). O Android aceita no máximo 5.
import { NativeTabs } from 'expo-router/native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

import { useCores } from '@/constants/theme';

export default function AppTabs() {
  const c = useCores();
  const tinta = Platform.OS === 'ios' ? DynamicColorIOS({ dark: '#46E0A4', light: '#0E9466' }) : c.menta;
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={tinta}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="postos">
        <NativeTabs.Trigger.Label>Postos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'fuelpump', selected: 'fuelpump.fill' }} md="local_gas_station" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
