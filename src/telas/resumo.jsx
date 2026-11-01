// O mês num olhar: as contas e as peças em comum entre o Pessoal (src/telas/pessoal.jsx) e os cartões do Início
// (src/telas/inicio-cartoes.jsx): o resumo do mês, o gráfico de linha, a barra por categoria e a linha de um lançamento.
// Ficam aqui (e não no pessoal.jsx) para o Início do consultório não precisar baixar o Pessoal inteiro.
import React, { useState, useEffect, useRef, memo } from "react";
import { CatBolinha, menosMovimento } from "./visual.jsx";
import { SeloBanco, nomeBanco } from "./bancos.jsx";
import { fmtMoeda } from "../cotacoes.js";
import "../pessoal.css";
import { todayISO, ESCONDER, I, brl, soma, catDe, catVars, fromISO, MarcaLogo, acharMarca, liquidoMes, vibrar } from "../App.jsx";

// O mês do lado pessoal: o que entrou (com o consultório, se ele conta como entrada), o que saiu (com as contas pagas)
// e o gasto por categoria
export function resumoPessoal(db, chave) {
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


/* ---------- gráficos (SVG puro, no tamanho de verdade da tela: traço, tracejado e ponto não distorcem) ---------- */
// Curva suave que não passa do ponto (monotônica): o gasto acumulado nunca parece descer entre um dia e outro
export function curva(p) {
  const n = p.length;
  if (n < 2) return "";
  const f = v => Math.round(v * 10) / 10;
  if (n === 2) return `M${f(p[0][0])},${f(p[0][1])}L${f(p[1][0])},${f(p[1][1])}`;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / (dx[i] || 1); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${f(p[i][0] + h)},${f(p[i][1] + t[i] * h)} ${f(p[i + 1][0] - h)},${f(p[i + 1][1] - t[i + 1] * h)} ${f(p[i + 1][0])},${f(p[i + 1][1])}`; }
  return d;
}

// Linha do mês: a do período (cheia, com área em degradê) se desenha da esquerda para a direita, a de comparação
// fica tracejada atrás e a previsão segue tracejada na mesma cor. O ponto de hoje pulsa.
// Tocar e arrastar (ou passar o mouse) mostra o valor do dia.
//   series: [{ v: [números], tipo: "cheia" | "fantasma" | "previsao", de: índice em que a série começa }]
//   n: quantos pontos cabem no eixo (dias do mês); eixo: [{ i, t }] rótulos embaixo; dica(i): o texto do dia i
export function GraficoLinha({ series, n, cor = "var(--mode)", altura = 132, eixo, legenda, dica, rotulo }) {
  const caixa = useRef(null);
  const [W, setW] = useState(0);
  const [toque, setToque] = useState(null);
  const ultimo = useRef(-1);
  const clip = useRef("pg" + Math.random().toString(36).slice(2, 8)).current;
  // a largura chega pelo ResizeObserver, logo depois do layout: ler clientWidth no useLayoutEffect forçava o layout da
  // página inteira no meio do desenho, e um segundo desenho antes da primeira pintura (a área já tem a altura certa)
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    if (typeof ResizeObserver === "undefined") { setW(el.clientWidth); return; }
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  // começa a desenhar quando o gráfico aparece (o relógio do SVG conta desde que a página abriu)
  const desenho = useRef(null);
  useEffect(() => { const a = desenho.current; if (W > 0 && a && a.beginElement) try { a.beginElement(); } catch (e) {} }, [W > 0]);
  const H = altura, TOP = 14, BASE = 6, PX = 6;
  const todas = series.flatMap(s => s.v.filter(Number.isFinite));
  const N = Math.max(n || 0, ...series.map(s => (s.de || 0) + s.v.length), 2);
  const lo = Math.min(0, ...todas), hi = Math.max(lo + 1, ...todas) * (Math.max(...todas, 0) > 0 ? 1.06 : 1);
  const x = i => PX + (i / (N - 1)) * Math.max(1, W - PX * 2);
  const y = v => TOP + (1 - (v - lo) / (hi - lo || 1)) * (H - TOP - BASE);
  const pts = s => s.v.map((v, k) => [x((s.de || 0) + k), y(v)]);
  const prin = series.find(s => s.tipo === "cheia" && s.v.length > 0);
  const fimI = prin ? (prin.de || 0) + prin.v.length - 1 : -1;
  const ponto = prin ? [x(fimI), y(prin.v[prin.v.length - 1])] : null;
  const maxI = Math.max(...series.map(s => (s.de || 0) + s.v.length - 1));
  const mover = e => {
    if (!dica || !W) return;
    const r = caixa.current.getBoundingClientRect();
    const i = Math.max(0, Math.min(maxI, Math.round(((e.clientX - r.left - PX) / Math.max(1, W - PX * 2)) * (N - 1))));
    if (i !== ultimo.current) { ultimo.current = i; if (e.pointerType === "touch") vibrar("toque"); setToque(i); }
  };
  const largar = () => { ultimo.current = -1; setToque(null); };
  const valorEm = (s, i) => { const k = i - (s.de || 0); return k >= 0 && k < s.v.length ? s.v[k] : null; };
  const anima = !menosMovimento();
  return (
    <div className="ps-graf" style={{ "--lc": cor }}>
      <div ref={caixa} className="ps-graf-area" style={{ height: H }} onPointerMove={mover} onPointerDown={mover} onPointerLeave={largar} onPointerUp={e => e.pointerType !== "mouse" && largar()} onPointerCancel={largar}>
        {W > 0 && <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo}>
          <defs>
            <linearGradient id={clip + "a"} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: cor, stopOpacity: .3 }} /><stop offset="1" style={{ stopColor: cor, stopOpacity: 0 }} /></linearGradient>
            {/* a linha se desenha: o recorte cresce da esquerda para a direita (se a animação não rodar, fica tudo à mostra) */}
            <clipPath id={clip}><rect x="0" y="-20" width={W + 20} height={H + 40}>{anima && <animate ref={desenho} attributeName="width" from="0" to={W + 20} dur="1.1s" begin="indefinite" fill="freeze" calcMode="spline" keySplines=".45 0 .2 1" keyTimes="0;1" />}</rect></clipPath>
          </defs>
          {lo < 0 && <line x1={PX} x2={W - PX} y1={y(0)} y2={y(0)} className="ps-graf-zero" />}
          {series.filter(s => s.tipo === "fantasma" && s.v.length > 1).map((s, k) => <path key={"f" + k} className="ps-graf-ant" d={curva(pts(s))} />)}
          <g clipPath={`url(#${clip})`}>
            {prin && prin.v.length > 1 && <path d={`${curva(pts(prin))}L${ponto[0]},${H}L${x(prin.de || 0)},${H}Z`} fill={`url(#${clip}a)`} />}
            {prin && prin.v.length > 1 && <path className="ps-graf-linha" d={curva(pts(prin))} />}
            {series.filter(s => s.tipo === "previsao" && s.v.length > 1).map((s, k) => <path key={"p" + k} className="ps-graf-prev" d={curva(pts(s))} />)}
          </g>
          {ponto && toque == null && <g className="ps-graf-ponto" style={{ "--px": `${ponto[0]}px`, "--py": `${ponto[1]}px` }}>
            <circle cx={ponto[0]} cy={ponto[1]} r="9" className="onda" />
            <circle cx={ponto[0]} cy={ponto[1]} r="5.5" className="miolo" />
          </g>}
          {toque != null && <g className="ps-graf-mira">
            <line x1={x(toque)} x2={x(toque)} y1={4} y2={H} />
            {series.map((s, k) => { const v = valorEm(s, toque); return v == null ? null : <circle key={k} cx={x(toque)} cy={y(v)} r={s.tipo === "fantasma" ? 3.5 : 5} className={s.tipo} />; })}
          </g>}
        </svg>}
        {toque != null && dica && W > 0 && <div className={"ps-graf-dica" + (x(toque) < 80 ? " esq" : x(toque) > W - 80 ? " dir" : "")} style={{ left: x(toque) }}>{dica(toque)}</div>}
      </div>
      {eixo && W > 0 && <div className="ps-graf-eixo" aria-hidden="true">{eixo.map((e, k) => <span key={k} className={x(e.i) < 24 ? "ini" : x(e.i) > W - 24 ? "fim" : ""} style={{ left: x(e.i) }}>{e.t}</span>)}</div>}
      {legenda && <div className="ps-graf-leg">{legenda.map((l, k) => <span key={k}><i className={l.tipo || "cheia"} />{l.t}</span>)}</div>}
    </div>
  );
}

