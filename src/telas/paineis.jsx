// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { todayISO, addDays, PERFIL, itensDoDia, registroPendente, contaDinheiro, Sheet, diaCurto, I, iniciais, corDe, relativo, brl, dm, copiarTexto, mensagem, Money, soma, fromISO, segunda, feriado, vencimento, semanaKey, horariosLivres, DIA_LONGO, hTxt, Seg, primeiro } from "../App.jsx";

const waLink = (phone, txt) => { const d = (phone || "").replace(/\D/g, ""); const f = d.length >= 10 && d.length <= 11 ? "55" + d : d; return `https://wa.me/${f}?text=${encodeURIComponent(txt)}`; };

const msgConfirma = (p, iso, time) => `Oi, ${primeiro(p.name)}! Tudo bem? Confirmando nossa sessão ${iso === addDays(todayISO(), 1) ? "amanhã" : `de ${DIA_LONGO[fromISO(iso).getDay()]}`} (${dm(iso)}) às ${time}. Até lá!`;

function FecharDia({ db, conta, onClose, act }) {
  const t = todayISO();
  const amanha = addDays(t, 1);
  const etapas = ["sessoes", ...(PERFIL.registro === false ? [] : ["registros"]), "cobrancas", "amanha", ...(PERFIL.pessoal !== false ? ["gastos"] : []), "fim"];
  const [i, setI] = useState(0);
  const e = etapas[i];
  const hoje = itensDoDia(db, t);
  const abertosHoje = hoje.filter(x => x.kind === "next");
  const regs = registroPendente(db);
  const cobr = db.charges.filter(c => !c.paid);
  const amanhaIts = itensDoDia(db, amanha).filter(x => x.kind !== "log");
  const gastosHoje = (db.pessoal.lanc || []).filter(l => l.data === t);
  const feitos = hoje.filter(x => x.kind === "log" && contaDinheiro(x.session));
  const pac = id => db.patients.find(p => p.id === id) || { name: "Removido" };
  const titulos = { sessoes: "Sessões de hoje", registros: "Registros das sessões", cobrancas: "Quem precisa ser cobrado", amanha: "Amanhã", gastos: "Gastos de hoje", fim: "Dia fechado" };
  const prox = () => { if (i < etapas.length - 1) setI(i + 1); };
  useEffect(() => { if (e === "fim") act.marcarFechado(t); }, [e]);
  return (
    <Sheet title={titulos[e]} sub={e === "fim" ? diaCurto(t) : `Passo ${i + 1} de ${etapas.length - 1} para fechar o dia`} onClose={onClose}>
      <div className="ob-prog" style={{ gridTemplateColumns: `repeat(${etapas.length},1fr)` }} aria-hidden="true">{etapas.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
      {e === "sessoes" && (abertosHoje.length === 0
        ? <div className="note mint"><I.check /><span>Todas as sessões de hoje estão marcadas.</span></div>
        : <div className="panel">{abertosHoje.map(x => (
            <div className="txn" key={x.patient.id}>
              <span className="txn-av">{iniciais(x.patient.name)}<i className="cdot" style={{ background: corDe(x.patient).cor }} /></span>
              <span className="mid"><span className="nm">{x.patient.name}</span><span className="sb">{x.time}</span></span>
              <button className="pill go" style={{ height: 40, padding: "0 14px" }} onClick={() => act.rapido(x.patient.id, "done", true)}><I.check /> Veio</button>
              <button className="pill no" style={{ height: 40, padding: "0 12px", background: "var(--surface-2)" }} onClick={() => act.rapido(x.patient.id, "missed", true)}>Faltou</button>
            </div>))}</div>)}
      {e === "registros" && (regs.length === 0
        ? <div className="note mint"><I.check /><span>Nenhum registro pendente.</span></div>
        : <><div className="hint">Toque para marcar o que você já registrou. Eu guardo só o "feito", nunca o conteúdo.</div>
          <div className="panel">{regs.map(s => (
            <button className="txn" key={s.id} onClick={() => act.toggleRegistro(s.id)}>
              <span className="txn-av">{iniciais(pac(s.patientId).name)}</span>
              <span className="mid"><span className="nm">{pac(s.patientId).name}</span><span className="sb">{relativo(s.date)} · {s.time}</span></span>
              <span className={"box " + (s.registro ? "done" : "up")}>{s.registro && <I.check />}</span>
            </button>))}</div></>)}
      {e === "cobrancas" && (cobr.length === 0
        ? <div className="note mint"><I.check /><span>Ninguém devendo agora.</span></div>
        : <div className="panel">{cobr.map(c => (
            <div className="txn" key={c.id}>
              <span className="txn-av">{iniciais(pac(c.patientId).name)}</span>
              <span className="mid"><span className="nm">{pac(c.patientId).name}</span><span className="sb num">{brl(c.amount)} · desde {dm(c.createdAt)}</span></span>
              <button className="bub-act" onClick={() => copiarTexto(mensagem(db, c, conta.nome), act, "Mensagem copiada")}><I.copy />Copiar</button>
            </div>))}</div>)}
      {e === "amanha" && (amanhaIts.length === 0
        ? <div className="note"><I.sun /><span>Amanhã está livre de sessões.</span></div>
        : <><div className="hint">Mande a confirmação agora e tire isso da cabeça.</div>
          <div className="panel">{amanhaIts.map(x => {
            const ok = db.confirmados[`${x.patient.id}:${amanha}`];
            const txt = msgConfirma(x.patient, amanha, x.time);
            return (
              <div className="txn" key={x.patient.id}>
                <span className="txn-av">{iniciais(x.patient.name)}</span>
                <span className="mid"><span className="nm">{x.patient.name}</span><span className="sb">{x.time}{ok && <span className="chip mint">Confirmado</span>}</span></span>
                <button className="bub-act" onClick={() => { copiarTexto(txt, act, "Confirmação copiada"); act.setConfirmado(x.patient.id, amanha, true); }}><I.copy />Copiar</button>
              </div>);
          })}</div></>)}
      {e === "gastos" && <>
        <div className="note"><I.wallet /><span>{gastosHoje.length ? `Você anotou ${gastosHoje.length} ${gastosHoje.length === 1 ? "lançamento" : "lançamentos"} hoje.` : "Nenhum gasto anotado hoje. Lembra de algum?"}</span></div>
        <button className="btn ghost" onClick={() => { onClose(); act.falarGasto(); }}><I.mic /> Anotar falando</button>
      </>}
      {e === "fim" && <>
        <span className="rc-chip center"><span className="rc-ic"><I.check /></span>Dia fechado</span>
        <div className="rc-amt"><Money v={soma(feitos, x => x.session.price - x.session.sublet)} /></div>
        <div className="rc-cap">{feitos.length} {feitos.length === 1 ? "sessão" : "sessões"} hoje</div>
        <hr className="dash" />
        <div className="rc-rows">
          <div className="rc-row"><span className="l">Amanhã</span><span className="v">{amanhaIts.length ? amanhaIts.map(x => x.time).join(" · ") : "livre"}</span></div>
          <div className="rc-row"><span className="l">Para cobrar</span><span className="v">{cobr.length ? brl(soma(cobr, c => c.amount)) : "nada"}</span></div>
        </div>
        <div className="hint" style={{ textAlign: "center" }}>Pode desligar. O resto fica comigo.</div>
        <button className="btn" onClick={onClose}>Boa noite</button>
      </>}
      {e !== "fim" && <button className="btn" onClick={prox}>{i === etapas.length - 2 ? "Fechar o dia" : "Próximo"}</button>}
    </Sheet>
  );
}

function RevisaoSheet({ db, onClose, act }) {
  const t = todayISO();
  const ini = fromISO(t).getDay() === 0 ? segunda(t) : addDays(segunda(t), -7); // domingo: semana atual; outros dias: semana passada
  const fim = addDays(ini, 6), iniAnt = addDays(ini, -7);
  const naSemana = (a, b) => s => s.date >= a && s.date <= b;
  const feitas = db.sessions.filter(s => contaDinheiro(s) && naSemana(ini, fim)(s));
  const faltas = db.sessions.filter(s => s.status === "missed" && naSemana(ini, fim)(s)).length;
  const liq = soma(feitas, s => s.price - s.sublet);
  const liqAnt = soma(db.sessions.filter(s => contaDinheiro(s) && naSemana(iniAnt, addDays(ini, -1))(s)), s => s.price - s.sublet);
  const pIni = addDays(fim, 1), pFim = addDays(pIni, 6);
  let proxSessoes = 0; const feriadosProx = [];
  for (let d = pIni; d <= pFim; d = addDays(d, 1)) { proxSessoes += itensDoDia(db, d).filter(i => i.kind !== "log").length; if (feriado(d)) feriadosProx.push(`${feriado(d).name} (${dm(d)})`); }
  const contasProx = PERFIL.pessoal === false ? [] : db.pessoal.contas.filter(c => { const v = vencimento(c, pIni.slice(0, 7)); return v >= pIni && v <= pFim && !(c.pagas && c.pagas[pIni.slice(0, 7)]); });
  const dif = liq - liqAnt;
  useEffect(() => { act.marcarRevisao(semanaKey(t)); }, []);
  return (
    <Sheet onClose={onClose}>
      <span className="rc-chip center"><span className="rc-ic blue"><I.chart /></span>Semana de {dm(ini)} a {dm(fim)}</span>
      <div className="rc-amt"><Money v={liq} /></div>
      <div className="rc-cap">{dif === 0 ? "igual à semana anterior" : `${dif > 0 ? "+" : "−"}${brl(Math.abs(dif))} que a semana anterior`}</div>
      <hr className="dash" />
      <div className="rc-rows">
        <div className="rc-row"><span className="l">Sessões</span><span className="v">{feitas.length}</span></div>
        <div className="rc-row"><span className="l">Faltas</span><span className="v">{faltas}</span></div>
        <div className="rc-row"><span className="l">Para cobrar</span><span className="v">{brl(soma(db.charges.filter(c => !c.paid), c => c.amount))}</span></div>
      </div>
      <h3 className="section-title">Próxima semana</h3>
      <div className="rc-rows">
        <div className="rc-row"><span className="l">Sessões marcadas</span><span className="v">{proxSessoes}</span></div>
        {feriadosProx.length > 0 && <div className="rc-row"><span className="l">Feriado</span><span className="v" style={{ color: "var(--rose)" }}>{feriadosProx.join(", ")}</span></div>}
        {contasProx.length > 0 && <div className="rc-row"><span className="l">Contas vencendo</span><span className="v">{contasProx.map(c => c.nome).join(", ")}</span></div>}
      </div>
      <button className="btn" onClick={onClose}>Fechado, boa semana</button>
    </Sheet>
  );
}

function ConfirmSheet({ db, iso, onClose, act }) {
  const its = itensDoDia(db, iso).filter(i => i.kind !== "log");
  const conf = db.confirmados || {};
  const feitos = its.filter(x => conf[`${x.patient.id}:${iso}`]).length;
  return (
    <Sheet title={`Confirmar ${relativo(iso).toLowerCase()}`} sub={`${relativo(iso).toLowerCase() === diaCurto(iso).toLowerCase() ? "" : diaCurto(iso) + " · "}${its.length} ${its.length === 1 ? "sessão" : "sessões"}`} onClose={onClose}>
      {its.length === 0 && <div className="empty">Nenhuma sessão nesse dia.</div>}
      {its.length > 0 && (
        <div className="conf-prog" aria-live="polite">
          <span><b>{feitos} de {its.length}</b> {feitos === its.length ? "confirmadas. Tudo certo!" : "confirmadas"}</span>
          <div className="conf-bar"><i style={{ width: `${(feitos / its.length) * 100}%` }} /></div>
        </div>
      )}
      <div className="conf-lista">
        {its.map(x => {
          const ok = !!conf[`${x.patient.id}:${iso}`], txt = msgConfirma(x.patient, iso, x.time);
          return (
            <div className={"conf-item" + (ok ? " ok" : "")} key={x.patient.id}>
              <div className="conf-top">
                <span className="txn-av">{iniciais(x.patient.name)}<i className="cdot" style={{ background: corDe(x.patient).cor }} /></span>
                <span className="mid"><b>{x.patient.name}</b><small>{x.time}{ok ? " · confirmado" : ""}</small></span>
                <button className={"box " + (ok ? "done" : "up")} onClick={() => act.setConfirmado(x.patient.id, iso, !ok)} aria-label={ok ? "Desmarcar confirmação" : "Marcar como confirmado"}>{ok && <I.check />}</button>
              </div>
              <p className="conf-msg">{txt}</p>
              <div className="conf-acoes">
                <a className="conf-wa" href={waLink(x.patient.phone, txt)} target="_blank" rel="noopener noreferrer" onClick={() => act.setConfirmado(x.patient.id, iso, true)}><I.send /> {ok ? "Enviar de novo" : "Enviar no WhatsApp"}</a>
                <button className="conf-copy" onClick={() => { copiarTexto(txt, act, "Confirmação copiada"); act.setConfirmado(x.patient.id, iso, true); }} aria-label="Copiar mensagem"><I.copy /></button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function LivresSheet({ db, onClose, act }) {
  const inicio = addDays(todayISO(), 1);
  const [dias, setDias] = useState(7);
  const [fora, setFora] = useState({});
  const lista = horariosLivres(db, inicio, dias);
  const texto = "Olá! Tenho estes horários livres " + (dias === 7 ? "nos próximos dias" : "nas próximas semanas") + ":\n" + lista.map(d => {
    const hs = d.livres.filter(m => !fora[d.iso + m]);
    return hs.length ? `• ${DIA_LONGO[fromISO(d.iso).getDay()].replace(/^./, c => c.toUpperCase())} (${dm(d.iso)}): ${hs.map(hTxt).join(", ")}` : null;
  }).filter(Boolean).join("\n") + "\n\nSe algum servir, me chama por aqui.";
  return (
    <Sheet title="Horários livres" sub={`Entre ${PERFIL.horaIni ?? 8}h e ${PERFIL.horaFim ?? 20}h · toque para tirar um horário`} onClose={onClose}>
      <Seg value={dias} onChange={setDias} options={[{ v: 7, l: "Próximos 7 dias" }, { v: 14, l: "14 dias" }]} />
      {lista.length === 0 && <div className="empty"><b>Agenda cheia</b>Nenhum horário livre nesse período.</div>}
      {lista.map(d => (
        <div key={d.iso}>
          <div className="day-sep" style={{ color: feriado(d.iso) ? "var(--rose)" : undefined }}>{diaCurto(d.iso)}</div>
          <div className="slots">{d.livres.map(m => <button key={m} className={"slot" + (fora[d.iso + m] ? " off" : "")} onClick={() => setFora({ ...fora, [d.iso + m]: !fora[d.iso + m] })}>{hTxt(m)}</button>)}</div>
        </div>
      ))}
      {lista.length > 0 && <>
        <textarea className="msg" style={{ minHeight: 150 }} readOnly value={texto} aria-label="Texto para divulgar" />
        <button className="btn" onClick={() => copiarTexto(texto, act, "Horários copiados")}><I.copy /> Copiar texto</button>
      </>}
    </Sheet>
  );
}

function RegistrosSheet({ db, onClose, act }) {
  const regs = db.sessions.filter(s => s.status === "done" && s.date >= addDays(todayISO(), -7)).sort((a, b) => b.date.localeCompare(a.date));
  const pac = id => db.patients.find(p => p.id === id) || { name: "Removido" };
  return (
    <Sheet title="Registros das sessões" sub="Últimos 7 dias. Eu guardo só o “feito”, nunca o conteúdo." onClose={onClose}>
      <div className="panel">
        {regs.length === 0 && <div className="empty">Nenhuma sessão nos últimos 7 dias.</div>}
        {regs.map(s => (
          <button className="txn" key={s.id} onClick={() => act.toggleRegistro(s.id)}>
            <span className="txn-av">{iniciais(pac(s.patientId).name)}</span>
            <span className="mid"><span className="nm">{pac(s.patientId).name}</span><span className="sb">{relativo(s.date)} · {s.time}</span></span>
            <span className={"box " + (s.registro ? "done" : "up")}>{s.registro && <I.check />}</span>
          </button>
        ))}
      </div>
      <button className="btn" onClick={onClose}>Pronto</button>
    </Sheet>
  );
}

export { FecharDia, RegistrosSheet, RevisaoSheet, ConfirmSheet, LivresSheet };
