// Os cartões do Início (consultório e pessoal), no jeito do app de celular: o carrossel de destaques no topo (sobrou no
// mês, recebido, meta, saldo em contas, faturas, investido) e os cartões que a pessoa escolhe e ordena em "Personalizar
// início" (a mesma lista do app, app-celular/src/lib/widgets.ts, com os mesmos ids, para um dia sincronizar).
// Carregado sob demanda: o bloco inicial do app não cresce. Contas pesadas guardadas por versão dos dados (o db é
// trocado inteiro a cada mudança), porque o relógio redesenha o Início a cada 30 s.
import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { I, Money, brl, brlReal, ESCONDER, soma, todayISO, fromISO, MES_LONGO, catDe, catVars, MarcaLogo, acharMarca, itensDoDia, situacao, liquido, contaDinheiro, liquidoMes, situacaoConta, vencimento, diffDias, Sheet, vibrar, useWide, TERMO, addDays } from "../App.jsx";
import { CatBolinha, useContagem, menosMovimento } from "./visual.jsx";
import { resumoPessoal, GraficoLinha, BarraCategorias, eixoDoMes, LancRow, acumuladoMes, diasDoMes, MES_ABREV } from "./resumo.jsx";
import { BancosPainel, useResumoBanco, useCaixinhasNoBanco, totaisBanco, nomeBanco, ABRIR_ABA_BANCO } from "./bancos.jsx";
import { CartaoCaixinhas } from "./dinheiro.jsx";
import { veiculosDe } from "../transporte.js";
import { noApp, chamarApp } from "../app-nativo.js";
import "../inicio.css";

