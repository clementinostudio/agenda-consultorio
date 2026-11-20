// Link de agendamento: o app publica os horários livres no servidor (servidor-avisos/src/link.js)
// e busca os pedidos que os pacientes mandaram. O paciente abre a página public/agendar/, sem login.
// O mesmo link leva também:
// - as próximas sessões (para o paciente confirmar com um toque: ...&p=<paciente>&s=<data>);
// - a página do profissional (foto, registro, abordagem, online ou presencial, bio): o "link na bio";
// - o token da agenda para assinar no Google Agenda ou no iPhone (servidor: /link/agenda.ics).
import { useEffect, useRef, useState } from "react";
import { cliente, ENDERECO_APP } from "./nuvem.js";

export const LINK_PADRAO = { ativo: true, quem: "todos", antecedencia: 24, semanas: 2 };
export const linkDo = pf => ({ ...LINK_PADRAO, ...((pf && pf.link) || {}) });
// endereço que o paciente abre; com o id do paciente, é o link para ele remarcar
export const enderecoLink = (endereco, pid) => endereco ? `${ENDERECO_APP}agendar/?${endereco}${pid ? `&p=${pid}` : ""}` : "";
// o link de confirmar uma sessão: o paciente toca em "Confirmo presença" ou "Preciso remarcar"
export const enderecoConfirmar = (endereco, pid, iso) => endereco && pid && iso ? `${ENDERECO_APP}agendar/?${endereco}&p=${pid}&s=${iso}` : "";
// a agenda para assinar (Google Agenda, iPhone, Outlook): só as sessões, sem o nome do paciente (a menos que a pessoa escolha)
export const enderecoAgendaIcs = (servidor, endereco, token) => servidor && endereco && token ? `${servidor}/link/agenda.ics?c=${encodeURIComponent(endereco)}&k=${token}` : "";
export const linkGoogleAgenda = ics => `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(ics.replace(/^https?:/, "webcal:"))}`;
export const linkAgendaApple = ics => ics.replace(/^https?:/, "webcal:");
export const novoTokenAgenda = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");

// Confirmação: true (marcada à mão) ou { r: "sim" | "remarcar", em } (resposta do paciente). Veja link-regras.js
export { confirmacaoDe, confirmado } from "./link-regras.js";

// Nome do conselho na página do link ("CRP 08/12345")
const CONSELHO = { Psicologia: "CRP", Psiquiatria: "CRM", "Terapia ocupacional": "CREFITO", Fonoaudiologia: "CRFa", Nutrição: "CRN", Fisioterapia: "CREFITO" };
export const registroDe = pf => { const r = String(((pf && pf.doc) || {}).registro || "").trim(); if (!r) return ""; const c = CONSELHO[pf.profissao]; return c && !r.toUpperCase().startsWith(c) ? `${c} ${r}` : r; };

const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const DIA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// O recado para quem pediu pelo link, depois de aceitar ("Confirmado: ...") ou recusar (com o link para escolher outro
// horário). p: o pedido ({ nome, data, hora, pid }); perfil: o da pessoa (o endereço do link fica em perfil.link)
export function recadoDoPedido(p, aceitou, perfil) {
  const nome = String(p.nome || "").split(" ")[0], [y, m, d] = String(p.data).split("-").map(Number);
  if (aceitou) return `Oi, ${nome}! Confirmado: ${DIA_LONGO[new Date(y, m - 1, d).getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}, às ${p.hora}. Até lá!`;
  const endereco = linkDo(perfil).endereco;
  return `Oi, ${nome}! Esse horário não vai dar.${endereco ? ` Escolha outro por aqui: ${enderecoLink(endereco, p.pid)}` : " Me fala outro dia e horário que fica bom para você?"}`;
}
const lerLocal = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// Horários livres que vão para o link (a antecedência o servidor aplica na hora em que o paciente abre)
export function livresParaLink(db, cfg, horariosLivres, hoje) {
  const pedidos = new Set((db.pedidos || []).map(p => `${p.data} ${p.hora}`));
  return horariosLivres(db, hoje, cfg.semanas * 7 + 1)
    .map(d => ({ d: d.iso, h: d.livres.filter(m => !pedidos.has(`${d.iso} ${hhmm(m)}`)) }))
    .filter(d => d.h.length);
}

