// Os gastos de transporte do mês escolhido (lançamentos e contas fixas pagas), agrupados por dia, com chips para ver
// um tipo só; e o rodapé com o que fica no site (editar o veículo, adicionar outro).
// Tocar num gasto abre o detalhe do lançamento (ou a conta fixa); o gasto anotado agora já aparece (acoes.ts).
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { CartaoLista, MARGEM } from '@/components/bancos/comum';
import { editarVeiculoNoSite } from '@/components/transporte/acoes';
import { CirculoTipo } from '@/components/transporte/icones';
import { infoSub, nomeCurto, subtituloGasto, type ItemGasto } from '@/components/transporte/regras';
import { Botao, Chip, Dinheiro, Linha, Logo, Separador, Texto, Tocavel, useDizerValor } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { dataRelativa, mesNome } from '@/lib/formato';
import type { SubTransp, Veiculo } from '@/lib/motor';

const POR_VEZ = 8;

export function ListaGastos({ itens, mes, hoje }: { itens: ItemGasto[]; mes: string; hoje: string }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const [filtro, setFiltro] = useState<SubTransp | null>(null);
  const [todos, setTodos] = useState(false);
  const tipos = [...new Set(itens.map((g) => g.sub))];
  const ativo = filtro && tipos.includes(filtro) ? filtro : null;
  const lista = ativo ? itens.filter((g) => g.sub === ativo) : itens;
  const visiveis = todos ? lista : lista.slice(0, POR_VEZ);
  const agora = mes === hoje.slice(0, 7);
  const titulo = agora ? 'Gastos do mês' : `Gastos de ${mesNome(mes)}${mes.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${mes.slice(0, 4)}` : ''}`;
  return (
    <View style={{ gap: Espaco.dois }}>
      <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secao}>{titulo}</Texto>
      {tipos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -MARGEM }} contentContainerStyle={{ gap: 8, paddingHorizontal: MARGEM }} accessibilityRole="radiogroup" accessibilityLabel="Que tipo de gasto ver">
          <Chip titulo="Todos" ativo={!ativo} contagem={itens.length} onPress={() => { setFiltro(null); setTodos(false); }} />
          {tipos.map((t) => (
            <Chip key={t} titulo={nomeCurto(t)} ativo={ativo === t} contagem={itens.filter((g) => g.sub === t).length} onPress={() => { setFiltro(ativo === t ? null : t); setTodos(false); }} />
          ))}
        </ScrollView>
      ) : null}
      <CartaoLista>
        {!lista.length ? (
          <View style={estilos.vazio}>
            <Texto v="apoio" style={{ textAlign: 'center' }}>{agora ? 'Nenhum gasto com transporte neste mês ainda.' : `Nenhum gasto com transporte em ${mesNome(mes)}.`}</Texto>
          </View>
        ) : null}
        {visiveis.map((g, i) => {
          const novoDia = i === 0 || visiveis[i - 1].data !== g.data;
          return (
            <Animated.View key={g.id} entering={reduzir ? undefined : FadeIn.duration(220)} layout={reduzir ? undefined : LinearTransition.duration(220)}>
              {novoDia ? <Texto v="apoio" style={[estilos.dia, i > 0 && { marginTop: 6 }]}>{dataRelativa(g.data, hoje)}</Texto> : <Separador recuo={56} />}
              <LinhaGasto g={g} />
            </Animated.View>
          );
        })}
        {lista.length > POR_VEZ ? (
          <Botao
            titulo={todos ? 'Mostrar menos' : `Ver todos os ${lista.length}`}
            variante="texto"
            tamanho="pequeno"
            icone={todos ? 'setaCima' : 'chevronBaixo'}
            onPress={() => setTodos(!todos)}
            style={{ alignSelf: 'center', marginVertical: Espaco.um }}
          />
        ) : null}
      </CartaoLista>
    </View>
  );
}

function LinhaGasto({ g }: { g: ItemGasto }) {
  const c = useCores();
  const dizer = useDizerValor();
  const sub = subtituloGasto(g);
  const temLogo = !!(g.marca || g.site);
  const abrir = () => {
    if (g.lancId) router.push({ pathname: '/lancamento/[id]', params: { id: g.lancId } });
    else if (g.contaId) router.push({ pathname: '/conta/[id]', params: { id: g.contaId } });
  };
  return (
    <Tocavel onPress={abrir} escala={0.985} accessibilityLabel={`${g.desc || infoSub(g.sub).nome}, ${dizer(g.valor)}, ${sub}, ${dataRelativa(g.data)}`} accessibilityHint="Abre o detalhe" style={estilos.linha}>
      {temLogo ? <Logo marca={g.marca} site={g.site} nome={g.desc} banco={g.banco} tamanho={42} anel={c.cartao} /> : <CirculoTipo sub={g.sub} tamanho={42} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Texto v="forte" numberOfLines={1} style={{ fontSize: 15.5 }}>{g.desc || infoSub(g.sub).nome}</Texto>
        <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17 }}>{sub}</Texto>
      </View>
      <Dinheiro valor={g.valor} tamanho={15.5} animar={false} />
    </Tocavel>
  );
}

// O que fica no site: o veículo (modelo, FIPE, foto, documentos, troca de óleo) e um veículo novo
export function RodapeVeiculo({ v }: { v: Veiculo }) {
  return (
    <CartaoLista>
      <Linha
        icone="editar"
        titulo={v.tipo === 'nenhum' ? 'Editar' : `Editar ${v.tipo === 'carro' ? 'o carro' : v.tipo === 'moto' ? 'a moto' : 'o veículo'}`}
        sub={v.tipo === 'nenhum' ? 'Nome e tipo' : 'Modelo, FIPE, foto e vencimentos'}
        chevron
        onPress={() => editarVeiculoNoSite(v.id)}
        rotulo={`Editar ${v.nome} no Avina completo: modelo, FIPE, foto, IPVA, seguro e troca de óleo`}
      />
      <Separador recuo={52} />
      <Linha icone="mais" titulo="Adicionar outro veículo" sub="Carro, moto, bike ou apps e ônibus" chevron onPress={() => editarVeiculoNoSite('novo')} rotulo="Adicionar outro veículo, no Avina completo" />
    </CartaoLista>
  );
}

const estilos = StyleSheet.create({
  secao: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20, paddingHorizontal: Espaco.um },
  dia: { fontFamily: Fontes.textoForte, fontSize: 12.5, lineHeight: 16, paddingTop: 12, paddingBottom: 0 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  vazio: { paddingVertical: 22, alignItems: 'center' },
});
