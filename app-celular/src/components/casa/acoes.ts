// O que a tela da Nossa casa pede ao site e useCasa(): a casa do retrato já com o que a pessoa acabou de fazer e o
// site ainda não confirmou (lib/pendentes.ts). O site grava na cópia do aparelho na hora (sem internet, vai para a
// fila dele); aqui a mudança aparece antes da resposta, e os saldos e as dívidas são refeitos com ela.
// - Anotar, pagar uma conta e acertar vibram, aparecem na hora e mostram o recado com Desfazer.
// - Se o site disser que não deu, a mudança volta e aparece o motivo (o texto neutro do site).
// - O que é do site (convidar, a divisão, as pessoas, as listas prontas, ler a nota) abre no site e volta para a casa.
import { useMemo } from 'react';
import { Linking } from 'react-native';

import { abrirNoSiteEVoltar, avisar, confirmar, motivoFalha } from '@/components/bancos/comum';
import {
  centavos, dividasDe, juntarNaLista, lerTextoDaLista, maiuscula, nomeDe, novoId, partesDoGasto, secaoDe, somarAcerto, somarGasto,
} from '@/components/casa/regras';
import { mostrarRecado, vibrar } from '@/components/ui';
import { chaveMes, dinheiro, hojeIso } from '@/lib/formato';
import { lerOculto, pedirSite, useEstado, type AcertoCasa, type ContaCasa, type DadosCasa, type EstadoCasa, type GastoCasa, type ItemCompra, type PedidosSite } from '@/lib/motor';
import { criarPendentes } from '@/lib/pendentes';

/* ---------- As mudanças ainda sem resposta ---------- */

const gastos = criarPendentes<GastoCasa | null>(); // id → o gasto novo ou mudado (null: apagado)
const acertos = criarPendentes<AcertoCasa | null>(); // id → o acerto (null: desfeito)
const compras = criarPendentes<ItemCompra | null>(); // id → o item como fica (null: tirado da lista); ids "tmp…" são novos

// A casa com as mudanças por cima. Os saldos e as dívidas saem de novo só quando um gasto ou um acerto mudou.
function aplicar(C: DadosCasa, g: Map<string, GastoCasa | null>, a: Map<string, AcertoCasa | null>, k: Map<string, ItemCompra | null>, hoje: string): DadosCasa {
  if (!g.size && !a.size && !k.size) return C;
  const r: DadosCasa = { ...C };
  if (g.size || a.size) {
    const s = { ...C.saldo };
    if (g.size) {
      const porId = new Map(C.gastos.map((x) => [x.id, x]));
      const delta: Record<string, number> = {};
      g.forEach((novo, id) => {
        const antes = porId.get(id);
        if (antes) { somarGasto(s, antes, -1); delta[antes.data.slice(0, 7)] = (delta[antes.data.slice(0, 7)] ?? 0) - antes.valor; }
        if (novo) { somarGasto(s, novo, 1); delta[novo.data.slice(0, 7)] = (delta[novo.data.slice(0, 7)] ?? 0) + novo.valor; }
      });
      const novos = [...g.values()].filter((x): x is GastoCasa => !!x);
      r.gastos = [...C.gastos.filter((x) => !g.has(x.id)), ...novos]
        .sort((x, y) => (x.data < y.data ? 1 : x.data > y.data ? -1 : (y.criado ?? 0) - (x.criado ?? 0)));
      r.meses = C.meses.map((m) => (delta[m.chave] ? { ...m, total: centavos(m.total + delta[m.chave]) } : m));
      // a conta da casa paga agora (o "Paguei" vira um gasto com contaId) ou desfeita (o gasto dela saiu)
      const ch = chaveMes(hoje);
      r.contas = C.contas.map((c) => {
        if (c.paga && g.has(c.paga.gastoId) && !g.get(c.paga.gastoId)) return { ...c, paga: null };
        if (c.paga) return c;
        const p = novos.find((x) => x.contaId === c.id && x.data.startsWith(ch));
        return p ? { ...c, paga: { por: p.pagou, data: p.data, gastoId: p.id } } : c;
      });
    }
    if (a.size) {
      const porId = new Map(C.acertos.map((x) => [x.id, x]));
      a.forEach((novo, id) => {
        const antes = porId.get(id);
        if (antes) somarAcerto(s, antes, -1);
        if (novo) somarAcerto(s, novo, 1);
      });
      const novos = [...a.values()].filter((x): x is AcertoCasa => !!x);
      r.acertos = [...novos, ...C.acertos.filter((x) => !a.has(x.id))].sort((x, y) => (y.criado ?? 0) - (x.criado ?? 0));
    }
    r.saldo = Object.fromEntries(Object.entries(s).map(([id, v]) => [id, centavos(v)]));
    r.dividas = dividasDe(s);
  }
  if (k.size) {
    const ja = new Set(C.compras.map((x) => x.id));
    const novos = [...k.entries()].filter(([id, x]) => x && !ja.has(id)).map(([, x]) => x as ItemCompra);
    r.compras = [...C.compras.filter((x) => k.get(x.id) !== null).map((x) => k.get(x.id) ?? x), ...novos];
  }
  return r;
}

