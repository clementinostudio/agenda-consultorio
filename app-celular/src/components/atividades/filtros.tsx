// Os filtros das Atividades: período, tipo (saídas ou entradas) e categorias. Ficam numa folha (o chip "Filtros")
// e valem na hora; os chips da lista (Entradas, Saídas e as categorias) mexem no mesmo filtro.
import { ScrollView, StyleSheet, View } from 'react-native';

import { Segmentos } from '@/components/atividades/segmentos';
import { Botao } from '@/components/ui/botao';
import { Chip } from '@/components/ui/chips';
import { IconeCategoria } from '@/components/ui/logo';
import { Texto } from '@/components/ui/texto';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { chaveMes, mesAnterior, somarDias } from '@/lib/formato';
import type { Categoria } from '@/lib/motor';

export type Periodo = 'tudo' | 'mes' | 'passado' | '30' | '90' | 'ano';
export type TipoFiltro = 'todos' | 'saida' | 'entrada';
export type Filtro = { periodo: Periodo; tipo: TipoFiltro; cats: string[] };
export const FILTRO_VAZIO: Filtro = { periodo: 'tudo', tipo: 'todos', cats: [] };

export const PERIODOS: { id: Periodo; nome: string }[] = [
  { id: 'tudo', nome: 'Tudo' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'passado', nome: 'Mês passado' },
  { id: '30', nome: 'Últimos 30 dias' },
  { id: '90', nome: 'Últimos 90 dias' },
  { id: 'ano', nome: 'Este ano' },
];

// A data (AAAA-MM-DD) cai no período?
export function noPeriodo(data: string, periodo: Periodo, hoje: string) {
  switch (periodo) {
    case 'mes': return data.slice(0, 7) === chaveMes(hoje);
    case 'passado': return data.slice(0, 7) === mesAnterior(chaveMes(hoje));
    case '30': return data > somarDias(hoje, -30);
    case '90': return data > somarDias(hoje, -90);
    case 'ano': return data.slice(0, 4) === hoje.slice(0, 4);
    default: return true;
  }
}

// Quantos filtros estão ligados (o número no chip "Filtros")
export const quantosFiltros = (f: Filtro) => (f.periodo !== 'tudo' ? 1 : 0) + (f.tipo !== 'todos' ? 1 : 0) + f.cats.length;

export function FiltrosConteudo({ filtro, onTrocar, categorias, catEntrada, contagem, total, aoFechar }: {
  filtro: Filtro;
  onTrocar: (f: Filtro) => void;
  categorias: Categoria[];
  catEntrada: Categoria[];
  contagem: Record<string, number>; // lançamentos por categoria (no período e tipo de agora)
  total: number; // quantos lançamentos o filtro mostra
  aoFechar: () => void;
}) {
  const c = useCores();
  // as categorias com lançamentos (e as já escolhidas); com "Tudo", separadas em gastos e entradas
  const com = (lista: Categoria[]) => lista.filter((k) => (contagem[k.id] ?? 0) > 0 || filtro.cats.includes(k.id));
  const grupos = [
    filtro.tipo !== 'entrada' ? { titulo: filtro.tipo === 'saida' ? 'Categorias' : 'Categorias de gasto', cats: com(categorias) } : null,
    filtro.tipo !== 'saida' ? { titulo: filtro.tipo === 'entrada' ? 'Categorias' : 'Categorias de entrada', cats: com(catEntrada) } : null,
  ].filter((g): g is { titulo: string; cats: Categoria[] } => !!g && g.cats.length > 0);
  const alternar = (id: string) => onTrocar({ ...filtro, cats: filtro.cats.includes(id) ? filtro.cats.filter((x) => x !== id) : [...filtro.cats, id] });
  // trocar o tipo tira as categorias que não são dele
  const trocarTipo = (tipo: TipoFiltro) => {
    const validas = new Set((tipo === 'saida' ? categorias : tipo === 'entrada' ? catEntrada : [...categorias, ...catEntrada]).map((k) => k.id));
    onTrocar({ ...filtro, tipo, cats: filtro.cats.filter((x) => validas.has(x)) });
  };
  return (
    <>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={estilos.corpo} showsVerticalScrollIndicator={false}>
        <View style={estilos.grupo}>
          <Texto style={[estilos.rotulo, { color: c.apoio }]}>Período</Texto>
          <View style={estilos.lista} accessibilityRole="radiogroup" accessibilityLabel="Período">
            {PERIODOS.map((p) => (
              <Chip key={p.id} titulo={p.nome} ativo={filtro.periodo === p.id} onPress={() => onTrocar({ ...filtro, periodo: p.id })} />
            ))}
          </View>
        </View>
        <View style={estilos.grupo}>
          <Texto style={[estilos.rotulo, { color: c.apoio }]}>Tipo</Texto>
          <Segmentos
            rotulo="Tipo"
            opcoes={[{ id: 'todos', nome: 'Tudo' }, { id: 'saida', nome: 'Saídas' }, { id: 'entrada', nome: 'Entradas' }]}
            valor={filtro.tipo}
            onTrocar={trocarTipo}
            cores={{ entrada: c.positivo }}
            altura={44}
          />
        </View>
        {grupos.map((g) => (
          <View key={g.titulo} style={estilos.grupo}>
            <Texto style={[estilos.rotulo, { color: c.apoio }]}>{g.titulo}</Texto>
            <View style={estilos.lista}>
              {g.cats.map((k) => (
                <Chip
                  key={k.id}
                  titulo={k.nome}
                  papel="checkbox"
                  ativo={filtro.cats.includes(k.id)}
                  contagem={contagem[k.id] ?? 0}
                  esquerda={<IconeCategoria cat={k} tamanho={24} style={{ marginLeft: -8 }} />}
                  onPress={() => alternar(k.id)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={estilos.rodape}>
        <Botao
          titulo={total === 0 ? 'Nenhum lançamento' : total === 1 ? 'Ver 1 lançamento' : `Ver ${total} lançamentos`}
          onPress={aoFechar}
          largo
        />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  corpo: { paddingHorizontal: Espaco.cinco, paddingTop: Espaco.dois, paddingBottom: Espaco.quatro, gap: Espaco.cinco },
  grupo: { gap: Espaco.tres },
  rotulo: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  lista: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.dois },
  rodape: { paddingHorizontal: Espaco.cinco, paddingTop: Espaco.dois },
});
