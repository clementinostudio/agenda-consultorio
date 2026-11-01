// Peças de tela antigas (postos.tsx, trava.tsx e as telas que ainda importam daqui). Texto, Cartao, Chips, vibrar
// e temVidro agora vêm de components/ui (o visual novo); aqui ficam o botão de vidro com cor e a tela que rola.
// Telas novas: importe de '@/components/ui'.
import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tocavel, vibrar } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { temVidro } from '@/components/ui/vidro';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

export { Cartao } from '@/components/ui/cartao';
export { Chips } from '@/components/ui/chips';
export { Texto, temVidro, vibrar };

// Botão principal: vidro com a cor da área no iOS 26, sólido no resto
export function BotaoVidro({ children, onPress, cor, rotulo }: { children: ReactNode; onPress: () => void; cor?: string; rotulo: string }) {
  const c = useCores();
  const tinta = cor ?? c.menta; // o texto de dentro usa c.tintaBotao, que combina com a menta
  const dentro = <View style={estilos.botaoDentro}>{children}</View>;
  return (
    <Tocavel accessibilityLabel={rotulo} onPress={onPress} escala={temVidro ? 1 : 0.96}>
      {temVidro
        ? <GlassView isInteractive tintColor={tinta} glassEffectStyle="regular" colorScheme={c.escuro ? 'dark' : 'light'} style={estilos.botao}>{dentro}</GlassView>
        : <View style={[estilos.botao, { backgroundColor: tinta }]}>{dentro}</View>}
    </Tocavel>
  );
}

// A tela que rola, com o título grande no topo e espaço para a barra de abas embaixo
// folha: a tela abre por cima do Avina (no iPhone, a folha já começa abaixo da barra de status)
export function Tela({ titulo, sub, children, atualizando, aoAtualizar, direita, folha }: { titulo: string; sub?: string; children: ReactNode; atualizando?: boolean; aoAtualizar?: () => void; direita?: ReactNode; folha?: boolean }) {
  const c = useCores();
  const ins = useSafeAreaInsets().top;
  const topo = folha && Platform.OS === 'ios' ? 0 : ins;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fundo }}
      contentContainerStyle={{ paddingTop: topo + Espaco.quatro, paddingBottom: 120, gap: Espaco.quatro }}
      refreshControl={aoAtualizar ? <RefreshControl refreshing={!!atualizando} onRefresh={aoAtualizar} tintColor={c.apoio} /> : undefined}>
      <View style={{ paddingHorizontal: Espaco.cinco, flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.tres }}>
        <View style={{ flex: 1 }}>
          {sub ? <Texto v="apoio" style={{ fontFamily: Fontes.textoForte }}>{sub}</Texto> : null}
          <Texto v="titulo" accessibilityRole="header">{titulo}</Texto>
        </View>
        {direita}
      </View>
      {children}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  botao: { borderRadius: Raio.pilula, overflow: 'hidden' },
  botaoDentro: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, height: 44 },
});
