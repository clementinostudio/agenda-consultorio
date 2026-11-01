// O topo do Início: a foto da conta (abre o Perfil), o olho que esconde os valores e o "+" azul (anotar), e embaixo
// a data e a saudação grande ("Boa noite, Felipe").
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, maiuscula, primeiroNome } from '@/components/inicio/comum';
import { BotaoRedondo, Texto, Tocavel } from '@/components/ui';
import { Espaco, useCores } from '@/constants/theme';
import { dataLonga, hojeIso, hojeLongo, saudacao } from '@/lib/formato';
import { alternarOculto, useOculto, type Estado } from '@/lib/motor';

export function Cabecalho({ e }: { e: Estado }) {
  const c = useCores();
  const oculto = useOculto();
  const nome = primeiroNome(e.conta?.nome);
  const ola = saudacao();
  const data = `${maiuscula(hojeLongo().split(',')[0])}, ${dataLonga(hojeIso())}`; // "Domingo, 1 de novembro"
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.linha}>
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
      <View style={{ gap: 2 }}>
        <Texto v="apoio" style={{ fontSize: 15, lineHeight: 20 }} cor={c.apoio}>{data}</Texto>
        <Texto v="titulo" accessibilityRole="header" numberOfLines={2} style={estilos.ola}>{nome ? `${ola}, ${nome}` : ola}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { paddingHorizontal: Espaco.quatro, gap: Espaco.seis },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2 },
  ola: { fontSize: 32, lineHeight: 39, letterSpacing: -0.8 },
});
