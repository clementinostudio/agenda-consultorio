// App de celular (ponte 2): o que as telas nativas de Consultório e Loja precisam do site.
// - retratoConsultorio e retratoLoja: os campos novos do "consultorio" e o bloco "loja" do retrato (o tipo Estado de
//   app-celular/src/lib/motor.ts).
// - acoesDoTrabalho(N): os pedidos dessas telas (registrados como uma camada a mais, por cima dos do Painel).
// - abrirTrabalho: as folhas do site que o pedido "abrir" abre para essas áreas (ficha completa, anotações, recibo...).
// Este arquivo só carrega dentro do app (src/App.jsx, Painel, com nativoV2): no navegador e no PWA ele nem baixa.
// As regras são as do site (registrar, desfazer, mensagem... em App.jsx; as contas da loja em loja-contas.js).
// Saúde mental: o retrato fica guardado no aparelho, então leva só o necessário para a agenda e o dinheiro. Nunca vão
// telefone (só "temFone"; o número vem na hora, nos pedidos que mandam mensagem), CPF, quem paga, anotações (trancadas,
// só no site), a observação da lista de espera nem o histórico completo de cada paciente (vem por "pacienteFicha").
import {
  todayISO, addDays, uid, pad, soma, primeiro, corDe, CORES, liquido, sublocacao, contaDinheiro, itensDoDia, situacao,
  feriado, horariosLivres, periodoDe, hhmm, liquidoMes, segunda, diffDias, registrar, desfazer, mensagem, cobrancasDoPix,
  reajusteDe, INTERVALO_MIN, limitePacApp, csvDoMes, TERMO, DIA_LONGO, dm, servidorAvisos, fromISO,
} from "./App.jsx";
import { linkDo, enderecoLink, recadoDoPedido } from "./link.js";
import { LIMITE_GRATIS } from "./plano.js";
import { PAGAMENTOS, CATS_LOJA, CORES_PRODUTO, PRODUTOS_SUGERIDOS, totaisDia, gaveta, vendasPorHora, resumoDoPeriodo, lojaTravada, avisoEquipeApp, pixCopiaECola } from "./loja-contas.js";
import { MAX_AJUDANTES } from "./loja.js";
import { lerItem, lerTextoNota, lerPaginaNfce, arrumarNotaIA, reduzirFoto, ufDaChave, cnpjDaChave, nomeLoja, combina } from "./nota.js";
import { buscarCnpj } from "./cnpj.js";
import { gradeDo, periodosDo, resumoGrade, PERIODOS, MODELOS } from "./horarios.js";
import { permitirIA } from "./app-nativo.js";
import { ehAvatarPronto } from "./avatares.js";
import { qrSvg } from "./qr.js";

// O que o site atende das telas nativas novas (sem isto no retrato, o app abre essas áreas no site)
export const RECURSOS = ["consultorio2", "loja2"];
const centavos = v => Math.round((Number(v) || 0) * 100) / 100;
const chaveFoto = f => `${f.length}:${f.slice(-12)}`; // muda quando a foto muda (a foto em si vem pelo pedido "lojaFoto")
const ultimoDia = ch => { const [a, m] = ch.split("-").map(Number); return `${ch}-${pad(new Date(a, m, 0).getDate())}`; };
const mesAntes = (ch, n = 1) => { const [a, m] = ch.split("-").map(Number); const d = new Date(a, m - 1 - n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const horaAgora = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// o WhatsApp do jeito que o wa.me espera ('55' + DDD + número), como na cobrança do site; null sem número
const foneWa = ph => { const d = String(ph || "").replace(/\D/g, ""); const f = d.length >= 10 && d.length <= 11 ? "55" + d : d; return f.length >= 12 ? f : null; };
const PREFS = ["manhã", "tarde", "noite", "qualquer"];

/* ---------- Consultório ---------- */
// Uma cobrança do jeito do app: as datas das sessões (em ordem) e quantas são faltas cobradas
function cobrancaApp(c, sessaoPorId) {
  const ss = (c.sessionIds || []).map(id => sessaoPorId.get(id)).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  return {
    id: c.id, pid: c.patientId, valor: centavos(c.amount), criada: c.createdAt, datas: ss.map(s => s.date),
    faltas: ss.filter(s => s.status === "missed").length, paga: !!c.paid, pagaEm: c.paidAt || null, recibo: c.reciboEm || null,
  };
}
// Lista de espera x agenda: o primeiro horário livre (livres: horariosLivres) no período que a pessoa prefere, como a
// conversa do Início do site faz com a primeira da lista
export function combinaEspera(e, livres) {
  for (const d of livres) {
    const m = d.livres.find(x => !e.pref || e.pref === "qualquer" || periodoDe(x) === e.pref);
    if (m !== undefined) return { data: d.iso, hora: hhmm(m) };
  }
  return null;
}
// Os números de um mês (o líquido é o mesmo do site: atendidas + faltas cobradas − sublocação)
function mesConsultorio(db, ch) {
  const ss = db.sessions.filter(s => s.date.startsWith(ch)), feitas = ss.filter(s => s.status === "done");
  return {
    chave: ch, liquido: centavos(liquidoMes(db, ch)),
    bruto: centavos(soma(feitas, s => s.price)), sublocacao: centavos(soma(feitas, s => s.sublet)),
    recebido: centavos(soma(db.charges.filter(c => c.paid && !c.hidden && c.paidAt && c.paidAt.startsWith(ch)), c => c.amount)),
    sessoes: feitas.length, faltas: ss.filter(s => s.status === "missed").length,
  };
}
// O líquido acumulado dia a dia de um mês, até o dia "ate" (a linha do gráfico das Finanças)
function serieDoMes(db, ch, ate) {
  const porDia = {};
  db.sessions.forEach(s => { if (contaDinheiro(s) && s.date.startsWith(ch)) porDia[s.date] = (porDia[s.date] || 0) + s.price - s.sublet; });
  const out = []; let acc = 0;
  for (let d = `${ch}-01`; d <= ate; d = addDays(d, 1)) { acc = centavos(acc + (porDia[d] || 0)); out.push(acc); }
  return out;
}

// Guardado pela versão dos dados (e de 5 em 5 minutos: a situação "próxima" vira "faltou marcar" com o relógio)
let memoCons = null;
export function retratoConsultorio(db, perfil, linkAg, libera, hoje) {
  const pf = perfil || {};
  const chave = [db.patients, db.sessions, db.charges, db.pedidos, db.espera, db.confirmados, db.settings, pf, hoje,
    linkAg && linkAg.pode, linkAg && linkAg.endereco, libera ? !!libera.consultorio : null, Math.floor(Date.now() / 3e5)];
  if (memoCons && memoCons.k.every((x, i) => x === chave[i])) return memoCons.v;
  const agora = new Date(), ch = hoje.slice(0, 7), chAnt = mesAntes(ch);
  const sessaoPorId = new Map(db.sessions.map(s => [s.id, s]));
  const cobPorId = new Map(db.charges.map(c => [c.id, c]));
  // num passe só: as sessões que ainda não viraram cobrança (pacote) e a última data de cada paciente
  const soltas = {}, ultimaData = {};
  db.sessions.forEach(s => {
    if (contaDinheiro(s) && !s.chargeId) soltas[s.patientId] = (soltas[s.patientId] || 0) + 1;
    if (!ultimaData[s.patientId] || s.date > ultimaData[s.patientId]) ultimaData[s.patientId] = s.date;
  });
  const abertas = db.charges.filter(c => !c.paid && !c.hidden);
  const abertoDe = {};
  abertas.forEach(c => {
    const x = abertoDe[c.patientId] || (abertoDe[c.patientId] = { n: 0, total: 0, desde: c.createdAt });
    x.n++; x.total = centavos(x.total + (Number(c.amount) || 0)); if (c.createdAt < x.desde) x.desde = c.createdAt;
  });
  const regPendente = pf.registro !== false, conf = db.confirmados || {};

  // a agenda: da segunda da semana passada ao domingo da 3ª semana à frente (35 dias)
  const de = addDays(segunda(hoje), -7), ate = addDays(de, 34);
  const itens = [], feriados = [], naAgenda = new Set();
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    const f = feriado(d);
    if (f) feriados.push({ d, nome: f.name, facultativo: !!f.fac });
    itensDoDia(db, d).forEach(i => {
      const p = i.patient, log = i.kind === "log", s = i.session;
      naAgenda.add(p.id);
      const it = {
        k: log ? s.id : `${p.id}|${i.date}`, data: i.date, hora: i.time, pid: p.id, tipo: i.kind, st: situacao(i, agora),
        sid: log ? s.id : null, valor: log ? (contaDinheiro(s) ? centavos(s.price - s.sublet) : null) : centavos(liquido(p)),
      };
      if (log) {
        if (s.cobrada) it.cobrada = true;
        const c = s.chargeId && cobPorId.get(s.chargeId);
        if (c && !c.hidden) { it.cid = c.id; it.paga = !!c.paid; }
        if (s.status === "done" && regPendente && !s.registro) it.reg = false;
        if (s.date === ultimaData[p.id]) it.desfaz = true; // só a última do paciente dá para desfazer (como no site)
      } else if (conf[`${p.id}:${i.date}`] === true || (conf[`${p.id}:${i.date}`] || {}).r === "sim") it.conf = true;
      itens.push(it);
    });
  }

  // as cobranças: todas as abertas e as pagas deste mês e do anterior
  const cobrancas = db.charges.filter(c => !c.hidden && (!c.paid || (c.paidAt && c.paidAt >= `${chAnt}-01`)))
    .sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || (a.paid ? (b.paidAt || "").localeCompare(a.paidAt || "") : a.createdAt.localeCompare(b.createdAt)))
    .map(c => cobrancaApp(c, sessaoPorId));

  // os pacientes: os ativos e os que aparecem na agenda ou numa cobrança (por proxima, como a aba do site; os inativos
  // no fim)
  const comCobranca = new Set(cobrancas.map(c => c.pid));
  const pacientes = db.patients.filter(p => p.active || naAgenda.has(p.id) || comCobranca.has(p.id))
    .sort((a, b) => (a.active ? 0 : 1) - (b.active ? 0 : 1) || (a.nextDate || "").localeCompare(b.nextDate || ""))
    .map(p => {
      const c = corDe(p), pacote = p.billing === "package";
      return {
        id: p.id, nome: p.name, ativo: !!p.active, cor: c.cor, tinta: c.ink,
        valor: centavos(p.price), liquido: centavos(liquido(p)), freq: p.freq, hora: p.time, proxima: p.nextDate || null,
        cobranca: pacote ? "pacote" : "sessao", pacote: pacote ? { feitas: soltas[p.id] || 0, de: p.packageSize || 4 } : null,
        aberto: abertoDe[p.id] || null, temFone: !!foneWa(p.phone), desde: p.desde || null,
      };
    });

  // as finanças do mês (as mesmas contas da aba Finanças e da Saúde do consultório)
  let previsto = 0;
  for (let d = hoje; d.startsWith(ch); d = addDays(d, 1)) itensDoDia(db, d).forEach(i => { if (i.kind !== "log") previsto += liquido(i.patient); });
  const doMes = db.sessions.filter(s => s.date.startsWith(ch)), feitas = doMes.filter(s => s.status === "done"), faltas = doMes.filter(s => s.status === "missed").length;
  const mes = {
    ...mesConsultorio(db, ch), previsto: centavos(previsto),
    serie: serieDoMes(db, ch, hoje), serieAnterior: serieDoMes(db, chAnt, ultimoDia(chAnt)),
    presenca: feitas.length + faltas ? Math.round(feitas.length / (feitas.length + faltas) * 100) : null,
    ticket: feitas.length ? centavos(soma(feitas, s => s.price - s.sublet) / feitas.length) : 0,
    atrasadas: abertas.filter(c => diffDias(c.createdAt, hoje) > 15).length,
  };
  const meses = [5, 4, 3, 2, 1, 0].map(k => mesConsultorio(db, mesAntes(ch, k)));

  // horários livres de 14 dias (os de hoje que já passaram não contam) e a lista de espera com o que combina
  const nm = agoraMin();
  const livres = horariosLivres(db, hoje, 14).map(d => ({ d: d.iso, h: d.livres.filter(m => d.iso !== hoje || m > nm).map(hhmm) })).filter(d => d.h.length);
  const livres7 = horariosLivres(db, addDays(hoje, 1), 7);
  const espera = (db.espera || []).map(e => ({
    id: e.id, nome: e.nome || "", pref: PREFS.includes(e.pref) ? e.pref : "qualquer", desde: e.desde || hoje,
    temFone: !!foneWa(e.phone), combina: combinaEspera(e, livres7),
  }));
  const pedidos = (db.pedidos || []).map(p => {
    const pac = p.pid && db.patients.find(x => x.id === p.pid);
    return { id: p.id, tipo: p.tipo === "remarcar" ? "remarcar" : "novo", pid: p.pid || null, nome: p.nome || "", data: p.data, hora: p.hora,
      criado: p.criado ?? null, antes: pac && pac.nextDate ? { data: pac.nextDate, hora: pac.time } : null };
  });

  const v = {
    pacientes, agenda: { de, ate, itens, feriados }, cobrancas, mes, meses, livres, pedidos, espera,
    link: { pode: !!(linkAg && linkAg.pode), ativo: !!linkDo(pf).ativo, url: (linkAg && enderecoLink(linkAg.endereco)) || null },
    regras: {
      duracao: pf.duracao || 50, intervalo: INTERVALO_MIN,
      falta: { cobrar: !!(pf.falta && pf.falta.cobrar), horas: (pf.falta && pf.falta.horas) || 24 },
      registro: pf.registro !== false, reserva: Number(pf.reserva) || 0, meta: Number(pf.meta) > 0 ? Number(pf.meta) : null,
      pix: !!(db.settings && db.settings.pix),
    },
    limitePacientes: libera && !libera.consultorio ? LIMITE_GRATIS.pacientes : null,
  };
  memoCons = { k: chave, v };
  return v;
}

