// Peças pequenas do Início: a foto da conta, o valor curto que respeita o olho, "vence em 3 dias" e as contas do
// mês (o que sobrou, a série do gráfico, as categorias, as próximas contas).
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Texto } from '@/components/ui';
import { Fontes, useCores } from '@/constants/theme';
import { acumuladoPorDia, brlCurto, chaveMes, diasAte, diasNoMes, dinheiro, hojeIso, mesAnterior, soma, somaPor } from '@/lib/formato';
import { useOculto, type ContaFixa, type Estado, type Lanc } from '@/lib/motor';

/* ---------- Nomes ---------- */

export const primeiroNome = (nome?: string | null) => (nome || '').trim().split(/\s+/)[0] || '';
const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
};
export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ---------- A foto da conta ---------- */

// A foto (data URL que o site manda) ou as iniciais num círculo azul e roxo do Avina
export function Avatar({ nome, foto, tamanho = 44, style }: { nome: string; foto: string | null; tamanho?: number; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const caixa: ViewStyle = { width: tamanho, height: tamanho, borderRadius: tamanho / 2, overflow: 'hidden', borderWidth: 1.5, borderColor: c.linhaForte };
  if (foto) {
    return (
      <View style={[caixa, style]} accessible={false}>
        <Image source={{ uri: foto }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} accessible={false} />
      </View>
    );
  }
  return (
    <View style={[caixa, estilos.meio, style]} accessible={false}>
      <LinearGradient colors={[c.azul, c.roxo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text allowFontScaling={false} style={{ color: '#FFFFFF', fontFamily: Fontes.tituloForte, fontSize: Math.round(tamanho * 0.36), letterSpacing: -0.3 }}>{iniciais(nome)}</Text>
    </View>
  );
}

/* ---------- Valores ---------- */

// "R$ 1,2 mil" (ou "R$ ••••" com o olho fechado), para cartões pequenos e linhas. Sem espaço (iPhone pequeno, letra
// grande), encolhe até 70% em vez de cortar o valor.
export function ValorCurto({ valor, cor, tamanho = 15, fonte = Fontes.tituloForte, sinal, style }: { valor: number; cor?: string; tamanho?: number; fonte?: string; sinal?: boolean; style?: StyleProp<TextStyle> }) {
  const oculto = useOculto();
  const texto = oculto ? 'R$ ••••' : `${sinal && valor > 0 ? '+' : ''}${brlCurto(valor)}`;
  return (
    <Texto
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.3}
      cor={cor}
      accessibilityLabel={oculto ? 'Valor escondido' : dinheiro(valor, { sinal })}
      style={[{ fontFamily: fonte, fontSize: tamanho, lineHeight: Math.round(tamanho * 1.3), fontVariant: ['tabular-nums'], letterSpacing: -tamanho * 0.01 }, style]}>
      {texto}
    </Texto>
  );
}

// O mesmo, como texto (para frases: "R$ 420 de R$ 900")
export function useCurto() {
  const oculto = useOculto();
  return (v: number) => (oculto ? 'R$ ••••' : brlCurto(v));
}

/* ---------- Bancos ---------- */

// "Nubank e Itaú", "Nubank, Itaú e Inter", "4 bancos"
export function listaNomes(nomes: string[]) {
  if (nomes.length > 3) return `${nomes.length} bancos`;
  if (nomes.length < 2) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/* ---------- Datas ---------- */

// "vence hoje", "vence amanhã", "vence em 3 dias", "venceu ontem", "venceu há 4 dias"
export function quandoVence(iso: string, hoje = hojeIso()) {
  const d = diasAte(iso, hoje);
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'vence amanhã';
  if (d > 1) return `vence em ${d} dias`;
  return d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`;
}

/* ---------- As contas do mês ---------- */

export type ResumoMes = {
  hoje: string;
  mes: string; // "2026-11"
  dia: number; // dia de hoje
  dias: number; // dias do mês
  temLanc: boolean;
  doMes: Lanc[];
  entrou: number;
  saiu: number;
  sobrou: number;
  serie: number[]; // gasto acumulado do dia 1 até hoje
  comparacao: number[]; // o mês passado inteiro, acumulado
  ateHoje: number; // gasto até hoje
  mesmoDiaAntes: number; // gasto do mês passado até o mesmo dia
  porCat: { id: string; valor: number }[]; // gastos do mês por categoria, do maior para o menor
  recentes: Lanc[]; // os 3 últimos (até hoje)
  contasAbertas: ContaFixa[]; // contas fixas não pagas, da que vence antes
};

const porData = (a: Lanc, b: Lanc) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0);

export function resumirMes(e: Estado | null, hoje = hojeIso()): ResumoMes {
  const lanc = e?.pessoal?.lanc ?? [];
  const mes = chaveMes(hoje);
  const dia = Number(hoje.slice(8, 10));
  const doMes = lanc.filter((l) => l.data.slice(0, 7) === mes);
  const entrou = soma(doMes.filter((l) => l.tipo === 'entrada'), (l) => l.valor);
  const saiu = soma(doMes.filter((l) => l.tipo !== 'entrada'), (l) => l.valor);
  const serie = acumuladoPorDia(lanc, mes, { ate: dia });
  const comparacao = acumuladoPorDia(lanc, mesAnterior(mes));
  const cat = somaPor(doMes.filter((l) => l.tipo !== 'entrada'), (l) => l.cat, (l) => l.valor);
  const contas = e?.pessoal?.contas ?? [];
  return {
    hoje, mes, dia, dias: diasNoMes(mes), temLanc: lanc.length > 0,
    doMes, entrou, saiu, sobrou: entrou - saiu,
    serie, comparacao,
    ateHoje: serie[serie.length - 1] ?? 0,
    mesmoDiaAntes: comparacao[Math.min(dia, comparacao.length) - 1] ?? 0,
    porCat: Object.entries(cat).map(([id, valor]) => ({ id, valor })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor),
    recentes: lanc.filter((l) => l.data <= hoje).sort(porData).slice(0, 3),
    contasAbertas: contas.filter((x) => !x.paga).sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0)),
  };
}

const estilos = StyleSheet.create({
  meio: { alignItems: 'center', justifyContent: 'center' },
});
