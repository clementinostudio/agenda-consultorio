// Link de agendamento: o paciente vê os horários livres e pede um; você aprova com um toque.
// Por enquanto é demonstração: os pedidos ficam neste aparelho. Com a nuvem ligada, o link abre no celular do paciente.
import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { I, Field, Seg, Toggle, Avatar, Sheet, todayISO, fromISO, pad, DIA_CURTO, DIA_LONGO, diaCurto, dm, horariosLivres, primeiro, iniciais, copiarTexto, vibrar, useCamada, termoDe } from "../App.jsx";
import { normalizar } from "../marcas.js";
import { ENDERECO_APP } from "../nuvem.js";
import { PERIODOS, NOME_PERIODO, MODELOS, periodosDo } from "../horarios.js";

const LINK_PADRAO = { ativo: true, quem: "todos", antecedencia: 24, semanas: 2 };
const linkDo = pf => ({ ...LINK_PADRAO, ...((pf && pf.link) || {}) });
const slugDe = nome => normalizar(nome).replace(/\s+/g, "-") || "agenda";
const enderecoLink = (conta, pid) => `${ENDERECO_APP}agendar/${slugDe(conta.nome)}${pid ? `/${pid}` : ""}`;
const waLink = (phone, txt) => { const d = String(phone || "").replace(/\D/g, ""); const f = d.length >= 10 && d.length <= 11 ? "55" + d : d; return `https://wa.me/${f}?text=${encodeURIComponent(txt)}`; };
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const periodoDe = m => m < 12 * 60 ? "manha" : m < 18 * 60 ? "tarde" : "noite";
const NOMES_DEMO = ["Rafael Nunes", "Beatriz Lopes", "Carla Mendes", "Diego Rocha", "Helena Duarte"];

// Horários que aparecem no link: os livres da agenda, respeitando a antecedência e sem os já pedidos
function livresDoLink(db, cfg, agora = new Date()) {
  const limite = agora.getTime() + cfg.antecedencia * 36e5;
  const pedidos = new Set((db.pedidos || []).map(p => `${p.data} ${p.hora}`));
  return horariosLivres(db, todayISO(), cfg.semanas * 7 + 1)
    .map(d => ({ iso: d.iso, livres: d.livres.filter(m => { const t = fromISO(d.iso); t.setMinutes(m); return t.getTime() >= limite && !pedidos.has(`${d.iso} ${hhmm(m)}`); }) }))
    .filter(d => d.livres.length);
}

