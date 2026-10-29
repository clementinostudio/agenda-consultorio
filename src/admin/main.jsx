/*
  Painel do dono (app.avina.com.br/admin/)
  ----------------------------------------
  Contas, acessos, códigos, assinaturas e os números do Supabase e da Cloudflare, sem nunca abrir o conteúdo
  de ninguém: o banco só devolve quantidades (quantos pacientes, sessões, gastos...), nunca nomes, anotações ou valores.

  - Entra com a mesma conta do app (no mesmo navegador, já vem logado).
  - Só abre para quem está na tabela "admins" do banco E fez a verificação em 2 etapas
    (código do app autenticador). Na primeira vez, o painel mostra o QR para cadastrar.
  - Banco: funções admin_* (supabase/migrations/20261029100000_admin.sql e 20261030000000_admin_acoes.sql).
  - Assinaturas, códigos, cortesias, avisos e Cloudflare: servidor de avisos (servidor-avisos/src/admin.js).
  - Cada ação fica anotada na aba Registro.
  Para dar admin pela primeira vez: bash ligar-admin.sh seu@email
*/
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "./admin.css";
import { NUVEM, cliente } from "../nuvem.js";
import { fDataHora, fNum, relativo } from "./util.jsx";
import Geral from "./geral.jsx";
import { Contas, Ficha } from "./contas.jsx";
import Acessos from "./acessos.jsx";
import Codigos from "./codigos.jsx";
import Sistema, { Registro } from "./sistema.jsx";

const SERVIDOR = String(import.meta.env.VITE_AVISOS_URL || "https://agenda-avisos.alvena.workers.dev").trim().replace(/\/+$/, "");
const EXEMPLO = import.meta.env.DEV && new URLSearchParams(location.search).has("exemplo"); // só no computador: dados inventados para ver as telas

const ABAS = { geral: "Visão geral", contas: "Contas", acessos: "Acessos e IPs", codigos: "Códigos", sistema: "Sistema", registro: "Registro" };

/* ---------- painel (depois de entrar) ---------- */
function Painel({ fontes, email, eu, sair }) {
  const [aba, setAba] = useState(() => (location.hash.slice(1) in ABAS ? location.hash.slice(1) : "geral"));
  const [filtro, setFiltro] = useState("todas");
  const [dados, setDados] = useState(null), [erro, setErro] = useState(""), [busy, setBusy] = useState(false);
  const [aberta, setAberta] = useState(null), [aviso, setAviso] = useState(null);
  const carregar = useCallback(async () => {
    setBusy(true); setErro("");
    try {
      const d = await fontes.tudo();
      setDados(d);
      // a ficha aberta passa a mostrar os dados novos (ou fecha, se a conta foi excluída)
      setAberta(a => a && (d.usuarios.find(u => u.id === a.id) || null));
    } catch (e) { setErro(e.message || String(e)); }
    setBusy(false);
  }, [fontes]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { history.replaceState(null, "", "#" + aba); }, [aba]);
  const avisar = texto => { setAviso(texto); setTimeout(() => setAviso(a => (a === texto ? null : a)), 4500); };
  const irPara = (a, f) => { setAba(a); if (f) setFiltro(f); scrollTo(0, 0); };
  const comum = dados && { fontes, usuarios: dados.usuarios, abrir: setAberta, avisar };
  return (
    <div className="painel">
      <header className="topo">
        <div className="marca"><img src="../icons/favicon.svg" alt="" /><b>Avina</b><span>Painel</span></div>
        <nav className="abas">
          {Object.entries(ABAS).map(([k, n]) => (
            <button key={k} className={aba === k ? "sim" : ""} onClick={() => setAba(k)}>{n}{k === "contas" && dados ? ` (${fNum(dados.usuarios.length)})` : ""}</button>
          ))}
        </nav>
        <div className="acoes">
          {dados && <small title={fDataHora(dados.resumo.gerado_em)}>atualizado {relativo(dados.resumo.gerado_em)}</small>}
          <button className="botao leve" onClick={carregar} disabled={busy}>{busy ? "Atualizando…" : "Atualizar"}</button>
          <button className="botao leve" onClick={sair} title={email}>Sair</button>
        </div>
      </header>
      <main>
        {erro && <p className="erro">{erro}</p>}
        {dados && dados.kv.erro && <p className="aviso"><b>O servidor de avisos não respondeu</b> ({dados.kv.erro}). Sem ele, o painel não sabe quem tem Pro, código ou cortesia: os planos aparecem como "?". Se acabou de atualizar, publique o servidor de novo.</p>}
        {!dados && !erro && <p className="vazio">Carregando…</p>}
        {dados && aba === "geral" && <Geral {...dados} abrir={setAberta} irPara={irPara} />}
        {dados && aba === "contas" && <Contas usuarios={dados.usuarios} kv={dados.kv} abrir={setAberta} filtro={filtro} setFiltro={setFiltro} fontes={fontes} avisar={avisar} />}
        {dados && aba === "acessos" && <Acessos {...comum} />}
        {dados && aba === "codigos" && <Codigos {...comum} />}
        {dados && aba === "sistema" && <Sistema fontes={fontes} resumo={dados.resumo} />}
        {dados && aba === "registro" && <Registro {...comum} />}
        <p className="rodape">O painel mostra só dados da conta e quantidades. O que cada pessoa anota (pacientes, sessões, gastos) nunca aparece aqui.</p>
      </main>
      {aberta && <Ficha u={aberta} kv={dados.kv} fontes={fontes} eu={eu} fechar={() => setAberta(null)} recarregar={carregar} avisar={avisar} />}
      {aviso && <div className="toast" role="status">{aviso}</div>}
    </div>
  );
}

