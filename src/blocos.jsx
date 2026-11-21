// Blocos do Início no jeito dos apps de banco (Asaas): botões azuis grandes no topo, o cartão de saldo, a grade de
// atalhos, o cartão de resumo com "Este mês | Últimos 30 dias" e o cartão de novidade. Estilos em src/azul.css.
import React, { useRef, useState } from "react";
import { I, Money, brl, soma, todayISO, addDays, MES_LONGO, Ilustra, ESCONDER } from "./App.jsx";

// Botões azuis do topo (rolam para o lado no celular). itens: [{ id, l, ic, f }]
export function AcoesAzuis({ itens, tres, className }) {
  return (
    <div className={"az-acoes" + (tres ? " tres" : "") + (className ? " " + className : "")} role="group" aria-label="Ações rápidas">
      {itens.map(a => { const Ic = a.ic; return (
        <button key={a.id} type="button" className="az-acao" onClick={a.f}><span className="az-acao-ic"><Ic /></span><span className="az-acao-l">{a.l}</span></button>
      ); })}
    </div>
  );
}

// "Saldo": o rótulo, o valor grande em azul, a setinha e o olho (esconde os valores do app todo). sub: linha embaixo
export function CartaoSaldo({ rotulo, valor, texto, sub, onClick, neg, act }) {
  return (
    <div className="az-saldo">
      <button type="button" className="az-saldo-main" onClick={onClick}>
        <span className="az-saldo-t"><small>{rotulo}</small><b className={"num" + (neg ? " neg" : "")}>{texto != null ? texto : <Money v={valor} />}</b>{sub && <em>{sub}</em>}</span>
        <I.chev />
      </button>
      {act && <button type="button" className="az-saldo-olho" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button>}
    </div>
  );
}

// Carrossel de cartões de saldo: passa para o lado com o dedo (e pelas bolinhas embaixo).
// cartoes: [{ id, rotulo, valor (dinheiro) ou texto, sub, neg, onClick }]
export function CarrosselSaldo({ cartoes, act }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const rolou = () => { const el = ref.current; if (!el || !el.firstChild) return; const w = el.firstChild.offsetWidth + 10; setI(Math.max(0, Math.min(cartoes.length - 1, Math.round(el.scrollLeft / w)))); };
  const ir = k => { const el = ref.current; if (!el || !el.children[k]) return; el.scrollTo({ left: el.children[k].offsetLeft - el.firstChild.offsetLeft, behavior: "smooth" }); };
  return (
    <section className="az-car" aria-label="Seus números">
      <div className="az-car-trilho" ref={ref} onScroll={rolou}>
        {cartoes.map((c, k) => (
          <div key={c.id} className="az-car-item" aria-hidden={k !== i ? "true" : undefined}>
            <CartaoSaldo rotulo={c.rotulo} valor={c.valor} texto={c.texto} sub={c.sub} neg={c.neg} onClick={c.onClick} act={k === 0 ? act : null} />
          </div>
        ))}
      </div>
      {cartoes.length > 1 && (
        <div className="az-car-pontos" role="tablist" aria-label="Escolher cartão">
          {cartoes.map((c, k) => <button key={c.id} type="button" role="tab" aria-selected={k === i} aria-label={c.rotulo} className={k === i ? "on" : ""} onClick={() => ir(k)} />)}
        </div>
      )}
    </section>
  );
}

// Grade de atalhos: quadrados brancos com o ícone azul e o nome embaixo. itens: [{ id, l, ic, f, n? }]
export function GradeAtalhos({ titulo, itens }) {
  return (
    <section className="az-grade-sec" aria-label={titulo || "Atalhos"}>
      {titulo && <h3 className="az-sec-t">{titulo}</h3>}
      <div className="az-grade">
        {itens.map(a => { const Ic = a.ic; return (
          <button key={a.id} type="button" className="az-atalho" onClick={a.f}>
            <span className="az-atalho-ic"><Ic />{a.n > 0 && <i className="az-ponto" aria-label={`${a.n} pendentes`} />}</span>
            <span className="az-atalho-l">{a.l}</span>
          </button>
        ); })}
      </div>
    </section>
  );
}

// "Outras ações": linhas arredondadas com o ícone azul, o nome, um selo opcional ("Novo") e a setinha
export function ListaAcoes({ titulo, itens, className }) {
  return (
    <section className={"az-lista" + (className ? " " + className : "")} aria-label={titulo || "Outras ações"}>
      {titulo && <h3 className="az-sec-t">{titulo}</h3>}
      {itens.map(a => { const Ic = a.ic; return (
        <button key={a.id} type="button" className="az-lista-i" onClick={a.f}>
          <span className="az-lista-ic"><Ic /></span><span className="az-lista-t"><b>{a.l}</b>{a.d && <small>{a.d}</small>}</span>
          {a.selo && <em className="az-selo">{a.selo}</em>}<I.chev />
        </button>
      ); })}
    </section>
  );
}

// Cartão de novidade: ilustração, título e texto (como o "Novo cartão Mastercard")
export function CartaoNovidade({ ilustra, icone: Ic, titulo, texto, onClick }) {
  return (
    <button type="button" className="az-novidade" onClick={onClick}>
      {ilustra ? <Ilustra n={ilustra} className="az-novidade-ilu" /> : <span className="az-novidade-ic"><Ic /></span>}
      <span><b>{titulo}</b><small>{texto}</small></span>
    </button>
  );
}

// Resumo com abas "Este mês | Últimos 30 dias". linhas(periodo) -> [{ t, n, v, cor: "verde" | "azul" | "laranja" | "vermelho" }]
export function CartaoResumo({ titulo, onAbrir, linhas }) {
  const [p, setP] = useState("mes");
  const ls = linhas(p);
  return (
    <section className="az-resumo">
      <button type="button" className="az-resumo-cab" onClick={onAbrir}><b>{titulo}</b><I.chev /></button>
      <div className="az-abas" role="tablist">
        {[["mes", "Este mês"], ["30", "Últimos 30 dias"]].map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={p === v} className={p === v ? "on" : ""} onClick={() => setP(v)}>{l}</button>)}
      </div>
      <div className="az-resumo-linhas">
        {ls.map(x => (
          <div key={x.t} className={"az-resumo-l " + (x.cor || "")}>
            <b>{x.t}</b>
            <span><small>{x.rotN || "Quantidade"}</small><strong className="num">{x.n}</strong></span>
            <span><small>Valor (R$)</small><strong className="num">{brl(x.v)}</strong></span>
          </div>
        ))}
      </div>
    </section>
  );
}

// O período do resumo: o mês corrente ou os últimos 30 dias
export const noPeriodo = p => { const t = todayISO(), ini = p === "mes" ? t.slice(0, 8) + "01" : addDays(t, -29); return iso => !!iso && iso.slice(0, 10) >= ini && iso.slice(0, 10) <= t; };
export const nomeMes = () => MES_LONGO[new Date().getMonth()];
export { soma };
