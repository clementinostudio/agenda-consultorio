// Nossa casa (tela empurrada). PROVISÓRIA: outro agente constrói a tela nativa de verdade em cima desta base
// (o contrato está em lib/motor.ts: Estado.casa e os pedidos casa*; os dados de exemplo da prévia em
// lib/exemplo.web.ts, com ?casa=sem|erro|carregando, e as respostas em lib/exemplo-areas.web.ts). Enquanto isso, abre a
// Nossa casa no site.
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, MARGEM, Topo } from '@/components/bancos/comum';
import { LuzDeFundo, Vazio } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';

export default function Casa() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo, paddingTop: ins.top + ALTURA_TOPO, paddingBottom: ins.bottom + Espaco.oito }]}>
      <LuzDeFundo />
      <View style={estilos.centro}>
        <Vazio
          icone="casa"
          cor={c.roxo}
          titulo="Nossa casa"
          texto="Dinheiro a dois ou em família: quem pagou o quê, quem deve quanto e a lista de compras."
          acao={{ titulo: 'Abrir a Nossa casa', icone: 'casa', onPress: () => abrirNoSiteDaqui({ area: 'casa' }) }}
        />
      </View>
      <Topo titulo="Nossa casa" />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, paddingHorizontal: MARGEM },
  centro: { flex: 1, justifyContent: 'center' },
});
