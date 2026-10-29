// Parte do app carregada sob demanda: o tour da primeira vez. Quatro passos curtinhos por modo,
// cada um acendendo uma parte de verdade da tela, com a Bolinha explicando. Dá pra pular a qualquer hora.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bolinha, vibrar } from "../App.jsx";

// Cada passo: um ou mais jeitos de mostrar (celular e computador). Vale o primeiro cujo lugar está visível na tela
const PASSOS = {
  consultorio: ({ termo, doisModos }) => [
    { sel: [".acts.narrow-only .act", ".lt-split", ".lt-mais"], t: `Comece pelo primeiro ${termo.s}`, d: "Cadastre com o dia e o horário, e ele já entra na agenda toda semana." },
    { sel: [".nav-mic"], t: "Fale em vez de digitar", d: "Toque na Bolinha e diga “Ana veio”, “Ana pagou” ou “remarca a Ana pra sexta às 15h”." },
    { sel: [".lt-lista", ".nav-in"], t: "Tudo à mão", d: `Agenda, ${termo.p} e finanças ficam aqui. O número em cima mostra o que está esperando você.` },
    fotoEModos(doisModos),
  ],
  pessoal: ({ doisModos }) => [
    { sel: [".c3-saldo"], t: "Seu mês num olhar", d: "Quanto entrou, quanto saiu e quanto ainda sobra até o fim do mês." },
    { sel: [".nav-mic"], t: "Anote um gasto falando", d: "Toque na Bolinha e diga “gastei 32 no mercado”. Eu coloco na categoria certa." },
    { sel: [".lt-lista", ".nav-in"], t: "Gastos, contas e carro", d: "Ficam aqui. Eu aviso um dia antes de cada conta vencer." },
    fotoEModos(doisModos),
  ],
  loja: ({ doisModos }) => [
    { sel: [".lj-vender"], t: "Cada venda, um toque", d: "Toque nos produtos e depois em como a pessoa pagou. Pronto, está anotado." },
    { sel: [".lj-dia"], t: "O dia até agora", d: "Quanto entrou hoje, separado em dinheiro, Pix e cartão." },
    { sel: [".lt-lista", ".nav-in"], t: "Gastos, o que falta e o resumo", d: "Os gastos da loja, a lista do que comprar e o resumo da semana e do mês." },
    fotoEModos(doisModos),
  ],
};
function fotoEModos(doisModos) {
  return doisModos
    ? [{ sel: [".lt-pe"], t: "Sua conta e seus modos", d: "Aqui ficam o perfil, os avisos e o plano. Em “Trocar”, você muda de modo." },
       { sel: [".hello-l:has(.mode-pill)"], t: "Sua foto e seus modos", d: "Na foto ficam o perfil, os avisos e o plano. Ao lado, você troca de modo." }]
    : { sel: [".lt-conta", ".hello-l .me"], t: "Sua conta", d: "Toque aqui para ver o perfil, os avisos e o seu plano." };
}

const visivel = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const achar = sel => sel.map(s => { try { return document.querySelector(s); } catch (e) { return null; } }).find(visivel) || null; // try: navegador antigo sem :has()
// de cada passo, o primeiro jeito que dá pra mostrar agora (ou nenhum)
const escolher = p => [].concat(p).find(x => achar(x.sel));

export function Tour({ modo, termo, doisModos, onFim }) {
  const [passos, setPassos] = useState(null); // só os passos que existem nesta tela
  const [i, setI] = useState(0);
  const [luz, setLuz] = useState(null);       // retângulo aceso
  const [bal, setBal] = useState(null);       // posição do balão
  const balRef = useRef(null), proxRef = useRef(null);

  // espera a tela aparecer (as telas carregam sob demanda) e guarda os passos que dá pra mostrar
  useEffect(() => {
    let vezes = 0, t;
    const tentar = () => {
      // a abertura animada ("avina") ainda está na frente: espera ela sair
      if (document.getElementById("intro")) { t = setTimeout(tentar, 400); return; }
      const ps = (PASSOS[modo] || PASSOS.consultorio)({ termo, doisModos }).map(escolher).filter(Boolean);
      if (ps.length >= 3 || (vezes > 12 && ps.length >= 2)) { setPassos(ps); return; }
      if (++vezes < 20) t = setTimeout(tentar, 400);
    };
    t = setTimeout(tentar, 700);
    return () => clearTimeout(t);
  }, []);

  const P = passos && passos[i];
  const medir = () => {
    const el = P && achar(P.sel);
    if (!el) return;
    const r = el.getBoundingClientRect(), f = 8;
    setLuz({ top: r.top - f, left: r.left - f, width: r.width + f * 2, height: r.height + f * 2 });
  };
  // leva o passo para o meio da tela e acompanha a rolagem
  useEffect(() => {
    if (!P) return;
    const el = achar(P.sel);
    if (el && getComputedStyle(el).position !== "fixed" && !el.closest(".nav, .side")) el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    medir();
    let q = 0;
    const f = () => { cancelAnimationFrame(q); q = requestAnimationFrame(medir); };
    addEventListener("scroll", f, true); addEventListener("resize", f);
    const tm = setTimeout(medir, 450);
    proxRef.current && proxRef.current.focus({ preventScroll: true });
    return () => { removeEventListener("scroll", f, true); removeEventListener("resize", f); cancelAnimationFrame(q); clearTimeout(tm); };
  }, [P]);
  // o balão vai embaixo do que está aceso; se não couber, em cima
  useLayoutEffect(() => {
    if (!luz || !balRef.current) return;
    const W = innerWidth, H = innerHeight, b = balRef.current.getBoundingClientRect(), m = 16;
    const baixo = H - (luz.top + luz.height) > b.height + 24 || luz.top < b.height + 24;
    const left = Math.max(m, Math.min(W - b.width - m, luz.left + luz.width / 2 - b.width / 2));
    const top = baixo ? Math.min(H - b.height - m, luz.top + luz.height + 14) : Math.max(m, luz.top - b.height - 14);
    setBal({ top, left, baixo, seta: Math.max(22, Math.min(b.width - 22, luz.left + luz.width / 2 - left)) });
  }, [luz]);
  useEffect(() => {
    const k = e => { if (e.key === "Escape") onFim(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);

  if (!P) return null;
  const ultimo = i === passos.length - 1;
  const proximo = () => { vibrar("toque"); if (ultimo) onFim(); else setI(i + 1); };
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Conhecendo o app">
      {luz && <div className="tour-luz" style={luz} aria-hidden="true" />}
      <div ref={balRef} className={"tour-bal" + (bal ? (bal.baixo ? " baixo" : " cima") : "")} style={bal ? { top: bal.top, left: bal.left, "--seta": bal.seta + "px" } : { visibility: "hidden" }} key={i}>
        <div className="tour-cab"><Bolinha estado={ultimo ? "resposta" : ""} /><b>{P.t}</b></div>
        <p>{P.d}</p>
        <div className="tour-pe">
          <span className="tour-pontos" aria-label={`Passo ${i + 1} de ${passos.length}`}>{passos.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</span>
          {!ultimo && <button type="button" className="tour-pular" onClick={onFim}>Pular</button>}
          <button type="button" ref={proxRef} className="tour-prox" onClick={proximo}>{ultimo ? "Bora começar!" : "Próximo"}</button>
        </div>
      </div>
    </div>
  );
}
