// As contas e os textos da tela de Transporte, com as mesmas regras do site (../src/transporte.js):
// - As tabelas fixas (tipos de gasto, manutenções, combustíveis) e as contas puras (etanol ou gasolina, carro ou app,
//   montar o gasto) vêm do próprio site; o retrato (Estado.transporte) traz o resto já calculado.
// - De qual veículo é um gasto: o site já resolve (Lanc.transp.veiculoId). Com um veículo só, tudo é dele.
// - Os prazos (dias que faltam, km que faltam) saem de novo com a data de hoje do aparelho e o km mais novo: o retrato
//   guardado de ontem já abre certo.
import { carroOuApp as carroOuAppSite, COMBUSTIVEIS, etanolOuGasolina as etanolOuGasolinaSite, MANUTENCOES, montarGastoTransp, SUBS, umAnoDepois as umAnoDepoisSite } from '@site/transporte.js';

import { dataCurta, dataLonga, diasAte, numero } from '@/lib/formato';
import type { CombAbast, Combustivel, ContaFixa, DocVeiculo, IdManut, Lanc, LembreteVeiculo, MesTransp, PrecosANP, SubTransp, Transporte, Veiculo } from '@/lib/motor';

/* ---------- As tabelas do site ---------- */

export type InfoSub = { id: SubTransp; nome: string; cor: string };
export const TIPOS: InfoSub[] = SUBS as InfoSub[];
export const infoSub = (id: string | null | undefined): InfoSub => TIPOS.find((s) => s.id === id) ?? TIPOS[TIPOS.length - 1];
// nomes mais curtos para chips e legendas
const CURTO: Partial<Record<SubTransp, string>> = { app: 'Apps', publico: 'Ônibus e metrô', estacionamento: 'Estacionamento', documentos: 'Documentos', melhorias: 'Peças' };
export const nomeCurto = (id: SubTransp) => CURTO[id] ?? infoSub(id).nome;

export const MANUT: [IdManut, string][] = MANUTENCOES as [IdManut, string][];
export const nomeManut = (id?: string | null) => MANUT.find((m) => m[0] === id)?.[1] ?? 'Manutenção';
export const nomeCombustivel = (id?: string | null) => (COMBUSTIVEIS as [string, string][]).find((x) => x[0] === id)?.[1] ?? '';
export const COMB_ABAST: [CombAbast, string][] = [['gasolina', 'Gasolina'], ['etanol', 'Etanol'], ['diesel', 'Diesel'], ['gnv', 'GNV']];

export const umAnoDepois = (iso: string) => umAnoDepoisSite(iso) as string;
export const montarGasto = montarGastoTransp as (f: Record<string, unknown>, inicial?: unknown) => Record<string, unknown> & { desc: string; litros?: number; precoLitro?: number; km?: number };

// O veículo anda sozinho (carro e moto): abastece, troca óleo, tem documentos
export const temMotor = (v: Veiculo | null | undefined) => !!v && (v.tipo === 'carro' || v.tipo === 'moto');
// O combustível que vai no abastecimento e no posto mais barato (flex começa na gasolina)
export function combDoVeiculo(v: Veiculo | null | undefined, ultimo?: CombAbast | null): CombAbast {
  const k = v?.combustivel;
  if (k === 'etanol' || k === 'diesel' || k === 'gnv' || k === 'gasolina') return k;
  return ultimo ?? 'gasolina';
}

/* ---------- Etanol ou gasolina e carro ou app (as contas do site) ---------- */

export type Veredito = { razao: number; veredito: 'etanol' | 'gasolina' | 'tanto-faz' };
export const etanolOuGasolina = (p: PrecosANP['p'] | null | undefined) => (p ? (etanolOuGasolinaSite(p) as Veredito | null) : null);

export type CarroOuApp = { carroKm: number; appKm: number; kmMes: number; appMes: number; carroMes: number; diferenca: number; comDesvalor: boolean };
export const carroOuApp = (v: Veiculo) => (v.custo && v.appRef ? (carroOuAppSite(v.custo, v.appRef) as CarroOuApp | null) : null);

/* ---------- Números e textos ---------- */

export const textoKm = (km: number) => `${numero(Math.round(km))} km`;
export const kml = (c: number) => numero(Math.round(c * 10) / 10, Math.round(c * 10) % 10 ? 1 : 0);
export const precoLitro = (p: number) => `R$ ${numero(p, 2)}`;
export const litros = (l: number) => `${numero(Math.round(l * 10) / 10, Math.round(l * 10) % 10 ? 1 : 0)} L`;

// "Onix Hatch LT 1.0" → só quando diz mais que o nome
export function subtituloVeiculo(v: Veiculo) {
  const partes: string[] = [];
  if (temMotor(v) && v.combustivel) partes.push(nomeCombustivel(v.combustivel));
  if (v.fipe?.modelo && v.fipe.modelo.toLowerCase() !== v.nome.toLowerCase()) partes.push(v.fipe.modelo.split(' ').slice(0, 4).join(' '));
  if (v.tipo === 'moto' && !partes.length) partes.push('Moto');
  if (v.tipo === 'bike') partes.push('Bicicleta');
  if (v.tipo === 'nenhum') partes.push('Corridas, ônibus e metrô');
  return partes.join(' · ');
}

