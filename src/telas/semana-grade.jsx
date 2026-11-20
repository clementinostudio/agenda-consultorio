// A semana em grade da Agenda no computador: um dia por coluna e as horas de cima para baixo. Arrastar a próxima
// sessão de alguém remarca (com Desfazer); clicar num horário vazio cadastra alguém ali.
import React, { useState, useRef } from "react";
import { SEMANA, addDays, agoraMin, fromISO, hhmm, mins, pad, segunda, todayISO } from "../datas.js";
import { confirmacaoDe } from "../link.js";
import { DURACAO_SESSAO, PERFIL, ROTULO, corVars, feriado, itensDoDia, situacao, vibrar } from "../App.jsx";

// A semana em grade (computador): um dia por coluna e as horas de cima para baixo, como num calendário.
// Arrastar a próxima sessão de alguém remarca (com Desfazer); clicar num horário vazio cadastra alguém ali.
const PX_HORA = 56, PASSO_MIN = 15;
export function SemanaGrade({ db, sel, setSel, now, act }) {
  const t = todayISO(), ini = segunda(sel), nm = agoraMin(now);
  const dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  const porDia = dias.map(iso => itensDoDia(db, iso));
  // as horas vão do início ao fim do expediente, e esticam se tiver sessão fora dele
  const todos = porDia.flat().map(i => mins(i.time));
  const hIni = Math.min(PERFIL.horaIni ?? 8, ...todos.map(m => Math.floor(m / 60)));
  const hFim = Math.max(PERFIL.horaFim ?? 20, ...todos.map(m => Math.ceil((m + DURACAO_SESSAO) / 60)));
  const horas = Array.from({ length: hFim - hIni }, (_, i) => hIni + i);
  const corpo = useRef(null);
  const [arr, setArr] = useState(null); // { it, x0, y0, dx, dy, moveu, alvo: { iso, min } }
  const yDe = m => (m - hIni * 60) / 60 * PX_HORA;
  const alvoDe = (x, y) => {
    const r = corpo.current.getBoundingClientRect(), col = Math.min(6, Math.max(0, Math.floor((x - r.left) / (r.width / 7))));
    const min = Math.round((hIni * 60 + (y - r.top) / PX_HORA * 60) / PASSO_MIN) * PASSO_MIN;
    return { iso: dias[col], min: Math.min(hFim * 60 - DURACAO_SESSAO, Math.max(hIni * 60, min)) };
  };
  const podeArrastar = it => it.kind === "next" && it.date >= t;
  const pegar = (e, it) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArr({ it, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moveu: false, alvo: null });
  };
  const mover = e => {
    if (!arr) return;
    const dx = e.clientX - arr.x0, dy = e.clientY - arr.y0, moveu = arr.moveu || Math.abs(dx) + Math.abs(dy) > 6;
    setArr({ ...arr, dx, dy, moveu, alvo: moveu && podeArrastar(arr.it) ? alvoDe(e.clientX, e.clientY) : null });
  };
  const soltar = () => {
    if (!arr) return;
    const { it, moveu, alvo } = arr; setArr(null);
    if (!moveu) return act.openItem(it);
    if (alvo && (alvo.iso !== it.date || hhmm(alvo.min) !== it.time)) {
      if (alvo.iso < t || (alvo.iso === t && alvo.min < nm)) { vibrar("aviso"); return act.toast("Escolha um horário daqui para a frente"); }
      act.moverSessao(it.patient.id, alvo.iso, hhmm(alvo.min));
    }
  };
  const clicarVazio = (e, iso) => {
    if (e.target !== e.currentTarget) return;
    const { min } = alvoDe(e.clientX, e.clientY);
    if (iso < t) return;
    act.novoPacienteEm(iso, hhmm(Math.floor(min / 30) * 30));
  };
  // sessões que se cruzam no mesmo dia dividem a largura
  const faixas = itens => {
    const out = []; let grupo = [], fim = -1;
    const fecha = () => grupo.forEach((x, k) => out.push({ ...x, k, n: grupo.length }));
    itens.forEach(it => { const a = mins(it.time); if (a >= fim && grupo.length) { fecha(); grupo = []; } grupo.push({ it, a }); fim = Math.max(fim, a + DURACAO_SESSAO); });
    fecha();
    return out;
  };
  return (
    <section className="sg" aria-label="Semana em grade">
      <div className="sg-cab">
        <span />
        {dias.map((iso, i) => {
          const d = fromISO(iso), n = porDia[i].filter(x => situacao(x, now) !== "missed").length;
          return (
            <button key={iso} className={"sg-dia" + (iso === t ? " eh-hoje" : "") + (iso === sel ? " sel" : "") + (feriado(iso) ? " hol" : "")} onClick={() => setSel(iso)} title={feriado(iso) ? feriado(iso).name : undefined}>
              <small>{SEMANA[i]}</small><b className="num">{d.getDate()}</b>{n > 0 && <em className="num">{n}</em>}
            </button>
          );
        })}
      </div>
      <div className="sg-rolar">
        <div className="sg-grade" style={{ height: horas.length * PX_HORA }}>
          <div className="sg-horas">{horas.map(h => <span key={h} style={{ top: (h - hIni) * PX_HORA }}>{pad(h)}:00</span>)}</div>
          <div className="sg-corpo" ref={corpo} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={() => setArr(null)}>
            {horas.map(h => <i key={h} className="sg-linha" style={{ top: (h - hIni) * PX_HORA }} />)}
            {dias.map((iso, i) => (
              <div key={iso} className={"sg-col" + (iso === t ? " eh-hoje" : "") + (iso < t ? " passado" : "") + (!(PERFIL.diasTrab || [1, 2, 3, 4, 5]).includes(fromISO(iso).getDay()) ? " folga" : "")} onClick={e => clicarVazio(e, iso)}>
                {iso === t && nm >= hIni * 60 && nm <= hFim * 60 && <i className="sg-agora" style={{ top: yDe(nm) }} />}
                {faixas(porDia[i]).map(({ it, k, n }) => {
                  const st = situacao(it, now), p = it.patient, segurando = arr && arr.it === it && arr.moveu;
                  const cf = confirmacaoDe((db.confirmados || {})[`${p.id}:${iso}`]);
                  return (
                    <button key={p.id + it.kind + it.time} className={"sg-ses " + st + (podeArrastar(it) ? " arrasta" : "") + (segurando ? " segurando" : "")}
                      style={{ ...corVars(p), top: yDe(mins(it.time)), height: DURACAO_SESSAO / 60 * PX_HORA - 3, left: `calc(${(k / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, ...(segurando ? { transform: `translate(${arr.dx}px, ${arr.dy}px)` } : {}) }}
                      onPointerDown={e => pegar(e, it)} aria-label={`${it.time}, ${p.name}: ${ROTULO[st]}${podeArrastar(it) ? ". Arraste para remarcar" : ""}`}>
                      <b>{p.name}</b>
                      <small className="num">{it.time}{p.online ? " · online" : ""}{cf === "paciente" || cf === "manual" ? " · ✓" : cf === "remarcar" ? " · remarcar" : ""}</small>
                    </button>
                  );
                })}
                {arr && arr.alvo && arr.alvo.iso === iso && <i className="sg-fantasma" style={{ top: yDe(arr.alvo.min), height: DURACAO_SESSAO / 60 * PX_HORA - 3 }}><span className="num">{hhmm(arr.alvo.min)}</span></i>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="sg-dica">Arraste a próxima sessão de alguém para remarcar. Clique num horário vazio para marcar alguém novo.</p>
    </section>
  );
}