// Barra segmentada por categoria (cantos redondos e espaço entre os pedaços), na cor de cada uma
export function BarraCategorias({ cats, total }) {
  const top = cats.slice(0, 6), resto = soma(cats.slice(6), c => c[1]);
  const pedacos = [...top.map(([id, v]) => ({ id, v, cor: `var(--g-${id}, ${catVars(catDe(id))["--cc"]})` })), ...(resto > 0 ? [{ id: "resto", v: resto, cor: "var(--surface-3)" }] : [])].filter(p => p.v > 0);
  if (!pedacos.length) return null;
  return (
    <div className="ps-seg" role="img" aria-label={pedacos.map(p => `${p.id === "resto" ? "Outras" : catDe(p.id).nome} ${Math.round((p.v / (total || 1)) * 100)}%`).join(", ")}>
      {pedacos.map((p, k) => <i key={p.id} style={{ flexGrow: p.v, background: p.cor, "--i": k }} />)}
    </div>
  );
}
// Uma categoria na lista: o ícone com anel (o teto, se tiver; senão a parte do mês), nome, o que sobra e o valor
export function LinhaCategoria({ id, v, total, teto, on, apaga, onClick }) {
  const c = catDe(id), sobra = teto - v;
  return (
    <button type="button" className={"ps-cat" + (on ? " on" : apaga ? " apaga" : "")} aria-pressed={on} onClick={onClick}>
      <CatBolinha cat={c} p={teto ? v / teto : v / (total || 1)} tam={42} />
      <span className="ps-cat-mid">
        <span className="ps-cat-nm">{c.nome}</span>
        <span className={"ps-cat-sb" + (teto && sobra < 0 ? " acima" : "")}>{teto ? (sobra >= 0 ? `Sobram ${brl(sobra)} do teto` : `${brl(-sobra)} acima do teto`) : `${Math.round((v / (total || 1)) * 100)}% do mês`}</span>
      </span>
      <b className="ps-cat-v">{brl(v)}</b>
    </button>
  );
}

