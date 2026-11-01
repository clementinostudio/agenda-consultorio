// O que a tela de Transporte pede ao site e useTransporte(): o retrato do Transporte já com o que a pessoa acabou de
// fazer e o site ainda não confirmou (lib/pendentes.ts).
// - Anotar (abastecer, manutenção, outro gasto): a folha espera a resposta (o limite do plano grátis aparece nela);
//   deu certo, o gasto entra na hora nos totais e na lista, com o recado "Desfazer" (que apaga o lançamento).
// - "Paguei" de um documento: confirma o valor numa folha; o próximo vencimento já aparece. Sem Desfazer: o site não
//   tem como voltar a data do documento.
// - O id de cada pedido nasce no app: repetir depois de "tempo esgotado" não anota duas vezes.
import { router } from 'expo-router';
import { useMemo, useSyncExternalStore } from 'react';

import { abrirNoSiteEVoltar, avisar, motivoFalha } from '@/components/bancos/comum';
import { mexerNosMeses, montarGasto, umAnoDepois } from '@/components/transporte/regras';
import { mostrarRecado, vibrar } from '@/components/ui';
import { diasAte, dinheiro, guardar, hojeIso, lerGuardado } from '@/lib/formato';
import { lerOculto, pedirSite, useEstado, type ContaFixa, type DocVeiculo, type Lanc, type MesTransp, type PedidosSite, type PrecosANP, type Transporte, type Veiculo } from '@/lib/motor';
import { criarPendentes } from '@/lib/pendentes';
import { acharMarca } from '@site/marcas.js';

/* ---------- O que mudou na tela e o site ainda não confirmou ---------- */

const gastos = criarPendentes<Lanc | null>(); // id → o gasto anotado agora (null: desfeito)
const docs = criarPendentes<string>(); // 'veiculoId|k' → a próxima data, depois do "Paguei"

export const novoId = (p = 't') => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export type DadosTransporte = {
  st: 'ok';
  hoje: string;
  T: Transporte;
  veiculos: Veiculo[]; // com o km, o último abastecimento e os documentos de agora
  lanc: Lanc[]; // os gastos de transporte (saídas), do mais novo ao mais velho
  contas: ContaFixa[]; // as contas fixas de transporte (os pagamentos entram nos meses)
  meses: MesTransp[]; // os 12 meses de todos os veículos
};
export type EstadoTransporte = DadosTransporte | { st: 'carregando' } | { st: 'desligado' };

export function useTransporte(): EstadoTransporte {
  const e = useEstado();
  const vivosG = gastos.usePendentes();
  const vivosD = docs.usePendentes();
  const hoje = hojeIso();
  const P = e?.pessoal, T = e?.transporte;
  return useMemo<EstadoTransporte>(() => {
    if (!e) return { st: 'carregando' };
    if (!P || T === null) return { st: 'desligado' };
    // o retrato pode chegar sem o Transporte enquanto a parte do site para o app ainda carrega
    if (!T) return { st: 'carregando' };

    const porId = new Map<string, Lanc>();
    for (const l of P.lanc) if (l.cat === 'transporte' && l.tipo === 'saida') porId.set(l.id, l);
    let meses = T.meses;
    const porVeiculo = new Map<string, MesTransp[]>();
    const mexer = (l: Lanc, s: 1 | -1) => {
      meses = mexerNosMeses(meses, l, s);
      const v = T.veiculos.find((x) => x.id === l.transp?.veiculoId);
      if (v?.meses) porVeiculo.set(v.id, mexerNosMeses(porVeiculo.get(v.id) ?? v.meses, l, s));
    };
    vivosG.forEach((l, id) => {
      const ja = porId.get(id);
      if (l && !ja) { porId.set(id, l); mexer(l, 1); }
      else if (!l && ja) { porId.delete(id); mexer(ja, -1); }
    });
    const lanc = [...porId.values()].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

    const veiculos = T.veiculos.map((v) => {
      const meus = lanc.filter((l) => l.transp?.veiculoId === v.id || (T.veiculos.length < 2 && l.transp));
      // o km mais novo que se conhece (um abastecimento anotado agora mexe nele)
      const km = Math.max(v.km ?? 0, ...meus.map((l) => l.transp?.km ?? 0)) || null;
      const abast = meus.find((l) => l.transp?.sub === 'combustivel' && l.transp.litros);
      const ultimoAbast = abast && (!v.ultimoAbast || abast.data >= v.ultimoAbast.data) && vivosG.has(abast.id)
        ? { data: abast.data, litros: abast.transp!.litros!, precoLitro: abast.transp!.precoLitro ?? null, combustivel: abast.transp!.combustivel ?? null, km: abast.transp!.km ?? null, desc: abast.desc }
        : v.ultimoAbast;
      const docsAgora: DocVeiculo[] = v.docs.map((d) => {
        const data = vivosD.get(`${v.id}|${d.k}`) ?? d.data;
        return { ...d, data, dias: diasAte(data, hoje) };
      }).sort((a, b) => (a.data < b.data ? -1 : 1));
      return { ...v, km, ultimoAbast, docs: docsAgora, ...(v.meses ? { meses: porVeiculo.get(v.id) ?? v.meses } : {}) };
    });
    return { st: 'ok', hoje, T: { ...T, veiculos, meses }, veiculos, lanc, contas: P.contas.filter((k) => !!k.transp), meses };
  }, [e, P, T, vivosG, vivosD, hoje]);
}