/* ---------- Loja ----------
   Os itens vivem em useLoja (nuvem com cópia no aparelho), não no db. Vão os produtos, o caixa de hoje, os gastos do
   mês (e do anterior, quando o site mostra), a lista do que falta e o resumo (só para quem vê o lucro). Guardado pela
   versão dos itens da loja. */
let memoLoja = null;
export function retratoLoja(L, pro, hoje) {
  if (!L) return null;
  const chave = [L.estado, L.versao, L.membros, L.nuvem, L.eu, L.desde, L.loja && L.loja.id, L.loja && L.loja.nome, L.loja && L.loja.dono, L.souDona, L.veLucro, !!pro, hoje];
  if (memoLoja && memoLoja.k.every((x, i) => x === chave[i])) return memoLoja.v;
  const base = { estado: L.estado, nuvem: !!L.nuvem };
  let v;
  if (!L.loja) v = { ...base, loja: null };
  else {
    const ch = hoje.slice(0, 7), T = totaisDia(L, hoje), G = gaveta(L, hoje), f = G.fechado;
    const cores = id => CORES.find(c => c.id === id) || CORES[4]; // como o botão do produto no site
    const pagOk = p => (PAGAMENTOS.some(x => x.id === p) ? p : "dinheiro");
    // o mês anterior só quando o site também mostra (na versão grátis, os últimos 30 dias)
    const antOk = pro || ultimoDia(mesAntes(ch)) >= addDays(hoje, -(LIMITE_GRATIS.lojaDias - 1));
    const gastosDe = antOk && `${mesAntes(ch)}-01` >= L.desde ? `${mesAntes(ch)}-01` : `${ch}-01`;
    const resumo = (de, ate) => resumoDoPeriodo(L, de, ate);
    v = { ...base, loja: {
      id: L.loja.id, nome: L.loja.nome, eu: L.eu, souDona: !!L.souDona, veLucro: !!L.veLucro,
      podeAnotar: !lojaTravada(L, pro), aviso: avisoEquipeApp(L, pro),
      historicoDias: pro ? null : LIMITE_GRATIS.lojaDias, temPix: !!(L.config && L.config.pix),
      membros: L.membros.map(m => ({
        id: m.id, nome: m.nome || "", papel: m.id === L.loja.dono ? "dono" : "ajudante", veLucro: m.id === L.loja.dono || !!m.veLucro,
        foto: ehAvatarPronto(m.foto) ? m.foto : null, fotoK: m.foto && !ehAvatarPronto(m.foto) ? chaveFoto(m.foto) : null,
      })),
      produtos: L.produtos.filter(p => p.ativo !== false).map(p => { const c = cores(p.cor); return { id: p.id, nome: p.nome, preco: centavos(p.preco), cor: c.cor, tinta: c.ink, corId: c.id }; }),
      // os produtos rápidos (nomes prontos para cadastrar) que ainda não estão no caixa, como a folha de produto do site
      sugestoes: PRODUTOS_SUGERIDOS.filter(x => !L.produtos.some(p => p.nome === x)).slice(0, 6),
      coresProduto: CORES_PRODUTO.map(id => { const c = cores(id); return { id, nome: c.nome, cor: c.cor, tinta: c.ink }; }),
      hoje: {
        dia: hoje, vendas: T.vendas, entrou: T.entrou, ticket: T.vendas ? centavos(T.entrou / T.vendas) : 0, porPag: T.porPag,
        porHora: vendasPorHora(L.vendas, hoje),
        saiu: L.veLucro ? T.saiu : null, sobrou: L.veLucro ? T.sobrou : null, // como o Caixa do site: só para quem vê o lucro
      },
      gaveta: {
        troco: G.troco, vendas: G.vendas, gastos: G.gastos, reforcos: G.reforcos, retiradas: G.retiradas, esperado: G.esperado,
        fechado: f ? { contado: centavos(f.contado), dif: centavos(f.dif), deixou: f.deixou != null ? centavos(f.deixou) : null, hora: f.hora || "", por: f.por || null } : null,
      },
      vendasHoje: L.vendas.filter(x => x.dia === hoje).sort((a, b) => (b.criado || 0) - (a.criado || 0)).slice(0, 50).map(x => {
        const com = !!(x.itens && x.itens.length);
        return {
          id: x.id, hora: x.hora || "", total: centavos(x.total), pag: pagOk(x.pag), desc: x.desc || null,
          resumo: com ? x.itens.map(it => `${it.q > 1 ? it.q + "× " : ""}${it.nome}`).join(", ") : x.desc || "Venda",
          autor: x.autor || null, comItens: com,
        };
      }),
      movsHoje: L.movs.filter(m => m.dia === hoje).sort((a, b) => (a.criado || 0) - (b.criado || 0)).map(m => ({
        id: m.id, tipo: m.tipo === "reforco" ? "reforco" : "retirada", valor: centavos(m.valor), desc: m.desc || null, hora: m.hora || "", pessoal: !!m.pessoal,
      })),
      gastosDe,
      gastos: L.gastos.filter(g => g.dia && g.dia >= gastosDe && g.dia <= ultimoDia(ch)).sort((a, b) => b.dia.localeCompare(a.dia) || (b.criado || 0) - (a.criado || 0)).map(g => ({
        id: g.id, valor: centavos(g.valor), desc: g.desc || "", cat: g.cat || "outros", dia: g.dia, daGaveta: !!g.daGaveta, autor: g.autor || null, nota: !!g.nota,
      })),
      faltas: [...L.faltas].sort((a, b) => (a.criado || 0) - (b.criado || 0)).map(x => ({
        id: x.id, texto: x.texto, qtd: x.qtd || 1, feito: !!x.feito, autor: x.autor || null, criado: x.criado || null,
      })),
      // o que sempre falta (já esteve na lista e foi comprado) e não está na lista agora: o "Acabou?" do site
      sempreFalta: Object.values((L.config && L.config.faltou) || {}).sort((a, b) => b.n - a.n).map(x => x.texto).filter(t => !L.faltas.some(x => x.texto.toLowerCase() === t.toLowerCase())).slice(0, 8),
      resumo: !L.veLucro ? null : { hoje: resumo(hoje, hoje), sete: resumo(addDays(hoje, -6), hoje), mes: resumo(`${ch}-01`, hoje) },
    } };
  }
  memoLoja = { k: chave, v };
  return v;
}

/* ---------- "abrir": as folhas do site para Consultório e Loja ----------
   Chamado pelo "abrir" do Painel (src/App.jsx) com a acao; true = abriu (ao fechar, o site volta sozinho para o app),
   false = não é daqui. Sem a área: erro "tela"; sem a loja: "sem-loja"; o que não existe mais: "nao-achei". */
const ABRIR_CONSULTORIO = new Set(["paciente", "editar-paciente", "novo-paciente", "cobranca", "recibo", "notas", "imposto", "importar-agenda",
  "pedidos", "espera", "livres", "confirmar", "fechar-dia", "revisao", "registros"]);
const ABRIR_LOJA = { "loja-ajustes": "ajustes", "loja-produto": "produto", "loja-venda": "venda", "loja-gasto": "gasto", "loja-nota": "nota",
  "loja-fechar": "fechar", "loja-comprei": "comprei", "loja-mov": "mov" };
const dataValida = d => typeof d === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d);
export function abrirTrabalho(n, acao, d = {}) {
  const a = n.act, naoAchei = () => { throw new Error("nao-achei"); };
  if (ABRIR_CONSULTORIO.has(acao)) {
    if (!n.usaConsultorio) throw new Error("tela");
    const pac = () => n.db.patients.some(p => p.id === d.id) || naoAchei();
    if (acao === "paciente") { pac(); a.openPatient(d.id); }
    else if (acao === "editar-paciente") { pac(); a.editPatient(d.id); }
    else if (acao === "novo-paciente") a.novoPaciente(); // passou do limite: a folha neutra do app (sem falar em assinar)
    else if (acao === "cobranca") { if (!n.db.charges.some(c => c.id === d.id)) naoAchei(); a.openCharge(d.id); }
    else if (acao === "recibo") { pac(); a.abrirRecibo(d.id, typeof d.cid === "string" ? d.cid : undefined); }
    else if (acao === "notas") { pac(); a.abrirNotas(d.id, typeof d.sid === "string" ? d.sid : undefined); } // trancadas: nunca no app
    else if (acao === "imposto") a.abrirImposto();
    else if (acao === "importar-agenda") a.importarAgenda();
    else if (acao === "pedidos") a.abrirPedidos();
    else if (acao === "espera") { if (d.id) { if (!(n.db.espera || []).some(e => e.id === d.id)) naoAchei(); a.editEspera(d.id); } else a.novaEspera(); }
    else if (acao === "livres") a.livres();
    else if (acao === "confirmar") a.confirmar(dataValida(d.id) ? d.id : addDays(todayISO(), 1));
    else if (acao === "fechar-dia") a.fecharDia();
    else if (acao === "revisao") a.revisao();
    else if (acao === "registros") a.registros();
    return true;
  }
  const qual = ABRIR_LOJA[acao];
  if (!qual) return false;
  if (!n.usaLoja) throw new Error("tela");
  const L = n.loja;
  if (!L || !L.loja) throw new Error("sem-loja");
  const de = lista => { if (!d.id) return {}; const x = lista.find(y => y.id === d.id); if (!x) naoAchei(); return { inicial: x }; };
  if (qual === "venda") { if (!d.id) naoAchei(); a.abrirLoja(qual, de(L.vendas)); }
  else if (qual === "produto") a.abrirLoja(qual, de(L.produtos));
  else if (qual === "gasto") a.abrirLoja(qual, de(L.gastos));
  else if (qual === "mov") a.abrirLoja(qual, de(L.movs));
  else a.abrirLoja(qual);
  return true;
}

/* ---------- Os pedidos das telas nativas ----------
   N() é o Painel do último desenho (src/App.jsx, nat.current): db, setDb, setP, act, perfil, loja (useLoja), lojaPro...
   Regras de todos (as mesmas de app-nativo-areas.js):
   - nada de aviso, vibração ou folha no site (quem vibra e mostra o "Desfazer" é a tela nativa);
   - grava sempre com setDb(d => ...) e confere de novo lá dentro (dois pedidos antes do próximo desenho enxergam o
     mesmo db: sem isso, um apagaria o outro);
   - o que cria algo aceita o id mandado pelo app (repetir o pedido depois de "tempo esgotado" não duplica) e o que
     liga ou desliga recebe o valor final;
   - "não deu" volta como { ok: false, erro, texto }, com o texto pronto e neutro (nada de preço nem de assinar). */
// o que saiu da lista de espera fica aqui (com o telefone e a observação), para o Desfazer não precisar mandar isso ao app
const LIXEIRA_ESPERA = new Map();
const REAJUSTE_ANTES = new Map();
// as notas lidas (lojaNotaLer), até virarem gasto (lojaNotaSalvar): a foto da nota não precisa ir e voltar pelo app
const NOTAS_LIDAS = new Map();
// O perfil (ajustes do consultório, link): dois ajustes seguidos antes do próximo desenho não podem se apagar, então o
// segundo parte do primeiro (até o desenho novo trazer o perfil já mudado)
let perfilEnviado = null;
const perfilAtual = n => (perfilEnviado && perfilEnviado.base === n.perfil ? perfilEnviado.novo : n.perfil || {});
const mudarPerfil = (n, patch) => { const novo = { ...perfilAtual(n), ...patch }; perfilEnviado = { base: n.perfil, novo }; n.onAtualizar({ perfil: novo }); return novo; };
// um arquivo (PDF) em base64, para ir pela ponte
const base64De = blob => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => erro(r.error); r.readAsDataURL(blob); });
// os erros da nuvem da loja, em português (os mesmos da tela da loja do site)
const ERROS_LOJA = [[/ja tem loja/, "Você já está numa loja. Para entrar nesta, saia da outra primeiro."], [/loja cheia/, `Essa loja já tem ${MAX_AJUDANTES} ajudantes.`],
  [/convite invalido/, "Esse convite venceu ou não existe. Peça um link novo para quem criou a loja."], [/sem login/, "Entre na sua conta para continuar."], [/so a dona/, "Só quem criou a loja pode fazer isso."]];
const erroLoja = e => { const t = String((e && e.message) || e); const m = ERROS_LOJA.find(([r]) => r.test(t)); return m ? m[1] : "Não consegui falar com a nuvem. Confira a internet e tente de novo."; };
// por que a nota não deu para ler pelo QR (os mesmos textos da leitura de nota do site, telas/casa.jsx)
const MOTIVOS_NOTA = {
  captcha: uf => `A Sefaz${uf ? ` de ${uf}` : ""} pede “não sou robô” e não deixa nenhum app ler a nota sozinho. Pela foto eu leio.`,
  js: uf => `A página da Sefaz${uf ? ` de ${uf}` : ""} só abre no navegador, e eu não consigo ler os itens dela. Pela foto eu leio.`,
  "ainda-nao": () => "Essa nota ainda não chegou na Sefaz (acontece logo depois da compra, ou quando o caixa estava sem internet). Tente pelo QR mais tarde, ou leia pela foto agora.",
};

