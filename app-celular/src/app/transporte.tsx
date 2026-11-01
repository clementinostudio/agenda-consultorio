// Transporte (tela empurrada). PROVISÓRIA: outro agente constrói a tela nativa de verdade em cima desta base
// (o contrato está em lib/motor.ts: Estado.transporte, Lanc.transp e os pedidos transporte*; os dados de exemplo da
// prévia em lib/exemplo.web.ts e as respostas em lib/exemplo-areas.web.ts). Enquanto isso, abre o Transporte no site.
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abrirNoSiteDaqui, ALTURA_TOPO, MARGEM, Topo } from '@/components/bancos/comum';
import { LuzDeFundo, Vazio } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';

export default function Transporte() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  return (
    <View style={[estilos.tela, { backgroundColor: c.fundo, paddingTop: ins.top + ALTURA_TOPO, paddingBottom: ins.bottom + Espaco.oito }]}>
      <LuzDeFundo />
      <View style={estilos.centro}>
        <Vazio
          icone="carro"
          cor={c.ciano}
          titulo="Transporte"
          texto="Combustível, manutenção, documentos e quanto o carro custa de verdade."
          acao={{ titulo: 'Abrir o Transporte', icone: 'carro', onPress: () => abrirNoSiteDaqui({ area: 'transporte' }) }}
        />
      </View>
      <Topo titulo="Transporte" />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, paddingHorizontal: MARGEM },
  centro: { flex: 1, justifyContent: 'center' },
});
