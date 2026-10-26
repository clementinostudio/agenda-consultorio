/*
  Nuvem (Supabase): login de verdade e dados sincronizados entre aparelhos.
  --------------------------------------------------------------------------
  O app continua funcionando primeiro no aparelho: abre na hora, salva sem internet e manda para a nuvem
  só o que mudou, item por item (cada paciente, sessão, cobrança, gasto...). O que não deu para mandar fica
  numa fila guardada no aparelho e sobe quando a internet volta. O que muda em outro aparelho chega na hora
  (tempo real) e também é conferido ao abrir o app e ao voltar para ele.

  Endereço e chave vêm do arquivo .env.local (no computador) ou das variáveis do GitHub (na publicação):
    VITE_SUPABASE_URL=https://xxxx.supabase.co
    VITE_SUPABASE_KEY=sb_publishable_...   (a chave "publishable"/"anon": pode ficar no app, quem protege é o RLS)
  Sem elas, o app funciona como antes: tudo só no aparelho.
  O banco (tabelas e regras de segurança) fica em supabase/migrations/.
*/
import { useEffect, useRef, useState } from "react";

const URL_NUVEM = import.meta.env.VITE_SUPABASE_URL;
const CHAVE_NUVEM = import.meta.env.VITE_SUPABASE_KEY;
export const NUVEM = !!(URL_NUVEM && CHAVE_NUVEM);
// Para onde voltam os links dos e-mails (confirmar conta, trocar senha)
export const ENDERECO_APP = location.origin + import.meta.env.BASE_URL;

const ler = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const K = { fila: u => `alvena-fila:${u}`, cursor: u => `alvena-cursor:${u}`, perfil: u => `alvena-perfil-pendente:${u}` };

