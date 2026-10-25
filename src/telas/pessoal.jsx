// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { todayISO, addDays, MES_LONGO, HelloRow, saudacao, WeatherChip, Talk, ESCONDER, I, Money, brl, AreaChart, pad, soma, TopBar, CORES, catDe, catVars, CatIcon, relativo, fromISO, MarcaLogo, acharMarca, fmtNum, interpretarFala, CAT_ENTRADA, CATEGORIAS, num, Sheet, brlReal, Seg, soNumero, Field, uid, ConfirmButton, Toggle, situacaoConta, diffDias, vencimento, ESTILO, liquidoDia, CalBadge, liquidoMes } from "../App.jsx";

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
  const r = resumoPessoal(db, chave);
  falas.push({ txt: <>Neste mês entrou <b>{brl(r.entrou)}</b>{r.consult > 0 ? <> (sendo {brl(r.consult)} do consultório)</> : null} e saiu <b>{brl(r.saiu)}</b>. {r.sobra >= 0 ? <>Sobram {brl(r.sobra)}.</> : <>Está {brl(-r.sobra)} no vermelho.</>}</> });
  const top = Object.entries(r.porCat).sort((a, b) => b[1] - a[1])[0];
  if (top) falas.push({ txt: <>O que mais pesou até agora foi <b>{catDe(top[0]).nome}</b>: {brl(top[1])}.</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const ass = P.contas.filter(c => c.assinatura);
  if (ass.length) falas.push({ txt: <>Suas {ass.length} assinaturas somam {brl(soma(ass, c => c.valor))} por mês, ou {brl(soma(ass, c => c.valor) * 12)} por ano.</>, acao: { l: "Ver assinaturas", ic: <I.bill />, fn: () => act.setTab("p-contas") } });
  return falas.slice(0, ESTILO === "curto" ? 2 : 4);
}

function LancRow({ l, act }) {
  const cat = catDe(l.cat);
  return (
    <button className="txn" onClick={() => act.editLanc(l.id)}>
      <MarcaLogo key={l.marca || l.cat} marca={l.marca || (acharMarca(l.desc || "") || {}).id} cat={cat} className="txn-av" />
      <span className="mid"><span className="nm">{l.desc || cat.nome}</span><span className="sb">{cat.nome} · {relativo(l.data).toLowerCase()}</span></span>
      <span className={"amt" + (l.tipo === "entrada" ? " pos" : "")}>{l.tipo === "entrada" ? "+" : "−"}<Money v={l.valor} /></span>
    </button>
  );
}

function BillRow({ c, chave, act }) {
  const s = situacaoConta(c, chave), cat = catDe(c.cat);
  const chip = s.st === "paga" ? "mint" : s.st === "atrasada" ? "rose" : s.st === "hoje" || s.st === "breve" ? "amber" : "ghost";
  return (
    <div className="txn">
      <CalBadge iso={vencimento(c, chave)} />
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
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-head"><h3>Próximas contas</h3><button className="link" onClick={() => act.setTab("p-contas")}>Ver todas</button></div>
            {proximas.length === 0 ? <div className="empty"><b>Nada para pagar</b>Todas as contas do mês estão pagas.</div> : proximas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
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

function GastosTab({ db, act, tema }) {
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState("tudo");
  const base = new Date();
  const m = new Date(base.getFullYear(), base.getMonth() + off, 1);
  const chave = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
  const r = resumoPessoal(db, chave);
  const cats = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]);
  const totalCat = soma(cats, c => c[1]) || 1;
  let lista = db.pessoal.lanc.filter(l => l.data.startsWith(chave));
  if (filtro === "saida") lista = lista.filter(l => l.tipo === "saida");
  if (filtro === "entrada") lista = lista.filter(l => l.tipo === "entrada");
  lista.sort((a, b) => b.data.localeCompare(a.data));
  const grupos = []; lista.forEach(l => { const g = grupos[grupos.length - 1]; if (g && g.d === l.data) g.itens.push(l); else grupos.push({ d: l.data, itens: [l] }); });
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
            {cats.length > 0 && <div className="catbar" aria-hidden="true">{cats.map(([id, v]) => <i key={id} style={{ width: `${v / totalCat * 100}%`, background: (CORES.find(c => c.id === catDe(id).cor) || CORES[0]).cor }} />)}</div>}
            {cats.length === 0 ? <div className="empty">Nenhum gasto neste mês.</div> : cats.map(([id, v]) => {
              const cat = catDe(id);
              return (
                <div className="catrow" key={id} style={catVars(cat)}>
                  <span className="ci"><CatIcon cat={cat} /></span>
                  <div style={{ minWidth: 0 }}><b>{cat.nome}</b><div className="bar"><i style={{ width: `${v / cats[0][1] * 100}%` }} /></div></div>
                  <span className="v"><Money v={v} /></span>
                </div>
              );
            })}
          </section>
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-head"><h3>Lançamentos</h3><button className="link" onClick={() => act.novoLanc("saida")}>+ Novo</button></div>
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
            {grupos.length === 0 && !(r.consult > 0 && filtro !== "saida") && <div className="empty">Nada por aqui neste mês.</div>}
            {grupos.map(g => (
              <React.Fragment key={g.d}>
                <div className="day-sep">{relativo(g.d)}</div>
                {g.itens.map(l => <LancRow key={l.id} l={l} act={act} />)}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
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
        extra={<button className="icon-btn" onClick={() => act.novaConta()} aria-label="Nova conta"><I.plus /></button>} />
      <div className="stack">
        <section className="bal">
          <div className="bal-top"><span className="lab">Falta pagar este mês</span></div>
          <div className="bal-amt" style={{ marginBottom: 2 }}><Money v={soma(abertas, c => c.valor)} /></div>
          <div className="hint" style={{ padding: 0 }}>Já pago: {brl(soma(pagas, c => c.valor))}. Eu aviso no Início um dia antes de cada vencimento.</div>
        </section>
        <div className="panel">
          <div className="panel-head"><h3>A pagar</h3></div>
          {abertas.length === 0 ? <div className="empty"><b>Tudo pago</b>Nenhuma conta pendente neste mês.</div> : abertas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
        </div>
        {pagas.length > 0 && <div className="panel"><div className="panel-head"><h3>Pagas</h3></div>{pagas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}</div>}
        {contas.some(c => c.assinatura) && (
          <div className="panel">
            <div className="panel-head"><h3>Assinaturas</h3><span className="hint" style={{ padding: 0 }}>{brl(soma(contas.filter(c => c.assinatura), c => c.valor))}/mês · {brl(soma(contas.filter(c => c.assinatura), c => c.valor) * 12)}/ano</span></div>
            {contas.filter(c => c.assinatura).map(c => (
              <button key={c.id} className="txn" onClick={() => act.editConta(c.id)}>
                <MarcaLogo marca={(acharMarca(c.nome) || {}).id} cat={catDe(c.cat)} className="txn-av" />
                <span className="mid"><span className="nm">{c.nome}</span><span className="sb">Todo dia {c.dia} · {brl(c.valor * 12)} por ano</span></span>
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

function LancSheet({ inicial, pre, tipo: tipo0, onVoz, onSave, onDelete, onClose }) {
  const [tipo, setTipo] = useState(inicial ? inicial.tipo : pre ? pre.tipo : tipo0);
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : pre && pre.valor ? fmtNum(pre.valor) : "");
  const [cat, setCat] = useState(inicial ? inicial.cat : pre ? pre.cat : null);
  const [desc, setDesc] = useState(inicial ? inicial.desc : pre ? pre.desc : "");
  const [data, setData] = useState(inicial ? inicial.data : pre ? addDays(todayISO(), -(pre.off || 0)) : todayISO());
  const [frase, setFrase] = useState("");
  const [entendi, setEntendi] = useState(null);
  const aplicar = txt => {
    setFrase(txt);
    if (!txt.trim()) { setEntendi(null); return; }
    const r = interpretarFala(txt);
    setTipo(r.tipo); setCat(r.cat); setData(addDays(todayISO(), -r.off));
    if (r.valor) setValor(fmtNum(r.valor));
    if (r.desc) setDesc(r.desc);
    setEntendi(r);
  };
  const lista = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
  const v = num(valor);
  const ok = v > 0 && cat && lista.some(c => c.id === cat);
  return (
    <Sheet title={inicial ? "Editar lançamento" : tipo === "entrada" ? "Nova entrada" : "Novo gasto"} onClose={onClose}>
      {!inicial && <>
        <div className="voice">
          <input id="l-frase" value={frase} onChange={e => aplicar(e.target.value)} placeholder='Fale ou escreva: "gastei 32 na padaria"' enterKeyHint="done" autoComplete="off" aria-label="Descreva o gasto em uma frase" />
          <button type="button" className="mic" onClick={onVoz} aria-label="Falar"><I.mic /></button>
        </div>
        {entendi && entendi.valor > 0 && <div className="voice-ok"><I.check /><span>Entendi: {entendi.tipo === "entrada" ? "entrada" : "gasto"} de {brlReal(entendi.valor)} em {catDe(entendi.cat).nome}{entendi.off ? (entendi.off === 1 ? ", ontem" : ", anteontem") : ", hoje"}. Confira e salve.</span></div>}
      </>}
      <Seg big value={tipo} onChange={x => { setTipo(x); setCat(null); }} options={[{ v: "saida", l: "Gasto" }, { v: "entrada", l: "Entrada" }]} />
      <label className={"big-amt" + (tipo === "entrada" ? " in" : "")} htmlFor="l-valor"><span>R$</span>
        <input id="l-valor" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" autoFocus={!inicial} placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor" />
      </label>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {lista.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => setCat(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label="Descrição (opcional)" htmlFor="l-desc"><input id="l-desc" value={desc} onChange={e => setDesc(e.target.value)} placeholder={tipo === "entrada" ? "Ex.: Freela" : "Ex.: Padaria"} /></Field>
        <Field label="Quando" htmlFor="l-data"><input id="l-data" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field>
      </div>
      {!ok && <div className="hint">{!(v > 0) ? "Digite o valor e escolha uma categoria." : "Escolha uma categoria."}</div>}
      <button className="btn mode" disabled={!ok} onClick={() => onSave({ id: inicial ? inicial.id : uid(), tipo, valor: v, cat, desc: desc.trim(), data })}><I.check /> {inicial ? "Salvar" : tipo === "entrada" ? "Anotar entrada" : "Anotar gasto"}</button>
      {inicial && <ConfirmButton label="Apagar lançamento" titulo="Apagar este lançamento?" texto="Ele sai do seu extrato e dos totais do mês." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

function ContaSheet({ inicial, onSave, onDelete, onClose }) {
  const [nome, setNome] = useState(inicial ? inicial.nome : "");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [dia, setDia] = useState(inicial ? inicial.dia : 10);
  const [cat, setCat] = useState(inicial ? inicial.cat : "casa");
  const [assin, setAssin] = useState(inicial ? !!inicial.assinatura : false);
  const v = num(valor);
  const ok = nome.trim() && v > 0;
  return (
    <Sheet title={inicial ? "Editar conta" : "Nova conta fixa"} sub="Repete todo mês. Eu aviso antes de vencer." onClose={onClose}>
      <div className="fields">
        <Field label="Nome da conta" icon={<I.bill />} htmlFor="c-nome"><input id="c-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Aluguel, Luz, Internet" /></Field>
        <Field label="Valor (R$)" icon={<I.money />} htmlFor="c-valor"><input id="c-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" /></Field>
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
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => setCat(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <Toggle on={assin} onClick={() => setAssin(!assin)}>É uma assinatura (streaming, app, academia)</Toggle>
      <button className="btn mode" disabled={!ok} onClick={() => onSave({ ...(inicial || { pagas: {} }), id: inicial ? inicial.id : uid(), nome: nome.trim(), valor: v, dia, cat, assinatura: assin })}><I.check /> {inicial ? "Salvar" : "Adicionar conta"}</button>
      {inicial && <ConfirmButton label="Apagar conta" titulo="Apagar esta conta fixa?" texto="Ela para de aparecer nos próximos meses e nos lembretes." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

export { PessoalHome, GastosTab, ContasTab, LancSheet, ContaSheet };