export type Casa = {
  // sem-pessoal: o Pessoal está desligado; sem-site: o site ainda não mandou a casa (uma cópia antiga, ou abrindo)
  estado: EstadoCasa | 'sem-pessoal' | 'sem-site';
  nuvem: boolean;
  C: DadosCasa | null; // com as mudanças que ainda não voltaram do site
  hoje: string;
};

export function useCasa(): Casa {
  const e = useEstado();
  const g = gastos.usePendentes();
  const a = acertos.usePendentes();
  const k = compras.usePendentes();
  const hoje = hojeIso();
  const R = e?.casa;
  const semPessoal = !!e && e.pessoal === null;
  return useMemo(() => {
    if (semPessoal) return { estado: 'sem-pessoal', nuvem: false, C: null, hoje };
    if (!R) return { estado: 'sem-site', nuvem: false, C: null, hoje };
    if (!R.casa) return { estado: R.estado === 'ok' ? 'sem' : R.estado, nuvem: R.nuvem, C: null, hoje };
    return { estado: 'ok', nuvem: R.nuvem, C: aplicar(R.casa, g, a, k, hoje), hoje };
  }, [semPessoal, R, g, a, k, hoje]);
}

/* ---------- Ajudas ---------- */

const valorTexto = (v: number) => (lerOculto() ? '' : dinheiro(v));
const juntar = (...t: (string | null | undefined | false)[]) => t.filter(Boolean).join(' · ');

// Um pedido que pode voltar { ok: false, texto }: devolve a resposta, ou null depois de mostrar o motivo
async function pedir<A extends keyof PedidosSite>(acao: A, dados: PedidosSite[A]['dados'], erro: string): Promise<PedidosSite[A]['volta'] | null> {
  try {
    const r = await pedirSite(acao, dados);
    const f = r as { ok?: boolean; texto?: string } | null;
    if (f && f.ok === false && f.texto) { vibrar('erro'); avisar(erro, f.texto); return null; }
    return r;
  } catch (e) {
    vibrar('erro');
    avisar(erro, motivoFalha(e));
    return null;
  }
}

/* ---------- Gastos da casa ---------- */

export type DadosGasto = { valor: number; desc: string; cat: string; data: string; pagou: string; participantes: string[] };

// Anota um gasto da casa (ou muda, com antes). O site valida de novo (quem pagou e quem divide são da casa).
export async function anotarGasto(C: DadosCasa, d: DadosGasto, antes?: GastoCasa, { silencioso = false }: { silencioso?: boolean } = {}) {
  const id = antes?.id ?? novoId('g');
  const novo: GastoCasa = {
    ...(antes ?? { criado: Date.now(), autor: C.eu, contaId: null, origem: null, nota: null }),
    id, valor: centavos(d.valor), desc: d.desc.trim().slice(0, 80), cat: d.cat, data: d.data, pagou: d.pagou,
    participantes: d.participantes, partes: partesDoGasto(C, d.valor, d.participantes, antes),
    proporcional: C.divisao.modo === 'proporcional' && d.participantes.length > 1,
  } as GastoCasa;
  const ficha = gastos.marcar(id, novo);
  if (!silencioso) {
    vibrar('ok');
    mostrarRecado({
      titulo: antes ? 'Gasto da casa atualizado' : 'Gasto da casa anotado',
      texto: juntar(novo.desc || 'Gasto da casa', valorTexto(novo.valor)),
      icone: 'casa',
      acao: { titulo: 'Desfazer', onPress: () => { if (antes) anotarGasto(C, antes, antes, { silencioso: true }); else apagarGasto(novo, { silencioso: true }); } },
    });
  }
  const r = await pedir('casaGasto', { id, valor: novo.valor, desc: novo.desc, cat: novo.cat, data: novo.data, pagou: novo.pagou, participantes: novo.participantes }, 'Não deu para anotar o gasto da casa');
  if (r && r.ok) { gastos.confirmar(id, ficha); return true; }
  gastos.tirar(id, ficha);
  return false;
}

