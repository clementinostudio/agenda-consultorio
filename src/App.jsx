/*
  Agenda do Consultório
  ---------------------
  O app inteiro está neste arquivo, separado em seções numeradas (procure por "====").
  Para mudar textos, valores padrão, cores de paciente ou categorias, comece pela seção 1 (CONFIGURAÇÃO).
  Os estilos ficam em src/styles.css e as imagens de fundo em public/fundos/.
*/
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal, flushSync } from "react-dom";

// Caminho base do app (no GitHub Pages é /nome-do-repositorio/)
const BASE = import.meta.env.BASE_URL;

/* =========================================================
   1. CONFIGURAÇÃO — mude aqui com facilidade
   ========================================================= */
let DURACAO_SESSAO = 50;       // minutos de cada sessão (vem do perfil)
const INTERVALO_MIN = 45;      // a partir de quantos minutos mostra "intervalo livre"
const TEMA_PADRAO = "dark";    // "dark", "light" ou "auto"
const FREQUENCIAS = [
  { dias: 7,  nome: "Semanal" },
  { dias: 14, nome: "Quinzenal" },
  { dias: 28, nome: "Mensal" },
];
// Cores do paciente na agenda
const CORES = [
  { id: "azul",    nome: "Azul",    cor: "#4A62FF", ink: "#FFFFFF" },
  { id: "roxo",    nome: "Roxo",    cor: "#8B6CFF", ink: "#FFFFFF" },
  { id: "rosa",    nome: "Rosa",    cor: "#FF6FA8", ink: "#FFFFFF" },
  { id: "coral",   nome: "Coral",   cor: "#FF6B5E", ink: "#FFFFFF" },
  { id: "laranja", nome: "Laranja", cor: "#FF9A4C", ink: "#2A1405" },
  { id: "amarelo", nome: "Amarelo", cor: "#FFC93D", ink: "#2A1F00" },
  { id: "verde",   nome: "Verde",   cor: "#2FCB8E", ink: "#04261A" },
  { id: "ciano",   nome: "Ciano",   cor: "#3CC4E6", ink: "#04232C" },
];
// Categorias do modo Pessoal (cor vem da lista acima)
const CATEGORIAS = [
  { id: "mercado",    nome: "Mercado",     cor: "verde",   ic: "cart" },
  { id: "casa",       nome: "Casa",        cor: "azul",    ic: "home" },
  { id: "transporte", nome: "Transporte",  cor: "ciano",   ic: "car" },
  { id: "comida",     nome: "Comida fora", cor: "laranja", ic: "food" },
  { id: "saude",      nome: "Saúde",       cor: "rosa",    ic: "heart" },
  { id: "lazer",      nome: "Lazer",       cor: "roxo",    ic: "star" },
  { id: "compras",    nome: "Compras",     cor: "coral",   ic: "bag" },
  { id: "outros",     nome: "Outros",      cor: "amarelo", ic: "more" },
];
const CAT_ENTRADA = [
  { id: "trabalho", nome: "Trabalho", cor: "verde",   ic: "money" },
  { id: "extra",    nome: "Extra",    cor: "ciano",   ic: "star" },
  { id: "presente", nome: "Presente", cor: "rosa",    ic: "heart" },
  { id: "outros-e", nome: "Outros",   cor: "amarelo", ic: "more" },
];
const AVISOS_PADRAO_DEMO = { ativo: true, antecedencia: 15, som: true };
// Respostas das perguntas iniciais da conta de demonstração
const PERFIL_DEMO = { reserva: 15, falta: { cobrar: true, horas: 24 }, registro: true, horaIni: 8, horaFim: 20, diasTrab: [1, 2, 3, 4, 5], nascimento: "1993-03-14", profissao: "Psicologia", termo: "Paciente", duracao: 50, valorPadrao: 110, subPadrao: 25, subTipo: "fixed", meta: 4000, estilo: "detalhado", pessoal: true, cidade: "Curitiba", avisos: AVISOS_PADRAO_DEMO };
const CONTA_DEMO = { nome: "Camila", email: "demo@consultorio.app", demo: true, perfil: PERFIL_DEMO };
const PROFISSOES = [
  { id: "Psicologia", termo: "Paciente" }, { id: "Psicanálise", termo: "Analisando" }, { id: "Psiquiatria", termo: "Paciente" },
  { id: "Terapia ocupacional", termo: "Paciente" }, { id: "Fonoaudiologia", termo: "Paciente" }, { id: "Nutrição", termo: "Paciente" },
  { id: "Fisioterapia", termo: "Paciente" }, { id: "Coaching", termo: "Cliente" },
];
const DURACOES = [30, 40, 45, 50, 60];
const K = { contas: "agenda-contas", sessao: "agenda-sessao", tema: "agenda-tema", oculto: "agenda-oculto", db: e => `agenda-db:${e}`, modo: e => `agenda-modo:${e}`, avisos: e => `agenda-avisos:${e}` };

/* =========================================================
   2. DATAS, HORAS E DINHEIRO
   ========================================================= */
const DIA_CURTO = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIA_LONGO = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
const SEMANA = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const MES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MES_LONGO = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const todayISO = () => toISO(new Date());
const segunda = iso => addDays(iso, -((fromISO(iso).getDay() + 6) % 7));
const diasNoMes = chave => { const [y, m] = chave.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const dm = iso => { const d = fromISO(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const diaCurto = iso => { const d = fromISO(iso); return `${DIA_CURTO[d.getDay()].toLowerCase()}, ${d.getDate()} ${MES_CURTO[d.getMonth()]}`; };
const relativo = iso => {
  const t = todayISO();
  if (iso === t) return "Hoje";
  if (iso === addDays(t, 1)) return "Amanhã";
  if (iso === addDays(t, -1)) return "Ontem";
  return diaCurto(iso);
};
const mins = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const duracao = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ""}`;
const agoraMin = d => d.getHours() * 60 + d.getMinutes();
const diffDias = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);

// Valores escondidos (olho): brl e Money respeitam isso
let ESCONDER = false;
// Palavra usada para quem a pessoa atende (Paciente, Cliente, Analisando)
const termoDe = S => ({ S, s: S.toLowerCase(), P: S + "s", p: S.toLowerCase() + "s" });
let TERMO = termoDe("Paciente");
let ESTILO = "detalhado"; // "curto" mostra menos frases no resumo
let PERFIL = {};          // respostas do perfil, lidas por várias partes do app
// Fundos que já vêm no app (arquivos em public/fundos/). Para adicionar um, coloque a imagem lá e inclua uma linha aqui.
const FUNDOS = [["floresta", "Floresta"], ["mar", "Mar à noite"], ["estrada", "Entardecer"]]
  .map(([id, nome]) => ({ id, nome, img: `${BASE}fundos/${id}.jpg`, thumb: `${BASE}fundos/${id}-mini.jpg` }));
const imagemFundo = (f, meus = []) => !f ? null : f.id === "meu" ? f.img : f.id.startsWith("u:") ? (meus.find(m => "u:" + m.id === f.id) || {}).img : (FUNDOS.find(x => x.id === f.id) || {}).img;

// Vibração do celular (Android; o iPhone não deixa sites vibrarem)
let VIBRAR = true;
const VIB = { toque: 8, ok: [14, 50, 14], aviso: [28, 40, 28], erro: [60, 40, 60] };
// iPhone: o Safari não tem vibração, mas dá um toquinho (háptico) quando um interruptor nativo muda.
// O app guarda um interruptor invisível e "aperta" ele no toque (funciona a partir do iOS 18).
let HAPTICO = null;
function hapticoIOS(vezes) {
  try {
    if (!HAPTICO) {
      const inp = document.createElement("input"); inp.type = "checkbox"; inp.setAttribute("switch", ""); inp.id = "haptico-sw"; inp.tabIndex = -1; inp.setAttribute("aria-hidden", "true");
      const lab = document.createElement("label"); lab.htmlFor = "haptico-sw"; lab.setAttribute("aria-hidden", "true");
      inp.style.cssText = lab.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
      document.body.append(inp, lab); HAPTICO = lab;
    }
    HAPTICO.click();
    for (let i = 1; i < vezes; i++) setTimeout(() => HAPTICO && HAPTICO.click(), i * 110);
  } catch (e) {}
}
const vibrar = (tipo = "toque") => {
  if (!VIBRAR) return;
  try {
    if (navigator.vibrate) navigator.vibrate(VIB[tipo] || 8);
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) hapticoIOS(tipo === "toque" ? 1 : 2);
  } catch (e) {}
};

// A área que rola fica dentro do app (assim a barra de baixo nunca sai do lugar)
const rolarTopo = () => window.scrollTo(0, 0);
// Troca de tela com animação suave, como app nativo (View Transitions; onde não existe, troca direto)
const comTransicao = fn => {
  try {
    if (document.startViewTransition && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) { document.startViewTransition(() => flushSync(fn)); return; }
  } catch (e) {}
  fn();
};
const brlReal = v => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl = v => ESCONDER ? "R$ •••" : brlReal(v);
const num = v => { let s = String(v).trim(); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const n = parseFloat(s); return isNaN(n) ? 0 : n; };
const fmtNum = v => (Number(v) || 0).toFixed(2).replace(".", ",");
const soNumero = v => v.replace(/[^\d,\.]/g, "");
const uid = () => Math.random().toString(36).slice(2, 10);
const iniciais = nome => nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
const primeiro = nome => nome.split(" ")[0];
const freqNome = dias => (FREQUENCIAS.find(f => f.dias === dias) || { nome: `A cada ${dias} dias` }).nome;
const soma = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);
const saudacao = d => d.getHours() < 12 ? "Bom dia" : d.getHours() < 18 ? "Boa tarde" : "Boa noite";
const corDe = p => CORES.find(c => c.id === (p && p.color)) || CORES[[...String(p && p.id || "x")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % CORES.length];
const corVars = p => { const c = corDe(p); return { "--pc": c.cor, "--pc-ink": c.ink }; };
const catDe = id => CATEGORIAS.find(c => c.id === id) || CAT_ENTRADA.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
const catVars = cat => { const c = CORES.find(x => x.id === cat.cor) || CORES[0]; return { "--cc": c.cor, "--cc-ink": c.ink }; };

const lerJSON = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const apagar = k => { try { localStorage.removeItem(k); } catch (e) {} };
const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h); }; // só demonstração

function useWide() {
  const q = "(min-width: 900px)";
  const [w, setW] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setW(m.matches); m.addEventListener ? m.addEventListener("change", f) : m.addListener(f); return () => { m.removeEventListener ? m.removeEventListener("change", f) : m.removeListener(f); }; }, []);
  return w;
}

/* =========================================================
   3. REGRAS DO CONSULTÓRIO
   ========================================================= */
const sublocacao = p => p.subletType === "percent" ? Math.round(p.price * p.sublet) / 100 : (Number(p.sublet) || 0);
const liquido = p => p.price - sublocacao(p);
// Sessão que entra no dinheiro: atendida ou falta cobrada
const contaDinheiro = s => s.status === "done" || !!s.cobrada;
const sessoesAbertas = (db, pid) =>
  db.sessions.filter(s => s.patientId === pid && contaDinheiro(s) && !s.chargeId).sort((a, b) => a.date.localeCompare(b.date));

function itensDoDia(db, iso) {
  const itens = db.sessions.filter(s => s.date === iso).map(s => ({
    kind: "log", session: s, patient: db.patients.find(p => p.id === s.patientId), date: iso, time: s.time,
  })).filter(i => i.patient);
  db.patients.forEach(p => {
    if (!p.active || !p.nextDate) return;
    let d = p.nextDate, k = 0;
    while (d <= iso && k < 200) {
      if (d === iso) itens.push({ kind: k === 0 ? "next" : "proj", patient: p, date: d, time: p.time });
      d = addDays(d, p.freq); k++;
    }
  });
  return itens.sort((a, b) => a.time.localeCompare(b.time));
}

function situacao(item, now) {
  if (item.kind === "log") return item.session.status === "done" ? "done" : "missed";
  if (item.kind === "proj") return "proj";
  const t = todayISO();
  if (item.date < t) return "late";
  if (item.date === t && mins(item.time) + DURACAO_SESSAO <= agoraMin(now)) return "late";
  return "up";
}

// price/sublet: valores só desta sessão (opcional). padrao: passa a usar esses valores daqui pra frente.
function registrar(db, pid, { status, nextDate, paidNow, price, sublet, padrao, cobrarFalta }) {
  const p = db.patients.find(x => x.id === pid);
  const s = { id: uid(), patientId: pid, date: p.nextDate, time: p.time, price: price ?? p.price, sublet: sublet ?? sublocacao(p), status, chargeId: null, registro: false, cobrada: status === "missed" && !!cobrarFalta };
  const entra = status === "done" || s.cobrada;
  let sessions = [...db.sessions], charges = [...db.charges], nova = null;
  if (entra && p.billing === "session") {
    nova = { id: uid(), patientId: pid, sessionIds: [s.id], amount: s.price, createdAt: todayISO(), paid: !!paidNow, paidAt: paidNow ? todayISO() : null };
    s.chargeId = nova.id;
    sessions.push(s);
  } else {
    sessions.push(s);
    if (entra) {
      const abertas = sessions.filter(x => x.patientId === pid && contaDinheiro(x) && !x.chargeId);
      if (abertas.length >= p.packageSize) {
        nova = { id: uid(), patientId: pid, sessionIds: abertas.map(x => x.id), amount: soma(abertas, x => x.price), createdAt: todayISO(), paid: false, paidAt: null };
        sessions = sessions.map(x => nova.sessionIds.includes(x.id) ? { ...x, chargeId: nova.id } : x);
      }
    }
  }
  if (nova) charges.push(nova);
  const patients = db.patients.map(x => x.id === pid ? { ...x, nextDate, ...(padrao ? { price: s.price, sublet: s.sublet, subletType: "fixed", reajusteEm: s.price !== x.price ? todayISO() : x.reajusteEm } : {}) } : x);
  return { db: { ...db, patients, sessions, charges }, nova, sid: s.id };
}

function desfazer(db, sid) {
  const s = db.sessions.find(x => x.id === sid);
  if (!s) return db;
  let sessions = db.sessions.filter(x => x.id !== sid), charges = db.charges;
  if (s.chargeId) {
    charges = charges.filter(c => c.id !== s.chargeId);
    sessions = sessions.map(x => x.chargeId === s.chargeId ? { ...x, chargeId: null } : x);
  }
  const patients = db.patients.map(p => p.id === s.patientId ? { ...p, nextDate: s.date, time: s.time } : p);
  return { ...db, patients, sessions, charges };
}

function mensagem(db, c, nomeProf) {
  const p = db.patients.find(x => x.id === c.patientId);
  const ss = c.sessionIds.map(id => db.sessions.find(s => s.id === id)).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  const datas = ss.map(s => dm(s.date));
  const lista = datas.length > 1 ? datas.slice(0, -1).join(", ") + " e " + datas[datas.length - 1] : datas[0];
  let t = `Oi, ${p ? primeiro(p.name) : ""}! Tudo bem?\n\n`;
  t += ss.length > 1 ? `Fechamos o ciclo de ${ss.length} sessões (${lista}).\n` : `Passando para lembrar do pagamento da sessão de ${lista}.\n`;
  const faltas = ss.filter(s => s.status === "missed");
  if (faltas.length) t += `${faltas.length === 1 ? "Inclui a falta" : "Inclui as faltas"} de ${faltas.map(f => dm(f.date)).join(", ")}, sem aviso com antecedência.\n`;
  t += `Valor: ${brlReal(c.amount)}\n`;
  if (db.settings.pix) t += `Pix: ${db.settings.pix}\n`;
  t += `\nQualquer dúvida, me chama. Abraço!`;
  if (nomeProf) t += `\n${nomeProf}`;
  return t;
}

// Líquido do consultório num dia ou num mês (usado também no modo Pessoal)
const liquidoDia = (db, iso) => soma(db.sessions.filter(s => contaDinheiro(s) && s.date === iso), s => s.price - s.sublet);
const liquidoMes = (db, chave) => soma(db.sessions.filter(s => contaDinheiro(s) && s.date.startsWith(chave)), s => s.price - s.sublet);

const ehAniversario = perfil => perfil && perfil.nascimento && perfil.nascimento.slice(5) === todayISO().slice(5);
const idadeDe = nasc => { if (!nasc) return null; const t = new Date(), n = fromISO(nasc); let a = t.getFullYear() - n.getFullYear(); if (t.getMonth() < n.getMonth() || (t.getMonth() === n.getMonth() && t.getDate() < n.getDate())) a--; return a; };

function conversa(db, now, act, perfil) {
  const t = todayISO(), nm = agoraMin(now);
  const falas = [];
  if (ehAniversario(perfil)) falas.push({ txt: <>Hoje é seu aniversário. Parabéns! Se der, deixa a agenda mais leve hoje.</> });
  if (db.patients.length === 0) {
    falas.push({ txt: <>Aqui eu cuido das datas e das contas para você. Para começar, cadastre seu primeiro {TERMO.s}. Depois disso a agenda anda sozinha.</>, acao: { l: `Cadastrar ${TERMO.s}`, ic: <I.plus />, fn: act.novoPaciente } });
    return falas;
  }
  const atrasados = db.patients.filter(p => p.active && p.nextDate < t);
  if (atrasados.length) falas.push({ txt: <>Antes de tudo: {atrasados.length === 1 ? "uma sessão ficou" : `${atrasados.length} sessões ficaram`} sem marcar. Responde aqui embaixo, é um toque só.</> });
  const hoje = itensDoDia(db, t);
  const abertos = hoje.filter(i => i.kind === "next");
  const prox = abertos.find(i => mins(i.time) + DURACAO_SESSAO > nm);
  const fHoje = feriado(t);
  if (fHoje) falas.push({ txt: <>Hoje é feriado: <b>{fHoje.name}</b>{fHoje.fac ? " (ponto facultativo)" : ""}.</> });
  if (prox) {
    const ini = mins(prox.time);
    if (nm >= ini) falas.push({ txt: <>Agora você está com <b>{primeiro(prox.patient.name)}</b>, até as {hhmm(ini + DURACAO_SESSAO)}.</> });
    else {
      falas.push({ txt: <>Sua próxima sessão é com <b>{primeiro(prox.patient.name)}</b> às <b>{prox.time}</b>. Faltam {duracao(ini - nm)}.</>, acao: { l: "Só o agora", ic: <I.target />, fn: act.agora } });
      const ch = chuvaPerto(t, prox.time);
      if (ch) falas.push({ txt: <>Vai chover perto das {ch.h}h ({ch.p}%). Saia uns 10 minutos antes para a sessão das {prox.time}.{CLIMA && CLIMA.demo ? " (previsão de exemplo)" : ""}</> });
    }
  } else if (abertos.length) {
    falas.push({ txt: <>Falta marcar {abertos.length === 1 ? `a sessão de ${primeiro(abertos[0].patient.name)}` : `${abertos.length} sessões`} de hoje. Foi tudo certo?</>, acao: { l: "Abrir agenda", ic: <I.cal />, fn: () => act.setTab("agenda") } });
  } else if (hoje.length) {
    falas.push({ txt: <>As sessões de hoje já estão todas marcadas. Pode tirar isso da cabeça.</> });
  } else {
    const fut = db.patients.filter(p => p.active && p.nextDate > t).sort((a, b) => (a.nextDate + a.time).localeCompare(b.nextDate + b.time))[0];
    if (fut) falas.push({ txt: <>Hoje não tem sessão. A próxima é <b>{relativo(fut.nextDate).toLowerCase()}</b> às {fut.time}, com {primeiro(fut.name)}.</> });
  }
  // Fechar o dia (depois das 18h)
  if (nm >= 18 * 60 && hoje.length && !(db.fechados || {})[t]) falas.push({ txt: <>Seu dia de atendimentos já acabou? Vamos fechar o dia: leva uns 2 minutos e você desliga tranquilo.</>, acao: { l: "Fechar o dia", ic: <I.moon />, fn: act.fecharDia } });
  // Confirmação da véspera (depois do meio-dia)
  const amanha = addDays(t, 1);
  const semConf = itensDoDia(db, amanha).filter(i => i.kind !== "log" && !(db.confirmados || {})[`${i.patient.id}:${amanha}`]);
  if (nm >= 12 * 60 && semConf.length) falas.push({ txt: <>Amanhã você tem {semConf.length === 1 ? `sessão com ${primeiro(semConf[0].patient.name)}` : `${semConf.length} sessões sem confirmação`}. Quer mandar a confirmação agora?</>, acao: { l: "Confirmar amanhã", ic: <I.send />, fn: () => act.confirmar(amanha) } });
  // Registros pendentes
  const regs = registroPendente(db);
  if (regs.length) { const ns = [...new Set(regs.map(r => primeiro((db.patients.find(p => p.id === r.patientId) || { name: "?" }).name)))]; falas.push({ txt: <>Falta o registro {ns.length === 1 ? `da sessão de ${ns[0]}` : `das sessões de ${ns.slice(0, -1).join(", ")} e ${ns[ns.length - 1]}`}.</>, acao: { l: "Marcar registros", ic: <I.check />, fn: act.registros } }); }
  // Revisão da semana (domingo e segunda)
  const dow = fromISO(t).getDay();
  if ((dow === 0 || dow === 1) && !(db.revisoes || {})[semanaKey(t)]) falas.push({ txt: <>Sua revisão da semana está pronta: quanto entrou, faltas e o que vem pela frente.</>, acao: { l: "Ver revisão", ic: <I.chart />, fn: act.revisao } });
  // Reajuste: mais de 12 meses com o mesmo valor
  const reaj = db.patients.find(p => p.active && (p.reajusteEm || p.desde) && diffDias(p.reajusteEm || p.desde, t) >= 365 && !(p.reajusteAdiado && p.reajusteAdiado > t));
  if (reaj) falas.push({ txt: <>{primeiro(reaj.name)} está há {Math.floor(diffDias(reaj.reajusteEm || reaj.desde, t) / 30)} meses com o mesmo valor ({brl(reaj.price)}). Talvez seja hora de conversar sobre reajuste.</>, acao: { l: `Ver ${primeiro(reaj.name)}`, ic: <I.user />, fn: () => act.openPatient(reaj.id) } });
  // Lista de espera x horário livre
  const esp = (db.espera || [])[0];
  if (esp) { const livres = horariosLivres(db, addDays(t, 1), 7); const bate = livres.map(d => ({ iso: d.iso, m: d.livres.find(m => esp.pref === "qualquer" || periodoDe(m) === esp.pref) })).find(x => x.m !== undefined);
    if (bate) falas.push({ txt: <>Tem horário livre {relativo(bate.iso).toLowerCase()} às {hTxt(bate.m)} e <b>{primeiro(esp.nome)}</b> está na lista de espera{esp.pref !== "qualquer" ? ` (prefere ${esp.pref})` : ""}.</>, acao: { l: "Ver lista de espera", ic: <I.users />, fn: act.verEspera } }); }
  // Feriado nos próximos 7 dias com sessão marcada
  for (let k = 1; k <= 7; k++) {
    const iso = addDays(t, k), f = feriado(iso);
    if (!f) continue;
    const its = itensDoDia(db, iso).filter(i => i.kind !== "log");
    if (!its.length) continue;
    const nomes = its.map(i => primeiro(i.patient.name));
    const lista = nomes.length > 1 ? nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1] : nomes[0];
    const alvo = its.find(i => i.kind === "next");
    falas.push({ txt: <><b>{relativo(iso)}</b> ({dm(iso)}) é {f.name}{f.fac ? ", ponto facultativo" : ""}. {lista} {nomes.length > 1 ? "têm" : "tem"} sessão nesse dia. Quer remarcar?</>,
      acao: alvo ? { l: `Remarcar ${primeiro(alvo.patient.name)}`, ic: <I.repeat />, fn: () => act.openItem({ ...alvo, modo: "move" }) } : { l: "Ver na agenda", ic: <I.cal />, fn: () => act.setTab("agenda") } });
    break;
  }
  const abertas = db.charges.filter(c => !c.paid);
  if (abertas.length === 1) {
    const p = db.patients.find(x => x.id === abertas[0].patientId);
    falas.push({ txt: <>{p ? primeiro(p.name) : `Um ${TERMO.s}`} ainda não pagou <b>{brl(abertas[0].amount)}</b>. A mensagem de cobrança já está pronta.</>, acao: { l: "Ver mensagem", ic: <I.send />, fn: () => act.openCharge(abertas[0].id) } });
  } else if (abertas.length > 1) {
    falas.push({ txt: <>Tem <b>{abertas.length} pagamentos</b> para cobrar, somando {brl(soma(abertas, c => c.amount))}.</>, acao: { l: "Ver cobranças", ic: <I.send />, fn: () => act.setTab("fin") } });
  }
  const quaseFecha = db.patients.find(p => p.active && p.billing === "package" && sessoesAbertas(db, p.id).length === p.packageSize - 1 && p.nextDate >= t);
  if (quaseFecha) falas.push({ txt: <>Na próxima sessão de {primeiro(quaseFecha.name)} o pacote fecha. Eu deixo a cobrança pronta na hora.</> });
  return falas.slice(0, ESTILO === "curto" ? 2 : 4);
}

/* =========================================================
   4. REGRAS DO MODO PESSOAL
   ========================================================= */
const pessoalVazio = () => ({ lanc: [], contas: [], incluirConsultorio: true });
const vencimento = (conta, chave) => `${chave}-${pad(Math.min(conta.dia, diasNoMes(chave)))}`;
function situacaoConta(conta, chave) {
  const t = todayISO();
  if (conta.pagas && conta.pagas[chave]) return { st: "paga", txt: `Paga em ${dm(conta.pagas[chave])}` };
  const v = vencimento(conta, chave), d = diffDias(t, v);
  if (d < 0) return { st: "atrasada", txt: `Venceu ${d === -1 ? "ontem" : `há ${-d} dias`}` };
  if (d === 0) return { st: "hoje", txt: "Vence hoje" };
  if (d === 1) return { st: "breve", txt: "Vence amanhã" };
  return { st: d <= 5 ? "breve" : "ok", txt: `Vence em ${d} dias` };
}
function resumoPessoal(db, chave) {
  const P = db.pessoal;
  const saidas = P.lanc.filter(l => l.tipo === "saida" && l.data.startsWith(chave));
  const entradas = P.lanc.filter(l => l.tipo === "entrada" && l.data.startsWith(chave));
  const consult = P.incluirConsultorio ? liquidoMes(db, chave) : 0;
  const pagas = P.contas.filter(c => c.pagas && c.pagas[chave]);
  const abertas = P.contas.filter(c => !(c.pagas && c.pagas[chave]));
  const entrou = soma(entradas, l => l.valor) + consult;
  const saiu = soma(saidas, l => l.valor) + soma(pagas, c => c.valor);
  const porCat = {};
  saidas.forEach(l => { porCat[l.cat] = (porCat[l.cat] || 0) + l.valor; });
  pagas.forEach(c => { porCat[c.cat] = (porCat[c.cat] || 0) + c.valor; });
  return { saidas, entradas, consult, pagas, abertas, entrou, saiu, sobra: entrou - saiu, aPagar: soma(abertas, c => c.valor), porCat };
}
// Saldo acumulado dia a dia (para o gráfico)
function serieSaldo(db, ini, fim) {
  const P = db.pessoal, out = [];
  let acc = 0;
  for (let d = ini; d <= fim; d = addDays(d, 1)) {
    acc += soma(P.lanc.filter(l => l.data === d), l => l.tipo === "entrada" ? l.valor : -l.valor);
    if (P.incluirConsultorio) acc += liquidoDia(db, d);
    acc -= soma(P.contas.filter(c => c.pagas && Object.values(c.pagas).includes(d)), c => c.valor);
    out.push(acc);
  }
  return out;
}
function conversaPessoal(db, act) {
  const t = todayISO(), chave = t.slice(0, 7), P = db.pessoal;
  const falas = [];
  if (P.lanc.length === 0 && P.contas.length === 0) {
    falas.push({ txt: <>Aqui você anota o que gasta e as contas da casa. Comece por uma conta fixa, como aluguel ou luz: eu aviso antes de vencer.</>, acao: { l: "Adicionar conta", ic: <I.plus />, fn: () => act.novaConta() } });
    return falas;
  }
  P.contas.forEach(c => {
    const s = situacaoConta(c, chave);
    if (s.st === "atrasada" || s.st === "hoje" || (s.st === "breve" && diffDias(t, vencimento(c, chave)) <= 1)) {
      falas.push({ txt: s.st === "atrasada" ? <>A conta de <b>{c.nome}</b> {s.txt.toLowerCase()} e ainda não está marcada como paga.</> : <><b>{c.nome}</b> {s.txt.toLowerCase()}: {brl(c.valor)}.</>, acao: { l: "Já paguei", ic: <I.check />, fn: () => act.pagarConta(c.id) } });
    }
  });
  const r = resumoPessoal(db, chave);
  falas.push({ txt: <>Neste mês entrou <b>{brl(r.entrou)}</b>{r.consult > 0 ? <> (sendo {brl(r.consult)} do consultório)</> : null} e saiu <b>{brl(r.saiu)}</b>. {r.sobra >= 0 ? <>Sobram {brl(r.sobra)}.</> : <>Está {brl(-r.sobra)} no vermelho.</>}</> });
  const top = Object.entries(r.porCat).sort((a, b) => b[1] - a[1])[0];
  if (top) falas.push({ txt: <>O que mais pesou até agora foi <b>{catDe(top[0]).nome}</b>: {brl(top[1])}.</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const ass = P.contas.filter(c => c.assinatura);
  if (ass.length) falas.push({ txt: <>Suas {ass.length} assinaturas somam {brl(soma(ass, c => c.valor))} por mês, ou {brl(soma(ass, c => c.valor) * 12)} por ano.</>, acao: { l: "Ver assinaturas", ic: <I.bill />, fn: () => act.setTab("p-contas") } });
  return falas.slice(0, ESTILO === "curto" ? 2 : 4);
}

/* =========================================================
   4b. FERIADOS, CLIMA, VOZ E AVISOS
   ========================================================= */
// Feriados nacionais calculados aqui mesmo (funciona sem internet)
function pascoa(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(y, mes - 1, dia));
}
function feriadosLocais(y) {
  const p = pascoa(y);
  const f = [["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"], ["09-07", "Independência do Brasil"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"], ["11-15", "Proclamação da República"], ["12-25", "Natal"]]
    .map(([md, name]) => ({ date: `${y}-${md}`, name }));
  if (y >= 2024) f.push({ date: `${y}-11-20`, name: "Consciência Negra" });
  f.push({ date: addDays(p, -48), name: "Carnaval", fac: true }, { date: addDays(p, -47), name: "Carnaval", fac: true }, { date: addDays(p, -2), name: "Sexta-feira Santa" }, { date: addDays(p, 60), name: "Corpus Christi", fac: true });
  return f;
}
let FERIADOS = {};
{ const y = new Date().getFullYear(); [y - 1, y, y + 1].forEach(a => feriadosLocais(a).forEach(f => { FERIADOS[f.date] = f; })); }
const feriado = iso => FERIADOS[iso] || null;
// Confirma com a BrasilAPI (gratuita, sem chave). Sem internet, fica o cálculo local.
async function buscarFeriadosAPI(ano) {
  const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
  if (!r.ok) throw new Error("feriados");
  (await r.json()).forEach(f => { FERIADOS[f.date] = { date: f.date, name: f.name, fac: FERIADOS[f.date] && FERIADOS[f.date].fac }; });
}

// Clima pela Open-Meteo (gratuita, sem chave). Se a internet estiver bloqueada, usa uma previsão de exemplo marcada como tal.
let CLIMA = null;
async function buscarClima(cidade) {
  const key = "agenda-clima:" + cidade.toLowerCase();
  const c = lerJSON(key, null);
  if (c && Date.now() - c.em < 3600e3) return c;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&countryCode=BR`, { signal: ctrl.signal })).json();
    const loc = g.results && g.results[0];
    if (!loc) throw new Error("cidade");
    const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=temperature_2m,precipitation_probability,weather_code&timezone=auto&forecast_days=2`, { signal: ctrl.signal })).json();
    const horas = f.hourly.time.map((t, i) => ({ t, temp: Math.round(f.hourly.temperature_2m[i]), p: f.hourly.precipitation_probability[i] ?? 0, code: f.hourly.weather_code[i] }));
    const out = { cidade: loc.name, horas, em: Date.now(), demo: false };
    gravar(key, out);
    return out;
  } finally { clearTimeout(to); }
}
function climaExemplo(cidade) {
  const t = todayISO(), horas = [];
  [t, addDays(t, 1)].forEach((d, di) => { for (let h = 0; h < 24; h++) {
    const chuva = di === 0 && h >= 17 && h <= 19;
    horas.push({ t: `${d}T${pad(h)}:00`, temp: Math.round(18 + 6 * Math.sin((h - 9) / 24 * 2 * Math.PI)), p: chuva ? [60, 75, 55][h - 17] : 10, code: chuva ? 61 : h > 9 && h < 16 ? 2 : 1 });
  } });
  return { cidade, horas, em: Date.now(), demo: true };
}
const climaHora = (iso, h) => CLIMA && CLIMA.horas.find(x => x.t === `${iso}T${pad(h)}:00`);
// Chance de chuva perto de um horário (na hora anterior e na própria hora)
function chuvaPerto(iso, hora) {
  const h = Math.floor(mins(hora) / 60);
  const cands = [climaHora(iso, h - 1), climaHora(iso, h)].filter(Boolean).sort((a, b) => b.p - a.p);
  return cands[0] && cands[0].p >= 50 ? { p: cands[0].p, h: Number(cands[0].t.slice(11, 13)) } : null;
}
const iconeClima = code => code >= 95 ? "storm" : code >= 51 ? "rain" : code >= 2 ? "cloud" : "sun";

// Entender frases como "gastei 32 reais na padaria ontem"
const PALAVRAS_CAT = {
  comida: ["padaria", "restaurante", "lanche", "lanchonete", "almoço", "jantar", "ifood", "pizza", "café", "cafeteria", "hambúrguer", "sorvete", "bar", "delivery", "açaí", "pastel", "marmita"],
  mercado: ["mercado", "supermercado", "feira", "açougue", "hortifruti", "sacolão", "atacadão", "atacado", "quitanda"],
  transporte: ["uber", "ônibus", "gasolina", "combustível", "posto", "estacionamento", "metrô", "táxi", "pedágio", "passagem", "etanol"],
  saude: ["farmácia", "remédio", "médico", "consulta", "exame", "dentista", "academia", "terapia", "plano de saúde"],
  casa: ["aluguel", "luz", "energia", "água", "internet", "gás", "condomínio", "faxina", "diarista", "móvel", "reforma"],
  lazer: ["cinema", "show", "teatro", "netflix", "spotify", "viagem", "passeio", "jogo", "streaming", "festa"],
  compras: ["roupa", "loja", "shopping", "presente", "amazon", "shopee", "mercado livre", "sapato", "tênis", "maquiagem"],
  trabalho: ["salário", "sessão", "sessões", "freela", "atendimento", "pagamento"],
  extra: ["venda", "vendi", "reembolso", "cashback", "pix"],
  presente: ["presente", "ganhei"],
};
const NUMS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000 };
const semAcento = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function numerosPorExtenso(t) {
  const w = Object.keys(NUMS).join("|");
  return t.replace(new RegExp(`\\b(?:${w})(?:\\s+(?:e\\s+)?(?:${w}))*\\b`, "g"), seq => {
    let total = 0, cur = 0;
    seq.split(/\s+/).forEach(p => { if (p === "e") return; if (p === "mil") { total += (cur || 1) * 1000; cur = 0; } else cur += NUMS[p]; });
    return String(total + cur);
  });
}
function interpretarFala(frase) {
  let t = " " + numerosPorExtenso(semAcento(frase)).replace(/r\$\s*/g, " rs ") + " ";
  const entrada = /\b(recebi|ganhei|entrou|entraram|vendi|me pagaram|me pagou|caiu|salario)\b/.test(t);
  // valor: "32 reais e 50 centavos", "32,50", "1.200", "rs 32"
  let valor = 0;
  // "32 reais e 50 centavos", "32 reais e 50" ou "18 e 50"
  const rc = t.match(/(\d[\d\.]*)\s*(?:reais|real)\s*e\s*(\d{1,2})\b/) || t.match(/(\d[\d\.]*)\s+e\s+(\d{2})\b(?!\s*(?:reais|real))/);
  if (rc) valor = Number(rc[1].replace(/\./g, "")) + Number(rc[2]) / 100;
  else {
    const nums = [...t.matchAll(/(rs\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(\s*(?:reais|real|conto|contos|pila))?/g)]
      .map(m => ({ v: Number(m[2].replace(/\./g, "")) + (m[3] ? Number(m[3].padEnd(2, "0")) / 100 : 0), moeda: !!(m[1] || m[4]) }));
    const comMoeda = nums.find(n => n.moeda);
    valor = comMoeda ? comMoeda.v : nums.length ? Math.max(...nums.map(n => n.v)) : 0;
  }
  const off = /\banteontem\b/.test(t) ? 2 : /\bontem\b/.test(t) ? 1 : 0;
  const lista = entrada ? ["trabalho", "extra", "presente"] : ["comida", "mercado", "transporte", "saude", "casa", "lazer", "compras"];
  let cat = null, desc = "", pos = 1e9;
  lista.forEach(id => PALAVRAS_CAT[id].forEach(p => {
    const m = t.match(new RegExp(`\\b${semAcento(p)}\\b`));
    if (m && m.index < pos) { pos = m.index; cat = id; desc = p.charAt(0).toUpperCase() + p.slice(1); }
  }));
  if (entrada && cat === "presente") desc = "Presente";
  if (!cat) {
    const m = t.match(/\b(?:na|no|em|de|do|da|com)\s+([a-z]+(?:\s+[a-z]+)?)/);
    if (m && !/^\d/.test(m[1])) desc = m[1].replace(/\b(ontem|hoje|anteontem|reais|real)\b/g, "").trim();
    desc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : "";
    cat = entrada ? "outros-e" : "outros";
  }
  // empresa conhecida: nome certo, categoria certa e a logo dela
  const marca = acharMarca(t);
  if (marca) { desc = marca.nome; if (!entrada) cat = marca.cat; }
  return { tipo: entrada ? "entrada" : "saida", valor, cat, desc, off, marca: marca ? marca.id : null };
}

/* ---------- Marcas: reconhece a empresa e mostra a logo de verdade ----------
   "gastei 30 no uber" vira "Uber", com a categoria certa e a logo oficial (o ícone do próprio site
   da empresa, buscado pelo serviço de ícones do Google). Para incluir uma marca: [id, nome, site, categoria, palavras...].
   As palavras podem ser texto simples (sem acento) ou uma expressão regular. */
const MARCAS = [
  // transporte
  ["uber", "Uber", "uber.com", "transporte", "uber", "uber eats"],
  ["99", "99", "99app.com", "transporte", "99 ?pop", "99 ?taxi", "99app", /\b(?:na|no|da|do|pela|pelo)\s+99\b(?!\s*(?:reais|real|conto|contos|centavos|,\d))/],
  ["indrive", "inDrive", "indrive.com", "transporte", "indrive", "in drive"],
  ["cabify", "Cabify", "cabify.com", "transporte", "cabify"],
  ["blablacar", "BlaBlaCar", "blablacar.com.br", "transporte", "blablacar", "bla bla car"],
  ["shell", "Shell", "shell.com.br", "transporte", "shell"],
  ["ipiranga", "Ipiranga", "ipiranga.com.br", "transporte", "ipiranga"],
  ["petrobras", "Petrobras", "petrobras.com.br", "transporte", "petrobras", "posto br"],
  ["semparar", "Sem Parar", "semparar.com.br", "transporte", "sem parar"],
  ["veloe", "Veloe", "veloe.com.br", "transporte", "veloe"],
  ["conectcar", "ConectCar", "conectcar.com", "transporte", "conectcar", "conect car"],
  ["estapar", "Estapar", "estapar.com.br", "transporte", "estapar"],
  ["latam", "LATAM", "latamairlines.com", "transporte", "latam"],
  ["gol", "GOL", "voegol.com.br", "transporte", /\b(?:passagem|voo|voos)\s+(?:da\s+)?gol\b/],
  ["azul", "Azul", "voeazul.com.br", "transporte", /\b(?:passagem|voo|voos)\s+(?:da\s+)?azul\b/],
  // comida
  ["ifood", "iFood", "ifood.com.br", "comida", "ifood", "i food", "aifood"],
  ["rappi", "Rappi", "rappi.com.br", "comida", "rappi", "rapi"],
  ["ze", "Zé Delivery", "ze.delivery", "comida", "ze delivery"],
  ["mcdonalds", "McDonald's", "mcdonalds.com.br", "comida", "mcdonalds", "mc donalds", "mcdonald", "mc donald", "mequi", "meque"],
  ["burgerking", "Burger King", "burgerking.com.br", "comida", "burger king", "burguer king", "bk"],
  ["subway", "Subway", "subway.com", "comida", "subway"],
  ["kfc", "KFC", "kfc.com.br", "comida", "kfc"],
  ["bobs", "Bob's", "bobs.com.br", "comida", "bobs"],
  ["habibs", "Habib's", "habibs.com.br", "comida", "habibs", "habib"],
  ["giraffas", "Giraffas", "giraffas.com.br", "comida", "giraffas", "girafas"],
  ["outback", "Outback", "outback.com.br", "comida", "outback"],
  ["madero", "Madero", "restaurantemadero.com.br", "comida", "madero"],
  ["cocobambu", "Coco Bambu", "cocobambu.com", "comida", "coco bambu"],
  ["spoleto", "Spoleto", "spoleto.com.br", "comida", "spoleto"],
  ["pizzahut", "Pizza Hut", "pizzahut.com.br", "comida", "pizza hut"],
  ["dominos", "Domino's", "dominos.com.br", "comida", "dominos", "domino"],
  ["starbucks", "Starbucks", "starbucks.com.br", "comida", "starbucks"],
  ["cacaushow", "Cacau Show", "cacaushow.com.br", "comida", "cacau show"],
  ["kopenhagen", "Kopenhagen", "kopenhagen.com.br", "comida", "kopenhagen"],
  // mercado
  ["carrefour", "Carrefour", "carrefour.com.br", "mercado", "carrefour", "carrefur"],
  ["paodeacucar", "Pão de Açúcar", "paodeacucar.com", "mercado", "pao de acucar"],
  ["assai", "Assaí", "assai.com.br", "mercado", "assai"],
  ["atacadao", "Atacadão", "atacadao.com.br", "mercado", "atacadao"],
  ["samsclub", "Sam's Club", "samsclub.com.br", "mercado", "sams club", "sams"],
  ["condor", "Condor", "condor.com.br", "mercado", "condor"],
  ["muffato", "Super Muffato", "supermuffato.com.br", "mercado", "muffato", "mufato"],
  ["angeloni", "Angeloni", "angeloni.com.br", "mercado", "angeloni"],
  ["festval", "Festval", "festval.com.br", "mercado", "festval"],
  ["zaffari", "Zaffari", "zaffari.com.br", "mercado", "zaffari", "zafari"],
  ["savegnago", "Savegnago", "savegnago.com.br", "mercado", "savegnago"],
  ["guanabara", "Guanabara", "supermercadosguanabara.com.br", "mercado", "guanabara"],
  ["sonda", "Sonda", "sondadelivery.com.br", "mercado", "sonda"],
  ["hirota", "Hirota", "hirota.com.br", "mercado", "hirota"],
  ["oba", "Oba Hortifruti", "obahortifruti.com.br", "mercado", "oba hortifruti"],
  ["giassi", "Giassi", "giassi.com.br", "mercado", "giassi"],
  ["bistek", "Bistek", "bistek.com.br", "mercado", "bistek"],
  // saúde
  ["drogasil", "Drogasil", "drogasil.com.br", "saude", "drogasil"],
  ["drogaraia", "Droga Raia", "drogaraia.com.br", "saude", "droga raia", "drogaraia", "raia"],
  ["paguemenos", "Pague Menos", "paguemenos.com.br", "saude", "pague menos"],
  ["panvel", "Panvel", "panvel.com", "saude", "panvel"],
  ["drogariasaopaulo", "Drogaria São Paulo", "drogariasaopaulo.com.br", "saude", "drogaria sao paulo"],
  ["pacheco", "Drogarias Pacheco", "drogariaspacheco.com.br", "saude", "pacheco"],
  ["nissei", "Farmácias Nissei", "farmaciasnissei.com.br", "saude", "nissei"],
  ["venancio", "Drogaria Venancio", "drogariavenancio.com.br", "saude", "venancio"],
  ["smartfit", "Smart Fit", "smartfit.com.br", "saude", "smart fit", "smartfit"],
  ["bluefit", "Bluefit", "bluefit.com.br", "saude", "bluefit", "blue fit"],
  ["wellhub", "Wellhub", "wellhub.com", "saude", "wellhub", "gympass"],
  ["totalpass", "TotalPass", "totalpass.com", "saude", "totalpass", "total pass"],
  // lazer e assinaturas
  ["netflix", "Netflix", "netflix.com", "lazer", "netflix", "netflics"],
  ["spotify", "Spotify", "spotify.com", "lazer", "spotify", "spotfy"],
  ["deezer", "Deezer", "deezer.com", "lazer", "deezer"],
  ["youtube", "YouTube", "youtube.com", "lazer", "youtube", "you tube"],
  ["primevideo", "Prime Video", "primevideo.com", "lazer", "prime video", "amazon prime"],
  ["disney", "Disney+", "disneyplus.com", "lazer", "disney"],
  ["max", "Max", "max.com", "lazer", "hbo max", "hbo"],
  ["globoplay", "Globoplay", "globoplay.globo.com", "lazer", "globoplay", "globo play"],
  ["paramount", "Paramount+", "paramountplus.com", "lazer", "paramount"],
  ["crunchyroll", "Crunchyroll", "crunchyroll.com", "lazer", "crunchyroll"],
  ["appletv", "Apple TV", "tv.apple.com", "lazer", "apple tv"],
  ["steam", "Steam", "steampowered.com", "lazer", "steam"],
  ["playstation", "PlayStation", "playstation.com", "lazer", "playstation", "psn", "play station"],
  ["xbox", "Xbox", "xbox.com", "lazer", "xbox", "game pass"],
  ["nintendo", "Nintendo", "nintendo.com", "lazer", "nintendo"],
  ["cinemark", "Cinemark", "cinemark.com.br", "lazer", "cinemark"],
  ["cinepolis", "Cinépolis", "cinepolis.com.br", "lazer", "cinepolis"],
  ["ingresso", "Ingresso.com", "ingresso.com", "lazer", "ingresso com", "ingresso.com"],
  ["airbnb", "Airbnb", "airbnb.com.br", "lazer", "airbnb", "air bnb"],
  ["booking", "Booking", "booking.com", "lazer", "booking"],
  ["decolar", "Decolar", "decolar.com", "lazer", "decolar"],
  // compras
  ["amazon", "Amazon", "amazon.com.br", "compras", "amazon", "amazon.com"],
  ["mercadolivre", "Mercado Livre", "mercadolivre.com.br", "compras", "mercado livre"],
  ["shopee", "Shopee", "shopee.com.br", "compras", "shopee", "shopii", "xopi"],
  ["shein", "Shein", "shein.com", "compras", "shein", "xein"],
  ["aliexpress", "AliExpress", "aliexpress.com", "compras", "aliexpress", "ali express"],
  ["temu", "Temu", "temu.com", "compras", "temu"],
  ["magalu", "Magalu", "magazineluiza.com.br", "compras", "magalu", "magazine luiza"],
  ["americanas", "Americanas", "americanas.com.br", "compras", "americanas"],
  ["casasbahia", "Casas Bahia", "casasbahia.com.br", "compras", "casas bahia"],
  ["renner", "Renner", "lojasrenner.com.br", "compras", "renner"],
  ["riachuelo", "Riachuelo", "riachuelo.com.br", "compras", "riachuelo"],
  ["cea", "C&A", "cea.com.br", "compras", /\bc ?& ?a\b/, /\bcea\b/],
  ["zara", "Zara", "zara.com", "compras", "zara"],
  ["hering", "Hering", "hering.com.br", "compras", "hering"],
  ["nike", "Nike", "nike.com.br", "compras", "nike"],
  ["adidas", "adidas", "adidas.com.br", "compras", "adidas"],
  ["centauro", "Centauro", "centauro.com.br", "compras", "centauro"],
  ["netshoes", "Netshoes", "netshoes.com.br", "compras", "netshoes", "net shoes"],
  ["decathlon", "Decathlon", "decathlon.com.br", "compras", "decathlon"],
  ["leroy", "Leroy Merlin", "leroymerlin.com.br", "casa", "leroy merlin", "leroy"],
  ["tokstok", "Tok&Stok", "tokstok.com.br", "casa", "tok stok", "tokstok"],
  ["kalunga", "Kalunga", "kalunga.com.br", "compras", "kalunga"],
  ["boticario", "O Boticário", "boticario.com.br", "compras", "boticario"],
  ["natura", "Natura", "natura.com.br", "compras", "natura"],
  ["sephora", "Sephora", "sephora.com.br", "compras", "sephora"],
  ["apple", "Apple", "apple.com", "compras", "apple", "icloud", "app store"],
  ["google", "Google", "google.com", "compras", "google", "google one", "play store"],
  ["microsoft", "Microsoft", "microsoft.com", "compras", "microsoft", "office 365"],
  ["openai", "ChatGPT", "openai.com", "compras", "chatgpt", "chat gpt", "openai"],
  ["canva", "Canva", "canva.com", "compras", "canva"],
  ["adobe", "Adobe", "adobe.com", "compras", "adobe"],
  ["duolingo", "Duolingo", "duolingo.com", "compras", "duolingo"],
  // casa: energia, água, internet, telefone, bancos
  ["copel", "Copel", "copel.com", "casa", "copel"],
  ["sanepar", "Sanepar", "sanepar.com.br", "casa", "sanepar"],
  ["enel", "Enel", "enel.com.br", "casa", "enel"],
  ["cemig", "Cemig", "cemig.com.br", "casa", "cemig"],
  ["sabesp", "Sabesp", "sabesp.com.br", "casa", "sabesp"],
  ["comgas", "Comgás", "comgas.com.br", "casa", "comgas"],
  ["vivo", "Vivo", "vivo.com.br", "casa", /\b(?:da|na|conta da|internet da)\s+vivo\b/, "vivo fibra"],
  ["claro", "Claro", "claro.com.br", "casa", /\b(?:da|na|conta da|internet da)\s+claro\b/, "claro net"],
  ["tim", "TIM", "tim.com.br", "casa", /\b(?:da|na|conta da)\s+tim\b/],
  ["nubank", "Nubank", "nubank.com.br", "outros", "nubank", "nu bank"],
  ["itau", "Itaú", "itau.com.br", "outros", "itau"],
  ["bradesco", "Bradesco", "bradesco.com.br", "outros", "bradesco"],
  ["santander", "Santander", "santander.com.br", "outros", "santander"],
  ["bb", "Banco do Brasil", "bb.com.br", "outros", "banco do brasil"],
  ["inter", "Inter", "inter.co", "outros", "banco inter"],
  ["c6", "C6 Bank", "c6bank.com.br", "outros", "c6 bank", "c6"],
  ["picpay", "PicPay", "picpay.com", "outros", "picpay", "pic pay"],
  ["mercadopago", "Mercado Pago", "mercadopago.com.br", "outros", "mercado pago"],
].map(([id, nome, site, cat, ...palavras]) => ({
  id, nome, site, cat,
  re: palavras.map(p => p instanceof RegExp ? p : new RegExp(`\\b${p.replace(/\./g, "\\.")}\\b`)),
}));
// procura a marca citada primeiro na frase
function acharMarca(frase) {
  const t = " " + semAcento(frase || "").replace(/[’'`´]/g, "") + " ";
  let melhor = null, pos = 1e9;
  for (const m of MARCAS) for (const re of m.re) {
    const r = t.match(re);
    if (r && r.index < pos) { pos = r.index; melhor = m; }
  }
  return melhor;
}
const marcaPorId = id => MARCAS.find(m => m.id === id) || null;
const logoMarca = (m, fonte = 0) => fonte === 0 ? `https://www.google.com/s2/favicons?domain=${m.site}&sz=128` : `https://icons.duckduckgo.com/ip3/${m.site}.ico`;