/* ---------- ícones desta parte ---------- */
const Svg = ({ children, sw = 1.8 }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const Ic = {
  banco: () => <Svg><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></Svg>,
  cartao: () => <Svg><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M2.5 10h19M6.5 15h4" /></Svg>,
  sobe: () => <Svg><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></Svg>,
  posto: () => <Svg><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 11h10M14 8h2.5a2 2 0 0 1 2 2v6.5a1.5 1.5 0 0 0 3 0V9l-3-3" /></Svg>,
  alca: () => <Svg sw={2.2}><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" /></Svg>,
  ajustes: () => <Svg><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>,
  categorias: () => <Svg><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="3.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="3.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></Svg>,
  lista: () => <Svg><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></Svg>,
  fluxo: () => <Svg><path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4" /></Svg>,
  escudo: () => <Svg><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /></Svg>,
};

/* ---------- valores ---------- */
const fmt1 = v => v.toFixed(1).replace(".", ",").replace(/,0$/, "");
// Valor sem centavos para os cartões pequenos e as frases (o olho fechado esconde): "R$ 10.467", "R$ 59,90" (abaixo
// de 100 os centavos contam), "R$ 125 mil", "R$ 1,2 mi". Sem centavos, cabe "+R$ 10.467" num cartão de meia largura.
const FMT_INT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
export function curto(v, sinal) {
  if (ESCONDER) return "R$ •••";
  const a = Math.abs(Number(v) || 0), s = v < 0 ? "−" : sinal && v > 0 ? "+" : "";
  if (a >= 1e6) return `${s}R$ ${fmt1(a / 1e6)} mi`;
  if (a >= 1e5) return `${s}R$ ${FMT_INT.format(a / 1e3)} mil`;
  return `${s}R$ ${a >= 100 ? FMT_INT.format(a) : brlReal(a).replace(/^R\$\s?/, "")}`;
}
const porcento = p => `${Math.round(p * 100)}%`;
const chaveDe = iso => iso.slice(0, 7);
const mesAnterior = d => new Date(d.getFullYear(), d.getMonth() - 1, 1);
const chaveData = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// "Nubank e Itaú", "Nubank, Itaú e Inter", "4 bancos"
const listaNomes = n => (n.length > 3 ? `${n.length} bancos` : n.length < 2 ? n[0] || "" : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`);
// "agora", "há 12 min", "há 2 h", "ontem", "há 3 dias"
function haQuanto(iso) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 6e4));
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/* ---------- contas guardadas por versão dos dados ---------- */
const GUARDADO = new WeakMap();
function guardado(db, nome, fazer) {
  const dia = todayISO();
  let g = GUARDADO.get(db);
  if (!g || g.dia !== dia) { g = { dia, v: {} }; GUARDADO.set(db, g); }
  if (!(nome in g.v)) g.v[nome] = fazer();
  return g.v[nome];
}
const resumoMes = db => guardado(db, "resumo", () => resumoPessoal(db, chaveDe(todayISO())));
// Os números do consultório no mês: recebido (cobranças pagas no mês), a receber, sessões, faltas, ativos e o líquido
const numerosConsultorio = db => guardado(db, "consultorio", () => {
  const ch = chaveDe(todayISO()), ses = db.sessions.filter(s => s.date.startsWith(ch));
  return {
    recebido: soma(db.charges.filter(c => c.paid && !c.hidden && c.paidAt && c.paidAt.startsWith(ch)), c => c.amount),
    aReceber: soma(db.charges.filter(c => !c.paid), c => c.amount),
    sessoes: ses.filter(s => s.status === "done").length, faltas: ses.filter(s => s.status === "missed").length,
    ativos: db.patients.filter(p => p.active).length, liquido: liquidoMes(db, ch),
  };
});
// A meta do mês (a mesma conta do antigo medidor): o ritmo esperado até hoje, o que a agenda ainda traz e quantas sessões faltam
const contaMeta = (db, meta) => guardado(db, "meta:" + meta, () => {
  const t = todayISO(), ch = chaveDe(t), dia = fromISO(t).getDate(), dim = diasDoMes(fromISO(t));
  const liq = liquidoMes(db, ch), esperado = (meta * dia) / dim;
  let previsto = 0;
  for (let d = t; d.startsWith(ch); d = addDays(d, 1)) itensDoDia(db, d).forEach(i => { if (i.kind !== "log") previsto += liquido(i.patient); });
  const feitas = db.sessions.filter(s => s.status === "done").slice(-30);
  const media = feitas.length ? soma(feitas, s => s.price - s.sublet) / feitas.length : 0;
  return { liq, esperado, previsto, media, falta: Math.max(meta - liq, 0), batida: liq >= meta, noRitmo: liq >= esperado * .95, dia, dim };
});

/* =========================================================
   Os cartões que a pessoa escolhe (os mesmos ids do app de celular)
   ========================================================= */
// precisa(ctx): o cartão só aparece quando faz sentido; motivo: o que falta (mostrado no "Personalizar")
export const WIDGETS = [
  { id: "bancos", nome: "Saldo em contas", descricao: "Quanto tem em cada banco conectado", ic: Ic.banco, precisa: c => c.banco, motivo: "Aparece com um banco conectado pelo Open Finance" },
  { id: "gastosMes", nome: "Gastos do mês", descricao: "O mês até hoje comparado com o mês passado", ic: Ic.sobe, precisa: c => c.pessoal && c.lanc, motivo: "Aparece com o Pessoal ligado e algum gasto anotado" },
  { id: "categorias", nome: "Gastos por categoria", descricao: "Para onde foi o dinheiro este mês", ic: Ic.categorias, precisa: c => c.pessoal && c.lanc, motivo: "Aparece com o Pessoal ligado e algum gasto anotado" },
  { id: "consultorio", nome: "Hoje no consultório", descricao: "Sessões de hoje, recebido e a receber", ic: I.cal, precisa: c => c.consultorio, motivo: "Aparece com a área Consultório ligada" },
  { id: "recentes", nome: "Transações recentes", descricao: "As últimas movimentações", ic: Ic.lista, precisa: c => c.pessoal && c.lanc, motivo: "Aparece com o Pessoal ligado e algum gasto anotado" },
  { id: "fluxo", nome: "Fluxo de caixa", descricao: "Entrou e saiu no mês", meia: true, ic: Ic.fluxo, precisa: c => c.pessoal && c.lanc, motivo: "Aparece com o Pessoal ligado e algum gasto anotado" },
  { id: "contas", nome: "Contas a pagar", descricao: "As contas fixas que vencem logo", meia: true, ic: I.bill, precisa: c => c.pessoal, motivo: "Aparece com a área Pessoal ligada" },
  { id: "tetos", nome: "Tetos do mês", descricao: "Quanto já foi de cada teto por categoria", ic: Ic.escudo, precisa: c => c.pessoal && c.tetos > 0, motivo: "Aparece quando houver um teto por categoria" },
  { id: "caixinhas", nome: "Caixinhas", descricao: "O que você está guardando", ic: I.piggy, precisa: c => c.pessoal, motivo: "Aparece com a área Pessoal ligada" },
  { id: "combustivel", nome: "Combustível agora", descricao: "O posto mais barato perto de você", ic: Ic.posto, precisa: c => c.pessoal, motivo: "Aparece com a área Pessoal ligada" },
  { id: "areas", nome: "Áreas do Avina", descricao: "Consultório, loja, casa, transporte e o resto", ic: I.grid, precisa: c => c.areas > 0, motivo: "Aparece quando houver outra área para abrir" },
];
const POR_ID = Object.fromEntries(WIDGETS.map(w => [w.id, w]));
const ehWidget = id => !!POR_ID[id];
// Cada Início tem a sua ordem: o do consultório mostra o que é do consultório primeiro (os do Pessoal ficam
// desligados, a um toque em "Personalizar"); o do Pessoal segue a ordem do app de celular
const PADRAO = {
  pessoal: { ordem: ["bancos", "gastosMes", "categorias", "recentes", "fluxo", "contas", "tetos", "caixinhas", "consultorio", "combustivel", "areas"], escondidos: [] },
  consultorio: { ordem: ["consultorio", "bancos", "areas", "gastosMes", "categorias", "recentes", "fluxo", "contas", "tetos", "caixinhas", "combustivel"], escondidos: ["gastosMes", "categorias", "recentes", "fluxo", "contas", "tetos", "caixinhas", "combustivel"] },
};
const copia = e => ({ ordem: [...e.ordem], escondidos: [...e.escondidos] });

/* A escolha fica no aparelho ({ consultorio: { ordem, escondidos }, pessoal: { … } }) */
const K_CARTOES = "avina-inicio-cartoes";
function normalizar(g, modo) {
  const pd = PADRAO[modo] || PADRAO.pessoal;
  if (!g || !Array.isArray(g.ordem)) return copia(pd);
  const ordem = g.ordem.filter(ehWidget), escondidos = (g.escondidos || []).filter(ehWidget);
  // cartão novo (de uma versão mais nova): entra no fim, ligado ou não conforme o padrão deste Início
  pd.ordem.forEach(id => { if (!ordem.includes(id)) { ordem.push(id); if (pd.escondidos.includes(id)) escondidos.push(id); } });
  return { ordem, escondidos };
}
function lerEscolha() {
  let g = {};
  try { g = JSON.parse(localStorage.getItem(K_CARTOES) || "{}") || {}; } catch (e) {}
  return { consultorio: normalizar(g.consultorio, "consultorio"), pessoal: normalizar(g.pessoal, "pessoal") };
}
let ESCOLHA = lerEscolha();
const OUVINTES = new Set();
const ouvir = f => { OUVINTES.add(f); return () => OUVINTES.delete(f); };
const escolhaDe = modo => ESCOLHA[modo] || ESCOLHA.pessoal;
export const useEscolha = modo => useSyncExternalStore(ouvir, () => escolhaDe(modo));
export function mudarEscolha(modo, n) {
  ESCOLHA = { ...ESCOLHA, [modo]: n };
  try { localStorage.setItem(K_CARTOES, JSON.stringify(ESCOLHA)); } catch (e) {}
  OUVINTES.forEach(f => f());
}

// As áreas do Avina que dá para abrir daqui (as outras, fora a do Início em que a pessoa está)
function areasDe(act, modo) {
  const ms = act.modos || [], l = [];
  if (ms.includes("consultorio") && modo !== "consultorio") l.push({ id: "consultorio", nome: "Consultório", desc: "Agenda, pacientes e cobranças", ic: I.cal, cor: "#4A62FF", abrir: () => act.setModo("consultorio") });
  if (ms.includes("pessoal") && modo !== "pessoal") l.push({ id: "pessoal", nome: "Pessoal", desc: "Gastos, contas e caixinhas", ic: I.wallet, cor: "#1FB879", abrir: () => act.setModo("pessoal") });
  if (ms.includes("loja")) l.push({ id: "loja", nome: "Loja", desc: "Caixa, gastos e o que falta", ic: I.bag, cor: "#FF8A3D", abrir: () => act.setModo("loja") });
  if (ms.includes("pessoal")) {
    l.push({ id: "contas", nome: "Contas fixas", desc: "O que vence no mês e o que já foi pago", ic: I.bill, cor: "#F2A93B", abrir: () => act.abrirAba("p-contas") });
    l.push({ id: "casa", nome: "Nossa casa", desc: "Dinheiro a dois ou em família", ic: I.home, cor: "#8B6CFF", abrir: () => act.abrirCasa() });
    l.push({ id: "transporte", nome: "Transporte", desc: "Combustível e gastos do carro", ic: I.car, cor: "#3CC4E6", abrir: () => act.abrirTransporte() });
  }
  return l;
}

// O que existe na conta agora (decide quais cartões aparecem)
function useContexto(db, act, modo) {
  const banco = useResumoBanco();
  const ms = act.modos || [], P = db.pessoal || {};
  return {
    pessoal: ms.includes("pessoal"), consultorio: ms.includes("consultorio"), lanc: (P.lanc || []).length > 0,
    banco: !!(banco.r && banco.r.ligado), tetos: Object.values(P.limites || {}).filter(v => v > 0).length,
    areas: areasDe(act, modo).length, r: banco.r,
  };
}
const visiveis = (escolha, ctx) => escolha.ordem.filter(id => !escolha.escondidos.includes(id)).map(id => POR_ID[id]).filter(w => w.precisa(ctx));

/* =========================================================
   O carrossel do topo
   ========================================================= */
// O cartão grande: a etiqueta com o ícone na cor do cartão (com um brilho dela no canto), o número grande e,
// embaixo, as barras ou as logos. Tocável quando tem para onde ir.
export function Grande({ rotulo, icone: Icone, cor, onClick, falar, className = "", children }) {
  const conteudo = <>
    <span className="ini-g-topo"><span className="ini-g-ic"><Icone /></span><span className="ini-g-rot">{rotulo}</span>{onClick && <I.chev />}</span>
    {children}
  </>;
  return onClick
    ? <button type="button" className={"ini-g " + className} style={{ "--gc": cor }} onClick={onClick} aria-label={falar}>{conteudo}</button>
    : <div className={"ini-g " + className} style={{ "--gc": cor }} role="group" aria-label={falar}>{conteudo}</div>;
}
// O número grande que corre até o valor
function ValorGrande({ v, neg }) {
  const x = useContagem(v);
  return <b className={"ini-g-v" + (neg ? " neg" : "")}><Money v={ESCONDER ? v : x} /></b>;
}
// "Entrou ▬▬▬▬▬▬ R$ 9,5 mil"
function LinhaBarra({ rotulo, valor, maior, cor, k = 0 }) {
  return (
    <span className="ini-g-barra" style={{ "--bc": cor }}>
      <span>{rotulo}</span>
      <span className="ini-trilho"><i style={{ width: `${maior > 0 ? Math.max(2, (valor / maior) * 100) : 0}%`, "--i": k }} /></span>
      <b>{curto(valor)}</b>
    </span>
  );
}
// As logos dos bancos, uma por cima da outra
const Logos = ({ bancos }) => <span className="ini-logos" aria-hidden="true">{bancos.slice(0, 4).map(b => <MarcaLogo key={b} marca={(acharMarca(b) || {}).id} nome={b} className="ini-logo" />)}</span>;

// O painel do banco (o cartão "Saldo em contas") mais abaixo: rola até ele e abre na aba certa
function irAoBanco(aba) {
  const el = document.getElementById("ini-bancos");
  if (!el) return;
  window.dispatchEvent(new CustomEvent(ABRIR_ABA_BANCO, { detail: aba }));
  el.scrollIntoView({ behavior: menosMovimento() ? "auto" : "smooth", block: "start" });
}

function cartoesDoBanco(r, podeAbrir) {
  const t = totaisBanco(r), l = [];
  const nomes = lista => [...new Set(lista.map(c => nomeBanco(c.banco) || c.nome))];
  const abrir = aba => (podeAbrir ? () => irAoBanco(aba) : null);
  if (t.contas.length) {
    const bancos = nomes(t.contas), quando = haQuanto(r.em);
    l.push({ id: "saldo", el: <Grande rotulo="Saldo em contas" icone={Ic.banco} cor="#4A62FF" onClick={abrir("contas")} falar={`Saldo em contas: ${brl(t.emConta)}`}>
      <ValorGrande v={t.emConta} neg={t.emConta < 0} />
      <span className="ini-g-pe ini-g-rodape"><Logos bancos={bancos} /><span className="ini-g-txt"><b>{listaNomes(bancos)}</b><small>{t.contas.length === 1 ? "1 conta" : `${t.contas.length} contas`}{quando ? ` · atualizado ${quando}` : ""}</small></span></span>
    </Grande> });
  }
  if (t.cartoes.length) {
    const d = t.vence ? diffDias(todayISO(), t.vence) : null, f = fromISO(t.vence || todayISO());
    const quando = d == null ? "" : d < 0 ? `venceu há ${-d} ${-d === 1 ? "dia" : "dias"}` : d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : `vence em ${d} dias`;
    l.push({ id: "faturas", el: <Grande rotulo="Faturas" icone={Ic.cartao} cor="#8B6CFF" onClick={abrir("cartoes")} falar={`Faturas: ${brl(t.faturas)}${quando ? `, ${quando}` : ""}`}>
      <ValorGrande v={t.faturas} />
      {quando && <span className={"ini-g-apoio" + (d != null && d <= 3 ? " atencao" : "")}>{quando[0].toUpperCase() + quando.slice(1)} · {f.getDate()} de {MES_ABREV[f.getMonth()]}</span>}
      {t.limite > 0 && <span className="ini-g-pe">
        <span className="ini-trilho grosso" style={{ "--bc": "#8B6CFF" }}><i style={{ width: `${Math.min(100, (t.usado / t.limite) * 100)}%` }} /></span>
        <span className="ini-g-entre"><span>Limite livre</span><b>{curto(Math.max(0, t.limite - t.usado))} de {curto(t.limite)}</b></span>
      </span>}
    </Grande> });
  }
  if (t.inv.length) {
    const bancos = nomes(t.inv);
    l.push({ id: "investido", el: <Grande rotulo="Investido" icone={Ic.sobe} cor="#3CC4E6" onClick={abrir("inv")} falar={`Investido: ${brl(t.investido)}${t.rendeu ? `, rendeu ${brl(t.rendeu)}` : ""}`}>
      <ValorGrande v={t.investido} />
      {t.rendeu !== 0 && <span className={"ini-g-apoio " + (t.rendeu > 0 ? "mais" : "atencao")}>{t.rendeu > 0 ? "↑ " : "↓ "}{curto(Math.abs(t.rendeu), false)} {t.rendeu > 0 ? "de rendimento" : "de variação"}</span>}
      <span className="ini-g-pe ini-g-rodape"><Logos bancos={bancos} /><span className="ini-g-txt"><small>{t.inv.length === 1 ? "1 aplicação" : `${t.inv.length} aplicações`} · {listaNomes(bancos)}</small></span></span>
    </Grande> });
  }
  return l;
}

// Os destaques do mês. Pessoal: quanto sobrou (e o que o Início do Pessoal juntar em "extras"); Consultório:
// o recebido e a meta. Com o banco conectado: saldo em contas, faturas e investido.
// No celular, um cartão por vez (deslizar, com as bolinhas de página); no computador, até três lado a lado, com setas.
export function Carrossel({ db, modo, act, meta, extras = [] }) {
  const P = db.pessoal || {}, d = fromISO(todayISO()), mes = MES_LONGO[d.getMonth()];
  const ctx = useContexto(db, act, modo);
  const escolha = useEscolha(modo);
  useCaixinhasNoBanco(modo === "pessoal" ? P.caixinhas : null, act);
  const cartoes = [];
  if (modo === "pessoal") {
    if ((P.lanc || []).length || (P.contas || []).length) {
      const r = resumoMes(db), maior = Math.max(r.entrou, r.saiu), sobra = r.sobra;
      cartoes.push({ id: "mes", el: <Grande rotulo={sobra >= 0 ? `Sobrou em ${mes}` : `Passou do que entrou em ${mes}`} icone={I.wallet} cor="var(--mode)" onClick={() => act.setTab("p-gastos")}
        falar={`${sobra >= 0 ? "Sobrou" : "Passou do que entrou"} ${brl(Math.abs(sobra))} em ${mes}. Entrou ${brl(r.entrou)}, saiu ${brl(r.saiu)}`}>
        <ValorGrande v={sobra} neg={sobra < 0} />
        <span className="ini-g-apoio">{r.entrou <= 0 ? `Nenhuma entrada anotada em ${mes}` : sobra >= 0 ? `${porcento(sobra / r.entrou)} do que entrou ficou com você` : r.saiu / r.entrou >= 2 ? `Saiu ${fmt1(r.saiu / r.entrou)} vezes o que entrou` : `Saiu ${porcento(r.saiu / r.entrou - 1)} a mais do que entrou`}</span>
        <span className="ini-g-pe">
          <LinhaBarra rotulo="Entrou" valor={r.entrou} maior={maior} cor="var(--mint)" />
          <LinhaBarra rotulo="Saiu" valor={r.saiu} maior={maior} cor="var(--rose)" k={1} />
        </span>
      </Grande> });
    } else {
      // conta nova: o convite para o primeiro gasto
      cartoes.push({ id: "boas-vindas", el: <div className="ini-g ini-g-oi" style={{ "--gc": "var(--mode)" }}>
        <span className="ini-g-oi-b ini-g-oi-ic"><I.wallet /></span>
        <b>Anote o primeiro gasto</b>
        <span className="ini-g-apoio">E o Início ganha vida: quanto sobrou no mês, para onde foi o dinheiro e o que vence logo.</span>
        <button type="button" className="ini-botao" onClick={() => act.novoLanc("saida")}><I.plus />Anotar gasto</button>
      </div> });
    }
  } else {
    const k = numerosConsultorio(db), T = TERMO;
    cartoes.push({ id: "recebido", el: <Grande rotulo={`Recebido em ${mes}`} icone={I.wallet} cor="var(--mode)" onClick={() => act.setTab("fin")}
      falar={`Recebido em ${mes}: ${brl(k.recebido)}. A receber ${brl(k.aReceber)}. ${k.sessoes} sessões no mês`}>
      <ValorGrande v={k.recebido} />
      <span className="ini-g-apoio">{k.faltas === 0 ? "Nenhuma falta no mês" : k.faltas === 1 ? "1 falta no mês" : `${k.faltas} faltas no mês`}</span>
      <span className="ini-g-pe ini-g-trio">
        <span><small>A receber</small><b className={k.aReceber > 0 ? "atencao" : ""}>{curto(k.aReceber)}</b></span>
        <span><small>Sessões</small><b>{k.sessoes}</b></span>
        <span><small>{T.P}</small><b>{k.ativos} {k.ativos === 1 ? "ativo" : "ativos"}</b></span>
      </span>
    </Grande> });
    if (meta > 0) {
      const m = contaMeta(db, meta), ok = m.batida || m.noRitmo;
      cartoes.push({ id: "meta", el: <Grande rotulo={`Meta de ${mes}`} icone={I.target} cor="var(--mint)" onClick={() => act.setTab("fin")}
        falar={`Meta de ${mes}: ${brl(m.liq)} de ${brl(meta)}. ${m.batida ? "Meta batida" : m.noRitmo ? "No ritmo da meta" : `Abaixo do ritmo por ${brl(m.esperado - m.liq)}`}`}>
        <ValorGrande v={m.liq} />
        <span className={"ini-g-apoio " + (ok ? "mais" : "atencao")}>{m.batida ? `Meta batida! Passou ${curto(m.liq - meta)}` : m.noRitmo ? "No ritmo da meta" : `Abaixo do ritmo por ${curto(m.esperado - m.liq)}`}</span>
        <span className="ini-g-pe">
          {/* a barra é a meta; o risquinho, onde o mês deveria estar hoje */}
          <span className="ini-trilho grosso ini-meta" style={{ "--bc": ok ? "var(--mint)" : "var(--rose)" }}><i style={{ width: `${Math.min(100, (m.liq / meta) * 100)}%` }} />{!m.batida && <em style={{ left: `${Math.min(100, (m.esperado / meta) * 100)}%` }} />}</span>
          <span className="ini-g-entre"><span>de {curto(meta)} · dia {m.dia} de {m.dim}</span><b>{m.batida ? "" : m.media > 0 ? `faltam ~${Math.ceil(m.falta / m.media)} sessões` : `faltam ${curto(m.falta)}`}</b></span>
        </span>
      </Grande> });
    } else {
      cartoes.push({ id: "meta", el: <Grande rotulo="Meta do mês" icone={I.target} cor="var(--mint)" onClick={() => act.openSettings("dinheiro")} falar="Meta do mês: ainda sem meta. Definir meta">
        <span className="ini-g-apoio grande">Com uma meta, eu mostro se o mês está no ritmo e quantas sessões faltam.</span>
        <span className="ini-g-pe"><span className="ini-botao falso"><I.plus />Definir meta</span></span>
      </Grande> });
    }
  }
  cartoes.splice(1, 0, ...extras.filter(Boolean));
  if (ctx.r && ctx.r.ligado && (ctx.r.bancos || []).length) cartoes.push(...cartoesDoBanco(ctx.r, visiveis(escolha, ctx).some(w => w.id === "bancos")));
  return <Trilho cartoes={cartoes} />;
}

function Trilho({ cartoes }) {
  const wide = useWide();
  const trilho = useRef(null);
  const [pos, setPos] = useState({ pag: 0, ini: true, fim: false });
  const n = cartoes.length, porTela = wide ? Math.min(n, 3) : 1, paginas = n - porTela + 1;
  // a página de agora sai da rolagem (um setState só quando muda)
  const ler = () => {
    const el = trilho.current; if (!el) return;
    const item = el.firstElementChild, passo = item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0) : 1;
    const pag = Math.max(0, Math.min(paginas - 1, Math.round(el.scrollLeft / (passo || 1))));
    const ini = el.scrollLeft < 4, fim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setPos(p => (p.pag === pag && p.ini === ini && p.fim === fim ? p : { pag, ini, fim }));
  };
  useLayoutEffect(ler, [n, porTela]);
  const raf = useRef(0);
  const rolou = () => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; ler(); }); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const mover = dir => {
    const el = trilho.current; if (!el) return;
    const item = el.firstElementChild, passo = item.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0);
    el.scrollBy({ left: dir * passo, behavior: menosMovimento() ? "auto" : "smooth" });
  };
  const irPara = k => {
    const el = trilho.current, item = el && el.children[k]; if (!item) return;
    el.scrollTo({ left: item.offsetLeft - el.firstElementChild.offsetLeft, behavior: menosMovimento() ? "auto" : "smooth" });
  };
  if (!n) return null;
  return (
    <section className={"ini-car" + (paginas > 1 ? " com-bolinhas" : "")} style={{ "--por": porTela }} aria-label="Destaques do mês" aria-roledescription="carrossel">
      <div className="ini-car-trilho" ref={trilho} onScroll={rolou}>
        {cartoes.map((c, k) => <div key={c.id} className="ini-car-item" role="group" aria-roledescription="destaque" aria-label={`${k + 1} de ${n}`}>{c.el}</div>)}
      </div>
      {wide && paginas > 1 && <>
        <button type="button" className="ini-car-seta esq" onClick={() => mover(-1)} disabled={pos.ini} aria-label="Destaque anterior"><I.chevL /></button>
        <button type="button" className="ini-car-seta dir" onClick={() => mover(1)} disabled={pos.fim} aria-label="Próximo destaque"><I.chev /></button>
      </>}
      {paginas > 1 && <div className="ini-car-bolinhas">
        {Array.from({ length: paginas }, (_, k) => <button key={k} type="button" className={k === pos.pag ? "on" : ""} onClick={() => irPara(k)} aria-label={`Ir para o destaque ${k + 1}`} aria-current={k === pos.pag ? "true" : undefined} />)}
      </div>}
    </section>
  );
}

/* =========================================================
   Os cartões
   ========================================================= */
// Cabeçalho de um cartão: o nome em cinza e, se abre algo, a setinha
function Cab({ children, onClick, extra }) {
  return onClick
    ? <div className="ini-cab"><button type="button" className="ini-cab-b" onClick={onClick}><span>{children}</span><I.chev /></button>{extra}</div>
    : <div className="ini-cab"><span className="ini-cab-t">{children}</span>{extra}</div>;
}

// Saldo nos bancos: o painel do banco (contas com a parte de cada banco, cartões e investimentos)
function CartaoBancos({ db, act, ctx }) {
  if (!ctx.r) return null;
  if (!(ctx.r.bancos || []).length) return (
    <section className="ini-cartao" id="ini-bancos">
      <Cab>Saldo em contas</Cab>
      <b className="ini-sub">Conecte seu banco</b>
      <p className="ini-apoio">Os saldos de todas as contas num lugar só, pelo Open Finance. Só leitura: nada sai da sua conta.</p>
      <button type="button" className="ini-botao" onClick={act.importarDoBanco}><I.plus />Conectar banco</button>
    </section>
  );
  return <BancosPainel id="ini-bancos" caixinhas={(db.pessoal || {}).caixinhas || []} act={act} />;
}

// Gastos do mês: o gasto acumulado até hoje, com o mês passado tracejado atrás (no mesmo dia, para ser justo)
function CartaoGastosMes({ db, act }) {
  const t = todayISO(), d = fromISO(t), ch = chaveDe(t), hojeI = d.getDate() - 1, n = diasDoMes(d);
  const pm = mesAnterior(d), chA = chaveData(pm), nA = diasDoMes(pm);
  const atual = guardado(db, "acum", () => acumuladoMes(db, ch, n).slice(0, hojeI + 1));
  const antes = guardado(db, "acum-ant", () => acumuladoMes(db, chA, nA));
  const ateHoje = atual[atual.length - 1] || 0, mesmoDia = antes[Math.min(hojeI, nA - 1)] || 0, temAnt = antes[nA - 1] > 0;
  const dif = mesmoDia > 0 ? (ateHoje - mesmoDia) / mesmoDia : null, igual = dif != null && Math.abs(dif) < .005;
  const nomeAnt = MES_LONGO[pm.getMonth()], mes = MES_LONGO[d.getMonth()], ab = MES_ABREV[d.getMonth()];
  const frase = dif == null ? `${nomeAnt[0].toUpperCase() + nomeAnt.slice(1)} não tem gastos para comparar` : igual ? "O mesmo que no mesmo dia do mês passado" : `${porcento(Math.abs(dif))} a ${dif > 0 ? "mais" : "menos"} que no mesmo dia do mês passado`;
  const v = useContagem(ateHoje);
  return (
    <section className="ini-cartao" aria-label={`Gastos de ${mes}`}>
      <Cab onClick={() => act.abrirAba("p-gastos")}>Gastos de {mes}</Cab>
      <b className="ini-valor"><Money v={ESCONDER ? ateHoje : v} /></b>
      <span className={"ini-comp" + (dif == null || igual ? "" : dif > 0 ? " sobe" : " desce")}>{dif != null && !igual && <i aria-hidden="true">{dif > 0 ? "↑" : "↓"}</i>}{frase}</span>
      <div className="ini-graf">
        <GraficoLinha key={ch} n={n} altura={128} cor="var(--mode)"
          series={[...(temAnt ? [{ v: antes.slice(0, n), tipo: "fantasma" }] : []), { v: atual, tipo: "cheia" }]}
          eixo={eixoDoMes(n, hojeI, ab)} legenda={temAnt ? [{ t: mes[0].toUpperCase() + mes.slice(1) }, { t: nomeAnt[0].toUpperCase() + nomeAnt.slice(1), tipo: "fantasma" }] : null}
          dica={i => <><small>{i === hojeI ? "Hoje" : `${i + 1} de ${ab}`}</small>{i < atual.length ? brl(atual[i]) : "—"}{temAnt && antes[i] != null && <em>{nomeAnt.slice(0, 3)}: {brl(antes[i])}</em>}</>}
          rotulo={`Gastos de ${mes} até hoje: ${brl(ateHoje)}. ${frase}`} />
      </div>
    </section>
  );
}

// Gastos por categoria: o total, a barra segmentada e as quatro maiores (tocar abre o teto da categoria)
function CartaoCategorias({ db, act }) {
  const r = resumoMes(db), mes = MES_LONGO[fromISO(todayISO()).getMonth()];
  const cats = Object.entries(r.porCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = soma(cats, c => c[1]);
  return (
    <section className="ini-cartao" aria-label="Gastos por categoria">
      <Cab onClick={() => act.abrirAba("p-gastos")}>Gastos por categoria · {mes}</Cab>
      <b className="ini-valor"><Money v={total} /></b>
      {cats.length ? <>
        <BarraCategorias cats={cats} total={total} />
        <div className="ini-cats">
          {cats.slice(0, 4).map(([id, v]) => { const c = catDe(id); return (
            <button key={id} type="button" className="ini-cat" onClick={() => (id === "transporte" ? act.abrirTransporte() : act.abrirTeto(id))}>
              <CatBolinha cat={c} p={v / (total || 1)} tam={38} />
              <span><small>{c.nome}</small><b>{curto(v)}<em>{porcento(v / (total || 1))}</em></b></span>
            </button>
          ); })}
        </div>
        {cats.length > 4 && <button type="button" className="link ini-pe" onClick={() => act.abrirAba("p-gastos")}>Ver as {cats.length} categorias</button>}
      </> : <p className="ini-apoio">Nenhum gasto em {mes} ainda.</p>}
    </section>
  );
}

// Hoje no consultório: as sessões de hoje numa linha do tempo (hora, nome, situação e valor). Tocar numa sessão abre
// ela (marcar, remarcar, cobrar). No Início do Pessoal vêm também o recebido e o que falta receber (no do consultório,
// esses números já estão no carrossel).
const SITUACAO = { done: ["Feita", "ok"], missed: ["Faltou", "falta"], up: ["Próxima", "prox"], proj: ["Prevista", "prev"], late: ["Sem marcar", "marcar"] };
const MAX_SESSOES = 6;
function CartaoConsultorio({ db, act, now, comNumeros }) {
  const t = todayISO(), itens = itensDoDia(db, t).map(i => ({ i, st: situacao(i, now) }));
  const feitas = itens.filter(x => x.st === "done").length, iProx = itens.findIndex(x => x.st === "up" || x.st === "proj");
  const prox = iProx >= 0 ? itens[iProx] : null;
  // muitas sessões: mostra a partir da última que passou (a próxima fica sempre à vista)
  const de = itens.length > MAX_SESSOES ? Math.max(0, Math.min(itens.length - MAX_SESSOES, (iProx >= 0 ? iProx : itens.length) - 1)) : 0;
  const mostrar = itens.slice(de, de + MAX_SESSOES), resto = itens.length - mostrar.length;
  const titulo = !itens.length ? "Nenhuma sessão hoje" : `${itens.length} ${itens.length === 1 ? "sessão" : "sessões"} hoje`;
  const sub = itens.length ? `${feitas} ${feitas === 1 ? "feita" : "feitas"}${prox ? ` · a próxima às ${prox.i.time}` : ""}` : "";
  const k = comNumeros ? numerosConsultorio(db) : null;
  return (
    <section className="ini-cartao" aria-label="Hoje no consultório">
      <Cab onClick={() => act.abrirAba("agenda")}>Hoje no consultório</Cab>
      <b className="ini-sub">{titulo}</b>
      {sub && <span className="ini-apoio">{sub}</span>}
      {mostrar.length ? <div className="ini-dia">
        {mostrar.map(({ i, st }, n) => {
          const [nome, tom] = SITUACAO[st] || SITUACAO.late, p = i.patient;
          const valor = i.kind === "log" ? (contaDinheiro(i.session) ? i.session.price - i.session.sublet : null) : liquido(p);
          return (
            <button key={p.id + i.time + n} type="button" className={"ini-ses " + tom + (prox && i === prox.i ? " agora" : "") + (n === 0 ? " primeira" : "") + (n === mostrar.length - 1 ? " ultima" : "")} onClick={() => act.openItem(i)}>
              <span className="ini-ses-h">{i.time}</span>
              <span className="ini-ses-trilho" aria-hidden="true"><i /></span>
              <span className="ini-ses-nm">{p.name}</span>
              <span className={"ini-pilula " + tom}>{nome}</span>
              <span className="ini-ses-v">{valor == null ? "—" : curto(valor)}</span>
            </button>
          );
        })}
        {resto > 0 && <span className="ini-apoio ini-dia-mais">e mais {resto} {resto === 1 ? "sessão" : "sessões"}</span>}
      </div> : <div className="ini-livre"><I.cal /><span>A agenda de hoje está livre.</span></div>}
      {k && <div className="ini-numeros">
        <span><small>Recebido no mês</small><b className="mais">{curto(k.recebido)}</b></span>
        <span><small>A receber</small><b className={k.aReceber > 0 ? "atencao" : ""}>{curto(k.aReceber)}</b></span>
        <span><small>Sessões</small><b>{k.sessoes}</b></span>
      </div>}
    </section>
  );
}

// Transações recentes: quantas no mês e as três últimas (com a logo e o selo do banco)
function CartaoRecentes({ db, act }) {
  const t = todayISO(), ch = chaveDe(t), mes = MES_LONGO[fromISO(t).getMonth()];
  const { n, ultimos } = guardado(db, "recentes", () => {
    const L = db.pessoal.lanc;
    return { n: L.filter(l => l.data.startsWith(ch)).length, ultimos: L.filter(l => l.data <= t).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3) };
  });
  if (!ultimos.length) return null;
  return (
    <section className="ini-cartao" aria-label="Transações recentes">
      <Cab onClick={() => act.abrirAba("p-gastos")}>Transações recentes</Cab>
      <span className="ini-contagem"><b>{n}</b>{n === 1 ? "movimentação" : "movimentações"} em {mes}</span>
      <div className="ini-recentes">{ultimos.map(l => <LancRow key={l.id} l={l} onAbrir={act.editLanc} hoje={t} oculto={ESCONDER} />)}</div>
    </section>
  );
}

// Fluxo de caixa (meia largura): o que entrou e o que saiu no mês
function CartaoFluxo({ db, act }) {
  const r = resumoMes(db), maior = Math.max(r.entrou, r.saiu, 1);
  return (
    <button type="button" className="ini-cartao ini-meia" onClick={() => act.abrirAba("p-gastos")} aria-label={`Fluxo de caixa: entrou ${brl(r.entrou)}, saiu ${brl(r.saiu)}`}>
      <span className="ini-cab"><span className="ini-cab-t">Fluxo de caixa</span><I.chev /></span>
      <span className="ini-meia-v"><small>Entrou</small><b className="mais">{curto(r.entrou, true)}</b></span>
      <span className="ini-meia-v"><small>Saiu</small><b className="menos">{curto(-r.saiu)}</b></span>
      <span className="ini-meia-pe">
        <span className="ini-trilho grosso" style={{ "--bc": "var(--mint)" }}><i style={{ width: `${(r.entrou / maior) * 100}%` }} /></span>
        <span className="ini-trilho grosso" style={{ "--bc": "var(--rose)" }}><i style={{ width: `${(r.saiu / maior) * 100}%`, "--i": 1 }} /></span>
      </span>
    </button>
  );
}

// Contas a pagar (meia largura): a próxima (com o "paguei" ali mesmo) e mais duas
function CartaoContas({ db, act }) {
  const ch = chaveDe(todayISO()), mes = MES_LONGO[fromISO(todayISO()).getMonth()];
  const abertas = (db.pessoal.contas || []).filter(c => !(c.pagas && c.pagas[ch])).sort((a, b) => vencimento(a, ch).localeCompare(vencimento(b, ch)));
  const [c, ...outras] = abertas;
  if (!c) return (
    <button type="button" className="ini-cartao ini-meia" onClick={() => act.abrirAba("p-contas")} aria-label="Contas a pagar: tudo pago este mês">
      <span className="ini-cab"><span className="ini-cab-t">A pagar</span><I.chev /></span>
      <span className="ini-ok" aria-hidden="true"><I.check /></span>
      <b className="ini-sub">Tudo pago</b>
      <span className="ini-apoio">{(db.pessoal.contas || []).length ? `As contas fixas de ${mes} estão em dia.` : "Nenhuma conta fixa ainda."}</span>
    </button>
  );
  const s = situacaoConta(c, ch), tom = s.st === "atrasada" ? "falta" : s.st === "hoje" || s.st === "breve" ? "marcar" : "neutro";
  const marca = c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id;
  return (
    <div className="ini-cartao ini-meia">
      <button type="button" className="ini-cab ini-cab-b" onClick={() => act.abrirAba("p-contas")}><span>A pagar</span><I.chev /></button>
      <button type="button" className="ini-conta" onClick={() => act.editConta(c.id)} aria-label={`${c.nome}, ${brl(c.valor)}, ${s.txt.toLowerCase()}`}>
        <MarcaLogo marca={marca} site={c.logoSite} nome={c.nome} cat={catDe(c.cat)} className="ini-conta-logo" /><b>{c.nome}</b>
      </button>
      <span className="ini-conta-st">
        <b className="ini-meia-num">{c.valor < 100 ? <Money v={c.valor} /> : curto(c.valor)}</b>
        <button type="button" className="ini-paguei" onClick={() => act.pagarConta(c.id)} aria-label={`Marcar ${c.nome} como paga`} title="Já paguei"><I.check /></button>
      </span>
      <span className={"ini-pilula " + tom}>{s.txt}</span>
      <span className="ini-meia-pe">
        {outras.slice(0, outras.length > 3 ? 2 : 3).map(x => <span key={x.id} className="ini-outra"><span>{x.nome}</span><b>{curto(x.valor)}</b></span>)}
        {outras.length > 3 && <span className="ini-outra fraco"><span>e mais {outras.length - 2}</span><b>{curto(soma(outras.slice(2), x => x.valor))}</b></span>}
      </span>
    </div>
  );
}

// Tetos do mês: um anel por categoria, um dentro do outro (as três mais perto do teto)
function Aneis({ aneis, tam = 124, esp = 12, vao = 4 }) {
  return (
    <svg className="ini-aneis" width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true">
      {aneis.map((a, k) => {
        const r = tam / 2 - esp / 2 - k * (esp + vao), c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, a.p));
        return <g key={k} style={{ "--ac": a.cor, "--k": k }}>
          <circle cx={tam / 2} cy={tam / 2} r={r} className="trilho" strokeWidth={esp} />
          {p > 0 && <circle cx={tam / 2} cy={tam / 2} r={r} className="cheio" strokeWidth={esp} style={{ strokeDasharray: c, strokeDashoffset: c * (1 - p), "--c": c }} transform={`rotate(-90 ${tam / 2} ${tam / 2})`} />}
        </g>;
      })}
    </svg>
  );
}
const corCat = id => `var(--g-${id}, ${catVars(catDe(id))["--cc"]})`;
function CartaoTetos({ db, act }) {
  const r = resumoMes(db);
  const tetos = Object.entries(db.pessoal.limites || {}).filter(([, v]) => v > 0)
    .map(([id, teto]) => ({ id, teto, gasto: r.porCat[id] || 0 })).sort((a, b) => b.gasto / b.teto - a.gasto / a.teto).slice(0, 3);
  if (!tetos.length) return null;
  return (
    <section className="ini-cartao" aria-label="Tetos do mês">
      <Cab onClick={() => act.abrirAba("p-gastos")}>Tetos do mês</Cab>
      <div className="ini-tetos">
        <Aneis aneis={tetos.map(t => ({ p: t.gasto / t.teto, cor: t.gasto > t.teto ? "var(--rose)" : corCat(t.id) }))} />
        <div className="ini-tetos-l">
          {tetos.map(t => { const p = t.gasto / t.teto, passou = p > 1, c = catDe(t.id); return (
            <button key={t.id} type="button" className="ini-teto" onClick={() => act.abrirTeto(t.id)}>
              <span className="ini-teto-t"><i style={{ background: passou ? "var(--rose)" : corCat(t.id) }} /><b>{c.nome}</b><em className={passou ? "menos" : ""}>{porcento(p)}</em></span>
              <small className={passou ? "menos" : ""}>{passou ? `${curto(t.gasto - t.teto)} acima do teto` : `${curto(t.gasto)} de ${curto(t.teto)}`}</small>
            </button>
          ); })}
        </div>
      </div>
    </section>
  );
}

// Combustível agora: o posto mais barato perto (não pede a localização sozinho: só ao abrir)
function CartaoCombustivel({ db }) {
  const [Posto, setPosto] = useState(null);
  const v = veiculosDe(db).find(x => x.tipo === "carro" || x.tipo === "moto") || null;
  const abrir = async () => {
    vibrar("toque");
    // no app de celular, a tela nativa do posto mais barato
    if (noApp) { const { combDoVeiculo } = await import("../postos.js"); return chamarApp("abrir", { tela: "postos", comb: combDoVeiculo(v), consumo: 0 }).catch(() => abrirSite()); }
    abrirSite();
  };
  const abrirSite = () => import("./postos.jsx").then(m => setPosto(() => m.PostoBaratoSheet));
  return (
    <>
      <button type="button" className="ini-cartao ini-linha" onClick={abrir}>
        <span className="ini-linha-ic" style={{ "--gc": "var(--amber)" }}><Ic.posto /></span>
        <span className="ini-linha-t"><b>Combustível agora</b><small>O posto mais barato perto de você e se o etanol compensa</small></span>
        <I.chev />
      </button>
      {Posto && createPortal(<Posto veiculo={v} onClose={() => setPosto(null)} />, document.querySelector(".shell") || document.body)}
    </>
  );
}

// As áreas do Avina (as outras, fora a deste Início)
function CartaoAreas({ act, modo }) {
  const areas = areasDe(act, modo);
  if (!areas.length) return null;
  return (
    <section className="ini-cartao" aria-label="Áreas do Avina">
      <Cab>Áreas do Avina</Cab>
      <div className="ini-areas">
        {areas.map(a => (
          <button key={a.id} type="button" className="ini-area" style={{ "--gc": a.cor }} onClick={a.abrir}>
            <span className="ini-area-ic"><a.ic /></span>
            <span><b>{a.nome}</b><small>{a.desc}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Widget({ id, db, act, modo, now, ctx }) {
  switch (id) {
    case "bancos": return <CartaoBancos db={db} act={act} ctx={ctx} />;
    case "gastosMes": return <CartaoGastosMes db={db} act={act} />;
    case "categorias": return <CartaoCategorias db={db} act={act} />;
    case "consultorio": return <CartaoConsultorio db={db} act={act} now={now} comNumeros={modo !== "consultorio"} />;
    case "recentes": return <CartaoRecentes db={db} act={act} />;
    case "fluxo": return <CartaoFluxo db={db} act={act} />;
    case "contas": return <CartaoContas db={db} act={act} />;
    case "tetos": return <CartaoTetos db={db} act={act} />;
    case "caixinhas": return <CartaoCaixinhas db={db} act={act} />;
    case "combustivel": return <CartaoCombustivel db={db} />;
    case "areas": return <CartaoAreas act={act} modo={modo} />;
    default: return null;
  }
}

// Altura aproximada de cada cartão no computador (para dividir em duas colunas sem buraco grande)
function alturaDe(id, db, now) {
  switch (id) {
    case "bancos": return 470;
    case "gastosMes": return 340;
    case "categorias": return 300;
    case "consultorio": return 150 + Math.min(MAX_SESSOES, itensDoDia(db, todayISO()).length || 1) * 48;
    case "recentes": return 320;
    case "tetos": return 220;
    case "caixinhas": return 260 + Math.min(4, ((db.pessoal || {}).caixinhas || []).length) * 66;
    case "combustivel": return 92;
    case "areas": return 300;
    default: return 240;
  }
}

// Os cartões escolhidos, na ordem da pessoa. Os de meia largura vão aos pares, lado a lado.
//   antes / depois: peças fixas do Início (o resumo, as pendências, a previsão, a conquista): [{ id, el, h }]
// No celular, uma coluna: antes, os cartões, depois. No computador, duas colunas: "antes" abre a da esquerda e o resto
// vai para a coluna mais curta, na ordem.
export function CartoesInicio({ db, modo, act, now, antes = [], depois = [] }) {
  const wide = useWide();
  const escolha = useEscolha(modo);
  const ctx = useContexto(db, act, modo);
  const lista = visiveis(escolha, ctx);
  const linhas = [];
  for (let i = 0; i < lista.length; i++) {
    const w = lista[i], prox = lista[i + 1];
    if (w.meia && prox && prox.meia) { linhas.push({ id: `${w.id}+${prox.id}`, h: 250, el: <div className="ini-par"><Widget id={w.id} db={db} act={act} modo={modo} now={now} ctx={ctx} /><Widget id={prox.id} db={db} act={act} modo={modo} now={now} ctx={ctx} /></div> }); i++; }
    else linhas.push({ id: w.id, h: alturaDe(w.id, db, now), el: <Widget id={w.id} db={db} act={act} modo={modo} now={now} ctx={ctx} /> });
  }
  const resto = [...linhas, ...depois.filter(x => x && x.el)];
  const rodape = (
    <div className="ini-rodape">
      <button type="button" className="chip-btn" onClick={act.personalizarInicio} aria-label="Personalizar o início: escolher e ordenar os cartões"><Ic.ajustes />Personalizar início</button>
    </div>
  );
  if (!wide) return (
    <div className="ini-cartoes">
      {antes.filter(x => x && x.el).map(x => <React.Fragment key={x.id}>{x.el}</React.Fragment>)}
      {resto.map(x => <React.Fragment key={x.id}>{x.el}</React.Fragment>)}
      {rodape}
    </div>
  );
  const esq = [], dir = [];
  let hE = soma(antes.filter(x => x && x.el), x => x.h || 200), hD = 0;
  resto.forEach(x => { if (hD <= hE) { dir.push(x); hD += x.h + 16; } else { esq.push(x); hE += x.h + 16; } });
  return (
    <>
      <div className="ini-grade">
        <div className="ini-col">{antes.filter(x => x && x.el).map(x => <React.Fragment key={x.id}>{x.el}</React.Fragment>)}{esq.map(x => <React.Fragment key={x.id}>{x.el}</React.Fragment>)}</div>
        <div className="ini-col">{dir.map(x => <React.Fragment key={x.id}>{x.el}</React.Fragment>)}</div>
      </div>
      {rodape}
    </>
  );
}

/* =========================================================
   Personalizar início: ligar e desligar cada cartão e arrastar para mudar a ordem
   ========================================================= */
export function PersonalizarInicio({ modo, db, act, onClose }) {
  const escolha = useEscolha(modo);
  const ctx = useContexto(db, act, modo);
  const [arr, setArr] = useState(null); // { id, de, para, dy }
  const toque = useRef(null);
  const lista = escolha.ordem.map(id => POR_ID[id]);
  const ligados = escolha.ordem.filter(id => !escolha.escondidos.includes(id) && POR_ID[id].precisa(ctx)).length;
  const trocar = (id, ligar) => { vibrar("toque"); mudarEscolha(modo, { ...escolha, escondidos: ligar ? escolha.escondidos.filter(x => x !== id) : [...escolha.escondidos, id] }); };
  const mover = (de, para) => {
    if (de === para || para < 0 || para >= lista.length) return;
    const ordem = [...escolha.ordem]; const [x] = ordem.splice(de, 1); ordem.splice(para, 0, x);
    mudarEscolha(modo, { ...escolha, ordem });
  };
  // arrastar pela alça (dedo ou mouse): a linha segue o dedo e as outras abrem espaço
  const pegar = (e, k, id) => {
    if (e.button > 0) return;
    e.preventDefault();
    const linha = e.currentTarget.closest(".pz-linha");
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    toque.current = { y: e.clientY, de: k, h: linha ? linha.getBoundingClientRect().height + 8 : 72, para: k };
    setArr({ id, de: k, para: k, dy: 0 });
  };
  const arrastar = e => {
    const t = toque.current; if (!t) return;
    const dy = e.clientY - t.y, para = Math.max(0, Math.min(lista.length - 1, t.de + Math.round(dy / t.h)));
    if (para !== t.para) { t.para = para; vibrar("toque"); }
    setArr(a => a && { ...a, dy, para });
  };
  const soltar = () => { const t = toque.current; toque.current = null; if (!t) return; setArr(null); mover(t.de, t.para); };
  const desloca = k => {
    if (!arr || k === arr.de) return 0;
    const h = toque.current ? toque.current.h : 72;
    if (arr.de < arr.para && k > arr.de && k <= arr.para) return -h;
    if (arr.de > arr.para && k >= arr.para && k < arr.de) return h;
    return 0;
  };
  return (
    <Sheet title="Cartões do Início" sub={`${ligados === 1 ? "1 cartão ligado" : `${ligados} cartões ligados`} no Início ${modo === "consultorio" ? "do Consultório" : "do Pessoal"}. Segure a alça e arraste para mudar a ordem.`} onClose={onClose}>
      <div className={"pz-lista" + (arr ? " arrastando" : "")}>
        {lista.map((w, k) => {
          const ligado = !escolha.escondidos.includes(w.id), porque = w.precisa(ctx) ? null : w.motivo, eu = arr && arr.id === w.id;
          return (
            <div key={w.id} className={"pz-linha" + (eu ? " pega" : "") + (porque ? " fora" : "")} style={{ transform: `translateY(${eu ? arr.dy : desloca(k)}px)` }}>
              <button type="button" className="pz-alca" aria-label={`Mudar a ordem de ${w.nome} (posição ${k + 1} de ${lista.length}). Use as setas para cima e para baixo`}
                onPointerDown={e => pegar(e, k, w.id)} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} onTouchStart={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); mover(k, k + (e.key === "ArrowUp" ? -1 : 1)); } }}><Ic.alca /></button>
              <span className="pz-ic"><w.ic /></span>
              <span className="pz-t"><b>{w.nome}</b><small>{porque || w.descricao}</small></span>
              <button type="button" className="pz-sw" role="switch" aria-checked={ligado} aria-label={`${w.nome}${porque ? `. ${porque}` : ""}`} onClick={() => trocar(w.id, !ligado)}><span className={"sw" + (ligado ? " on" : "")} /></button>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn ghost" onClick={() => { vibrar("toque"); mudarEscolha(modo, copia(PADRAO[modo] || PADRAO.pessoal)); }}><I.undo /> Restaurar o padrão</button>
    </Sheet>
  );
}
