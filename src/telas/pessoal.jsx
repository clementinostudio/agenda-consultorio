// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { useCotacoes, MOEDAS, CODIGOS, emReais, fmtMoeda, fmtTaxa, IOF_CARTAO } from "../cotacoes.js";
import { DinheiroHome } from "./dinheiro.jsx";
import { buscarMarcas, palpitesDeSite, logoDoSite, marcaPorId as marcaId, normalizar } from "../marcas.js";
import { logoPropria, lerArquivo } from "../App.jsx";
import { todayISO, addDays, MES_LONGO, HelloRow, saudacao, WeatherChip, Talk, ESCONDER, I, Money, brl, AreaChart, pad, soma, TopBar, CORES, catDe, catVars, CatIcon, relativo, fromISO, MarcaLogo, acharMarca, fmtNum, interpretarFala, CAT_ENTRADA, CATEGORIAS, num, Sheet, brlReal, Seg, soNumero, Field, uid, ConfirmButton, Toggle, iniciais, itensDoDia, PERFIL, situacaoConta, diffDias, vencimento, ESTILO, liquidoDia, CalBadge, liquidoMes, tetosAlerta, Ilustra, ProximaConquista, servidorAvisos, Confirmar, vibrar } from "../App.jsx";
import { saldos as saldosCasa } from "../casa.js";

/* ---------- Logo enquanto digita: sugere as empresas parecidas (mesmo com erro de digitação),
   tenta achar o site de quem não está na lista e deixa usar uma foto como logo ---------- */
// escolha: null (automático) | { marca, nome, cat } | { site } | { nenhuma: true }
const escolhaInicial = it => !it ? null : it.semLogo ? { nenhuma: true } : it.marca ? { marca: it.marca, nome: (marcaId(it.marca) || {}).nome } : it.logoSite ? { site: it.logoSite } : null;
function escolhaEfetiva(texto, escolha) {
  if (escolha) return escolha.nenhuma ? null : escolha;
  const top = buscarMarcas(texto, 1)[0];
  return top && top.p >= 86 ? { marca: top.m.id, nome: top.m.nome, cat: top.m.cat, auto: true } : null;
}
const camposLogo = (texto, escolha) => {
  if (escolha && escolha.nenhuma) return { marca: null, logoSite: null, semLogo: true };
  const ef = escolhaEfetiva(texto, escolha);
  return { marca: ef && ef.marca ? ef.marca : null, logoSite: ef && ef.site ? ef.site : null, semLogo: false };
};
// reduz a foto para um quadrado pequeno (fica leve para guardar)
async function fotoParaLogo(file) {
  const url = await lerArquivo(file);
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  const lado = Math.min(img.naturalWidth, img.naturalHeight), T = 128;
  const c = document.createElement("canvas"); c.width = c.height = T;
  c.getContext("2d").drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, T, T);
  return c.toDataURL("image/jpeg", .85);
}
// Palpite de site: só aparece se o Google tiver um ícone de verdade para ele (o serviço novo dá erro quando não tem)
function SitePalpite({ site, ativo, onEscolher }) {
  const [ok, setOk] = useState(false);
  if (!ok) return <img className="ms-teste" src={logoDoSite(site, 1)} alt="" referrerPolicy="no-referrer" onLoad={e => { if (e.currentTarget.naturalWidth >= 16) setOk(true); }} />;
  return (
    <button type="button" className={"ms-op" + (ativo ? " on" : "")} onClick={onEscolher}>
      <MarcaLogo site={site} nome={site} className="ms-logo" /><span>{site}</span>
    </button>
  );
}
function SugestoesMarca({ texto, escolha, onEscolha, onFoto }) {
  const sug = useMemo(() => buscarMarcas(texto, 5), [texto]);
  const palpites = useMemo(() => (sug.length && sug[0].p >= 86 ? [] : palpitesDeSite(texto)), [texto, sug]);
  const ef = escolhaEfetiva(texto, escolha);
  const fotoRef = useRef(null);
  const temFoto = !!logoPropria((ef && ef.nome) || texto);
  if (normalizar(texto).length < 2) return null;
  const escolher = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try { onFoto((ef && ef.nome) || texto.trim(), await fotoParaLogo(f)); } catch (err) {}
  };
  return (
    <div className="marca-sug" aria-label="Escolha a logo">
      {sug.map(({ m }) => {
        const on = !!(ef && ef.marca === m.id);
        return (
          <button type="button" key={m.id} className={"ms-op" + (on ? " on" : "")} aria-pressed={on} onClick={() => onEscolha({ marca: m.id, nome: m.nome, cat: m.cat })}>
            <MarcaLogo marca={m.id} cat={catDe(m.cat)} className="ms-logo" /><span>{m.nome}</span>
          </button>
        );
      })}
      {palpites.map(site => <SitePalpite key={site} site={site} ativo={!!(ef && ef.site === site)} onEscolher={() => onEscolha({ site })} />)}
      <button type="button" className="ms-op ms-foto" onClick={() => fotoRef.current && fotoRef.current.click()}>
        <span className="ms-logo ms-cam" aria-hidden="true">📷</span><span>{temFoto ? "Trocar foto" : "Usar foto"}</span>
      </button>
      <input ref={fotoRef} type="file" accept="image/*" hidden onChange={escolher} />
      {(ef || (escolha && escolha.nenhuma)) && <button type="button" className={"ms-op ms-nenhuma" + (escolha && escolha.nenhuma ? " on" : "")} onClick={() => onEscolha({ nenhuma: true })}>Sem logo</button>}
    </div>
  );
}