/* ---------- Falar no consultório: "Felipe veio", "Ana faltou", "Júlia pagou", "remarca o Pedro pra quinta às 15h" ---------- */
const DIAS_FALA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function acharPaciente(t, db) {
  let melhor = null, pos = 1e9, tam = 0;
  for (const p of db.patients.filter(x => x.active)) {
    const nome = semAcento(p.name).trim(), pri = nome.split(/\s+/)[0];
    for (const alvo of [nome, pri]) {
      if (alvo.length < 3) continue;
      const m = t.match(new RegExp(`\\b${escRe(alvo)}\\b`));
      if (m && (m.index < pos || (m.index === pos && alvo.length > tam))) { melhor = p; pos = m.index; tam = alvo.length; }
    }
  }
  return melhor;
}
function lerDiaHora(t) {
  const hoje = todayISO();
  let data = null;
  if (/\bdepois de amanha\b/.test(t)) data = addDays(hoje, 2);
  else if (/\bamanha\b/.test(t)) data = addDays(hoje, 1);
  else if (/\bhoje\b/.test(t)) data = hoje;
  else {
    const d = t.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/);
    if (d) { const alvo = DIAS_FALA[d[1]], hj = fromISO(hoje).getDay(); data = addDays(hoje, ((alvo - hj + 7) % 7) || 7); }
    const dia = t.match(/\bdia\s+(\d{1,2})\b/);
    if (!d && dia) { const n = Number(dia[1]); let c = `${hoje.slice(0, 8)}${pad(n)}`; if (c < hoje) { const m = fromISO(hoje); m.setMonth(m.getMonth() + 1, n); c = toISO(m); } data = c; }
  }
  let hora = null;
  const h = t.match(/\b(\d{1,2})\s*(?::|h)\s*(\d{2})\b/) || t.match(/\b(\d{1,2})\s*h\b/) || t.match(/\b(?:as|pras|para as|pra)\s+(\d{1,2})(?:\s+(?:e\s+)?(\d{2}))?(?:\s+horas?)?\b/) || t.match(/\b(\d{1,2})\s+horas?\b/);
  if (h && Number(h[1]) <= 23) hora = `${pad(Number(h[1]))}:${pad(Number(h[2] || 0))}`;
  return { data, hora };
}
function interpretarConsultorio(frase, db) {
  const t = " " + numerosPorExtenso(semAcento(frase || "")).replace(/\s+/g, " ") + " ";
  const p = acharPaciente(t, db);
  if (!p) return null;
  const falta = /\b(faltou|nao veio|nao apareceu|nao compareceu|desmarcou|cancelou)\b/.test(t);
  const veio = !falta && /\b(veio|atendi|compareceu|teve sessao|fez sessao|fez a sessao|atendido|atendida)\b/.test(t);
  const pagou = /\b(pagou|me pagou|pagamento|fez o pix|mandou o pix|acertou|quitou|ja pagou)\b/.test(t);
  const remarcar = /\b(remarca|remarcar|remarquei|remarcou|muda|mudar|mudei|passa|passar|passei|adia|adiar)\b/.test(t);
  if (remarcar) { const { data, hora } = lerDiaHora(t); return { acao: "remarcar", p, data: data || p.nextDate, hora: hora || p.time, ok: !!(data || hora) }; }
  if (falta) return { acao: "falta", p, ok: true };
  if (veio) return { acao: "veio", p, pago: pagou, ok: true };
  if (pagou) return { acao: "pagou", p, ok: true };
  return { acao: "?", p, ok: false };
}
const textoAcao = (c, T) => c.acao === "veio" ? (c.pago ? "Veio e pagou" : "Veio")
  : c.acao === "falta" ? "Faltou"
  : c.acao === "pagou" ? "Pagou"
  : c.acao === "remarcar" ? `Remarcar para ${diaCurto(c.data)} às ${c.hora}`
  : `O que aconteceu com ${primeiro(c.p.name)}?`;

// Várias anotações numa frase só: "gastei 30 no mercado e 12 de uber"
const VERBO_FALA = /\b(gastei|paguei|comprei|recebi|ganhei|entrou|vendi|caiu|me pagou|me pagaram)\b/;
function interpretarVarios(frase) {
  const t = numerosPorExtenso(semAcento(frase || "")).replace(/\s+/g, " ").trim();
  if (!t) return [];
  const geral = interpretarFala(t);
  const cortes = [...t.matchAll(/\s*(?:,|;|\be\b|\bmais\b|\btambem\b|\bdepois\b)\s+/g)];
  const partes = []; let ini = 0;
  for (const c of cortes) {
    const esq = t.slice(ini, c.index).trim(), dir = t.slice(c.index + c[0].length);
    const r = interpretarFala(esq);
    // só corta quando o pedaço da esquerda já é uma anotação completa (valor + onde) e a direita tem outro valor
    if (r.valor > 0 && (r.cat !== "outros" && r.cat !== "outros-e" || r.desc) && /\d/.test(dir) && !/^(?:rs\s*)?\d{1,2}(?:\s*centavos?)?\s*$/.test(dir.trim())) { partes.push(esq); ini = c.index + c[0].length; }
  }
  partes.push(t.slice(ini).trim());
  if (partes.length < 2) return [geral];
  let ultimoTipo = null;
  return partes.map(p => {
    const temVerbo = VERBO_FALA.test(p);
    const r = interpretarFala(!temVerbo && ultimoTipo === "entrada" ? "recebi " + p : p);
    if (!/\b(ontem|anteontem|hoje)\b/.test(p)) r.off = geral.off;
    ultimoTipo = r.tipo;
    return r;
  }).filter(r => r.valor > 0);
}

/* ---------- Falar: reconhecimento de voz do próprio aparelho ----------
   Sem servidor e sem API: usa o reconhecimento de voz que já vem no navegador (o mesmo do ditado).
   Ele para sozinho quando você termina de falar. Se o aparelho não liberar (alguns iPhones com o app
   instalado na tela inicial), o app abre o teclado: aí é só tocar no microfone do teclado e falar. */
const SRec = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const K_VOZ_TECLADO = "agenda-voz-teclado"; // { falhas, ate }: quando o reconhecimento falha seguido, usa o teclado por umas horas
const vozTravada = () => { const v = lerJSON(K_VOZ_TECLADO, null); return !!(v && v.falhas >= 2 && Date.now() < (v.ate || 0)); };
const marcarFalhaVoz = () => { const v = lerJSON(K_VOZ_TECLADO, null); const f = ((v && v.falhas) || 0) + 1; gravar(K_VOZ_TECLADO, { falhas: f, ate: Date.now() + 6 * 36e5 }); return f; };
const vozOk = () => apagar(K_VOZ_TECLADO);
const MSG_TECLADO = "O aparelho não está liberando o reconhecimento de voz agora. Use o microfone do teclado: funciona igual.";

// Reconhecimento de voz do aparelho, com proteções para nunca ficar "travado ouvindo"
function useFalaNativa({ onParcial, onFinal, onFalhou }) {
  const [estado, setEstado] = useState("parado"); // parado | ouvindo | falando | erro
  const [erro, setErro] = useState("");
  const [nivel, setNivel] = useState(0);
  const r = useRef({});
  const cb = useRef({}); cb.current = { onParcial, onFinal, onFalhou };
  const limparTimers = x => { clearInterval(x.decai); clearTimeout(x.vigia); clearTimeout(x.vigia2); clearTimeout(x.teto); clearTimeout(x.forca); };
  const limpar = () => { const x = r.current; x.fim = true; limparTimers(x); try { x.rec && x.rec.abort(); } catch (e) {} r.current = {}; };
  useEffect(() => limpar, []);
  const falhar = (msg, teclado) => { limpar(); setNivel(0); setErro(msg); setEstado("erro"); vibrar("aviso"); if (teclado) cb.current.onFalhou(); };
  const iniciar = () => {
    const tinha = !!r.current.rec;
    limpar(); setErro(""); setNivel(0);
    const SR = SRec();
    if (!SR) return false;
    const abrir = () => {
      const rec = new SR();
      rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      const x = r.current = { rec, texto: "", fim: false, audio: false, ouviu: false };
      // termina de um jeito só, aconteça o que acontecer
      x.terminar = (t, msgVazio) => {
        if (x.fim) return; x.fim = true; limparTimers(x);
        try { rec.abort(); } catch (e) {}
        if (r.current === x) r.current = {};
        setNivel(0);
        if (t) { setEstado("parado"); cb.current.onFinal(t); } else falhar(msgVazio || "Não ouvi nada. Toque na Bolinha e fale de novo.");
      };
      const travou = () => { if (x.fim) return; x.fim = true; limparTimers(x); try { rec.abort(); } catch (e) {} const f = marcarFalhaVoz(); falhar(f >= 2 ? MSG_TECLADO : "O microfone não respondeu. Toque na Bolinha de novo.", f >= 2); };
      x.decai = setInterval(() => setNivel(n => n > .14 ? n * .8 : .06 + Math.random() * .06), 110);
      x.vigia = setTimeout(() => { if (!x.audio && !x.ouviu) travou(); }, 4500);             // o microfone nem abriu
      x.vigia2 = setTimeout(() => { if (!x.ouviu) { if (x.audio) { const f = marcarFalhaVoz(); if (f >= 2) return travou(); } x.terminar(""); } }, 9000); // abriu mas nada chegou
      x.teto = setTimeout(() => { try { rec.stop(); } catch (e) {} x.forca = setTimeout(() => x.terminar(x.texto.trim()), 1500); }, 20000);
      rec.onstart = rec.onaudiostart = () => { x.audio = true; };
      rec.onspeechstart = () => setEstado("falando");
      rec.onresult = e => {
        if (x.fim) return;
        x.ouviu = true; clearTimeout(x.vigia); clearTimeout(x.vigia2); vozOk();
        x.texto = [...e.results].map(y => y[0].transcript).join(" ");
        setEstado("falando"); setNivel(.55 + Math.random() * .45);
        cb.current.onParcial(x.texto);
      };
      rec.onerror = e => {
        if (x.fim || e.error === "aborted") return;
        if (e.error === "no-speech") return x.terminar(x.texto.trim());
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { x.fim = true; limparTimers(x); gravar(K_VOZ_TECLADO, { falhas: 2, ate: Date.now() + 6 * 36e5 }); return falhar("O microfone não foi liberado para o app. Use o microfone do teclado: funciona igual.", true); }
        if (e.error === "network") return x.terminar(x.texto.trim(), "Sem internet: o reconhecimento de voz do aparelho precisa de conexão. Toque em Teclado.");
        if (e.error === "audio-capture") return x.terminar(x.texto.trim(), "O microfone está ocupado por outro app. Feche o outro app e tente de novo.");
        x.terminar(x.texto.trim(), "Não consegui ouvir agora. Toque na Bolinha para tentar de novo.");
      };
      rec.onend = () => x.terminar(x.texto.trim());
      try { rec.start(); setEstado("ouvindo"); }
      catch (e) { x.fim = true; limparTimers(x); r.current = {}; falhar("Não consegui abrir o microfone. Toque na Bolinha de novo."); }
    };
    if (tinha) setTimeout(abrir, 180); else abrir();
    setEstado("ouvindo");
    return true;
  };
  // terminar agora: pede para parar e, se o aparelho não responder em 1,5 s, termina com o que já ouviu
  const parar = () => {
    const x = r.current; if (!x.rec || x.fim) return;
    try { x.rec.stop(); } catch (e) {}
    clearTimeout(x.forca); x.forca = setTimeout(() => x.terminar && x.terminar(x.texto.trim()), 1500);
  };
  const cancelar = () => { limpar(); setNivel(0); setErro(""); setEstado("parado"); };
  return { estado, erro, nivel, iniciar, parar, cancelar };
}

// Avisos: banner dentro do app + som + vibração; notificação do sistema quando o aparelho permitir
let audioCtx = null;
function tocarSom() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * .16); g.gain.exponentialRampToValueAtTime(.16, t + i * .16 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .16 + .3);
      o.connect(g); g.connect(audioCtx.destination); o.start(t + i * .16); o.stop(t + i * .16 + .32);
    });
    return true;
  } catch (e) { return false; }
}
async function notificarSistema(titulo, corpo, pedir) {
  try {
    if (!("Notification" in window)) return "indisponivel";
    if (Notification.permission === "default" && pedir) { const r = await Notification.requestPermission(); if (r !== "granted") return "negado"; }
    if (Notification.permission !== "granted") return Notification.permission === "denied" ? "negado" : "pendente";
    const opts = { body: corpo, icon: `${BASE}icons/icon-192.png`, badge: `${BASE}icons/icon-192.png`, vibrate: [120, 60, 120], tag: titulo };
    // Com o app instalado, a notificação precisa sair pelo service worker (exigência do Android)
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) await reg.showNotification(titulo, opts);
    else new Notification(titulo, opts);
    return "ok";
  } catch (e) { return "bloqueado"; }
}
const AVISOS_PADRAO = { ativo: true, antecedencia: 15, som: true, nomes: false, resumo: true, fechar: true };

/* ---------- Avisos com o app fechado (Web Push) ----------
   O iPhone congela o app assim que ele sai da tela, então nenhum relógio dentro do app consegue avisar na hora.
   Quem avisa é o servidor-avisos (pasta servidor-avisos/, grátis na Cloudflare): o app manda para lá só a lista
   dos próximos 7 dias (horário + texto do aviso) e o servidor dispara cada um no minuto certo.
   Por padrão o texto não leva o nome do paciente (aparece na tela bloqueada). */
const AVISOS_URL_PADRAO = String(import.meta.env.VITE_AVISOS_URL || "").trim().replace(/\/+$/, "");
const K_PUSH = "agenda-push";         // { ligado, id do aparelho, chave do servidor, último envio }
const K_PUSH_URL = "agenda-push-url"; // endereço do servidor colado à mão (se o GitHub não preencheu)
const servidorAvisos = () => String(lerJSON(K_PUSH_URL, "") || AVISOS_URL_PADRAO).trim().replace(/\/+$/, "");
const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const appInstalado = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const pushSuportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const pushLigado = () => !!lerJSON(K_PUSH, {}).ligado && !!servidorAvisos();
const b64uBytes = s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const bytesB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const comPrazo = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("tempo")), ms))]);