export function querApagarGasto() {
  vibrar('firme');
  return confirmar({
    titulo: 'Apagar o gasto da casa?',
    texto: 'Ele some para todas as pessoas da casa. O seu lançamento pessoal (se veio de lá) continua.',
    sim: 'Apagar',
    perigo: true,
  });
}

// Tira o gasto da casa (para todos). Pergunta antes (não tem desfazer: a nota do mercado vai junto), a não ser que
// quem chama já perguntou; silencioso: sem pergunta nem recado (o Desfazer de um gasto recém-anotado)
export async function apagarGasto(g: GastoCasa, { silencioso = false, perguntar = !silencioso }: { silencioso?: boolean; perguntar?: boolean } = {}) {
  if (perguntar && !(await querApagarGasto())) return false;
  const ficha = gastos.marcar(g.id, null);
  vibrar(silencioso ? 'leve' : 'ok');
  if (!silencioso) mostrarRecado({ titulo: 'Gasto apagado', texto: juntar(g.desc || 'Gasto da casa', valorTexto(g.valor)), icone: 'lixo', cor: '#FF6B6B' });
  try {
    await pedirSite('casaGastoApagar', { id: g.id });
    gastos.confirmar(g.id, ficha); // ok false: já não estava lá (apagado em outro celular), vale o retrato
    return true;
  } catch (e) {
    gastos.tirar(g.id, ficha);
    vibrar('erro');
    avisar('Não deu para apagar agora', motivoFalha(e));
    return false;
  }
}

/* ---------- Contas da casa ---------- */

// O "Paguei": vira um gasto dividido entre todos, pago por você (o id do gasto sai daqui: repetir não paga duas vezes)
export async function pagarContaCasa(C: DadosCasa, k: ContaCasa) {
  const id = novoId('g');
  const todos = C.membros.map((m) => m.id);
  const novo: GastoCasa = {
    id, valor: k.valor, desc: k.nome, cat: k.cat, data: hojeIso(), criado: Date.now(), pagou: C.eu, autor: C.eu,
    participantes: todos, partes: partesDoGasto(C, k.valor, todos), proporcional: C.divisao.modo === 'proporcional' && todos.length > 1,
    contaId: k.id, origem: null, nota: null,
  };
  const ficha = gastos.marcar(id, novo);
  vibrar('ok');
  mostrarRecado({
    titulo: C.membros.length > 1 ? `${k.nome} paga e dividida` : `${k.nome} paga`,
    texto: valorTexto(k.valor) || undefined,
    acao: { titulo: 'Desfazer', onPress: () => { apagarGasto(novo, { silencioso: true }); } },
  });
  const r = await pedir('casaContaPagar', { id: k.id, gastoId: id }, 'Não deu para marcar como paga');
  if (r && r.ok) { gastos.confirmar(id, ficha); return true; }
  gastos.tirar(id, ficha);
  return false;
}

/* ---------- Acertos ---------- */

// "Recebi" / "Já paguei": a dívida (ou parte dela) fica acertada para os dois
export async function acertar(C: DadosCasa, d: { de: string; para: string; valor: number }) {
  const id = novoId('a');
  const novo: AcertoCasa = { id, de: d.de, para: d.para, valor: centavos(d.valor), data: hojeIso(), criado: Date.now() };
  const ficha = acertos.marcar(id, novo);
  vibrar('ok');
  mostrarRecado({
    titulo: 'Acertado',
    texto: juntar(`${nomeDe(C, d.de)} → ${nomeDe(C, d.para)}`, valorTexto(novo.valor)),
    icone: 'check',
    acao: { titulo: 'Desfazer', onPress: () => { desfazerAcerto(novo); } },
  });
  const r = await pedir('casaAcertar', { id, de: d.de, para: d.para, valor: novo.valor }, 'Não deu para acertar');
  if (r && r.ok) { acertos.confirmar(id, ficha); return true; }
  acertos.tirar(id, ficha);
  return false;
}

