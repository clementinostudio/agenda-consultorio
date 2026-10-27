// Parte do app carregada sob demanda: dinheiro a dois (ou em família)
import React, { useEffect, useMemo, useState } from "react";
import { I, Sheet, Field, Seg, Money, brl, brlReal, num, soNumero, fmtNum, todayISO, addDays, MES_LONGO, pad, dm, relativo, vibrar, Ilustra, ConfirmButton, iniciais, CATEGORIAS, catDe, catVars, CatIcon, TopBar, useCamada } from "../App.jsx";
import { saldos, partes, pesosDe, MAX_PESSOAS } from "../casa.js";

const VAGAS = ["Parceiro(a)", "Mãe ou pai", "Filho(a)", "Amigo(a)"];
const Pessoa = ({ m, grande }) => <span className={"casa-av" + (grande ? " grande" : "")}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</span>;
const ERROS = [[/ja tem casa/, "Você já está numa casa. Para entrar nesta, saia da outra primeiro."], [/casa cheia/, "Essa casa já tem 5 pessoas."], [/convite invalido/, "Esse convite venceu ou não existe. Peça um link novo."], [/sem login/, "Entre na sua conta para continuar."]];
const erroDe = e => { const t = String((e && e.message) || e); const m = ERROS.find(([r]) => r.test(t)); return m ? m[1] : "Não consegui falar com a nuvem. Confira a internet e tente de novo."; };
const nomeDe = (C, id) => id === C.eu ? "Você" : ((C.membros.find(m => m.id === id) || {}).nome || "Alguém");
const mesDe = off => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + off, 1); return { ch: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, nome: MES_LONGO[m.getMonth()], curto: MES_LONGO[m.getMonth()].slice(0, 3), ano: m.getFullYear() }; };
const Mai = s => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