/* ---------- de onde vêm os dados ---------- */
function fontesDe(sb) {
  const rpc = async (nome, args) => {
    const { data, error } = await sb.rpc(nome, args);
    if (error) throw new Error(error.code === "42501" ? "A sessão de admin acabou. Entre de novo." : error.message);
    return data;
  };
  const servidor = async (rota, corpo = {}) => {
    const token = (await sb.auth.getSession()).data.session?.access_token;
    let r;
    try { r = await fetch(SERVIDOR + rota, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); }
    catch (e) { throw new Error("o servidor de avisos não respondeu"); }
    const j = await r.json().catch(() => ({ erro: `O servidor respondeu ${r.status}` }));
    if (!r.ok || j.erro) throw new Error(j.erro || `O servidor respondeu ${r.status}`);
    return j;
  };
  return {
    tudo: async () => {
      const [resumo, usuarios, kv, funil] = await Promise.all([rpc("admin_resumo"), rpc("admin_usuarios"),
        servidor("/admin/assinaturas").catch(e => ({ erro: e.message })), rpc("admin_funil").catch(() => null)]);
      return { resumo, usuarios, kv, funil };
    },
    acessos: uid => rpc("admin_acessos", { p_user: uid }),
    asaas: uid => servidor("/admin/assinatura", { uid }),
    recentes: () => rpc("admin_acessos_recentes", { p_limite: 400 }),
    ips: dias => rpc("admin_ips_repetidos", { p_dias: dias }),
    codigos: () => servidor("/admin/codigos"),
    criarCodigo: o => servidor("/admin/codigo/criar", o),
    apagarCodigo: codigo => servidor("/admin/codigo/apagar", { codigo }),
    cortesia: (uid, ate) => servidor("/admin/cortesia", { uid, ate }),
    aviso: o => servidor("/admin/aviso", o),
    excluir: uid => servidor("/admin/excluir", { uid }),
    bloquear: (uid, dias) => rpc("admin_bloquear", { p_user: uid, p_dias: dias }),
    desconectar: uid => rpc("admin_desconectar", { p_user: uid }),
    definirAdmin: (uid, sim) => rpc("admin_definir_admin", { p_user: uid, p_sim: sim }),
    trocarSenha: async email => {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/" });
      if (error) throw new Error(/rate limit/i.test(error.message) ? "O Supabase só manda poucos e-mails por hora no plano grátis. Tente daqui a pouco." : error.message);
      await rpc("admin_anotar", { p_acao: "link de trocar senha", p_alvo: null, p_detalhe: { email } }).catch(() => {});
    },
    sistema: () => rpc("admin_sistema"),
    cloudflare: atualizar => servidor("/admin/cloudflare", { atualizar: !!atualizar }),
    log: () => rpc("admin_log_lista", { p_limite: 500 }),
  };
}

/* ---------- entrar ---------- */
function Cartao({ titulo, children }) {
  return <div className="entrar"><div className="cartao"><div className="marca"><img src="../icons/favicon.svg" alt="" /><b>Avina</b><span>Painel</span></div><h1>{titulo}</h1>{children}</div></div>;
}

function Entrar({ sb, pronto }) {
  const [email, setEmail] = useState(""), [senha, setSenha] = useState(""), [erro, setErro] = useState(""), [busy, setBusy] = useState(false);
  const enviar = async e => {
    e.preventDefault(); setBusy(true); setErro("");
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    setBusy(false);
    if (error) return setErro(/invalid login/i.test(error.message) ? "E-mail ou senha não conferem." : error.message);
    pronto();
  };
  return (
    <Cartao titulo="Entrar">
      <form onSubmit={enviar}>
        <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></label>
        {erro && <p className="erro">{erro}</p>}
        <button className="botao" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="nota">A mesma conta do app. Depois pede o código do app autenticador.</p>
    </Cartao>
  );
}

