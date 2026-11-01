// Prévia no navegador: as respostas de mentira para os pedidos das telas nativas de Contas fixas, Transporte e Nossa
// casa (os formatos de PedidosSite em lib/motor.ts), mudando o retrato de exemplo como o site faria. Quem chama é o
// site de mentira (components/camada-web.web.tsx), que publica o retrato novo. Só entra no build web.
// - Validações e textos de erro iguais aos do contrato da ponte (neutros: nada de preço nem de assinar).
// - O que o site guarda fora do retrato (as notas do mercado, as fotos) volta com um exemplo fixo.
import { partes, pesosDe, saldos } from '@site/casa-contas.js';
import { lerItem, secaoDe } from '@site/nota.js';
import { MANUTENCOES, subInfo } from '@site/transporte.js';

import { CATEGORIAS, logoDe, situacaoDe } from '@/lib/exemplo.web';
import type {
  CasaRetrato, ContaFixa, DadosCasa, Estado, Falha, GastoCasa, ItemCompra, Lanc, LancTransp, MesTransp, PedidosSite, Transporte,
} from '@/lib/motor';

type Resposta = { volta: unknown; novo?: Estado };
type Dados<A extends keyof PedidosSite> = PedidosSite[A]['dados'];

/* ---------- Datas e números ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = () => iso(new Date());
const diffDias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / 864e5);
const centavos = (v: number) => Math.round(v * 100) / 100;
const diasNoMes = (ch: string) => { const [a, m] = ch.split('-').map(Number); return new Date(a, m, 0).getDate(); };
const vencimento = (dia: number, ch: string) => `${ch}-${pad(Math.min(dia, diasNoMes(ch)))}`;
const novoId = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const falha = (erro: string, texto: string): Falha => ({ ok: false, erro, texto });
const umAnoDepois = (s: string) => { const d = new Date(`${s}T12:00:00`); d.setFullYear(d.getFullYear() + 1); return iso(d); };

/* ---------- Contas fixas ---------- */

// Depois de mudar os pagamentos: a situação do mês de agora sai de novo (como retratoNativo)
function comSituacao(c: ContaFixa): ContaFixa {
  const h = hoje(), ch = h.slice(0, 7);
  const vence = vencimento(c.dia, ch);
  const pagaEm = c.pagas?.[ch] ?? null;
  return { ...c, vence, paga: !!pagaEm, pagaEm, ...situacaoDe(vence, pagaEm, h) };
}

function mudarContas(e: Estado, f: (contas: ContaFixa[]) => ContaFixa[]): Estado {
  const P = e.pessoal!;
  return { ...e, pessoal: { ...P, contas: f(P.contas).map(comSituacao) } };
}