async function desfazerAcerto(a: AcertoCasa) {
  const ficha = acertos.marcar(a.id, null);
  vibrar('leve');
  try {
    await pedirSite('casaAcertoApagar', { id: a.id });
    acertos.confirmar(a.id, ficha);
  } catch (e) {
    acertos.tirar(a.id, ficha);
    vibrar('erro');
    avisar('Não deu para desfazer o acerto', motivoFalha(e));
  }
}

// O lembrete educado pelo WhatsApp (a pessoa escolhe o contato), com a sua chave Pix quando ela está nos ajustes
export function lembrarNoWhatsApp(C: DadosCasa, d: { de: string; valor: number }) {
  const nome = nomeDe(C, d.de);
  const msg = `Oi, ${nome}! Pelas contas da casa "${C.nome}", ficou ${dinheiro(d.valor)} para você me passar.${C.pix ? ` Meu Pix: ${C.pix}` : ''} Obrigado(a)! 💚`;
  Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() => avisar('Não deu para abrir o WhatsApp', 'Confira se ele está instalado neste celular.'));
}

/* ---------- Lista de compras ---------- */

// Marca (ou desmarca) no carrinho: o valor final, não "inverter" (dois celulares marcando juntos não se desfazem)
export async function marcarItem(C: DadosCasa, x: ItemCompra, feito: boolean) {
  const ficha = compras.marcar(x.id, { ...x, feito, por: feito ? C.eu : null });
  vibrar(feito ? 'leve' : 'toque');
  // ainda nem chegou ao site: vale até o retrato com o item de verdade (que chega num instante)
  if (x.id.startsWith('tmp')) { compras.confirmar(x.id, ficha); return; }
  try {
    const r = await pedirSite('casaLista', { id: x.id, feito });
    if (r.ok) compras.confirmar(x.id, ficha); else compras.tirar(x.id, ficha); // já saiu da lista (outro celular)
  } catch (e) {
    compras.tirar(x.id, ficha);
    avisar('Não deu para marcar agora', motivoFalha(e));
  }
}

// Muda a quantidade (de 1 a 99)
export async function mudarQtd(x: ItemCompra, qtd: number) {
  const q = Math.min(99, Math.max(1, Math.round(qtd)));
  const ficha = compras.marcar(x.id, { ...x, qtd: q, preco: x.preco ? { ...x.preco, total: centavos(x.preco.unit * q) } : null });
  vibrar('toque');
  try {
    const r = await pedirSite('casaLista', { id: x.id, qtd: q });
    if (r.ok) compras.confirmar(x.id, ficha); else compras.tirar(x.id, ficha);
  } catch (e) {
    compras.tirar(x.id, ficha);
    avisar('Não deu para mudar agora', motivoFalha(e));
  }
}

// Coloca na lista ("2 leite, pão; café" ou uma lista pronta). O que já está não repete: digitando, soma a
// quantidade; da lista pronta, fica como está. Aparece na hora (os novos com um id provisório até o retrato chegar).
export async function adicionarNaLista(C: DadosCasa, entrada: { texto: string } | { itens: { texto: string; qtd: number; obs?: string }[]; nome: string }) {
  const lidos = 'texto' in entrada ? lerTextoDaLista(entrada.texto) : entrada.itens;
  if (!lidos.length) return false;
  const somar = 'texto' in entrada;
  const { mudados, novos } = juntarNaLista(C.compras, lidos, somar, C.eu);
  const fichas: [string, number][] = [];
  for (const x of mudados) fichas.push([x.id, compras.marcar(x.id, { ...x, preco: x.preco ? { ...x.preco, total: centavos(x.preco.unit * x.qtd) } : null })]);
  novos.forEach((x, i) => {
    const id = `tmp${Date.now().toString(36)}${i}`;
    const it: ItemCompra = { id, texto: x.texto, qtd: x.qtd, obs: x.obs ?? null, secao: secaoDe(x.texto), feito: false, por: null, autor: C.eu, criado: Date.now() + i, preco: null };
    fichas.push([id, compras.marcar(id, it)]);
  });
  vibrar('toque');
  try {
    const r = await pedirSite('casaListaAdicionar', 'texto' in entrada ? { texto: entrada.texto } : { itens: entrada.itens, somar: false });
    const f = r as { ok?: boolean; texto?: string };
    if (f.ok === false) throw new Error(f.texto || 'sem-casa');
    fichas.forEach(([id, n]) => compras.confirmar(id, n));
    if (!somar) {
      vibrar('ok');
      mostrarRecado({ titulo: `${r.novos} ${r.novos === 1 ? 'item' : 'itens'} de "${(entrada as { nome: string }).nome}" na lista`, texto: r.ja.length ? `${r.ja.length} já ${r.ja.length === 1 ? 'estava' : 'estavam'} lá` : undefined, icone: 'carrinho' });
    } else if (r.ja.length === 1) {
      mostrarRecado({ titulo: `${maiuscula(r.ja[0].texto)} já estava na lista`, texto: `Agora são ${r.ja[0].qtd}×`, icone: 'carrinho' });
    } else if (r.ja.length > 1) {
      mostrarRecado({ titulo: `${r.ja.length} itens já estavam na lista`, texto: 'Somei as quantidades', icone: 'carrinho' });
    }
    return true;
  } catch (e) {
    fichas.forEach(([id, n]) => compras.tirar(id, n));
    vibrar('erro');
    avisar('Não deu para colocar na lista', motivoFalha(e));
    return false;
  }
}

