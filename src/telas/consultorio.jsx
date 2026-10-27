// Parte do app carregada sob demanda: recibo em PDF, relatório para o imposto e anotações de sessão trancadas.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { I, Sheet, Field, Toggle, ConfirmButton, brl, brlReal, todayISO, MES_LONGO, pad, dm, fromISO, PERFIL, termoDe, vibrar, Ilustra } from "../App.jsx";
import { aberto, criarCofre, destrancar, trancar, abrirTexto, fecharCofre, mexeu, trocarSenha } from "../cofre.js";

/* ---------- números e documentos ---------- */
const UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const ate999 = n => {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, p = [];
  if (c) p.push(CT[c]);
  if (r) p.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? " e " + UN[r % 10] : ""));
  return p.join(" e ");
};
const inteiro = n => {
  if (!n) return "zero";
  const mi = Math.floor(n / 1e6), mil = Math.floor(n % 1e6 / 1000), r = n % 1000, p = [];
  if (mi) p.push(mi === 1 ? "um milhão" : `${ate999(mi)} milhões`);
  if (mil) p.push(mil === 1 ? "mil" : `${ate999(mil)} mil`);
  if (r) p.push(ate999(r));
  // "mil e cem", "dois mil e quinhentos", mas "mil duzentos e trinta"
  return p.length > 1 && r && (r < 100 || r % 100 === 0) ? p.slice(0, -1).join(" ") + " e " + p[p.length - 1] : p.join(" ");
};
export function porExtenso(v) {
  const c = Math.round(v * 100), re = Math.floor(c / 100), ce = c % 100, p = [];
  if (re) p.push(`${inteiro(re)}${re % 1e6 === 0 ? " de" : ""} ${re === 1 ? "real" : "reais"}`);
  if (ce) p.push(`${inteiro(ce)} ${ce === 1 ? "centavo" : "centavos"}`);
  return p.join(" e ") || "zero reais";
}
const soDigitos = s => String(s || "").replace(/\D/g, "");
export const fmtCPF = s => { const d = soDigitos(s).slice(0, 11); return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2"); };
export function cpfValido(s) {
  const d = soDigitos(s); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let t = 0; for (let i = 0; i < n; i++) t += Number(d[i]) * (n + 1 - i); const r = t * 10 % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
const dataLonga = iso => { const d = fromISO(iso); return `${d.getDate()} de ${MES_LONGO[d.getMonth()]} de ${d.getFullYear()}`; };
const dataBR = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const lista = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
// Nome do conselho para cada profissão (o rótulo do campo; a pessoa escreve o número como quiser)
const CONSELHO = { Psicologia: "CRP", Psicanálise: "Registro", Psiquiatria: "CRM", "Terapia ocupacional": "CREFITO", Fonoaudiologia: "CRFa", Nutrição: "CRN", Fisioterapia: "CREFITO" };
export const conselhoDe = prof => CONSELHO[prof] || "Registro profissional";
const servicoPadrao = prof => ({ Psicologia: "psicoterapia individual", Psicanálise: "psicanálise", Psiquiatria: "consulta psiquiátrica", "Terapia ocupacional": "terapia ocupacional", Fonoaudiologia: "fonoaudiologia", Nutrição: "consulta de nutrição", Fisioterapia: "fisioterapia" }[prof] || "atendimento");

// Pagamentos recebidos (cobranças pagas de verdade), do mais novo para o mais velho
const pagos = db => db.charges.filter(c => c.paid && c.paidAt && !c.hidden && c.amount > 0).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
const sessoesDe = (db, c) => c.sessionIds.map(id => db.sessions.find(s => s.id === id)).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));

/* ---------- arquivo: compartilhar (WhatsApp, e-mail) ou baixar ---------- */
function baixar(blob, nome) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function compartilhar(blob, nome, tipo, texto) {
  const f = new File([blob], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: nome, text: texto }); return "ok"; } catch (e) { if (e.name === "AbortError") return "cancelou"; }
  }
  baixar(blob, nome); return "baixou";
}