// "Venceu há 3 dias", "Vence hoje", "Vence amanhã", "Em 47 dias", "20 de jan."
export function prazoDoc(dias: number, data: string) {
  if (dias < 0) return dias === -1 ? 'Venceu ontem' : `Venceu há ${-dias} dias`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  if (dias <= 60) return `Em ${dias} dias`;
  const meses = Math.round(dias / 30.4);
  return meses <= 18 ? `Em ${meses} meses` : dataCurta(data);
}

/* ---------- Os próximos cuidados ---------- */

export type Cuidado = {
  id: string; // 'oleo' | 'rodizio' | 'doc:ipva'...
  tipo: 'oleo' | 'rodizio' | 'doc';
  titulo: string;
  prazo: string; // a pílula: "em 2.340 km", "Em 47 dias"
  detalhe: string;
  ultima?: string; // "Última: 17 de set., com 41.710 km"
  dias: number; // para ordenar (quanto antes, mais em cima)
  st: 'ok' | 'perto' | 'atrasado';
  progresso: number | null; // quanto do intervalo já passou (0 a 1): óleo e rodízio
  doc?: DocVeiculo;
  pagavel?: boolean; // o "Paguei" (documento que vence nos próximos 60 dias ou já venceu)
};

function lembrete(l: LembreteVeiculo, km: number | null, cadaKm: number, cadaMeses: number, hoje: string) {
  const faltamDias = diasAte(l.ate, hoje);
  const faltamKm = l.proxKm && km ? l.proxKm - km : l.faltamKm;
  // o que já passou do intervalo: pelo km ou pelo tempo, o que estiver mais perto do fim
  const pKm = faltamKm != null ? 1 - faltamKm / cadaKm : 0;
  const pTempo = 1 - faltamDias / (cadaMeses * 30.4);
  const urgente = (faltamKm != null && faltamKm <= 500) || faltamDias <= 15;
  const passou = (faltamKm != null && faltamKm < 0) || faltamDias < 0;
  const porKm = faltamKm != null ? (faltamKm >= 0 ? `Em ${textoKm(faltamKm)}` : `Passou ${textoKm(-faltamKm)}`) : null;
  const porData = faltamDias >= 0 ? `até ${dataCurta(l.ate)}` : `venceu em ${dataCurta(l.ate)}`;
  const ultima = `Última: ${dataCurta(l.ultima.data)}${l.ultima.km ? `, com ${textoKm(l.ultima.km)}` : ''}`;
  return {
    prazo: porKm ?? (faltamDias >= 0 ? `Em ${faltamDias} dias` : `Venceu há ${-faltamDias} dias`),
    detalhe: porKm ? `Ou ${porData}` : faltamDias >= 0 ? `Até ${dataCurta(l.ate)}` : `Venceu em ${dataCurta(l.ate)}`,
    ultima,
    dias: Math.min(faltamDias, faltamKm != null ? Math.round(faltamKm / 40) : Infinity), // ~40 km por dia, só para ordenar
    st: passou ? ('atrasado' as const) : urgente ? ('perto' as const) : ('ok' as const),
    progresso: Math.max(0, Math.min(1, Math.max(pKm, pTempo))),
  };
}

export function cuidadosDo(v: Veiculo, hoje: string): Cuidado[] {
  if (!temMotor(v)) return [];
  const lista: Cuidado[] = [];
  if (v.oleo) lista.push({ id: 'oleo', tipo: 'oleo', titulo: 'Troca de óleo', ...lembrete(v.oleo, v.km, v.oleoKm || 10000, v.oleoMeses || 12, hoje) });
  if (v.rodizio) lista.push({ id: 'rodizio', tipo: 'rodizio', titulo: 'Rodízio e alinhamento', ...lembrete(v.rodizio, v.km, 10000, 12, hoje) });
  for (const d of v.docs) {
    const dias = diasAte(d.data, hoje);
    lista.push({
      id: `doc:${d.k}`, tipo: 'doc', titulo: `${d.nome} ${d.data.slice(0, 4)}`, prazo: prazoDoc(dias, d.data),
      detalhe: `${dias < 0 ? 'Venceu' : 'Vence'} em ${dataLonga(d.data)}`,
      dias, st: dias < 0 ? 'atrasado' : dias <= 15 ? 'perto' : 'ok', progresso: null, doc: { ...d, dias }, pagavel: dias <= 60,
    });
  }
  return lista.sort((a, b) => (a.st === 'ok') === (b.st === 'ok') ? a.dias - b.dias : a.st === 'ok' ? 1 : -1);
}

/* ---------- Os gastos de um mês ---------- */

export type ItemGasto = {
  id: string;
  lancId: string | null; // null: conta fixa paga (abre a conta)
  contaId?: string;
  desc: string;
  valor: number;
  data: string;
  sub: SubTransp;
  marca: string | null;
  site?: string | null;
  banco?: string | null;
  litros?: number;
  precoLitro?: number;
  km?: number;
  manut?: IdManut;
};