function contas(acao: string, d: any, e: Estado): Resposta | null {
  const P = e.pessoal;
  const sem = { volta: falha('pessoal', 'Ligue o Pessoal no Perfil para usar as contas fixas.') };
  switch (acao) {
    case 'contaPagar': {
      if (!P) return sem;
      const { id, mes = hoje().slice(0, 7), data = hoje() } = d as Dados<'contaPagar'>;
      if (!P.contas.some((c) => c.id === id)) return { volta: falha('nao-achei', 'Não achei esta conta. Ela pode ter sido apagada em outro aparelho.') };
      if (mes > hoje().slice(0, 7)) return { volta: falha('mes', 'Esse mês ainda não chegou.') };
      return { volta: { ok: true, mes, data }, novo: mudarContas(e, (l) => l.map((c) => (c.id === id ? { ...c, pagas: { ...c.pagas, [mes]: data } } : c))) };
    }
    case 'contaDesfazer': {
      if (!P) return { volta: { ok: false } };
      const { id, mes = hoje().slice(0, 7) } = d as Dados<'contaDesfazer'>;
      const tinha = P.contas.some((c) => c.id === id && c.pagas?.[mes]);
      if (!tinha) return { volta: { ok: false } };
      return {
        volta: { ok: true },
        novo: mudarContas(e, (l) => l.map((c) => { if (c.id !== id) return c; const pagas = { ...c.pagas }; delete pagas[mes]; return { ...c, pagas }; })),
      };
    }
    case 'contaSalvar': {
      if (!P) return sem;
      const x = d as Dados<'contaSalvar'>;
      const nome = String(x.nome || '').trim().slice(0, 60);
      const valor = centavos(Number(x.valor));
      const dia = Math.round(Number(x.dia));
      if (!nome) return { volta: falha('nome', 'Coloque o nome da conta.') };
      if (!(valor > 0)) return { volta: falha('valor', 'Coloque o valor da conta.') };
      if (!(dia >= 1 && dia <= 31)) return { volta: falha('dia', 'O dia do vencimento vai de 1 a 31.') };
      const antes = x.id ? P.contas.find((c) => c.id === x.id) : undefined;
      if (x.id && !antes) return { volta: falha('nao-achei', 'Não achei esta conta. Ela pode ter sido apagada em outro aparelho.') };
      if (antes?.moeda && antes.moeda !== 'BRL' && Math.abs(antes.valor - valor) >= 0.005) {
        return { volta: falha('moeda', 'Esta conta é cobrada em outra moeda e o valor segue a cotação. Mude pelo Avina completo.') };
      }
      const cat = x.cat && CATEGORIAS.some((k) => k.id === x.cat) ? x.cat : 'casa';
      const logo = logoDe(nome, x.marca);
      const conta: ContaFixa = {
        ...(antes ?? { id: novoId('cf'), pagas: {}, codigo: null, paga: false, vence: '' }),
        nome, valor, dia, cat, assinatura: x.assinatura ?? antes?.assinatura ?? false, ...logo,
      };
      return { volta: { ok: true, id: conta.id }, novo: mudarContas(e, (l) => (antes ? l.map((c) => (c.id === conta.id ? conta : c)) : [...l, conta])) };
    }
    case 'contaApagar': {
      if (!P) return { volta: { ok: false } };
      const { id } = d as Dados<'contaApagar'>;
      if (!P.contas.some((c) => c.id === id)) return { volta: { ok: false } };
      return { volta: { ok: true }, novo: mudarContas(e, (l) => l.filter((c) => c.id !== id)) };
    }
    default: return null;
  }
}

/* ---------- Transporte ---------- */

// Soma (sinal 1) ou tira (sinal -1) um gasto do mês dele: no total e no veículo
function mexerNoMes(T: Transporte, l: Lanc, sinal: 1 | -1): Transporte {
  const t = l.transp;
  if (!t) return T;
  const ch = l.data.slice(0, 7);
  const mexer = (meses: MesTransp[] | undefined) => meses?.map((m) => {
    if (m.chave !== ch) return m;
    const x = m.porSub[t.sub] ?? { total: 0, n: 0 };
    const novo = { total: centavos(Math.max(0, x.total + sinal * l.valor)), n: Math.max(0, x.n + sinal) };
    return { ...m, total: centavos(Math.max(0, m.total + sinal * l.valor)), porSub: { ...m.porSub, [t.sub]: novo } };
  });
  return {
    ...T,
    meses: mexer(T.meses) ?? T.meses,
    veiculos: T.veiculos.map((v) => (v.id === t.veiculoId && v.meses ? { ...v, meses: mexer(v.meses) } : v)),
  };
}

// Grava (ou troca) um lançamento e acerta o Transporte
function gravarLanc(e: Estado, l: Lanc, antes?: Lanc): Estado {
  const P = e.pessoal!;
  let T = e.transporte ?? null;
  if (T && antes) T = mexerNoMes(T, antes, -1);
  if (T) T = mexerNoMes(T, l, 1);
  // o km do painel e o último abastecimento andam junto
  if (T && l.transp?.veiculoId) {
    const t = l.transp;
    T = {
      ...T,
      veiculos: T.veiculos.map((v) => {
        if (v.id !== t.veiculoId) return v;
        const km = t.km && (!v.km || t.km > v.km) ? t.km : v.km;
        const ultimo = t.sub === 'combustivel' && t.litros && (!v.ultimoAbast || l.data >= v.ultimoAbast.data)
          ? { data: l.data, litros: t.litros, precoLitro: t.precoLitro ?? null, combustivel: t.combustivel ?? null, km: t.km ?? null, desc: l.desc }
          : v.ultimoAbast;
        return { ...v, km, ultimoAbast: ultimo };
      }),
    };
  }
  const lanc = antes ? P.lanc.map((x) => (x.id === l.id ? l : x)) : [l, ...P.lanc];
  lanc.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return { ...e, pessoal: { ...P, lanc }, transporte: T };
}

