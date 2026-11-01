// App de celular (ponte 2): o que as telas nativas de Contas fixas, Transporte e Nossa casa precisam do site.
// - retratoTransporte e retratoCasa: os blocos "transporte" e "casa" do retrato (o tipo Estado de
//   app-celular/src/lib/motor.ts); as contas fixas vão dentro do "pessoal", em src/App.jsx (retratoNativo).
// - acoesDasAreas(N): os pedidos dessas telas (registrados como uma camada a mais, por cima dos do Painel).
// Este arquivo só carrega dentro do app (src/App.jsx, Painel, com nativoV2): no navegador e no PWA ele nem baixa.
// As regras são as mesmas do site: as funções puras ficam em transporte.js, casa.js e nota.js e o site usa as mesmas.
import { todayISO, uid, pad, CATEGORIAS, servidorAvisos, soma, vencimento, situacaoConta, diffDias, pagarContaP, despagarContaP, limiteDoApp } from "./App.jsx";
import {
  veiculosDe, SUBS, MANUTENCOES, subDe, donoDoGasto, gastosTransporte, estatisticasCombustivel, kmAtual, proximaTrocaOleo, proximoRodizio, docsVeiculo,
  umAnoDepois, custoReal, postos, fotoDoVeiculo, montarGastoTransp, ufDaCidade, precosCombustivel, infoPrecos, precosGuardadosInfo, fipeDoMes,
} from "./transporte.js";
import { pesosDe, partes, saldos, MAX_PESSOAS } from "./casa.js";
import { historico, ultimoPreco, secaoDe, nomeLoja, lerItem, juntarNaLista, precosQueMudaram } from "./nota.js";
import { acharMarca, marcaPorId } from "./marcas.js";
import { ehAvatarPronto } from "./avatares.js";
import { cliente } from "./nuvem.js";
import { enviarEstado } from "./app-nativo.js";

