// Navegação do celular: o menu lateral (a tela encolhe e vai para a direita), a folha de trocar de área
// (Consultório, Pessoal, Loja) e a tela de Alertas (o sino da barra de cima). Usadas pelo Painel, em src/App.jsx.
import React from "react";
import { createPortal } from "react-dom";
import { I } from "../icones.jsx";
import { linkSuporte } from "../plano.js";
import { Avatar, AvinaNome, ESCONDER, Ilustra, NOME_MODO, Sheet, useCamada, vibrar } from "../App.jsx";

// Menu lateral do celular: fica atrás da tela; ao abrir, a tela encolhe e vai para a direita (com as bordas
// arredondadas) e as opções aparecem à esquerda. go(f): fecha o menu e depois faz f.
export function MenuLateral({ aberto, conta, modo, modos, abas, tab, act, tema, nAlertas, onAlertas, go }) {
  const extras = modo === "consultorio" ? [
    { id: "al", l: "Alertas", ic: I.bell, f: onAlertas, n: nAlertas },
    { id: "link", l: "Link de agendamento", ic: I.share, f: () => act.openSettings("link") },
    { id: "cal", l: "Agenda no celular", ic: I.calSync, f: () => act.openSettings("calendario") },
    { id: "espera", l: "Lista de espera", ic: I.clock, f: act.verEspera },
    { id: "imp", l: "Recibos e imposto", ic: I.receipt, f: act.abrirImposto },
  ] : modo === "pessoal" ? [
    { id: "al", l: "Alertas", ic: I.bell, f: onAlertas, n: nAlertas },
    { id: "casa", l: "Nossa casa", ic: I.home, f: act.abrirCasa },
    { id: "cx", l: "Caixinhas", ic: I.piggy, f: () => act.abrirCaixinha() },
    { id: "ext", l: "Importar extrato", ic: I.upload, f: act.importar },
  ] : [];
  let ordem = 0; const n = () => ({ "--i": ordem++ }); // a ordem de entrada de cada item (um depois do outro)
  const Item = ({ x, on }) => { const Ic = x.ic; return (
    <button type="button" className={"menu-lat-i" + (on ? " on" : "")} onClick={go(x.f)} style={n()}>
      {typeof Ic === "function" ? <Ic /> : Ic}<span>{x.l}</span>{x.n > 0 && <em>{x.n > 99 ? "99+" : x.n}</em>}
    </button>
  ); };
  return (
    <aside className="menu-lat" aria-label="Menu" aria-hidden={!aberto} inert={aberto ? undefined : ""}>
      <div className="menu-lat-in">
        <div className="menu-lat-logo" style={n()}><AvinaNome /></div>
        <button type="button" className="menu-lat-conta" onClick={go(act.openSettings)} style={n()}><Avatar conta={conta} /><span><b>{conta.nome}</b><small>Ver perfil e ajustes</small></span><I.chev /></button>
        {modos.length > 1 && <div className="menu-lat-modos" role="group" aria-label="Área" style={n()}>{modos.map(m => <button key={m} type="button" className={m === modo ? "on" : ""} aria-pressed={m === modo} onClick={go(() => act.setModo(m))}>{NOME_MODO[m]}</button>)}</div>}
        <nav className="menu-lat-lista">{abas.map(a => <Item key={a.id} x={{ l: a.l, ic: a.ic, n: a.n, f: () => act.setTab(a.id) }} on={tab === a.id} />)}</nav>
        {extras.length > 0 && <><div className="menu-lat-sep" /><div className="menu-lat-lista">{extras.map(x => <Item key={x.id} x={x} />)}</div></>}
        <div className="menu-lat-sep" />
        <div className="menu-lat-lista menu-lat-pe">
          <Item x={{ l: ESCONDER ? "Mostrar valores" : "Esconder valores", ic: ESCONDER ? I.eye : I.eyeOff, f: act.toggleOculto }} />
          <Item x={{ l: tema.escuro ? "Modo claro" : "Modo escuro", ic: tema.escuro ? I.sun : I.moon, f: act.trocarTema }} />
          <a className="menu-lat-i" href={linkSuporte()} target="_blank" rel="noopener" style={n()}><I.chat /><span>Fale com a gente</span></a>
          <Item x={{ l: "Sair da conta", ic: I.out, f: act.sair }} />
        </div>
      </div>
    </aside>
  );
}