/* ---------- O veículo escolhido (fica guardado no aparelho) ---------- */

const K_VEICULO = 'avina-nativo-transp-veiculo';
let escolhido: string | null | undefined; // undefined: ainda não leu do aparelho (lê no primeiro uso, não ao carregar)
const lerEscolhido = () => { if (escolhido === undefined) escolhido = lerGuardado<{ id: string | null }>(K_VEICULO, { id: null }).id; return escolhido; };
const ouvintes = new Set<() => void>();
export function escolherVeiculo(id: string) {
  if (id === lerEscolhido()) return;
  escolhido = id;
  guardar(K_VEICULO, { id });
  ouvintes.forEach((f) => f());
}
// O escolhido, se ainda existe; senão o primeiro com motor (como a tela do site)
export function useVeiculoEscolhido(veiculos: Veiculo[]): Veiculo | null {
  const id = useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, lerEscolhido);
  return veiculos.find((v) => v.id === id) ?? veiculos.find((v) => v.tipo !== 'nenhum') ?? veiculos[0] ?? null;
}

/* ---------- Anotar um gasto ---------- */

export type DadosGasto = PedidosSite['transporteGasto']['dados'] & { id: string };

const TITULO: Record<string, string> = { combustivel: 'Abastecimento anotado', manutencao: 'Manutenção anotada', app: 'Corrida anotada', publico: 'Passagem anotada' };

// Devolve ok, ou o texto para mostrar na folha (o limite do plano vem neutro do site)
export async function anotarGasto(d: DadosGasto, veiculos: Veiculo[]): Promise<{ ok: true } | { ok: false; texto: string }> {
  try {
    const r = await pedirSite('transporteGasto', d);
    if (!r.ok) { vibrar('aviso'); return { ok: false, texto: r.texto || 'Não deu para anotar agora.' }; }
    // o gasto entra na hora (o retrato com ele chega logo depois), montado como o site monta
    const vid = d.veiculoId ?? (veiculos.find((v) => v.tipo !== 'nenhum') ?? veiculos[0])?.id ?? null;
    const m = montarGasto({ ...d, id: r.id, veiculoId: vid, data: d.data ?? hojeIso(), desc: d.desc ?? '', litros: d.litros ?? 0, precoLitro: d.precoLitro ?? 0, km: d.km ?? 0 });
    const marca = (acharMarca(m.desc) as { id: string } | null)?.id ?? null;
    const l: Lanc = {
      id: r.id, tipo: 'saida', valor: d.valor, data: d.data ?? hojeIso(), cat: 'transporte', desc: m.desc, marca, site: null, banco: null,
      transp: {
        sub: d.sub, veiculoId: vid,
        ...(m.litros ? { litros: m.litros } : {}), ...(m.precoLitro ? { precoLitro: m.precoLitro } : {}),
        ...(d.sub === 'combustivel' && d.combustivel ? { combustivel: d.combustivel } : {}),
        ...(m.km ? { km: m.km } : {}), ...(d.manut && (d.sub === 'manutencao' || d.sub === 'melhorias') ? { manut: d.manut } : {}),
      },
    };
    gastos.confirmar(r.id, gastos.marcar(r.id, l));
    vibrar('ok');
    mostrarRecado({
      titulo: TITULO[d.sub] ?? 'Gasto anotado',
      texto: lerOculto() ? l.desc : `${l.desc} · ${dinheiro(l.valor)}`,
      acao: { titulo: 'Desfazer', onPress: () => { desfazerGasto(l); } },
    });
    return { ok: true };
  } catch (e) {
    vibrar('erro');
    return { ok: false, texto: motivoFalha(e) };
  }
}

