// O topo da tela de Transporte: os chips para trocar de veículo (com mais de um), o veículo grande no palco, o nome,
// e os números dele (km no painel, consumo e custo do combustível por km; nos "apps e ônibus", as corridas do mês).
// Logo abaixo, as ações rápidas (Abastecer, Manutenção, Outro gasto, Posto mais barato) em botões redondos, como os
// atalhos dos apps de banco.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { MARGEM } from '@/components/bancos/comum';
import { abrirGasto, editarVeiculoNoSite, escolherVeiculo } from '@/components/transporte/acoes';
import { MiniVeiculo, PalcoVeiculo } from '@/components/transporte/desenho';
import { IconeTransp, type NomeTransp } from '@/components/transporte/icones';
import { combDoVeiculo, kml, subtituloVeiculo, temMotor, textoKm, type ItemGasto } from '@/components/transporte/regras';
import { Cartao, Chip, comAlfa, Icone, Pilula, Texto, Tocavel } from '@/components/ui';
import { Fontes, useCores } from '@/constants/theme';
import { dinheiro, numero } from '@/lib/formato';
import { useOculto, type Veiculo } from '@/lib/motor';

/* ---------- Trocar de veículo ---------- */

export function ChipsVeiculos({ veiculos, v }: { veiculos: Veiculo[]; v: Veiculo }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginHorizontal: -MARGEM }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: MARGEM }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Qual veículo ver">
      {veiculos.map((x) => (
        <Chip key={x.id} titulo={x.tipo === 'nenhum' && x.nome === 'Apps e transporte público' ? 'Apps e ônibus' : x.nome} ativo={x.id === v.id} esquerda={<MiniVeiculo v={x} ativo={x.id === v.id} />} onPress={() => escolherVeiculo(x.id)} />
      ))}
      <Chip titulo="Adicionar" icone="mais" papel="button" onPress={() => editarVeiculoNoSite('novo')} />
    </ScrollView>
  );
}

/* ---------- O veículo ---------- */

type Numero = { valor: string; unidade?: string; rotulo: string; falar: string };

export function TopoVeiculo({ v, doMes }: { v: Veiculo; doMes: ItemGasto[] }) {
  const c = useCores();
  const oculto = useOculto();
  const { width: W } = useWindowDimensions();
  const largura = Math.min(W - MARGEM * 2, 420);
  const fipe = v.fipe?.valor ? v.fipe.valor.replace(/,00$/, '') : null;
  const sub = subtituloVeiculo(v);

  const numeros: Numero[] = [];
  if (temMotor(v)) {
    numeros.push(v.km
      ? { valor: numero(v.km), unidade: 'km', rotulo: 'no painel', falar: `${textoKm(v.km)} no painel` }
      : { valor: '—', rotulo: 'km no painel', falar: 'Km no painel: ainda sem anotar' });
    numeros.push(v.consumo
      ? { valor: kml(v.consumo), unidade: 'km/l', rotulo: v.consumoReal ? 'consumo real' : 'consumo informado', falar: `Consumo ${v.consumoReal ? 'real' : 'informado'}: ${kml(v.consumo)} quilômetros por litro` }
      : { valor: '—', rotulo: 'consumo', falar: 'Consumo: anote os litros e o km ao abastecer' });
    if (v.custoKm) numeros.push({ valor: oculto ? 'R$ ••' : dinheiro(v.custoKm), rotulo: 'combustível/km', falar: oculto ? 'Custo por km escondido' : `${dinheiro(v.custoKm)} de combustível por quilômetro` });
  } else if (v.tipo === 'nenhum') {
    const corridas = doMes.filter((g) => g.sub === 'app');
    const onibus = doMes.filter((g) => g.sub === 'publico');
    const media = corridas.length ? corridas.reduce((t, g) => t + g.valor, 0) / corridas.length : 0;
    numeros.push({ valor: String(corridas.length), rotulo: corridas.length === 1 ? 'corrida no mês' : 'corridas no mês', falar: `${corridas.length} corridas de app no mês` });
    if (media) numeros.push({ valor: oculto ? 'R$ ••' : dinheiro(media), rotulo: 'por corrida', falar: oculto ? 'Média por corrida escondida' : `${dinheiro(media)} por corrida, em média` });
    numeros.push({ valor: String(onibus.length), rotulo: onibus.length === 1 ? 'ônibus ou metrô' : 'ônibus e metrô', falar: `${onibus.length} passagens de ônibus ou metrô no mês` });
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <PalcoVeiculo v={v} largura={largura} cor={v.tipo === 'nenhum' ? c.roxo : c.ciano} />
      {/* nome comprido ("Apps e transporte público") num tamanho menor, em até duas linhas */}
      <Texto v="titulo" accessibilityRole="header" numberOfLines={2} style={[estilos.nome, v.nome.length > 16 && { fontSize: 23, lineHeight: 29 }]}>{v.nome}</Texto>
      <View style={estilos.linhaSub}>
        {sub ? <Texto v="apoio" numberOfLines={1} style={estilos.sub}>{sub}</Texto> : null}
        {fipe ? <Pilula texto={oculto ? 'FIPE R$ ••••' : `FIPE ${fipe}`} cor={c.azulTinta} /> : null}
      </View>
      {numeros.length ? (
        <Cartao style={estilos.numeros} padding={0}>
          {/* o espaço de dentro num miolo próprio (na prévia web, o padding do Cartao venceria o daqui) */}
          <View style={estilos.numerosDentro}>
          {numeros.map((n, i) => (
            <View key={n.rotulo} accessible accessibilityLabel={n.falar} style={[estilos.numero, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.linhaForte }]}>
              <View style={estilos.valorLinha}>
                <Texto numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3} style={estilos.valor}>{n.valor}</Texto>
                {n.unidade ? <Texto v="apoio" maxFontSizeMultiplier={1.3} style={estilos.unidade}>{n.unidade}</Texto> : null}
              </View>
              <Texto v="apoio" numberOfLines={1} maxFontSizeMultiplier={1.3} style={estilos.rotulo}>{n.rotulo}</Texto>
            </View>
          ))}
          </View>
        </Cartao>
      ) : null}
    </View>
  );
}