// O Supabase só carrega quando precisa: o app abre sem esperar por ele
let _cliente = null;
export const cliente = () => _cliente || (_cliente = import("@supabase/supabase-js").then(({ createClient }) =>
  createClient(URL_NUVEM, CHAVE_NUVEM, { auth: { storageKey: "alvena-login", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })));

/* ---------- db <-> itens ---------- */
// Listas em que cada elemento (com id) vira uma linha. O resto do db (ajustes, dias fechados, modo viagem...)
// vira uma linha "doc" por chave.
const LISTAS = ["patients", "sessions", "charges", "espera", "pessoal.lanc", "pessoal.contas", "pessoal.caixinhas"];
const chave = (colecao, id) => `${colecao}|${id}`;
const partir = k => { const i = k.indexOf("|"); return [k.slice(0, i), k.slice(i + 1)]; };

// db -> Map("colecao|id" -> valor)
export function separar(db) {
  const m = new Map();
  const por = (col, v) => {
    if (v === undefined) return;
    if (LISTAS.includes(col) && Array.isArray(v)) v.forEach(x => { if (x && x.id != null) m.set(chave(col, x.id), x); });
    else m.set(chave("doc", col), v);
  };
  Object.entries(db || {}).forEach(([k, v]) => {
    if (k === "pessoal" && v && typeof v === "object" && !Array.isArray(v)) Object.entries(v).forEach(([k2, v2]) => por("pessoal." + k2, v2));
    else por(k, v);
  });
  return m;
}

// Aplica linhas vindas da nuvem no db (sem mexer no original)
export function aplicar(db, linhas) {
  const novo = { ...db, pessoal: { ...(db.pessoal || {}) } };
  const onde = caminho => { const [a, b] = caminho.split("."); return b ? [novo.pessoal, b] : [novo, a]; };
  const listas = {};
  const lista = col => {
    if (!listas[col]) { const [o, k] = onde(col); listas[col] = new Map((Array.isArray(o[k]) ? o[k] : []).map(x => [String(x.id), x])); }
    return listas[col];
  };
  for (const l of linhas) {
    if (l.colecao === "doc") { const [o, k] = onde(l.id); if (l.apagado) delete o[k]; else o[k] = l.dados; }
    else if (l.apagado) lista(l.colecao).delete(l.id);
    else lista(l.colecao).set(l.id, l.dados);
  }
  Object.entries(listas).forEach(([col, m]) => { const [o, k] = onde(col); o[k] = [...m.values()]; });
  return novo;
}

/* ---------- motor de sincronização (um por conta logada) ---------- */
let atual = null;

class Motor {
  constructor(conta, setDb, setStatus, aoPerfil) {
    this.uid = conta.uid;
    this.setDb = setDb; this.setStatus = setStatus; this.aoPerfil = aoPerfil;
    this.fila = new Map(Object.entries(ler(K.fila(this.uid), {})));
    this.ultimo = new Map(); // o que a nuvem já tem: chave -> { ref, json }
    this.vivo = true; this.tentativas = 0;
  }

  iniciar(db) {
    this.dbAtual = db;
    // Já sincronizou neste aparelho antes: o que está aqui já está na nuvem (o que não estava, está na fila).
    // Primeira vez: baixa tudo antes de comparar, para não passar por cima do que já está na nuvem.
    this.primeira = ler(K.cursor(this.uid), null) === null;
    if (!this.primeira) this.ultimo = this.retrato(db);
    this.aoOnline = () => { this.tentativas = 0; enviarPerfilPendente(this.uid); this.enviar(); this.puxar(); };
    this.aoOffline = () => this.status();
    this.aoVoltar = () => {
      if (document.visibilityState === "visible") { this.puxar(); this.enviar(); }
      else this.mudou(this.dbAtual, true); // saindo do app: confere tudo, por garantia, e manda já
    };
    addEventListener("online", this.aoOnline); addEventListener("offline", this.aoOffline);
    document.addEventListener("visibilitychange", this.aoVoltar);
    this.status();
    cliente().then(sb => { if (!this.vivo) return; this.sb = sb; this.puxar(); this.tempoReal(); });
  }

  parar() {
    this.vivo = false; clearTimeout(this.timer); clearTimeout(this.timerRetry); clearTimeout(this.timerRecebidos);
    removeEventListener("online", this.aoOnline); removeEventListener("offline", this.aoOffline);
    document.removeEventListener("visibilitychange", this.aoVoltar);
    if (this.canal && this.sb) this.sb.removeChannel(this.canal);
  }

  retrato(db) { const m = new Map(); separar(db).forEach((v, k) => m.set(k, { ref: v, json: JSON.stringify(v) })); return m; }

  status(forcar) {
    const s = forcar || (navigator.onLine === false ? "offline" : this.fila.size || this.primeira ? "enviando" : "ok");
    this.setStatus({ estado: s, pendentes: this.fila.size });
  }

  // O db mudou no aparelho: descobre o que mudou e põe na fila
  mudou(db, completo) {
    this.dbAtual = db;
    if (this.primeira || !db) return;
    const agora = separar(db); let mexeu = false;
    agora.forEach((v, k) => {
      const p = this.ultimo.get(k);
      if (p && p.ref === v && !completo) return;
      const json = JSON.stringify(v);
      if (p && p.json === json) { p.ref = v; return; }
      this.ultimo.set(k, { ref: v, json });
      this.fila.set(k, { d: v }); mexeu = true;
    });
    [...this.ultimo.keys()].forEach(k => { if (!agora.has(k)) { this.ultimo.delete(k); this.fila.set(k, { x: 1 }); mexeu = true; } });
    if (mexeu) { gravar(K.fila(this.uid), Object.fromEntries(this.fila)); this.status(); }
    if (mexeu || completo) { clearTimeout(this.timer); this.timer = setTimeout(() => this.enviar(), completo ? 0 : 700); }
  }

  async enviar() {
    if (this.enviando || !this.sb || !this.fila.size || this.primeira || navigator.onLine === false) return;
    this.enviando = true; this.status();
    try {
      while (this.fila.size && this.vivo) {
        const lote = [...this.fila.entries()].slice(0, 300);
        const linhas = lote.map(([k, v]) => { const [colecao, id] = partir(k); return { user_id: this.uid, colecao, id, dados: v.x ? null : v.d, apagado: !!v.x }; });
        const { error } = await this.sb.from("itens").upsert(linhas, { onConflict: "user_id,colecao,id" });
        if (error) throw error;
        lote.forEach(([k, v]) => { if (this.fila.get(k) === v) this.fila.delete(k); }); // só tira o que não mudou de novo enquanto subia
        gravar(K.fila(this.uid), Object.fromEntries(this.fila));
      }
      this.tentativas = 0; this.status();
    } catch (e) {
      console.warn("Nuvem: não consegui enviar agora", e);
      this.status(navigator.onLine === false ? "offline" : "erro");
      // tenta de novo daqui a pouco (2 s, 4 s, 8 s... até 2 min)
      clearTimeout(this.timerRetry);
      this.timerRetry = setTimeout(() => this.enviar(), Math.min(120000, 2000 * 2 ** this.tentativas++));
    } finally { this.enviando = false; }
  }

  async puxar() {
    if (!this.sb || navigator.onLine === false) return;
    if (this.puxando) { this.puxarDeNovo = true; return; }
    this.puxando = true;
    try {
      const cursor = ler(K.cursor(this.uid), null);
      // volta 1 minuto por garantia (mudanças que terminaram de gravar fora de ordem); repetir não faz mal
      const desde = cursor ? new Date(new Date(cursor).getTime() - 60000).toISOString() : null;
      const linhas = []; let maior = cursor;
      for (let de = 0; ; de += 1000) {
        let q = this.sb.from("itens").select("colecao,id,dados,apagado,atualizado_em").eq("user_id", this.uid);
        if (desde) q = q.gt("atualizado_em", desde);
        const { data, error } = await q.order("criado_em").order("colecao").order("id").range(de, de + 999);
        if (error) throw error;
        data.forEach(l => { linhas.push(l); if (!maior || l.atualizado_em > maior) maior = l.atualizado_em; });
        if (data.length < 1000) break;
      }
      if (!this.vivo) return;
      const aplicou = this.receber(linhas);
      gravar(K.cursor(this.uid), maior || "1970-01-01T00:00:00Z");
      if (this.primeira) {
        // Primeira vez: o que veio da nuvem já entrou; o que só existe neste aparelho (de antes da nuvem) sobe
        // quando o db novo chegar no mudou() (ou agora, se nada veio da nuvem)
        this.primeira = false;
        if (!aplicou) this.mudou(this.dbAtual);
      }
      this.status();
      await this.puxarPerfil();
    } catch (e) {
      console.warn("Nuvem: não consegui baixar agora", e);
      this.status(navigator.onLine === false ? "offline" : "erro");
    } finally {
      this.puxando = false;
      if (this.puxarDeNovo) { this.puxarDeNovo = false; this.puxar(); }
    }
  }

  // Linhas novas da nuvem (do puxar ou do tempo real) entram no db
  receber(linhas) {
    const novas = linhas.filter(l => {
      const k = chave(l.colecao, l.id);
      if (this.fila.has(k)) return false; // mudou aqui e ainda não subiu: vale a daqui
      const p = this.ultimo.get(k);
      if (l.apagado) return !!p || this.primeira;
      return !p || p.json !== JSON.stringify(l.dados); // igual ao que já temos (ex.: o eco do que acabamos de enviar)
    });
    if (!novas.length) return false;
    novas.forEach(l => {
      const k = chave(l.colecao, l.id);
      if (l.apagado) this.ultimo.delete(k); else this.ultimo.set(k, { ref: l.dados, json: JSON.stringify(l.dados) });
    });
    this.setDb(d => { const n = aplicar(d, novas); this.dbAtual = n; return n; });
    return true;
  }

  tempoReal() {
    const recebidos = [];
    this.canal = this.sb.channel(`alvena-${this.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "itens", filter: `user_id=eq.${this.uid}` }, p => {
        if (!p.new || !p.new.colecao) return;
        recebidos.push(p.new);
        clearTimeout(this.timerRecebidos);
        this.timerRecebidos = setTimeout(() => { if (!this.primeira) this.receber(recebidos.splice(0)); }, 150);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "perfis", filter: `id=eq.${this.uid}` }, p => { if (p.new) this.perfilChegou(p.new); })
      .subscribe(st => { if (st === "SUBSCRIBED") this.puxar(); }); // reconectou: confere o que perdeu
  }

  async puxarPerfil() {
    const { data } = await this.sb.from("perfis").select("nome,dados,atualizado_em").eq("id", this.uid).maybeSingle();
    if (data) this.perfilChegou(data);
  }
  perfilChegou(p) {
    if (ler(K.perfil(this.uid), null)) return; // mudança daqui esperando para subir
    if (p.dados && p.dados.perfil && this.aoPerfil) this.aoPerfil({ ...p.dados, nome: p.nome || p.dados.nome });
  }

  // Antes de sair: manda o que faltou (espera no máximo alguns segundos)
  async esvaziar() {
    this.mudou(this.dbAtual, true);
    const fim = Date.now() + 4000;
    while ((this.fila.size || this.enviando) && Date.now() < fim && navigator.onLine !== false) { await this.enviar(); if (this.fila.size) await new Promise(r => setTimeout(r, 300)); }
  }
}

// Liga a sincronização no painel. Devolve { estado: "ok" | "enviando" | "offline" | "erro", pendentes }
export function useNuvem(conta, db, setDb, aoPerfil) {
  const [status, setStatus] = useState({ estado: navigator.onLine === false ? "offline" : "ok", pendentes: 0 });
  const motor = useRef(null);
  const perfilRef = useRef(aoPerfil); perfilRef.current = aoPerfil;
  useEffect(() => {
    if (!NUVEM || !conta.uid) return;
    const m = new Motor(conta, setDb, setStatus, c => perfilRef.current && perfilRef.current(c));
    motor.current = atual = m;
    m.iniciar(db);
    return () => { m.parar(); if (atual === m) atual = null; };
  }, [conta.uid]);
  useEffect(() => { if (motor.current) motor.current.mudou(db); }, [db]);
  return NUVEM && conta.uid ? status : null;
}

/* ---------- perfil (nome, foto, respostas das perguntas iniciais) ---------- */
const semSegredos = c => { const { email, hash, uid, demo, ...resto } = c; return resto; };

export async function enviarPerfil(conta) {
  if (!NUVEM || !conta.uid) return;
  gravar(K.perfil(conta.uid), { id: conta.uid, nome: conta.nome || "", dados: semSegredos(conta) });
  return enviarPerfilPendente(conta.uid);
}
async function enviarPerfilPendente(uid) {
  const p = ler(K.perfil(uid), null);
  if (!p || navigator.onLine === false) return;
  try {
    const sb = await cliente();
    const { error } = await sb.from("perfis").upsert(p);
    if (error) throw error;
    if (JSON.stringify(ler(K.perfil(uid), null)) === JSON.stringify(p)) localStorage.removeItem(K.perfil(uid));
  } catch (e) { console.warn("Nuvem: perfil fica para depois", e); }
}

// Depois do login: junta o perfil da nuvem com o que já existia neste aparelho
export async function contaDaNuvem(user, local) {
  const sb = await cliente();
  const { data } = await sb.from("perfis").select("nome,dados").eq("id", user.id).maybeSingle();
  const base = { email: user.email, uid: user.id };
  const nomeMeta = (user.user_metadata && user.user_metadata.nome) || "";
  if (data && data.dados && data.dados.perfil) return { ...data.dados, nome: data.nome || data.dados.nome || nomeMeta, ...base };
  // A nuvem ainda não tem perfil: usa o deste aparelho (conta de antes da nuvem) e manda para lá
  const conta = local ? { ...semSegredos(local), ...base } : { nome: (data && data.nome) || nomeMeta, ...base };
  if (local && local.perfil) enviarPerfil(conta);
  return conta;
}

/* ---------- conta ---------- */
const mensagens = [
  [/invalid login credentials/i, "E-mail ou senha não conferem. Tenta de novo, sem pressa."],
  [/email not confirmed/i, "Falta confirmar o e-mail: toque no link que mandei para você."],
  [/already registered|already exists/i, "Esse e-mail já tem conta."],
  [/password should be at least|weak password/i, "Use uma senha com pelo menos 6 caracteres."],
  [/rate limit|too many/i, "Muitas tentativas seguidas. Espera um minutinho e tenta de novo."],
  [/failed to fetch|network|load failed/i, "Sem internet agora. Para entrar precisa de conexão (depois o app funciona sem)."],
  [/invalid.*email|unable to validate email/i, "Esse e-mail parece incompleto."],
];
export const traduzirErro = e => { const t = (e && (e.message || e.code)) || String(e); const m = mensagens.find(([r]) => r.test(t)); return m ? m[1] : "Algo deu errado do lado da nuvem. Tenta de novo daqui a pouco."; };

// Sai da conta. Devolve true quando tudo já estava na nuvem: aí o app pode apagar a cópia deste aparelho
// (dados de saúde não ficam largados num aparelho emprestado). Se algo não subiu, a cópia fica e sobe no próximo login.
export async function sairDaNuvem() {
  if (!NUVEM) return false;
  let limpo = false;
  try {
    if (atual) {
      await atual.esvaziar();
      if (!atual.fila.size) { limpo = true; const u = atual.uid; atual.parar(); atual = null; [K.fila(u), K.cursor(u)].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); }
    }
  } catch (e) {}
  try { const sb = await cliente(); await sb.auth.signOut({ scope: "local" }); } catch (e) {}
  return limpo;
}

// Apaga a conta e tudo dela na nuvem (o banco apaga perfil e itens em cascata)
export async function excluirContaNuvem(uid) {
  const sb = await cliente();
  const { error } = await sb.rpc("excluir_minha_conta");
  if (error) throw error;
  if (atual) { atual.parar(); atual = null; }
  [K.fila(uid), K.cursor(uid), K.perfil(uid)].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  try { await sb.auth.signOut({ scope: "local" }); } catch (e) {}
}
