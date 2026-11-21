// Parte do app carregada sob demanda: recibo em PDF, declaração e contrato, relatório para o imposto e anotações de sessão trancadas.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { I, Sheet, Field, Toggle, Seg, ConfirmButton, brl, brlReal, todayISO, addDays, MES_LONGO, DIA_LONGO, pad, dm, fromISO, mins, hhmm, num, fmtNum, PERFIL, termoDe, vibrar, Ilustra, copiarTexto } from "../App.jsx";
import { aberto, criarCofre, destrancar, trancar, abrirTexto, fecharCofre, mexeu, trocarSenha, novoCodigo, comRecuperacao, senhaDoCodigo } from "../cofre.js";
import { porExtenso, fmtCPF, cpfValido, dataLonga, novoPDF, pdfRecibo, pdfProntuario, pdfDeclaracao, textoDeclaracao, pdfContrato } from "../documentos-pdf.js";
export { porExtenso, fmtCPF, cpfValido, pdfRecibo };

/* ---------- números e documentos ---------- */
const soDigitos = s => String(s || "").replace(/\D/g, "");
const dataBR = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const lista = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
// Nome do conselho para cada profissão (o rótulo do campo; a pessoa escreve o número como quiser)
const CONSELHO = { Psicologia: "CRP", Psicanálise: "Registro", Psiquiatria: "CRM", "Terapia ocupacional": "CREFITO", Fonoaudiologia: "CRFa", Nutrição: "CRN", Fisioterapia: "CREFITO" };
export const conselhoDe = prof => CONSELHO[prof] || "Registro profissional";
export const servicoPadrao = prof => ({ Psicologia: "psicoterapia individual", Psicanálise: "psicanálise", Psiquiatria: "consulta psiquiátrica", "Terapia ocupacional": "terapia ocupacional", Fonoaudiologia: "fonoaudiologia", Nutrição: "consulta de nutrição", Fisioterapia: "fisioterapia" }[prof] || "atendimento");

// Pagamentos recebidos (cobranças pagas de verdade), do mais novo para o mais velho
export const pagos = db => db.charges.filter(c => c.paid && c.paidAt && !c.hidden && c.amount > 0).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
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
      <small>Assine com o dedo no quadro (fica só nos seus recibos e documentos)</small>
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

// Seus dados no PDF (recibo, declaração e contrato): os mesmos do Perfil → Recibos e imposto
const profDoc = conta => { const pf = conta.perfil || {}, doc = pf.doc || {}; return { nome: doc.nome || conta.nome, profissao: pf.profissao, conselho: conselhoDe(pf.profissao), registro: doc.registro, cpf: doc.cpf, endereco: doc.endereco }; };

// O quadro "Seus dados" das folhas de documentos: aberto para quem ainda não preencheu, e fica aberto até fechar (dá tempo de assinar)
function SeusDados({ conta, act, onde, para }) {
  const pf = conta.perfil || {}, doc = pf.doc || {};
  const falta = !doc.nome || !doc.registro || !doc.cpf;
  const [ver, setVer] = useState(() => falta || !doc.assinatura);
  if (!ver) return <button className="link" onClick={() => setVer(true)}><I.pencil /> Mudar seus dados ou a assinatura</button>;
  return (
    <div className="panel recibo-dados">
      <div className="panel-head"><h3>Seus dados {onde}</h3>{!falta && <button className="link" onClick={() => setVer(false)}>Pronto</button>}</div>
      {falta && <div className="hint">Preencha uma vez: nome completo, CPF e {conselhoDe(pf.profissao)}. Ficam guardados para {para}.</div>}
      <DadosRecibo conta={conta} act={act} compacto />
    </div>
  );
}

/* ---------- recibo de um ou mais pagamentos ---------- */
// O recibo de algumas cobranças pagas (escolhidos) de um paciente: o valor, as datas, o texto e o que vai no PDF.
// A folha do site e o pedido "reciboPdf" do app de celular montam do mesmo jeito
export function montarRecibo({ db, conta, p, escolhidos, servico, cpfPac, outroPaga, pagNome, pagCpf }) {
  const pf = conta.perfil || {}, doc = pf.doc || {};
  const valor = escolhidos.reduce((s, c) => s + c.amount, 0);
  const datas = [...new Set(escolhidos.flatMap(c => sessoesDe(db, c).map(s => s.date)))].sort();
  const ses = datas.length === 1 ? "1 sessão" : `${datas.length} sessões`;
  const quando = datas.length ? ` ${datas.length === 1 ? "realizada" : "realizadas"} em ${lista(datas.map(dataBR))}` : "";
  const pagador = outroPaga && pagNome.trim() ? { nome: pagNome.trim(), cpf: soDigitos(pagCpf) } : { nome: p.name, cpf: soDigitos(cpfPac) };
  const texto = `Recebi de ${pagador.nome}${pagador.cpf ? `, CPF ${fmtCPF(pagador.cpf)},` : ""} a quantia de ${brlReal(valor)} (${porExtenso(valor)}), referente a ${datas.length ? ses : "atendimento"} de ${servico.trim() || "atendimento"}${quando}`
    + (outroPaga && pagNome.trim() ? `, ${datas.length === 1 ? "prestada" : "prestadas"} a ${p.name}${soDigitos(cpfPac) ? `, CPF ${fmtCPF(cpfPac)}` : ""}` : "") + ".";
  const dataRecibo = escolhidos.length ? escolhidos.map(c => c.paidAt).sort().slice(-1)[0] : todayISO();
  const pdf = { valor, texto, data: dataRecibo, cidade: pf.cidade, assinatura: doc.assinatura, prof: profDoc(conta) };
  return { valor, datas, texto, dataRecibo, pdf };
}
export const nomeDoRecibo = (p, mes) => `Recibo ${p.name.split(" ")[0]} ${MES_LONGO[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}.pdf`;

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
  const [gerando, setGerando] = useState("");
  if (!p) return null;
  const pf = conta.perfil || {}, doc = pf.doc || {};
  const escolhidos = doMes.filter(c => marcados.has(c.id));
  const trocarMes = m => { setMes(m); setMarcados(new Set(todos.filter(c => c.paidAt.startsWith(m)).map(c => c.id))); };
  const marcar = id => setMarcados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const R = montarRecibo({ db, conta, p, escolhidos, servico, cpfPac, outroPaga, pagNome, pagCpf });
  const { valor, texto, dataRecibo } = R;

  const guardarPaciente = () => act.atualizarPaciente(p.id, { cpf: soDigitos(cpfPac), pagadorNome: outroPaga ? pagNome.trim() : "", pagadorCpf: outroPaga ? soDigitos(pagCpf) : "" });
  const gerar = async modo => {
    if (!escolhidos.length) return;
    setGerando(modo); guardarPaciente();
    try {
      const blob = await pdfRecibo(R.pdf);
      const arq = nomeDoRecibo(p, mes);
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
        <SeusDados conta={conta} act={act} onde="no recibo" para="todos os recibos" />
        <div className="btn-row">
          <button className="btn" disabled={!escolhidos.length || !!gerando} onClick={() => gerar("enviar")}><I.send /> {gerando === "enviar" ? "Gerando…" : "Enviar PDF"}</button>
          <button className="btn ghost" disabled={!escolhidos.length || !!gerando} onClick={() => gerar("baixar")}><I.down /> Baixar</button>
        </div>
        <div className="hint">Serve para o reembolso do plano de saúde e para {p.name.split(" ")[0]} guardar. Para o Imposto de Renda, emita também no app Receita Saúde: o relatório do imposto, no Perfil, mostra o que digitar lá.</div>
      </>}
    </Sheet>
  );
}