function transporte(acao: string, d: any, e: Estado): Resposta | null {
  const P = e.pessoal, T = e.transporte;
  const sem = { volta: falha('pessoal', 'Ligue o Pessoal no Perfil para usar o Transporte.') };
  switch (acao) {
    case 'transporteGasto': {
      if (!P || !T) return sem;
      const x = d as Dados<'transporteGasto'>;
      const antes = x.id ? P.lanc.find((l) => l.id === x.id) : undefined;
      let litros = Number(x.litros) || 0, precoLitro = Number(x.precoLitro) || 0, valor = Number(x.valor) || 0;
      // dois dos três: o terceiro sai sozinho
      if (x.sub === 'combustivel') {
        if (!valor && litros && precoLitro) valor = litros * precoLitro;
        else if (valor && litros && !precoLitro) precoLitro = valor / litros;
        else if (valor && !litros && precoLitro) litros = valor / precoLitro;
      }
      valor = centavos(valor);
      if (!(valor > 0)) return { volta: falha('valor', 'Coloque o valor do gasto.') };
      const motor = T.veiculos.find((v) => v.tipo !== 'nenhum') ?? T.veiculos[0];
      const veiculoId = x.veiculoId && T.veiculos.some((v) => v.id === x.veiculoId) ? x.veiculoId : motor?.id ?? null;
      const comb = x.combustivel ?? 'gasolina';
      const desc = String(x.desc || '').trim().slice(0, 80)
        || (x.sub === 'combustivel' ? `Abastecimento (${comb})` : x.sub === 'manutencao' && x.manut ? String((MANUTENCOES as string[][]).find((m) => m[0] === x.manut)?.[1] ?? 'Manutenção') : String(subInfo(x.sub).nome));
      const comKm = x.sub === 'combustivel' || x.sub === 'manutencao';
      const transp: LancTransp = {
        sub: x.sub, veiculoId,
        ...(x.sub === 'combustivel' ? { litros: Math.round(litros * 100) / 100, precoLitro: Math.round(precoLitro * 1000) / 1000, combustivel: comb } : {}),
        ...(comKm && x.km ? { km: Math.round(Number(x.km)) } : {}),
        ...(x.sub === 'manutencao' && x.manut ? { manut: x.manut } : {}),
      };
      const l: Lanc = {
        ...(antes ?? {}),
        id: antes?.id ?? x.id ?? novoId('t'), tipo: 'saida', valor, data: /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data! : hoje(),
        cat: 'transporte', desc, ...logoDe(desc), banco: antes?.banco ?? null, transp,
      };
      return { volta: { ok: true, id: l.id }, novo: gravarLanc(e, l, antes) };
    }
    case 'veiculoDocPagar': {
      if (!P || !T) return sem;
      const x = d as Dados<'veiculoDocPagar'>;
      const v = T.veiculos.find((y) => y.id === x.veiculoId);
      const doc = v?.docs.find((y) => y.k === x.k);
      if (!v) return { volta: falha('veiculo', 'Não achei esse veículo. Ele pode ter sido tirado em outro aparelho.') };
      if (x.lancId && P.lanc.some((l) => l.id === x.lancId)) return { volta: { ok: true, lancId: x.lancId, proxima: doc?.data ?? null } };
      if (!doc) return { volta: falha('doc', 'Esse documento não tem data marcada no veículo.') };
      const valor = centavos(Number(x.valor) || doc.valor);
      if (!(valor > 0)) return { volta: falha('valor', 'Coloque quanto você pagou.') };
      const proxima = umAnoDepois(doc.data);
      const l: Lanc = {
        id: x.lancId ?? novoId('t'), tipo: 'saida', valor, data: hoje(), cat: 'transporte', desc: `${doc.nome} ${doc.data.slice(0, 4)}`, marca: null, site: null, banco: null,
        transp: { sub: 'documentos', veiculoId: v.id },
      };
      const comDoc = gravarLanc(e, l);
      const T2 = comDoc.transporte!;
      return {
        volta: { ok: true, lancId: l.id, proxima },
        novo: {
          ...comDoc,
          transporte: { ...T2, veiculos: T2.veiculos.map((y) => (y.id !== v.id ? y : { ...y, docs: y.docs.map((z) => (z.k === doc.k ? { ...z, data: proxima, dias: diffDias(hoje(), proxima) } : z)) })) },
        },
      };
    }
    case 'veiculoAtualizar': {
      if (!T) return { volta: { ok: false } };
      const x = d as Dados<'veiculoAtualizar'>;
      if (!T.veiculos.some((v) => v.id === x.id)) return { volta: { ok: false } };
      const veiculos = T.veiculos.map((v) => (v.id !== x.id ? v : {
        ...v,
        ...(x.km !== undefined ? { km: x.km } : {}),
        ...(x.consumo !== undefined ? { consumo: x.consumo, consumoReal: false } : {}),
        ...(x.appRef !== undefined ? { appRef: x.appRef } : {}),
      }));
      return { volta: { ok: true }, novo: { ...e, transporte: { ...T, veiculos } } };
    }
    case 'transportePrecos': {
      if (!T || !T.cidade) return { volta: { erro: 'sem-cidade' } };
      const precos = { ...(T.precos ?? { p: { gasolina: 6.29, etanol: 4.19 }, onde: 'cidade' as const, nome: T.cidade, ini: null, fim: null }), em: Date.now() };
      return { volta: precos, novo: { ...e, transporte: { ...T, precos } } };
    }
    default: return null;
  }
}

