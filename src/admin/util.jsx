// Painel do dono: formatos, regras de plano e peças de tela usadas em todas as abas
import React, { useEffect, useRef, useState } from "react";

/* ---------- formatos ---------- */
export const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export const addDias = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
export const dt = iso => iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso) : null;
export const fData = iso => iso ? dt(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
export const fDiaMes = iso => iso ? dt(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
export const fDataHora = iso => iso ? dt(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const fNum = n => n == null ? "—" : Number(n).toLocaleString("pt-BR");
export const fReais = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fPct = (a, b) => b ? `${Math.round((100 * a) / b)}%` : "—";
export function fBytes(n) {
  if (n == null) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0, v = Number(n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 && i ? 1 : 0 })} ${u[i]}`;
}
export function relativo(iso) {
  if (!iso) return "nunca";
  const s = (Date.now() - dt(iso).getTime()) / 1000;
  if (s < 90) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : fData(iso);
}

// "Mozilla/5.0 (Linux; Android 14) ... Chrome/130" -> "Android · Chrome"
export function aparelho(ua) {
  if (!ua) return "—";
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "?";
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /OPR\//.test(ua) ? "Opera" : /FxiOS|Firefox/.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  return nav ? `${so} · ${nav}` : so;
}
export const ondeDe = x => x && x.cidade ? `${x.cidade}${x.regiao ? "/" + x.regiao : ""}${x.pais && x.pais !== "BR" ? ` (${x.pais})` : ""}` : "—";
// Operadora sem o "S.A.", "LTDA"... ("Claro S.A." -> "Claro")
export const fRede = r => r ? r.replace(/\s*(S\.?\/?A\.?|LTDA\.?|Ltda\.?|EIRELI|ME|Inc\.?|LLC)\s*$/i, "").replace(/\s{2,}/g, " ").trim() : "";

// Nomes das listas do app (src/nuvem.js, LISTAS)
const LISTA = {
  patients: "Pacientes", sessions: "Sessões", charges: "Cobranças", espera: "Lista de espera", notas: "Notas", pedidos: "Pedidos de horário",
  "pessoal.lanc": "Gastos e entradas", "pessoal.contas": "Contas da casa", "pessoal.caixinhas": "Caixinhas", "pessoal.veiculos": "Veículos",
};
export const nomeLista = c => LISTA[c] || c;
export const NOME_MODO = { consultorio: "Consultório", pessoal: "Pessoal", loja: "Loja" };

// Mesma regra do app (modosDo em src/App.jsx)
export function modosDe(u) {
  if (!u.perfil_feito) return [];
  const c = u.m_consultorio !== "false", l = u.m_loja === "true", ps = u.m_pessoal !== "false" || (!c && !l);
  return [c && "consultorio", ps && "pessoal", l && "loja"].filter(Boolean);
}
export const totalItens = u => Object.values(u.contagem || {}).reduce((s, n) => s + n, 0);
export const bloqueada = u => !!(u.bloqueado_ate && dt(u.bloqueado_ate) > new Date());
export const ultimoUso = u => Math.max(...[u.ultimo_acesso, u.ultima_mudanca, u.ultimo_login].filter(Boolean).map(x => dt(x).getTime()), 0);
export const ultimoUsoIso = u => { const t = ultimoUso(u); return t ? new Date(t).toISOString() : null; };

/* ---------- plano de cada conta ----------
   Do que o servidor guarda (assin:, plano:, cort:, usou:). A mesma regra do /assinatura/ver:
   vale a data mais longe entre a cortesia de conta antiga (criada antes da cobrança começar) e a do código/painel. */
export const TEM_PRO = ["pago", "codigo", "cortesia", "antiga"];
export function planoDe(u, kv) {
  if (!kv || kv.erro) return { tipo: "desconhecido", rotulo: "?", a: {} };
  const a = kv.contas[u.id] || {}, hoje = hojeBR(), inicio = kv.cobrancaInicio;
  const antiga = inicio && String(u.criado_em).slice(0, 10) < inicio ? addDias(inicio, 30) : "";
  const codigo = (a.codigos || []).slice().sort((x, y) => String(y.dia).localeCompare(String(x.dia)))[0] || null;
  const teste = a.ambiente === "sandbox", base = { a, codigo, antiga, teste };
  if (a.assinando && a.nivel === "pro") return { ...base, tipo: "pago", rotulo: a.nomePlano || "Pro", mensal: teste ? 0 : a.mensal };
  if (a.assinando) return { ...base, tipo: "aguardando", rotulo: "Aguardando o 1º pagamento" };
  if (a.ate && hoje < a.ate) return { ...base, tipo: "cancelada", rotulo: `Cancelou (Pro até ${fDiaMes(a.ate)})` };
  const cort = a.cortesiaAte || "", fim = cort > antiga ? cort : antiga;
  // usou código e ainda está valendo: mostra o código (mesmo que a cortesia de conta antiga vá até o mesmo dia)
  if (cort && hoje <= cort && codigo) return { ...base, tipo: "codigo", ate: fim, rotulo: `Código ${codigo.codigo} · até ${fDiaMes(fim)}` };
  if (cort && hoje <= cort && cort >= antiga) return { ...base, tipo: "cortesia", ate: cort, rotulo: `Cortesia até ${fDiaMes(cort)}` };
  if (antiga && hoje <= antiga) return { ...base, tipo: "antiga", ate: antiga, rotulo: `Conta antiga · até ${fDiaMes(antiga)}` };
  if (codigo) return { ...base, tipo: "gratis", rotulo: `Grátis (código ${codigo.codigo} venceu)` };
  return { ...base, tipo: "gratis", rotulo: "Grátis" };
}

/* ---------- gráfico de barras (uma série, um dia por barra) ---------- */
function teto(m) {
  if (m <= 5) return Math.max(1, m);
  const p = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 2.5, 5, 10].map(f => f * p).find(v => v >= m);
}
export function Barras({ dados, titulo, unidade, total = true, formato = fNum }) {
  const ref = useRef(null);
  const [w, setW] = useState(640), [foco, setFoco] = useState(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  const H = 170, topo = 10, base = H - 22, esq = 40;
  const max = teto(Math.max(0, ...dados.map(d => d.n)));
  const marcas = max <= 5 ? [0, max] : [0, max / 2, max];
  const slot = (w - esq) / Math.max(1, dados.length), larg = Math.max(1, Math.min(slot - 2, 42));
  const y = v => base - (v / max) * (base - topo);
  const cada = Math.ceil(dados.length / 7);
  const soma = dados.reduce((s, d) => s + d.n, 0);
  const d = foco != null ? dados[foco] : null;
  return (
    <figure className="grafico" ref={ref}>
      <figcaption><b>{titulo}</b>{total && <span>{formato(soma)} no período</span>}</figcaption>
      <div className="grafico-area" onMouseLeave={() => setFoco(null)}>
        <svg width={w} height={H} role="img" aria-label={`${titulo}: ${formato(soma)} no período`}>
          {marcas.map(m => (
            <g key={m}>
              <line x1={esq} x2={w} y1={y(m)} y2={y(m)} className={m === 0 ? "eixo" : "grade"} />
              <text x={esq - 6} y={y(m) + 4} textAnchor="end" className="rotulo">{formato(m)}</text>
            </g>
          ))}
          {dados.map((p, i) => {
            const x = esq + i * slot + (slot - larg) / 2, h = base - y(p.n), r = Math.min(4, larg / 2, h);
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
            <b>{formato(d.n)}</b> {d.n === 1 ? unidade[0] : unidade[1]}<span>{fData(d.dia)}</span>
          </div>
        )}
      </div>
      <details className="em-tabela">
        <summary>Ver em tabela</summary>
        <table><thead><tr><th>Dia</th><th className="num">{unidade[1]}</th></tr></thead>
          <tbody>{dados.slice().reverse().map(p => <tr key={p.dia}><td>{fData(p.dia)}</td><td className="num">{formato(p.n)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

export const Numero = ({ rotulo, valor, sub, onClick }) => (
  <div className={"numero" + (onClick ? " clica" : "")} onClick={onClick}><span>{rotulo}</span><b>{valor}</b>{sub && <small>{sub}</small>}</div>
);

// Quanto já foi usado de um limite grátis. Perto do fim, a barra e o texto avisam (nunca só pela cor).
export function Medidor({ rotulo, usado, limite, formato = fNum, nota }) {
  const p = limite ? Math.min(1, (usado || 0) / limite) : 0;
  const nivel = p >= 0.9 ? "critico" : p >= 0.7 ? "alerta" : "ok";
  return (
    <div className={"medidor " + nivel}>
      <div className="medidor-topo"><span>{rotulo}</span><b>{formato(usado)} <small>de {formato(limite)}</small></b></div>
      <div className="medidor-trilho" role="meter" aria-valuemin={0} aria-valuemax={limite} aria-valuenow={usado || 0} aria-label={rotulo}>
        <div style={{ width: `${Math.max(p > 0 ? 1.5 : 0, p * 100)}%` }} />
      </div>
      <small className="medidor-nota">{nivel === "critico" ? "⚠ quase no limite · " : nivel === "alerta" ? "△ passou de 70% · " : ""}{fPct(usado || 0, limite)} usado{nota ? ` · ${nota}` : ""}</small>
    </div>
  );
}

// Janela de "tem certeza?". Para o que não tem volta, pede para digitar uma palavra (ex.: o e-mail da conta).
export function Confirmar({ titulo, texto, botao = "Confirmar", perigo, digitar, onSim, onNao }) {
  const [v, setV] = useState(""), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  useEffect(() => { const k = e => e.key === "Escape" && onNao(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  const ok = !digitar || v.trim().toLowerCase() === String(digitar).toLowerCase();
  const sim = async () => { setBusy(true); setErro(""); try { await onSim(); } catch (e) { setErro(e.message || String(e)); setBusy(false); } };
  return (
    <div className="modal-fundo" onClick={onNao}>
      <div className="modal" role="alertdialog" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <h3>{titulo}</h3>
        {texto && <div className="modal-texto">{texto}</div>}
        {digitar && <label>Para confirmar, digite <b>{digitar}</b><input value={v} onChange={e => setV(e.target.value)} autoFocus /></label>}
        {erro && <p className="erro">{erro}</p>}
        <div className="modal-botoes">
          <button className="botao leve" onClick={onNao} disabled={busy}>Voltar</button>
          <button className={"botao" + (perigo ? " perigo" : "")} onClick={sim} disabled={!ok || busy}>{busy ? "Um instante…" : botao}</button>
        </div>
      </div>
    </div>
  );
}

export function Copiar({ texto, rotulo = "copiar" }) {
  const [ok, setOk] = useState(false);
  return <button className="link" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }}>{ok ? "copiado" : rotulo}</button>;
}

export function baixarCsv(nome, colunas, linhas) {
  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const blob = new Blob(["﻿" + [colunas.join(";"), ...linhas.map(l => l.map(esc).join(";"))].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${nome}-${hojeBR()}.csv` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