// Os gastos de transporte do mês (lançamentos e contas fixas pagas), do mais novo ao mais velho
export function gastosDoMes(lanc: Lanc[], contas: ContaFixa[], mes: string, vid: string | null): ItemGasto[] {
  const doVeiculo = (x: { veiculoId: string | null } | undefined) => !vid || !x || x.veiculoId === vid;
  const itens: ItemGasto[] = lanc
    .filter((l) => l.data.startsWith(mes) && doVeiculo(l.transp))
    .map((l) => ({
      id: l.id, lancId: l.id, desc: l.desc, valor: l.valor, data: l.data, sub: l.transp?.sub ?? 'outros', marca: l.marca, site: l.site, banco: l.banco,
      litros: l.transp?.litros, precoLitro: l.transp?.precoLitro, km: l.transp?.km, manut: l.transp?.manut,
    }));
  for (const k of contas) {
    const pago = k.pagas?.[mes];
    if (!pago || !k.transp || !doVeiculo(k.transp)) continue;
    itens.push({ id: `c:${k.id}`, lancId: null, contaId: k.id, desc: k.nome, valor: k.valor, data: pago, sub: k.transp.sub, marca: k.marca, site: k.site });
  }
  return itens.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

// "Combustível · 32,5 L a R$ 6,19 · 48.300 km"
export function subtituloGasto(g: ItemGasto) {
  const partes: string[] = [];
  // o tipo só quando diz algo a mais (no abastecimento, os litros já dizem; "Estacionamento" com o nome inteiro)
  if (g.sub === 'manutencao' && g.manut) partes.push(nomeManut(g.manut));
  else if (g.sub === 'app') partes.push('Corrida de app');
  else if (!(g.sub === 'combustivel' && g.litros)) partes.push(g.desc.trim().toLowerCase() === nomeCurto(g.sub).toLowerCase() ? infoSub(g.sub).nome : nomeCurto(g.sub));
  if (g.litros) partes.push(g.precoLitro ? `${litros(g.litros)} a ${precoLitro(g.precoLitro)}` : litros(g.litros));
  if (g.km) partes.push(textoKm(g.km));
  if (!g.lancId) partes.push('conta fixa');
  return partes.join(' · ');
}

/* ---------- Os meses com o que mudou na tela ---------- */

// Soma (sinal 1) ou tira (sinal −1) um gasto do mês dele
export function mexerNosMeses(meses: MesTransp[], l: Lanc, sinal: 1 | -1): MesTransp[] {
  const t = l.transp;
  if (!t) return meses;
  const ch = l.data.slice(0, 7);
  return meses.map((m) => {
    if (m.chave !== ch) return m;
    const x = m.porSub[t.sub] ?? { total: 0, n: 0 };
    const novo = { total: Math.max(0, Math.round((x.total + sinal * l.valor) * 100) / 100), n: Math.max(0, x.n + sinal) };
    return { ...m, total: Math.max(0, Math.round((m.total + sinal * l.valor) * 100) / 100), porSub: { ...m.porSub, [t.sub]: novo } };
  });
}

// Os 12 meses de um veículo: os dele (com 2 ou mais veículos) ou os de todos
export const mesesDo = (T: Transporte, v: Veiculo | null) => (v && T.veiculos.length >= 2 ? v.meses ?? T.meses : T.meses);

// As partes do mês por tipo, da maior para a menor
export function partesDoMes(m: MesTransp | undefined) {
  if (!m) return [];
  return TIPOS.map((s) => ({ ...s, total: m.porSub[s.id]?.total ?? 0, n: m.porSub[s.id]?.n ?? 0 }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);
}

/* ---------- Os preços da semana ---------- */

export const NOMES_PRECO: [keyof PrecosANP['p'], string][] = [['gasolina', 'Gasolina'], ['etanol', 'Etanol'], ['aditivada', 'Aditivada'], ['diesel', 'Diesel S10'], ['gnv', 'GNV (m³)']];

// Os que interessam ao veículo: gasolina e etanol sempre; diesel e GNV só para quem usa
export function precosDoVeiculo(p: PrecosANP['p'], comb: Combustivel | null | undefined) {
  return NOMES_PRECO.filter(([k]) => p[k] && (k === 'gasolina' || k === 'etanol' || (k === 'diesel' && comb === 'diesel') || (k === 'gnv' && comb === 'gnv')))
    .map(([k, nome]) => ({ k, nome, valor: p[k]! }));
}

// "em Curitiba", "no Paraná", "no Brasil"
export function ondePreco(P: PrecosANP) {
  if (P.onde === 'cidade') return P.nome ? `em ${P.nome}` : 'na sua cidade';
  if (P.onde === 'estado') return P.nome ? `em ${P.nome.charAt(0)}${P.nome.slice(1).toLowerCase()}` : 'no seu estado';
  return 'no Brasil';
}
