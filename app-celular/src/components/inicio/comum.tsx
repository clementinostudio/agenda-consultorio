// Peças pequenas do Início: o valor curto que respeita o olho, "vence em 3 dias" e as contas do
// mês (o que sobrou, a série do gráfico, as categorias, as próximas contas).
import type { StyleProp, TextStyle } from 'react-native';

import { Texto } from '@/components/ui';
import { Fontes } from '@/constants/theme';
import { acumuladoPorDia, brlCurto, chaveMes, diasAte, diasNoMes, dinheiro, hojeIso, mesAnterior, soma, somaPor } from '@/lib/formato';
import { useOculto, type ContaFixa, type Estado, type Lanc } from '@/lib/motor';

/* ---------- Nomes ---------- */

export const primeiroNome = (nome?: string | null) => (nome || '').trim().split(/\s+/)[0] || '';
export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

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
