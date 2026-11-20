/*
  Avina (antes: Agenda do Consultório)
  -------------------------------------
  Quase todo o app está neste arquivo, separado em seções numeradas (procure por "====").
  Telas pouco usadas (perfil, painéis, cadastro inicial, recorte de foto e o modo Pessoal) ficam em src/telas/
  e só carregam quando são abertas: assim o app abre mais rápido.
  Para mudar textos, valores padrão, cores de paciente ou categorias, comece pela seção 1 (CONFIGURAÇÃO).
  Os estilos ficam em src/styles.css e as imagens de fundo em public/fundos/.
*/
import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "./assets/porquinho.webp";
import { acharMarca, marcaPorId, fontesLogo, fonteLembrada, lembrarFonte, monograma, normalizar } from "./marcas.js";
import { emReais, moedaNaFala, fmtMoeda, definirServidor, atualizarCotacoes, cotacaoDe, MOEDAS } from "./cotacoes.js";
import { NUVEM, ENDERECO_APP, cliente, useNuvem, contaDaNuvem, whatsappDaNuvem, enviarPerfil, sairDaNuvem, desconectar, excluirContaNuvem, traduzirErro, registrarAcesso } from "./nuvem.js";
import { lerBoleto, acharBoleto } from "./boleto.js";
import { lerInflacao, atualizarInflacao, useInflacao, acumulado, valorSugerido, nomeMesCurto } from "./inflacao.js";
import { avaliarConquistas, proximaConquista, nivelDe, TRILHAS } from "./conquistas.js";
import { AVATARES, ehAvatarPronto, avatarAtualizado } from "./avatares.js";
import { precosGuardados, veiculosDe } from "./transporte.js";
import { useCasa, K_CONVITE, pesosDe } from "./casa.js";
import { useLoja, K_CONVITE_LOJA, CORES_PRODUTO } from "./loja.js";
// a loja respondida no cadastro, esperando a nuvem para ser criada
const K_LOJA_INICIAL = e => `agenda-loja-inicial:${e}`;
import { janelasDoDia } from "./horarios.js";
import { LIMITE_GRATIS, LANCAMENTO_ATE, liberadoDe, ehPro, produtoDoUso, faseCortesia, emLancamento } from "./plano.js";
import { lerWhatsapp, mascaraWhatsapp } from "./whatsapp.js";
import { K_ORIGEM } from "./origem.js";
import { useLinkAgendamento, linkDo, confirmacaoDe, confirmado, enderecoConfirmar } from "./link.js";
import { AcoesAzuis, CartaoSaldo, GradeAtalhos, CartaoNovidade, CartaoResumo, noPeriodo } from "./blocos.jsx";
import { noApp, nativoV2, chamarApp, permitirIA, registrarNativo, enviarEstado } from "./app-nativo.js";
import { createPortal, flushSync } from "react-dom";

// A Bolinha (fala, conversa com a IA e o mascote) está desligada: o código fica guardado, mas nada dela aparece no app.
// A IA do servidor vai ser usada para outra coisa. Para voltar com ela, é só trocar para true.
const IA_CONVERSA = false;

// Caminho base do app (no GitHub Pages é /nome-do-repositorio/)
const BASE = import.meta.env.BASE_URL;

/* =========================================================
   1. CONFIGURAÇÃO — mude aqui com facilidade
   ========================================================= */
let DURACAO_SESSAO = 50;       // minutos de cada sessão (vem do perfil)
const INTERVALO_MIN = 45;      // a partir de quantos minutos mostra "intervalo livre"
const TEMA_PADRAO = "light";   // "dark", "light" ou "auto" (o claro é o principal)
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
// Perfil de partida de uma conta que ainda não respondeu as perguntas iniciais
const PERFIL_PADRAO = { reserva: 15, falta: { cobrar: true, horas: 24 }, registro: true, horaIni: 8, horaFim: 20, diasTrab: [1, 2, 3, 4, 5], termo: "Paciente", duracao: 50, estilo: "detalhado", pessoal: true };
// As versões antigas tinham uma demonstração que entrava com este e-mail: quem ainda estiver nela volta para a tela de entrar
const EMAIL_DEMO_ANTIGO = "demo@consultorio.app";
const PROFISSOES = [
  { id: "Psicologia", termo: "Paciente" }, { id: "Psicanálise", termo: "Analisando" }, { id: "Psiquiatria", termo: "Paciente" },
  { id: "Terapia ocupacional", termo: "Paciente" }, { id: "Fonoaudiologia", termo: "Paciente" }, { id: "Nutrição", termo: "Paciente" },
  { id: "Fisioterapia", termo: "Paciente" }, { id: "Coaching", termo: "Cliente" },
];
const DURACOES = [30, 40, 45, 50, 60];
const K = { contas: "agenda-contas", sessao: "agenda-sessao", tema: "agenda-tema", oculto: "agenda-oculto", db: e => `agenda-db:${e}`, modo: e => `agenda-modo:${e}`, avisos: e => `agenda-avisos:${e}`, inicial: e => `agenda-inicial:${e}`, tour: e => `agenda-tour:${e}` };

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
let LOGADO = false;       // conta com login: a IA do servidor conta o uso do dia por pessoa (e não por aparelho)
let VIAGEM = null;        // modo viagem do Pessoal (a fala assume a moeda da viagem)
let LOGOS = {};           // fotos que a pessoa escolheu como logo de uma empresa (por nome)
// Fundos que já vêm no app (arquivos em public/fundos/). Para adicionar um, coloque a imagem lá e inclua uma linha aqui.
const FUNDOS = [["floresta", "Floresta"], ["mar", "Mar à noite"], ["estrada", "Entardecer"]]
  .map(([id, nome]) => ({ id, nome, img: `${BASE}fundos/${id}.jpg`, thumb: `${BASE}fundos/${id}-mini.jpg` }));
const imagemFundo = (f, meus = []) => !f ? null : f.id === "meu" ? f.img : f.id.startsWith("u:") ? (meus.find(m => "u:" + m.id === f.id) || {}).img : (FUNDOS.find(x => x.id === f.id) || {}).img;

// Vibração do celular (Android; o iPhone não deixa sites vibrarem)
let VIBRAR = true;
const ajustarVibrar = v => { VIBRAR = v; };
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
  // no app de celular, a vibração é a do próprio aparelho (toque leve, sucesso, alerta ou erro)
  if (noApp) { chamarApp("vibrar", tipo).catch(() => {}); return; }
  try {
    if (navigator.vibrate) navigator.vibrate(VIB[tipo] || 8);
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) hapticoIOS(tipo === "toque" ? 1 : 2);
  } catch (e) {}
};

// A área que rola fica dentro do app (assim a barra de baixo nunca sai do lugar)
const rolarTopo = () => window.scrollTo(0, 0);
// Troca de tela com animação suave, como app nativo (View Transitions; onde não existe, troca direto)
// Troca de tela com animação nativa do navegador. "tipo" diz para onde a tela desliza:
// "frente" (aba que fica depois), "tras" (aba que fica antes) ou "modo" (Consultório <-> Pessoal)
const comTransicao = (fn, tipo = "frente") => {
  try {
    if (document.startViewTransition && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      document.documentElement.dataset.vt = tipo;
      const t = document.startViewTransition(() => flushSync(fn));
      t.finished.finally(() => { delete document.documentElement.dataset.vt; });
      return;
    }
  } catch (e) {}
  fn();
};
const ORDEM_ABAS = ["home", "agenda", "pac", "fin", "p-home", "p-gastos", "p-contas", "p-transp", "p-casa", "l-caixa", "l-gastos", "l-lista", "l-resumo"];
// Os modos do app: Consultório, Pessoal e Loja. Cada pessoa usa os que escolheu (pelo menos um)
const modosDo = p => { p = p || {}; const c = p.consultorio !== false, l = p.loja === true, ps = p.pessoal !== false || (!c && !l); return [c && "consultorio", ps && "pessoal", l && "loja"].filter(Boolean); };
const inicioDo = m => m === "pessoal" ? "p-home" : m === "loja" ? "l-caixa" : "home";
const modoDaAba = t => t.startsWith("p-") ? "pessoal" : t.startsWith("l-") ? "loja" : "consultorio";
const NOME_MODO = { consultorio: "Consultório", pessoal: "Pessoal", loja: "Loja" };
// por onde o app abre depois do cadastro: quem tem loja começa nela
const modoInicial = p => (p && p.loja ? "loja" : modosDo(p)[0]);
// formatador guardado: toLocaleString com opções monta um novo a cada chamada (~50x mais lento, e são centenas por tela)
const FMT_BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlReal = v => FMT_BRL.format(Number(v) || 0);
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
// --ci: cor do ícone em cima da bolinha cheia (branco nas cores fortes; escuro no laranja e no amarelo, onde o branco some)
const catVars = cat => { const c = CORES.find(x => x.id === (cat && cat.cor)) || CORES[0]; return { "--cc": c.cor, "--cc-ink": c.ink, "--ci": c.id === "laranja" || c.id === "amarelo" ? c.ink : "#fff" }; };

const lerJSON = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const apagar = k => { try { localStorage.removeItem(k); } catch (e) {} };
const lerTexto = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h); }; // só nas contas sem nuvem (ficam no aparelho)

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

// Guardado por versão dos dados: o db é trocado inteiro a cada mudança (nunca alterado no lugar), e a agenda, o Início
// e a previsão pedem os mesmos dias muitas vezes a cada desenho (o relógio redesenha a cada 30 s)
const DIAS_GUARDADOS = new WeakMap();
function itensDoDia(db, iso) {
  let porDia = DIAS_GUARDADOS.get(db);
  if (!porDia) { porDia = new Map(); DIAS_GUARDADOS.set(db, porDia); }
  let itens = porDia.get(iso);
  if (!itens) { itens = itensDoDiaAgora(db, iso); porDia.set(iso, itens); }
  return itens;
}
function itensDoDiaAgora(db, iso) {
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
// id/chargeId: os ids da sessão e da cobrança nova (o app de celular manda os dele: repetir o pedido não duplica)
function registrar(db, pid, { status, nextDate, paidNow, price, sublet, padrao, cobrarFalta, id, chargeId }) {
  const p = db.patients.find(x => x.id === pid);
  const s = { id: id || uid(), patientId: pid, date: p.nextDate, time: p.time, price: price ?? p.price, sublet: sublet ?? sublocacao(p), status, chargeId: null, registro: false, cobrada: status === "missed" && !!cobrarFalta };
  const entra = status === "done" || s.cobrada;
  let sessions = [...db.sessions], charges = [...db.charges], nova = null;
  if (entra && p.billing === "session") {
    nova = { id: chargeId || uid(), patientId: pid, sessionIds: [s.id], amount: s.price, createdAt: todayISO(), paid: !!paidNow, paidAt: paidNow ? todayISO() : null };
    s.chargeId = nova.id;
    sessions.push(s);
  } else {
    sessions.push(s);
    if (entra) {
      const abertas = sessions.filter(x => x.patientId === pid && contaDinheiro(x) && !x.chargeId);
      if (abertas.length >= p.packageSize) {
        nova = { id: chargeId || uid(), patientId: pid, sessionIds: abertas.map(x => x.id), amount: soma(abertas, x => x.price), createdAt: todayISO(), paid: false, paidAt: null };
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
    falas.push({ txt: <>Já usa outra agenda? Eu trago seus {TERMO.p} do Google Agenda, do iPhone ou de uma lista, com dia e horário.</>, acao: { l: "Trazer da agenda antiga", ic: <I.upload />, fn: act.importarAgenda } });
    return falas;
  }
  const fa = act.falaAssinatura && act.falaAssinatura();
  if (fa) falas.push(fa);
  const ped = db.pedidos || [];
  if (ped.length) falas.push({ txt: ped.length === 1
    ? <><b>{primeiro(ped[0].nome)}</b> pediu pelo seu link {ped[0].pid ? "para remarcar para" : "um horário:"} {relativo(ped[0].data).toLowerCase()} às {ped[0].hora}.</>
    : <>Chegaram <b>{ped.length} pedidos de horário</b> pelo seu link.</>, acao: { l: ped.length === 1 ? "Ver pedido" : "Ver pedidos", ic: <I.cal />, fn: act.abrirPedidos } });
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
      if (ch) falas.push({ txt: <>Vai chover perto das {ch.h}h ({ch.p}%). Saia uns 10 minutos antes para a sessão das {prox.time}.</> });
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
  // Pix do banco em dúvida (Open Finance): de quem é?
  const pixP = (db.pixPendentes || [])[0];
  if (pixP) falas.push({ txt: <>Chegou um Pix de <b>{brl(pixP.valor)}</b>{pixP.pagador ? <> de {pixP.pagador.replace(/\b\w/g, c => c.toUpperCase())}</> : null} ({dm(pixP.data)}). É pagamento de sessão?{(db.pixPendentes || []).length > 1 ? ` E mais ${db.pixPendentes.length - 1} para ver.` : ""}</>, acao: { l: "Ver de quem é", ic: <I.money />, fn: () => act.verPixPendente(pixP) } });
  // Pediu para remarcar pelo link de confirmação (nos próximos 7 dias)
  Object.entries(db.confirmados || {}).forEach(([k, v]) => {
    if (confirmacaoDe(v) !== "remarcar") return;
    const [pid, d] = k.split(":"), p = db.patients.find(x => x.id === pid && x.active);
    if (!p || d < t || d > addDays(t, 7)) return;
    const naProxima = p.nextDate === d;
    falas.push({ txt: <><b>{primeiro(p.name)}</b> pediu para remarcar a sessão de {relativo(d).toLowerCase()}{relativo(d) === diaCurto(d) ? "" : ` (${dm(d)})`}. {naProxima ? "Escolha o novo horário e avise por mensagem." : ""}</>,
      acao: naProxima ? { l: "Remarcar", ic: <I.repeat />, fn: () => act.openItem({ kind: "next", patient: p, date: d, time: p.time, modo: "move" }) } : { l: `Ver ${primeiro(p.name)}`, ic: <I.user />, fn: () => act.openPatient(p.id) } });
  });
  // Registros pendentes
  const regs = registroPendente(db);
  if (regs.length) { const ns = [...new Set(regs.map(r => primeiro((db.patients.find(p => p.id === r.patientId) || { name: "?" }).name)))]; falas.push({ txt: <>Falta o registro {ns.length === 1 ? `da sessão de ${ns[0]}` : `das sessões de ${ns.slice(0, -1).join(", ")} e ${ns[ns.length - 1]}`}.</>, acao: { l: "Marcar registros", ic: <I.check />, fn: act.registros } }); }
  // Revisão da semana (domingo e segunda)
  const dow = fromISO(t).getDay();
  if ((dow === 0 || dow === 1) && !(db.revisoes || {})[semanaKey(t)]) falas.push({ txt: <>Sua revisão da semana está pronta: quanto entrou, faltas e o que vem pela frente.</>, acao: { l: "Ver revisão", ic: <I.chart />, fn: act.revisao } });
  // Reajuste: mais de 12 meses com o mesmo valor
  const reaj = db.patients.find(p => reajusteDe(p));
  const rj = reaj && reajusteDe(reaj);
  if (reaj && rj.ac && rj.ac.pct <= 0) { /* inflação zerada ou negativa no período: nada a sugerir */ }
  else if (reaj) falas.push({ txt: <>{primeiro(reaj.name)} está há {rj.meses} meses com o mesmo valor ({brl(reaj.price)}).{rj.sug > reaj.price ? <> A inflação nesse tempo foi de {pctTxt(rj.ac.pct)}: que tal {brl(rj.sug)}?</> : " Talvez seja hora de conversar sobre reajuste."}</>, acao: { l: `Ver ${primeiro(reaj.name)}`, ic: <I.user />, fn: () => act.openPatient(reaj.id) } });
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
const pessoalVazio = () => ({ lanc: [], contas: [], caixinhas: [], incluirConsultorio: true });
const vencimento = (conta, chave) => `${chave}-${pad(Math.min(conta.dia, diasNoMes(chave)))}`;
// Marcar (e desmarcar) uma conta fixa como paga num mês ('AAAA-MM'): o "Paguei" do site e o pedido do app de celular
const pagarContaP = (P, id, mes, data) => ({ ...P, contas: P.contas.map(x => x.id === id ? { ...x, pagas: { ...(x.pagas || {}), [mes]: data } } : x) });
const despagarContaP = (P, id, mes) => ({ ...P, contas: P.contas.map(x => { if (x.id !== id) return x; const pg = { ...(x.pagas || {}) }; delete pg[mes]; return { ...x, pagas: pg }; }) });
function situacaoConta(conta, chave) {
  const t = todayISO();
  if (conta.pagas && conta.pagas[chave]) return { st: "paga", txt: `Paga em ${dm(conta.pagas[chave])}` };
  const v = vencimento(conta, chave), d = diffDias(t, v);
  if (d < 0) return { st: "atrasada", txt: `Venceu ${d === -1 ? "ontem" : `há ${-d} dias`}` };
  if (d === 0) return { st: "hoje", txt: "Vence hoje" };
  if (d === 1) return { st: "breve", txt: "Vence amanhã" };
  return { st: d <= 5 ? "breve" : "ok", txt: `Vence em ${d} dias` };
}
// Quanto saiu em cada categoria no mês (lançamentos + contas fixas pagas): é o que conta para os tetos
// Caixinhas com "separar sozinho": cada entrada nova manda a porcentagem para a caixinha
function separarAuto(P, entrada) {
  if (!entrada || !(entrada.valor > 0)) return P;
  const cx = (P.caixinhas || []).map(c => c.autoPct > 0 && !c.banco ? { ...c, movs: [...(c.movs || []), { id: uid(), data: entrada.data, valor: Math.round(entrada.valor * c.autoPct) / 100, auto: true }] } : c);
  return cx.some((c, i) => c !== P.caixinhas[i]) ? { ...P, caixinhas: cx } : P;
}
function gastoPorCat(db, chave) {
  const P = db.pessoal || pessoalVazio(), out = {};
  P.lanc.forEach(l => { if (l.tipo === "saida" && l.data.startsWith(chave)) out[l.cat] = (out[l.cat] || 0) + l.valor; });
  P.contas.forEach(c => { if (c.pagas && c.pagas[chave]) out[c.cat] = (out[c.cat] || 0) + c.valor; });
  return out;
}
// Tetos que passaram de 80% (ou estouraram) neste mês: [{ cat, teto, gasto, pct }]
function tetosAlerta(db, chave) {
  const lim = (db.pessoal && db.pessoal.limites) || {}, g = gastoPorCat(db, chave);
  return Object.entries(lim).filter(([, v]) => v > 0).map(([cat, teto]) => ({ cat, teto, gasto: g[cat] || 0, pct: (g[cat] || 0) / teto })).filter(x => x.pct >= .8).sort((a, b) => b.pct - a.pct);
}

// Saldo acumulado dia a dia (para o gráfico)

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

/* Clima de verdade pela Open-Meteo (gratuita, sem chave): temperatura de AGORA, sensação, umidade,
   chuva hora a hora e mínima/máxima. Pela cidade do perfil ou pela localização do aparelho (mais precisa).
   Sem internet, mostra a última previsão real com o horário em que foi buscada; nunca inventa números. */
let CLIMA = null;
const K_CLIMA_LOCAL = "agenda-clima-local"; // { lat, lon, nome } quando você escolhe "usar minha localização"
const climaLocal = () => lerJSON(K_CLIMA_LOCAL, null);
async function buscarJSON(url, signal) { const r = await fetch(url, { signal }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function buscarClima(cidade, forcar) {
  const local = climaLocal();
  if (!local && !cidade) throw new Error("sem-cidade");
  const key = "agenda-clima:" + (local ? `${local.lat.toFixed(2)},${local.lon.toFixed(2)}` : cidade.toLowerCase());
  const c = lerJSON(key, null);
  if (!forcar && c && c.atual && Date.now() - c.em < 15 * 60e3) return c;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    let lat, lon, nome;
    if (local) { lat = local.lat; lon = local.lon; nome = local.nome || "Sua localização"; }
    else {
      const g = await buscarJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&countryCode=BR`, ctrl.signal);
      const loc = g.results && g.results[0];
      if (!loc) throw new Error("cidade");
      lat = loc.latitude; lon = loc.longitude; nome = loc.name + (loc.admin1 ? ` (${loc.admin1})` : "");
    }
    const f = await buscarJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,precipitation,is_day,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=2`, ctrl.signal);
    const horas = f.hourly.time.map((t, i) => ({ t, temp: Math.round(f.hourly.temperature_2m[i]), p: f.hourly.precipitation_probability[i] ?? 0, code: f.hourly.weather_code[i], dia: f.hourly.is_day[i] !== 0 }));
    const a = f.current;
    const out = {
      cidade: nome.replace(/ \(.*\)$/, ""), lugar: nome, horas, em: Date.now(), local: !!local,
      atual: { temp: Math.round(a.temperature_2m), sens: Math.round(a.apparent_temperature), umid: a.relative_humidity_2m, code: a.weather_code, chuva: a.precipitation, dia: a.is_day !== 0, vento: Math.round(a.wind_speed_10m), hora: a.time },
      hoje: { min: Math.round(f.daily.temperature_2m_min[0]), max: Math.round(f.daily.temperature_2m_max[0]), p: f.daily.precipitation_probability_max[0] ?? 0, sol: [f.daily.sunrise[0], f.daily.sunset[0]].map(s => String(s).slice(11, 16)) },
    };
    gravar(key, out);
    return out;
  } catch (e) {
    // sem internet: a última previsão real (até 12 h), avisando de quando é
    if (c && c.atual && Date.now() - c.em < 12 * 3600e3) return { ...c, velho: true };
    throw e;
  } finally { clearTimeout(to); }
}
// Nome do lugar a partir da localização (BigDataCloud, gratuito e sem chave)
async function nomeDoLugar(lat, lon) {
  try { const j = await buscarJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`); return j.city || j.locality || j.principalSubdivision || ""; }
  catch (e) { return ""; }
}
// Pede a localização ao aparelho (o próprio celular pergunta se pode)
function pedirLocalizacao() {
  return new Promise((ok, erro) => {
    if (!navigator.geolocation) return erro(new Error("sem-gps"));
    navigator.geolocation.getCurrentPosition(async p => {
      const lat = +p.coords.latitude.toFixed(3), lon = +p.coords.longitude.toFixed(3);
      const nome = await nomeDoLugar(lat, lon);
      gravar(K_CLIMA_LOCAL, { lat, lon, nome }); ok({ lat, lon, nome });
    }, e => erro(new Error(e && e.code === 1 ? "negado" : "gps")), { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60e3 });
  });
}
const TEMPO_TXT = c => c === 0 ? "Céu limpo" : c === 1 ? "Quase sem nuvens" : c === 2 ? "Parcialmente nublado" : c === 3 ? "Nublado" : c <= 48 ? "Neblina" : c <= 57 ? "Garoa" : c <= 67 ? (c === 61 ? "Chuva fraca" : c === 65 ? "Chuva forte" : "Chuva") : c <= 77 ? "Neve" : c <= 82 ? "Pancadas de chuva" : c <= 86 ? "Neve" : "Trovoadas";
const climaHora = (iso, h) => CLIMA && CLIMA.horas ? CLIMA.horas.find(x => x.t === `${iso}T${pad(h)}:00`) : undefined;
// Chance de chuva perto de um horário (na hora anterior e na própria hora)
function chuvaPerto(iso, hora) {
  const h = Math.floor(mins(hora) / 60);
  const cands = [climaHora(iso, h - 1), climaHora(iso, h)].filter(Boolean).sort((a, b) => b.p - a.p);
  return cands[0] && cands[0].p >= 50 ? { p: cands[0].p, h: Number(cands[0].t.slice(11, 13)) } : null;
}
const iconeClima = (code, dia = true) => code >= 95 ? "storm" : code >= 51 ? "rain" : code >= 2 ? "cloud" : dia ? "sun" : "moon";

// Entender frases como "gastei 32 reais na padaria ontem"
const PALAVRAS_CAT = {
  comida: ["padaria", "padoca", "pão", "restaurante", "lanche", "lanchonete", "almoço", "jantar", "ifood", "pizza", "café", "cafeteria", "hambúrguer", "sorvete", "bar", "boteco", "cerveja", "churrasco", "sushi", "delivery", "açaí", "pastel", "marmita"],
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
    let total = 0, cur = 0, ult = Infinity, cent = null;
    for (const p of seq.split(/\s+/)) {
      if (p === "e") continue;
      if (p === "mil") { total += (cur || 1) * 1000; cur = 0; ult = 1000; continue; }
      const v = NUMS[p];
      // cada parte de um número é menor que a anterior ("cento e oitenta e dois"); se vier uma maior
      // depois ("…dois e quarenta", "dez e cinquenta", "um e noventa"), são os centavos
      if (cent === null && v >= 10 && v < 100 && v > ult && total + cur > 0) { cent = v; continue; }
      if (cent !== null) { if (v < 10 && cent % 10 === 0) cent += v; continue; }
      cur += v; ult = v;
    }
    return cent !== null ? `${total + cur},${pad(cent)}` : String(total + cur);
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
    const m = t.match(/\b(?:na|no|em|de|do|da|com|pro|pra|pros|pras|para o|para a)\s+([a-z]+(?:\s+[a-z]+)?)/);
    if (m && !/^\d/.test(m[1])) desc = m[1].replace(/\b(ontem|hoje|anteontem|reais|real)\b/g, "").trim();
    desc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : "";
    cat = entrada ? "outros-e" : "outros";
  }
  // empresa conhecida: nome certo, categoria certa e a logo dela
  const marca = acharMarca(t);
  if (marca) { desc = marca.nome; if (!entrada) cat = marca.cat; }
  // moeda estrangeira ("20 dólares no táxi", "€ 15", ou a moeda da viagem): guarda o original e converte para reais
  const mo = moedaNaFala(t, VIAGEM);
  if (mo) {
    const valorOrig = mo.valor || valor, cotacao = cotacaoDe(mo.moeda);
    const iof = !(VIAGEM && VIAGEM.moeda === mo.moeda && VIAGEM.iof === false);
    if (desc && /^(Dolar|Dolares|Euro|Euros|Libra|Libras|Pesos?)\b/i.test(desc)) desc = "";
    return { tipo: entrada ? "entrada" : "saida", valor: valorOrig ? emReais(valorOrig, mo.moeda, iof && !entrada, cotacao) : 0, cat, desc, off, marca: marca ? marca.id : null, moeda: mo.moeda, valorOrig, cotacao, iof: iof && !entrada };
  }
  return { tipo: entrada ? "entrada" : "saida", valor, cat, desc, off, marca: marca ? marca.id : null };
}

// Marcas (logos de empresas, tolerando erro de digitação): veja src/marcas.js

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
  const h = t.match(/\b(\d{1,2})\s*(?::|h)\s*(\d{2})\b/) || t.match(/\b(\d{1,2})\s*h\b/) || t.match(/\b(?:as|pras|para as|pra)\s+(\d{1,2}),(\d{2})\b/) || t.match(/\b(?:as|pras|para as|pra)\s+(\d{1,2})(?:\s+(?:e\s+)?(\d{2}))?(?:\s+horas?)?\b/) || t.match(/\b(\d{1,2})\s+horas?\b/);
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
   Como ficou mais confiável:
   - Uma instância só, reaproveitada a cada toque (criar várias seguidas trava o reconhecimento no iPhone e no Android).
     Se ela ainda estiver ocupada, é descartada e nasce outra, sempre dentro do toque (o iPhone exige).
   - O app decide quando você terminou: se a frase já faz sentido ("gastei 30 no uber"), encerra 1,2 s depois
     da última palavra; se ainda falta algo (o valor, por ex.), espera um pouco mais. Pausas no meio não cortam a frase.
   - Pede várias interpretações ao aparelho e fica com a primeira que o app entende.
   - Nada de travar o microfone por horas: cada toque é uma tentativa nova. O teclado só entra quando
     o aparelho realmente não deixa (permissão negada ou recurso indisponível), e o botão "Tentar a voz" volta.
   Se o aparelho não tiver reconhecimento (alguns iPhones com o app instalado), o app abre o teclado:
   aí é só tocar no microfone do teclado e falar. */
const SRec = () => window.SpeechRecognition || window.webkitSpeechRecognition;
try { localStorage.removeItem("agenda-voz-teclado"); } catch (e) {} // limpa a trava antiga de 6 horas
let VOZ_BLOQUEADA = false; // o aparelho negou o microfone nesta abertura do app (volta ao tocar em "Tentar a voz")
const vozTravada = () => VOZ_BLOQUEADA;
const vozOk = () => { VOZ_BLOQUEADA = false; };
const MSG_TECLADO = "O aparelho não liberou o reconhecimento de voz. Use o microfone do teclado: funciona igual.";
const normVoz = t => semAcento(String(t || "").toLowerCase()).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
// Junta os pedaços que o aparelho devolve. Alguns aparelhos repetem a frase inteira a cada pedaço
// (Android com escuta contínua): aí fica só a versão mais completa, sem duplicar.
function juntarFala(results, k = -1, j = 0) {
  const finais = []; let interino = "";
  for (let i = 0; i < results.length; i++) {
    const r = results[i]; const alt = r[i === k ? j : 0] || r[0];
    const t = (alt && alt.transcript || "").trim(); if (!t) continue;
    if (r.isFinal) {
      const acc = normVoz(finais.join(" ")), nt = normVoz(t);
      if (acc && nt.startsWith(acc)) { finais.length = 0; finais.push(t); }
      else if (!(acc && acc.endsWith(nt))) finais.push(t);
    } else interino = interino ? interino + " " + t : t;
  }
  let txt = finais.join(" ");
  if (interino) { const a = normVoz(txt), b = normVoz(interino); txt = a && b.startsWith(a) ? interino : a && a.endsWith(b) ? txt : (txt + " " + interino).trim(); }
  return txt.replace(/\s+/g, " ").trim();
}
// as outras interpretações do último pedaço final (ex.: "trinta" ouvido como "trinta" ou "30")
function alternativasFala(results) {
  let k = -1; for (let i = results.length - 1; i >= 0; i--) if (results[i].isFinal) { k = i; break; }
  if (k < 0) return [];
  const out = []; for (let j = 1; j < results[k].length; j++) { const t = juntarFala(results, k, j); if (t && !out.includes(t)) out.push(t); }
  return out;
}

// O motor: guarda a instância e liga cada uma à "sessão" (um toque na Bolinha) que a está usando
const MOTOR = { rec: null, rodando: false };
function pegarReconhecedor() {
  const SR = SRec(); if (!SR) return null;
  if (MOTOR.rec && MOTOR.rodando) { const velho = MOTOR.rec; velho._s = null; try { velho.abort(); } catch (e) {} MOTOR.rec = null; }
  if (!MOTOR.rec) {
    const rec = new SR();
    rec.lang = "pt-BR"; rec.interimResults = true; rec.maxAlternatives = 4;
    // contínuo: você pode pausar no meio ("gastei 30… no mercado") sem a frase ser cortada; quem encerra é o app
    rec.continuous = true;
    const ev = nome => (...a) => { const s = rec._s; if (s && s[nome]) s[nome](...a); };
    rec.onstart = ev("comecou"); rec.onaudiostart = ev("audio"); rec.onspeechstart = ev("fala");
    rec.onresult = ev("resultado"); rec.onerror = ev("erro");
    rec.onend = (...a) => { if (MOTOR.rec === rec) MOTOR.rodando = false; const s = rec._s; rec._s = null; if (s && s.terminou) s.terminou(...a); };
    MOTOR.rec = rec;
  }
  return MOTOR.rec;
}
const descartarReconhecedor = () => { const r = MOTOR.rec; if (r) { r._s = null; try { r.abort(); } catch (e) {} } MOTOR.rec = null; MOTOR.rodando = false; };

function useFalaNativa({ onParcial, onFinal, onFalhou, completo, onSilencio }) {
  const [estado, setEstado] = useState("parado"); // parado | ouvindo | falando | erro
  const [erro, setErro] = useState("");
  const [nivel, setNivel] = useState(0);
  const sess = useRef(null);
  const cb = useRef({}); cb.current = { onParcial, onFinal, onFalhou, completo, onSilencio };
  const limparTimers = x => { clearInterval(x.decai); ["vigiaInicio", "vigiaSilencio", "fimFala", "teto", "forca"].forEach(k => clearTimeout(x[k])); };
  const encerrar = x => { if (!x || x.acabou) return false; x.acabou = true; limparTimers(x); if (sess.current === x) sess.current = null; setNivel(0); return true; };
  const falhar = (x, msg, teclado) => {
    if (x && !encerrar(x)) return;
    if (x && x.rec) { x.rec._s = null; try { x.rec.abort(); } catch (e) {} }
    setErro(msg); setEstado("erro"); vibrar("aviso");
    if (teclado) cb.current.onFalhou();
  };
  // termina com o que ouviu (ou avisa que não ouviu nada)
  const finalizar = (x, msgVazio) => {
    if (!encerrar(x)) return;
    if (x.rec && x.rec._s === x) { x.rec._s = null; try { x.rec.abort(); } catch (e) {} }
    const t = x.texto.trim();
    if (t) { setEstado("parado"); cb.current.onFinal(t, x.alts || []); }
    else if (!msgVazio && cb.current.onSilencio && cb.current.onSilencio()) setEstado("parado");
    else { setErro(msgVazio || "Não ouvi nada. Toque na Bolinha e fale de novo."); setEstado("erro"); vibrar("aviso"); }
  };
  // pede para o aparelho fechar a frase; se ele demorar, fica com o que já chegou
  const pedirFim = x => {
    if (!x || x.acabou || x.parando) return; x.parando = true;
    clearTimeout(x.fimFala); clearTimeout(x.vigiaSilencio);
    try { x.rec.stop(); } catch (e) {}
    x.forca = setTimeout(() => finalizar(x), 1100);
  };
  useEffect(() => () => { const x = sess.current; if (x) { encerrar(x); if (x.rec) { x.rec._s = null; try { x.rec.abort(); } catch (e) {} } } }, []);

  // chamado direto no toque: o rec.start() acontece aqui mesmo, sem esperar nada (exigência do iPhone)
  const iniciar = () => {
    const velho = sess.current; if (velho) { encerrar(velho); if (velho.rec) velho.rec._s = null; }
    setErro(""); setNivel(0);
    const rec = pegarReconhecedor();
    if (!rec) return false;
    const x = { rec, texto: "", alts: [], acabou: false, parando: false, abriu: false, ouviu: false, tentativas: 0, t0: Date.now() };
    sess.current = x;
    const recomecar = () => { // nova tentativa silenciosa (sem toque: funciona no Android; no iPhone, se falhar, avisa)
      x.tentativas++; x.parando = false;
      try { rec._s = x; rec.start(); MOTOR.rodando = true; x.t0 = Date.now(); armarInicio(); return true; } catch (e) { return false; }
    };
    const armarInicio = () => { clearTimeout(x.vigiaInicio); x.vigiaInicio = setTimeout(() => { if (!x.abriu && !x.acabou) { descartarReconhecedor(); falhar(x, "O microfone não abriu. Toque na Bolinha de novo."); } }, 8000); };
    x.comecou = () => { x.abriu = true; clearTimeout(x.vigiaInicio); setEstado(e => e === "falando" ? e : "ouvindo"); };
    x.audio = () => { x.abriu = true; clearTimeout(x.vigiaInicio); };
    x.fala = () => { setEstado("falando"); };
    x.resultado = e => {
      if (x.acabou) return;
      x.abriu = true; x.ouviu = true; clearTimeout(x.vigiaInicio); clearTimeout(x.vigiaSilencio);
      const t = juntarFala(e.results);
      if (t !== x.texto) { x.texto = t; cb.current.onParcial(t); }
      const alts = alternativasFala(e.results); if (alts.length) x.alts = alts;
      setEstado("falando"); setNivel(.55 + Math.random() * .45);
      // fim da fala: decide pelo sentido da frase, não só pelo silêncio
      clearTimeout(x.fimFala);
      const ok = cb.current.completo ? cb.current.completo(t) : false;
      x.fimFala = setTimeout(() => pedirFim(x), ok ? 1200 : 2600);
    };
    x.erro = ev => {
      if (x.acabou) return;
      const code = (ev && ev.error) || String(ev || "");
      x.codigo = code;
      if (code === "aborted") return; // o onend vem logo depois e resolve
      if (code === "no-speech") return; // idem: termina com o que tiver
      if (code === "not-allowed" || code === "service-not-allowed") {
        VOZ_BLOQUEADA = true; descartarReconhecedor();
        return falhar(x, code === "not-allowed" && !ehIOS() ? "O microfone está bloqueado para o app. Libere em Configurações do navegador → Microfone, ou use o microfone do teclado." : MSG_TECLADO, true);
      }
      if (code === "network" && !x.texto && x.tentativas < 1) { x.recomecarNoFim = true; return; }
      if (code === "network") { x.msgFim = "Sem internet: o reconhecimento de voz do aparelho precisa de conexão. Use o teclado."; return; }
      if (code === "audio-capture") { descartarReconhecedor(); x.msgFim = "O microfone está ocupado por outro app (ligação, gravador…). Feche e tente de novo."; return; }
      if (code === "language-not-supported") { x.msgFim = "Este aparelho não reconhece português pela voz. Use o microfone do teclado."; return; }
      x.msgFim = `Não consegui ouvir agora (${code}). Toque na Bolinha para tentar de novo.`;
    };
    x.terminou = () => {
      if (x.acabou) return;
      clearTimeout(x.forca);
      // o aparelho fechou sozinho logo de cara, sem ouvir nada (acontece no iPhone e em rede ruim): tenta de novo uma vez
      if (!x.texto && !x.parando && (x.recomecarNoFim || (Date.now() - x.t0 < 1500 && !x.codigo)) && x.tentativas < 1) { x.recomecarNoFim = false; x.codigo = ""; if (recomecar()) return; }
      // escuta contínua: se o aparelho encerrou no meio (pausa longa) e já tem frase, termina com ela
      finalizar(x, x.msgFim);
    };
    x.decai = setInterval(() => setNivel(n => n > .14 ? n * .8 : .06 + Math.random() * .06), 110);
    // abriu mas ninguém falou: encerra com calma
    x.vigiaSilencio = setTimeout(() => { if (!x.ouviu) pedirFim(x); }, 9000);
    x.teto = setTimeout(() => pedirFim(x), 30000);
    try { rec._s = x; rec.start(); MOTOR.rodando = true; }
    catch (e) {
      // ainda estava ocupada: descarta e tenta com uma nova, no mesmo toque
      descartarReconhecedor();
      const novo = pegarReconhecedor(); x.rec = novo;
      try { novo._s = x; novo.start(); MOTOR.rodando = true; }
      catch (e2) { falhar(x, "Não consegui abrir o microfone. Toque na Bolinha de novo."); return true; }
    }
    armarInicio();
    setEstado("ouvindo");
    return true;
  };
  // terminar agora (toque na Bolinha enquanto ouve)
  const parar = () => { const x = sess.current; if (x) pedirFim(x); };
  const cancelar = () => { const x = sess.current; if (x) { encerrar(x); if (x.rec) { x.rec._s = null; try { x.rec.abort(); } catch (e) {} } } setNivel(0); setErro(""); setEstado("parado"); };
  return { estado, erro, nivel, iniciar, parar, cancelar };
}

/* ---------- Falar pelo servidor (Whisper na Cloudflare) ----------
   O jeito mais confiável, em qualquer celular (inclusive iPhone com o app instalado):
   o próprio app grava o áudio, percebe sozinho quando você parou de falar (medindo o volume de verdade),
   corta o silêncio, manda um áudio curtinho para o SEU servidor na Cloudflare e recebe o texto.
   Sem servidor configurado (ou se ele estiver desatualizado), usa o reconhecimento do aparelho. */
let AUDIO_CTX_VOZ = null;
let VOZ_SERVIDOR_FALHOU = false; // o servidor ainda não tem a rota de fala: nesta abertura do app usa a voz do aparelho
const temGravador = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!(window.AudioContext || window.webkitAudioContext);
const vozPeloServidor = () => !VOZ_SERVIDOR_FALHOU && !!servidorAvisos() && temGravador();
// O microfone fica aberto alguns segundos depois de cada frase: completar a frase (ou falar de novo)
// não abre o microfone outra vez, não pede permissão de novo no iPhone e não perde o comecinho da fala.
const MIC = { stream: null, timer: 0 };
const micVivo = () => !!MIC.stream && MIC.stream.getAudioTracks().some(t => t.readyState === "live");
const fecharMic = () => { clearTimeout(MIC.timer); if (MIC.stream) MIC.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); MIC.stream = null; };
const guardarMic = () => { clearTimeout(MIC.timer); MIC.timer = setTimeout(fecharMic, 12000); };
// frases que o Whisper "inventa" quando só tem silêncio ou ruído (o servidor também filtra)
const ALUCINA = /amara\.org|legendas? (pela|por|da)|inscreva-se|se inscrev[ae]|ative o sininho|obrigad[oa] por assistir|anota[cç][aã]o falada em portugu|^\s*(obrigad[oa]|tchau)[.!]?\s*$/i;
const limparTranscricao = t => {
  let s = String(t || "").replace(/\s+/g, " ").trim();
  if (!s || ALUCINA.test(s)) return "";
  s = s.replace(/R\$\s*/gi, "").replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2").replace(/[.!?…]+(\s|$)/g, "$1").replace(/[“”"]/g, "").trim();
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : "";
};
const paraBase64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
// Converte para 16 kHz com o conversor do próprio navegador (filtra os agudos antes; a voz chega mais limpa ao Whisper)
async function reamostrar(pcm, taxa) {
  if (taxa === 16000) return pcm;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return null;
  const off = new OAC(1, Math.ceil(pcm.length * 16000 / taxa), 16000);
  const buf = off.createBuffer(1, pcm.length, taxa); buf.getChannelData(0).set(pcm);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start(0);
  const p = off.startRendering();
  const out = p && p.then ? await p : await new Promise(ok => { off.oncomplete = e => ok(e.renderedBuffer); });
  return out.getChannelData(0);
}
// junta os pedaços gravados, corta o silêncio das pontas, ajusta o volume e gera um WAV 16 kHz mono (o formato que o Whisper usa)
async function montarWav(x, manual) {
  const n = x.chunks.length; if (!n) return null;
  let ini = x.fala.indexOf(true), fim = x.fala.lastIndexOf(true);
  if (ini < 0) { if (!manual) return null; ini = 0; fim = n - 1; }
  // margem antes e depois da fala: o fim das palavras ("ontem", "reais") é baixinho e não pode ser cortado
  const pad1 = Math.ceil(450 / x.msBloco), pad2 = Math.ceil(900 / x.msBloco);
  const pedacos = x.chunks.slice(Math.max(0, ini - pad1), Math.min(n, fim + pad2 + 1));
  let total = 0; for (const c of pedacos) total += c.length;
  if (total < x.taxa * .35) return null;
  const pcm = new Float32Array(total); let o = 0; for (const c of pedacos) { pcm.set(c, o); o += c.length; }
  let pico = 0; for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > pico) pico = a; }
  const ganho = pico > 0 ? Math.min(8, .9 / pico) : 1;
  let s16 = null; try { s16 = await reamostrar(pcm, x.taxa); } catch (e) {}
  if (!s16) { // navegador antigo: média simples
    const r = x.taxa / 16000, m0 = Math.floor(pcm.length / r); s16 = new Float32Array(m0);
    for (let i = 0; i < m0; i++) {
      const a = Math.floor(i * r), b = Math.max(a + 1, Math.min(pcm.length, Math.floor((i + 1) * r)));
      let soma = 0; for (let j = a; j < b; j++) soma += pcm[j];
      s16[i] = soma / (b - a);
    }
  }
  const m = s16.length, out = new Int16Array(m);
  for (let i = 0; i < m; i++) out[i] = Math.max(-1, Math.min(1, s16[i] * ganho)) * 0x7fff;
  const buf = new ArrayBuffer(44 + m * 2), dv = new DataView(buf);
  const w = (p, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(p + i, t.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + m * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, m * 2, true);
  new Int16Array(buf, 44).set(out);
  return new Uint8Array(buf);
}

function useFalaServidor({ onFinal, onFalhou, prompt, onSilencio }) {
  const [estado, setEstado] = useState("parado"); // parado | ouvindo | falando | processando | erro
  const [erro, setErro] = useState("");
  const [nivel, setNivel] = useState(0);
  const atual = useRef(null);
  const cb = useRef({}); cb.current = { onFinal, onFalhou, prompt, onSilencio };
  // fecharMic: true quando a fala acabou de vez (Cancelar, saiu do app); senão o microfone fica aberto mais um pouco
  const soltar = (x, fecharMicAgora) => {
    if (x && !x.solto) {
      x.solto = true;
      clearTimeout(x.teto); clearTimeout(x.semFala); clearTimeout(x.vigiaAudio);
      try { if (x.proc) { x.proc.onaudioprocess = null; x.proc.disconnect(); } if (x.fonte) x.fonte.disconnect(); } catch (e) {}
    }
    if (fecharMicAgora) fecharMic(); else guardarMic();
  };
  useEffect(() => () => { const x = atual.current; if (x) x.cancelado = true; soltar(x, true); }, []);
  const falhar = (x, msg) => { if (x && x.cancelado) return; setNivel(0); setErro(msg); setEstado("erro"); vibrar("aviso"); };
  const terminar = async (x, manual) => {
    if (!x || x.encerrado) return; x.encerrado = true;
    soltar(x); setNivel(0);
    // ninguém falou: numa conversa, a Bolinha só fica esperando (sem mensagem de erro)
    if (!x.falou && !manual) { if (cb.current.onSilencio && cb.current.onSilencio()) { setEstado("parado"); return; } return falhar(x, "Não ouvi nada. Toque na Bolinha e fale de novo."); }
    setEstado("processando");
    const wav = x.chunks.length ? await montarWav(x, manual) : null;
    if (x.cancelado) return;
    if (!wav) return falhar(x, "Não ouvi nada. Toque na Bolinha e fale de novo.");
    if (!(await permitirIA())) return falhar(x, "Tudo bem: sem a IA, use o microfone do teclado, que funciona igual.");
    if (x.cancelado) return;
    const ctrl = new AbortController(); const tempo = setTimeout(() => ctrl.abort(), 20000);
    try {
      const corpo = JSON.stringify({ audio: paraBase64(wav), prompt: cb.current.prompt || "" });
      // rede instável: tenta mais uma vez sozinho antes de desistir
      let r, j;
      for (let tentativa = 0; ; tentativa++) {
        try {
          r = await fetch(`${servidorAvisos()}/transcrever`, { method: "POST", headers: await cabecalhosIA(), body: corpo, signal: ctrl.signal });
          j = await r.json().catch(() => ({}));
          if (r.status < 500 || tentativa >= 1) break;
        } catch (e) { if (e.name === "AbortError" || tentativa >= 1 || navigator.onLine === false) throw e; }
        if (x.cancelado) return;
        await new Promise(ok => setTimeout(ok, 700));
      }
      if (x.cancelado) return;
      if (j.erro === "limite") return falhar(x, j.nivel === "gratis" ? (noApp ? "As transcrições da IA de hoje acabaram. Amanhã renova; por hoje, use o microfone do teclado: funciona igual." : "As transcrições da IA de hoje acabaram (no Avina Pro é à vontade). Por hoje, use o microfone do teclado: funciona igual.")
        : j.nivel === "anon" ? "Sem entrar na conta, a fala pela IA tem poucos usos por dia. Use o microfone do teclado, ou entre na sua conta." : "Você falou bastante hoje! Por hoje, use o microfone do teclado: funciona igual.");
      if (r.status === 404 || r.status === 501 || j.erro === "sem-ia") { VOZ_SERVIDOR_FALHOU = true; return falhar(x, "Seu servidor ainda não sabe transcrever a fala. No computador, rode de novo: bash servidor-avisos/instalar-avisos.sh. Por enquanto, toque na Bolinha que eu uso a voz do aparelho."); }
      if (!r.ok || !j.ok) throw new Error(j.erro || "HTTP " + r.status);
      const t = limparTranscricao(j.texto);
      if (!t) return falhar(x, "Não entendi. Toque na Bolinha e fale de novo, um pouco mais perto do celular.");
      setEstado("parado"); cb.current.onFinal(t);
    } catch (e) {
      if (x.cancelado) return;
      falhar(x, navigator.onLine === false ? "Sem internet agora. Use o teclado, ou tente de novo quando a conexão voltar."
        : e && e.name === "AbortError" ? "O servidor demorou demais para responder. Toque na Bolinha para tentar de novo."
        : `Não consegui transcrever agora (${String((e && e.message) || e).slice(0, 60)}). Toque na Bolinha para tentar de novo.`);
    } finally { clearTimeout(tempo); }
  };
  // chamado direto no toque: o áudio do iPhone só liga dentro do toque
  const iniciar = () => {
    const velho = atual.current; if (velho) { velho.cancelado = true; soltar(velho); }
    setErro(""); setNivel(0);
    const AC = window.AudioContext || window.webkitAudioContext;
    try { if (!AUDIO_CTX_VOZ || AUDIO_CTX_VOZ.state === "closed") AUDIO_CTX_VOZ = new AC(); if (AUDIO_CTX_VOZ.state !== "running") AUDIO_CTX_VOZ.resume().catch(() => {}); }
    catch (e) { return false; }
    const ctx = AUDIO_CTX_VOZ;
    const x = { chunks: [], fala: [], falou: false, emFala: false, ruido: 0, nRuido: 0, falaMs: 0, silencio: 0, taxa: ctx.sampleRate, msBloco: 4096 / ctx.sampleRate * 1000 };
    atual.current = x; setEstado("ouvindo");
    clearTimeout(MIC.timer);
    const pedir = micVivo() ? Promise.resolve(MIC.stream) : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    pedir.then(stream => {
      MIC.stream = stream;
      if (x.cancelado || x.encerrado) { guardarMic(); return; }
      x.stream = stream;
      // liga o microfone ao medidor de volume; no iPhone o áudio às vezes "congela" quando o microfone abre:
      // se nenhum som chegar em 1,5 s, recria o áudio e liga de novo (uma vez)
      const ligar = c => {
        if (c.state !== "running") c.resume().catch(() => {});
        try { if (x.proc) { x.proc.onaudioprocess = null; x.proc.disconnect(); } if (x.fonte) x.fonte.disconnect(); } catch (e) {}
        const fonte = c.createMediaStreamSource(stream), proc = c.createScriptProcessor(4096, 1, 1);
        x.fonte = fonte; x.proc = proc; x.taxa = c.sampleRate; x.msBloco = 4096 / c.sampleRate * 1000;
        proc.onaudioprocess = processar;
        fonte.connect(proc); proc.connect(c.destination);
      };
      const processar = e => {
        if (x.solto) return;
        const c = new Float32Array(e.inputBuffer.getChannelData(0)); x.chunks.push(c);
        let q = 0; for (let i = 0; i < c.length; i++) q += c[i] * c[i];
        const rms = Math.sqrt(q / c.length);
        // primeiros ~350 ms: mede o barulho do ambiente pelo MENOR volume ouvido
        // (quem já começa falando não engana a medida: entre as sílabas sempre tem um respiro)
        if (x.nRuido < 4) { x.ruido = x.nRuido ? Math.min(x.ruido, rms) : rms; x.nRuido++; x.fala.push(false); setNivel(.08); return; }
        const base = Math.min(Math.max(x.ruido, .0015), .02);
        // para começar a valer como voz precisa de mais volume; para continuar, menos (não corta o fim das palavras)
        const limiar = x.emFala ? Math.max(.004, base * 2) : Math.min(.045, Math.max(.007, base * 3));
        const voz = rms > limiar; x.emFala = voz; x.fala.push(voz);
        // o piso de ruído desce rápido e sobe devagar: acompanha o ambiente sem confundir com a voz
        x.ruido = rms < x.ruido ? x.ruido * .7 + rms * .3 : x.ruido * .985 + rms * .015;
        setNivel(Math.min(1, .08 + rms / (limiar * 5)));
        if (voz) { x.falaMs += x.msBloco; x.silencio = 0; if (!x.falou && x.falaMs >= 160) { x.falou = true; clearTimeout(x.semFala); setEstado("falando"); } }
        else if (x.falou) {
          // frase curta ("gastei…") espera mais pela continuação; frase longa encerra com 1,5 s de silêncio
          x.silencio += x.msBloco;
          if (x.silencio >= (x.falaMs < 1500 ? 2100 : 1500)) terminar(x);
        }
      };
      ligar(ctx);
      x.vigiaAudio = setTimeout(() => {
        if (x.solto || x.chunks.length) return;
        try { const AC2 = window.AudioContext || window.webkitAudioContext; try { ctx.close(); } catch (e) {} AUDIO_CTX_VOZ = new AC2(); ligar(AUDIO_CTX_VOZ); } catch (e) {}
      }, 1500);
      x.semFala = setTimeout(() => { if (!x.falou) terminar(x); }, 8000);
      x.teto = setTimeout(() => terminar(x, true), 25000);
    }).catch(err => {
      if (x.cancelado) return;
      x.encerrado = true; soltar(x);
      const n = err && err.name;
      if (n === "NotAllowedError" || n === "SecurityError") { falhar(x, "O microfone não foi liberado para o app. Toque em Permitir quando o celular perguntar, ou libere em Ajustes do aparelho → Safari/Chrome → Microfone. Enquanto isso, use o microfone do teclado."); cb.current.onFalhou(); }
      else if (n === "NotFoundError") falhar(x, "Não achei microfone neste aparelho.");
      else if (n === "NotReadableError" || n === "AbortError") falhar(x, "O microfone está ocupado por outro app (ligação, gravador…). Feche e tente de novo.");
      else falhar(x, `Não consegui abrir o microfone (${n || "erro"}). Toque na Bolinha de novo.`);
    });
    return true;
  };
  const parar = () => { const x = atual.current; if (x && !x.encerrado) terminar(x, true); };
  const cancelar = () => { const x = atual.current; if (x) { x.cancelado = true; x.encerrado = true; soltar(x); } setNivel(0); setErro(""); setEstado("parado"); };
  return { estado, erro, nivel, iniciar, parar, cancelar };
}

/* ---------- IA no seu servidor (Workers AI da Cloudflare, cota grátis diária) ----------
   - entende frases que o app não entendeu sozinho ("torrei 45 conto no boteco ontem");
   - responde perguntas sobre os seus números ("quanto gastei de Uber em outubro?");
   - lê fotos de comprovante e nota.
   Só funciona com internet e com o servidor de avisos ligado; sem eles, o app segue como antes.
   No plano grátis da Cloudflare, se a cota do dia acabar, a IA só para até o dia seguinte: nunca gera cobrança. */
const iaDisponivel = () => !!servidorAvisos() && navigator.onLine !== false;
const hojeTexto = () => `${todayISO()} (${DIA_LONGO[new Date().getDay()]})`;
async function cabecalhosIA() {
  const h = { "content-type": "application/json" };
  if (LOGADO) try { const { data } = await (await cliente()).auth.getSession(); if (data.session) h.Authorization = `Bearer ${data.session.access_token}`; } catch (e) {}
  return h;
}
async function chamarIA(rota, corpo, ms = 15000) {
  if (!(await permitirIA())) throw new Error("sem-permissao-ia");
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${servidorAvisos()}${rota}`, { method: "POST", headers: await cabecalhosIA(), body: JSON.stringify({ hoje: hojeTexto(), ...corpo }), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (j.erro === "limite") throw new Error(`limite:${j.nivel}`);
    if (r.status === 429 || j.erro === "cota") throw new Error("cota");
    if (!r.ok || !j.ok) throw new Error(j.erro || "HTTP " + r.status);
    return j;
  } catch (e) { throw e && e.name === "AbortError" ? new Error("demorou") : e; }
  finally { clearTimeout(t); }
}
const msgIA = e => {
  const m = String((e && e.message) || e);
  return m === "sem-permissao-ia" ? "Tudo bem: a IA só é usada quando você permite. O resto do app funciona normal."
    : m === "limite:gratis" ? (noApp ? "Você usou as ajudas da IA de hoje. Amanhã renova; o resto do app funciona normal." : "Você usou as ajudas da IA de hoje. Amanhã renova, e no Avina Pro é à vontade. O resto do app funciona normal.")
    : m === "limite:anon" ? "Sem entrar na conta, a IA tem poucos usos por dia. Entre na sua conta para usar mais."
    : m === "limite:pro" ? "Você usou bastante a IA hoje. Amanhã renova; o resto do app funciona normal."
    : m === "cota" ? "A IA já trabalhou bastante hoje (cota grátis do dia). Amanhã ela volta; o resto do app funciona normal."
    : m === "demorou" ? "A IA demorou para responder. Tente de novo em instantes."
    : m === "ilegivel" ? "Não consegui ler o valor nessa foto. Tente uma foto mais de perto, com o valor bem visível."
    : navigator.onLine === false ? "Sem internet agora. Tente de novo quando a conexão voltar."
    : "Não consegui falar com a IA agora. Tente de novo em instantes.";
};
const CATS_IA = () => [...CATEGORIAS, ...CAT_ENTRADA].map(c => c.id);
// O app entendeu a frase sozinho, mas com cara de chute: não sabe onde foi o gasto,
// ou sobrou valor na frase que não virou anotação ("…20 pro flanelinha e 15 na padoca")
function duvidoso(r, t) {
  if (r.tipo !== "gastos") return false;
  if (r.itens.some(i => (i.cat === "outros" || i.cat === "outros-e") && !i.desc)) return true;
  const s = numerosPorExtenso(semAcento(t)).replace(/\d+\s*(?:reais|real)\s*e\s*\d{1,2}(?:\s*centavos?)?/g, "1").replace(/\b(?:dia|as|às)\s+\d+/g, "");
  return (s.match(/\b\d+(?:,\d{1,2})?\b/g) || []).length > r.itens.length;
}
const tituloCurto = s => { const t = String(s || "").trim().slice(0, 40); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
// "quanto gastei de uber?", "quem está devendo?" (só vale quando a frase não virou anotação)
const ehPergunta = t => /\?\s*$/.test(String(t || "")) || /^(quanto|quantos|quantas|qual|quais|quem|quando|onde|como|o que|oque|por que|porque|sera que|me (diz|fala|mostra|conta|lembra)|tenho|tem algum|tem alguma|ja paguei|estou|devo|posso|consigo|preciso)\b/.test(semAcento(String(t || "")).trim());
// Pergunta sem dúvida (termina com "?" ou começa com quanto, quais, quem…): vale antes de tentar anotar, senão o número
// da pergunta vira gasto ("quanto gastei nos últimos 3 meses?" virava R$ 3,00). "Tenho", "devo", "preciso"… começam
// anotações também, então continuam valendo só quando a frase não virou anotação (ehPergunta).
const perguntaClara = t => /\?\s*$/.test(String(t || "")) || /^(quanto|quantos|quantas|qual|quais|quem|quando|onde|como|o que|oque|por que|porque|sera que|me (diz|fala|mostra|conta|lembra))\b/.test(semAcento(String(t || "")).trim());

// Pede à IA para transformar a frase em anotação; confere tudo aqui antes de usar
async function entenderIA(texto, db) {
  const ativos = db.patients.filter(p => p.active);
  const j = await chamarIA("/entender", { texto, categorias: CATS_IA(), pacientes: [...new Set(ativos.map(p => primeiro(p.name)))] }, 12000);
  const d = j.dados || {};
  if (d.tipo === "pergunta") return { tipo: "pergunta" };
  if (d.tipo === "consultorio" && d.consultorio) {
    const c = d.consultorio, p = acharPaciente(` ${semAcento(String(c.paciente || ""))} `, db);
    if (!p || !["veio", "falta", "pagou", "remarcar"].includes(c.acao)) return null;
    if (c.acao === "remarcar") {
      const data = /^\d{4}-\d{2}-\d{2}$/.test(c.data || "") && c.data >= todayISO() ? c.data : null;
      const hora = /^\d{1,2}:\d{2}$/.test(c.hora || "") ? c.hora.padStart(5, "0") : null;
      if (!data && !hora) return null;
      return { tipo: "consult", c: { acao: "remarcar", p, data: data || p.nextDate, hora: hora || p.time, ok: true } };
    }
    return { tipo: "consult", c: { acao: c.acao, p, pago: c.acao === "veio" && !!c.pagou, ok: true } };
  }
  if (d.tipo === "gastos" && Array.isArray(d.itens)) {
    const itens = d.itens.slice(0, 10).map(it => {
      const tipo = it.tipo === "entrada" ? "entrada" : "saida";
      const lista = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
      const desc0 = String(it.descricao || "").trim();
      const marca = desc0 ? acharMarca(desc0) : null;
      let cat = lista.some(c => c.id === it.categoria) ? it.categoria : tipo === "entrada" ? "outros-e" : "outros";
      if (marca && tipo === "saida" && CATEGORIAS.some(c => c.id === marca.cat)) cat = marca.cat;
      return { tipo, valor: Math.round(Number(it.valor) * 100) / 100, cat, desc: marca ? marca.nome : tituloCurto(desc0), off: Math.max(0, Math.min(60, Math.round(Number(it.dias_atras) || 0))), marca: marca ? marca.id : null };
    }).filter(i => i.valor > 0 && i.valor < 1e6);
    if (itens.length) return { tipo: "gastos", itens };
  }
  return null;
}

// Resumo dos seus números para a IA responder perguntas (só primeiros nomes dos pacientes; nada fica guardado no servidor)
function contextoPergunta(db, usaPessoal) {
  const L = [], hoje = todayISO(), mesAt = hoje.slice(0, 7), r = brlReal;
  const meses = []; { const d = fromISO(hoje); for (let i = 0; i < 6; i++) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); meses.push(`${m.getFullYear()}-${pad(m.getMonth() + 1)}`); } }
  const nomeMes = ch => `${MES_LONGO[Number(ch.slice(5)) - 1]} de ${ch.slice(0, 4)}`;
  const nomeP = id => { const p = db.patients.find(x => x.id === id); return p ? primeiro(p.name) : "?"; };
  if (db.patients.length) {
    L.push("## CONSULTÓRIO");
    meses.slice(0, 4).forEach(ch => {
      const ses = db.sessions.filter(s => s.date.startsWith(ch));
      L.push(`${nomeMes(ch)}: ${ses.filter(s => s.status === "done").length} sessões atendidas, ${ses.filter(s => s.status === "missed").length} faltas, líquido ${r(liquidoMes(db, ch))}`);
    });
    const abertas = db.charges.filter(c => !c.paid && !c.hidden);
    L.push(`Pagamentos em aberto (pacientes devendo): ${abertas.length ? abertas.map(c => `${nomeP(c.patientId)} ${r(c.amount)} desde ${dm(c.createdAt)}`).join("; ") : "nenhum"}`);
    L.push("Pacientes ativos:");
    db.patients.filter(p => p.active).forEach(p => {
      const doMes = db.sessions.filter(s => s.patientId === p.id && s.date.startsWith(mesAt));
      L.push(`- ${primeiro(p.name)}: sessão ${r(p.price)}, a cada ${p.freq} dias, próxima ${p.nextDate ? `${diaCurto(p.nextDate)} às ${p.time}` : "sem data"}; no mês ${doMes.filter(s => s.status === "done").length} sessões e ${doMes.filter(s => s.status === "missed").length} faltas`);
    });
    const ag = [];
    for (let i = 0; i < 8; i++) { const iso = addDays(hoje, i), its = itensDoDia(db, iso).filter(x => x.kind === "next" || x.kind === "proj"); if (its.length) ag.push(`${diaCurto(iso)}: ${its.map(x => `${x.time} ${primeiro(x.patient.name)}`).join(", ")}`); }
    L.push(`Agenda dos próximos dias: ${ag.length ? ag.join(" | ") : "sem sessões marcadas"}`);
  }
  const P = db.pessoal;
  if (usaPessoal && P) {
    L.push("## PESSOAL (casa)");
    meses.slice(0, 4).forEach(ch => {
      const ls = P.lanc.filter(l => l.data.startsWith(ch)); if (!ls.length) return;
      const sai = ls.filter(l => l.tipo === "saida"), ent = ls.filter(l => l.tipo === "entrada"), porCat = {}, porLoja = {};
      sai.forEach(l => { porCat[l.cat] = (porCat[l.cat] || 0) + l.valor; const k = l.desc || catDe(l.cat).nome; porLoja[k] = porLoja[k] || [0, 0]; porLoja[k][0] += l.valor; porLoja[k][1]++; });
      L.push(`${nomeMes(ch)}: entrou ${r(soma(ent, l => l.valor))}, saiu ${r(soma(sai, l => l.valor))} (fora as contas fixas)`);
      L.push(`  por categoria: ${Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${catDe(c).nome} ${r(v)}`).join("; ") || "nada"}`);
      L.push(`  por loja: ${Object.entries(porLoja).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10).map(([k, [v, n]]) => `${k} ${r(v)} (${n}x)`).join("; ")}`);
    });
    const rec = P.lanc.filter(l => l.data >= addDays(hoje, -30)).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 60);
    if (rec.length) L.push(`Lançamentos dos últimos 45 dias: ${rec.map(l => `${dm(l.data)} ${l.tipo === "entrada" ? "+" : "-"}${r(l.valor)} ${l.desc || catDe(l.cat).nome} [${catDe(l.cat).nome}]`).join("; ")}`);
    L.push(`Contas fixas (todo mês): ${P.contas.map(c => `${c.nome} ${r(c.valor)} dia ${c.dia}, ${c.pagas && c.pagas[mesAt] ? "paga este mês" : "não paga este mês"}${c.assinatura ? ", assinatura" : ""}`).join("; ") || "nenhuma"}`);
    if ((P.caixinhas || []).length) L.push(`Caixinhas: ${P.caixinhas.map(x => `${x.nome} guardado ${r(soma(x.movs || [], m => m.valor))}${x.meta ? ` de ${r(x.meta)}` : ""}`).join("; ")}`);
    const tet = Object.entries(P.limites || {}).filter(([, v]) => v > 0);
    if (tet.length) { const g = gastoPorCat(db, mesAt); L.push(`Tetos do mês por categoria: ${tet.map(([c, v]) => `${catDe(c).nome} teto ${r(v)}, gasto ${r(g[c] || 0)}`).join("; ")}`); }
  }
  return L.join("\n").slice(0, 16000);
}

// Dica para o Whisper: exemplos, nomes dos pacientes e as lojas que você mais usa (até ~680 letras)
function dicaWhisper(db) {
  let s = "Anotação falada em português do Brasil, sobre gastos, entradas ou atendimentos. Exemplos: Gastei R$ 30 no Uber. Comprei R$ 54,90 no iFood e R$ 120 na Amazon. Recebi R$ 200 de Pix. Felipe veio e pagou. A Ana faltou. Remarca o Pedro pra quinta às 15h. Quanto gastei no mercado este mês?";
  const nomes = [...new Set(db.patients.filter(p => p.active).map(p => primeiro(p.name)))];
  // só nomes curtos (até 2 palavras): "Drogasil", "Pão de Açúcar" sim; "Compra da semana" não ajuda
  const vezes = {}; ((db.pessoal && db.pessoal.lanc) || []).forEach(l => { if (l.desc && l.desc.length <= 24 && l.desc.trim().split(/\s+/).length <= 2 && l.data >= addDays(todayISO(), -120)) vezes[l.desc] = (vezes[l.desc] || 0) + 1; });
  const lojas = Object.entries(vezes).sort((a, b) => b[1] - a[1]).slice(0, 15).map(x => x[0]);
  const juntar = (rot, lista) => { let out = ""; for (const n of lista) { const prox = out ? `${out}, ${n}` : n; if ((s + ` ${rot}: ${prox}.`).length > 680) break; out = prox; } if (out) s += ` ${rot}: ${out}.`; };
  juntar("Nomes", nomes); juntar("Lojas", lojas);
  return s;
}

// Foto de comprovante ou nota -> lançamento pronto para conferir
async function fotoParaIA(file) {
  const url = await lerArquivo(file);
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .82);
}
async function lerComprovante(file) {
  const j = await chamarIA("/ler-imagem", { imagem: await fotoParaIA(file), categorias: CATS_IA() }, 30000);
  const d = j.dados || {}, valor = Math.round(Number(d.valor) * 100) / 100;
  if (!(valor > 0 && valor < 1e6)) throw new Error("ilegivel");
  const tipo = d.tipo === "entrada" ? "entrada" : "saida", lista = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
  const desc0 = String(d.descricao || "").trim(), marca = desc0 ? acharMarca(desc0) : null;
  let cat = lista.some(c => c.id === d.categoria) ? d.categoria : null;
  if (marca && tipo === "saida" && CATEGORIAS.some(c => c.id === marca.cat)) cat = marca.cat;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(d.data || "") && d.data <= todayISO() && d.data >= addDays(todayISO(), -400) ? d.data : todayISO();
  let desc = marca ? marca.nome : tituloCurto(desc0), catLoja = null;
  // sem marca conhecida, o CNPJ do comprovante (quando aparece) diz o nome da loja e o ramo dela (BrasilAPI).
  // (cnpj.js e nota.js vêm só aqui, quando precisam: não pesam na abertura do app)
  const { cnpjValido, buscarCnpj } = d.cnpj ? await import("./cnpj.js").catch(() => ({})) : {};
  if (cnpjValido && cnpjValido(d.cnpj)) {
    const q = await buscarCnpj(d.cnpj, 4000).catch(() => null);
    if (q) { catLoja = q.catLoja; if (!marca) { desc = q.nome; if (tipo === "saida" && q.cat) cat = q.cat; } }
  }
  return { tipo, valor, cat, desc, data, pagador: String(d.pagador || "").trim().slice(0, 60), catLoja };
}

// Pix recebido → as cobranças em aberto que ele paga. Por paciente: o mesmo nome de quem pagou
// (ou de quem costuma pagar por ele) e/ou o valor batendo com as cobranças mais antigas.
function cobrancasDoPix(db, pre) {
  const ws = semAcento(pre.pagador || "").replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !["dos", "das"].includes(w));
  const bateNome = p => ws.length > 0 && [p.name, p.pagadorNome].filter(Boolean).some(n => {
    const nw = semAcento(n).split(/\s+/);
    return nw[0] === ws[0] || ws.filter(w => nw.includes(w)).length >= 2;
  });
  const quase = (a, b) => Math.abs(a - b) < 0.01;
  const grupos = [];
  db.patients.forEach(p => {
    const abertas = db.charges.filter(c => c.patientId === p.id && !c.paid && !c.hidden).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!abertas.length) return;
    // as mais antigas que somam o valor do Pix (uma sessão, duas, o pacote…); senão, uma com o valor exato
    let acum = 0, ids = null;
    for (let i = 0; i < abertas.length && !ids; i++) { acum += abertas[i].amount; if (quase(acum, pre.valor)) ids = abertas.slice(0, i + 1).map(c => c.id); }
    if (!ids) { const uma = abertas.find(c => quase(c.amount, pre.valor)); if (uma) ids = [uma.id]; }
    const nome = bateNome(p);
    if (!ids && !nome) return;
    grupos.push({ pid: p.id, ids: ids || [], abertas: abertas.length, total: ids ? pre.valor : soma(abertas, c => c.amount), desde: abertas[0].createdAt, nota: (ids ? 2 : 0) + (nome ? 3 : 0) });
  });
  return grupos.sort((a, b) => b.nota - a.nota || a.desde.localeCompare(b.desde)).slice(0, 4);
}

/* ---------- A Bolinha responde falando ----------
   Voz do próprio aparelho (grátis e sem internet), escolhendo a mais natural que existir:
   "Natural/Online" no Edge, Google no Android e no Chrome, "Melhorada/Premium" no iPhone.
   O texto é preparado para soar falado: "R$ 286,40" vira "286 reais e 40 centavos", "21/10" vira "21 de outubro". */
const K_FALA_RESP = "agenda-fala-resposta"; // false: as respostas só aparecem escritas
const falaLigada = () => lerJSON(K_FALA_RESP, true) !== false && "speechSynthesis" in window;
const VOZ_RESP = { voz: null };
function escolherVoz() {
  const s = window.speechSynthesis; if (!s) return null;
  const vs = s.getVoices(); if (!vs.length) return null;
  const br = vs.filter(v => /^pt[-_]BR/i.test(v.lang)), lista = br.length ? br : vs.filter(v => /^pt/i.test(v.lang));
  const nota = v => (/natural|neural|online|premium|enhanced|melhorad|aprimorad/i.test(v.name) ? 20 : 0) + (/google/i.test(v.name) ? 12 : 0)
    + (/francisca|thalita|luciana|vit[oó]ria|camila|fernanda/i.test(v.name) ? 3 : 0) + (v.localService ? 0 : 2) + (v.default ? 1 : 0);
  return lista.sort((a, b) => nota(b) - nota(a))[0] || null;
}
try { if (window.speechSynthesis) { const f = () => { VOZ_RESP.voz = escolherVoz(); }; f(); window.speechSynthesis.addEventListener("voiceschanged", f); } } catch (e) {}
function paraFala(t) {
  return String(t || "")
    .replace(/R\$\s?([\d.]+),(\d{2})/g, (m, r, c) => `${r.replace(/\./g, "")} reais${c === "00" ? "" : ` e ${Number(c)} centavos`}`)
    .replace(/R\$\s?([\d.]+)/g, (m, r) => `${r.replace(/\./g, "")} reais`)
    .replace(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g, (m, d, mm) => (Number(mm) >= 1 && Number(mm) <= 12 ? `${Number(d)} de ${MES_LONGO[Number(mm) - 1]}` : m))
    .replace(/(\d+)\s?%/g, "$1 por cento").replace(/\bhs?\b/g, "horas")
    .replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim();
}
// Fala em frases curtas (o Chrome corta falas longas no meio). Devolve uma função que para na hora.
function falarResposta(texto, aoFim) {
  const s = window.speechSynthesis;
  if (!s) { if (aoFim) aoFim(); return () => {}; }
  try { s.cancel(); } catch (e) {}
  const frases = paraFala(texto).match(/[^.!?;]+[.!?;]*/g) || [];
  let parou = false, i = 0;
  const prox = () => {
    if (parou) return;
    if (i >= frases.length) { if (aoFim) aoFim(); return; }
    const u = new SpeechSynthesisUtterance(frases[i++].trim());
    u.lang = "pt-BR"; if (VOZ_RESP.voz) u.voice = VOZ_RESP.voz; u.rate = 1.03; u.pitch = 1;
    u.onend = prox; u.onerror = () => prox();
    s.speak(u);
  };
  prox();
  return () => { parou = true; try { s.cancel(); } catch (e) {} };
}
// o iPhone só deixa falar depois de um toque: uma fala vazia, no toque, libera as próximas
const destravarFala = () => { try { const s = window.speechSynthesis; if (s && !destravarFala.ok) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; s.speak(u); destravarFala.ok = true; } } catch (e) {} };
const FIM_CONVERSA = /^\s*(obrigad[oa]|valeu|tchau|so isso|era so isso|nada nao|nao obrigad[oa]|beleza|ta bom|tudo bem|ok|certo|entendi)\b[\s\S]{0,20}$/;

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
  if (noApp) return chamarApp("avisos:mostrar", { titulo, corpo, pedir: !!pedir }).catch(() => "bloqueado");
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
   Por padrão o texto não leva o nome do paciente (aparece na tela bloqueada).
   No app de celular (app-celular/) não tem servidor no meio: a mesma lista vai para o próprio aparelho, que agenda
   cada aviso como notificação do celular (funciona até sem internet). */
// O endereço é público (não é segredo). A variável AVISOS_URL do GitHub, se existir, tem prioridade.
const AVISOS_URL_PADRAO = String(import.meta.env.VITE_AVISOS_URL || "https://agenda-avisos.alvena.workers.dev").trim().replace(/\/+$/, "");
const K_PUSH = "agenda-push";         // { ligado, id do aparelho, chave do servidor, último envio }
const K_PUSH_URL = "agenda-push-url"; // endereço do servidor colado à mão (se o GitHub não preencheu)
const servidorAvisos = () => String(lerJSON(K_PUSH_URL, "") || AVISOS_URL_PADRAO).trim().replace(/\/+$/, "");
const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const appInstalado = () => noApp || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const pushSuportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const pushLigado = () => !!lerJSON(K_PUSH, {}).ligado && !!servidorAvisos();
const b64uBytes = s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const bytesB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const comPrazo = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("tempo")), ms))]);

// O que impede de ligar ("" = pode ligar)
function motivoSemPush() {
  if (noApp) return "";
  if (!servidorAvisos()) return "servidor";
  if (ehIOS() && !appInstalado()) return "instalar";
  if (!pushSuportado()) return "indisponivel";
  if (Notification.permission === "denied") return "negado";
  return "";
}
async function inscreverPush(pedir) {
  if (noApp) { // a permissão é a do celular ("ok", "permissao" ou "negado")
    const r = await chamarApp("avisos:permissao", { pedir: !!pedir });
    if (r !== "ok") throw new Error(r);
    const id = lerJSON(K_PUSH, {}).id || uid() + uid();
    gravar(K_PUSH, { ...lerJSON(K_PUSH, {}), id });
    return { id, sub: null };
  }
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
  if (usaPessoal) { const vs = veiculosDe(db); vs.forEach(vc => { const docs = vc.docs || {}, de = vs.length > 1 && vc.nome ? ` (${vc.nome})` : ""; [["ipva", "IPVA"], ["licenc", "Licenciamento"], ["seguro", "Seguro"]].forEach(([k, n]) => {
    const d = docs[k]; if (!d || !d.data) return;
    const val = d.valor ? ` · ${brlReal(d.valor)}` : "";
    add(quando(addDays(d.data, -7), "09:00"), `${n}${de} vence em uma semana`, `Dia ${dm(d.data)}${val}. Toque para ver no Transporte.`, `v-${vc.id}-${k}`);
    add(quando(d.data, "09:00"), `${n}${de} vence hoje`, `Já pagou? Marque em Transporte${val}.`, `v-${vc.id}-${k}`);
  }); }); }
  // Resumo da semana: domingo às 20h. Os números vão até a última vez que o app mandou a lista
  // (e ele manda de novo a cada mudança), então chega com a semana inteira.
  if (av.semana !== false) {
    const dom = addDays(hoje, (7 - fromISO(hoje).getDay()) % 7), s = resumoSemana(db, dom, usaPessoal);
    add(quando(dom, "20:00"), s.titulo, s.corpo, "semana");
  }
  return lista.sort((a, b) => a.t - b.t).slice(0, 200);
}
// O texto do resumo da semana (segunda a domingo). Sem nomes de pacientes: aparece na tela bloqueada.
function resumoSemana(db, dom, usaPessoal) {
  const seg = addDays(dom, -6), dentro = d => d >= seg && d <= dom, R = v => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  const partes = [];
  const ses = db.sessions.filter(s => dentro(s.date)), feitas = ses.filter(s => s.status === "done").length, faltas = ses.filter(s => s.status === "missed").length;
  let liq = 0; for (let d = seg; d <= dom; d = addDays(d, 1)) liq += liquidoDia(db, d);
  if (feitas || faltas) partes.push(`${feitas} ${feitas === 1 ? "sessão" : "sessões"}${faltas ? ` e ${faltas} ${faltas === 1 ? "falta" : "faltas"}` : ""}, ${R(liq)} líquidos.`);
  const abertas = db.charges.filter(c => !c.paid && !c.hidden);
  if (abertas.length) { const n = new Set(abertas.map(c => c.patientId)).size; partes.push(`Falta receber ${R(soma(abertas, c => c.amount))}${n > 1 ? ` de ${n} ${TERMO.p}` : ""}.`); }
  if (usaPessoal && db.pessoal) {
    const ls = db.pessoal.lanc.filter(l => dentro(l.data)), sai = soma(ls.filter(l => l.tipo === "saida"), l => l.valor), ent = soma(ls.filter(l => l.tipo === "entrada"), l => l.valor);
    if (sai || ent) partes.push(`Casa: saiu ${R(sai)}${ent ? `, entrou ${R(ent)}` : ""}.`);
    const prox = [];
    for (let i = 1; i <= 7; i++) { const iso = addDays(dom, i), ch = iso.slice(0, 7); db.pessoal.contas.forEach(c => { if (vencimento(c, ch) === iso && !(c.pagas && c.pagas[ch])) prox.push(c.nome); }); }
    if (prox.length) partes.push(`Vencem: ${prox.slice(0, 3).join(", ")}${prox.length > 3 ? ` e mais ${prox.length - 3}` : ""}.`);
    const tet = tetosAlerta(db, dom.slice(0, 7))[0];
    if (tet) partes.push(`${catDe(tet.cat).nome}: ${Math.round(tet.pct * 100)}% do teto.`);
  }
  while (partes.length > 1 && partes.join(" ").length > 178) partes.pop();
  return { titulo: "Resumo da sua semana", corpo: partes.join(" ").slice(0, 180) || "Semana tranquila, nada anotado. Bom descanso!" };
}

/* =========================================================
   6. ÍCONES
   ========================================================= */
const Svg = ({ children, sw = 1.8 }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
// Logo da Avina: um A de fita só (sobe, curva no topo, desce a haste; a travessa é um laço pela esquerda)
const Marca = () => (
  <svg viewBox="97 105 300 300" aria-hidden="true">
    <path d="M338 380V176Q338 128 300 128Q274 128 260 158L196 300Q180 336 152 334Q128 332 134 302Q146 258 214 248Q296 238 338 300" fill="none" stroke="#1F3BEF" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const I = {
  home: () => <Svg><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z"/></Svg>,
  cal: () => <Svg><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></Svg>,
  grid: () => <Svg><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></Svg>,
  users: () => <Svg><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.8 2.4 3 5.2"/></Svg>,
  wallet: () => <Svg><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16.5 15h1"/><path d="M6 6l9-3 1.5 3"/></Svg>,
  plus: () => <Svg sw={2.2}><path d="M12 5v14M5 12h14"/></Svg>,
  x: () => <Svg sw={2.2}><path d="M6 6l12 12M18 6L6 18"/></Svg>,
  trash: () => <Svg><path d="M4 7h16M9.5 7V4.5h5V7"/><path d="M6.5 7l.9 11.6A2 2 0 0 0 9.4 20.5h5.2a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/></Svg>,
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
  // Versões cheias dos ícones da barra de baixo (aparecem na aba que está aberta, como no app do Xbox)
  homeOn: () => <Svg><path fill="currentColor" stroke="none" d="M12 3.2c.4 0 .8.1 1.1.4l7 5.7c.6.5.9 1.2.9 1.9v7.8A2 2 0 0 1 19 21h-4.2v-5.5a1.3 1.3 0 0 0-1.3-1.3h-3a1.3 1.3 0 0 0-1.3 1.3V21H5a2 2 0 0 1-2-2v-7.8c0-.7.3-1.4.9-1.9l7-5.7c.3-.3.7-.4 1.1-.4z"/></Svg>,
  calOn: () => <Svg><path fill="currentColor" stroke="none" fillRule="evenodd" d="M6.5 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM7 11.5v2h2v-2zM11 11.5v2h2v-2zM15 11.5v2h2v-2zM7 15.5v2h2v-2zM11 15.5v2h2v-2z"/><path d="M8 3v3M16 3v3"/></Svg>,
  usersOn: () => <Svg><circle cx="9" cy="8" r="3.5" fill="currentColor"/><path fill="currentColor" d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5z"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.8 2.4 3 5.2"/></Svg>,
  walletOn: () => <Svg><path d="M6 6l9-3 1.5 3"/><path fill="currentColor" stroke="none" fillRule="evenodd" d="M6 5.2h12a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.2a3 3 0 0 1 3-3zM15.5 13.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z"/></Svg>,
  chartOn: () => <Svg><rect x="2.8" y="10" width="3.4" height="10.5" rx="1.2" fill="currentColor" stroke="none"/><rect x="8.3" y="3.5" width="3.4" height="17" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="12.5" width="3.4" height="8" rx="1.2" fill="currentColor" stroke="none"/><rect x="19.3" y="7" width="2.4" height="13.5" rx="1.1" fill="currentColor" stroke="none"/></Svg>,
  billOn: () => <Svg><path fill="currentColor" stroke="none" fillRule="evenodd" d="M7 3h10a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM8 7.2v1.6h8V7.2zM8 11.2v1.6h8v-1.6zM8 15.2v1.6h4v-1.6z"/></Svg>,
  bill: () => <Svg><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></Svg>,
  cart: () => <Svg><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></Svg>,
  car: () => <Svg><path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2.5M20 16v2.5"/><circle cx="7.5" cy="13.5" r=".8"/><circle cx="16.5" cy="13.5" r=".8"/></Svg>,
  carOn: () => <Svg><path fill="currentColor" stroke="none" fillRule="evenodd" d="M6.9 5.5h10.2a1.5 1.5 0 0 1 1.4.94l1.9 4.76c.4.36.6.86.6 1.4V17a1 1 0 0 1-1 1h-.5v1.2a1 1 0 0 1-2 0V18H6.5v1.2a1 1 0 0 1-2 0V18H4a1 1 0 0 1-1-1v-4.4c0-.54.2-1.04.6-1.4L5.5 6.44a1.5 1.5 0 0 1 1.4-.94zM6.2 10.5h11.6l-1.3-3.2H7.5zM7.5 15.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm9 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z"/></Svg>,
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
  sound: () => <Svg><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></Svg>,
  camera: () => <Svg><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/></Svg>,
  scan: () => <Svg><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 8v8M10 8v8M12.5 8v8M15 8v8M16.5 8v8"/></Svg>,
  upload: () => <Svg><path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4.5 14v4.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V14"/></Svg>,
  gauge: () => <Svg><path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13l3.5-4"/><circle cx="12" cy="13" r="1.2"/></Svg>,
};
const CatIcon = ({ cat }) => { const C = (cat && I[cat.ic]) || I.more; return <C />; };

/* =========================================================
   7. PEÇAS REUTILIZÁVEIS
   ========================================================= */
function Money({ v, cls = "" }) {
  if (ESCONDER) return <span className={"mny " + cls}><span className="cur">R$</span>•••<span className="cents">,••</span></span>;
  const neg = v < 0, [i, c] = Math.abs(Number(v) || 0).toFixed(2).split(".");
  return <span className={"mny " + cls}><span className="cur">R$</span>{neg ? "−" : ""}{Number(i).toLocaleString("pt-BR")}<span className="cents">,{c}</span></span>;
}
// Clima de agora + chuva perto da próxima sessão
const horaDe = ms => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
function WeatherChip({ cidade, act, sessao }) {
  if (!cidade && !climaLocal()) return <button className="wx btn-like" onClick={() => act.openSettings("dados")}><I.cloud /><span>Defina sua cidade para ver a chuva</span></button>;
  if (CLIMA === "erro") return <button className="wx btn-like" onClick={act.abrirClima}><I.cloud /><span className="r" style={{ color: "var(--muted)" }}>Clima indisponível agora · toque para tentar</span></button>;
  if (!CLIMA || !CLIMA.atual) return <span className="wx"><I.cloud /><span className="r" style={{ color: "var(--muted)" }}>Buscando o clima…</span></span>;
  const now = new Date(), a = CLIMA.atual;
  const Ic = I[iconeClima(a.code, a.dia)];
  const ch = sessao ? chuvaPerto(todayISO(), sessao.time) : null;
  let prox = null;
  if (!ch) for (let h = now.getHours() + 1; h < 24; h++) { const x = climaHora(todayISO(), h); if (x && x.p >= 50) { prox = { p: x.p, h }; break; } }
  return (
    <button className="wx btn-like ok" onClick={act.abrirClima} aria-label={`Clima: ${a.temp} graus, ${TEMPO_TXT(a.code)}. Ver a previsão`}>
      <Ic /><span className="t num">{a.temp}°</span>
      <span className="r">{a.code >= 51 && a.code < 95 ? `chovendo agora · ${CLIMA.cidade}` : ch ? `chuva ${ch.p}% perto das ${ch.h}h` : prox ? `chuva ${prox.p}% às ${prox.h}h` : `sem chuva hoje · ${CLIMA.cidade}`}</span>
      {CLIMA.velho && <span className="ex">{horaDe(CLIMA.em)}</span>}
    </button>
  );
}

// Previsão em detalhe: agora, o dia e as próximas 12 horas. Dá para trocar para a localização do aparelho.
function ClimaSheet({ clima, cidade, act, onClose }) {
  const [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const usarLocal = async () => {
    setBusy(true); setErro("");
    try { await pedirLocalizacao(); await act.recarregarClima(); }
    catch (e) { setErro(e.message === "negado" ? "A localização não foi liberada. Libere nas configurações do aparelho, ou continue com a cidade do perfil." : "Não consegui pegar a localização agora. Tente de novo em instantes."); }
    setBusy(false);
  };
  const usarCidade = async () => { try { localStorage.removeItem(K_CLIMA_LOCAL); } catch (e) {} setBusy(true); await act.recarregarClima(); setBusy(false); };
  const ok = clima && clima !== "erro" && clima.atual;
  const a = ok ? clima.atual : null, Ic = a ? I[iconeClima(a.code, a.dia)] : I.cloud;
  const h0 = `${todayISO()}T${pad(new Date().getHours())}:00`;
  const prox = ok ? clima.horas.filter(h => h.t >= h0).slice(0, 12) : [];
  return (
    <Sheet title={ok ? clima.lugar || clima.cidade : "Clima"} sub={ok ? `Open-Meteo · atualizado às ${horaDe(clima.em)}${clima.velho ? " · sem internet agora" : ""}` : "Previsão indisponível agora"} onClose={onClose}>
      {ok ? <>
        <div className="clima-agora">
          <span className="clima-ic"><Ic /></span>
          <b className="num">{a.temp}°</b>
          <span className="clima-tx"><b>{TEMPO_TXT(a.code)}</b><small>Sensação de {a.sens}° · umidade {a.umid}% · vento {a.vento} km/h</small></span>
        </div>
        <div className="clima-dia">
          <span><small>Hoje</small><b>{clima.hoje.min}° a {clima.hoje.max}°</b></span>
          <span><small>Chuva</small><b>até {clima.hoje.p}%</b></span>
          <span><small>Sol</small><b>{clima.hoje.sol[0]} – {clima.hoje.sol[1]}</b></span>
        </div>
        <div className="clima-horas" role="list" aria-label="Próximas horas">
          {prox.map((h, i) => { const HI = I[iconeClima(h.code, h.dia)]; return (
            <div key={h.t} role="listitem" className={h.p >= 50 ? "chuva" : ""}><small>{i === 0 ? "Agora" : `${h.t.slice(11, 13)}h`}</small><HI /><b className="num">{h.temp}°</b><small>{h.p}%</small></div>
          ); })}
        </div>
      </> : <div className="empty">Não consegui buscar a previsão. Confira a internet e tente de novo.</div>}
      {erro && <div className="error">{erro}</div>}
      {ok && clima.local
        ? <button className="btn ghost" disabled={busy} onClick={usarCidade}>{cidade ? `Usar a cidade do perfil (${cidade})` : "Usar a cidade do perfil"}</button>
        : <button className="btn ghost" disabled={busy} onClick={usarLocal}><I.target /> {busy ? "Buscando…" : "Usar minha localização (mais preciso)"}</button>}
      {!ok && <button className="btn mode" disabled={busy} onClick={async () => { setBusy(true); await act.recarregarClima(); setBusy(false); }}>Tentar de novo</button>}
    </Sheet>
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
const Cropper = lazy(() => import("./telas/recorte.jsx").then(m => ({ default: m.Cropper })));

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
        <label htmlFor="foto-in">{foto && !ehAvatarPronto(foto) ? "Trocar foto" : "Usar uma foto minha"}</label>
        <input id="foto-in" className="sr" type="file" accept="image/*" onChange={escolher} />
        {foto && !ehAvatarPronto(foto) && <button type="button" onClick={() => setRecortar(foto)}>Ajustar enquadramento</button>}
        {foto && <button type="button" className="rm" onClick={() => onChange(null)}>Remover foto</button>}
        {erro && <span className="error" style={{ padding: 0 }}>{erro}</span>}
      </div>
      <div className="avatares" role="radiogroup" aria-label="Ou escolha uma bolinha">
        <span>Ou escolha uma bolinha:</span>
        {AVATARES.map(a => (
          <button key={a.id} type="button" role="radio" aria-checked={foto === a.url} aria-label={`Bolinha ${a.nome.toLowerCase()}`} className={"avatar-op" + (foto === a.url ? " on" : "")} onClick={() => { vibrar("toque"); onChange(a.url); }}>
            <img src={a.url} alt="" />
          </button>
        ))}
      </div>
      {recortar && <Suspense fallback={null}><Cropper src={recortar} forma="circulo" titulo="Foto de perfil" onCancel={() => setRecortar(null)} onDone={url => { onChange(url); setRecortar(null); }} /></Suspense>}
    </div>
  );
}

function CalBadge({ iso }) {
  const d = fromISO(iso);
  return <span className="calb" aria-hidden="true"><b>{MES_CURTO[d.getMonth()]}</b><i>{d.getDate()}</i></span>;
}

const semMovimento = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const SAIDA_MS = 200;

/* ---------- Painéis com jeito de app nativo ----------
   - O botão (ou gesto) de voltar do Android fecha o painel de cima, e não o app.
   - Com um painel aberto, a tela de trás recua um pouco (como no iPhone) e a barra de status escurece junto.
   - A cor da barra de status acompanha o tema escolhido no app (claro ou escuro). */
// Uma só entrada "de guarda" no histórico enquanto houver algo aberto: o voltar fecha a camada de cima
// e a guarda volta se ainda sobrar alguma. (Uma entrada por camada dá errado quando uma fecha e outra abre juntas.)
const CAMADAS = [];
let ignorarVolta = 0, guarda = false, tVolta = 0;
const vivas = () => CAMADAS.filter(c => !c.voltou).length;
const porGuarda = () => { if (guarda) return; try { history.pushState({ alvenaGuarda: 1 }, ""); guarda = true; } catch (e) {} };
// a cor da névoa, lida uma vez por tema: ler o estilo a cada painel que abre forçava recalcular a página inteira
let NEVOA = null;
function corDaBarra(temaMudou) {
  try {
    // a barra de status fica sempre escura, na cor da névoa do topo (combina com ela nos dois temas)
    if (!NEVOA || temaMudou === true) {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--topo-nevoa").trim();
      const m = /^#([\da-f]{6})$/i.test(v) ? [0, 2, 4].map(i => parseInt(v.slice(1 + i, 3 + i), 16)) : (v.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      if (m.length < 3) return;
      NEVOA = m;
    }
    const m = NEVOA, k = CAMADAS.some(c => c.escurece) ? .42 : 1;
    const hex = "#" + m.map(x => Math.round(x * k).toString(16).padStart(2, "0")).join("");
    document.querySelectorAll('meta[name="theme-color"]').forEach(el => { el.setAttribute("content", hex); el.removeAttribute("media"); });
  } catch (e) {}
}
function mudouCamadas() {
  const raiz = document.documentElement, recua = CAMADAS.some(c => c.recua);
  if (recua && !raiz.classList.contains("com-camada")) raiz.style.setProperty("--recuo-y", `${Math.round(window.scrollY + window.innerHeight / 2)}px`);
  raiz.classList.toggle("com-camada", recua);
  corDaBarra();
  clearTimeout(tVolta);
  if (vivas()) porGuarda();
  // tudo fechou pelo app (X, arrastar, salvar): tira a guarda, mas só se nada abrir logo em seguida
  else if (guarda) tVolta = setTimeout(() => { if (!vivas() && guarda) { guarda = false; ignorarVolta++; try { history.back(); } catch (e) { ignorarVolta--; } } }, 80);
}
window.addEventListener("popstate", () => {
  if (ignorarVolta > 0) { ignorarVolta--; return; }
  if (!guarda) return; // não é nosso: é o voltar normal (sair do app)
  guarda = false;
  const c = [...CAMADAS].reverse().find(x => !x.voltou); if (!c) return;
  c.voltou = true;
  // fechar() devolve false quando só voltou um passo (ex.: de uma seção do Perfil para o Perfil): a camada continua
  if (c.fechar() === false) c.voltou = false;
  setTimeout(() => { if (vivas()) porGuarda(); }, 0);
});
function useCamada(fechar, { recua = false, escurece = true, nome = "" } = {}) {
  const ref = useRef(fechar); ref.current = fechar;
  useEffect(() => {
    const c = { fechar: () => ref.current(), voltou: false, recua, escurece, nome };
    CAMADAS.push(c); mudouCamadas();
    return () => { const i = CAMADAS.indexOf(c); if (i >= 0) CAMADAS.splice(i, 1); mudouCamadas(); };
  }, []);
}
function Camada({ onFechar, recua, escurece, nome }) { useCamada(onFechar, { recua, escurece, nome }); return null; }
// a camada de cima é esta? (o Esc de quem fica por baixo não deve fechar junto a folha que abriu por cima)
const camadaNoTopo = nome => { const c = [...CAMADAS].reverse().find(x => !x.voltou); return !c || c.nome === nome; };

function Sheet({ title, sub, onClose, children }) {
  // Arrastar para baixo pela alça (ou pelo título) fecha, igual aos apps do celular.
  // Fechar pelo X, tocando fora ou com Esc também anima a saída (desce e o fundo some).
  const ref = useRef(null), scrim = useRef(null), arr = useRef(null);
  const sair = () => {
    const sc = scrim.current;
    if (!sc || sc.classList.contains("sai") || sc.classList.contains("solto") || semMovimento()) { onClose(); return; }
    sc.classList.add("sai"); setTimeout(onClose, SAIDA_MS);
  };
  const ini = e => { if (!ref.current) return; arr.current = { y: e.touches[0].clientY, dy: 0, t: performance.now() }; ref.current.style.transition = "none"; };
  const mov = e => {
    if (!arr.current) return;
    const dy = Math.max(0, e.touches[0].clientY - arr.current.y); arr.current.dy = dy;
    ref.current.style.translate = `0 ${dy}px`;
    scrim.current && scrim.current.style.setProperty("--scrim-o", String(Math.max(0, 1 - dy / 420)));
  };
  const fim = () => {
    if (!arr.current) return;
    const { dy, t } = arr.current; arr.current = null;
    const rapido = dy > 40 && dy / Math.max(1, performance.now() - t) > .6; // um "peteleco" para baixo também fecha
    if (dy > 110 || rapido) {
      ref.current.style.transition = "translate .2s cubic-bezier(.4, 0, 1, 1)"; ref.current.style.translate = "0 100%";
      if (scrim.current) { scrim.current.classList.add("solto"); scrim.current.style.setProperty("--scrim-o", "0"); }
      vibrar("toque"); setTimeout(onClose, 190);
    } else {
      ref.current.style.transition = "translate .32s cubic-bezier(.2, .9, .3, 1.1)"; ref.current.style.translate = "";
      scrim.current && scrim.current.style.removeProperty("--scrim-o");
    }
  };
  // Arrastar para baixo fecha: pela alça e pelo título sempre; pelo resto do painel, quando ele já está no topo
  // (como nos apps do celular). Arrastar para os lados, campos e listas que rolam de lado não contam.
  const toque = useRef(null);
  const tIni = e => {
    const s = ref.current; if (!s) return;
    const naAlca = !!e.target.closest(".grab, .sheet-head");
    if (!naAlca && (s.scrollTop > 0 || e.target.closest("input, textarea, select, [contenteditable], .clima-horas, .chips, .cats, .abas, .vozb-chat, .transp-subs, .vz-trilho, .casa-chips"))) { toque.current = null; return; }
    toque.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, vivo: naAlca };
    if (naAlca) ini(e);
  };
  const tMov = e => {
    const a = toque.current; if (!a) return;
    if (!a.vivo) {
      const dy = e.touches[0].clientY - a.y, dx = e.touches[0].clientX - a.x;
      if (dy < -4 || Math.abs(dx) > Math.max(10, dy)) { toque.current = null; return; }
      if (dy < 8 || ref.current.scrollTop > 0) return;
      a.vivo = true; ini({ touches: [{ clientY: e.touches[0].clientY }] });
    }
    mov(e);
  };
  const tFim = () => { const a = toque.current; toque.current = null; if (a && a.vivo) fim(); };
  const sairRef = useRef(sair); sairRef.current = sair;
  useCamada(() => sairRef.current(), { recua: true });
  useEffect(() => {
    vibrar("toque");
    const k = e => e.key === "Escape" && sairRef.current();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="scrim" ref={scrim} onClick={sair}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title || "Painel"} onClick={e => e.stopPropagation()} onScroll={e => e.currentTarget.classList.toggle("rolou", e.currentTarget.scrollTop > 6)} onTouchStart={tIni} onTouchMove={tMov} onTouchEnd={tFim} onTouchCancel={tFim}>
        <div className="grab" />
        {title && (
          <div className="sheet-head">
            <div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>
            <button className="sheet-x" onClick={sair} aria-label="Fechar"><I.x /></button>
          </div>
        )}
        <div className="stack">{children}</div>
      </div>
    </div>
  );
}

// Janela de confirmação (no lugar do antigo "toque de novo para apagar"):
// abre no meio da tela, com o que vai acontecer escrito, Cancelar à esquerda e a ação à direita.
function Confirmar({ titulo, texto, acao = "Confirmar", icon, perigo = true, onSim, onFim }) {
  const [saindo, setSaindo] = useState(false);
  const saiu = useRef(false), nao = useRef(null);
  const sair = () => { if (saiu.current) return; saiu.current = true; setSaindo(true); setTimeout(onFim, semMovimento() ? 0 : 160); };
  const sim = () => { if (saiu.current) return; vibrar("aviso"); onSim(); sair(); };
  const sairRef = useRef(sair); sairRef.current = sair;
  useCamada(() => sairRef.current());
  useEffect(() => {
    try { nao.current && nao.current.focus({ preventScroll: true }); } catch (e) {}
    // Esc fecha só a janela, não o painel que está por baixo
    const k = e => { if (e.key === "Escape") { e.stopPropagation(); sairRef.current(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, []);
  return createPortal(
    <div className={"alerta" + (saindo ? " sai" : "")} onClick={sair} role="presentation">
      <div className="alerta-box" role="alertdialog" aria-modal="true" aria-labelledby="alerta-t" aria-describedby={texto ? "alerta-d" : undefined} onClick={e => e.stopPropagation()}>
        {icon && <span className={"alerta-ic" + (perigo ? " perigo" : "")} aria-hidden="true">{icon}</span>}
        <h3 id="alerta-t">{titulo}</h3>
        {texto && <p id="alerta-d">{texto}</p>}
        <div className="alerta-acoes">
          <button ref={nao} className="alerta-btn" onClick={sair}>Cancelar</button>
          <button className={"alerta-btn forte" + (perigo ? " perigo" : "")} onClick={sim}>{acao}</button>
        </div>
      </div>
    </div>,
    document.body
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

function ConfirmButton({ label, onConfirm, icon, titulo, texto, acao }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn danger" onClick={() => { vibrar("aviso"); setAberto(true); }}>{icon}{label}</button>
      {aberto && <Confirmar titulo={titulo || `${label}?`} texto={texto} acao={acao || label} icon={icon || <I.trash />} onSim={onConfirm} onFim={() => setAberto(false)} />}
    </>
  );
}

// No app de celular (ponte 2): volta para as telas nativas do app (o Início dele). Fora do app não aparece.
function VoltarAoApp({ className = "icon-btn" }) {
  if (!nativoV2) return null;
  return <button className={className} onClick={() => chamarApp("nativo:voltar").catch(() => {})} aria-label="Voltar ao início do app"><I.setaL /></button>;
}
// App de celular (ponte 2): a aba que o próprio app abriu (pedido "abrir"). Enquanto a pessoa não troca de aba no site,
// o voltar dessa tela leva de volta ao app, e não a outra tela do site. O Painel limpa quando a aba muda.
let ABA_DO_APP = null;
const voltarDaTela = voltar => { if (nativoV2 && ABA_DO_APP) chamarApp("nativo:voltar").catch(() => voltar()); else voltar(); };

// A página passou do título grande? (um setState por mudança, não a cada pixel rolado)
function useRolouTitulo(limite = 92) {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    let r = null, raf = 0;
    const f = () => { raf = 0; const v = window.scrollY > limite; if (v !== r) { r = v; setRolou(v); } };
    const agendar = () => { if (!raf) raf = requestAnimationFrame(f); };
    f(); window.addEventListener("scroll", agendar, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", agendar); };
  }, [limite]);
  return rolou;
}
// O topo das abas. No celular: olho (ou voltar) e a ação principal numa linha, o título grande embaixo. Ao rolar, o título
// sobe para o centro de uma barra fina, com o olho e a ação no mesmo lugar: nada pula e o "+" continua a um toque.
// (o Início tem a barra dele, com a foto e o nome.) mais: { l, f }, a ação principal da aba
function TopBar({ eyebrow, title, act, tema, extra, voltar, mais }) {
  const esquerda = voltar
    ? <button className="icon-btn redondo top-voltar" onClick={() => voltarDaTela(voltar)} aria-label="Voltar"><I.chevL /></button>
    : nativoV2 ? <VoltarAoApp className="icon-btn redondo top-voltar" />
      : <button className="icon-btn redondo top-olho" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button>;
  const botaoMais = mais && <button className="icon-btn redondo top-mais" onClick={mais.f} aria-label={mais.l}><I.plus /></button>;
  return (
    <>
      <header className={"top" + (voltar || nativoV2 ? " com-voltar" : "")}>
        {/* no app, a tela com voltar próprio fica só com ele (dois botões de voltar lado a lado confundem) */}
        <span className="top-esq">{esquerda}</span>
        <div className="top-titulo"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>
        <div className="top-actions">
          {extra}
          {botaoMais}
          <span className="nc">
            <button className="icon-btn" onClick={act.trocarTema} aria-label={tema.escuro ? "Usar modo claro" : "Usar modo escuro"}>{tema.escuro ? <I.sun /> : <I.moon />}</button>
          </span>
        </div>
      </header>
    </>
  );
}

// Seletor Consultório / Pessoal (menu brilhante)
function ModeSwitch({ modo, setModo, block, modos }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = e => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("pointerdown", f); document.removeEventListener("keydown", k); };
  }, [open]);
  const ops = [["consultorio", "Consultório", "Agenda, pacientes e cobranças"], ["pessoal", "Pessoal", "Gastos e contas da casa"], ["loja", "Loja", "Caixa, gastos e o que falta"]].filter(([v]) => !modos || modos.includes(v));
  return (
    <div className={"mode" + (block ? " block" : "")} ref={ref}>
      <button className="mode-pill" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <i className="mode-dot" />{NOME_MODO[modo] || "Consultório"}<I.chevD />
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

// Barra lateral do computador (a partir de 900px). Aberta mostra o nome "avina" por extenso (o mesmo da abertura);
// recolhida fica só o "A" do ícone. Recolhida, cada item mostra o nome num balão ao passar o mouse e os Atalhos
// saem num painel ao lado, com o ícone viajando até o título do painel.
const K_LATERAL = "agenda-lateral";
const AvinaNome = () => (
  <svg className="lt-nome" viewBox="-12 -50 544 162" role="img" aria-label="Avina">
    <defs><linearGradient id="lt-nvf" x1="-18" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopOpacity="0" /><stop offset=".45" stopOpacity=".45" /><stop offset="1" /></linearGradient></defs>
    <g fill="none" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50M100 0V100" stroke="url(#lt-nvf)" />
      <path d="M136 0L178 100L220 0M256 0V100M256 -37V-35M292 100V46A46 46 0 0 1 384 46V100M520 50A50 50 0 1 1 420 50A50 50 0 1 1 520 50M520 0V100" stroke="currentColor" />
    </g>
  </svg>
);
const AvinaA = () => (
  <svg className="lt-a" viewBox="0 0 512 512" aria-hidden="true">
    <rect width="512" height="512" rx="114" fill="#F7F6F2" />
    <path transform="translate(256 256) scale(1.04) translate(-247 -257)" d="M338 380V176Q338 128 300 128Q274 128 260 158L196 300Q180 336 152 334Q128 332 134 302Q146 258 214 248Q296 238 338 300" fill="none" stroke="#1F3BEF" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
function BarraLateral({ conta, tema, modo, doisModos, abas, tab, act }) {
  const pessoal = modo === "pessoal", loja = modo === "loja";
  const [mini, setMini] = useState(() => lerJSON(K_LATERAL, "aberta") === "mini");
  const [abertos, setAbertos] = useState({});   // submenus abertos (barra aberta)
  const [rapido, setRapido] = useState(null);   // menu do botão principal: { top, left, width }
  const [dica, setDica] = useState(null);       // balão com o nome (barra recolhida)
  const [voo, setVoo] = useState(null);         // painel ao lado com os subitens (barra recolhida)
  const [icone, setIcone] = useState(null);     // ícone que viaja do item até o título do painel
  const ladoRef = useRef(null), vooRef = useRef(null), slotRef = useRef(null), rapRef = useRef(null), splitRef = useRef(null);
  const tempo = useRef({});

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.lateral = mini ? "mini" : "aberta";
    gravar(K_LATERAL, mini ? "mini" : "aberta");
    return () => { delete raiz.dataset.lateral; };
  }, [mini]);
  useEffect(() => () => { clearTimeout(tempo.current.abre); clearTimeout(tempo.current.fecha); }, []);

  const chat = IA_CONVERSA && servidorAvisos() ? [{ id: "chat", l: "Perguntar à Bolinha", ic: <I.chat />, f: act.abrirChat }] : [];
  const principal = loja ? { l: "Anotar gasto", f: () => act.abrirLoja("gasto", {}) } : pessoal ? { l: "Anotar gasto", f: () => act.novoLanc("saida") } : { l: `Novo ${TERMO.s}`, f: act.novoPaciente };
  const rapidas = loja
    ? [{ id: "gasto", l: "Anotar gasto da loja", d: "Insumos, embalagem, gás…", ic: <I.minus />, f: () => act.abrirLoja("gasto", {}) },
       { id: "venda", l: "Venda pelo valor", d: "Sem escolher produto", ic: <I.plus />, f: () => act.abrirLoja("venda", {}) },
       { id: "nota", l: "Ler nota do fornecedor", d: "QR code ou foto", ic: <I.receipt />, f: () => act.abrirLoja("nota", {}) },
       { id: "fechar", l: "Fechar o caixa", d: "Contar a gaveta", ic: <I.wallet />, f: () => act.abrirLoja("fechar", {}) }]
    : pessoal
    ? [{ id: "gasto", l: "Anotar gasto", d: "Saiu dinheiro", ic: <I.minus />, f: () => act.novoLanc("saida") },
       { id: "entrada", l: "Anotar entrada", d: "Entrou dinheiro", ic: <I.plus />, f: () => act.novoLanc("entrada") },
       { id: "conta", l: "Nova conta fixa", d: "Luz, aluguel, assinaturas", ic: <I.bill />, f: () => act.novaConta() },
       ...(IA_CONVERSA ? [{ id: "falar", l: "Anotar falando", d: "Diga o gasto em voz alta", ic: <I.mic />, f: act.falarGasto }] : [])]
    : [{ id: "pac", l: `Novo ${TERMO.s}`, d: "Cadastrar e pôr na agenda", ic: <I.users />, f: act.novoPaciente },
       { id: "espera", l: "Lista de espera", d: "Anotar quem quer um horário", ic: <I.clock />, f: act.novaEspera },
       { id: "importar", l: "Importar agenda", d: "Trazer de outra agenda", ic: <I.upload />, f: act.importarAgenda }];
  const atalhos = loja
    ? [{ id: "ajustes", l: "Ajustes e equipe", ic: <I.gear />, f: () => act.abrirLoja("ajustes", {}) }, { id: "mov", l: "Tirar ou pôr dinheiro", ic: <I.repeat />, f: () => act.abrirLoja("mov", {}) }]
    : pessoal
    ? [...chat, { id: "casa", l: "Nossa casa", ic: <I.home />, tab: "p-casa", f: act.abrirCasa }]
    : [...chat, { id: "agora", l: "Só o agora", ic: <I.target />, f: act.agora }, { id: "fechar", l: "Fechar o dia", ic: <I.moon />, f: act.fecharDia }, { id: "livres", l: "Horários livres", ic: <I.share />, f: act.livres }];
  const itens = [...abas.map(a => ({ id: a.id, l: a.l, ic: a.ic, n: a.n, tab: a.id })), { id: "atalhos", l: "Atalhos", ic: <I.grid />, sub: atalhos }];

  const fecharVoo = () => { setVoo(null); setIcone(null); };
  const abrirVoo = (it, r) => { setVoo({ id: it.id, top: r.top }); setIcone({ id: it.id, ic: it.ic, top: r.top + r.height / 2, left: r.left + r.width / 2 }); };
  const mostrarDica = (id, l, extra, r) => setDica({ id, l, extra, top: r.top + r.height / 2, left: r.right + 12 });
  const entra = (it, e) => {
    if (!mini) return;
    const r = e.currentTarget.getBoundingClientRect();
    clearTimeout(tempo.current.abre); clearTimeout(tempo.current.fecha);
    mostrarDica(it.id, it.l, it.sub ? "Clique para abrir" : "", r);
    if (it.sub) tempo.current.abre = setTimeout(() => abrirVoo(it, r), 80);
    else tempo.current.fecha = setTimeout(fecharVoo, 100);
  };
  const sai = it => {
    if (!mini) return;
    clearTimeout(tempo.current.abre); setDica(null);
    if (voo && voo.id === it.id) tempo.current.fecha = setTimeout(fecharVoo, 220);
  };

  // Fecha o painel ao clicar fora (ou com Esc)
  useEffect(() => {
    if (!voo) return;
    const f = e => { if (!(ladoRef.current && ladoRef.current.contains(e.target)) && !(vooRef.current && vooRef.current.contains(e.target))) fecharVoo(); };
    const k = e => e.key === "Escape" && fecharVoo();
    document.addEventListener("mousedown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", f); document.removeEventListener("keydown", k); };
  }, [voo]);
  // Depois que o painel aparece, manda o ícone para o lugar dele no título
  const vooId = voo && voo.id;
  useEffect(() => {
    if (!vooId) return;
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (!slotRef.current) return;
        const r = slotRef.current.getBoundingClientRect();
        setIcone(p => p && p.id === vooId ? { ...p, top: r.top + r.height / 2, left: r.left + r.width / 2 } : p);
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [vooId]);
  useEffect(() => { fecharVoo(); setDica(null); setRapido(null); }, [mini]);

  // Menu do botão principal
  useEffect(() => {
    if (!rapido) return;
    const f = e => { if (!(rapRef.current && rapRef.current.contains(e.target)) && !(splitRef.current && splitRef.current.contains(e.target))) setRapido(null); };
    const k = e => e.key === "Escape" && setRapido(null);
    document.addEventListener("pointerdown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("pointerdown", f); document.removeEventListener("keydown", k); };
  }, [rapido]);
  const abrirRapido = () => {
    if (rapido) { setRapido(null); return; }
    const r = splitRef.current.getBoundingClientRect();
    setRapido({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  const alvo = (ladoRef.current && ladoRef.current.parentElement) || document.body;
  const itemVoo = voo && itens.find(i => i.id === voo.id);

  return (
    <aside ref={ladoRef} className={"side" + (mini ? " recolhida" : "")} aria-label="Menu">
      <button type="button" className="lt-recolher" onClick={() => setMini(m => !m)} title={mini ? "Expandir menu" : "Recolher menu"} aria-label={mini ? "Expandir menu" : "Recolher menu"}>
        {mini ? <I.chev /> : <I.chevL />}
      </button>

      <div className="lt-marca">
        {mini
          ? <button type="button" key="a" onClick={() => setMini(false)} title="Avina" aria-label="Expandir menu"><AvinaA /></button>
          : <button type="button" key="nome" onClick={() => act.setTab(inicioDo(modo))} aria-label="Avina, início"><AvinaNome /></button>}
      </div>

      <div className="lt-acao">
        <div className="lt-split" ref={splitRef} inert={mini ? "" : undefined}>
          <button type="button" className="lt-split-p" onClick={principal.f}><span>{principal.l}</span></button>
          <button type="button" className={"lt-split-s" + (rapido ? " on" : "")} onClick={abrirRapido} aria-label="Mais opções" aria-haspopup="menu" aria-expanded={!!rapido}><I.chevD /></button>
        </div>
        <div className="lt-mais-w" inert={mini ? undefined : ""}>
          <button type="button" className="lt-mais" onClick={principal.f} aria-label={principal.l}
            onMouseEnter={e => mini && mostrarDica("mais", principal.l, "", e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setDica(null)}>
            <I.plus />
          </button>
        </div>
      </div>

      <div className="lt-lista">
        {itens.map(it => {
          const ativo = it.sub ? it.sub.some(s => s.tab && s.tab === tab) : tab === it.tab;
          const aberto = !!abertos[it.id];
          return (
            <div key={it.id} onMouseEnter={e => entra(it, e)} onMouseLeave={() => sai(it)}>
              <button type="button" className={"lt-item" + (ativo ? " on" : "") + (it.sub ? " tem-sub" : "")} aria-label={it.l}
                aria-current={!it.sub && ativo ? "page" : undefined} aria-haspopup={it.sub ? "true" : undefined} aria-expanded={it.sub ? (mini ? vooId === it.id : aberto) : undefined}
                onClick={e => {
                  if (!it.sub) { act.setTab(it.tab); return; }
                  if (!mini) { setAbertos(a => ({ [it.id]: !a[it.id] })); return; }
                  if (vooId === it.id) { fecharVoo(); return; }
                  abrirVoo(it, e.currentTarget.getBoundingClientRect());
                }}>
                <span className={"lt-ic" + (mini && vooId === it.id ? " some" : "")}>{it.ic}</span>
                <span className="lt-rot">{it.l}</span>
                {it.n > 0 && <span className="badge">{it.n > 99 ? "99+" : it.n}</span>}
                {it.sub && <span className="lt-seta"><I.chevD /></span>}
              </button>
              {!mini && it.sub && (
                <div className={"lt-sub" + (aberto ? " on" : "")} inert={aberto ? undefined : ""}>
                  <i className="lt-sub-linha" />
                  {it.sub.map((s, k) => (
                    <button type="button" key={s.id} className={"lt-subi" + (s.tab && s.tab === tab ? " on" : "")} onClick={s.f}
                      style={{ "--d": aberto ? `${150 + k * 60}ms` : `${(it.sub.length - 1 - k) * 60}ms` }}>
                      {s.ic}<span>{s.l}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="lt-pe">
        <button type="button" className="lt-conta" onClick={() => act.openSettings()} title="Sua conta e ajustes">
          <Avatar conta={conta} />
          {!mini && <span className="lt-quem"><b>{conta.nome}</b><small>{conta.email}</small></span>}
        </button>
        {doisModos && (
          <button type="button" className="lt-linha" onClick={act.proximoModo} title={`Ir para o ${NOME_MODO[act.modoSeguinte]}`}>
            <span><i className="lt-modo" />{!mini && <em>{NOME_MODO[modo]}</em>}</span>
            {!mini && <small>Trocar</small>}
          </button>
        )}
        <button type="button" className="lt-linha" onClick={act.trocarTema} title={tema.escuro ? "Usar modo claro" : "Usar modo escuro"}>
          <span>{tema.escuro ? <i className="lt-lua"><I.moon /></i> : <i className="lt-sol"><I.sun /></i>}{!mini && <em>{tema.escuro ? "Tema escuro" : "Tema claro"}</em>}</span>
          {!mini && <small>Alternar</small>}
        </button>
      </div>

      {mini && dica && dica.id !== vooId && createPortal(
        <div className="lt-dica" style={{ top: dica.top, left: dica.left }}>
          <div><span>{dica.l}</span>{dica.extra && <small>{dica.extra}</small>}</div>
        </div>, alvo)}

      {mini && itemVoo && createPortal(
        <div className="lt-voo" ref={vooRef} style={{ top: voo.top }}
          onMouseEnter={() => clearTimeout(tempo.current.fecha)} onMouseLeave={() => { tempo.current.fecha = setTimeout(fecharVoo, 220); }}>
          <svg className="lt-voo-canto em-cima" viewBox="0 0 12 12" aria-hidden="true"><path d="M12 12L0 12L0 0A12 12 0 0 0 12 12Z" /></svg>
          <svg className="lt-voo-canto embaixo" viewBox="0 0 12 12" aria-hidden="true"><path d="M12 0L0 0L0 12A12 12 0 0 1 12 0Z" /></svg>
          <div className="lt-voo-h"><span ref={slotRef} className="lt-voo-slot" /><span>{itemVoo.l}</span></div>
          <div className="lt-voo-l">
            {itemVoo.sub.map(s => (
              <button type="button" key={s.id} className={"lt-voo-i" + (s.tab && s.tab === tab ? " on" : "")} onClick={() => { fecharVoo(); s.f(); }}>{s.ic}<span>{s.l}</span></button>
            ))}
          </div>
        </div>, alvo)}

      {mini && icone && icone.id === vooId && createPortal(
        <div className="lt-viaja" style={{ top: icone.top, left: icone.left }}>{icone.ic}</div>, alvo)}

      {rapido && createPortal(
        <div className="menu lt-rapido" role="menu" ref={rapRef} style={{ top: rapido.top, left: rapido.left, width: rapido.width }}>
          {rapidas.map(r => (
            <button key={r.id} type="button" role="menuitem" className="mi" onClick={() => { setRapido(null); r.f(); }}>
              {r.ic}<span><b>{r.l}</b><small>{r.d}</small></span>
            </button>
          ))}
        </div>, alvo)}
    </aside>
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
   8. LOGIN E CADASTRO
   Com a nuvem ligada (src/nuvem.js), o login é de verdade (Supabase Auth). Sem ela, fica só no aparelho.
   ========================================================= */
function Auth({ onLogin, emailInicial, aviso }) {
  // chegou por um convite para a casa (#casa=...): o convite fica guardado e abre depois de entrar
  const [convite] = useState(() => { try { return !!(localStorage.getItem("agenda-convite-casa") || localStorage.getItem("agenda-convite-loja")); } catch (e) { return false; } });
  const [modo, setModo] = useState(() => ["#criar", "#demo"].includes(location.hash) || (convite && !emailInicial) ? "criar" : "entrar"); // entrar | criar | esqueci
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(() => { if (emailInicial) return emailInicial; const daApresentacao = new URLSearchParams(location.search).get("email"); if (daApresentacao) return daApresentacao; try { const e = sessionStorage.getItem("agenda-email") || ""; sessionStorage.removeItem("agenda-email"); return e; } catch (x) { return ""; } });
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [indo, setIndo] = useState(false);
  const criar = modo === "criar", esqueci = modo === "esqueci";
  const trocar = m => { setModo(m); setErro(null); setOk(null); };
  const enviarNuvem = async () => {
    const em = email.trim().toLowerCase();
    if (criar && !nome.trim()) return setErro({ t: "Como você quer ser chamado aqui? Pode ser só o primeiro nome." });
    if (!em.includes("@")) return setErro({ t: "Esse e-mail parece incompleto." });
    if (!esqueci && !senha) return setErro({ t: "Falta a senha." });
    if (criar && senha.length < 6) return setErro({ t: "Use uma senha com pelo menos 6 caracteres." });
    setErro(null); setOk(null); setIndo(true);
    try {
      const sb = await cliente();
      if (esqueci) {
        const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: ENDERECO_APP });
        if (error) throw error;
        return setOk(`Se ${em} tiver conta, chegou um link para criar uma senha nova. Abra o e-mail neste aparelho.`);
      }
      const local = lerJSON(K.contas, {})[em];
      const origem = lerTexto(K_ORIGEM); // de onde a pessoa veio (o painel do dono conta)
      const novaConta = n => sb.auth.signUp({ email: em, password: senha, options: { data: { nome: n, ...(origem ? { origem } : {}) }, emailRedirectTo: ENDERECO_APP } });
      let r = criar ? await novaConta(nome.trim()) : await sb.auth.signInWithPassword({ email: em, password: senha });
      // Conta de antes da nuvem (só neste aparelho): com a senha certa, cria a conta na nuvem e leva os dados junto
      if (!criar && r.error && /invalid login credentials/i.test(r.error.message) && local && !local.uid && local.hash === hash(senha)) r = await novaConta(local.nome);
      if (r.error) {
        if (criar && /already registered|already exists/i.test(r.error.message)) return setErro({ t: "Esse e-mail já tem conta.", b: "Entrar com ele", fn: () => trocar("entrar") });
        if (/email not confirmed/i.test(r.error.message)) return setErro({ t: traduzirErro(r.error), b: "Mandar o link de novo", fn: () => sb.auth.resend({ type: "signup", email: em, options: { emailRedirectTo: ENDERECO_APP } }).then(() => { setErro(null); setOk(`Link novo enviado para ${em}.`); }) });
        if (/invalid login credentials/i.test(r.error.message)) return setErro({ t: traduzirErro(r.error), b: "Esqueci a senha", fn: () => trocar("esqueci") });
        throw r.error;
      }
      if (!r.data.session) return setOk(`Mandei um link para ${em}. Toque nele para confirmar a conta e depois entre aqui.`);
      onLogin(await contaDaNuvem(r.data.user, local), criar);
    } catch (x) { setErro({ t: traduzirErro(x) }); } finally { setIndo(false); }
  };
  const enviar = e => {
    e.preventDefault();
    if (NUVEM) return enviarNuvem();
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
      <div className="brand"><i><Marca /></i>Avina</div>
      <div className="auth-h">
        <div className="hi">{criar ? "Vamos começar!" : esqueci ? "Acontece!" : "Que bom te ver!"}</div>
        <h1>{criar ? "Criar conta" : esqueci ? "Nova senha" : "Entrar"}</h1>
        <p>{convite && !esqueci ? "Você foi convidado(a) para dividir as contas de uma casa no Avina." : criar ? "Leva menos de um minuto." : esqueci ? "Coloque seu e-mail e eu mando um link para criar outra senha." : aviso || "Sua agenda, seus pagamentos e suas contas num lugar só."}</p>
      </div>
      <form className="stack" onSubmit={enviar} noValidate>
        <div className="fields">
          {criar && <Field label="Como quer ser chamado(a)" icon={<I.user />} htmlFor="a-nome"><input id="a-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Camila" autoComplete="given-name" /></Field>}
          <Field label="E-mail" icon={<I.mail />} htmlFor="a-email"><input id="a-email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete={criar ? "email" : "username"} /></Field>
          {!esqueci && <Field label="Senha" icon={<I.lock />} htmlFor="a-senha"><input id="a-senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" autoComplete={criar ? "new-password" : "current-password"} /></Field>}
        </div>
        {erro && <div className="error" role="alert">{erro.t} {erro.b && <button type="button" onClick={erro.fn} style={{ color: "var(--accent-ink)", fontWeight: 800, textDecoration: "underline" }}>{erro.b}</button>}</div>}
        {ok && <div className="auth-ok" role="status"><I.mail /> {ok}</div>}
        {convite && !esqueci && !ok && <div className="auth-ok auth-convite" role="status"><I.users /> <span>{criar ? "Crie sua conta (é grátis) e o convite abre em seguida. Quem entra numa casa não paga nada para usar a casa." : "Entre com a sua conta e o convite abre em seguida."}</span></div>}
        <button className="btn" type="submit" disabled={indo}>{indo ? "Um instante…" : criar ? "Criar minha conta" : esqueci ? "Mandar o link" : "Entrar"}</button>
        {criar && <div className="hint auth-termos">Ao criar a conta, você concorda com os <a href={`${BASE}termos/`} target="_blank" rel="noopener">Termos de uso</a> e a <a href={`${BASE}privacidade/`} target="_blank" rel="noopener">Política de privacidade</a>.</div>}
        {esqueci && <button className="btn ghost" type="button" onClick={() => trocar("entrar")}>Voltar para entrar</button>}
      </form>
      <div className="auth-foot">
        {criar ? <>Já tem conta? <button onClick={() => trocar("entrar")}>Entrar</button></> : !esqueci && <>Primeira vez aqui? <button onClick={() => trocar("criar")}>Criar conta</button>{NUVEM && <> · <button onClick={() => trocar("esqueci")}>Esqueci a senha</button></>}</>}
      </div>
      <div className="demo-note">{NUVEM ? "Seus dados ficam protegidos na nuvem, só a sua conta vê, e o app funciona até sem internet." : "Sem a nuvem ligada: tudo fica salvo só neste aparelho."}</div>
    </main>
  );
}

// WhatsApp obrigatório no PWA: aparece antes de abrir o app para quem ainda não informou, em conta nova ou antiga.
// Fora do app de celular: a Apple não aceita exigir dado pessoal que o app não precisa para funcionar.
function PedirWhatsapp({ conta, onPronto, onAchou, onSair }) {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState(null);
  const [vendo, setVendo] = useState(true); // pode já ter informado em outro aparelho: confere na nuvem antes de perguntar
  useEffect(() => {
    let vivo = true;
    const perguntar = () => { if (vivo) setVendo(false); };
    const t = setTimeout(perguntar, 2500);
    whatsappDaNuvem(conta.uid).then(w => { if (vivo && w) onAchou(w); else perguntar(); }).catch(perguntar);
    return () => { vivo = false; clearTimeout(t); };
  }, []);
  const enviar = e => {
    e.preventDefault();
    const r = lerWhatsapp(valor);
    if (!r.ok) { setErro(r.erro); vibrar("erro"); return; }
    setErro(null); vibrar("ok"); onPronto(r.numero);
  };
  if (vendo) return <main className="auth"><div className="brand"><i><Marca /></i>Avina</div></main>;
  return (
    <main className="auth">
      <div className="brand"><i><Marca /></i>Avina</div>
      <div className="auth-h">
        <div className="hi">Falta só isso!</div>
        <h1>Seu WhatsApp</h1>
        <p>É por ele que a gente fala com você sobre a sua conta, ajuda quando precisar e conta as novidades do Avina. Seu número não vai para mais ninguém.</p>
      </div>
      <form className="stack" onSubmit={enviar} noValidate>
        <div className="fields">
          <Field label="Número com DDD" icon={<I.phone />} htmlFor="w-num"><input id="w-num" type="tel" inputMode="tel" autoComplete="tel-national" autoFocus value={valor} onChange={e => { setValor(mascaraWhatsapp(e.target.value)); setErro(null); }} placeholder="(43) 98888-7777" aria-invalid={!!erro} /></Field>
        </div>
        {erro && <div className="error" role="alert">{erro}</div>}
        <button className="btn" type="submit">Continuar</button>
        <div className="hint auth-termos">Você pode trocar o número no Perfil. Para não receber mensagens, é só pedir. Veja a <a href={`${BASE}privacidade/`} target="_blank" rel="noopener">Política de privacidade</a>.</div>
      </form>
      <div className="auth-foot"><button onClick={() => onSair()}>Sair da conta</button></div>
    </main>
  );
}

// Veio do link "criar senha nova" do e-mail
function NovaSenha({ onPronto }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [indo, setIndo] = useState(false);
  const enviar = async e => {
    e.preventDefault();
    if (senha.length < 6) return setErro("Use uma senha com pelo menos 6 caracteres.");
    setErro(null); setIndo(true);
    try {
      const sb = await cliente();
      const { data, error } = await sb.auth.updateUser({ password: senha });
      if (error) throw error;
      await onPronto(data.user);
    } catch (x) { setErro(traduzirErro(x)); setIndo(false); }
  };
  return (
    <main className="auth">
      <div className="brand"><i><Marca /></i>Avina</div>
      <div className="auth-h"><div className="hi">Quase lá!</div><h1>Senha nova</h1><p>Escolha a senha que você vai usar daqui para frente.</p></div>
      <form className="stack" onSubmit={enviar} noValidate>
        <div className="fields"><Field label="Senha nova" icon={<I.lock />} htmlFor="n-senha"><input id="n-senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" autoComplete="new-password" autoFocus /></Field></div>
        {erro && <div className="error" role="alert">{erro}</div>}
        <button className="btn" type="submit" disabled={indo}>{indo ? "Um instante…" : "Salvar e entrar"}</button>
      </form>
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
        <VoltarAoApp />
        <Avatar conta={conta} onClick={act.openSettings} />
        {act.modos && act.modos.length > 1 && <ModeSwitch modo={modo} setModo={act.setModo} modos={act.modos} />}
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

// O topo do Início (consultório e pessoal), no jeito do app de celular: a foto, o modo, o olho e o "+" (anotar), e
// embaixo a data e a saudação grande ("Boa noite, Felipe")
const DIA_SEMANA_LONGO = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
function TopoInicio({ conta, act, tema, modo, now, compacto }) {
  const d = now || new Date();
  const mais = modo === "pessoal" ? { l: "Anotar gasto ou entrada", fn: () => act.novoLanc("saida") } : modo === "consultorio" ? { l: `Novo ${TERMO.s}`, fn: act.novoPaciente } : null;
  const varios = act.modos && act.modos.length > 1;
  return (
    <header className={"ini-topo" + (varios ? " com-modo" : "") + (compacto ? " compacto" : "")}>
      <div className="ini-topo-l">
        <VoltarAoApp />
        <Avatar conta={conta} onClick={act.openSettings} />
        {varios && <ModeSwitch modo={modo} setModo={act.setModo} modos={act.modos} />}
      </div>
      {compacto
        ? <div className="ini-topo-t">
          <h1 className="ini-ola">{ehAniversario(conta.perfil) ? "Feliz aniversário" : saudacao(d)}, {primeiro(conta.nome)}</h1>
          <p className="ini-data">{DIA_SEMANA_LONGO[d.getDay()].replace("-feira", "")}, {d.getDate()} de {MES_LONGO[d.getMonth()]}</p>
        </div>
        : <div className="ini-topo-t">
          <p className="ini-data">{DIA_SEMANA_LONGO[d.getDay()]}, {d.getDate()} de {MES_LONGO[d.getMonth()]}</p>
          <h1 className="ini-ola">{ehAniversario(conta.perfil) ? "Feliz aniversário" : saudacao(d)}, {primeiro(conta.nome)}</h1>
        </div>}
      <div className="top-actions ini-topo-a">
        <button className="icon-btn" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button>
        <span className="nc"><button className="icon-btn" onClick={act.trocarTema} aria-label={tema.escuro ? "Usar modo claro" : "Usar modo escuro"}>{tema.escuro ? <I.sun /> : <I.moon />}</button></span>
        {mais && <button className="icon-btn ini-mais" onClick={mais.fn} aria-label={mais.l}><I.plus /></button>}
      </div>
    </header>
  );
}

// Os cartões do Início (o carrossel e os que a pessoa escolhe) vêm sob demanda: src/telas/inicio-cartoes.jsx
const CarrosselInicio = lazy(() => import("./telas/inicio-cartoes.jsx").then(m => ({ default: m.Carrossel })));
const CartoesInicio = lazy(() => import("./telas/inicio-cartoes.jsx").then(m => ({ default: m.CartoesInicio })));
const PersonalizarInicio = lazy(() => import("./telas/inicio-cartoes.jsx").then(m => ({ default: m.PersonalizarInicio })));

// Trocar de área (Consultório, Pessoal, Loja): uma folha que sobe com um cartão grande para cada área
const AREAS_INFO = {
  consultorio: { nome: "Consultório", texto: "Agenda, pacientes, cobranças e recibos", ic: "cal", cor: "#2B46FF" },
  pessoal: { nome: "Pessoal", texto: "Gastos, contas, casa e transporte", ic: "wallet", cor: "#12B76A" },
  loja: { nome: "Loja", texto: "Caixa do dia, gastos e equipe", ic: "bag", cor: "#F79009" },
};
function ModoFolha({ modo, modos, act, onClose }) {
  const ir = m => { vibrar("toque"); onClose(); if (m !== modo) setTimeout(() => act.setModo(m), 180); };
  return (
    <Sheet title="Trocar de área" sub="O app muda inteiro: o Início, as abas e os atalhos." onClose={onClose}>
      <div className="modo-cartoes">
        {modos.map((m, k) => { const a = AREAS_INFO[m], Ic = I[a.ic]; return (
          <button key={m} type="button" className={"modo-cartao" + (m === modo ? " on" : "")} style={{ "--mc": a.cor, animationDelay: `${k * 50}ms` }} onClick={() => ir(m)} aria-pressed={m === modo}>
            <span className="modo-cartao-ic"><Ic /></span>
            <span className="modo-cartao-t"><b>{a.nome}</b><small>{a.texto}</small></span>
            <span className="modo-cartao-ok">{m === modo ? <I.check /> : <I.chev />}</span>
          </button>
        ); })}
      </div>
      <button className="btn text" onClick={() => { onClose(); setTimeout(() => act.openSettings("pessoal"), 200); }}>Ligar ou desligar áreas</button>
    </Sheet>
  );
}

// Alertas: o que antes ficava no "Seu resumo" do Início, numa tela própria (o sino da barra de cima), no jeito da
// lista de alertas dos apps de banco: o que pede atenção primeiro (com o botão para resolver), depois o resto.
function AlertasTela({ falas, onClose }) {
  useCamada(onClose, { escurece: false, nome: "alertas" });
  const acao = falas.filter(f => f.acao), info = falas.filter(f => !f.acao);
  const Linha = ({ f }) => (
    <div className="al-linha">
      <span className={"al-ic" + (f.acao ? " forte" : "")}>{f.acao ? <I.bell /> : <I.alert />}</span>
      <div className="al-tx"><p>{f.txt}</p>{f.acao && <button className="al-acao" onClick={() => { onClose(); setTimeout(f.acao.fn, 200); }}>{f.acao.l}<I.chev /></button>}</div>
    </div>
  );
  return createPortal(
    <div className="tela-cheia" role="dialog" aria-modal="true" aria-label="Alertas">
      <div className="tela-cheia-in">
        <button className="tela-voltar" onClick={onClose} aria-label="Voltar"><I.setaL /></button>
        <h1 className="tela-t">Alertas</h1>
        {!falas.length && <div className="al-vazio"><Ilustra n="cafe" /><b>Tudo em dia</b><span>Quando algo pedir a sua atenção, aparece aqui.</span></div>}
        {acao.length > 0 && <><h2 className="al-grupo">Pede atenção</h2>{acao.map((f, i) => <Linha key={"a" + i} f={f} />)}</>}
        {info.length > 0 && <><h2 className="al-grupo">Para saber</h2>{info.map((f, i) => <Linha key={"i" + i} f={f} />)}</>}
      </div>
    </div>, document.body);
}

// O dia no topo do Início: quantas sessões, quanto entra, a próxima (com o "Entrar" da sala online) e a linha do dia
function HojeConsultorio({ db, now, act, clima }) {
  const t = todayISO(), nm = agoraMin(now);
  const its = itensDoDia(db, t);
  const sts = its.map(i => situacao(i, now));
  const validos = its.filter((_, k) => sts[k] !== "missed");
  const feitos = sts.filter(s => s === "done").length;
  const total = soma(validos, i => i.kind === "log" ? i.session.price - i.session.sublet : liquido(i.patient));
  const prox = its.find(i => i.kind === "next" && mins(i.time) + DURACAO_SESSAO > nm);
  const jaComecou = prox && nm >= mins(prox.time);
  const sala = prox && salaDe(prox.patient);
  const pct = validos.length ? Math.round((feitos / validos.length) * 100) : 0;
  return (
    <section className="hoje" aria-label="Hoje no consultório">
      <div className="hoje-cab">
        <span className="hoje-rot">Hoje</span>
        <span className="hoje-res num">{validos.length ? <>{feitos} de {validos.length} {validos.length === 1 ? "sessão" : "sessões"} · <b>{brl(total)}</b></> : feriado(t) ? `Feriado: ${feriado(t).name}` : "Sem sessões"}</span>
      </div>
      {validos.length > 0 && <div className="hoje-barra" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
      {prox ? (
        <div className={"hoje-prox" + (jaComecou ? " agora" : "")} style={corVars(prox.patient)}>
          <button className="hoje-prox-main" onClick={() => act.openItem(prox)}>
            <span className="hoje-hora num">{prox.time}</span>
            <span className="hoje-quem">
              <b>{prox.patient.name}</b>
              <small>{jaComecou ? "Acontecendo agora" : `Próxima · em ${duracao(mins(prox.time) - nm)}`} · você recebe {brl(liquido(prox.patient))}</small>
              <SeloConfirmacao v={(db.confirmados || {})[`${prox.patient.id}:${t}`]} online={!!prox.patient.online} />
            </span>
            <I.chev />
          </button>
          {sala && (horaDeEntrar(prox, now)
            ? <a className="entrar-sala grande" href={sala} target="_blank" rel="noopener noreferrer" onClick={() => vibrar("toque")}><I.video /> Entrar na sessão</a>
            : <a className="entrar-sala discreto" href={sala} target="_blank" rel="noopener noreferrer"><I.video /> Link da sala</a>)}
        </div>
      ) : <p className="hoje-vazio">{its.length ? "As sessões de hoje já passaram." : "Nenhuma sessão hoje. Bom descanso."}</p>}
      {its.length > 1 && (
        <div className="hoje-linha" role="list" aria-label="Sessões de hoje">
          {its.map((i, k) => <button key={i.patient.id + i.time} role="listitem" className={"hoje-pt " + sts[k] + (prox && i === prox ? " prox" : "")} style={corVars(i.patient)} onClick={() => act.openItem(i)} aria-label={`${i.time}, ${i.patient.name}: ${ROTULO[sts[k]]}`}><span className="num">{i.time}</span><i>{primeiro(i.patient.name)}</i></button>)}
        </div>
      )}
      {clima && <div className="hoje-clima">{clima}</div>}
    </section>
  );
}

function HomeTab({ db, conta, now, act, tema, avisos }) {
  const t = todayISO(), ch = t.slice(0, 7), nm = agoraMin(now);
  const atrasados = db.patients.filter(p => p.active && p.nextDate < t).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const prox = itensDoDia(db, t).filter(i => i.kind === "next").find(i => mins(i.time) + DURACAO_SESSAO > nm);
  const cs = db.charges.filter(c => !c.hidden);
  const recebidoMes = soma(cs.filter(c => c.paid && (c.paidAt || "").startsWith(ch)), c => c.amount);
  const aReceber = soma(cs.filter(c => !c.paid), c => c.amount);
  const amanha = addDays(t, 1), nPedidos = (db.pedidos || []).length;
  const acoes = [
    { id: "pac", l: `Novo ${TERMO.s}`, ic: I.plus, f: act.novoPaciente },
    { id: "cobrar", l: "Cobrar", ic: I.send, f: () => act.setTab("fin") },
    { id: "conf", l: "Confirmar amanhã", ic: I.check, f: () => act.confirmar(amanha) },
    { id: "link", l: "Link de agendamento", ic: I.share, f: () => act.openSettings("link") },
    { id: "livres", l: "Horários livres", ic: I.clock, f: act.livres },
  ];
  const atalhos = [
    { id: "agenda", l: "Agenda", ic: I.cal, f: () => act.setTab("agenda") },
    { id: "pac", l: TERMO.P, ic: I.users, f: () => act.setTab("pac") },
    { id: "fin", l: "Cobranças", ic: I.money, f: () => act.setTab("fin"), n: cs.filter(c => !c.paid).length },
    { id: "pedidos", l: "Pedidos", ic: I.bell, f: nPedidos ? act.abrirPedidos : () => act.openSettings("link"), n: nPedidos },
    { id: "fechar", l: "Fechar o dia", ic: I.moon, f: act.fecharDia },
    { id: "agora", l: "Só o agora", ic: I.target, f: act.agora },
    { id: "revisao", l: "Revisão", ic: I.chart, f: act.revisao },
    { id: "imposto", l: "Imposto", ic: I.receipt, f: act.abrirImposto },
  ];
  const linhas = per => {
    const f = noPeriodo(per), limite = addDays(t, -7);
    const rec = cs.filter(c => c.paid && f(c.paidAt)), feitas = db.sessions.filter(s => s.status === "done" && f(s.date));
    const abertas = cs.filter(c => !c.paid && f(c.createdAt)), atras = abertas.filter(c => c.createdAt < limite), aguard = abertas.filter(c => c.createdAt >= limite);
    return [
      { t: "Recebidas", rotN: "Cobranças", n: rec.length, v: soma(rec, c => c.amount), cor: "verde" },
      { t: "Sessões atendidas", rotN: "Sessões", n: feitas.length, v: soma(feitas, s => s.price - s.sublet), cor: "azul" },
      { t: "Aguardando pagamento", rotN: "Cobranças", n: aguard.length, v: soma(aguard, c => c.amount), cor: "laranja" },
      { t: "Atrasadas (mais de 7 dias)", rotN: "Cobranças", n: atras.length, v: soma(atras, c => c.amount), cor: "vermelho" },
    ];
  };
  const pf = conta.perfil || {}, temLink = !!(pf.link && pf.link.endereco), temCal = !!(pf.agendaCal && pf.agendaCal.token);
  return (
    <div className="page ini az-ini">
      <TopoInicio conta={conta} act={act} tema={tema} modo="consultorio" now={now} compacto />
      {avisos}
      <AcoesAzuis itens={acoes} />
      <CartaoSaldo rotulo={`Recebido em ${MES_LONGO[now.getMonth()]}`} valor={recebidoMes} sub={aReceber > 0 ? `${brl(aReceber)} a receber` : "Nada a receber agora"} onClick={() => act.setTab("fin")} />
      <GradeAtalhos itens={atalhos} />
      {atrasados.map(p => <PendingCard key={p.id} p={p} act={act} />)}
      <HojeConsultorio db={db} now={now} act={act} clima={<WeatherChip cidade={pf.cidade} act={act} sessao={prox} />} />
      {!temLink ? <CartaoNovidade icone={I.share} titulo="Seu link de agendamento" texto="Coloque na bio do Instagram: quem chega vê a sua página e já pede um horário." onClick={() => act.openSettings("link")} />
        : !temCal ? <CartaoNovidade icone={I.cal} titulo="Sessões no Google Agenda" texto="Veja a agenda do Avina junto com o resto do seu dia, no Google ou no iPhone." onClick={() => act.openSettings("calendario")} />
        : null}
      <CartaoResumo titulo="Resumo das cobranças" onAbrir={() => act.setTab("fin")} linhas={linhas} />
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

// Remarcou: o pedido de remarcar daquele paciente já foi atendido
const semPedidoRemarcar = (conf, pid) => Object.fromEntries(Object.entries(conf || {}).filter(([k, v]) => !(k.startsWith(pid + ":") && confirmacaoDe(v) === "remarcar")));
// Sessão online: o link da sala (só https) e a hora de mostrar o "Entrar" (15 min antes até o fim)
const salaDe = p => p && p.online && /^https:\/\/\S+/.test(p.sala || "") ? p.sala : null;
const horaDeEntrar = (it, now) => it.date === todayISO() && agoraMin(now) >= mins(it.time) - 15 && agoraMin(now) < mins(it.time) + DURACAO_SESSAO;
// Selos da sessão na agenda: online e a confirmação (à mão ou do próprio paciente, pelo link)
function SeloConfirmacao({ v, online }) {
  const c = confirmacaoDe(v);
  if (!c && !online) return null;
  return (
    <span className="selos">
      {online && <span className="selo online"><I.video />Online</span>}
      {c === "paciente" && <span className="selo ok"><I.check />Confirmou</span>}
      {c === "manual" && <span className="selo ok"><I.check />Confirmado</span>}
      {c === "remarcar" && <span className="selo alerta"><I.repeat />Pediu para remarcar</span>}
    </span>
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
        <div className="tl-row"><span /><span /><div className="tl-empty com-ilustra"><Ilustra n="cafe" /><b>Dia livre</b>Nada marcado para {diaCurto(iso)}.<br /><button className="ghost-chip" onClick={act.novoPaciente}><I.plus /> Novo {TERMO.s}</button></div></div>
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
                {(st === "up" || st === "proj") && <SeloConfirmacao v={(db.confirmados || {})[`${p.id}:${it.date}`]} online={!!p.online} />}
                {st === "up" && !p.online && chuvaPerto(it.date, it.time) && <span className="tm rainy">Chance de chuva {chuvaPerto(it.date, it.time).p}% · saia mais cedo</span>}
              </button>
              {st === "up" && salaDe(p) && horaDeEntrar(it, now) && <a className="entrar-sala" href={salaDe(p)} target="_blank" rel="noopener noreferrer" onClick={() => vibrar("toque")}><I.video /> Entrar</a>}
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

// A semana em grade (computador): um dia por coluna e as horas de cima para baixo, como num calendário.
// Arrastar a próxima sessão de alguém remarca (com Desfazer); clicar num horário vazio cadastra alguém ali.
const PX_HORA = 56, PASSO_MIN = 15;
function SemanaGrade({ db, sel, setSel, now, act }) {
  const t = todayISO(), ini = segunda(sel), nm = agoraMin(now);
  const dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  const porDia = dias.map(iso => itensDoDia(db, iso));
  // as horas vão do início ao fim do expediente, e esticam se tiver sessão fora dele
  const todos = porDia.flat().map(i => mins(i.time));
  const hIni = Math.min(PERFIL.horaIni ?? 8, ...todos.map(m => Math.floor(m / 60)));
  const hFim = Math.max(PERFIL.horaFim ?? 20, ...todos.map(m => Math.ceil((m + DURACAO_SESSAO) / 60)));
  const horas = Array.from({ length: hFim - hIni }, (_, i) => hIni + i);
  const corpo = useRef(null);
  const [arr, setArr] = useState(null); // { it, x0, y0, dx, dy, moveu, alvo: { iso, min } }
  const yDe = m => (m - hIni * 60) / 60 * PX_HORA;
  const alvoDe = (x, y) => {
    const r = corpo.current.getBoundingClientRect(), col = Math.min(6, Math.max(0, Math.floor((x - r.left) / (r.width / 7))));
    const min = Math.round((hIni * 60 + (y - r.top) / PX_HORA * 60) / PASSO_MIN) * PASSO_MIN;
    return { iso: dias[col], min: Math.min(hFim * 60 - DURACAO_SESSAO, Math.max(hIni * 60, min)) };
  };
  const podeArrastar = it => it.kind === "next" && it.date >= t;
  const pegar = (e, it) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArr({ it, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moveu: false, alvo: null });
  };
  const mover = e => {
    if (!arr) return;
    const dx = e.clientX - arr.x0, dy = e.clientY - arr.y0, moveu = arr.moveu || Math.abs(dx) + Math.abs(dy) > 6;
    setArr({ ...arr, dx, dy, moveu, alvo: moveu && podeArrastar(arr.it) ? alvoDe(e.clientX, e.clientY) : null });
  };
  const soltar = () => {
    if (!arr) return;
    const { it, moveu, alvo } = arr; setArr(null);
    if (!moveu) return act.openItem(it);
    if (alvo && (alvo.iso !== it.date || hhmm(alvo.min) !== it.time)) {
      if (alvo.iso < t || (alvo.iso === t && alvo.min < nm)) { vibrar("aviso"); return act.toast("Escolha um horário daqui para a frente"); }
      act.moverSessao(it.patient.id, alvo.iso, hhmm(alvo.min));
    }
  };
  const clicarVazio = (e, iso) => {
    if (e.target !== e.currentTarget) return;
    const { min } = alvoDe(e.clientX, e.clientY);
    if (iso < t) return;
    act.novoPacienteEm(iso, hhmm(Math.floor(min / 30) * 30));
  };
  // sessões que se cruzam no mesmo dia dividem a largura
  const faixas = itens => {
    const out = []; let grupo = [], fim = -1;
    const fecha = () => grupo.forEach((x, k) => out.push({ ...x, k, n: grupo.length }));
    itens.forEach(it => { const a = mins(it.time); if (a >= fim && grupo.length) { fecha(); grupo = []; } grupo.push({ it, a }); fim = Math.max(fim, a + DURACAO_SESSAO); });
    fecha();
    return out;
  };
  return (
    <section className="sg" aria-label="Semana em grade">
      <div className="sg-cab">
        <span />
        {dias.map((iso, i) => {
          const d = fromISO(iso), n = porDia[i].filter(x => situacao(x, now) !== "missed").length;
          return (
            <button key={iso} className={"sg-dia" + (iso === t ? " eh-hoje" : "") + (iso === sel ? " sel" : "") + (feriado(iso) ? " hol" : "")} onClick={() => setSel(iso)} title={feriado(iso) ? feriado(iso).name : undefined}>
              <small>{SEMANA[i]}</small><b className="num">{d.getDate()}</b>{n > 0 && <em className="num">{n}</em>}
            </button>
          );
        })}
      </div>
      <div className="sg-rolar">
        <div className="sg-grade" style={{ height: horas.length * PX_HORA }}>
          <div className="sg-horas">{horas.map(h => <span key={h} style={{ top: (h - hIni) * PX_HORA }}>{pad(h)}:00</span>)}</div>
          <div className="sg-corpo" ref={corpo} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={() => setArr(null)}>
            {horas.map(h => <i key={h} className="sg-linha" style={{ top: (h - hIni) * PX_HORA }} />)}
            {dias.map((iso, i) => (
              <div key={iso} className={"sg-col" + (iso === t ? " eh-hoje" : "") + (iso < t ? " passado" : "") + (!(PERFIL.diasTrab || [1, 2, 3, 4, 5]).includes(fromISO(iso).getDay()) ? " folga" : "")} onClick={e => clicarVazio(e, iso)}>
                {iso === t && nm >= hIni * 60 && nm <= hFim * 60 && <i className="sg-agora" style={{ top: yDe(nm) }} />}
                {faixas(porDia[i]).map(({ it, k, n }) => {
                  const st = situacao(it, now), p = it.patient, segurando = arr && arr.it === it && arr.moveu;
                  const cf = confirmacaoDe((db.confirmados || {})[`${p.id}:${iso}`]);
                  return (
                    <button key={p.id + it.kind + it.time} className={"sg-ses " + st + (podeArrastar(it) ? " arrasta" : "") + (segurando ? " segurando" : "")}
                      style={{ ...corVars(p), top: yDe(mins(it.time)), height: DURACAO_SESSAO / 60 * PX_HORA - 3, left: `calc(${(k / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, ...(segurando ? { transform: `translate(${arr.dx}px, ${arr.dy}px)` } : {}) }}
                      onPointerDown={e => pegar(e, it)} aria-label={`${it.time}, ${p.name}: ${ROTULO[st]}${podeArrastar(it) ? ". Arraste para remarcar" : ""}`}>
                      <b>{p.name}</b>
                      <small className="num">{it.time}{p.online ? " · online" : ""}{cf === "paciente" || cf === "manual" ? " · ✓" : cf === "remarcar" ? " · remarcar" : ""}</small>
                    </button>
                  );
                })}
                {arr && arr.alvo && arr.alvo.iso === iso && <i className="sg-fantasma" style={{ top: yDe(arr.alvo.min), height: DURACAO_SESSAO / 60 * PX_HORA - 3 }}><span className="num">{hhmm(arr.alvo.min)}</span></i>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="sg-dica">Arraste a próxima sessão de alguém para remarcar. Clique num horário vazio para marcar alguém novo.</p>
    </section>
  );
}

function AgendaTab({ db, now, act, tema }) {
  const wide = useWide();
  const [sel, setSel] = useState(todayISO());
  const [vista, setVista] = useState(() => window.matchMedia("(min-width: 900px)").matches ? "grade" : "semana");
  const n = itensDoDia(db, sel).filter(i => i.kind !== "log" || i.session.status === "done").length;
  const grade = wide && vista === "grade";
  const ini = segunda(sel), fim = addDays(ini, 6);
  const tituloSemana = fromISO(ini).getMonth() === fromISO(fim).getMonth() ? `${fromISO(ini).getDate()} a ${fromISO(fim).getDate()} de ${MES_LONGO[fromISO(fim).getMonth()]}` : `${dm(ini)} a ${dm(fim)}`;
  return (
    <div className="page">
      <TopBar eyebrow={grade ? tituloSemana : `${n ? `${n} ${n === 1 ? "sessão" : "sessões"}` : "Sem sessões"} ${sel === todayISO() ? "hoje" : "neste dia"}`} title="Agenda" act={act} tema={tema} mais={{ l: `Novo ${TERMO.s}`, f: act.novoPaciente }}
        extra={<button className="icon-btn" onClick={act.livres} aria-label="Horários livres para divulgar"><I.share /></button>} />
      {wide && (
        <div className="ag-barra">
          <Seg value={vista === "grade" ? "grade" : "mes"} onChange={setVista} options={[{ v: "grade", l: "Semana" }, { v: "mes", l: "Mês e dia" }]} />
          {grade && <div className="ag-nav">
            <button className="mini" onClick={() => setSel(addDays(sel, -7))} aria-label="Semana anterior"><I.chevL /></button>
            <button className="mini" onClick={() => setSel(todayISO())} disabled={segunda(todayISO()) === ini}>Hoje</button>
            <button className="mini" onClick={() => setSel(addDays(sel, 7))} aria-label="Próxima semana"><I.chev /></button>
          </div>}
          {grade && <button className="chip-btn" onClick={() => act.confirmar(addDays(todayISO(), 1))}><I.send />Confirmar amanhã</button>}
        </div>
      )}
      {grade ? <SemanaGrade db={db} sel={sel} setSel={setSel} now={now} act={act} /> :
      <div className="cols">
        <div className="col"><WeekBar db={db} sel={sel} setSel={setSel} vista={vista === "grade" ? (wide ? "mes" : "semana") : vista} setVista={setVista} now={now} /></div>
        <div className="col">
          <div className="day-head" style={wide ? { marginTop: 0 } : undefined}><h2>{relativo(sel)}</h2><span>{diaCurto(sel)}</span></div>
          {sel >= todayISO() && itensDoDia(db, sel).some(i => i.kind !== "log") && <div className="small-acts"><button className="chip-btn" onClick={() => act.confirmar(sel)}><I.send />Mandar confirmação</button></div>}
          <Timeline db={db} iso={sel} now={now} act={act} />
        </div>
      </div>}
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
        {s.status === "done" && <button className="btn ghost" onClick={() => act.abrirNotas(s.patientId, s.id)}><I.key /> {(db.notas || []).some(n => n.sid === s.id) ? "Ver a evolução da sessão" : "Registrar a evolução"}</button>}
        {charge && <button className="btn ghost" onClick={() => act.openCharge(charge.id)}><I.receipt /> Ver cobrança</button>}
        {ultima && <ConfirmButton icon={<I.undo />} label="Desfazer registro" titulo="Desfazer este registro?" texto="A sessão volta a ficar como antes de você marcar, e o que foi lançado junto com ela sai." acao="Desfazer" onConfirm={() => act.desfazer(s.id)} />}
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
      <TopBar eyebrow={`${db.patients.length} ${db.patients.length === 1 ? TERMO.s : TERMO.p}`} title={TERMO.P} act={act} tema={tema} mais={{ l: `Novo ${TERMO.s}`, f: act.novoPaciente }}
        extra={<button className="icon-btn" onClick={act.importarAgenda} aria-label="Trazer da agenda antiga"><I.upload /></button>} />
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
          {ativos.length === 0 && <div className={"empty" + (busca ? "" : " com-ilustra")}>{!busca && <Ilustra n="arquivo" />}<b>{busca ? "Ninguém com esse nome" : `Nenhum ${TERMO.s} ainda`}</b>{busca ? "Confira a grafia." : "Toque no + para cadastrar o primeiro."}</div>}
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

// Pix recebido (foto ou comprovante compartilhado) que bate com sessões em aberto: de quem é?
function PixSessaoSheet({ db, pre, grupos, onClose, act }) {
  const pac = id => db.patients.find(p => p.id === id) || { name: "?" };
  return (
    <Sheet title={`Pix de ${brlReal(pre.valor)} recebido`} sub={`${pre.pagador ? `De ${pre.pagador} · ` : ""}${pre.data === todayISO() ? "hoje" : dm(pre.data)}. É pagamento de sessão?`} onClose={onClose}>
      {grupos.map(g => { const p = pac(g.pid), n = g.ids.length; return (
        <button key={g.pid} className="txn" onClick={() => (n ? act.pixPagou(g.ids, pre.data, pre.tid) : act.openCharge(db.charges.find(c => c.patientId === g.pid && !c.paid && !c.hidden).id))}>
          <span className="txn-av">{iniciais(p.name)}<i className="cdot" style={{ background: corDe(p).cor }} /></span>
          <span className="mid"><span className="nm">{p.name}</span><span className="sb">{n ? `${n === 1 ? "1 sessão" : `${n} sessões`} em aberto desde ${dm(g.desde)} · marcar como pago` : `${g.abertas} em aberto (${brl(g.total)}): o valor não bate, ver cobrança`}</span></span>
          <span className="amt pos">{n ? <I.check /> : <Money v={g.total} />}</span>
        </button>
      ); })}
      <button className="btn ghost" onClick={() => act.pixNaoSessao(pre)}>Não é de sessão{act.usaPessoal ? ": anotar como entrada" : ""}</button>
      {pre.tid && <button className="btn text" onClick={() => { act.tirarPixPendente(pre.tid); onClose(); }}>Ignorar este Pix</button>}
    </Sheet>
  );
}

// Reajuste da sessão: quanto a inflação (IPCA) andou desde o último valor e o valor novo sugerido
function reajusteDe(p, inf = lerInflacao()) {
  const desde = p.reajusteEm || p.desde, t = todayISO();
  if (!p.active || !desde || diffDias(desde, t) < 365 || (p.reajusteAdiado && p.reajusteAdiado > t)) return null;
  const ac = acumulado(inf.ipca, desde);
  return { meses: Math.floor(diffDias(desde, t) / 30), ac, sug: ac && ac.pct > 0 ? valorSugerido(p.price, ac.pct) : null };
}
const FMT_PCT1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pctTxt = v => `${FMT_PCT1.format(v)}%`;
// Recado para o paciente, pronto para mandar (tom de combinado, não de cobrança)
function recadoReajuste(p, novo, ac) {
  const prox = new Date(); prox.setMonth(prox.getMonth() + 1, 1);
  return `Oi, ${primeiro(p.name)}! Tudo bem? Queria combinar com você: a partir de ${MES_LONGO[prox.getMonth()].toLowerCase()}, o valor da sessão passa de ${brlReal(p.price)} para ${brlReal(novo)}. É a correção da inflação desde o último reajuste (${pctTxt(ac.pct)} pelo IPCA). Se quiser, conversamos sobre isso na sessão.`;
}

function PatientSheet({ db, pid, onClose, act }) {
  const inf = useInflacao();
  const p = db.patients.find(x => x.id === pid);
  if (!p) return null;
  const reaj = reajusteDe(p, inf);
  const foneWa = (d => (d.length >= 10 && d.length <= 11 ? "55" + d : d))((p.phone || "").replace(/\D/g, ""));
  const hist = db.sessions.filter(s => s.patientId === pid).sort((a, b) => b.date.localeCompare(a.date));
  const feitas = hist.filter(s => s.status === "done");
  const ab = sessoesAbertas(db, pid).length;
  const recebido = soma(db.charges.filter(c => c.patientId === pid && c.paid), c => c.amount);
  const nNotas = (db.notas || []).filter(n => n.pid === pid && !n.tipo).length;
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
      {salaDe(p) && <div className="note"><I.video /><span>Atendimento online. <a href={salaDe(p)} target="_blank" rel="noopener noreferrer">Abrir a sala</a> · <button type="button" className="link" onClick={() => copiarTexto(salaDe(p), act, "Link da sala copiado")}>copiar o link</button></span></div>}
      {reaj && (
        <div className="note amber"><I.money /><span>
          Há {reaj.meses} meses com o mesmo valor ({brlReal(p.price)}).{" "}
          {reaj.ac ? (reaj.ac.pct > 0
            ? <>A inflação nesse tempo foi de <b>{pctTxt(reaj.ac.pct)}</b> (IPCA de {nomeMesCurto(reaj.ac.de)} a {nomeMesCurto(reaj.ac.ate)}, Banco Central): corrigido, o valor fica {brlReal(p.price * reaj.ac.fator)}.</>
            : <>A inflação nesse tempo ficou em {pctTxt(reaj.ac.pct)}: não precisa reajustar agora.</>)
            : <>Quando reajustar, é só editar o cadastro.</>}
          <span className="reaj-acts">
            {reaj.sug > p.price && <button className="bub-act" onClick={() => act.reajustar(p.id, reaj.sug)}><I.check /> Passar para {brl(reaj.sug)}</button>}
            {reaj.sug > p.price && (foneWa.length >= 12
              ? <a className="bub-act" href={`https://wa.me/${foneWa}?text=${encodeURIComponent(recadoReajuste(p, reaj.sug, reaj.ac))}`} target="_blank" rel="noopener noreferrer"><I.send /> Avisar {primeiro(p.name)}</a>
              : <button className="bub-act" onClick={() => copiarTexto(recadoReajuste(p, reaj.sug, reaj.ac), act, "Recado copiado")}><I.send /> Copiar recado</button>)}
            <button className="bub-act" onClick={() => act.adiarReajuste(p.id)}>Lembrar em 6 meses</button>
          </span>
        </span></div>
      )}
      <div className="pac-acoes">
        <button className="pac-acao" onClick={() => act.abrirNotas(p.id)}><Ilustra n="cadeados" /><span><b>Prontuário</b><small>{nNotas ? `${nNotas} ${nNotas === 1 ? "registro" : "registros"} · trancado` : "Só você lê"}</small></span></button>
        <button className="pac-acao" onClick={() => act.abrirRecibo(p.id)}><Ilustra n="arquivo" /><span><b>Recibo</b><small>{recebido > 0 ? "PDF para o reembolso" : "Depois do 1º pagamento"}</small></span></button>
        <button className="pac-acao" onClick={() => act.abrirDocumentos(p.id)}><span className="pac-acao-ic"><I.doc /></span><span><b>Documentos</b><small>Declaração e contrato</small></span></button>
      </div>
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
      <ConfirmButton label={`Excluir ${TERMO.s}`} titulo={`Excluir ${primeiro(p.name)}?`} texto="O cadastro sai da sua agenda. Isso não dá para desfazer." acao="Excluir" onConfirm={() => act.excluir(p.id)} />
    </Sheet>
  );
}

const mascaraCPF = s => String(s || "").replace(/\D/g, "").slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
function PatientForm({ initial, total = 0, perfil, pre, onSave, onClose }) {
  const pf = perfil || {};
  const [f, setF] = useState(() => initial
    ? { ...initial, color: corDe(initial).id, price: String(initial.price).replace(".", ","), sublet: String(initial.sublet).replace(".", ",") }
    : { name: (pre && pre.name) || "", phone: (pre && pre.phone) || "", color: CORES[total % CORES.length].id, price: pf.valorPadrao ? fmtNum(pf.valorPadrao) : "", sublet: pf.subPadrao ? fmtNum(pf.subPadrao).replace(",00", "") : "", subletType: pf.subTipo || "fixed", freq: 7, time: (pre && pre.time) || "18:00", billing: "session", packageSize: 4, nextDate: (pre && pre.nextDate) || todayISO(), active: true });
  const [erro, setErro] = useState("");
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const price = num(f.price), sub = num(f.sublet);
  const liq = price - (f.subletType === "percent" ? price * sub / 100 : sub);
  const salvarForm = e => {
    e.preventDefault();
    if (!f.name.trim()) return setErro(`Escreva o nome do ${TERMO.s}.`);
    if (!(price > 0)) return setErro("Falta o valor da sessão.");
    if (liq < 0) return setErro("A sublocação ficou maior que o valor da sessão.");
    if (f.online && f.sala && !/^https:\/\/\S+\.\S+/.test(f.sala)) return setErro("O link da sala precisa começar com https://");
    const { outroPaga, ...semAux } = f;
    onSave({ ...semAux, pagadorNome: (f.pagadorNome || "").trim(), id: f.id || uid(), name: f.name.trim(), price, sublet: sub, packageSize: Number(f.packageSize) || 4, active: true, desde: f.desde || todayISO(), reajusteEm: initial && price !== initial.price ? todayISO() : f.reajusteEm });
  };
  return (
    <Sheet title={initial ? `Editar ${TERMO.s}` : `Novo ${TERMO.s}`} sub="Preencha uma vez. Datas e contas ficam comigo." onClose={onClose}>
      <form onSubmit={salvarForm} className="stack" noValidate>
        <div className="fields">
          <Field label="Nome" icon={<I.user />} htmlFor="f-nome"><input id="f-nome" value={f.name} onChange={e => up("name", e.target.value)} placeholder={`Nome do ${TERMO.s}`} autoComplete="off" /></Field>
          <Field label="WhatsApp (opcional)" icon={<I.phone />} htmlFor="f-tel"><input id="f-tel" inputMode="tel" value={f.phone} onChange={e => up("phone", e.target.value)} placeholder="43 99999-0000" /></Field>
          <Field label="CPF (opcional, para recibo e imposto)" htmlFor="f-cpf"><input id="f-cpf" inputMode="numeric" value={mascaraCPF(f.cpf)} onChange={e => up("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="000.000.000-00" /></Field>
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
          <Field label="Atendimento"><Seg value={f.online ? "online" : "presencial"} onChange={v => up("online", v === "online")} options={[{ v: "presencial", l: "Presencial" }, { v: "online", l: "Online" }]} /></Field>
          {f.online && <Field label="Link da sala (Meet, Zoom, Jitsi…)" icon={<I.video />} htmlFor="f-sala"><input id="f-sala" type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={f.sala || ""} onChange={e => up("sala", e.target.value.trim())} placeholder="https://meet.google.com/abc-defg-hij" /></Field>}
        </div>
        {f.online && <div className="hint">O link vai junto na confirmação e, na hora da sessão, aparece um botão “Entrar” na agenda.</div>}
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
        <Toggle on={!!f.pagadorNome || !!f.outroPaga} onClick={() => setF(x => x.pagadorNome || x.outroPaga ? { ...x, outroPaga: false, pagadorNome: "", pagadorCpf: "" } : { ...x, outroPaga: true })}>Quem paga é outra pessoa (pai, mãe, responsável)</Toggle>
        {(!!f.pagadorNome || !!f.outroPaga) && <div className="fields">
          <Field label="Nome de quem paga" htmlFor="f-pn"><input id="f-pn" value={f.pagadorNome || ""} onChange={e => up("pagadorNome", e.target.value)} placeholder="Nome completo" /></Field>
          <Field label="CPF de quem paga" htmlFor="f-pc"><input id="f-pc" inputMode="numeric" value={mascaraCPF(f.pagadorCpf)} onChange={e => up("pagadorCpf", e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="000.000.000-00" /></Field>
        </div>}
        {erro && <div className="error" role="alert">{erro}</div>}
        <button className="btn" type="submit">{initial ? "Salvar alterações" : `Cadastrar ${TERMO.s}`}</button>
      </form>
    </Sheet>
  );
}

/* Porquinho do card "Guarde R$": sai pela borda de cima do card e fica flutuando devagar */
const Porquinho = () => (
  <div className="porco" aria-hidden="true">
    <img src={PORQUINHO} alt="" width="380" height="389" decoding="async" />
  </div>
);

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
            <div className="reserve com-porco">
              <div style={{ minWidth: 0 }}><b>Guarde {brl(liq * PERFIL.reserva / 100)}</b><span>Para o imposto deste mês ({String(PERFIL.reserva).replace(".", ",")}% do líquido). É uma estimativa simples: confirme com seu contador.</span></div>
              <Porquinho />
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
            {filtro === "abertas" && (abertas.length === 0 ? <div className="empty com-ilustra"><Ilustra n="trofeu" /><b>Tudo em dia</b>Ninguém devendo agora.</div> : abertas.map(c => (
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
      {c.paid && p && <button className="btn ghost" onClick={() => act.abrirRecibo(p.id, c.id)}><I.receipt /> {c.reciboEm ? "Recibo de novo" : "Fazer recibo em PDF"}</button>}
    </Sheet>
  );
}

/* =========================================================
   13. PESSOAL · INÍCIO, GASTOS E CONTAS
   ========================================================= */

const PessoalHome = lazy(() => import("./telas/pessoal.jsx").then(m => ({ default: m.PessoalHome })));
const LojaCaixa = lazy(() => import("./telas/loja.jsx").then(m => ({ default: m.LojaCaixa })));
const LojaGastos = lazy(() => import("./telas/loja.jsx").then(m => ({ default: m.LojaGastos })));
const LojaLista = lazy(() => import("./telas/loja.jsx").then(m => ({ default: m.LojaLista })));
const LojaResumo = lazy(() => import("./telas/loja.jsx").then(m => ({ default: m.LojaResumo })));
const LojaSheet = lazy(() => import("./telas/loja.jsx").then(m => ({ default: m.LojaSheet })));

const GastosTab = lazy(() => import("./telas/pessoal.jsx").then(m => ({ default: m.GastosTab })));

const ContasTab = lazy(() => import("./telas/pessoal.jsx").then(m => ({ default: m.ContasTab })));

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
const FMT_REAIS = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reais = v => FMT_REAIS.format(Math.round(v * 100) / 100);

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
  const modo = estado === "contando" || estado === "resposta" ? "feliz" : estado === "faltando" || estado === "erro" ? "confuso" : estado === "falando" ? "falando" : estado === "ouvindo" || estado === "teclado" || estado === "pensando" ? "ouvindo" : "parado";
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

// Logo de verdade da empresa. Ordem: foto que a pessoa escolheu > logo da marca conhecida > site escolhido > ícone da categoria
const logoPropria = nome => (nome && LOGOS[normalizar(nome)]) || null;
function MarcaLogo({ marca, site, nome, cat, className = "" }) {
  const m = marcaPorId(marca);
  const foto = logoPropria(nome) || (m && logoPropria(m.nome));
  const alvo = m && m.site ? m.site : site || null;
  const rotulo = (m && m.nome) || nome || alvo || "";
  if (foto) return <span className={className + " logo foto"} title={rotulo}><img src={foto} alt="" /></span>;
  if (alvo) return <LogoDoSite key={alvo} site={alvo} rotulo={rotulo} className={className} />;
  // marca conhecida sem logo, ou sem categoria (o banco do Open Finance): as iniciais do nome
  if (m || (!cat && rotulo)) return <Monograma nome={rotulo} className={className} />;
  return <span className={className + " cat"} style={catVars(cat)}><CatIcon cat={cat} /></span>;
}
// Tenta as fontes em ordem (ícone grande do site > Google novo > Google antigo); se nada servir, mostra as iniciais
function LogoDoSite({ site, rotulo, className }) {
  const fontes = fontesLogo(site);
  const [i, setI] = useState(() => { const f = fonteLembrada(site); return f === undefined ? 0 : f; });
  if (i < 0 || i >= fontes.length) return <Monograma nome={rotulo} className={className} />;
  const f = fontes[i];
  const proxima = () => { const n = i + 1; if (n >= fontes.length) { lembrarFonte(site, -1); setI(-1); } else setI(n); };
  return (
    <span className={className + " logo" + (i === 0 ? " cheio" : "")} title={rotulo}>
      <img key={f.url} src={f.url} alt="" loading="lazy" referrerPolicy="no-referrer" decoding="async"
        onError={proxima}
        onLoad={e => { if (e.currentTarget.naturalWidth < f.min) proxima(); else lembrarFonte(site, i); }} />
    </span>
  );
}
function Monograma({ nome, className }) {
  const { ini, cor } = monograma(nome || "?");
  return <span className={className + " mono"} style={{ background: cor }} title={nome} aria-hidden="true"><b>{ini}</b></span>;
}

/* ---------- Ilustrações 3D e conquistas ----------
   Cada ilustração tem um sentido fixo no app: troféu = conquistas e metas, dinheiro = caixinhas e tetos,
   arquivo = consultório organizado, cadeados = privacidade, café = rotina leve e dia livre, iPad = o app em qualquer tela. */
const Ilustra = ({ n, className = "", alt = "" }) => <img className={"ilustra " + className} src={`${BASE}ilustras/${n}.webp`} alt={alt} loading="lazy" decoding="async" draggable="false" />;
const ajudaConquistas = () => ({ todayISO, fromISO, pad, soma, liquidoMes });

// Cartão do Início: a conquista que está mais perto
function ProximaConquista({ act, trilhas }) {
  const c = proximaConquista(act.conquistas || [], trilhas);
  if (!c) return null;
  return (
    <button className="conq-prox" onClick={() => act.openSettings("conquistas")}>
      <Ilustra n={c.ilustra} className="conq-prox-img" />
      <span className="conq-prox-tx">
        <small>Próxima conquista · {c.meta > 1 ? `${c.atual} de ${c.meta}` : "quase lá"}</small>
        <b>{c.titulo}</b>
        <span className="conq-bar" aria-hidden="true"><i style={{ width: `${Math.round(c.pct * 100)}%` }} /></span>
        <small>{c.texto}</small>
      </span>
    </button>
  );
}

// Comemoração: a ilustração entra com brilho, confete cai e o celular vibra (sem movimento se o aparelho pedir)
function Celebra({ c, total, onFim, onVer }) {
  const tela = useRef(null);
  const nv = nivelDe(total);
  const fimRef = useRef(onFim); fimRef.current = onFim;
  useCamada(() => fimRef.current());
  useEffect(() => {
    vibrar("ok");
    const k = e => { if (e.key === "Escape") fimRef.current(); };
    window.addEventListener("keydown", k);
    const cv = tela.current;
    if (semMovimento() || !cv) return () => window.removeEventListener("keydown", k);
    const g = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = window.innerWidth * dpr, H = cv.height = window.innerHeight * dpr;
    const cores = ["#4A62FF", "#8B6CFF", "#3DD68C", "#FFB648", "#FF6B8B", "#38C6E8"];
    const ps = Array.from({ length: 150 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .25, y: H * .4, vx: (Math.random() - .5) * 20 * dpr, vy: (-Math.random() * 17 - 5) * dpr, r: (4 + Math.random() * 5) * dpr, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cores[(Math.random() * cores.length) | 0], fita: Math.random() < .6 }));
    let raf, ult = 0; const t0 = performance.now();
    const passo = t => {
      const dt = ult ? Math.min(2, (t - ult) / 16.7) : 1; ult = t;
      const vida = (t - t0) / 2800;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = Math.max(0, 1 - vida * vida);
      ps.forEach(p => {
        p.vy += .42 * dpr * dt; p.vx *= .985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c;
        if (p.fita) g.fillRect(-p.r, -p.r * .35, p.r * 2, p.r * .7); else { g.beginPath(); g.arc(0, 0, p.r * .55, 0, 7); g.fill(); }
        g.restore();
      });
      if (vida < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", k); };
  }, []);
  return createPortal(
    <div className="festa" onClick={onFim} role="presentation">
      <canvas ref={tela} className="festa-confete" aria-hidden="true" />
      <div className="festa-box" role="alertdialog" aria-modal="true" aria-labelledby="festa-t" aria-describedby="festa-d" onClick={e => e.stopPropagation()}>
        <div className="festa-arte"><i className="festa-luz" aria-hidden="true" /><Ilustra n={c.ilustra} className="festa-img" /></div>
        <span className="festa-rot">Conquista desbloqueada</span>
        <h3 id="festa-t">{c.titulo}</h3>
        <p id="festa-d">{TRILHAS[c.trilha].nome} · {total} {total === 1 ? "conquista" : "conquistas"} · nível {nv.nome}</p>
        <div className="alerta-acoes">
          <button className="alerta-btn" onClick={onVer}>Ver todas</button>
          <button className="alerta-btn forte" onClick={onFim} autoFocus>Continuar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Entende a frase: primeiro procura um paciente ("Felipe veio"), senão é gasto/entrada
function entenderFrase(t, db) {
  const c = interpretarConsultorio(t, db);
  const itens = interpretarVarios(t);
  if (c && (c.ok || !itens.some(i => i.valor > 0))) return { tipo: "consult", c };
  return { tipo: "gastos", itens };
}
const POSSO_GASTAR = /\b(posso|da pra|da para|consigo|daria pra|daria para|devo)\s+(gastar|comprar|torrar)\b/;

/* ---------- A Bolinha do app de celular (chat nativo, ponte 2) ----------
   A mesma conversa da VozBarra, mas a resposta volta como dados e nada é salvo aqui: gasto ou entrada vira uma
   proposta ({ tipo: "gastos", itens }) que o app mostra; se a pessoa confirmar, o app pede "lancar".
   Dentro do app, as mensagens são neutras (sem falar de plano). */
const SEM_PERMISSAO_IA = "Tudo bem. Sem a permissão eu não consigo usar a IA para responder.";
const itemParaApp = it => {
  const m = it.marca ? marcaPorId(it.marca) : null;
  return {
    tipo: it.tipo === "entrada" ? "entrada" : "saida", valor: Math.round(Number(it.valor) * 100) / 100, data: addDays(todayISO(), -(it.off || 0)),
    cat: it.cat, desc: it.desc || "", marca: it.marca || null, site: (m && m.site) || null, banco: null,
    ...(it.moeda ? { moeda: it.moeda, valorOrig: it.valorOrig ?? null, cotacao: it.cotacao ?? null, iof: !!it.iof } : {}),
  };
};
async function responderBolinha(db, usaPessoal, texto, historico) {
  const t = String(texto || "").trim().slice(0, 600);
  if (!t) return { tipo: "erro", texto: "Escreva o que você quer anotar ou perguntar." };
  const s = semAcento(t), conversando = Array.isArray(historico) && historico.length > 0;
  const hist = (conversando ? historico : []).slice(-8).map(m => ({ quem: m && m.quem === "ela" ? "ela" : "eu", texto: String((m && m.texto) || "").slice(0, 1200) }));
  const proposta = itens => {
    const its = itens.filter(i => i.valor > 0).map(itemParaApp);
    return { tipo: "gastos", texto: its.length > 1 ? `Anoto estes ${its.length} lançamentos?` : "Anoto assim?", itens: its };
  };
  // consultório: quem marca é a agenda (lá tem a confirmação e o desfazer)
  const naAgenda = c => ({ tipo: "resposta", texto: c.ok
    ? `Entendi: ${primeiro(c.p.name)}, ${textoAcao(c, TERMO).toLowerCase()}. Isso fica com a agenda: abra o Consultório no Avina e marque por lá, onde dá para conferir e desfazer.`
    : `Entendi ${primeiro(c.p.name)}, mas não o que aconteceu. Diga "veio", "faltou", "pagou" ou "remarca pra quinta às 15h".` });
  const perguntar = async () => {
    if (!iaDisponivel()) return { tipo: "erro", texto: navigator.onLine === false ? "Sem internet agora. Tente de novo quando a conexão voltar." : "Para responder perguntas eu preciso de internet." };
    if (!(await permitirIA())) return { tipo: "erro", texto: SEM_PERMISSAO_IA };
    try {
      const j = await chamarIA("/perguntar", { pergunta: t, contexto: contextoPergunta(db, usaPessoal), historico: hist }, 25000);
      const resp = String(j.resposta || "").trim();
      return resp ? { tipo: "resposta", texto: resp } : { tipo: "erro", texto: "Não consegui responder agora. Tente perguntar de outro jeito." };
    } catch (e) { return { tipo: "erro", texto: msgIA(e) }; }
  };
  if (/^\s*(cancela|cancelar|esquece|deixa pra la|deixa para la)\b/.test(s)) return { tipo: "resposta", texto: "Tudo bem, não anotei nada." };
  // "obrigado", "tchau": encerra com educação
  if (conversando && FIM_CONVERSA.test(s)) return { tipo: "resposta", texto: "Por nada! Se precisar, é só me chamar." };
  // "posso gastar 300 no sábado?": a conta é feita aqui mesmo, com a previsão do mês (sem internet)
  if (usaPessoal && POSSO_GASTAR.test(s)) {
    const { respostaGastar } = await import("./telas/pessoal.jsx");
    return { tipo: "resposta", texto: respostaGastar(db, t) };
  }
  const r = entenderFrase(t, db);
  // "quanto gastei nos últimos 3 meses?" é pergunta, mesmo com número
  if (perguntaClara(t)) return perguntar();
  const ok = r.tipo === "consult" ? r.c.ok : r.itens.length > 0 && r.itens.every(i => i.valor > 0) && usaPessoal;
  if (ok) {
    if (r.tipo === "consult") return naAgenda(r.c);
    // entendeu, mas com cara de chute (sem saber onde foi, ou sobrou valor na frase): confere com a IA
    if (duvidoso(r, t) && iaDisponivel() && (await permitirIA())) {
      try {
        const r2 = await entenderIA(t, db);
        if (r2 && r2.tipo === "pergunta") return perguntar();
        if (r2 && r2.tipo === "gastos") return proposta(r2.itens);
      } catch (e) {}
    }
    return proposta(r.itens);
  }
  const gastoSemPessoal = { tipo: "erro", texto: "Para anotar gastos, ligue o Pessoal em Perfil → Como você usa o app." };
  if (r.tipo === "gastos" && !usaPessoal && r.itens.length && r.itens.every(i => i.valor > 0) && !ehPergunta(t)) return gastoSemPessoal;
  // pergunta ("quanto gastei de uber?"), ou qualquer coisa no meio de uma conversa ("e em setembro?")
  if (ehPergunta(t) || (conversando && t.split(/\s+/).length >= 2)) return perguntar();
  // o app não entendeu sozinho: pede ajuda à IA antes de desistir ("torrei 45 conto no boteco")
  if (iaDisponivel() && t.split(/\s+/).length >= 2) {
    if (!(await permitirIA())) return { tipo: "erro", texto: SEM_PERMISSAO_IA };
    try {
      const r2 = await entenderIA(t, db);
      if (r2 && r2.tipo === "pergunta") return perguntar();
      if (r2 && r2.tipo === "consult") return naAgenda(r2.c);
      if (r2 && r2.tipo === "gastos" && usaPessoal) return proposta(r2.itens);
    } catch (e) { if (String((e && e.message) || "").startsWith("limite") || (e && e.message) === "cota") return { tipo: "erro", texto: msgIA(e) }; }
  }
  if (r.tipo === "consult") return naAgenda(r.c);
  if (r.itens.length && r.itens.every(i => i.valor > 0) && !usaPessoal) return gastoSemPessoal;
  return { tipo: "erro", texto: r.itens.some(i => i.valor > 0) ? "Faltou o valor de alguma coisa." : "Não peguei o valor. Ex.: “gastei 30 no uber”." };
}

/* ---------- A conversa com a Bolinha, com cara de chat de IA (estilos em src/chat.css) ----------
   Sem conversa: a Bolinha grande, "Olá, Fulano" e sugestões em chips acima do campo. Com conversa: o que você
   diz em pílula à direita; a resposta dela em texto corrido à esquerda (sem balão), aparecendo palavra por palavra,
   com ouvir, copiar e gostei/não gostei embaixo. */
const K_NOTA_BOLINHA = "agenda-bolinha-notas"; // gostei/não gostei: fica só neste aparelho (as últimas 50)
const IC_CHAT = {
  gostei: () => <Svg><path d="M7 10v11" /><path d="M15 5.9L14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z" /></Svg>,
  naoGostei: () => <Svg><path d="M17 14V3" /><path d="M9 18.1l1-4.1H4.2a2 2 0 0 1-1.9-2.6l2.3-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.8a2 2 0 0 0-1.8 1.1L12 22a3.1 3.1 0 0 1-3-3.9z" /></Svg>,
  enviar: () => <Svg sw={2.4}><path d="M12 19V5.5M6 11l6-6 6 6" /></Svg>,
};
// Sugestões da tela vazia: só o que ela sabe responder com os modos ligados (sem internet, só as que ela faz sozinha).
// "escrever" vai para o campo sem enviar (anotar de verdade é com você); "enviar" é o que vai, quando o rótulo é curto.
function sugestoesBolinha(usaPessoal) {
  const comIA = iaDisponivel(), consult = PERFIL.consultorio !== false;
  const d = fromISO(todayISO());
  const mes = MES_LONGO[d.getDate() <= 3 ? (d.getMonth() + 11) % 12 : d.getMonth()]; // no começo do mês, o mês que passou
  return [
    usaPessoal && comIA && { t: "Quanto gastei este mês?" },
    usaPessoal && { t: "Posso gastar R$ 200 no sábado?" },
    consult && comIA && { t: "Quem está devendo?", enviar: "Quem está me devendo?" },
    usaPessoal && comIA && { t: `Maiores gastos de ${mes}`, enviar: `Quais foram os meus maiores gastos de ${mes}?` },
    usaPessoal && { t: "Anotar: 30 no Uber", escrever: "Gastei 30 no Uber" },
    consult && comIA && { t: "Quem eu atendo amanhã?" },
    consult && comIA && { t: "Quanto recebi este mês?" },
  ].filter(Boolean);
}
// "Pensando": a Bolinha se mexe e o texto vai dizendo o que ela está fazendo
const PENSANDO = ["Lendo seu pedido…", "Olhando seus números…", "Escrevendo a resposta…"];
function ChatPensando() {
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= PENSANDO.length - 1) return; const t = setTimeout(() => setI(i + 1), 1600); return () => clearTimeout(t); }, [i]);
  return (
    <div className="chat-msg ela chat-pensando" role="status">
      <span className="chat-pensa-bola"><Bolinha estado="pensando" /></span>
      <span className="digitando chat-pensa-tx" key={i}>{PENSANDO[i]}</span>
    </div>
  );
}
// A resposta aparece palavra por palavra (rápido: no máximo ~1 s; com "reduzir movimento", de uma vez).
// O leitor de tela recebe o texto inteiro de uma vez só, e não pedaço por pedaço.
function TextoQueSurge({ texto, onAndou, onFim }) {
  const partes = useMemo(() => String(texto).split(/(\s+)/), [texto]);
  const [n, setN] = useState(() => semMovimento() ? partes.length : 0);
  useEffect(() => {
    if (n >= partes.length) { if (onFim) onFim(); return; }
    const porVez = Math.max(1, Math.ceil(partes.length / 2 / 40)); // palavras por passo: respostas longas andam mais rápido
    const t = setTimeout(() => setN(x => Math.min(partes.length, x + porVez * 2)), 26);
    if (onAndou) onAndou();
    return () => clearTimeout(t);
  }, [n, partes.length]);
  // a estrutura fica igual depois de pronta: assim o leitor de tela não lê a resposta duas vezes
  return <><span className="chat-sr">{texto}</span><span aria-hidden="true">{n >= partes.length ? texto : partes.slice(0, n).join("")}</span></>;
}
// Uma resposta da Bolinha: o texto e, quando ele termina de aparecer, as ações (a Bolinha pequena à esquerda)
function MsgBolinha({ m, falando, temVoz, nota, copia, onOuvir, onCopiar, onNota, onAndou }) {
  const [pronta, setPronta] = useState(false);
  return (
    <div className={"chat-msg ela" + (falando ? " falando" : "")}>
      <p className="chat-texto"><TextoQueSurge texto={m.texto} onAndou={onAndou} onFim={() => setPronta(true)} /></p>
      <div className={"chat-acoes" + (pronta ? " on" : "")}>
        <span className="chat-mini" aria-hidden="true"><i /><i /></span>
        {copia && !copia.ok && <small className="chat-acoes-aviso" role="status">Não deu para copiar. Segure o texto.</small>}
        <span className="chat-acoes-d">
          {temVoz && <button type="button" className={falando ? "on" : ""} onClick={onOuvir} aria-pressed={falando} aria-label={falando ? "Parar de falar" : "Ouvir a resposta"}><I.sound /></button>}
          <button type="button" className={copia && copia.ok ? "on" : ""} onClick={onCopiar} aria-label={copia && copia.ok ? "Copiado" : "Copiar a resposta"}>{copia && copia.ok ? <I.check /> : <I.copy />}</button>
          <button type="button" className={nota === "bom" ? "on" : ""} onClick={() => onNota("bom")} aria-pressed={nota === "bom"} aria-label="Gostei da resposta"><IC_CHAT.gostei /></button>
          <button type="button" className={nota === "ruim" ? "on" : ""} onClick={() => onNota("ruim")} aria-pressed={nota === "ruim"} aria-label="Não gostei da resposta"><IC_CHAT.naoGostei /></button>
        </span>
      </div>
    </div>
  );
}

function VozBarra({ api, db, usaPessoal, nome, onSalvar, onComando, onEditar, onNovo, onAtivo }) {
  const [ativo, setAtivo] = useState(false);
  const [fase, setFase] = useState("ouvindo"); // ouvindo | teclado | contando | faltando
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState(null);
  const [aviso, setAviso] = useState("");
  const [conta, setConta] = useState(3);
  const tecRef = useRef(null);
  const ocioso = useRef(null);
  const T = TERMO;
  const entender = t => entenderFrase(t, db);
  const okDe = r => r.tipo === "consult" ? r.c.ok : (r.itens.length > 0 && r.itens.every(i => i.valor > 0) && usaPessoal);
  // "Falar de novo" depois de faltar algo completa a frase anterior ("gastei no uber" + "30")
  const base = useRef("");
  const comBase = t => base.current ? (base.current + " " + t).trim() : t;
  const melhor = (t, alts = []) => {
    const cands = [t, ...alts];
    const lista = base.current ? [...cands.map(comBase), ...cands] : cands;
    return lista.find(c => okDe(entender(c))) || comBase(t);
  };
  const textoRef = useRef(""); textoRef.current = texto;
  const aplicar = t => { setTexto(t); setRes(entender(t)); };
  const [resposta, setResposta] = useState("");
  const vez = useRef(0); // cada frase nova invalida uma resposta atrasada da IA
  const autoCont = useRef(false); // já reabriu o microfone sozinho para completar esta frase
  // Conversa com a Bolinha: as falas ficam na tela como num chat, e ela lembra do que já foi dito
  const [conversa, setConversa] = useState([]);
  const conversaRef = useRef([]); conversaRef.current = conversa;
  const [chat, setChat] = useState(false); // tela de conversa aberta
  const chatAberto = useRef(false); chatAberto.current = chat;
  const [rascunho, setRascunho] = useState("");
  const chatInput = useRef(null);
  const [falandoResp, setFalandoResp] = useState(false);
  const [comSom, setComSom] = useState(() => falaLigada());
  const pararFala = useRef(() => {});
  const ativoRef = useRef(false);
  const chatRef = useRef(null);
  const largo = useWide(); // no computador, a conversa é um painel do lado (a tela continua à vista)
  const [menu, setMenu] = useState(""); // "" | "mais" (o + do campo) | "opcoes" (o … do topo)
  const menuRef = useRef(""); menuRef.current = menu;
  const [notas, setNotas] = useState({}); // gostei/não gostei de cada resposta desta conversa
  const [copia, setCopia] = useState(null); // { id, ok }: a resposta que acabou de ser copiada
  const [falandoId, setFalandoId] = useState(null); // a resposta que está sendo lida em voz alta
  // aviso: true marca um aviso ou erro dela ("Faltou o valor…"): fica na conversa, mas sem as ações e fora do histórico da IA
  const addFala = (quem, texto, aviso) => setConversa(c => [...c, { id: uid(), quem, texto, ...(aviso ? { aviso: true } : {}) }].slice(-12));
  // no chat, o aviso entra na conversa (e não some na próxima mensagem); na barra de voz, fica embaixo da Bolinha
  const avisar = msg => { if (chatAberto.current) { addFala("ela", msg, true); setAviso(""); } else setAviso(msg); setFase("faltando"); vibrar("aviso"); };
  const calar = () => { pararFala.current(); pararFala.current = () => {}; setFalandoResp(false); setFalandoId(null); };
  const responderFalando = (texto, depois) => {
    if (!comSom || !falaLigada()) { if (depois) depois(); return; }
    if (ehIOS()) fecharMic(); // com o microfone aberto, o iPhone toca a voz baixinho, no alto-falante de ligação
    setFalandoResp(true);
    pararFala.current = falarResposta(texto, () => { setFalandoResp(false); if (depois) depois(); });
  };
  const pronto = () => { setConta(3); setFase("contando"); vibrar("ok"); if (tecRef.current) tecRef.current.blur(); };
  const perguntar = async (t, minha, deVoz, jaMostrou) => {
    let antes = conversaRef.current.filter(m => !m.aviso); const ult = antes[antes.length - 1];
    if (ult && ult.quem === "eu" && ult.texto === t) antes = antes.slice(0, -1); // a pergunta de agora vai à parte
    const hist = antes.slice(-8).map(m => ({ quem: m.quem, texto: m.texto }));
    setChat(true); if (!jaMostrou) addFala("eu", t); setTexto(""); setRes(null);
    setFase("pensando"); setAviso("");
    try {
      const j = await chamarIA("/perguntar", { pergunta: t, contexto: contextoPergunta(db, usaPessoal), historico: hist }, 25000);
      if (vez.current !== minha) return;
      const resp = String(j.resposta || "").trim();
      addFala("ela", resp); setResposta(resp); setFase("resposta"); vibrar("ok");
      if (tecRef.current) tecRef.current.blur();
      // perguntou falando: depois da resposta, o microfone reabre para a próxima pergunta, como numa conversa
      responderFalando(resp, () => { if (deVoz && vez.current === minha && ativoRef.current) comecar(false, null, true); });
    } catch (e) { if (vez.current !== minha) return; avisar(msgIA(e)); }
  };
  const concluir = async (t0, alts, deVoz) => {
    const minha = ++vez.current;
    const t = alts ? melhor(t0, alts) : t0;
    aplicar(t); setAviso(""); setResposta("");
    if (/^\s*(cancela|cancelar|esquece|deixa pra la|deixa para la)\b/.test(semAcento(t))) { fechar(); return; }
    // no chat, tudo o que você diz ou escreve vira o seu balão
    const noChat = chatAberto.current;
    // um gasto ainda na contagem do "Salvar (3)": fica anotado antes da frase nova (antes, a nova tomava o lugar dele)
    if (fase === "contando" && res) anotarPendente(res);
    if (noChat) { addFala("eu", t); setTexto(""); }
    // "obrigado", "tchau": encerra a conversa com educação
    if (conversaRef.current.length && FIM_CONVERSA.test(semAcento(t))) {
      if (!noChat) addFala("eu", t); setTexto(""); setRes(null);
      const tchau = "Por nada! Se precisar, é só me chamar.";
      addFala("ela", tchau); setFase("resposta");
      responderFalando(tchau, () => { if (vez.current === minha) setTimeout(() => { if (vez.current === minha) fechar(); }, 600); });
      return;
    }
    // "posso gastar 300 no sábado?": a conta é feita aqui mesmo, com a previsão do mês (sem internet)
    if (usaPessoal && POSSO_GASTAR.test(semAcento(t))) {
      const { respostaGastar } = await import("./telas/pessoal.jsx");
      if (vez.current !== minha) return;
      const resp = respostaGastar(db, t);
      setChat(true); if (!noChat) addFala("eu", t); setTexto(""); setRes(null);
      addFala("ela", resp); setResposta(resp); setFase("resposta"); vibrar("ok");
      if (tecRef.current) tecRef.current.blur();
      responderFalando(resp, () => { if (deVoz && vez.current === minha && ativoRef.current) comecar(false, null, true); });
      return;
    }
    const r = entender(t);
    // "quanto gastei nos últimos 3 meses?" é pergunta, mesmo com número: não vira anotação
    const pergunta = perguntaClara(t);
    if (!pergunta && okDe(r)) {
      // entendeu, mas ficou com cara de chute (sem saber onde foi, ou sobrou valor na frase): confere com a IA
      if (!(duvidoso(r, t) && iaDisponivel())) return pronto();
      setFase("pensando");
      try {
        const r2 = await entenderIA(t, db); if (vez.current !== minha) return;
        if (r2 && r2.tipo === "pergunta") return perguntar(t, minha, deVoz, noChat);
        if (r2 && r2.tipo === "gastos") setRes(r2);
      } catch (e) { if (vez.current !== minha) return; }
      return pronto();
    }
    // pergunta ("quanto gastei de uber?"), ou qualquer coisa no meio de uma conversa ("e em setembro?"):
    // quem responde é a IA, com os seus números
    if (pergunta || ehPergunta(t) || (conversaRef.current.length && t.trim().split(/\s+/).length >= 2)) {
      if (iaDisponivel()) return perguntar(t, minha, deVoz, noChat);
      avisar("Para responder perguntas eu preciso de internet."); return;
    }
    // o app não entendeu sozinho: pede ajuda à IA antes de desistir ("torrei 45 conto no boteco")
    if (iaDisponivel() && t.trim().split(/\s+/).length >= 2) {
      setFase("pensando");
      try {
        const r2 = await entenderIA(t, db);
        if (vez.current !== minha) return;
        if (r2 && r2.tipo === "pergunta") return perguntar(t, minha, deVoz, noChat);
        if (r2 && (r2.tipo === "consult" || usaPessoal)) { setRes(r2); return pronto(); }
      } catch (e) { if (vez.current !== minha) return; }
    }
    let msg = "";
    if (r.tipo === "consult") msg = `Entendi ${primeiro(r.c.p.name)}, mas não o que aconteceu. Diga "veio", "faltou", "pagou" ou "remarca pra quinta às 15h".`;
    else if (r.itens.length && r.itens.every(i => i.valor > 0) && !usaPessoal) msg = "Para anotar gastos, ligue o modo Pessoal em Perfil.";
    else msg = r.itens.some(i => i.valor > 0) ? "Faltou o valor de alguma coisa." : "Não peguei o valor. Ex.: “gastei 30 no uber”.";
    avisar(msg);
    // falou e faltou um pedaço: o microfone reabre sozinho uma vez para você completar ("…30")
    if (deVoz && pelaRede.current && !autoCont.current && usaPessoal !== false && micVivo()) {
      autoCont.current = true;
      setTimeout(() => { if (vez.current === minha) comecar(true, msg); }, 450);
    }
  };
  // "ouvir" numa resposta da Bolinha: ouve de novo (tocar de novo enquanto ela fala essa: para)
  const ultimaEla = conversa.reduce((u, m) => m.quem === "ela" && !m.aviso ? m : u, null);
  const falandoEsta = m => falandoResp && (falandoId ? falandoId === m.id : !!ultimaEla && ultimaEla.id === m.id);
  const ouvirEsta = m => {
    const era = falandoEsta(m); calar(); if (era) return;
    pararTudoMenosConversa(); destravarFala(); setFalandoId(m.id); setFalandoResp(true);
    pararFala.current = falarResposta(m.texto, () => { setFalandoResp(false); setFalandoId(null); });
  };
  // copiar, gostei/não gostei e limpar a conversa (o … do topo)
  const tCopia = useRef(0);
  const copiar = m => { clearTimeout(tCopia.current); copiarTexto(m.texto, { toast: t => { setCopia({ id: m.id, ok: t === "Copiado" }); vibrar("toque"); tCopia.current = setTimeout(() => setCopia(null), 1800); } }); };
  const darNota = (m, nota) => {
    const nova = notas[m.id] === nota ? null : nota; // tocar de novo desfaz
    setNotas(n => ({ ...n, [m.id]: nova })); if (nova) vibrar("toque");
    const i = conversa.findIndex(x => x.id === m.id), pergunta = conversa.slice(0, i).reverse().find(x => x.quem === "eu");
    const lista = lerJSON(K_NOTA_BOLINHA, []).filter(x => x && x.id !== m.id);
    if (nova) lista.push({ id: m.id, nota: nova, quando: Date.now(), pergunta: pergunta ? pergunta.texto.slice(0, 200) : "", resposta: m.texto.slice(0, 400) });
    gravar(K_NOTA_BOLINHA, lista.slice(-50));
  };
  const limpar = () => { pararTudo(); fecharMic(); clearTimeout(ocioso.current); base.current = ""; autoCont.current = false; setMenu(""); setConversa([]); setNotas({}); setCopia(null); setRes(null); setTexto(""); setAviso(""); setResposta(""); setRascunho(""); setFase("resposta"); };
  const pararTudoMenosConversa = () => { nat.cancelar(); srv.cancelar(); };
  const trocarSom = () => { const v = !comSom; setComSom(v); gravar(K_FALA_RESP, v); if (!v) calar(); };
  // silêncio quando o microfone reabriu numa conversa: ela só espera, sem erro
  const silencio = () => { if (!conversaRef.current.length) return false; setFase("resposta"); return true; };
  const irTeclado = () => { setFase("teclado"); setTimeout(() => tecRef.current && tecRef.current.focus(), 60); };
  const nat = useFalaNativa({
    onParcial: t => aplicar(comBase(t)),
    onFinal: (t, alts) => concluir(t, alts || [], true),
    onFalhou: irTeclado,
    completo: t => !perguntaClara(comBase(t)) && okDe(entender(comBase(t))), // pergunta espera a frase inteira
    onSilencio: silencio,
  });
  // dica para o Whisper: como as frases costumam ser, os nomes dos pacientes (só o primeiro nome)
  // e as lojas que você mais usa (assim ele escreve "Drogasil" e não "droga sil")
  const promptVoz = useMemo(() => dicaWhisper(db), [db.patients, db.pessoal && db.pessoal.lanc]);
  const srv = useFalaServidor({ onFinal: t => concluir(t, [], true), onFalhou: irTeclado, prompt: promptVoz, onSilencio: silencio });
  const pelaRede = useRef(false);
  const fala = pelaRede.current ? srv : nat;
  const pararTudo = () => { nat.cancelar(); srv.cancelar(); vez.current++; calar(); };
  const abrirTeclado = () => {
    pararTudo(); setAviso(""); setResposta("");
    if (chatAberto.current) { setFase("resposta"); setTimeout(() => chatInput.current && chatInput.current.focus(), 60); return; }
    setFase("teclado"); if (tecRef.current) { tecRef.current.value = ""; tecRef.current.focus(); }
  };
  // chamado direto no toque (o iPhone só libera microfone, teclado e voz dentro do toque)
  // continuar: completa a frase anterior; avisoFixo: mantém o aviso do que faltou enquanto ouve;
  // automatico: reaberto sozinho depois de uma resposta (não é um toque)
  const comecar = (continuar, avisoFixo, automatico) => {
    clearTimeout(ocioso.current);
    if (!automatico) destravarFala();
    base.current = continuar === true && textoRef.current ? textoRef.current : "";
    if (!base.current) { setTexto(""); setRes(null); }
    if (continuar !== true) autoCont.current = false;
    setAviso(typeof avisoFixo === "string" ? avisoFixo : ""); setResposta(""); setAtivo(true);
    const rede = vozPeloServidor();
    if (!rede && (!SRec() || vozTravada())) { abrirTeclado(); return; }
    pararTudo(); pelaRede.current = rede;
    setFase("ouvindo");
    if (tecRef.current) tecRef.current.blur();
    if (!(rede ? srv : nat).iniciar()) abrirTeclado();
  };
  const fechar = () => { pararTudo(); fecharMic(); clearTimeout(ocioso.current); base.current = ""; autoCont.current = false; if (tecRef.current) { tecRef.current.blur(); tecRef.current.value = ""; } setAtivo(false); setFase("ouvindo"); setAviso(""); setTexto(""); setRes(null); setResposta(""); setConversa([]); setChat(false); setRascunho(""); setMenu(""); setNotas({}); setCopia(null); };
  // anota sem fechar nada; no chat, ela confirma o que anotou
  const anotarPendente = r => {
    if (r.tipo === "consult") onComando(r.c); else onSalvar(r.itens);
    if (!chatAberto.current) return;
    const its = r.tipo === "gastos" ? r.itens.filter(i => i.valor > 0) : [];
    addFala("ela", r.tipo === "consult" ? `Pronto: ${primeiro(r.c.p.name)}, ${textoAcao(r.c, TERMO).toLowerCase()}.` : `Anotei ${its.length > 1 ? `${its.length} lançamentos, ${brlReal(soma(its, i => i.valor))} no total` : `${its[0].desc || catDe(its[0].cat).nome}: ${brlReal(its[0].valor)}`}.`);
  };
  const salvar = () => {
    const r = res; if (!r) return fechar();
    // dentro da conversa: anota e continua conversando
    if (chatAberto.current) {
      anotarPendente(r);
      setRes(null); setTexto(""); setFase("resposta");
      return;
    }
    fechar(); if (r.tipo === "consult") onComando(r.c); else onSalvar(r.itens);
  };
  // a conversa digitada: manda o que está escrito
  const enviar = t => { t = String(t || "").trim(); if (!t) return; setRascunho(""); calar(); nat.cancelar(); srv.cancelar(); concluir(t); };
  const tocarMic = () => {
    if (falandoResp) { calar(); return comecar(); }
    if (fase === "pensando" || fala.estado === "processando") return;
    // falar de novo com o "Salvar (3)" contando: o que estava esperando fica anotado
    if (fase === "contando" && res) { anotarPendente(res); setRes(null); }
    if (fase === "ouvindo" && (fala.estado === "ouvindo" || fala.estado === "falando")) return fala.parar();
    comecar(fase === "faltando");
  };
  const tocar = () => {
    if (!ativo) return comecar();
    if (fase === "contando") return salvar();
    if (falandoResp) { calar(); return comecar(); } // interromper a Bolinha e já perguntar
    if (fase === "pensando") return; // a IA está pensando: um segundo toque não atrapalha
    if (fase === "resposta") return comecar();
    if (fase === "teclado") { const t = tecRef.current ? tecRef.current.value : ""; return t.trim() ? concluir(t) : fechar(); }
    if (fala.estado === "processando") return; // já está transcrevendo: um segundo toque não atrapalha
    if (fala.estado === "ouvindo" || fala.estado === "falando") return fala.parar();
    comecar(fase === "faltando");
  };
  // texto que chegou de fora (compartilhado de outro app): entende como se tivesse sido digitado
  const deTexto = t => { pararTudo(); base.current = ""; setAtivo(true); setFase("teclado"); if (tecRef.current) tecRef.current.value = t; concluir(t); };
  // abrir direto a conversa (atalho "Perguntar à Bolinha")
  const abrirChat = () => { destravarFala(); clearTimeout(ocioso.current); setAtivo(true); setChat(true); setFase("resposta"); setTexto(""); setRes(null); setAviso(""); };
  api.current = { tocar, comecar, fechar, texto: deTexto, chat: abrirChat };
  ativoRef.current = ativo;
  // a conversa sempre rola para a última fala
  useEffect(() => { const el = chatRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: semMovimento() ? "auto" : "smooth" }); }, [conversa.length, fase, texto]);
  // conversa aberta: no computador largo, a tela abre espaço para o painel (src/chat.css)
  const comChat = ativo && (chat || conversa.length > 0);
  useEffect(() => { const raiz = document.documentElement; raiz.classList.toggle("com-chat", comChat); return () => raiz.classList.remove("com-chat"); }, [comChat]);
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
  // Esc fecha o menu aberto (o + ou o …) e, sem menu, a conversa; com uma folha aberta por cima (no computador,
  // "Anotar gasto" na lateral), o Esc é só dela
  useEffect(() => { if (!ativo) return; const k = e => { if (e.key !== "Escape" || !camadaNoTopo("bolinha")) return; if (menuRef.current) setMenu(""); else fechar(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [ativo]);
  // tocar fora de um menu aberto fecha o menu
  useEffect(() => {
    if (!menu) return;
    const f = e => { if (!e.target.closest(".chat-menu, .chat-menu-btn")) setMenu(""); };
    document.addEventListener("pointerdown", f); return () => document.removeEventListener("pointerdown", f);
  }, [menu]);
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
    // anotação vai sozinha depois de uma pausa; pergunta só vai com o Enter (o número dela não é valor)
    if (!perguntaClara(t) && ((r.tipo === "consult" && r.c.ok) || (r.tipo === "gastos" && r.itens.some(i => i.valor > 0)))) ocioso.current = setTimeout(() => concluir(t), 2600);
  };

  const itens = res && res.tipo === "gastos" ? res.itens.filter(i => i.valor > 0) : [];
  const um = itens.length === 1 ? itens[0] : null;
  const valorVisto = useContagem(itens.length ? soma(itens, i => i.valor) : 0);
  const c = res && res.tipo === "consult" ? res.c : null;
  const est = fala.estado;
  const emConversa = chat || conversa.length > 0;
  const ouvindoAgora = fase === "ouvindo" && (est === "ouvindo" || est === "falando");
  const estadoBola = falandoResp ? "falando" : fase === "pensando" ? "pensando" : ouvindoAgora ? (est === "falando" ? "falando" : "ouvindo") : fase === "contando" ? "contando" : "";
  // o que está acontecendo, no topo da conversa (o "pensando" aparece na própria conversa)
  const statusChat = falandoResp ? "Falando…" : ouvindoAgora ? (est === "falando" ? "Ouvindo você…" : "Pode falar") : est === "processando" && fase === "ouvindo" ? "Entendendo…" : ""; // "anotando em 3" já está no botão Salvar
  // sem nada dito ainda: a tela vazia com a Bolinha grande e as sugestões
  const vazio = !conversa.length && fase !== "pensando" && fase !== "contando" && !(fase === "faltando" && aviso) && !(fase === "ouvindo" && (texto || est === "processando" || est === "erro"));
  const sugestoes = vazio ? sugestoesBolinha(usaPessoal) : [];
  const usarSugestao = s => {
    if (!s.escrever) return enviar(s.enviar || s.t);
    setRascunho(s.escrever);
    setTimeout(() => { const el = chatInput.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30);
  };
  // o botão da direita do campo: parar (pensando, falando, ouvindo ou transcrevendo), enviar (com texto) ou falar
  const ocupada = fase === "pensando" || falandoResp || ouvindoAgora || (est === "processando" && fase === "ouvindo");
  const parar = () => { if (ouvindoAgora) return fala.parar(); pararTudo(); setAviso(""); setTexto(""); setFase("resposta"); };
  // enquanto a resposta aparece, a conversa acompanha (se você não rolou para cima para reler)
  const rolarFim = () => { const el = chatRef.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight; };
  const atalho = tipo => { fechar(); onNovo(tipo); };
  const cartao = (<>
      {itens.length > 0 && (
        <div className="vozb-card">
          {itens.slice(0, 3).map((it, i) => (
            <div key={i} className="vozb-linha">
              <MarcaLogo key={it.marca || it.cat} marca={it.marca} cat={catDe(it.cat)} className="vozb-ic" />
              <span className="vozb-txt"><b>{it.desc || catDe(it.cat).nome}</b><small>{catDe(it.cat).nome} · {quandoTxt(it.off)}{it.tipo === "entrada" ? " · entrada" : ""}</small></span>
              <b className={"vozb-v" + (it.tipo === "entrada" ? " in" : "")}>{it.tipo === "entrada" ? "+" : ""}{um ? `R$ ${reais(valorVisto)}` : brlReal(it.valor)}</b>{it.moeda && <small className="vozb-moeda">{fmtMoeda(it.valorOrig, it.moeda)}{it.iof ? " + IOF" : ""}</small>}
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
  </>);
  const classe = (fase === "contando" || fase === "resposta" ? "pronto" : fase === "pensando" ? "processando" : fase === "faltando" || est === "erro" ? "erro" : est) + (emConversa ? " conversa" : "") + (falandoResp ? " falando-resp" : "");
  const status = fase === "contando" ? `Entendi · salvando em ${conta}`
    : falandoResp ? "Falando… toque na Bolinha para interromper"
    : fase === "pensando" ? "Pensando…"
    : fase === "resposta" ? "Toque na Bolinha para perguntar mais"
    : emConversa && fase === "ouvindo" ? (est === "falando" ? "Ouvindo…" : est === "processando" ? "Entendendo…" : "Pode perguntar")
    : fase === "teclado" ? "Toque no microfone do teclado e fale"
    : fase === "faltando" ? "Faltou algo" : est === "erro" ? "Não deu para ouvir"
    : est === "processando" ? "Entendendo…"
    : base.current ? (est === "falando" ? "Ouvindo… completando a frase" : "Complete a frase")
    : est === "falando" ? "Ouvindo… toque na Bolinha quando terminar" : "Pode falar";
  const dica = `Ex.: “gastei 30 no uber”${db.patients.some(p => p.active) ? ` ou “${primeiro(db.patients.find(p => p.active).name)} veio”` : ""}${servidorAvisos() ? `. Ou pergunte: “${usaPessoal ? "quanto gastei de iFood?" : "quem está devendo?"}”` : ""}`;
  return (
    <>
      <input ref={tecRef} className={"voz-tec" + (ativo && fase === "teclado" ? " on" : "")} tabIndex={ativo && fase === "teclado" ? 0 : -1} type="text" enterKeyHint="done" autoComplete="off" autoCorrect="on"
        placeholder={dica.replace("Ex.: ", "").replace(/[“”]/g, "")} aria-label="Fale ou escreva" onChange={digitou}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(ocioso.current); if (e.target.value.trim()) concluir(e.target.value); } }} />
      {ativo && <Camada onFechar={fechar} escurece={false} nome="bolinha" />}
      {ativo && emConversa && (
        <div className={"chat-ia" + (falandoResp ? " falando" : "") + (ouvindoAgora ? " ouvindo" : "") + (vazio ? " vazio" : "")} role="dialog" aria-modal={!largo} aria-label="Conversa com a Bolinha" style={{ "--n": fala.nivel.toFixed(3) }}>
          <header className="chat-topo">
            <button type="button" className="chat-redondo" onClick={fechar} aria-label="Fechar a conversa"><I.x /></button>
            <span className={"chat-status" + (statusChat ? " on" : "")} aria-live="polite">{statusChat && <><i aria-hidden="true" />{statusChat}</>}</span>
            <div className="chat-topo-d">
              <button type="button" className={"chat-redondo chat-menu-btn" + (menu === "opcoes" ? " on" : "")} onClick={() => setMenu(m => m === "opcoes" ? "" : "opcoes")} aria-label="Mais opções" aria-haspopup="menu" aria-expanded={menu === "opcoes"}><I.more /></button>
              {menu === "opcoes" && (
                <div className="chat-menu" role="menu">
                  {"speechSynthesis" in window && <button type="button" role="menuitemcheckbox" aria-checked={comSom} onClick={trocarSom}><I.sound /><span>Responder falando</span><i className={"chat-chave" + (comSom ? " on" : "")} aria-hidden="true" /></button>}
                  <button type="button" role="menuitem" disabled={!conversa.length} onClick={limpar}><I.trash /><span>Limpar conversa</span></button>
                </div>
              )}
            </div>
          </header>
          <div className={"chat-lista" + (vazio ? " vazia" : "")} ref={chatRef} aria-live="polite" aria-relevant="additions">
            {vazio ? (
              <div className="chat-vazio">
                <span className="chat-vazio-bola"><Bolinha estado={estadoBola} /></span>
                <h2>Olá{nome ? `, ${primeiro(nome)}` : ""}</h2>
                <p>{ouvindoAgora ? "Pode falar, estou ouvindo." : "Como posso te ajudar?"}</p>
              </div>
            ) : (<>
              {conversa.map(m => m.aviso ? <div key={m.id} className="chat-msg ela aviso"><p className="chat-texto">{m.texto}</p></div>
                : m.quem === "ela"
                ? <MsgBolinha key={m.id} m={m} falando={falandoEsta(m)} temVoz={"speechSynthesis" in window} nota={notas[m.id]} copia={copia && copia.id === m.id ? copia : null}
                    onOuvir={() => ouvirEsta(m)} onCopiar={() => copiar(m)} onNota={n => darNota(m, n)} onAndou={rolarFim} />
                : <div key={m.id} className="chat-msg eu"><p>{m.texto}</p></div>)}
              {texto && fase === "ouvindo" && <div className="chat-msg eu rascunho"><p>{texto}</p></div>}
              {est === "processando" && fase === "ouvindo" && !texto && <div className="chat-msg eu rascunho"><p className="digitando" aria-label="Transcrevendo"><i /><i /><i /></p></div>}
              {fase === "pensando" && <ChatPensando />}
              {aviso && fase === "faltando" && <div className="chat-msg ela aviso"><p className="chat-texto">{aviso}</p></div>}
              {est === "erro" && fase === "ouvindo" && <div className="chat-msg ela aviso"><p className="chat-texto">{fala.erro}</p></div>}
              {fase === "contando" && (itens.length > 0 || c) && (
                <div className="chat-msg ela chat-anota">
                  <p className="chat-texto">{c ? "Registro assim?" : itens.length > 1 ? `Anoto estes ${itens.length} lançamentos?` : "Anoto assim?"}</p>
                  <div className="chat-cartao">
                    {cartao}
                    <div className={"chat-cartao-acoes" + (um ? "" : " dois")}>
                      <button type="button" className="chat-cartao-btn forte" onClick={salvar}><I.check /> Salvar <span className="num">({conta})</span></button>
                      {um && <button type="button" className="chat-cartao-btn" onClick={() => { const it = um; fechar(); onEditar(it); }}><I.pencil /> Ajustar</button>}
                      <button type="button" className="chat-cartao-btn" onClick={() => { setRes(null); setFase("resposta"); addFala("ela", "Tudo bem, não anotei."); }}>Descartar</button>
                    </div>
                  </div>
                </div>
              )}
            </>)}
          </div>
          <form className="chat-compor" onSubmit={e => { e.preventDefault(); enviar(rascunho); }}>
            {sugestoes.length > 0 && !rascunho.trim() && menu !== "mais" && (
              <div className="chat-sugestoes" role="group" aria-label="Sugestões">
                {sugestoes.map(s => <button key={s.t} type="button" onClick={() => usarSugestao(s)}>{s.t}</button>)}
              </div>
            )}
            {menu === "mais" && (
              <div className="chat-menu chat-menu-mais" role="menu">
                <button type="button" role="menuitem" onClick={() => atalho("saida")}><span className="chat-menu-ic menos" aria-hidden="true"><I.down /></span><span>Anotar gasto</span></button>
                <button type="button" role="menuitem" onClick={() => atalho("entrada")}><span className="chat-menu-ic mais" aria-hidden="true"><I.up /></span><span>Anotar entrada</span></button>
              </div>
            )}
            <div className="chat-campo">
              {usaPessoal && onNovo && <button type="button" className={"chat-campo-mais chat-menu-btn" + (menu === "mais" ? " on" : "")} onClick={() => setMenu(m => m === "mais" ? "" : "mais")} aria-label="Atalhos: anotar gasto ou entrada" aria-haspopup="menu" aria-expanded={menu === "mais"}><I.plus /></button>}
              <input ref={chatInput} value={rascunho} onChange={e => setRascunho(e.target.value)} placeholder={ouvindoAgora ? "Ouvindo…" : "Pergunte ou anote algo"} enterKeyHint="send" autoComplete="off" aria-label="Escreva para a Bolinha" />
              {ocupada
                ? <button type="button" className={"chat-acao parar" + (ouvindoAgora ? " ouvindo" : "")} onClick={parar} aria-label={ouvindoAgora ? "Terminar de falar" : falandoResp ? "Parar de falar" : "Parar"}><i className="chat-parar" aria-hidden="true" /></button>
                : rascunho.trim()
                  ? <button type="submit" className="chat-acao" aria-label="Enviar"><IC_CHAT.enviar /></button>
                  : <button type="button" className="chat-acao" onClick={tocarMic} aria-label="Falar"><I.mic /></button>}
            </div>
          </form>
        </div>
      )}
      {ativo && !emConversa && <div className={"vozb " + classe + (fase === "teclado" ? " teclado" : "")} style={{ "--n": fala.nivel.toFixed(3) }} aria-live="polite">
        <div className="vozb-sombra" aria-hidden="true"><i /><i /><i /></div>
        <div className="vozb-doca">
          <div className="vozb-status">{fase !== "contando" && fase !== "faltando" && est !== "erro" && <i className="vozb-ponto" />}{status}</div>
          <p className={"vozb-fala" + (texto ? "" : " vazio")}>{texto || (est === "erro" ? fala.erro : est === "processando" ? "Transcrevendo o que você disse…" : fase === "teclado" ? "" : dica)}</p>

          {cartao}
          {aviso && <div className="vozb-aviso"><I.alert /><span>{aviso}</span></div>}

          <div className="vozb-acoes">
            {fase === "contando" && <button className="pill-btn forte" onClick={salvar} style={{ "--k": conta / 3 }}><I.check /> Salvar</button>}
            {fase === "contando" && um && <button className="pill-btn" onClick={() => { const it = um; fechar(); onEditar(it); }}><I.pencil /> Ajustar</button>}
            {fase === "resposta" && !falandoResp && <button className="pill-btn forte" onClick={() => comecar()}><I.mic /> Perguntar mais</button>}
            {falandoResp && <button className="pill-btn forte" onClick={calar}>Parar de falar</button>}
            {emConversa && !falandoResp && fase !== "teclado" && <button className="pill-btn icone" onClick={abrirTeclado} aria-label="Escrever a pergunta"><I.pencil /></button>}
            {emConversa && "speechSynthesis" in window && <button className={"pill-btn icone" + (comSom ? "" : " mudo")} onClick={trocarSom} aria-label={comSom ? "Não responder falando" : "Responder falando"} aria-pressed={comSom}><I.sound /></button>}
            {(fase === "faltando" || (est === "erro" && fase !== "resposta")) && fase !== "teclado" && <button className="pill-btn forte" onClick={() => comecar(fase === "faltando")}><I.mic /> {fase === "faltando" ? "Completar falando" : "Falar de novo"}</button>}
            {(fase === "faltando" || (est === "erro" && fase !== "resposta")) && fase !== "teclado" && !emConversa && <button className="pill-btn" onClick={abrirTeclado}>Teclado</button>}
            {fase === "teclado" && (SRec() || vozPeloServidor()) && <button className="pill-btn" onClick={() => { vozOk(); comecar(); }}><I.mic /> Tentar a voz</button>}
            <button className="pill-btn" onClick={fechar}>{fase === "resposta" ? "Fechar" : "Cancelar"}</button>
          </div>
        </div>
      </div>}
    </>
  );
}

const LancSheet = lazy(() => import("./telas/pessoal.jsx").then(m => ({ default: m.LancSheet })));

const ContaSheet = lazy(() => import("./telas/pessoal.jsx").then(m => ({ default: m.ContaSheet })));
const CaixinhaSheet = lazy(() => import("./telas/dinheiro.jsx").then(m => ({ default: m.CaixinhaSheet })));
const TetoSheet = lazy(() => import("./telas/pessoal.jsx").then(m => ({ default: m.TetoSheet })));
const TransporteTab = lazy(() => import("./telas/transporte.jsx").then(m => ({ default: m.TransporteTab })));
const GastoTransporteSheet = lazy(() => import("./telas/transporte.jsx").then(m => ({ default: m.GastoTransporteSheet })));
const VeiculoSheet = lazy(() => import("./telas/transporte.jsx").then(m => ({ default: m.VeiculoSheet })));
// Dinheiro a dois (casa compartilhada)
const CasaPagina = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.CasaPagina })));
const GastoCasaSheet = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.GastoCasaSheet })));
const ContaCasaSheet = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.ContaCasaSheet })));
const NotaSheet = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.NotaSheet })));
const NotaVerSheet = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.NotaVerSheet })));
const TrazerGastosSheet = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.TrazerGastosSheet })));
const ConviteCasaSheet = lazy(() => import("./telas/casa.jsx").then(m => ({ default: m.ConviteCasaSheet })));
// Recibo em PDF, relatório do imposto e anotações trancadas (carregam só quando abrem)
const ReciboSheet = lazy(() => import("./telas/consultorio.jsx").then(m => ({ default: m.ReciboSheet })));
const ImpostoSheet = lazy(() => import("./telas/consultorio.jsx").then(m => ({ default: m.ImpostoSheet })));
const NotasSheet = lazy(() => import("./telas/consultorio.jsx").then(m => ({ default: m.NotasSheet })));
const DocumentosSheet = lazy(() => import("./telas/consultorio.jsx").then(m => ({ default: m.DocumentosSheet })));
const MeusDadosSheet = lazy(() => import("./telas/meus-dados.jsx").then(m => ({ default: m.MeusDadosSheet })));
const BoletoSheet = lazy(() => import("./telas/ferramentas.jsx").then(m => ({ default: m.BoletoSheet })));
const ImportarSheet = lazy(() => import("./telas/ferramentas.jsx").then(m => ({ default: m.ImportarSheet })));
const ParceladoSheet = lazy(() => import("./telas/dinheiro.jsx").then(m => ({ default: m.ParceladoSheet })));
const AluguelSheet = lazy(() => import("./telas/dinheiro.jsx").then(m => ({ default: m.AluguelSheet })));
const ViagemSheet = lazy(() => import("./telas/dinheiro.jsx").then(m => ({ default: m.ViagemSheet })));

// Meta do mês em arco (inspirado no "Retirement")
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
const Onboarding = lazy(() => import("./telas/inicio.jsx").then(m => ({ default: m.Onboarding })));
const Tour = lazy(() => import("./telas/tour.jsx").then(m => ({ default: m.Tour })));

/* ---------- Avisos com o app fechado: cartão dos Ajustes ---------- */

/* =========================================================
   PERFIL (Sua conta): cartão com seus números + seções que abrem em páginas.
   Tudo salva sozinho (sem botão "Salvar" para esquecer de apertar).
   ========================================================= */
const PerfilPage = lazy(() => import("./telas/perfil.jsx").then(m => ({ default: m.PerfilPage })));

/* =========================================================
   12b. ROTINAS E FERRAMENTAS (Fechar o dia, Só o agora, Revisão,
        Confirmação, Horários livres, Lista de espera, Registros)
   ========================================================= */
function copiarTexto(txt, act, ok = "Copiado") {
  try { navigator.clipboard.writeText(txt).then(() => act.toast(ok), () => act.toast("Não consegui copiar aqui. Segure o texto para copiar.")); }
  catch (e) { act.toast("Não consegui copiar aqui. Segure o texto para copiar."); }
}

const registroPendente = db => PERFIL.registro === false ? [] : db.sessions.filter(s => s.status === "done" && !s.registro && s.date >= addDays(todayISO(), -7)).sort((a, b) => a.date.localeCompare(b.date));
const semanaKey = iso => segunda(iso);

// Horários livres nos próximos dias, dentro do horário de trabalho
// As próximas sessões para o link (confirmação pelo paciente) e para a agenda do celular. nomes: "iniciais" põe as
// iniciais do paciente no título do evento; sem isso, o título é só "Sessão" (quem vê a agenda não sabe quem é).
function proximasDoLink(db, hoje, dias, nomes) {
  const out = [];
  for (let i = 0; i < dias && out.length < 400; i++) {
    const iso = addDays(hoje, i);
    itensDoDia(db, iso).forEach(it => {
      if (it.kind === "log" || !it.patient.active) return;
      const p = it.patient, sala = p.online && /^https:\/\//.test(p.sala || "") ? p.sala : undefined;
      out.push({ p: p.id, d: iso, h: it.time, ...(sala ? { o: sala } : {}), ...(nomes === "iniciais" ? { t: `Sessão · ${iniciais(p.name)}` } : {}) });
    });
  }
  return out;
}

function horariosLivres(db, inicio, nDias) {
  const out = [];
  for (let k = 0; k < nDias; k++) {
    const iso = addDays(inicio, k), d = fromISO(iso);
    const janelas = janelasDoDia(PERFIL, d.getDay());
    if (!janelas.length || feriado(iso)) continue;
    const ocup = itensDoDia(db, iso).filter(i => !(i.kind === "log" && i.session.status === "missed")).map(i => [mins(i.time), mins(i.time) + DURACAO_SESSAO]);
    const livres = [];
    janelas.forEach(([ji, jf]) => { for (let m = ji; m + DURACAO_SESSAO <= jf; m += 60) if (!ocup.some(([a, b]) => m < b && a < m + DURACAO_SESSAO)) livres.push(m); });
    if (livres.length) out.push({ iso, livres });
  }
  return out;
}
const hTxt = m => m % 60 ? hhmm(m) : `${Math.floor(m / 60)}h`;
const periodoDe = m => m < 12 * 60 ? "manhã" : m < 18 * 60 ? "tarde" : "noite";

// FECHAR O DIA: uma etapa por vez
const FecharDia = lazy(() => import("./telas/paineis.jsx").then(m => ({ default: m.FecharDia })));

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
  useCamada(onClose, { escurece: false });
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
const RevisaoSheet = lazy(() => import("./telas/paineis.jsx").then(m => ({ default: m.RevisaoSheet })));

// CONFIRMAÇÃO DA VÉSPERA
const ConfirmSheet = lazy(() => import("./telas/paineis.jsx").then(m => ({ default: m.ConfirmSheet })));

// HORÁRIOS LIVRES PARA DIVULGAR
const LivresSheet = lazy(() => import("./telas/paineis.jsx").then(m => ({ default: m.LivresSheet })));
const ProSheet = lazy(() => import("./telas/assinatura.jsx").then(m => ({ default: m.ProSheet })));
const PedidosSheet = lazy(() => import("./telas/agendamento.jsx").then(m => ({ default: m.PedidosSheet })));
const ImportarAgendaSheet = lazy(() => import("./telas/importar-agenda.jsx").then(m => ({ default: m.ImportarAgendaSheet })));

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
      {inicial && <ConfirmButton label="Tirar da lista" titulo="Tirar da lista de espera?" texto="A pessoa sai da lista. Dá para colocar de novo depois." acao="Tirar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// REGISTROS PENDENTES
const RegistrosSheet = lazy(() => import("./telas/paineis.jsx").then(m => ({ default: m.RegistrosSheet })));

// Exportar o mês para o contador (planilha .csv)
// a planilha do mês em texto (CSV com ";" e BOM, abre direto no Excel): o botão do site e o pedido do app de celular
function csvDoMes(db, chave) {
  const pac = id => (db.patients.find(p => p.id === id) || { name: "Removido" }).name;
  const linhas = [["Data", "Nome", "Situação", "Valor", "Sublocação", "Líquido", "Pago em"]];
  db.sessions.filter(s => s.date.startsWith(chave) && (s.status === "done" || s.cobrada)).sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
    const c = s.chargeId && db.charges.find(x => x.id === s.chargeId && !x.hidden);
    linhas.push([dm(s.date) + "/" + chave.slice(0, 4), pac(s.patientId), s.status === "done" ? "Atendido" : "Falta cobrada", fmtNum(s.price), fmtNum(s.sublet), fmtNum(s.price - s.sublet), c && c.paid ? dm(c.paidAt) : "em aberto"]);
  });
  return "﻿" + linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
}
async function exportarMes(db, chave, act) {
  const csv = csvDoMes(db, chave);
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
const limparPedidoInstalar = () => { pedidoInstalar = null; };
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

// Fundos do usuário ficam no IndexedDB do aparelho (cabe muito mais que o localStorage)

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
    // a barra de status do celular acompanha o tema escolhido no app (e não só o do aparelho)
    requestAnimationFrame(() => requestAnimationFrame(() => corDaBarra(true)));
  }, [modo]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const f = () => { NEVOA = null; force(x => x + 1); }; // o tema do aparelho mudou: a névoa é lida de novo
    mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f);
    const mo = new MutationObserver(f); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener ? mq.removeEventListener("change", f) : mq.removeListener(f); mo.disconnect(); };
  }, []);
  const host = document.documentElement.getAttribute("data-theme");
  const escuro = modo === "dark" || (modo === "auto" && host !== "light" && (host === "dark" || !window.matchMedia("(prefers-color-scheme: light)").matches));
  // Trocar o tema sem piscar: a tela inteira passa de um tema para o outro num esmaecer só (View Transitions) e,
  // enquanto troca, nenhuma peça anima a própria cor (cada uma mudando no seu tempo é o que parece piscar)
  const trocar = m => {
    if (m === modo) return;
    const root = document.documentElement;
    root.classList.add("tema-trocando");
    comTransicao(() => { if (m === "auto") root.removeAttribute("data-app-theme"); else root.setAttribute("data-app-theme", m); setModo(m); }, "tema");
    setTimeout(() => root.classList.remove("tema-trocando"), 500);
  };
  return { modo, setModo: trocar, escuro };
}

/* =========================================================
   15. APP (depois do login)
   ========================================================= */
I.minus = () => <Svg sw={2.2}><path d="M5 12h14"/></Svg>;
I.video = () => <Svg><rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/></Svg>;
I.doc = () => <Svg><path d="M6.5 3h7.5l4.5 4.5V19a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13.5 3v5h5M8.5 13h7M8.5 16.5h5"/></Svg>;
I.download = () => <Svg><path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M5 17.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-1.5"/></Svg>;
I.calSync = () => <Svg><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15.2a3 3 0 0 0 5.4.8M15 13.8a3 3 0 0 0-5.4-.8"/></Svg>;
I.setaL = () => <Svg sw={2.2}><path d="M19 12H5M11 6l-6 6 6 6"/></Svg>;

// conta nova (nada salvo ainda): começa vazia
const vazio = () => ({ settings: { pix: "" }, patients: [], sessions: [], charges: [], pessoal: pessoalVazio(), espera: [], fechados: {}, confirmados: {}, revisoes: {} });
function carregarDb(conta) {
  const salvo = lerJSON(K.db(conta.email), null);
  if (!salvo) return vazio();
  if (!salvo.pessoal) salvo.pessoal = pessoalVazio();
  salvo.espera = salvo.espera || []; salvo.fechados = salvo.fechados || {}; salvo.confirmados = salvo.confirmados || {}; salvo.revisoes = salvo.revisoes || {};
  return salvo;
}

/* ---------- O retrato para as telas nativas do app de celular (ponte 2) ----------
   É o tipo Estado de app-celular/src/lib/motor.ts: as telas nativas só leem isto; as mudanças voltam como pedidos
   (registrarNativo, no Painel). As cores e as logos já vão resolvidas. */
const catParaApp = c => { const k = CORES.find(x => x.id === c.cor) || CORES[0]; return { id: c.id, nome: c.nome, cor: k.cor, ink: k.ink, ic: c.ic }; };
const MARCA_DA_DESC = new Map(); // acharMarca é tolerante (e por isso lento): guarda o que já achou
const marcaDaDesc = d => {
  if (!d) return null;
  if (!MARCA_DA_DESC.has(d)) { if (MARCA_DA_DESC.size > 3000) MARCA_DA_DESC.clear(); MARCA_DA_DESC.set(d, (acharMarca(d) || {}).id || null); }
  return MARCA_DA_DESC.get(d);
};
// a logo do jeito que o site mostra: a marca escolhida (ou achada pelo nome), senão o site escolhido à mão
const logoParaApp = (x, nome) => {
  if (x.semLogo) return { marca: null, site: null };
  const marca = x.marca || marcaDaDesc(nome), m = marca ? marcaPorId(marca) : null;
  return { marca: marca || null, site: (m && m.site) || x.logoSite || null };
};
const nomeDoBanco = b => (typeof b === "string" && b.trim() && !/meu\s*pluggy/i.test(b) ? b.trim() : null);
// Limite do plano grátis para lançamentos pessoais novos pedidos pelo app: só avisa, com texto neutro (dentro do
// app não se fala em assinar). Contas fixas e a casa não contam, como no site. n: { libera, hojePlano, db }
const limiteDoApp = (n, novos) => {
  const ch = n.hojePlano.slice(0, 7);
  return novos && n.libera && !n.libera.pessoal && n.db.pessoal.lanc.filter(l => l.data && l.data.startsWith(ch)).length + novos > LIMITE_GRATIS.lancMes
    ? { ok: false, erro: "limite", texto: `O plano grátis tem até ${LIMITE_GRATIS.lancMes} lançamentos por mês.` } : null;
};
// O mesmo para o Consultório: só os pacientes ativos contam (paciente novo e pedido de pessoa nova pelo link), com o
// termo do perfil ("analisandos", "clientes"). n: { libera, db }
const limitePacApp = (n, novos) =>
  novos && n.libera && !n.libera.consultorio && n.db.patients.filter(p => p.active).length + novos > LIMITE_GRATIS.pacientes
    ? { ok: false, erro: "limite", texto: `O plano grátis tem até ${LIMITE_GRATIS.pacientes} ${TERMO.p} ativos.` } : null;
// Contas fixas, Transporte e Nossa casa no app (src/app-nativo-areas.js: o retrato dessas áreas e os pedidos delas).
// Só carrega dentro do app de celular; aí o retrato passa a levar os extras das contas e dos gastos, transporte,
// casa e recursos
let AREAS = null;
// Consultório e Loja no app (src/app-nativo-trabalho.js): carrega junto com o das áreas; aí o retrato leva o
// consultório completo, a loja e os recursos deles
let TRAB = null;
let FOCO_N = 0; // cada pedido de uma parte da casa ganha um número novo (a página da casa faz cada um uma vez só)

function retratoNativo({ conta, perfil, db, modos, modo, tema, plano, souPro, bancoLigado, casa, linkAg, libera, loja, lojaPro }) {
  const hoje = todayISO(), ch = hoje.slice(0, 7), desde = addDays(hoje, -400);
  const P = db.pessoal || pessoalVazio();
  const e = plano && plano.estado;
  const vs = AREAS ? veiculosDe(db) : null;
  const pessoal = !modos.includes("pessoal") ? null : {
    lanc: P.lanc.filter(l => l && l.data >= desde).map(l => ({
      id: l.id, tipo: l.tipo === "entrada" ? "entrada" : "saida", valor: Number(l.valor) || 0, data: l.data, cat: l.cat, desc: l.desc || "",
      ...logoParaApp(l, l.desc), banco: nomeDoBanco(l.banco),
      ...(l.moeda && l.moeda !== "BRL" ? { moeda: l.moeda, valorOrig: l.valorOrig ?? null } : {}),
      ...(l.obs ? { obs: String(l.obs) } : {}),
      ...(AREAS ? AREAS.extrasLanc(l, vs) : {}), // transporte (transp) e casa (casaId)
    })),
    contas: P.contas.map(c => ({
      id: c.id, nome: c.nome, valor: Number(c.valor) || 0, dia: c.dia, cat: c.cat || null, paga: !!(c.pagas && c.pagas[ch]), vence: vencimento(c, ch),
      assinatura: !!c.assinatura, ...logoParaApp(c, c.nome),
      ...(AREAS ? AREAS.extrasConta(c, hoje, vs) : {}), // situação, histórico de pagamentos, boleto, moeda, transporte
    })),
    caixinhas: (P.caixinhas || []).map(c => {
      const B = c.banco && typeof c.banco.valor === "number" ? c.banco : null;
      return { id: c.id, nome: c.nome, emoji: c.emoji || "🛟", guardado: B ? B.valor : soma(c.movs || [], m => Number(m.valor) || 0), meta: c.meta > 0 ? c.meta : null, doBanco: !!B };
    }),
    limites: Object.fromEntries(Object.entries(P.limites || {}).filter(([, v]) => v > 0)),
    renda: P.renda && P.renda.valor > 0 ? P.renda.valor : null,
  };
  const ses = db.sessions.filter(s => s.date.startsWith(ch));
  const consultorio = !modos.includes("consultorio") ? null : {
    hoje: itensDoDia(db, hoje).map(i => {
      const st = situacao(i, new Date());
      return {
        hora: i.time, nome: primeiro(i.patient.name),
        status: st === "done" ? "feita" : st === "missed" ? "faltou" : st === "up" || st === "proj" ? "proxima" : "outra",
        valor: i.kind === "log" ? (contaDinheiro(i.session) ? i.session.price - i.session.sublet : null) : liquido(i.patient),
      };
    }),
    recebidoMes: liquidoMes(db, ch),
    aReceber: soma(db.charges.filter(c => !c.paid && !c.hidden), c => Number(c.amount) || 0),
    sessoesMes: ses.filter(s => s.status === "done").length,
    faltasMes: ses.filter(s => s.status === "missed").length,
    pacientesAtivos: db.patients.filter(p => p.active).length,
    // pacientes, agenda de 5 semanas, cobranças, finanças, pedidos do link, lista de espera e regras (sem telefone,
    // CPF nem anotações: veja src/app-nativo-trabalho.js)
    ...(TRAB ? TRAB.retratoConsultorio(db, perfil, linkAg, libera, hoje) : {}),
  };
  return {
    v: 1, em: Date.now(), logado: true, tema: tema.modo,
    conta: { nome: conta.nome || "", email: conta.email || "", foto: conta.foto || null, uid: conta.uid || null },
    modos, modo, termo: perfil.termo || "Paciente",
    // só a situação (nada de preço): "Pro · ativo até…" ou grátis
    plano: plano ? { pro: !!souPro, estado: (e && e.status) || (plano.cortesiaAte && hoje < plano.cortesiaAte ? "cortesia" : null), ate: (e && (e.ate || e.proxima)) || plano.cortesiaAte || null } : null,
    servidor: servidorAvisos(), bancoLigado: !!bancoLigado,
    categorias: CATEGORIAS.map(catParaApp), catEntrada: CAT_ENTRADA.map(catParaApp),
    pessoal, consultorio,
    // Transporte e Nossa casa são do Pessoal: desligado, vão null (como o pessoal)
    ...(AREAS ? {
      transporte: pessoal ? AREAS.retratoTransporte(db, hoje, (perfil && perfil.cidade) || null) : null,
      casa: pessoal ? AREAS.retratoCasa(casa, db.settings && db.settings.pix, hoje) : null,
    } : {}),
    // a Loja (null = área desligada)
    ...(TRAB ? { loja: modos.includes("loja") ? TRAB.retratoLoja(loja, lojaPro, hoje) : null } : {}),
    ...(AREAS || TRAB ? { recursos: [...(AREAS ? AREAS.RECURSOS : []), ...(TRAB ? TRAB.RECURSOS : [])] } : {}),
  };
}
// Sem login (ou cadastro pela metade): o app deixa a tela do site na frente
const retratoSemLogin = tema => ({
  v: 1, em: Date.now(), logado: false, tema: tema.modo, conta: null, modos: [], modo: null, termo: "Paciente", plano: null,
  servidor: servidorAvisos(), bancoLigado: false, categorias: [], catEntrada: [], pessoal: null, consultorio: null,
  transporte: null, casa: null, loja: null,
});
const TEMAS_VALIDOS = ["auto", "dark", "light"];
// seções do Perfil que o "abrir" ajustes { id } abre direto (telas/perfil.jsx)
const SECOES_AJUSTES = ["link", "agenda", "dinheiro", "pix", "docs", "avisos"];
// "abrir" das telas nativas: nomes amigáveis das abas de cada área
const ABAS_NOMES = {
  consultorio: { inicio: "home", home: "home", agenda: "agenda", pacientes: "pac", pac: "pac", financas: "fin", fin: "fin" },
  pessoal: { inicio: "p-home", gastos: "p-gastos", contas: "p-contas", transporte: "p-transp", casa: "p-casa" },
  loja: { inicio: "l-caixa", caixa: "l-caixa", gastos: "l-gastos", lista: "l-lista", falta: "l-lista", resumo: "l-resumo" },
};

// Quem ainda não ativou as notificações: um toque e o navegador já pergunta (ele só deixa pedir dentro de um toque).
// Não aparece quando não dá para ligar: bloqueadas no aparelho, navegador sem suporte ou iPhone sem o app instalado
// (nesse caso, a dica de instalar vem antes).
function AvisoNotificacoes({ conta, modo, act }) {
  const hoje = todayISO(), chave = `avina-aviso-notificacoes:${conta.email}`;
  const [fechado, setFechado] = useState(() => lerTexto(chave) > hoje);
  const [indo, setIndo] = useState(false), [erro, setErro] = useState("");
  if (noApp || fechado || act.pushLigado() || motivoSemPush()) return null;
  const ativar = async () => {
    setIndo(true); setErro("");
    const r = await act.ligarPush();
    setIndo(false);
    if (r === "ok") act.toast("Notificações ativadas");
    else if (r !== "negado") setErro("Não deu certo agora. Tente de novo ou ative em Perfil, na parte de Avisos.");
  };
  const fechar = () => { try { localStorage.setItem(chave, addDays(hoje, 7)); } catch (e) {} setFechado(true); };
  return (
    <section className="aviso-linha" aria-label="Notificações">
      <i><I.bell /></i>
      <span><b>Você ainda não ativou as notificações</b><small>{erro || (modo === "consultorio" ? "Saiba da sessão chegando e das contas vencendo." : modo === "loja" ? "Receba os lembretes da loja." : "Saiba das contas vencendo, mesmo com o app fechado.")}</small></span>
      <button className="pill-btn forte" disabled={indo} onClick={ativar}>{indo ? "Ativando…" : "Ativar"}</button>
      <button className="aviso-x" onClick={fechar} aria-label="Agora não"><I.x /></button>
    </section>
  );
}

// O Pro de presente está acabando (ou acabou, e o preço de lançamento ainda vale): mostra o que a pessoa já fez aqui,
// o que muda e o preço. Só no PWA: o app de celular não fala de assinatura.
function AvisoCortesia({ fase, conta, db, modo, onPlanos }) {
  const hoje = todayISO(), chave = `avina-aviso-cortesia:${conta.email}`;
  const [fechado, setFechado] = useState(() => lerTexto(chave) > hoje);
  if (fechado) return null;
  const ini = addDays(hoje, -30);
  let feito = "", limite = "";
  if (modo === "consultorio") {
    const sessoes = db.sessions.filter(s => s.status === "done" && s.date >= ini).length;
    const recebido = db.charges.filter(c => c.paid && c.paidAt && !c.hidden && c.paidAt.slice(0, 10) >= ini).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    if (sessoes) feito = `Nos últimos 30 dias você registrou ${sessoes} ${sessoes === 1 ? "sessão" : "sessões"}${recebido > 0 ? ` e recebeu ${brl(recebido)}` : ""} por aqui.`;
    limite = `No plano grátis, são até ${LIMITE_GRATIS.pacientes} ${TERMO.p} ativos.`;
  } else if (modo === "pessoal") {
    const n = db.pessoal.lanc.filter(l => l.data && l.data >= ini).length;
    if (n) feito = `Nos últimos 30 dias você fez ${n} ${n === 1 ? "anotação" : "anotações"} de dinheiro por aqui.`;
    limite = `No plano grátis, são até ${LIMITE_GRATIS.lancMes} lançamentos por mês.`;
  } else limite = `No plano grátis, só você anota na loja e o resumo mostra os últimos ${LIMITE_GRATIS.lojaDias} dias.`;
  const quando = fase.dias === 1 ? "amanhã" : `em ${fase.dias} dias`;
  const preco = emLancamento(hoje) ? ` Assinando até ${LANCAMENTO_ATE.slice(8)}/${LANCAMENTO_ATE.slice(5, 7)}, o preço de lançamento fica garantido enquanto a assinatura estiver ativa.` : "";
  const fechar = () => { try { localStorage.setItem(chave, addDays(hoje, fase.dias > 0 && fase.dias <= 3 ? 1 : 3)); } catch (e) {} setFechado(true); };
  return (
    <section className="aviso-linha cheio" aria-label="Sua assinatura">
      <i><I.star /></i>
      <span><b>{fase.fase === "acabou" ? "Seu Pro de presente acabou" : `Seu Pro de presente acaba ${quando}`}</b><small>{feito && <>{feito} </>}Seus dados continuam guardados. {limite}{preco}</small>
        <button className="pill-btn forte" onClick={onPlanos}>Ver os planos</button></span>
      <button className="aviso-x" onClick={fechar} aria-label="Agora não"><I.x /></button>
    </section>
  );
}

function Painel({ conta, novo, pronto, tema, onSair, onAtualizar, onPerfilNuvem }) {
  const perfil = conta.perfil || PERFIL_PADRAO;
  DURACAO_SESSAO = perfil.duracao || 50;
  TERMO = termoDe(perfil.termo || "Paciente");
  ESTILO = perfil.estilo || "detalhado";
  PERFIL = perfil;
  LOGADO = !!conta.uid;
  const modos = modosDo(perfil);
  const usaConsultorio = modos.includes("consultorio"), usaPessoal = modos.includes("pessoal"), usaLoja = modos.includes("loja");
  const doisModos = modos.length > 1;
  const av = { ...AVISOS_PADRAO, ...(perfil.avisos || {}) };
  const [db, setDb] = useState(() => carregarDb(conta));
  const nuvem = useNuvem(conta, db, setDb, onPerfilNuvem); // null quando a conta não usa a nuvem
  // registro de acesso (Marco Civil): ao abrir e ao voltar para o app
  useEffect(() => {
    if (!NUVEM || !conta.uid) return;
    const reg = () => { if (document.visibilityState !== "hidden") registrarAcesso(conta.uid, servidorAvisos()); };
    reg(); document.addEventListener("visibilitychange", reg);
    return () => document.removeEventListener("visibilitychange", reg);
  }, [conta.uid]);
  const casa = useCasa(conta, db, setDb); // gastos da casa divididos com quem mora junto
  const loja = useLoja(conta, db, setDb); // o caixa da loja, com quem ajuda
  // inflação (IPCA) para o lembrete de reajuste: só busca se algum paciente está há 12 meses com o mesmo valor
  const [, setInfV] = useState(0);
  useEffect(() => {
    if (usaConsultorio && db.patients.some(p => reajusteDe(p, { ipca: [] }))) atualizarInflacao().then(() => setInfV(v => v + 1)).catch(() => {});
  }, [usaConsultorio]);
  // bolinha de perfil de um desenho antigo: troca sozinha pela nova parecida (e a casa acompanha)
  useEffect(() => { const nova = avatarAtualizado(conta.foto); if (nova) onAtualizar({ foto: nova }); }, [conta.foto]);
  const linkAg = useLinkAgendamento({
    conta, db, setDb, servidor: servidorAvisos(), horariosLivres, proximas: proximasDoLink, hoje: todayISO(),
    pushId: pushLigado() ? lerJSON(K_PUSH, {}).id : "",
    onEndereco: (endereco, extra) => onAtualizar({ perfil: { ...perfil, link: { ...(perfil.link || {}), endereco, ...(extra || {}) } } }),
    onPedidos: n => notify(n === 1 ? "Chegou um pedido de horário pelo seu link" : `Chegaram ${n} pedidos de horário pelo seu link`),
    onRespostas: rs => {
      const nome = r => { const p = db.patients.find(x => x.id === r.pid); return p ? primeiro(p.name) : "Um paciente"; };
      const rem = rs.filter(r => r.r === "remarcar");
      vibrar(rem.length ? "aviso" : "ok");
      notify(rs.length > 1 ? `${rs.length} respostas de confirmação chegaram` : rem.length ? `${nome(rs[0])} pediu para remarcar a sessão de ${dm(rs[0].d)}` : `${nome(rs[0])} confirmou a sessão de ${dm(rs[0].d)}`);
    },
  });
  // Avina Pro: o plano vem do servidor (que lê no Asaas). Sem servidor configurado (ou sem login), não há limite.
  const kPlano = `avina-plano:${conta.email}`;
  // no computador (npm run dev), "avina-asaas-teste" = 1 testa sem login, como na tela da assinatura
  const testeAsaas = import.meta.env.DEV && !conta.uid && !!lerJSON("avina-asaas-teste", false);
  const [plano, setPlanoSt] = useState(() => conta.uid || testeAsaas ? lerJSON(kPlano, null) : null);
  const mudarPlano = x => { setPlanoSt(x); gravar(kPlano, x); };
  useEffect(() => {
    if (!(conta.uid || testeAsaas) || !servidorAvisos()) return;
    let vivo = true;
    (async () => {
      try {
        const headers = { "Content-Type": "application/json" };
        if (conta.uid) { const { data } = await (await cliente()).auth.getSession(); if (!data.session) return; headers.Authorization = `Bearer ${data.session.access_token}`; }
        else headers["X-Teste-Uid"] = conta.email;
        const r = await fetch(`${servidorAvisos()}/assinatura/ver`, { method: "POST", headers, body: "{}" });
        const j = await r.json().catch(() => null);
        if (!vivo || !j) return;
        if (j.configurado === false) mudarPlano(null);
        else if (j.estado) mudarPlano({ estado: j.estado, cortesiaAte: j.cortesiaAte || null });
      } catch (e) {} // sem internet: vale o último plano guardado
    })();
    return () => { vivo = false; };
  }, [conta.uid]);
  const hojePlano = todayISO();
  // null = sem limite (sem login, ou cobrança ainda não ligada); senão, as áreas liberadas: { consultorio, pessoal }
  const libera = plano ? liberadoDe(plano.estado, plano.cortesiaAte, hojePlano) : null;
  const souPro = !!plano && ehPro(plano.estado, hojePlano);
  const avisoPlano0 = !noApp && plano && !souPro && (!plano.estado || plano.estado.status === "sem") ? faseCortesia(plano.cortesiaAte, hojePlano) : null;
  // Versão grátis: até 3 pacientes ativos e 30 lançamentos por mês. Passou: mostra o Avina Pro e não salva.
  const limite = (tipo, n = 1) => {
    if (!libera) return false;
    if (tipo === "pac") { if (libera.consultorio || db.patients.filter(x => x.active).length + n <= LIMITE_GRATIS.pacientes) return false; }
    else { const ch = hojePlano.slice(0, 7); if (libera.pessoal || db.pessoal.lanc.filter(l => l.data && l.data.startsWith(ch)).length + n <= LIMITE_GRATIS.lancMes) return false; }
    vibrar("aviso"); setSheet({ type: "pro", motivo: tipo, sugerido: produtoDoUso(perfil) }); return true;
  };
  VIAGEM = (db.pessoal && db.pessoal.viagem) || null;
  LOGOS = (db.pessoal && db.pessoal.logos) || {};
  const [modo, setModoSt] = useState(() => lerJSON(K.modo(conta.email), "consultorio"));
  const [veicAtual, setVeicAtual] = useState(null); // veículo mostrado no carrossel do Transporte
  const [casaFoco, setCasaFoco] = useState(null); // app de celular: a parte da casa que ele pediu ({ k, n }, ver CasaPagina)
  const [tab, setTab] = useState(() => inicioDo(lerJSON(K.modo(conta.email), "consultorio")));
  const modoEf = modos.includes(modo) ? modo : modos[0];
  const trocarModoSt = m => { setModoSt(m); gravar(K.modo(conta.email), m); setTab(inicioDo(m)); };
  // a Loja: o Pro da dona libera a equipe (e o histórico) para todo mundo da loja
  const lojaPro = !libera || !!libera.loja || !!(loja.loja && loja.loja.pro_ate && loja.loja.pro_ate >= hojePlano);
  useEffect(() => { if (libera && libera.loja && loja.souDona) loja.marcarPro(addDays(hojePlano, 40)); }, [!!(libera && libera.loja), loja.souDona, loja.loja && loja.loja.pro_ate]);
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
  // Conquistas: calculadas a partir dos dados; as novas ganham comemoração (uma de cada vez)
  const conquistas = useMemo(() => avaliarConquistas(db, ajudaConquistas(), { perfil, usaPessoal, instalado: appInstalado(), push, nuvem: !!conta.uid, av }), [db, push, perfil, usaPessoal, conta.uid, av.nomes]);
  const [festa, setFesta] = useState([]);
  // Tour da primeira vez: { modo: true } para cada modo já visto. Só quem acabou de fazer o cadastro ganha a chave;
  // quem já usava o app (ou entrou num aparelho novo) não vê o tour sozinho, só pelo Perfil
  const [tourVisto, setTourVisto] = useState(() => { const v = lerJSON(K.tour(conta.email), null); if (v || !pronto) return v; gravar(K.tour(conta.email), {}); return {}; });
  const fimTour = m => setTourVisto(v => { const n = { ...v, [m]: true }; gravar(K.tour(conta.email), n); return n; });
  // Primeiro minuto de quem atende: logo depois do tour, oferece trazer os pacientes (da agenda antiga ou de uma lista)
  // para a semana já aparecer montada. Aparece uma vez só, e só para quem ainda não tem ninguém cadastrado.
  const kTrazer = `avina-trazer-pacientes:${conta.email}`;
  useEffect(() => {
    if (!usaConsultorio || modoEf !== "consultorio" || db.patients.length || !tourVisto || !tourVisto.consultorio || sheet || lerTexto(kTrazer)) return;
    const t = setTimeout(() => { try { localStorage.setItem(kTrazer, "1"); } catch (e) {} setSheet({ type: "importar-agenda", primeira: true }); }, 900);
    return () => clearTimeout(t);
  }, [tourVisto, sheet, modoEf, db.patients.length]);
  const vozApi = useRef({});
  // as falas do Pessoal (para os Alertas) moram em telas/pessoal.jsx, que carrega sob demanda
  const [convP, setConvP] = useState(null);
  const [alertas, setAlertas] = useState(false);
  useEffect(() => { if (usaPessoal) import("./telas/pessoal.jsx").then(m => setConvP(() => m.conversaPessoal)).catch(() => {}); }, [usaPessoal]);
  CLIMA = clima;
  const tRef = useRef(null);
  // Clima real; atualiza a cada 20 min com o app aberto e ao voltar para ele
  const climaRef = useRef(0);
  const carregarClima = async forcar => {
    const cidade = perfil.cidade;
    if (!cidade && !climaLocal()) { setClima(null); return; }
    const vez = ++climaRef.current;
    try { const c = await buscarClima(cidade, forcar); if (vez === climaRef.current) setClima(c); }
    catch (e) { if (vez === climaRef.current) setClima(cl => (cl && cl !== "erro" ? cl : "erro")); }
  };
  useEffect(() => { carregarClima(false); }, [perfil.cidade, Math.floor(now.getTime() / 12e5)]);
  useEffect(() => {
    const f = () => { if (document.visibilityState === "visible") carregarClima(false); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [perfil.cidade]);
  useEffect(() => { const y = new Date().getFullYear(); Promise.all([buscarFeriadosAPI(y), buscarFeriadosAPI(y + 1)]).then(() => setFerVer(v => v + 1)).catch(() => {}); }, []);
  ESCONDER = oculto;
  // ao abrir, o que acabou de ser lido não precisa ser regravado (com milhares de lançamentos, eram ~50 ms na abertura)
  const jaAbriu = useRef(false);
  useEffect(() => { if (!jaAbriu.current) { jaAbriu.current = true; return; } gravar(K.db(conta.email), db); }, [db]);
  useEffect(() => gravar(K.oculto, oculto), [oculto]);
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { if (pronto) notify(`Tudo pronto, ${conta.nome}! Vamos começar.`); else if (novo) notify(`Boas-vindas, ${conta.nome}!`); }, []);
  // Atalhos por link: ...#gasto abre o gasto por voz, #agora o "Só o agora", #fechar o "Fechar o dia", #livres os horários livres
  useEffect(() => {
    const h = (location.hash || "").slice(1);
    if (h === "gasto" && usaPessoal) { act.setModo("pessoal"); setTimeout(() => IA_CONVERSA && vozApi.current.comecar ? vozApi.current.comecar() : act.novoLanc("saida"), 400); }
    else if (h === "agora") setFoco(true);
    else if (h === "fechar") setSheet({ type: "fechar" });
    else if (h === "livres") setSheet({ type: "livres" });
    else if (h === "compartilhado") setTimeout(() => act.receberCompartilhado(), 300);
    const tokL = h.startsWith("loja=") ? h.slice(5) : lerJSON(K_CONVITE_LOJA, null);
    if (tokL) { localStorage.removeItem(K_CONVITE_LOJA); if (h.startsWith("loja=")) history.replaceState(null, "", location.pathname + location.search); setTimeout(() => setSheet({ type: "loja", qual: "convite", token: tokL, n: Date.now() }), 600); }
    const tok = h.startsWith("casa=") ? h.slice(5) : lerJSON(K_CONVITE, null);
    if (tok) { localStorage.removeItem(K_CONVITE); if (h.startsWith("casa=")) history.replaceState(null, "", location.pathname + location.search); setTimeout(() => setSheet({ type: "convite-casa", token: tok }), 600); }
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
  // Cotações (câmbio, CDI, IPCA): busca ao abrir e ao voltar para o app. Quando chegam valores novos,
  // as assinaturas cobradas em moeda estrangeira passam a mostrar o custo em reais do dia (com IOF).
  useEffect(() => {
    definirServidor(servidorAvisos());
    if (!usaPessoal) return;
    const recalc = () => setDb(d => {
      const P = d.pessoal; if (!P || !P.contas.some(c => c.moeda && c.moeda !== "BRL")) return d;
      let mudou = false;
      const contas = P.contas.map(c => {
        if (!c.moeda || c.moeda === "BRL" || !c.valorOrig) return c;
        const v = emReais(c.valorOrig, c.moeda, c.iof !== false);
        if (!(v > 0) || Math.abs(v - c.valor) < 0.01) return c;
        mudou = true; return { ...c, valor: v };
      });
      return mudou ? { ...d, pessoal: { ...P, contas } } : d;
    });
    recalc(); window.addEventListener("cotacoes", recalc); atualizarCotacoes().catch(() => {});
    const vis = () => { if (document.visibilityState === "visible") atualizarCotacoes().catch(() => {}); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("cotacoes", recalc); document.removeEventListener("visibilitychange", vis); };
  }, [usaPessoal]);
  // Respostas do cadastro (contas fixas, veículo, caixinha, entrada do mês): entram uma vez no db
  useEffect(() => {
    const ini0 = lerJSON(K.inicial(conta.email), null);
    if (!ini0) return;
    localStorage.removeItem(K.inicial(conta.email));
    // a parte da loja espera a loja da nuvem responder (efeito logo abaixo)
    const { loja: lojaIni, ...ini } = ini0;
    if (lojaIni) gravar(K_LOJA_INICIAL(conta.email), lojaIni);
    if (!Object.keys(ini).length) return;
    setDb(d => {
      const P = d.pessoal || pessoalVazio(), nomes = new Set(P.contas.map(c => c.nome.toLowerCase()));
      const contas = [...P.contas, ...(ini.contas || []).filter(c => !nomes.has(c.nome.toLowerCase())).map(c => { const m = acharMarca(c.nome); return { ...c, marca: m ? m.id : null }; })];
      const vs = Array.isArray(P.veiculos) ? P.veiculos : P.veiculo ? [{ id: "v1", ...P.veiculo }] : [];
      const { veiculo, ...resto } = P;
      return { ...d, pessoal: { ...resto, incluirConsultorio: ini.incluirConsultorio, contas,
        veiculos: vs.length ? vs : ini.veiculos || [],
        caixinhas: [...(P.caixinhas || []), ...(ini.caixinhas || []).filter(c => !(P.caixinhas || []).some(x => x.nome === c.nome))],
        ...(ini.renda ? { renda: ini.renda } : {}) } };
    });
  }, []);
  // A loja do cadastro: quando a nuvem diz que ainda não tem loja, abre com o nome, os botões do caixa, o Pix e o troco
  const montandoLoja = useRef(false);
  useEffect(() => {
    const ini = lerJSON(K_LOJA_INICIAL(conta.email), null);
    if (!ini || loja.estado !== "sem" || montandoLoja.current) return;
    montandoLoja.current = true;
    (async () => {
      await loja.criar(ini.nome);
      for (const [k, p] of (ini.produtos || []).entries()) await loja.salvar("produto", { nome: p.nome, preco: p.preco, cor: CORES_PRODUTO[k % CORES_PRODUTO.length], ativo: true, ordem: k, criado: Date.now() + k });
      if (ini.pix || ini.tipo) await loja.salvar("config", { id: "loja", tipo: ini.tipo, pix: ini.pix || "", cidade: (ini.cidade || "").slice(0, 15) });
      if (ini.troco > 0) await loja.salvar("caixa", { id: todayISO(), dia: todayISO(), troco: ini.troco, criado: Date.now() });
      localStorage.removeItem(K_LOJA_INICIAL(conta.email));
    })().catch(() => {}).finally(() => { montandoLoja.current = false; });
  }, [loja.estado]);
  // Entrada do mês (salário): no dia combinado, vira um lançamento sozinho (uma vez por mês, mesmo que apaguem)
  useEffect(() => {
    const R = db.pessoal && db.pessoal.renda; if (!usaPessoal || !R || !R.auto || !(R.valor > 0)) return;
    const hoje = todayISO(), ch = hoje.slice(0, 7), dia = Math.min(R.dia || 5, diasNoMes(ch));
    if ((R.lancados || {})[ch] || Number(hoje.slice(8, 10)) < dia) return;
    const l = { id: uid(), tipo: "entrada", cat: "trabalho", valor: R.valor, desc: R.nome || "Salário", data: `${ch}-${pad(dia)}`, rendaMes: ch };
    setP(P => separarAuto({ ...P, lanc: [...P.lanc, l], renda: { ...P.renda, lancados: { ...(P.renda.lancados || {}), [ch]: true } } }, l));
    notify(`${l.desc} de ${MES_LONGO[Number(ch.slice(5)) - 1]} lançado: ${brlReal(l.valor)}`);
  }, [db.pessoal && db.pessoal.renda, now.getDate()]);
  // Depois que o app abriu, deixa as outras telas prontas em segundo plano (abrem na hora, sem esperar)
  useEffect(() => {
    const pre = () => ["perfil", "paineis", "recorte", "pessoal", "dinheiro"].forEach(n => {
      ({ perfil: () => import("./telas/perfil.jsx"), paineis: () => import("./telas/paineis.jsx"), recorte: () => import("./telas/recorte.jsx"), pessoal: () => import("./telas/pessoal.jsx"), dinheiro: () => import("./telas/dinheiro.jsx") })[n]().catch(() => {});
    });
    const t = setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(pre, { timeout: 3000 }) : pre()), 3500);
    return () => clearTimeout(t);
  }, []);

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
      carregarClima(true),
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
      if (noApp) await chamarApp("avisos:agendar", { avisos });
      else await chamarServidor("/agendar", { id, sub, avisos, uid: conta.uid || undefined }, manter); // uid: o painel do dono pode mandar um aviso para a conta
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
  }, [db, push, av.ativo, av.antecedencia, av.nomes, av.resumo, av.fechar, av.semana, usaPessoal, Math.floor(now.getTime() / 9e5)]);
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
      if (!dispara && av.semana !== false && fromISO(t).getDay() === 0 && nm >= 20 * 60 && !vistos[`w:${t}`]) { vistos[`w:${t}`] = t; const s = resumoSemana(db, t, usaPessoal); dispara = [s.titulo, s.corpo, () => {}]; }
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

  // Pix que se marca sozinho (Open Finance + Pro do consultório): busca os Pix recebidos dos últimos dias ao abrir
  // e a cada 30 minutos. Nome e valor batendo com um paciente só: marca como pago (com Desfazer). Só um dos dois
  // batendo: fica em db.pixPendentes e o Início pergunta de quem é. Cada Pix é olhado uma vez só.
  const dbPix = useRef(db); dbPix.current = db;
  const pixLigado = NUVEM && !!conta.uid && usaConsultorio && !noApp && (!libera || !!libera.consultorio);
  useEffect(() => {
    if (!pixLigado) return;
    const kVistos = `avina-pix-vistos:${conta.email}`, kDesde = `avina-pix-desde:${conta.email}`;
    if (!lerTexto(kDesde)) try { localStorage.setItem(kDesde, todayISO()); } catch (e) {} // só Pix daqui para a frente
    let vivo = true, rodando = false, ultima = 0;
    const olhar = async () => {
      if (rodando || document.visibilityState !== "visible" || Date.now() - ultima < 10 * 60e3) return; // no máximo a cada 10 min
      rodando = true; ultima = Date.now();
      try {
        const b = await import("./banco.js"), e = await b.estadoBanco();
        if (!vivo || !e.ligado || !(e.bancos || []).length) return;
        const { itens = [] } = await b.lancamentosBanco(5);
        const { separarPix } = await import("./pix-auto.js");
        const vistos = new Set(lerJSON(kVistos, []));
        const r = separarPix(itens, pre => cobrancasDoPix(dbPix.current, pre), { vistos, desde: lerTexto(kDesde) });
        if (!vivo || (!r.automaticos.length && !r.duvidas.length)) return;
        gravar(kVistos, [...vistos, ...r.automaticos.map(a => a.tid), ...r.duvidas.map(d => d.tid)].slice(-500));
        const pagos = new Map(); r.automaticos.forEach(a => a.ids.forEach(id => pagos.set(id, a.pre.data)));
        const antes = dbPix.current.charges.filter(c => pagos.has(c.id)).map(c => ({ ...c }));
        setDb(d => ({ ...d,
          charges: pagos.size ? d.charges.map(c => pagos.has(c.id) && !c.paid ? { ...c, paid: true, paidAt: pagos.get(c.id), viaPix: true } : c) : d.charges,
          pixPendentes: [...(d.pixPendentes || []), ...r.duvidas.map(x => x.pre)].slice(-20) }));
        if (r.automaticos.length) {
          const a = r.automaticos[0], p = dbPix.current.patients.find(x => x.id === a.pid);
          vibrar("ok");
          notify(r.automaticos.length > 1 ? `${r.automaticos.length} Pix recebidos: sessões marcadas como pagas` : `Pix de ${brlReal(a.pre.valor)} de ${p ? primeiro(p.name) : "um paciente"}: marquei como pago`,
            () => setDb(d => ({ ...d, charges: d.charges.map(c => antes.find(x => x.id === c.id) || c) })));
        } else notify(r.duvidas.length === 1 ? `Chegou um Pix de ${brlReal(r.duvidas[0].valor)}. Veja no Início de quem é.` : `Chegaram ${r.duvidas.length} Pix. Veja no Início de quem são.`);
      } catch (e) { /* sem internet ou banco pedindo autorização: tenta na próxima */ }
      finally { rodando = false; }
    };
    const t0 = setTimeout(olhar, 4000), t = setInterval(olhar, 30 * 60e3);
    const ver = () => { if (document.visibilityState === "visible") olhar(); };
    document.addEventListener("visibilitychange", ver);
    return () => { vivo = false; clearTimeout(t0); clearInterval(t); document.removeEventListener("visibilitychange", ver); };
  }, [pixLigado]);

  // Registra as conquistas novas. Na primeira vez (ou num aparelho novo sem nenhuma), guarda o que
  // já estava feito sem fazer festa, para não chover comemoração de uma vez.
  useEffect(() => {
    const t = setTimeout(() => {
      const ja = db.conquistas, novas = conquistas.filter(c => c.feito && !(ja || {})[c.id]).map(c => c.id);
      if (ja && !novas.length) return;
      const hoje = todayISO();
      setDb(d => ({ ...d, conquistas: { ...(d.conquistas || {}), ...Object.fromEntries(novas.map(id => [id, hoje])) } }));
      if (!ja) { if (novas.length > 1) setTimeout(() => notify(`Você já tem ${novas.length} conquistas. Veja no Perfil.`), 3500); return; }
      setFesta(f => [...f, ...novas.filter(id => !f.includes(id))]);
    }, 1500);
    return () => clearTimeout(t);
  }, [conquistas]);
  // Teto por categoria: avisa uma vez ao passar de 80% e outra se estourar (por mês, neste aparelho)
  const nivelTetos = usaPessoal ? tetosAlerta(db, todayISO().slice(0, 7)).map(x => `${x.cat}:${x.pct >= 1 ? 100 : 80}`).join(",") : "";
  useEffect(() => {
    if (!nivelTetos) return;
    const ch = todayISO().slice(0, 7), k = `agenda-tetos:${conta.email}`, vistos = lerJSON(k, {});
    Object.keys(vistos).forEach(id => { if (!id.startsWith(ch)) delete vistos[id]; });
    let novo = null;
    tetosAlerta(db, ch).forEach(x => { const nivel = x.pct >= 1 ? 100 : 80, id = `${ch}:${x.cat}`; if ((vistos[id] || 0) < nivel) { vistos[id] = nivel; novo = novo || x; } });
    gravar(k, vistos);
    if (!novo) return;
    const nome = catDe(novo.cat).nome;
    const txt = novo.pct >= 1 ? `${nome}: passou do teto (${brlReal(novo.gasto)} de ${brlReal(novo.teto)})` : `${nome}: já foi ${Math.round(novo.pct * 100)}% do teto (${brlReal(novo.gasto)} de ${brlReal(novo.teto)})`;
    avisar(novo.pct >= 1 ? "Teto estourado" : "Perto do teto", txt);
    // depois do "Anotado · Desfazer", para não tapar o desfazer
    const t = setTimeout(() => notify(txt), 6200);
    return () => clearTimeout(t);
  }, [nivelTetos]);
  // Fecha o painel aberto com a animação de saída. Enquanto ele desce, o conteúdo fica "congelado"
  // como estava (assim um paciente excluído não some do painel antes da hora).
  const sheetRef = useRef(sheet); sheetRef.current = sheet;
  const [saindo, setSaindo] = useState(false);
  const close = () => {
    const atual = sheetRef.current;
    const tirar = () => { setSaindo(false); setSheet(s => s === atual ? null : s); };
    const abertos = Array.from(document.querySelectorAll(".scrim:not(.sai):not(.solto), .perfil:not(.sai)"));
    if (!atual || !abertos.length || semMovimento()) { tirar(); return; }
    abertos.forEach(el => el.classList.add("sai")); setSaindo(true); setTimeout(tirar, SAIDA_MS);
  };
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
    plano: { libera, pro: souPro, estado: plano && plano.estado, cortesiaAte: plano && plano.cortesiaAte },
    planoMudou: mudarPlano,
    // aviso no Início: a cobrança do Avina Pro está para vencer (Pix) ou venceu
    // (no app de celular não aparece: lá não se fala de pagamento, regra da Apple e do Google)
    falaAssinatura: () => {
      if (noApp) return null;
      const e = plano && plano.estado, pend = e && e.pendente;
      if (!pend || !(e.status === "ativa" || e.status === "aguardando")) return null;
      const faltam = diffDias(hojePlano, pend.vencimento);
      if (!pend.atrasada && faltam > 3) return null;
      const quando = pend.atrasada ? "venceu" : faltam <= 0 ? "vence hoje" : faltam === 1 ? "vence amanhã" : `vence em ${faltam} dias`;
      return { txt: <>Seu <b>Avina Pro</b> {quando}: {brl(pend.valor)}{pend.forma === "pix" ? " no Pix" : ""}.</>, acao: { l: "Pagar", ic: <I.wallet />, fn: () => act.openSettings("assinatura") } };
    },
    toast: (m, desfazer) => notify(m, desfazer),
    // Loja
    loja, lojaPro, usaPessoal, modos,
    abrirLoja: (qual, extra = {}) => setSheet({ type: "loja", qual, ...extra, n: Date.now() }),
    pedirPro: motivo => { vibrar("aviso"); setSheet({ type: "pro", motivo, sugerido: produtoDoUso(perfil) }); },
    // retirada da loja que a dona leva para o Pessoal: vira uma entrada lá
    retiradaParaPessoal: ({ valor, loja: nomeL, desc, movId }) => setP(P => ({ ...P, lanc: [...P.lanc, { id: uid(), tipo: "entrada", cat: "trabalho", valor, desc: desc && desc !== "Para mim" ? `${desc} (${nomeL})` : `Retirada da ${nomeL}`, data: todayISO(), lojaMov: movId }] })),
    conquistas,
    abrirClima: () => setSheet({ type: "clima" }),
    // Transporte é uma aba do modo Pessoal; os painéis dela abrem como os outros
    abrirTransporte: () => { if (sheet) close(); if (modo !== "pessoal") { setModoSt("pessoal"); gravar(K.modo(conta.email), "pessoal"); } setTab("p-transp"); rolarTopo(); },
    abrirGastoTransp: ({ sub, inicial, manut, veiculoId } = {}) => setSheet({ type: "transp-gasto", sub, inicial, manut, veiculoId, n: Date.now() }),
    abrirCasa: () => { if (sheet) close(); if (modo !== "pessoal") { setModoSt("pessoal"); gravar(K.modo(conta.email), "pessoal"); } setTab("p-casa"); rolarTopo(); },
    abrirGastoCasa: (inicial, pre) => setSheet({ type: "casa-gasto", inicial: inicial || null, pre: pre || null, n: Date.now() }),
    abrirContaCasa: c => setSheet({ type: "casa-conta", inicial: c || null, n: Date.now() }),
    lerNotaCasa: () => setSheet({ type: "casa-nota", n: Date.now() }),
    verNotaCasa: l => setSheet({ type: "casa-nota-ver", lanc: l, n: Date.now() }),
    trazerParaCasa: ids => setSheet({ type: "casa-trazer", ids: ids || [], n: Date.now() }),
    // gastos pessoais que a pessoa escolheu levar para a casa (dividindo entre todos ou só mostrando).
    // levarParaCasa é o miolo, sem aviso nem vibração (o pedido "casaTrazer" do app de celular usa direto): devolve quantos foram
    levarParaCasa: async (ids, dividir = true) => {
      if (!casa.casa) return null;
      const ls = db.pessoal.lanc.filter(l => ids.includes(l.id) && !l.casaId && l.tipo === "saida");
      const marcas = {};
      for (const l of ls) {
        const parts = dividir ? casa.membros.map(m => m.id) : [casa.eu];
        const it = await casa.salvar("lanc", { id: uid(), valor: l.valor, desc: l.desc, cat: l.cat, data: l.data, pagou: casa.eu, participantes: parts, pesos: dividir ? pesosDe(casa.config, parts) : undefined, origem: l.id, criado: Date.now(), autor: casa.eu });
        marcas[l.id] = it.id;
      }
      setP(P => ({ ...P, lanc: P.lanc.map(l => marcas[l.id] ? { ...l, casaId: marcas[l.id] } : l) }));
      return ls.length;
    },
    compartilharComCasa: async (ids, dividir = true) => {
      const n = await act.levarParaCasa(ids, dividir);
      if (n === null) return;
      vibrar("ok"); notify(n === 1 ? "Gasto levado para a casa" : `${n} gastos levados para a casa`);
    },
    desligarDaCasa: casaItemId => setP(P => ({ ...P, lanc: P.lanc.map(l => l.casaId === casaItemId ? (({ casaId, ...r }) => r)(l) : l) })),
    casa,
    abrirVeiculo: id => setSheet({ type: "veiculo", id: typeof id === "string" ? id : null }),
    atualizarVeiculo: (id, patch) => setP(P => { const { veiculo, ...resto } = P; return { ...resto, veiculos: veiculosDe({ pessoal: P }).map(x => x.id === id ? { ...x, ...patch } : x) }; }),
    // Consultório: recibo, imposto e anotações
    abrirRecibo: (pid, cid) => setSheet({ type: "recibo", pid, cid }),
    abrirImposto: () => setSheet({ type: "imposto" }),
    abrirDocumentos: pid => setSheet({ type: "documentos", pid }),
    meusDados: () => setSheet({ type: "meus-dados" }),
    abrirNotas: (pid, sid) => setSheet({ type: "notas", pid, sid }),
    atualizarPaciente: (pid, campos) => setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, ...campos } : p) })),
    salvarDocProf: doc => onAtualizar({ perfil: { ...(conta.perfil || {}), doc } }),
    salvarWhatsapp: whatsapp => onAtualizar({ whatsapp }),
    contaAtual: () => conta,
    marcarRecibo: ids => { const s = new Set(ids), h = todayISO(); setDb(d => ({ ...d, charges: d.charges.map(c => s.has(c.id) ? { ...c, reciboEm: h } : c) })); },
    marcarReceitaSaude: cid => { vibrar("toque"); setDb(d => ({ ...d, charges: d.charges.map(c => c.id === cid ? { ...c, rsaude: !c.rsaude } : c) })); },
    salvarCofre: cofre => setDb(d => ({ ...d, cofre })),
    trocarCofre: (cofre, notas) => { setDb(d => { const n = { ...d, notas }; if (cofre) n.cofre = cofre; else delete n.cofre; return n; }); notify(cofre ? "Senha trocada" : "Anotações apagadas. Crie uma senha nova."); },
    // anotar uma sessão também conta como "registro feito"
    salvarNota: n => setDb(d => ({ ...d, notas: (d.notas || []).some(x => x.id === n.id) ? d.notas.map(x => x.id === n.id ? n : x) : [...(d.notas || []), n],
      sessions: n.sid ? d.sessions.map(s => s.id === n.sid ? { ...s, registro: true } : s) : d.sessions })),
    apagarNota: id => { setDb(d => ({ ...d, notas: (d.notas || []).filter(x => x.id !== id) })); notify("Anotação apagada"); },
    // vários veículos: a lista vai para pessoal.veiculos (o antigo pessoal.veiculo vira o primeiro e some)
    salvarVeiculo: v => {
      const item = { ...v, id: v.id || uid() };
      setP(P => { const vs = veiculosDe({ pessoal: P }), { veiculo, ...resto } = P; return { ...resto, veiculos: vs.some(x => x.id === item.id) ? vs.map(x => x.id === item.id ? item : x) : [...vs, item] }; });
      setVeicAtual(item.id); close(); vibrar("ok");
      notify(item.tipo === "nenhum" ? "Pronto: apps e transporte público" : `${item.nome || "Veículo"} salvo`);
    },
    removerVeiculo: id => {
      setP(P => { const { veiculo, ...resto } = P; return { ...resto, veiculos: veiculosDe({ pessoal: P }).filter(x => x.id !== id) }; });
      setVeicAtual(null); close(); notify("Veículo removido. Os gastos dele continuam em Gastos.");
    },
    // dentro do app de celular (ponte 2), "Perguntar à Bolinha" abre o chat nativo; se o app não souber abrir, vai a conversa do site
    abrirChat: () => {
      if (sheet) close();
      const doSite = () => vozApi.current.chat && vozApi.current.chat();
      if (nativoV2) chamarApp("abrir", { tela: "chat" }).catch(doSite); else doSite();
    },
    recarregarClima: () => carregarClima(true),
    setTab: t => { if (t === tab) return rolarTopo(); comTransicao(() => { setTab(t); rolarTopo(); }, ORDEM_ABAS.indexOf(t) < ORDEM_ABAS.indexOf(tab) ? "tras" : "frente"); },
    setModo: m => comTransicao(() => { trocarModoSt(m); rolarTopo(); }, "modo"),
    // abre uma aba de qualquer modo: o Início de um modo leva ao que é do outro (os gastos, as contas, a agenda)
    abrirAba: t => {
      const m = modoDaAba(t);
      if (m === modoEf) return act.setTab(t);
      if (sheet) close();
      comTransicao(() => { setModoSt(m); gravar(K.modo(conta.email), m); setTab(t); rolarTopo(); }, "modo");
    },
    personalizarInicio: () => setSheet({ type: "cartoes", modo: modoEf }),
    modoSeguinte: modos[(modos.indexOf(modoEf) + 1) % modos.length],
    proximoModo: () => act.setModo(modos[(modos.indexOf(modoEf) + 1) % modos.length]),
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
      if (noApp) { chamarApp("avisos:cancelar").catch(() => {}); return; }
      try { if (st.id) await chamarServidor("/cancelar", { id: st.id }); } catch (e) {}
    },
    testarPush: async atraso => {
      try {
        const { id, sub } = await inscreverPush(true);
        const tem = av.ativo && gerarAvisos(db, av, usaPessoal).length > 0;
        const teste = { atraso,
          titulo: atraso ? "Teste com o app fechado" : "Teste de aviso",
          corpo: atraso ? "Chegou! Os avisos funcionam mesmo com o app fechado." : tem ? "Funcionando. Os próximos avisos já estão guardados." : "Funcionando. Os avisos vão chegar por aqui." };
        if (noApp) await chamarApp("avisos:teste", teste);
        else await chamarServidor("/teste", { id, sub, ...teste });
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
      if (limite("lanc", itens.length)) return;
      const novos = itens.map(it => ({ id: uid(), tipo: it.tipo, valor: it.valor, cat: it.cat, desc: it.desc || "", marca: it.marca || null, via: "voz", data: addDays(todayISO(), -(it.off || 0)), ...(it.moeda ? { moeda: it.moeda, valorOrig: it.valorOrig, cotacao: it.cotacao, iof: !!it.iof } : {}) }));
      const ids = new Set(novos.map(n => n.id));
      setP(P => ({ ...P, lanc: [...P.lanc, ...novos] }));
      close(); vibrar("ok");
      const n = novos[0];
      notify(novos.length > 1 ? `${novos.length} anotações · ${brlReal(soma(novos, x => x.valor))}` : `Anotado: ${n.moeda ? `${fmtMoeda(n.valorOrig, n.moeda)} (${brlReal(n.valor)})` : brlReal(n.valor)} em ${n.desc || catDe(n.cat).nome}`, () => setP(P => ({ ...P, lanc: P.lanc.filter(x => !ids.has(x.id)) })));
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
    // mandou a confirmação com o link: fica "esperando a resposta" (as antigas, de mais de 30 dias, saem)
    setEnviada: (pid, iso) => setDb(d => { const lim = addDays(todayISO(), -30); const e = Object.fromEntries(Object.entries(d.enviadas || {}).filter(([k]) => k.split(":")[1] >= lim)); return { ...d, enviadas: { ...e, [`${pid}:${iso}`]: Date.now() } }; }),
    // Reajuste combinado: as próximas sessões já saem com o valor novo (as que já aconteceram ficam como estão)
    reajustar: (pid, valor) => {
      const antes = db.patients.find(p => p.id === pid); if (!antes) return;
      setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, price: valor, reajusteEm: todayISO(), reajusteAdiado: null } : p) }));
      vibrar("ok");
      notify(`${primeiro(antes.name)}: sessão agora é ${brlReal(valor)}`, () => setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? antes : p) })));
    },
    adiarReajuste: pid => { setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, reajusteAdiado: addDays(todayISO(), 180) } : p) })); notify("Combinado: lembro de novo em 6 meses"); },
    exportar: chave => exportarMes(db, chave, act),
    setFundo: f => onAtualizar({ fundo: f }),
    setVidro: v => onAtualizar({ vidro: v }),
    setBarra: v => onAtualizar({ barra: v }),
    addFundo: async img => { const item = { id: uid(), dono: conta.email, img, criado: Date.now() }; await IDB.salvar(item); setMeusFundos(l => [...l, item]); onAtualizar({ fundo: { veu: (conta.fundo && conta.fundo.veu) || "medio", id: "u:" + item.id } }); notify("Fundo adicionado"); },
    updFundo: async (id, img) => { const velho = meusFundos.find(m => m.id === id); const item = { ...velho, img }; await IDB.salvar(item); setMeusFundos(l => l.map(m => m.id === id ? item : m)); notify("Fundo ajustado"); },
    delFundo: async id => { await IDB.apagar(id).catch(() => {}); setMeusFundos(l => l.filter(m => m.id !== id)); if (conta.fundo && conta.fundo.id === "u:" + id) onAtualizar({ fundo: null }); notify("Fundo excluído"); },
    meusFundos,
    // Link de agendamento: o pedido espera você aceitar; aceitar põe na agenda (paciente novo ou remarcação)
    link: linkAg,
    abrirPedidos: () => setSheet({ type: "pedidos" }),
    responderPedido: (id, ok) => {
      const p = (db.pedidos || []).find(x => x.id === id); if (!p) return;
      if (ok && !p.pid && limite("pac")) return;
      setDb(d => {
        const r = { ...d, pedidos: (d.pedidos || []).filter(x => x.id !== id) };
        if (!ok) return r;
        if (p.pid) return { ...r, patients: r.patients.map(x => x.id === p.pid ? { ...x, nextDate: p.data, time: p.hora } : x) };
        const novo = { id: uid(), name: p.nome, phone: p.phone || "", color: CORES[r.patients.length % CORES.length].id, price: perfil.valorPadrao || 0, sublet: perfil.subPadrao || 0, subletType: perfil.subTipo || "fixed", freq: 7, time: p.hora, billing: "session", packageSize: 4, nextDate: p.data, active: true, desde: todayISO() };
        return { ...r, patients: [...r.patients, novo] };
      });
      vibrar(ok ? "ok" : "toque");
      notify(ok ? `${primeiro(p.nome)} na agenda · ${dm(p.data)} às ${p.hora}` : "Pedido recusado");
    },
    remarcar: (pid, data, hora) => { setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, nextDate: data, time: hora } : p), confirmados: semPedidoRemarcar(d.confirmados, pid) })); close(); notify(`Remarcado para ${dm(data)} às ${hora}`); },
    // Arrastar na semana em grade: muda a próxima sessão, com Desfazer
    moverSessao: (pid, data, hora) => {
      const antes = db.patients.find(p => p.id === pid); if (!antes || (antes.nextDate === data && antes.time === hora)) return;
      const confAntes = db.confirmados;
      setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, nextDate: data, time: hora } : p), confirmados: semPedidoRemarcar(d.confirmados, pid) }));
      vibrar("ok");
      notify(`${primeiro(antes.name)}: ${diaCurto(data)} às ${hora}`, () => setDb(d => ({ ...d, patients: d.patients.map(p => p.id === pid ? { ...p, nextDate: antes.nextDate, time: antes.time } : p), confirmados: confAntes })));
    },
    desfazer: sid => { setDb(d => desfazer(d, sid)); close(); notify("Registro desfeito"); },
    setPago: (cid, pago) => (pago && vibrar("ok"), setDb(d => ({ ...d, charges: d.charges.map(c => c.id === cid ? { ...c, paid: pago, paidAt: pago ? todayISO() : null } : c) }))),
    openCharge: cid => setSheet({ type: "charge", cid }),
    openPatient: pid => setSheet({ type: "patient", pid }),
    editPatient: pid => setSheet({ type: "form", pid }),
    novoPaciente: () => { if (!limite("pac")) setSheet({ type: "form" }); },
    novoPacienteEm: (data, hora) => { if (!limite("pac")) setSheet({ type: "form", pre: { nextDate: data, time: hora } }); },
    importarAgenda: () => setSheet({ type: "importar-agenda" }),
    importarPacientes: lista => {
      if (limite("pac", lista.filter(x => x.active).length)) return;
      setDb(d => ({ ...d, patients: [...d.patients, ...lista] }));
      vibrar("ok"); close(); notify(`${lista.length} ${lista.length === 1 ? TERMO.s : TERMO.p} na agenda`);
    },
    openSettings: aba => setSheet({ type: "settings", aba: typeof aba === "string" ? aba : null }),
    salvarPerfil: (patch, pix) => {
      if (pix !== undefined) setDb(d => d.settings.pix === pix ? d : { ...d, settings: { ...d.settings, pix } });
      onAtualizar(patch);
      if (patch.perfil) { const ms = modosDo(patch.perfil); if (!ms.includes(modoEf)) trocarModoSt(ms[0]); }
    },
    modo: modoEf,
    salvarPaciente: p => {
      if (!db.patients.some(x => x.id === p.id) && p.active && limite("pac")) return;
      setDb(d => ({ ...d, patients: d.patients.some(x => x.id === p.id) ? d.patients.map(x => x.id === p.id ? p : x) : [...d.patients, p] }));
      vibrar("ok"); close(); notify(`${primeiro(p.name)} salvo · próxima ${dm(p.nextDate)} às ${p.time}`);
    },
    excluir: pid => { setDb(d => ({ ...d, patients: d.patients.filter(p => p.id !== pid) })); close(); notify("Paciente excluído"); },
    // Pessoal
    novoLanc: tipo => { if (!limite("lanc")) setSheet({ type: "lanc", tipo }); },
    editLanc: id => setSheet({ type: "lanc", id }),
    salvarLanc: l00 => {
      const { dividirCasa, ...l0 } = l00;
      if (dividirCasa && casa.casa && !l0.casaId) { const cid = uid(); l0.casaId = cid; const parts = casa.membros.map(m => m.id); casa.salvar("lanc", { id: cid, valor: l0.valor, desc: l0.desc, cat: l0.cat, data: l0.data, pagou: casa.eu, participantes: parts, pesos: pesosDe(casa.config, parts), origem: l0.id, criado: Date.now(), autor: casa.eu }); }
      const mm = acharMarca(l0.desc || ""); const l = { ...l0, marca: l0.marca !== undefined ? l0.marca : mm ? mm.id : null };
      const novoL = !db.pessoal.lanc.some(x => x.id === l.id);
      setP(P => separarAuto({ ...P, lanc: novoL ? [...P.lanc, l] : P.lanc.map(x => x.id === l.id ? l : x) }, novoL && l.tipo === "entrada" ? l : null));
      vibrar("ok"); close();
      notify(novoL ? `${l.tipo === "entrada" ? "Entrada" : "Gasto"} de ${l.moeda ? `${fmtMoeda(l.valorOrig, l.moeda)} (${brlReal(l.valor)})` : brlReal(l.valor)} anotado` : "Lançamento atualizado", novoL ? () => setP(P => ({ ...P, lanc: P.lanc.filter(x => x.id !== l.id) })) : undefined);
    },
    // apagar um só também tem o Desfazer (como apagar vários)
    apagarLanc: id => {
      const tirado = db.pessoal.lanc.find(x => x.id === id);
      setP(P => ({ ...P, lanc: P.lanc.filter(x => x.id !== id) })); close();
      notify("Lançamento apagado", tirado ? () => setP(P => ({ ...P, lanc: [...P.lanc.filter(x => x.id !== id), tirado] })) : undefined);
    },
    // vários de uma vez (seleção em Gastos), com desfazer
    apagarLancs: ids => {
      const s = new Set(ids), tirados = db.pessoal.lanc.filter(x => s.has(x.id));
      if (!tirados.length) return;
      setP(P => ({ ...P, lanc: P.lanc.filter(x => !s.has(x.id)) }));
      vibrar("aviso");
      notify(`${tirados.length} ${tirados.length === 1 ? "lançamento apagado" : "lançamentos apagados"}`, () => setP(P => ({ ...P, lanc: [...P.lanc.filter(x => !s.has(x.id)), ...tirados] })));
    },
    novaConta: () => setSheet({ type: "conta" }),
    // foto escolhida como logo de uma empresa (vale para tudo com esse nome)
    salvarLogo: (nome, url) => { const k = normalizar(nome); if (!k) return; setP(P => ({ ...P, logos: { ...(P.logos || {}), [k]: url } })); vibrar("ok"); notify("Logo salva"); },
    tirarLogo: nome => { const k = normalizar(nome); setP(P => { const l = { ...(P.logos || {}) }; delete l[k]; return { ...P, logos: l }; }); },
    // Dinheiro rendendo: caixinhas, à vista ou parcelado, modo viagem
    abrirCaixinha: id => setSheet({ type: "caixinha", id: id || null }),
    salvarCaixinha: c => { setP(P => { const cx = P.caixinhas || []; return { ...P, caixinhas: cx.some(x => x.id === c.id) ? cx.map(x => x.id === c.id ? c : x) : [...cx, c] }; }); vibrar("ok"); notify(`Caixinha ${c.nome} salva`); },
    apagarCaixinha: id => { setP(P => ({ ...P, caixinhas: (P.caixinhas || []).filter(x => x.id !== id) })); close(); notify("Caixinha apagada"); },
    moverCaixinha: (id, valor) => {
      const mov = { id: uid(), data: todayISO(), valor };
      setP(P => ({ ...P, caixinhas: (P.caixinhas || []).map(x => x.id === id ? { ...x, movs: [...(x.movs || []), mov] } : x) }));
      vibrar("ok");
      notify(valor > 0 ? `Guardado: ${brlReal(valor)}` : `Retirado: ${brlReal(-valor)}`, () => setP(P => ({ ...P, caixinhas: (P.caixinhas || []).map(x => x.id === id ? { ...x, movs: (x.movs || []).filter(m => m.id !== mov.id) } : x) })));
    },
    abrirParcelado: () => setSheet({ type: "parcelado" }),
    abrirAluguel: () => setSheet({ type: "aluguel" }),
    abrirViagem: () => setSheet({ type: "viagem" }),
    iniciarViagem: (moeda, iof) => { setP(P => ({ ...P, viagem: { moeda, iof, desde: todayISO() } })); close(); vibrar("ok"); notify(`Modo viagem: ${MOEDAS[moeda].nome}. Pode falar os gastos na moeda de lá.`); },
    encerrarViagem: () => { const v = db.pessoal.viagem; setP(P => { const { viagem, ...resto } = P; return resto; }); close(); notify("Modo viagem desligado", () => setP(P => ({ ...P, viagem: v }))); },
    editConta: id => setSheet({ type: "conta", id }),
    // Assinatura achada no extrato: "usa" passa para a lista de assinaturas; "nao" some e lembra quanto economiza
    assinaturaVista: (x, st) => {
      setP(P => ({ ...P, assinVistas: { ...(P.assinVistas || {}), [x.k]: st } }));
      vibrar(st === "nao" ? "ok" : "toque");
      notify(st === "nao" ? `Cancele ${x.nome} no app ou site deles: são ${brlReal(x.valor * 12)} por ano de volta` : `${x.nome} foi para as suas assinaturas`, () => setP(P => { const v = { ...(P.assinVistas || {}) }; delete v[x.k]; return { ...P, assinVistas: v }; }));
    },
    salvarConta: c => { setP(P => ({ ...P, contas: P.contas.some(x => x.id === c.id) ? P.contas.map(x => x.id === c.id ? c : x) : [...P.contas, c] })); close(); notify(`${c.nome} salva · vence todo dia ${c.dia}`); },
    apagarConta: id => { setP(P => ({ ...P, contas: P.contas.filter(x => x.id !== id) })); close(); notify("Conta apagada"); },
    pagarConta: id => {
      const ch = chaveAtual(), c = db.pessoal.contas.find(x => x.id === id); vibrar("ok");
      setP(P => pagarContaP(P, id, ch, todayISO()));
      notify(`${c ? c.nome : "Conta"} marcada como paga`, () => setP(P => despagarContaP(P, id, ch)));
    },
    despagarConta: id => { const ch = chaveAtual(); setP(P => despagarContaP(P, id, ch)); notify("Voltou para a pagar"); },
    toggleIncluir: () => setP(P => ({ ...P, incluirConsultorio: !P.incluirConsultorio })),
    salvarRenda: renda => setP(P => { const n = { ...P }; if (renda) n.renda = renda; else delete n.renda; return n; }),
    // Teto do mês por categoria
    abrirTeto: cat => setSheet({ type: "teto", cat: typeof cat === "string" ? cat : null }),
    salvarTeto: (cat, valor) => {
      setP(P => { const l = { ...(P.limites || {}) }; if (valor > 0) l[cat] = valor; else delete l[cat]; return { ...P, limites: l }; });
      close(); vibrar("ok"); notify(valor > 0 ? `Teto de ${catDe(cat).nome}: ${brlReal(valor)} por mês` : `Teto de ${catDe(cat).nome} removido`);
    },
    // Boleto: vira conta fixa ou gasto já pago
    lerBoleto: texto => setSheet({ type: "boleto", texto: typeof texto === "string" ? texto : "", n: Date.now() }),
    contaDoBoleto: b => {
      const marca = acharMarca(b.emissor || "");
      setSheet({ type: "conta", n: Date.now(), pre: { nome: b.tipo === "banco" ? "" : b.emissor, valor: b.valor, dia: b.vencimento ? Number(b.vencimento.slice(8)) : null, cat: marca && CATEGORIAS.some(c => c.id === marca.cat) ? marca.cat : b.cat, codigo: b.linha, incerto: b.vencimentoIncerto } });
    },
    gastoDoBoleto: b => setSheet({ type: "lanc", tipo: "saida", n: Date.now(), pre: { tipo: "saida", valor: b.valor, cat: b.cat, desc: b.tipo === "banco" ? "Boleto" : b.emissor, data: todayISO() } }),
    // Extrato do banco
    importar: () => setSheet({ type: "importar" }),
    // Open Finance (src/telas/bancos.jsx): já abre buscando no banco; e o valor real dos investimentos nas caixinhas ligadas
    importarDoBanco: () => setSheet({ type: "importar", doBanco: true, n: Date.now() }),
    bancoNasCaixinhas: mud => setP(P => ({ ...P, caixinhas: (P.caixinhas || []).map(x => (mud[x.id] ? { ...x, banco: mud[x.id] } : x)) })),
    importarLanc: lista => {
      if (limite("lanc", lista.length)) return;
      const ids = new Set(lista.map(l => l.id));
      setP(P => ({ ...P, lanc: [...P.lanc, ...lista] }));
      close(); vibrar("ok");
      notify(`${lista.length} ${lista.length === 1 ? "lançamento importado" : "lançamentos importados"}`, () => setP(P => ({ ...P, lanc: P.lanc.filter(x => !ids.has(x.id)) })));
    },
    // Foto de comprovante ou nota -> lançamento para conferir
    lerComprovante: async file => {
      if (!iaDisponivel()) { notify(navigator.onLine === false ? "Sem internet: para ler a foto eu preciso de conexão." : "Para ler fotos, ligue o servidor de avisos."); return; }
      clearTimeout(tRef.current); setToast({ msg: "Lendo o comprovante…" });
      try {
        const pre = await lerComprovante(file);
        setToast(null); vibrar("ok");
        // na loja: Pix recebido vira venda (já paga); o resto, gasto da loja
        if (modoEf === "loja" && loja) {
          if (pre.tipo === "entrada") act.abrirLoja("venda", { pre: { valor: pre.valor, pag: "pix", recebido: true, dia: pre.data, desc: pre.pagador ? `Pix de ${primeiro(pre.pagador)}` : "" } });
          else act.abrirLoja("gasto", { pre: { valor: pre.valor, desc: pre.desc, dia: pre.data, ...(pre.catLoja ? { cat: pre.catLoja } : {}) } });
          return;
        }
        // Pix recebido de quem tem sessão em aberto: oferece marcar como pago
        if (pre.tipo === "entrada" && usaConsultorio) {
          const grupos = cobrancasDoPix(db, pre);
          if (grupos.length) { setSheet({ type: "pix-sessao", pre, grupos, n: Date.now() }); return; }
        }
        if (usaPessoal && modo !== "pessoal") act.setModo("pessoal");
        setSheet({ type: "lanc", tipo: pre.tipo, pre: { ...pre, daFoto: true }, n: Date.now() });
      } catch (e) { vibrar("aviso"); notify(msgIA(e)); }
    },
    // O Pix pagou estas cobranças: ficam pagas na data do comprovante
    pixPagou: (ids, data, tid) => {
      const set = new Set(ids), antes = db.charges.filter(c => set.has(c.id)).map(c => ({ ...c }));
      setDb(d => ({ ...d, charges: d.charges.map(c => set.has(c.id) ? { ...c, paid: true, paidAt: data || todayISO() } : c), ...(tid ? { pixPendentes: (d.pixPendentes || []).filter(x => x.tid !== tid) } : {}) }));
      close(); vibrar("ok");
      notify(ids.length === 1 ? "Marquei como pago" : `${ids.length} sessões marcadas como pagas`, () => setDb(d => ({ ...d, charges: d.charges.map(c => antes.find(a => a.id === c.id) || c) })));
    },
    // Pix que não era de sessão: segue como entrada no Pessoal
    // Pix do banco que ficou em dúvida: abre a pergunta "é de quem?" (ou, se não bate mais com ninguém, tira da lista)
    verPixPendente: pre => {
      const grupos = cobrancasDoPix(db, pre);
      if (grupos.length) return setSheet({ type: "pix-sessao", pre, grupos, n: Date.now() });
      act.tirarPixPendente(pre.tid); notify("Esse Pix não bate mais com nenhuma cobrança em aberto");
    },
    tirarPixPendente: tid => setDb(d => ({ ...d, pixPendentes: (d.pixPendentes || []).filter(x => x.tid !== tid) })),
    pixNaoSessao: pre => { if (pre && pre.tid) act.tirarPixPendente(pre.tid); if (usaPessoal && modo !== "pessoal") act.setModo("pessoal"); setSheet({ type: "lanc", tipo: "entrada", pre: { ...pre, daFoto: true }, n: Date.now() }); },
    // PDF compartilhado: boleto (acha o código no texto) ou comprovante (a 1ª página vira foto para a IA)
    lerPdf: async blob => {
      clearTimeout(tRef.current); setToast({ msg: "Abrindo o PDF…" });
      // fatura do cartão (ou PDF com senha, que quase sempre é fatura ou extrato): vai para a importação
      const paraImportar = () => { if (!usaPessoal) { notify("A fatura entra no Pessoal: ligue o Pessoal no Perfil."); return; } if (modo !== "pessoal") act.setModo("pessoal"); setSheet({ type: "importar", arquivo: new File([blob], "fatura.pdf", { type: "application/pdf" }), n: Date.now() }); };
      let r;
      try { r = await (await import("./pdf.js")).lerPdf(blob); }
      catch (e) { setToast(null); if (e && /senha/.test(e.codigo || "")) return paraImportar(); vibrar("aviso"); notify("Não consegui abrir esse PDF."); return; }
      setToast(null);
      const { faturaParaImportar } = await import("./extrato.js");
      if (faturaParaImportar(r.linhas).length >= 3) return paraImportar();
      const cod = acharBoleto(r.texto);
      if (cod) return act.boletoCompartilhado(cod);
      if (r.imagem) return act.lerComprovante(r.imagem);
      notify("Não achei nada para anotar nesse PDF.");
    },
    // Boleto que chegou de fora: na loja vira gasto da loja; no resto, a tela do boleto (conta ou gasto pago)
    boletoCompartilhado: cod => {
      const b = lerBoleto(cod);
      if (modoEf === "loja" && loja && b) return act.abrirLoja("gasto", { pre: { valor: b.valor || undefined, desc: b.tipo === "banco" ? "Boleto" : b.emissor, cat: b.cat === "casa" ? "contas" : undefined } });
      if (usaPessoal && modo !== "pessoal") act.setModo("pessoal");
      act.lerBoleto(cod);
    },
    // Chegou algo pelo "Compartilhar" do Android (foto de comprovante, código de boleto ou texto)
    receberCompartilhado: async () => {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      try {
        const c = await caches.open("compartilhado"), u = n => new URL(`__compartilhado/${n}`, location.origin + BASE).href;
        const rf = await c.match(u("arquivo")), rt = await c.match(u("texto"));
        await c.delete(u("arquivo")); await c.delete(u("texto"));
        const texto = rt ? (await rt.text()).trim() : "";
        if (rf) {
          const b = await rf.blob();
          if (/pdf/i.test(b.type)) return act.lerPdf(b);
          const f = new File([b], "comprovante", { type: b.type || "image/jpeg" });
          // na loja, foto de nota com QR code: lê a nota inteira (itens e preços), como pelo botão "Ler nota do fornecedor"
          if (modoEf === "loja" && loja) {
            const [{ lerQRs }, { ehLinkNfce }] = await Promise.all([import("./telas/ferramentas.jsx"), import("./nota.js")]); // (só agora: nota.js não pesa na abertura)
            const temNota = await lerQRs(f).then(ts => ts.some(ehLinkNfce)).catch(() => false);
            if (temNota) return act.abrirLoja("nota", { arquivo: f });
          }
          return act.lerComprovante(f);
        }
        const cod = texto && (lerBoleto(texto) ? texto : acharBoleto(texto));
        if (cod) return act.boletoCompartilhado(cod);
        if (IA_CONVERSA && texto && vozApi.current.texto) vozApi.current.texto(texto);
      } catch (e) { notify("Não consegui abrir o que foi compartilhado."); }
    },
    // Conta
    salvarAjustes: (patch, pix) => { setDb(d => ({ ...d, settings: { ...d.settings, pix } })); onAtualizar(patch); if (patch.perfil) { const ms = modosDo(patch.perfil); if (!ms.includes(modoEf)) act.setModo(ms[0]); } close(); notify("Tudo salvo"); },
    refazer: () => { close(); onAtualizar({ perfil: { ...perfil, refazer: true } }); },
    verTour: () => { close(); setTab(inicioDo(modoEf)); rolarTopo(); setTourVisto(v => ({ ...v, [modoEf]: false })); },
    zerar: () => { setDb(vazio()); close(); notify("Dados apagados"); },
    sair: async () => {
      // a conta saiu deste aparelho: para de mandar os avisos dela
      const st = lerJSON(K_PUSH, {});
      if (st.ligado && st.id) { (noApp ? chamarApp("avisos:cancelar") : chamarServidor("/cancelar", { id: st.id }, true)).catch(() => {}); gravar(K_PUSH, { ...st, hash: "" }); }
      if (conta.uid) { notify("Guardando tudo na nuvem…"); onSair((await sairDaNuvem()) && conta); }
      else onSair();
    },
    excluirConta: async () => {
      // antes de apagar a conta, cancela a assinatura no Asaas (senão o cartão continuaria sendo cobrado).
      // Nos 7 dias da garantia, o cancelamento já devolve o dinheiro. Se não der para cancelar, a conta fica.
      try {
        if (servidorAvisos()) {
          const { data } = await (await cliente()).auth.getSession();
          if (data.session) {
            const r = await fetch(`${servidorAvisos()}/assinatura/cancelar`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ motivo: "Excluiu a conta" }) });
            const j = await r.json().catch(() => ({}));
            // 409 = não tinha assinatura; configurado false = cobrança ainda não ligada
            if (!r.ok && r.status !== 409 && j.configurado !== false) return notify(`Não consegui cancelar sua assinatura (${j.erro || "sem resposta"}). A conta não foi excluída: tente de novo.`);
            // o link de agendamento sai do ar junto (se não der, os pedidos somem sozinhos do servidor em 30 dias)
            await fetch(`${servidorAvisos()}/link/apagar`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: "{}" }).catch(() => {});
          }
        }
      } catch (e) { return notify("Sem internet agora: para excluir a conta, a assinatura precisa ser cancelada antes. Tente de novo com internet."); }
      try { await excluirContaNuvem(conta.uid); onSair(conta); }
      catch (e) { notify(traduzirErro(e)); }
    },
    trocarTema: () => tema.setModo(tema.escuro ? "light" : "dark"),
  };
  // só no computador de desenvolvimento (npm run dev): deixa abrir qualquer tela pelo console, para testar
  if (import.meta.env.DEV) window.__avina = { act, setSheet };

  /* ---------- App de celular (ponte 2): o retrato para as telas nativas e os pedidos delas ----------
     Nada disto roda no navegador nem no PWA (nativoV2 é false). */
  // Open Finance liberado para esta conta: pergunta uma vez ao abrir e guarda (a próxima abertura já sabe)
  const kBanco = `avina-banco-ligado:${conta.email}`;
  const [bancoLigado, setBancoLigado] = useState(() => nativoV2 && !!lerJSON(kBanco, false));
  const guardarBanco = v => { setBancoLigado(v); gravar(kBanco, v); };
  useEffect(() => {
    if (!nativoV2 || !NUVEM || !conta.uid) return;
    let vivo = true;
    import("./banco.js").then(b => b.estadoBanco()).then(e => { if (vivo && (e.ligado || navigator.onLine !== false)) guardarBanco(!!e.ligado); }).catch(() => {});
    return () => { vivo = false; };
  }, [conta.uid]);
  const retrato = () => retratoNativo({ conta, perfil, db, modos, modo: modoEf, tema, plano, souPro, bancoLigado, casa, linkAg, libera, loja, lojaPro });
  const nat = useRef(null);
  // a folha que o app abriu (pedido "abrir" com acao): true até aparecer, depois { tab } (a aba do site por trás dela)
  const folhaDoApp = useRef(null);
  nat.current = { retrato, act, db, usaPessoal, libera, hojePlano, tema, sheet, close, trocarModoSt, setTab, setP, modos, conta, perfil, folhaDoApp, setCasaFoco, setDb, usaConsultorio, usaLoja, loja, lojaPro, linkAg, onAtualizar };
  // manda de novo quando algo muda (e a cada 5 minutos: a agenda de hoje muda de "próxima" para "faltou marcar").
  // A casa vive fora do db (nuvem, tempo real): os itens, as pessoas e o estado dela também contam. A loja também
  // (as vendas de quem ajuda chegam pela nuvem e mudam a versão dos itens)
  useEffect(() => { if (nativoV2) enviarEstado(() => nat.current.retrato()); }, [db, conta, plano, tema.modo, modoEf, bancoLigado, perfil, Math.floor(now.getTime() / 3e5), casa.estado, casa.casa ? casa.itens : null, casa.casa ? casa.membros : null, casa.casa && casa.casa.nome, loja.estado, loja.versao, loja.loja && loja.loja.nome, loja.loja && loja.loja.dono, loja.membros, lojaPro]);
  useEffect(() => {
    if (!nativoV2) return;
    const N = () => nat.current;
    const banco = () => import("./banco.js");
    // a logo do banco (quando a marca é conhecida) já vai junto
    const comLogo = r => (r && Array.isArray(r.bancos) ? { ...r, bancos: r.bancos.map(b => ({ ...b, logo: ((acharMarca(b.nome || "") || {}).site) || null })) } : r);
    // troca de área e de aba sem animação (o app mostra a camada do site logo depois)
    const irPara = (m, tela) => {
      const n = N();
      if (!n.modos.includes(m)) m = n.modos[0];
      const aba = tela && ((ABAS_NOMES[m] || {})[tela] || (ORDEM_ABAS.includes(tela) && modoDaAba(tela) === m ? tela : null));
      n.trocarModoSt(m);
      if (aba) n.setTab(aba);
      rolarTopo();
      return aba || inicioDo(m);
    };
    // Contas fixas, Transporte e Nossa casa (src/app-nativo-areas.js): uma camada a mais de pedidos, e o retrato
    // passa a levar essas áreas (e "recursos") assim que o arquivo carrega
    let vivo = true, tirarAreas = null, tirarTrab = null;
    import("./app-nativo-areas.js").then(m => {
      if (!vivo) return;
      AREAS = m; tirarAreas = registrarNativo(m.acoesDasAreas(N));
      enviarEstado(() => N().retrato());
    }).catch(() => {});
    // Consultório e Loja (src/app-nativo-trabalho.js): o mesmo esquema, outra camada (nenhum pedido com nome repetido)
    import("./app-nativo-trabalho.js").then(m => {
      if (!vivo) return;
      TRAB = m; tirarTrab = registrarNativo(m.acoesDoTrabalho(N));
      enviarEstado(() => N().retrato());
    }).catch(() => {});
    const tirar = registrarNativo({
      estado: () => N().retrato(),
      // abrir { area, tela, acao, id }: a área (e a aba) do site e/ou um painel dele
      abrir: (d = {}) => {
        const n = N(), a = n.act, C = a.casa;
        const acao = d.acao || (!d.area ? d.tela : null);
        n.folhaDoApp.current = null; // um pedido novo: a folha de antes (se ainda aberta) já não volta sozinha para o app
        // as partes da casa que ficam no site (convite, divisão, ajustes, listas prontas) e as folhas da casa precisam dela
        const FOCO_CASA = { "casa-convidar": "convidar", "casa-divisao": "divisao", "casa-pessoas": "pessoas", "casa-listas": "listas" };
        if (acao && (FOCO_CASA[acao] || /^casa-/.test(acao)) && !(n.usaPessoal && C && C.casa)) throw new Error("sem-casa");
        if (FOCO_CASA[acao]) { a.abrirCasa(); ABA_DO_APP = "p-casa"; n.setCasaFoco({ k: FOCO_CASA[acao], n: ++FOCO_N }); return null; }
        if (d.area) {
          if (d.area === "casa" && n.usaPessoal) { a.abrirCasa(); ABA_DO_APP = "p-casa"; } // (fecham o painel aberto sozinhas)
          else if (d.area === "transporte" && n.usaPessoal) { a.abrirTransporte(); ABA_DO_APP = "p-transp"; }
          else { if (n.sheet) n.close(); ABA_DO_APP = irPara(d.area === "casa" || d.area === "transporte" ? "pessoal" : d.area, d.tela); }
        }
        if (!acao) return null;
        const lanc = id => (id && n.db.pessoal.lanc.find(l => l.id === id)) || null;
        if (acao === "contas") { irPara("pessoal", "contas"); return null; }
        // ajustes { id }: já aberto numa seção (link, agenda, dinheiro, pix, docs, avisos)
        if (acao === "ajustes" || acao === "perfil") a.openSettings(acao === "ajustes" && SECOES_AJUSTES.includes(d.id) ? d.id : undefined);
        else if (acao === "avisos") a.openSettings("avisos");
        else if (acao === "excluir-conta") a.openSettings("excluir");
        else if (acao === "importar-banco") a.importarDoBanco();
        else if (acao === "importar") a.importar();
        else if (acao === "editar-lanc") { if (lanc(d.id)) a.editLanc(d.id); else throw new Error("nao-achei"); }
        else if (acao === "caixinha") a.abrirCaixinha(d.id || null);
        else if (acao === "nova-conta") a.novaConta();
        else if (acao === "teto") a.abrirTeto(d.id || null);
        else if (acao === "novo-lanc") a.novoLanc(d.id === "entrada" || d.tipo === "entrada" ? "entrada" : "saida");
        // Contas fixas: o que a folha nativa não faz (logo ou foto, moeda de fora, código do boleto) e ler o boleto
        else if (acao === "editar-conta") { if (d.id && n.db.pessoal.contas.some(c => c.id === d.id)) a.editConta(d.id); else throw new Error("nao-achei"); }
        else if (acao === "ler-boleto") a.lerBoleto();
        // Transporte: o veículo (tipo, foto, FIPE, IPVA e seguro, troca de óleo); id "novo" cria um
        // (abrirVeiculo(null) abriria o primeiro)
        else if (acao === "veiculo") {
          if (!d.id || d.id === "novo") a.abrirVeiculo("novo");
          else if (veiculosDe(n.db).some(v => v.id === d.id)) a.abrirVeiculo(d.id);
          else throw new Error("nao-achei");
        }
        else if (acao === "transp-gasto") { const l = lanc(d.id); if (d.id && !l) throw new Error("nao-achei"); a.abrirGastoTransp(l ? { inicial: l } : { sub: d.sub, veiculoId: d.veiculoId }); }
        // Nossa casa: ler a nota (câmera, QR, Sefaz), ver a foto da nota e as folhas de reserva
        else if (acao === "casa-nota") a.lerNotaCasa();
        else if (acao === "casa-nota-ver") { const l = C.lanc.find(x => x.id === d.id); if (!l || !l.nota) throw new Error("nao-achei"); a.verNotaCasa(l); }
        else if (acao === "casa-trazer") a.trazerParaCasa();
        else if (acao === "casa-gasto") a.abrirGastoCasa((d.id && C.lanc.find(x => x.id === d.id)) || undefined);
        else if (acao === "casa-conta") a.abrirContaCasa((d.id && C.contas.find(x => x.id === d.id)) || undefined);
        // Consultório e Loja: a ficha completa, as anotações trancadas, o recibo, as rotinas, os ajustes da loja...
        // (src/app-nativo-trabalho.js; sem a área, erro "tela")
        else if (TRAB && TRAB.abrirTrabalho(n, acao, d)) { /* abriu a folha */ }
        else if (!d.area) throw new Error("tela");
        else return null;
        n.folhaDoApp.current = true; // abriu uma folha: ao fechar, volta para o app
        return null;
      },
      // lancar { itens }: anota (ou atualiza, se o id já existe) no Pessoal, sem painel e sem aviso na tela do site
      lancar: ({ itens } = {}) => {
        const n = N();
        const lista = (Array.isArray(itens) ? itens : []).filter(it => it && Number(it.valor) > 0 && Number(it.valor) < 1e7);
        if (!lista.length) return { ok: false, erro: "vazio", texto: "Não achei nada para anotar." };
        if (!n.usaPessoal) return { ok: false, erro: "pessoal", texto: "Para anotar gastos, ligue o Pessoal em Perfil → Como você usa o app." };
        const existentes = new Map(n.db.pessoal.lanc.map(l => [l.id, l]));
        const novos = lista.filter(it => !(it.id && existentes.has(it.id))).length;
        const lim = limiteDoApp(n, novos); if (lim) return lim;
        const prontos = lista.map(it => {
          const tipo = it.tipo === "entrada" ? "entrada" : "saida", cats = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
          const desc = String(it.desc || "").trim().slice(0, 80);
          const antes = it.id ? existentes.get(it.id) : null;
          const marca = it.marca && marcaPorId(it.marca) ? it.marca : (acharMarca(desc) || {}).id || null;
          const fora = it.moeda && it.moeda !== "BRL" && Number(it.valorOrig) > 0;
          const l = {
            ...(antes ? (({ moeda, valorOrig, cotacao, iof, ...resto }) => resto)(antes) : {}),
            id: antes ? antes.id : (typeof it.id === "string" && it.id ? it.id : uid()),
            tipo, valor: Math.round(Number(it.valor) * 100) / 100, cat: cats.some(c => c.id === it.cat) ? it.cat : tipo === "entrada" ? "outros-e" : "outros",
            desc, data: /^\d{4}-\d{2}-\d{2}$/.test(it.data || "") ? it.data : todayISO(), marca,
            ...(fora ? { moeda: it.moeda, valorOrig: Number(it.valorOrig), ...(it.cotacao ? { cotacao: it.cotacao } : {}), ...(it.iof !== undefined ? { iof: !!it.iof } : {}) } : {}),
          };
          if (typeof it.obs === "string") { if (it.obs.trim()) l.obs = it.obs.trim(); else delete l.obs; }
          // trocou a marca ou o nome: a logo escolhida antes à mão não vale mais
          if (antes && (antes.marca !== marca || antes.desc !== desc)) { delete l.logoSite; delete l.semLogo; }
          return { l, novo: !antes };
        });
        n.setP(P => prontos.reduce((acc, { l, novo }) => separarAuto({ ...acc, lanc: novo ? [...acc.lanc, l] : acc.lanc.map(x => x.id === l.id ? l : x) }, novo && l.tipo === "entrada" ? l : null), P));
        return { ok: true, ids: prontos.map(x => x.l.id) };
      },
      apagarLanc: ({ id } = {}) => {
        const n = N(), tinha = !!id && n.db.pessoal.lanc.some(l => l.id === id);
        if (tinha) n.setP(P => ({ ...P, lanc: P.lanc.filter(x => x.id !== id) }));
        return { ok: tinha };
      },
      bolinha: ({ texto, historico } = {}) => { const n = N(); return responderBolinha(n.db, n.usaPessoal, texto, historico); },
      // banco { rota, forcar }: saldos (resumo, guardado 15 min) ou os bancos conectados (estado)
      banco: async ({ rota, forcar } = {}) => {
        const b = await banco();
        const r = rota === "estado" ? await b.estadoBanco() : await b.resumoBanco(!!forcar);
        if (r && r.ligado) guardarBanco(true);
        return comLogo(r);
      },
      desligarBanco: async ({ itemId } = {}) => {
        if (!itemId) throw new Error("sem-banco");
        const b = await banco();
        await b.desligarBanco(itemId); b.esquecerResumo();
        return { ok: true };
      },
      // conectarBanco { itemId }: a janela do banco abre por cima do site (o app já trouxe o site para a frente)
      conectarBanco: async ({ itemId } = {}) => {
        const b = await banco(), e = await b.estadoBanco();
        const novo = await b.conectarBanco({ itemId: itemId || undefined, escuro: N().tema.escuro, teste: !!(e && e.teste) });
        b.esquecerResumo();
        return novo ? comLogo({ bancos: [novo] }).bancos[0] : null;
      },
      tema: ({ modo } = {}) => { if (TEMAS_VALIDOS.includes(modo)) N().tema.setModo(modo); return null; },
      // puxar da nuvem agora: o mesmo caminho de quando a pessoa volta para o app (nuvem, loja, pedidos do link).
      // A casa não escuta o "voltou para a frente" (e o tempo real perde o que chegou com o app no fundo): recarrega
      // daqui, mandando antes o que ficou na fila dela
      sincronizar: async () => {
        try { if (document.visibilityState === "visible") document.dispatchEvent(new Event("visibilitychange")); } catch (e) {}
        const C = N().act.casa;
        await Promise.all([
          new Promise(ok => setTimeout(ok, 900)),
          Promise.race([Promise.resolve(C && C.recarregar && C.recarregar()).catch(() => {}), new Promise(ok => setTimeout(ok, 8000))]),
        ]);
        return null;
      },
      // sair: o mesmo do botão "Sair da conta" do Perfil
      sair: async () => { await N().act.sair(); return null; },
    });
    return () => { vivo = false; tirar(); if (tirarAreas) tirarAreas(); if (tirarTrab) tirarTrab(); };
  }, []);

  const t = todayISO(), ch = t.slice(0, 7);
  const atrasados = db.patients.filter(p => p.active && p.nextDate && p.nextDate < t).length;
  const pendentes = db.charges.filter(c => !c.paid).length;
  const contasUrg = db.pessoal.contas.filter(c => { const s = situacaoConta(c, ch).st; return s === "atrasada" || s === "hoje"; }).length;
  const tabEf = modoDaAba(tab) === modoEf ? tab : inicioDo(modoEf);
  // trocou de aba no site: o voltar da tela nova já não leva de volta ao app (ABA_DO_APP)
  useEffect(() => { if (ABA_DO_APP && ABA_DO_APP !== tabEf) ABA_DO_APP = null; }, [tabEf]);
  // a folha que o app abriu fechou, com a pessoa na mesma tela do site: volta para a tela nativa de onde ela veio
  // (se no meio do caminho ela foi para outra tela do site, fica no site)
  useEffect(() => {
    const f = folhaDoApp.current;
    if (!nativoV2 || !f) return;
    if (sheet) { if (f === true) folhaDoApp.current = { tab: tabEf }; return; }
    folhaDoApp.current = null;
    if (f !== true && f.tab === tabEf) chamarApp("nativo:voltar").catch(() => {});
  }, [sheet, tabEf]);
  const abas = modoEf === "loja"
    ? [{ id: "l-caixa", l: "Caixa", ic: <I.wallet />, on: <I.walletOn />, n: 0 }, { id: "l-gastos", l: "Gastos", ic: <I.bill />, on: <I.billOn />, n: 0 }, { id: "l-lista", l: "Falta", ic: <I.cart />, on: <I.cart />, n: loja.faltas.filter(x => !x.feito).length }, { id: "l-resumo", l: "Resumo", ic: <I.chart />, on: <I.chartOn />, n: 0 }]
    : modoEf === "pessoal"
    ? [{ id: "p-home", l: "Início", ic: <I.home />, on: <I.homeOn />, n: 0 }, { id: "p-gastos", l: "Gastos", ic: <I.chart />, on: <I.chartOn />, n: 0 }, { id: "p-contas", l: "Contas", ic: <I.bill />, on: <I.billOn />, n: contasUrg }, { id: "p-transp", l: "Transporte", ic: <I.car />, on: <I.carOn />, n: 0 }]
    : [{ id: "home", l: "Início", ic: <I.home />, on: <I.homeOn />, n: atrasados }, { id: "agenda", l: "Agenda", ic: <I.cal />, on: <I.calOn />, n: 0 }, { id: "pac", l: TERMO.P, ic: <I.users />, on: <I.usersOn />, n: 0 }, { id: "fin", l: "Finanças", ic: <I.wallet />, on: <I.walletOn />, n: pendentes }];
  const lancSel = sheet && sheet.type === "lanc" && sheet.id ? db.pessoal.lanc.find(l => l.id === sheet.id) : null;
  const contaSel = sheet && sheet.type === "conta" && sheet.id ? db.pessoal.contas.find(c => c.id === sheet.id) : null;
  const paineisCong = useRef(null);
  const paineis = saindo && paineisCong.current ? paineisCong.current : (
    <>
      {sheet && sheet.type === "session" && <SessionSheet key={sheet.item.patient.id + sheet.item.date + sheet.item.kind} db={db} item={sheet.item} onClose={close} act={act} />}
      {sheet && sheet.type === "patient" && <PatientSheet db={db} pid={sheet.pid} onClose={close} act={act} />}
      {sheet && sheet.type === "pix-sessao" && <PixSessaoSheet key={sheet.n} db={db} pre={sheet.pre} grupos={sheet.grupos} onClose={close} act={act} />}
      {sheet && sheet.type === "form" && <PatientForm total={db.patients.length} perfil={perfil} pre={sheet.pre} initial={sheet.pid ? db.patients.find(p => p.id === sheet.pid) : null} onSave={act.salvarPaciente} onClose={close} />}
      {sheet && sheet.type === "charge" && <ChargeSheet key={sheet.cid} db={db} cid={sheet.cid} fresh={sheet.fresh} nomeProf={conta.nome} onClose={close} act={act} />}
      {sheet && sheet.type === "settings" && <Suspense fallback={null}><PerfilPage db={db} conta={conta} tema={tema} inicio={sheet.aba} onClose={close} act={act} nuvem={nuvem} /></Suspense>}
      {sheet && sheet.type === "fechar" && <Suspense fallback={null}><FecharDia db={db} conta={conta} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "revisao" && <Suspense fallback={null}><RevisaoSheet db={db} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "confirmar" && <Suspense fallback={null}><ConfirmSheet db={db} iso={sheet.iso} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "livres" && <Suspense fallback={null}><LivresSheet db={db} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "pro" && <Suspense fallback={null}><ProSheet motivo={sheet.motivo} sugerido={sheet.sugerido} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "pedidos" && <Suspense fallback={null}><PedidosSheet db={db} conta={conta} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "importar-agenda" && <Suspense fallback={null}><ImportarAgendaSheet db={db} perfil={perfil} onClose={close} act={act} primeira={!!sheet.primeira} /></Suspense>}
      {sheet && sheet.type === "registros" && <Suspense fallback={null}><RegistrosSheet db={db} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "espera" && <EsperaSheet key={sheet.id || "nova"} inicial={sheet.id ? db.espera.find(e => e.id === sheet.id) : null} onSave={act.salvarEspera} onDelete={act.tirarEspera} onClose={close} />}
      {sheet && sheet.type === "lanc" && <Suspense fallback={null}><LancSheet key={sheet.id || sheet.tipo + (sheet.n || "")} inicial={lancSel} pre={sheet.pre} tipo={sheet.tipo || "saida"} viagem={db.pessoal.viagem} onLogo={act.salvarLogo} onVoz={act.falarGasto} onFoto={servidorAvisos() ? act.lerComprovante : null} casa={casa.casa && casa.membros.length > 1 ? casa : null} onSave={act.salvarLanc} onDelete={act.apagarLanc} onClose={close} /></Suspense>}
      {sheet && sheet.type === "transp-gasto" && <Suspense fallback={null}><GastoTransporteSheet key={sheet.n} veiculos={veiculosDe(db)} veiculoId={sheet.veiculoId || (sheet.inicial && sheet.inicial.veiculoId) || veicAtual} sub0={sheet.sub} manut0={sheet.manut} inicial={sheet.inicial} precos={precosGuardados()} onSave={act.salvarLanc} onDelete={act.apagarLanc} onClose={close} /></Suspense>}
      {sheet && sheet.type === "recibo" && <Suspense fallback={null}><ReciboSheet key={sheet.pid + (sheet.cid || "")} db={db} conta={conta} pid={sheet.pid} cid={sheet.cid} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "imposto" && <Suspense fallback={null}><ImpostoSheet db={db} conta={conta} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "documentos" && <Suspense fallback={null}><DocumentosSheet key={sheet.pid} db={db} conta={conta} pid={sheet.pid} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "meus-dados" && <Suspense fallback={null}><MeusDadosSheet db={db} conta={conta} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "notas" && <Suspense fallback={null}><NotasSheet key={sheet.pid + (sheet.sid || "")} db={db} pid={sheet.pid} sid={sheet.sid} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "casa-gasto" && <Suspense fallback={null}><GastoCasaSheet key={sheet.n} casa={casa} inicial={sheet.inicial} pre={sheet.pre} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "casa-nota" && <Suspense fallback={null}><NotaSheet key={sheet.n} casa={casa} servidor={servidorAvisos()} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "casa-nota-ver" && <Suspense fallback={null}><NotaVerSheet key={sheet.n} lanc={sheet.lanc} onClose={close} /></Suspense>}
      {sheet && sheet.type === "casa-conta" && <Suspense fallback={null}><ContaCasaSheet key={sheet.n} casa={casa} inicial={sheet.inicial} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "casa-trazer" && <Suspense fallback={null}><TrazerGastosSheet key={sheet.n} casa={casa} db={db} ids0={sheet.ids} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "convite-casa" && <Suspense fallback={null}><ConviteCasaSheet casa={casa} token={sheet.token} onClose={close} onEntrou={() => {
        // a casa fica no lado pessoal: quem só usava o consultório passa a ver os dois
        if (!usaPessoal) onAtualizar({ perfil: { ...perfil, pessoal: true } });
        notify("Você entrou na casa!"); act.abrirCasa();
      }} /></Suspense>}
      {sheet && sheet.type === "veiculo" && <Suspense fallback={null}><VeiculoSheet key={sheet.id || "novo"} veiculo={sheet.id && sheet.id !== "novo" ? veiculosDe(db).find(x => x.id === sheet.id) || null : sheet.id === "novo" ? null : veiculosDe(db)[0] || null} db={db} onSave={act.salvarVeiculo} onDelete={act.removerVeiculo} onClose={close} /></Suspense>}
      {sheet && sheet.type === "loja" && <Suspense fallback={null}><LojaSheet key={sheet.n} sheet={sheet.qual === "convite" ? { ...sheet, onEntrou: () => {
        // quem entra numa loja passa a ver o modo Loja
        if (!usaLoja) onAtualizar({ perfil: { ...perfil, loja: true } });
        notify("Você entrou na loja!"); setTimeout(() => act.setModo("loja"), 300);
      } } : sheet} loja={loja} conta={conta} servidor={servidorAvisos()} onClose={close} act={act} /></Suspense>}
      {sheet && sheet.type === "clima" && <ClimaSheet clima={clima} cidade={perfil.cidade} act={act} onClose={close} />}
      {sheet && sheet.type === "cartoes" && <Suspense fallback={null}><PersonalizarInicio modo={sheet.modo} db={db} act={act} onClose={close} /></Suspense>}
      {sheet && sheet.type === "teto" && <Suspense fallback={null}><TetoSheet key={sheet.cat || "teto"} db={db} cat={sheet.cat} act={act} onClose={close} /></Suspense>}
      {sheet && sheet.type === "boleto" && <Suspense fallback={null}><BoletoSheet key={sheet.n || "boleto"} texto={sheet.texto} act={act} onClose={close} /></Suspense>}
      {sheet && sheet.type === "importar" && <Suspense fallback={null}><ImportarSheet key={sheet.n} db={db} act={act} onClose={close} arquivo={sheet.arquivo} doBanco={sheet.doBanco} /></Suspense>}
      {sheet && sheet.type === "caixinha" && <Suspense fallback={null}><CaixinhaSheet key={sheet.id || "nova"} cx={(db.pessoal.caixinhas || []).find(x => x.id === sheet.id) || null} act={act} onClose={close} /></Suspense>}
      {sheet && sheet.type === "parcelado" && <Suspense fallback={null}><ParceladoSheet onClose={close} /></Suspense>}
      {sheet && sheet.type === "aluguel" && <Suspense fallback={null}><AluguelSheet onClose={close} /></Suspense>}
      {sheet && sheet.type === "viagem" && <Suspense fallback={null}><ViagemSheet viagem={db.pessoal.viagem} lanc={db.pessoal.lanc} act={act} onClose={close} /></Suspense>}
      {sheet && sheet.type === "conta" && <Suspense fallback={null}><ContaSheet key={sheet.id || "nova" + (sheet.n || "")} inicial={contaSel} pre={sheet.pre} onLogo={act.salvarLogo} onBoleto={act.lerBoleto} onCopiar={t => copiarTexto(t.replace(/\D/g, ""), act, "Código copiado. É só colar no app do banco.")} onSave={act.salvarConta} onDelete={act.apagarConta} onClose={close} /></Suspense>}
    </>
  );
  if (!saindo) paineisCong.current = paineis;

  const rolouCab = useRolouTitulo(6);
  const falasAlerta = modoEf === "consultorio" ? conversa(db, now, act, perfil) : modoEf === "pessoal" && convP ? convP(db, act) : [];
  const nAlertas = falasAlerta.filter(f => f.acao).length; // a barra de cima ganha uma sombra suave quando o conteúdo passa por baixo dela
  // o que pede atenção logo que a pessoa entra (fica abaixo da saudação)
  const avisosInicio = <><AvisoNotificacoes conta={conta} modo={modoEf} act={act} />{avisoPlano0 && <AvisoCortesia fase={avisoPlano0} conta={conta} db={db} modo={modoEf} onPlanos={() => act.openSettings("assinatura")} />}</>;
  return (
    <div className={"shell" + (conta.fundo && imagemFundo(conta.fundo, meusFundos) ? " com-foto" + (conta.vidro !== false ? " glass" : "") : "") + (conta.vidro === false ? " solido" : "") + (conta.barra === "botoes" ? " barra-botoes" : "")} data-mode={modoEf}>
      {conta.fundo && imagemFundo(conta.fundo, meusFundos) && <div className="bgimg" aria-hidden="true" style={{ backgroundImage: `url(${imagemFundo(conta.fundo, meusFundos)})`, "--veil-o": { leve: .45, medio: .75, forte: 1 }[conta.fundo.veu || "medio"] }} />}
      <BarraLateral conta={conta} tema={tema} modo={modoEf} doisModos={doisModos} abas={abas} tab={tabEf} act={act} />

      <div className={"puxar" + (recarregando ? " gira" : puxar >= 70 ? " pronto" : "")} aria-hidden="true"
        style={{ transform: `translate(-50%, ${recarregando ? 46 : puxar * .45 + 2}px) rotate(${puxar * 2}deg)`, opacity: recarregando || puxar > 6 ? 1 : 0, transition: puxar ? "opacity .15s" : undefined }}>
        <svg viewBox="0 0 24 24"><circle className="puxar-trilho" cx="12" cy="12" r="8.5" /><circle className="puxar-arco" cx="12" cy="12" r="8.5" pathLength="100" style={{ strokeDashoffset: recarregando ? 70 : 100 - Math.min(1, puxar / 70) * 92 }} /></svg>
      </div>
      {/* Barra de cima do celular: fixa e sempre útil (logo, modo, olho e conta). No computador quem faz isso é a barra lateral */}
      <header className={"cab-app" + (rolouCab ? " rolou" : "")}>
        <div className="cab-app-in">
          <VoltarAoApp className="icon-btn cab-ic" />
          <button className="cab-app-logo" onClick={() => { if (tabEf !== inicioDo(modoEf)) act.setTab(inicioDo(modoEf)); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Avina, início"><AvinaNome /></button>
          <div className="cab-app-a">
            {doisModos && <button type="button" className="mode-pill cab-modo" onClick={() => { vibrar("toque"); setSheet({ type: "modo" }); }} aria-label={`Área: ${NOME_MODO[modoEf]}. Trocar`}><span className="mode-dot" />{NOME_MODO[modoEf]}<I.chevD /></button>}
            <button className="icon-btn cab-ic" onClick={act.toggleOculto} aria-label={oculto ? "Mostrar valores" : "Esconder valores"}>{oculto ? <I.eyeOff /> : <I.eye />}</button>
            {modoEf !== "loja" && <button className="icon-btn cab-ic cab-sino" onClick={() => { vibrar("toque"); setAlertas(true); }} aria-label={nAlertas ? `Alertas: ${nAlertas} pedem atenção` : "Alertas"}><I.bell />{nAlertas > 0 && <i className="cab-ponto" />}</button>}
            <Avatar conta={conta} onClick={act.openSettings} label="Sua conta e ajustes" />
          </div>
        </div>
      </header>
      <main className={"app" + (puxar ? " puxando" : "")} style={puxar || recarregando ? { transform: `translateY(${recarregando ? 46 : puxar * .5}px)` } : undefined}>
        <DicaInstalar />
        {tabEf === "l-caixa" && avisosInicio}
        {tabEf === "home" && <HomeTab db={db} conta={conta} now={now} act={act} tema={tema} avisos={avisosInicio} />}
        {tabEf === "agenda" && <AgendaTab db={db} now={now} act={act} tema={tema} />}
        {tabEf === "pac" && <PatientsTab db={db} act={act} tema={tema} vista={pacVista} setVista={setPacVista} />}
        {tabEf === "fin" && <FinanceTab db={db} act={act} tema={tema} meta={perfil.meta} />}
        {tabEf === "p-home" && <Suspense fallback={null}><PessoalHome db={db} conta={conta} now={now} act={act} tema={tema} avisos={avisosInicio} /></Suspense>}
        {tabEf === "p-gastos" && <Suspense fallback={null}><GastosTab db={db} act={act} tema={tema} /></Suspense>}
        {tabEf === "p-contas" && <Suspense fallback={null}><ContasTab db={db} act={act} tema={tema} /></Suspense>}
        {tabEf === "p-casa" && <Suspense fallback={null}><CasaPagina casa={casa} conta={conta} pix={db.settings.pix} act={act} tema={tema} foco={casaFoco} /></Suspense>}
        {tabEf === "l-caixa" && <Suspense fallback={null}><LojaCaixa loja={loja} conta={conta} act={act} tema={tema} /></Suspense>}
        {tabEf === "l-gastos" && <Suspense fallback={null}><LojaGastos loja={loja} conta={conta} act={act} tema={tema} /></Suspense>}
        {tabEf === "l-lista" && <Suspense fallback={null}><LojaLista loja={loja} conta={conta} act={act} tema={tema} /></Suspense>}
        {tabEf === "l-resumo" && <Suspense fallback={null}><LojaResumo loja={loja} conta={conta} act={act} tema={tema} /></Suspense>}
        {tabEf === "p-transp" && <Suspense fallback={null}><TransporteTab db={db} act={act} tema={tema} perfil={perfil} atual={veicAtual} onTrocar={setVeicAtual} /></Suspense>}
      </main>

      {festa.length > 0 && !sheet && !vozAtiva && !foco && (() => {
        const c = conquistas.find(x => x.id === festa[0]);
        return c && <Celebra key={c.id} c={c} total={conquistas.filter(x => x.feito).length} onFim={() => setFesta(f => f.slice(1))} onVer={() => { setFesta([]); act.openSettings("conquistas"); }} />;
      })()}
      {IA_CONVERSA && <VozBarra api={vozApi} db={db} usaPessoal={usaPessoal} nome={conta.nome} onNovo={act.novoLanc} onAtivo={setVozAtiva} onSalvar={act.salvarVoz} onComando={act.comandoVoz} onEditar={it => setSheet({ type: "lanc", tipo: it.tipo, pre: it })} />}
      <nav className="nav" aria-label="Seções">
        <div className="nav-in">
          {abas.map(a => (
            <button key={a.id} className={"nv" + (tabEf === a.id ? " on" : "")} onClick={() => act.setTab(a.id)} aria-current={tabEf === a.id ? "page" : undefined} aria-label={a.l}>
              <span className="nv-ic">{tabEf === a.id ? a.on : a.ic}{a.n > 0 && <span className="badge">{a.n > 99 ? "99+" : a.n}</span>}</span><span className="lb">{a.l}</span>
            </button>
          ))}
          {IA_CONVERSA && <button className={"nav-mic" + (vozAtiva ? " on" : "")} onClick={() => vozApi.current.tocar && vozApi.current.tocar()} aria-label={vozAtiva === "contando" ? "Salvar" : vozAtiva ? "Terminar" : "Falar"}>
            <Bolinha estado={vozAtiva} /><span className="lb">{vozAtiva === "contando" ? "Salvar" : vozAtiva === "resposta" || !vozAtiva ? "Falar" : "Parar"}</span>
          </button>}
        </div>
      </nav>

      {paineis}
      {sheet && sheet.type === "modo" && <ModoFolha modo={modoEf} modos={modos} act={act} onClose={close} />}
      {alertas && <AlertasTela falas={falasAlerta} onClose={() => setAlertas(false)} />}
      {foco && <Agora db={db} conta={conta} now={now} onClose={() => setFoco(false)} act={act} />}
      {tourVisto && !tourVisto[modoEf] && tabEf === inicioDo(modoEf) && !sheet && !festa.length && !foco && !vozAtiva && <Suspense fallback={null}><Tour key={modoEf} modo={modoEf} termo={TERMO} doisModos={doisModos} onFim={() => fimTour(modoEf)} /></Suspense>}

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
    if (email === EMAIL_DEMO_ANTIGO) { apagar(K.sessao); apagar(K.db(email)); return null; }
    const c = lerJSON(K.contas, {})[email];
    if (!c) return null;
    // Conta de antes da nuvem: pede a senha uma vez para levar tudo para a nuvem
    if (NUVEM && !c.uid) return { legado: c.email };
    return { conta: c, novo: false };
  });
  const [recuperar, setRecuperar] = useState(false);
  const sessaoRef = useRef(sessao); sessaoRef.current = sessao;
  const entrar = (conta, novo) => {
    const contas = lerJSON(K.contas, {});
    gravar(K.sessao, conta.email);
    // conta da nuvem: guarda uma cópia aqui para o app abrir na hora, até sem internet
    if (conta.uid) { const { hash: _h, ...limpa } = conta; gravar(K.contas, { ...contas, [conta.email]: limpa }); conta = limpa; }
    setSessao({ conta, novo });
    window.scrollTo(0, 0);
  };
  // limpar = a conta da nuvem que saiu com tudo já salvo lá: a cópia dela neste aparelho pode ir embora.
  // Só limpa a tela e o aparelho: quem desconecta da nuvem é o desconectar(), uma vez só (chamar o signOut
  // daqui, enquanto o Supabase avisa "saiu", fazia um avisar o outro sem fim e travava o app ao sair)
  const sair = limpar => {
    if (limpar && limpar.uid && limpar.email) {
      const contas = lerJSON(K.contas, {}); delete contas[limpar.email];
      gravar(K.contas, contas); apagar(K.db(limpar.email)); apagar(K.modo(limpar.email)); apagar(K.avisos(limpar.email));
    }
    const s = sessaoRef.current;
    sessaoRef.current = null;
    if (s && s.conta && s.conta.uid) desconectar();
    apagar(K.sessao); setSessao(null);
  };
  // Veio da página de apresentação (#entrar, #criar; o #demo dos links antigos abre o criar conta): limpa o endereço
  useEffect(() => {
    const h = location.hash;
    if (h === "#demo" || h === "#entrar" || h === "#criar") { const q = new URLSearchParams(location.search); q.delete("email"); q.delete("origem"); history.replaceState(null, "", location.pathname + (q.size ? `?${q}` : "")); }
  }, []);
  // Nuvem: confere se o login ainda vale e escuta os links dos e-mails (confirmar conta, senha nova)
  const daNuvem = !!(sessao && sessao.conta && sessao.conta.uid);
  useEffect(() => {
    const doEmail = /access_token=|error_description=|type=recovery/.test(location.hash);
    if (!NUVEM || (!daNuvem && !doEmail)) return;
    let vivo = true, inscricao = null;
    cliente().then(sb => {
      if (!vivo) return;
      inscricao = sb.auth.onAuthStateChange((ev, s) => {
        if (ev === "PASSWORD_RECOVERY") { setRecuperar(true); return; }
        // saiu por outro caminho (login revogado, outra aba): só fecha a tela, sem pedir para sair de novo.
        // Fica para depois do aviso do Supabase terminar, para nada rodar dentro dele
        if (ev === "SIGNED_OUT") { setTimeout(() => { const s = sessaoRef.current; if (s && s.conta && s.conta.uid) { sessaoRef.current = null; apagar(K.sessao); setSessao(null); } }, 0); return; }
        // confirmou o e-mail pelo link: já entra
        if (ev === "SIGNED_IN" && s && !(sessaoRef.current && sessaoRef.current.conta)) {
          setTimeout(() => contaDaNuvem(s.user, lerJSON(K.contas, {})[s.user.email]).then(c => { if (!(sessaoRef.current && sessaoRef.current.conta)) entrar(c, true); }).catch(() => {}), 0);
        }
      }).data.subscription;
      if (daNuvem) sb.auth.getSession().then(({ data, error }) => { if (vivo && !error && !data.session) sair(); }); // login vencido ou revogado (sem internet, segue normal)
    });
    return () => { vivo = false; if (inscricao) inscricao.unsubscribe(); };
  }, [daNuvem]);
  // Atualiza nome, foto ou perfil e guarda na lista de contas (e na nuvem)
  const atualizar = (patch, extra = {}) => {
    const contas = lerJSON(K.contas, {});
    const c = { ...sessao.conta, ...(contas[sessao.conta.email] || {}), ...patch };
    gravar(K.contas, { ...contas, [c.email]: c });
    setSessao(s => ({ ...s, ...extra, conta: { ...s.conta, ...patch } }));
    if (c.uid) enviarPerfil(c);
  };
  // O perfil mudou em outro aparelho
  const perfilNuvem = p => setSessao(s => {
    if (!s || !s.conta) return s;
    const conta = { ...s.conta, ...p };
    if (JSON.stringify(conta) === JSON.stringify(s.conta)) return s;
    const contas = lerJSON(K.contas, {}); gravar(K.contas, { ...contas, [conta.email]: conta });
    return { ...s, conta };
  });
  // App de celular (ponte 2): sem login (ou com o cadastro pela metade) o retrato vai vazio, e o app deixa a tela
  // do site na frente. Com login, quem manda o retrato e atende os pedidos é o Painel.
  const comPainel = !recuperar && !!(sessao && sessao.conta && sessao.conta.perfil && !sessao.conta.perfil.refazer);
  useEffect(() => {
    if (!nativoV2 || comPainel) return;
    const r = () => retratoSemLogin(tema);
    enviarEstado(r);
    return registrarNativo({ estado: r, tema: ({ modo } = {}) => { if (TEMAS_VALIDOS.includes(modo)) tema.setModo(modo); return null; } });
  }, [comPainel, tema.modo]);
  if (recuperar) return <NovaSenha onPronto={async user => {
    setRecuperar(false);
    if (!(sessao && sessao.conta)) entrar(await contaDaNuvem(user, lerJSON(K.contas, {})[user.email]), false);
  }} />;
  if (!sessao || sessao.legado) return <Auth onLogin={entrar} emailInicial={sessao && sessao.legado} aviso={sessao && sessao.legado ? "Agora seus dados ficam guardados na nuvem. Entre com a sua senha de sempre e eu levo tudo para lá." : null} />;
  if (!sessao.conta.perfil || sessao.conta.perfil.refazer) return <Suspense fallback={null}><Onboarding conta={sessao.conta} onSair={sair} onDone={({ inicial, ...d }) => { const e = sessao.conta.email; if (inicial) gravar(K.inicial(e), inicial); gravar(K.modo(e), modoInicial(d.perfil)); atualizar(d, { pronto: true }); window.scrollTo(0, 0); }} /></Suspense>;
  if (NUVEM && !noApp && sessao.conta.uid && !sessao.conta.whatsapp) return <PedirWhatsapp key={sessao.conta.uid} conta={sessao.conta} onSair={sair} onPronto={whatsapp => atualizar({ whatsapp })} onAchou={whatsapp => perfilNuvem({ whatsapp })} />;
  return <Painel key={sessao.conta.email} conta={sessao.conta} novo={sessao.novo} pronto={sessao.pronto} tema={tema} onSair={sair} onAtualizar={atualizar} onPerfilNuvem={perfilNuvem} />;
}


// Peças usadas pelas telas carregadas sob demanda (pasta telas/)
export { IA_CONVERSA, AvinaA, AvinaNome, Marca, Bolinha, logoPropria, fmtNum, AVISOS_PADRAO, num, todayISO, liquidoMes, addDays, itensDoDia, idadeDe, termoDe, DIA_CURTO, I, brl, pushLigado, appInstalado, Avatar, ESCONDER, ConfirmButton, PhotoPicker, Field, PROFISSOES, Seg, ehAniversario, DURACOES, Toggle, soNumero, vibrar, BASE, lerJSON, K_PUSH_URL, motivoSemPush, K_PUSH, lerArquivo, FUNDOS, Cropper, pedidoInstalar, ehIOS, PERFIL, registroPendente, contaDinheiro, Sheet, diaCurto, iniciais, corDe, relativo, dm, copiarTexto, mensagem, Money, soma, fromISO, segunda, feriado, vencimento, semanaKey, horariosLivres, DIA_LONGO, hTxt, primeiro, MES_LONGO, HelloRow, saudacao, WeatherChip, Talk, AreaChart, pad, TopBar, CORES, catDe, catVars, CatIcon, MarcaLogo, acharMarca, interpretarFala, CAT_ENTRADA, CATEGORIAS, brlReal, uid, situacaoConta, diffDias, ESTILO, liquidoDia, CalBadge, ajustarVibrar, limparPedidoInstalar, tetosAlerta, gastoPorCat, Ilustra, ProximaConquista, ajudaConquistas, useCamada, servidorAvisos, Confirmar, voltarDaTela, pagarContaP, despagarContaP, limiteDoApp, TopoInicio, situacao, liquido, useWide, TERMO,
  // o app de celular (src/app-nativo-trabalho.js): as regras do consultório sem tela
  registrar, desfazer, sublocacao, sessoesAbertas, cobrancasDoPix, freqNome, reajusteDe, periodoDe, mins, hhmm, INTERVALO_MIN, limitePacApp, csvDoMes };

export default App;
