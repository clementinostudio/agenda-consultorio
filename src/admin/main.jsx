/*
  Painel do dono (app.avina.com.br/admin/)
  ----------------------------------------
  Contas, acessos e números do app, sem nunca abrir o conteúdo de ninguém: o banco só devolve
  quantidades (quantos pacientes, sessões, gastos...), nunca nomes, anotações ou valores.

  - Entra com a mesma conta do app (no mesmo navegador, já vem logado).
  - Só abre para quem está na tabela "admins" do banco E fez a verificação em 2 etapas
    (código do app autenticador). Na primeira vez, o painel mostra o QR para cadastrar.
  - Contas, acessos e índices: funções admin_* do banco (supabase/migrations/20261029100000_admin.sql).
  - Assinaturas, cortesias, IA e avisos: servidor de avisos (servidor-avisos/src/admin.js).
  Para virar admin: bash ligar-admin.sh seu@email
*/
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "./admin.css";
import { NUVEM, cliente } from "../nuvem.js";

const SERVIDOR = String(import.meta.env.VITE_AVISOS_URL || "https://agenda-avisos.alvena.workers.dev").trim().replace(/\/+$/, "");
const EXEMPLO = import.meta.env.DEV && new URLSearchParams(location.search).has("exemplo"); // só no computador: dados inventados para ver as telas

