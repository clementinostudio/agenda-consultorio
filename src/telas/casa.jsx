// Parte do app carregada sob demanda: dinheiro a dois (ou em família)
import React, { useEffect, useMemo, useState } from "react";
import { I, Sheet, Field, Seg, Money, brl, brlReal, num, soNumero, fmtNum, todayISO, addDays, MES_LONGO, dm, relativo, vibrar, Ilustra, ConfirmButton, iniciais, CATEGORIAS, catDe, catVars, CatIcon, TopBar, useCamada } from "../App.jsx";
import { saldos, MAX_PESSOAS } from "../casa.js";

const VAGAS = ["Parceiro(a)", "Mãe ou pai", "Filho(a)", "Amigo(a)"];
const Pessoa = ({ m, grande }) => <span className={"casa-av" + (grande ? " grande" : "")}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</span>;
const ERROS = [[/ja tem casa/, "Você já está numa casa. Para entrar nesta, saia da outra primeiro."], [/casa cheia/, "Essa casa já tem 5 pessoas."], [/convite invalido/, "Esse convite venceu ou não existe. Peça um link novo."], [/sem login/, "Entre na sua conta para continuar."]];
const erroDe = e => { const t = String((e && e.message) || e); const m = ERROS.find(([r]) => r.test(t)); return m ? m[1] : "Não consegui falar com a nuvem. Confira a internet e tente de novo."; };
const nomeDe = (C, id) => id === C.eu ? "Você" : ((C.membros.find(m => m.id === id) || {}).nome || "Alguém");

