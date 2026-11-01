// O histórico de pagamentos de uma conta (no detalhe): os últimos 12 meses em barrinhas, cada uma da cor do que
// aconteceu no mês (em dia, com atraso, sem pagamento, ainda em aberto), a legenda, a frase do resumo e os últimos
// meses por escrito ("Outubro · paga em 05/10 · 2 dias de atraso").
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import type { MesConta, SituacaoMes } from '@/components/contas/regras';
import { comAlfa, Icone, Separador, Texto } from '@/components/ui';
import { Fontes, Raio, useCores, type Paleta } from '@/constants/theme';
import { dataCurta, mesNome } from '@/lib/formato';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// o mês de agora em aberto fica azul (no prazo) ou vermelho (já venceu)
function corDoMes(st: SituacaoMes, c: Paleta, atrasadaAgora = false) {
  if (st === 'em-dia') return c.positivo;
  if (st === 'atraso') return c.ambar;
  if (st === 'sem') return c.negativo;
  if (st === 'aberta') return atrasadaAgora ? c.negativo : c.azul;
  return c.cartao3;
}

export function textoDoMes(m: MesConta, atrasadaAgora: boolean) {
  if (m.st === 'em-dia') return `Paga em ${dm(m.pagaEm!)}`;
  if (m.st === 'atraso') return `Paga em ${dm(m.pagaEm!)} · ${m.atraso === 1 ? '1 dia' : `${m.atraso} dias`} de atraso`;
  if (m.st === 'sem') return 'Sem pagamento anotado';
  if (m.st === 'aberta') return atrasadaAgora ? `Venceu em ${dm(m.vence)}` : `Vence em ${dataCurta(m.vence)}`;
  return '';
}

export function HistoricoConta({ meses, atrasadaAgora }: { meses: MesConta[]; atrasadaAgora: boolean }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const conhecidos = meses.filter((m) => m.st !== 'antes' && m.st !== 'aberta');
  const emDia = conhecidos.filter((m) => m.st === 'em-dia').length;
  const resumo = !conhecidos.length
    ? 'O histórico começa no primeiro pagamento anotado.'
    : emDia === conhecidos.length
      ? `Paga em dia ${conhecidos.length === 1 ? 'no último mês' : `nos últimos ${conhecidos.length} meses`}.`
      : `Paga em dia em ${emDia} de ${conhecidos.length} ${conhecidos.length === 1 ? 'mês' : 'meses'}.`;
  const recentes = meses.filter((m) => m.st !== 'antes').slice(-4).reverse();
  const tem = (st: SituacaoMes) => meses.some((m) => m.st === st);
  return (
    <View style={{ gap: 14 }}>
      <View style={estilos.topo}>
        <Texto v="forte" style={{ flex: 1 }}>Últimos 12 meses</Texto>
      </View>
      <View style={estilos.barras} accessible accessibilityRole="image" accessibilityLabel={`${resumo} ${meses.filter((m) => m.st !== 'antes').map((m) => `${mesNome(m.mes)}: ${textoDoMes(m, atrasadaAgora)}`).join('. ')}`}>
        {meses.map((m, i) => {
          const cor = corDoMes(m.st, c, atrasadaAgora);
          const vazado = m.st === 'sem' || m.st === 'aberta';
          return (
            <View key={m.mes} style={estilos.coluna}>
              <Animated.View
                entering={reduzir ? undefined : FadeIn.delay(i * 35).duration(240)}
                style={[
                  estilos.barra,
                  vazado ? { borderWidth: 2, borderColor: cor, backgroundColor: comAlfa(cor, 0.12), borderStyle: m.st === 'aberta' ? 'dashed' : 'solid' } : { backgroundColor: cor },
                  m.st === 'antes' && { opacity: c.escuro ? 0.6 : 0.8, height: 10, marginTop: 24 },
                ]}>
                {m.st === 'em-dia' ? <Icone nome="check" tamanho={10} cor={c.escuro ? '#06150F' : '#FFFFFF'} peso="bold" /> : null}
              </Animated.View>
              <Text allowFontScaling={false} style={[estilos.mes, { color: i === meses.length - 1 ? c.texto : c.fraco }, i === meses.length - 1 && { fontFamily: Fontes.textoPesado }]}>
                {mesNome(m.mes, true).charAt(0).toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={estilos.legenda}>
        <Legenda cor={c.positivo} texto="Em dia" />
        {tem('atraso') ? <Legenda cor={c.ambar} texto="Com atraso" /> : null}
        {tem('sem') ? <Legenda cor={c.negativo} texto="Sem pagamento" vazado /> : null}
      </View>
      <Texto v="apoio" style={{ fontSize: 14, lineHeight: 20 }}>{resumo}</Texto>
      <View>
        {recentes.map((m, i) => (
          <View key={m.mes}>
            {i ? <Separador /> : null}
            <View style={estilos.linha} accessible accessibilityLabel={`${maiuscula(mesNome(m.mes))}: ${textoDoMes(m, atrasadaAgora)}`}>
              <View style={[estilos.bolinha, m.st === 'sem' || m.st === 'aberta' ? { borderWidth: 2, borderColor: corDoMes(m.st, c, atrasadaAgora) } : { backgroundColor: corDoMes(m.st, c) }]} />
              <Texto v="forte" style={{ width: 92, fontSize: 14 }}>{maiuscula(mesNome(m.mes))}</Texto>
              <Texto v="apoio" numberOfLines={1} cor={m.st === 'sem' || (m.st === 'aberta' && atrasadaAgora) ? c.negativo : m.st === 'atraso' ? c.ambar : c.apoio} style={{ flex: 1, textAlign: 'right' }}>{textoDoMes(m, atrasadaAgora)}</Texto>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legenda({ cor, texto, vazado }: { cor: string; texto: string; vazado?: boolean }) {
  const c = useCores();
  return (
    <View style={estilos.legendaItem}>
      <View style={[estilos.bolinha, vazado ? { borderWidth: 2, borderColor: cor } : { backgroundColor: cor }]} />
      <Texto v="apoio" cor={c.apoio} style={{ fontSize: 12.5 }}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center' },
  barras: { flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  coluna: { flex: 1, alignItems: 'center', gap: 6 },
  barra: { width: '100%', maxWidth: 22, height: 34, borderRadius: Raio.pequeno / 2, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  mes: { fontFamily: Fontes.textoForte, fontSize: 11, lineHeight: 14 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
});