// O Desfazer do recado: o gasto sai na hora e o site apaga o lançamento
export async function desfazerGasto(l: Lanc) {
  const ficha = gastos.marcar(l.id, null);
  vibrar('leve');
  try {
    const r = await pedirSite('apagarLanc', { id: l.id });
    if (r?.ok) { gastos.confirmar(l.id, ficha); return; }
    gastos.tirar(l.id, ficha);
    avisar('Não deu para desfazer', 'Este gasto pode já ter sido apagado em outro aparelho.');
  } catch (e) {
    gastos.tirar(l.id, ficha);
    vibrar('erro');
    avisar('Não deu para desfazer', motivoFalha(e));
  }
}

/* ---------- O "Paguei" de um documento ---------- */

export async function pagarDocumento(v: Veiculo, doc: DocVeiculo, valor: number, lancId: string): Promise<{ ok: true } | { ok: false; texto: string }> {
  try {
    const r = await pedirSite('veiculoDocPagar', { veiculoId: v.id, k: doc.k, valor, lancId });
    if (!r.ok) { vibrar('aviso'); return { ok: false, texto: r.texto || 'Não deu para marcar como pago agora.' }; }
    const proxima = r.proxima ?? umAnoDepois(doc.data);
    const k = `${v.id}|${doc.k}`;
    docs.confirmar(k, docs.marcar(k, proxima));
    const desc = `${doc.nome} ${doc.data.slice(0, 4)}`;
    const l: Lanc = { id: r.lancId, tipo: 'saida', valor, data: hojeIso(), cat: 'transporte', desc, marca: null, site: null, banco: null, transp: { sub: 'documentos', veiculoId: v.id } };
    gastos.confirmar(r.lancId, gastos.marcar(r.lancId, l));
    vibrar('ok');
    mostrarRecado({ titulo: `${desc} pago`, texto: `Próximo vencimento: ${proxima.slice(8, 10)}/${proxima.slice(5, 7)}/${proxima.slice(0, 4)}`, icone: 'check' });
    return { ok: true };
  } catch (e) {
    vibrar('erro');
    return { ok: false, texto: motivoFalha(e) };
  }
}

/* ---------- Os preços da semana (ANP) ---------- */

// A resposta mais nova do "atualizar" (o retrato com ela chega depois): a tela mostra a mais recente das duas
let precosAgora: PrecosANP | null = null;
const ouvintesPrecos = new Set<() => void>();
export const usePrecosAgora = () => useSyncExternalStore((f) => { ouvintesPrecos.add(f); return () => { ouvintesPrecos.delete(f); }; }, () => precosAgora);

export type ResultadoPrecos = { ok: true; velho: boolean } | { ok: false; erro: 'sem-cidade' | 'sem-servidor' | 'sem-internet' | 'falha'; texto: string };
const TEXTO_PRECOS = {
  'sem-cidade': 'Coloque a sua cidade no Perfil do Avina para ver o preço da semana.',
  'sem-servidor': 'O preço da ANP não está disponível agora.',
  'sem-internet': 'Sem internet agora. Tente de novo daqui a pouco.',
};
// forcar: busca de novo mesmo com a semana guardada (o botão de atualizar); sem forcar, o site só busca se já passou de 3 dias
export async function buscarPrecos(forcar: boolean): Promise<ResultadoPrecos> {
  try {
    const r = await pedirSite('transportePrecos', { forcar }, 45_000);
    if (!r) return { ok: false, erro: 'falha', texto: 'Tente de novo em instantes.' };
    if ('erro' in r) return { ok: false, erro: r.erro, texto: TEXTO_PRECOS[r.erro] ?? 'Tente de novo em instantes.' };
    precosAgora = r;
    ouvintesPrecos.forEach((f) => f());
    return { ok: true, velho: !!r.velho };
  } catch (e) {
    return { ok: false, erro: 'falha', texto: motivoFalha(e) };
  }
}

/* ---------- As folhas e o que fica no site ---------- */

export type TipoFolha = 'combustivel' | 'manutencao' | 'outro' | 'app' | 'publico';
export const abrirGasto = (veiculoId: string | null, tipo: TipoFolha, manut?: string) =>
  router.push({ pathname: '/veiculo/gasto', params: { tipo, ...(veiculoId ? { veiculo: veiculoId } : {}), ...(manut ? { manut } : {}) } });
export const abrirDocumento = (veiculoId: string, k: string) => router.push({ pathname: '/veiculo/documento', params: { veiculo: veiculoId, k } });

// O veículo (tipo, foto, FIPE, IPVA e seguro, troca de óleo) é editado no site; ao sair, volta para o Transporte
export const editarVeiculoNoSite = (id: string | 'novo') => abrirNoSiteEVoltar({ area: 'transporte', acao: 'veiculo', id }, '/transporte', 'transporte');
