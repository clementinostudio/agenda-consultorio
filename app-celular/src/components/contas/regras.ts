// As contas fixas do mês, com as mesmas regras do site (situacaoConta, vencimento e ContasTab em ../src):
// - O vencimento no mês é o dia da conta, ou o último dia do mês quando ele é menor (dia 31 em novembro → 30).
// - A situação sai sempre com a data de hoje do aparelho: aberto no dia 1º com o retrato de outubro guardado, as
//   contas já aparecem como de novembro (sem esperar o site mandar o retrato novo).
// - Os grupos: atrasadas, nos próximos 7 dias, mais para a frente e pagas.
// - O histórico de 12 meses vem dos pagamentos (pagas): paga em dia, paga com atraso ou sem pagamento. A conta não
//   guarda quando foi criada, então o histórico começa no primeiro pagamento que aparece.
import { chaveMes, dataLonga, deIso, diasAte, diasNoMes, mesAnterior, somarDias } from '@/lib/formato';
import type { ContaFixa, SituacaoConta } from '@/lib/motor';

const pad = (n: number) => String(n).padStart(2, '0');

export const vencimentoNoMes = (dia: number, mes: string) => `${mes}-${pad(Math.min(Math.max(1, dia), diasNoMes(mes)))}`;

// A conta no mês de agora (com a mudança feita na tela que o site ainda não confirmou, quando há)
export type ContaMes = ContaFixa & { vence: string; paga: boolean; pagaEm: string | null; st: SituacaoConta; dias: number };

// pendente: undefined = nada mudou na tela; string = paga nessa data; null = desmarcada
export function contaNoMes(c: ContaFixa, hoje: string, mesRetrato: string, pendente?: string | null): ContaMes {
  const mes = chaveMes(hoje);
  const vence = vencimentoNoMes(c.dia, mes);
  let paga: boolean, pagaEm: string | null;
  if (pendente !== undefined) { paga = pendente !== null; pagaEm = pendente; }
  else if (c.pagas) { pagaEm = c.pagas[mes] ?? null; paga = !!pagaEm; }
  // um site de antes dos pagamentos no retrato: o "paga" só vale se o retrato é deste mês
  else { paga = mesRetrato === mes && c.paga; pagaEm = paga ? c.pagaEm ?? null : null; }
  const dias = diasAte(vence, hoje);
  const st: SituacaoConta = paga ? 'paga' : dias < 0 ? 'atrasada' : dias === 0 ? 'hoje' : dias <= 5 ? 'breve' : 'ok';
  return { ...c, vence, paga, pagaEm, st, dias };
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "Venceu ontem", "Venceu há 3 dias", "Vence hoje", "Vence amanhã", "Vence em 5 dias", "Paga em 03/11", "Paga"
export function textoSituacao(c: Pick<ContaMes, 'st' | 'dias' | 'pagaEm'>) {
  if (c.st === 'paga') return c.pagaEm ? `Paga em ${dm(c.pagaEm)}` : 'Paga';
  if (c.dias < 0) return c.dias === -1 ? 'Venceu ontem' : `Venceu há ${-c.dias} dias`;
  if (c.dias === 0) return 'Vence hoje';
  if (c.dias === 1) return 'Vence amanhã';
  return `Vence em ${c.dias} dias`;
}

export type ResumoContas = {
  mes: string;
  todas: ContaMes[]; // pelo dia do vencimento
  atrasadas: ContaMes[];
  semana: ContaMes[]; // vencem nos próximos 7 dias (hoje incluído)
  depois: ContaMes[];
  pagas: ContaMes[];
  total: number; pago: number; falta: number;
  proxima: ContaMes | null; // a que mais pede atenção: a mais atrasada, senão a próxima a vencer
  assinaturas: ContaMes[];
  totalAssinaturas: number;
};

const soma = (l: ContaMes[]) => l.reduce((t, c) => t + c.valor, 0);

export function resumirContas(lista: ContaMes[], hoje: string): ResumoContas {
  const todas = [...lista].sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : a.nome.localeCompare(b.nome, 'pt-BR')));
  const abertas = todas.filter((c) => !c.paga);
  const fim = somarDias(hoje, 7);
  const atrasadas = abertas.filter((c) => c.vence < hoje);
  const semana = abertas.filter((c) => c.vence >= hoje && c.vence <= fim);
  const depois = abertas.filter((c) => c.vence > fim);
  const pagas = todas.filter((c) => c.paga);
  const assinaturas = todas.filter((c) => c.assinatura);
  return {
    mes: chaveMes(hoje), todas, atrasadas, semana, depois, pagas,
    total: soma(todas), pago: soma(pagas), falta: soma(abertas),
    proxima: atrasadas[0] ?? semana[0] ?? depois[0] ?? null,
    assinaturas, totalAssinaturas: soma(assinaturas),
  };
}