export function acoesDoTrabalho(N) {
  const falha = (erro, texto, extra) => ({ ok: false, erro, texto, ...extra });
  const semConsultorio = () => falha("consultorio", "Para isso, ligue o Consultório em Perfil → Como você usa o app.");
  const valorOk = v => Number(v) > 0 && Number(v) < 1e7;
  const zeroOk = v => v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1e7;
  const dataOk = dataValida;
  const horaOk = h => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  const mesOk = m => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const idOk = id => typeof id === "string" && id.length > 0 && id.length <= 64;
  const texto80 = t => String(t == null ? "" : t).trim().slice(0, 80);
  const novoId = () => uid() + Date.now().toString(36);
  const consultorio = () => { const n = N(); return n.usaConsultorio ? n : null; };
  const nomeDe = p => (p ? primeiro(p.name) : `o ${TERMO.s}`);
  // a sessão já registrada (o mesmo pedido de novo): devolve o que ficou
  const jaRegistrada = (db, s) => {
    const p = db.patients.find(x => x.id === s.patientId), c = s.chargeId && db.charges.find(x => x.id === s.chargeId);
    return { ok: true, sid: s.id, proxima: (p && p.nextDate) || null,
      cobranca: c ? { id: c.id, valor: centavos(c.amount), sessoes: c.sessionIds.length, paga: !!c.paid, fechouPacote: !!p && p.billing === "package" } : null };
  };

  // A loja pronta para o pedido: com a área ligada, a loja aberta (L.salvar com a loja ainda carregando não grava) e,
  // para anotar, sem a equipe travada. Devolve [L, null] ou [null, falha]
  const lojaPronta = anotar => {
    const n = N();
    if (!n.usaLoja) return [null, falha("loja", "Para isso, ligue a Loja em Perfil → Como você usa o app.")];
    const L = n.loja;
    if (!L || L.estado === "sem" || L.estado === "indisponivel" || (L.estado === "ok" && !L.loja)) return [null, falha("sem-loja", "Você ainda não tem uma loja.")];
    if (L.estado !== "ok" || !L.loja) return [null, falha("carregando", "A loja ainda está abrindo. Tente de novo em instantes.")];
    if (anotar && lojaTravada(L, n.lojaPro)) return [null, falha("travado", avisoEquipeApp(L, n.lojaPro))];
    return [L, null];
  };
  // grava na loja sem esperar a nuvem: a cópia no aparelho muda na hora e, sem internet, o item vai para a fila
  const naLoja = (L, colecao, item) => { L.salvar(colecao, item).catch(() => {}); return item; };
  const daLojaFora = (L, colecao, id) => { L.apagar(colecao, id).catch(() => {}); };
  // a retirada que a dona leva para o Pessoal vira uma entrada lá (o mesmo de act.retiradaParaPessoal, sem repetir)
  const entradaDaRetirada = (n, m, nomeL) => n.setP(P => P.lanc.some(l => l.lojaMov === m.id) ? P : { ...P, lanc: [...P.lanc, {
    id: uid(), tipo: "entrada", cat: "trabalho", valor: m.valor, desc: m.desc && m.desc !== "Para mim" ? `${m.desc} (${nomeL})` : `Retirada da ${nomeL}`, data: todayISO(), lojaMov: m.id,
  }] });
  // o link de agendamento como a tela de ajustes mostra: as regras, o endereço e quantos horários aparecem nele agora
  // (os livres, com a antecedência e sem os já pedidos, como no Perfil do site)
  const estadoDoLink = (n, pf = perfilAtual(n)) => {
    const cfg = linkDo(pf), L = n.linkAg || {};
    const limite = Date.now() + cfg.antecedencia * 36e5, pedidos = new Set((n.db.pedidos || []).map(p => `${p.data} ${p.hora}`));
    const horarios = !cfg.ativo ? 0 : horariosLivres(n.db, todayISO(), cfg.semanas * 7 + 1)
      .reduce((s, d) => s + d.livres.filter(m => { const t = fromISO(d.iso); t.setMinutes(m); return t.getTime() >= limite && !pedidos.has(`${d.iso} ${hhmm(m)}`); }).length, 0);
    return { pode: !!L.pode, ativo: !!cfg.ativo, quem: cfg.quem, antecedencia: cfg.antecedencia, semanas: cfg.semanas, url: enderecoLink(cfg.endereco) || null,
      erro: L.erro || null, pedidos: (n.db.pedidos || []).length, horarios };
  };
  // o recibo pedido pelo app: os pagamentos do paciente, os escolhidos (ids, senão os do mês) e o texto (telas/consultorio.jsx)
  const recibo = async (n, d) => {
    const p = n.db.patients.find(x => x.id === d.pid);
    if (!p) return falha("nao-achei", `Não achei esse ${TERMO.s}. Ele pode ter sido apagado em outro aparelho.`);
    const C = await import("./telas/consultorio.jsx"), pf = perfilAtual(n), conta = { ...n.conta, perfil: pf };
    const todos = C.pagos(n.db).filter(c => c.patientId === p.id);
    if (!todos.length) return falha("sem-pagamento", `Quando ${primeiro(p.name)} pagar, o recibo sai daqui.`);
    const pedidos = Array.isArray(d.ids) ? todos.filter(c => d.ids.includes(c.id)) : null;
    const mes = mesOk(d.mes) ? d.mes : pedidos && pedidos.length ? pedidos[0].paidAt.slice(0, 7) : todos[0].paidAt.slice(0, 7);
    const doMes = todos.filter(c => c.paidAt.startsWith(mes)), escolhidos = pedidos || doMes;
    const op = {
      servico: typeof d.servico === "string" ? d.servico.slice(0, 80) : C.servicoPadrao(pf.profissao),
      cpf: d.cpf !== undefined ? String(d.cpf || "").replace(/\D/g, "").slice(0, 11) : p.cpf || "",
      outroPaga: d.outroPaga !== undefined ? !!d.outroPaga : !!p.pagadorNome,
      pagadorNome: d.pagadorNome !== undefined ? String(d.pagadorNome || "").slice(0, 80) : p.pagadorNome || "",
      pagadorCpf: d.pagadorCpf !== undefined ? String(d.pagadorCpf || "").replace(/\D/g, "").slice(0, 11) : p.pagadorCpf || "",
    };
    const R = C.montarRecibo({ db: n.db, conta, p, escolhidos, servico: op.servico, cpfPac: op.cpf, outroPaga: op.outroPaga, pagNome: op.pagadorNome, pagCpf: op.pagadorCpf });
    return { p, todos, mes, doMes, escolhidos, R, op, pf, C };
  };
  // A nota do fornecedor: pelo QR (o servidor busca a página da Sefaz e o aparelho lê os itens) ou pela foto (a IA lê,
  // com a permissão da pessoa). Os mesmos passos e textos da leitura de nota do site (telas/casa.jsx, NotaSheet)
  const lerNota = async (L, texto, foto) => {
    const servidor = servidorAvisos();
    const quemDe = async cnpj => { try { const q = cnpj ? await buscarCnpj(cnpj) : null; return q ? { nome: q.nome || "", cnpj: q.cnpj || cnpj, catLoja: q.catLoja || null } : null; } catch (e) { return null; } };
    const pronta = async (nota, quem) => {
      if (!nota.itens || !nota.itens.length) return falha("itens", "Não achei os itens dessa nota. Tire a foto de perto, com a nota inteira e reta.", { foto: true });
      const q = quem !== undefined ? quem : await quemDe(nota.cnpj), ref = novoId();
      NOTAS_LIDAS.set(ref, { nota, quem: q });
      if (NOTAS_LIDAS.size > 5) NOTAS_LIDAS.delete(NOTAS_LIDAS.keys().next().value);
      const { foto: f, _tr, recusa, bloqueio, ...resto } = nota;
      return { ok: true, ref, nota: { ...resto, temFoto: !!f }, quem: q, naLista: L.faltas.filter(x => nota.itens.some(i => combina(x.texto, i.nome))).map(x => x.id) };
    };
    const pelaIA = async (blob, motivo) => {
      if (!servidor) return falha("sem-servidor", "Para ler a foto da nota, ligue o servidor de avisos (Perfil → Avisos).");
      if (!(await permitirIA())) return falha("ia", "Tudo bem: sem a IA, leia pelo QR code da nota ou anote só o total.");
      try {
        const imagem = await reduzirFoto(blob, 1400, 0.72);
        const r = await fetch(`${servidor}/ler-nota`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagem, hoje: todayISO() }), signal: AbortSignal.timeout(60000) });
        const j = await r.json().catch(() => ({}));
        if (j.erro === "limite") return falha("limite", j.nivel === "pro" ? "Você usou bastante a leitura por foto hoje. Amanhã renova. Pelo QR code continua funcionando." : "As leituras por foto de hoje acabaram. Amanhã renova; pelo QR code continua funcionando, ou anote só o total.");
        if (!r.ok || !j.nota) return falha("foto", "Não consegui ler a foto. Tire de perto, com boa luz e a nota inteira e reta.", { foto: true, motivo: motivo || null });
        return pronta({ ...arrumarNotaIA(j.nota), fonte: "foto", foto: await reduzirFoto(blob, 800, 0.55) });
      } catch (e) { return falha("sem-internet", "Não consegui ler a foto. Confira a internet e tente de novo.", { foto: true }); }
    };
    if (typeof foto === "string" && /^data:image\//.test(foto)) {
      let blob; try { blob = await (await fetch(foto)).blob(); } catch (e) { return falha("foto", "Não consegui abrir essa foto.", { foto: true }); }
      return pelaIA(blob, "");
    }
    if (typeof texto !== "string" || !texto.trim()) return falha("vazio", "Leia o QR code da nota ou tire uma foto dela.");
    const q = lerTextoNota(texto);
    if (q.erro) return falha("qr", q.erro === "chave" ? "O QR code saiu cortado ou borrado (a chave da nota não confere). Tente de novo, mais de perto e com a nota esticada." : "Esse QR code não é o da nota fiscal. Procure o do fim do cupom, perto de “Consulte pela chave de acesso”.");
    if (!servidor) return falha("sem-servidor", "Para ler a nota, ligue o servidor de avisos (Perfil → Avisos).");
    const uf = ufDaChave(q.chave), quemP = quemDe(cnpjDaChave(q.chave)); // o CNPJ está na chave: já sei de que loja é
    let motivo = "", sefaz = null;
    try {
      const r = await fetch(`${servidor}/nfce`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: q.url }), signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const buf = await r.arrayBuffer(), ct = r.headers.get("content-type") || "";
        const cs = (ct.match(/charset=([\w-]+)/i) || [])[1];
        let html; try { html = new TextDecoder(cs || "utf-8").decode(buf); } catch (e) { html = new TextDecoder("utf-8").decode(buf); }
        if (!cs) { const m = html.match(/<meta[^>]+charset=["']?([\w-]+)/i); if (m && !/utf-?8/i.test(m[1])) { try { html = new TextDecoder(m[1]).decode(buf); } catch (e) {} } }
        const n = lerPaginaNfce(html);
        if (n.itens.length) return pronta({ ...n, fonte: "qr", url: q.url }, await quemP);
        motivo = MOTIVOS_NOTA[n.bloqueio] ? MOTIVOS_NOTA[n.bloqueio](uf) : n.recusa ? `A Sefaz${uf ? ` de ${uf}` : ""} respondeu: “${n.recusa}”.` : `Não reconheci a página da Sefaz${uf ? ` de ${uf}` : ""}. Pela foto eu leio.`;
        if (n.bloqueio === "js" || n.bloqueio === "captcha") sefaz = q.url;
      } else motivo = `A Sefaz${uf ? ` de ${uf}` : ""} não respondeu agora. Pela foto eu leio.`;
    } catch (e) { motivo = "Não consegui falar com a Sefaz. Confira a internet, ou leia pela foto."; }
    return falha("sefaz", motivo, { foto: true, sefaz, quem: await quemP });
  };
  const lojaApagar = colecao => ({ id, ...resto } = {}) => {
    const [L, f] = lojaPronta(false); if (f) return { ...f, item: null };
    const lista = { venda: L.vendas, gasto: L.gastos, mov: L.movs }[colecao], x = lista.find(y => y.id === id);
    if (x) {
      daLojaFora(L, colecao, id);
      // o Desfazer de "Tirar ou pôr" (comPessoal): a entrada que foi para o Pessoal sai junto
      if (colecao === "mov" && x.pessoal && resto.comPessoal) N().setP(P => ({ ...P, lanc: P.lanc.filter(l => l.lojaMov !== id) }));
    }
    return { ok: !!x, item: x || null };
  };

  return {
    /* ----- Consultório (db.patients, db.sessions, db.charges; funciona sem internet, a nuvem vai depois) ----- */
    // sessaoRegistrar { pid, data, status, sid, cid?, paga?, cobrarFalta?, proxima?, valor?, sublocacao?, padrao? }:
    // o "Veio" / "Faltou" da sessão marcada (a próxima do paciente), como a folha da sessão do site. data é a que a
    // tela mostrava: se a próxima já é outra (marcada em outro aparelho), erro "mudou"
    sessaoRegistrar: (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const sid = idOk(d.sid) ? d.sid : uid();
      const ja = n.db.sessions.find(s => s.id === sid);
      if (ja) return jaRegistrada(n.db, ja);
      if (d.status !== "done" && d.status !== "missed") return falha("status", "Diga se veio ou faltou.");
      const p = n.db.patients.find(x => x.id === d.pid);
      if (!p) return falha("nao-achei", `Não achei esse ${TERMO.s}. Ele pode ter sido apagado em outro aparelho.`);
      if (!p.active || !p.nextDate || p.nextDate !== d.data) return falha("mudou", `A próxima sessão de ${nomeDe(p)} mudou em outro aparelho. Confira a agenda.`);
      const proxima = d.proxima === undefined ? addDays(p.nextDate, p.freq) : d.proxima;
      if (!dataOk(proxima) || proxima <= p.nextDate) return falha("data", "A próxima sessão precisa ser depois desta.");
      if (d.valor !== undefined && !valorOk(d.valor)) return falha("valor", "Coloque o valor da sessão.");
      if (d.sublocacao !== undefined && !zeroOk(d.sublocacao)) return falha("valor", "Confira a sublocação.");
      const price = d.valor !== undefined ? centavos(d.valor) : undefined, sublet = d.sublocacao !== undefined ? centavos(d.sublocacao) : undefined;
      if ((price ?? p.price) - (sublet ?? sublocacao(p)) < 0) return falha("valor", "A sublocação ficou maior que o valor da sessão.");
      const cobrarFalta = d.status === "missed" && !!(n.perfil && n.perfil.falta && n.perfil.falta.cobrar) && !!d.cobrarFalta;
      const opts = {
        status: d.status, nextDate: proxima, paidNow: d.status === "done" && !!d.paga, price, sublet,
        padrao: !!d.padrao && (price !== undefined || sublet !== undefined), cobrarFalta, id: sid,
        chargeId: idOk(d.cid) && !n.db.charges.some(c => c.id === d.cid) ? d.cid : uid(),
      };
      const r = registrar(n.db, p.id, opts);
      n.setDb(db => {
        if (db.sessions.some(s => s.id === sid)) return db; // já entrou
        const pp = db.patients.find(x => x.id === p.id);
        return pp && pp.nextDate === d.data ? registrar(db, p.id, opts).db : db;
      });
      return { ok: true, sid, proxima,
        cobranca: r.nova ? { id: r.nova.id, valor: centavos(r.nova.amount), sessoes: r.nova.sessionIds.length, paga: !!r.nova.paid, fechouPacote: p.billing === "package" } : null };
    },
    // sessaoDesfazer { sid }: volta a sessão para "marcada" (some a cobrança dela inteira, mesmo paga: o app confirma
    // antes). Só a última do paciente, como no site. Já desfeita: ok
    sessaoDesfazer: ({ sid } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (!idOk(sid)) return { ok: false };
      const s = n.db.sessions.find(x => x.id === sid);
      if (s && n.db.sessions.some(x => x.patientId === s.patientId && x.date > s.date))
        return falha("nao-e-a-ultima", `Só dá para desfazer o último registro de ${nomeDe(n.db.patients.find(p => p.id === s.patientId))}.`);
      // mesmo sem achar (pedido logo depois do "Veio", antes do próximo desenho), a conta é refeita lá dentro
      n.setDb(db => { const x = db.sessions.find(y => y.id === sid); return !x || db.sessions.some(y => y.patientId === x.patientId && y.date > x.date) ? db : desfazer(db, sid); });
      return { ok: true };
    },
    // sessaoRemarcar { pid, data, hora }: muda só esta sessão (a frequência segue da data nova). O Desfazer é o mesmo
    // pedido com o "antes"
    sessaoRemarcar: ({ pid, data, hora } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const p = n.db.patients.find(x => x.id === pid);
      if (!p || !p.active) return falha("nao-achei", `Não achei esse ${TERMO.s}. Ele pode ter sido apagado em outro aparelho.`);
      if (!dataOk(data)) return falha("data", "Escolha a nova data.");
      if (!horaOk(hora)) return falha("hora", "Escolha o horário.");
      n.setDb(db => ({ ...db, patients: db.patients.map(x => x.id === pid ? { ...x, nextDate: data, time: hora } : x) }));
      return { ok: true, antes: { data: p.nextDate || null, hora: p.time || null } };
    },
    // sessaoRegistro { sid, feito }: o "Registro da sessão feito" (só a marca; o conteúdo fica nas anotações do site)
    sessaoRegistro: ({ sid, feito } = {}) => {
      const n = consultorio(), tem = !!n && n.db.sessions.some(s => s.id === sid);
      if (tem) n.setDb(db => ({ ...db, sessions: db.sessions.map(s => s.id === sid ? { ...s, registro: !!feito } : s) }));
      return { ok: tem };
    },
    // sessaoConfirmada { pid, data, feito }: a confirmação da véspera (como a folha "Confirmar" do site)
    sessaoConfirmada: ({ pid, data, feito } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (!n.db.patients.some(p => p.id === pid) || !dataOk(data)) return { ok: false };
      n.setDb(db => ({ ...db, confirmados: { ...(db.confirmados || {}), [`${pid}:${data}`]: !!feito } }));
      return { ok: true };
    },
    // cobrancaPagar { ids, paga, data? }: o "Já pagou" (data do comprovante; padrão hoje) e o Desfazer dele ("antes")
    cobrancaPagar: ({ ids, paga, data } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const set = new Set((Array.isArray(ids) ? ids : [ids]).filter(idOk));
      const alvo = n.db.charges.filter(c => set.has(c.id));
      if (!alvo.length) return falha("nao-achei", "Não achei essa cobrança. Ela pode ter mudado em outro aparelho.");
      if (paga && data !== undefined && (!dataOk(data) || data > todayISO())) return falha("data", "Confira a data do pagamento.");
      const quando = dataOk(data) ? data : todayISO();
      // já paga e sem data nova: fica a data que estava (repetir o pedido não muda nada)
      n.setDb(db => ({ ...db, charges: db.charges.map(c => !set.has(c.id) ? c : { ...c, paid: !!paga, paidAt: !paga ? null : c.paid && !dataOk(data) ? c.paidAt : quando }) }));
      return { ok: true, n: alvo.length, antes: alvo.map(c => ({ id: c.id, paga: !!c.paid, pagaEm: c.paidAt || null })) };
    },
    // cobrancaMensagem { id }: o texto pronto da cobrança (com a chave Pix da pessoa) e o WhatsApp do paciente
    cobrancaMensagem: ({ id } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const c = n.db.charges.find(x => x.id === id);
      if (!c) return falha("nao-achei", "Não achei essa cobrança. Ela pode ter mudado em outro aparelho.");
      const p = n.db.patients.find(x => x.id === c.patientId);
      return { texto: mensagem(n.db, c, n.conta && n.conta.nome), fone: foneWa(p && p.phone) };
    },
    // pixConferir { valor, pagador?, data? }: "Recebi um Pix: é de quem?" (não grava; a pessoa escolhe e o app chama
    // cobrancaPagar)
    pixConferir: ({ valor, pagador, data } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (!valorOk(valor)) return falha("valor", "Coloque o valor do Pix.");
      const grupos = cobrancasDoPix(n.db, { valor: centavos(valor), pagador: String(pagador || "").slice(0, 60), data: dataOk(data) ? data : todayISO() });
      return { grupos: grupos.map(g => ({ pid: g.pid, ids: g.ids, abertas: g.abertas, total: centavos(g.total), desde: g.desde })) };
    },
    // pacienteNovo { id, nome, fone?, valor, freq?, hora, data, cobranca?, pacote?, espera? }: o cadastro simples, como o
    // do site (sublocação do perfil, cor da vez). espera: o id da lista de espera (vira paciente e sai da lista).
    // O resto (CPF, cor, sublocação, quem paga) é no site ("abrir" editar-paciente)
    pacienteNovo: (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (idOk(d.id) && n.db.patients.some(p => p.id === d.id)) return { ok: true, id: d.id };
      const nome = String(d.nome || "").trim().slice(0, 80);
      if (!nome) return falha("nome", `Escreva o nome do ${TERMO.s}.`);
      if (!valorOk(d.valor)) return falha("valor", "Falta o valor da sessão.");
      if (!dataOk(d.data)) return falha("data", "Escolha o dia da primeira sessão.");
      if (!horaOk(d.hora)) return falha("hora", "Escolha o horário.");
      const pf = n.perfil || {}, price = centavos(d.valor), subletType = pf.subTipo || "fixed", sublet = Number(pf.subPadrao) || 0;
      if (price - (subletType === "percent" ? price * sublet / 100 : sublet) < 0) return falha("valor", "A sublocação ficou maior que o valor da sessão.");
      const lim = limitePacApp(n, 1); if (lim) return lim;
      const esp = idOk(d.espera) ? (n.db.espera || []).find(e => e.id === d.espera) : null;
      const f = Math.round(Number(d.freq));
      const pacote = d.cobranca === "pacote";
      const id = idOk(d.id) ? d.id : uid();
      const novo = {
        name: nome, phone: d.fone !== undefined ? String(d.fone || "").trim().slice(0, 30) : esp ? esp.phone || "" : "",
        price, sublet, subletType, freq: f >= 1 && f <= 365 ? f : 7, time: d.hora, billing: pacote ? "package" : "session",
        packageSize: pacote ? Math.min(12, Math.max(2, Math.round(Number(d.pacote)) || 4)) : 4, nextDate: d.data, active: true,
        pagadorNome: "", id, desde: todayISO(),
      };
      n.setDb(db => {
        if (db.patients.some(p => p.id === id)) return db;
        const r = { ...db, patients: [...db.patients, { ...novo, color: CORES[db.patients.length % CORES.length].id }] };
        if (esp) r.espera = (db.espera || []).filter(e => e.id !== esp.id);
        return r;
      });
      return { ok: true, id };
    },
    // pacienteFicha { id }: o detalhe do paciente, sob demanda (nada disso fica no retrato): histórico (até 24), as
    // cobranças, o já recebido, o WhatsApp (para o botão) e o reajuste pela inflação
    pacienteFicha: ({ id } = {}) => {
      const n = consultorio(), p = n && n.db.patients.find(x => x.id === id);
      if (!p) return null;
      const sessaoPorId = new Map(n.db.sessions.map(s => [s.id, s])), cobPorId = new Map(n.db.charges.map(c => [c.id, c]));
      const hist = n.db.sessions.filter(s => s.patientId === id).sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""));
      const rj = reajusteDe(p);
      return {
        historico: hist.slice(0, 24).map(s => {
          const c = s.chargeId && cobPorId.get(s.chargeId);
          return { sid: s.id, data: s.date, hora: s.time, st: s.status === "done" ? "done" : "missed", valor: contaDinheiro(s) ? centavos(s.price - s.sublet) : null,
            cobrada: !!s.cobrada, paga: c && !c.hidden ? !!c.paid : null };
        }),
        cobrancas: n.db.charges.filter(c => c.patientId === id && !c.hidden).sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || b.createdAt.localeCompare(a.createdAt)).map(c => cobrancaApp(c, sessaoPorId)),
        recebido: centavos(soma(n.db.charges.filter(c => c.patientId === id && c.paid), c => c.amount)),
        feitas: hist.filter(s => s.status === "done").length, faltas: hist.filter(s => s.status === "missed").length,
        fone: foneWa(p.phone),
        reajuste: rj ? { meses: rj.meses, pct: rj.ac ? Math.round(rj.ac.pct * 10) / 10 : null, sugerido: rj.sug > p.price ? centavos(rj.sug) : null } : null,
      };
    },
    // pacienteReajustar { id, valor } ou { id, desfazer: true }: o valor novo vale para as próximas sessões (as que já
    // aconteceram ficam como estão); o desfazer volta o valor e as datas do reajuste de antes
    pacienteReajustar: ({ id, valor, desfazer: volta } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const p = n.db.patients.find(x => x.id === id);
      if (!p) return falha("nao-achei", `Não achei esse ${TERMO.s}. Ele pode ter sido apagado em outro aparelho.`);
      if (volta) {
        const a = REAJUSTE_ANTES.get(id); if (!a) return { ok: false };
        REAJUSTE_ANTES.delete(id);
        n.setDb(db => ({ ...db, patients: db.patients.map(x => x.id === id ? { ...x, ...a } : x) }));
        return { ok: true, antes: centavos(p.price) };
      }
      if (!valorOk(valor)) return falha("valor", "Coloque o valor novo da sessão.");
      if (!REAJUSTE_ANTES.has(id) || centavos(p.price) !== centavos(valor)) REAJUSTE_ANTES.set(id, { price: p.price, reajusteEm: p.reajusteEm, reajusteAdiado: p.reajusteAdiado });
      n.setDb(db => ({ ...db, patients: db.patients.map(x => x.id === id ? { ...x, price: centavos(valor), reajusteEm: todayISO(), reajusteAdiado: null } : x) }));
      return { ok: true, antes: centavos(p.price) };
    },
    // pedidoResponder { id, aceitar }: o pedido que chegou pelo link (como o site, sem aviso). Aceitar uma pessoa nova
    // passa pelo limite. Volta o recado ("confirmado" ou "não vai dar", com o link) e o WhatsApp de quem pediu
    pedidoResponder: ({ id, aceitar } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const p = (n.db.pedidos || []).find(x => x.id === id);
      if (!p) return falha("nao-achei", "Esse pedido já foi respondido.");
      if (aceitar && !p.pid) { const lim = limitePacApp(n, 1); if (lim) return lim; }
      const pac = p.pid && n.db.patients.find(x => x.id === p.pid), pf = n.perfil || {}, novoPid = uid();
      n.setDb(db => {
        if (!(db.pedidos || []).some(x => x.id === id)) return db; // já respondido
        const r = { ...db, pedidos: db.pedidos.filter(x => x.id !== id) };
        if (!aceitar) return r;
        if (p.pid) return { ...r, patients: r.patients.map(x => x.id === p.pid ? { ...x, nextDate: p.data, time: p.hora } : x) };
        const novo = { id: novoPid, name: p.nome, phone: p.phone || "", color: CORES[r.patients.length % CORES.length].id, price: pf.valorPadrao || 0, sublet: pf.subPadrao || 0, subletType: pf.subTipo || "fixed", freq: 7, time: p.hora, billing: "session", packageSize: 4, nextDate: p.data, active: true, desde: todayISO() };
        return { ...r, patients: [...r.patients, novo] };
      });
      return { ok: true, pid: aceitar ? p.pid || novoPid : p.pid || null, texto: recadoDoPedido(p, !!aceitar, pf), fone: foneWa(p.phone || (pac && pac.phone)) };
    },
    // esperaSalvar { id, nome, fone?, pref, obs? }: entra (ou muda) na lista de espera (sem obs, a observação fica como estava)
    esperaSalvar: (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const nome = String(d.nome || "").trim().slice(0, 80);
      if (!nome) return falha("nome", "Escreva o nome.");
      const antes = idOk(d.id) ? (n.db.espera || []).find(e => e.id === d.id) : null;
      const e = { ...(antes || { desde: todayISO(), id: idOk(d.id) ? d.id : uid(), obs: "" }), nome,
        phone: d.fone !== undefined ? String(d.fone || "").trim().slice(0, 30) : antes ? antes.phone || "" : "",
        pref: PREFS.includes(d.pref) ? d.pref : antes && PREFS.includes(antes.pref) ? antes.pref : "qualquer",
        obs: d.obs !== undefined ? texto80(d.obs) : antes ? antes.obs || "" : "" };
      n.setDb(db => { const l = db.espera || []; return { ...db, espera: l.some(x => x.id === e.id) ? l.map(x => x.id === e.id ? { ...x, nome: e.nome, phone: e.phone, pref: e.pref, obs: e.obs } : x) : [...l, e] }; });
      return { ok: true, id: e.id };
    },
    // esperaTirar { id }: sai da lista. item (sem telefone nem observação) é para o Desfazer: o site guarda o resto
    esperaTirar: ({ id } = {}) => {
      const n = consultorio(), e = n && (n.db.espera || []).find(x => x.id === id);
      if (!e) return { ok: false, item: null };
      LIXEIRA_ESPERA.set(e.id, e);
      n.setDb(db => ({ ...db, espera: (db.espera || []).filter(x => x.id !== id) }));
      return { ok: true, item: { id: e.id, nome: e.nome, pref: e.pref, desde: e.desde } };
    },
    // esperaRestaurar { item }: o Desfazer (volta como era, com o telefone e a observação guardados aqui)
    esperaRestaurar: ({ item } = {}) => {
      const n = consultorio(); if (!n || !item || !idOk(item.id)) return { ok: false };
      const e = LIXEIRA_ESPERA.get(item.id) || { id: item.id, nome: String(item.nome || "").trim().slice(0, 80), phone: "", obs: "",
        pref: PREFS.includes(item.pref) ? item.pref : "qualquer", desde: dataOk(item.desde) ? item.desde : todayISO() };
      if (!e.nome) return { ok: false };
      LIXEIRA_ESPERA.delete(item.id);
      n.setDb(db => (db.espera || []).some(x => x.id === e.id) ? db : { ...db, espera: [...(db.espera || []), e] });
      return { ok: true };
    },
    // consultorioPlanilha { mes }: a planilha do mês para o contador (a mesma do botão do site), para o Compartilhar
    consultorioPlanilha: ({ mes } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (!mesOk(mes)) return falha("mes", "Escolha o mês.");
      return { nome: `consultorio-${mes}.csv`, csv: csvDoMes(n.db, mes) };
    },

    /* ----- Loja (useLoja: nuvem com cópia no aparelho e fila; sem login, a loja guardada no aparelho) ----- */
    // lojaVenda { id, itens?: [{ p, q }], valor?, pag, desc? }: a venda do caixa (nome e preço vêm dos produtos do site)
    // ou só pelo valor. Dia, hora e quem vendeu, o site põe
    lojaVenda: (d = {}) => {
      const [L, f] = lojaPronta(true); if (f) return f;
      const id = idOk(d.id) ? d.id : novoId(), ja = L.vendas.find(v => v.id === id);
      if (ja) return { ok: true, id, total: centavos(ja.total) };
      if (d.pag !== undefined && !PAGAMENTOS.some(p => p.id === d.pag)) return falha("pag", "Escolha como a venda foi paga.");
      let itens = [], total;
      if (Array.isArray(d.itens) && d.itens.length) {
        const q = new Map();
        for (const it of d.itens.slice(0, 100)) {
          const p = it && L.produtos.find(x => x.id === it.p), k = Math.round(Number(it && it.q));
          if (!p) return falha("produto", "Um produto da venda saiu do caixa. Confira e tente de novo.");
          if (!(k >= 1 && k <= 999)) return falha("produto", "Confira a quantidade de cada produto.");
          q.set(p.id, (q.get(p.id) || 0) + k);
        }
        itens = [...q].map(([pid, k]) => { const p = L.produtos.find(x => x.id === pid); return { p: pid, nome: p.nome, preco: Number(p.preco) || 0, q: k }; });
        total = centavos(itens.reduce((s, it) => s + it.preco * it.q, 0));
      } else if (d.valor !== undefined) {
        if (!valorOk(d.valor)) return falha("valor", "Coloque o valor da venda.");
        total = centavos(d.valor);
      } else return falha("vazio", "A venda está vazia.");
      if (!(total > 0)) return falha("valor", "A venda ficou sem valor.");
      const desc = texto80(d.desc);
      naLoja(L, "venda", { id, dia: todayISO(), hora: horaAgora(), itens, total, pag: d.pag || "dinheiro", autor: L.eu, criado: Date.now(), ...(!itens.length || desc ? { desc } : {}) });
      return { ok: true, id, total };
    },
    // lojaVendaApagar { id }: some para todos da loja; item é para o Desfazer (lojaRestaurar)
    lojaVendaApagar: lojaApagar("venda"),
    // lojaPix { valor }: o Pix copia e cola com o valor e o QR (SVG; null se o gerador ainda não baixou). Não grava:
    // em "O Pix caiu", o app chama lojaVenda { pag: 'pix' }
    lojaPix: async ({ valor } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!valorOk(valor)) return falha("valor", "Coloque o valor da venda.");
      const cfg = L.config || {}, nome = cfg.recebedor || L.loja.nome, pf = N().perfil || {};
      const codigo = cfg.pix ? pixCopiaECola({ chave: cfg.pix, nome, cidade: cfg.cidade || pf.cidade || "", valor: centavos(valor) }) : "";
      if (!codigo) return falha("sem-pix", "Coloque a chave Pix da loja em Ajustes da loja.");
      const svg = await Promise.race([qrSvg(codigo).catch(() => null), new Promise(ok => setTimeout(() => ok(null), 8000))]);
      return { codigo, svg, nome };
    },
    // lojaGasto { id, valor, desc?, cat?, dia?, daGaveta? }: anota ou corrige (ao corrigir, a nota, os itens, quem
    // anotou e quando continuam)
    lojaGasto: (d = {}) => {
      const [L, f] = lojaPronta(true); if (f) return f;
      if (!valorOk(d.valor)) return falha("valor", "Coloque um valor maior que zero.");
      if (d.dia !== undefined && !dataOk(d.dia)) return falha("dia", "Confira a data do gasto.");
      const antes = idOk(d.id) ? L.gastos.find(g => g.id === d.id) : null;
      const g = naLoja(L, "gasto", {
        ...(antes || {}), id: antes ? antes.id : idOk(d.id) ? d.id : novoId(), valor: centavos(d.valor),
        desc: d.desc !== undefined ? texto80(d.desc) : antes ? antes.desc || "" : "",
        cat: CATS_LOJA.some(c => c.id === d.cat) ? d.cat : antes ? antes.cat || "outros" : "insumos",
        dia: dataOk(d.dia) ? d.dia : antes ? antes.dia : todayISO(),
        daGaveta: d.daGaveta !== undefined ? !!d.daGaveta : !!(antes && antes.daGaveta),
        autor: (antes && antes.autor) || L.eu, criado: antes ? antes.criado : Date.now(),
      });
      return { ok: true, id: g.id };
    },
    lojaGastoApagar: lojaApagar("gasto"),
    // lojaMov { id, tipo: retirada | reforco, valor, desc?, pessoal? }: tirar ou pôr dinheiro na gaveta. pessoal: a dona,
    // com o Pessoal ligado, leva a retirada para lá (vira uma entrada). Ao corrigir, o tipo e o "pessoal" ficam
    lojaMov: (d = {}) => {
      const [L, f] = lojaPronta(true); if (f) return f;
      const n = N();
      if (!valorOk(d.valor)) return falha("valor", "Coloque um valor maior que zero.");
      const antes = idOk(d.id) ? L.movs.find(m => m.id === d.id) : null;
      if (!antes && d.tipo !== "retirada" && d.tipo !== "reforco") return falha("tipo", "Escolha se o dinheiro saiu ou entrou na gaveta.");
      const tipo = antes ? antes.tipo : d.tipo, podePessoal = !antes && tipo === "retirada" && n.usaPessoal && L.souDona;
      const m = naLoja(L, "mov", {
        ...(antes || {}), id: antes ? antes.id : idOk(d.id) ? d.id : novoId(), tipo, valor: centavos(d.valor),
        desc: d.desc !== undefined ? texto80(d.desc) : antes ? antes.desc || "" : "",
        dia: antes ? antes.dia : todayISO(), hora: antes ? antes.hora : horaAgora(),
        pessoal: antes ? antes.pessoal : (podePessoal && !!d.pessoal) || undefined,
        autor: (antes && antes.autor) || L.eu, criado: antes ? antes.criado : Date.now(),
      });
      if (podePessoal && d.pessoal) entradaDaRetirada(n, m, L.loja.nome);
      return { ok: true, id: m.id, pessoal: !!m.pessoal };
    },
    // lojaMovApagar { id, comPessoal? }: o Desfazer de "Tirar ou pôr" (comPessoal: a entrada no Pessoal sai junto)
    lojaMovApagar: lojaApagar("mov"),
    // lojaFechar { dia?, troco, contado, deixou? }: fecha o caixa do dia (padrão hoje). O site refaz a conta do que
    // deveria ter na gaveta; o caixa do dia tem o id do dia (fechar de novo regrava)
    lojaFechar: (d = {}) => {
      const [L, f] = lojaPronta(true); if (f) return f;
      const hoje = todayISO(), dia = d.dia === undefined ? hoje : d.dia;
      if (!dataOk(dia) || dia > hoje) return falha("dia", "Escolha um dia que já chegou.");
      if (!zeroOk(d.contado)) return falha("contado", "Coloque quanto tem na gaveta.");
      if (d.troco !== undefined && !zeroOk(d.troco)) return falha("troco", "Confira o troco do começo.");
      if (d.deixou !== undefined && d.deixou !== null && !zeroOk(d.deixou)) return falha("deixou", "Confira o troco que fica para amanhã.");
      const G = gaveta(L, dia), T = totaisDia(L, dia), antes = G.fechado;
      const troco = d.troco !== undefined ? centavos(d.troco) : G.troco, contado = centavos(d.contado);
      const esperado = centavos(troco + G.vendas + G.reforcos - G.gastos - G.retiradas), dif = centavos(contado - esperado);
      const deixou = zeroOk(d.deixou) ? centavos(d.deixou) : Math.min(contado, troco || contado);
      naLoja(L, "caixa", { id: dia, dia, troco, contado, esperado, dif, deixou, por: L.eu, hora: horaAgora(), pix: T.porPag.pix, cartao: centavos(T.porPag.debito + T.porPag.credito), criado: antes ? antes.criado : Date.now() });
      return { ok: true, esperado, dif, deixou };
    },
    // lojaFaltaAdicionar { itens: [{ id, texto }] }: "2 leite condensado" vira 2× leite condensado (o app separa por
    // vírgula, ponto e vírgula e quebra de linha e manda um id por item; id que já está na lista não entra de novo)
    lojaFaltaAdicionar: ({ itens } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      const agora = Date.now(); let novos = 0;
      (Array.isArray(itens) ? itens : []).slice(0, 100).forEach((x, i) => {
        if (!x || typeof x.texto !== "string" || (idOk(x.id) && L.faltas.some(y => y.id === x.id))) return;
        const it = lerItem(x.texto.trim()), texto = texto80(it.texto);
        if (!texto) return;
        naLoja(L, "falta", { id: idOk(x.id) ? x.id : novoId(), texto, qtd: Math.min(99, Math.max(1, Math.round(it.qtd) || 1)), feito: false, criado: agora + i, autor: L.eu });
        novos++;
      });
      return { ok: true, novos };
    },
    // lojaFalta { id, feito }: marcar como comprado (o valor final, não "inverter")
    lojaFalta: ({ id, feito } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return { ...f, ok: false };
      const x = L.faltas.find(y => y.id === id); if (!x) return { ok: false };
      naLoja(L, "falta", { ...x, feito: !!feito, por: L.eu });
      return { ok: true };
    },
    // lojaFaltaTirar { ids }: tira da lista e devolve os itens como estavam (para o Desfazer)
    lojaFaltaTirar: ({ ids } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return { ...f, itens: [] };
      const s = new Set(Array.isArray(ids) ? ids : []), tirados = L.faltas.filter(x => s.has(x.id));
      tirados.forEach(x => daLojaFora(L, "falta", x.id));
      return { ok: tirados.length > 0, itens: tirados };
    },
    // lojaRestaurar { colecao: venda | gasto | falta | mov | produto, itens }: os Desfazer (os itens voltam como eram)
    lojaRestaurar: ({ colecao, itens } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!["venda", "gasto", "falta", "mov", "produto"].includes(colecao)) return { ok: false };
      const vale = x => x && typeof x === "object" && idOk(x.id) && (colecao === "falta" ? typeof x.texto === "string" && !!x.texto.trim()
        : colecao === "produto" ? typeof x.nome === "string" && !!x.nome.trim() && valorOk(x.preco)
        : dataOk(x.dia) && valorOk(colecao === "venda" ? x.total : x.valor));
      const lista = (Array.isArray(itens) ? itens : []).slice(0, 200).filter(vale);
      lista.forEach(x => naLoja(L, colecao, x));
      return { ok: lista.length > 0 };
    },
    // lojaComprei { id, total?, precos?, cat, daGaveta }: os itens marcados da lista viram um gasto (com o preço de
    // cada um, se veio), entram no "sempre falta" e saem da lista. Repetir com o mesmo id não anota de novo
    lojaComprei: (d = {}) => {
      const [L, f] = lojaPronta(true); if (f) return f;
      const ja = idOk(d.id) && L.gastos.find(g => g.id === d.id);
      if (ja) return { ok: true, id: ja.id, valor: centavos(ja.valor) };
      const feitos = L.faltas.filter(x => x.feito);
      if (!feitos.length) return falha("vazio", "Marque na lista o que você comprou.");
      const precos = d.precos && typeof d.precos === "object" ? d.precos : {};
      const preco = x => (valorOk(precos[x.id]) ? centavos(precos[x.id]) : 0);
      const valor = d.total !== undefined && d.total !== null ? (valorOk(d.total) ? centavos(d.total) : 0) : centavos(soma(feitos, preco));
      if (!(valor > 0)) return falha("valor", "Coloque quanto custou a compra.");
      const g = naLoja(L, "gasto", {
        id: idOk(d.id) ? d.id : novoId(), valor, desc: `Compras: ${feitos.map(x => x.texto).slice(0, 4).join(", ")}${feitos.length > 4 ? "…" : ""}`,
        cat: CATS_LOJA.some(c => c.id === d.cat) ? d.cat : "insumos", dia: todayISO(), daGaveta: !!d.daGaveta,
        itens: feitos.map(x => ({ nome: x.texto, qtd: x.qtd || 1, valor: preco(x) || null })), autor: L.eu, criado: Date.now(),
      });
      const faltou = { ...((L.config && L.config.faltou) || {}) };
      feitos.forEach(x => { const k = x.texto.toLowerCase(); faltou[k] = { texto: x.texto, n: ((faltou[k] && faltou[k].n) || 0) + 1 }; });
      naLoja(L, "config", { ...L.config, id: "loja", faltou });
      feitos.forEach(x => daLojaFora(L, "falta", x.id));
      return { ok: true, id: g.id, valor };
    },
    // lojaResumo { mes }: o resumo de um mês fora do retrato (os dias antes da janela do aparelho vêm somados da nuvem)
    lojaResumo: async ({ mes } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      const n = N(), hoje = todayISO();
      if (!L.veLucro) return falha("sem-lucro", "O resumo é de quem cuida da loja.");
      if (!mesOk(mes) || `${mes}-01` > hoje) return falha("mes", "Esse mês ainda não chegou.");
      const fim = ultimoDia(mes), de = `${mes}-01`, ate = fim > hoje ? hoje : fim;
      if (!n.lojaPro && fim < addDays(hoje, -(LIMITE_GRATIS.lojaDias - 1)))
        return falha("historico", `Na versão grátis, o resumo mostra os últimos ${LIMITE_GRATIS.lojaDias} dias. Nada se perde.`);
      let antigos = [];
      if (de < L.desde) {
        try { antigos = await L.resumo(de, addDays(L.desde, -1) < ate ? addDays(L.desde, -1) : ate); }
        catch (e) { return falha("sem-internet", "Para os meses antigos, o resumo precisa de internet."); }
      }
      return resumoDoPeriodo(L, de, ate, antigos);
    },
    // lojaFoto { id }: a foto de quem está na loja (o retrato só leva a chave dela, fotoK)
    lojaFoto: ({ id } = {}) => {
      const n = N(), L = n.usaLoja && n.loja, m = L && L.membros.find(x => x.id === id);
      return (m && m.foto) || null;
    },

    /* ===== Tudo o que antes abria uma tela do site, agora por pedido (no app, o site não aparece) ===== */

    /* ----- Consultório: cadastro completo do paciente ----- */
    // pacienteCadastro { id }: o cadastro para a tela de editar (sob demanda, nunca no retrato): dados administrativos,
    // valores, frequência e horário. Nada de anotações
    pacienteCadastro: ({ id } = {}) => {
      const n = consultorio(), p = n && n.db.patients.find(x => x.id === id);
      if (!p) return null;
      return {
        id: p.id, nome: p.name, fone: p.phone || "", cpf: p.cpf || "", cor: corDe(p).id, valor: centavos(p.price),
        sublocacao: Number(p.sublet) || 0, sublocacaoTipo: p.subletType === "percent" ? "porcento" : "fixo", liquido: centavos(liquido(p)),
        freq: p.freq, hora: p.time, proxima: p.nextDate || null, cobranca: p.billing === "package" ? "pacote" : "sessao", pacote: p.packageSize || 4,
        ativo: !!p.active, pagadorNome: p.pagadorNome || "", pagadorCpf: p.pagadorCpf || "", desde: p.desde || null,
        cores: CORES.map(c => ({ id: c.id, nome: c.nome, cor: c.cor, tinta: c.ink })),
      };
    },
    // pacienteSalvar { id, nome?, fone?, cpf?, cor?, valor?, sublocacao?, sublocacaoTipo?: fixo | porcento, freq?, hora?,
    // proxima?, cobranca?, pacote?, ativo?, pagadorNome?, pagadorCpf? }: cria (id novo) ou muda só o que veio, com as
    // regras do cadastro do site (valor maior que zero, sublocação até o valor). Paciente novo ou que volta a ficar
    // ativo passa pelo limite do plano grátis
    pacienteSalvar: (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (!idOk(d.id)) return falha("id", "Falta o id do cadastro.");
      const antes = n.db.patients.find(p => p.id === d.id), pf = n.perfil || {};
      const vem = k => d[k] !== undefined;
      const nome = vem("nome") ? String(d.nome || "").trim().slice(0, 80) : antes ? antes.name : "";
      if (!nome) return falha("nome", `Escreva o nome do ${TERMO.s}.`);
      if (vem("valor") && !valorOk(d.valor)) return falha("valor", "Falta o valor da sessão.");
      const price = vem("valor") ? centavos(d.valor) : antes ? antes.price : NaN;
      if (!(price > 0)) return falha("valor", "Falta o valor da sessão.");
      const subletType = vem("sublocacaoTipo") ? (d.sublocacaoTipo === "porcento" ? "percent" : "fixed") : antes ? antes.subletType || "fixed" : pf.subTipo || "fixed";
      if (vem("sublocacao") && !zeroOk(d.sublocacao)) return falha("valor", "Confira a sublocação.");
      const sublet = vem("sublocacao") ? Number(d.sublocacao) : antes ? Number(antes.sublet) || 0 : Number(pf.subPadrao) || 0;
      if (subletType === "percent" ? sublet > 100 : price - sublet < 0) return falha("valor", "A sublocação ficou maior que o valor da sessão.");
      const hora = vem("hora") ? d.hora : antes ? antes.time : null;
      if (!horaOk(hora)) return falha("hora", "Escolha o horário.");
      const proxima = vem("proxima") ? d.proxima : antes ? antes.nextDate : null;
      if (!dataOk(proxima)) return falha("data", "Escolha o dia da próxima sessão.");
      const f = vem("freq") ? Math.round(Number(d.freq)) : antes ? antes.freq : 7;
      if (!(f >= 1 && f <= 365)) return falha("freq", "Confira a frequência.");
      if (vem("cpf") && d.cpf && String(d.cpf).replace(/\D/g, "").length !== 11) return falha("cpf", "O CPF tem 11 números.");
      const ativo = vem("ativo") ? !!d.ativo : antes ? !!antes.active : true;
      if (ativo && !(antes && antes.active)) { const lim = limitePacApp(n, 1); if (lim) return lim; }
      const pacote = vem("cobranca") ? d.cobranca === "pacote" : antes ? antes.billing === "package" : false;
      const campos = {
        name: nome, price, sublet: subletType === "percent" ? sublet : centavos(sublet), subletType, time: hora, nextDate: proxima, freq: f, active: ativo,
        billing: pacote ? "package" : "session",
        packageSize: vem("pacote") ? Math.min(12, Math.max(2, Math.round(Number(d.pacote)) || 4)) : antes ? antes.packageSize || 4 : 4,
        ...(vem("fone") ? { phone: String(d.fone || "").trim().slice(0, 30) } : {}),
        ...(vem("cpf") ? { cpf: String(d.cpf || "").replace(/\D/g, "").slice(0, 11) } : {}),
        ...(vem("cor") && CORES.some(c => c.id === d.cor) ? { color: d.cor } : {}),
        ...(vem("pagadorNome") ? { pagadorNome: String(d.pagadorNome || "").trim().slice(0, 80) } : {}),
        ...(vem("pagadorCpf") ? { pagadorCpf: String(d.pagadorCpf || "").replace(/\D/g, "").slice(0, 11) } : {}),
        // mudou o valor: conta como reajuste (o lembrete da inflação recomeça daqui), como no cadastro do site
        ...(antes && price !== antes.price ? { reajusteEm: todayISO() } : {}),
      };
      n.setDb(db => {
        const x = db.patients.find(p => p.id === d.id);
        if (x) return { ...db, patients: db.patients.map(p => p.id === d.id ? { ...p, ...campos } : p) };
        return { ...db, patients: [...db.patients, { phone: "", pagadorNome: "", color: CORES[db.patients.length % CORES.length].id, ...campos, id: d.id, desde: todayISO() }] };
      });
      return { ok: true, id: d.id, novo: !antes };
    },
    // pacienteExcluir { id }: o cadastro sai da agenda (as sessões e cobranças de antes ficam, como no site). Sem desfazer
    pacienteExcluir: ({ id } = {}) => {
      const n = consultorio(), tem = !!n && n.db.patients.some(p => p.id === id);
      if (tem) n.setDb(db => ({ ...db, patients: db.patients.filter(p => p.id !== id) }));
      return { ok: tem };
    },
    // esperaFicha { id }: a pessoa da lista de espera com o WhatsApp e a observação (para editar; fora do retrato)
    esperaFicha: ({ id } = {}) => {
      const n = consultorio(), e = n && (n.db.espera || []).find(x => x.id === id);
      return e ? { id: e.id, nome: e.nome || "", fone: e.phone || "", pref: PREFS.includes(e.pref) ? e.pref : "qualquer", obs: e.obs || "", desde: e.desde || null } : null;
    },
    // sessaoConfirmacao { pid, data }: o recado de confirmação da véspera (o mesmo texto da folha "Confirmar" do site,
    // telas/paineis.jsx) e o WhatsApp. O app manda e marca com sessaoConfirmada
    sessaoConfirmacao: ({ pid, data } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const it = dataOk(data) && itensDoDia(n.db, data).find(i => i.kind !== "log" && i.patient.id === pid);
      if (!it) return falha("nao-achei", "Não achei essa sessão na agenda.");
      const p = it.patient;
      return { texto: `Oi, ${primeiro(p.name)}! Tudo bem? Confirmando nossa sessão ${data === addDays(todayISO(), 1) ? "amanhã" : `de ${DIA_LONGO[fromISO(data).getDay()]}`} (${dm(data)}) às ${it.time}. Até lá!`, fone: foneWa(p.phone) };
    },

    /* ----- Consultório: link de agendamento e ajustes ----- */
    // linkAgendamento: as regras do link, o endereço e quantos horários aparecem nele agora
    linkAgendamento: () => {
      const n = consultorio(); if (!n) return semConsultorio();
      return estadoDoLink(n);
    },
    // linkAjustar { ativo?, quem?: todos | pacientes, antecedencia?: 2 | 12 | 24 | 48, semanas?: 1 | 2 | 4 }: muda as regras
    // (o link se publica sozinho depois). Volta o mesmo de linkAgendamento
    linkAjustar: (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const cfg = linkDo(perfilAtual(n)), mud = {};
      if (d.ativo !== undefined) mud.ativo = !!d.ativo;
      if (d.quem !== undefined) { if (!["todos", "pacientes"].includes(d.quem)) return falha("quem", "Escolha quem pode pedir."); mud.quem = d.quem; }
      if (d.antecedencia !== undefined) { if (![2, 12, 24, 48].includes(Number(d.antecedencia))) return falha("antecedencia", "Escolha a antecedência."); mud.antecedencia = Number(d.antecedencia); }
      if (d.semanas !== undefined) { if (![1, 2, 4].includes(Number(d.semanas))) return falha("semanas", "Escolha quantas semanas aparecem."); mud.semanas = Number(d.semanas); }
      const pf = mudarPerfil(n, { link: { ...cfg, ...mud } });
      return estadoDoLink(n, pf);
    },
    // linkCriar: cria o link (na primeira vez) e publica os horários de agora; também busca os pedidos que chegaram.
    // Precisa da conta com login e de internet
    linkCriar: async () => {
      const n = consultorio(); if (!n) return semConsultorio();
      const L = n.linkAg;
      if (!L || !L.pode) return falha("sem-login", "O link de agendamento precisa da sua conta com login (com a cópia na nuvem) e de internet.");
      try {
        const endereco = await L.publicar(true);
        L.buscar();
        return { ok: true, url: enderecoLink(endereco) || null };
      } catch (e) { return falha("sem-internet", String((e && e.message) || "Sem internet agora. Tente de novo em instantes.")); }
    },
    // consultorioAjustes: os ajustes do consultório (agenda, valores, faltas, Pix e os seus dados no recibo), para as
    // telas de ajuste do app
    consultorioAjustes: async () => {
      const n = consultorio(); if (!n) return semConsultorio();
      const pf = perfilAtual(n), doc = pf.doc || {}, C = await import("./telas/consultorio.jsx");
      return {
        pix: (n.db.settings && n.db.settings.pix) || "", duracao: pf.duracao || 50, duracoes: [30, 40, 45, 50, 60],
        falta: pf.falta ? { cobrar: !!pf.falta.cobrar, horas: pf.falta.horas || 24 } : { cobrar: false, horas: 24 },
        registro: pf.registro !== false, reserva: Number(pf.reserva) || 0, meta: Number(pf.meta) || 0,
        valorPadrao: Number(pf.valorPadrao) || 0, subPadrao: Number(pf.subPadrao) || 0, subTipo: pf.subTipo === "percent" ? "porcento" : "fixo",
        termo: pf.termo || "Paciente", profissao: pf.profissao || "", cidade: pf.cidade || "",
        grade: gradeDo(pf), periodos: periodosDo(pf), modelos: MODELOS.map(m => ({ id: m.id, nome: m.nome, grade: m.grade })),
        doc: { nome: doc.nome || "", cpf: doc.cpf || "", registro: doc.registro || "", endereco: doc.endereco || "", assinatura: doc.assinatura || null, conselho: C.conselhoDe(pf.profissao) },
      };
    },
    // consultorioAjustar { pix?, duracao?, falta?: { cobrar, horas }, registro?, reserva?, meta?, valorPadrao?, subPadrao?,
    // subTipo?: fixo | porcento, termo?, profissao?, cidade?, grade?: { 0..6: [manha|tarde|noite] }, periodos?: { manha:
    // [8, 12], ... }, doc?: { nome, cpf, registro, endereco, assinatura (data:image/png ou "") } }: muda só o que veio
    consultorioAjustar: (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const pf = perfilAtual(n), mud = {};
      const num = (k, min, max) => { if (d[k] === undefined) return true; const v = Number(d[k]); if (!Number.isFinite(v) || v < min || v > max) return false; mud[k] = Math.round(v * 100) / 100; return true; };
      if (!num("duracao", 10, 240)) return falha("duracao", "Confira a duração da sessão.");
      if (mud.duracao) mud.duracao = Math.round(mud.duracao);
      if (!num("reserva", 0, 60) || !num("meta", 0, 1e7) || !num("valorPadrao", 0, 1e7) || !num("subPadrao", 0, 1e7)) return falha("valor", "Confira os valores.");
      if (d.registro !== undefined) mud.registro = !!d.registro;
      if (d.falta !== undefined) {
        const h = Math.round(Number(d.falta && d.falta.horas));
        if (!d.falta || typeof d.falta !== "object" || !(h >= 0 && h <= 168)) return falha("falta", "Confira a regra de faltas.");
        mud.falta = { cobrar: !!d.falta.cobrar, horas: h };
      }
      if (d.subTipo !== undefined) mud.subTipo = d.subTipo === "porcento" ? "percent" : "fixed";
      if (d.termo !== undefined) { if (!["Paciente", "Analisando", "Cliente"].includes(d.termo)) return falha("termo", "Escolha como chamar quem você atende."); mud.termo = d.termo; }
      if (d.profissao !== undefined) mud.profissao = String(d.profissao || "").trim().slice(0, 40);
      if (d.cidade !== undefined) mud.cidade = String(d.cidade || "").trim().slice(0, 60);
      if (d.grade !== undefined || d.periodos !== undefined) {
        const grade = d.grade !== undefined ? d.grade : gradeDo(pf), periodos = d.periodos !== undefined ? d.periodos : periodosDo(pf);
        const gOk = grade && typeof grade === "object" && Object.entries(grade).every(([k, v]) => /^[0-6]$/.test(k) && Array.isArray(v) && v.every(x => PERIODOS.includes(x)));
        const pOk = periodos && typeof periodos === "object" && Object.entries(periodos).every(([k, v]) => PERIODOS.includes(k) && Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 0 && v[1] <= 24 && v[0] < v[1]);
        if (!gOk || !pOk) return falha("agenda", "Confira os dias e os horários de atendimento.");
        const g = Object.fromEntries(Object.entries(grade).map(([k, v]) => [k, PERIODOS.filter(x => v.includes(x))]));
        Object.assign(mud, { grade: g, periodos }, resumoGrade(g, periodos)); // horaIni, horaFim e diasTrab, como o Perfil do site
      }
      if (d.doc !== undefined) {
        const x = d.doc || {}, doc = { ...(pf.doc || {}) };
        if (x.nome !== undefined) doc.nome = String(x.nome || "").trim().slice(0, 100);
        if (x.cpf !== undefined) { const c = String(x.cpf || "").replace(/\D/g, ""); if (c && c.length !== 11) return falha("cpf", "O CPF tem 11 números."); doc.cpf = c; }
        if (x.registro !== undefined) doc.registro = String(x.registro || "").trim().slice(0, 40);
        if (x.endereco !== undefined) doc.endereco = String(x.endereco || "").trim().slice(0, 160);
        if (x.assinatura !== undefined) {
          if (x.assinatura && !(typeof x.assinatura === "string" && /^data:image\/png;base64,/.test(x.assinatura) && x.assinatura.length < 400000)) return falha("assinatura", "Não consegui usar essa assinatura. Assine de novo.");
          doc.assinatura = x.assinatura || "";
        }
        mud.doc = doc;
      }
      if (d.pix !== undefined) { const pix = String(d.pix || "").trim().slice(0, 120); n.setDb(db => ({ ...db, settings: { ...db.settings, pix } })); }
      if (Object.keys(mud).length) mudarPerfil(n, mud);
      return { ok: true };
    },

    /* ----- Consultório: recibo e imposto (PDF em base64: o app compartilha pelo celular) ----- */
    // reciboPrevia { pid, mes?, ids?, servico?, cpf?, outroPaga?, pagadorNome?, pagadorCpf? }: os pagamentos que dão
    // recibo (os do mês escolhido; padrão o mais novo) e o texto do recibo, como a folha do site mostra
    reciboPrevia: async (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const r = await recibo(n, d); if (r.ok === false) return r;
      const { p, todos, mes, doMes, escolhidos, R, op, pf } = r, doc = pf.doc || {};
      return {
        meses: [...new Set(todos.map(c => c.paidAt.slice(0, 7)))], mes,
        pagamentos: doMes.map(c => ({ id: c.id, valor: centavos(c.amount), pagaEm: c.paidAt, datas: (c.sessionIds || []).map(id => (n.db.sessions.find(s => s.id === id) || {}).date).filter(Boolean).sort(), recibo: c.reciboEm || null })),
        ids: escolhidos.map(c => c.id), valor: centavos(R.valor), texto: R.texto, data: R.dataRecibo, ...op,
        nome: p.name, faltaDados: !doc.nome || !doc.registro || !doc.cpf, temAssinatura: !!doc.assinatura,
      };
    },
    // reciboPdf { pid, ids, servico?, cpf?, outroPaga?, pagadorNome?, pagadorCpf?, marcar? }: o PDF do recibo em base64.
    // Guarda o CPF e quem paga no cadastro (como a folha do site) e marca os pagamentos como "recibo feito"
    // (marcar: false não marca, para quando a pessoa desistiu de mandar)
    reciboPdf: async (d = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const r = await recibo(n, d); if (r.ok === false) return r;
      const { p, escolhidos, R, op, C } = r;
      if (!escolhidos.length) return falha("vazio", "Escolha pelo menos um pagamento.");
      let base64;
      try { base64 = await base64De(await C.pdfRecibo(R.pdf)); } catch (e) { return falha("pdf", "Não consegui gerar o PDF. Tente de novo."); }
      const ids = new Set(escolhidos.map(c => c.id)), hoje = todayISO();
      const cad = { cpf: String(op.cpf || "").replace(/\D/g, ""), pagadorNome: op.outroPaga ? String(op.pagadorNome || "").trim() : "", pagadorCpf: op.outroPaga ? String(op.pagadorCpf || "").replace(/\D/g, "") : "" };
      n.setDb(db => ({ ...db, patients: db.patients.map(x => x.id === p.id ? { ...x, ...cad } : x),
        charges: d.marcar === false ? db.charges : db.charges.map(c => ids.has(c.id) ? { ...c, reciboEm: hoje } : c) }));
      const mes = escolhidos.map(c => c.paidAt).sort().slice(-1)[0].slice(0, 7);
      return { nome: C.nomeDoRecibo(p, mes), tipo: "application/pdf", base64, valor: centavos(R.valor), texto: R.texto };
    },
    // impostoResumo { ano? }: o relatório do Imposto de Renda (Receita Saúde e Carnê-Leão): o ano, mês a mês, com os
    // CPFs de quem foi atendido e de quem pagou (o que se digita no Receita Saúde). Sob demanda, fora do retrato
    impostoResumo: async ({ ano } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      const C = await import("./telas/consultorio.jsx"), todos = C.pagos(n.db);
      const anos = [...new Set([todayISO().slice(0, 4), ...todos.map(c => c.paidAt.slice(0, 4))])].sort().reverse();
      const a = /^\d{4}$/.test(String(ano || "")) ? String(ano) : anos[0];
      const I = C.impostoDoAno(n.db, a);
      const pac = id => n.db.patients.find(p => p.id === id);
      return {
        anos, ano: a, total: centavos(I.total), pagamentos: I.doAno.length, sublocacao: centavos(I.subl), receitaSaude: I.doAno.filter(c => c.rsaude).length,
        semCpf: [...new Set(I.doAno.filter(c => !(pac(c.patientId) || {}).cpf).map(c => c.patientId))].map(pid => ({ pid, nome: (pac(pid) || { name: "Removido" }).name })),
        meses: I.meses.map(m => ({ chave: m.ch, total: centavos(m.total), itens: m.cs.map(c => { const l = C.linhaImposto(n.db, c); return { id: c.id, pid: c.patientId, data: l.data, nome: l.nome, cpf: l.cpf, pagador: l.pagador, cpfPag: l.cpfPag, valor: centavos(l.valor), sessoes: l.sessoes, rsaude: !!c.rsaude }; }) })),
      };
    },
    // impostoMarcar { id, feito }: "emitido no Receita Saúde" (o valor final)
    impostoMarcar: ({ id, feito } = {}) => {
      const n = consultorio(), tem = !!n && n.db.charges.some(c => c.id === id);
      if (tem) n.setDb(db => ({ ...db, charges: db.charges.map(c => c.id === id ? { ...c, rsaude: !!feito } : c) }));
      return { ok: tem };
    },
    // impostoArquivo { ano, tipo: pdf | csv }: o PDF para o contador (base64) ou a planilha (texto)
    impostoArquivo: async ({ ano, tipo } = {}) => {
      const n = consultorio(); if (!n) return semConsultorio();
      if (!/^\d{4}$/.test(String(ano || ""))) return falha("ano", "Escolha o ano.");
      const C = await import("./telas/consultorio.jsx");
      if (tipo === "csv") return { nome: `Recebimentos ${ano}.csv`, tipo: "text/csv", csv: C.csvImposto(n.db, String(ano)) };
      try { return { nome: `Recebimentos ${ano}.pdf`, tipo: "application/pdf", base64: await base64De(await C.pdfImposto(n.db, n.conta, String(ano))) }; }
      catch (e) { return falha("pdf", "Não consegui gerar o PDF. Tente de novo."); }
    },

    /* ----- Loja: criar, produtos, ajustes e equipe ----- */
    // lojaCriar { nome }: abre a loja (com login, na nuvem; sem login, no aparelho). Já tem: ok
    lojaCriar: async ({ nome } = {}) => {
      const n = N(); if (!n.usaLoja) return falha("loja", "Para isso, ligue a Loja em Perfil → Como você usa o app.");
      const L = n.loja; if (L.loja) return { ok: true };
      if (L.estado === "carregando") return falha("carregando", "A loja ainda está abrindo. Tente de novo em instantes.");
      try { await L.criar(String(nome || "").trim().slice(0, 60) || "Minha loja"); return { ok: true }; }
      catch (e) { return falha("nuvem", erroLoja(e)); }
    },
    // lojaProduto { id, nome?, preco?, cor?, ativo? }: cria ou muda um produto do caixa (cor: um id de CORES_PRODUTO)
    lojaProduto: (d = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!idOk(d.id)) return falha("id", "Falta o id do produto.");
      const antes = L.produtos.find(p => p.id === d.id);
      const nome = d.nome !== undefined ? String(d.nome || "").trim().slice(0, 40) : antes ? antes.nome : "";
      if (!nome) return falha("nome", "Escreva o nome do produto.");
      if (d.preco !== undefined && !valorOk(d.preco)) return falha("preco", "Coloque o preço.");
      const preco = d.preco !== undefined ? centavos(d.preco) : antes ? antes.preco : 0;
      if (!(preco > 0)) return falha("preco", "Coloque o preço.");
      naLoja(L, "produto", { ...(antes || {}), id: d.id, nome, preco,
        cor: CORES_PRODUTO.includes(d.cor) ? d.cor : antes ? antes.cor : CORES_PRODUTO[L.produtos.length % CORES_PRODUTO.length],
        ativo: d.ativo === undefined ? true : !!d.ativo, ordem: antes ? antes.ordem : L.produtos.length, criado: antes ? antes.criado : Date.now() });
      return { ok: true, id: d.id };
    },
    // lojaProdutoTirar { id }: o botão some do caixa (as vendas de antes continuam). item é para o Desfazer (lojaProduto
    // com ativo: true, ou lojaRestaurar)
    lojaProdutoTirar: ({ id } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return { ...f, item: null };
      const p = L.produtos.find(x => x.id === id);
      if (p) naLoja(L, "produto", { ...p, ativo: false });
      return { ok: !!p, item: p || null };
    },
    // lojaProdutosOrdem { ids }: a ordem dos botões do caixa
    lojaProdutosOrdem: ({ ids } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      (Array.isArray(ids) ? ids : []).forEach((id, i) => { const p = L.produtos.find(x => x.id === id); if (p && p.ordem !== i) naLoja(L, "produto", { ...p, ordem: i }); });
      return { ok: true };
    },
    // lojaAjustes: nome, Pix (chave, nome e cidade no Pix) e a equipe, para a tela de ajustes da loja
    lojaAjustes: () => {
      const [L, f] = lojaPronta(false); if (f) return f;
      const n = N(), cfg = L.config || {}, ajudantes = L.membros.filter(m => m.id !== L.loja.dono).length;
      return {
        nome: L.loja.nome, pix: cfg.pix || "", recebedor: cfg.recebedor || "", cidade: cfg.cidade || (n.perfil && n.perfil.cidade) || "",
        souDona: !!L.souDona, nuvem: !!L.nuvem, maxAjudantes: MAX_AJUDANTES, ajudantes,
        // a equipe é do plano de quem criou a loja: na versão grátis, só a dona anota (texto neutro)
        equipe: !!n.lojaPro, podeConvidar: !!L.souDona && !!L.nuvem && !!n.lojaPro && ajudantes < MAX_AJUDANTES,
        avisoEquipe: n.lojaPro ? null : "Na versão grátis, a loja é só sua.",
        membros: L.membros.map(m => ({ id: m.id, nome: m.nome || "", papel: m.id === L.loja.dono ? "dono" : "ajudante", veLucro: m.id === L.loja.dono || !!m.veLucro, eu: m.id === L.eu })),
      };
    },
    // lojaAjustar { nome?, pix?, recebedor?, cidade? }: só quem criou a loja
    lojaAjustar: async (d = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!L.souDona) return falha("so-a-dona", "Quem cuida dos ajustes é quem criou a loja.");
      const cfg = { ...L.config, id: "loja" };
      if (d.pix !== undefined) cfg.pix = String(d.pix || "").trim().slice(0, 120);
      if (d.recebedor !== undefined) cfg.recebedor = String(d.recebedor || "").trim().slice(0, 25);
      if (d.cidade !== undefined) cfg.cidade = String(d.cidade || "").trim().slice(0, 15);
      if (["pix", "recebedor", "cidade"].some(k => d[k] !== undefined)) naLoja(L, "config", cfg);
      const nome = d.nome !== undefined ? String(d.nome || "").trim().slice(0, 60) : "";
      if (nome && nome !== L.loja.nome) { try { await L.renomear(nome); } catch (e) { return falha("nuvem", erroLoja(e)); } }
      return { ok: true };
    },
    // lojaConvidar: o link de convite para quem ajuda (vale 7 dias) e o texto para mandar
    lojaConvidar: async () => {
      const [L, f] = lojaPronta(false); if (f) return f;
      const n = N();
      if (!L.souDona) return falha("so-a-dona", "Só quem criou a loja pode convidar.");
      if (!L.nuvem) return falha("sem-login", "Para ter equipe, entre com a sua conta (e-mail e senha).");
      if (!n.lojaPro) return falha("equipe", "Na versão grátis, a loja é só sua.");
      if (L.membros.filter(m => m.id !== L.loja.dono).length >= MAX_AJUDANTES) return falha("cheia", `A loja já tem ${MAX_AJUDANTES} ajudantes.`);
      try {
        const url = await L.convidar();
        return { ok: true, url, texto: `${primeiro(String((n.conta && n.conta.nome) || ""))} te chamou para ajudar a anotar o caixa da ${L.loja.nome} no Avina. Abra o link, crie sua conta (é grátis para quem ajuda) e você entra na loja.` };
      } catch (e) { return falha("nuvem", erroLoja(e)); }
    },
    // lojaVerLucro { id, ve }: deixa quem ajuda ver os gastos, o lucro e o resumo (só a dona)
    lojaVerLucro: async ({ id, ve } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!L.souDona) return falha("so-a-dona", "Só quem criou a loja pode fazer isso.");
      if (!L.membros.some(m => m.id === id) || id === L.eu) return falha("nao-achei", "Essa pessoa não está na loja.");
      try { await L.deixarVerLucro(id, !!ve); return { ok: true }; } catch (e) { return falha("nuvem", erroLoja(e)); }
    },
    // lojaTirarPessoa { id }: a pessoa deixa de ver a loja (o que ela anotou continua). Só a dona
    lojaTirarPessoa: async ({ id } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!L.souDona) return falha("so-a-dona", "Só quem criou a loja pode fazer isso.");
      if (!L.membros.some(m => m.id === id) || id === L.eu) return falha("nao-achei", "Essa pessoa não está na loja.");
      try { await L.tirar(id); return { ok: true }; } catch (e) { return falha("nuvem", erroLoja(e)); }
    },
    // lojaSair: sair da loja (sozinha na loja, ela e tudo o que foi anotado somem: o app confirma antes)
    lojaSair: async () => {
      const [L, f] = lojaPronta(false); if (f) return f;
      try { await L.sair(); return { ok: true }; } catch (e) { return falha("nuvem", erroLoja(e)); }
    },
    // lojaConvite { token }: de quem é o convite (antes de entrar)
    lojaConvite: async ({ token } = {}) => {
      const n = N(), L = n.loja;
      if (!L || !L.nuvem) return falha("sem-login", "Para entrar numa loja, use a sua conta com e-mail e senha.");
      try { const i = await L.verConvite(String(token || "")); return i && i.valido ? { ok: true, loja: i.loja || "", convidou: i.convidou || "" } : falha("convite", erroLoja("convite invalido")); }
      catch (e) { return falha("nuvem", erroLoja(e)); }
    },
    // lojaEntrar { token }: entra na loja (e a Loja passa a aparecer no app, como no site)
    lojaEntrar: async ({ token } = {}) => {
      const n = N(), L = n.loja;
      if (!L || !L.nuvem) return falha("sem-login", "Para entrar numa loja, use a sua conta com e-mail e senha.");
      try { await L.entrar(String(token || "")); } catch (e) { return falha("nuvem", erroLoja(e)); }
      if (!n.usaLoja) mudarPerfil(n, { loja: true });
      return { ok: true };
    },

    /* ----- Loja: caixa de outro dia, corrigir venda, nota do fornecedor ----- */
    // lojaCaixaDia { dia }: as contas da gaveta e do dia (para fechar o caixa de um dia que passou)
    lojaCaixaDia: ({ dia } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      if (!dataOk(dia) || dia > todayISO()) return falha("dia", "Escolha um dia que já chegou.");
      const T = totaisDia(L, dia), G = gaveta(L, dia), x = G.fechado;
      return {
        dia, vendas: T.vendas, entrou: T.entrou, porPag: T.porPag, saiu: L.veLucro ? T.saiu : null,
        gaveta: { troco: G.troco, vendas: G.vendas, gastos: G.gastos, reforcos: G.reforcos, retiradas: G.retiradas, esperado: G.esperado,
          fechado: x ? { contado: centavos(x.contado), dif: centavos(x.dif), deixou: x.deixou != null ? centavos(x.deixou) : null, hora: x.hora || "", por: x.por || null } : null },
        movs: T.movs.map(m => ({ id: m.id, tipo: m.tipo === "reforco" ? "reforco" : "retirada", valor: centavos(m.valor), desc: m.desc || null, hora: m.hora || "" })),
      };
    },
    // lojaVendaCorrigir { id, valor?, desc?, pag? }: corrige uma venda (a de produtos mantém o total)
    lojaVendaCorrigir: (d = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      const v = L.vendas.find(x => x.id === d.id);
      if (!v) return falha("nao-achei", "Não achei essa venda. Ela pode ter sido apagada.");
      if (d.pag !== undefined && !PAGAMENTOS.some(p => p.id === d.pag)) return falha("pag", "Escolha como a venda foi paga.");
      const comItens = !!(v.itens && v.itens.length);
      if (!comItens && d.valor !== undefined && !valorOk(d.valor)) return falha("valor", "Coloque o valor da venda.");
      naLoja(L, "venda", { ...v, total: comItens || d.valor === undefined ? v.total : centavos(d.valor), desc: d.desc !== undefined ? texto80(d.desc) : v.desc || "", pag: d.pag || v.pag });
      return { ok: true };
    },
    // lojaNotaLer { texto? (QR code, link ou chave da nota) , foto? (data:image/jpeg) }: lê a nota do fornecedor (pelo QR
    // a Sefaz; pela foto a IA, com a permissão da pessoa). Volta a nota (ref para salvar), de que loja é e os itens da
    // lista que vieram nela. Sem dar pelo QR: erro com foto: true (o app oferece a foto)
    lojaNotaLer: async ({ texto, foto } = {}) => {
      const [L, f] = lojaPronta(false); if (f) return f;
      return lerNota(L, texto, foto);
    },
    // lojaNotaSalvar { id, ref, tirar?: [índices dos itens que não vão], cat? }: a nota vira um gasto da loja com os itens,
    // e o que estava faltando e veio na nota sai da lista
    lojaNotaSalvar: (d = {}) => {
      const [L, f] = lojaPronta(true); if (f) return f;
      if (idOk(d.id)) { const ja = L.gastos.find(g => g.id === d.id); if (ja) return { ok: true, id: ja.id, valor: centavos(ja.valor), tirados: [] }; }
      const lida = NOTAS_LIDAS.get(d.ref);
      if (!lida) return falha("nota", "Leia a nota de novo, por favor.");
      const fora = new Set(Array.isArray(d.tirar) ? d.tirar : []);
      const { _tr, recusa, bloqueio, ...n0 } = lida.nota;
      const itens = n0.itens.filter((_, i) => !fora.has(i));
      const nota = { ...n0, itens, total: fora.size ? centavos(Math.max(0, n0.total - soma(n0.itens.filter((_, i) => fora.has(i)), x => x.valor))) : n0.total,
        ...(lida.quem ? { loja: lida.quem.nome, cnpj: lida.quem.cnpj || n0.cnpj } : {}) };
      if (!(nota.total > 0)) return falha("valor", "A nota ficou sem valor.");
      const naNota = L.faltas.filter(x => itens.some(i => combina(x.texto, i.nome)));
      const g = naLoja(L, "gasto", { id: idOk(d.id) ? d.id : novoId(), valor: nota.total, desc: nomeLoja(nota.loja) || "Compra com nota",
        cat: CATS_LOJA.some(c => c.id === d.cat) ? d.cat : (lida.quem && lida.quem.catLoja) || "insumos", dia: nota.data || todayISO(), nota, autor: L.eu, criado: Date.now() });
      naNota.forEach(x => daLojaFora(L, "falta", x.id));
      NOTAS_LIDAS.delete(d.ref);
      return { ok: true, id: g.id, valor: nota.total, tirados: naNota.map(x => x.id) };
    },
  };
}