/* ---------- Nossa casa ---------- */

// Os saldos e as dívidas saem de novo de todos os gastos e acertos (como o site faz com o histórico inteiro)
function recalcular(C: DadosCasa): DadosCasa {
  const ch = hoje().slice(0, 7);
  const r = saldos(C.gastos.map((g) => ({ valor: g.valor, pagou: g.pagou, participantes: g.participantes, pesos: g.partes })), C.acertos, C.membros) as { saldo: Record<string, number>; dividas: DadosCasa['dividas'] };
  const doMes = C.gastos.filter((g) => g.data.startsWith(ch));
  return {
    ...C, saldo: r.saldo, dividas: r.dividas,
    meses: C.meses.map((m) => (m.chave === ch ? { ...m, total: centavos(doMes.reduce((t, g) => t + g.valor, 0)) } : m)),
    gastos: [...C.gastos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.criado ?? 0) - (a.criado ?? 0))),
  };
}

const mudarCasa = (e: Estado, C: DadosCasa): Estado => ({ ...e, casa: { ...(e.casa as CasaRetrato), casa: C } });

// Um gasto da casa no formato do retrato: participantes (todos, se não vierem), pesos da divisão e a parte de cada um
function gastoCasa(C: DadosCasa, x: { id?: string; valor: number; desc?: string; cat?: string; data?: string; pagou?: string; participantes?: string[]; contaId?: string | null; origem?: string | null }, antes?: GastoCasa): GastoCasa {
  const ids = C.membros.map((m) => m.id);
  const participantes = (x.participantes?.length ? x.participantes : ids).filter((p) => ids.includes(p));
  const mesmos = antes && antes.participantes.length === participantes.length && antes.participantes.every((p) => participantes.includes(p));
  const pesos = mesmos && antes!.proporcional ? antes!.partes : pesosDe(C.divisao, participantes);
  const valor = centavos(x.valor);
  return {
    ...(antes ?? { criado: Date.now(), autor: C.eu, contaId: x.contaId ?? null, origem: x.origem ?? null, nota: null }),
    id: antes?.id ?? x.id ?? novoId('gc'), valor, desc: String(x.desc ?? antes?.desc ?? '').trim().slice(0, 80), cat: x.cat ?? antes?.cat ?? 'mercado',
    data: x.data && /^\d{4}-\d{2}-\d{2}$/.test(x.data) ? x.data : antes?.data ?? hoje(), pagou: x.pagou && ids.includes(x.pagou) ? x.pagou : antes?.pagou ?? C.eu,
    participantes, partes: partes({ valor, participantes, pesos }, C.membros) as Record<string, number>, proporcional: !!pesos,
  } as GastoCasa;
}