// O que impede de ligar ("" = pode ligar)
function motivoSemPush() {
  if (!servidorAvisos()) return "servidor";
  if (ehIOS() && !appInstalado()) return "instalar";
  if (!pushSuportado()) return "indisponivel";
  if (Notification.permission === "denied") return "negado";
  return "";
}
async function inscreverPush(pedir) {
  const m = motivoSemPush(); if (m) throw new Error(m);
  if (Notification.permission !== "granted") {
    if (!pedir) throw new Error("permissao");
    if (await Notification.requestPermission() !== "granted") throw new Error("negado");
  }
  const url = servidorAvisos();
  const reg = await comPrazo(navigator.serviceWorker.ready, 8000).catch(() => { throw new Error("sem-sw"); });
  const r = await comPrazo(fetch(url + "/chave"), 12000).catch(() => { throw new Error("servidor-fora"); });
  const { chave } = await r.json().catch(() => ({}));
  if (!r.ok || !chave) throw new Error("servidor-fora");
  const st = lerJSON(K_PUSH, {});
  let sub = await reg.pushManager.getSubscription();
  if (sub && st.chave && st.chave !== chave) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(chave) });
  const id = st.id || uid() + uid();
  gravar(K_PUSH, { ...lerJSON(K_PUSH, {}), id, chave });
  return { id, sub: sub.toJSON() };
}
async function chamarServidor(caminho, corpo, manter) {
  const r = await fetch(servidorAvisos() + caminho, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo), keepalive: !!manter });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "servidor-fora");
  return j;
}
// Lista dos avisos dos próximos 7 dias
function gerarAvisos(db, av, usaPessoal) {
  const agora = Date.now(), hoje = todayISO(), lista = [];
  const quando = (iso, hhmm) => { const d = fromISO(iso); const [h, m] = hhmm.split(":").map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
  const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const add = (t, titulo, corpo, tag) => { if (t > agora + 30000) lista.push({ t, titulo, corpo, tag }); };
  const plural = (n, um, varios) => n === 1 ? um : varios.replace("#", n);
  for (let i = 0; i < 8; i++) {
    const iso = addDays(hoje, i);
    const sess = itensDoDia(db, iso).filter(x => x.kind === "next" || x.kind === "proj");
    if (!sess.length) continue;
    sess.forEach((x, n) => add(quando(iso, x.time) - av.antecedencia * 60000,
      `Sessão${av.nomes ? ` com ${primeiro(x.patient.name)}` : ""} em ${av.antecedencia} min`,
      `Às ${x.time}.${n === sess.length - 1 && sess.length > 1 ? " É a última do dia." : ""}`, `s-${iso}-${x.time}`));
    const pri = sess[0].time, ult = sess[sess.length - 1].time;
    if (av.resumo !== false) add(Math.min(quando(iso, "07:30"), quando(iso, pri) - 90 * 60000),
      `Hoje: ${plural(sess.length, "1 sessão", "# sessões")}`,
      sess.length === 1 ? `Às ${pri}. Bom dia!` : `A primeira às ${pri} e a última às ${ult}. Bom dia!`, `r-${iso}`);
    if (av.fechar !== false && !(db.fechados || {})[iso]) add(quando(iso, hm(Math.max(19 * 60, mins(ult) + DURACAO_SESSAO + 10))),
      "Vamos fechar o dia?", "Leva uns 2 minutos: marcar quem veio, quem faltou e o que falta cobrar.", `f-${iso}`);
  }
  const pend = db.patients.filter(p => p.active && p.nextDate && p.nextDate < hoje).length;
  if (pend) add(quando(hoje, "09:00") > agora + 60000 ? quando(hoje, "09:00") : quando(addDays(hoje, 1), "09:00"),
    plural(pend, "Ficou 1 sessão sem marcar", "Ficaram # sessões sem marcar"), "Toque para dizer quem veio e quem faltou.", "pend");
  if (usaPessoal) ((db.pessoal && db.pessoal.contas) || []).forEach(c => {
    for (let i = 0; i < 8; i++) {
      const iso = addDays(hoje, i), chave = iso.slice(0, 7);
      if (vencimento(c, chave) !== iso || (c.pagas && c.pagas[chave])) continue;
      add(quando(addDays(iso, -1), "09:00"), `${c.nome} vence amanhã`, `${brlReal(c.valor)} · toque para ver suas contas`, `c-${c.id}`);
      add(quando(iso, "09:00"), `${c.nome} vence hoje`, `${brlReal(c.valor)} · já pagou? Marque no app.`, `c-${c.id}`);
    }
  });
  return lista.sort((a, b) => a.t - b.t).slice(0, 200);
}


/* =========================================================
   5. DADOS DE EXEMPLO
   ========================================================= */
function exemplo() {
  const t = todayISO();
  const ses = (pid, off, price, sublet, extra = {}) => ({ id: uid(), patientId: pid, date: addDays(t, off), price, sublet, status: "done", chargeId: null, registro: true, ...extra });
  const patients = [
    { id: "p1", name: "Felipe Andrade", phone: "", color: "azul", price: 110, sublet: 25, subletType: "fixed", freq: 14, time: "18:30", billing: "package", packageSize: 4, nextDate: t, active: true },
    { id: "p2", name: "Marcos Lima", phone: "", color: "laranja", price: 130, sublet: 20, subletType: "percent", freq: 7, time: "10:00", billing: "package", packageSize: 4, nextDate: addDays(t, -1), active: true },
    { id: "p3", name: "Ana Souza", phone: "", color: "rosa", price: 150, sublet: 30, subletType: "fixed", freq: 7, time: "14:00", billing: "session", packageSize: 4, nextDate: addDays(t, 2), active: true },
    { id: "p4", name: "Júlia Prado", phone: "", color: "verde", price: 180, sublet: 0, subletType: "fixed", freq: 28, time: "09:00", billing: "session", packageSize: 4, nextDate: addDays(t, 10), active: true },
    { id: "p5", name: "Bruno Costa", phone: "", color: "roxo", price: 120, sublet: 25, subletType: "fixed", freq: 7, time: "08:00", billing: "session", packageSize: 4, nextDate: t, active: true },
  ];
  const fOld = [-84, -70, -56, -42].map(o => ses("p1", o, 110, 25, { time: "18:30", chargeId: "c1" }));
  // Histórico extra de Ana e Bruno (semanais) para o mapa de ritmo
  const anaOld = [-26, -33, -40, -47, -54, -61, -68, -75, -82, -89].map(o => ses("p3", o, 150, 30, { time: "14:00", chargeId: "c0" }));
  const brunoOld = [-14, -21, -28, -35, -42, -49, -56].map(o => ses("p5", o, 120, 25, { time: "08:00", chargeId: "c0" }));
  const sessions = [
    ...fOld, ...anaOld, ...brunoOld,
    ses("p1", -28, 110, 25, { time: "18:30" }), ses("p1", -14, 110, 25, { time: "18:30" }),
    ses("p2", -22, 130, 26, { time: "10:00" }), ses("p2", -15, 130, 26, { time: "10:00" }), ses("p2", -8, 130, 26, { time: "10:00", registro: false }),
    ses("p3", -19, 150, 30, { time: "14:00", chargeId: "c2" }), ses("p3", -12, 150, 30, { time: "14:00", chargeId: "c3" }), ses("p3", -5, 150, 30, { time: "14:00", chargeId: "c4" }),
    ses("p4", -18, 180, 0, { time: "09:00", chargeId: "c5" }), ses("p4", -46, 180, 0, { time: "09:00", chargeId: "c0" }), ses("p4", -74, 180, 0, { time: "09:00", chargeId: "c0" }),
    ses("p5", -7, 120, 25, { time: "08:00", chargeId: "c6", registro: false }),
  ];
  patients.forEach(p => { p.desde = addDays(t, p.id === "p1" ? -400 : -120); });
  const ids = c => sessions.filter(s => s.chargeId === c).map(s => s.id);
  const charges = [
    { id: "c0", patientId: "p3", sessionIds: ids("c0"), amount: 0, createdAt: addDays(t, -90), paid: true, paidAt: addDays(t, -90), hidden: true },
    { id: "c1", patientId: "p1", sessionIds: ids("c1"), amount: 440, createdAt: addDays(t, -42), paid: true, paidAt: addDays(t, -40) },
    { id: "c2", patientId: "p3", sessionIds: ids("c2"), amount: 150, createdAt: addDays(t, -19), paid: true, paidAt: addDays(t, -19) },
    { id: "c3", patientId: "p3", sessionIds: ids("c3"), amount: 150, createdAt: addDays(t, -12), paid: true, paidAt: addDays(t, -12) },
    { id: "c4", patientId: "p3", sessionIds: ids("c4"), amount: 150, createdAt: addDays(t, -5), paid: false, paidAt: null },
    { id: "c5", patientId: "p4", sessionIds: ids("c5"), amount: 180, createdAt: addDays(t, -18), paid: true, paidAt: addDays(t, -18) },
    { id: "c6", patientId: "p5", sessionIds: ids("c6"), amount: 120, createdAt: addDays(t, -7), paid: true, paidAt: addDays(t, -7) },
  ];
  const espera = [{ id: "e1", nome: "Luiza Martins", phone: "", pref: "manhã", obs: "Indicação da Ana", desde: addDays(t, -12) }];
  return { settings: { pix: "" }, patients, sessions, charges, pessoal: exemploPessoal(), espera, fechados: {}, confirmados: {}, revisoes: {} };
}
function exemploPessoal() {
  const t = todayISO(), chave = t.slice(0, 7);
  const diaDe = off => fromISO(addDays(t, off)).getDate();
  const pago = dia => { const v = `${chave}-${pad(Math.min(dia, diasNoMes(chave)))}`; return { [chave]: v < t ? v : t }; };
  const l = (tipo, valor, cat, desc, off) => ({ id: uid(), tipo, valor, cat, desc, data: addDays(t, off) });
  return {
    incluirConsultorio: true,
    lanc: [
      l("saida", 312.4, "mercado", "Compra da semana", -2),
      l("saida", 68, "comida", "Almoço com amigas", -1),
      l("saida", 22.5, "transporte", "Uber", 0),
      l("saida", 54.9, "saude", "Farmácia", -4),
      l("saida", 120, "lazer", "Cinema e jantar", -6),
      l("saida", 89.9, "compras", "Presente de aniversário", -3),
      l("saida", 196.3, "mercado", "Feira e açougue", -9),
      l("entrada", 60, "extra", "Venda de livro usado", -5),
    ],
    contas: [
      { id: uid(), nome: "Aluguel", valor: 1400, dia: 5, cat: "casa", pagas: pago(5) },
      { id: uid(), nome: "Luz", valor: 182.3, dia: diaDe(1), cat: "casa", pagas: {} },
      { id: uid(), nome: "Água", valor: 94, dia: diaDe(-3), cat: "casa", pagas: {} },
      { id: uid(), nome: "Internet", valor: 109.9, dia: 15, cat: "casa", pagas: pago(15) },
      { id: uid(), nome: "Plano de saúde", valor: 420, dia: diaDe(6), cat: "saude", pagas: {} },
      { id: uid(), nome: "Netflix", valor: 44.9, dia: 12, cat: "lazer", pagas: pago(12), assinatura: true },
      { id: uid(), nome: "Spotify", valor: 21.9, dia: 18, cat: "lazer", pagas: pago(18), assinatura: true },
      { id: uid(), nome: "Academia", valor: 99.9, dia: 7, cat: "saude", pagas: pago(7), assinatura: true },
    ],
  };
}
const vazio = () => ({ settings: { pix: "" }, patients: [], sessions: [], charges: [], pessoal: pessoalVazio(), espera: [], fechados: {}, confirmados: {}, revisoes: {} });

/* =========================================================
   6. ÍCONES
   ========================================================= */
const Svg = ({ children, sw = 1.8 }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const I = {
  home: () => <Svg><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z"/></Svg>,
  cal: () => <Svg><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></Svg>,
  grid: () => <Svg><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></Svg>,
  users: () => <Svg><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.8 2.4 3 5.2"/></Svg>,
  wallet: () => <Svg><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16.5 15h1"/><path d="M6 6l9-3 1.5 3"/></Svg>,
  plus: () => <Svg sw={2.2}><path d="M12 5v14M5 12h14"/></Svg>,
  x: () => <Svg sw={2.2}><path d="M6 6l12 12M18 6L6 18"/></Svg>,
  check: () => <Svg sw={2.6}><path d="M5 12.5l4.5 4.5L19 7.5"/></Svg>,
  chev: () => <Svg sw={2.2}><path d="M9 6l6 6-6 6"/></Svg>,
  chevL: () => <Svg sw={2.2}><path d="M15 6l-6 6 6 6"/></Svg>,
  chevD: () => <Svg sw={2.2}><path d="M6 9l6 6 6-6"/></Svg>,
  gear: () => <Svg><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Svg>,
  sun: () => <Svg><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></Svg>,
  moon: () => <Svg><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></Svg>,
  eye: () => <Svg><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></Svg>,
  eyeOff: () => <Svg><path d="M4 4l16 16M10 6a9.6 9.6 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 7.3C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/></Svg>,
  bell: () => <Svg><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></Svg>,
  user: () => <Svg><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/></Svg>,
  mail: () => <Svg><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></Svg>,
  lock: () => <Svg><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2"/></Svg>,
  phone: () => <Svg><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></Svg>,
  money: () => <Svg><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></Svg>,
  door: () => <Svg><path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18"/><path d="M15 12v.5"/></Svg>,
  repeat: () => <Svg><path d="M17 2.5l3 3-3 3"/><path d="M4 11V9.5a4 4 0 0 1 4-4h12"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/></Svg>,
  clock: () => <Svg><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Svg>,
  alert: () => <Svg sw={2.2}><path d="M12 7v6M12 16.5v.5"/></Svg>,
  copy: () => <Svg><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></Svg>,
  send: () => <Svg><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></Svg>,
  down: () => <Svg sw={2.2}><path d="M12 5v13M6 12l6 6 6-6"/></Svg>,
  up: () => <Svg sw={2.2}><path d="M12 19V6M6 12l6-6 6 6"/></Svg>,
  receipt: () => <Svg><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></Svg>,
  undo: () => <Svg><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></Svg>,
  key: () => <Svg><circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8L20 3M17 6l3 3"/></Svg>,
  search: () => <Svg><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></Svg>,
  out: () => <Svg><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10"/></Svg>,
  chat: () => <Svg sw={2.2}><path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8z"/></Svg>,
  pencil: () => <Svg sw={2}><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></Svg>,
  chart: () => <Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Svg>,
  bill: () => <Svg><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></Svg>,
  cart: () => <Svg><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></Svg>,
  car: () => <Svg><path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2.5M20 16v2.5"/><circle cx="7.5" cy="13.5" r=".8"/><circle cx="16.5" cy="13.5" r=".8"/></Svg>,
  food: () => <Svg><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1-3.5 3.5-3.5 7h3.5"/></Svg>,
  heart: () => <Svg><path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/></Svg>,
  star: () => <Svg><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></Svg>,
  bag: () => <Svg><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></Svg>,
  more: () => <Svg sw={2.6}><path d="M6 12h.01M12 12h.01M18 12h.01"/></Svg>,
  mic: () => <Svg sw={2}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></Svg>,
  cloud: () => <Svg><path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 18.5z"/></Svg>,
  rain: () => <Svg><path d="M7 15h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/></Svg>,
  storm: () => <Svg><path d="M7 15h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/></Svg>,
  target: () => <Svg><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" /></Svg>,
  share: () => <Svg><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></Svg>,
  piggy: () => <Svg><path d="M19 11.5c0-3.6-3.1-6-7-6-1.7 0-3.3.5-4.5 1.3L5 5.5V9C4 10 3.5 11 3.5 12.5 3.5 15 5 17 7.5 18v2h3v-1.5h3V20h3v-2.2c1.4-.8 2.5-2.1 2.5-3.8h1.5v-2.5z"/><circle cx="15" cy="10.5" r=".6"/></Svg>,
  flag: () => <Svg><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></Svg>,
  logo: () => <Svg sw={2.2}><rect x="4" y="5" width="16" height="15" rx="3.5"/><path d="M4 10h16M9 15l2 2 4-4"/></Svg>,
};
const CatIcon = ({ cat }) => { const C = I[cat.ic] || I.more; return <C />; };

/* =========================================================
   7. PEÇAS REUTILIZÁVEIS
   ========================================================= */
function Money({ v, cls = "" }) {
  if (ESCONDER) return <span className={"mny " + cls}><span className="cur">R$</span>•••<span className="cents">,••</span></span>;
  const neg = v < 0, [i, c] = Math.abs(Number(v) || 0).toFixed(2).split(".");
  return <span className={"mny " + cls}><span className="cur">R$</span>{neg ? "−" : ""}{Number(i).toLocaleString("pt-BR")}<span className="cents">,{c}</span></span>;
}
// Clima de agora + chuva perto da próxima sessão
function WeatherChip({ cidade, act, sessao }) {
  if (!cidade) return <button className="wx btn-like" onClick={() => act.openSettings("dados")}><I.cloud /><span>Defina sua cidade para ver a chuva</span></button>;
  if (!CLIMA) return <span className="wx"><I.cloud /><span className="r" style={{ color: "var(--muted)" }}>Buscando o clima…</span></span>;
  const now = new Date(), agora = climaHora(todayISO(), now.getHours());
  if (!agora) return null;
  const Ic = I[iconeClima(agora.code)];
  const ch = sessao ? chuvaPerto(todayISO(), sessao.time) : null;
  let prox = null;
  if (!ch) for (let h = now.getHours() + 1; h < 24; h++) { const x = climaHora(todayISO(), h); if (x && x.p >= 50) { prox = { p: x.p, h }; break; } }
  return (
    <span className="wx" title={CLIMA.cidade}>
      <Ic /><span className="t num">{agora.temp}°</span>
      <span className="r">{ch ? `chuva ${ch.p}% perto das ${ch.h}h` : prox ? `chuva ${prox.p}% às ${prox.h}h` : `sem chuva hoje · ${CLIMA.cidade}`}</span>
      {CLIMA.demo && <span className="ex">exemplo</span>}
    </span>
  );
}

// Foto do perfil (ou iniciais) em círculo
function Avatar({ conta, onClick, label = "Sua conta e ajustes" }) {
  const inner = conta.foto ? <img src={conta.foto} alt="" /> : iniciais(conta.nome);
  return onClick ? <button className="me" onClick={onClick} aria-label={label}>{inner}</button> : <span className="me" aria-hidden="true">{inner}</span>;
}
// Lê a foto escolhida, corta em quadrado e reduz para 256px (fica leve para guardar)
function lerFoto(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
        const m = Math.min(img.width, img.height);
        c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
        res(c.toDataURL("image/jpeg", .82));
      };
      img.onerror = rej; img.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
// Lê um arquivo de imagem do aparelho
const lerArquivo = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

// Recortar imagem: arraste para mover, pinça (dois dedos), rodinha do mouse ou a barra para dar zoom.
// forma "circulo" = foto de perfil; forma "tela" = fundo no formato da tela deste aparelho.
function Cropper({ src, forma = "circulo", titulo, onDone, onCancel }) {
  const imgRef = useRef(null), frameRef = useRef(null);
  const ptrs = useRef(new Map()), pinca = useRef(null);
  const [nat, setNat] = useState(null);
  const [z, setZ] = useState(1);
  const [o, setO] = useState({ x: 0, y: 0 });
  const [erro, setErro] = useState("");
  const vw = window.innerWidth, vh = window.innerHeight;
  let W, H;
  if (forma === "circulo") { W = H = Math.min(300, vw - 64); }
  else { const r = vh / vw; H = Math.min(vh * 0.56, 480); W = H / r; if (W > vw - 48) { W = vw - 48; H = W * r; } }
  useEffect(() => { const im = new Image(); im.onload = () => { imgRef.current = im; setNat({ w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = () => setErro("Não consegui abrir essa imagem."); im.src = src; }, [src]);
  const cover = nat ? Math.max(W / nat.w, H / nat.h) : 1;
  const prender = (x, y, zz) => { if (!nat) return { x, y }; const s = cover * zz, mx = (nat.w * s - W) / 2, my = (nat.h * s - H) / 2; return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }; };
  const mudarZoom = nz => { nz = Math.max(1, Math.min(5, nz)); setZ(nz); setO(c => prender(c.x, c.y, nz)); };
  // rodinha do mouse (no computador)
  useEffect(() => {
    const el = frameRef.current; if (!el) return;
    const f = e => { e.preventDefault(); setZ(zz => { const nz = Math.max(1, Math.min(5, zz * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); setO(c => prender(c.x, c.y, nz)); return nz; }); };
    el.addEventListener("wheel", f, { passive: false });
    return () => el.removeEventListener("wheel", f);
  });
  const dist = () => { const [a, b] = [...ptrs.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = e => { e.currentTarget.setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.current.size === 2) pinca.current = { d: dist(), z }; };
  const move = e => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) setO(c => prender(c.x + e.clientX - prev.x, c.y + e.clientY - prev.y, z));
    else if (ptrs.current.size === 2 && pinca.current) mudarZoom(pinca.current.z * dist() / pinca.current.d);
  };
  const up = e => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinca.current = null; };
  const s = cover * z, dw = nat ? nat.w * s : 0, dh = nat ? nat.h * s : 0;
  const left = (W - dw) / 2 + o.x, top = (H - dh) / 2 + o.y;
  const usar = () => {
    const im = imgRef.current; if (!im) return;
    const outW = forma === "circulo" ? 400 : 1080, outH = Math.round(outW * H / W);
    const c = document.createElement("canvas"); c.width = outW; c.height = outH;
    c.getContext("2d").drawImage(im, -left / s, -top / s, W / s, H / s, 0, 0, outW, outH);
    vibrar("ok");
    onDone(c.toDataURL("image/jpeg", forma === "circulo" ? .86 : .82));
  };
  // Vai direto para o <body>: assim aparece por cima de tudo, mesmo aberto de dentro de um painel
  return createPortal(
    <div className="crop" role="dialog" aria-modal="true" aria-label={titulo || "Ajustar imagem"}>
      <div className="crop-top"><button className="icon-btn" onClick={onCancel} aria-label="Cancelar"><I.x /></button><b>{titulo || "Ajustar imagem"}</b><span style={{ width: 42 }} /></div>
      <div className="crop-mid">
        <div ref={frameRef} className={"crop-frame" + (forma === "circulo" ? " circ" : "")} style={{ width: W, height: H }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {nat && <img src={src} alt="" draggable="false" style={{ width: dw, height: dh, left, top }} />}
          <span className="crop-grid" aria-hidden="true" />
        </div>
        <p className="crop-dica">{erro || "Arraste para posicionar. Use dois dedos ou a barra para dar zoom."}</p>
      </div>
      <div className="crop-bot">
        <div className="crop-zoom">
          <button type="button" aria-label="Diminuir zoom" onClick={() => mudarZoom(z / 1.2)}><I.minus /></button>
          <input type="range" min="1" max="5" step="0.01" value={z} onChange={e => mudarZoom(Number(e.target.value))} aria-label="Zoom" />
          <button type="button" aria-label="Aumentar zoom" onClick={() => mudarZoom(z * 1.2)}><I.plus /></button>
        </div>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={usar} disabled={!nat}><I.check /> Usar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PhotoPicker({ nome, foto, onChange }) {
  const [erro, setErro] = useState("");
  const [recortar, setRecortar] = useState(null);
  const escolher = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErro("Escolha um arquivo de imagem.");
    try { setRecortar(await lerArquivo(f)); setErro(""); } catch (x) { setErro("Não consegui abrir essa imagem. Tenta outra?"); }
  };
  return (
    <div className="photo">
      <Avatar conta={{ nome: nome || "?", foto }} />
      <div className="photo-btns">
        <label htmlFor="foto-in">{foto ? "Trocar foto" : "Adicionar foto"}</label>
        <input id="foto-in" className="sr" type="file" accept="image/*" onChange={escolher} />
        {foto && <button type="button" onClick={() => setRecortar(foto)}>Ajustar enquadramento</button>}
        {foto && <button type="button" className="rm" onClick={() => onChange(null)}>Remover foto</button>}
        {erro && <span className="error" style={{ padding: 0 }}>{erro}</span>}
      </div>
      {recortar && <Cropper src={recortar} forma="circulo" titulo="Foto de perfil" onCancel={() => setRecortar(null)} onDone={url => { onChange(url); setRecortar(null); }} />}
    </div>
  );
}

function CalBadge({ iso }) {
  const d = fromISO(iso);
  return <span className="calb" aria-hidden="true"><b>{MES_CURTO[d.getMonth()]}</b><i>{d.getDate()}</i></span>;
}

function Sheet({ title, sub, onClose, children }) {
  // Arrastar para baixo pela alça (ou pelo título) fecha, igual aos apps do celular
  const ref = useRef(null), arr = useRef(null);
  const ini = e => { if (!ref.current) return; arr.current = { y: e.touches[0].clientY, dy: 0 }; ref.current.style.transition = "none"; };
  const mov = e => { if (!arr.current) return; const dy = Math.max(0, e.touches[0].clientY - arr.current.y); arr.current.dy = dy; ref.current.style.translate = `0 ${dy}px`; };
  const fim = () => { if (!arr.current) return; const dy = arr.current.dy; arr.current = null; ref.current.style.transition = "translate .22s ease"; if (dy > 110) { ref.current.style.translate = "0 100vh"; vibrar("toque"); setTimeout(onClose, 160); } else ref.current.style.translate = ""; };
  const arrasto = { onTouchStart: ini, onTouchMove: mov, onTouchEnd: fim, onTouchCancel: fim };
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title || "Painel"} onClick={e => e.stopPropagation()}>
        <div className="grab" {...arrasto} />
        {title && (
          <div className="sheet-head" {...arrasto}>
            <div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><I.x /></button>
          </div>
        )}
        <div className="stack">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, icon, htmlFor, children }) {
  return (
    <div className="field">
      <div className="field-main">{label && <label htmlFor={htmlFor}>{label}</label>}{children}</div>
      {icon && <span className="field-ic" aria-hidden="true">{icon}</span>}
    </div>
  );
}
function Seg({ value, options, onChange, big }) {
  return (
    <div className={"seg" + (big ? " big" : "")} role="radiogroup">
      {options.map(o => <button type="button" key={String(o.v)} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}
const Dots = ({ total, filled }) => <span className="dots" aria-label={`${filled} de ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i < filled ? "f" : ""} />)}</span>;
const Toggle = ({ on, onClick, children }) => <button type="button" className="toggle" role="switch" aria-checked={on} onClick={onClick}><span>{children}</span><span className={"sw" + (on ? " on" : "")} /></button>;

function ConfirmButton({ label, confirmLabel, onConfirm, icon }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button className="btn danger" onClick={() => { if (armed) { vibrar("aviso"); onConfirm(); } else { vibrar("aviso"); setArmed(true); } }}>{icon}{armed ? confirmLabel : label}</button>;
}

function TopBar({ eyebrow, title, act, tema, extra }) {
  return (
    <header className="top">
      <div style={{ minWidth: 0 }}><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>
      <div className="top-actions">
        {extra}
        <span className="nc">
          <button className="icon-btn" onClick={act.trocarTema} aria-label={tema.escuro ? "Usar modo claro" : "Usar modo escuro"}>{tema.escuro ? <I.sun /> : <I.moon />}</button>
        </span>
      </div>
    </header>
  );
}

// Seletor Consultório / Pessoal (menu brilhante)
function ModeSwitch({ modo, setModo, block }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = e => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("pointerdown", f); document.removeEventListener("keydown", k); };
  }, [open]);
  const ops = [["consultorio", "Consultório", "Agenda, pacientes e cobranças"], ["pessoal", "Pessoal", "Gastos e contas da casa"]];
  return (
    <div className={"mode" + (block ? " block" : "")} ref={ref}>
      <button className="mode-pill" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <i className="mode-dot" />{modo === "pessoal" ? "Pessoal" : "Consultório"}<I.chevD />
      </button>
      {open && (
        <div className="menu" role="menu">
          {ops.map(([v, l, d]) => (
            <button key={v} role="menuitemradio" aria-checked={modo === v} className={"mi" + (modo === v ? " on" : "")} onClick={() => { setModo(v); setOpen(false); }}>
              <span className="mi-check">{modo === v && <I.check />}</span>
              <span><b>{l}</b><small>{d}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Gráfico de área (saldo acumulado)
function AreaChart({ serie, cor }) {
  const gid = useMemo(() => "g" + uid(), []);
  const n = serie.length;
  if (n < 2) return <div className="chart-empty">Ainda sem movimento neste período.</div>;
  const W = 320, H = 120;
  const min = Math.min(0, ...serie), max = Math.max(...serie, min + 1);
  const x = i => i / (n - 1) * W, y = v => H - 8 - (v - min) / (max - min) * (H - 20);
  let d = `M${x(0)},${y(serie[0])}`;
  for (let i = 1; i < n; i++) { const cx = (x(i - 1) + x(i)) / 2; d += ` C${cx},${y(serie[i - 1])} ${cx},${y(serie[i])} ${x(i)},${y(serie[i])}`; }
  const c = cor || (serie[n - 1] >= 0 ? "var(--mint-btn)" : "var(--rose)");
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: c, stopOpacity: .42 }} /><stop offset="1" style={{ stopColor: c, stopOpacity: 0 }} /></linearGradient></defs>
        {min < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} style={{ stroke: "var(--line)" }} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
        <path d={d} fill="none" style={{ stroke: c }} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="chart-dot" style={{ top: `${y(serie[n - 1]) / H * 100}%`, background: c }} />
    </div>
  );
}

/* =========================================================
   8. LOGIN E CADASTRO (demonstração)
   ========================================================= */
function Auth({ onLogin }) {
  const [modo, setModo] = useState(() => location.hash === "#criar" ? "criar" : "entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const criar = modo === "criar";
  const enviar = e => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    const contas = lerJSON(K.contas, {});
    if (criar) {
      if (!nome.trim()) return setErro({ t: "Como você quer ser chamado aqui? Pode ser só o primeiro nome." });
      if (!em.includes("@")) return setErro({ t: "Esse e-mail parece incompleto." });
      if (senha.length < 4) return setErro({ t: "Use uma senha com pelo menos 4 caracteres." });
      if (contas[em]) return setErro({ t: "Esse e-mail já tem conta.", b: "Entrar com ele", fn: () => { setModo("entrar"); setErro(null); } });
      const conta = { nome: nome.trim(), email: em, hash: hash(senha) };
      gravar(K.contas, { ...contas, [em]: conta });
      onLogin(conta, true);
    } else {
      const c = contas[em];
      if (!c) return setErro({ t: "Não encontrei esse e-mail.", b: "Criar uma conta", fn: () => { setModo("criar"); setErro(null); } });
      if (c.hash !== hash(senha)) return setErro({ t: "A senha não confere. Tenta de novo, sem pressa." });
      onLogin(c, false);
    }
  };
  return (
    <main className="auth">
      <div className="brand"><i><I.logo /></i>Agenda</div>
      <div className="auth-h">
        <div className="hi">{criar ? "Vamos começar!" : "Que bom te ver!"}</div>
        <h1>{criar ? "Criar conta" : "Entrar"}</h1>
        <p>{criar ? "Leva menos de um minuto." : "Sua agenda, seus pagamentos e suas contas num lugar só."}</p>
      </div>
      <form className="stack" onSubmit={enviar} noValidate>
        <div className="fields">
          {criar && <Field label="Como quer ser chamado(a)" icon={<I.user />} htmlFor="a-nome"><input id="a-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Camila" autoComplete="given-name" /></Field>}
          <Field label="E-mail" icon={<I.mail />} htmlFor="a-email"><input id="a-email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field>
          <Field label="Senha" icon={<I.lock />} htmlFor="a-senha"><input id="a-senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" autoComplete={criar ? "new-password" : "current-password"} /></Field>
        </div>
        {erro && <div className="error" role="alert">{erro.t} {erro.b && <button type="button" onClick={erro.fn} style={{ color: "var(--accent-ink)", fontWeight: 800, textDecoration: "underline" }}>{erro.b}</button>}</div>}
        <button className="btn" type="submit">{criar ? "Criar minha conta" : "Entrar"}</button>
        <button className="btn ghost" type="button" onClick={() => onLogin(CONTA_DEMO, false)}>Só quero ver como funciona</button>
      </form>
      <div className="auth-foot">
        {criar ? <>Já tem conta? <button onClick={() => { setModo("entrar"); setErro(null); }}>Entrar</button></> : <>Primeira vez aqui? <button onClick={() => { setModo("criar"); setErro(null); }}>Criar conta</button></>}
      </div>
      <div className="demo-note">Versão de demonstração: tudo fica salvo só neste aparelho.</div>
    </main>
  );
}

/* =========================================================
   9. CONSULTÓRIO · INÍCIO
   ========================================================= */
function HelloRow({ conta, act, tema, modo }) {
  return (
    <div className="hello">
      <div className="hello-l">
        <Avatar conta={conta} onClick={act.openSettings} />
        {conta.perfil && conta.perfil.pessoal !== false && <ModeSwitch modo={modo} setModo={act.setModo} />}
      </div>
      <div className="top-actions">
        <button className="icon-btn" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button>
        <span className="nc">
          <button className="icon-btn" onClick={act.trocarTema} aria-label={tema.escuro ? "Usar modo claro" : "Usar modo escuro"}>{tema.escuro ? <I.sun /> : <I.moon />}</button>
        </span>
      </div>
    </div>
  );
}

function Talk({ falas }) {
  return (
    <section className="talk" aria-label="Seu resumo">
      <div className="talk-who"><span className="mark"><I.chat /></span>Seu resumo</div>
      {falas.map((f, i) => (
        <div className="bub" key={i}>
          {f.txt}
          {f.acao && <div className="acts-in"><button className="bub-act" onClick={f.acao.fn}>{f.acao.ic}{f.acao.l}</button></div>}
        </div>
      ))}
    </section>
  );
}

function PendingCard({ p, act }) {
  const d = fromISO(p.nextDate);
  const quando = p.nextDate === addDays(todayISO(), -1) ? "de ontem" : `de ${DIA_LONGO[d.getDay()]}, ${dm(p.nextDate)}`;
  return (
    <article className="pend">
      <div className="pend-top">
        <div className="cal-chip" aria-hidden="true">
          <div className="mo">{MES_CURTO[d.getMonth()]}</div>
          <div className="dn num">{d.getDate()}</div>
          <div className="wd">{DIA_CURTO[d.getDay()]} {p.time}</div>
        </div>
        <div className="mid">
          <div className="pend-eyebrow">Faltou marcar</div>
          <div className="pend-q">{primeiro(p.name)} veio na sessão {quando}?</div>
          <div className="pend-meta num">{brl(p.price)} · você recebe {brl(liquido(p))}</div>
        </div>
      </div>
      <div className="pend-actions">
        <button className="pill go" onClick={() => act.rapido(p.id, "done")}><I.check /> Veio</button>
        <button className="pill no" onClick={() => act.rapido(p.id, "missed")}>Faltou</button>
        <button className="pill ghost" onClick={() => act.openItem({ kind: "next", patient: p, date: p.nextDate, time: p.time, modo: "move" })}>Outra data</button>
      </div>
    </article>
  );
}

function HomeTab({ db, conta, now, act, tema }) {
  const t = todayISO(), nm = agoraMin(now);
  const falas = conversa(db, now, act, conta.perfil);
  const atrasados = db.patients.filter(p => p.active && p.nextDate < t).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const prox = itensDoDia(db, t).filter(i => i.kind === "next").find(i => mins(i.time) + DURACAO_SESSAO > nm);
  const chave = t.slice(0, 7);
  const recebido = soma(db.charges.filter(c => c.paid && !c.hidden && c.paidAt && c.paidAt.startsWith(chave)), c => c.amount);
  const aReceber = soma(db.charges.filter(c => !c.paid), c => c.amount);
  const noMes = db.sessions.filter(s => s.status === "done" && s.date.startsWith(chave)).length;
  const d = new Date();

  return (
    <div className="page">
      <HelloRow conta={conta} act={act} tema={tema} modo="consultorio" />
      <h1 className="hello-t">{ehAniversario(conta.perfil) ? "Feliz aniversário" : saudacao(now)}, <b>{conta.nome}</b>.<br />Hoje é {DIA_LONGO[d.getDay()]}, {d.getDate()} de {MES_LONGO[d.getMonth()]}.</h1>
      <WeatherChip cidade={conta.perfil && conta.perfil.cidade} act={act} sessao={prox} />
      <div className="cols">
        <div className="col">
          <Talk falas={falas} />
          <div className="small-acts">
            <button className="chip-btn" onClick={act.agora}><I.target />Só o agora</button>
            <button className="chip-btn" onClick={act.fecharDia}><I.moon />{(db.fechados || {})[t] ? "Dia fechado ✓" : "Fechar o dia"}</button>
            <button className="chip-btn" onClick={act.revisao}><I.chart />Revisão da semana</button>
          </div>
          {atrasados.map(p => <PendingCard key={p.id} p={p} act={act} />)}
          {prox && (
            <button className="next" onClick={() => act.openItem(prox)}>
              <div className="next-top">
                <span className="rc-chip"><span className="rc-ic blue"><I.clock /></span>{nm >= mins(prox.time) ? "Acontecendo agora" : "Próxima sessão"}</span>
                {nm < mins(prox.time) && <span className="countdown">em {duracao(mins(prox.time) - nm)}</span>}
              </div>
              <div className="next-big">
                <span className="next-time num">{prox.time}</span>
                <span style={{ minWidth: 0 }}><span className="next-name" style={{ display: "block" }}>{prox.patient.name}</span><span className="next-sub">{freqNome(prox.patient.freq)} · até {hhmm(mins(prox.time) + DURACAO_SESSAO)}</span></span>
              </div>
              <hr className="dash" />
              <div className="rc-row" style={{ minHeight: 0, padding: "4px 0" }}><span className="l">Você recebe</span><span className="v pos"><Money v={liquido(prox.patient)} /></span></div>
            </button>
          )}
        </div>
        <div className="col">
          <MetaGauge db={db} meta={conta.perfil && conta.perfil.meta} act={act} />
          <section className="bal">
            <div className="bal-top"><span className="lab">Recebido em {MES_LONGO[d.getMonth()]}</span><button className="badge-btn" onClick={() => act.setTab("fin")}>Finanças <I.chev /></button></div>
            <div className="bal-amt"><Money v={recebido} /></div>
            <div className="bal-tiles" style={{ marginTop: 6 }}>
              <button className="bt" onClick={() => act.setTab("fin")}><span>A receber</span><b><Money v={aReceber} /></b></button>
              <div className="bt"><span>Sessões</span><b>{noMes} no mês</b></div>
              <button className="bt" onClick={() => act.setTab("pac")}><span>{TERMO.P}</span><b>{db.patients.filter(p => p.active).length} ativos</b></button>
            </div>
          </section>
          <div className="acts narrow-only">
            <button className="act" onClick={act.novoPaciente}><i><I.plus /></i>{TERMO.S}</button>
            <button className="act" onClick={() => act.setTab("agenda")}><i><I.cal /></i>Agenda</button>
            <button className="act" onClick={() => act.setTab("fin")}><i><I.send /></i>Cobrar</button>
          </div>
          <div className="wide-only">
            <div className="day-head" style={{ marginBottom: 12 }}><h2>Hoje</h2><span>{diaCurto(t)}</span></div>
            <Timeline db={db} iso={t} now={now} act={act} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   10. CONSULTÓRIO · AGENDA
   ========================================================= */
function WeekBar({ db, sel, setSel, vista, setVista, now }) {
  const t = todayISO();
  const touch = useRef(null);
  const d = fromISO(sel);
  const mudar = dir => {
    if (vista === "mes") setSel(toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
    else setSel(addDays(sel, dir * 7));
  };
  const marcas = iso => itensDoDia(db, iso).slice(0, 3).map(i => ({ s: situacao(i, now), c: corDe(i.patient).cor }));
  let corpo;
  if (vista === "semana") {
    const ini = segunda(sel);
    corpo = (
      <div className="week-days">
        {SEMANA.map((l, i) => {
          const iso = addDays(ini, i), dd = fromISO(iso);
          return (
            <button key={iso} className={"wd" + (iso === sel ? " sel" : "") + (iso === t ? " today" : "") + (feriado(iso) ? " hol" : "")} onClick={() => setSel(iso)} aria-pressed={iso === sel} aria-label={diaCurto(iso) + (feriado(iso) ? `, feriado: ${feriado(iso).name}` : "")}>
              <span className="l">{l}</span>
              <span className="n num">{dd.getDate()}</span>
              <span className="ds">{marcas(iso).map((m, k) => <i key={k} className={m.s === "late" ? "late" : ""} style={m.s === "late" ? undefined : { background: m.c, opacity: m.s === "missed" ? .35 : 1 }} />)}</span>
            </button>
          );
        })}
      </div>
    );
  } else {
    const prim = new Date(d.getFullYear(), d.getMonth(), 1);
    const ini = addDays(toISO(prim), -((prim.getDay() + 6) % 7));
    const cells = Array.from({ length: 42 }, (_, i) => addDays(ini, i));
    const linhas = fromISO(cells[35]).getMonth() === d.getMonth() ? 42 : 35;
    corpo = (
      <>
        <div className="month-h">{SEMANA.map(l => <span key={l}>{l}</span>)}</div>
        <div className="month">
          {cells.slice(0, linhas).map(iso => {
            const dd = fromISO(iso), fora = dd.getMonth() !== d.getMonth();
            const sts = fora ? [] : itensDoDia(db, iso).map(i => situacao(i, now));
            const ativos = sts.filter(s => s !== "missed").length;
            const todosFeitos = ativos > 0 && sts.every(s => s === "done" || s === "missed");
            return (
              <button key={iso} disabled={fora} className={"mc" + (fora ? " out" : "") + (iso === sel ? " sel" : "") + (iso === t ? " today" : "") + (!fora && feriado(iso) ? " hol" : "")} onClick={() => { setSel(iso); if (!window.matchMedia("(min-width: 900px)").matches) setVista("semana"); }} aria-label={`${diaCurto(iso)}: ${ativos} sessões`}>
                {sts.includes("late") && <span className="late" />}
                {ativos > 0 ? <span className={"cnt" + (todosFeitos ? " done" : "")}>{ativos}</span> : <span />}
                <span className="n num">{dd.getDate()}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }
  return (
    <section className="week" onTouchStart={e => { touch.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 60) mudar(dx < 0 ? 1 : -1); touch.current = null; }}>
      <div className="week-head">
        <button className="mini" onClick={() => mudar(-1)} aria-label={vista === "mes" ? "Mês anterior" : "Semana anterior"}><I.chevL /></button>
        <span className="ttl">{MES_LONGO[d.getMonth()]} {d.getFullYear()}</span>
        {sel !== t && <button className="mini" onClick={() => setSel(t)}>Hoje</button>}
        <button className={"mini" + (vista === "mes" ? " on" : "")} onClick={() => setVista(vista === "mes" ? "semana" : "mes")} aria-label={vista === "mes" ? "Ver semana" : "Ver mês inteiro"}><I.grid /></button>
        <button className="mini" onClick={() => mudar(1)} aria-label={vista === "mes" ? "Próximo mês" : "Próxima semana"}><I.chev /></button>
      </div>
      {corpo}
    </section>
  );
}

const ROTULO = { up: "você recebe", done: "Atendido", late: "Faltou marcar", missed: "Faltou", proj: "Previsto pela frequência" };
const ICONE = { up: <I.clock />, done: <I.check />, late: <I.alert />, missed: <I.x />, proj: <I.repeat /> };

function Timeline({ db, iso, now, act }) {
  const t = todayISO(), nm = agoraMin(now), hoje = iso === t;
  const itens = itensDoDia(db, iso);
  const linhas = [];
  let fim = null, agoraPosto = !hoje;
  itens.forEach(it => {
    const ini = mins(it.time);
    if (fim !== null && ini - fim >= INTERVALO_MIN) linhas.push({ tipo: "gap", dur: ini - fim });
    if (!agoraPosto && nm < ini) { linhas.push({ tipo: "now" }); agoraPosto = true; }
    linhas.push({ tipo: "item", it, ini });
    fim = Math.max(fim || 0, ini + DURACAO_SESSAO);
  });
  if (!agoraPosto && itens.length) linhas.push({ tipo: "now" });
  const validos = itens.filter(i => situacao(i, now) !== "missed");
  const total = soma(validos, i => i.kind === "log" ? i.session.price - i.session.sublet : liquido(i.patient));
  return (
    <div className="tl">
      <div className="tl-row"><span /><span className="tl-cap"><I.sun /></span><span /></div>
      {feriado(iso) && <div className="tl-row"><span /><span /><div className="hol-note"><I.flag />Feriado: {feriado(iso).name}{feriado(iso).fac ? " (ponto facultativo)" : ""}</div></div>}
      {itens.length === 0 && (
        <div className="tl-row"><span /><span /><div className="tl-empty"><b>Dia livre</b>Nada marcado para {diaCurto(iso)}.<br /><button className="ghost-chip" onClick={act.novoPaciente}><I.plus /> Novo {TERMO.s}</button></div></div>
      )}
      {linhas.map((l, k) => {
        if (l.tipo === "gap") return <div className="tl-row" key={k}><span /><span /><div className="tl-gap">Intervalo livre · {duracao(l.dur)}</div></div>;
        if (l.tipo === "now") return <div className="tl-row tl-now" key={k}><span className="tl-time num">{hhmm(nm)}</span><span className="tl-nowline" aria-label="Agora" /></div>;
        const it = l.it, st = situacao(it, now), p = it.patient;
        const valor = it.kind === "log" ? it.session.price - it.session.sublet : liquido(p);
        const podeMarcar = it.kind === "next" && it.date <= t;
        return (
          <div className="tl-row" key={k}>
            <span className="tl-time num">{it.time}</span>
            <span className={"tl-block " + st} style={corVars(p)}>{ICONE[st]}</span>
            <div className={"tl-card " + st}>
              <button className="tl-main" onClick={() => act.openItem(it)}>
                <span className="nm">{p.name}</span>
                <span className="tm num">{it.time}–{hhmm(l.ini + DURACAO_SESSAO)} · {DURACAO_SESSAO} min</span>
                <span className={"st " + st}>{st === "up" ? <>{ROTULO.up} {brl(valor)}</> : st === "done" ? <>{ROTULO.done} · {brl(valor)}</> : st === "missed" && it.session.cobrada ? <>Faltou · cobrada {brl(valor)}</> : ROTULO[st]}</span>
                {st === "done" && PERFIL.registro !== false && !it.session.registro && <span className="tm" style={{ color: "var(--amber)" }}>Registro pendente</span>}
                {(st === "up" || st === "proj") && (db.confirmados || {})[`${p.id}:${it.date}`] && <span className="tm" style={{ color: "var(--mint)" }}>Confirmado</span>}
                {st === "up" && chuvaPerto(it.date, it.time) && <span className="tm rainy">Chance de chuva {chuvaPerto(it.date, it.time).p}% · saia mais cedo</span>}
              </button>
              <button className={"box " + st} disabled={!podeMarcar && it.kind !== "log"} onClick={() => podeMarcar ? act.rapido(p.id, "done") : act.openItem(it)} aria-label={podeMarcar ? `Marcar que ${primeiro(p.name)} veio` : "Ver detalhes"}>
                {(st === "done" || st === "missed") && ICONE[st]}
              </button>
            </div>
          </div>
        );
      })}
      <div className="tl-row"><span /><span className="tl-cap"><I.moon /></span>
        <span className="tl-end">{validos.length ? <>Fim do dia: <b>{validos.length} {validos.length === 1 ? "sessão" : "sessões"}</b> · você recebe <b>{brl(total)}</b></> : "Bom descanso."}</span>
      </div>
    </div>
  );
}

function AgendaTab({ db, now, act, tema }) {
  const wide = useWide();
  const [sel, setSel] = useState(todayISO());
  const [vista, setVista] = useState(() => window.matchMedia("(min-width: 900px)").matches ? "mes" : "semana");
  const n = itensDoDia(db, sel).filter(i => i.kind !== "log" || i.session.status === "done").length;
  return (
    <div className="page">
      <TopBar eyebrow={`${n ? `${n} ${n === 1 ? "sessão" : "sessões"}` : "Sem sessões"} ${sel === todayISO() ? "hoje" : "neste dia"}`} title="Agenda" act={act} tema={tema}
        extra={<><button className="icon-btn" onClick={act.livres} aria-label="Horários livres para divulgar"><I.share /></button><button className="icon-btn" onClick={act.novoPaciente} aria-label={`Novo ${TERMO.s}`}><I.plus /></button></>} />
      <div className="cols">
        <div className="col"><WeekBar db={db} sel={sel} setSel={setSel} vista={vista} setVista={setVista} now={now} /></div>
        <div className="col">
          <div className="day-head" style={wide ? { marginTop: 0 } : undefined}><h2>{relativo(sel)}</h2><span>{diaCurto(sel)}</span></div>
          {sel > todayISO() && itensDoDia(db, sel).some(i => i.kind !== "log") && <div className="small-acts"><button className="chip-btn" onClick={() => act.confirmar(sel)}><I.send />Mandar confirmação</button></div>}
          <Timeline db={db} iso={sel} now={now} act={act} />
        </div>
      </div>
    </div>
  );
}

function SessionSheet({ db, item, onClose, act }) {
  const p = item.patient;
  const [modo, setModo] = useState(item.modo || "done");
  const [prox, setProx] = useState(addDays(item.date, p.freq));
  const [pago, setPago] = useState(true);
  const [rData, setRData] = useState(item.date);
  const [rHora, setRHora] = useState(p.time);
  const [valor, setValor] = useState(fmtNum(p.price));
  const [subl, setSubl] = useState(fmtNum(sublocacao(p)));
  const [padrao, setPadrao] = useState(false);
  const regraFalta = PERFIL.falta && PERFIL.falta.cobrar;
  const [avisou, setAvisou] = useState(null);
  const sub = `${relativo(item.date)} · ${item.time} · ${freqNome(p.freq).toLowerCase()}`;

  if (item.kind === "log") {
    const s = item.session;
    const charge = s.chargeId ? db.charges.find(c => c.id === s.chargeId && !c.hidden) : null;
    const ultima = !db.sessions.some(x => x.patientId === s.patientId && x.date > s.date);
    return (
      <Sheet onClose={onClose}>
        <span className="rc-chip center">{s.status === "done" ? <><span className="rc-ic"><I.check /></span>Atendimento registrado</> : <><span className="rc-ic rose"><I.x /></span>Falta registrada</>}</span>
        {s.status === "done" || s.cobrada ? <div className="rc-amt"><Money v={s.price - s.sublet} /></div> : <div className="rc-amt muted">Faltou</div>}
        <div className="rc-cap">{p.name}</div>
        <hr className="dash" />
        <div className="rc-rows">
          <div className="rc-row"><span className="l">Data</span><span className="v">{DIA_LONGO[fromISO(s.date).getDay()]}, {s.time}<CalBadge iso={s.date} /></span></div>
          {s.cobrada && <div className="rc-row"><span className="l">Falta</span><span className="v"><span className="chip amber">Cobrada</span></span></div>}
          {(s.status === "done" || s.cobrada) && <>
            <div className="rc-row"><span className="l">Valor da sessão</span><span className="v">{brl(s.price)}</span></div>
            <div className="rc-row"><span className="l">Sublocação</span><span className="v neg">− {brl(s.sublet)}</span></div>
          </>}
          {charge && <div className="rc-row"><span className="l">Pagamento</span><span className="v">{charge.paid ? <span className="chip mint">Pago em {dm(charge.paidAt)}</span> : <span className="chip amber">Em aberto</span>}</span></div>}
        </div>
        {s.status === "done" && PERFIL.registro !== false && <Toggle on={!!s.registro} onClick={() => act.toggleRegistro(s.id)}>Registro da sessão feito</Toggle>}
        {charge && <button className="btn ghost" onClick={() => act.openCharge(charge.id)}><I.receipt /> Ver cobrança</button>}
        {ultima && <ConfirmButton icon={<I.undo />} label="Desfazer registro" confirmLabel="Toque de novo para desfazer" onConfirm={() => act.desfazer(s.id)} />}
        <button className="btn text" onClick={onClose}>Fechar</button>
      </Sheet>
    );
  }
  if (item.kind === "proj") {
    return (
      <Sheet title={p.name} sub={sub} onClose={onClose}>
        <div className="note"><I.repeat /><span>Prevista pela frequência {freqNome(p.freq).toLowerCase()}. Ela vira confirmada quando você marcar a sessão de {dm(p.nextDate)}.</span></div>
        <button className="btn ghost" onClick={() => act.openPatient(p.id)}><I.user /> Ver {TERMO.s}</button>
      </Sheet>
    );
  }
  const vNum = num(valor), sNum = num(subl), liq = vNum - sNum;
  const mudou = Math.abs(vNum - p.price) > 0.001 || Math.abs(sNum - sublocacao(p)) > 0.001;
  const invalido = !(vNum > 0) || liq < 0;
  const abertas = sessoesAbertas(db, p.id);
  const pacote = p.billing === "package";
  const numero = abertas.length + 1;
  const fecha = pacote && numero >= p.packageSize;
  const totalPacote = soma(abertas, s => s.price) + vNum;
  const selTudo = e => e.target.select();

  return (
    <Sheet title={p.name} sub={sub} onClose={onClose}>
      <Seg big value={modo} onChange={setModo} options={[{ v: "done", l: "Veio" }, { v: "missed", l: "Faltou" }, { v: "move", l: "Remarcar" }]} />
      {modo === "done" && <>
        <span className="rc-chip center"><span className="rc-ic"><I.down /></span>Você recebe</span>
        <div className="rc-amt" style={liq < 0 ? { color: "var(--rose)" } : undefined}><Money v={liq} /></div>
        <hr className="dash" />
        <div className="rc-rows">
          <div className="rc-row">
            <label className="l" htmlFor="ed-valor">Valor da sessão</label>
            <label className="edit-money" htmlFor="ed-valor"><span className="pre">R$</span>
              <input id="ed-valor" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" value={valor} onFocus={selTudo} onChange={e => setValor(soNumero(e.target.value))} onBlur={() => setValor(fmtNum(num(valor)))} />
              <I.pencil />
            </label>
          </div>
          <div className="rc-row">
            <label className="l" htmlFor="ed-sub">Sublocação</label>
            <label className="edit-money neg" htmlFor="ed-sub"><span className="pre">− R$</span>
              <input id="ed-sub" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" value={subl} onFocus={selTudo} onChange={e => setSubl(soNumero(e.target.value))} onBlur={() => setSubl(fmtNum(num(subl)))} />
              <I.pencil />
            </label>
          </div>
          {PERFIL.reserva > 0 && liq > 0 && <div className="rc-row"><span className="l">Guardar para imposto ({String(PERFIL.reserva).replace(".", ",")}%)</span><span className="v" style={{ color: "var(--amber)" }}>{brl(liq * PERFIL.reserva / 100)}</span></div>}
          {pacote && <div className="rc-row"><span className="l">Pacote</span><span className="v">{Math.min(numero, p.packageSize)} de {p.packageSize} <Dots total={p.packageSize} filled={Math.min(numero, p.packageSize)} /></span></div>}
          <div className="rc-row"><label className="l" htmlFor="prox-done">Próxima sessão</label><span className="v"><input id="prox-done" className="inline-date" type="date" value={prox} onChange={e => e.target.value && setProx(e.target.value)} /><CalBadge iso={prox} /></span></div>
        </div>
        {invalido
          ? <div className="error" role="alert">{!(vNum > 0) ? "Coloque o valor da sessão." : "A sublocação ficou maior que o valor da sessão."}</div>
          : mudou ? <Toggle on={padrao} onClick={() => setPadrao(!padrao)}>Usar esses valores nas próximas sessões</Toggle>
            : <div className="hint">Toque no valor para mudar só nesta sessão.</div>}
        {fecha && <div className="note amber"><I.bell /><span>Esta sessão fecha o pacote. A mensagem de cobrança de <b>{brl(totalPacote)}</b> fica pronta na hora.</span></div>}
        {!pacote && <Toggle on={pago} onClick={() => setPago(!pago)}>Já recebi o pagamento</Toggle>}
        <button className="btn" disabled={invalido} onClick={() => act.registrar(p.id, { status: "done", nextDate: prox, paidNow: pago, price: vNum, sublet: sNum, padrao })}><I.check /> Confirmar</button>
      </>}
      {modo === "missed" && <>
        {regraFalta ? <>
          <div className="hint">{primeiro(p.name)} avisou com pelo menos {PERFIL.falta.horas}h de antecedência?</div>
          <div className="choices"><button className={"choice" + (avisou === true ? " on" : "")} onClick={() => setAvisou(true)}>Avisou<small>Não cobra</small></button><button className={"choice" + (avisou === false ? " on" : "")} onClick={() => setAvisou(false)}>Não avisou<small>Cobra {brl(p.price)}</small></button></div>
          {avisou === false && <div className="note amber"><I.bell /><span>A falta entra na cobrança{p.billing === "package" ? " e conta no pacote" : ""}, com uma linha explicando na mensagem.</span></div>}
        </> : <div className="note amber"><I.bell /><span>A falta fica no histórico, não conta no pacote e não gera cobrança.</span></div>}
        <div className="rc-rows">
          <div className="rc-row"><label className="l" htmlFor="prox-miss">Próxima sessão</label><span className="v"><input id="prox-miss" className="inline-date" type="date" value={prox} onChange={e => e.target.value && setProx(e.target.value)} /><CalBadge iso={prox} /></span></div>
        </div>
        <button className="btn" disabled={regraFalta && avisou === null} onClick={() => act.registrar(p.id, { status: "missed", nextDate: prox, cobrarFalta: regraFalta && avisou === false })}>Registrar falta</button>
      </>}
      {modo === "move" && <>
        <div className="note"><I.repeat /><span>Muda só esta sessão. Depois dela, a frequência {freqNome(p.freq).toLowerCase()} continua a partir da nova data.</span></div>
        <div className="fields">
          <div className="field row2">
            <div><label htmlFor="r-data">Nova data</label><input id="r-data" type="date" value={rData} onChange={e => e.target.value && setRData(e.target.value)} /></div>
            <div><label htmlFor="r-hora">Horário</label><input id="r-hora" type="time" value={rHora} onChange={e => e.target.value && setRHora(e.target.value)} /></div>
          </div>
        </div>
        <button className="btn" onClick={() => act.remarcar(p.id, rData, rHora)}>Salvar nova data</button>
      </>}
    </Sheet>
  );
}

/* =========================================================
   11. CONSULTÓRIO · PACIENTES
   ========================================================= */
function PatientsTab({ db, act, tema, vista = "ativos", setVista }) {
  const [busca, setBusca] = useState("");
  const ativos = db.patients.filter(p => p.active && p.name.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => (a.nextDate || "").localeCompare(b.nextDate || ""));
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <TopBar eyebrow={`${db.patients.length} ${db.patients.length === 1 ? TERMO.s : TERMO.p}`} title={TERMO.P} act={act} tema={tema}
        extra={<button className="icon-btn" onClick={act.novoPaciente} aria-label={`Novo ${TERMO.s}`}><I.plus /></button>} />
      <div className="stack">
        <Seg big value={vista} onChange={setVista} options={[{ v: "ativos", l: TERMO.P }, { v: "espera", l: `Lista de espera${db.espera.length ? ` (${db.espera.length})` : ""}` }]} />
        {vista === "espera" && <>
          <div className="panel">
            {db.espera.length === 0 && <div className="empty"><b>Lista vazia</b>Quem pedir horário e não couber agora fica aqui.</div>}
            {db.espera.map(e => (
              <button key={e.id} className="txn" onClick={() => act.editEspera(e.id)}>
                <span className="txn-av">{iniciais(e.nome)}</span>
                <span className="mid"><span className="nm">{e.nome}</span><span className="sb">Prefere {e.pref === "qualquer" ? "qualquer horário" : e.pref} · há {diffDias(e.desde, todayISO())} dias{e.obs ? ` · ${e.obs}` : ""}</span></span>
                <I.chev />
              </button>
            ))}
          </div>
          <div className="btn-row"><button className="btn ghost" onClick={act.novaEspera}><I.plus /> Adicionar</button><button className="btn ghost" onClick={act.livres}><I.share /> Horários livres</button></div>
        </>}
        {vista === "ativos" && db.patients.length > 3 && <label className="search"><I.search /><input id="busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Procurar ${TERMO.s}`} aria-label={`Procurar ${TERMO.s}`} /></label>}
        {vista === "ativos" && <div className="panel">
          {ativos.length === 0 && <div className="empty"><b>{busca ? "Ninguém com esse nome" : `Nenhum ${TERMO.s} ainda`}</b>{busca ? "Confira a grafia." : "Toque no + para cadastrar o primeiro."}</div>}
          {ativos.map(p => {
            const ab = sessoesAbertas(db, p.id).length;
            return (
              <button key={p.id} className="txn" onClick={() => act.openPatient(p.id)}>
                <span className="txn-av">{iniciais(p.name)}<i className="cdot" style={{ background: corDe(p).cor }} /></span>
                <span className="mid">
                  <span className="nm">{p.name}</span>
                  <span className="sb">{freqNome(p.freq)} · {relativo(p.nextDate).toLowerCase()} {p.time}</span>
                  <span className="sb">{p.billing === "package" ? <>Pacote <Dots total={p.packageSize} filled={ab} /></> : "Paga por sessão"}</span>
                </span>
                <span className="amt"><Money v={p.price} /></span>
              </button>
            );
          })}
        </div>}
      </div>
    </div>
  );
}

function PatientSheet({ db, pid, onClose, act }) {
  const p = db.patients.find(x => x.id === pid);
  if (!p) return null;
  const hist = db.sessions.filter(s => s.patientId === pid).sort((a, b) => b.date.localeCompare(a.date));
  const feitas = hist.filter(s => s.status === "done");
  const ab = sessoesAbertas(db, pid).length;
  const recebido = soma(db.charges.filter(c => c.patientId === pid && c.paid), c => c.amount);
  return (
    <Sheet title={p.name} sub={`${freqNome(p.freq)} · ${DIA_LONGO[fromISO(p.nextDate).getDay()]} às ${p.time}`} onClose={onClose}>
      <div className="kv">
        <div><span>Próxima sessão</span><b>{relativo(p.nextDate)}</b></div>
        <div><span>Você recebe</span><b className="num">{brl(liquido(p))}</b></div>
        <div><span>Pagamento</span><b>{p.billing === "package" ? `A cada ${p.packageSize}` : "Por sessão"}</b></div>
        <div><span>{p.billing === "package" ? "Pacote atual" : "Sessões feitas"}</span><b>{p.billing === "package" ? <>{ab}/{p.packageSize} <Dots total={p.packageSize} filled={ab} /></> : feitas.length}</b></div>
        <div><span>Sublocação</span><b className="num">{p.subletType === "percent" ? `${p.sublet}%` : brl(p.sublet)}</b></div>
        <div><span>Já recebido</span><b className="num">{brl(recebido)}</b></div>
      </div>
      {p.phone && <div className="hint">WhatsApp: <span style={{ userSelect: "all", color: "var(--fg)" }}>{p.phone}</span></div>}
      {(p.reajusteEm || p.desde) && diffDias(p.reajusteEm || p.desde, todayISO()) >= 365 && !(p.reajusteAdiado && p.reajusteAdiado > todayISO()) && (
        <div className="note amber"><I.money /><span>Há {Math.floor(diffDias(p.reajusteEm || p.desde, todayISO()) / 30)} meses com o mesmo valor. Quando reajustar, é só editar o cadastro.<br /><button className="bub-act" style={{ marginTop: 8 }} onClick={() => act.adiarReajuste(p.id)}>Lembrar em 6 meses</button></span></div>
      )}
      <button className="btn" onClick={() => act.editPatient(p.id)}>Editar cadastro</button>
      <div className="panel">
        <div className="panel-head"><h3>Histórico</h3></div>
        {hist.length === 0 && <div className="empty">Ainda sem sessões registradas.</div>}
        {hist.slice(0, 12).map(s => (
          <div key={s.id} className="txn">
            <CalBadge iso={s.date} />
            <span className="mid"><span className="nm">{DIA_LONGO[fromISO(s.date).getDay()]}</span><span className="sb">{s.time}</span></span>
            {s.status === "done" ? <span className="amt pos"><Money v={s.price - s.sublet} /></span> : <span className="chip rose">Faltou</span>}
          </div>
        ))}
      </div>
      <ConfirmButton label={`Excluir ${TERMO.s}`} confirmLabel="Toque de novo para excluir" onConfirm={() => act.excluir(p.id)} />
    </Sheet>
  );
}

function PatientForm({ initial, total = 0, perfil, pre, onSave, onClose }) {
  const pf = perfil || {};
  const [f, setF] = useState(() => initial
    ? { ...initial, color: corDe(initial).id, price: String(initial.price).replace(".", ","), sublet: String(initial.sublet).replace(".", ",") }
    : { name: pre ? pre.name : "", phone: pre ? pre.phone : "", color: CORES[total % CORES.length].id, price: pf.valorPadrao ? fmtNum(pf.valorPadrao) : "", sublet: pf.subPadrao ? fmtNum(pf.subPadrao).replace(",00", "") : "", subletType: pf.subTipo || "fixed", freq: 7, time: "18:00", billing: "session", packageSize: 4, nextDate: todayISO(), active: true });
  const [erro, setErro] = useState("");
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const price = num(f.price), sub = num(f.sublet);
  const liq = price - (f.subletType === "percent" ? price * sub / 100 : sub);
  const salvarForm = e => {
    e.preventDefault();
    if (!f.name.trim()) return setErro(`Escreva o nome do ${TERMO.s}.`);
    if (!(price > 0)) return setErro("Falta o valor da sessão.");
    if (liq < 0) return setErro("A sublocação ficou maior que o valor da sessão.");
    onSave({ ...f, id: f.id || uid(), name: f.name.trim(), price, sublet: sub, packageSize: Number(f.packageSize) || 4, active: true, desde: f.desde || todayISO(), reajusteEm: initial && price !== initial.price ? todayISO() : f.reajusteEm });
  };
  return (
    <Sheet title={initial ? `Editar ${TERMO.s}` : `Novo ${TERMO.s}`} sub="Preencha uma vez. Datas e contas ficam comigo." onClose={onClose}>
      <form onSubmit={salvarForm} className="stack" noValidate>
        <div className="fields">
          <Field label="Nome" icon={<I.user />} htmlFor="f-nome"><input id="f-nome" value={f.name} onChange={e => up("name", e.target.value)} placeholder={`Nome do ${TERMO.s}`} autoComplete="off" /></Field>
          <Field label="WhatsApp (opcional)" icon={<I.phone />} htmlFor="f-tel"><input id="f-tel" inputMode="tel" value={f.phone} onChange={e => up("phone", e.target.value)} placeholder="43 99999-0000" /></Field>
          <Field label={`Cor na agenda · ${corDe(f).nome}`}>
            <div className="swatches" role="radiogroup" aria-label="Cor na agenda">
              {CORES.map(c => (
                <button type="button" key={c.id} role="radio" aria-checked={f.color === c.id} aria-label={c.nome} className={"swatch" + (f.color === c.id ? " on" : "")} style={{ "--sw": c.cor, "--sw-ink": c.ink }} onClick={() => up("color", c.id)}>
                  {f.color === c.id && <I.check />}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="fields">
          <Field label="Valor da sessão (R$)" icon={<I.money />} htmlFor="f-valor"><input id="f-valor" inputMode="decimal" value={f.price} onChange={e => up("price", soNumero(e.target.value))} placeholder="110,00" /></Field>
          <Field label={f.subletType === "percent" ? "Sublocação (% da sessão)" : "Sublocação por sessão (R$)"} icon={<I.door />} htmlFor="f-sub">
            <input id="f-sub" inputMode="decimal" value={f.sublet} onChange={e => up("sublet", soNumero(e.target.value))} placeholder={f.subletType === "percent" ? "20" : "25,00"} />
            <Seg value={f.subletType} onChange={v => up("subletType", v)} options={[{ v: "fixed", l: "Valor fixo" }, { v: "percent", l: "Porcentagem" }]} />
          </Field>
        </div>
        {price > 0 && <div className="note mint"><I.money /><span>Por sessão você recebe <b>{brl(liq)}</b>.</span></div>}
        <div className="fields">
          <Field label="Frequência"><Seg value={f.freq} onChange={v => up("freq", v)} options={FREQUENCIAS.map(x => ({ v: x.dias, l: x.nome }))} /></Field>
          <div className="field row2">
            <div><label htmlFor="f-data">Próxima sessão</label><input id="f-data" type="date" value={f.nextDate} onChange={e => e.target.value && up("nextDate", e.target.value)} /></div>
            <div><label htmlFor="f-hora">Horário</label><input id="f-hora" type="time" value={f.time} onChange={e => e.target.value && up("time", e.target.value)} /></div>
          </div>
        </div>
        <div className="fields">
          <Field label="Como paga"><Seg value={f.billing} onChange={v => up("billing", v)} options={[{ v: "session", l: "Por sessão" }, { v: "package", l: "Pacote" }]} /></Field>
          {f.billing === "package" && (
            <Field label="Cobrar a cada">
              <div className="stepper">
                <button type="button" aria-label="Menos" onClick={() => up("packageSize", Math.max(2, f.packageSize - 1))}>−</button>
                <b className="num">{f.packageSize}</b>
                <button type="button" aria-label="Mais" onClick={() => up("packageSize", Math.min(12, f.packageSize + 1))}>+</button>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>sessões{price > 0 ? ` · ${brl(price * f.packageSize)}` : ""}</span>
              </div>
            </Field>
          )}
        </div>
        {erro && <div className="error" role="alert">{erro}</div>}
        <button className="btn" type="submit">{initial ? "Salvar alterações" : `Cadastrar ${TERMO.s}`}</button>
      </form>
    </Sheet>
  );
}

/* =========================================================
   12. CONSULTÓRIO · FINANÇAS
   ========================================================= */
// Mapa de bolinhas: cada bolinha é um dia; mais clara = mais sessões
function Ritmo({ db }) {
  const wide = useWide();
  const semanas = wide ? 22 : 14;
  const t = todayISO();
  const ini = addDays(segunda(t), -7 * (semanas - 1));
  const [sel, setSel] = useState(null);
  const linhas = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const feitas = iso => db.sessions.filter(s => s.status === "done" && s.date === iso);
  let total = 0;
  const cols = Array.from({ length: semanas }, (_, w) => linhas.map((_, r) => {
    const iso = addDays(ini, w * 7 + r);
    const n = feitas(iso).length; if (iso <= t) total += n;
    return { iso, n };
  }));
  const meses = cols.map((c, w) => { const m = fromISO(c[0].iso).getMonth(); const prev = w > 0 ? fromISO(cols[w - 1][0].iso).getMonth() : -1; return m !== prev ? MES_CURTO[m] : ""; });
  const grid = { gridTemplateColumns: `28px repeat(${semanas}, minmax(0,1fr))` };
  const det = sel ? feitas(sel) : [];
  return (
    <section className="rhythm">
      <div className="rhythm-head"><div><span>Ritmo de atendimentos</span><b className="num">{total} sessões</b></div><span>últimas {semanas} semanas</span></div>
      <div className="rgrid" style={grid} role="grid" aria-label="Sessões por dia">
        {linhas.map((l, r) => (
          <React.Fragment key={l}>
            <span className="rl">{l}</span>
            {cols.map((c, w) => {
              const { iso, n } = c[r];
              const fut = iso > t;
              const cls = fut ? "fut" : n >= 3 ? "l3" : n === 2 ? "l2" : n === 1 ? "l1" : "";
              return <button key={iso} className={"rd " + cls + (iso === t ? " today" : "") + (iso === sel ? " sel" : "")} disabled={fut} onClick={() => setSel(sel === iso ? null : iso)} aria-label={`${diaCurto(iso)}: ${n} sessões`} />;
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="rmonths" style={grid}><span />{meses.map((m, i) => <span key={i}>{m}</span>)}</div>
      {sel && (
        <div className="rtip">
          <div className="rtip-h"><b style={{ textTransform: "capitalize" }}>{diaCurto(sel)}</b><span>{det.length} {det.length === 1 ? "sessão" : "sessões"} · {brl(soma(det, s => s.price - s.sublet))}</span></div>
          {det.length === 0 ? <div className="r">Dia sem atendimento.</div> : det.map(s => { const p = db.patients.find(x => x.id === s.patientId); return <div className="r" key={s.id}><span>{p ? p.name : "Paciente removido"}</span><span>{s.time}</span></div>; })}
        </div>
      )}
    </section>
  );
}

function FinanceTab({ db, act, tema, meta }) {
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState("abertas");
  const base = new Date();
  const m = new Date(base.getFullYear(), base.getMonth() + off, 1);
  const chave = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
  const doMes = db.sessions.filter(s => s.status === "done" && s.date.startsWith(chave)).sort((a, b) => b.date.localeCompare(a.date));
  const bruto = soma(doMes, s => s.price), sbl = soma(doMes, s => s.sublet), liq = bruto - sbl;
  const recebido = soma(db.charges.filter(c => c.paid && !c.hidden && c.paidAt && c.paidAt.startsWith(chave)), c => c.amount);
  const abertas = db.charges.filter(c => !c.paid).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pagas = db.charges.filter(c => c.paid && !c.hidden && c.paidAt && c.paidAt.startsWith(chave)).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  let previsto = 0;
  if (off === 0) for (let d = todayISO(); d.startsWith(chave); d = addDays(d, 1)) itensDoDia(db, d).forEach(i => { if (i.kind !== "log") previsto += liquido(i.patient); });
  const fimSerie = off === 0 ? todayISO() : `${chave}-${pad(diasNoMes(chave))}`;
  const serie = []; let acc = 0;
  for (let d = `${chave}-01`; d <= fimSerie; d = addDays(d, 1)) { acc += liquidoDia(db, d); serie.push(acc); }
  const pac = id => db.patients.find(p => p.id === id) || { name: "Paciente removido" };
  const nav = <>
    <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
    <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Próximo mês"><I.chev /></button>
  </>;
  return (
    <div className="page">
      <TopBar eyebrow={`${MES_LONGO[m.getMonth()]} de ${m.getFullYear()}`} title="Finanças" act={act} tema={tema} extra={nav} />
      <div className="cols">
        <div className="col">
          <section className="bal">
            <div className="bal-top">
              <span className="lab">Líquido do mês <button className="eye" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button></span>
              {abertas.length > 0 && <button className="badge-btn" onClick={() => setFiltro("abertas")}>{abertas.length} para cobrar <I.chev /></button>}
            </div>
            <div className="bal-amt"><Money v={liq} /></div>
            <div className="bal-sub"><span className="up">+{brl(bruto)} bruto</span><span className="trend dn">− {brl(sbl)} sublocação</span></div>
            <AreaChart serie={serie} cor="var(--mint-btn)" />
            <div className="bal-tiles">
              <div className="bt"><span>Recebido</span><b style={{ color: "var(--mint)" }}><Money v={recebido} /></b></div>
              <div className="bt"><span>A receber</span><b style={{ color: "var(--amber)" }}><Money v={soma(abertas, c => c.amount)} /></b></div>
              <div className="bt"><span>{off === 0 ? "Ainda vem" : "Sessões"}</span><b>{off === 0 ? <Money v={previsto} /> : doMes.length}</b></div>
            </div>
          </section>
          {PERFIL.reserva > 0 && liq > 0 && (
            <div className="reserve">
              <span className="ic"><I.piggy /></span>
              <div style={{ minWidth: 0 }}><b>Guarde {brl(liq * PERFIL.reserva / 100)}</b><span>Para o imposto deste mês ({String(PERFIL.reserva).replace(".", ",")}% do líquido). É uma estimativa simples: confirme com seu contador.</span></div>
            </div>
          )}
          <div className="small-acts">
            <button className="chip-btn" onClick={() => act.exportar(chave)}><I.down />Planilha para o contador</button>
            <button className="chip-btn" onClick={act.revisao}><I.chart />Revisão da semana</button>
          </div>
          <SaudeConsultorio db={db} chave={chave} meta={meta} />
          <Ritmo db={db} />
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-head"><h3>Movimento</h3></div>
            <div className="chips" role="tablist">
              {[["abertas", `Para cobrar${abertas.length ? ` (${abertas.length})` : ""}`], ["pagas", "Pagas"], ["sessoes", "Sessões"]].map(([v, l]) => (
                <button key={v} role="tab" aria-selected={filtro === v} className={"fchip" + (filtro === v ? " on" : "")} onClick={() => setFiltro(v)}>{l}</button>
              ))}
            </div>
            {filtro === "abertas" && (abertas.length === 0 ? <div className="empty"><b>Tudo em dia</b>Ninguém devendo agora.</div> : abertas.map(c => (
              <button key={c.id} className="txn" onClick={() => act.openCharge(c.id)}>
                <span className="txn-av">{iniciais(pac(c.patientId).name)}<i className="cdot" style={{ background: corDe(pac(c.patientId)).cor }} /></span>
                <span className="mid"><span className="nm">{pac(c.patientId).name}</span><span className="sb">{c.sessionIds.length > 1 ? `Pacote de ${c.sessionIds.length}` : "1 sessão"} · desde {dm(c.createdAt)}</span></span>
                <span className="amt warn"><Money v={c.amount} /></span>
              </button>
            )))}
            {filtro === "pagas" && (pagas.length === 0 ? <div className="empty">Nenhum pagamento neste mês.</div> : pagas.map(c => (
              <button key={c.id} className="txn" onClick={() => act.openCharge(c.id)}>
                <span className="txn-av">{iniciais(pac(c.patientId).name)}<i className="cdot" style={{ background: corDe(pac(c.patientId)).cor }} /></span>
                <span className="mid"><span className="nm">{pac(c.patientId).name}</span><span className="sb">Pago em {dm(c.paidAt)}</span></span>
                <span className="amt pos">+<Money v={c.amount} /></span>
              </button>
            )))}
            {filtro === "sessoes" && (doMes.length === 0 ? <div className="empty">Nenhum atendimento neste mês.</div> : doMes.map(s => (
              <div key={s.id} className="txn">
                <CalBadge iso={s.date} />
                <span className="mid"><span className="nm">{pac(s.patientId).name}</span><span className="sb num">{brl(s.price)} − {brl(s.sublet)} sublocação</span></span>
                <span className="amt pos"><Money v={s.price - s.sublet} /></span>
              </div>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChargeSheet({ db, cid, fresh, nomeProf, onClose, act }) {
  const c = db.charges.find(x => x.id === cid);
  const [msg, setMsg] = useState(() => c ? mensagem(db, c, nomeProf) : "");
  const taRef = useRef(null);
  if (!c) return null;
  const p = db.patients.find(x => x.id === c.patientId);
  const ss = c.sessionIds.map(id => db.sessions.find(s => s.id === id)).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  const digits = (p && p.phone || "").replace(/\D/g, "");
  const fone = digits.length >= 10 && digits.length <= 11 ? "55" + digits : digits;
  const wa = `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
  const copiar = () => {
    const fallback = () => { const ta = taRef.current; if (ta) { ta.focus(); ta.select(); } act.toast("Texto selecionado. Copie pelo menu do celular."); };
    try { navigator.clipboard.writeText(msg).then(() => act.toast("Mensagem copiada"), fallback); } catch (e) { fallback(); }
  };
  return (
    <Sheet onClose={onClose}>
      <span className="rc-chip center">{c.paid ? <><span className="rc-ic"><I.check /></span>Pagamento recebido</> : <><span className="rc-ic amber"><I.bell /></span>{fresh ? "Pacote fechado, hora de cobrar" : "Para cobrar"}</>}</span>
      <div className="rc-amt" style={c.paid ? undefined : { color: "var(--fg)" }}><Money v={c.amount} /></div>
      <hr className="dash" />
      <div className="rc-rows">
        <div className="rc-row"><span className="l">Paciente</span><span className="v">{p ? p.name : "Removido"}<span className="txn-av" style={{ width: 40, height: 40 }}>{p ? iniciais(p.name) : "?"}</span></span></div>
        <div className="rc-row"><span className="l">Sessões</span><span className="v num" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>{ss.map(s => dm(s.date)).join(" · ")}</span></div>
        <div className="rc-row"><span className="l">{c.paid ? "Pago em" : "Desde"}</span><span className="v">{DIA_LONGO[fromISO(c.paid ? c.paidAt : c.createdAt).getDay()]}<CalBadge iso={c.paid ? c.paidAt : c.createdAt} /></span></div>
      </div>
      <textarea id="msg-cobranca" ref={taRef} className="msg" value={msg} onChange={e => setMsg(e.target.value)} aria-label="Mensagem de cobrança" />
      {!db.settings.pix && <div className="hint">Coloque sua chave Pix em Ajustes e ela entra sozinha na mensagem.</div>}
      <div className="btn-row">
        <button className="btn" onClick={copiar}><I.copy /> Copiar</button>
        <a className="btn ghost" href={wa} target="_blank" rel="noopener noreferrer"><I.send /> WhatsApp</a>
      </div>
      <Toggle on={c.paid} onClick={() => act.setPago(c.id, !c.paid)}>{c.paid ? `Pago em ${dm(c.paidAt)}` : "Já pagou? Marque aqui"}</Toggle>
    </Sheet>
  );
}

/* =========================================================
   13. PESSOAL · INÍCIO, GASTOS E CONTAS
   ========================================================= */
function LancRow({ l, act }) {
  const cat = catDe(l.cat);
  return (
    <button className="txn" onClick={() => act.editLanc(l.id)}>
      <MarcaLogo key={l.marca || l.cat} marca={l.marca || (acharMarca(l.desc || "") || {}).id} cat={cat} className="txn-av" />
      <span className="mid"><span className="nm">{l.desc || cat.nome}</span><span className="sb">{cat.nome} · {relativo(l.data).toLowerCase()}</span></span>
      <span className={"amt" + (l.tipo === "entrada" ? " pos" : "")}>{l.tipo === "entrada" ? "+" : "−"}<Money v={l.valor} /></span>
    </button>
  );
}

function BillRow({ c, chave, act }) {
  const s = situacaoConta(c, chave), cat = catDe(c.cat);
  const chip = s.st === "paga" ? "mint" : s.st === "atrasada" ? "rose" : s.st === "hoje" || s.st === "breve" ? "amber" : "ghost";
  return (
    <div className="txn">
      <CalBadge iso={vencimento(c, chave)} />
      <button className="mid" style={{ textAlign: "left" }} onClick={() => act.editConta(c.id)}>
        <span className="nm">{c.nome}</span>
        <span className="sb"><span className={"chip " + chip}>{s.txt}</span><span>{cat.nome}</span></span>
      </button>
      <span className="amt"><Money v={c.valor} /></span>
      <button className={"box " + (s.st === "paga" ? "done" : s.st === "atrasada" || s.st === "hoje" ? "late" : "up")} onClick={() => s.st === "paga" ? act.despagarConta(c.id) : act.pagarConta(c.id)} aria-label={s.st === "paga" ? `Desmarcar ${c.nome}` : `Marcar ${c.nome} como paga`}>
        {s.st === "paga" && <I.check />}
      </button>
    </div>
  );
}

function PessoalHome({ db, conta, now, act, tema }) {
  const t = todayISO(), chave = t.slice(0, 7);
  const [rng, setRng] = useState("mes");
  const r = resumoPessoal(db, chave);
  const falas = conversaPessoal(db, act);
  const ini = rng === "7" ? addDays(t, -6) : rng === "30" ? addDays(t, -29) : `${chave}-01`;
  const serie = serieSaldo(db, ini, t);
  const saldo = serie.length ? serie[serie.length - 1] : 0;
  const proximas = db.pessoal.contas.filter(c => !(c.pagas && c.pagas[chave])).sort((a, b) => a.dia - b.dia).slice(0, 4);
  const ultimos = [...db.pessoal.lanc].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  const d = new Date();
  const rotulo = rng === "mes" ? `Sobra de ${MES_LONGO[d.getMonth()]}` : `Saldo dos últimos ${rng} dias`;
  return (
    <div className="page">
      <HelloRow conta={conta} act={act} tema={tema} modo="pessoal" />
      <h1 className="hello-t">{saudacao(now)}, <b>{conta.nome}</b>.<br />Vamos ver como está a casa?</h1>
      <WeatherChip cidade={conta.perfil && conta.perfil.cidade} act={act} />
      <div className="cols">
        <div className="col">
          <Talk falas={falas} />
          <section className="bal">
            <div className="bal-top">
              <span className="lab">{rotulo} <button className="eye" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button></span>
            </div>
            <div className={"bal-amt" + (saldo < 0 ? " neg" : "")}><Money v={saldo} /></div>
            <div className="bal-sub"><span className="up">+{brl(r.entrou)}</span><span className="trend dn">−{brl(r.saiu)}</span><span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 13 }}>no mês</span></div>
            <AreaChart serie={serie} />
            <div className="ranges" role="tablist">
              {[["7", "7 dias"], ["30", "30 dias"], ["mes", "Mês"]].map(([v, l]) => <button key={v} role="tab" aria-selected={rng === v} className={"rg" + (rng === v ? " on" : "")} onClick={() => setRng(v)}>{l}</button>)}
            </div>
          </section>
          <div className="tiles">
            <div className="tile"><I.down /><div><span>Entrou</span><b style={{ color: "var(--mint)" }}><Money v={r.entrou} /></b></div></div>
            <div className="tile"><I.up /><div><span>Saiu</span><b><Money v={r.saiu} /></b></div></div>
            <button className="tile" onClick={() => act.setTab("p-contas")}><I.bill /><div><span>A pagar</span><b style={{ color: r.aPagar ? "var(--amber)" : undefined }}><Money v={r.aPagar} /></b></div></button>
          </div>
          <div className="acts narrow-only">
            <button className="act" onClick={act.falarGasto}><i><I.mic /></i>Falar</button>
            <button className="act" onClick={() => act.novoLanc("saida")}><i><I.minus /></i>Gasto</button>
            <button className="act" onClick={() => act.novoLanc("entrada")}><i><I.plus /></i>Entrada</button>
            <button className="act" onClick={() => act.novaConta()}><i><I.bill /></i>Conta fixa</button>
          </div>
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-head"><h3>Próximas contas</h3><button className="link" onClick={() => act.setTab("p-contas")}>Ver todas</button></div>
            {proximas.length === 0 ? <div className="empty"><b>Nada para pagar</b>Todas as contas do mês estão pagas.</div> : proximas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Últimos lançamentos</h3><button className="link" onClick={() => act.setTab("p-gastos")}>Ver tudo</button></div>
            {ultimos.length === 0 ? <div className="empty">Nada anotado ainda. Toque em + para o primeiro gasto.</div> : ultimos.map(l => <LancRow key={l.id} l={l} act={act} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function GastosTab({ db, act, tema }) {
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState("tudo");
  const base = new Date();
  const m = new Date(base.getFullYear(), base.getMonth() + off, 1);
  const chave = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
  const r = resumoPessoal(db, chave);
  const cats = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]);
  const totalCat = soma(cats, c => c[1]) || 1;
  let lista = db.pessoal.lanc.filter(l => l.data.startsWith(chave));
  if (filtro === "saida") lista = lista.filter(l => l.tipo === "saida");
  if (filtro === "entrada") lista = lista.filter(l => l.tipo === "entrada");
  lista.sort((a, b) => b.data.localeCompare(a.data));
  const grupos = []; lista.forEach(l => { const g = grupos[grupos.length - 1]; if (g && g.d === l.data) g.itens.push(l); else grupos.push({ d: l.data, itens: [l] }); });
  const nav = <>
    <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
    <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Próximo mês"><I.chev /></button>
  </>;
  return (
    <div className="page">
      <TopBar eyebrow={`${MES_LONGO[m.getMonth()]} de ${m.getFullYear()}`} title="Gastos" act={act} tema={tema} extra={nav} />
      <div className="cols">
        <div className="col">
          <section className="bal">
            <div className="bal-top"><span className="lab">Saiu no mês</span><span className="trend">{r.sobra >= 0 ? `Sobra ${brl(r.sobra)}` : `Faltam ${brl(-r.sobra)}`}</span></div>
            <div className="bal-amt"><Money v={r.saiu} /></div>
            {cats.length > 0 && <div className="catbar" aria-hidden="true">{cats.map(([id, v]) => <i key={id} style={{ width: `${v / totalCat * 100}%`, background: (CORES.find(c => c.id === catDe(id).cor) || CORES[0]).cor }} />)}</div>}
            {cats.length === 0 ? <div className="empty">Nenhum gasto neste mês.</div> : cats.map(([id, v]) => {
              const cat = catDe(id);
              return (
                <div className="catrow" key={id} style={catVars(cat)}>
                  <span className="ci"><CatIcon cat={cat} /></span>
                  <div style={{ minWidth: 0 }}><b>{cat.nome}</b><div className="bar"><i style={{ width: `${v / cats[0][1] * 100}%` }} /></div></div>
                  <span className="v"><Money v={v} /></span>
                </div>
              );
            })}
          </section>
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-head"><h3>Lançamentos</h3><button className="link" onClick={() => act.novoLanc("saida")}>+ Novo</button></div>
            <div className="chips" role="tablist">
              {[["tudo", "Tudo"], ["saida", "Gastos"], ["entrada", "Entradas"]].map(([v, l]) => <button key={v} role="tab" aria-selected={filtro === v} className={"fchip" + (filtro === v ? " on" : "")} onClick={() => setFiltro(v)}>{l}</button>)}
            </div>
            {r.consult > 0 && filtro !== "saida" && (
              <div className="txn">
                <span className="txn-av cat" style={catVars({ cor: "azul" })}><I.logo /></span>
                <span className="mid"><span className="nm">Consultório</span><span className="sb">Líquido das sessões do mês</span></span>
                <span className="amt pos">+<Money v={r.consult} /></span>
              </div>
            )}
            {grupos.length === 0 && !(r.consult > 0 && filtro !== "saida") && <div className="empty">Nada por aqui neste mês.</div>}
            {grupos.map(g => (
              <React.Fragment key={g.d}>
                <div className="day-sep">{relativo(g.d)}</div>
                {g.itens.map(l => <LancRow key={l.id} l={l} act={act} />)}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContasTab({ db, act, tema }) {
  const t = todayISO(), chave = t.slice(0, 7);
  const contas = [...db.pessoal.contas].sort((a, b) => a.dia - b.dia);
  const abertas = contas.filter(c => !(c.pagas && c.pagas[chave]));
  const pagas = contas.filter(c => c.pagas && c.pagas[chave]);
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <TopBar eyebrow={`${MES_LONGO[fromISO(t).getMonth()]} · ${pagas.length} de ${contas.length} pagas`} title="Contas fixas" act={act} tema={tema}
        extra={<button className="icon-btn" onClick={() => act.novaConta()} aria-label="Nova conta"><I.plus /></button>} />
      <div className="stack">
        <section className="bal">
          <div className="bal-top"><span className="lab">Falta pagar este mês</span></div>
          <div className="bal-amt" style={{ marginBottom: 2 }}><Money v={soma(abertas, c => c.valor)} /></div>
          <div className="hint" style={{ padding: 0 }}>Já pago: {brl(soma(pagas, c => c.valor))}. Eu aviso no Início um dia antes de cada vencimento.</div>
        </section>
        <div className="panel">
          <div className="panel-head"><h3>A pagar</h3></div>
          {abertas.length === 0 ? <div className="empty"><b>Tudo pago</b>Nenhuma conta pendente neste mês.</div> : abertas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
        </div>
        {pagas.length > 0 && <div className="panel"><div className="panel-head"><h3>Pagas</h3></div>{pagas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}</div>}
        {contas.some(c => c.assinatura) && (
          <div className="panel">
            <div className="panel-head"><h3>Assinaturas</h3><span className="hint" style={{ padding: 0 }}>{brl(soma(contas.filter(c => c.assinatura), c => c.valor))}/mês · {brl(soma(contas.filter(c => c.assinatura), c => c.valor) * 12)}/ano</span></div>
            {contas.filter(c => c.assinatura).map(c => (
              <button key={c.id} className="txn" onClick={() => act.editConta(c.id)}>
                <MarcaLogo marca={(acharMarca(c.nome) || {}).id} cat={catDe(c.cat)} className="txn-av" />
                <span className="mid"><span className="nm">{c.nome}</span><span className="sb">Todo dia {c.dia} · {brl(c.valor * 12)} por ano</span></span>
                <span className="amt"><Money v={c.valor} /></span>
              </button>
            ))}
            <p className="hint" style={{ padding: "4px 0 12px" }}>Ainda usa todas? Cancelar uma que você esqueceu é dinheiro de volta todo mês.</p>
          </div>
        )}
        {contas.length === 0 && <button className="btn mode" onClick={() => act.novaConta()}><I.plus /> Adicionar primeira conta</button>}
      </div>
    </div>
  );
}

/* ---------- Falar na própria tela (sem abrir janela) ----------
   O botão de microfone da barra de baixo acende um degradê colorido de baixo para cima,
   e o que você fala vai aparecendo ali mesmo, com o valor, a categoria e a data. */
function useContagem(alvo) {
  const [v, setV] = useState(alvo);
  const de = useRef(alvo);
  useEffect(() => {
    const ini = de.current, t0 = performance.now(); let raf;
    const passo = agora => { const k = Math.min(1, (agora - t0) / 420), e = 1 - Math.pow(1 - k, 3); const x = ini + (alvo - ini) * e; setV(x); de.current = x; if (k < 1) raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return v;
}
const quandoTxt = off => off === 2 ? "Anteontem" : off === 1 ? "Ontem" : "Hoje";
const reais = v => (Math.round(v * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- Bolinha, o mascote do microfone ----------
   Minimalista: uma bola com dois olhinhos em pílula. Toda a expressão está nos olhos.
   - parado: flutua, pisca, olha em volta e às vezes faz uma cara (piscadinha, olhos espremidos, arregalados, sono)
   - ouvindo: olhos crescem e olham para cima
   - falando: os olhos pulam com a sua voz e a bola estica um pouco
   - entendeu: olhos viram dois arquinhos felizes e ela dá um pulinho
   - não entendeu: inclina, um olho fica menor (cara de "hã?") */
const CARAS_BOLA = ["piscadinha", "espremido", "arregalado", "sono", "piscadinha", "espremido"];
function Bolinha({ estado = "" }) {
  const [olhar, setOlhar] = useState("c");
  const [pisca, setPisca] = useState(false);
  const [cara, setCara] = useState("");
  useEffect(() => {
    let vivo = true; const ts = [];
    const depois = (f, ms) => ts.push(setTimeout(() => vivo && f(), ms));
    const piscar = () => depois(() => { setPisca(true); depois(() => setPisca(false), 120); if (Math.random() < .25) depois(() => { setPisca(true); depois(() => setPisca(false), 110); }, 240); piscar(); }, 2000 + Math.random() * 3500);
    const espiar = () => depois(() => { const r = Math.random(); setOlhar(r < .3 ? "e" : r < .6 ? "d" : r < .72 ? "b" : r < .82 ? "cima" : "c"); depois(() => setOlhar("c"), 700 + Math.random() * 1000); espiar(); }, 2800 + Math.random() * 3200);
    const careta = () => depois(() => { setCara(CARAS_BOLA[Math.floor(Math.random() * CARAS_BOLA.length)]); depois(() => setCara(""), 1400); careta(); }, 7000 + Math.random() * 6000);
    piscar(); espiar(); careta();
    return () => { vivo = false; ts.forEach(clearTimeout); };
  }, []);
  const modo = estado === "contando" ? "feliz" : estado === "faltando" || estado === "erro" ? "confuso" : estado === "falando" ? "falando" : estado === "ouvindo" || estado === "teclado" ? "ouvindo" : "parado";
  const c = modo === "parado" ? cara : "";
  const dir = modo === "ouvindo" || modo === "falando" ? "cima" : modo === "confuso" ? "d" : olhar;
  return (
    <span className={`bolinha ${modo}${c ? " cara-" + c : ""} olha-${dir}${pisca && modo !== "feliz" ? " pisca" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <ellipse className="b-sombra" cx="32" cy="61" rx="13" ry="2" />
        <g className="b-corpo">
          <circle className="b-bola" cx="32" cy="32" r="24" />
          <g className="b-olhos">
            <rect className="b-olho b-oe" x="21.5" y="23" width="6" height="13" rx="3" />
            <rect className="b-olho b-od" x="36.5" y="23" width="6" height="13" rx="3" />
          </g>
          <path className="b-feliz" d="M20.5 32 Q24.5 26.5 28.5 32 M35.5 32 Q39.5 26.5 43.5 32" />
        </g>
      </svg>
    </span>
  );
}

// Logo de verdade da empresa (ou o ícone da categoria quando não é uma marca conhecida)
function MarcaLogo({ marca, cat, className = "" }) {
  const m = marcaPorId(marca);
  const [fonte, setFonte] = useState(0);
  if (!m || fonte > 1) return <span className={className + " cat"} style={catVars(cat)}><CatIcon cat={cat} /></span>;
  return (
    <span className={className + " logo"} title={m.nome}>
      <img src={logoMarca(m, fonte)} alt={m.nome} loading="lazy" referrerPolicy="no-referrer" decoding="async"
        onError={() => setFonte(f => f + 1)}
        onLoad={e => { if (fonte === 0 && e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 16) setFonte(1); }} />
    </span>
  );
}

function VozBarra({ api, db, usaPessoal, onSalvar, onComando, onEditar, onAtivo }) {
  const [ativo, setAtivo] = useState(false);
  const [fase, setFase] = useState("ouvindo"); // ouvindo | teclado | contando | faltando
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState(null);
  const [aviso, setAviso] = useState("");
  const [conta, setConta] = useState(3);
  const tecRef = useRef(null);
  const ocioso = useRef(null);
  const T = TERMO;
  // entende a frase: primeiro procura um paciente ("Felipe veio"), senão é gasto/entrada
  const entender = t => {
    const c = interpretarConsultorio(t, db);
    const itens = interpretarVarios(t);
    if (c && (c.ok || !itens.some(i => i.valor > 0))) return { tipo: "consult", c };
    return { tipo: "gastos", itens };
  };
  const aplicar = t => { setTexto(t); setRes(entender(t)); };
  const concluir = t => {
    aplicar(t); setAviso("");
    if (/^\s*(cancela|cancelar|esquece|deixa pra la|deixa para la)\b/.test(semAcento(t))) { fechar(); return; }
    const r = entender(t);
    let ok = false, msg = "";
    if (r.tipo === "consult") { ok = r.c.ok; if (!ok) msg = `Entendi ${primeiro(r.c.p.name)}, mas não o que aconteceu. Diga "veio", "faltou", "pagou" ou "remarca pra quinta às 15h".`; }
    else if (!r.itens.length || !r.itens.every(i => i.valor > 0)) msg = r.itens.some(i => i.valor > 0) ? "Faltou o valor de alguma coisa." : "Não peguei o valor. Ex.: “gastei 30 no uber”.";
    else if (!usaPessoal) msg = "Para anotar gastos, ligue o modo Pessoal em Perfil.";
    else ok = true;
    if (ok) { setConta(3); setFase("contando"); vibrar("ok"); if (tecRef.current) tecRef.current.blur(); }
    else { setAviso(msg); setFase("faltando"); vibrar("aviso"); }
  };
  const fala = useFalaNativa({ onParcial: aplicar, onFinal: concluir, onFalhou: () => setFase("teclado") });
  const abrirTeclado = () => { fala.cancelar(); setAviso(""); setFase("teclado"); if (tecRef.current) { tecRef.current.value = ""; tecRef.current.focus(); } };
  // chamado direto no toque (o iPhone só libera microfone e teclado dentro do toque)
  const comecar = () => {
    clearTimeout(ocioso.current);
    setTexto(""); setRes(null); setAviso(""); setAtivo(true);
    if (!SRec() || vozTravada()) { abrirTeclado(); return; }
    setFase("ouvindo");
    if (tecRef.current) tecRef.current.blur();
    fala.iniciar();
  };
  const fechar = () => { fala.cancelar(); clearTimeout(ocioso.current); if (tecRef.current) tecRef.current.blur(); setAtivo(false); setFase("ouvindo"); setAviso(""); };
  const salvar = () => { const r = res; fechar(); if (!r) return; if (r.tipo === "consult") onComando(r.c); else onSalvar(r.itens); };
  const tocar = () => {
    if (!ativo) return comecar();
    if (fase === "contando") return salvar();
    if (fase === "teclado") { const t = tecRef.current ? tecRef.current.value : ""; return t.trim() ? concluir(t) : fechar(); }
    if (fala.estado === "ouvindo" || fala.estado === "falando") return fala.parar();
    comecar();
  };
  api.current = { tocar, comecar, fechar };
  // conta para a barra (e para o mascote) o que está acontecendo
  const est0 = fala.estado;
  useEffect(() => { onAtivo(!ativo ? "" : fase === "ouvindo" ? (est0 === "falando" ? "falando" : est0 === "erro" ? "erro" : "ouvindo") : fase); }, [ativo, fase, est0]);
  useEffect(() => { document.documentElement.style.setProperty("--voz-n", ativo ? fala.nivel.toFixed(3) : "0"); }, [fala.nivel, ativo]);
  // saiu do app no meio da fala: desliga tudo (quando voltar, é só tocar de novo)
  useEffect(() => { if (!ativo) return; const f = () => { if (document.visibilityState === "hidden") fechar(); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, [ativo]);
  useEffect(() => {
    if (fase !== "contando") return;
    if (conta <= 0) { salvar(); return; }
    const t = setTimeout(() => setConta(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, conta]);
  useEffect(() => { if (!ativo) return; const k = e => e.key === "Escape" && fechar(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [ativo]);
  // com o teclado aberto, tudo sobe junto e fica logo acima dele (nada some lá em cima)
  useEffect(() => {
    const vv = window.visualViewport, raiz = document.documentElement;
    if (!ativo || !vv) { raiz.style.removeProperty("--teclado"); return; }
    const f = () => raiz.style.setProperty("--teclado", Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + "px");
    f(); vv.addEventListener("resize", f); vv.addEventListener("scroll", f);
    return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); raiz.style.removeProperty("--teclado"); };
  }, [ativo]);
  const digitou = e => {
    const t = e.target.value; aplicar(t);
    clearTimeout(ocioso.current);
    const r = entender(t);
    if ((r.tipo === "consult" && r.c.ok) || (r.tipo === "gastos" && r.itens.some(i => i.valor > 0))) ocioso.current = setTimeout(() => concluir(t), 2600);
  };

  const itens = res && res.tipo === "gastos" ? res.itens.filter(i => i.valor > 0) : [];
  const um = itens.length === 1 ? itens[0] : null;
  const valorVisto = useContagem(itens.length ? soma(itens, i => i.valor) : 0);
  const c = res && res.tipo === "consult" ? res.c : null;
  const est = fala.estado;
  const classe = fase === "contando" ? "pronto" : fase === "faltando" || est === "erro" ? "erro" : est;
  const status = fase === "contando" ? `Entendi · salvando em ${conta}`
    : fase === "teclado" ? "Toque no microfone do teclado e fale"
    : fase === "faltando" ? "Faltou algo" : est === "erro" ? "Não deu para ouvir" : est === "falando" ? "Ouvindo…" : "Pode falar";
  const dica = `Ex.: “gastei 30 no uber”${db.patients.some(p => p.active) ? ` ou “${primeiro(db.patients.find(p => p.active).name)} veio”` : ""}`;
  return (
    <>
      <input ref={tecRef} className={"voz-tec" + (ativo && fase === "teclado" ? " on" : "")} tabIndex={ativo && fase === "teclado" ? 0 : -1} type="text" enterKeyHint="done" autoComplete="off" autoCorrect="on"
        placeholder={dica.replace("Ex.: ", "").replace(/[“”]/g, "")} aria-label="Fale ou escreva" onChange={digitou}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(ocioso.current); if (e.target.value.trim()) concluir(e.target.value); } }} />
      {ativo && <div className={"vozb " + classe + (fase === "teclado" ? " teclado" : "")} style={{ "--n": fala.nivel.toFixed(3) }} aria-live="polite">
        <div className="vozb-sombra" aria-hidden="true"><i /><i /><i /></div>
        <div className="vozb-doca">
          <div className="vozb-status">{fase !== "contando" && fase !== "faltando" && est !== "erro" && <i className="vozb-ponto" />}{status}</div>
          <p className={"vozb-fala" + (texto ? "" : " vazio")}>{texto || (est === "erro" ? fala.erro : fase === "teclado" ? "" : dica)}</p>

          {itens.length > 0 && (
            <div className="vozb-card">
              {itens.slice(0, 3).map((it, i) => (
                <div key={i} className="vozb-linha">
                  <MarcaLogo key={it.marca || it.cat} marca={it.marca} cat={catDe(it.cat)} className="vozb-ic" />
                  <span className="vozb-txt"><b>{it.desc || catDe(it.cat).nome}</b><small>{catDe(it.cat).nome} · {quandoTxt(it.off)}{it.tipo === "entrada" ? " · entrada" : ""}</small></span>
                  <b className={"vozb-v" + (it.tipo === "entrada" ? " in" : "")}>{it.tipo === "entrada" ? "+" : ""}{um ? `R$ ${reais(valorVisto)}` : brlReal(it.valor)}</b>
                </div>
              ))}
              {itens.length > 3 && <div className="vozb-mais">+ {itens.length - 3} · total {brlReal(soma(itens, i => i.valor))}</div>}
              {itens.length > 1 && itens.length <= 3 && <div className="vozb-mais">Total {brlReal(soma(itens, i => i.valor))}</div>}
            </div>
          )}
          {c && (
            <div className="vozb-card">
              <div className="vozb-linha">
                <span className="vozb-ic pac" style={corVars(c.p)}>{c.p.foto ? <img src={c.p.foto} alt="" /> : iniciais(c.p.name)}</span>
                <span className="vozb-txt"><b>{c.p.name}</b><small>{textoAcao(c, T)}</small></span>
                {c.ok && c.acao !== "remarcar" && <span className={"chip " + (c.acao === "falta" ? "rose" : "mint")}>{c.acao === "falta" ? "Falta" : c.acao === "pagou" ? "Pago" : "Sessão"}</span>}
              </div>
            </div>
          )}
          {aviso && <div className="vozb-aviso"><I.alert /><span>{aviso}</span></div>}

          <div className="vozb-acoes">
            {fase === "contando" && <button className="pill-btn forte" onClick={salvar} style={{ "--k": conta / 3 }}><I.check /> Salvar</button>}
            {fase === "contando" && um && <button className="pill-btn" onClick={() => { const it = um; fechar(); onEditar(it); }}><I.pencil /> Ajustar</button>}
            {(fase === "faltando" || est === "erro") && fase !== "teclado" && <button className="pill-btn forte" onClick={comecar}><I.mic /> Falar de novo</button>}
            {(fase === "faltando" || est === "erro") && fase !== "teclado" && <button className="pill-btn" onClick={abrirTeclado}>Teclado</button>}
            {fase === "teclado" && SRec() && <button className="pill-btn" onClick={() => { vozOk(); comecar(); }}><I.mic /> Tentar a voz</button>}
            <button className="pill-btn" onClick={fechar}>Cancelar</button>
          </div>
        </div>
      </div>}
    </>
  );
}

function LancSheet({ inicial, pre, tipo: tipo0, onVoz, onSave, onDelete, onClose }) {
  const [tipo, setTipo] = useState(inicial ? inicial.tipo : pre ? pre.tipo : tipo0);
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : pre && pre.valor ? fmtNum(pre.valor) : "");
  const [cat, setCat] = useState(inicial ? inicial.cat : pre ? pre.cat : null);
  const [desc, setDesc] = useState(inicial ? inicial.desc : pre ? pre.desc : "");
  const [data, setData] = useState(inicial ? inicial.data : pre ? addDays(todayISO(), -(pre.off || 0)) : todayISO());
  const [frase, setFrase] = useState("");
  const [entendi, setEntendi] = useState(null);
  const aplicar = txt => {
    setFrase(txt);
    if (!txt.trim()) { setEntendi(null); return; }
    const r = interpretarFala(txt);
    setTipo(r.tipo); setCat(r.cat); setData(addDays(todayISO(), -r.off));
    if (r.valor) setValor(fmtNum(r.valor));
    if (r.desc) setDesc(r.desc);
    setEntendi(r);
  };
  const lista = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
  const v = num(valor);
  const ok = v > 0 && cat && lista.some(c => c.id === cat);
  return (
    <Sheet title={inicial ? "Editar lançamento" : tipo === "entrada" ? "Nova entrada" : "Novo gasto"} onClose={onClose}>
      {!inicial && <>
        <div className="voice">
          <input id="l-frase" value={frase} onChange={e => aplicar(e.target.value)} placeholder='Fale ou escreva: "gastei 32 na padaria"' enterKeyHint="done" autoComplete="off" aria-label="Descreva o gasto em uma frase" />
          <button type="button" className="mic" onClick={onVoz} aria-label="Falar"><I.mic /></button>
        </div>
        {entendi && entendi.valor > 0 && <div className="voice-ok"><I.check /><span>Entendi: {entendi.tipo === "entrada" ? "entrada" : "gasto"} de {brlReal(entendi.valor)} em {catDe(entendi.cat).nome}{entendi.off ? (entendi.off === 1 ? ", ontem" : ", anteontem") : ", hoje"}. Confira e salve.</span></div>}
      </>}
      <Seg big value={tipo} onChange={x => { setTipo(x); setCat(null); }} options={[{ v: "saida", l: "Gasto" }, { v: "entrada", l: "Entrada" }]} />
      <label className={"big-amt" + (tipo === "entrada" ? " in" : "")} htmlFor="l-valor"><span>R$</span>
        <input id="l-valor" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" autoFocus={!inicial} placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor" />
      </label>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {lista.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => setCat(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label="Descrição (opcional)" htmlFor="l-desc"><input id="l-desc" value={desc} onChange={e => setDesc(e.target.value)} placeholder={tipo === "entrada" ? "Ex.: Freela" : "Ex.: Padaria"} /></Field>
        <Field label="Quando" htmlFor="l-data"><input id="l-data" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field>
      </div>
      {!ok && <div className="hint">{!(v > 0) ? "Digite o valor e escolha uma categoria." : "Escolha uma categoria."}</div>}
      <button className="btn mode" disabled={!ok} onClick={() => onSave({ id: inicial ? inicial.id : uid(), tipo, valor: v, cat, desc: desc.trim(), data })}><I.check /> {inicial ? "Salvar" : tipo === "entrada" ? "Anotar entrada" : "Anotar gasto"}</button>
      {inicial && <ConfirmButton label="Apagar lançamento" confirmLabel="Toque de novo para apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

function ContaSheet({ inicial, onSave, onDelete, onClose }) {
  const [nome, setNome] = useState(inicial ? inicial.nome : "");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [dia, setDia] = useState(inicial ? inicial.dia : 10);
  const [cat, setCat] = useState(inicial ? inicial.cat : "casa");
  const [assin, setAssin] = useState(inicial ? !!inicial.assinatura : false);
  const v = num(valor);
  const ok = nome.trim() && v > 0;
  return (
    <Sheet title={inicial ? "Editar conta" : "Nova conta fixa"} sub="Repete todo mês. Eu aviso antes de vencer." onClose={onClose}>
      <div className="fields">
        <Field label="Nome da conta" icon={<I.bill />} htmlFor="c-nome"><input id="c-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Aluguel, Luz, Internet" /></Field>
        <Field label="Valor (R$)" icon={<I.money />} htmlFor="c-valor"><input id="c-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" /></Field>
        <Field label="Vence todo dia">
          <div className="stepper">
            <button type="button" aria-label="Dia anterior" onClick={() => setDia(Math.max(1, dia - 1))}>−</button>
            <b className="num">{dia}</b>
            <button type="button" aria-label="Próximo dia" onClick={() => setDia(Math.min(31, dia + 1))}>+</button>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>do mês</span>
          </div>
        </Field>
      </div>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {CATEGORIAS.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => setCat(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <Toggle on={assin} onClick={() => setAssin(!assin)}>É uma assinatura (streaming, app, academia)</Toggle>
      <button className="btn mode" disabled={!ok} onClick={() => onSave({ ...(inicial || { pagas: {} }), id: inicial ? inicial.id : uid(), nome: nome.trim(), valor: v, dia, cat, assinatura: assin })}><I.check /> {inicial ? "Salvar" : "Adicionar conta"}</button>
      {inicial && <ConfirmButton label="Apagar conta" confirmLabel="Toque de novo para apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// Meta do mês em arco (inspirado no "Retirement")
function arco(cx, cy, r, a0, a1) {
  const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
}
function MetaGauge({ db, meta, act }) {
  const t = todayISO(), chave = t.slice(0, 7);
  if (!meta) return (
    <section className="goal">
      <div className="goal-head"><div><b>Meta do mês</b><span>Ainda sem meta definida</span></div></div>
      <p className="goal-sub" style={{ margin: "14px 0 0" }}>Com uma meta, eu mostro se o mês está no ritmo e quantas sessões faltam.</p>
      <button className="goal-tip" onClick={() => act.openSettings("dinheiro")}>Definir meta</button>
    </section>
  );
  const liq = liquidoMes(db, chave);
  const dia = fromISO(t).getDate(), dim = diasNoMes(chave);
  const esperado = meta * dia / dim;
  const pct = Math.min(liq / meta, 1), pctE = Math.min(esperado / meta, 1);
  let previsto = 0;
  for (let d = t; d.startsWith(chave); d = addDays(d, 1)) itensDoDia(db, d).forEach(i => { if (i.kind !== "log") previsto += liquido(i.patient); });
  const feitas = db.sessions.filter(s => s.status === "done").slice(-30);
  const media = feitas.length ? soma(feitas, s => s.price - s.sublet) / feitas.length : 0;
  const falta = Math.max(meta - liq, 0);
  const batida = liq >= meta, noRitmo = liq >= esperado * 0.95;
  const A0 = 200, SPAN = 220, ang = v => A0 - SPAN * v;
  const cor = batida || noRitmo ? "var(--mint-btn)" : "var(--rose)";
  const pe = ang(pctE), px = 150 + 118 * Math.cos(pe * Math.PI / 180), py = 150 - 118 * Math.sin(pe * Math.PI / 180);
  return (
    <section className="goal">
      <div className="goal-head"><div><b>Meta do mês</b><span>{brl(meta)} líquidos</span></div><span>dia {dia} de {dim}</span></div>
      <div className="goal-mid">
        <svg viewBox="0 0 300 200" aria-hidden="true">
          <path d={arco(150, 150, 118, A0, A0 - SPAN)} fill="none" style={{ stroke: "var(--surface-3)" }} strokeWidth="22" strokeLinecap="round" />
          {pct > 0.005 && <path d={arco(150, 150, 118, A0, ang(pct))} fill="none" style={{ stroke: cor }} strokeWidth="22" strokeLinecap="round" />}
          {!batida && <g><circle cx={px} cy={py} r="14" style={{ fill: "var(--surface)", stroke: "var(--fg)" }} strokeWidth="3" /><circle cx={px} cy={py} r="4" style={{ fill: "var(--fg)" }} /></g>}
        </svg>
        <div className="goal-val"><Money v={liq} /></div>
        <div className={"goal-st " + (batida || noRitmo ? "ok" : "bad")}>{batida ? "Meta batida!" : noRitmo ? "No ritmo da meta" : `Abaixo do ritmo por ${brl(esperado - liq)}`}</div>
        <div className="goal-sub">{batida ? `Passou ${brl(liq - meta)} da meta.` : `Com a agenda marcada, o mês fecha em ${brl(liq + previsto)}.`}</div>
        {!batida && media > 0 && <span className="goal-tip">Faltam {brl(falta)} · cerca de {Math.ceil(falta / media)} sessões</span>}
      </div>
    </section>
  );
}

// Saúde do consultório (inspirado no Ultrahuman)
const Nivel = ({ n }) => <span className={"lvl " + n[0]}>{n[1]}</span>;
function SaudeConsultorio({ db, chave, meta }) {
  const feitas = db.sessions.filter(s => s.status === "done" && s.date.startsWith(chave));
  const faltas = db.sessions.filter(s => s.status === "missed" && s.date.startsWith(chave)).length;
  const presenca = feitas.length + faltas ? Math.round(feitas.length / (feitas.length + faltas) * 100) : null;
  const ticket = feitas.length ? soma(feitas, s => s.price - s.sublet) / feitas.length : 0;
  const abertas = db.charges.filter(c => !c.paid);
  const atrasadas = abertas.filter(c => diffDias(c.createdAt, todayISO()) > 15).length;
  const doMes = db.charges.filter(c => !c.hidden && c.createdAt.startsWith(chave));
  const pagosPct = doMes.length ? Math.round(soma(doMes.filter(c => c.paid), c => c.amount) / (soma(doMes, c => c.amount) || 1) * 100) : null;
  const metaPct = meta ? Math.min(100, Math.round(liquidoMes(db, chave) / meta * 100)) : null;
  const nv = v => v == null ? ["neu", "Sem dados"] : v >= 90 ? ["top", "Ótimo"] : v >= 70 ? ["bom", "Bom"] : ["at", "Atenção"];
  const ti = ESCONDER ? "•••" : Math.round(ticket).toLocaleString("pt-BR");
  return (
    <section className="panel">
      <div className="panel-head"><h3>Saúde do consultório</h3></div>
      <div className="contrib">
        <div className="ctile"><span className="val num">{feitas.length}<small> sessões</small></span><span className="lab">Atendidas</span><Nivel n={feitas.length ? ["top", "No mês"] : ["neu", "Sem dados"]} /></div>
        <div className="ctile"><span className="val num">{presenca ?? "–"}<small>%</small></span><span className="lab">Presença</span><Nivel n={nv(presenca)} /></div>
        <div className="ctile"><span className="val num"><small>R$ </small>{ti}</span><span className="lab">Por sessão</span><Nivel n={["neu", "Média líquida"]} /></div>
        <div className="ctile"><span className="val num">{abertas.length}<small> {abertas.length === 1 ? "aberta" : "abertas"}</small></span><span className="lab">Cobranças</span><Nivel n={abertas.length === 0 ? ["top", "Em dia"] : atrasadas ? ["at", `${atrasadas} atrasada${atrasadas > 1 ? "s" : ""}`] : ["bom", "Aguardando"]} /></div>
      </div>
      {[["Presença", presenca], ["Pagamentos recebidos", pagosPct], ["Meta do mês", metaPct]].filter(b => b[1] != null).map(([l, v]) => (
        <div className="cbar" key={l}>
          <div className="cbar-h"><span>{l}</span><Nivel n={nv(v)} /></div>
          <div className="cbar-t"><i style={{ width: `${v}%` }} /></div>
        </div>
      ))}
    </section>
  );
}

// Perguntas iniciais: uma por tela, com o porquê de cada pergunta
function Onboarding({ conta, onDone, onSair }) {
  const p0 = conta.perfil || {};
  const [i, setI] = useState(0);
  const [nome, setNome] = useState(conta.nome || "");
  const [foto, setFoto] = useState(conta.foto || null);
  const [nasc, setNasc] = useState(p0.nascimento || "");
  const [prof, setProf] = useState(p0.profissao ? (PROFISSOES.some(x => x.id === p0.profissao) ? p0.profissao : "Outra") : "");
  const [outra, setOutra] = useState(p0.profissao && !PROFISSOES.some(x => x.id === p0.profissao) ? p0.profissao : "");
  const [termo, setTermo] = useState(p0.termo || "");
  const [dur, setDur] = useState(p0.duracao || 0);
  const [valor, setValor] = useState(p0.valorPadrao ? fmtNum(p0.valorPadrao) : "");
  const [temSub, setTemSub] = useState(p0.subPadrao ? "sim" : p0.valorPadrao ? "nao" : "");
  const [sub, setSub] = useState(p0.subPadrao ? String(p0.subPadrao).replace(".", ",") : "");
  const [subTipo, setSubTipo] = useState(p0.subTipo || "fixed");
  const [meta, setMeta] = useState(p0.meta ? fmtNum(p0.meta) : "");
  const [estilo, setEstilo] = useState(p0.estilo || "");
  const [pessoal, setPessoal] = useState(p0.pessoal === undefined ? "" : p0.pessoal ? "sim" : "nao");
  const [cidade, setCidade] = useState(p0.cidade || "");
  const [erro, setErro] = useState("");
  const idade = idadeDe(nasc);
  const profissao = prof === "Outra" ? outra.trim() : prof;
  const escolherProf = id => { setProf(id); const d = (PROFISSOES.find(x => x.id === id) || { termo: "Cliente" }).termo; if (!termo || termo !== d) setTermo(d); };
  const Choice = ({ on, onClick, children, sub, wide }) => <button type="button" className={"choice" + (on ? " on" : "") + (wide ? " wide" : "")} aria-pressed={on} onClick={onClick}>{children}{sub && <small>{sub}</small>}</button>;

  const passos = [
    { q: "Como você quer ser chamado(a)?", why: "É assim que eu vou falar com você todo dia.",
      valida: () => nome.trim() ? "" : "Escreva como quer ser chamado(a).",
      body: <><PhotoPicker nome={nome} foto={foto} onChange={setFoto} /><div className="fields"><Field label="Seu nome" icon={<I.user />} htmlFor="o-nome"><input id="o-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Camila" /></Field></div></> },
    { q: "Quando você nasceu?", why: "Pra eu lembrar do seu aniversário e deixar o dia mais leve.",
      valida: () => !nasc ? "Escolha sua data de nascimento." : idade < 16 || idade > 100 ? "Confere o ano, por favor." : "",
      body: <><div className="fields"><Field label="Data de nascimento" icon={<I.cal />} htmlFor="o-nasc"><input id="o-nasc" type="date" value={nasc} max={todayISO()} onChange={e => setNasc(e.target.value)} /></Field></div>{idade >= 16 && idade <= 100 && <div className="big-num num">{idade} <span style={{ fontSize: 20, color: "var(--muted)" }}>anos</span></div>}</> },
    { q: "Qual é a sua área?", why: "Assim eu uso as palavras certas da sua profissão.",
      valida: () => profissao ? "" : prof === "Outra" ? "Escreva sua área." : "Escolha uma opção.",
      body: <><div className="choices">{PROFISSOES.map(x => <Choice key={x.id} on={prof === x.id} onClick={() => escolherProf(x.id)}>{x.id}</Choice>)}<Choice wide on={prof === "Outra"} onClick={() => escolherProf("Outra")}>Outra área</Choice></div>
        {prof === "Outra" && <div className="fields"><Field label="Qual?" htmlFor="o-outra"><input id="o-outra" value={outra} onChange={e => setOutra(e.target.value)} placeholder="Ex.: Arteterapia" /></Field></div>}</> },
    { q: "Como você chama quem você atende?", why: "Vou usar essa palavra no app inteiro: nos botões, nas listas e nos avisos.",
      valida: () => termo ? "" : "Escolha uma opção.",
      body: <div className="choices">{[["Paciente", "Novo paciente"], ["Cliente", "Novo cliente"], ["Analisando", "Novo analisando"]].map(([v, ex]) => <Choice key={v} wide on={termo === v} onClick={() => setTermo(v)} sub={`Ex.: "${ex}"`}>{v}</Choice>)}</div> },
    { q: "Quanto tempo dura cada sessão?", why: "Uso isso pra montar sua linha do tempo e mostrar os intervalos livres.",
      valida: () => dur ? "" : "Escolha a duração.",
      body: <div className="choices">{DURACOES.map(d => <Choice key={d} on={dur === d} onClick={() => setDur(d)} wide={d === 50}>{d} minutos</Choice>)}</div> },
    { q: "Qual o valor normal da sessão?", why: "Já deixo esse valor pronto quando você cadastrar alguém. Dá pra mudar a qualquer hora.",
      valida: () => !(num(valor) > 0) ? "Digite o valor da sessão." : !temSub ? "Diga se paga sublocação." : temSub === "sim" && !(num(sub) > 0) ? "Digite o valor da sublocação." : "",
      body: <><label className="big-amt" htmlFor="o-valor"><span>R$</span><input id="o-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor da sessão" /></label>
        <div className="hint">Você paga sublocação de sala?</div>
        <div className="choices"><Choice on={temSub === "sim"} onClick={() => setTemSub("sim")}>Sim</Choice><Choice on={temSub === "nao"} onClick={() => setTemSub("nao")}>Não</Choice></div>
        {temSub === "sim" && <div className="fields"><Field label={subTipo === "percent" ? "Sublocação (% da sessão)" : "Sublocação por sessão (R$)"} icon={<I.door />} htmlFor="o-sub"><input id="o-sub" inputMode="decimal" value={sub} onChange={e => setSub(soNumero(e.target.value))} placeholder={subTipo === "percent" ? "20" : "25,00"} /><Seg value={subTipo} onChange={setSubTipo} options={[{ v: "fixed", l: "Valor fixo" }, { v: "percent", l: "Porcentagem" }]} /></Field></div>}</> },
    { q: "Quanto você quer ganhar por mês?", why: "Com uma meta, eu mostro se o mês está no ritmo e quantas sessões faltam. Pode pular.", opcional: true,
      valida: () => "",
      body: <><label className="big-amt in" htmlFor="o-meta"><span>R$</span><input id="o-meta" inputMode="decimal" placeholder="0,00" value={meta} onChange={e => setMeta(soNumero(e.target.value))} aria-label="Meta mensal" /></label><div className="hint" style={{ textAlign: "center" }}>Valor líquido, já sem a sublocação.</div></> },
    { q: "Em que cidade você atende?", why: "Pra eu avisar quando for chover perto do horário das suas sessões. Pode pular.", opcional: true,
      valida: () => "",
      body: <div className="fields"><Field label="Cidade" icon={<I.cloud />} htmlFor="o-cidade"><input id="o-cidade" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: Curitiba" autoComplete="address-level2" /></Field></div> },
    { q: "Como prefere que eu fale com você?", why: "Tem dia que menos é mais. Você muda isso quando quiser.",
      valida: () => !estilo ? "Escolha como prefere o resumo." : !pessoal ? "Diga se quer usar o modo Pessoal." : "",
      body: <><div className="choices"><Choice wide on={estilo === "curto"} onClick={() => setEstilo("curto")} sub="Só os 2 avisos mais importantes">Direto ao ponto</Choice><Choice wide on={estilo === "detalhado"} onClick={() => setEstilo("detalhado")} sub="Até 4 avisos, com mais contexto">Completo</Choice></div>
        <div className="hint">Quer anotar também os gastos e as contas da casa?</div>
        <div className="choices"><Choice on={pessoal === "sim"} onClick={() => setPessoal("sim")}>Sim, quero</Choice><Choice on={pessoal === "nao"} onClick={() => setPessoal("nao")}>Só o consultório</Choice></div></> },
  ];
  const n = passos.length, P = passos[i];
  const terminar = () => onDone({ nome: nome.trim(), foto, perfil: { nascimento: nasc, profissao, termo, duracao: dur, valorPadrao: num(valor), subPadrao: temSub === "sim" ? num(sub) : 0, subTipo, meta: num(meta) || 0, estilo, pessoal: pessoal === "sim", cidade: cidade.trim(), avisos: p0.avisos || AVISOS_PADRAO } });
  const avancar = () => { const e = P.valida(); if (e) { vibrar("erro"); return setErro(e); } vibrar("toque"); setErro(""); if (i === n - 1) terminar(); else { setI(i + 1); window.scrollTo(0, 0); } };
  return (
    <main className="ob">
      <div className="ob-top">
        {i > 0 ? <button className="icon-btn" onClick={() => { setI(i - 1); setErro(""); }} aria-label="Voltar"><I.chevL /></button> : <button className="icon-btn" onClick={onSair} aria-label="Sair"><I.x /></button>}
        <div className="ob-prog" style={{ gridTemplateColumns: `repeat(${n},1fr)` }} aria-hidden="true">{passos.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
        <span className="ob-step">{i + 1} de {n}</span>
      </div>
      <div>
        <h1 className="ob-q">{P.q}</h1>
        <div className="ob-why"><I.chat /><span>{P.why}</span></div>
      </div>
      <div className="ob-body" key={i}>{P.body}</div>
      {erro && <div className="error" role="alert">{erro}</div>}
      <div className="ob-foot">
        <button className="btn" onClick={avancar}>{i === n - 1 ? "Tudo certo, começar" : "Continuar"}</button>
        {P.opcional && <button className="btn text" onClick={() => { if (i === 6) setMeta(""); else setCidade(""); setErro(""); if (i === n - 1) terminar(); else setI(i + 1); }}>Pular por agora</button>}
      </div>
    </main>
  );
}

/* ---------- Avisos com o app fechado: cartão dos Ajustes ---------- */
const TXT_PUSH = {
  servidor: "Falta ligar o servidor de avisos (uma vez só). No computador, dentro da pasta do app, rode: bash servidor-avisos/instalar-avisos.sh",
  instalar: "No iPhone, os avisos com o app fechado só funcionam com o app instalado: no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone.",
  indisponivel: "Este navegador não recebe avisos com o app fechado. No iPhone, precisa do iOS 16.4 ou mais novo e do app instalado na tela inicial.",
  negado: "As notificações estão bloqueadas para o app.",
  permissao: "Toque em Ligar e escolha Permitir.",
  "servidor-fora": "Não consegui falar com o servidor de avisos. Confira a internet e tente de novo.",
  "sem-sw": "O app ainda está terminando de instalar. Feche, abra de novo pelo ícone e tente outra vez.",
  tempo: "Demorou demais para responder. Tente de novo.",
};
const textoNegado = () => ehIOS()
  ? "As notificações estão bloqueadas. Libere em: Ajustes do iPhone → Notificações → Agenda → Permitir Notificações. Depois volte aqui."
  : "As notificações estão bloqueadas. Libere nas configurações do celular: Apps → Agenda (ou Chrome) → Notificações. Depois volte aqui.";

function AvisosFechado({ act }) {
  const [ligado, setLigado] = useState(() => pushLigado());
  const [estado, setEstado] = useState(null);
  const [url, setUrl] = useState(() => lerJSON(K_PUSH_URL, ""));
  const motivo = motivoSemPush();
  const st = lerJSON(K_PUSH, {});
  const explica = m => m === "negado" ? textoNegado() : TXT_PUSH[m] || `Não deu certo (${m}). Tente de novo.`;
  const rodar = async (fn, okTxt) => {
    setEstado({ tipo: "carregando" });
    const r = await fn();
    setLigado(pushLigado());
    setEstado(r === "ok" ? { tipo: "ok", txt: okTxt } : { tipo: "erro", txt: explica(r) });
  };
  return (
    <div className="push-card">
      <div className="push-head">
        <i className={ligado ? "on" : ""}><I.bell /></i>
        <div>
          <b>Avisos com o app fechado</b>
          <span>{ligado ? `Ligados · ${st.total ?? 0} avisos guardados para os próximos dias` : "Sessão chegando, conta vencendo e fechar o dia, mesmo com o celular bloqueado."}</span>
        </div>
      </div>
      {!ligado && motivo && <div className="test-res"><div className="no"><I.alert /><span>{explica(motivo)}</span></div></div>}
      {!ligado && motivo === "servidor" && (
        <Field label="Ou cole o endereço do servidor" icon={<I.send />} htmlFor="s-srv">
          <input id="s-srv" inputMode="url" autoCapitalize="off" autoCorrect="off" value={url} placeholder="https://agenda-avisos….workers.dev" onChange={e => { setUrl(e.target.value); act.setServidor(e.target.value); }} />
        </Field>
      )}
      {!ligado && !motivo && <button className="btn" disabled={estado && estado.tipo === "carregando"} onClick={() => rodar(act.ligarPush, "Pronto! Agora teste: toque em “Testar em 10 s” e feche o app.")}><I.bell /> Ligar avisos com o app fechado</button>}
      {ligado && (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => rodar(() => act.testarPush(0), "Enviado! Deve chegar em alguns segundos.")}>Testar agora</button>
          <button className="btn ghost" onClick={() => rodar(() => act.testarPush(10000), "Agora feche o app (vá para a tela inicial) e espere 10 segundos.")}>Testar em 10 s</button>
        </div>
      )}
      {estado && (estado.tipo === "carregando"
        ? <div className="test-res"><div><I.clock /><span>Só um instante…</span></div></div>
        : <div className="test-res"><div className={estado.tipo === "ok" ? "ok" : "no"}>{estado.tipo === "ok" ? <I.check /> : <I.alert />}<span>{estado.txt}</span></div></div>)}
      {ligado && st.erro && !estado && <div className="hint">Último problema: {explica(st.erro)}</div>}
      {ligado && <button className="btn text" onClick={async () => { await act.desligarPush(); setLigado(false); setEstado(null); }}>Desligar avisos com o app fechado</button>}
    </div>
  );
}

/* =========================================================
   PERFIL (Sua conta): cartão com seus números + seções que abrem em páginas.
   Tudo salva sozinho (sem botão "Salvar" para esquecer de apertar).
   ========================================================= */
function PerfilPage({ db, conta, tema, inicio, onClose, act }) {
  const pf = conta.perfil || {};
  const [aba, setAba] = useState(inicio || null);
  const [nome, setNome] = useState(conta.nome);
  const [foto, setFoto] = useState(conta.foto || null);
  const [profissao, setProfissao] = useState(pf.profissao || "Psicologia");
  const [nasc, setNasc] = useState(pf.nascimento || "");
  const [cidade, setCidade] = useState(pf.cidade || "");
  const [pix, setPix] = useState(db.settings.pix || "");
  const [termo, setTermo] = useState(pf.termo || "Paciente");
  const [dur, setDur] = useState(pf.duracao || 50);
  const [hIni, setHIni] = useState(pf.horaIni ?? 8);
  const [hFim, setHFim] = useState(pf.horaFim ?? 20);
  const [diasT, setDiasT] = useState(pf.diasTrab || [1, 2, 3, 4, 5]);
  const [falta, setFalta] = useState(pf.falta || { cobrar: false, horas: 24 });
  const [regLembrar, setRegLembrar] = useState(pf.registro !== false);
  const [meta, setMeta] = useState(pf.meta ? fmtNum(pf.meta) : "");
  const [valorPadrao, setValorPadrao] = useState(pf.valorPadrao ? fmtNum(pf.valorPadrao) : "");
  const [subPadrao, setSubPadrao] = useState(pf.subPadrao ? fmtNum(pf.subPadrao) : "");
  const [reserva, setReserva] = useState(pf.reserva || 0);
  const av0 = { ...AVISOS_PADRAO, ...(pf.avisos || {}) };
  const [avAtivo, setAvAtivo] = useState(av0.ativo);
  const [antec, setAntec] = useState(av0.antecedencia);
  const [avNomes, setAvNomes] = useState(!!av0.nomes);
  const [avResumo, setAvResumo] = useState(av0.resumo !== false);
  const [avFechar, setAvFechar] = useState(av0.fechar !== false);
  const [estilo, setEstilo] = useState(pf.estilo || "detalhado");
  const [vib, setVib] = useState(pf.vibrar !== false);
  const [pessoal, setPessoal] = useState(pf.pessoal !== false);
  const [permissao, setPermissao] = useState(() => "Notification" in window ? Notification.permission : "indisponivel");
  const [teste, setTeste] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const primeira = useRef(true);
  const topo = useRef(null);

  // Salva sozinho meio segundo depois da última mudança
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    const t = setTimeout(() => {
      const atual = conta.perfil || {};
      act.salvarPerfil({
        nome: nome.trim() || conta.nome, foto,
        perfil: { ...atual, profissao, nascimento: nasc, cidade: cidade.trim(), termo, duracao: dur, horaIni: hIni, horaFim: hFim, diasTrab: diasT, falta, registro: regLembrar,
          meta: num(meta) || 0, valorPadrao: num(valorPadrao) || atual.valorPadrao || 0, subPadrao: num(subPadrao), reserva,
          avisos: { ...av0, ...(atual.avisos || {}), ativo: avAtivo, antecedencia: antec, nomes: avNomes, resumo: avResumo, fechar: avFechar },
          estilo, vibrar: vib, pessoal },
      }, pix.trim());
      setSalvo(true);
    }, 450);
    return () => clearTimeout(t);
  }, [nome, foto, profissao, nasc, cidade, pix, termo, dur, hIni, hFim, diasT, falta, regLembrar, meta, valorPadrao, subPadrao, reserva, avAtivo, antec, avNomes, avResumo, avFechar, estilo, vib, pessoal]);
  useEffect(() => { if (!salvo) return; const t = setTimeout(() => setSalvo(false), 1600); return () => clearTimeout(t); }, [salvo]);
  useEffect(() => { if (topo.current) topo.current.scrollTop = 0; }, [aba]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = e => { if (e.key === "Escape") { if (aba) setAba(null); else onClose(); } };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", k); };
  }, [aba]);

  const testar = atraso => { setTeste({ esperando: atraso > 0 }); act.testarAviso(atraso).then(r => { setTeste({ r }); if ("Notification" in window) setPermissao(Notification.permission); }); };
  const textoTeste = {
    ok: "Notificação enviada. Se não apareceu, confira se o app pode mostrar notificações nas configurações do celular.",
    negado: "As notificações estão bloqueadas. Libere nas configurações do celular.",
    pendente: "Você ainda não permitiu as notificações. Toque em Testar e escolha Permitir.",
    indisponivel: "Este navegador não tem notificações. No iPhone, instale o app na tela inicial (iOS 16.4 ou mais novo).",
    bloqueado: "O navegador bloqueou a notificação. Instale o app na tela inicial e teste de novo.",
  };
  const textoPermissao = { granted: "Permitidas", denied: "Bloqueadas", default: "Ainda não pedidas", indisponivel: "Indisponíveis neste navegador" };

  // Números do cartão
  const hoje = todayISO(), chave = hoje.slice(0, 7);
  const ativos = db.patients.filter(p => p.active).length;
  const sessMes = db.sessions.filter(s => s.status === "done" && s.date.startsWith(chave)).length;
  const liqMes = liquidoMes(db, chave);
  let seguidos = 0;
  for (let i = 1; i < 60; i++) { const d = addDays(hoje, -i); if (!itensDoDia(db, d).length) continue; if ((db.fechados || {})[d]) seguidos++; else break; }
  const idade = idadeDe(nasc);
  const T = termoDe(termo);
  const diasTxt = diasT.length === 5 && [1, 2, 3, 4, 5].every(d => diasT.includes(d)) ? "seg a sex" : [1, 2, 3, 4, 5, 6, 0].filter(d => diasT.includes(d)).map(d => DIA_CURTO[d].toLowerCase()).join(", ");
  const temaNome = { dark: "Escuro", light: "Claro", auto: "Do aparelho" }[tema.modo];

  const secoes = [
    { grupo: "Você", itens: [
      { id: "dados", ic: <I.user />, t: "Dados pessoais", v: [profissao, cidade].filter(Boolean).join(" · ") || "Nome, foto e cidade" },
      { id: "pix", ic: <I.key />, t: "Chave Pix", v: pix ? "Entra nas cobranças" : "Ainda não colocou" },
    ] },
    { grupo: "Consultório", itens: [
      { id: "agenda", ic: <I.cal />, t: "Agenda", v: `${hIni}h às ${hFim}h · ${diasTxt || "sem dias"}` },
      { id: "dinheiro", ic: <I.wallet />, t: "Valores e metas", v: meta ? `Meta de ${brl(num(meta))}` : "Sem meta" },
      { id: "avisos", ic: <I.bell />, t: "Avisos", v: !avAtivo ? "Desligados" : pushLigado() ? `Com o app fechado · ${antec} min antes` : `${antec} min antes` },
    ] },
    { grupo: "App", itens: [
      { id: "visual", ic: <I.sun />, t: "Aparência e fundo", v: temaNome },
      ...[{ id: "pessoal", ic: <I.piggy />, t: "Modo Pessoal", v: pessoal ? "Ligado" : "Desligado" }],
      { id: "app", ic: <I.down />, t: "Instalar e atalhos", v: appInstalado() ? "Instalado" : "Colocar na tela inicial" },
    ] },
  ];
  const titulo = { dados: "Dados pessoais", pix: "Chave Pix", agenda: "Agenda", dinheiro: "Valores e metas", avisos: "Avisos", visual: "Aparência e fundo", pessoal: "Modo Pessoal", app: "Instalar e atalhos" }[aba];

  return createPortal(
    <div className="perfil" data-mode={act.modo} role="dialog" aria-modal="true" aria-label={titulo || "Perfil"} ref={topo}>
      <div className="perfil-in">
        <div className="perfil-top">
          <button className="icon-btn" onClick={() => aba ? setAba(null) : onClose()} aria-label={aba ? "Voltar" : "Fechar"}>{aba ? <I.chevL /> : <I.x />}</button>
          <b>{titulo || "Perfil"}</b>
          <span className={"perfil-salvo" + (salvo ? " on" : "")} aria-live="polite">{salvo ? <><I.check /> Salvo</> : ""}</span>
        </div>

        {!aba && <>
          <div className="perfil-hero">
            <button className="perfil-foto" onClick={() => setAba("dados")} aria-label="Trocar foto e dados">
              <Avatar conta={{ nome: nome || "?", foto }} /><i><I.pencil /></i>
            </button>
            <h2>{nome || conta.nome}</h2>
            <p>{[profissao, idade ? `${idade} anos` : null].filter(Boolean).join(" · ")}</p>
            <span className="perfil-email">{conta.email}{conta.demo ? " · demonstração" : ""}</span>
            <div className="perfil-nums">
              <div><b>{ativos}</b><span>{ativos === 1 ? `${T.s} ativo` : `${T.p} ativos`}</span></div>
              <div><b>{sessMes}</b><span>{sessMes === 1 ? "sessão no mês" : "sessões no mês"}</span></div>
              <div><b className="num">{ESCONDER ? "R$ •••" : `R$ ${Math.round(liqMes).toLocaleString("pt-BR")}`}</b><span>líquido no mês</span></div>
            </div>
            {seguidos >= 2 && <div className="perfil-seq"><I.flag /> Você fechou o dia {seguidos} vezes seguidas</div>}
          </div>

          {secoes.map(g => (
            <div key={g.grupo} className="perfil-grupo">
              <h3>{g.grupo}</h3>
              <div className="perfil-lista">
                {g.itens.map(it => (
                  <button key={it.id} className="perfil-row" onClick={() => setAba(it.id)}>
                    <i>{it.ic}</i><span><b>{it.t}</b><small>{it.v}</small></span><I.chev />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="perfil-grupo">
            <h3>Conta</h3>
            <div className="perfil-lista">
              <button className="perfil-row" onClick={act.refazer}><i><I.repeat /></i><span><b>Refazer perguntas iniciais</b><small>Muda profissão, valores e jeito do app</small></span><I.chev /></button>
              <button className="perfil-row" onClick={act.sair}><i><I.out /></i><span><b>Sair da conta</b><small>Seus dados ficam guardados neste aparelho</small></span><I.chev /></button>
            </div>
          </div>
          <ConfirmButton label="Apagar meus dados" confirmLabel="Toque de novo para apagar tudo" onConfirm={act.zerar} />
          {db.patients.length === 0 && <button className="btn text" onClick={act.carregarExemplo}>Carregar dados de exemplo</button>}
        </>}

        {aba === "dados" && <div className="stack">
          <PhotoPicker nome={nome} foto={foto} onChange={setFoto} />
          <div className="fields">
            <Field label="Como quer ser chamado(a)" icon={<I.user />} htmlFor="p-nome"><input id="p-nome" value={nome} onChange={e => setNome(e.target.value)} /></Field>
            <Field label="Data de nascimento" htmlFor="p-nasc"><input id="p-nasc" type="date" value={nasc} onChange={e => setNasc(e.target.value)} /></Field>
            <Field label="Cidade (para o clima e a chuva)" icon={<I.cloud />} htmlFor="p-cidade"><input id="p-cidade" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: Curitiba" /></Field>
          </div>
          <h3 className="section-title">Profissão</h3>
          <div className="chips-wrap">{PROFISSOES.map(p => <button type="button" key={p.id} className={"chip-op" + (profissao === p.id ? " on" : "")} aria-pressed={profissao === p.id} onClick={() => { setProfissao(p.id); setTermo(p.termo); }}>{p.id}</button>)}</div>
          <div className="fields"><Field label="Quem você atende"><Seg value={termo} onChange={setTermo} options={["Paciente", "Cliente", "Analisando"].map(v => ({ v, l: v }))} /></Field></div>
          {ehAniversario({ nascimento: nasc }) && <div className="note mint"><I.star /><span>Feliz aniversário! Hoje o app fica mais leve com você.</span></div>}
        </div>}

        {aba === "pix" && <div className="stack">
          <div className="fields"><Field label="Sua chave Pix" icon={<I.key />} htmlFor="p-pix"><input id="p-pix" value={pix} onChange={e => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" autoCapitalize="off" /></Field></div>
          <div className="hint">Ela entra sozinha no fim das mensagens de cobrança, para o {T.s} só copiar e pagar.</div>
        </div>}

        {aba === "agenda" && <div className="stack">
          <div className="fields">
            <Field label="Horário de atendimento">
              <div className="stepper">
                <button type="button" aria-label="Começa mais cedo" onClick={() => setHIni(Math.max(5, hIni - 1))}>−</button><b className="num">{hIni}h</b><button type="button" aria-label="Começa mais tarde" onClick={() => setHIni(Math.min(hFim - 1, hIni + 1))}>+</button>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>até</span>
                <button type="button" aria-label="Termina mais cedo" onClick={() => setHFim(Math.max(hIni + 1, hFim - 1))}>−</button><b className="num">{hFim}h</b><button type="button" aria-label="Termina mais tarde" onClick={() => setHFim(Math.min(23, hFim + 1))}>+</button>
              </div>
            </Field>
            <Field label="Dias em que atende">
              <div className="slots">{[1, 2, 3, 4, 5, 6, 0].map(d => <button type="button" key={d} className={"slot" + (diasT.includes(d) ? "" : " off")} style={{ textDecoration: "none" }} aria-pressed={diasT.includes(d)} onClick={() => setDiasT(diasT.includes(d) ? diasT.filter(x => x !== d) : [...diasT, d])}>{DIA_CURTO[d]}</button>)}</div>
            </Field>
            <Field label="Duração da sessão (minutos)"><Seg value={dur} onChange={setDur} options={DURACOES.map(d => ({ v: d, l: String(d) }))} /></Field>
          </div>
          <Toggle on={regLembrar} onClick={() => setRegLembrar(!regLembrar)}>Lembrar do registro depois de cada sessão</Toggle>
          <Toggle on={falta.cobrar} onClick={() => setFalta({ ...falta, cobrar: !falta.cobrar })}>Cobrar falta sem aviso</Toggle>
          {falta.cobrar && <div className="fields"><Field label="Aviso mínimo para não cobrar (horas)"><Seg value={falta.horas} onChange={h => setFalta({ ...falta, horas: h })} options={[12, 24, 48].map(h => ({ v: h, l: `${h}h` }))} /></Field></div>}
        </div>}

        {aba === "dinheiro" && <div className="stack">
          <div className="fields">
            <Field label="Meta líquida do mês (R$)" icon={<I.target />} htmlFor="p-meta"><input id="p-meta" inputMode="decimal" value={meta} onChange={e => setMeta(soNumero(e.target.value))} placeholder="Sem meta" /></Field>
            <Field label={`Valor padrão da sessão para ${T.p} novos (R$)`} icon={<I.money />} htmlFor="p-valor"><input id="p-valor" inputMode="decimal" value={valorPadrao} onChange={e => setValorPadrao(soNumero(e.target.value))} placeholder="0,00" /></Field>
            <Field label="Sublocação padrão por sessão (R$)" icon={<I.door />} htmlFor="p-sub"><input id="p-sub" inputMode="decimal" value={subPadrao} onChange={e => setSubPadrao(soNumero(e.target.value))} placeholder="Sem sublocação" /></Field>
            <Field label="Separar para o imposto (% do líquido)"><Seg value={reserva} onChange={setReserva} options={[0, 10, 15, 20, 27.5].map(v => ({ v, l: v ? String(v).replace(".", ",") : "Não" }))} /></Field>
          </div>
          <div className="hint">Estimativa simples para não levar susto. O valor certo do Carnê-Leão quem calcula é o contador.</div>
          <div className="fields"><Field label="Resumo do Início"><Seg value={estilo} onChange={setEstilo} options={[{ v: "curto", l: "Direto ao ponto" }, { v: "detalhado", l: "Completo" }]} /></Field></div>
        </div>}

        {aba === "avisos" && <div className="stack">
          <div className="fields">
            <Field label="Avisos de sessão, contas e pendências"><Seg value={avAtivo} onChange={setAvAtivo} options={[{ v: true, l: "Ligados" }, { v: false, l: "Desligados" }]} /></Field>
            <Field label="Avisar antes da sessão (minutos)"><Seg value={antec} onChange={setAntec} options={[5, 10, 15, 30].map(m => ({ v: m, l: String(m) }))} /></Field>
          </div>
          <Toggle on={avResumo} onClick={() => setAvResumo(!avResumo)}>Resumo do dia de manhã</Toggle>
          <Toggle on={avFechar} onClick={() => setAvFechar(!avFechar)}>Lembrar de fechar o dia</Toggle>
          <Toggle on={avNomes} onClick={() => setAvNomes(!avNomes)}>Mostrar o nome do {T.s} no aviso</Toggle>
          {!avNomes && <div className="hint">O aviso diz só “Sessão em {antec} min”, sem nome. Mais discreto na tela bloqueada.</div>}
          <AvisosFechado act={act} />
          {!pushLigado() && <>
            <div className="hint">Teste com o app aberto · notificações: <b>{textoPermissao[permissao] || permissao}</b></div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => testar(0)}><I.bell /> Testar aqui</button>
              <button className="btn ghost" onClick={() => testar(10000)}>Em 10 segundos</button>
            </div>
            {teste && (teste.esperando
              ? <div className="test-res"><div><I.clock /><span>Aguarde 10 segundos com o app aberto.</span></div></div>
              : <div className="test-res"><div className={teste.r === "ok" ? "ok" : "no"}>{teste.r === "ok" ? <I.check /> : <I.alert />}<span>{textoTeste[teste.r] || textoTeste.bloqueado}</span></div></div>)}
          </>}
        </div>}

        {aba === "visual" && <div className="stack">
          <div className="fields"><Field label="Aparência"><Seg value={tema.modo} onChange={tema.setModo} options={[{ v: "dark", l: "Escuro" }, { v: "light", l: "Claro" }, { v: "auto", l: "Do aparelho" }]} /></Field></div>
          <h3 className="section-title">Fundo do app</h3>
          <FundoPicker fundo={conta.fundo} meus={act.meusFundos} onChange={act.setFundo} onAdd={act.addFundo} onUpdate={act.updFundo} onDelete={act.delFundo} />
          <Toggle on={vib} onClick={() => { setVib(!vib); VIBRAR = !vib; if (!vib) vibrar("ok"); }}>Vibrar nos toques</Toggle>
          <div className="hint">No iPhone a vibração é bem leve (o iPhone só deixa apps da web darem um toquinho).</div>
        </div>}

        {aba === "pessoal" && <div className="stack">
          <div className="note"><I.piggy /><span>O modo Pessoal guarda os gastos da casa, as contas fixas e o que sobra no mês, separado do consultório.</span></div>
          <Toggle on={pessoal} onClick={() => setPessoal(!pessoal)}>Usar também o modo Pessoal</Toggle>
          {pessoal && <Toggle on={db.pessoal.incluirConsultorio} onClick={act.toggleIncluir}>Contar o líquido do consultório como entrada no Pessoal</Toggle>}
        </div>}

        {aba === "app" && <div className="stack">
          <InstalarApp />
          <a className="btn ghost" href={`${BASE}sobre/`} target="_blank" rel="noopener"><I.share /> Página do app, para indicar a colegas</a>
          <div className="hint">Atalhos: links do app terminados em <b>#gasto</b>, <b>#agora</b>, <b>#fechar</b> ou <b>#livres</b> abrem direto o gasto por voz, o Só o agora, o Fechar o dia e os horários livres. No Android, segure o ícone do app para ver os atalhos.</div>
        </div>}
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   12b. ROTINAS E FERRAMENTAS (Fechar o dia, Só o agora, Revisão,
        Confirmação, Horários livres, Lista de espera, Registros)
   ========================================================= */
function copiarTexto(txt, act, ok = "Copiado") {
  try { navigator.clipboard.writeText(txt).then(() => act.toast(ok), () => act.toast("Não consegui copiar aqui. Segure o texto para copiar.")); }
  catch (e) { act.toast("Não consegui copiar aqui. Segure o texto para copiar."); }
}
const waLink = (phone, txt) => { const d = (phone || "").replace(/\D/g, ""); const f = d.length >= 10 && d.length <= 11 ? "55" + d : d; return `https://wa.me/${f}?text=${encodeURIComponent(txt)}`; };
const msgConfirma = (p, iso, time) => `Oi, ${primeiro(p.name)}! Tudo bem? Confirmando nossa sessão ${iso === addDays(todayISO(), 1) ? "amanhã" : `de ${DIA_LONGO[fromISO(iso).getDay()]}`} (${dm(iso)}) às ${time}. Até lá!`;
const registroPendente = db => PERFIL.registro === false ? [] : db.sessions.filter(s => s.status === "done" && !s.registro && s.date >= addDays(todayISO(), -7)).sort((a, b) => a.date.localeCompare(b.date));
const semanaKey = iso => segunda(iso);

// Horários livres nos próximos dias, dentro do horário de trabalho
function horariosLivres(db, inicio, nDias) {
  const hi = PERFIL.horaIni ?? 8, hf = PERFIL.horaFim ?? 20, dias = PERFIL.diasTrab || [1, 2, 3, 4, 5];
  const out = [];
  for (let k = 0; k < nDias; k++) {
    const iso = addDays(inicio, k), d = fromISO(iso);
    if (!dias.includes(d.getDay()) || feriado(iso)) continue;
    const ocup = itensDoDia(db, iso).filter(i => !(i.kind === "log" && i.session.status === "missed")).map(i => [mins(i.time), mins(i.time) + DURACAO_SESSAO]);
    const livres = [];
    for (let m = hi * 60; m + DURACAO_SESSAO <= hf * 60; m += 60) if (!ocup.some(([a, b]) => m < b && a < m + DURACAO_SESSAO)) livres.push(m);
    if (livres.length) out.push({ iso, livres });
  }
  return out;
}
const hTxt = m => m % 60 ? hhmm(m) : `${Math.floor(m / 60)}h`;
const periodoDe = m => m < 12 * 60 ? "manhã" : m < 18 * 60 ? "tarde" : "noite";

// FECHAR O DIA: uma etapa por vez
function FecharDia({ db, conta, onClose, act }) {
  const t = todayISO();
  const amanha = addDays(t, 1);
  const etapas = ["sessoes", ...(PERFIL.registro === false ? [] : ["registros"]), "cobrancas", "amanha", ...(PERFIL.pessoal !== false ? ["gastos"] : []), "fim"];
  const [i, setI] = useState(0);
  const e = etapas[i];
  const hoje = itensDoDia(db, t);
  const abertosHoje = hoje.filter(x => x.kind === "next");
  const regs = registroPendente(db);
  const cobr = db.charges.filter(c => !c.paid);
  const amanhaIts = itensDoDia(db, amanha).filter(x => x.kind !== "log");
  const gastosHoje = (db.pessoal.lanc || []).filter(l => l.data === t);
  const feitos = hoje.filter(x => x.kind === "log" && contaDinheiro(x.session));
  const pac = id => db.patients.find(p => p.id === id) || { name: "Removido" };
  const titulos = { sessoes: "Sessões de hoje", registros: "Registros das sessões", cobrancas: "Quem precisa ser cobrado", amanha: "Amanhã", gastos: "Gastos de hoje", fim: "Dia fechado" };
  const prox = () => { if (i < etapas.length - 1) setI(i + 1); };
  useEffect(() => { if (e === "fim") act.marcarFechado(t); }, [e]);
  return (
    <Sheet title={titulos[e]} sub={e === "fim" ? diaCurto(t) : `Passo ${i + 1} de ${etapas.length - 1} para fechar o dia`} onClose={onClose}>
      <div className="ob-prog" style={{ gridTemplateColumns: `repeat(${etapas.length},1fr)` }} aria-hidden="true">{etapas.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
      {e === "sessoes" && (abertosHoje.length === 0
        ? <div className="note mint"><I.check /><span>Todas as sessões de hoje estão marcadas.</span></div>
        : <div className="panel">{abertosHoje.map(x => (
            <div className="txn" key={x.patient.id}>
              <span className="txn-av">{iniciais(x.patient.name)}<i className="cdot" style={{ background: corDe(x.patient).cor }} /></span>
              <span className="mid"><span className="nm">{x.patient.name}</span><span className="sb">{x.time}</span></span>
              <button className="pill go" style={{ height: 40, padding: "0 14px" }} onClick={() => act.rapido(x.patient.id, "done", true)}><I.check /> Veio</button>
              <button className="pill no" style={{ height: 40, padding: "0 12px", background: "var(--surface-2)" }} onClick={() => act.rapido(x.patient.id, "missed", true)}>Faltou</button>
            </div>))}</div>)}
      {e === "registros" && (regs.length === 0
        ? <div className="note mint"><I.check /><span>Nenhum registro pendente.</span></div>
        : <><div className="hint">Toque para marcar o que você já registrou. Eu guardo só o "feito", nunca o conteúdo.</div>
          <div className="panel">{regs.map(s => (
            <button className="txn" key={s.id} onClick={() => act.toggleRegistro(s.id)}>
              <span className="txn-av">{iniciais(pac(s.patientId).name)}</span>
              <span className="mid"><span className="nm">{pac(s.patientId).name}</span><span className="sb">{relativo(s.date)} · {s.time}</span></span>
              <span className={"box " + (s.registro ? "done" : "up")}>{s.registro && <I.check />}</span>
            </button>))}</div></>)}
      {e === "cobrancas" && (cobr.length === 0
        ? <div className="note mint"><I.check /><span>Ninguém devendo agora.</span></div>
        : <div className="panel">{cobr.map(c => (
            <div className="txn" key={c.id}>
              <span className="txn-av">{iniciais(pac(c.patientId).name)}</span>
              <span className="mid"><span className="nm">{pac(c.patientId).name}</span><span className="sb num">{brl(c.amount)} · desde {dm(c.createdAt)}</span></span>
              <button className="bub-act" onClick={() => copiarTexto(mensagem(db, c, conta.nome), act, "Mensagem copiada")}><I.copy />Copiar</button>
            </div>))}</div>)}
      {e === "amanha" && (amanhaIts.length === 0
        ? <div className="note"><I.sun /><span>Amanhã está livre de sessões.</span></div>
        : <><div className="hint">Mande a confirmação agora e tire isso da cabeça.</div>
          <div className="panel">{amanhaIts.map(x => {
            const ok = db.confirmados[`${x.patient.id}:${amanha}`];
            const txt = msgConfirma(x.patient, amanha, x.time);
            return (
              <div className="txn" key={x.patient.id}>
                <span className="txn-av">{iniciais(x.patient.name)}</span>
                <span className="mid"><span className="nm">{x.patient.name}</span><span className="sb">{x.time}{ok && <span className="chip mint">Confirmado</span>}</span></span>
                <button className="bub-act" onClick={() => { copiarTexto(txt, act, "Confirmação copiada"); act.setConfirmado(x.patient.id, amanha, true); }}><I.copy />Copiar</button>
              </div>);
          })}</div></>)}
      {e === "gastos" && <>
        <div className="note"><I.wallet /><span>{gastosHoje.length ? `Você anotou ${gastosHoje.length} ${gastosHoje.length === 1 ? "lançamento" : "lançamentos"} hoje.` : "Nenhum gasto anotado hoje. Lembra de algum?"}</span></div>
        <button className="btn ghost" onClick={() => { onClose(); act.falarGasto(); }}><I.mic /> Anotar falando</button>
      </>}
      {e === "fim" && <>
        <span className="rc-chip center"><span className="rc-ic"><I.check /></span>Dia fechado</span>
        <div className="rc-amt"><Money v={soma(feitos, x => x.session.price - x.session.sublet)} /></div>
        <div className="rc-cap">{feitos.length} {feitos.length === 1 ? "sessão" : "sessões"} hoje</div>
        <hr className="dash" />
        <div className="rc-rows">
          <div className="rc-row"><span className="l">Amanhã</span><span className="v">{amanhaIts.length ? amanhaIts.map(x => x.time).join(" · ") : "livre"}</span></div>
          <div className="rc-row"><span className="l">Para cobrar</span><span className="v">{cobr.length ? brl(soma(cobr, c => c.amount)) : "nada"}</span></div>
        </div>
        <div className="hint" style={{ textAlign: "center" }}>Pode desligar. O resto fica comigo.</div>
        <button className="btn" onClick={onClose}>Boa noite</button>
      </>}
      {e !== "fim" && <button className="btn" onClick={prox}>{i === etapas.length - 2 ? "Fechar o dia" : "Próximo"}</button>}
    </Sheet>
  );
}

// SÓ O AGORA: uma coisa por vez, em letra grande
// Tela acesa enquanto o "Só o agora" está aberto (Screen Wake Lock)
function useTelaAcesa() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let trava = null, vivo = true;
    const pedir = () => { if (document.visibilityState === "visible") navigator.wakeLock.request("screen").then(t => { if (vivo) trava = t; else t.release(); }).catch(() => {}); };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => { vivo = false; document.removeEventListener("visibilitychange", pedir); try { trava && trava.release(); } catch (e) {} };
  }, []);
}
function Agora({ db, conta, now, onClose, act }) {
  useTelaAcesa();
  const t = todayISO(), nm = agoraMin(now), chave = t.slice(0, 7);
  const [pular, setPular] = useState(0);
  const lista = [];
  db.patients.filter(p => p.active && p.nextDate < t).forEach(p => lista.push({ k: "atr" + p.id, rot: "Faltou marcar", tit: `${primeiro(p.name)} veio ${p.nextDate === addDays(t, -1) ? "ontem" : `em ${dm(p.nextDate)}`}?`, sub: `Sessão das ${p.time}`, acoes: [["Veio", "go", () => act.rapido(p.id, "done", true)], ["Faltou", "no", () => act.rapido(p.id, "missed", true)]] }));
  const hoje = itensDoDia(db, t).filter(i => i.kind === "next");
  hoje.forEach(i => {
    const ini = mins(i.time), fim = ini + DURACAO_SESSAO;
    if (nm >= ini && nm < fim) lista.push({ k: "now" + i.patient.id, rot: "Agora", tit: `Sessão com ${primeiro(i.patient.name)}`, sub: `Até as ${hhmm(fim)}`, acoes: [["Terminou: veio", "go", () => act.rapido(i.patient.id, "done", true)]] });
    else if (nm >= fim) lista.push({ k: "mk" + i.patient.id, rot: "Marcar", tit: `${primeiro(i.patient.name)} veio hoje?`, sub: `Sessão das ${i.time}`, acoes: [["Veio", "go", () => act.rapido(i.patient.id, "done", true)], ["Faltou", "no", () => act.rapido(i.patient.id, "missed", true)]] });
  });
  const prox = hoje.find(i => mins(i.time) > nm);
  if (prox) { const ch = chuvaPerto(t, prox.time); lista.push({ k: "px", rot: `Em ${duracao(mins(prox.time) - nm)}`, tit: `${primeiro(prox.patient.name)} às ${prox.time}`, sub: ch ? `Chance de chuva de ${ch.p}%: saia uns 10 min antes.` : `${freqNome(prox.patient.freq)} · você recebe ${brl(liquido(prox.patient))}`, acoes: [] }); }
  if (PERFIL.pessoal !== false) db.pessoal.contas.forEach(c => { const s = situacaoConta(c, chave); if (s.st === "hoje" || s.st === "atrasada") lista.push({ k: "c" + c.id, rot: s.txt, tit: `Pagar ${c.nome}`, sub: brl(c.valor), acoes: [["Já paguei", "go", () => act.pagarConta(c.id)]] }); });
  db.charges.filter(c => !c.paid).forEach(c => { const p = db.patients.find(x => x.id === c.patientId); if (p) lista.push({ k: "cb" + c.id, rot: "Cobrar", tit: `${primeiro(p.name)}: ${brl(c.amount)}`, sub: `Em aberto desde ${dm(c.createdAt)}`, acoes: [["Copiar mensagem", "go", () => copiarTexto(mensagem(db, c, conta.nome), act, "Mensagem copiada")], ["Já pagou", "no", () => act.setPago(c.id, true)]] }); });
  registroPendente(db).forEach(s => { const p = db.patients.find(x => x.id === s.patientId); if (p) lista.push({ k: "r" + s.id, rot: "Registro", tit: `Registro de ${primeiro(p.name)}`, sub: `Sessão de ${relativo(s.date).toLowerCase()} às ${s.time}`, acoes: [["Feito", "go", () => act.toggleRegistro(s.id)]] }); });
  const item = lista[pular % Math.max(lista.length, 1)];
  return (
    <div className="focus" role="dialog" aria-modal="true" aria-label="Só o agora">
      <div className="focus-top"><span>Só o agora</span><button className="icon-btn" onClick={onClose} aria-label="Fechar"><I.x /></button></div>
      {item ? (
        <div className="focus-body" key={item.k}>
          <span className="focus-rot">{item.rot}</span>
          <h2 className="focus-tit">{item.tit}</h2>
          <p className="focus-sub">{item.sub}</p>
          <div className="focus-acts">{item.acoes.map(([l, c, fn]) => <button key={l} className={"pill " + c} onClick={fn}>{l}</button>)}</div>
        </div>
      ) : (
        <div className="focus-body"><span className="focus-rot">Tudo certo</span><h2 className="focus-tit">Nada pendente agora.</h2><p className="focus-sub">Respira. Eu te aviso quando precisar.</p></div>
      )}
      <div className="focus-foot">
        {lista.length > 1 && <button className="btn ghost" onClick={() => setPular(pular + 1)}>Mostrar outra coisa ({(pular % lista.length) + 1} de {lista.length})</button>}
        <button className="btn text" onClick={onClose}>Voltar ao app</button>
      </div>
    </div>
  );
}

// REVISÃO DA SEMANA
function RevisaoSheet({ db, onClose, act }) {
  const t = todayISO();
  const ini = fromISO(t).getDay() === 0 ? segunda(t) : addDays(segunda(t), -7); // domingo: semana atual; outros dias: semana passada
  const fim = addDays(ini, 6), iniAnt = addDays(ini, -7);
  const naSemana = (a, b) => s => s.date >= a && s.date <= b;
  const feitas = db.sessions.filter(s => contaDinheiro(s) && naSemana(ini, fim)(s));
  const faltas = db.sessions.filter(s => s.status === "missed" && naSemana(ini, fim)(s)).length;
  const liq = soma(feitas, s => s.price - s.sublet);
  const liqAnt = soma(db.sessions.filter(s => contaDinheiro(s) && naSemana(iniAnt, addDays(ini, -1))(s)), s => s.price - s.sublet);
  const pIni = addDays(fim, 1), pFim = addDays(pIni, 6);
  let proxSessoes = 0; const feriadosProx = [];
  for (let d = pIni; d <= pFim; d = addDays(d, 1)) { proxSessoes += itensDoDia(db, d).filter(i => i.kind !== "log").length; if (feriado(d)) feriadosProx.push(`${feriado(d).name} (${dm(d)})`); }
  const contasProx = PERFIL.pessoal === false ? [] : db.pessoal.contas.filter(c => { const v = vencimento(c, pIni.slice(0, 7)); return v >= pIni && v <= pFim && !(c.pagas && c.pagas[pIni.slice(0, 7)]); });
  const dif = liq - liqAnt;
  useEffect(() => { act.marcarRevisao(semanaKey(t)); }, []);
  return (
    <Sheet onClose={onClose}>
      <span className="rc-chip center"><span className="rc-ic blue"><I.chart /></span>Semana de {dm(ini)} a {dm(fim)}</span>
      <div className="rc-amt"><Money v={liq} /></div>
      <div className="rc-cap">{dif === 0 ? "igual à semana anterior" : `${dif > 0 ? "+" : "−"}${brl(Math.abs(dif))} que a semana anterior`}</div>
      <hr className="dash" />
      <div className="rc-rows">
        <div className="rc-row"><span className="l">Sessões</span><span className="v">{feitas.length}</span></div>
        <div className="rc-row"><span className="l">Faltas</span><span className="v">{faltas}</span></div>
        <div className="rc-row"><span className="l">Para cobrar</span><span className="v">{brl(soma(db.charges.filter(c => !c.paid), c => c.amount))}</span></div>
      </div>
      <h3 className="section-title">Próxima semana</h3>
      <div className="rc-rows">
        <div className="rc-row"><span className="l">Sessões marcadas</span><span className="v">{proxSessoes}</span></div>
        {feriadosProx.length > 0 && <div className="rc-row"><span className="l">Feriado</span><span className="v" style={{ color: "var(--rose)" }}>{feriadosProx.join(", ")}</span></div>}
        {contasProx.length > 0 && <div className="rc-row"><span className="l">Contas vencendo</span><span className="v">{contasProx.map(c => c.nome).join(", ")}</span></div>}
      </div>
      <button className="btn" onClick={onClose}>Fechado, boa semana</button>
    </Sheet>
  );
}

// CONFIRMAÇÃO DA VÉSPERA
function ConfirmSheet({ db, iso, onClose, act }) {
  const its = itensDoDia(db, iso).filter(i => i.kind !== "log");
  return (
    <Sheet title={`Confirmar ${relativo(iso).toLowerCase()}`} sub={`${diaCurto(iso)} · ${its.length} ${its.length === 1 ? "sessão" : "sessões"}`} onClose={onClose}>
      {its.length === 0 && <div className="empty">Nenhuma sessão nesse dia.</div>}
      {its.map(x => {
        const ok = db.confirmados[`${x.patient.id}:${iso}`], txt = msgConfirma(x.patient, iso, x.time);
        return (
          <div className="panel" key={x.patient.id}>
            <div className="txn">
              <span className="txn-av">{iniciais(x.patient.name)}<i className="cdot" style={{ background: corDe(x.patient).cor }} /></span>
              <span className="mid"><span className="nm">{x.patient.name}</span><span className="sb">{x.time}</span></span>
              <button className={"box " + (ok ? "done" : "up")} onClick={() => act.setConfirmado(x.patient.id, iso, !ok)} aria-label={ok ? "Desmarcar confirmação" : "Marcar como confirmado"}>{ok && <I.check />}</button>
            </div>
            <p className="hint" style={{ padding: "0 0 10px" }}>{txt}</p>
            <div className="btn-row" style={{ paddingBottom: 12 }}>
              <button className="btn ghost" style={{ height: 44, fontSize: 15 }} onClick={() => { copiarTexto(txt, act, "Confirmação copiada"); act.setConfirmado(x.patient.id, iso, true); }}><I.copy /> Copiar</button>
              <a className="btn ghost" style={{ height: 44, fontSize: 15 }} href={waLink(x.patient.phone, txt)} target="_blank" rel="noopener noreferrer" onClick={() => act.setConfirmado(x.patient.id, iso, true)}><I.send /> WhatsApp</a>
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}

// HORÁRIOS LIVRES PARA DIVULGAR
function LivresSheet({ db, onClose, act }) {
  const inicio = addDays(todayISO(), 1);
  const [dias, setDias] = useState(7);
  const [fora, setFora] = useState({});
  const lista = horariosLivres(db, inicio, dias);
  const texto = "Olá! Tenho estes horários livres " + (dias === 7 ? "nos próximos dias" : "nas próximas semanas") + ":\n" + lista.map(d => {
    const hs = d.livres.filter(m => !fora[d.iso + m]);
    return hs.length ? `• ${DIA_LONGO[fromISO(d.iso).getDay()].replace(/^./, c => c.toUpperCase())} (${dm(d.iso)}): ${hs.map(hTxt).join(", ")}` : null;
  }).filter(Boolean).join("\n") + "\n\nSe algum servir, me chama por aqui.";
  return (
    <Sheet title="Horários livres" sub={`Entre ${PERFIL.horaIni ?? 8}h e ${PERFIL.horaFim ?? 20}h · toque para tirar um horário`} onClose={onClose}>
      <Seg value={dias} onChange={setDias} options={[{ v: 7, l: "Próximos 7 dias" }, { v: 14, l: "14 dias" }]} />
      {lista.length === 0 && <div className="empty"><b>Agenda cheia</b>Nenhum horário livre nesse período.</div>}
      {lista.map(d => (
        <div key={d.iso}>
          <div className="day-sep" style={{ color: feriado(d.iso) ? "var(--rose)" : undefined }}>{diaCurto(d.iso)}</div>
          <div className="slots">{d.livres.map(m => <button key={m} className={"slot" + (fora[d.iso + m] ? " off" : "")} onClick={() => setFora({ ...fora, [d.iso + m]: !fora[d.iso + m] })}>{hTxt(m)}</button>)}</div>
        </div>
      ))}
      {lista.length > 0 && <>
        <textarea className="msg" style={{ minHeight: 150 }} readOnly value={texto} aria-label="Texto para divulgar" />
        <button className="btn" onClick={() => copiarTexto(texto, act, "Horários copiados")}><I.copy /> Copiar texto</button>
      </>}
    </Sheet>
  );
}

// LISTA DE ESPERA
function EsperaSheet({ inicial, onSave, onDelete, onClose }) {
  const [nome, setNome] = useState(inicial ? inicial.nome : "");
  const [phone, setPhone] = useState(inicial ? inicial.phone : "");
  const [pref, setPref] = useState(inicial ? inicial.pref : "qualquer");
  const [obs, setObs] = useState(inicial ? inicial.obs : "");
  return (
    <Sheet title={inicial ? "Lista de espera" : "Adicionar à lista de espera"} sub="Quando abrir um horário que combina, eu te aviso." onClose={onClose}>
      <div className="fields">
        <Field label="Nome" icon={<I.user />} htmlFor="e-nome"><input id="e-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" /></Field>
        <Field label="WhatsApp (opcional)" icon={<I.phone />} htmlFor="e-tel"><input id="e-tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="43 99999-0000" /></Field>
        <Field label="Prefere"><Seg value={pref} onChange={setPref} options={[["manhã", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"], ["qualquer", "Tanto faz"]].map(([v, l]) => ({ v, l }))} /></Field>
        <Field label="Observação (opcional)" htmlFor="e-obs"><input id="e-obs" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: indicação da Ana" /></Field>
      </div>
      <button className="btn" disabled={!nome.trim()} onClick={() => onSave({ ...(inicial || { desde: todayISO(), id: uid() }), nome: nome.trim(), phone, pref, obs: obs.trim() })}><I.check /> Salvar</button>
      {inicial && <button className="btn ghost" onClick={() => onDelete(inicial.id, true)}><I.user /> Virar {TERMO.s}</button>}
      {inicial && <ConfirmButton label="Tirar da lista" confirmLabel="Toque de novo para tirar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// REGISTROS PENDENTES
function RegistrosSheet({ db, onClose, act }) {
  const regs = db.sessions.filter(s => s.status === "done" && s.date >= addDays(todayISO(), -7)).sort((a, b) => b.date.localeCompare(a.date));
  const pac = id => db.patients.find(p => p.id === id) || { name: "Removido" };
  return (
    <Sheet title="Registros das sessões" sub="Últimos 7 dias. Eu guardo só o “feito”, nunca o conteúdo." onClose={onClose}>
      <div className="panel">
        {regs.length === 0 && <div className="empty">Nenhuma sessão nos últimos 7 dias.</div>}
        {regs.map(s => (
          <button className="txn" key={s.id} onClick={() => act.toggleRegistro(s.id)}>
            <span className="txn-av">{iniciais(pac(s.patientId).name)}</span>
            <span className="mid"><span className="nm">{pac(s.patientId).name}</span><span className="sb">{relativo(s.date)} · {s.time}</span></span>
            <span className={"box " + (s.registro ? "done" : "up")}>{s.registro && <I.check />}</span>
          </button>
        ))}
      </div>
      <button className="btn" onClick={onClose}>Pronto</button>
    </Sheet>
  );
}

// Exportar o mês para o contador (planilha .csv)
async function exportarMes(db, chave, act) {
  const pac = id => (db.patients.find(p => p.id === id) || { name: "Removido" }).name;
  const linhas = [["Data", "Nome", "Situação", "Valor", "Sublocação", "Líquido", "Pago em"]];
  db.sessions.filter(s => s.date.startsWith(chave) && (s.status === "done" || s.cobrada)).sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
    const c = s.chargeId && db.charges.find(x => x.id === s.chargeId && !x.hidden);
    linhas.push([dm(s.date) + "/" + chave.slice(0, 4), pac(s.patientId), s.status === "done" ? "Atendido" : "Falta cobrada", fmtNum(s.price), fmtNum(s.sublet), fmtNum(s.price - s.sublet), c && c.paid ? dm(c.paidAt) : "em aberto"]);
  });
  const csv = "﻿" + linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const nome = `consultorio-${chave}.csv`;
  try {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    act.toast("Planilha baixada");
  } catch (e) { copiarTexto(csv, act, "Não deu para baixar: copiei a planilha. Cole no Excel ou no Sheets."); }
}

// Instalar na tela inicial: Android/PC usam o pedido do navegador; iPhone precisa do menu Compartilhar
let pedidoInstalar = null;
// Aviso discreto no topo quando o app está aberto no navegador e não instalado
function DicaInstalar() {
  const [fechada, setFechada] = useState(() => lerJSON("agenda-dica-instalar", false) || appInstalado());
  const [pode, setPode] = useState(!!pedidoInstalar);
  useEffect(() => { const f = () => setPode(true); window.addEventListener("pode-instalar", f); return () => window.removeEventListener("pode-instalar", f); }, []);
  if (fechada || (!ehIOS() && !pode)) return null;
  const fechar = () => { gravar("agenda-dica-instalar", true); setFechada(true); };
  return (
    <div className="dica-instalar">
      <img src={`${BASE}icons/icon-192.png`} alt="" />
      <div>
        <b>Instale o app</b>
        {ehIOS() ? <span>Toque em <I.share /> Compartilhar e depois em <b>Adicionar à Tela de Início</b>. Abre em tela cheia, com avisos.</span>
          : <span>Fica na tela inicial, abre em tela cheia e funciona sem internet.</span>}
        {!ehIOS() && <button className="pill-btn forte" onClick={async () => { pedidoInstalar.prompt(); await pedidoInstalar.userChoice; pedidoInstalar = null; fechar(); }}>Instalar</button>}
      </div>
      <button className="icon-btn" onClick={fechar} aria-label="Agora não"><I.x /></button>
    </div>
  );
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pedidoInstalar = e; window.dispatchEvent(new Event("pode-instalar")); });
}
function InstalarApp() {
  const [pode, setPode] = useState(!!pedidoInstalar);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => { const f = () => setPode(true); window.addEventListener("pode-instalar", f); return () => window.removeEventListener("pode-instalar", f); }, []);
  if (instalado) return <div className="note mint"><I.check /><span>O app já está instalado neste aparelho.</span></div>;
  if (pode) return <button className="btn ghost" onClick={async () => { pedidoInstalar.prompt(); await pedidoInstalar.userChoice; pedidoInstalar = null; setPode(false); }}><I.down /> Instalar na tela inicial</button>;
  if (ios) return <div className="note"><I.share /><span>Para instalar no iPhone: abra no Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Assim os avisos funcionam.</span></div>;
  return null;
}

// Fundos do usuário ficam no IndexedDB do aparelho (cabe muito mais que o localStorage)
const LIMITE_FUNDOS = 10;
const IDB = (() => {
  let conexao = null;
  const abrir = () => conexao || (conexao = new Promise((res, rej) => {
    const r = indexedDB.open("agenda-imagens", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("fundos", { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (modo, fn) => {
    const db = await abrir();
    return new Promise((res, rej) => { const t = db.transaction("fundos", modo); const req = fn(t.objectStore("fundos")); t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); });
  };
  return {
    listar: async dono => ((await tx("readonly", st => st.getAll())) || []).filter(f => f.dono === dono).sort((a, b) => a.criado - b.criado),
    salvar: item => tx("readwrite", st => st.put(item)),
    apagar: id => tx("readwrite", st => st.delete(id)),
  };
})();

// Escolher o fundo do app: 3 prontos + até 10 fotos suas, com recorte
function FundoPicker({ fundo, meus, onChange, onAdd, onUpdate, onDelete }) {
  const [erro, setErro] = useState("");
  const [recortar, setRecortar] = useState(null); // { src, alvo: "novo" | id do fundo }
  const [apagando, setApagando] = useState(null);
  const atual = fundo && fundo.id;
  const sel = id => atual === id || (!atual && !id);
  const carregar = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErro("Escolha um arquivo de imagem.");
    try { setRecortar({ src: await lerArquivo(f), alvo: "novo" }); setErro(""); } catch (x) { setErro("Não consegui abrir essa imagem."); }
  };
  const escolher = id => onChange(id ? { ...(fundo || {}), id } : null);
  const atualSrc = atual ? (atual.startsWith("u:") ? (meus.find(m => "u:" + m.id === atual) || {}).img : (FUNDOS.find(f => f.id === atual) || {}).img) : null;
  return (
    <>
      <div className="fundos" role="radiogroup" aria-label="Fundo do app">
        <button type="button" role="radio" aria-checked={sel(null)} className={"fundo" + (sel(null) ? " on" : "")} onClick={() => escolher(null)}><span className="fundo-img"><I.x /></span>Sem fundo</button>
        {FUNDOS.map(o => (
          <button type="button" key={o.id} role="radio" aria-checked={sel(o.id)} className={"fundo" + (sel(o.id) ? " on" : "")} onClick={() => escolher(o.id)}>
            <span className="fundo-img" style={{ backgroundImage: `url(${o.thumb})` }} />{o.nome}
          </button>
        ))}
        {meus.map((m, i) => (
          <div key={m.id} className={"fundo" + (sel("u:" + m.id) ? " on" : "")}>
            <button type="button" role="radio" aria-checked={sel("u:" + m.id)} className="fundo-img" style={{ backgroundImage: `url(${m.img})` }} onClick={() => escolher("u:" + m.id)} aria-label={`Sua foto ${i + 1}`} />
            <button type="button" className={"fundo-del" + (apagando === m.id ? " armado" : "")} aria-label={apagando === m.id ? "Toque de novo para excluir" : "Excluir este fundo"}
              onClick={() => { if (apagando === m.id) { onDelete(m.id); setApagando(null); } else { vibrar("aviso"); setApagando(m.id); setTimeout(() => setApagando(a => a === m.id ? null : a), 3500); } }}>
              {apagando === m.id ? "Excluir?" : <I.x />}
            </button>
            Sua foto {i + 1}
          </div>
        ))}
        {meus.length < LIMITE_FUNDOS && (
          <label className="fundo" htmlFor="fundo-in"><span className="fundo-img add"><I.plus /></span>Adicionar</label>
        )}
        <input id="fundo-in" className="sr" type="file" accept="image/*" onChange={carregar} />
      </div>
      <div className="hint">{meus.length}/{LIMITE_FUNDOS} fotos suas{meus.length >= LIMITE_FUNDOS ? ": exclua uma para adicionar outra" : ""}.</div>
      {erro && <div className="error">{erro}</div>}
      {fundo && atualSrc && <button className="btn ghost" onClick={() => setRecortar({ src: atualSrc, alvo: atual.startsWith("u:") ? atual.slice(2) : "novo" })}><I.pencil /> Ajustar enquadramento deste fundo</button>}
      {fundo && <Field label="Escurecer o fundo (deixa o texto mais fácil de ler)"><Seg value={fundo.veu || "medio"} onChange={v => onChange({ ...fundo, veu: v })} options={[{ v: "leve", l: "Leve" }, { v: "medio", l: "Médio" }, { v: "forte", l: "Forte" }]} /></Field>}
      {recortar && <Cropper src={recortar.src} forma="tela" titulo="Ajustar fundo"
        onCancel={() => setRecortar(null)}
        onDone={async url => {
          const alvo = recortar.alvo; setRecortar(null);
          try {
            if (alvo === "novo") { if (meus.length >= LIMITE_FUNDOS) return setErro("Você chegou ao limite de 10 fotos. Exclua uma para adicionar outra."); await onAdd(url); }
            else await onUpdate(alvo, url);
          } catch (x) { setErro("Não consegui guardar essa imagem neste aparelho."); }
        }} />}
    </>
  );
}

/* =========================================================
   14. TEMA
   ========================================================= */
function useTema() {
  const [modo, setModo] = useState(() => { try { return localStorage.getItem(K.tema) || TEMA_PADRAO; } catch (e) { return TEMA_PADRAO; } });
  const [, force] = useState(0);
  useEffect(() => {
    const root = document.documentElement;
    if (modo === "auto") root.removeAttribute("data-app-theme"); else root.setAttribute("data-app-theme", modo);
    try { localStorage.setItem(K.tema, modo); } catch (e) {}
  }, [modo]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const f = () => force(x => x + 1);
    mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f);
    const mo = new MutationObserver(f); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener ? mq.removeEventListener("change", f) : mq.removeListener(f); mo.disconnect(); };
  }, []);
  const host = document.documentElement.getAttribute("data-theme");
  const escuro = modo === "dark" || (modo === "auto" && host !== "light" && (host === "dark" || !window.matchMedia("(prefers-color-scheme: light)").matches));
  return { modo, setModo, escuro };
}

/* =========================================================
   15. APP (depois do login)
   ========================================================= */
I.minus = () => <Svg sw={2.2}><path d="M5 12h14"/></Svg>;

function carregarDb(conta) {
  const salvo = lerJSON(K.db(conta.email), null);
  if (!salvo) return conta.demo ? exemplo() : vazio();
  if (!salvo.pessoal) salvo.pessoal = conta.demo ? exemploPessoal() : pessoalVazio();
  salvo.espera = salvo.espera || []; salvo.fechados = salvo.fechados || {}; salvo.confirmados = salvo.confirmados || {}; salvo.revisoes = salvo.revisoes || {};
  return salvo;
}

function Painel({ conta, novo, pronto, tema, onSair, onAtualizar }) {
  const perfil = conta.perfil || PERFIL_DEMO;
  DURACAO_SESSAO = perfil.duracao || 50;
  TERMO = termoDe(perfil.termo || "Paciente");
  ESTILO = perfil.estilo || "detalhado";
  PERFIL = perfil;
  const usaPessoal = perfil.pessoal !== false;
  const av = { ...AVISOS_PADRAO, ...(perfil.avisos || {}) };
  const [db, setDb] = useState(() => carregarDb(conta));
  const [modo, setModoSt] = useState(() => lerJSON(K.modo(conta.email), "consultorio"));
  const [tab, setTab] = useState(() => lerJSON(K.modo(conta.email), "consultorio") === "pessoal" ? "p-home" : "home");
  const [sheet, setSheet] = useState(null);
  const [foco, setFoco] = useState(false);
  const [pacVista, setPacVista] = useState("ativos");
  const [toast, setToast] = useState(null);
  const [oculto, setOculto] = useState(() => lerJSON(K.oculto, false));
  const [now, setNow] = useState(new Date());
  const [clima, setClima] = useState(null);
  const [, setFerVer] = useState(0);
  const [meusFundos, setMeusFundos] = useState([]);
  const [push, setPush] = useState(() => pushLigado());
  const [vozAtiva, setVozAtiva] = useState(false);
  // Barra de cima que aparece quando a página rola
  const [rolou, setRolou] = useState(false);
  // Barra de baixo some enquanto a tela rola (ou o dedo arrasta) e volta quando a tela para
  const [navMini, setNavMini] = useState(false);
  useEffect(() => {
    let t = null, mini = false, y0 = window.scrollY;
    const encolher = () => {
      if (!mini) { mini = true; setNavMini(true); }
      clearTimeout(t); t = setTimeout(() => { mini = false; setNavMini(false); }, 260);
    };
    const f = () => { setRolou(window.scrollY > 72); if (Math.abs(window.scrollY - y0) > 2) encolher(); y0 = window.scrollY; };
    const arrasto = e => { if (e.target.closest && e.target.closest(".nav")) encolher(); };
    f(); window.addEventListener("scroll", f, { passive: true });
    window.addEventListener("touchmove", arrasto, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener("scroll", f); window.removeEventListener("touchmove", arrasto); };
  }, []);
  const vozApi = useRef({});
  CLIMA = clima;
  const tRef = useRef(null);
  useEffect(() => {
    const cidade = perfil.cidade; if (!cidade) { setClima(null); return; }
    let vivo = true;
    buscarClima(cidade).then(c => vivo && setClima(c)).catch(() => vivo && setClima(climaExemplo(cidade)));
    return () => { vivo = false; };
  }, [perfil.cidade]);
  useEffect(() => { const y = new Date().getFullYear(); Promise.all([buscarFeriadosAPI(y), buscarFeriadosAPI(y + 1)]).then(() => setFerVer(v => v + 1)).catch(() => {}); }, []);
  ESCONDER = oculto;
  useEffect(() => gravar(K.db(conta.email), db), [db]);
  useEffect(() => gravar(K.oculto, oculto), [oculto]);
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { if (pronto) notify(`Tudo pronto, ${conta.nome}! Vamos começar.`); else if (novo) notify(`Boas-vindas, ${conta.nome}!`); }, []);
  // Atalhos por link: ...#gasto abre o gasto por voz, #agora o "Só o agora", #fechar o "Fechar o dia", #livres os horários livres
  useEffect(() => {
    const h = (location.hash || "").slice(1);
    if (h === "gasto" && usaPessoal) { act.setModo("pessoal"); setTimeout(() => vozApi.current.comecar && vozApi.current.comecar(), 400); }
    else if (h === "agora") setFoco(true);
    else if (h === "fechar") setSheet({ type: "fechar" });
    else if (h === "livres") setSheet({ type: "livres" });
  }, []);

  // Avisos saem só como notificação do celular (o som e a vibração são os do próprio aparelho)
  const avisar = (titulo, corpo) => notificarSistema(titulo, corpo, false);
  VIBRAR = perfil.vibrar !== false;
  // Vibração leve em qualquer botão
  useEffect(() => {
    const f = e => { if (e.target === HAPTICO || (e.target && e.target.id === "haptico-sw")) return; if (e.target.closest && e.target.closest("button, a.btn, label.fundo, label[for]")) vibrar("toque"); };
    document.addEventListener("click", f, true);
    return () => document.removeEventListener("click", f, true);
  }, []);
  // Fotos de fundo do usuário (guardadas no aparelho)
  useEffect(() => {
    let vivo = true;
    IDB.listar(conta.email).then(async lista => {
      // fundo antigo guardado dentro da conta: passa para o IndexedDB
      if (conta.fundo && conta.fundo.id === "meu" && conta.fundo.img) {
        const item = { id: uid(), dono: conta.email, img: conta.fundo.img, criado: Date.now() };
        await IDB.salvar(item); lista = [...lista, item]; onAtualizar({ fundo: { veu: conta.fundo.veu, id: "u:" + item.id } });
      }
      if (vivo) setMeusFundos(lista);
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  // Número no ícone do app: sessões sem marcar + contas vencendo hoje ou atrasadas
  const pendIcone = db.patients.filter(p => p.active && p.nextDate && p.nextDate < todayISO()).length
    + (usaPessoal ? db.pessoal.contas.filter(c => { const st = situacaoConta(c, todayISO().slice(0, 7)).st; return st === "hoje" || st === "atrasada"; }).length : 0);
  useEffect(() => {
    try {
      if (!("setAppBadge" in navigator)) return;
      if (pendIcone > 0) navigator.setAppBadge(pendIcone).catch(() => {}); else navigator.clearAppBadge().catch(() => {});
    } catch (e) {}
  }, [pendIcone]);
  // Pede ao navegador para não apagar os dados do app quando faltar espaço
  useEffect(() => { try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) {} }, []);

  // Puxar para recarregar: arrastar a tela para baixo no topo atualiza clima, feriados, avisos e o próprio app
  const [puxar, setPuxar] = useState(0);
  const [recarregando, setRecarregando] = useState(false);
  const puxRef = useRef(null), puxVal = useRef(0), recRef = useRef(false), vozRef = useRef("");
  vozRef.current = vozAtiva;
  const recarregar = async () => {
    recRef.current = true; setRecarregando(true); vibrar("ok");
    const espera = new Promise(r => setTimeout(r, 900));
    const cidade = perfil.cidade, y = new Date().getFullYear();
    await Promise.all([
      espera,
      cidade ? buscarClima(cidade).then(c => setClima(c)).catch(() => {}) : null,
      Promise.all([buscarFeriadosAPI(y), buscarFeriadosAPI(y + 1)]).then(() => setFerVer(v => v + 1)).catch(() => {}),
      "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}) : null,
      Promise.resolve(sincRef.current && sincRef.current(false, true)).catch(() => {}),
    ]);
    setNow(new Date()); setRecarregando(false); recRef.current = false;
  };
  const recarregarRef = useRef(recarregar); recarregarRef.current = recarregar;
  useEffect(() => {
    const ini = e => {
      puxRef.current = null;
      if (window.scrollY > 2 || recRef.current || vozRef.current || document.body.style.overflow === "hidden" || e.touches.length > 1) return;
      puxRef.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, avisou: false };
    };
    const mov = e => {
      const p = puxRef.current; if (!p) return;
      const dy = e.touches[0].clientY - p.y, dx = Math.abs(e.touches[0].clientX - p.x);
      if (dy < -6 || dx > Math.max(14, dy)) { puxRef.current = null; puxVal.current = 0; setPuxar(0); return; }
      const v = Math.max(0, Math.min(120, dy * .5));
      if (v >= 70 && !p.avisou) { p.avisou = true; vibrar("toque"); }
      if (v < 70) p.avisou = false;
      puxVal.current = v; setPuxar(v);
    };
    const fim = () => { if (!puxRef.current) return; puxRef.current = null; const v = puxVal.current; puxVal.current = 0; setPuxar(0); if (v >= 70) recarregarRef.current(); };
    window.addEventListener("touchstart", ini, { passive: true });
    window.addEventListener("touchmove", mov, { passive: true });
    window.addEventListener("touchend", fim); window.addEventListener("touchcancel", fim);
    return () => { window.removeEventListener("touchstart", ini); window.removeEventListener("touchmove", mov); window.removeEventListener("touchend", fim); window.removeEventListener("touchcancel", fim); };
  }, []);

  // Avisos com o app fechado: manda a lista dos próximos dias para o servidor sempre que algo muda
  const sincronizar = async (manter, forcar) => {
    if (!pushLigado()) return "desligado";
    const avisos = av.ativo ? gerarAvisos(db, av, usaPessoal) : [];
    const h = hash(JSON.stringify(avisos)), st = lerJSON(K_PUSH, {});
    if (!forcar && st.hash === h && st.email === conta.email && Date.now() - (st.quando || 0) < 6 * 36e5) return "ok";
    try {
      const { id, sub } = await inscreverPush(false);
      await chamarServidor("/agendar", { id, sub, avisos }, manter);
      gravar(K_PUSH, { ...lerJSON(K_PUSH, {}), hash: h, email: conta.email, quando: Date.now(), total: avisos.length, erro: "" });
      return "ok";
    } catch (e) { gravar(K_PUSH, { ...lerJSON(K_PUSH, {}), erro: e.message }); return e.message; }
  };
  const sincRef = useRef(sincronizar);
  sincRef.current = sincronizar;
  useEffect(() => {
    if (!push) return;
    const t = setTimeout(() => sincRef.current(false), 2500);
    return () => clearTimeout(t);
  }, [db, push, av.ativo, av.antecedencia, av.nomes, av.resumo, av.fechar, usaPessoal, Math.floor(now.getTime() / 9e5)]);
  // Ao sair da tela: manda o que mudou na hora
  useEffect(() => {
    const f = () => sincRef.current(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  // Confere a cada 30 s se tem algo para avisar (sessão chegando, conta vencendo, sessão sem marcar).
  // Com os avisos pelo servidor ligados, quem avisa é o servidor (assim não chega aviso repetido).
  useEffect(() => {
    if (!av.ativo || push) return;
    const timer = setTimeout(() => {
      const t = todayISO(), nm = agoraMin(new Date());
      const vistos = lerJSON(K.avisos(conta.email), {});
      Object.keys(vistos).forEach(k => { if (vistos[k] < addDays(t, -3)) delete vistos[k]; });
      let dispara = null;
      itensDoDia(db, t).filter(i => i.kind === "next").forEach(i => {
        const falta = mins(i.time) - nm, k = `s:${i.patient.id}:${t}:${i.time}`;
        if (!dispara && falta > 0 && falta <= av.antecedencia && !vistos[k]) { vistos[k] = t; dispara = [`Sessão com ${primeiro(i.patient.name)} em ${falta} min`, `${i.time} · você recebe ${brlReal(liquido(i.patient))}`, () => act.openItem(i)]; }
      });
      if (!dispara && nm >= 8 * 60 && usaPessoal) db.pessoal.contas.forEach(c => {
        const sc = situacaoConta(c, t.slice(0, 7)), k = `c:${c.id}:${t}`;
        if (!dispara && !vistos[k] && (sc.st === "hoje" || sc.st === "atrasada" || sc.txt === "Vence amanhã")) { vistos[k] = t; dispara = [`${c.nome}: ${sc.txt.toLowerCase()}`, `${brlReal(c.valor)} · toque para ver suas contas`, () => { act.setModo("pessoal"); act.setTab("p-contas"); }]; }
      });
      if (!dispara && nm >= 19 * 60 && !(db.fechados || {})[t] && itensDoDia(db, t).length && !vistos[`f:${t}`]) { vistos[`f:${t}`] = t; dispara = ["Vamos fechar o dia?", "Leva uns 2 minutos e você desliga tranquilo.", () => setSheet({ type: "fechar" })]; }
      if (!dispara && nm >= 8 * 60) db.patients.filter(p => p.active && p.nextDate < t).forEach(p => {
        const k = `p:${p.id}:${p.nextDate}`;
        if (!dispara && !vistos[k]) { vistos[k] = t; dispara = [`Faltou marcar a sessão de ${primeiro(p.name)}`, `${diaCurto(p.nextDate)} às ${p.time}. Veio ou faltou?`, () => act.setTab("home")]; }
      });
      gravar(K.avisos(conta.email), vistos);
      if (dispara) avisar(...dispara);
    }, 2500);
    return () => clearTimeout(timer);
  }, [now, av.ativo, av.antecedencia, push]);

  const notify = (msg, undo) => { setToast({ msg, undo }); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(null), undo ? 6000 : 2800); };
  const close = () => setSheet(null);
  const setP = fn => setDb(d => ({ ...d, pessoal: fn(d.pessoal) }));
  const chaveAtual = () => todayISO().slice(0, 7);

  // manter = true: não fecha o painel aberto (usado no "Fechar o dia" e no "Só o agora")
  const registrarE = (pid, opts, manter) => {
    const r = registrar(db, pid, opts);
    setDb(r.db);
    vibrar(opts.status === "done" ? "ok" : "aviso");
    if (!manter && r.nova && !r.nova.paid && r.nova.sessionIds.length > 1) { setSheet({ type: "charge", cid: r.nova.id, fresh: true }); return; }
    if (!manter) close();
    const extra = opts.status === "done" && r.nova && !r.nova.paid ? " · cobrança aberta" : "";
    notify(`${opts.status === "done" ? "Pronto, marcado" : "Falta registrada"}${extra} · próxima ${dm(opts.nextDate)}`, () => setDb(d => desfazer(d, r.sid)));
  };

  const act = {
    toast: m => notify(m),
    setTab: t => comTransicao(() => { setTab(t); rolarTopo(); }),
    setModo: m => comTransicao(() => { setModoSt(m); gravar(K.modo(conta.email), m); setTab(m === "pessoal" ? "p-home" : "home"); rolarTopo(); }),
    toggleOculto: () => setOculto(o => !o),
    testarAviso: async (atraso = 0) => {
      // pede a permissão na hora do toque (o navegador só deixa pedir assim)
      try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch (e) {}
      await new Promise(r => setTimeout(r, atraso));
      const prox = itensDoDia(db, todayISO()).find(i => i.kind === "next" && mins(i.time) > agoraMin(new Date()));
      return notificarSistema(prox ? `Sessão com ${primeiro(prox.patient.name)} em ${av.antecedencia} min` : "Teste de aviso", prox ? `${prox.time} · este é um aviso de teste` : "Se você está vendo isto, os avisos estão funcionando.", false);
    },
    // Avisos com o app fechado
    pushLigado: () => push,
    ligarPush: async () => {
      try {
        await inscreverPush(true);
        gravar(K_PUSH, { ...lerJSON(K_PUSH, {}), ligado: true, hash: "" });
        setPush(true);
        const r = await sincronizar(false, true);
        if (r !== "ok") throw new Error(r);
        vibrar("ok");
        return "ok";
      } catch (e) { return e.message; }
    },
    desligarPush: async () => {
      const st = lerJSON(K_PUSH, {});
      gravar(K_PUSH, { ...st, ligado: false, hash: "" });
      setPush(false);
      try { if (st.id) await chamarServidor("/cancelar", { id: st.id }); } catch (e) {}
    },
    testarPush: async atraso => {
      try {
        const { id, sub } = await inscreverPush(true);
        const tem = av.ativo && gerarAvisos(db, av, usaPessoal).length > 0;
        await chamarServidor("/teste", { id, sub, atraso,
          titulo: atraso ? "Teste com o app fechado" : "Teste de aviso",
          corpo: atraso ? "Chegou! Os avisos funcionam mesmo com o app fechado." : tem ? "Funcionando. Os próximos avisos já estão guardados." : "Funcionando. Os avisos vão chegar por aqui." });
        return "ok";
      } catch (e) { return e.message; }
    },
    setServidor: url => { gravar(K_PUSH_URL, url.trim()); },
    falarGasto: () => { if (sheet) close(); vozApi.current.comecar && vozApi.current.comecar(); },
    comandoVoz: c => {
      const p = db.patients.find(x => x.id === c.p.id); if (!p) return;
      const hoje = todayISO(), nome = primeiro(p.name);
      if (c.acao === "veio" || c.acao === "falta") {
        if (p.nextDate > hoje) { vibrar("aviso"); notify(`A próxima sessão de ${nome} é só ${diaCurto(p.nextDate)}`); return; }
        registrarE(p.id, { status: c.acao === "veio" ? "done" : "missed", nextDate: addDays(p.nextDate, p.freq), paidNow: c.acao === "veio" && !!c.pago });
        return;
      }
      if (c.acao === "pagou") {
        const ch = db.charges.filter(x => x.patientId === p.id && !x.paid).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (!ch) { vibrar("aviso"); notify(`${nome} não tem cobrança em aberto`); return; }
        act.setPago(ch.id, true); notify(`${nome} pagou ${brlReal(ch.amount)}`, () => act.setPago(ch.id, false));
        return;
      }
      if (c.acao === "remarcar") {
        const antes = { nextDate: p.nextDate, time: p.time };
        setDb(d => ({ ...d, patients: d.patients.map(x => x.id === p.id ? { ...x, nextDate: c.data, time: c.hora } : x) }));
        vibrar("ok"); notify(`${nome}: ${diaCurto(c.data)} às ${c.hora}`, () => setDb(d => ({ ...d, patients: d.patients.map(x => x.id === p.id ? { ...x, ...antes } : x) })));
      }
    },
    salvarVoz: itens => {
      const novos = itens.map(it => ({ id: uid(), tipo: it.tipo, valor: it.valor, cat: it.cat, desc: it.desc || "", marca: it.marca || null, data: addDays(todayISO(), -(it.off || 0)) }));
      const ids = new Set(novos.map(n => n.id));
      setP(P => ({ ...P, lanc: [...P.lanc, ...novos] }));
      close(); vibrar("ok");
      const n = novos[0];
      notify(novos.length > 1 ? `${novos.length} anotações · ${brlReal(soma(novos, x => x.valor))}` : `Anotado: ${brlReal(n.valor)} em ${n.desc || catDe(n.cat).nome}`, () => setP(P => ({ ...P, lanc: P.lanc.filter(x => !ids.has(x.id)) })));
    },
    openItem: item => setSheet({ type: "session", item }),
    registrar: registrarE,
    rapido: (pid, status, manter) => { const p = db.patients.find(x => x.id === pid); registrarE(pid, { status, nextDate: addDays(p.nextDate, p.freq), paidNow: false }, manter); },
    // Rotinas e ferramentas
    fecharDia: () => setSheet({ type: "fechar" }),
    agora: () => setFoco(true),
    revisao: () => setSheet({ type: "revisao" }),
    confirmar: iso => setSheet({ type: "confirmar", iso }),
    livres: () => setSheet({ type: "livres" }),
    registros: () => setSheet({ type: "registros" }),
    verEspera: () => { setPacVista("espera"); setTab("pac"); rolarTopo(); },
    novaEspera: () => setSheet({ type: "espera" }),
    editEspera: id => setSheet({ type: "espera", id }),
    salvarEspera: e => { setDb(d => ({ ...d, espera: d.espera.some(x => x.id === e.id) ? d.espera.map(x => x.id === e.id ? e : x) : [...d.espera, e] })); close(); notify(`${primeiro(e.nome)} está na lista de espera`); },
    tirarEspera: (id, virar) => { const e = db.espera.find(x => x.id === id); setDb(d => ({ ...d, espera: d.espera.filter(x => x.id !== id) })); if (virar && e) setSheet({ type: "form", pre: { name: e.nome, phone: e.phone } }); else { close(); notify("Tirado da lista de espera"); } },
    marcarFechado: iso => setDb(d => ({ ...d, fechados: { ...(d.fechados || {}), [iso]: true } })),
    marcarRevisao: k => setDb(d => ({ ...d, revisoes: { ...(d.revisoes || {}), [k]: true } })),
    toggleRegistro: sid => setDb(d => ({ ...d, sessions: d.sessions.map(x => x.id === sid ? { ...x, registro: !x.registro } : x) })),
    setConfirmado: (pid, iso, v) => setDb(d => ({ ...d, confirmados: { ...(d.confirmados || {}), [`${pid}:${iso}`]: v } })),
    adiarReajuste: pid => { setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, reajusteAdiado: addDays(todayISO(), 180) } : p) })); notify("Combinado: lembro de novo em 6 meses"); },
    exportar: chave => exportarMes(db, chave, act),
    setFundo: f => onAtualizar({ fundo: f }),
    addFundo: async img => { const item = { id: uid(), dono: conta.email, img, criado: Date.now() }; await IDB.salvar(item); setMeusFundos(l => [...l, item]); onAtualizar({ fundo: { veu: (conta.fundo && conta.fundo.veu) || "medio", id: "u:" + item.id } }); notify("Fundo adicionado"); },
    updFundo: async (id, img) => { const velho = meusFundos.find(m => m.id === id); const item = { ...velho, img }; await IDB.salvar(item); setMeusFundos(l => l.map(m => m.id === id ? item : m)); notify("Fundo ajustado"); },
    delFundo: async id => { await IDB.apagar(id).catch(() => {}); setMeusFundos(l => l.filter(m => m.id !== id)); if (conta.fundo && conta.fundo.id === "u:" + id) onAtualizar({ fundo: null }); notify("Fundo excluído"); },
    meusFundos,
    remarcar: (pid, data, hora) => { setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, nextDate: data, time: hora } : p) })); close(); notify(`Remarcado para ${dm(data)} às ${hora}`); },
    desfazer: sid => { setDb(d => desfazer(d, sid)); close(); notify("Registro desfeito"); },
    setPago: (cid, pago) => (pago && vibrar("ok"), setDb(d => ({ ...d, charges: d.charges.map(c => c.id === cid ? { ...c, paid: pago, paidAt: pago ? todayISO() : null } : c) }))),
    openCharge: cid => setSheet({ type: "charge", cid }),
    openPatient: pid => setSheet({ type: "patient", pid }),
    editPatient: pid => setSheet({ type: "form", pid }),
    novoPaciente: () => setSheet({ type: "form" }),
    openSettings: aba => setSheet({ type: "settings", aba: typeof aba === "string" ? aba : null }),
    salvarPerfil: (patch, pix) => {
      setDb(d => d.settings.pix === pix ? d : { ...d, settings: { ...d.settings, pix } });
      onAtualizar(patch);
      if (patch.perfil && patch.perfil.pessoal === false && modo === "pessoal") { setModoSt("consultorio"); gravar(K.modo(conta.email), "consultorio"); setTab("home"); }
    },
    modo: usaPessoal ? modo : "consultorio",
    salvarPaciente: p => {
      setDb(d => ({ ...d, patients: d.patients.some(x => x.id === p.id) ? d.patients.map(x => x.id === p.id ? p : x) : [...d.patients, p] }));
      vibrar("ok"); close(); notify(`${primeiro(p.name)} salvo · próxima ${dm(p.nextDate)} às ${p.time}`);
    },
    excluir: pid => { setDb(d => ({ ...d, patients: d.patients.filter(p => p.id !== pid) })); close(); notify("Paciente excluído"); },
    // Pessoal
    novoLanc: tipo => setSheet({ type: "lanc", tipo }),
    editLanc: id => setSheet({ type: "lanc", id }),
    salvarLanc: l0 => {
      const mm = acharMarca(l0.desc || ""); const l = { ...l0, marca: mm ? mm.id : null };
      const novoL = !db.pessoal.lanc.some(x => x.id === l.id);
      setP(P => ({ ...P, lanc: novoL ? [...P.lanc, l] : P.lanc.map(x => x.id === l.id ? l : x) }));
      vibrar("ok"); close();
      notify(novoL ? `${l.tipo === "entrada" ? "Entrada" : "Gasto"} de ${brlReal(l.valor)} anotado` : "Lançamento atualizado", novoL ? () => setP(P => ({ ...P, lanc: P.lanc.filter(x => x.id !== l.id) })) : undefined);
    },
    apagarLanc: id => { setP(P => ({ ...P, lanc: P.lanc.filter(x => x.id !== id) })); close(); notify("Lançamento apagado"); },
    novaConta: () => setSheet({ type: "conta" }),
    editConta: id => setSheet({ type: "conta", id }),
    salvarConta: c => { setP(P => ({ ...P, contas: P.contas.some(x => x.id === c.id) ? P.contas.map(x => x.id === c.id ? c : x) : [...P.contas, c] })); close(); notify(`${c.nome} salva · vence todo dia ${c.dia}`); },
    apagarConta: id => { setP(P => ({ ...P, contas: P.contas.filter(x => x.id !== id) })); close(); notify("Conta apagada"); },
    pagarConta: id => {
      const ch = chaveAtual(), c = db.pessoal.contas.find(x => x.id === id); vibrar("ok");
      setP(P => ({ ...P, contas: P.contas.map(x => x.id === id ? { ...x, pagas: { ...(x.pagas || {}), [ch]: todayISO() } } : x) }));
      notify(`${c ? c.nome : "Conta"} marcada como paga`, () => setP(P => ({ ...P, contas: P.contas.map(x => { if (x.id !== id) return x; const pg = { ...(x.pagas || {}) }; delete pg[ch]; return { ...x, pagas: pg }; }) })));
    },
    despagarConta: id => { const ch = chaveAtual(); setP(P => ({ ...P, contas: P.contas.map(x => { if (x.id !== id) return x; const pg = { ...(x.pagas || {}) }; delete pg[ch]; return { ...x, pagas: pg }; }) })); notify("Voltou para a pagar"); },
    toggleIncluir: () => setP(P => ({ ...P, incluirConsultorio: !P.incluirConsultorio })),
    // Conta
    salvarAjustes: (patch, pix) => { setDb(d => ({ ...d, settings: { ...d.settings, pix } })); onAtualizar(patch); if (patch.perfil && patch.perfil.pessoal === false && modo === "pessoal") act.setModo("consultorio"); close(); notify("Tudo salvo"); },
    refazer: () => { close(); onAtualizar({ perfil: { ...perfil, refazer: true } }); },
    zerar: () => { setDb(vazio()); close(); notify("Dados apagados"); },
    carregarExemplo: () => { setDb(exemplo()); close(); notify("Exemplos carregados"); },
    sair: () => {
      // a conta saiu deste aparelho: para de mandar os avisos dela
      const st = lerJSON(K_PUSH, {});
      if (st.ligado && st.id) { chamarServidor("/cancelar", { id: st.id }, true).catch(() => {}); gravar(K_PUSH, { ...st, hash: "" }); }
      onSair();
    },
    trocarTema: () => tema.setModo(tema.escuro ? "light" : "dark"),
  };

  const t = todayISO(), ch = t.slice(0, 7);
  const atrasados = db.patients.filter(p => p.active && p.nextDate && p.nextDate < t).length;
  const pendentes = db.charges.filter(c => !c.paid).length;
  const contasUrg = db.pessoal.contas.filter(c => { const s = situacaoConta(c, ch).st; return s === "atrasada" || s === "hoje"; }).length;
  const modoEf = usaPessoal ? modo : "consultorio";
  const tabEf = !usaPessoal && tab.startsWith("p-") ? "home" : tab;
  const abas = modoEf === "pessoal"
    ? [{ id: "p-home", l: "Início", ic: <I.home />, n: 0 }, { id: "p-gastos", l: "Gastos", ic: <I.chart />, n: 0 }, { id: "p-contas", l: "Contas", ic: <I.bill />, n: contasUrg }]
    : [{ id: "home", l: "Início", ic: <I.home />, n: atrasados }, { id: "agenda", l: "Agenda", ic: <I.cal />, n: 0 }, { id: "pac", l: TERMO.P, ic: <I.users />, n: 0 }, { id: "fin", l: "Finanças", ic: <I.wallet />, n: pendentes }];
  const lancSel = sheet && sheet.type === "lanc" && sheet.id ? db.pessoal.lanc.find(l => l.id === sheet.id) : null;
  const contaSel = sheet && sheet.type === "conta" && sheet.id ? db.pessoal.contas.find(c => c.id === sheet.id) : null;

  return (
    <div className={"shell" + (conta.fundo && imagemFundo(conta.fundo, meusFundos) ? " glass" : "")} data-mode={modoEf}>
      {conta.fundo && imagemFundo(conta.fundo, meusFundos) && <div className="bgimg" aria-hidden="true" style={{ backgroundImage: `url(${imagemFundo(conta.fundo, meusFundos)})`, "--veil-o": { leve: .45, medio: .75, forte: 1 }[conta.fundo.veu || "medio"] }} />}
      <aside className="side" aria-label="Menu">
        <div className="side-brand"><i><I.logo /></i>Agenda</div>
        {usaPessoal && <ModeSwitch modo={modo} setModo={act.setModo} block />}
        <nav className="side-nav">
          {abas.map(a => (
            <button key={a.id} className={"si" + (tabEf === a.id ? " on" : "")} onClick={() => act.setTab(a.id)} aria-current={tabEf === a.id ? "page" : undefined}>
              {a.ic}{a.l}{a.n > 0 && <span className="badge">{a.n}</span>}
            </button>
          ))}
        </nav>
        <div className="side-sec">Atalhos</div>
        <div className="side-nav">
          {modoEf === "pessoal" ? <>
            <button className="si" onClick={act.falarGasto}><I.mic />Anotar falando</button>
            <button className="si" onClick={() => act.novoLanc("saida")}><I.minus />Anotar gasto</button>
            <button className="si" onClick={() => act.novoLanc("entrada")}><I.plus />Anotar entrada</button>
            <button className="si" onClick={() => act.novaConta()}><I.bill />Nova conta fixa</button>
          </> : <>
            <button className="si" onClick={act.agora}><I.target />Só o agora</button>
            <button className="si" onClick={act.fecharDia}><I.moon />Fechar o dia</button>
            <button className="si" onClick={act.novoPaciente}><I.plus />Novo {TERMO.s}</button>
            <button className="si" onClick={act.livres}><I.share />Horários livres</button>
            <button className="si" onClick={() => act.setTab("fin")}><I.send />Cobranças</button>
          </>}
        </div>
        <div className="side-foot">
          <Avatar conta={conta} onClick={act.openSettings} label="Sua conta" />
          <div className="who"><b>{conta.nome}</b><span>{conta.email}</span></div>
          <button className="icon-btn" onClick={act.trocarTema} aria-label={tema.escuro ? "Usar modo claro" : "Usar modo escuro"}>{tema.escuro ? <I.sun /> : <I.moon />}</button>
          <button className="icon-btn" onClick={act.openSettings} aria-label="Ajustes"><I.gear /></button>
        </div>
      </aside>

      <div className={"puxar" + (recarregando ? " gira" : puxar >= 70 ? " pronto" : "")} aria-hidden="true"
        style={{ transform: `translate(-50%, ${recarregando ? 46 : puxar * .45 + 2}px) rotate(${puxar * 2}deg)`, opacity: recarregando || puxar > 6 ? 1 : 0, transition: puxar ? "opacity .15s" : undefined }}>
        <svg viewBox="0 0 24 24"><circle className="puxar-trilho" cx="12" cy="12" r="8.5" /><circle className="puxar-arco" cx="12" cy="12" r="8.5" pathLength="100" style={{ strokeDashoffset: recarregando ? 70 : 100 - Math.min(1, puxar / 70) * 92 }} /></svg>
      </div>
      <main className={"app" + (puxar ? " puxando" : "")} style={puxar || recarregando ? { transform: `translateY(${recarregando ? 46 : puxar * .5}px)` } : undefined}>
        <DicaInstalar />
        {tabEf === "home" && <HomeTab db={db} conta={conta} now={now} act={act} tema={tema} />}
        {tabEf === "agenda" && <AgendaTab db={db} now={now} act={act} tema={tema} />}
        {tabEf === "pac" && <PatientsTab db={db} act={act} tema={tema} vista={pacVista} setVista={setPacVista} />}
        {tabEf === "fin" && <FinanceTab db={db} act={act} tema={tema} meta={perfil.meta} />}
        {tabEf === "p-home" && <PessoalHome db={db} conta={conta} now={now} act={act} tema={tema} />}
        {tabEf === "p-gastos" && <GastosTab db={db} act={act} tema={tema} />}
        {tabEf === "p-contas" && <ContasTab db={db} act={act} tema={tema} />}
      </main>

      <div className={"topo-fixo" + (rolou && !sheet ? " on" : "")} aria-hidden={!(rolou && !sheet)} inert={rolou && !sheet ? undefined : ""}>
        <div className="topo-fixo-in">
          <Avatar conta={conta} onClick={act.openSettings} label="Sua conta" />
          <button className="topo-fixo-t" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Voltar ao topo">{tabEf === "home" || tabEf === "p-home" ? primeiro(conta.nome) : (abas.find(a => a.id === tabEf) || {}).l}</button>
          <button className="icon-btn redondo" onClick={act.toggleOculto} aria-label={oculto ? "Mostrar valores" : "Esconder valores"}>{oculto ? <I.eyeOff /> : <I.eye />}</button>
          {usaPessoal
            ? <button className="topo-fixo-pill" onClick={() => act.setModo(modoEf === "pessoal" ? "consultorio" : "pessoal")} aria-label="Trocar de modo">{modoEf === "pessoal" ? "Pessoal" : "Consultório"}<I.repeat /></button>
            : <button className="icon-btn redondo" onClick={act.trocarTema} aria-label="Trocar tema">{tema.escuro ? <I.sun /> : <I.moon />}</button>}
        </div>
      </div>
      <VozBarra api={vozApi} db={db} usaPessoal={usaPessoal} onAtivo={setVozAtiva} onSalvar={act.salvarVoz} onComando={act.comandoVoz} onEditar={it => setSheet({ type: "lanc", tipo: it.tipo, pre: it })} />
      <nav className={"nav" + (navMini && !vozAtiva ? " encolhida" : "")} aria-label="Seções">
        <div className="nav-pill">
          {abas.map(a => (
            <button key={a.id} className={"nv" + (tabEf === a.id ? " on" : "")} onClick={() => act.setTab(a.id)} aria-current={tabEf === a.id ? "page" : undefined} aria-label={a.l}>
              {a.ic}<span className="lb">{a.l}</span>{a.n > 0 && <span className="badge">{a.n}</span>}
            </button>
          ))}
        </div>
        <button className={"nav-mic" + (vozAtiva ? " on" : "")} onClick={() => vozApi.current.tocar && vozApi.current.tocar()} aria-label={vozAtiva === "contando" ? "Salvar" : vozAtiva ? "Terminar" : "Falar"}><Bolinha estado={vozAtiva} /></button>
      </nav>

      {sheet && sheet.type === "session" && <SessionSheet key={sheet.item.patient.id + sheet.item.date + sheet.item.kind} db={db} item={sheet.item} onClose={close} act={act} />}
      {sheet && sheet.type === "patient" && <PatientSheet db={db} pid={sheet.pid} onClose={close} act={act} />}
      {sheet && sheet.type === "form" && <PatientForm total={db.patients.length} perfil={perfil} pre={sheet.pre} initial={sheet.pid ? db.patients.find(p => p.id === sheet.pid) : null} onSave={act.salvarPaciente} onClose={close} />}
      {sheet && sheet.type === "charge" && <ChargeSheet key={sheet.cid} db={db} cid={sheet.cid} fresh={sheet.fresh} nomeProf={conta.nome} onClose={close} act={act} />}
      {sheet && sheet.type === "settings" && <PerfilPage db={db} conta={conta} tema={tema} inicio={sheet.aba} onClose={close} act={act} />}
      {sheet && sheet.type === "fechar" && <FecharDia db={db} conta={conta} onClose={close} act={act} />}
      {sheet && sheet.type === "revisao" && <RevisaoSheet db={db} onClose={close} act={act} />}
      {sheet && sheet.type === "confirmar" && <ConfirmSheet db={db} iso={sheet.iso} onClose={close} act={act} />}
      {sheet && sheet.type === "livres" && <LivresSheet db={db} onClose={close} act={act} />}
      {sheet && sheet.type === "registros" && <RegistrosSheet db={db} onClose={close} act={act} />}
      {sheet && sheet.type === "espera" && <EsperaSheet key={sheet.id || "nova"} inicial={sheet.id ? db.espera.find(e => e.id === sheet.id) : null} onSave={act.salvarEspera} onDelete={act.tirarEspera} onClose={close} />}
      {foco && <Agora db={db} conta={conta} now={now} onClose={() => setFoco(false)} act={act} />}
      {sheet && sheet.type === "lanc" && <LancSheet key={sheet.id || sheet.tipo} inicial={lancSel} pre={sheet.pre} tipo={sheet.tipo || "saida"} onVoz={act.falarGasto} onSave={act.salvarLanc} onDelete={act.apagarLanc} onClose={close} />}
      {sheet && sheet.type === "conta" && <ContaSheet key={sheet.id || "nova"} inicial={contaSel} onSave={act.salvarConta} onDelete={act.apagarConta} onClose={close} />}

      {toast && (
        <div className={"toast" + (toast.undo ? "" : " solo")} role="status">
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Desfazer</button>}
        </div>
      )}
    </div>
  );
}

function App() {
  const tema = useTema();
  const [sessao, setSessao] = useState(() => {
    const email = lerJSON(K.sessao, null);
    if (!email) return null;
    if (email === CONTA_DEMO.email) return { conta: { ...CONTA_DEMO, ...(lerJSON(K.contas, {})[email] || {}) }, novo: false };
    const c = lerJSON(K.contas, {})[email];
    return c ? { conta: c, novo: false } : null;
  });
  const entrar = (conta, novo) => {
    const salvo = lerJSON(K.contas, {})[conta.email];
    gravar(K.sessao, conta.email);
    setSessao({ conta: conta.demo ? { ...CONTA_DEMO, ...(salvo || {}) } : conta, novo });
    window.scrollTo(0, 0);
  };
  const sair = () => { apagar(K.sessao); setSessao(null); };
  // Veio da página de apresentação: #demo entra direto na demonstração; depois limpa o endereço
  useEffect(() => {
    const h = location.hash;
    if (h === "#demo" && !sessao) entrar(CONTA_DEMO, false);
    if (h === "#demo" || h === "#entrar" || h === "#criar") history.replaceState(null, "", location.pathname + location.search);
  }, []);
  // Atualiza nome, foto ou perfil e guarda na lista de contas
  const atualizar = (patch, extra = {}) => {
    const contas = lerJSON(K.contas, {});
    const c = { ...sessao.conta, ...(contas[sessao.conta.email] || {}), ...patch };
    gravar(K.contas, { ...contas, [c.email]: c });
    setSessao(s => ({ ...s, ...extra, conta: { ...s.conta, ...patch } }));
  };
  if (!sessao) return <Auth onLogin={entrar} />;
  if (!sessao.conta.perfil || sessao.conta.perfil.refazer) return <Onboarding conta={sessao.conta} onSair={sair} onDone={d => { atualizar(d, { pronto: true }); window.scrollTo(0, 0); }} />;
  return <Painel key={sessao.conta.email} conta={sessao.conta} novo={sessao.novo} pronto={sessao.pronto} tema={tema} onSair={sair} onAtualizar={atualizar} />;
}


export default App;
