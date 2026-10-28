// Trazer da agenda antiga: lê o arquivo do Google Agenda / iPhone (.ics), uma planilha (.csv) ou uma lista colada.
// Tudo é lido aqui no aparelho. Cada nome vira um paciente com dia, horário e frequência.
import React, { useState, useRef } from "react";
import { I, Sheet, CORES, todayISO, addDays, fromISO, pad, DIA_CURTO, dm, num, brl, uid, termoDe } from "../App.jsx";
import { normalizar, semAcentoM } from "../marcas.js";

const FREQS = [7, 14, 28];
const NOME_FREQ = { 7: "toda semana", 14: "a cada 15 dias", 28: "uma vez por mês" };
const NAO_SESSAO = /\b(reuniao|aniversario|dentista|medico|almoco|jantar|academia|supervisao|curso|aula|feriado|viagem|voo|ferias|pagar|lembrete|banco)\b/;
const DIAS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const freqMaisPerto = dias => FREQS.reduce((a, b) => Math.abs(b - dias) < Math.abs(a - dias) ? b : a);
// "Sessão - Ana Souza (online)" -> "Ana Souza"
const limparNome = t => String(t || "").replace(/\(.*?\)/g, " ").replace(/^\s*(sess[aã]o|atendimento|consulta|terapia|psicoterapia|paciente)\s*(com|de|[-–:|])?\s*/i, "").replace(/\s+/g, " ").trim();
// próxima data, a partir de hoje, de quem começou em "ini" e repete a cada "freq" dias
const proximaDe = (iniISO, freq) => { const hoje = todayISO(); let d = iniISO; while (d < hoje) d = addDays(d, freq); return d; };
const proximoDia = dow => { const hoje = todayISO(); return addDays(hoje, (dow - fromISO(hoje).getDay() + 7) % 7); };

/* ---------- .ics (Google Agenda, iPhone, Outlook) ---------- */
function lerDataICS(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m || !m[4]) return null; // dia inteiro não é sessão
  return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
function lerICS(txt) {
  const linhas = txt.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const evs = []; let ev = null;
  for (const l of linhas) {
    if (l === "BEGIN:VEVENT") ev = {};
    else if (l === "END:VEVENT") { if (ev && ev.titulo && ev.ini && ev.status !== "CANCELLED") evs.push(ev); ev = null; }
    else if (ev) {
      const i = l.indexOf(":"); if (i < 0) continue;
      const k = l.slice(0, i).split(";")[0], v = l.slice(i + 1);
      if (k === "SUMMARY") ev.titulo = v.replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " ");
      else if (k === "DTSTART") ev.ini = lerDataICS(v);
      else if (k === "RRULE") ev.rrule = v;
      else if (k === "STATUS") ev.status = v;
    }
  }
  const hoje = todayISO(), desde = addDays(hoje, -120), g = new Map();
  evs.forEach(e => {
    const nome = limparNome(e.titulo); if (nome.length < 2) return;
    const k = normalizar(nome), it = g.get(k) || { nome, datas: [], regra: null };
    if (e.rrule && /FREQ=WEEKLY/.test(e.rrule)) {
      const ate = (e.rrule.match(/UNTIL=(\d{8})/) || [])[1];
      if (!ate || `${ate.slice(0, 4)}-${ate.slice(4, 6)}-${ate.slice(6, 8)}` >= hoje) it.regra = { ini: e.ini, freq: freqMaisPerto(7 * Number((e.rrule.match(/INTERVAL=(\d+)/) || [])[1] || 1)) };
    } else if (isoDe(e.ini) >= desde) it.datas.push(e.ini);
    g.set(k, it);
  });
  return [...g.values()].map(it => {
    if (it.regra) return { nome: it.nome, freq: it.regra.freq, time: hhmm(it.regra.ini), nextDate: proximaDe(isoDe(it.regra.ini), it.regra.freq), certeza: true };
    if (!it.datas.length) return null;
    const ds = it.datas.sort((a, b) => a - b), ult = ds[ds.length - 1];
    const saltos = ds.slice(1).map((d, i) => Math.round((d - ds[i]) / 864e5)).filter(x => x > 0).sort((a, b) => a - b);
    const freq = saltos.length ? freqMaisPerto(saltos[Math.floor(saltos.length / 2)]) : 7;
    const horas = {}; ds.forEach(d => { horas[hhmm(d)] = (horas[hhmm(d)] || 0) + 1; });
    const futura = ds.find(d => isoDe(d) >= hoje);
    return { nome: it.nome, freq, time: Object.entries(horas).sort((a, b) => b[1] - a[1])[0][0], nextDate: futura ? isoDe(futura) : proximaDe(isoDe(ult), freq), certeza: ds.length >= 2 };
  }).filter(Boolean);
}

