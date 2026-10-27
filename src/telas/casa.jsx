// Parte do app carregada sob demanda: dinheiro a dois (ou em família)
import React, { useEffect, useState } from "react";
import { I, Sheet, Field, Money, brl, brlReal, num, soNumero, fmtNum, todayISO, MES_LONGO, dm, vibrar, Ilustra, ConfirmButton, iniciais, CATEGORIAS, catDe } from "../App.jsx";
import { saldos, MAX_PESSOAS } from "../casa.js";

const VAGAS = ["Parceiro(a)", "Mãe ou pai", "Filho(a)", "Amigo(a)"];
const Pessoa = ({ m, grande }) => <span className={"casa-av" + (grande ? " grande" : "")}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</span>;
const ERROS = [[/ja tem casa/, "Você já está numa casa. Para entrar nesta, saia da outra primeiro."], [/casa cheia/, "Essa casa já tem 5 pessoas."], [/convite invalido/, "Esse convite venceu ou não existe. Peça um link novo."], [/sem login/, "Entre na sua conta para continuar."]];
const erroDe = e => { const t = String((e && e.message) || e); const m = ERROS.find(([r]) => r.test(t)); return m ? m[1] : "Não consegui falar com a nuvem. Confira a internet e tente de novo."; };

export function CasaSheet({ casa: C, conta, onClose, act }) {
  const [nomeCasa, setNomeCasa] = useState("Nossa casa");
  const [link, setLink] = useState("");
  const [ocupado, setOcupado] = useState(""), [erro, setErro] = useState("");
  const [form, setForm] = useState(null); // gasto novo ou em edição
  const nome = id => id === C.eu ? "Você" : ((C.membros.find(m => m.id === id) || {}).nome || "Alguém");
  const faz = async (k, fn) => { setOcupado(k); setErro(""); try { await fn(); } catch (e) { setErro(erroDe(e)); vibrar("erro"); } setOcupado(""); };

  if (C.estado === "carregando") return <Sheet title="Dinheiro a dois" onClose={onClose}><p className="hint">Abrindo a casa…</p></Sheet>;
  if (!C.casa) return (
    <Sheet title="Dinheiro a dois" sub="Ou em família: até 5 pessoas" onClose={onClose}>
      <div className="casa-intro">
        <Ilustra n="dinheiro" />
        <ul>
          <li><b>Cada um anota</b> o que pagou da casa: mercado, aluguel, luz…</li>
          <li><b>O app divide</b> e mostra quem deve quanto, sem planilha.</li>
          <li><b>Só a casa é compartilhada.</b> Seus gastos pessoais continuam só seus.</li>
        </ul>
      </div>
      <div className="fields"><Field label="Nome da casa" htmlFor="c-nome"><input id="c-nome" value={nomeCasa} onChange={e => setNomeCasa(e.target.value)} placeholder="Ex.: Nossa casa, Apê" maxLength={60} /></Field></div>
      {erro && <div className="error">{erro}</div>}
      <button className="btn mode" disabled={!!ocupado} onClick={() => faz("criar", () => C.criar(nomeCasa.trim()))}><I.check /> {ocupado ? "Criando…" : "Criar a casa"}</button>
      {!C.nuvem && <div className="hint">Na demonstração a casa fica só neste aparelho. Com a sua conta, ela fica na nuvem e cada pessoa usa o próprio celular.</div>}
    </Sheet>
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

  return (
    <Sheet title={C.casa.nome} sub={sozinho ? "Convide quem divide as contas com você" : `${C.membros.length} pessoas · gastos da casa`} onClose={onClose}>
      {/* pessoas da casa e as vagas */}
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

      {/* quem deve quanto */}
      {!sozinho && <section className="panel casa-saldo">
        <div className="panel-head"><h3>Quem deve quanto</h3></div>
        {dividas.length === 0 ? <div className="casa-ok"><I.check /><span>Tudo acertado entre vocês.</span></div> : dividas.map((d, k) => (
          <div key={k} className="casa-divida">
            <span><b>{nome(d.de)}</b> {d.de === C.eu ? "deve" : "deve"} <b className="num">{brl(d.valor)}</b> para <b>{d.para === C.eu ? "você" : nome(d.para)}</b></span>
            {(d.de === C.eu || d.para === C.eu) && <button className="bub-act" disabled={!!ocupado} onClick={() => acertar(d)}>{d.de === C.eu ? "Paguei" : "Recebi"}</button>}
          </div>
        ))}
      </section>}

      {/* gastos da casa no mês */}
      {form ? <GastoCasa C={C} inicial={form === "novo" ? null : form} onFim={() => setForm(null)} act={act} /> : <>
        <section className="panel casa-mes">
          <div className="panel-head"><h3>{MES_LONGO[Number(ch.slice(5)) - 1][0].toUpperCase() + MES_LONGO[Number(ch.slice(5)) - 1].slice(1)} na casa</h3><b className="num">{brl(totalMes)}</b></div>
          {!sozinho && totalMes > 0 && <div className="casa-quem">{C.membros.map(m => <span key={m.id}><Pessoa m={m} />{m.id === C.eu ? "Você" : m.nome}: <b>{brl(pagouMes[m.id] || 0)}</b></span>)}</div>}
          {doMes.length === 0 && <div className="empty">Nenhum gasto da casa este mês. {sozinho ? "Convide alguém e anotem juntos." : "Quem pagar, anota aqui."}</div>}
          {doMes.map(l => (
            <button key={l.id} className="casa-gasto" onClick={() => setForm(l)}>
              <span className="mid"><b>{l.desc || catDe(l.cat || "casa").nome}</b><small>{nome(l.pagou)} pagou · {dm(l.data)}{l.participantes && l.participantes.length < C.membros.length ? ` · dividido entre ${l.participantes.length}` : ""}</small></span>
              <span className="amt num"><Money v={l.valor} /></span>
            </button>
          ))}
        </section>
        <button className="btn mode" onClick={() => setForm("novo")}><I.plus /> Anotar gasto da casa</button>
      </>}

      {/* pessoas: tirar alguém (quem criou) e sair */}
      {!form && <div className="casa-fim">
        {souDono && C.membros.filter(m => m.id !== C.eu).map(m => <ConfirmButton key={m.id} label={`Tirar ${m.nome} da casa`} titulo={`Tirar ${m.nome}?`} texto="A pessoa deixa de ver os gastos da casa. O que ela anotou continua." acao="Tirar" onConfirm={() => faz("tirar", () => C.tirar(m.id))} />)}
        <ConfirmButton label="Sair da casa" titulo="Sair da casa?" texto={sozinho ? "A casa e os gastos dela somem." : souDono ? "Você deixa de ver os gastos da casa. Quem entrou primeiro passa a cuidar dela." : "Você deixa de ver os gastos da casa."} acao="Sair" onConfirm={() => faz("sair", () => C.sair())} />
      </div>}
    </Sheet>
  );
}

function GastoCasa({ C, inicial, onFim, act }) {
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
    vibrar("ok"); act.toast(inicial ? "Gasto da casa atualizado" : `Gasto da casa anotado: ${brlReal(v)}`); onFim();
  };
  return (
    <div className="stack casa-form">
      <label className="big-amt" htmlFor="cg-v"><span>R$</span><input id="cg-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} aria-label="Valor" /></label>
      <div className="fields"><Field label="O que foi" htmlFor="cg-d"><input id="cg-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: Mercado do mês, Luz, Pizza" autoComplete="off" /></Field></div>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATEGORIAS.filter(c => c.id !== "outros").slice(0, 6).map(c => <button key={c.id} type="button" className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>{c.nome}</button>)}</div>
      {C.membros.length > 1 && <>
        <div className="hint">Quem pagou</div>
        <div className="casa-chips" role="radiogroup" aria-label="Quem pagou">{C.membros.map(m => <button key={m.id} type="button" className={pagou === m.id ? "on" : ""} onClick={() => setPagou(m.id)}><Pessoa m={m} />{nome(m)}</button>)}</div>
        <div className="hint">Dividir entre</div>
        <div className="casa-chips" role="group" aria-label="Dividir entre">{C.membros.map(m => <button key={m.id} type="button" className={parts.has(m.id) ? "on" : ""} onClick={() => setParts(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}>{parts.has(m.id) && <I.check />}{nome(m)}</button>)}</div>
        {v > 0 && parts.size > 0 && <div className="hint">Cada um fica com {brlReal(v / parts.size)}.</div>}
      </>}
      <div className="fields"><Field label="Quando" htmlFor="cg-dt"><input id="cg-dt" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field></div>
      <div className="btn-row"><button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Anotar"}</button><button className="btn ghost" onClick={onFim}>Cancelar</button></div>
      {inicial && <ConfirmButton label="Apagar este gasto" titulo="Apagar o gasto da casa?" texto="Ele some para todas as pessoas da casa." acao="Apagar" onConfirm={async () => { await C.apagar("lanc", inicial.id); onFim(); }} />}
    </div>
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
        {info ? <p><b>{info.convidou || "Alguém"}</b> te chamou para dividir as contas da casa <b>“{info.casa}”</b> ({info.pessoas} {info.pessoas === 1 ? "pessoa" : "pessoas"}).<br /><br />Vocês vão ver os gastos da casa e quem deve quanto. <b>Seus gastos pessoais continuam só seus.</b></p>
          : !erro ? <p>Abrindo o convite…</p> : null}
      </div>
      {erro && <div className="error">{erro}</div>}
      {info && <button className="btn mode" disabled={ocupado} onClick={entrar}><I.check /> {ocupado ? "Entrando…" : "Entrar na casa"}</button>}
      <button className="btn text" onClick={onClose}>Agora não</button>
    </Sheet>
  );
}