function resumoPessoal(db, chave) {
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

// Previsão do mês: simula dia a dia até o fim do mês, a partir do saldo de hoje.
// Entra: o salário (se ainda não caiu) e as sessões marcadas (se o consultório conta como entrada).
// Sai: as contas fixas que faltam, no dia do vencimento, e o gasto do dia a dia no ritmo de agora.
function previsaoMes(db) {
  const P = db.pessoal, hoje = todayISO(), ch = hoje.slice(0, 7), diaHoje = Number(hoje.slice(8, 10));
  const ultimo = new Date(Number(ch.slice(0, 4)), Number(ch.slice(5)), 0).getDate();
  const r = resumoPessoal(db, ch);
  let saldo = r.sobra;
  // ritmo do dia a dia: o deste mês, puxado pelo do mês passado nos primeiros dias (para não oscilar)
  const pm = new Date(Number(ch.slice(0, 4)), Number(ch.slice(5)) - 2, 1), ant = `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}`;
  const varMes = soma(r.saidas, l => l.valor), varAnt = soma(P.lanc.filter(l => l.tipo === "saida" && l.data.startsWith(ant)), l => l.valor);
  const diasAnt = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
  const peso = varAnt > 0 ? 7 : 0;
  const ritmo = (varMes + (varAnt / diasAnt) * peso) / (diaHoje + peso);
  const R = P.renda && P.renda.valor > 0 && !(P.renda.lancados || {})[ch] ? P.renda : null;
  const pac = id => db.patients.find(p => p.id === id);
  const liq = p => p.price - (p.subletType === "percent" ? p.price * p.sublet / 100 : p.sublet);
  const contas = P.contas.filter(c => !(c.pagas && c.pagas[ch]));
  const atrasadas = contas.filter(c => vencimento(c, ch) < hoje);
  saldo -= soma(atrasadas, c => c.valor);
  const serie = [saldo];
  let diaNeg = saldo < 0 ? diaHoje : null, entraConsult = 0, saiContas = soma(atrasadas, c => c.valor);
  for (let d = diaHoje + 1; d <= ultimo; d++) {
    const iso = `${ch}-${pad(d)}`;
    if (R && Math.min(R.dia || 5, ultimo) === d) saldo += R.valor;
    if (P.incluirConsultorio && PERFIL.consultorio !== false) { const v = soma(itensDoDia(db, iso).filter(x => x.kind === "next" || x.kind === "proj"), x => liq(x.patient)); saldo += v; entraConsult += v; }
    contas.forEach(c => { if (vencimento(c, ch) === iso) { saldo -= c.valor; saiContas += c.valor; } });
    saldo -= ritmo;
    serie.push(saldo);
    if (saldo < 0 && diaNeg == null) diaNeg = d;
  }
  if (R && Math.min(R.dia || 5, ultimo) <= diaHoje) saldo += R.valor; // o salário de hoje ainda não lançado
  return { fim: saldo, diaNeg: saldo < 0 || diaNeg ? diaNeg : null, ritmo, renda: R ? R.valor : 0, diaRenda: R ? R.dia : null, contas: saiContas, consult: entraConsult, ultimo, diaHoje, serie };
}

function CartaoPrevisao({ db }) {
  const p = previsaoMes(db);
  if (p.diaHoje >= p.ultimo) return null;
  const min = Math.min(0, ...p.serie), max = Math.max(1, ...p.serie), W = 300, H = 60;
  const pts = p.serie.map((v, i) => `${(i / Math.max(1, p.serie.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * H}`).join(" ");
  const zero = H - ((0 - min) / (max - min || 1)) * H;
  const ruim = p.fim < 0 || p.diaNeg;
  return (
    <section className={"panel previsao" + (ruim ? " ruim" : "")}>
      <div className="panel-head"><h3>Previsão do mês</h3></div>
      <p className="previsao-t">{p.fim >= 0 && !p.diaNeg
        ? <>Nesse ritmo, <b>sobram {brl(p.fim)}</b> no dia {p.ultimo}.</>
        : p.diaNeg && p.diaNeg <= p.diaHoje ? <>O mês já está no vermelho. Nesse ritmo, <b>termina faltando {brl(-Math.min(0, p.fim))}</b>.</>
        : <>Nesse ritmo, <b>falta dinheiro a partir do dia {p.diaNeg || p.ultimo}</b>{p.fim < 0 ? <> ({brl(-p.fim)} no fim do mês)</> : null}.</>}</p>
      <svg className="previsao-g" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {min < 0 && <line x1="0" x2={W} y1={zero} y2={zero} className="zero" />}
        <polyline points={pts} />
      </svg>
      <div className="previsao-itens">
        {p.renda > 0 && <span className="mais">+{brl(p.renda)} salário (dia {p.diaRenda})</span>}
        {p.consult > 0 && <span className="mais">+{brl(p.consult)} sessões marcadas</span>}
        {p.contas > 0 && <span className="menos">−{brl(p.contas)} contas que faltam</span>}
        <span className="menos">−{brl(p.ritmo)} por dia no dia a dia</span>
      </div>
      {ruim && <div className="hint">Dá para segurar: um teto em Gastos ajuda a ver onde cortar.</div>}
    </section>
  );
}

function serieSaldo(db, ini, fim) {
  const P = db.pessoal, out = [];
  let acc = 0;
  for (let d = ini; d <= fim; d = addDays(d, 1)) {
    acc += soma(P.lanc.filter(l => l.data === d), l => l.tipo === "entrada" ? l.valor : -l.valor);
    if (P.incluirConsultorio) acc += liquidoDia(db, d);
    acc -= soma(P.contas.filter(c => c.pagas && Object.values(c.pagas).includes(d)), c => c.valor);
    out.push(acc);
  }
  return out;
}

function conversaPessoal(db, act) {
  const t = todayISO(), chave = t.slice(0, 7), P = db.pessoal;
  const falas = [];
  if (P.lanc.length === 0 && P.contas.length === 0) {
    falas.push({ txt: <>Aqui você anota o que gasta e as contas da casa. Comece por uma conta fixa, como aluguel ou luz: eu aviso antes de vencer.</>, acao: { l: "Adicionar conta", ic: <I.plus />, fn: () => act.novaConta() } });
    return falas;
  }
  P.contas.forEach(c => {
    const s = situacaoConta(c, chave);
    if (s.st === "atrasada" || s.st === "hoje" || (s.st === "breve" && diffDias(t, vencimento(c, chave)) <= 1)) {
      falas.push({ txt: s.st === "atrasada" ? <>A conta de <b>{c.nome}</b> {s.txt.toLowerCase()} e ainda não está marcada como paga.</> : <><b>{c.nome}</b> {s.txt.toLowerCase()}: {brl(c.valor)}.</>, acao: { l: "Já paguei", ic: <I.check />, fn: () => act.pagarConta(c.id) } });
    }
  });
  const tet = tetosAlerta(db, chave)[0];
  if (tet) falas.push({ txt: tet.pct >= 1 ? <>Você passou do teto de <b>{catDe(tet.cat).nome}</b>: {brl(tet.gasto)} de {brl(tet.teto)} no mês.</> : <><b>{catDe(tet.cat).nome}</b> já está em {Math.round(tet.pct * 100)}% do teto do mês ({brl(tet.gasto)} de {brl(tet.teto)}).</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const pv = previsaoMes(db);
  if (pv.diaHoje < pv.ultimo && (pv.fim < 0 || pv.diaNeg)) falas.unshift({ txt: pv.diaNeg && pv.diaNeg <= pv.diaHoje ? <>Atenção: o mês já está no vermelho e, nesse ritmo, <b>termina faltando {brl(-Math.min(0, pv.fim))}</b>. Vale segurar os gastos do dia a dia.</> : <>Atenção: nesse ritmo, <b>falta dinheiro a partir do dia {pv.diaNeg || pv.ultimo}</b>. Vale segurar os gastos do dia a dia.</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const r = resumoPessoal(db, chave);
  falas.push({ txt: <>Neste mês entrou <b>{brl(r.entrou)}</b>{r.consult > 0 ? <> (sendo {brl(r.consult)} do consultório)</> : null} e saiu <b>{brl(r.saiu)}</b>. {r.sobra >= 0 ? <>Sobram {brl(r.sobra)}.</> : <>Está {brl(-r.sobra)} no vermelho.</>}</> });
  const top = Object.entries(r.porCat).sort((a, b) => b[1] - a[1])[0];
  if (top) falas.push({ txt: <>O que mais pesou até agora foi <b>{catDe(top[0]).nome}</b>: {brl(top[1])}.</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const ass = P.contas.filter(c => c.assinatura);
  if (ass.length) falas.push({ txt: <>Suas {ass.length} assinaturas somam {brl(soma(ass, c => c.valor))} por mês, ou {brl(soma(ass, c => c.valor) * 12)} por ano.</>, acao: { l: "Ver assinaturas", ic: <I.bill />, fn: () => act.setTab("p-contas") } });
  return falas.slice(0, ESTILO === "curto" ? 2 : 4);
}

// sel: modo de seleção ligado; segurar o dedo num lançamento também liga a seleção (como nos apps do celular)
function LancRow({ l, act, sel, marcado, onMarcar, onSegurar }) {
  const cat = catDe(l.cat);
  const tempo = useRef(0), segurou = useRef(false);
  const apertou = () => { if (!onSegurar) return; segurou.current = false; clearTimeout(tempo.current); tempo.current = setTimeout(() => { segurou.current = true; onSegurar(l.id); }, 450); };
  const soltou = () => clearTimeout(tempo.current);
  const tocou = () => { if (segurou.current) { segurou.current = false; return; } if (sel) onMarcar(l.id); else act.editLanc(l.id); };
  return (
    <button className={"txn" + (sel ? " sel" : "") + (marcado ? " marcado" : "")} onClick={tocou} onPointerDown={apertou} onPointerUp={soltou} onPointerLeave={soltou} onPointerCancel={soltou}
      onContextMenu={e => { if (onSegurar) e.preventDefault(); }} aria-pressed={sel ? !!marcado : undefined}>
      {sel && <span className={"sel-box" + (marcado ? " on" : "")} aria-hidden="true">{marcado && <I.check />}</span>}
      <MarcaLogo key={(l.marca || l.logoSite || l.cat) + (l.desc || "")} marca={l.semLogo ? null : l.marca || (acharMarca(l.desc || "") || {}).id} site={l.semLogo ? null : l.logoSite} nome={l.desc} cat={cat} className="txn-av" />
      <span className="mid"><span className="nm">{l.desc || cat.nome}</span><span className="sb">{cat.nome}{l.moeda ? ` · ${ESCONDER ? "•••" : fmtMoeda(l.valorOrig, l.moeda)}` : ""} · {relativo(l.data).toLowerCase()}</span></span>
      <span className={"amt" + (l.tipo === "entrada" ? " pos" : "")}>{l.tipo === "entrada" ? "+" : "−"}<Money v={l.valor} /></span>
    </button>
  );
}

function BillRow({ c, chave, act }) {
  const s = situacaoConta(c, chave), cat = catDe(c.cat);
  const mid = c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id;
  const temLogo = !c.semLogo && !!(mid || c.logoSite || logoPropria(c.nome));
  const chip = s.st === "paga" ? "mint" : s.st === "atrasada" ? "rose" : s.st === "hoje" || s.st === "breve" ? "amber" : "ghost";
  return (
    <div className="txn">
      {temLogo ? <span className="bill-logo"><MarcaLogo marca={mid} site={c.logoSite} nome={c.nome} cat={cat} className="txn-av" /><i className="bill-dia" aria-hidden="true">{Number(vencimento(c, chave).slice(8))}</i></span> : <CalBadge iso={vencimento(c, chave)} />}
      <button className="mid" style={{ textAlign: "left" }} onClick={() => act.editConta(c.id)}>
        <span className="nm">{c.nome}</span>
        <span className="sb"><span className={"chip " + chip}>{s.txt}</span><span>{cat.nome}</span></span>
      </button>
      <span className="amt"><Money v={c.valor} /></span>
      <button className={"box " + (s.st === "paga" ? "done" : s.st === "atrasada" || s.st === "hoje" ? "late" : "up")} onClick={() => s.st === "paga" ? act.despagarConta(c.id) : act.pagarConta(c.id)} aria-label={s.st === "paga" ? `Desmarcar ${c.nome}` : `Marcar ${c.nome} como paga`}>
        {s.st === "paga" && <I.check />}
      </button>
    </div>
  );
}

function PessoalHome({ db, conta, now, act, tema }) {
  const t = todayISO(), chave = t.slice(0, 7);
  const [rng, setRng] = useState("mes");
  const r = resumoPessoal(db, chave);
  const falas = conversaPessoal(db, act);
  const ini = rng === "7" ? addDays(t, -6) : rng === "30" ? addDays(t, -29) : `${chave}-01`;
  const serie = serieSaldo(db, ini, t);
  const saldo = serie.length ? serie[serie.length - 1] : 0;
  const proximas = db.pessoal.contas.filter(c => !(c.pagas && c.pagas[chave])).sort((a, b) => a.dia - b.dia).slice(0, 4);
  const ultimos = [...db.pessoal.lanc].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  const d = new Date();
  const rotulo = rng === "mes" ? `Sobra de ${MES_LONGO[d.getMonth()]}` : `Saldo dos últimos ${rng} dias`;
  return (
    <div className="page">
      <HelloRow conta={conta} act={act} tema={tema} modo="pessoal" />
      <h1 className="hello-t">{saudacao(now)}, <b>{conta.nome}</b>.<br />Vamos ver como está a casa?</h1>
      <WeatherChip cidade={conta.perfil && conta.perfil.cidade} act={act} />
      <div className="cols">
        <div className="col">
          <Talk falas={falas} />
          <ProximaConquista act={act} trilhas={["dinheiro", "app"]} />
          <CasaCartao casa={act.casa} onAbrir={act.abrirCasa} />
          {servidorAvisos() && <div className="small-acts"><button className="chip-btn" onClick={act.abrirChat}><I.chat />Perguntar à Bolinha</button></div>}
          <section className="bal">
            <div className="bal-top">
              <span className="lab">{rotulo} <button className="eye" onClick={act.toggleOculto} aria-label={ESCONDER ? "Mostrar valores" : "Esconder valores"}>{ESCONDER ? <I.eyeOff /> : <I.eye />}</button></span>
            </div>
            <div className={"bal-amt" + (saldo < 0 ? " neg" : "")}><Money v={saldo} /></div>
            <div className="bal-sub"><span className="up">+{brl(r.entrou)}</span><span className="trend dn">−{brl(r.saiu)}</span><span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 13 }}>no mês</span></div>
            <AreaChart serie={serie} />
            <div className="ranges" role="tablist">
              {[["7", "7 dias"], ["30", "30 dias"], ["mes", "Mês"]].map(([v, l]) => <button key={v} role="tab" aria-selected={rng === v} className={"rg" + (rng === v ? " on" : "")} onClick={() => setRng(v)}>{l}</button>)}
            </div>
          </section>
          <CartaoPrevisao db={db} />
          <div className="tiles">
            <div className="tile"><I.down /><div><span>Entrou</span><b style={{ color: "var(--mint)" }}><Money v={r.entrou} /></b></div></div>
            <div className="tile"><I.up /><div><span>Saiu</span><b><Money v={r.saiu} /></b></div></div>
            <button className="tile" onClick={() => act.setTab("p-contas")}><I.bill /><div><span>A pagar</span><b style={{ color: r.aPagar ? "var(--amber)" : undefined }}><Money v={r.aPagar} /></b></div></button>
          </div>
          <div className="acts narrow-only">
            <button className="act" onClick={act.falarGasto}><i><I.mic /></i>Falar</button>
            <button className="act" onClick={() => act.novoLanc("saida")}><i><I.minus /></i>Gasto</button>
            <button className="act" onClick={() => act.novoLanc("entrada")}><i><I.plus /></i>Entrada</button>
            <button className="act" onClick={() => act.novaConta()}><i><I.bill /></i>Conta fixa</button>
          </div>
          <DinheiroHome db={db} act={act} />
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-head"><h3>Próximas contas</h3><button className="link" onClick={() => act.setTab("p-contas")}>Ver todas</button></div>
            {proximas.length === 0 ? <div className="empty com-ilustra"><Ilustra n="cafe" /><b>Nada para pagar</b>Todas as contas do mês estão pagas.</div> : proximas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Últimos lançamentos</h3><button className="link" onClick={() => act.setTab("p-gastos")}>Ver tudo</button></div>
            {ultimos.length === 0 ? <div className="empty">Nada anotado ainda. Toque em + para o primeiro gasto.</div> : ultimos.map(l => <LancRow key={l.id} l={l} act={act} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Para onde foi o dinheiro: compara com o mês anterior (no mês corrente, só até o mesmo dia, para ser justo)
function ParaOndeFoi({ db, chave, act }) {
  const hoje = todayISO(), corrente = chave === hoje.slice(0, 7);
  const [a, m] = chave.split("-").map(Number), pd = new Date(a, m - 2, 1);
  const ant = `${pd.getFullYear()}-${pad(pd.getMonth() + 1)}`;
  const dia = corrente ? Number(hoje.slice(8, 10)) : 31;
  const ate = iso => typeof iso !== "string" || Number(iso.slice(8, 10)) <= dia;
  const porCat = ch => {
    const out = {};
    db.pessoal.lanc.forEach(l => { if (l.tipo === "saida" && l.data.startsWith(ch) && ate(l.data)) out[l.cat] = (out[l.cat] || 0) + l.valor; });
    db.pessoal.contas.forEach(c => { const pg = c.pagas && c.pagas[ch]; if (pg && ate(pg)) out[c.cat] = (out[c.cat] || 0) + c.valor; });
    return out;
  };
  const agora = porCat(chave), antes = porCat(ant);
  const tA = Object.values(agora).reduce((s, v) => s + v, 0), tB = Object.values(antes).reduce((s, v) => s + v, 0);
  if (tB < 1 || tA < 1) return null;
  const difs = [...new Set([...Object.keys(agora), ...Object.keys(antes)])].map(id => ({ id, a: agora[id] || 0, b: antes[id] || 0, d: (agora[id] || 0) - (antes[id] || 0) }));
  const subiu = difs.filter(x => x.d >= 20 && x.d >= x.b * .15).sort((x, y) => y.d - x.d).slice(0, 3);
  const caiu = difs.filter(x => x.d <= -20).sort((x, y) => x.d - y.d)[0];
  const delta = tA - tB, pct = Math.round(delta / tB * 100);
  const nomeAnt = MES_LONGO[pd.getMonth()];
  return (
    <section className="panel pof">
      <Ilustra n="carrinho" className="pof-ilu" />
      <div className="panel-head"><h3>Para onde foi o dinheiro</h3></div>
      <p className={"pof-resumo " + (delta > 0 ? "mais" : "menos")}>
        {Math.abs(delta) < 10 ? <>Quase igual a {nomeAnt}{corrente ? ` até o dia ${dia}` : ""}.</>
          : <><b>{brl(Math.abs(delta))} {delta > 0 ? "a mais" : "a menos"}</b> que em {nomeAnt}{corrente ? ` até o dia ${dia}` : ""} ({delta > 0 ? "+" : "−"}{Math.abs(pct)}%).</>}
      </p>
      {subiu.map(x => { const cat = catDe(x.id); return (
        <button key={x.id} className="pof-linha" style={catVars(cat)} onClick={() => x.id === "transporte" ? act.abrirTransporte() : act.abrirTeto(x.id)}>
          <span className="ci"><CatIcon cat={cat} /></span>
          <span className="mid"><b>{cat.nome}</b><small>{x.b > 0 ? `de ${brl(x.b)} para ${brl(x.a)}` : `${brl(x.a)}, nada em ${nomeAnt}`}</small></span>
          <b className="pof-up">+{brl(x.d)}</b>
        </button>
      ); })}
      {caiu && <div className="pof-caiu"><I.check /><span>Economizou <b>{brl(-caiu.d)}</b> em {catDe(caiu.id).nome.toLowerCase()}.</span></div>}
      {!subiu.length && !caiu && <div className="hint">Nenhuma categoria mudou muito. Ritmo parecido com {nomeAnt}.</div>}
    </section>
  );
}

function GastosTab({ db, act, tema }) {
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState("tudo");
  const base = new Date();
  const m = new Date(base.getFullYear(), base.getMonth() + off, 1);
  const chave = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
  const r = resumoPessoal(db, chave);
  const tetos = db.pessoal.limites || {};
  // categorias com gasto no mês + as que têm teto (mesmo sem gasto ainda)
  const cats = [...Object.entries(r.porCat), ...Object.keys(tetos).filter(id => tetos[id] > 0 && !r.porCat[id]).map(id => [id, 0])].sort((a, b) => b[1] - a[1]);
  const totalCat = soma(cats, c => c[1]) || 1;
  const maior = Math.max(...cats.map(c => c[1]), 1);
  let lista = db.pessoal.lanc.filter(l => l.data.startsWith(chave));
  if (filtro === "saida") lista = lista.filter(l => l.tipo === "saida");
  if (filtro === "entrada") lista = lista.filter(l => l.tipo === "entrada");
  lista.sort((a, b) => b.data.localeCompare(a.data));
  const grupos = []; lista.forEach(l => { const g = grupos[grupos.length - 1]; if (g && g.d === l.data) g.itens.push(l); else grupos.push({ d: l.data, itens: [l] }); });
  // Seleção para apagar vários de uma vez
  const [sel, setSel] = useState(null); // null = modo normal; Set de ids = selecionando
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { setSel(null); }, [off, filtro]);
  const marcar = id => setSel(s => { const n = new Set(s || []); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const segurar = id => { vibrar("toque"); setSel(s => new Set([...(s || []), id])); };
  const todos = sel && lista.length > 0 && lista.every(l => sel.has(l.id));
  const nav = <>
    <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
    <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Próximo mês"><I.chev /></button>
  </>;
  return (
    <div className="page">
      <TopBar eyebrow={`${MES_LONGO[m.getMonth()]} de ${m.getFullYear()}`} title="Gastos" act={act} tema={tema} extra={nav} />
      <div className="cols">
        <div className="col">
          <section className="bal">
            <div className="bal-top"><span className="lab">Saiu no mês</span><span className="trend">{r.sobra >= 0 ? `Sobra ${brl(r.sobra)}` : `Faltam ${brl(-r.sobra)}`}</span></div>
            <div className="bal-amt"><Money v={r.saiu} /></div>
            {cats.length > 0 && <div className="catbar" aria-hidden="true">{cats.filter(c => c[1] > 0).map(([id, v]) => <i key={id} style={{ width: `${v / totalCat * 100}%`, background: (CORES.find(c => c.id === catDe(id).cor) || CORES[0]).cor }} />)}</div>}
            {cats.length === 0 ? <div className="empty">Nenhum gasto neste mês.</div> : cats.map(([id, v]) => {
              const cat = catDe(id), teto = tetos[id] > 0 ? tetos[id] : 0, pct = teto ? v / teto : 0;
              return (
                <button className={"catrow" + (teto ? pct >= 1 ? " estourou" : pct >= .8 ? " perto" : " com-teto" : "")} key={id} style={catVars(cat)} onClick={() => id === "transporte" ? act.abrirTransporte() : act.abrirTeto(id)} aria-label={id === "transporte" ? "Abrir Meu transporte" : `${cat.nome}: ${teto ? "mudar teto" : "definir teto"}`}>
                  <span className="ci"><CatIcon cat={cat} /></span>
                  <div style={{ minWidth: 0 }}><b>{cat.nome}{teto ? <small className="teto-txt">{pct >= 1 ? ` · passou ${brl(v - teto)}` : ` · ${Math.round(pct * 100)}% do teto`}</small> : null}</b><div className="bar"><i style={{ width: `${teto ? Math.min(100, pct * 100) : v / maior * 100}%` }} /></div></div>
                  <span className="v"><Money v={v} />{teto ? <small className="teto-de">de {brl(teto)}</small> : null}</span>
                </button>
              );
            })}
            <button className="link teto-link" onClick={() => act.abrirTeto()}><I.gauge /> {Object.values(tetos).some(v => v > 0) ? "Mudar tetos do mês" : "Definir um teto por categoria"}</button>
          </section>
          <ParaOndeFoi db={db} chave={chave} act={act} />
        </div>
        <div className="col">
          <div className="panel">
            {sel ? (
              <div className="panel-head sel-head">
                <h3>{sel.size ? `${sel.size} ${sel.size === 1 ? "selecionado" : "selecionados"}` : "Toque para selecionar"}</h3>
                <span className="panel-acts">
                  <button className="link" onClick={() => setSel(todos ? new Set() : new Set(lista.map(l => l.id)))}>{todos ? "Desmarcar tudo" : "Selecionar tudo"}</button>
                  <button className="link" onClick={() => setSel(null)}>Cancelar</button>
                </span>
              </div>
            ) : (
              <div className="panel-head"><h3>Lançamentos</h3><span className="panel-acts">
                {lista.length > 0 && <button className="link" onClick={() => setSel(new Set())}><I.check /> Selecionar</button>}
                <button className="link" onClick={act.importar}><I.upload /> Importar</button>
                <button className="link" onClick={() => act.novoLanc("saida")}>+ Novo</button>
              </span></div>
            )}
            <div className="chips" role="tablist">
              {[["tudo", "Tudo"], ["saida", "Gastos"], ["entrada", "Entradas"]].map(([v, l]) => <button key={v} role="tab" aria-selected={filtro === v} className={"fchip" + (filtro === v ? " on" : "")} onClick={() => setFiltro(v)}>{l}</button>)}
            </div>
            {r.consult > 0 && filtro !== "saida" && (
              <div className="txn">
                <span className="txn-av cat" style={catVars({ cor: "azul" })}><I.logo /></span>
                <span className="mid"><span className="nm">Consultório</span><span className="sb">Líquido das sessões do mês</span></span>
                <span className="amt pos">+<Money v={r.consult} /></span>
              </div>
            )}
            {grupos.length === 0 && !(r.consult > 0 && filtro !== "saida") && <div className="empty com-ilustra"><Ilustra n="arquivo" /><b>Nada por aqui neste mês</b>Anote falando ou traga tudo do banco de uma vez.<button className="ghost-chip" onClick={act.importar}><I.upload /> Importar extrato</button></div>}
            {grupos.map(g => (
              <React.Fragment key={g.d}>
                <div className="day-sep">{relativo(g.d)}</div>
                {g.itens.map(l => <LancRow key={l.id} l={l} act={act} sel={!!sel} marcado={!!sel && sel.has(l.id)} onMarcar={marcar} onSegurar={segurar} />)}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      {sel && (
        <div className="sel-barra" role="toolbar" aria-label="Ações da seleção">
          <span>{sel.size ? `${sel.size} ${sel.size === 1 ? "lançamento" : "lançamentos"} · ${brl(soma(lista.filter(l => sel.has(l.id)), l => l.valor))}` : "Nada selecionado"}</span>
          <button className="sel-apagar" disabled={!sel.size} onClick={() => setConfirmar(true)}><I.trash /> Apagar</button>
        </div>
      )}
      {confirmar && sel && <Confirmar titulo={`Apagar ${sel.size} ${sel.size === 1 ? "lançamento" : "lançamentos"}?`} texto="Eles saem do extrato e dos totais do mês. Logo depois aparece a opção de desfazer." acao="Apagar" icon={<I.trash />}
        onSim={() => { act.apagarLancs([...sel]); setSel(null); }} onFim={() => setConfirmar(false)} />}
    </div>
  );
}

function ContasTab({ db, act, tema }) {
  const t = todayISO(), chave = t.slice(0, 7);
  const contas = [...db.pessoal.contas].sort((a, b) => a.dia - b.dia);
  const abertas = contas.filter(c => !(c.pagas && c.pagas[chave]));
  const pagas = contas.filter(c => c.pagas && c.pagas[chave]);
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <TopBar eyebrow={`${MES_LONGO[fromISO(t).getMonth()]} · ${pagas.length} de ${contas.length} pagas`} title="Contas fixas" act={act} tema={tema}
        extra={<><button className="icon-btn" onClick={act.lerBoleto} aria-label="Ler boleto"><I.scan /></button><button className="icon-btn" onClick={() => act.novaConta()} aria-label="Nova conta"><I.plus /></button></>} />
      <div className="stack">
        <section className="bal">
          <div className="bal-top"><span className="lab">Falta pagar este mês</span></div>
          <div className="bal-amt" style={{ marginBottom: 2 }}><Money v={soma(abertas, c => c.valor)} /></div>
          <div className="hint" style={{ padding: 0 }}>Já pago: {brl(soma(pagas, c => c.valor))}. Eu aviso no Início um dia antes de cada vencimento.</div>
        </section>
        <div className="panel">
          <div className="panel-head"><h3>A pagar</h3></div>
          {abertas.length === 0 ? <div className="empty com-ilustra"><Ilustra n="cafe" /><b>Tudo pago</b>Nenhuma conta pendente neste mês.</div> : abertas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
        </div>
        {pagas.length > 0 && <div className="panel"><div className="panel-head"><h3>Pagas</h3></div>{pagas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}</div>}
        {contas.some(c => c.assinatura) && (
          <div className="panel">
            <div className="panel-head"><h3>Assinaturas</h3><span className="hint" style={{ padding: 0 }}>{brl(soma(contas.filter(c => c.assinatura), c => c.valor))}/mês · {brl(soma(contas.filter(c => c.assinatura), c => c.valor) * 12)}/ano</span></div>
            {contas.filter(c => c.assinatura).map(c => (
              <button key={c.id} className="txn" onClick={() => act.editConta(c.id)}>
                <MarcaLogo marca={c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id} site={c.semLogo ? null : c.logoSite} nome={c.nome} cat={catDe(c.cat)} className="txn-av" />
                <span className="mid"><span className="nm">{c.nome}</span><span className="sb">{c.moeda ? `${ESCONDER ? "•••" : fmtMoeda(c.valorOrig, c.moeda)}${c.iof !== false ? " + IOF" : ""} · ` : ""}Todo dia {c.dia} · {brl(c.valor * 12)} por ano</span></span>
                <span className="amt"><Money v={c.valor} /></span>
              </button>
            ))}
            <p className="hint" style={{ padding: "4px 0 12px" }}>Ainda usa todas? Cancelar uma que você esqueceu é dinheiro de volta todo mês.</p>
          </div>
        )}
        {contas.length === 0 && <button className="btn mode" onClick={() => act.novaConta()}><I.plus /> Adicionar primeira conta</button>}
      </div>
    </div>
  );
}

// campos que outras telas guardam no lançamento (transporte, extrato, voz): editar aqui não pode apagar
const extrasDe = l => { if (!l) return {}; const o = {}; ["sub", "litros", "precoLitro", "combustivel", "km", "manut", "importId", "via"].forEach(k => { if (l[k] !== undefined) o[k] = l[k]; }); return o; };
// Início pessoal: a casa compartilhada (ou o convite para criar uma)
function CasaCartao({ casa, onAbrir }) {
  if (!casa || ["carregando", "indisponivel", "erro"].includes(casa.estado) && !casa.casa) return null;
  if (!casa.casa) return (
    <button className="casa-cartao vazio" onClick={onAbrir}>
      <span className="casa-cartao-ic"><I.users /></span>
      <span className="tx"><b>Divide as contas com alguém?</b><small>Dinheiro a dois ou em família: quem pagou o quê e quem deve quanto.</small></span>
      <I.chev />
    </button>
  );
  const { dividas } = saldosCasa(casa.lanc, casa.acertos, casa.membros);
  const minha = dividas.find(d => d.de === casa.eu || d.para === casa.eu);
  const nome = id => ((casa.membros.find(m => m.id === id) || {}).nome || "Alguém");
  const ch = todayISO().slice(0, 7), mes = casa.lanc.filter(l => (l.data || "").startsWith(ch)).reduce((s, l) => s + l.valor, 0);
  return (
    <button className="casa-cartao" onClick={onAbrir}>
      <span className="casa-cartao-av">{casa.membros.slice(0, 3).map(m => <i key={m.id}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</i>)}</span>
      <span className="tx"><b>{casa.casa.nome}</b><small>{casa.membros.length < 2 ? "Convide quem divide as contas com você" : minha ? (minha.de === casa.eu ? `Você deve ${brl(minha.valor)} para ${nome(minha.para)}` : `${nome(minha.de)} te deve ${brl(minha.valor)}`) : `Tudo acertado · ${brl(mes)} da casa este mês`}</small></span>
      <I.chev />
    </button>
  );
}

function LancSheet({ inicial, pre, tipo: tipo0, viagem, casa, onVoz, onFoto, onSave, onDelete, onClose, onLogo }) {
  const [dividir, setDividir] = useState(false);
  const fotoRef = useRef(null);
  const cot = useCotacoes();
  const [tipo, setTipo] = useState(inicial ? inicial.tipo : pre ? pre.tipo : tipo0);
  const orig = inicial || pre || null;
  const [moeda, setMoeda] = useState(orig && orig.moeda ? orig.moeda : !inicial && viagem ? viagem.moeda : "BRL");
  const [iof, setIof] = useState(orig && orig.moeda ? orig.iof !== false : viagem ? viagem.iof !== false : true);
  const [valor, setValor] = useState(orig && orig.moeda && orig.valorOrig ? fmtNum(orig.valorOrig) : inicial ? fmtNum(inicial.valor) : pre && pre.valor ? fmtNum(pre.valor) : "");
  const [cat, setCat] = useState(inicial ? inicial.cat : pre ? pre.cat : null);
  const [desc, setDesc] = useState(inicial ? inicial.desc : pre ? pre.desc : "");
  const [escolha, setEscolha] = useState(() => escolhaInicial(inicial));
  const efDesc = escolhaEfetiva(desc, escolha);
  useEffect(() => { if (!cat && tipo === "saida" && efDesc && efDesc.cat && CATEGORIAS.some(c => c.id === efDesc.cat)) setCat(efDesc.cat); }, [efDesc && efDesc.cat]);
  const [data, setData] = useState(inicial ? inicial.data : pre ? pre.data || addDays(todayISO(), -(pre.off || 0)) : todayISO());
  const [frase, setFrase] = useState("");
  const [entendi, setEntendi] = useState(null);
  const aplicar = txt => {
    setFrase(txt);
    if (!txt.trim()) { setEntendi(null); return; }
    const r = interpretarFala(txt);
    setTipo(r.tipo); setCat(r.cat); setData(addDays(todayISO(), -r.off));
    if (r.moeda) { setMoeda(r.moeda); setIof(!!r.iof || r.tipo === "entrada"); if (r.valorOrig) setValor(fmtNum(r.valorOrig)); }
    else { if (!viagem) setMoeda("BRL"); if (r.valor) setValor(fmtNum(r.valor)); }
    if (r.desc) { setDesc(r.desc); setEscolha(null); }
    setEntendi(r);
  };
  const lista = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
  const v = num(valor);
  const fora = moeda !== "BRL";
  // edição de um gasto antigo: mantém a cotação do dia em que ele foi feito
  const cotUsada = fora ? (inicial && inicial.moeda === moeda && inicial.cotacao ? inicial.cotacao : cot.moedas[moeda]) : 1;
  const iofOn = fora && iof && tipo === "saida";
  const emR = fora ? emReais(v, moeda, iofOn, cotUsada) : v;
  const simb = fora ? fmtMoeda(0, moeda).replace(/[\d\s.,]/g, "") : "R$";
  const ok = v > 0 && cat && lista.some(c => c.id === cat);
  return (
    <Sheet title={inicial ? "Editar lançamento" : tipo === "entrada" ? "Nova entrada" : "Novo gasto"} onClose={onClose}>
      {!inicial && <>
        <div className="voice">
          <input id="l-frase" value={frase} onChange={e => aplicar(e.target.value)} placeholder='Fale ou escreva: "gastei 32 na padaria"' enterKeyHint="done" autoComplete="off" aria-label="Descreva o gasto em uma frase" />
          {onFoto && <button type="button" className="mic foto" onClick={() => fotoRef.current && fotoRef.current.click()} aria-label="Foto do comprovante"><I.camera /></button>}
          <button type="button" className="mic" onClick={onVoz} aria-label="Falar"><I.mic /></button>
          {onFoto && <input ref={fotoRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onFoto(f); }} />}
        </div>
        {pre && pre.daFoto && <div className="voice-ok"><I.check /><span>Li a foto: {pre.tipo === "entrada" ? "entrada" : "gasto"} de {brlReal(pre.valor)}{pre.desc ? ` em ${pre.desc}` : ""}. Confira e salve.</span></div>}
        {entendi && entendi.valor > 0 && <div className="voice-ok"><I.check /><span>Entendi: {entendi.tipo === "entrada" ? "entrada" : "gasto"} de {entendi.moeda ? `${fmtMoeda(entendi.valorOrig, entendi.moeda)} (${brlReal(entendi.valor)})` : brlReal(entendi.valor)} em {catDe(entendi.cat).nome}{entendi.off ? (entendi.off === 1 ? ", ontem" : ", anteontem") : ", hoje"}. Confira e salve.</span></div>}
      </>}
      <Seg big value={tipo} onChange={x => { setTipo(x); setCat(null); }} options={[{ v: "saida", l: "Gasto" }, { v: "entrada", l: "Entrada" }]} />
      <label className={"big-amt" + (tipo === "entrada" ? " in" : "")} htmlFor="l-valor"><span>{simb}</span>
        <input id="l-valor" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" autoFocus={!inicial} placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor" />
      </label>
      <div className="moeda-linha">
        <select className="moeda-sel" value={moeda} onChange={e => setMoeda(e.target.value)} aria-label="Moeda">
          <option value="BRL">🇧🇷 Real</option>
          {CODIGOS.map(c => <option key={c} value={c}>{MOEDAS[c].bandeira} {MOEDAS[c].nome}</option>)}
        </select>
        {fora && <span className="moeda-conv">{v > 0 ? <>≈ <b>{brlReal(emR)}</b></> : <>1 {simb} = R$ {fmtTaxa(cotUsada)}</>}</span>}
      </div>
      {fora && tipo === "saida" && <Toggle on={iof} onClick={() => setIof(!iof)}>Pago no cartão (soma IOF de {String(IOF_CARTAO).replace(".", ",")}%)</Toggle>}
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {lista.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => setCat(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label="Descrição (opcional)" icon={escolhaEfetiva(desc, escolha) || logoPropria(desc) ? <MarcaLogo marca={(escolhaEfetiva(desc, escolha) || {}).marca} site={(escolhaEfetiva(desc, escolha) || {}).site} nome={desc} cat={catDe(cat || "outros")} className="campo-logo" /> : null} htmlFor="l-desc"><input id="l-desc" value={desc} onChange={e => { setDesc(e.target.value); setEscolha(null); }} placeholder={tipo === "entrada" ? "Ex.: Freela" : "Ex.: Padaria, Carrefour, Netflix"} autoComplete="off" /></Field>
        <SugestoesMarca texto={desc} escolha={escolha} onFoto={onLogo} onEscolha={e => { setEscolha(e); if (e.nome) setDesc(e.nome); if (e.cat && tipo === "saida" && CATEGORIAS.some(c => c.id === e.cat)) setCat(e.cat); }} />
        <Field label="Quando" htmlFor="l-data"><input id="l-data" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field>
      </div>
      {casa && !inicial && tipo === "saida" && <Toggle on={dividir} onClick={() => setDividir(!dividir)}>Dividir com a casa ({casa.membros.length} pessoas{v > 0 ? `, ${brl(v / casa.membros.length)} cada` : ""})</Toggle>}
      {!ok && <div className="hint">{!(v > 0) ? "Digite o valor e escolha uma categoria." : "Escolha uma categoria."}</div>}
      <button className="btn mode" disabled={!ok} onClick={() => onSave({ ...(dividir && casa && tipo === "saida" ? { dividirCasa: true } : {}), ...extrasDe(inicial), id: inicial ? inicial.id : uid(), tipo, valor: emR, cat, desc: desc.trim(), data, ...camposLogo(desc, escolha), ...(fora ? { moeda, valorOrig: v, cotacao: cotUsada, iof: iofOn } : {}) })}><I.check /> {inicial ? "Salvar" : tipo === "entrada" ? "Anotar entrada" : "Anotar gasto"}</button>
      {inicial && <ConfirmButton label="Apagar lançamento" titulo="Apagar este lançamento?" texto="Ele sai do seu extrato e dos totais do mês." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// pre: dados vindos de um boleto lido ({ nome, valor, dia, cat, codigo })
function ContaSheet({ inicial, pre, onSave, onDelete, onClose, onLogo, onBoleto, onCopiar }) {
  const cot = useCotacoes();
  const [nome, setNome] = useState(inicial ? inicial.nome : pre && pre.nome ? pre.nome : "");
  const codigo = (inicial && inicial.codigo) || (pre && pre.codigo) || "";
  const [escolha, setEscolha] = useState(() => escolhaInicial(inicial));
  const [catTocada, setCatTocada] = useState(!!inicial);
  const efNome = escolhaEfetiva(nome, escolha);
  useEffect(() => { if (!catTocada && efNome && efNome.cat && CATEGORIAS.some(c => c.id === efNome.cat)) setCat(efNome.cat); }, [efNome && efNome.cat, catTocada]);
  const [moeda, setMoeda] = useState(inicial && inicial.moeda ? inicial.moeda : "BRL");
  const [iof, setIof] = useState(inicial ? inicial.iof !== false : true);
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.moeda && inicial.valorOrig ? inicial.valorOrig : inicial.valor) : pre && pre.valor ? fmtNum(pre.valor) : "");
  const [dia, setDia] = useState(inicial ? inicial.dia : pre && pre.dia ? pre.dia : 10);
  const [cat, setCat] = useState(inicial ? inicial.cat : pre && pre.cat ? pre.cat : "casa");
  const [assin, setAssin] = useState(inicial ? !!inicial.assinatura : false);
  const v = num(valor);
  const fora = moeda !== "BRL";
  const emR = fora ? emReais(v, moeda, iof) : v;
  const ok = nome.trim() && v > 0;
  return (
    <Sheet title={inicial ? "Editar conta" : "Nova conta fixa"} sub="Repete todo mês. Eu aviso antes de vencer." onClose={onClose}>
      {!inicial && !pre && onBoleto && <button type="button" className="btn ghost" onClick={onBoleto}><I.scan /> Ler o boleto (preenche sozinho)</button>}
      {pre && pre.codigo && <div className="voice-ok"><I.check /><span>Boleto lido. Confira o nome e salve.{pre.incerto ? " O vencimento não vem no código desta conta: confira o dia." : ""}</span></div>}
      <div className="fields">
        <Field label="Nome da conta" icon={escolhaEfetiva(nome, escolha) || logoPropria(nome) ? <MarcaLogo marca={(escolhaEfetiva(nome, escolha) || {}).marca} site={(escolhaEfetiva(nome, escolha) || {}).site} nome={nome} cat={catDe(cat)} className="campo-logo" /> : <I.bill />} htmlFor="c-nome"><input id="c-nome" value={nome} onChange={e => { setNome(e.target.value); setEscolha(null); }} placeholder="Ex.: Aluguel, Copel, Netflix" autoComplete="off" /></Field>
        <SugestoesMarca texto={nome} escolha={escolha} onFoto={onLogo} onEscolha={e => { setEscolha(e); if (e.nome) setNome(e.nome); if (e.cat && !inicial) setCat(e.cat); }} />
        <Field label={fora ? `Valor (${MOEDAS[moeda].nome.toLowerCase()})` : "Valor (R$)"} icon={<I.money />} htmlFor="c-valor"><input id="c-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" /></Field>
        <Field label="Cobrada em" htmlFor="c-moeda">
          <select id="c-moeda" className="moeda-sel no-campo" value={moeda} onChange={e => setMoeda(e.target.value)}>
            <option value="BRL">🇧🇷 Real</option>
            {CODIGOS.map(c => <option key={c} value={c}>{MOEDAS[c].bandeira} {MOEDAS[c].nome}</option>)}
          </select>
        </Field>
        <Field label="Vence todo dia">
          <div className="stepper">
            <button type="button" aria-label="Dia anterior" onClick={() => setDia(Math.max(1, dia - 1))}>−</button>
            <b className="num">{dia}</b>
            <button type="button" aria-label="Próximo dia" onClick={() => setDia(Math.min(31, dia + 1))}>+</button>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>do mês</span>
          </div>
        </Field>
      </div>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {CATEGORIAS.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => { setCat(c.id); setCatTocada(true); }}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <Toggle on={assin} onClick={() => setAssin(!assin)}>É uma assinatura (streaming, app, academia)</Toggle>
      {codigo && <div className="boleto-cod"><span><small>Código do boleto</small><b>{codigo}</b></span>{onCopiar && <button type="button" className="pill-btn" onClick={() => onCopiar(codigo)}><I.copy /> Copiar</button>}</div>}
      {fora && <Toggle on={iof} onClick={() => setIof(!iof)}>Cobrada no cartão (soma IOF de {String(IOF_CARTAO).replace(".", ",")}%)</Toggle>}
      {fora && v > 0 && <div className="moeda-aviso">Hoje sai por <b>{brlReal(emR)}</b> por mês ({brlReal(emR * 12)} por ano). Eu atualizo esse valor com a cotação do dia.</div>}
      <button className="btn mode" disabled={!ok} onClick={() => { const { moeda: _m, valorOrig: _vo, iof: _i, ...base } = inicial || { pagas: {} }; onSave({ ...base, id: inicial ? inicial.id : uid(), nome: nome.trim(), valor: emR, dia, cat, assinatura: assin, ...camposLogo(nome, escolha), ...(fora ? { moeda, valorOrig: v, iof } : {}), ...(codigo ? { codigo } : {}) }); }}><I.check /> {inicial ? "Salvar" : "Adicionar conta"}</button>
      {inicial && <ConfirmButton label="Apagar conta" titulo="Apagar esta conta fixa?" texto="Ela para de aparecer nos próximos meses e nos lembretes." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// Teto do mês por categoria: avisa em 80% e quando passa
function TetoSheet({ db, cat: cat0, act, onClose }) {
  const lim = db.pessoal.limites || {}, chave = todayISO().slice(0, 7);
  const [cat, setCat] = useState(cat0 && CATEGORIAS.some(c => c.id === cat0) ? cat0 : (CATEGORIAS.find(c => lim[c.id] > 0) || CATEGORIAS[0]).id);
  const [valor, setValor] = useState(lim[cat] ? fmtNum(lim[cat]) : "");
  const escolher = id => { setCat(id); setValor(lim[id] ? fmtNum(lim[id]) : ""); };
  const gasto = resumoPessoal(db, chave).porCat[cat] || 0;
  // sugestão: a média dos 3 meses anteriores
  let media = 0; for (let i = 1; i <= 3; i++) { const d = new Date(); d.setMonth(d.getMonth() - i, 1); media += (resumoPessoal(db, `${d.getFullYear()}-${pad(d.getMonth() + 1)}`).porCat[cat] || 0) / 3; }
  const v = num(valor);
  return (
    <Sheet title="Teto do mês" sub="Eu aviso quando chegar em 80% e se passar." onClose={onClose}>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {CATEGORIAS.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => escolher(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}{lim[c.id] > 0 ? " •" : ""}
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label={`Teto para ${catDe(cat).nome} (R$ por mês)`} icon={<I.gauge />} htmlFor="t-valor"><input id="t-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder={media > 0 ? fmtNum(Math.ceil(media / 10) * 10) : "0,00"} /></Field>
      </div>
      <div className="hint">Neste mês: {brl(gasto)}{media > 0 ? `. Média dos últimos 3 meses: ${brl(media)}.` : "."}{v > 0 ? ` Sobra ${brl(Math.max(0, v - gasto))} até o fim do mês.` : ""}</div>
      <button className="btn mode" disabled={!(v > 0)} onClick={() => act.salvarTeto(cat, v)}><I.check /> Salvar teto</button>
      {lim[cat] > 0 && <button className="btn text" onClick={() => act.salvarTeto(cat, 0)}>Tirar o teto de {catDe(cat).nome}</button>}
    </Sheet>
  );
}

export { PessoalHome, GastosTab, ContasTab, LancSheet, ContaSheet, TetoSheet };