// Dias da semana x manhã, tarde e noite: um toque liga ou desliga
function GradeHorarios({ grade, periodos, onGrade, onPeriodos }) {
  const [ajustar, setAjustar] = useState(false);
  const P = periodosDo({ periodos });
  const tem = (d, k) => (grade[d] || []).includes(k);
  const trocar = (d, k) => { const at = grade[d] || []; onGrade({ ...grade, [d]: at.includes(k) ? at.filter(x => x !== k) : PERIODOS.filter(x => x === k || at.includes(x)) }); vibrar("toque"); };
  const diaTodo = d => { onGrade({ ...grade, [d]: PERIODOS.every(k => tem(d, k)) ? [] : [...PERIODOS] }); vibrar("toque"); };
  const mudar = (k, i, delta) => {
    const [a, b] = P[k];
    onPeriodos({ ...periodos, [k]: i === 0 ? [Math.min(b - 1, Math.max(5, a + delta)), b] : [a, Math.max(a + 1, Math.min(23, b + delta))] });
  };
  return (
    <div className="grade">
      <div className="grade-tab">
        <div className="grade-lin cab"><span />{PERIODOS.map(k => <b key={k}>{NOME_PERIODO[k]}<small>{P[k][0]}h–{P[k][1]}h</small></b>)}</div>
        {[1, 2, 3, 4, 5, 6, 0].map(d => (
          <div key={d} className="grade-lin">
            <button type="button" className="grade-dia" onClick={() => diaTodo(d)} aria-label={`${DIA_LONGO[d]}: marcar ou desmarcar o dia todo`}>{DIA_CURTO[d]}</button>
            {PERIODOS.map(k => (
              <button key={k} type="button" className={"grade-cel" + (tem(d, k) ? " on" : "")} aria-pressed={tem(d, k)} aria-label={`${DIA_LONGO[d]} de ${NOME_PERIODO[k].toLowerCase()}`} onClick={() => trocar(d, k)}>
                {tem(d, k) && <I.check />}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="hint">Toque no nome do dia para marcar ou desmarcar o dia todo.</div>
      <div className="chips-wrap">{MODELOS.map(m => <button key={m.id} type="button" className="chip-op" onClick={() => onGrade(m.grade)}>{m.nome}</button>)}</div>
      <button type="button" className="btn text" onClick={() => setAjustar(!ajustar)}>{ajustar ? "Pronto" : "Mudar o horário de cada período"}</button>
      {ajustar && (
        <div className="fields">
          {PERIODOS.map(k => (
            <Field key={k} label={NOME_PERIODO[k]}>
              <div className="stepper">
                <button type="button" aria-label="Começa mais cedo" onClick={() => mudar(k, 0, -1)}>−</button><b className="num">{P[k][0]}h</b><button type="button" aria-label="Começa mais tarde" onClick={() => mudar(k, 0, 1)}>+</button>
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>até</span>
                <button type="button" aria-label="Termina mais cedo" onClick={() => mudar(k, 1, -1)}>−</button><b className="num">{P[k][1]}h</b><button type="button" aria-label="Termina mais tarde" onClick={() => mudar(k, 1, 1)}>+</button>
              </div>
            </Field>
          ))}
        </div>
      )}
    </div>
  );
}

// Pedidos que chegaram pelo link: aceitar põe na agenda; depois, um toque avisa no WhatsApp
function PedidosLista({ db, conta, act }) {
  const [feitos, setFeitos] = useState([]);
  const pedidos = db.pedidos || [];
  if (!pedidos.length && !feitos.length) return null;
  const responder = (p, ok) => {
    const pac = p.pid && db.patients.find(x => x.id === p.pid);
    act.responderPedido(p.id, ok);
    setFeitos(l => [{ id: p.id, nome: p.nome, phone: p.phone || (pac && pac.phone) || "", ok,
      msg: ok ? `Oi, ${primeiro(p.nome)}! Confirmado: ${DIA_LONGO[fromISO(p.data).getDay()]}, ${dm(p.data)}, às ${p.hora}. Até lá!`
        : `Oi, ${primeiro(p.nome)}! Esse horário não vai dar. Escolha outro por aqui: ${enderecoLink(conta, p.pid)}` }, ...l]);
  };
  return (
    <div className="pedidos">
      {feitos.map(f => (
        <div key={f.id} className="pedido feito">
          <span className="mid"><b>{f.ok ? `${primeiro(f.nome)} está na agenda` : `Pedido de ${primeiro(f.nome)} recusado`}</b><small>Falta só avisar</small></span>
          <a className="chip-btn" href={waLink(f.phone, f.msg)} target="_blank" rel="noopener" onClick={() => setFeitos(l => l.filter(x => x.id !== f.id))}><I.send /> Avisar</a>
        </div>
      ))}
      {pedidos.map(p => {
        const pac = p.pid && db.patients.find(x => x.id === p.pid);
        return (
          <div key={p.id} className="pedido">
            <div className="pedido-top">
              <span className="txn-av">{iniciais(p.nome)}</span>
              <span className="mid"><b>{p.nome}</b><small>{p.tipo === "remarcar" ? (pac && pac.nextDate ? `Quer trocar ${diaCurto(pac.nextDate)} às ${pac.time}` : "Quer remarcar") : "Pessoa nova"}</small></span>
            </div>
            <div className="pedido-quando"><I.cal /> {diaCurto(p.data)} às {p.hora}</div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => responder(p, false)}>Recusar</button>
              <button className="btn mode" onClick={() => responder(p, true)}><I.check /> Aceitar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PedidosSheet({ db, conta, act, onClose }) {
  return (
    <Sheet title="Pedidos de horário" sub="Chegaram pelo seu link. Aceitar já coloca na agenda." onClose={onClose}>
      <PedidosLista db={db} conta={conta} act={act} />
      {!(db.pedidos || []).length && <button className="btn" onClick={onClose}>Pronto</button>}
    </Sheet>
  );
}

// Perfil > Link de agendamento
function LinkAgendamento({ db, conta, act }) {
  const cfg = linkDo(conta.perfil);
  const [ver, setVer] = useState(null); // null | "novo" | id do paciente
  const salvar = patch => act.salvarPerfil({ perfil: { ...(conta.perfil || {}), link: { ...cfg, ...patch } } }, db.settings.pix || "");
  const url = enderecoLink(conta);
  const livres = livresDoLink(db, cfg);
  const nHor = livres.reduce((s, d) => s + d.livres.length, 0);
  const ex = db.patients.find(p => p.active);
  const simular = () => {
    const d = livres[Math.min(1, livres.length - 1)];
    if (!d) return act.toast("Não há horário livre no link para simular");
    act.pedirHorario({ tipo: "novo", nome: NOMES_DEMO[(db.pedidos || []).length % NOMES_DEMO.length], phone: "", data: d.iso, hora: hhmm(d.livres[0]) });
  };
  return (
    <div className="stack">
      <div className="link-card">
        <small>Seu link</small>
        <b className="link-url">{url.replace(/^https?:\/\//, "")}</b>
        <div className="btn-row">
          <button className="btn ghost" onClick={() => copiarTexto(url, act, "Link copiado")}><I.copy /> Copiar</button>
          <a className="btn ghost" href={waLink("", `Para marcar ou remarcar um horário comigo, é só escolher aqui: ${url}`)} target="_blank" rel="noopener"><I.send /> WhatsApp</a>
        </div>
        <button className="btn mode" onClick={() => setVer("novo")}><I.eye /> Ver como o {termoDe((conta.perfil || {}).termo || "Paciente").s} vê</button>
      </div>
      <Toggle on={cfg.ativo} onClick={() => salvar({ ativo: !cfg.ativo })}>Aceitar pedidos pelo link</Toggle>
      {cfg.ativo && <div className="hint">{nHor ? `Agora aparecem ${nHor} horários livres no link, ${cfg.semanas === 4 ? "no próximo mês" : `nas próximas ${cfg.semanas === 1 ? "semana" : `${cfg.semanas} semanas`}`}.` : "Nenhum horário livre aparece no link agora. Confira seus dias e períodos em Agenda."}</div>}

      {(db.pedidos || []).length > 0 && <h3 className="section-title">Pedidos <small>{db.pedidos.length}</small></h3>}
      <PedidosLista db={db} conta={conta} act={act} />

      <h3 className="section-title">Regras</h3>
      <div className="fields">
        <Field label="Quem pode pedir"><Seg value={cfg.quem} onChange={v => salvar({ quem: v })} options={[{ v: "todos", l: "Novos e atuais" }, { v: "pacientes", l: "Só remarcar" }]} /></Field>
        <Field label="Antecedência mínima"><Seg value={cfg.antecedencia} onChange={v => salvar({ antecedencia: v })} options={[{ v: 2, l: "2 h" }, { v: 12, l: "12 h" }, { v: 24, l: "1 dia" }, { v: 48, l: "2 dias" }]} /></Field>
        <Field label="Mostrar horários de"><Seg value={cfg.semanas} onChange={v => salvar({ semanas: v })} options={[{ v: 1, l: "1 semana" }, { v: 2, l: "2 semanas" }, { v: 4, l: "1 mês" }]} /></Field>
      </div>
      <div className="hint">Os horários saem dos seus dias e períodos (em Agenda), tirando o que já está marcado. Nada entra na agenda sem você aceitar.</div>
      {ex && <button className="btn ghost" onClick={() => setVer(ex.id)}><I.repeat /> Ver como {primeiro(ex.name)} remarcaria</button>}

      <div className="assin-demo">
        <b>Só na demonstração</b>
        <small>O link passa a abrir no celular do {termoDe((conta.perfil || {}).termo || "Paciente").s} quando ligarmos a nuvem. Por enquanto, os pedidos ficam neste aparelho.</small>
        <button className="btn ghost" onClick={simular}>Simular um pedido</button>
      </div>
      {ver && <PaginaPaciente db={db} conta={conta} pid={ver === "novo" ? null : ver} onClose={() => setVer(null)} onPedir={act.pedirHorario} />}
    </div>
  );
}

// O que o paciente vê ao abrir o link: escolhe o dia, o horário e manda o pedido
function PaginaPaciente({ db, conta, pid, onClose, onPedir }) {
  useCamada(onClose);
  const cfg = linkDo(conta.perfil), pf = conta.perfil || {};
  const pac = pid ? db.patients.find(p => p.id === pid) : null;
  const dias = useMemo(() => livresDoLink(db, cfg), []);
  const [dia, setDia] = useState(dias[0] ? dias[0].iso : null);
  const [hora, setHora] = useState(null);
  const [passo, setPasso] = useState("escolher");
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState("");
  const atual = dias.find(d => d.iso === dia);
  const fechado = !cfg.ativo || (!pac && cfg.quem === "pacientes");
  const quando = hora != null ? `${diaCurto(dia)} às ${hhmm(hora)}` : "";
  const pedir = () => {
    onPedir({ tipo: pac ? "remarcar" : "novo", pid: pac ? pac.id : null, nome: pac ? pac.name : nome.trim(), phone: pac ? pac.phone || "" : fone, data: dia, hora: hhmm(hora) });
    vibrar("ok"); setPasso("ok");
  };
  const prof = primeiro(conta.nome);
  let corpo;
  if (passo === "ok") corpo = (
    <div className="agp-ok">
      <i><I.check /></i>
      <h2>Pedido enviado!</h2>
      <p>{prof} confirma pelo WhatsApp. Seu horário fica marcado depois disso.</p>
      <p className="hint">Precisa mudar depois? É só abrir este link de novo.</p>
      <div className="note mint"><I.eye /><span>Na demonstração, o pedido já apareceu para você em Pedidos.</span></div>
      <button className="btn ghost" onClick={onClose}>Fechar a prévia</button>
    </div>
  );
  else if (fechado) corpo = <div className="agp-ok"><h2>Agenda fechada no momento</h2><p>Para marcar, fale com {prof} pelo WhatsApp.</p></div>;
  else if (!dias.length) corpo = <div className="agp-ok"><h2>Sem horários livres</h2><p>Os próximos horários estão todos ocupados. Fale com {prof} pelo WhatsApp.</p></div>;
  else if (passo === "dados") corpo = <>
    <button className="agp-escolhido" onClick={() => setPasso("escolher")}><I.cal /><span><b>{quando}</b><small>Trocar horário</small></span></button>
    <h2 className="agp-t">Quase lá</h2>
    <div className="fields">
      <Field label="Seu nome" icon={<I.user />} htmlFor="agp-nome"><input id="agp-nome" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome e sobrenome" /></Field>
      <Field label="Seu WhatsApp" icon={<I.phone />} htmlFor="agp-fone"><input id="agp-fone" inputMode="tel" autoComplete="tel" value={fone} onChange={e => setFone(e.target.value)} placeholder="(41) 99999-9999" /></Field>
    </div>
    <div className="agp-pe"><button className="btn mode" disabled={nome.trim().length < 2 || fone.replace(/\D/g, "").length < 10} onClick={pedir}>Pedir este horário</button></div>
  </>;
  else corpo = <>
    {pac && pac.nextDate && <div className="agp-atual"><small>Sua próxima sessão</small><b>{diaCurto(pac.nextDate)} às {pac.time}</b></div>}
    <h2 className="agp-t">{pac ? `Oi, ${primeiro(pac.name)}! Para quando quer mudar?` : "Escolha um horário"}</h2>
    <div className="agp-dias" role="radiogroup" aria-label="Dia">
      {dias.map(d => {
        const dt = fromISO(d.iso);
        return (
          <button key={d.iso} type="button" role="radio" aria-checked={dia === d.iso} className={"agp-dia" + (dia === d.iso ? " on" : "")} onClick={() => { setDia(d.iso); setHora(null); }}>
            <small>{DIA_CURTO[dt.getDay()]}</small><b>{dt.getDate()}</b><small>{diaCurto(d.iso).split(" ").pop()}</small>
          </button>
        );
      })}
    </div>
    {atual && PERIODOS.map(k => {
      const hs = atual.livres.filter(m => periodoDe(m) === k);
      return hs.length ? (
        <div key={k} className="agp-per">
          <h4>{NOME_PERIODO[k]}</h4>
          <div className="agp-horas">{hs.map(m => <button key={m} type="button" className={"agp-hora" + (hora === m ? " on" : "")} aria-pressed={hora === m} onClick={() => setHora(m)}>{hhmm(m)}</button>)}</div>
        </div>
      ) : null;
    })}
    <div className="agp-pe">
      <button className="btn mode" disabled={hora == null} onClick={() => pac ? pedir() : setPasso("dados")}>{hora == null ? "Escolha um horário" : pac ? `Pedir ${quando}` : `Continuar · ${quando}`}</button>
    </div>
  </>;
  return createPortal(
    <div className="agp" role="dialog" aria-modal="true" aria-label="Página de agendamento">
      <div className="agp-demo"><span><I.eye /> Prévia do seu link</span><button className="icon-btn" onClick={onClose} aria-label="Fechar a prévia"><I.x /></button></div>
      <div className="agp-in">
        <div className="agp-quem">
          <Avatar conta={conta} />
          <div><b>{conta.nome}</b><small>{[pf.profissao, `sessão de ${pf.duracao || 50} min`].filter(Boolean).join(" · ")}</small></div>
        </div>
        {corpo}
      </div>
    </div>,
    document.body
  );
}

export { GradeHorarios, LinkAgendamento, PedidosSheet, linkDo };