// O que o site atende das telas nativas novas (sem isto no retrato, o app abre essas áreas no site)
export const RECURSOS = ["contas2", "transporte", "casa"];
const centavos = v => Math.round((Number(v) || 0) * 100) / 100;
// chave curta de uma foto grande (muda quando a foto muda): a foto em si só vem quando o app pede (pedido "veiculoFoto"/"foto")
const chaveFoto = f => `${f.length}:${f.slice(-12)}`;
// os n meses ('AAAA-MM') que terminam em ch, do mais antigo ao mais novo
const mesesAte = (ch, n) => { const [a, m] = ch.split("-").map(Number); return Array.from({ length: n }, (_, i) => { const d = new Date(a, m - 1 - (n - 1 - i), 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }); };

/* ---------- Os extras de cada lançamento e de cada conta fixa (dentro do "pessoal" do retrato) ---------- */
// Gasto de transporte: subcategoria e veículo já resolvidos e o que a janela de abastecer guardou; e se está na casa
export function extrasLanc(l, vs) {
  const x = {};
  if (l.cat === "transporte") {
    const t = x.transp = { sub: subDe(l), veiculoId: donoDoGasto(l, vs) };
    if (l.litros > 0) t.litros = l.litros;
    if (l.precoLitro > 0) t.precoLitro = l.precoLitro;
    if (l.combustivel) t.combustivel = l.combustivel;
    if (l.km > 0) t.km = l.km;
    if (l.manut) t.manut = l.manut;
  }
  if (l.casaId) x.casaId = l.casaId;
  return x;
}
// Conta fixa: a situação no mês (o mesmo corte do site), os pagamentos dos últimos 12 meses, o código do boleto,
// a moeda de fora (o valor já vem em reais, com IOF) e, no transporte, de qual veículo
let doze = { ch: "", s: null };
export function extrasConta(c, hoje, vs) {
  const ch = hoje.slice(0, 7), pg = c.pagas || {}, vence = vencimento(c, ch);
  if (doze.ch !== ch) doze = { ch, s: new Set(mesesAte(ch, 12)) };
  return {
    st: situacaoConta(c, ch).st, dias: diffDias(hoje, vence), pagaEm: pg[ch] || null,
    pagas: Object.fromEntries(Object.entries(pg).filter(([k, d]) => doze.s.has(k) && d)),
    codigo: c.codigo || null,
    ...(c.moeda && c.moeda !== "BRL" ? { moeda: c.moeda, valorOrig: c.valorOrig ?? null, iof: c.iof !== false } : {}),
    ...(c.cat === "transporte" ? { transp: { sub: subDe(c), veiculoId: donoDoGasto(c, vs) } } : {}),
  };
}

/* ---------- Transporte ----------
   Veículos com consumo, lembretes, documentos e custo, e os 12 meses de gastos. Os preços da ANP vêm do que está
   guardado no aparelho (o pedido "transportePrecos" busca de novo). Guardado pela versão dos dados: custoReal soma
   12 meses por veículo. */
let memoTransp = null;
export function retratoTransporte(db, hoje, cidade) {
  if (!(memoTransp && memoTransp.P === db.pessoal && memoTransp.hoje === hoje)) {
    const vs = veiculosDe(db), meses = mesesAte(hoje.slice(0, 7), 12);
    const doMes = (k, v) => { const g = gastosTransporte(db, k, v); return { chave: k, total: centavos(g.total), porSub: Object.fromEntries(Object.entries(g.porSub).map(([s, x]) => [s, { total: centavos(x.total), n: x.n }])) }; };
    const lembrete = r => r ? { ate: r.ate, proxKm: r.proxKm, faltamKm: r.faltamKm, faltamDias: r.faltamDias, urgente: !!r.urgente, ultima: { data: r.ultima.data, km: r.ultima.km > 0 ? r.ultima.km : null } } : null;
    const veiculos = vs.map(v => {
      const e = estatisticasCombustivel(db, v), u = e.ultimo, f = fotoDoVeiculo(v);
      const c = v.tipo === "carro" || v.tipo === "moto" ? custoReal(db, v, hoje) : null; // como a aba Transporte (só carro e moto)
      return {
        id: v.id, nome: v.nome || (v.fipe && v.fipe.modelo) || (v.tipo === "nenhum" ? "Apps e transporte público" : "Seu veículo"),
        tipo: ["carro", "moto", "bike", "nenhum"].includes(v.tipo) ? v.tipo : "carro",
        combustivel: v.combustivel || null, desenho: f ? f[2] : null,
        fotoK: typeof v.foto === "string" && v.foto.startsWith("data:") ? chaveFoto(v.foto) : null,
        km: kmAtual(db, v), consumo: e.consumo, consumoReal: e.consumoReal, precoPago: e.precoPago, custoKm: e.custoKm,
        ultimoAbast: u ? { data: u.data, litros: u.litros, precoLitro: u.precoLitro || null, combustivel: u.combustivel || null, km: u.km > 0 ? u.km : null, desc: u.desc || "" } : null,
        fipe: v.fipe && v.fipe.valor ? { valor: String(v.fipe.valor), mes: v.fipe.mes || null, modelo: v.fipe.modelo || "" } : null,
        oleo: lembrete(proximaTrocaOleo(db, v, hoje)), rodizio: lembrete(proximoRodizio(db, v, hoje)),
        oleoKm: v.oleoKm || 10000, oleoMeses: v.oleoMeses || 12,
        docs: docsVeiculo(v, hoje),
        custo: c ? { total: centavos(c.total), porMes: c.porMes, porDia: c.porDia, nMeses: c.nMeses, porKm: c.porKm, rodados: c.rodados, porSub: c.porSub, perdeu: c.perdeu || null } : null,
        appRef: v.appRef && v.appRef.valor > 0 && v.appRef.km > 0 ? { valor: v.appRef.valor, km: v.appRef.km } : null,
        postos: postos(db, v).slice(0, 5).map(({ precos, ...x }) => x),
        ...(vs.length >= 2 ? { meses: meses.map(k => doMes(k, v)) } : {}),
      };
    });
    memoTransp = { P: db.pessoal, hoje, v: { veiculos, meses: meses.map(k => doMes(k, null)) } };
  }
  return { ...memoTransp.v, precos: precosGuardadosInfo(cidade), cidade: cidade || null };
}

/* ---------- Nossa casa ----------
   Os dados vivem em useCasa (nuvem com cópia no aparelho), não no db. Vão os 3 últimos meses de gastos (com a parte
   de cada um já calculada), os saldos de todo o histórico, as contas, a lista de compras e o mercado. Fotos e itens
   das notas ficam de fora (pedidos "foto" e "casaNota"). Guardado pela versão dos itens da casa. */
let memoCasa = null;
export function retratoCasa(C, pix, hoje) {
  if (!C) return null;
  const chave = [C.itens, C.membros, C.estado, C.nuvem, C.casa && C.casa.id, C.casa && C.casa.nome, C.casa && C.casa.dono, pix, hoje];
  if (memoCasa && memoCasa.k.every((x, i) => x === chave[i])) return memoCasa.v;
  const base = { estado: C.estado, nuvem: !!C.nuvem };
  let v;
  if (!C.casa) v = { ...base, casa: null };
  else {
    const ch = hoje.slice(0, 7), seis = mesesAte(ch, 6), desde = mesesAte(ch, 3)[0] + "-01";
    const membros = C.membros, todos = membros.map(m => m.id);
    const { saldo, dividas } = saldos(C.lanc, C.acertos, membros);
    const hist = historico(C.lanc), comNota = C.lanc.filter(l => l.nota && Array.isArray(l.nota.itens));
    const doMes = k => centavos(soma(C.lanc.filter(l => (l.data || "").startsWith(k)), l => Number(l.valor) || 0));
    // o último preço que a casa pagou (pelas notas), vezes a quantidade: o "~R$ 12" de cada item da lista
    const preco = x => { const u = ultimoPreco(hist, x.texto); return u ? { unit: u.unit, total: centavos(u.unit * (x.qtd || 1)), loja: u.loja, data: u.data } : null; };
    const ponto = x => ({ unit: x.unit, loja: x.loja, data: x.data });
    v = { ...base, casa: {
      id: C.casa.id, nome: C.casa.nome, dono: C.casa.dono, eu: C.eu, souDono: C.casa.dono === C.eu, max: MAX_PESSOAS,
      membros: membros.map(m => ({ id: m.id, nome: m.nome || "", papel: m.papel === "dono" ? "dono" : "membro",
        foto: ehAvatarPronto(m.foto) ? m.foto : null, fotoK: m.foto && !ehAvatarPronto(m.foto) ? chaveFoto(m.foto) : null })),
      divisao: { modo: C.config.modo === "proporcional" ? "proporcional" : "igual", pcts: C.config.pcts || null },
      saldo: Object.fromEntries(Object.entries(saldo).map(([k, x]) => [k, centavos(x)])), dividas,
      gastos: C.lanc.filter(l => (l.data || "") >= desde).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0)).map(l => ({
        id: l.id, valor: Number(l.valor) || 0, desc: l.desc || "", cat: l.cat || "casa", data: l.data, criado: l.criado || null,
        pagou: l.pagou, autor: l.autor || null,
        participantes: l.participantes && l.participantes.length ? l.participantes : todos,
        partes: Object.fromEntries(Object.entries(partes(l, membros)).map(([k, x]) => [k, centavos(x)])),
        proporcional: !!l.pesos, contaId: l.contaId || null, origem: l.origem || null,
        nota: l.nota ? { loja: nomeLoja(l.nota.loja) || l.desc || "", itens: Array.isArray(l.nota.itens) ? l.nota.itens.length : 0, fonte: l.nota.fonte || null, temFoto: !!l.nota.foto, temLink: !!l.nota.url } : null,
      })),
      meses: seis.map(k => ({ chave: k, total: doMes(k) })),
      acertos: [...C.acertos].sort((a, b) => (b.criado || 0) - (a.criado || 0)).slice(0, 10).map(a => ({ id: a.id, de: a.de, para: a.para, valor: Number(a.valor) || 0, data: a.data, criado: a.criado || null })),
      contas: [...C.contas].sort((a, b) => a.dia - b.dia).map(c => {
        const p = C.lanc.find(l => l.contaId === c.id && l.mes === ch);
        return { id: c.id, nome: c.nome, valor: Number(c.valor) || 0, dia: c.dia, cat: c.cat || "casa", paga: p ? { por: p.pagou, data: p.data, gastoId: p.id } : null };
      }),
      compras: C.compras.map(x => ({ id: x.id, texto: x.texto, qtd: x.qtd || 1, obs: x.obs || null, secao: x.secao || secaoDe(x.texto),
        feito: !!x.feito, por: x.por || null, autor: x.autor || null, criado: x.criado || null, preco: x.feito ? null : preco(x) })),
      listaLimite: Number(C.listaCfg.limite) > 0 ? Number(C.listaCfg.limite) : null,
      modelos: C.modelos.map(m => ({ id: m.id, nome: m.nome, itens: (m.itens || []).map(i => ({ texto: i.texto, qtd: i.qtd || 1, ...(i.obs ? { obs: i.obs } : {}) })) })),
      // como o "Mercado da casa" do site: só aparece quando há nota guardada
      mercado: !comNota.length ? null : {
        mes: centavos(soma(C.lanc.filter(l => (l.data || "").startsWith(ch) && (l.cat === "mercado" || l.nota)), l => Number(l.valor) || 0)), notas: comNota.length,
        mudou: precosQueMudaram(hist, 5).map(x => ({ nome: x.nome, de: ponto(x.de), para: ponto(x.para), pct: x.pct })),
      },
      pix: pix || null,
    } };
  }
  memoCasa = { k: chave, v };
  return v;
}

