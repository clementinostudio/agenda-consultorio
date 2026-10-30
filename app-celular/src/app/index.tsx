// Início: os cartões do dia, no estilo de widget. Por enquanto o "Combustível agora";
// agenda, contas e caixa entram aqui com o login (fases 1 a 3 do PLANO.md).
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Platform, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Cartao, Tela, Texto } from '@/components/base';
import { Espaco, useCores } from '@/constants/theme';
import { usePostos } from '@/hooks/use-postos';
import { hojeLongo, preco, saudacao } from '@/lib/formato';
import { etanolOuGasolina } from '@site/transporte.js';

export default function Inicio() {
  return (
    <Tela titulo={saudacao()} sub={hojeLongo()}>
      <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} style={{ paddingHorizontal: Espaco.cinco }}>
        <CombustivelAgora />
      </Animated.View>
    </Tela>
  );
}

// Etanol ou gasolina, pelo posto mais barato de cada um a até 5 km (a regra dos 70%)
function CombustivelAgora() {
  const c = useCores();
  const g = usePostos('gasolina', 5), e = usePostos('etanol', 5);
  const mg = g.lista[0], me = e.lista[0];
  const v = mg && me ? etanolOuGasolina({ gasolina: mg.preco, etanol: me.preco }) : null;
  const cor = v?.veredito === 'etanol' ? c.menta : v?.veredito === 'gasolina' ? c.ambar : c.apoio;
  const onde = mg?.cidade || me?.cidade || g.cidade || 'Perto de você';
  const carregando = (g.st === 'buscando' || e.st === 'buscando') && !mg && !me;
  const semLocal = g.st === 'semLocal' || e.st === 'semLocal';
  // a razão etanol/gasolina numa faixa de 55% a 85%, com o 70% marcado
  const pos = v ? Math.min(1, Math.max(0, (v.razao - 0.55) / 0.3)) : null;

  return (
    <Cartao onPress={() => router.navigate('/postos')} style={{ gap: Espaco.tres }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Platform.OS === 'ios' && <SymbolView name="location.fill" size={13} tintColor={c.texto} />}
        <Texto v="forte" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{onde}</Texto>
        {v && <Texto v="rotulo" cor={cor}>{v.veredito === 'etanol' ? 'Etanol compensa' : v.veredito === 'gasolina' ? 'Gasolina compensa' : 'Tanto faz'}</Texto>}
      </View>
      {carregando && <Texto v="apoio">Procurando os postos perto de você…</Texto>}
      {semLocal && <Texto v="apoio">Libere a localização para ver o posto mais barato perto de você.</Texto>}
      {(mg || me) && (
        <View style={{ flexDirection: 'row', gap: Espaco.quatro }}>
          <Preco nome="Gasolina" valor={mg?.preco} posto={mg?.nome} melhor={v?.veredito === 'gasolina'} />
          <Preco nome="Etanol" valor={me?.preco} posto={me?.nome} melhor={v?.veredito === 'etanol'} />
        </View>
      )}
      {pos != null && v && (
        <View style={{ gap: 6 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.cartao3, overflow: 'visible' }}>
            <View style={{ position: 'absolute', left: 0, width: '50%', height: 6, borderRadius: 3, backgroundColor: c.mentaFundo }} />
            <View style={{ position: 'absolute', left: '50%', top: -3, width: 2, height: 12, backgroundColor: c.apoio, borderRadius: 1 }} />
            <View style={{ position: 'absolute', left: `${pos * 100}%`, top: -4, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: cor, borderWidth: 3, borderColor: c.cartao }} />
          </View>
          <Texto v="apoio" style={{ fontSize: 12 }}>O etanol está a {Math.round(v.razao * 100)}% da gasolina. Abaixo de 70%, ele compensa.</Texto>
        </View>
      )}
    </Cartao>
  );
}

function Preco({ nome, valor, posto, melhor }: { nome: string; valor?: number; posto?: string; melhor?: boolean }) {
  const c = useCores();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Texto v="apoio" cor={melhor ? c.menta : c.apoio} style={{ fontSize: 12 }}>{nome}</Texto>
      <Texto v="numero" style={{ fontSize: 28 }} cor={melhor ? c.menta : c.texto}>{valor ? preco(valor) : '—'}</Texto>
      <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12 }}>{posto || ' '}</Texto>
    </View>
  );
}