/* ---------- a página da casa (aba do modo Pessoal, com o fundo do app) ---------- */
export function CasaPagina({ casa: C, conta, pix, act, tema }) {
  useCamada(() => act.setTab("p-home"), { escurece: false }); // voltar do Android volta ao Início
  const voltar = () => act.setTab("p-home");
  const [nomeCasa, setNomeCasa] = useState("Nossa casa");
  const [link, setLink] = useState("");
  const [off, setOff] = useState(0);
  const [ocupado, setOcupado] = useState(""), [erro, setErro] = useState("");
  const faz = async (k, fn) => { setOcupado(k); setErro(""); try { await fn(); } catch (e) { setErro(erroDe(e)); vibrar("erro"); } setOcupado(""); };

  if (!C.casa) return (
    <div className="page casa-pg">
      <TopBar eyebrow="Dinheiro a dois" title="Nossa casa" act={act} tema={tema} voltar={voltar} />
      <div className="cols"><div className="col">
        <section className="panel casa-criar">
          {C.estado === "carregando" ? <p className="hint">Abrindo a casa…</p> : <>
            <div className="casa-intro">
              <Ilustra n="dinheiro" />
              <ul>
                <li><b>Cada um anota</b> o que pagou da casa: mercado, aluguel, luz…</li>
                <li><b>O app divide</b>, igual ou pela renda de cada um, e mostra quem deve quanto.</li>
                <li><b>Contas, lista de compras e gráficos</b> da casa num lugar só.</li>
                <li><b>Você escolhe</b> quais gastos seus vão para a casa. O resto continua só seu.</li>
              </ul>
            </div>
            <div className="fields"><Field label="Nome da casa" htmlFor="c-nome"><input id="c-nome" value={nomeCasa} onChange={e => setNomeCasa(e.target.value)} placeholder="Ex.: Nossa casa, Apê" maxLength={60} /></Field></div>
            {erro && <div className="error">{erro}</div>}
            <button className="btn mode" disabled={!!ocupado} onClick={() => faz("criar", () => C.criar(nomeCasa.trim()))}><I.check /> {ocupado ? "Criando…" : "Criar a casa"}</button>
            {!C.nuvem && <div className="hint">Na demonstração a casa fica só neste aparelho. Com a sua conta, ela fica na nuvem e cada pessoa usa o próprio celular.</div>}
          </>}
        </section>
      </div></div>
    </div>
  );

  const souDono = C.casa.dono === C.eu;
  const mes = mesDe(off);
  const doMes = C.lanc.filter(l => (l.data || "").startsWith(mes.ch)).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const totalMes = doMes.reduce((s, l) => s + l.valor, 0);
  const { dividas } = saldos(C.lanc, C.acertos, C.membros);
  const sozinho = C.membros.length < 2;
  const convidar = () => faz("convite", async () => {
    const url = await C.convidar(); setLink(url);
    const texto = `${conta.nome} te chamou para dividir as contas da casa "${C.casa.nome}" no Alvena:`;
    if (navigator.share && C.nuvem) { try { await navigator.share({ title: "Convite para a casa", text: texto, url }); } catch (e) {} }
  });
  const acertar = d => faz("acerto", async () => { await C.salvar("acerto", { de: d.de, para: d.para, valor: d.valor, data: todayISO(), criado: Date.now(), autor: C.eu }); vibrar("ok"); act.toast(`Acertado: ${brlReal(d.valor)}`); });
  // lembrete educado pelo WhatsApp (abre o WhatsApp com a mensagem pronta; a pessoa escolhe o contato)
  const lembrar = d => {
    const msg = `Oi, ${nomeDe(C, d.de)}! Pelas contas da casa "${C.casa.nome}", ficou ${brlReal(d.valor)} para você me passar.${pix ? ` Meu Pix: ${pix}` : ""} Obrigado(a)! 💚`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  return (
    <div className="page casa-pg">
      <TopBar eyebrow={sozinho ? "Dinheiro a dois" : `${C.membros.length} pessoas`} title={C.casa.nome} act={act} tema={tema} voltar={voltar} />
      <div className="cols">
        <div className="col">
          {/* pessoas da casa e as vagas */}
          <section className="panel casa-gente">
            <div className="casa-pessoas">
              {C.membros.map(m => (
                <div key={m.id} className="casa-pessoa">
                  <Pessoa m={m} grande />{m.papel === "dono" && <i className="casa-estrela" aria-label="Criou a casa"><I.star /></i>}
                  <small>{m.id === C.eu ? "Você" : m.nome}</small>
                </div>
              ))}
              {Array.from({ length: MAX_PESSOAS - C.membros.length }).map((_, k) => (
                <button key={k} className="casa-pessoa vaga" onClick={convidar} aria-label="Convidar alguém">
                  <span className="casa-av grande"><I.plus /></span><small>ex.: {VAGAS[(C.membros.length - 1 + k) % VAGAS.length]}</small>
                </button>
              ))}
            </div>
            {C.membros.length < MAX_PESSOAS && (
              <button className="casa-convite" onClick={convidar} disabled={ocupado === "convite"}>
                <span className="ic"><I.share /></span>
                <span className="tx"><b>{ocupado === "convite" ? "Criando o link…" : "Convidar por link"}</b><small>Mande pelo WhatsApp. Quem abrir entra na casa (vale 7 dias).</small></span>
                <I.chev />
              </button>
            )}
            {link && <div className="casa-link"><span>{link}</span><button className="bub-act" onClick={() => { try { navigator.clipboard.writeText(link); act.toast("Link copiado"); } catch (e) {} }}>Copiar</button></div>}
            {!C.nuvem && link && C.membros.length < MAX_PESSOAS && <button className="link" onClick={C.simularEntrada}>Demonstração: simular alguém aceitando o convite</button>}
            {erro && <div className="error">{erro}</div>}
          </section>

          {/* quem deve quanto */}
          {!sozinho && <section className="panel casa-saldo">
            <div className="panel-head"><h3>Quem deve quanto</h3></div>
            {dividas.length === 0 ? <div className="casa-ok"><I.check /><span>Tudo acertado entre vocês.</span></div> : dividas.map((d, k) => (
              <div key={k} className="casa-divida">
                <span><b>{nomeDe(C, d.de)}</b> deve <b className="num">{brl(d.valor)}</b> para <b>{d.para === C.eu ? "você" : nomeDe(C, d.para)}</b></span>
                {(d.de === C.eu || d.para === C.eu) && <span className="casa-divida-acts">
                  {d.para === C.eu && <button className="bub-act" onClick={() => lembrar(d)}>Lembrar</button>}
                  <button className="bub-act" disabled={!!ocupado} onClick={() => acertar(d)}>{d.de === C.eu ? "Paguei" : "Recebi"}</button>
                </span>}
              </div>
            ))}
            <Acertos C={C} />
          </section>}

          <div className="casa-acoes">
            <button className="btn mode" onClick={() => act.abrirGastoCasa()}><I.plus /> Anotar gasto da casa</button>
            <button className="btn ghost" onClick={() => act.trazerParaCasa()}><I.upload /> Trazer dos meus gastos</button>
          </div>

          <ContasDaCasa C={C} act={act} />
          <ListaCompras C={C} act={act} />
        </div>

        <div className="col">
          {/* o mês da casa: total, para onde foi, quem pagou e os gastos */}
          <section className="panel casa-mes">
            <div className="casa-mes-nav">
              <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
              <span>{Mai(mes.nome)} de {mes.ano}</span>
              <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Próximo mês" disabled={off >= 0}><I.chev /></button>
            </div>
            <div className="casa-total"><Money v={totalMes} /><small>{doMes.length} {doMes.length === 1 ? "gasto" : "gastos"} da casa</small></div>
            <GraficoMeses C={C} off={off} onEscolher={setOff} />
            {totalMes > 0 && <GraficoCategorias itens={doMes} />}
            {totalMes > 0 && !sozinho && <GraficoQuem C={C} itens={doMes} />}
          </section>

          <section className="panel casa-lista">
            <div className="panel-head"><h3>Gastos de {mes.nome}</h3></div>
            {doMes.length === 0 && <div className="empty">Nenhum gasto da casa em {mes.nome}. {sozinho ? "Convide alguém e anotem juntos." : "Quem pagar, anota aqui."}</div>}
            {doMes.map(l => { const cat = catDe(l.cat || "casa"); const so = l.participantes && l.participantes.length === 1; return (
              <button key={l.id} className="casa-gasto" onClick={() => act.abrirGastoCasa(l)}>
                <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
                <span className="mid"><b>{l.desc || cat.nome}</b><small>{nomeDe(C, l.pagou)} pagou · {dm(l.data)}{so ? " · só para mostrar" : l.pesos ? " · proporcional" : l.participantes && l.participantes.length < C.membros.length ? ` · dividido entre ${l.participantes.length}` : ""}{l.origem ? " · dos gastos pessoais" : ""}{l.contaId ? " · conta da casa" : ""}</small></span>
                <span className="amt num"><Money v={l.valor} /></span>
              </button>
            ); })}
          </section>

          {!sozinho && <ComoDividem C={C} />}

          <div className="casa-fim">
            {souDono && C.membros.filter(m => m.id !== C.eu).map(m => <ConfirmButton key={m.id} label={`Tirar ${m.nome} da casa`} titulo={`Tirar ${m.nome}?`} texto="A pessoa deixa de ver os gastos da casa. O que ela anotou continua." acao="Tirar" onConfirm={() => faz("tirar", () => C.tirar(m.id))} />)}
            <ConfirmButton label="Sair da casa" titulo="Sair da casa?" texto={sozinho ? "A casa e os gastos dela somem." : souDono ? "Você deixa de ver os gastos da casa. Quem entrou primeiro passa a cuidar dela." : "Você deixa de ver os gastos da casa."} acao="Sair" onConfirm={() => faz("sair", () => C.sair())} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- gráficos (cores de gráfico validadas para os dois temas: --g-<categoria>) ---------- */
// Os últimos 6 meses até o mês escolhido; tocar numa barra abre aquele mês
function GraficoMeses({ C, off, onEscolher }) {
  const meses = [-5, -4, -3, -2, -1, 0].map(k => { const m = mesDe(off + k); return { ...m, k: off + k, total: C.lanc.filter(l => (l.data || "").startsWith(m.ch)).reduce((s, l) => s + l.valor, 0) }; });
  const maior = Math.max(...meses.map(m => m.total), 1);
  if (meses.every(m => !m.total)) return null;
  return (
    <div className="g-meses" role="group" aria-label="Gastos da casa nos últimos 6 meses">
      {meses.map(m => (
        <button key={m.ch} type="button" className={"g-mes" + (m.k === off ? " on" : "")} disabled={m.k > 0} onClick={() => onEscolher(m.k)} title={`${Mai(m.nome)}: ${brlReal(m.total)}`} aria-label={`${Mai(m.nome)}: ${brlReal(m.total)}`}>
          {m.k === off && m.total > 0 && <small className="g-val">{brl(m.total)}</small>}
          <i style={{ height: `${Math.max(3, (m.total / maior) * 78)}%` }} />
          <span>{m.curto}</span>
        </button>
      ))}
    </div>
  );
}

// Para onde foi: barra empilhada por categoria (com espaço entre as partes) e a lista com nome, valor e %
function GraficoCategorias({ itens }) {
  const [sel, setSel] = useState(null);
  const por = {}; itens.forEach(l => { const c = l.cat || "casa"; por[c] = (por[c] || 0) + l.valor; });
  const cats = Object.entries(por).sort((a, b) => b[1] - a[1]), tot = cats.reduce((s, c) => s + c[1], 0);
  return (
    <div className="g-cats">
      <b className="g-tit">Para onde foi</b>
      <div className="g-pilha" role="img" aria-label={cats.map(([c, v]) => `${catDe(c).nome} ${pct(v, tot)}%`).join(", ")}>
        {cats.map(([c, v]) => <i key={c} className={sel && sel !== c ? "apaga" : ""} style={{ width: `${(v / tot) * 100}%`, background: `var(--g-${c}, var(--mode))` }} title={`${catDe(c).nome}: ${brlReal(v)}`} onClick={() => setSel(sel === c ? null : c)} />)}
      </div>
      <div className="g-leg">
        {cats.map(([c, v]) => (
          <button key={c} type="button" className={"g-leg-l" + (sel === c ? " on" : sel ? " apaga" : "")} onClick={() => setSel(sel === c ? null : c)}>
            <i style={{ background: `var(--g-${c}, var(--mode))` }} /><span>{catDe(c).nome}</span><b className="num">{brl(v)}</b><small>{pct(v, tot)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// Quem pagou quanto, com a marca da parte justa de cada um (igual ou proporcional)
function GraficoQuem({ C, itens }) {
  const pagou = {}, justo = {};
  C.membros.forEach(m => { pagou[m.id] = 0; justo[m.id] = 0; });
  itens.forEach(l => { if (l.pagou in pagou) pagou[l.pagou] += l.valor; Object.entries(partes(l, C.membros)).forEach(([p, v]) => { justo[p] += v; }); });
  const maior = Math.max(...C.membros.map(m => Math.max(pagou[m.id], justo[m.id])), 1);
  return (
    <div className="g-quem">
      <b className="g-tit">Quem pagou</b>
      {C.membros.map(m => { const dif = pagou[m.id] - justo[m.id]; return (
        <div key={m.id} className="g-quem-l" title={`${nomeDe(C, m.id)} pagou ${brlReal(pagou[m.id])}; a parte justa é ${brlReal(justo[m.id])}`}>
          <span className="g-quem-n"><Pessoa m={m} />{nomeDe(C, m.id)}</span>
          <span className="g-quem-b"><i style={{ width: `${(pagou[m.id] / maior) * 100}%` }} /><em style={{ left: `${(justo[m.id] / maior) * 100}%` }} aria-hidden="true" /></span>
          <span className="g-quem-v"><b className="num">{brl(pagou[m.id])}</b><small>{Math.abs(dif) < 0.5 ? "na medida" : dif > 0 ? `+${brl(dif)} a mais` : `${brl(-dif)} a menos`}</small></span>
        </div>
      ); })}
      <small className="g-nota"><em aria-hidden="true" /> parte justa de cada um</small>
    </div>
  );
}

/* ---------- contas fixas da casa ---------- */
function ContasDaCasa({ C, act }) {
  const ch = todayISO().slice(0, 7), hoje = Number(todayISO().slice(8, 10));
  const lista = [...C.contas].sort((a, b) => a.dia - b.dia);
  const pagaEm = c => C.lanc.find(l => l.contaId === c.id && l.mes === ch);
  const pagar = async c => {
    const parts = C.membros.map(m => m.id);
    await C.salvar("lanc", { valor: c.valor, desc: c.nome, cat: c.cat || "casa", data: todayISO(), pagou: C.eu, participantes: parts, pesos: pesosDe(C.config, parts), contaId: c.id, mes: ch, criado: Date.now(), autor: C.eu });
    vibrar("ok"); act.toast(`${c.nome} paga e dividida`);
  };
  const aPagar = lista.filter(c => !pagaEm(c)).reduce((s, c) => s + c.valor, 0);
  return (
    <section className="panel casa-contas">
      <div className="panel-head"><h3>Contas da casa</h3>{aPagar > 0 && <small className="casa-contas-falta">{brl(aPagar)} a pagar</small>}</div>
      {lista.length === 0 && <div className="hint">Aluguel, luz, internet… Coloque as contas fixas da casa: quem pagar marca, e o valor já entra dividido.</div>}
      {lista.map(c => { const p = pagaEm(c), cat = catDe(c.cat || "casa"), atrasada = !p && c.dia < hoje; return (
        <div key={c.id} className={"casa-conta" + (p ? " paga" : atrasada ? " atrasada" : "")}>
          <button className="casa-conta-in" onClick={() => act.abrirContaCasa(c)}>
            <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
            <span className="mid"><b>{c.nome}</b><small>{p ? `Paga por ${nomeDe(C, p.pagou)} · ${dm(p.data)}` : atrasada ? `Venceu dia ${c.dia}` : `Vence dia ${c.dia}`}</small></span>
            <span className="amt num">{brl(c.valor)}</span>
          </button>
          {!p ? <button className="bub-act" onClick={() => pagar(c)}>Paguei</button> : <span className="casa-conta-ok" aria-label="Paga"><I.check /></span>}
        </div>
      ); })}
      <button className="link" onClick={() => act.abrirContaCasa()}><I.plus /> Conta da casa</button>
    </section>
  );
}

export function ContaCasaSheet({ casa: C, inicial, onClose, act }) {
  const [nome, setNome] = useState(inicial ? inicial.nome : "");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [dia, setDia] = useState(inicial ? String(inicial.dia) : "10");
  const [cat, setCat] = useState(inicial ? inicial.cat || "casa" : "casa");
  const ok = nome.trim() && num(valor) > 0 && Number(dia) >= 1 && Number(dia) <= 31;
  const SUG = ["Aluguel", "Condomínio", "Luz", "Água", "Internet", "Gás", "Diarista", "Streaming"];
  const salvar = async () => { await C.salvar("conta", { ...(inicial || {}), nome: nome.trim(), valor: num(valor), dia: Number(dia), cat, autor: (inicial && inicial.autor) || C.eu }); vibrar("ok"); act.toast(inicial ? "Conta atualizada" : `${nome.trim()} na casa`); onClose(); };
  return (
    <Sheet title={inicial ? "Conta da casa" : "Nova conta da casa"} sub="Todo mês, quem pagar marca e o valor entra dividido" onClose={onClose}>
      {!inicial && <div className="casa-chips">{SUG.map(s => <button key={s} type="button" className={nome === s ? "on" : ""} onClick={() => setNome(s)}>{s}</button>)}</div>}
      <div className="fields">
        <Field label="Nome" htmlFor="cc-n"><input id="cc-n" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Aluguel" autoComplete="off" /></Field>
      </div>
      <div className="fields duas">
        <Field label="Valor (R$)" htmlFor="cc-v"><input id="cc-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" /></Field>
        <Field label="Vence dia" htmlFor="cc-d"><input id="cc-d" inputMode="numeric" value={dia} onChange={e => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
      </div>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATEGORIAS.filter(c => c.id !== "outros").slice(0, 6).map(c => <button key={c.id} type="button" className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>{c.nome}</button>)}</div>
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Colocar na casa"}</button>
      {inicial && <ConfirmButton label="Tirar esta conta" titulo={`Tirar ${inicial.nome}?`} texto="Ela some da casa. Os pagamentos que já foram anotados continuam." acao="Tirar" onConfirm={async () => { await C.apagar("conta", inicial.id); onClose(); }} />}
    </Sheet>
  );
}

/* ---------- lista de compras da casa (aparece na hora no celular de todos) ---------- */
function ListaCompras({ C, act }) {
  const [txt, setTxt] = useState("");
  const itens = [...C.compras].sort((a, b) => (a.feito ? 1 : 0) - (b.feito ? 1 : 0) || (a.criado || 0) - (b.criado || 0));
  const feitos = itens.filter(x => x.feito);
  const add = e => { e.preventDefault(); const t = txt.trim(); if (!t) return; t.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach((s, i) => C.salvar("compra", { texto: s, feito: false, criado: Date.now() + i, autor: C.eu })); setTxt(""); vibrar("toque"); };
  const limpar = () => feitos.forEach(x => C.apagar("compra", x.id));
  return (
    <section className="panel casa-compras">
      <div className="panel-head"><h3>Lista de compras</h3>{itens.length > 0 && <small>{feitos.length} de {itens.length}</small>}</div>
      <form className="casa-compras-add" onSubmit={add}>
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Adicionar (ex.: leite, pão, café)" aria-label="Item da lista de compras" enterKeyHint="done" />
        <button type="submit" className="icon-btn" aria-label="Adicionar" disabled={!txt.trim()}><I.plus /></button>
      </form>
      {itens.length === 0 && <div className="hint">O que um coloca aparece na hora para os outros. Quem estiver no mercado marca o que pegou.</div>}
      {itens.map(x => (
        <div key={x.id} className={"casa-item" + (x.feito ? " feito" : "")}>
          <button className={"box " + (x.feito ? "done" : "up")} onClick={() => C.salvar("compra", { ...x, feito: !x.feito, por: C.eu })} aria-label={x.feito ? `Desmarcar ${x.texto}` : `Marcar ${x.texto}`}>{x.feito && <I.check />}</button>
          <span>{x.texto}{x.autor && x.autor !== C.eu ? <small> · {nomeDe(C, x.autor)}</small> : null}</span>
          <button className="casa-item-x" onClick={() => C.apagar("compra", x.id)} aria-label={`Tirar ${x.texto}`}><I.x /></button>
        </div>
      ))}
      {feitos.length > 0 && <div className="btn-row">
        <button className="btn ghost" onClick={() => act.abrirGastoCasa(null, { desc: "Compras do mercado", cat: "mercado" })}><I.plus /> Anotar a compra</button>
        <button className="btn ghost" onClick={limpar}>Limpar comprados</button>
      </div>}
    </section>
  );
}

/* ---------- como a casa divide: igual ou proporcional (por exemplo, pela renda) ---------- */
function ComoDividem({ C }) {
  const cfg = C.config || {};
  const [modo, setModo] = useState(cfg.modo || "igual");
  const [pcts, setPcts] = useState(() => Object.fromEntries(C.membros.map(m => [m.id, String((cfg.pcts && cfg.pcts[m.id]) || Math.round(100 / C.membros.length))])));
  const soma = C.membros.reduce((s, m) => s + (Number(pcts[m.id]) || 0), 0);
  const salvar = (md, p = pcts) => C.salvar("config", { id: "divisao", modo: md, pcts: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Number(v) || 0])) });
  useEffect(() => { if (modo === "proporcional" && soma === 100) { const t = setTimeout(() => salvar("proporcional"), 600); return () => clearTimeout(t); } }, [pcts]);
  return (
    <section className="panel casa-divide">
      <div className="panel-head"><h3>Como vocês dividem</h3></div>
      <Seg value={modo} onChange={md => { setModo(md); salvar(md); vibrar("toque"); }} options={[{ v: "igual", l: "Igual" }, { v: "proporcional", l: "Proporcional" }]} />
      {modo === "igual" ? <div className="hint">Cada gasto é dividido em partes iguais entre quem participa.</div> : <>
        <div className="hint">Bom quando um ganha mais que o outro: cada um paga a sua porcentagem. Vale para os gastos anotados daqui para a frente.</div>
        {C.membros.map(m => (
          <label key={m.id} className="casa-pct"><span><Pessoa m={m} />{nomeDe(C, m.id)}</span><input inputMode="numeric" value={pcts[m.id]} onChange={e => setPcts(p => ({ ...p, [m.id]: e.target.value.replace(/\D/g, "").slice(0, 3) }))} aria-label={`Porcentagem de ${nomeDe(C, m.id)}`} /><small>%</small></label>
        ))}
        {soma !== 100 && <div className="error">A soma está em {soma}%. Precisa dar 100%.</div>}
      </>}
    </section>
  );
}

// Os últimos acertos (quem pagou quem)
function Acertos({ C }) {
  const ult = [...C.acertos].sort((a, b) => (b.criado || 0) - (a.criado || 0)).slice(0, 3);
  if (!ult.length) return null;
  return <div className="casa-acertos"><small>Últimos acertos</small>{ult.map(a => <span key={a.id}>{nomeDe(C, a.de)} pagou {brl(a.valor)} para {a.para === C.eu ? "você" : nomeDe(C, a.para)} · {relativo(a.data).toLowerCase()}</span>)}</div>;
}

/* ---------- anotar ou corrigir um gasto da casa ---------- */
export function GastoCasaSheet({ casa: C, inicial, pre, onClose, act }) {
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : (pre && pre.desc) || "");
  const [cat, setCat] = useState(inicial ? inicial.cat || "casa" : (pre && pre.cat) || "mercado");
  const [pagou, setPagou] = useState(inicial ? inicial.pagou : C.eu);
  const [parts, setParts] = useState(() => new Set(inicial && inicial.participantes ? inicial.participantes : C.membros.map(m => m.id)));
  const [data, setData] = useState(inicial ? inicial.data : todayISO());
  const v = num(valor), ok = v > 0 && parts.size > 0;
  const nome = m => m.id === C.eu ? "Você" : m.nome;
  // pesos: os do próprio gasto (se os participantes não mudaram) ou os da casa
  const mesmos = inicial && inicial.participantes && inicial.participantes.length === parts.size && inicial.participantes.every(p => parts.has(p));
  const pesos = mesmos && inicial.pesos ? inicial.pesos : pesosDe(C.config, [...parts]);
  const previa = v > 0 && parts.size > 1 ? partes({ valor: v, participantes: [...parts], pesos }, C.membros) : null;
  const salvar = async () => {
    await C.salvar("lanc", { ...(inicial || {}), valor: v, desc: desc.trim(), cat, pagou, participantes: [...parts], pesos, data, criado: inicial ? inicial.criado : Date.now(), autor: (inicial && inicial.autor) || C.eu });
    vibrar("ok"); act.toast(inicial ? "Gasto da casa atualizado" : `Gasto da casa anotado: ${brlReal(v)}`); onClose();
  };
  return (
    <Sheet title={inicial ? "Gasto da casa" : "Anotar gasto da casa"} sub={C.casa ? C.casa.nome : ""} onClose={onClose}>
      <label className="big-amt" htmlFor="cg-v"><span>R$</span><input id="cg-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} aria-label="Valor" /></label>
      <div className="fields"><Field label="O que foi" htmlFor="cg-d"><input id="cg-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: Mercado do mês, Luz, Pizza" autoComplete="off" /></Field></div>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATEGORIAS.filter(c => c.id !== "outros").slice(0, 6).map(c => <button key={c.id} type="button" className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>{c.nome}</button>)}</div>
      {C.membros.length > 1 && <>
        <div className="hint">Quem pagou</div>
        <div className="casa-chips" role="radiogroup" aria-label="Quem pagou">{C.membros.map(m => <button key={m.id} type="button" className={pagou === m.id ? "on" : ""} onClick={() => setPagou(m.id)}><Pessoa m={m} />{nome(m)}</button>)}</div>
        <div className="hint">Dividir entre</div>
        <div className="casa-chips" role="group" aria-label="Dividir entre">{C.membros.map(m => <button key={m.id} type="button" className={parts.has(m.id) ? "on" : ""} onClick={() => setParts(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}>{parts.has(m.id) && <I.check />}{nome(m)}</button>)}</div>
        {v > 0 && parts.size === 1 && <div className="hint">Ninguém fica devendo: o gasto só aparece para a casa.</div>}
        {previa && <div className="hint">{pesos ? "Proporcional: " : "Cada um: "}{Object.entries(previa).map(([id, x]) => `${nomeDe(C, id)} ${brlReal(x)}`).join(" · ")}.</div>}
      </>}
      <div className="fields"><Field label="Quando" htmlFor="cg-dt"><input id="cg-dt" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field></div>
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Anotar"}</button>
      {inicial && <ConfirmButton label="Apagar este gasto" titulo="Apagar o gasto da casa?" texto="Ele some para todas as pessoas da casa. O seu lançamento pessoal (se veio de lá) continua." acao="Apagar" onConfirm={async () => { await C.apagar("lanc", inicial.id); act.desligarDaCasa(inicial.id); onClose(); }} />}
    </Sheet>
  );
}

/* ---------- levar gastos pessoais para a casa (a pessoa escolhe quais) ---------- */
export function TrazerGastosSheet({ casa: C, db, ids0, onClose, act }) {
  const desde = addDays(todayISO(), -60);
  const lista = useMemo(() => db.pessoal.lanc.filter(l => l.tipo === "saida" && !l.casaId && (l.data >= desde || (ids0 || []).includes(l.id))).sort((a, b) => b.data.localeCompare(a.data)), [db]);
  const [sel, setSel] = useState(() => new Set((ids0 || []).filter(id => lista.some(l => l.id === id))));
  const [modo, setModo] = useState("dividir");
  const marcar = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const total = lista.filter(l => sel.has(l.id)).reduce((s, l) => s + l.valor, 0);
  const sozinho = C.membros.length < 2;
  const levar = async () => { await act.compartilharComCasa([...sel], modo === "dividir" && !sozinho); onClose(); };
  return (
    <Sheet title="Levar para a casa" sub="Escolha quais gastos seus a casa vai ver" onClose={onClose}>
      {!sozinho && <Seg value={modo} onChange={setModo} options={[{ v: "dividir", l: "Dividir entre todos" }, { v: "mostrar", l: "Só mostrar" }]} />}
      <div className="hint">{sozinho ? "Quando alguém entrar na casa, vai ver estes gastos." : modo === "dividir" ? `Cada gasto é dividido ${C.config && C.config.modo === "proporcional" ? "pela porcentagem de cada um" : `igual entre as ${C.membros.length} pessoas`}: quem não pagou fica devendo a parte dele.` : "A casa vê o gasto, mas ninguém fica devendo nada."}</div>
      {lista.length === 0 ? <div className="empty">Nenhum gasto seu nos últimos 60 dias que ainda não esteja na casa.</div> : (
        <div className="casa-escolha">
          {lista.map(l => { const cat = catDe(l.cat); return (
            <button key={l.id} type="button" className={"casa-escolha-item" + (sel.has(l.id) ? " on" : "")} aria-pressed={sel.has(l.id)} onClick={() => marcar(l.id)}>
              <span className={"box " + (sel.has(l.id) ? "done" : "up")}>{sel.has(l.id) && <I.check />}</span>
              <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
              <span className="mid"><b>{l.desc || cat.nome}</b><small>{cat.nome} · {relativo(l.data).toLowerCase()}</small></span>
              <span className="amt num"><Money v={l.valor} /></span>
            </button>
          ); })}
        </div>
      )}
      <button className="btn mode" disabled={!sel.size} onClick={levar}><I.check /> {sel.size ? `Levar ${sel.size} ${sel.size === 1 ? "gasto" : "gastos"} (${brl(total)})` : "Escolha os gastos"}</button>
    </Sheet>
  );
}

// Abriu um link de convite: mostra de quem é a casa e entra
export function ConviteCasaSheet({ casa: C, token, onClose, onEntrou }) {
  const [info, setInfo] = useState(null), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!C.nuvem) { setErro("Para entrar numa casa, use a sua conta com e-mail e senha. Na demonstração não dá."); return; }
    C.verConvite(token).then(i => i && i.valido ? setInfo(i) : setErro(erroDe("convite invalido"))).catch(e => setErro(erroDe(e)));
  }, [token]);
  const entrar = async () => { setOcupado(true); try { await C.entrar(token); vibrar("ok"); onEntrou(); } catch (e) { setErro(erroDe(e)); setOcupado(false); } };
  return (
    <Sheet title="Convite para a casa" onClose={onClose}>
      <div className="casa-intro"><Ilustra n="dinheiro" />
        {info ? <p><b>{info.convidou || "Alguém"}</b> te chamou para dividir as contas da casa <b>“{info.casa}”</b> ({info.pessoas} {info.pessoas === 1 ? "pessoa" : "pessoas"}).<br /><br />Vocês vão ver os gastos da casa e quem deve quanto. <b>Seus gastos pessoais continuam só seus</b>, a não ser os que você escolher levar.</p>
          : !erro ? <p>Abrindo o convite…</p> : null}
      </div>
      {erro && <div className="error">{erro}</div>}
      {info && <button className="btn mode" disabled={ocupado} onClick={entrar}><I.check /> {ocupado ? "Entrando…" : "Entrar na casa"}</button>}
      <button className="btn text" onClick={onClose}>Agora não</button>
    </Sheet>
  );
}