// A página do profissional no link: só o que a pessoa escolheu mostrar
function paginaDo(conta, pf) {
  const pg = (pf.link && pf.link.pagina) || {};
  const foto = pg.foto !== false && typeof conta.foto === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(conta.foto) && conta.foto.length <= 160000 ? conta.foto : null;
  return { foto, registro: pg.registro !== false ? registroDe(pf) : "", abordagem: pg.abordagem || "", modalidade: pg.modalidade || "", bio: pg.bio || "", cidade: pg.cidade !== false ? pf.cidade || "" : "" };
}

// no computador (npm run dev), localStorage "avina-asaas-teste" = 1 testa sem login (o servidor de teste aceita o e-mail)
const semLogin = conta => import.meta.env.DEV && !conta.uid && !!lerLocal("avina-asaas-teste", false);

async function chamar(servidor, conta, rota, corpo) {
  const headers = { "Content-Type": "application/json" };
  if (semLogin(conta)) headers["X-Teste-Uid"] = conta.email;
  else {
    const { data } = await (await cliente()).auth.getSession();
    if (!data.session) throw new Error("Entre de novo na sua conta para continuar");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let r;
  try { r = await fetch(`${servidor}/link/${rota}`, { method: "POST", headers, body: JSON.stringify(corpo) }); }
  catch (e) { throw new Error("Sem internet agora. Tente de novo em instantes."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) throw new Error(j.erro || (r.status === 404 ? "O servidor ainda não tem o link de agendamento." : "O servidor não respondeu. Tente de novo."));
  return j;
}

// Mantém o link em dia enquanto o app está aberto. O link passa a existir quando a pessoa abre "Link de agendamento"
// no Perfil, ou quando manda a primeira confirmação com link, ou liga a agenda no celular (nesses dois casos ele
// nasce fechado para pedidos de horário). Depois disso, cada mudança na agenda é publicada sozinha.
// proximas(db, hoje, dias): as próximas sessões ({ p, d, h, o, t }), para a confirmação e a agenda do celular.
export function useLinkAgendamento({ conta, db, setDb, servidor, horariosLivres, proximas, hoje, pushId, onEndereco, onPedidos, onRespostas }) {
  const pf = conta.perfil || {}, cfg = linkDo(pf);
  const pode = !!((conta.uid || semLogin(conta)) && servidor) && pf.consultorio !== false;
  const kPub = `avina-link:${conta.email}`;
  const [erro, setErro] = useState("");
  const cal = pf.agendaCal && pf.agendaCal.token;
  const dados = pode ? {
    nome: conta.nome, profissao: pf.profissao || "", duracao: pf.duracao || 50, termo: pf.termo || "Paciente",
    ativo: cfg.ativo, quem: cfg.quem, antecedencia: cfg.antecedencia,
    dias: cfg.ativo ? livresParaLink(db, cfg, horariosLivres, hoje) : [],
    pids: db.patients.filter(p => p.active).map(p => p.id), push: pushId || "",
    sessoes: proximas ? proximas(db, hoje, 60, pf.agendaCal && pf.agendaCal.nomes) : [],
    perfil: paginaDo(conta, pf), cal: cal || null,
    zap: String(conta.whatsapp || "").replace(/\D/g, "") || null,
  } : null;
  const assinatura = dados ? JSON.stringify(dados) : "";
  const ultimo = useRef(dados); ultimo.current = dados;

  // fechado: o link nasce só para confirmar sessões e para a agenda do celular (sem aceitar pedidos de horário)
  const publicar = async (forcar = false, { fechado = false } = {}) => {
    let d = ultimo.current; if (!d) return null;
    const novo = !cfg.endereco, fecha = fechado && novo && !(pf.link && "ativo" in pf.link);
    if (fecha) d = { ...d, ativo: false, dias: [] };
    const txt = JSON.stringify(d), feito = lerLocal(kPub, {});
    if (!forcar && feito.txt === txt && feito.endereco) return feito.endereco;
    const j = await chamar(servidor, conta, "publicar", d);
    gravarLocal(kPub, { txt, endereco: j.endereco, em: Date.now() });
    if (j.endereco && j.endereco !== cfg.endereco) onEndereco(j.endereco, fecha ? { ativo: false } : {});
    setErro("");
    return j.endereco;
  };
  // mudou a agenda, os horários ou as regras: publica de novo (espera a pessoa parar de mexer)
  useEffect(() => {
    if (!pode || !cfg.endereco) return;
    const t = setTimeout(() => publicar().catch(e => setErro(e.message)), 2500);
    return () => clearTimeout(t);
  }, [assinatura, cfg.endereco]);

  // pedidos e respostas que chegaram: busca ao abrir, ao voltar para o app e a cada 3 minutos
  const kVistos = `avina-link-vistos:${conta.email}`;
  const buscando = useRef(false);
  const buscar = async () => {
    if (!pode || !cfg.endereco || buscando.current) return;
    buscando.current = true;
    try {
      const { pedidos = [], respostas = [] } = await chamar(servidor, conta, "pedidos", {});
      if (!pedidos.length && !respostas.length) return;
      const vistos = lerLocal(kVistos, []);
      const novos = pedidos.filter(p => !vistos.includes(p.id));
      const novasResp = respostas.filter(r => !vistos.includes(r.id));
      if (novos.length) {
        setDb(d => {
          const ja = new Set((d.pedidos || []).map(p => p.id));
          const entram = novos.filter(p => !ja.has(p.id)).map(p => {
            const pac = p.pid && d.patients.find(x => x.id === p.pid);
            return { id: p.id, tipo: pac ? "remarcar" : "novo", pid: pac ? pac.id : null, nome: pac ? pac.name : p.nome, phone: pac ? pac.phone || "" : p.fone, data: p.data, hora: p.hora, criado: p.criado };
          });
          return entram.length ? { ...d, pedidos: [...(d.pedidos || []), ...entram] } : d;
        });
        onPedidos(novos.length);
      }
      // a resposta do paciente vale mais que a marcação à mão (e a mais nova vale mais que a antiga)
      if (novasResp.length) {
        setDb(d => {
          const conf = { ...(d.confirmados || {}) };
          novasResp.forEach(r => { if (!d.patients.some(p => p.id === r.pid)) return; const k = `${r.pid}:${r.d}`, antes = conf[k]; if (antes && antes.em && antes.em > r.em) return; conf[k] = { r: r.r === "remarcar" ? "remarcar" : "sim", em: r.em || Date.now() }; });
          return { ...d, confirmados: conf };
        });
        if (onRespostas) onRespostas(novasResp);
      }
      if (novos.length || novasResp.length) gravarLocal(kVistos, [...vistos, ...novos.map(p => p.id), ...novasResp.map(r => r.id)].slice(-300));
      // já está guardado no app (e na nuvem): sai do servidor
      await chamar(servidor, conta, "pedidos", { recebi: [...pedidos.map(p => p.id), ...respostas.map(r => r.id)] });
    } catch (e) { /* sem internet: tenta na próxima */ }
    finally { buscando.current = false; }
  };
  useEffect(() => {
    if (!pode || !cfg.endereco) return;
    buscar();
    const t = setInterval(() => { if (document.visibilityState === "visible") buscar(); }, 180000);
    const ver = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", ver);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ver); };
  }, [pode, cfg.endereco]);

  return { pode, endereco: cfg.endereco || null, erro, publicar, buscar };
}