/* ---------- Histórico ---------- */

// em-dia / atraso: pagas; sem: o mês passou sem pagamento; aberta: o mês de agora, ainda sem pagar;
// antes: antes do primeiro pagamento conhecido (a conta talvez nem existisse)
export type SituacaoMes = 'em-dia' | 'atraso' | 'sem' | 'aberta' | 'antes';
export type MesConta = { mes: string; vence: string; pagaEm: string | null; st: SituacaoMes; atraso: number };

export function historicoConta(c: ContaMes, hoje: string, n = 12): MesConta[] {
  const agora = chaveMes(hoje);
  const pagas: Record<string, string> = { ...(c.pagas ?? {}) };
  if (c.pagaEm) pagas[agora] = c.pagaEm; else delete pagas[agora];
  const chaves = Object.keys(pagas).sort();
  const primeiro = chaves[0] ?? agora;
  const meses: string[] = [agora];
  while (meses.length < n) meses.unshift(mesAnterior(meses[0]));
  return meses.map((mes) => {
    const vence = vencimentoNoMes(c.dia, mes);
    const pagaEm = pagas[mes] ?? null;
    if (pagaEm) {
      const atraso = Math.max(0, diasAte(pagaEm, vence)); // pagaEm - vence, em dias
      return { mes, vence, pagaEm, st: atraso > 0 ? 'atraso' : 'em-dia', atraso };
    }
    if (mes === agora) return { mes, vence, pagaEm: null, st: 'aberta', atraso: 0 };
    if (mes < primeiro || !c.pagas) return { mes, vence, pagaEm: null, st: 'antes', atraso: 0 };
    return { mes, vence, pagaEm: null, st: 'sem', atraso: 0 };
  });
}

// O mês anterior ficou sem pagamento? (o "Marcar outubro como pago" do detalhe)
export function mesPassadoEmAberto(h: MesConta[]) {
  const ant = h[h.length - 2];
  return ant && ant.st === 'sem' ? ant : null;
}

/* ---------- Textos ---------- */

// "Todo dia 12" (e "último dia" quando o dia não existe em todo mês)
export const todoDia = (dia: number) => (dia >= 29 ? `Todo dia ${dia} (ou o último dia do mês)` : `Todo dia ${dia}`);

// "12 de novembro"
export const diaDoMes = (iso: string) => dataLonga(iso);

// "quinta-feira" (o dia da semana do vencimento, para a próxima conta)
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const diaDaSemana = (iso: string) => SEMANA[deIso(iso).getDay()];

// "US$ 2,99" (a conta cobrada em outra moeda)
const SIMBOLO: Record<string, string> = { USD: 'US$', EUR: '€', GBP: '£', ARS: 'AR$', CLP: 'CLP$', UYU: '$U', CAD: 'C$', AUD: 'A$', JPY: '¥', CHF: 'CHF' };
export const valorNaMoeda = (moeda: string, v: number) => `${SIMBOLO[moeda] ?? moeda} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Só os números da linha digitável (os apps de banco aceitam colar assim)
export const soDigitos = (codigo: string) => codigo.replace(/\D/g, '');
