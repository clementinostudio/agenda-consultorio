// Link de agendamento: o app publica os horários livres no servidor (servidor-avisos/src/link.js)
// e busca os pedidos que os pacientes mandaram. O paciente abre a página public/agendar/, sem login.
import { useEffect, useRef, useState } from "react";
import { cliente, ENDERECO_APP } from "./nuvem.js";

export const LINK_PADRAO = { ativo: true, quem: "todos", antecedencia: 24, semanas: 2 };
export const linkDo = pf => ({ ...LINK_PADRAO, ...((pf && pf.link) || {}) });
// endereço que o paciente abre; com o id do paciente, é o link para ele remarcar
export const enderecoLink = (endereco, pid) => endereco ? `${ENDERECO_APP}agendar/?${endereco}${pid ? `&p=${pid}` : ""}` : "";

const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const lerLocal = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// Horários livres que vão para o link (a antecedência o servidor aplica na hora em que o paciente abre)
export function livresParaLink(db, cfg, horariosLivres, hoje) {
  const pedidos = new Set((db.pedidos || []).map(p => `${p.data} ${p.hora}`));
  return horariosLivres(db, hoje, cfg.semanas * 7 + 1)
    .map(d => ({ d: d.iso, h: d.livres.filter(m => !pedidos.has(`${d.iso} ${hhmm(m)}`)) }))
    .filter(d => d.h.length);
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

// Mantém o link em dia enquanto o app está aberto. O link só passa a existir quando a pessoa abre
// "Link de agendamento" no Perfil (aí ganha o endereço); depois disso, cada mudança na agenda é publicada sozinha.
export function useLinkAgendamento({ conta, db, setDb, servidor, horariosLivres, hoje, pushId, onEndereco, onPedidos }) {
  const pf = conta.perfil || {}, cfg = linkDo(pf);
  const pode = !!((conta.uid || semLogin(conta)) && servidor) && pf.consultorio !== false;
  const kPub = `avina-link:${conta.email}`;
  const [erro, setErro] = useState("");
  const dados = pode ? {
    nome: conta.nome, profissao: pf.profissao || "", duracao: pf.duracao || 50, termo: pf.termo || "Paciente",
    ativo: cfg.ativo, quem: cfg.quem, antecedencia: cfg.antecedencia,
    dias: cfg.ativo ? livresParaLink(db, cfg, horariosLivres, hoje) : [],
    pids: db.patients.filter(p => p.active).map(p => p.id), push: pushId || "",
  } : null;
  const assinatura = dados ? JSON.stringify(dados) : "";
  const ultimo = useRef(dados); ultimo.current = dados;

  const publicar = async (forcar = false) => {
    const d = ultimo.current; if (!d) return null;
    const txt = JSON.stringify(d), feito = lerLocal(kPub, {});
    if (!forcar && feito.txt === txt && feito.endereco) return feito.endereco;
    const j = await chamar(servidor, conta, "publicar", d);
    gravarLocal(kPub, { txt, endereco: j.endereco, em: Date.now() });
    if (j.endereco && j.endereco !== cfg.endereco) onEndereco(j.endereco);
    setErro("");
    return j.endereco;
  };
  // mudou a agenda, os horários ou as regras: publica de novo (espera a pessoa parar de mexer)
  useEffect(() => {
    if (!pode || !cfg.endereco) return;
    const t = setTimeout(() => publicar().catch(e => setErro(e.message)), 2500);
    return () => clearTimeout(t);
  }, [assinatura, cfg.endereco]);

  // pedidos que chegaram: busca ao abrir, ao voltar para o app e a cada 3 minutos
  const kVistos = `avina-link-vistos:${conta.email}`;
  const buscando = useRef(false);
  const buscar = async () => {
    if (!pode || !cfg.endereco || buscando.current) return;
    buscando.current = true;
    try {
      const { pedidos = [] } = await chamar(servidor, conta, "pedidos", {});
      if (!pedidos.length) return;
      const vistos = lerLocal(kVistos, []);
      const novos = pedidos.filter(p => !vistos.includes(p.id));
      if (novos.length) {
        setDb(d => {
          const ja = new Set((d.pedidos || []).map(p => p.id));
          const entram = novos.filter(p => !ja.has(p.id)).map(p => {
            const pac = p.pid && d.patients.find(x => x.id === p.pid);
            return { id: p.id, tipo: pac ? "remarcar" : "novo", pid: pac ? pac.id : null, nome: pac ? pac.name : p.nome, phone: pac ? pac.phone || "" : p.fone, data: p.data, hora: p.hora, criado: p.criado };
          });
          return entram.length ? { ...d, pedidos: [...(d.pedidos || []), ...entram] } : d;
        });
        gravarLocal(kVistos, [...vistos, ...novos.map(p => p.id)].slice(-200));
        onPedidos(novos.length);
      }
      // já está guardado no app (e na nuvem): sai do servidor
      await chamar(servidor, conta, "pedidos", { recebi: pedidos.map(p => p.id) });
    } catch (e) { /* sem internet: tenta na próxima */ }
    finally { buscando.current = false; }
  };
  useEffect(() => {
    if (!pode || !cfg.endereco || !cfg.ativo) return;
    buscar();
    const t = setInterval(() => { if (document.visibilityState === "visible") buscar(); }, 180000);
    const ver = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", ver);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ver); };
  }, [pode, cfg.endereco, cfg.ativo]);

  return { pode, endereco: cfg.endereco || null, erro, publicar, buscar };
}