/* ---------- Os pedidos das telas nativas ----------
   N() é o Painel do último desenho (src/App.jsx, nat.current): db, setP, act (com act.casa = useCasa), perfil...
   Regras de todos:
   - nada de aviso, vibração ou folha no site (quem vibra e mostra o "Desfazer" é a tela nativa);
   - o que cria algo aceita o id mandado pelo app (repetir o pedido depois de "tempo esgotado" não duplica) e o que
     liga ou desliga recebe o valor final;
   - "não deu" volta como { ok: false, erro, texto }, com o texto pronto e neutro (nada de preço nem de assinar). */
export function acoesDasAreas(N) {
  const falha = (erro, texto, extra) => ({ ok: false, erro, texto, ...extra });
  const semPessoal = () => falha("pessoal", "Para isso, ligue o Pessoal em Perfil → Como você usa o app.");
  const semCasa = extra => falha("sem-casa", "Você ainda não está numa casa.", extra);
  const valorOk = v => Number(v) > 0 && Number(v) < 1e7;
  const dataOk = d => typeof d === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d);
  const mesOk = m => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const idOk = id => typeof id === "string" && id.length > 0 && id.length <= 64;
  const texto80 = t => String(t == null ? "" : t).trim().slice(0, 80);
  const qtdOk = q => Math.min(99, Math.max(1, Math.round(Number(q)) || 1));
  const casaViva = () => { const n = N(), C = n.act.casa; return n.usaPessoal && C && C.casa ? C : null; };
  // grava na casa sem esperar a nuvem: a cópia no aparelho muda na hora e, sem internet, o item vai para a fila
  const naCasa = (C, colecao, item) => { C.salvar(colecao, item).catch(() => {}); return item; };
  const daCasaFora = (C, colecao, id) => { C.apagar(colecao, id).catch(() => {}); };
  const fotoDoVeiculoId = id => { const v = veiculosDe(N().db).find(x => x.id === id); return v && typeof v.foto === "string" && v.foto.startsWith("data:") ? v.foto : null; };

  const acoes = {
    /* ----- Contas fixas (pessoal.contas; sincronizam pela nuvem do db) ----- */
    // contaPagar { id, mes?, data? }: marca o mês (padrão: o de agora) como pago. Repetir dá o mesmo: já paga e
    // sem data nova, fica a data que estava. Mês que ainda não chegou, não
    contaPagar: ({ id, mes, data } = {}) => {
      const n = N(); if (!n.usaPessoal) return semPessoal();
      const c = n.db.pessoal.contas.find(x => x.id === id);
      if (!c) return falha("nao-achei", "Não achei essa conta. Ela pode ter sido apagada em outro aparelho.");
      const agora = todayISO().slice(0, 7), m = mesOk(mes) ? mes : agora;
      if (m > agora) return falha("mes", "Esse mês ainda não chegou.");
      const d = dataOk(data) ? data : (c.pagas && c.pagas[m]) || todayISO();
      n.setP(P => pagarContaP(P, id, m, d));
      return { ok: true, mes: m, data: d };
    },
    // contaDesfazer { id, mes? }: volta para "a pagar" (ok = a conta existe; se já estava a pagar, também é ok)
    contaDesfazer: ({ id, mes } = {}) => {
      const n = N(), c = n.usaPessoal && n.db.pessoal.contas.find(x => x.id === id);
      if (!c) return { ok: false };
      const m = mesOk(mes) ? mes : todayISO().slice(0, 7);
      if (c.pagas && c.pagas[m]) n.setP(P => despagarContaP(P, id, m));
      return { ok: true };
    },
    // contaSalvar { id?, nome, valor, dia, cat?, assinatura?, marca? }: cria ou muda. O resto da conta continua (pagas,
    // código do boleto, moeda). Conta em moeda de fora não muda o valor por aqui (o câmbio do dia reescreveria):
    // responde erro "moeda" e o app abre a conta no site
    contaSalvar: (d = {}) => {
      const n = N(); if (!n.usaPessoal) return semPessoal();
      const nome = String(d.nome || "").trim().slice(0, 60);
      if (!nome) return falha("nome", "Coloque o nome da conta.");
      if (!valorOk(d.valor)) return falha("valor", "Coloque um valor maior que zero.");
      const dia = Math.round(Number(d.dia));
      if (!(dia >= 1 && dia <= 31)) return falha("dia", "O dia do vencimento vai de 1 a 31.");
      const antes = idOk(d.id) ? n.db.pessoal.contas.find(c => c.id === d.id) : null;
      const valor = centavos(d.valor);
      if (antes && antes.moeda && antes.moeda !== "BRL" && Math.abs(valor - (Number(antes.valor) || 0)) >= 0.01)
        return falha("moeda", "Essa conta é cobrada em outra moeda: o valor muda no Avina, com a cotação do dia.");
      const cat = CATEGORIAS.some(c => c.id === d.cat) ? d.cat : d.cat === undefined && antes ? antes.cat : "casa";
      const conta = { ...(antes || { pagas: {} }), id: antes ? antes.id : idOk(d.id) ? d.id : uid(), nome, valor, dia, cat,
        assinatura: d.assinatura === undefined ? !!(antes && antes.assinatura) : !!d.assinatura };
      // a logo, como no "lancar": a marca mandada (se existe), senão a achada pelo nome. Sem marca nova e com o mesmo
      // nome, fica a de antes (inclusive a foto escolhida à mão ou o "sem logo")
      if (!antes || d.marca !== undefined || antes.nome !== nome) {
        conta.marca = d.marca && marcaPorId(d.marca) ? d.marca : (acharMarca(nome) || {}).id || null;
        if (antes && (antes.marca !== conta.marca || antes.nome !== nome)) { delete conta.logoSite; delete conta.semLogo; }
      }
      n.setP(P => ({ ...P, contas: P.contas.some(x => x.id === conta.id) ? P.contas.map(x => x.id === conta.id ? conta : x) : [...P.contas, conta] }));
      return { ok: true, id: conta.id };
    },
    // contaApagar { id }: a confirmação é do app (sem desfazer: o histórico de pagamentos vai junto)
    contaApagar: ({ id } = {}) => {
      const n = N(), tinha = !!n.usaPessoal && !!id && n.db.pessoal.contas.some(c => c.id === id);
      if (tinha) n.setP(P => ({ ...P, contas: P.contas.filter(x => x.id !== id) }));
      return { ok: tinha };
    },

    /* ----- Transporte (veículos em pessoal.veiculos, gastos em pessoal.lanc) ----- */
    // transporteGasto { id?, veiculoId?, sub, valor, data?, desc?, litros?, precoLitro?, combustivel?, km?, manut? }:
    // monta igual à janela de abastecer do site (montarGastoTransp). Ao editar, o que não vier fica como estava.
    // Lançamento novo passa pelo limite do plano grátis
    transporteGasto: (d = {}) => {
      const n = N(); if (!n.usaPessoal) return semPessoal();
      if (!valorOk(d.valor)) return falha("valor", "Coloque um valor maior que zero.");
      const vs = veiculosDe(n.db), antes = idOk(d.id) ? n.db.pessoal.lanc.find(l => l.id === d.id) : null;
      if (antes && antes.cat !== "transporte") return falha("nao-achei", "Esse lançamento não é de transporte.");
      const lim = !antes && limiteDoApp(n, 1); if (lim) return lim;
      if (idOk(d.veiculoId) && !vs.some(v => v.id === d.veiculoId)) return falha("veiculo", "Não achei esse veículo. Ele pode ter sido tirado em outro aparelho.");
      // de qual veículo: o pedido, senão o do gasto, senão o primeiro com motor (como a janela do site)
      const vid = idOk(d.veiculoId) ? d.veiculoId : antes && vs.some(v => v.id === antes.veiculoId) ? antes.veiculoId : (vs.find(v => v.tipo !== "nenhum") || vs[0] || {}).id || null;
      const veic = vs.find(v => v.id === vid);
      const ABAST = ["gasolina", "etanol", "diesel", "gnv"], pos = x => (Number(x) > 0 ? Number(x) : 0);
      const de = k => pos(d[k] !== undefined ? d[k] : antes ? antes[k] : 0);
      const l0 = montarGastoTransp({
        id: antes ? antes.id : idOk(d.id) ? d.id : uid(), veiculoId: vid,
        sub: SUBS.some(x => x.id === d.sub) ? d.sub : antes ? subDe(antes) : "outros",
        valor: centavos(d.valor), data: dataOk(d.data) ? d.data : antes ? antes.data : todayISO(),
        desc: d.desc !== undefined ? texto80(d.desc) : antes ? antes.desc || "" : "",
        litros: de("litros"), precoLitro: de("precoLitro"), km: de("km"),
        combustivel: ABAST.includes(d.combustivel) ? d.combustivel : antes && antes.combustivel ? antes.combustivel : veic && ABAST.includes(veic.combustivel) ? veic.combustivel : "gasolina",
        manut: MANUTENCOES.some(m => m[0] === d.manut) ? d.manut : antes && antes.manut ? antes.manut : "revisao",
      }, antes);
      // a marca, como o "Salvar" do site: a que o lançamento já tinha, senão a achada pela descrição
      const l = { ...l0, marca: l0.marca !== undefined ? l0.marca : (acharMarca(l0.desc || "") || {}).id || null };
      n.setP(P => ({ ...P, lanc: P.lanc.some(x => x.id === l.id) ? P.lanc.map(x => x.id === l.id ? l : x) : [...P.lanc, l] }));
      return { ok: true, id: l.id };
    },
    // veiculoAtualizar { id, km?, consumo?, appRef? }: só isso muda por aqui (o resto do veículo é no site: "abrir" veiculo)
    veiculoAtualizar: ({ id, ...d } = {}) => {
      const n = N(); if (!n.usaPessoal || !veiculosDe(n.db).some(v => v.id === id)) return { ok: false };
      const mud = {};
      if ("km" in d) mud.km = Number(d.km) > 0 ? Math.round(Number(d.km)) : null;
      if ("consumo" in d) mud.consumo = Number(d.consumo) > 0 && Number(d.consumo) < 100 ? Number(d.consumo) : null;
      if ("appRef" in d) mud.appRef = d.appRef && Number(d.appRef.valor) > 0 && Number(d.appRef.km) > 0 ? { valor: centavos(d.appRef.valor), km: Number(d.appRef.km) } : null;
      if (Object.keys(mud).length) n.act.atualizarVeiculo(id, mud);
      return { ok: true };
    },
    // veiculoDocPagar { veiculoId (ou id), k: ipva | licenc | seguro, valor?, lancId? }: o "Paguei" do IPVA, do
    // licenciamento ou do seguro: anota o gasto e passa a data para o ano seguinte. Precisa de valor (o do documento ou
    // o mandado; o site aceita R$ 0, aqui não). lancId (do app) faz o pedido repetido não pagar duas vezes
    veiculoDocPagar: ({ veiculoId, id, k, valor, lancId } = {}) => {
      const n = N(); if (!n.usaPessoal) return semPessoal();
      const v = veiculosDe(n.db).find(x => x.id === (veiculoId || id));
      if (!v) return falha("veiculo", "Não achei esse veículo. Ele pode ter sido tirado em outro aparelho.");
      if (idOk(lancId) && n.db.pessoal.lanc.some(l => l.id === lancId)) return { ok: true, lancId, proxima: ((v.docs || {})[k] || {}).data || null };
      const hoje = todayISO(), doc = docsVeiculo(v, hoje).find(x => x.k === k);
      if (!doc) return falha("doc", "Esse documento não tem data marcada no veículo.");
      const val = valorOk(valor) ? centavos(valor) : doc.valor > 0 ? doc.valor : 0;
      if (!val) return falha("valor", "Coloque quanto foi pago.");
      const lim = limiteDoApp(n, 1); if (lim) return lim;
      const desc = `${doc.nome} ${doc.data.slice(0, 4)}`, proxima = umAnoDepois(doc.data);
      const l = { id: idOk(lancId) ? lancId : uid(), veiculoId: v.id, tipo: "saida", cat: "transporte", sub: "documentos", valor: val, data: hoje, desc, marca: (acharMarca(desc) || {}).id || null };
      // o gasto e a data nova numa mudança só (a lista de veículos vai para pessoal.veiculos, como o resto do site)
      n.setP(P => { const { veiculo, ...resto } = P; return { ...resto, lanc: [...P.lanc, l], veiculos: veiculosDe({ pessoal: P }).map(x => x.id === v.id ? { ...x, docs: { ...(x.docs || {}), [k]: { ...(x.docs || {})[k], data: proxima } } } : x) }; });
      return { ok: true, lancId: l.id, proxima };
    },
    // transportePrecos { forcar? }: preço médio da semana (ANP) na cidade do perfil; sem internet, o guardado (velho).
    // No fim manda o retrato de novo (os preços ficam no aparelho, fora do db, e o retrato não sabe quando mudam).
    // De carona, a FIPE do mês dos veículos (no site isso acontece quando a aba Transporte abre)
    transportePrecos: async ({ forcar } = {}) => {
      const n = N(), cidade = n.perfil && n.perfil.cidade;
      if (!cidade) return { erro: "sem-cidade" };
      const mes = todayISO().slice(0, 7);
      veiculosDe(n.db).forEach(v => { fipeDoMes(v, mes).then(mud => { if (mud) N().act.atualizarVeiculo(v.id, mud); }).catch(() => {}); });
      let r;
      try { r = infoPrecos(await precosCombustivel(servidorAvisos(), await ufDaCidade(cidade), cidade, !!forcar), cidade); }
      catch (e) {
        const g = precosGuardadosInfo(cidade);
        if (!g) return { erro: !servidorAvisos() || /sem-servidor/.test(String(e && e.message)) ? "sem-servidor" : "sem-internet" };
        r = { ...g, velho: true };
      }
      enviarEstado(() => N().retrato());
      return r;
    },
    // a foto própria do veículo (data URL); o retrato só leva a chave dela (fotoK)
    veiculoFoto: ({ id } = {}) => fotoDoVeiculoId(id),
    // foto { de: veiculo | membro, id }: o mesmo, e também a foto de quem mora na casa
    foto: ({ de, id } = {}) => {
      if (de !== "membro") return fotoDoVeiculoId(id);
      const C = N().act.casa, m = C && C.membros.find(x => x.id === id);
      return (m && m.foto) || null;
    },

    /* ----- Nossa casa (useCasa: nuvem com cópia no aparelho e fila; sem login, a casa de demonstração do db) ----- */
    // casaGasto { id?, valor, desc?, cat?, data?, pagou?, participantes? }: como a janela "Anotar gasto da casa".
    // A casa não tem limite de plano. Mudar a cópia da casa não muda o lançamento pessoal de onde ela veio
    casaGasto: (d = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      if (!valorOk(d.valor)) return falha("valor", "Coloque um valor maior que zero.");
      const antes = idOk(d.id) ? C.lanc.find(l => l.id === d.id) : null;
      // quem já estava no gasto (mesmo tendo saído da casa) continua valendo, como na janela do site
      const vale = new Set([...C.membros.map(m => m.id), ...((antes && antes.participantes) || []), ...(antes ? [antes.pagou] : [])]);
      const pagou = d.pagou || (antes ? antes.pagou : C.eu);
      if (!vale.has(pagou)) return falha("pagou", "Quem pagou não está na casa.");
      const parts = Array.isArray(d.participantes) ? [...new Set(d.participantes)] : antes && antes.participantes && antes.participantes.length ? antes.participantes : C.membros.map(m => m.id);
      if (!parts.length || parts.some(p => !vale.has(p))) return falha("participantes", "Escolha entre quem dividir (só quem está na casa).");
      // pesos: os do próprio gasto (se os participantes não mudaram) ou os da casa
      const mesmos = antes && antes.participantes && antes.participantes.length === parts.length && antes.participantes.every(p => parts.includes(p));
      const it = naCasa(C, "lanc", {
        ...(antes || {}), id: antes ? antes.id : idOk(d.id) ? d.id : uid(), valor: centavos(d.valor),
        desc: d.desc !== undefined ? texto80(d.desc) : antes ? antes.desc || "" : "",
        cat: CATEGORIAS.some(c => c.id === d.cat) ? d.cat : antes ? antes.cat || "casa" : "mercado",
        pagou, participantes: parts, pesos: mesmos && antes.pesos ? antes.pesos : pesosDe(C.config, parts),
        data: dataOk(d.data) ? d.data : antes ? antes.data : todayISO(), criado: antes ? antes.criado : Date.now(), autor: (antes && antes.autor) || C.eu,
      });
      return { ok: true, id: it.id };
    },
    // casaGastoApagar { id }: some para todos da casa; o lançamento pessoal de onde veio (se veio) continua
    casaGastoApagar: ({ id } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const tinha = C.lanc.some(l => l.id === id);
      if (tinha) { daCasaFora(C, "lanc", id); N().act.desligarDaCasa(id); }
      return { ok: tinha };
    },
    // casaAcertar { id?, de, para, valor }: "Já paguei" / "Recebi" (o app manda a dívida que aparece em dividas)
    casaAcertar: ({ id, de, para, valor } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const ids = new Set(C.membros.map(m => m.id));
      if (!ids.has(de) || !ids.has(para) || de === para) return falha("pessoas", "Escolha duas pessoas da casa.");
      if (!valorOk(valor)) return falha("valor", "Coloque um valor maior que zero.");
      if (idOk(id) && C.acertos.some(a => a.id === id)) return { ok: true, id };
      const it = naCasa(C, "acerto", { id: idOk(id) ? id : uid(), de, para, valor: centavos(valor), data: todayISO(), criado: Date.now(), autor: C.eu });
      return { ok: true, id: it.id };
    },
    // casaAcertoApagar { id }: o Desfazer do acerto
    casaAcertoApagar: ({ id } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const tinha = C.acertos.some(a => a.id === id);
      if (tinha) daCasaFora(C, "acerto", id);
      return { ok: tinha };
    },
    // casaContaPagar { id, gastoId? }: o "Paguei" de uma conta da casa vira um gasto dividido entre todos.
    // Já paga este mês: erro "ja-paga" (o mesmo pedido de novo, com o mesmo gastoId, responde ok)
    casaContaPagar: ({ id, gastoId } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const c = C.contas.find(x => x.id === id);
      if (!c) return falha("nao-achei", "Não achei essa conta da casa.");
      const ch = todayISO().slice(0, 7), ja = C.lanc.find(l => l.contaId === c.id && l.mes === ch);
      if (ja) return idOk(gastoId) && ja.id === gastoId ? { ok: true, gastoId } : falha("ja-paga", `${c.nome} já foi paga este mês.`);
      const parts = C.membros.map(m => m.id);
      const it = naCasa(C, "lanc", { id: idOk(gastoId) ? gastoId : uid(), valor: c.valor, desc: c.nome, cat: c.cat || "casa", data: todayISO(), pagou: C.eu, participantes: parts, pesos: pesosDe(C.config, parts), contaId: c.id, mes: ch, criado: Date.now(), autor: C.eu });
      return { ok: true, gastoId: it.id };
    },
    // casaConta { id?, nome, valor, dia, cat? }: cria ou muda uma conta da casa
    casaConta: (d = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const nome = String(d.nome || "").trim().slice(0, 60);
      if (!nome) return falha("nome", "Coloque o nome da conta.");
      if (!valorOk(d.valor)) return falha("valor", "Coloque um valor maior que zero.");
      const dia = Math.round(Number(d.dia));
      if (!(dia >= 1 && dia <= 31)) return falha("dia", "O dia do vencimento vai de 1 a 31.");
      const antes = idOk(d.id) ? C.contas.find(x => x.id === d.id) : null;
      const it = naCasa(C, "conta", { ...(antes || {}), id: antes ? antes.id : idOk(d.id) ? d.id : uid(), nome, valor: centavos(d.valor), dia,
        cat: CATEGORIAS.some(c => c.id === d.cat) ? d.cat : antes ? antes.cat || "casa" : "casa", autor: (antes && antes.autor) || C.eu });
      return { ok: true, id: it.id };
    },
    // casaContaApagar { id }: os pagamentos já anotados continuam
    casaContaApagar: ({ id } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const tinha = C.contas.some(c => c.id === id);
      if (tinha) daCasaFora(C, "conta", id);
      return { ok: tinha };
    },
    // casaListaAdicionar { texto? ("2 leite, pão; café"), itens?, somar? }: o que já está na lista não repete
    // (soma a quantidade; somar: false é o "usar uma lista pronta"). Devolve quantos entraram e os que já estavam
    casaListaAdicionar: ({ texto, itens, somar } = {}) => {
      const C = casaViva(); if (!C) return semCasa({ novos: 0, ja: [] });
      const doTexto = typeof texto === "string" ? texto.split(/[,;\n]+/).map(t => lerItem(t.trim())) : [];
      const novos = [...doTexto, ...(Array.isArray(itens) ? itens : [])].slice(0, 100)
        .map(x => ({ texto: texto80(x && x.texto), qtd: qtdOk(x && x.qtd), ...(x && texto80(x.obs) ? { obs: texto80(x.obs) } : {}) }))
        .filter(x => x.texto);
      const r = juntarNaLista(C.compras, novos, { somar: somar !== false, eu: C.eu });
      r.salvar.forEach(x => naCasa(C, "compra", x));
      return { novos: r.novos, ja: r.ja.map(x => ({ id: x.id, texto: x.texto, qtd: x.qtd || 1 })) };
    },
    // casaLista { id, feito?, texto?, qtd?, obs? }: marcar (o valor final, não "inverter") e mudar o item
    // (quantidade de 1 a 99; texto e observação até 80 letras; o corredor muda junto com o texto)
    casaLista: ({ id, feito, texto, qtd, obs } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const x = C.compras.find(y => y.id === id); if (!x) return { ok: false };
      const it = { ...x };
      if (typeof feito === "boolean") { it.feito = feito; it.por = C.eu; }
      const t = texto80(texto);
      if (typeof texto === "string" && t && t !== x.texto) { it.texto = t; it.secao = secaoDe(t); }
      else if (!it.secao) it.secao = secaoDe(it.texto);
      if (qtd !== undefined && qtd !== null) it.qtd = qtdOk(qtd);
      if (obs !== undefined) { const o = texto80(obs); if (o) it.obs = o; else delete it.obs; }
      naCasa(C, "compra", it);
      return { ok: true };
    },
    // casaListaTirar { ids }: tira da lista e devolve os itens como estavam (para o Desfazer)
    casaListaTirar: ({ ids } = {}) => {
      const C = casaViva(); if (!C) return semCasa({ itens: [] });
      const s = new Set(Array.isArray(ids) ? ids : []), tirados = C.compras.filter(x => s.has(x.id));
      tirados.forEach(x => daCasaFora(C, "compra", x.id));
      return { ok: tirados.length > 0, itens: tirados };
    },
    // casaListaRestaurar { itens }: o Desfazer do "tirar" (os itens voltam como eram)
    casaListaRestaurar: ({ itens } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      const lista = (Array.isArray(itens) ? itens : []).slice(0, 200).filter(x => x && idOk(x.id) && typeof x.texto === "string" && x.texto.trim());
      lista.forEach(x => naCasa(C, "compra", x));
      return { ok: lista.length > 0 };
    },
    // casaListaLimite { limite }: quanto a lista pode gastar (null ou 0: sem limite)
    casaListaLimite: ({ limite } = {}) => {
      const C = casaViva(); if (!C) return semCasa();
      naCasa(C, "config", { ...C.listaCfg, id: "lista", limite: valorOk(limite) ? centavos(limite) : 0 });
      return { ok: true };
    },
    // casaAvisarMercado: o "Estou no mercado" avisa quem mora junto (precisa da nuvem, de internet e de mais alguém)
    casaAvisarMercado: async () => {
      const C = casaViva(); if (!C) return semCasa();
      if (!C.nuvem || C.membros.length < 2) return falha("sozinho", "Para avisar, a casa precisa ter mais alguém.");
      try {
        const { data } = await (await cliente()).auth.getSession(); if (!data.session) throw new Error("sem login");
        const r = await fetch(`${servidorAvisos()}/casa/mercado`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: "{}" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.erro || "HTTP " + r.status);
        return { ok: true, enviados: Number(j.enviados) || 0, recente: !!j.recente };
      } catch (e) { return falha("sem-internet", "Não consegui avisar agora. Confira a internet."); }
    },
    // casaTrazer { ids, dividir }: leva gastos pessoais para a casa (dividindo entre todos ou só mostrando).
    // Os que já foram (casaId) não vão de novo: repetir o pedido não duplica
    casaTrazer: async ({ ids, dividir } = {}) => {
      const n = N(); if (!n.usaPessoal) return semPessoal();
      if (!casaViva()) return semCasa();
      const k = await n.act.levarParaCasa((Array.isArray(ids) ? ids : []).filter(idOk), dividir !== false);
      return { ok: true, n: k || 0 };
    },
    // casaNota { id }: os itens da nota de um gasto da casa (a foto, quando há, abre no site: "abrir" casa-nota-ver)
    casaNota: ({ id } = {}) => {
      const C = casaViva(), l = C && C.lanc.find(x => x.id === id);
      if (!l || !l.nota) return null;
      const nt = l.nota;
      return {
        loja: nomeLoja(nt.loja) || l.desc || "", data: l.data, total: Number(l.valor) || 0, fonte: nt.fonte || null, url: nt.url || null, temFoto: !!nt.foto,
        itens: (Array.isArray(nt.itens) ? nt.itens : []).map(x => ({ nome: String(x.nome || ""), qtd: Number(x.qtd) || 1, un: x.un || null, unit: Number(x.unit) || 0, valor: Number(x.valor) || 0 })),
      };
    },
  };
  // os mesmos pedidos com os nomes do primeiro desenho do contrato (o app pode chamar por qualquer um dos dois)
  acoes.transporteVeiculo = acoes.veiculoAtualizar;
  acoes.transporteDocPago = acoes.veiculoDocPagar;
  return acoes;
}