/* ---------- declaração de comparecimento e contrato terapêutico ---------- */
const PARA_QUE = [{ v: "trabalho", l: "Trabalho", t: "apresentar no trabalho" }, { v: "escola", l: "Escola ou faculdade", t: "apresentar na escola ou faculdade" }, { v: "outro", l: "Outro" }];
const FREQ_CONTRATO = { 7: "semanal", 14: "quinzenal", 28: "mensal" };
const nomeArquivo = (tipo, p) => `${tipo} ${p.name.split(" ")[0]} ${dataBR(todayISO()).replace(/\//g, "-")}.pdf`;

export function DocumentosSheet({ db, conta, pid, onClose, act }) {
  const p = db.patients.find(x => x.id === pid);
  const pf = conta.perfil || {}, doc = pf.doc || {};
  const dur = Number(pf.duracao) || 50;
  const [aba, setAba] = useState("declaracao");
  const [gerando, setGerando] = useState("");

  // declaração: as sessões realizadas nos últimos 90 dias, da mais nova para a mais velha
  const feitas = useMemo(() => {
    const desde = addDays(todayISO(), -90);
    return db.sessions.filter(s => s.patientId === pid && s.status === "done" && s.date >= desde)
      .sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  }, [db, pid]);
  const [marcadas, setMarcadas] = useState(() => new Set(feitas.length ? [feitas[0].id] : []));
  const [para, setPara] = useState("trabalho");
  const [outro, setOutro] = useState("");
  const [comHora, setComHora] = useState(true);
  const [semTipo, setSemTipo] = useState(false);

  // contrato: vem preenchido com o cadastro, o perfil e o Pix
  const f0 = pf.falta || { cobrar: true, horas: 24 };
  const [valor, setValor] = useState(p && p.price ? fmtNum(p.price) : "");
  const [freq, setFreq] = useState(p && p.freq ? FREQ_CONTRATO[p.freq] || `a cada ${p.freq} dias` : "semanal");
  const [duracao, setDuracao] = useState(String(dur));
  const [modalidade, setModalidade] = useState(p && p.online ? "online" : "presencial");
  const [sala, setSala] = useState((p && p.sala) || "");
  const [pagamento, setPagamento] = useState(p && p.billing === "package" ? `a cada ${p.packageSize} sessões` : "por sessão, no dia do atendimento");
  const [cobrar, setCobrar] = useState(!!f0.cobrar);
  const [horas, setHoras] = useState(String(f0.horas || 24));
  const [reajuste, setReajuste] = useState("anual, pela inflação (IPCA)");
  const [extras, setExtras] = useState("");
  const [comResp, setComResp] = useState(!!(p && p.pagadorNome));
  const [respNome, setRespNome] = useState((p && p.pagadorNome) || "");
  const [respCpf, setRespCpf] = useState(p && p.pagadorCpf ? fmtCPF(p.pagadorCpf) : "");
  if (!p) return null;
  const nome = p.name.split(" ")[0];
  const psi = !pf.profissao || pf.profissao === "Psicologia";

  const marcar = id => setMarcadas(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const finalidade = para === "outro" ? outro.trim() : (PARA_QUE.find(x => x.v === para) || {}).t || "";
  const declaracao = {
    prof: profDoc(conta), paciente: { nome: p.name, cpf: p.cpf || "" },
    sessoes: feitas.filter(s => marcadas.has(s.id)).map(s => ({ data: s.date, inicio: s.time || "", fim: s.time ? hhmm(mins(s.time) + dur) : "" })),
    finalidade, mostrarHorario: comHora, ocultarTipo: semTipo, cidade: pf.cidade, data: todayISO(), assinatura: doc.assinatura };
  const prev = textoDeclaracao(declaracao);

  const contrato = () => ({
    prof: profDoc(conta), paciente: { nome: p.name, cpf: p.cpf || "", responsavel: comResp && respNome.trim() ? { nome: respNome.trim(), cpf: soDigitos(respCpf) } : null },
    valor: num(valor), frequencia: freq, duracao: Number(duracao) || dur, modalidade, sala: modalidade === "presencial" ? "" : sala.trim(),
    pagamento: pagamento.trim(), pix: (db.settings && db.settings.pix) || "", faltas: { cobrar, horas: Number(horas) || 24 }, reajuste: reajuste.trim(),
    cidade: pf.cidade, data: todayISO(), assinatura: doc.assinatura, extras: extras.trim() });

  // gera e manda pelo celular (WhatsApp, e-mail); no computador, ou se não der para compartilhar, baixa
  const gerar = async (modo, tipo) => {
    setGerando(modo);
    try {
      const blob = tipo === "declaracao" ? await pdfDeclaracao(declaracao) : await pdfContrato(contrato());
      const dec = tipo === "declaracao";
      const arq = nomeArquivo(dec ? "Declaração de comparecimento" : "Contrato terapêutico", p);
      const r = modo === "baixar" ? (baixar(blob, arq), "baixou") : await compartilhar(blob, arq, "application/pdf", `${dec ? "Declaração" : "Contrato"} de ${p.name}`);
      if (r !== "cancelou") act.toast(r === "baixou" ? (dec ? "Declaração salva nos downloads" : "Contrato salvo nos downloads") : dec ? "Declaração enviada" : "Contrato enviado");
    } catch (e) { act.toast("Não consegui gerar o PDF. Tente de novo."); }
    setGerando("");
  };
  const botoes = (tipo, rotulo, pode = true) => (
    <div className="btn-row">
      <button className="btn" disabled={!pode || !!gerando} onClick={() => gerar("enviar", tipo)}><I.send /> {gerando === "enviar" ? "Gerando…" : rotulo}</button>
      <button className="btn ghost" disabled={!pode || !!gerando} onClick={() => gerar("baixar", tipo)}><I.down /> Baixar</button>
    </div>
  );

  return (
    <Sheet title="Documentos" sub={p.name} onClose={onClose}>
      <Seg value={aba} onChange={setAba} options={[{ v: "declaracao", l: "Declaração" }, { v: "contrato", l: "Contrato" }]} />

      {aba === "declaracao" ? <>
        <div className="hint">Para {nome} mostrar no trabalho ou na escola que veio à sessão. Diz só as datas: nada sobre o que foi conversado.</div>
        {feitas.length === 0 ? <div className="empty com-ilustra"><Ilustra n="arquivo" /><b>Nenhuma sessão realizada nos últimos 90 dias</b>Quando você marcar uma sessão de {nome} como feita, ela aparece aqui.</div> : <>
          <h3 className="section-title">Sessões<small>{marcadas.size === 1 ? "1 escolhida" : `${marcadas.size} escolhidas`}</small></h3>
          <div className="recibo-pags" role="group" aria-label="Sessões na declaração">
            {feitas.map(s => (
              <button key={s.id} type="button" className={"recibo-pag" + (marcadas.has(s.id) ? " on" : "")} aria-pressed={marcadas.has(s.id)} onClick={() => marcar(s.id)}>
                <span className={"box " + (marcadas.has(s.id) ? "done" : "up")}>{marcadas.has(s.id) && <I.check />}</span>
                <span className="mid"><b>{dataLonga(s.date)}</b><small>{DIA_LONGO[fromISO(s.date).getDay()]}{s.time ? ` · ${s.time} às ${hhmm(mins(s.time) + dur)}` : ""}</small></span>
              </button>
            ))}
          </div>
          <h3 className="section-title">Para quê?</h3>
          <div className="chips" role="radiogroup" aria-label="Para quê">
            {PARA_QUE.map(x => <button key={x.v} type="button" role="radio" aria-checked={para === x.v} className={"fchip" + (para === x.v ? " on" : "")} onClick={() => setPara(x.v)}>{x.l}</button>)}
          </div>
          {para === "outro" && <div className="fields"><Field label="Para quê? (opcional)" htmlFor="dc-para"><input id="dc-para" value={outro} onChange={e => setOutro(e.target.value)} placeholder="Ex.: apresentar no curso de inglês" /></Field></div>}
          <Toggle on={comHora} onClick={() => setComHora(!comHora)}>Mostrar o horário</Toggle>
          <Toggle on={semTipo} onClick={() => setSemTipo(!semTipo)}>{psi ? "Não dizer que é atendimento psicológico" : "Não dizer o tipo de atendimento"}</Toggle>
          {semTipo && <div className="hint">Fica escrito "atendimento profissional". Seu {conselhoDe(pf.profissao)} continua embaixo da assinatura.</div>}
          <div className="recibo-prev" aria-label="Como a declaração vai ficar">
            <div className="recibo-prev-top"><b>DECLARAÇÃO DE COMPARECIMENTO</b></div>
            <p>{marcadas.size ? prev.abertura : "Escolha pelo menos uma sessão."}</p>
            {prev.datas.map(t => <p key={t}>• {t}</p>)}
            <p>{prev.fecho}</p>
            <p className="dir">{pf.cidade ? pf.cidade + ", " : ""}{dataLonga(todayISO())}.</p>
            {doc.assinatura ? <img src={doc.assinatura} alt="" /> : <i className="assin-falta">sem assinatura</i>}
            <small>{doc.nome || conta.nome}{doc.registro ? ` · ${conselhoDe(pf.profissao)} ${doc.registro}` : ""}</small>
          </div>
        </>}
      </> : <>
        <div className="hint">Um modelo simples com o que vocês combinaram. Confira, ajuste o que precisar e envie para {comResp ? "o responsável" : nome} assinar.</div>
        <div className="fields">
          <Field label="Valor da sessão (R$)" htmlFor="ct-valor"><input id="ct-valor" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" /></Field>
          <Field label="Duração da sessão (minutos)" htmlFor="ct-dur"><input id="ct-dur" inputMode="numeric" value={duracao} onChange={e => setDuracao(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
        <Field label="Frequência"><Seg value={freq} onChange={setFreq} options={[...new Set(["semanal", "quinzenal", "mensal", freq])].map(v => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} /></Field>
        <Field label="Formato"><Seg value={modalidade} onChange={setModalidade} options={[{ v: "presencial", l: "Presencial" }, { v: "online", l: "Online" }, { v: "presencial e online", l: "Os dois" }]} /></Field>
        {modalidade !== "presencial" && <div className="fields"><Field label="Link da sala online (opcional)" htmlFor="ct-sala"><input id="ct-sala" inputMode="url" value={sala} onChange={e => setSala(e.target.value)} placeholder="https://meet.google.com/…" /></Field></div>}
        <div className="fields">
          <Field label="Quando paga" htmlFor="ct-pag"><input id="ct-pag" value={pagamento} onChange={e => setPagamento(e.target.value)} placeholder="por sessão, no dia do atendimento" /></Field>
        </div>
        <Toggle on={cobrar} onClick={() => setCobrar(!cobrar)}>Cobrar falta sem aviso</Toggle>
        {cobrar && <div className="fields"><Field label="Aviso mínimo para não cobrar (horas)" htmlFor="ct-horas"><input id="ct-horas" inputMode="numeric" value={horas} onChange={e => setHoras(e.target.value.replace(/\D/g, ""))} /></Field></div>}
        <div className="fields"><Field label="Reajuste" htmlFor="ct-reaj"><input id="ct-reaj" value={reajuste} onChange={e => setReajuste(e.target.value)} /></Field></div>
        <Toggle on={comResp} onClick={() => setComResp(!comResp)}>Quem assina é o responsável (menor de idade)</Toggle>
        {comResp && <div className="fields">
          <Field label="Nome do responsável" htmlFor="ct-rn"><input id="ct-rn" value={respNome} onChange={e => setRespNome(e.target.value)} placeholder="Nome completo" /></Field>
          <Field label="CPF do responsável" htmlFor="ct-rc"><input id="ct-rc" inputMode="numeric" value={respCpf} onChange={e => setRespCpf(fmtCPF(e.target.value))} placeholder="000.000.000-00" /></Field>
        </div>}
        <label className="ficha-campo"><b>Outros combinados (opcional)</b><textarea className="msg" value={extras} onChange={e => setExtras(e.target.value)} placeholder="Um combinado por linha. Ex.: férias em janeiro, sem sessões." /></label>
        {!(db.settings && db.settings.pix) && <div className="hint">Coloque sua chave Pix em Ajustes e ela entra sozinha no contrato.</div>}
        <div className="note"><I.receipt /><span>O contrato já fala de sigilo, de como encerrar e de mensagens fora da sessão. Leia antes de enviar.</span></div>
      </>}

      <SeusDados conta={conta} act={act} onde="nos documentos" para="recibos, declarações e contratos" />
      {aba === "declaracao" ? feitas.length > 0 && botoes("declaracao", "Gerar declaração", marcadas.size > 0) : botoes("contrato", "Gerar contrato", comResp ? !!respNome.trim() : true)}
    </Sheet>
  );
}

/* ---------- relatório para o imposto (Receita Saúde e Carnê-Leão) ---------- */
// O ano no relatório: os pagamentos (do mais novo ao mais velho), os meses com recebimento, o total e a sublocação.
// A folha do site e os pedidos "impostoResumo" e "impostoArquivo" do app de celular usam o mesmo
export function impostoDoAno(db, ano) {
  const doAno = pagos(db).filter(c => c.paidAt.startsWith(ano));
  const meses = []; for (let m = 12; m >= 1; m--) { const ch = `${ano}-${pad(m)}`, cs = doAno.filter(c => c.paidAt.startsWith(ch)); if (cs.length) meses.push({ ch, cs, total: cs.reduce((s, c) => s + c.amount, 0) }); }
  const total = doAno.reduce((s, c) => s + c.amount, 0);
  const subl = db.sessions.filter(s => s.date.startsWith(ano) && (s.status === "done" || s.cobrada)).reduce((s, x) => s + (x.sublet || 0), 0);
  return { doAno, meses, total, subl };
}
export function linhaImposto(db, c) {
  const p = db.patients.find(x => x.id === c.patientId) || { name: "Removido" };
  return { data: c.paidAt, nome: p.name, cpf: p.cpf || "", pagador: p.pagadorNome || p.name, cpfPag: p.pagadorNome ? p.pagadorCpf || "" : p.cpf || "", valor: c.amount, sessoes: sessoesDe(db, c).map(s => dataBR(s.date)).join(" ") };
}
export function csvImposto(db, ano) {
  const { doAno } = impostoDoAno(db, ano);
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["Data do pagamento", "Paciente", "CPF do paciente", "Quem pagou", "CPF de quem pagou", "Valor", "Sessões", "Emitido no Receita Saúde"].map(q).join(";"),
    ...doAno.slice().reverse().map(c => { const l = linhaImposto(db, c); return [dataBR(l.data), l.nome, fmtCPF(l.cpf), l.pagador, fmtCPF(l.cpfPag), l.valor.toFixed(2).replace(".", ","), l.sessoes, c.rsaude ? "sim" : "não"].map(q).join(";"); })];
  return "﻿" + rows.join("\r\n");
}
export async function pdfImposto(db, conta, ano) {
  const { meses, total, subl } = impostoDoAno(db, ano);
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
      const l = linhaImposto(db, c);
      doc.text(`${dataBR(l.data)}   ${l.nome}${l.cpf ? ` (CPF ${fmtCPF(l.cpf)})` : " (sem CPF)"}${l.pagador !== l.nome ? ` · pago por ${l.pagador}${l.cpfPag ? ` (CPF ${fmtCPF(l.cpfPag)})` : ""}` : ""}`, M, y);
      doc.text(brlReal(l.valor), 194, y, { align: "right" }); y += 5;
    });
    y += 3;
  });
  return doc.output("blob");
}