/* ---------- formatos ---------- */
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const addDias = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
const dt = iso => iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso) : null;
const fData = iso => iso ? dt(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fDiaMes = iso => iso ? dt(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
const fDataHora = iso => iso ? dt(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fNum = n => Number(n || 0).toLocaleString("pt-BR");
const fReais = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function relativo(iso) {
  if (!iso) return "nunca";
  const s = (Date.now() - dt(iso).getTime()) / 1000;
  if (s < 90) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : fData(iso);
}

// "Mozilla/5.0 (Linux; Android 14) ... Chrome/130" -> "Android · Chrome"
function aparelho(ua) {
  if (!ua) return "—";
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "?";
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /OPR\//.test(ua) ? "Opera" : /FxiOS|Firefox/.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  return nav ? `${so} · ${nav}` : so;
}

// Nomes das listas do app (src/nuvem.js, LISTAS)
const LISTA = {
  patients: "Pacientes", sessions: "Sessões", charges: "Cobranças", espera: "Lista de espera", notas: "Notas", pedidos: "Pedidos de horário",
  "pessoal.lanc": "Gastos e entradas", "pessoal.contas": "Contas da casa", "pessoal.caixinhas": "Caixinhas", "pessoal.veiculos": "Veículos",
};
const nomeLista = c => LISTA[c] || c;
const NOME_MODO = { consultorio: "Consultório", pessoal: "Pessoal", loja: "Loja" };

// Mesma regra do app (modosDo em src/App.jsx)
function modosDe(u) {
  if (!u.perfil_feito) return [];
  const c = u.m_consultorio !== "false", l = u.m_loja === "true", ps = u.m_pessoal !== "false" || (!c && !l);
  return [c && "consultorio", ps && "pessoal", l && "loja"].filter(Boolean);
}
const totalItens = u => Object.values(u.contagem || {}).reduce((s, n) => s + n, 0);

// O plano de cada conta, do que o servidor guarda (o "Ver no Asaas agora" da ficha lê o estado exato)
function planoDe(u, kv) {
  const a = (kv && kv.contas && kv.contas[u.id]) || {}, hoje = hojeBR(), inicio = kv && kv.cobrancaInicio;
  const antiga = inicio && String(u.criado_em).slice(0, 10) < inicio ? addDias(inicio, 30) : "";
  const cort = [a.cortesiaAte || "", antiga].sort().pop();
  const teste = a.ambiente === "sandbox";
  if (a.assinando && a.nivel === "pro") return { tipo: "pro", rotulo: a.nomePlano || "Pro", mensal: teste ? 0 : a.mensal, teste, a };
  if (a.assinando) return { tipo: "aguardando", rotulo: "Aguardando pagamento", teste, a };
  if (a.ate && hoje < a.ate) return { tipo: "cancelada", rotulo: `Cancelada (Pro até ${fDiaMes(a.ate)})`, teste, a };
  if (cort && hoje <= cort) return { tipo: "cortesia", rotulo: `Cortesia até ${fDiaMes(cort)}`, a };
  return { tipo: "gratis", rotulo: "Grátis", a };
}

/* ---------- gráfico de barras (uma série, um dia por barra) ---------- */
function teto(m) {
  if (m <= 5) return Math.max(1, m);
  const p = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 2.5, 5, 10].map(f => f * p).find(v => v >= m);
}
function Barras({ dados, titulo, unidade }) {
  const ref = useRef(null);
  const [w, setW] = useState(640), [foco, setFoco] = useState(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  const H = 180, topo = 10, base = H - 22, esq = 30;
  const max = teto(Math.max(0, ...dados.map(d => d.n)));
  const marcas = max <= 5 ? [0, max] : [0, max / 2, max];
  const slot = (w - esq) / dados.length, larg = Math.max(1, slot - 2);
  const y = v => base - (v / max) * (base - topo);
  const cada = Math.ceil(dados.length / 6);
  const total = dados.reduce((s, d) => s + d.n, 0);
  const d = foco != null ? dados[foco] : null;
  return (
    <figure className="grafico" ref={ref}>
      <figcaption><b>{titulo}</b><span>{fNum(total)} no período</span></figcaption>
      <div className="grafico-area" onMouseLeave={() => setFoco(null)}>
        <svg width={w} height={H} role="img" aria-label={`${titulo}: ${fNum(total)} no período`}>
          {marcas.map(m => (
            <g key={m}>
              <line x1={esq} x2={w} y1={y(m)} y2={y(m)} className={m === 0 ? "eixo" : "grade"} />
              <text x={esq - 6} y={y(m) + 4} textAnchor="end" className="rotulo">{fNum(m)}</text>
            </g>
          ))}
          {dados.map((p, i) => {
            const x = esq + i * slot + 1, h = base - y(p.n), r = Math.min(4, larg / 2, h);
            return (
              <g key={p.dia}>
                {p.n > 0 && <path className={"barra" + (foco === i ? " acesa" : "")}
                  d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + larg - r} Q${x + larg},${base - h} ${x + larg},${base - h + r} V${base} Z`} />}
                {(dados.length - 1 - i) % cada === 0 && <text x={x + larg / 2} y={H - 6} textAnchor="middle" className="rotulo">{fDiaMes(p.dia)}</text>}
                <rect x={esq + i * slot} y={topo} width={slot} height={base - topo} fill="transparent"
                  onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)} />
              </g>
            );
          })}
        </svg>
        {d && (
          <div className="dica" style={{ left: Math.min(Math.max(esq + foco * slot + slot / 2, 60), w - 60), top: Math.max(0, y(d.n) - 46) }}>
            <b>{fNum(d.n)}</b> {d.n === 1 ? unidade[0] : unidade[1]}<span>{fData(d.dia)}</span>
          </div>
        )}
      </div>
      <details className="em-tabela">
        <summary>Ver em tabela</summary>
        <table><thead><tr><th>Dia</th><th className="num">{unidade[1]}</th></tr></thead>
          <tbody>{dados.slice().reverse().map(p => <tr key={p.dia}><td>{fData(p.dia)}</td><td className="num">{fNum(p.n)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

const Numero = ({ rotulo, valor, sub }) => (
  <div className="numero"><span>{rotulo}</span><b>{valor}</b>{sub && <small>{sub}</small>}</div>
);

/* ---------- visão geral ---------- */
function Geral({ resumo: r, usuarios, kv }) {
  const planos = usuarios.map(u => planoDe(u, kv));
  const pro = planos.filter(p => p.tipo === "pro" && !p.teste);
  const mrr = pro.reduce((s, p) => s + (p.mensal || 0), 0);
  const conta = t => planos.filter(p => p.tipo === t && !p.teste).length;
  return (
    <>
      <section className="numeros">
        <Numero rotulo="Contas" valor={fNum(r.contas.total)} sub={`+${fNum(r.contas.hoje)} hoje · +${fNum(r.contas.d7)} em 7 dias · +${fNum(r.contas.d30)} em 30`} />
        <Numero rotulo="Usaram hoje" valor={fNum(r.ativos.d1)} sub={`${fNum(r.ativos.d7)} em 7 dias · ${fNum(r.ativos.d30)} em 30`} />
        <Numero rotulo="Assinantes Pro" valor={kv.erro ? "—" : fNum(pro.length)}
          sub={kv.erro ? kv.erro : `${fNum(conta("aguardando"))} aguardando · ${fNum(conta("cancelada"))} cancelando · ${fNum(conta("cortesia"))} em cortesia`} />
        <Numero rotulo="Receita por mês" valor={kv.erro ? "—" : fReais(mrr)} sub="estimada: anuais divididos por 12" />
      </section>

      <section className="graficos">
        <Barras titulo="Cadastros por dia" dados={r.cadastros_dia} unidade={["cadastro", "cadastros"]} />
        <Barras titulo="Contas que usaram o app, por dia" dados={r.ativos_dia} unidade={["conta", "contas"]} />
      </section>

      <section className="blocos">
        <div className="bloco">
          <h3>Como usam</h3>
          <table><tbody>
            {Object.entries(NOME_MODO).map(([k, n]) => <tr key={k}><td>{n}</td><td className="num">{fNum(r.modos[k])}</td></tr>)}
            <tr><td>Não terminaram o cadastro</td><td className="num">{fNum(r.contas.sem_perfil)}</td></tr>
            <tr><td>Casas (dinheiro a dois)</td><td className="num">{fNum(r.casas.casas)} <small>· {fNum(r.casas.pessoas)} pessoas</small></td></tr>
            <tr><td>Lojas</td><td className="num">{fNum(r.lojas.lojas)} <small>· {fNum(r.lojas.ajudantes)} ajudantes</small></td></tr>
          </tbody></table>
        </div>
        <div className="bloco">
          <h3>O que guardam <small>(só quantidades)</small></h3>
          <table><thead><tr><th>Lista</th><th className="num">Itens</th><th className="num">Contas</th></tr></thead><tbody>
            {r.colecoes.map(c => <tr key={c.colecao}><td>{nomeLista(c.colecao)}</td><td className="num">{fNum(c.itens)}</td><td className="num">{fNum(c.contas)}</td></tr>)}
            {r.lojas.itens > 0 && <tr><td>Itens das lojas</td><td className="num">{fNum(r.lojas.itens)}</td><td className="num">{fNum(r.lojas.lojas)}</td></tr>}
          </tbody></table>
        </div>
        <div className="bloco">
          <h3>De onde acessam <small>(30 dias)</small></h3>
          {r.acessos.cidades.length ? (
            <table><thead><tr><th>Cidade</th><th className="num">Contas</th></tr></thead><tbody>
              {r.acessos.cidades.map(c => <tr key={c.cidade + c.regiao}><td>{c.cidade}{c.regiao ? <small> · {c.regiao}</small> : null}</td><td className="num">{fNum(c.contas)}</td></tr>)}
            </tbody></table>
          ) : <p className="vazio">Ainda sem registros: começam a aparecer quando o app novo for publicado.</p>}
        </div>
        <div className="bloco">
          <h3>Servidor</h3>
          <table><tbody>
            <tr><td>Registros de acesso guardados</td><td className="num">{fNum(r.acessos.registros)}</td></tr>
            <tr><td>Acessos nas últimas 24 h</td><td className="num">{fNum(r.acessos.d1)}</td></tr>
            <tr><td>Contas com verificação em 2 etapas</td><td className="num">{fNum(r.contas.com_2etapas)}</td></tr>
            {!kv.erro && <>
              <tr><td>Aparelhos recebendo avisos</td><td className="num">{fNum(kv.aparelhosComAviso)}</td></tr>
              <tr><td>IA hoje: voz</td><td className="num">{fNum(kv.ia.voz.usos)} <small>· {fNum(kv.ia.voz.pessoas)} pessoas</small></td></tr>
              <tr><td>IA hoje: Bolinha e fotos</td><td className="num">{fNum(kv.ia.ia.usos)} <small>· {fNum(kv.ia.ia.pessoas)} pessoas</small></td></tr>
              <tr><td>Cobrança</td><td className="num">{kv.asaasLigado ? `ligada desde ${fData(kv.cobrancaInicio)}` : "desligada"}</td></tr>
            </>}
          </tbody></table>
        </div>
      </section>
    </>
  );
}

/* ---------- lista de contas ---------- */
const FILTROS = {
  todas: ["Todas", () => true],
  pro: ["Pro", (u, p) => p.tipo === "pro"],
  gratis: ["Grátis", (u, p) => p.tipo === "gratis"],
  cortesia: ["Cortesia", (u, p) => p.tipo === "cortesia"],
  ativas: ["Usaram em 7 dias", u => ultimoUso(u) > Date.now() - 7 * 864e5],
  paradas: ["Paradas há 30+ dias", u => ultimoUso(u) < Date.now() - 30 * 864e5],
  incompletas: ["Cadastro incompleto", u => !u.perfil_feito],
};
const ORDENS = {
  novas: ["Mais novas", (a, b) => String(b.criado_em).localeCompare(String(a.criado_em))],
  uso: ["Último uso", (a, b) => ultimoUso(b) - ultimoUso(a)],
  itens: ["Mais itens", (a, b) => totalItens(b) - totalItens(a)],
};
function ultimoUso(u) {
  return Math.max(...[u.ultimo_acesso, u.ultima_mudanca, u.ultimo_login].filter(Boolean).map(x => dt(x).getTime()), 0);
}
const ultimoUsoIso = u => { const t = ultimoUso(u); return t ? new Date(t).toISOString() : null; };

function baixarCsv(lista, kv) {
  const col = ["id", "email", "nome", "cadastro", "ultimo_uso", "ip", "cidade", "uf", "aparelho", "modos", "plano", "itens"];
  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const linhas = lista.map(u => [u.id, u.email, u.nome, u.criado_em, ultimoUsoIso(u), u.ip, u.cidade, u.regiao, aparelho(u.aparelho),
    modosDe(u).map(m => NOME_MODO[m]).join("+"), planoDe(u, kv).rotulo, totalItens(u)].map(esc).join(";"));
  const blob = new Blob(["﻿" + [col.join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `avina-contas-${hojeBR()}.csv` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Contas({ usuarios, kv, abrir }) {
  const [busca, setBusca] = useState(""), [filtro, setFiltro] = useState("todas"), [ordem, setOrdem] = useState("novas");
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios
      .filter(u => FILTROS[filtro][1](u, planoDe(u, kv)))
      .filter(u => !q || [u.nome, u.email, u.cidade, u.regiao, u.ip, u.profissao, u.id].some(v => String(v || "").toLowerCase().includes(q)))
      .sort(ORDENS[ordem][1]);
  }, [usuarios, kv, busca, filtro, ordem]);
  return (
    <section className="contas">
      <div className="filtros">
        <input type="search" placeholder="Buscar por nome, e-mail, cidade ou IP" value={busca} onChange={e => setBusca(e.target.value)} />
        <div className="chips">
          {Object.entries(FILTROS).map(([k, [n]]) => <button key={k} className={"chip" + (filtro === k ? " sim" : "")} onClick={() => setFiltro(k)}>{n}</button>)}
        </div>
        <select value={ordem} onChange={e => setOrdem(e.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <button className="botao leve" onClick={() => baixarCsv(lista, kv)}>Baixar planilha</button>
      </div>
      <p className="contador">{fNum(lista.length)} {lista.length === 1 ? "conta" : "contas"}</p>
      <div className="tabela-rola">
        <table className="tabela-contas">
          <thead><tr><th>Conta</th><th>Cadastro</th><th>Último uso</th><th>Onde</th><th>Aparelho</th><th>Modos</th><th>Plano</th><th className="num">Itens</th></tr></thead>
          <tbody>
            {lista.map(u => {
              const p = planoDe(u, kv);
              return (
                <tr key={u.id} onClick={() => abrir(u)} tabIndex={0} onKeyDown={e => e.key === "Enter" && abrir(u)}>
                  <td><b>{u.nome || "(sem nome)"}</b>{u.admin && <span className="selo">admin</span>}<small>{u.email}</small></td>
                  <td>{fData(u.criado_em)}</td>
                  <td title={fDataHora(ultimoUsoIso(u))}>{relativo(ultimoUsoIso(u))}</td>
                  <td>{u.cidade ? <>{u.cidade}{u.regiao ? `/${u.regiao}` : ""}</> : "—"}<small className="mono">{u.ip || ""}</small></td>
                  <td>{aparelho(u.aparelho)}</td>
                  <td>{modosDe(u).map(m => NOME_MODO[m]).join(", ") || <span className="fraco">incompleto</span>}</td>
                  <td><span className={"plano " + p.tipo}>{p.rotulo}</span>{p.teste && <span className="selo">teste</span>}</td>
                  <td className="num">{fNum(totalItens(u))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- ficha de uma conta ---------- */
function Ficha({ u, kv, fontes, fechar }) {
  const [acessos, setAcessos] = useState(null), [asaas, setAsaas] = useState(null), [copiado, setCopiado] = useState(false);
  useEffect(() => { setAcessos(null); setAsaas(null); fontes.acessos(u.id).then(setAcessos, e => setAcessos({ erro: e.message })); }, [u.id]);
  useEffect(() => { const k = e => e.key === "Escape" && fechar(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  const p = planoDe(u, kv), a = p.a || {};
  const verAsaas = () => { setAsaas({ carregando: true }); fontes.asaas(u.id).then(setAsaas, e => setAsaas({ erro: e.message })); };
  const copiar = () => navigator.clipboard.writeText(u.id).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); });
  const listas = Object.entries(u.contagem || {}).sort((x, y) => y[1] - x[1]);
  return (
    <div className="ficha-fundo" onClick={fechar}>
      <aside className="ficha" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Conta de ${u.nome || u.email}`}>
        <header>
          <div><h2>{u.nome || "(sem nome)"}</h2><p>{u.email}</p></div>
          <button className="fechar" onClick={fechar} aria-label="Fechar">×</button>
        </header>
        <div className="selos">
          {u.admin && <span className="selo">admin</span>}
          <span className={"selo " + (u.dois_passos ? "ok" : "")}>{u.dois_passos ? "2 etapas ligada" : "sem 2 etapas"}</span>
          <span className="selo">{u.email_ok ? "e-mail confirmado" : "e-mail não confirmado"}</span>
          {u.bloqueado_ate && dt(u.bloqueado_ate) > new Date() && <span className="selo ruim">bloqueada até {fData(u.bloqueado_ate)}</span>}
        </div>

        <h3>Conta</h3>
        <dl>
          <dt>Cadastro</dt><dd>{fDataHora(u.criado_em)}</dd>
          <dt>Último login</dt><dd>{fDataHora(u.ultimo_login)}</dd>
          <dt>Último acesso</dt><dd>{fDataHora(u.ultimo_acesso)} {u.ultimo_acesso && <small>({relativo(u.ultimo_acesso)})</small>}</dd>
          <dt>Última mudança</dt><dd>{fDataHora(u.ultima_mudanca)}</dd>
          <dt>Profissão</dt><dd>{u.profissao || "—"}</dd>
          <dt>Modos</dt><dd>{modosDe(u).map(m => NOME_MODO[m]).join(", ") || "cadastro incompleto"}</dd>
          <dt>Entrou com</dt><dd>{u.provedor}</dd>
          <dt>ID</dt><dd><code>{u.id}</code> <button className="link" onClick={copiar}>{copiado ? "copiado" : "copiar"}</button></dd>
        </dl>

        <h3>Plano</h3>
        <dl>
          <dt>Agora</dt><dd><span className={"plano " + p.tipo}>{p.rotulo}</span>{p.teste && <span className="selo">teste (sandbox)</span>}</dd>
          {a.plano && <><dt>Desde</dt><dd>{fData(a.desde)} · {a.forma === "cartao" ? "cartão" : a.forma || "—"}</dd></>}
          {a.pagamentos > 0 && <><dt>Pagou</dt><dd>{fReais(a.totalPago)} em {a.pagamentos} {a.pagamentos === 1 ? "pagamento" : "pagamentos"}{a.devolvidos ? ` · ${a.devolvidos} devolvido(s)` : ""}</dd></>}
        </dl>
        {!kv.erro && kv.asaasLigado && (a.plano || a.assinando) && (
          asaas == null ? <button className="botao leve" onClick={verAsaas}>Ver no Asaas agora</button>
            : asaas.carregando ? <p className="vazio">Perguntando ao Asaas…</p>
              : asaas.erro ? <p className="erro">{asaas.erro}</p>
                : <dl className="asaas">
                  <dt>Situação</dt><dd>{asaas.status}</dd>
                  {asaas.proxima && <><dt>Próxima cobrança</dt><dd>{fData(asaas.proxima)}</dd></>}
                  {asaas.pendente && <><dt>Em aberto</dt><dd>{fReais(asaas.pendente.valor)} · vence {fData(asaas.pendente.vencimento)}{asaas.pendente.atrasada ? " (atrasada)" : ""}</dd></>}
                  {asaas.garantia && <><dt>Garantia</dt><dd>até {fData(asaas.garantia.ate)}</dd></>}
                  {(asaas.historico || []).map(h => <React.Fragment key={h.id}><dt>{fData(h.data)}</dt><dd>{fReais(h.valor)} · {h.forma}{h.devolvido ? " · devolvido" : ""}</dd></React.Fragment>)}
                </dl>
        )}

        <h3>Uso <small>(só quantidades)</small></h3>
        {listas.length ? <dl>{listas.map(([c, n]) => <React.Fragment key={c}><dt>{nomeLista(c)}</dt><dd>{fNum(n)}</dd></React.Fragment>)}</dl>
          : <p className="vazio">Nada guardado na nuvem ainda.</p>}
        {(u.casa || u.loja) && <dl>
          {u.casa && <><dt>Casa</dt><dd>{u.casa}</dd></>}
          {u.loja && <><dt>Loja</dt><dd>{u.loja.nome} <small>({u.loja.papel})</small></dd></>}
        </dl>}

        <h3>Acessos <small>(guardados 6 meses)</small></h3>
        {acessos == null ? <p className="vazio">Carregando…</p>
          : acessos.erro ? <p className="erro">{acessos.erro}</p>
            : !acessos.length ? <p className="vazio">Nenhum acesso registrado ainda.</p>
              : <div className="tabela-rola"><table className="acessos">
                <thead><tr><th>Quando</th><th>IP</th><th>Cidade</th><th>Aparelho</th></tr></thead>
                <tbody>{acessos.map((x, i) => (
                  <tr key={i}>
                    <td>{fDataHora(x.quando)}{x.ultimo !== x.quando && <small>até {fDataHora(x.ultimo).slice(-5)}</small>}</td>
                    <td className="mono">{x.ip || "—"}</td>
                    <td>{x.cidade ? `${x.cidade}${x.regiao ? "/" + x.regiao : ""}` : "—"}{x.pais && x.pais !== "BR" ? ` (${x.pais})` : ""}</td>
                    <td title={x.aparelho || ""}>{aparelho(x.aparelho)}</td>
                  </tr>
                ))}</tbody>
              </table></div>}
      </aside>
    </div>
  );
}

/* ---------- painel (depois de entrar) ---------- */
function Painel({ fontes, email, sair }) {
  const [aba, setAba] = useState("geral"), [dados, setDados] = useState(null), [erro, setErro] = useState(""), [busy, setBusy] = useState(false), [aberta, setAberta] = useState(null);
  const carregar = useCallback(async () => {
    setBusy(true); setErro("");
    try { setDados(await fontes.tudo()); } catch (e) { setErro(e.message || String(e)); }
    setBusy(false);
  }, [fontes]);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <div className="painel">
      <header className="topo">
        <div className="marca"><img src="../icons/favicon.svg" alt="" /><b>Avina</b><span>Painel</span></div>
        <nav className="abas">
          <button className={aba === "geral" ? "sim" : ""} onClick={() => setAba("geral")}>Visão geral</button>
          <button className={aba === "contas" ? "sim" : ""} onClick={() => setAba("contas")}>Contas{dados ? ` (${fNum(dados.usuarios.length)})` : ""}</button>
        </nav>
        <div className="acoes">
          {dados && <small title={fDataHora(dados.resumo.gerado_em)}>atualizado {relativo(dados.resumo.gerado_em)}</small>}
          <button className="botao leve" onClick={carregar} disabled={busy}>{busy ? "Atualizando…" : "Atualizar"}</button>
          <button className="botao leve" onClick={sair} title={email}>Sair</button>
        </div>
      </header>
      <main>
        {erro && <p className="erro">{erro}</p>}
        {dados && dados.kv.erro && <p className="aviso">Assinaturas indisponíveis agora: {dados.kv.erro}</p>}
        {!dados && !erro && <p className="vazio">Carregando…</p>}
        {dados && aba === "geral" && <Geral {...dados} />}
        {dados && aba === "contas" && <Contas usuarios={dados.usuarios} kv={dados.kv} abrir={setAberta} />}
        <p className="rodape">O painel mostra só dados da conta e quantidades. O que cada pessoa anota (pacientes, sessões, gastos) nunca aparece aqui.</p>
      </main>
      {aberta && <Ficha u={aberta} kv={dados.kv} fontes={fontes} fechar={() => setAberta(null)} />}
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
    const r = await fetch(SERVIDOR + rota, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({ erro: `O servidor respondeu ${r.status}` }));
    if (!r.ok || j.erro) throw new Error(j.erro || `O servidor respondeu ${r.status}`);
    return j;
  };
  return {
    tudo: async () => {
      const [resumo, usuarios, kv] = await Promise.all([rpc("admin_resumo"), rpc("admin_usuarios"),
        servidor("/admin/assinaturas").catch(e => ({ erro: /fetch/i.test(e.message) ? "o servidor de avisos não respondeu" : e.message }))]);
      return { resumo, usuarios, kv };
    },
    acessos: uid => rpc("admin_acessos", { p_user: uid }),
    asaas: uid => servidor("/admin/assinatura", { uid }),
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
    if (EXEMPLO) return setFase({ f: "pronto", email: "dono@avina.com.br" });
    if (!NUVEM) return setFase({ f: "erro", msg: "Este build não tem o endereço do Supabase (.env.local ou .env.production)." });
    try {
      const s = sb || await cliente(); setSb(s);
      const { data: { session } } = await s.auth.getSession();
      if (!session) return setFase({ f: "entrar" });
      const email = session.user.email;
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
      setFase({ f: "pronto", email });
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
  return <Painel fontes={fontes} email={fase.email} sair={sair} />;
}

// Dados inventados para ver as telas no computador (npm run dev → /admin/?exemplo). Não vai para o app publicado.
function exemplo() {
  const carregar = () => import("./exemplo.js");
  return {
    tudo: () => carregar().then(m => m.tudo()),
    acessos: uid => carregar().then(m => m.acessos(uid)),
    asaas: () => carregar().then(m => m.asaas()),
  };
}

createRoot(document.getElementById("root")).render(<Raiz />);