function casa(acao: string, d: any, e: Estado): Resposta | null {
  if (!acao.startsWith('casa')) return null;
  const C = e.casa?.casa;
  if (!C) return { volta: acao === 'casaNota' ? null : falha('sem-casa', 'Crie a casa primeiro.') };
  const membro = (id: string) => C.membros.some((m) => m.id === id);
  switch (acao) {
    case 'casaGasto': {
      const x = d as Dados<'casaGasto'>;
      if (!(Number(x.valor) > 0)) return { volta: falha('valor', 'Coloque o valor do gasto.') };
      if (x.pagou && !membro(x.pagou)) return { volta: falha('pagou', 'Quem pagou precisa ser da casa.') };
      if (x.participantes && !x.participantes.filter(membro).length) return { volta: falha('participantes', 'Escolha ao menos uma pessoa para dividir.') };
      const antes = x.id ? C.gastos.find((g) => g.id === x.id) : undefined;
      const g = gastoCasa(C, x, antes);
      return { volta: { ok: true, id: g.id }, novo: mudarCasa(e, recalcular({ ...C, gastos: antes ? C.gastos.map((y) => (y.id === g.id ? g : y)) : [g, ...C.gastos] })) };
    }
    case 'casaGastoApagar': {
      const { id } = d as Dados<'casaGastoApagar'>;
      const g = C.gastos.find((y) => y.id === id);
      if (!g) return { volta: { ok: false } };
      const contas = C.contas.map((k) => (k.paga?.gastoId === id ? { ...k, paga: null } : k));
      // o lançamento pessoal de onde veio deixa de estar na casa
      const P = e.pessoal;
      const pessoal = P && g.origem ? { ...P, lanc: P.lanc.map((l) => (l.id === g.origem ? { ...l, casaId: null } : l)) } : P;
      return { volta: { ok: true }, novo: { ...mudarCasa(e, recalcular({ ...C, contas, gastos: C.gastos.filter((y) => y.id !== id) })), pessoal } };
    }
    case 'casaAcertar': {
      const x = d as Dados<'casaAcertar'>;
      const valor = centavos(Number(x.valor));
      if (!membro(x.de) || !membro(x.para) || x.de === x.para) return { volta: falha('membros', 'O acerto é entre duas pessoas da casa.') };
      if (!(valor > 0)) return { volta: falha('valor', 'Coloque o valor do acerto.') };
      if (x.id && C.acertos.some((a) => a.id === x.id)) return { volta: { ok: true, id: x.id } };
      const a = { id: x.id ?? novoId('ac'), de: x.de, para: x.para, valor, data: hoje(), criado: Date.now() };
      return { volta: { ok: true, id: a.id }, novo: mudarCasa(e, recalcular({ ...C, acertos: [a, ...C.acertos].slice(0, 10) })) };
    }
    case 'casaAcertoApagar': {
      const { id } = d as Dados<'casaAcertoApagar'>;
      if (!C.acertos.some((a) => a.id === id)) return { volta: { ok: false } };
      return { volta: { ok: true }, novo: mudarCasa(e, recalcular({ ...C, acertos: C.acertos.filter((a) => a.id !== id) })) };
    }
    case 'casaContaPagar': {
      const { id } = d as Dados<'casaContaPagar'>;
      const k = C.contas.find((y) => y.id === id);
      if (!k) return { volta: falha('nao-achei', 'Não achei esta conta da casa.') };
      if (k.paga) return { volta: falha('ja-paga', `${k.nome} já foi paga este mês.`) };
      const g = gastoCasa(C, { id: (d as Dados<'casaContaPagar'>).gastoId, valor: k.valor, desc: k.nome, cat: k.cat, contaId: k.id });
      const contas = C.contas.map((y) => (y.id === id ? { ...y, paga: { por: C.eu, data: g.data, gastoId: g.id } } : y));
      return { volta: { ok: true, gastoId: g.id }, novo: mudarCasa(e, recalcular({ ...C, contas, gastos: [g, ...C.gastos] })) };
    }
    case 'casaConta': {
      const x = d as Dados<'casaConta'>;
      const nome = String(x.nome || '').trim().slice(0, 60), valor = centavos(Number(x.valor)), dia = Math.round(Number(x.dia));
      if (!nome) return { volta: falha('nome', 'Coloque o nome da conta.') };
      if (!(valor > 0)) return { volta: falha('valor', 'Coloque o valor da conta.') };
      if (!(dia >= 1 && dia <= 31)) return { volta: falha('dia', 'O dia do vencimento vai de 1 a 31.') };
      const antes = x.id ? C.contas.find((y) => y.id === x.id) : undefined;
      const k = { ...(antes ?? { paga: null }), id: antes?.id ?? x.id ?? novoId('cc'), nome, valor, dia, cat: x.cat ?? antes?.cat ?? 'casa' };
      const lista = (antes ? C.contas.map((y) => (y.id === k.id ? k : y)) : [...C.contas, k]).sort((a, b) => a.dia - b.dia);
      return { volta: { ok: true, id: k.id }, novo: mudarCasa(e, { ...C, contas: lista }) };
    }
    case 'casaContaApagar': {
      const { id } = d as Dados<'casaContaApagar'>;
      if (!C.contas.some((y) => y.id === id)) return { volta: { ok: false } };
      return { volta: { ok: true }, novo: mudarCasa(e, { ...C, contas: C.contas.filter((y) => y.id !== id) }) };
    }
    case 'casaListaAdicionar': {
      const x = d as Dados<'casaListaAdicionar'>;
      const pedidos = (x.itens ?? String(x.texto || '').split(/[,;\n]+/).map((t) => lerItem(t) as { texto: string; qtd: number }))
        .map((it) => ({ texto: String(it.texto || '').trim().slice(0, 80), qtd: Math.min(99, Math.max(1, Number(it.qtd) || 1)), obs: 'obs' in it ? (it as { obs?: string }).obs ?? null : null }))
        .filter((it) => it.texto);
      const somar = x.somar !== false;
      const igual = (a: string, b: string) => a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      let compras = [...C.compras];
      const ja: { id: string; texto: string; qtd: number }[] = [];
      let novos = 0;
      for (const it of pedidos) {
        const existe = compras.find((c) => !c.feito && igual(c.texto, it.texto));
        if (existe) {
          const qtd = somar ? Math.min(99, existe.qtd + it.qtd) : existe.qtd;
          compras = compras.map((c) => (c.id === existe.id ? { ...c, qtd } : c));
          ja.push({ id: existe.id, texto: existe.texto, qtd });
          continue;
        }
        novos += 1;
        compras.push({ id: novoId('i'), texto: it.texto, qtd: it.qtd, obs: it.obs, secao: secaoDe(it.texto) as string, feito: false, por: null, autor: C.eu, criado: Date.now(), preco: null });
      }
      return { volta: { novos, ja }, novo: mudarCasa(e, { ...C, compras }) };
    }
    case 'casaLista': {
      const x = d as Dados<'casaLista'>;
      const item = C.compras.find((c) => c.id === x.id);
      if (!item) return { volta: { ok: false } };
      const texto = x.texto !== undefined ? String(x.texto).trim().slice(0, 80) || item.texto : item.texto;
      const novo: ItemCompra = {
        ...item, texto,
        ...(x.feito !== undefined ? { feito: x.feito, por: x.feito ? C.eu : null } : {}),
        ...(x.qtd !== undefined ? { qtd: Math.min(99, Math.max(1, Math.round(Number(x.qtd)) || 1)) } : {}),
        ...(x.obs !== undefined ? { obs: x.obs ? String(x.obs).slice(0, 80) : null } : {}),
        ...(texto !== item.texto ? { secao: secaoDe(texto) as string } : {}),
      };
      return { volta: { ok: true }, novo: mudarCasa(e, { ...C, compras: C.compras.map((c) => (c.id === x.id ? novo : c)) }) };
    }
    case 'casaListaTirar': {
      const { ids } = d as Dados<'casaListaTirar'>;
      const itens = C.compras.filter((c) => ids.includes(c.id));
      return { volta: { ok: itens.length > 0, itens }, novo: mudarCasa(e, { ...C, compras: C.compras.filter((c) => !ids.includes(c.id)) }) };
    }
    case 'casaListaRestaurar': {
      const { itens } = d as Dados<'casaListaRestaurar'>;
      const volta = (itens as ItemCompra[]).filter((x) => x && x.id && !C.compras.some((c) => c.id === x.id));
      return { volta: { ok: true }, novo: mudarCasa(e, { ...C, compras: [...C.compras, ...volta] }) };
    }
    case 'casaListaLimite': {
      const { limite } = d as Dados<'casaListaLimite'>;
      return { volta: { ok: true }, novo: mudarCasa(e, { ...C, listaLimite: limite && limite > 0 ? centavos(limite) : null }) };
    }
    case 'casaAvisarMercado':
      if (!e.casa?.nuvem || C.membros.length < 2) return { volta: falha('sozinho', 'Avisar a casa precisa de mais alguém na casa.') };
      return { volta: { ok: true, enviados: C.membros.length - 1, recente: false } };
    case 'casaTrazer': {
      const x = d as Dados<'casaTrazer'>;
      const P = e.pessoal;
      if (!P) return { volta: falha('pessoal', 'Ligue o Pessoal no Perfil.') };
      const escolhidos = P.lanc.filter((l) => x.ids.includes(l.id) && l.tipo === 'saida' && !l.casaId);
      if (!escolhidos.length) return { volta: falha('vazio', 'Esses gastos já estão na casa.') };
      const novos = escolhidos.map((l) => gastoCasa(C, { valor: l.valor, desc: l.desc, cat: l.cat, data: l.data, participantes: x.dividir ? undefined : [C.eu], origem: l.id }));
      const porOrigem = new Map(novos.map((g) => [g.origem, g.id]));
      return {
        volta: { ok: true, n: novos.length },
        novo: { ...mudarCasa(e, recalcular({ ...C, gastos: [...novos, ...C.gastos] })), pessoal: { ...P, lanc: P.lanc.map((l) => (porOrigem.has(l.id) ? { ...l, casaId: porOrigem.get(l.id)! } : l)) } },
      };
    }
    case 'casaNota': {
      const { id } = d as Dados<'casaNota'>;
      const g = C.gastos.find((y) => y.id === id);
      if (!g?.nota) return { volta: null };
      // uma nota de mercado de exemplo, com o total do gasto
      const base = [['Leite integral 1L', 6, 'UN', 4.89], ['Café torrado 500g', 2, 'UN', 18.9], ['Arroz tipo 1 5kg', 1, 'UN', 27.9], ['Banana prata', 1.2, 'KG', 6.99], ['Frango filé', 1, 'KG', 21.9]] as const;
      const itens: { nome: string; qtd: number; un: string | null; unit: number; valor: number }[] = base.map(([nome, qtd, un, unit]) => ({ nome, qtd, un, unit, valor: centavos(qtd * unit) }));
      const somaItens = itens.reduce((t, x) => t + x.valor, 0);
      const resto = centavos(g.valor - somaItens);
      if (resto > 0) itens.push({ nome: `Outros ${Math.max(1, g.nota.itens - itens.length)} itens`, qtd: 1, un: 'UN', unit: resto, valor: resto });
      return { volta: { loja: g.nota.loja, data: g.data, total: g.valor, fonte: g.nota.fonte, url: g.nota.temLink ? 'https://www.fazenda.pr.gov.br/nfce/qrcode' : null, temFoto: g.nota.temFoto, itens } };
    }
    default: return null;
  }
}