// Lançar no Receita Saúde, um pagamento por vez: cada dado que o app da Receita pede, com o botão de copiar ao lado.
// "Lancei" marca o pagamento e já mostra o próximo. Nada sai do aparelho: é só para copiar e colar.
function LancarReceitaSaude({ db, conta, pend, act, onFim }) {
  const [inicial] = useState(pend.length);
  const [pulados, setPulados] = useState(() => new Set());
  const c = pend.find(x => !pulados.has(x.id));
  const feitos = inicial - pend.length;
  if (!c) return (
    <div className="rs-fim">
      <span className="rs-fim-ic"><I.check /></span>
      <b>{pend.length ? "Você passou por todos" : "Tudo lançado!"}</b>
      <small>{pend.length ? `${pend.length} ${pend.length === 1 ? "ficou" : "ficaram"} para depois (sem marcar).` : `${feitos} ${feitos === 1 ? "recibo lançado" : "recibos lançados"} no Receita Saúde.`}</small>
      <button className="btn mode" onClick={onFim}>Voltar para o resumo</button>
    </div>
  );
  const l = linhaImposto(db, c), mesma = l.pagador === l.nome;
  const prof = ((conta.perfil || {}).profissao || "Psicologia").toLowerCase();
  const datas = l.sessoes ? l.sessoes.split(" ") : [];
  const desc = `Atendimento em ${prof}${datas.length ? ` (${datas.length === 1 ? "sessão de" : "sessões de"} ${datas.join(", ")})` : ""}`;
  const copiar = (v, o) => { vibrar("toque"); copiarTexto(v, act, `${o} copiado`); };
  const Dado = ({ rotulo, valor, copia, falta }) => (
    <div className={"rs-dado" + (falta ? " falta" : "")}>
      <span><small>{rotulo}</small><b>{valor}</b></span>
      {!falta && <button type="button" className="rs-copiar" onClick={() => copiar(copia, rotulo)} aria-label={`Copiar ${rotulo}`}><I.copy />Copiar</button>}
      {falta && <button type="button" className="rs-copiar" onClick={() => act.editPatient(c.patientId)}><I.pencil />Colocar</button>}
    </div>
  );
  return (
    <div className="rs">
      <div className="rs-topo">
        <span>Recibo {feitos + 1} de {inicial}</span>
        <span className="rs-barra" aria-hidden="true"><i style={{ width: `${(feitos / Math.max(1, inicial)) * 100}%` }} /></span>
      </div>
      <div className="rs-cartao-pag">
        <small>Pagamento de {dataBR(l.data)}</small>
        <b>{mesma ? l.nome : `${l.nome}, pago por ${l.pagador}`}</b>
      </div>
      <div className="rs-dados">
        <Dado rotulo="CPF de quem pagou" valor={l.cpfPag ? fmtCPF(l.cpfPag) : "Falta o CPF"} copia={l.cpfPag} falta={!l.cpfPag} />
        {mesma ? <div className="rs-dado"><span><small>Quem foi atendido</small><b>A mesma pessoa que pagou</b></span></div>
          : <Dado rotulo="CPF de quem foi atendido" valor={l.cpf ? fmtCPF(l.cpf) : "Falta o CPF"} copia={l.cpf} falta={!l.cpf} />}
        <Dado rotulo="Valor" valor={brlReal(l.valor)} copia={l.valor.toFixed(2).replace(".", ",")} />
        <Dado rotulo="Data do pagamento" valor={dataBR(l.data)} copia={dataBR(l.data)} />
        <Dado rotulo="Descrição" valor={desc} copia={desc} />
      </div>
      <button className="btn mode" onClick={() => { vibrar("ok"); act.marcarReceitaSaude(c.id); }}><I.check /> Lancei · próximo</button>
      <button className="btn ghost" onClick={() => setPulados(new Set([...pulados, c.id]))}>Pular este por agora</button>
      <p className="hint">Abra o app <b>Receita Saúde</b> (da Receita Federal) ao lado, emita o recibo com estes dados e volte aqui para marcar.</p>
    </div>
  );
}