/* ---------- lista colada ou planilha: "Ana Souza, quinta, 14h, 150" ---------- */
function lerLinha(l, valorPadrao) {
  const t = normalizar(l), bruto = semAcentoM(l);
  const dia = t.match(/\b(dom|seg|ter|qua|qui|sex|sab)(?:ingo|unda|ca|rta|nta|ta|ado)?\b/);
  // "14h", "14h30", "18:30" (o valor que vem depois, "14h 150", não vira minuto)
  const h = bruto.match(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2}(?!\d))?/);
  const nome = l.split(/[,;\t|]|\s[-–]\s/)[0].replace(/^\s*\d+[.)]\s*/, "").trim();
  if (!nome || !dia || !h || /\d/.test(nome)) return null;
  const sem = l.replace(/\b\d{1,2}\s*(?:h|:)\s*(?:\d{2}(?!\d))?/gi, " ");
  const valor = (sem.match(/(?:r\$\s*)?(\d{2,4}(?:[.,]\d{2})?)(?!\d)/i) || [])[1];
  const freq = /quinzen|15 em 15|a cada 15/.test(t) ? 14 : /mensal|por mes|1x no mes/.test(t) ? 28 : 7;
  return { nome, freq, time: `${pad(Math.min(23, Number(h[1])))}:${pad(Number(h[2] || 0))}`, nextDate: proximoDia(DIAS[dia[1]]), price: valor ? num(valor) : valorPadrao, certeza: true };
}
function lerLista(txt, valorPadrao) {
  const linhas = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // planilha com cabeçalho: junta as colunas na ordem que a leitura de linha entende
  if (linhas.length && /\bnome\b/i.test(linhas[0])) {
    const sep = linhas[0].includes(";") ? ";" : linhas[0].includes("\t") ? "\t" : ",";
    const cab = linhas[0].split(sep).map(c => normalizar(c));
    const col = re => cab.findIndex(c => re.test(c));
    const iN = col(/nome/), iD = col(/dia/), iH = col(/hora|horario/), iV = col(/valor|preco/), iF = col(/freq/), iT = col(/telefone|celular|whatsapp|fone/);
    return linhas.slice(1).map(l => {
      const c = l.split(sep).map(x => x.trim().replace(/^"|"$/g, ""));
      const r = lerLinha([c[iN], c[iD], c[iH] && /h|:/.test(c[iH]) ? c[iH] : `${c[iH]}h`, iV >= 0 ? c[iV] : "", iF >= 0 ? c[iF] : ""].join(", "), valorPadrao);
      return r && iT >= 0 ? { ...r, phone: c[iT] || "" } : r;
    }).filter(Boolean);
  }
  return linhas.map(l => lerLinha(l, valorPadrao)).filter(Boolean);
}

const EXEMPLO_ICS = (() => {
  const d = (off, h) => { const x = fromISO(addDays(todayISO(), off)); return `${isoDe(x).replace(/-/g, "")}T${pad(h)}0000`; };
  const ev = (t, ini, extra = "") => `BEGIN:VEVENT\nSUMMARY:${t}\nDTSTART:${ini}\n${extra}END:VEVENT`;
  return ["BEGIN:VCALENDAR",
    ev("Sessão - Renata Alves", d(-14, 9), "RRULE:FREQ=WEEKLY\n"),
    ev("Paulo Henrique (online)", d(-12, 17), "RRULE:FREQ=WEEKLY;INTERVAL=2\n"),
    ev("Atendimento: Sofia Ramos", d(-20, 11)), ev("Atendimento: Sofia Ramos", d(-13, 11)), ev("Atendimento: Sofia Ramos", d(-6, 11)),
    ev("Dentista", d(3, 15)), ev("Reunião do condomínio", d(5, 20)),
    "END:VCALENDAR"].join("\n");
})();

