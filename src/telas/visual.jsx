// Peças visuais em comum entre a casa e a tela inicial do lado pessoal:
// o ícone de categoria com anel, o anel sozinho, a linha do gráfico e o número que corre até o valor.
import React, { useEffect, useRef, useState } from "react";
import { CatIcon, catVars } from "../App.jsx";
import "../visual.css";

export const menosMovimento = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

// Número que corre até o valor novo (ao abrir e quando o valor muda)
export function useContagem(alvo, ms = 700) {
  const [v, setV] = useState(() => (menosMovimento() ? alvo : 0));
  const de = useRef(menosMovimento() ? alvo : 0);
  useEffect(() => {
    const ini = de.current; de.current = alvo;
    if (ini === alvo || menosMovimento()) { setV(alvo); return; }
    let raf, t0;
    const passo = t => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); setV(ini + (alvo - ini) * e); if (k < 1) raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return v;
}

// Anel de progresso (p de 0 a 1), com o que vier dentro no centro
export function Anel({ p, children, cor = "var(--mode)", trilho, tam = 64, esp = 6, className = "" }) {
  const r = (tam - esp) / 2, c = 2 * Math.PI * r, k = Math.max(0, Math.min(1, p || 0));
  return (
    <span className={"vz-anel " + className} style={{ width: tam, height: tam }}>
      <svg viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true">
        <circle cx={tam / 2} cy={tam / 2} r={r} className="trilho" strokeWidth={esp} style={trilho ? { stroke: trilho } : undefined} />
        {k > 0 && <circle cx={tam / 2} cy={tam / 2} r={r} className="cheio" strokeWidth={esp} style={{ stroke: cor, strokeDasharray: c, "--c": c, strokeDashoffset: c * (1 - k) }} transform={`rotate(-90 ${tam / 2} ${tam / 2})`} />}
      </svg>
      <span className="vz-anel-in">{children}</span>
    </span>
  );
}

// Ícone de categoria: bolinha cheia na cor da categoria, o ícone no centro, e um anel da mesma cor em volta
// (o trilho é a própria cor apagada) com um brilho suave. p = quanto o anel enche.
// ícone branco nas cores fortes; escuro no laranja e no amarelo, onde o branco some (como o garfo no laranja)
const ESCURO = new Set(["laranja", "amarelo"]);
export function CatBolinha({ cat, p = 0, tam = 52 }) {
  const esp = Math.max(3, Math.round(tam * .075));
  return (
    <span className="vz-cat" style={{ ...catVars(cat), "--t": `${tam}px`, "--ci": ESCURO.has(cat.cor) ? "var(--cc-ink)" : "#fff" }}>
      <Anel p={p} cor="var(--cc)" trilho="color-mix(in srgb, var(--cc) 24%, transparent)" tam={tam} esp={esp}>
        <span className="vz-cat-in"><CatIcon cat={cat} /></span>
      </Anel>
    </span>
  );
}

// Linha suave com área embaixo, desenhada da esquerda para a direita, e o ponto de agora pulsando.
//   series: [{ v: [números], cor, fantasma }]  (fantasma = tracejada, sem área: o período de comparação)
//   n: quantos pontos cabem no eixo (ex.: dias do mês); a série principal pode ser mais curta (até hoje)
export function Linha({ series, n, altura = 118, legenda, rotuloDir, rotulo }) {
  const gid = useRef("vz" + Math.random().toString(36).slice(2, 8)).current; // antes de qualquer return (regra dos hooks)
  const W = 340, H = altura;
  const todas = series.flatMap(s => s.v);
  if (!todas.length) return null;
  const N = Math.max(n || 0, ...series.map(s => s.v.length), 2);
  const min = Math.min(0, ...todas), max = Math.max(1, ...todas);
  const x = i => (i / (N - 1)) * W, y = val => H - 6 - ((val - min) / (max - min || 1)) * (H - 18);
  const caminho = s => s.map((val, i) => (i === 0 ? `M${x(0)},${y(val)}` : `C${(x(i - 1) + x(i)) / 2},${y(s[i - 1])} ${(x(i - 1) + x(i)) / 2},${y(val)} ${x(i)},${y(val)}`)).join(" ");
  const prin = series.find(s => !s.fantasma && s.v.length > 1);
  const cor = (prin && prin.cor) || "var(--mode)";
  const fim = prin ? { cx: x(prin.v.length - 1), cy: y(prin.v[prin.v.length - 1]) } : null;
  return (
    <div className="vz-linha" style={{ "--lc": cor, height: H + 32 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={rotulo} style={{ height: H }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: cor, stopOpacity: .32 }} /><stop offset="1" style={{ stopColor: cor, stopOpacity: 0 }} /></linearGradient></defs>
        {min < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="vz-zero" vectorEffect="non-scaling-stroke" />}
        {series.filter(s => s.fantasma && s.v.length > 1).map((s, i) => <path key={"f" + i} className="vz-fantasma" d={caminho(s.v)} vectorEffect="non-scaling-stroke" />)}
        {prin && <path d={`${caminho(prin.v)} L${x(prin.v.length - 1)},${H} L0,${H} Z`} fill={`url(#${gid})`} />}
        {prin && <path className="vz-traco" d={caminho(prin.v)} vectorEffect="non-scaling-stroke" />}
      </svg>
      {fim && <span className="vz-ponto" style={{ left: `${(fim.cx / W) * 100}%`, top: `${(fim.cy / H) * 100 * (H / (H + 32))}%` }} />}
      {(legenda || rotuloDir) && <div className="vz-leg">{(legenda || []).map((l, i) => <span key={i}><i className={l.fantasma ? "b" : "a"} />{l.t}</span>)}{rotuloDir && <span className="dir">{rotuloDir}</span>}</div>}
    </div>
  );
}
