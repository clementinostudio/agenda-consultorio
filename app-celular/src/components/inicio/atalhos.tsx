// Os cartões de atalho do Início: combustível (abre o posto mais barato; não pede a localização sozinho), as
// áreas do Avina e as boas-vindas da conta nova (o primeiro gasto).
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { areasDe, GradeAreas } from '@/components/inicio/areas';
import { Botao, Cartao, CartaoTitulo, comAlfa, Icone, Mascote, Texto, Tocavel } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { useEstado } from '@/lib/motor';

export function CartaoCombustivel() {
  const c = useCores();
  return (
    <Cartao onPress={() => router.push('/postos')} rotulo="Combustível agora. Abre o posto mais barato perto de você">
      <View style={estilos.linha}>
        <View style={[estilos.icone, { backgroundColor: comAlfa(c.ambar, c.escuro ? 0.16 : 0.14) }]}>
          <Icone nome="combustivel" tamanho={22} cor={c.ambar} peso="semibold" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="forte" style={{ fontSize: 16, lineHeight: 21 }}>Combustível agora</Texto>
          <Texto v="apoio" numberOfLines={2}>O posto mais barato perto de você e se o etanol compensa</Texto>
        </View>
        <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" />
      </View>
    </Cartao>
  );
}

export function CartaoAreas() {
  const c = useCores();
  const e = useEstado();
  const areas = areasDe(e);
  if (!areas.length) return null;
  return (
    <Cartao>
      <CartaoTitulo rotulo="Áreas do Avina" />
      <View style={{ marginTop: Espaco.um }}>
        <GradeAreas areas={areas} fundo={c.escuro ? c.cartao2 : c.fundo} />
      </View>
    </Cartao>
  );
}

// Conta nova (sem nenhum lançamento): a Bolinha dá as boas-vindas e chama para o primeiro gasto
export function BoasVindas({ nome }: { nome: string }) {
  const c = useCores();
  return (
    <Cartao variante="destaque" padding={Espaco.seis}>
      <Mascote tamanho={72} estado="feliz" />
      <Texto v="titulo" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, marginTop: Espaco.dois }}>
        {nome ? `Que bom ter você aqui, ${nome}` : 'Que bom ter você aqui'}
      </Texto>
      <Texto v="apoio" style={{ fontSize: 15, lineHeight: 21 }}>
        Anote o primeiro gasto e o Início ganha vida: quanto sobrou no mês, para onde foi o dinheiro e o que vence logo.
      </Texto>
      <Botao titulo="Anotar o primeiro gasto" icone="mais" largo onPress={() => router.push('/novo')} style={{ marginTop: Espaco.tres }} />
      <Tocavel onPress={() => router.push('/chat')} accessibilityLabel="Ou conte para a Bolinha, por exemplo: gastei 30 no Uber" escala={0.97} style={estilos.dica}>
        <Icone nome="faisca" tamanho={15} cor={c.azulTinta} peso="semibold" />
        <Texto v="apoio" style={{ flexShrink: 1 }}>
          Ou conte para a Bolinha: <Texto v="apoio" cor={c.texto} style={{ fontFamily: Fontes.textoForte }}>“gastei 30 no Uber”</Texto>
        </Texto>
      </Tocavel>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres + 2 },
  icone: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dica: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
});