/* ---------- A entrada ---------- */

// As respostas dos pedidos novos (ou null, quando o pedido não é destas áreas)
export function atenderAreas(acao: string, d: unknown, e: Estado): Resposta | null {
  if (acao === 'foto' || acao === 'veiculoFoto') return { volta: null }; // as fotos próprias ficam no site (na prévia, os desenhos bastam)
  return contas(acao, d, e) ?? transporte(acao, d, e) ?? casa(acao, d, e);
}

// Os nomes das áreas e das ações do "abrir" que o painel do site de mentira descreve
export const ACOES_AREAS: Record<string, string> = {
  'editar-conta': 'a edição da conta fixa (logo, moeda, código do boleto)', 'ler-boleto': 'Ler boleto',
  veiculo: 'o veículo (modelo, FIPE, foto, documentos)', 'transp-gasto': 'o gasto de transporte',
  'casa-nota': 'Ler a nota do mercado', 'casa-nota-ver': 'a nota do mercado', 'casa-trazer': 'Trazer dos meus gastos',
  'casa-gasto': 'o gasto da casa', 'casa-conta': 'a conta da casa', 'casa-convidar': 'Convidar para a casa',
  'casa-divisao': 'Como vocês dividem', 'casa-pessoas': 'Ajustes da casa', 'casa-listas': 'as listas prontas',
};