/* ---------- a página da casa (aba do modo Pessoal, com o fundo do app) ---------- */
export function CasaPagina({ casa: C, conta, act, tema }) {
  useCamada(() => act.setTab("p-home"), { escurece: false }); // voltar do Android volta ao Início
  const voltar = () => act.setTab("p-home");
  const [nomeCasa, setNomeCasa] = useState("Nossa casa");
  const [link, setLink] = useState("");
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
                <li><b>O app divide</b> e mostra quem deve quanto, sem planilha.</li>
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
  const ch = todayISO().slice(0, 7);
  const doMes = C.lanc.filter(l => (l.data || "").startsWith(ch)).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const totalMes = doMes.reduce((s, l) => s + l.valor, 0);
  const pagouMes = {}; doMes.forEach(l => { pagouMes[l.pagou] = (pagouMes[l.pagou] || 0) + l.valor; });
  const { dividas } = saldos(C.lanc, C.acertos, C.membros);
  const sozinho = C.membros.length < 2;
  const convidar = () => faz("convite", async () => {
    const url = await C.convidar(); setLink(url);
    const texto = `${conta.nome} te chamou para dividir as contas da casa "${C.casa.nome}" no Alvena:`;
    if (navigator.share && C.nuvem) { try { await navigator.share({ title: "Convite para a casa", text: texto, url }); } catch (e) {} }
  });
  const acertar = d => faz("acerto", async () => { await C.salvar("acerto", { de: d.de, para: d.para, valor: d.valor, data: todayISO(), criado: Date.now() }); vibrar("ok"); act.toast(`Acertado: ${brlReal(d.valor)}`); });
  const mesNome = MES_LONGO[Number(ch.slice(5)) - 1];

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
                <span><b>{nomeDe(C, d.de)}</b> {d.de === C.eu ? "deve" : "deve"} <b className="num">{brl(d.valor)}</b> para <b>{d.para === C.eu ? "você" : nomeDe(C, d.para)}</b></span>
                {(d.de === C.eu || d.para === C.eu) && <button className="bub-act" disabled={!!ocupado} onClick={() => acertar(d)}>{d.de === C.eu ? "Paguei" : "Recebi"}</button>}
              </div>
            ))}
          </section>}

          <div className="casa-acoes">
            <button className="btn mode" onClick={() => act.abrirGastoCasa()}><I.plus /> Anotar gasto da casa</button>
            <button className="btn ghost" onClick={() => act.trazerParaCasa()}><I.upload /> Trazer dos meus gastos</button>
          </div>
        </div>

        <div className="col">
          {/* gastos da casa no mês */}
          <section className="panel casa-mes">
            <div className="panel-head"><h3>{mesNome[0].toUpperCase() + mesNome.slice(1)} na casa</h3><b className="num">{brl(totalMes)}</b></div>
            {!sozinho && totalMes > 0 && <div className="casa-quem">{C.membros.map(m => <span key={m.id}><Pessoa m={m} />{m.id === C.eu ? "Você" : m.nome}: <b>{brl(pagouMes[m.id] || 0)}</b></span>)}</div>}
            {doMes.length === 0 && <div className="empty">Nenhum gasto da casa este mês. {sozinho ? "Convide alguém e anotem juntos." : "Quem pagar, anota aqui."}</div>}
            {doMes.map(l => { const cat = catDe(l.cat || "casa"); const so = l.participantes && l.participantes.length === 1; return (
              <button key={l.id} className="casa-gasto" onClick={() => act.abrirGastoCasa(l)}>
                <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
                <span className="mid"><b>{l.desc || cat.nome}</b><small>{nomeDe(C, l.pagou)} pagou · {dm(l.data)}{so ? " · só para mostrar" : l.participantes && l.participantes.length < C.membros.length ? ` · dividido entre ${l.participantes.length}` : ""}{l.origem ? " · dos gastos pessoais" : ""}</small></span>
                <span className="amt num"><Money v={l.valor} /></span>
              </button>
            ); })}
          </section>

          <div className="casa-fim">
            {souDono && C.membros.filter(m => m.id !== C.eu).map(m => <ConfirmButton key={m.id} label={`Tirar ${m.nome} da casa`} titulo={`Tirar ${m.nome}?`} texto="A pessoa deixa de ver os gastos da casa. O que ela anotou continua." acao="Tirar" onConfirm={() => faz("tirar", () => C.tirar(m.id))} />)}
            <ConfirmButton label="Sair da casa" titulo="Sair da casa?" texto={sozinho ? "A casa e os gastos dela somem." : souDono ? "Você deixa de ver os gastos da casa. Quem entrou primeiro passa a cuidar dela." : "Você deixa de ver os gastos da casa."} acao="Sair" onConfirm={() => faz("sair", () => C.sair())} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- anotar ou corrigir um gasto da casa ---------- */
export function GastoCasaSheet({ casa: C, inicial, onClose, act }) {
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : "");
  const [cat, setCat] = useState(inicial ? inicial.cat || "casa" : "mercado");
  const [pagou, setPagou] = useState(inicial ? inicial.pagou : C.eu);
  const [parts, setParts] = useState(() => new Set(inicial && inicial.participantes ? inicial.participantes : C.membros.map(m => m.id)));
  const [data, setData] = useState(inicial ? inicial.data : todayISO());
  const v = num(valor), ok = v > 0 && parts.size > 0;
  const nome = m => m.id === C.eu ? "Você" : m.nome;
  const salvar = async () => {
    await C.salvar("lanc", { ...(inicial || {}), valor: v, desc: desc.trim(), cat, pagou, participantes: [...parts], data, criado: inicial ? inicial.criado : Date.now() });
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
        {v > 0 && parts.size > 0 && <div className="hint">{parts.size === 1 ? "Ninguém fica devendo: o gasto só aparece para a casa." : `Cada um fica com ${brlReal(v / parts.size)}.`}</div>}
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
      <div className="hint">{sozinho ? "Quando alguém entrar na casa, vai ver estes gastos." : modo === "dividir" ? `Cada gasto é dividido igual entre as ${C.membros.length} pessoas: quem não pagou fica devendo a parte dele.` : "A casa vê o gasto, mas ninguém fica devendo nada."}</div>
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
