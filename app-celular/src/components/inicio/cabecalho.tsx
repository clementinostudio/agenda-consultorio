// O topo do Início: a foto da conta (abre o Perfil), o olho que esconde os valores e o "+" azul (anotar), embaixo
// a data e a saudação grande ("Boa noite, Felipe") e, com mais de uma área ligada, a troca de área (os mesmos chips
// da barra de cima que aparece ao rolar), para a pessoa achar sem rolar.
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { maiuscula, primeiroNome } from '@/components/inicio/comum';
import type { AreaFoco } from '@/components/inicio/foco';
import { TrocaArea } from '@/components/inicio/troca-area';
import { Avatar, BotaoRedondo, Texto, Tocavel } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';
import { dataLonga, hojeIso, hojeLongo, saudacao } from '@/lib/formato';
import { alternarOculto, useOculto, type Estado, type Modo } from '@/lib/motor';

export function Cabecalho({ e, area, aoTrocarArea }: { e: Estado; area: AreaFoco | null; aoTrocarArea: (a: Modo) => void }) {
  const c = useCores();
  const oculto = useOculto();
  const nome = primeiroNome(e.conta?.nome);
  const ola = saudacao();
  const data = `${maiuscula(hojeLongo().split(',')[0])}, ${dataLonga(hojeIso())}`; // "Domingo, 1 de novembro"
  return (
    <View style={estilos.cabecalho}>
      <View style={[estilos.linha, estilos.lado]}>
        <Tocavel onPress={() => router.push('/perfil')} accessibilityLabel="Perfil e ajustes" escala={0.94} hitSlop={4}>
          <Avatar nome={e.conta?.nome || e.conta?.email || '?'} foto={e.conta?.foto ?? null} tamanho={44} />
        </Tocavel>
        <View style={{ flex: 1 }} />
        <BotaoRedondo
          icone={oculto ? 'olhoFechado' : 'olho'}
          rotulo={oculto ? 'Mostrar os valores' : 'Esconder os valores'}
          tamanho={44}
          onPress={alternarOculto}
        />
        {e.pessoal ? <BotaoRedondo icone="mais" variante="azul" rotulo="Anotar gasto ou entrada" tamanho={44} onPress={() => router.push('/novo')} /> : null}
      </View>
      <View style={{ gap: Espaco.quatro }}>
        <View style={[{ gap: 2 }, estilos.lado]}>
          <Texto v="apoio" style={{ fontSize: 15, lineHeight: 20 }} cor={c.apoio}>{data}</Texto>
          <Texto v="titulo" accessibilityRole="header" numberOfLines={2} style={estilos.ola}>{nome ? `${ola}, ${nome}` : ola}</Texto>
        </View>
        <TrocaArea e={e} area={area} aoTrocar={aoTrocarArea} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: Espaco.seis },
  lado: { paddingHorizontal: Espaco.quatro },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2 },
  ola: { fontSize: 32, lineHeight: 39, letterSpacing: -0.8 },
});