export function ImpostoSheet({ db, conta, onClose, act }) {
  const todos = pagos(db);
  const anos = [...new Set([todayISO().slice(0, 4), ...todos.map(c => c.paidAt.slice(0, 4))])].sort().reverse();
  const [ano, setAno] = useState(anos[0]);
  const [mesAberto, setMesAberto] = useState(() => { const u = todos.find(c => c.paidAt.startsWith(anos[0])); return u ? u.paidAt.slice(0, 7) : ""; });
  const { doAno, meses, total, subl } = impostoDoAno(db, ano);
  const pac = id => db.patients.find(p => p.id === id) || { name: "Removido" };
  const semCpf = new Set(doAno.filter(c => !(pac(c.patientId).cpf)).map(c => c.patientId));
  const feitos = doAno.filter(c => c.rsaude).length;
  const T = termoDe(PERFIL.termo || "Paciente");
  const linha = c => linhaImposto(db, c);
  // os que faltam lançar no Receita Saúde neste ano, do mais antigo ao mais novo
  const pend = doAno.filter(c => !c.rsaude).slice().reverse();
  const [lancar, setLancar] = useState(false);

  const csv = () => new Blob([csvImposto(db, ano)], { type: "text/csv;charset=utf-8" });
  const pdf = () => pdfImposto(db, conta, ano);
  const exportar = async tipo => {
    try {
      const r = tipo === "csv" ? await compartilhar(csv(), `Recebimentos ${ano}.csv`, "text/csv", `Recebimentos de ${ano}`) : await compartilhar(await pdf(), `Recebimentos ${ano}.pdf`, "application/pdf", `Recebimentos de ${ano}`);
      if (r === "baixou") act.toast("Arquivo salvo nos downloads");
    } catch (e) { act.toast("Não consegui gerar o arquivo."); }
  };

  return (
    lancar ? <Sheet title="Lançar no Receita Saúde" onClose={() => setLancar(false)}>
      <LancarReceitaSaude db={db} conta={conta} pend={pend} act={act} onFim={() => setLancar(false)} />
    </Sheet> :
    <Sheet title="Imposto de Renda" sub="O que você recebeu, mês a mês" onClose={onClose}>
      {pend.length > 0 && (
        <button type="button" className="rs-chamada" onClick={() => { vibrar("toque"); setLancar(true); }}>
          <span className="rs-chamada-ic"><I.receipt /></span>
          <span className="rs-chamada-t"><b>{pend.length} {pend.length === 1 ? "recibo para lançar" : "recibos para lançar"}</b><small>No Receita Saúde, um por vez, copiando cada dado</small></span>
          <em>Lançar</em>
        </button>
      )}
      {doAno.length > 0 && pend.length === 0 && <div className="rs-ok"><I.check /><span>Todos os recibos de {ano} estão no Receita Saúde.</span></div>}
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
  const [, setVer] = useState(0), [codigo, setCodigo] = useState(null);
  useEffect(() => { const f = () => setVer(v => v + 1); addEventListener("cofre", f); return () => removeEventListener("cofre", f); }, []);
  if (!p) return null;
  const nome = p.name.split(" ")[0];
  return (
    <Sheet title={`Prontuário · ${nome}`} sub="Trancado com a sua senha" onClose={onClose}>
      {codigo ? <MostrarCodigo codigo={codigo} act={act} onPronto={() => setCodigo(null)} />
        : !db.cofre ? <CriarSenha act={act} onCodigo={setCodigo} /> : !aberto() ? <Destrancar db={db} act={act} /> : <ListaNotas db={db} p={p} sid={sid} act={act} onCodigo={setCodigo} />}
    </Sheet>
  );
}
// O código aparece uma vez só: depois de criar a senha, ao trocar ou ao pedir um
function MostrarCodigo({ codigo, act, onPronto }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => { try { await navigator.clipboard.writeText(codigo); act.toast("Código copiado"); } catch (e) { act.toast("Não consegui copiar. Anote o código."); } };
  return (
    <div className="stack">
      <div className="notas-intro"><Ilustra n="cadeados" /><span><b>Guarde este código</b>Se esquecer a senha, é com ele que você abre o prontuário de novo. Ele só aparece agora, e ninguém consegue recuperar por você.</span></div>
      <div className="codigo-rec">{codigo}</div>
      <button type="button" className="btn ghost" onClick={copiar}>Copiar o código</button>
      <Toggle on={ok} onClick={() => setOk(!ok)}>Guardei o código em um lugar seguro</Toggle>
      <button type="button" className="btn" disabled={!ok} onClick={onPronto}><I.check /> Continuar</button>
    </div>
  );
}
function CriarCodigo({ db, act, onCodigo, onVoltar }) {
  const [s, setS] = useState(""), [erro, setErro] = useState(""), [ind, setInd] = useState(false);
  const criar = async e => {
    e.preventDefault(); if (!s) return;
    setInd(true);
    if (!await destrancar(db.cofre, s)) { setInd(false); setErro("Senha errada."); vibrar("erro"); return; }
    const codigo = novoCodigo();
    act.salvarCofre(await comRecuperacao(db.cofre, s, codigo)); vibrar("ok"); onCodigo(codigo);
  };
  return (
    <form className="stack" onSubmit={criar} noValidate>
      <div className="fields"><Field label="Senha do prontuário" icon={<I.key />} htmlFor="c-s"><input id="c-s" type="password" autoComplete="current-password" autoFocus value={s} onChange={e => { setS(e.target.value); setErro(""); }} /></Field></div>
      {erro && <div className="error" role="alert">{erro}</div>}
      <div className="btn-row"><button className="btn" type="submit" disabled={ind}>{ind ? "Criando…" : "Criar o código"}</button><button type="button" className="btn ghost" onClick={onVoltar}>Cancelar</button></div>
    </form>
  );
}
function CriarSenha({ act, onCodigo }) {
  const [s1, setS1] = useState(""), [s2, setS2] = useState(""), [erro, setErro] = useState(""), [ok, setOk] = useState(false), [ind, setInd] = useState(false);
  const criar = async e => {
    e.preventDefault();
    if (s1.length < 6) return setErro("Use pelo menos 6 letras ou números.");
    if (s1 !== s2) return setErro("As duas senhas não são iguais.");
    if (!ok) return setErro("Marque que você entendeu como funciona a senha.");
    setInd(true);
    const codigo = novoCodigo();
    const cofre = await comRecuperacao(await criarCofre(s1), s1, codigo);
    onCodigo(codigo); act.salvarCofre(cofre); vibrar("ok");
  };
  return (
    <form className="stack" onSubmit={criar} noValidate>
      <div className="notas-intro"><Ilustra n="cadeados" /><span><b>Só você lê</b>O texto é trancado aqui no aparelho antes de ir para a nuvem. Ninguém mais consegue abrir: nem eu, nem o servidor.</span></div>
      <div className="fields">
        <Field label="Crie uma senha para o prontuário" icon={<I.key />} htmlFor="n-s1"><input id="n-s1" type="password" autoComplete="new-password" value={s1} onChange={e => setS1(e.target.value)} /></Field>
        <Field label="Repita a senha" icon={<I.key />} htmlFor="n-s2"><input id="n-s2" type="password" autoComplete="new-password" value={s2} onChange={e => setS2(e.target.value)} /></Field>
      </div>
      <Toggle on={ok} onClick={() => setOk(!ok)}>Entendi: sem esta senha e sem o código de recuperação, o prontuário não pode ser aberto</Toggle>
      {erro && <div className="error" role="alert">{erro}</div>}
      <button className="btn" type="submit" disabled={ind}><I.check /> {ind ? "Criando…" : "Criar senha"}</button>
      <div className="hint">É diferente da senha da conta. O cofre tranca sozinho depois de 10 minutos parado ou quando você sai do app.</div>
    </form>
  );
}
function Destrancar({ db, act }) {
  const [s, setS] = useState(""), [erro, setErro] = useState(""), [ind, setInd] = useState(false), [esqueci, setEsqueci] = useState(false), [cod, setCod] = useState("");
  const comCodigo = async () => {
    setInd(true); const senha = await senhaDoCodigo(db.cofre, cod);
    const ok = senha != null && await destrancar(db.cofre, senha);
    setInd(false);
    if (!ok) { setErro("Código errado."); vibrar("erro"); } else vibrar("ok");
  };
  const abrir = async e => {
    e.preventDefault(); if (!s) return;
    setInd(true); const ok = await destrancar(db.cofre, s); setInd(false);
    if (!ok) { setErro("Senha errada."); vibrar("erro"); } else vibrar("ok");
  };
  return (
    <form className="stack" onSubmit={abrir} noValidate>
      <div className="notas-intro"><Ilustra n="cadeados" /><span><b>Prontuário trancado</b>Digite a sua senha para abrir.</span></div>
      <div className="fields"><Field label="Senha do prontuário" icon={<I.key />} htmlFor="n-s"><input id="n-s" type="password" autoComplete="current-password" autoFocus value={s} onChange={e => { setS(e.target.value); setErro(""); }} /></Field></div>
      {erro && <div className="error" role="alert">{erro}</div>}
      <button className="btn" type="submit" disabled={ind}>{ind ? "Abrindo…" : "Abrir"}</button>
      {!esqueci ? <button type="button" className="btn text" onClick={() => setEsqueci(true)}>Esqueci a senha</button>
        : db.cofre.rec ? <>
          <div className="fields"><Field label="Código de recuperação" icon={<I.key />} htmlFor="n-c"><input id="n-c" autoComplete="off" autoCapitalize="characters" value={cod} onChange={e => { setCod(e.target.value); setErro(""); }} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" /></Field></div>
          <button type="button" className="btn ghost" disabled={ind || !cod.trim()} onClick={comCodigo}>Abrir com o código</button>
          <ConfirmButton label="Perdi o código: apagar tudo" titulo="Apagar todos os prontuários?" texto={`Sem a senha e sem o código, ninguém consegue abrir os ${(db.notas || []).length} registros guardados. Eles somem de vez e você cria uma senha nova. Isso não dá para desfazer.`} acao="Apagar e recomeçar" onConfirm={() => act.trocarCofre(null, [])} />
        </>
        : <ConfirmButton label="Apagar as anotações e criar outra senha" titulo="Apagar todas as anotações?" texto={`Sem a senha, ninguém consegue abrir as ${(db.notas || []).length} anotações guardadas. Elas somem de vez e você cria uma senha nova. Isso não dá para desfazer.`} acao="Apagar e recomeçar" onConfirm={() => act.trocarCofre(null, [])} />}
    </form>
  );
}
// O que vai na ficha do prontuário (segue o que a Resolução CFP 001/2009 pede que o registro tenha)
const FICHA = [
  ["demanda", "Avaliação da demanda", "O que trouxe a pessoa, queixa principal e histórico importante"],
  ["objetivos", "Objetivos do trabalho", "O que vocês combinaram buscar"],
  ["procedimentos", "Abordagem e procedimentos", "Abordagem, técnicas e instrumentos usados"],
  ["encaminhamento", "Encaminhamento ou encerramento", "Para quem foi encaminhado, ou como e por que terminou"],
  ["documentos", "Documentos produzidos", "Relatórios, laudos, declarações e outros, com a data"],
];
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function FichaProntuario({ db, p, act, onVoltar }) {
  const atual = (db.notas || []).find(n => n.pid === p.id && n.tipo === "ficha");
  const [f, setF] = useState(null);
  useEffect(() => {
    let vivo = true;
    (atual ? abrirTexto(atual).then(JSON.parse) : Promise.resolve({})).then(d => { if (vivo) setF(d); }).catch(() => { if (vivo) setF({}); });
    return () => { vivo = false; };
  }, []);
  if (!f) return <div className="empty">Abrindo…</div>;
  const muda = (k, v) => { setF({ ...f, [k]: v }); mexeu(); };
  const salvar = async () => {
    mexeu();
    act.salvarNota({ ...(atual || {}), id: atual ? atual.id : novoId(), pid: p.id, tipo: "ficha", sid: null, data: todayISO(), criado: atual ? atual.criado : Date.now(), editado: Date.now(), ...(await trancar(JSON.stringify(f))) });
    vibrar("ok"); onVoltar();
  };
  return (
    <div className="stack">
      <div className="fields">
        <Field label="Início do atendimento" htmlFor="f-ini"><input id="f-ini" type="date" value={f.inicio || ""} onChange={e => muda("inicio", e.target.value)} /></Field>
        <Field label="Data de nascimento" htmlFor="f-nasc"><input id="f-nasc" type="date" value={f.nascimento || ""} onChange={e => muda("nascimento", e.target.value)} /></Field>
      </div>
      {FICHA.map(([k, rotulo, dica]) => (
        <label key={k} className="ficha-campo"><b>{rotulo}</b><textarea className="msg nota-txt" value={f[k] || ""} onChange={e => muda(k, e.target.value)} placeholder={dica} /></label>
      ))}
      <div className="btn-row"><button className="btn" onClick={salvar}><I.check /> Salvar</button><button className="btn ghost" onClick={onVoltar}>Cancelar</button></div>
    </div>
  );
}
function ListaNotas({ db, p, sid, act, onCodigo }) {
  const notas = (db.notas || []).filter(n => n.pid === p.id && !n.tipo).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const ses = sid && db.sessions.find(s => s.id === sid);
  const [textos, setTextos] = useState({});
  const [edit, setEdit] = useState(() => ses && !notas.some(n => n.sid === sid) ? { nova: true, data: ses.date, texto: "" } : null);
  const [trocar, setTrocar] = useState(false), [ficha, setFicha] = useState(false), [pedirCodigo, setPedirCodigo] = useState(false), [gerando, setGerando] = useState(false);
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
  // o prontuário inteiro em PDF: para guardar fora do app, entregar a quem tem direito ou passar a outro profissional
  const baixarPdf = async () => {
    setGerando(true); mexeu();
    try {
      const reg = (db.notas || []).find(n => n.pid === p.id && n.tipo === "ficha");
      const d = reg ? JSON.parse(await abrirTexto(reg)) : {};
      const conta = act.contaAtual(), pf = conta.perfil || {}, doc = pf.doc || {};
      const blob = await pdfProntuario({
        hoje: todayISO(), inicio: d.inicio, sessoes: db.sessions.filter(s => s.patientId === p.id && s.status === "done").length,
        prof: { nome: doc.nome || conta.nome, profissao: pf.profissao, conselho: conselhoDe(pf.profissao), registro: doc.registro },
        paciente: { nome: p.name, cpf: p.cpf, telefone: p.phone, nascimento: d.nascimento },
        secoes: FICHA.map(([k, titulo]) => ({ titulo, texto: d[k] })),
        evolucoes: notas.slice().reverse().map(n => ({ data: n.data, texto: textos[n.id] || "" })),
      });
      baixar(blob, `Prontuário ${p.name}.pdf`); act.toast("PDF do prontuário pronto");
    } catch (e) { act.toast("Não consegui gerar o PDF. Tente de novo."); }
    setGerando(false);
  };
  if (ficha) return <FichaProntuario db={db} p={p} act={act} onVoltar={() => setFicha(false)} />;
  if (pedirCodigo) return <CriarCodigo db={db} act={act} onCodigo={onCodigo} onVoltar={() => setPedirCodigo(false)} />;
  if (trocar) return <TrocarSenha db={db} act={act} onCodigo={onCodigo} onPronto={() => setTrocar(false)} />;
  if (edit) return (
    <div className="stack">
      <div className="fields">
        <Field label="Data da sessão" htmlFor="n-data"><input id="n-data" type="date" value={edit.data} onChange={e => e.target.value && setEdit({ ...edit, data: e.target.value })} /></Field>
      </div>
      <textarea className="msg nota-txt" autoFocus value={edit.texto} onChange={e => { setEdit({ ...edit, texto: e.target.value }); mexeu(); }} placeholder="O que foi trabalhado, combinados, pontos para a próxima sessão…" aria-label="Anotação" />
      <div className="btn-row"><button className="btn" onClick={salvar}><I.check /> Salvar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
      {!edit.nova && <ConfirmButton label="Apagar esta evolução" titulo="Apagar a evolução?" texto="Ela some de vez, deste e de todos os seus aparelhos." acao="Apagar" onConfirm={() => { act.apagarNota(edit.id); setEdit(null); }} />}
    </div>
  );
  return (
    <div className="stack">
      {!db.cofre.rec && <div className="note amber"><I.alert /><span><b>Crie um código de recuperação.</b> Sem ele, quem esquece a senha perde o prontuário. <button type="button" className="link-inline" onClick={() => setPedirCodigo(true)}>Criar agora</button></span></div>}
      <button className="btn ghost" onClick={() => setFicha(true)}><I.pencil /> Ficha do atendimento</button>
      <button className="btn" onClick={() => setEdit({ nova: true, data: ses ? ses.date : todayISO(), texto: "" })}><I.plus /> Nova evolução</button>
      {notas.length === 0 && <div className="empty">Nenhuma evolução ainda. Elas ficam em ordem de data, só para você.</div>}
      <div className="notas-lista">
        {notas.map(n => (
          <button key={n.id} className="nota-item" onClick={() => textos[n.id] != null && setEdit({ id: n.id, data: n.data, texto: textos[n.id] })}>
            <small>{dataLonga(n.data)}</small>
            <span>{textos[n.id] == null ? "…" : textos[n.id]}</span>
          </button>
        ))}
      </div>
      <button className="btn ghost" disabled={gerando} onClick={baixarPdf}><I.receipt /> {gerando ? "Gerando…" : "Baixar o prontuário em PDF"}</button>
      <div className="btn-row"><button className="btn ghost" onClick={() => { fecharCofre(); vibrar("toque"); }}><I.key /> Trancar agora</button><button className="btn ghost" onClick={() => setTrocar(true)}>Trocar senha</button></div>
    </div>
  );
}
function TrocarSenha({ db, act, onPronto, onCodigo }) {
  const [s1, setS1] = useState(""), [s2, setS2] = useState(""), [erro, setErro] = useState(""), [ind, setInd] = useState(false);
  const ir = async e => {
    e.preventDefault();
    if (s1.length < 6) return setErro("Use pelo menos 6 letras ou números.");
    if (s1 !== s2) return setErro("As duas senhas não são iguais.");
    setInd(true);
    try {
      const r = await trocarSenha(db.notas || [], s1), codigo = novoCodigo();
      act.trocarCofre(await comRecuperacao(r.cofre, s1, codigo), r.notas); vibrar("ok"); onPronto(); onCodigo(codigo);
    }
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