// Tira da lista (um item, ou os comprados de uma vez), com o Desfazer que põe de volta como estavam
export async function tirarDaLista(itens: ItemCompra[], { comprados = false }: { comprados?: boolean } = {}) {
  const reais = itens.filter((x) => !x.id.startsWith('tmp'));
  if (!reais.length) return false;
  const fichas = reais.map((x) => [x.id, compras.marcar(x.id, null)] as const);
  vibrar('firme');
  // a resposta traz os itens como o site guarda (é o que volta no Desfazer)
  const pedido = pedirSite('casaListaTirar', { ids: reais.map((x) => x.id) });
  const titulo = comprados
    ? `${reais.length} ${reais.length === 1 ? 'item tirado' : 'itens tirados'} do carrinho`
    : `${maiuscula(reais[0].texto)} saiu da lista`;
  mostrarRecado({ titulo, icone: 'lixo', cor: '#FFB648', acao: { titulo: 'Desfazer', onPress: () => { restaurar(reais, pedido); } } });
  try {
    await pedido;
    fichas.forEach(([id, n]) => compras.confirmar(id, n));
    return true;
  } catch (e) {
    fichas.forEach(([id, n]) => compras.tirar(id, n));
    avisar('Não deu para tirar da lista', motivoFalha(e));
    return false;
  }
}

async function restaurar(itens: ItemCompra[], pedido: Promise<PedidosSite['casaListaTirar']['volta']>) {
  const fichas = itens.map((x) => [x.id, compras.marcar(x.id, x)] as const);
  vibrar('leve');
  try {
    const r = await pedido;
    if (!r.itens.length) throw new Error('nada');
    await pedirSite('casaListaRestaurar', { itens: r.itens });
    fichas.forEach(([id, n]) => compras.confirmar(id, n));
  } catch (e) {
    fichas.forEach(([id, n]) => compras.tirar(id, n));
    avisar('Não deu para pôr de volta', motivoFalha(e));
  }
}

// "Estou no mercado": avisa quem mora junto (precisa de mais alguém na casa e de internet)
export async function avisarMercado() {
  const r = await pedir('casaAvisarMercado', null, 'Não deu para avisar a casa');
  if (!r || !r.ok) return false;
  vibrar('ok');
  mostrarRecado({
    titulo: r.recente ? 'A casa já foi avisada há pouco' : r.enviados ? 'Avisei quem mora aqui' : 'Ninguém recebeu o aviso',
    texto: !r.recente && !r.enviados ? 'Ninguém da casa ligou os avisos no celular ainda' : undefined,
    icone: 'sino',
  });
  return true;
}


/* ---------- O que fica no site (ao sair do site, volta para a casa) ---------- */

type AcaoCasa = 'casa-convidar' | 'casa-divisao' | 'casa-pessoas' | 'casa-listas' | 'casa-nota' | 'casa-nota-ver' | 'casa-trazer' | 'casa-conta' | 'casa-gasto';
export const abrirCasaNoSite = (acao?: AcaoCasa, id?: string) => abrirNoSiteEVoltar({ area: 'casa', ...(acao ? { acao } : {}), ...(id ? { id } : {}) }, '/casa', 'casa');