// Trocar de área (Consultório, Pessoal, Loja): uma folha que sobe com um cartão grande para cada área
const AREAS_INFO = {
  consultorio: { nome: "Consultório", texto: "Agenda, pacientes, cobranças e recibos", ic: "cal", cor: "#2B46FF" },
  pessoal: { nome: "Pessoal", texto: "Gastos, contas, casa e transporte", ic: "wallet", cor: "#12B76A" },
  loja: { nome: "Loja", texto: "Caixa do dia, gastos e equipe", ic: "bag", cor: "#F79009" },
};
export function ModoFolha({ modo, modos, act, onClose }) {
  const ir = m => { vibrar("toque"); onClose(); if (m !== modo) setTimeout(() => act.setModo(m), 180); };
  return (
    <Sheet folha title="Trocar de área" sub="O app muda inteiro: o Início, as abas e os atalhos." onClose={onClose}>
      <div className="modo-cartoes">
        {modos.map((m, k) => { const a = AREAS_INFO[m], Ic = I[a.ic]; return (
          <button key={m} type="button" className={"modo-cartao" + (m === modo ? " on" : "")} style={{ "--mc": a.cor, animationDelay: `${k * 50}ms` }} onClick={() => ir(m)} aria-pressed={m === modo}>
            <span className="modo-cartao-ic"><Ic /></span>
            <span className="modo-cartao-t"><b>{a.nome}</b><small>{a.texto}</small></span>
            <span className="modo-cartao-ok">{m === modo ? <I.check /> : <I.chev />}</span>
          </button>
        ); })}
      </div>
      <button className="btn text" onClick={() => { onClose(); setTimeout(() => act.openSettings("pessoal"), 200); }}>Ligar ou desligar áreas</button>
    </Sheet>
  );
}

// Alertas: o que antes ficava no "Seu resumo" do Início, numa tela própria (o sino da barra de cima), no jeito da
// lista de alertas dos apps de banco: o que pede atenção primeiro (com o botão para resolver), depois o resto.
export function AlertasTela({ falas, onClose }) {
  useCamada(onClose, { escurece: false, nome: "alertas" });
  const acao = falas.filter(f => f.acao), info = falas.filter(f => !f.acao);
  const Linha = ({ f }) => (
    <div className="al-linha">
      <span className={"al-ic" + (f.acao ? " forte" : "")}>{f.acao ? <I.bell /> : <I.alert />}</span>
      <div className="al-tx"><p>{f.txt}</p>{f.acao && <button className="al-acao" onClick={() => { onClose(); setTimeout(f.acao.fn, 200); }}>{f.acao.l}<I.chev /></button>}</div>
    </div>
  );
  return createPortal(
    <div className="tela-cheia" role="dialog" aria-modal="true" aria-label="Alertas">
      <div className="tela-cheia-in">
        <button className="tela-voltar" onClick={onClose} aria-label="Voltar"><I.setaL /></button>
        <h1 className="tela-t">Alertas</h1>
        {falas.length > 0 && <p className="al-sub">{acao.length ? `${acao.length} ${acao.length === 1 ? "coisa pede" : "coisas pedem"} a sua atenção` : "Nada urgente por aqui"}</p>}
        {!falas.length && <div className="al-vazio"><Ilustra n="cafe" /><b>Tudo em dia</b><span>Quando algo pedir a sua atenção, aparece aqui.</span></div>}
        {acao.length > 0 && <><h2 className="al-grupo">Pede atenção</h2><section className="al-cartao">{acao.map((f, i) => <Linha key={"a" + i} f={f} />)}</section></>}
        {info.length > 0 && <><h2 className="al-grupo">Para saber</h2><section className="al-cartao">{info.map((f, i) => <Linha key={"i" + i} f={f} />)}</section></>}
      </div>
    </div>, document.body);
}