export const MES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// "17 de out" (com o ano, quando não é deste ano)
export const diaMes = (iso, hoje, ponto = "") => { const d = fromISO(iso); return `${d.getDate()} de ${MES_ABREV[d.getMonth()]}${ponto}${iso.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${d.getFullYear()}` : ""}`; };

// rótulos embaixo de um gráfico do mês: o dia 1, hoje e o último dia (sem encavalar)
export function eixoDoMes(n, hojeI, mes) {
  const longe = i => hojeI == null || Math.abs(i - hojeI) >= Math.max(4, n / 7);
  return [longe(0) && { i: 0, t: `1 ${mes}` }, hojeI != null && { i: hojeI, t: "hoje" }, longe(n - 1) && { i: n - 1, t: `${n} ${mes}` }].filter(Boolean);
}

// Marca achada pelo nome, guardada: achar é caro (compara com centenas de marcas) e a lista repete os mesmos nomes
const marcasPorNome = new Map();
export function marcaDoNome(nome) {
  const k = nome || "";
  if (!marcasPorNome.has(k)) { if (marcasPorNome.size > 3000) marcasPorNome.clear(); marcasPorNome.set(k, (acharMarca(k) || {}).id || null); }
  return marcasPorNome.get(k);
}

// Uma atividade: a logo da empresa (com o selo do banco no canto quando veio do Open Finance), o nome,
// "data · categoria", o banco embaixo em cinza e o valor (saída em vermelho, entrada em verde).
// memo: com centenas de linhas, só redesenha a que mudou (oculto e hoje entram só para redesenhar quando mudam).
// sel: modo de seleção ligado; segurar o dedo num lançamento também liga a seleção (como nos apps do celular)
export const LancRow = memo(function LancRow({ l, onAbrir, sel, marcado, onMarcar, onSegurar, hoje }) {
  const cat = catDe(l.cat), banco = nomeBanco(l.banco);
  const tempo = useRef(0), segurou = useRef(false);
  const apertou = () => { if (!onSegurar) return; segurou.current = false; clearTimeout(tempo.current); tempo.current = setTimeout(() => { segurou.current = true; onSegurar(l.id); }, 450); };
  const soltou = () => clearTimeout(tempo.current);
  const tocou = () => { if (segurou.current) { segurou.current = false; return; } if (sel) onMarcar(l.id); else onAbrir(l.id); };
  const entra = l.tipo === "entrada";
  return (
    <button className={"ps-at" + (sel ? " sel" : "") + (marcado ? " marcado" : "")} onClick={tocou} onPointerDown={apertou} onPointerUp={soltou} onPointerLeave={soltou} onPointerCancel={soltou}
      onContextMenu={e => { if (onSegurar) e.preventDefault(); }} aria-pressed={sel ? !!marcado : undefined}>
      {sel && <span className={"sel-box" + (marcado ? " on" : "")} aria-hidden="true">{marcado && <I.check />}</span>}
      <span className="ps-at-av">
        <MarcaLogo key={(l.marca || l.logoSite || l.cat) + (l.desc || "")} marca={l.semLogo ? null : l.marca || marcaDoNome(l.desc)} site={l.semLogo ? null : l.logoSite} nome={l.desc} cat={cat} className="txn-av" />
        {banco && <SeloBanco banco={banco} />}
      </span>
      <span className="ps-at-mid">
        <span className="ps-at-nm">{l.desc || cat.nome}</span>
        <span className="ps-at-sb">{diaMes(l.data, hoje || todayISO())} · {cat.nome}{l.moeda ? ` · ${ESCONDER ? "•••" : fmtMoeda(l.valorOrig, l.moeda)}` : ""}</span>
        {banco && <span className="ps-at-bc">{banco}</span>}
      </span>
      <span className={"ps-at-v" + (entra ? " entra" : "")}>{entra ? "+" : "−"}{brl(l.valor)}</span>
    </button>
  );
});

// Gasto acumulado dia a dia num mês (saídas e contas pagas), para a linha do ritmo
export function acumuladoMes(db, ch, n) {
  const p = Array(n).fill(0), dia = iso => Math.min(n, Math.max(1, Number(String(iso).slice(8, 10)) || 1));
  db.pessoal.lanc.forEach(l => { if (l.tipo === "saida" && l.data.startsWith(ch)) p[dia(l.data) - 1] += l.valor; });
  // conta paga: no dia em que foi paga (paga em outro mês: no começo ou no fim deste)
  db.pessoal.contas.forEach(c => { const pg = c.pagas && c.pagas[ch]; if (!pg) return; const d = typeof pg === "string" && pg.startsWith(ch) ? dia(pg) : typeof pg === "string" && pg > ch ? n : 1; p[d - 1] += c.valor; });
  let s = 0; return p.map(x => (s += x));
}
export const diasDoMes = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