/* ---------- As ações rápidas ---------- */

type Acao = { id: string; titulo: string; icone: NomeTransp | 'mais'; cor: string; falar: string; onPress: () => void };

export function AcoesRapidas({ v }: { v: Veiculo | null }) {
  const c = useCores();
  const id = v?.id ?? null;
  let acoes: Acao[];
  if (v?.tipo === 'nenhum') {
    acoes = [
      { id: 'app', titulo: 'Corrida', icone: 'app', cor: '#6366F1', falar: 'Anotar uma corrida de app', onPress: () => abrirGasto(id, 'app') },
      { id: 'publico', titulo: 'Ônibus e metrô', icone: 'publico', cor: '#06B6D4', falar: 'Anotar ônibus ou metrô', onPress: () => abrirGasto(id, 'publico') },
      { id: 'outro', titulo: 'Outro gasto', icone: 'mais', cor: c.azul, falar: 'Anotar outro gasto com transporte', onPress: () => abrirGasto(id, 'outro') },
    ];
  } else if (v && !temMotor(v)) {
    acoes = [
      { id: 'manut', titulo: 'Manutenção', icone: 'manutencao', cor: '#EF4444', falar: 'Anotar uma manutenção', onPress: () => abrirGasto(id, 'manutencao') },
      { id: 'outro', titulo: 'Outro gasto', icone: 'mais', cor: c.azul, falar: 'Anotar outro gasto com transporte', onPress: () => abrirGasto(id, 'outro') },
    ];
  } else {
    const comb = combDoVeiculo(v, v?.ultimoAbast?.combustivel);
    acoes = [
      { id: 'abastecer', titulo: 'Abastecer', icone: 'combustivel', cor: '#F59E0B', falar: 'Anotar um abastecimento', onPress: () => abrirGasto(id, 'combustivel') },
      { id: 'manut', titulo: 'Manutenção', icone: 'manutencao', cor: '#EF4444', falar: 'Anotar uma manutenção', onPress: () => abrirGasto(id, 'manutencao') },
      { id: 'outro', titulo: 'Outro gasto', icone: 'mais', cor: c.azul, falar: 'Anotar outro gasto: estacionamento, pedágio, documentos', onPress: () => abrirGasto(id, 'outro') },
      {
        id: 'posto', titulo: 'Posto mais barato', icone: 'local', cor: c.menta, falar: 'Ver o posto mais barato perto de você',
        onPress: () => router.push({ pathname: '/postos', params: { comb, consumo: String(v?.consumo || '') } }),
      },
    ];
  }
  return (
    <View style={estilos.acoes}>
      {acoes.map((a) => (
        <Tocavel key={a.id} onPress={a.onPress} escala={0.94} accessibilityLabel={a.falar} style={estilos.acao}>
          <View style={[estilos.acaoCirculo, { backgroundColor: comAlfa(a.cor, c.escuro ? 0.17 : 0.12), borderColor: comAlfa(a.cor, c.escuro ? 0.32 : 0.22) }]}>
            {a.icone === 'mais' ? <Icone nome="mais" tamanho={24} cor={c.escuro ? c.azulTinta : a.cor} peso="bold" /> : <IconeTransp nome={a.icone} tamanho={24} cor={a.cor} />}
          </View>
          <Texto numberOfLines={2} maxFontSizeMultiplier={1.25} style={estilos.acaoTexto}>{a.titulo}</Texto>
        </Tocavel>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  nome: { textAlign: 'center', marginTop: 6, paddingHorizontal: 12 },
  linhaSub: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, paddingHorizontal: 8 },
  sub: { textAlign: 'center', fontSize: 14, lineHeight: 19 },
  numeros: { alignSelf: 'stretch', marginTop: 18 },
  numerosDentro: { flexDirection: 'row', paddingVertical: 14 },
  numero: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  valorLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 3, maxWidth: '100%' },
  valor: { flexShrink: 1, fontFamily: Fontes.tituloForte, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  unidade: { fontFamily: Fontes.titulo, fontSize: 13 },
  rotulo: { fontSize: 12.5, lineHeight: 16 },
  acoes: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  acao: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 4 },
  acaoCirculo: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  acaoTexto: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 17, textAlign: 'center' },
});
