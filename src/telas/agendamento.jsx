// Link de agendamento: o paciente vê os horários livres e pede um; você aprova com um toque.
// O paciente abre a página public/agendar/ (sem login); os horários e os pedidos passam pelo servidor (src/link.js).
import React, { useState, useEffect } from "react";
import { I, Field, Seg, Toggle, Sheet, todayISO, fromISO, pad, DIA_CURTO, DIA_LONGO, diaCurto, dm, horariosLivres, primeiro, iniciais, copiarTexto, vibrar, termoDe } from "../App.jsx";
import { PERIODOS, NOME_PERIODO, MODELOS, periodosDo } from "../horarios.js";
import { linkDo, enderecoLink } from "../link.js";
const waLink = (phone, txt) => { const d = String(phone || "").replace(/\D/g, ""); const f = d.length >= 10 && d.length <= 11 ? "55" + d : d; return `https://wa.me/${f}?text=${encodeURIComponent(txt)}`; };
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

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
        : `Oi, ${primeiro(p.nome)}! Esse horário não vai dar.${linkDo(conta.perfil).endereco ? ` Escolha outro por aqui: ${enderecoLink(linkDo(conta.perfil).endereco, p.pid)}` : " Me fala outro dia e horário que fica bom para você?"}` }, ...l]);
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
  const cfg = linkDo(conta.perfil), L = act.link || {};
  const T = termoDe((conta.perfil || {}).termo || "Paciente");
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(!cfg.endereco);
  const salvar = patch => act.salvarPerfil({ perfil: { ...(conta.perfil || {}), link: { ...cfg, ...patch } } }, db.settings.pix || "");
  // abrir esta tela cria o link (na primeira vez) e manda os horários de agora
  useEffect(() => {
    if (!L.pode) return;
    L.publicar(true).then(() => setErro("")).catch(e => setErro(e.message)).finally(() => setCriando(false));
    L.buscar();
  }, []);
  const url = enderecoLink(cfg.endereco);
  const livres = livresDoLink(db, cfg);
  const nHor = livres.reduce((s, d) => s + d.livres.length, 0);

  if (!L.pode) return (
    <div className="stack">
      <div className="note"><I.cloud /><span>O link de agendamento precisa da sua conta com login (com a cópia na nuvem) e de internet.</span></div>
    </div>
  );
  return (
    <div className="stack">
      <div className="link-card">
        <small>Seu link</small>
        {url ? <>
          <b className="link-url">{url.replace(/^https?:\/\//, "")}</b>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => copiarTexto(url, act, "Link copiado")}><I.copy /> Copiar</button>
            <a className="btn ghost" href={waLink("", `Para marcar ou remarcar um horário comigo, é só escolher aqui: ${url}`)} target="_blank" rel="noopener"><I.send /> WhatsApp</a>
          </div>
          <a className="btn mode" href={url} target="_blank" rel="noopener"><I.eye /> Abrir como o {T.s} vê</a>
        </> : <b className="link-url">{criando ? "Criando o seu link…" : "Não deu para criar o link agora"}</b>}
      </div>
      {erro && <div className="error" role="alert">{erro} {!url && <button type="button" className="link" onClick={() => { setCriando(true); L.publicar(true).then(() => setErro("")).catch(e => setErro(e.message)).finally(() => setCriando(false)); }}>Tentar de novo</button>}</div>}
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
      <div className="hint">Os horários saem dos seus dias e períodos (em Agenda), tirando o que já está marcado. Nada entra na agenda sem você aceitar. Quando chega um pedido, ele aparece aqui e no Início, com um aviso no celular se os avisos estiverem ligados.</div>
      {cfg.quem === "pacientes" && <div className="hint">Em “Só remarcar”, quem não é seu {T.s} vê a agenda fechada. Quando você recusa um pedido, o app manda o link para a pessoa escolher outro horário.</div>}
    </div>
  );
}

export { GradeHorarios, LinkAgendamento, PedidosSheet, linkDo };