/* ---------- PDF ---------- */
async function novoPDF() { const { jsPDF } = await import("jspdf"); return new jsPDF({ unit: "mm", format: "a4" }); }
async function pdfRecibo(r) {
  const doc = await novoPDF(), W = 210, M = 22; let y = 30;
  doc.setDrawColor(210); doc.setLineWidth(.4); doc.roundedRect(M - 6, 14, W - 2 * (M - 6), 190, 4, 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("RECIBO", M, y);
  doc.setFontSize(16); doc.text(brlReal(r.valor), W - M, y, { align: "right" });
  y += 16; doc.setFont("helvetica", "normal"); doc.setFontSize(12.5);
  const corpo = doc.splitTextToSize(r.texto, W - 2 * M);
  doc.text(corpo, M, y, { lineHeightFactor: 1.6 }); y += corpo.length * 12.5 * .3528 * 1.6 + 10;
  doc.text(`${r.cidade ? r.cidade + ", " : ""}${dataLonga(r.data)}.`, W - M, y, { align: "right" }); y += 18;
  if (r.assinatura) { try { doc.addImage(r.assinatura, "PNG", W / 2 - 35, y - 4, 70, 24); } catch (e) {} }
  y += 22; doc.setDrawColor(120); doc.line(W / 2 - 45, y, W / 2 + 45, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(r.prof.nome || "", W / 2, y, { align: "center" }); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  [r.prof.profissao && r.prof.registro ? `${r.prof.profissao} · ${r.prof.conselho} ${r.prof.registro}` : r.prof.registro ? `${r.prof.conselho} ${r.prof.registro}` : r.prof.profissao,
    r.prof.cpf ? `CPF ${fmtCPF(r.prof.cpf)}` : "", r.prof.endereco || ""].filter(Boolean).forEach(l => { doc.text(doc.splitTextToSize(l, W - 2 * M), W / 2, y, { align: "center" }); y += 5.5; });
  return doc.output("blob");
}

/* ---------- assinatura: desenhar com o dedo ---------- */
function AssinaturaPad({ valor, onChange }) {
  const cv = useRef(null), riscou = useRef(false), ult = useRef(null);
  const [editando, setEditando] = useState(!valor);
  useEffect(() => {
    if (!editando) return;
    const c = cv.current, r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext("2d"); g.scale(k, k); g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#0b1f4d";
  }, [editando]);
  const ponto = e => { const r = cv.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const ini = e => { e.preventDefault(); cv.current.setPointerCapture(e.pointerId); ult.current = ponto(e); };
  const mov = e => {
    if (!ult.current) return; const g = cv.current.getContext("2d"), p = ponto(e);
    g.beginPath(); g.moveTo(...ult.current); g.lineTo(...p); g.stroke(); ult.current = p; riscou.current = true;
  };
  const fim = () => { ult.current = null; };
  const limpar = () => { const c = cv.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); riscou.current = false; };
  const pronto = () => { if (!riscou.current) return; onChange(cv.current.toDataURL("image/png")); setEditando(false); vibrar("ok"); };
  if (!editando) return (
    <div className="assin-pronta">
      <img src={valor} alt="Sua assinatura" />
      <div className="btn-row"><button type="button" className="btn ghost" onClick={() => setEditando(true)}><I.pencil /> Assinar de novo</button><button type="button" className="btn ghost" onClick={() => onChange("")}>Tirar</button></div>
    </div>
  );
  return (
    <div className="assin">
      <canvas ref={cv} className="assin-pad" onPointerDown={ini} onPointerMove={mov} onPointerUp={fim} onPointerCancel={fim} aria-label="Assine aqui com o dedo" />
      <small>Assine com o dedo no quadro (fica só nos seus recibos)</small>
      <div className="btn-row"><button type="button" className="btn ghost" onClick={limpar}>Limpar</button><button type="button" className="btn" onClick={pronto}><I.check /> Usar assinatura</button></div>
    </div>
  );
}

/* ---------- seus dados para recibos (Perfil → Recibos e imposto) ---------- */
export function DadosRecibo({ conta, act, compacto }) {
  const pf = conta.perfil || {}, d0 = pf.doc || {};
  const [nome, setNome] = useState(d0.nome || "");
  const [cpf, setCpf] = useState(d0.cpf ? fmtCPF(d0.cpf) : "");
  const [registro, setRegistro] = useState(d0.registro || "");
  const [endereco, setEndereco] = useState(d0.endereco || "");
  const [assinatura, setAssinatura] = useState(d0.assinatura || "");
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    const t = setTimeout(() => act.salvarDocProf({ nome: nome.trim(), cpf: soDigitos(cpf), registro: registro.trim(), endereco: endereco.trim(), assinatura }), 450);
    return () => clearTimeout(t);
  }, [nome, cpf, registro, endereco, assinatura]);
  const cpfRuim = soDigitos(cpf).length === 11 && !cpfValido(cpf);
  return (
    <div className="stack">
      <div className="fields">
        <Field label="Nome completo (como no conselho)" icon={<I.user />} htmlFor="d-nome"><input id="d-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder={conta.nome} autoComplete="name" /></Field>
        <Field label="Seu CPF" htmlFor="d-cpf"><input id="d-cpf" inputMode="numeric" value={cpf} onChange={e => setCpf(fmtCPF(e.target.value))} placeholder="000.000.000-00" /></Field>
        <Field label={`${conselhoDe(pf.profissao)} (número do registro)`} htmlFor="d-reg"><input id="d-reg" value={registro} onChange={e => setRegistro(e.target.value)} placeholder={pf.profissao === "Psicologia" ? "Ex.: 08/12345" : "Número do registro"} /></Field>
        {!compacto && <Field label="Endereço do consultório (opcional)" htmlFor="d-end"><input id="d-end" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, sala · cidade" autoComplete="street-address" /></Field>}
      </div>
      {cpfRuim && <div className="error">Esse CPF parece ter um número trocado. Confira.</div>}
      <h3 className="section-title">Assinatura</h3>
      <AssinaturaPad valor={assinatura} onChange={setAssinatura} />
    </div>
  );
}

/* ---------- recibo de um ou mais pagamentos ---------- */
export function ReciboSheet({ db, conta, pid, cid, onClose, act }) {
  const p = db.patients.find(x => x.id === pid);
  const todos = useMemo(() => pagos(db).filter(c => c.patientId === pid), [db, pid]);
  const meses = [...new Set(todos.map(c => c.paidAt.slice(0, 7)))];
  const c0 = cid && todos.find(c => c.id === cid);
  const [mes, setMes] = useState(c0 ? c0.paidAt.slice(0, 7) : meses[0] || todayISO().slice(0, 7));
  const doMes = todos.filter(c => c.paidAt.startsWith(mes));
  const [marcados, setMarcados] = useState(() => new Set(c0 ? [c0.id] : doMes.map(c => c.id)));
  const [cpfPac, setCpfPac] = useState(p && p.cpf ? fmtCPF(p.cpf) : "");
  const [outroPaga, setOutroPaga] = useState(!!(p && p.pagadorNome));
  const [pagNome, setPagNome] = useState((p && p.pagadorNome) || "");
  const [pagCpf, setPagCpf] = useState(p && p.pagadorCpf ? fmtCPF(p.pagadorCpf) : "");
  const [servico, setServico] = useState(servicoPadrao(PERFIL.profissao));
  // quem ainda não preencheu os dados vê o quadro aberto, e ele fica aberto até fechar (dá tempo de assinar)
  const [verDados, setVerDados] = useState(() => { const d = (conta.perfil || {}).doc || {}; return !d.nome || !d.registro || !d.cpf || !d.assinatura; });
  const [gerando, setGerando] = useState("");
  if (!p) return null;
  const pf = conta.perfil || {}, doc = pf.doc || {};
  const faltaProf = !doc.nome || !doc.registro || !doc.cpf;
  const escolhidos = doMes.filter(c => marcados.has(c.id));
  const valor = escolhidos.reduce((s, c) => s + c.amount, 0);
  const datas = [...new Set(escolhidos.flatMap(c => sessoesDe(db, c).map(s => s.date)))].sort();
  const trocarMes = m => { setMes(m); setMarcados(new Set(todos.filter(c => c.paidAt.startsWith(m)).map(c => c.id))); };
  const marcar = id => setMarcados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ses = datas.length === 1 ? "1 sessão" : `${datas.length} sessões`;
  const quando = datas.length ? ` ${datas.length === 1 ? "realizada" : "realizadas"} em ${lista(datas.map(dataBR))}` : "";
  const pagador = outroPaga && pagNome.trim() ? { nome: pagNome.trim(), cpf: soDigitos(pagCpf) } : { nome: p.name, cpf: soDigitos(cpfPac) };
  const texto = `Recebi de ${pagador.nome}${pagador.cpf ? `, CPF ${fmtCPF(pagador.cpf)},` : ""} a quantia de ${brlReal(valor)} (${porExtenso(valor)}), referente a ${datas.length ? ses : "atendimento"} de ${servico.trim() || "atendimento"}${quando}`
    + (outroPaga && pagNome.trim() ? `, ${datas.length === 1 ? "prestada" : "prestadas"} a ${p.name}${soDigitos(cpfPac) ? `, CPF ${fmtCPF(cpfPac)}` : ""}` : "") + ".";
  const dataRecibo = escolhidos.length ? escolhidos.map(c => c.paidAt).sort().slice(-1)[0] : todayISO();

  const guardarPaciente = () => act.atualizarPaciente(p.id, { cpf: soDigitos(cpfPac), pagadorNome: outroPaga ? pagNome.trim() : "", pagadorCpf: outroPaga ? soDigitos(pagCpf) : "" });
  const gerar = async modo => {
    if (!escolhidos.length) return;
    setGerando(modo); guardarPaciente();
    try {
      const blob = await pdfRecibo({ valor, texto, data: dataRecibo, cidade: pf.cidade, assinatura: doc.assinatura,
        prof: { nome: doc.nome || conta.nome, profissao: pf.profissao, conselho: conselhoDe(pf.profissao), registro: doc.registro, cpf: doc.cpf, endereco: doc.endereco } });
      const arq = `Recibo ${p.name.split(" ")[0]} ${MES_LONGO[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}.pdf`;
      const r = modo === "baixar" ? (baixar(blob, arq), "baixou") : await compartilhar(blob, arq, "application/pdf", `Recibo de ${brlReal(valor)}`);
      if (r !== "cancelou") { act.marcarRecibo(escolhidos.map(c => c.id)); act.toast(r === "baixou" ? "Recibo salvo nos downloads" : "Recibo enviado"); }
    } catch (e) { act.toast("Não consegui gerar o PDF. Tente de novo."); }
    setGerando("");
  };

  return (
    <Sheet title="Recibo" sub={p.name} onClose={onClose}>
      {todos.length === 0 ? <div className="empty com-ilustra"><Ilustra n="arquivo" /><b>Nenhum pagamento recebido ainda</b>Quando {p.name.split(" ")[0]} pagar, o recibo sai daqui.</div> : <>
        <div className="fields">
          <Field label="Pagamentos de" htmlFor="r-mes">
            <select id="r-mes" value={mes} onChange={e => trocarMes(e.target.value)}>
              {meses.map(m => <option key={m} value={m}>{MES_LONGO[Number(m.slice(5)) - 1]} de {m.slice(0, 4)}</option>)}
            </select>
          </Field>
        </div>
        <div className="recibo-pags" role="group" aria-label="Pagamentos no recibo">
          {doMes.map(c => (
            <button key={c.id} type="button" className={"recibo-pag" + (marcados.has(c.id) ? " on" : "")} aria-pressed={marcados.has(c.id)} onClick={() => marcar(c.id)}>
              <span className={"box " + (marcados.has(c.id) ? "done" : "up")}>{marcados.has(c.id) && <I.check />}</span>
              <span className="mid"><b>{brlReal(c.amount)}</b><small>Pago em {dm(c.paidAt)} · sessões {sessoesDe(db, c).map(s => dm(s.date)).join(", ") || "—"}{c.reciboEm ? " · recibo já feito" : ""}</small></span>
            </button>
          ))}
        </div>
        <div className="fields">
          <Field label={`CPF de ${p.name.split(" ")[0]}`} htmlFor="r-cpf"><input id="r-cpf" inputMode="numeric" value={cpfPac} onChange={e => setCpfPac(fmtCPF(e.target.value))} placeholder="Opcional, mas o plano costuma pedir" /></Field>
        </div>
        <Toggle on={outroPaga} onClick={() => setOutroPaga(!outroPaga)}>Quem paga é outra pessoa (pai, mãe, responsável)</Toggle>
        {outroPaga && <div className="fields">
          <Field label="Nome de quem paga" htmlFor="r-pn"><input id="r-pn" value={pagNome} onChange={e => setPagNome(e.target.value)} placeholder="Nome completo" /></Field>
          <Field label="CPF de quem paga" htmlFor="r-pc"><input id="r-pc" inputMode="numeric" value={pagCpf} onChange={e => setPagCpf(fmtCPF(e.target.value))} placeholder="000.000.000-00" /></Field>
        </div>}
        <div className="fields"><Field label="Serviço" htmlFor="r-serv"><input id="r-serv" value={servico} onChange={e => setServico(e.target.value)} /></Field></div>
        <div className="recibo-prev" aria-label="Como o recibo vai ficar">
          <div className="recibo-prev-top"><b>RECIBO</b><b>{brlReal(valor)}</b></div>
          <p>{texto}</p>
          <p className="dir">{pf.cidade ? pf.cidade + ", " : ""}{dataLonga(dataRecibo)}.</p>
          {doc.assinatura ? <img src={doc.assinatura} alt="" /> : <i className="assin-falta">sem assinatura</i>}
          <small>{doc.nome || conta.nome}{doc.registro ? ` · ${conselhoDe(pf.profissao)} ${doc.registro}` : ""}</small>
        </div>
        {verDados ? <div className="panel recibo-dados">
          <div className="panel-head"><h3>Seus dados no recibo</h3>{!faltaProf && <button className="link" onClick={() => setVerDados(false)}>Pronto</button>}</div>
          {faltaProf && <div className="hint">Preencha uma vez: nome completo, CPF e {conselhoDe(pf.profissao)}. Ficam guardados para todos os recibos.</div>}
          <DadosRecibo conta={conta} act={act} compacto />
        </div> : <button className="link" onClick={() => setVerDados(true)}><I.pencil /> Mudar seus dados ou a assinatura</button>}
        <div className="btn-row">
          <button className="btn" disabled={!escolhidos.length || !!gerando} onClick={() => gerar("enviar")}><I.send /> {gerando === "enviar" ? "Gerando…" : "Enviar PDF"}</button>
          <button className="btn ghost" disabled={!escolhidos.length || !!gerando} onClick={() => gerar("baixar")}><I.down /> Baixar</button>
        </div>
        <div className="hint">Serve para o reembolso do plano de saúde e para {p.name.split(" ")[0]} guardar. Para o Imposto de Renda, emita também no app Receita Saúde: o relatório do imposto, no Perfil, mostra o que digitar lá.</div>
      </>}
    </Sheet>
  );
}

/* ---------- relatório para o imposto (Receita Saúde e Carnê-Leão) ---------- */
export function ImpostoSheet({ db, conta, onClose, act }) {
  const todos = pagos(db);
  const anos = [...new Set([todayISO().slice(0, 4), ...todos.map(c => c.paidAt.slice(0, 4))])].sort().reverse();
  const [ano, setAno] = useState(anos[0]);
  const [mesAberto, setMesAberto] = useState(() => { const u = todos.find(c => c.paidAt.startsWith(anos[0])); return u ? u.paidAt.slice(0, 7) : ""; });
  const doAno = todos.filter(c => c.paidAt.startsWith(ano));
  const pac = id => db.patients.find(p => p.id === id) || { name: "Removido" };
  const meses = []; for (let m = 12; m >= 1; m--) { const ch = `${ano}-${pad(m)}`, cs = doAno.filter(c => c.paidAt.startsWith(ch)); if (cs.length) meses.push({ ch, cs, total: cs.reduce((s, c) => s + c.amount, 0) }); }
  const total = doAno.reduce((s, c) => s + c.amount, 0);
  const subl = db.sessions.filter(s => s.date.startsWith(ano) && (s.status === "done" || s.cobrada)).reduce((s, x) => s + (x.sublet || 0), 0);
  const semCpf = new Set(doAno.filter(c => !(pac(c.patientId).cpf)).map(c => c.patientId));
  const feitos = doAno.filter(c => c.rsaude).length;
  const T = termoDe(PERFIL.termo || "Paciente");
  const linha = c => { const p = pac(c.patientId); return { data: c.paidAt, nome: p.name, cpf: p.cpf || "", pagador: p.pagadorNome || p.name, cpfPag: p.pagadorNome ? p.pagadorCpf || "" : p.cpf || "", valor: c.amount, sessoes: sessoesDe(db, c).map(s => dataBR(s.date)).join(" ") }; };

  const csv = () => {
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Data do pagamento", "Paciente", "CPF do paciente", "Quem pagou", "CPF de quem pagou", "Valor", "Sessões", "Emitido no Receita Saúde"].map(q).join(";"),
      ...doAno.slice().reverse().map(c => { const l = linha(c); return [dataBR(l.data), l.nome, fmtCPF(l.cpf), l.pagador, fmtCPF(l.cpfPag), l.valor.toFixed(2).replace(".", ","), l.sessoes, c.rsaude ? "sim" : "não"].map(q).join(";"); })];
    return new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  };
  const pdf = async () => {
    const doc = await novoPDF(), M = 16; let y = 20;
    const pf = conta.perfil || {}, d = pf.doc || {};
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(`Recebimentos de ${ano}`, M, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text([d.nome || conta.nome, d.cpf ? `CPF ${fmtCPF(d.cpf)}` : "", d.registro ? `${conselhoDe(pf.profissao)} ${d.registro}` : ""].filter(Boolean).join(" · "), M, y); y += 6;
    doc.text(`Total recebido de pessoas físicas: ${brlReal(total)} · sublocação (despesa): ${brlReal(subl)}`, M, y); y += 9;
    meses.slice().reverse().forEach(m => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.text(`${MES_LONGO[Number(m.ch.slice(5)) - 1]} · ${brlReal(m.total)}`, M, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      m.cs.slice().reverse().forEach(c => {
        if (y > 280) { doc.addPage(); y = 20; }
        const l = linha(c);
        doc.text(`${dataBR(l.data)}   ${l.nome}${l.cpf ? ` (CPF ${fmtCPF(l.cpf)})` : " (sem CPF)"}${l.pagador !== l.nome ? ` · pago por ${l.pagador}${l.cpfPag ? ` (CPF ${fmtCPF(l.cpfPag)})` : ""}` : ""}`, M, y);
        doc.text(brlReal(l.valor), 194, y, { align: "right" }); y += 5;
      });
      y += 3;
    });
    return doc.output("blob");
  };
  const exportar = async tipo => {
    try {
      const r = tipo === "csv" ? await compartilhar(csv(), `Recebimentos ${ano}.csv`, "text/csv", `Recebimentos de ${ano}`) : await compartilhar(await pdf(), `Recebimentos ${ano}.pdf`, "application/pdf", `Recebimentos de ${ano}`);
      if (r === "baixou") act.toast("Arquivo salvo nos downloads");
    } catch (e) { act.toast("Não consegui gerar o arquivo."); }
  };

  return (
    <Sheet title="Imposto de Renda" sub="O que você recebeu, mês a mês" onClose={onClose}>
      <div className="seg-anos" role="tablist">{anos.map(a => <button key={a} role="tab" aria-selected={a === ano} className={"fchip" + (a === ano ? " on" : "")} onClick={() => setAno(a)}>{a}</button>)}</div>
      <div className="kv">
        <div><span>Recebido em {ano}</span><b className="num">{brl(total)}</b></div>
        <div><span>Pagamentos</span><b>{doAno.length}</b></div>
        <div><span>Sublocação (despesa)</span><b className="num">{brl(subl)}</b></div>
        <div><span>No Receita Saúde</span><b>{feitos} de {doAno.length}</b></div>
      </div>
      {semCpf.size > 0 && <div className="note amber"><I.alert /><span>{semCpf.size === 1 ? `1 ${T.s} está` : `${semCpf.size} ${T.p} estão`} sem CPF. O Receita Saúde pede o CPF de quem foi atendido e de quem pagou.<br />
        <span className="imp-semcpf">{[...semCpf].slice(0, 6).map(id => <button key={id} className="bub-act" onClick={() => act.editPatient(id)}>{pac(id).name.split(" ")[0]}</button>)}</span></span></div>}
      {meses.length === 0 && <div className="empty com-ilustra"><Ilustra n="arquivo" /><b>Nada recebido em {ano}</b>Quando você marcar uma cobrança como paga, ela aparece aqui.</div>}
      {meses.map(m => (
        <div key={m.ch} className="panel imp-mes">
          <button className="imp-mes-cab" onClick={() => setMesAberto(mesAberto === m.ch ? "" : m.ch)} aria-expanded={mesAberto === m.ch}>
            <span><b>{MES_LONGO[Number(m.ch.slice(5)) - 1][0].toUpperCase() + MES_LONGO[Number(m.ch.slice(5)) - 1].slice(1)}</b><small>{m.cs.length} {m.cs.length === 1 ? "pagamento" : "pagamentos"} · {m.cs.filter(c => c.rsaude).length} no Receita Saúde</small></span>
            <b className="num">{brl(m.total)}</b>
          </button>
          {mesAberto === m.ch && m.cs.map(c => { const l = linha(c); return (
            <div key={c.id} className="imp-linha">
              <button className={"box " + (c.rsaude ? "done" : "up")} onClick={() => act.marcarReceitaSaude(c.id)} aria-label={c.rsaude ? "Emitido no Receita Saúde (toque para desmarcar)" : "Marcar como emitido no Receita Saúde"}>{c.rsaude && <I.check />}</button>
              <span className="mid"><b>{l.nome}</b><small>{dm(l.data)} · {l.cpf ? `CPF ${fmtCPF(l.cpf)}` : "sem CPF"}{l.pagador !== l.nome ? ` · pago por ${l.pagador}${l.cpfPag ? ` (${fmtCPF(l.cpfPag)})` : ""}` : ""}</small></span>
              <b className="num">{brlReal(l.valor)}</b>
            </div>
          ); })}
        </div>
      ))}
      {doAno.length > 0 && <div className="btn-row">
        <button className="btn" onClick={() => exportar("pdf")}><I.send /> PDF para o contador</button>
        <button className="btn ghost" onClick={() => exportar("csv")}><I.down /> Planilha</button>
      </div>}
      <div className="note"><I.receipt /><span><b>Como usar:</b> para cada pagamento, emita o recibo no app <b>Receita Saúde</b> (da Receita Federal) com a data, o valor e os CPFs daqui, e marque a bolinha. No fim do mês, o total vai para o <b>Carnê-Leão</b>. Quanto pagar de imposto, confirme com o seu contador.</span></div>
    </Sheet>
  );
}

/* ---------- anotações de sessão (trancadas com senha) ---------- */
export function NotasSheet({ db, pid, sid, onClose, act }) {
  const p = db.patients.find(x => x.id === pid);
  const [, setVer] = useState(0);
  useEffect(() => { const f = () => setVer(v => v + 1); addEventListener("cofre", f); return () => removeEventListener("cofre", f); }, []);
  if (!p) return null;
  const nome = p.name.split(" ")[0];
  return (
    <Sheet title={`Anotações · ${nome}`} sub="Trancadas com a sua senha" onClose={onClose}>
      {!db.cofre ? <CriarSenha act={act} /> : !aberto() ? <Destrancar db={db} act={act} /> : <ListaNotas db={db} p={p} sid={sid} act={act} />}
    </Sheet>
  );
}
function CriarSenha({ act }) {
  const [s1, setS1] = useState(""), [s2, setS2] = useState(""), [erro, setErro] = useState(""), [ok, setOk] = useState(false), [ind, setInd] = useState(false);
  const criar = async e => {
    e.preventDefault();
    if (s1.length < 6) return setErro("Use pelo menos 6 letras ou números.");
    if (s1 !== s2) return setErro("As duas senhas não são iguais.");
    if (!ok) return setErro("Marque que você entendeu que a senha não tem como ser recuperada.");
    setInd(true); act.salvarCofre(await criarCofre(s1)); vibrar("ok");
  };
  return (
    <form className="stack" onSubmit={criar} noValidate>
      <div className="notas-intro"><Ilustra n="cadeados" /><span><b>Só você lê</b>O texto é trancado aqui no aparelho antes de ir para a nuvem. Ninguém mais consegue abrir: nem eu, nem o servidor.</span></div>
      <div className="fields">
        <Field label="Crie uma senha para as anotações" icon={<I.key />} htmlFor="n-s1"><input id="n-s1" type="password" autoComplete="new-password" value={s1} onChange={e => setS1(e.target.value)} /></Field>
        <Field label="Repita a senha" icon={<I.key />} htmlFor="n-s2"><input id="n-s2" type="password" autoComplete="new-password" value={s2} onChange={e => setS2(e.target.value)} /></Field>
      </div>
      <Toggle on={ok} onClick={() => setOk(!ok)}>Entendi: se eu esquecer esta senha, as anotações não podem ser recuperadas</Toggle>
      {erro && <div className="error" role="alert">{erro}</div>}
      <button className="btn" type="submit" disabled={ind}><I.check /> {ind ? "Criando…" : "Criar senha"}</button>
      <div className="hint">É diferente da senha da conta. O cofre tranca sozinho depois de 10 minutos parado ou quando você sai do app.</div>
    </form>
  );
}
function Destrancar({ db, act }) {
  const [s, setS] = useState(""), [erro, setErro] = useState(""), [ind, setInd] = useState(false), [esqueci, setEsqueci] = useState(false);
  const abrir = async e => {
    e.preventDefault(); if (!s) return;
    setInd(true); const ok = await destrancar(db.cofre, s); setInd(false);
    if (!ok) { setErro("Senha errada."); vibrar("erro"); } else vibrar("ok");
  };
  return (
    <form className="stack" onSubmit={abrir} noValidate>
      <div className="notas-intro"><Ilustra n="cadeados" /><span><b>Anotações trancadas</b>Digite a senha das anotações para abrir.</span></div>
      <div className="fields"><Field label="Senha das anotações" icon={<I.key />} htmlFor="n-s"><input id="n-s" type="password" autoComplete="current-password" autoFocus value={s} onChange={e => { setS(e.target.value); setErro(""); }} /></Field></div>
      {erro && <div className="error" role="alert">{erro}</div>}
      <button className="btn" type="submit" disabled={ind}>{ind ? "Abrindo…" : "Abrir"}</button>
      {!esqueci ? <button type="button" className="btn text" onClick={() => setEsqueci(true)}>Esqueci a senha</button>
        : <ConfirmButton label="Apagar as anotações e criar outra senha" titulo="Apagar todas as anotações?" texto={`Sem a senha, ninguém consegue abrir as ${(db.notas || []).length} anotações guardadas. Elas somem de vez e você cria uma senha nova. Isso não dá para desfazer.`} acao="Apagar e recomeçar" onConfirm={() => act.trocarCofre(null, [])} />}
    </form>
  );
}
function ListaNotas({ db, p, sid, act }) {
  const notas = (db.notas || []).filter(n => n.pid === p.id).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const ses = sid && db.sessions.find(s => s.id === sid);
  const [textos, setTextos] = useState({});
  const [edit, setEdit] = useState(() => ses && !notas.some(n => n.sid === sid) ? { nova: true, data: ses.date, texto: "" } : null);
  const [trocar, setTrocar] = useState(false);
  const chave = notas.map(n => n.id + (n.editado || 0)).join();
  useEffect(() => {
    let vivo = true;
    Promise.all(notas.map(n => abrirTexto(n).then(t => [n.id, t]).catch(() => [n.id, null]))).then(ps => { if (vivo) setTextos(Object.fromEntries(ps)); });
    return () => { vivo = false; };
  }, [chave]);
  const salvar = async () => {
    const t = edit.texto.trim(); if (!t) return setEdit(null);
    mexeu();
    const velho = edit.nova ? null : notas.find(n => n.id === edit.id);
    act.salvarNota({ ...(velho || {}), id: velho ? velho.id : Math.random().toString(36).slice(2, 10) + Date.now().toString(36), pid: p.id, sid: velho ? velho.sid : sid || null, data: edit.data, criado: velho ? velho.criado : Date.now(), editado: Date.now(), ...(await trancar(t)) });
    setEdit(null); vibrar("ok");
  };
  if (trocar) return <TrocarSenha db={db} act={act} onPronto={() => setTrocar(false)} />;
  if (edit) return (
    <div className="stack">
      <div className="fields">
        <Field label="Data da sessão" htmlFor="n-data"><input id="n-data" type="date" value={edit.data} onChange={e => e.target.value && setEdit({ ...edit, data: e.target.value })} /></Field>
      </div>
      <textarea className="msg nota-txt" autoFocus value={edit.texto} onChange={e => { setEdit({ ...edit, texto: e.target.value }); mexeu(); }} placeholder="O que foi trabalhado, combinados, pontos para a próxima sessão…" aria-label="Anotação" />
      <div className="btn-row"><button className="btn" onClick={salvar}><I.check /> Salvar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
      {!edit.nova && <ConfirmButton label="Apagar esta anotação" titulo="Apagar a anotação?" texto="Ela some de vez, deste e de todos os seus aparelhos." acao="Apagar" onConfirm={() => { act.apagarNota(edit.id); setEdit(null); }} />}
    </div>
  );
  return (
    <div className="stack">
      <button className="btn" onClick={() => setEdit({ nova: true, data: ses ? ses.date : todayISO(), texto: "" })}><I.plus /> Nova anotação</button>
      {notas.length === 0 && <div className="empty">Nenhuma anotação ainda. Elas ficam em ordem de data, só para você.</div>}
      <div className="notas-lista">
        {notas.map(n => (
          <button key={n.id} className="nota-item" onClick={() => textos[n.id] != null && setEdit({ id: n.id, data: n.data, texto: textos[n.id] })}>
            <small>{dataLonga(n.data)}</small>
            <span>{textos[n.id] == null ? "…" : textos[n.id]}</span>
          </button>
        ))}
      </div>
      <div className="btn-row"><button className="btn ghost" onClick={() => { fecharCofre(); vibrar("toque"); }}><I.key /> Trancar agora</button><button className="btn ghost" onClick={() => setTrocar(true)}>Trocar senha</button></div>
    </div>
  );
}
function TrocarSenha({ db, act, onPronto }) {
  const [s1, setS1] = useState(""), [s2, setS2] = useState(""), [erro, setErro] = useState(""), [ind, setInd] = useState(false);
  const ir = async e => {
    e.preventDefault();
    if (s1.length < 6) return setErro("Use pelo menos 6 letras ou números.");
    if (s1 !== s2) return setErro("As duas senhas não são iguais.");
    setInd(true);
    try { const r = await trocarSenha(db.notas || [], s1); act.trocarCofre(r.cofre, r.notas); vibrar("ok"); onPronto(); }
    catch (x) { setErro("Não consegui trocar. Nada foi mudado."); setInd(false); }
  };
  return (
    <form className="stack" onSubmit={ir} noValidate>
      <div className="fields">
        <Field label="Nova senha" icon={<I.key />} htmlFor="t-s1"><input id="t-s1" type="password" autoComplete="new-password" value={s1} onChange={e => setS1(e.target.value)} /></Field>
        <Field label="Repita a nova senha" icon={<I.key />} htmlFor="t-s2"><input id="t-s2" type="password" autoComplete="new-password" value={s2} onChange={e => setS2(e.target.value)} /></Field>
      </div>
      {erro && <div className="error" role="alert">{erro}</div>}
      <div className="btn-row"><button className="btn" type="submit" disabled={ind}>{ind ? "Trancando de novo…" : "Trocar senha"}</button><button type="button" className="btn ghost" onClick={onPronto}>Cancelar</button></div>
    </form>
  );
}