function Codigo({ sb, fase, pronto, sair }) {
  const [cod, setCod] = useState(""), [erro, setErro] = useState(""), [busy, setBusy] = useState(false);
  const enviar = async e => {
    e.preventDefault(); setBusy(true); setErro("");
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: fase.fator, code: cod.replace(/\D/g, "") });
    setBusy(false);
    if (error) { setCod(""); return setErro(/invalid|expired/i.test(error.message) ? "Código não confere. Use o que está aparecendo agora no app." : error.message); }
    pronto();
  };
  const novo = fase.f === "cadastrar";
  return (
    <Cartao titulo={novo ? "Ligar a verificação em 2 etapas" : "Código de verificação"}>
      {novo && <>
        <p>O painel só abre com um código que muda a cada 30 segundos. No celular, abra um app autenticador (Google Authenticator, Microsoft Authenticator, 2FAS…), toque em <b>+</b> e leia este QR:</p>
        <img className="qr" src={fase.qr} alt="QR para o app autenticador" />
        <details><summary>Não dá para ler o QR?</summary><p>Digite esta chave no app: <code className="segredo">{fase.segredo}</code></p></details>
      </>}
      <form onSubmit={enviar}>
        <label>{novo ? "Agora digite o código de 6 números que apareceu" : `Abra o app autenticador e digite o código do Avina (${fase.email})`}
          <input className="cod" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={cod} onChange={e => setCod(e.target.value)} autoFocus required />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button className="botao" disabled={busy || cod.replace(/\D/g, "").length < 6}>{busy ? "Conferindo…" : "Confirmar"}</button>
      </form>
      <button className="link" onClick={sair}>Entrar com outra conta</button>
    </Cartao>
  );
}

/* ---------- raiz: descobre em que passo está ---------- */
function Raiz() {
  const [sb, setSb] = useState(null), [fase, setFase] = useState({ f: "carregando" });
  const conferir = useCallback(async () => {
    if (EXEMPLO) return setFase({ f: "pronto", email: "dono@avina.com.br", uid: "00000000-aaaa-4bbb-8ccc-000000000000" });
    if (!NUVEM) return setFase({ f: "erro", msg: "Este build não tem o endereço do Supabase (.env.local ou .env.production)." });
    try {
      const s = sb || await cliente(); setSb(s);
      const { data: { session } } = await s.auth.getSession();
      if (!session) return setFase({ f: "entrar" });
      const email = session.user.email, uid = session.user.id;
      const { data: eu, error } = await s.rpc("sou_admin");
      if (error) return setFase({ f: "erro", msg: /sou_admin|PGRST202/.test(error.message + error.code) ? "O banco ainda não tem o painel. No computador, rode: bash ligar-admin.sh seu@email" : error.message });
      if (!eu.admin) return setFase({ f: "nao-admin", email });
      if (!eu.verificado) {
        const { data: fs, error: e1 } = await s.auth.mfa.listFactors();
        if (e1) return setFase({ f: "erro", msg: e1.message });
        const ok = (fs.totp || []).find(f => f.status === "verified");
        if (ok) return setFase({ f: "codigo", fator: ok.id, email });
        // começou a cadastrar antes e não terminou: começa de novo
        for (const f of (fs.all || []).filter(f => f.factor_type === "totp" && f.status !== "verified")) await s.auth.mfa.unenroll({ factorId: f.id });
        const { data: novo, error: e2 } = await s.auth.mfa.enroll({ factorType: "totp", friendlyName: "Avina painel", issuer: "Avina" });
        if (e2) return setFase({ f: "erro", msg: e2.message });
        return setFase({ f: "cadastrar", fator: novo.id, qr: novo.totp.qr_code, segredo: novo.totp.secret, email });
      }
      setFase({ f: "pronto", email, uid });
    } catch (e) { setFase({ f: "erro", msg: e.message || String(e) }); }
  }, [sb]);
  useEffect(() => { conferir(); }, []);
  // sai só deste navegador (no mesmo navegador, sai do app também: é o mesmo login)
  const sair = async () => { if (sb) await sb.auth.signOut({ scope: "local" }).catch(() => {}); setFase({ f: "entrar" }); };
  const fontes = useMemo(() => EXEMPLO ? exemplo() : sb && fontesDe(sb), [sb]);

  if (fase.f === "carregando") return <Cartao titulo="Abrindo…" />;
  if (fase.f === "erro") return <Cartao titulo="Não deu para abrir"><p className="erro">{fase.msg}</p><button className="botao" onClick={conferir}>Tentar de novo</button></Cartao>;
  if (fase.f === "entrar") return <Entrar sb={sb} pronto={conferir} />;
  if (fase.f === "nao-admin") return <Cartao titulo="Esta conta não é admin"><p>{fase.email} entrou, mas não tem acesso ao painel.</p><button className="botao" onClick={sair}>Entrar com outra conta</button></Cartao>;
  if (fase.f === "codigo" || fase.f === "cadastrar") return <Codigo sb={sb} fase={fase} pronto={conferir} sair={sair} />;
  return <Painel fontes={fontes} email={fase.email} eu={fase.uid} sair={sair} />;
}

// Dados inventados para ver as telas no computador (npm run dev → /admin/?exemplo). Não vai para o app publicado.
function exemplo() {
  const m = () => import("./exemplo.js");
  return new Proxy({}, { get: (_, nome) => (...args) => m().then(x => x[nome](...args)) });
}

createRoot(document.getElementById("root")).render(<Raiz />);