function ImportarAgendaSheet({ db, perfil, act, onClose }) {
  const [passo, setPasso] = useState("escolher");
  const [texto, setTexto] = useState("");
  const [achados, setAchados] = useState([]);
  const [erro, setErro] = useState("");
  const arq = useRef(null);
  const T = termoDe(perfil.termo || "Paciente"), valorPadrao = perfil.valorPadrao || 0;
  const jaTem = new Set(db.patients.map(p => normalizar(p.name)));
  const mostrar = lista => {
    const l = lista.map((x, i) => {
      const repetido = jaTem.has(normalizar(x.nome));
      return { ...x, i, price: x.price || valorPadrao, repetido, on: !repetido && x.certeza && !NAO_SESSAO.test(normalizar(x.nome)) };
    });
    if (!l.length) return setErro("Não achei nenhum horário que se repete. Confira o arquivo ou tente colar uma lista.");
    setErro(""); setAchados(l); setPasso("revisar");
  };
  const abrirArquivo = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (/\.zip$/i.test(f.name)) return setErro("O Google manda um .zip: abra ele no celular ou no computador e escolha o arquivo .ics que está dentro.");
    const txt = await f.text();
    mostrar(/BEGIN:VCALENDAR/.test(txt) ? lerICS(txt) : lerLista(txt, valorPadrao));
  };
  const trocar = i => setAchados(l => l.map(x => x.i === i && !x.repetido ? { ...x, on: !x.on } : x));
  const escolhidos = achados.filter(x => x.on);
  const trazer = () => {
    const n = db.patients.length;
    act.importarPacientes(escolhidos.map((x, k) => ({ id: uid(), name: x.nome, phone: x.phone || "", color: CORES[(n + k) % CORES.length].id, price: x.price, sublet: perfil.subPadrao || 0, subletType: perfil.subTipo || "fixed", freq: x.freq, time: x.time, billing: "session", packageSize: 4, nextDate: x.nextDate, active: true, desde: todayISO() })));
  };

  return (
    <Sheet title="Trazer da agenda antiga" sub={`Seus ${T.p} entram com dia, horário e frequência. O arquivo é lido aqui no aparelho.`} onClose={onClose}>
      {passo === "escolher" && <>
        <div className="perfil-lista">
          <button className="perfil-row" onClick={() => arq.current && arq.current.click()}><i><I.cal /></i><span><b>Google Agenda, iPhone ou Outlook</b><small>Arquivo .ics exportado da agenda</small></span><I.chev /></button>
          <button className="perfil-row" onClick={() => setPasso("colar")}><i><I.pencil /></i><span><b>Colar uma lista</b><small>Do bloco de notas ou de uma planilha</small></span><I.chev /></button>
        </div>
        <input ref={arq} className="sr" type="file" accept=".ics,.csv,.txt,text/calendar,text/csv,text/plain" onChange={abrirArquivo} />
        {erro && <div className="error">{erro}</div>}
        <details className="imp-ajuda">
          <summary>Como baixar a agenda do Google</summary>
          <ol>
            <li>No computador, abra <b>calendar.google.com</b>.</li>
            <li>Engrenagem → <b>Configurações</b> → <b>Importar e exportar</b> → <b>Exportar</b>.</li>
            <li>Vem um .zip: abra e escolha aqui o arquivo <b>.ics</b> da sua agenda.</li>
          </ol>
        </details>
        <button className="btn text" onClick={() => mostrar(lerICS(EXEMPLO_ICS))}>Testar com uma agenda de exemplo</button>
      </>}

      {passo === "colar" && <>
        <textarea className="msg imp-texto" value={texto} onChange={e => setTexto(e.target.value)} aria-label="Lista de pacientes"
          placeholder={"Um por linha, com dia e horário:\nAna Souza, quinta, 14h, 150\nBruno Lima - segunda 9h quinzenal\nCarla Dias, sex 18:30"} />
        {erro && <div className="error">{erro}</div>}
        <button className="btn mode" disabled={!texto.trim()} onClick={() => mostrar(lerLista(texto, valorPadrao))}>Ler a lista</button>
        <button className="btn text" onClick={() => { setPasso("escolher"); setErro(""); }}>Voltar</button>
      </>}

      {passo === "revisar" && <>
        <div className="hint">Achei {achados.length} {achados.length === 1 ? "nome" : "nomes"}. Desmarque o que não for {T.s}.</div>
        <div className="perfil-lista">
          {achados.map(x => (
            <button key={x.i} className={"perfil-row imp-item" + (x.on ? " on" : "")} role="checkbox" aria-checked={x.on} disabled={x.repetido} onClick={() => trocar(x.i)}>
              <i className="imp-box">{x.on && <I.check />}</i>
              <span><b>{x.nome}</b><small>{x.repetido ? `Já está nos seus ${T.p}` : `${NOME_FREQ[x.freq]} · ${DIA_CURTO[fromISO(x.nextDate).getDay()].toLowerCase()} ${x.time} · próxima ${dm(x.nextDate)}${x.price ? ` · ${brl(x.price)}` : ""}`}</small></span>
            </button>
          ))}
        </div>
        <div className="hint">{valorPadrao ? `Quem não tinha valor ficou com ${brl(valorPadrao)}.` : "Coloque o valor da sessão depois, no cadastro de cada um."} Valor e frequência dá para mudar depois.</div>
        <button className="btn mode" disabled={!escolhidos.length} onClick={trazer}><I.down /> Trazer {escolhidos.length} {escolhidos.length === 1 ? T.s : T.p}</button>
        <button className="btn text" onClick={() => { setPasso("escolher"); setAchados([]); }}>Escolher outro arquivo</button>
      </>}
    </Sheet>
  );
}

export { ImportarAgendaSheet };
