// Como o Avina escreve dinheiro, distância e datas
export const preco = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const km = (d?: number | null) => (d == null ? '' : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace('.', ',')} km`);
export const dm = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const hojeLongo = (d = new Date()) => `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
export const saudacao = (d = new Date()) => (d.getHours() < 5 ? 'Boa noite' : d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

// lê e grava uma escolha no aparelho (o mesmo localStorage que a lógica do site usa)
export function lerGuardado<T>(chave: string, padrao: T): T {
  try { const v = localStorage.getItem(chave); return v ? { ...padrao, ...JSON.parse(v) } : padrao; } catch { return padrao; }
}
export function guardar(chave: string, v: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(v)); } catch {}
}

/* ---------- Dinheiro ---------- */

const MENOS = '−'; // o sinal de menos tipográfico (o hífen fica curto ao lado dos números)
const milhar = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// 1234.5 → { negativo: false, reais: "1.234", centavos: "50" } (para escrever os centavos menores)
export function separarCentavos(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  const cent = Math.round(Math.abs(n) * 100);
  return { negativo: n < 0 && cent > 0, reais: milhar(Math.floor(cent / 100)), centavos: String(cent % 100).padStart(2, '0') };
}

// "R$ 1.234,56"; com sinal: "+R$ 1.234,56" ou "−R$ 1.234,56" (como os bancos mostram entradas e saídas)
export function dinheiro(v: number, { sinal = false, centavos = true }: { sinal?: boolean; centavos?: boolean } = {}) {
  const s = separarCentavos(centavos ? v : Math.round(v));
  const pre = s.negativo ? MENOS : sinal && v > 0 ? '+' : '';
  return `${pre}R$ ${s.reais}${centavos ? `,${s.centavos}` : ''}`;
}

// Curto, para eixos, balões e cartões pequenos: "R$ 950", "R$ 1,2 mil", "R$ 3,4 mi"
export function brlCurto(v: number) {
  const a = Math.abs(v), pre = v < 0 ? MENOS : '';
  const umaCasa = (x: number) => x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  if (a < 1000) return `${pre}R$ ${a % 1 && a < 100 ? a.toFixed(2).replace('.', ',') : Math.round(a)}`;
  if (a < 1e6) return `${pre}R$ ${umaCasa(a / 1e3)} mil`;
  return `${pre}R$ ${umaCasa(a / 1e6)} mi`;
}

export const numero = (v: number, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const porcento = (v: number, casas = 0) => `${numero(v * 100, casas)}%`; // 0.123 → "12%"

/* ---------- Datas ---------- */

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const pad = (n: number) => String(n).padStart(2, '0');

export const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const deIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1); };
export const hojeIso = () => isoDe(new Date());
export const somarDias = (iso: string, n: number) => { const d = deIso(iso); d.setDate(d.getDate() + n); return isoDe(d); };
export const chaveMes = (d: Date | string = new Date()) => (typeof d === 'string' ? d.slice(0, 7) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`); // "2026-11"
export const mesAnterior = (chave: string) => { const [a, m] = chave.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`; };

// mesNome(10) → "novembro"; mesNome("2026-11") → "novembro"; curto → "nov"
export function mesNome(m: number | string, curto = false) {
  const i = typeof m === 'number' ? m : Number(String(m).slice(5, 7)) - 1;
  return (curto ? MESES : MESES_LONGOS)[((i % 12) + 12) % 12];
}
// diasNoMes("2026-02") → 28; diasNoMes(2026, 1) → 28 (mês de 0 a 11)
export function diasNoMes(a: number | string, m?: number) {
  if (typeof a === 'string') { const [ano, mes] = a.split('-').map(Number); return new Date(ano, mes, 0).getDate(); }
  return new Date(a, (m ?? 0) + 1, 0).getDate();
}

// "17 de out." (com o ano quando não é o deste ano: "17 de out. de 2025")
export function dataCurta(iso: string) {
  const d = deIso(iso);
  const ano = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${d.getDate()} de ${MESES[d.getMonth()]}.${ano}`;
}
// "17 de outubro"
export const dataLonga = (iso: string) => { const d = deIso(iso); return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}`; };

// Dias de hoje até a data (negativo: já passou)
export const diasAte = (iso: string, hoje = hojeIso()) => Math.round((deIso(iso).getTime() - deIso(hoje).getTime()) / 864e5);

// "agora", "há 12 min", "há 2 h", "ontem", "há 3 dias" (quando o banco mandou os dados)
export function haQuanto(iso?: string | null) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 6e4));
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

// Para os títulos dos grupos de dias: "Hoje", "Ontem", "Quinta-feira" (nesta semana), "17 de out."
export function dataRelativa(iso: string, hoje = hojeIso()) {
  if (iso === hoje) return 'Hoje';
  if (iso === somarDias(hoje, -1)) return 'Ontem';
  if (iso === somarDias(hoje, 1)) return 'Amanhã';
  if (iso < hoje && iso > somarDias(hoje, -7)) return DIAS_LONGOS[deIso(iso).getDay()];
  return dataCurta(iso);
}

/* ---------- Contas ---------- */

// Soma por chave: somaPor(lanc, (l) => l.cat, (l) => l.valor) → { mercado: 320, casa: 1200 }
export function somaPor<T>(lista: readonly T[], chave: (x: T) => string, valor: (x: T) => number): Record<string, number> {
  const r: Record<string, number> = {};
  for (const x of lista) { const k = chave(x); r[k] = (r[k] || 0) + (Number(valor(x)) || 0); }
  return r;
}
export const soma = <T,>(lista: readonly T[], valor: (x: T) => number) => lista.reduce((t, x) => t + (Number(valor(x)) || 0), 0);

// Agrupa por dia, do mais novo para o mais velho (para a lista de atividades): [{ data, itens, entrou, saiu }]
export function agruparPorDia<T extends { data: string; tipo?: string; valor: number }>(lista: readonly T[]) {
  const m = new Map<string, T[]>();
  for (const x of lista) { const g = m.get(x.data); if (g) g.push(x); else m.set(x.data, [x]); }
  return [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([data, itens]) => ({
      data, itens,
      entrou: soma(itens.filter((x) => x.tipo === 'entrada'), (x) => x.valor),
      saiu: soma(itens.filter((x) => x.tipo !== 'entrada'), (x) => x.valor),
    }));
}

// Gasto acumulado dia a dia num mês (para o GraficoArea): [dia 1, dia 1+2, ...] até "ate" (dia do mês) ou o fim do mês
export function acumuladoPorDia<T extends { data: string; tipo?: string; valor: number }>(lista: readonly T[], chave: string, { tipo = 'saida', ate }: { tipo?: string; ate?: number } = {}) {
  const n = ate ?? diasNoMes(chave);
  const dia = new Array<number>(n).fill(0);
  for (const x of lista) {
    if (x.data.slice(0, 7) !== chave || (tipo && (x.tipo ?? 'saida') !== tipo)) continue;
    const i = Number(x.data.slice(8, 10)) - 1;
    if (i >= 0 && i < n) dia[i] += Number(x.valor) || 0;
  }
  for (let i = 1; i < n; i++) dia[i] += dia[i - 1];
  return dia;
}
