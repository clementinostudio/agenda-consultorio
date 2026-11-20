// Documentos em PDF: recibo, declaração de comparecimento, contrato terapêutico e prontuário. Não depende do resto do app: o gerador de recibo grátis do site
// (sobre/ferramentas/) usa este mesmo arquivo. O jsPDF só baixa na hora de gerar.
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const FMT_BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlReal = v => FMT_BRL.format(Number(v) || 0);
const soDigitos = s => String(s || "").replace(/\D/g, "");

/* ---------- números e datas por escrito ---------- */
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
export const fmtCPF = s => { const d = soDigitos(s).slice(0, 11); return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2"); };
export function cpfValido(s) {
  const d = soDigitos(s); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let t = 0; for (let i = 0; i < n; i++) t += Number(d[i]) * (n + 1 - i); const r = t * 10 % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
export const dataLonga = iso => { const [a, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };

export async function novoPDF() { const { jsPDF } = await import("jspdf"); return new jsPDF({ unit: "mm", format: "a4" }); }

/* ---------- assinatura (recibo, declaração e contrato) ---------- */
// O desenho da assinatura (se tiver), a linha, o nome em negrito e as linhas de baixo, tudo centrado em cx.
// y é onde o desenho começa; devolve o y depois da última linha
function blocoAssinatura(doc, { cx, y, meia = 45, larg, img, nome, linhas }) {
  if (img) { const w = Math.min(70, 2 * meia - 10); try { doc.addImage(img, "PNG", cx - w / 2, y - 4, w, w * 24 / 70); } catch (e) {} }
  y += 22; doc.setDrawColor(120); doc.line(cx - meia, y, cx + meia, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  const nm = doc.splitTextToSize(nome || "", larg); doc.text(nm, cx, y, { align: "center" }); y += 6 + (nm.length - 1) * 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  linhas.filter(Boolean).forEach(l => { doc.text(doc.splitTextToSize(l, larg), cx, y, { align: "center" }); y += 5.5; });
  return y;
}
// Embaixo do nome do profissional: profissão e registro, CPF e endereço. semTipo: só o registro, sem o nome da profissão
const linhasProf = (prof, semTipo) => [
  prof.profissao && prof.registro && !semTipo ? `${prof.profissao} · ${prof.conselho} ${prof.registro}` : prof.registro ? `${prof.conselho} ${prof.registro}` : semTipo ? "" : prof.profissao,
  prof.cpf ? `CPF ${fmtCPF(prof.cpf)}` : "", prof.endereco || ""];
const cidadeData = (cidade, data) => `${cidade ? cidade + ", " : ""}${dataLonga(data)}.`;

/* ---------- recibo ---------- */
export async function pdfRecibo(r) {
  const doc = await novoPDF(), W = 210, M = 22; let y = 30;
  doc.setDrawColor(210); doc.setLineWidth(.4); doc.roundedRect(M - 6, 14, W - 2 * (M - 6), 190, 4, 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("RECIBO", M, y);
  doc.setFontSize(16); doc.text(brlReal(r.valor), W - M, y, { align: "right" });
  y += 16; doc.setFont("helvetica", "normal"); doc.setFontSize(12.5);
  const corpo = doc.splitTextToSize(r.texto, W - 2 * M);
  doc.text(corpo, M, y, { lineHeightFactor: 1.6 }); y += corpo.length * 12.5 * .3528 * 1.6 + 10;
  doc.text(cidadeData(r.cidade, r.data), W - M, y, { align: "right" }); y += 18;
  blocoAssinatura(doc, { cx: W / 2, y, larg: W - 2 * M, img: r.assinatura, nome: r.prof.nome, linhas: linhasProf(r.prof) });
  if (r.rodape) { doc.setFontSize(8.5); doc.setTextColor(130); doc.text(r.rodape, W / 2, 200, { align: "center" }); doc.setTextColor(0); }
  return doc.output("blob");
}

/* ---------- declaração de comparecimento ----------
   { prof, paciente: { nome, cpf }, sessoes: [{ data: "AAAA-MM-DD", inicio: "HH:MM", fim: "HH:MM" }],
     finalidade ("apresentar no trabalho": vira "…a pedido do(a) interessado(a), para apresentar no trabalho."),
     mostrarHorario, ocultarTipo, cidade, data, assinatura, rodape }
   Pelo Código de Ética, a declaração diz só que a pessoa compareceu: nada de diagnóstico nem do que foi tratado. */
const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const diaDaSemana = iso => { const [a, m, d] = iso.split("-").map(Number); return SEMANA[new Date(a, m - 1, d).getDay()]; };
const dataCurta = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const ATENDIMENTO = { Psicologia: "atendimento psicológico", Psicanálise: "atendimento psicanalítico", Psiquiatria: "atendimento psiquiátrico", Fonoaudiologia: "atendimento fonoaudiológico",
  Nutrição: "atendimento nutricional", Fisioterapia: "atendimento fisioterapêutico", "Terapia ocupacional": "atendimento de terapia ocupacional" };
// "atendimento psicológico" (ou o da profissão); sem a profissão, "atendimento profissional"
export const tipoDeAtendimento = profissao => ATENDIMENTO[profissao] || (profissao ? `atendimento de ${profissao.toLowerCase()}` : "atendimento profissional");
const semPonto = t => String(t || "").trim().replace(/[.;,\s]+$/, "");
const horario = (s, mostrar) => mostrar && s.inicio ? s.fim ? `, das ${s.inicio} às ${s.fim}` : `, às ${s.inicio}` : "";

// O texto da declaração em partes (o app mostra a prévia com o mesmo texto do PDF):
// abertura, as datas (uma por linha quando são várias) e o fecho
export function textoDeclaracao(d) {
  const ses = [...(d.sessoes || [])].sort((a, b) => (a.data + (a.inicio || "")).localeCompare(b.data + (b.inicio || "")));
  const quem = `${d.paciente.nome}${d.paciente.cpf ? `, CPF ${fmtCPF(d.paciente.cpf)},` : ""}`;
  const tipo = d.ocultarTipo ? "atendimento profissional" : tipoDeAtendimento(d.prof.profissao);
  const um = ses.length === 1 ? ses[0] : null;
  const abertura = `Declaro, para os devidos fins, que ${quem} compareceu a ${tipo}` + (um ? ` no dia ${dataLonga(um.data)} (${diaDaSemana(um.data)})${horario(um, d.mostrarHorario)}.` : " nas seguintes datas:");
  const datas = um ? [] : ses.map(s => `${dataCurta(s.data)}, ${diaDaSemana(s.data)}${horario(s, d.mostrarHorario)}`);
  const para = semPonto(d.finalidade).replace(/^para\s+/i, "");
  const fecho = `Esta declaração é emitida a pedido do(a) interessado(a)${para ? `, para ${para}` : ""}.`;
  return { abertura, datas, fecho };
}

export async function pdfDeclaracao(d) {
  const doc = await novoPDF(), W = 210, H = 297, M = 22, LARG = W - 2 * M, LH = 12.5 * .3528 * 1.6; let y = 32;
  const { abertura, datas, fecho } = textoDeclaracao(d);
  doc.setDrawColor(210); doc.setLineWidth(.4); doc.roundedRect(M - 6, 14, W - 2 * (M - 6), H - 28, 4, 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.text("DECLARAÇÃO DE COMPARECIMENTO", W / 2, y, { align: "center" });
  y += 20; doc.setFont("helvetica", "normal"); doc.setFontSize(12.5);
  const paragrafo = (t, x = M, larg = LARG) => { const ls = doc.splitTextToSize(t, larg); doc.text(ls, x, y, { lineHeightFactor: 1.6 }); y += ls.length * LH; };
  paragrafo(abertura); y += 3;
  datas.forEach(t => { doc.text("•", M + 4, y); paragrafo(t, M + 10, LARG - 10); });
  y += datas.length ? 5 : 3;
  paragrafo(fecho); y += 12;
  doc.text(cidadeData(d.cidade, d.data), W - M, y, { align: "right" }); y += 18;
  blocoAssinatura(doc, { cx: W / 2, y, larg: LARG, img: d.assinatura, nome: d.prof.nome, linhas: linhasProf(d.prof, d.ocultarTipo) });
  if (d.rodape) { doc.setFontSize(8.5); doc.setTextColor(130); doc.text(d.rodape, W / 2, H - 20, { align: "center" }); doc.setTextColor(0); }
  return doc.output("blob");
}

/* ---------- contrato terapêutico ----------
   { prof, paciente: { nome, cpf, responsavel: { nome, cpf } | null }, valor, frequencia ("semanal", "quinzenal",
     "mensal" ou um texto), duracao (min), modalidade ("presencial" | "online" | "presencial e online"), sala (link),
     pagamento ("por sessão, no dia do atendimento"), pix, faltas: { cobrar, horas }, reajuste, cidade, data,
     assinatura, extras (texto livre, um parágrafo por linha), rodape } */
const PROFISSIONAL = { Psicologia: "psicólogo(a)", Psicanálise: "psicanalista", Psiquiatria: "médico(a) psiquiatra", Fonoaudiologia: "fonoaudiólogo(a)",
  Nutrição: "nutricionista", Fisioterapia: "fisioterapeuta", "Terapia ocupacional": "terapeuta ocupacional" };
const FREQ_TXT = { semanal: "uma vez por semana", quinzenal: "a cada quinze dias", mensal: "uma vez por mês" };
const comCpf = (nome, cpf) => `${nome}${cpf ? `, CPF ${fmtCPF(cpf)}` : ""}`;

// As cláusulas do contrato: [{ titulo, textos: [parágrafos] }]
export function textoContrato(c) {
  const pr = c.prof || {}, pa = c.paciente || {}, resp = pa.responsavel && pa.responsavel.nome ? pa.responsavel : null;
  const quem = PROFISSIONAL[pr.profissao] || (pr.profissao ? `profissional de ${pr.profissao.toLowerCase()}` : "");
  const end = semPonto(pr.endereco), sala = String(c.sala || "").trim();
  const mod = c.modalidade || "presencial", presencial = mod !== "online";
  const freq = semPonto(c.frequencia), freqTxt = FREQ_TXT[freq.toLowerCase()] || freq;
  const valor = Number(c.valor) || 0, horas = Number(c.faltas && c.faltas.horas) || 24;
  const reaj = semPonto(c.reajuste), pag = semPonto(c.pagamento);
  const ehPsi = !pr.profissao || pr.profissao === "Psicologia";
  const cl = [
    { titulo: "Partes", textos: [
      `Profissional: ${[pr.nome, quem, pr.registro ? `${pr.conselho || "registro"} ${pr.registro}` : "", pr.cpf ? `CPF ${fmtCPF(pr.cpf)}` : ""].filter(Boolean).join(", ")}${end ? `, com consultório em ${end}` : ""}.`,
      `Paciente: ${comCpf(pa.nome || "", pa.cpf)}.`,
      resp && `Responsável legal: ${comCpf(resp.nome, resp.cpf)}, que assina este contrato em nome do(a) paciente.`] },
    { titulo: "Objeto e formato", textos: [
      `Este contrato trata do ${tipoDeAtendimento(pr.profissao)} de ${pa.nome || "paciente"}, em sessões de ${Number(c.duracao) || 50} minutos${freqTxt ? `, ${freqTxt}` : ""}.`,
      mod === "presencial" ? `As sessões são presenciais${end ? ", no consultório" : ""}.`
        : `As sessões ${presencial ? `podem ser presenciais${end ? " (no consultório)" : ""} ou online` : "são online"}, por videochamada${sala ? `, na sala ${sala}` : ""}. Nas sessões online, o(a) paciente cuida de estar em um lugar reservado e com boa conexão.`,
      "Os dias e horários são combinados entre as partes. Atrasos não estendem o fim da sessão."] },
    { titulo: "Honorários e pagamento", textos: [
      valor ? `O valor de cada sessão é ${brlReal(valor)} (${porExtenso(valor)}).` : "O valor das sessões é combinado entre as partes.",
      pag && `O pagamento é feito ${pag}.`,
      c.pix && `Pagamentos por Pix podem ser feitos na chave ${String(c.pix).trim()}.`,
      "O recibo é emitido sempre que pedido."] },
    { titulo: "Faltas e remarcações", textos: c.faltas && c.faltas.cobrar ? [
      `Faltas e cancelamentos avisados com menos de ${horas} horas de antecedência são cobrados como sessão realizada, porque o horário fica reservado para o(a) paciente.`,
      `Com aviso de pelo menos ${horas} horas, a sessão pode ser remarcada, conforme a agenda.`] : [
      "Faltas não são cobradas. Mesmo assim, pede-se aviso com a maior antecedência possível, para que o horário possa ser remarcado."] },
    { titulo: "Reajuste", textos: [
      reaj ? `Reajuste do valor: ${reaj}. Qualquer mudança é avisada com pelo menos 30 dias de antecedência.` : "O valor pode ser reajustado em comum acordo, com aviso de pelo menos 30 dias de antecedência."] },
    { titulo: "Sigilo", textos: [
      `Tudo o que for falado nas sessões é protegido pelo sigilo profissional, conforme o ${ehPsi ? "Código de Ética Profissional do Psicólogo" : "código de ética da profissão"}. O sigilo só pode ser quebrado nas situações previstas nesse código e na lei, e apenas no que for estritamente necessário.`,
      "Os registros do atendimento e os dados pessoais do(a) paciente são guardados com segurança e usados só para o atendimento."] },
    { titulo: "Interrupção", textos: [
      "Qualquer uma das partes pode encerrar o acompanhamento a qualquer momento. O ideal é combinar uma sessão de encerramento, para fechar o processo com cuidado. Sessões já realizadas e não pagas continuam devidas."] },
    { titulo: "Contato fora da sessão", textos: [
      "Mensagens (WhatsApp, e-mail ou telefone) servem para combinar horários e pagamentos. Os assuntos da terapia ficam para as sessões.",
      "Em uma emergência, procure o SAMU (192), o CVV (188) ou o pronto-socorro mais próximo."] },
  ];
  const extras = String(c.extras || "").split(/\n+/).map(t => t.trim()).filter(Boolean);
  if (extras.length) cl.push({ titulo: "Outros combinados", textos: extras });
  return cl.map(x => ({ ...x, textos: x.textos.filter(Boolean) }));
}

export async function pdfContrato(c) {
  const doc = await novoPDF(), W = 210, H = 297, M = 20, LARG = W - 2 * M, LINHA = 5.6;
  const pa = c.paciente || {}, resp = pa.responsavel && pa.responsavel.nome ? pa.responsavel : null;
  let y = 26;
  const pular = n => { if (y + n > H - 24) { doc.addPage(); y = 24; } };
  const texto = t => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    doc.splitTextToSize(t, LARG).forEach(l => { pular(LINHA); doc.text(l, M, y); y += LINHA; });
    y += 1.6;
  };
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("CONTRATO TERAPÊUTICO", M, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(110);
  doc.text(c.prof && c.prof.profissao ? `Prestação de serviços de ${c.prof.profissao.toLowerCase()}` : "Prestação de serviços profissionais", M, y); doc.setTextColor(0);
  y += 4; doc.setDrawColor(200); doc.setLineWidth(.3); doc.line(M, y, W - M, y); y += 9;

  textoContrato(c).forEach((cl, i) => {
    pular(LINHA * 3 + 7); y += 1.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.text(`${i + 1}. ${cl.titulo}`, M, y); y += 6.2;
    cl.textos.forEach(texto); y += 2.5;
  });

  // fecho e assinaturas sempre juntos na mesma página
  pular(82); y += 2;
  texto("E por estarem de acordo, assinam.");
  y += 4; doc.setFontSize(10.5); doc.text(cidadeData(c.cidade, c.data), W - M, y, { align: "right" }); y += 20;
  const col = { meia: 37, larg: LARG / 2 - 6 };
  blocoAssinatura(doc, { ...col, cx: M + LARG / 4, y, img: c.assinatura, nome: c.prof && c.prof.nome, linhas: linhasProf({ ...c.prof, endereco: "" }) });
  blocoAssinatura(doc, { ...col, cx: W - M - LARG / 4, y, nome: resp ? resp.nome : pa.nome,
    linhas: resp ? [`Responsável legal por ${pa.nome}`, resp.cpf ? `CPF ${fmtCPF(resp.cpf)}` : ""] : ["Paciente", pa.cpf ? `CPF ${fmtCPF(pa.cpf)}` : ""] });

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(130);
    doc.text(`Contrato terapêutico · ${pa.nome || ""}`, M, H - 12); doc.text(`Página ${i} de ${paginas}`, W - M, H - 12, { align: "right" });
    if (c.rodape) doc.text(c.rodape, W / 2, H - 7, { align: "center" });
  }
  doc.setTextColor(0);
  return doc.output("blob");
}

/* ---------- prontuário ----------
   { prof: { nome, profissao, conselho, registro }, paciente: { nome, cpf, telefone, nascimento },
     secoes: [{ titulo, texto }], evolucoes: [{ data, texto }], sessoes, hoje } */
export async function pdfProntuario(p) {
  const doc = await novoPDF(), W = 210, H = 297, M = 20, LARG = W - 2 * M, LINHA = 5.4;
  let y = 24;
  const pular = n => { if (y + n > H - 22) { doc.addPage(); y = 22; } };
  const titulo = t => { pular(16); y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text(t, M, y); y += 2.5; doc.setDrawColor(200); doc.setLineWidth(.3); doc.line(M, y, W - M, y); y += 6; };
  const texto = t => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    doc.splitTextToSize(String(t || ""), LARG).forEach(l => { pular(LINHA); doc.text(l, M, y); y += LINHA; });
    y += 2;
  };
  const campo = (rotulo, valor) => { if (!valor) return; pular(LINHA); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text(`${rotulo}: `, M, y); const x = M + doc.getTextWidth(`${rotulo}: `); doc.setFont("helvetica", "normal"); doc.text(String(valor), x, y); y += LINHA; };

  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("PRONTUÁRIO", M, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110); doc.text(`Emitido em ${dataLonga(p.hoje)}. Documento sigiloso.`, M, y); doc.setTextColor(0); y += 5;

  titulo("Identificação");
  campo("Nome", p.paciente.nome);
  campo("Nascimento", p.paciente.nascimento ? dataLonga(p.paciente.nascimento) : "");
  campo("CPF", p.paciente.cpf ? fmtCPF(p.paciente.cpf) : "");
  campo("Contato", p.paciente.telefone);
  campo("Início do atendimento", p.inicio ? dataLonga(p.inicio) : "");
  campo("Sessões realizadas", p.sessoes);

  titulo("Profissional");
  campo("Nome", p.prof.nome);
  campo("Profissão", p.prof.profissao);
  campo(p.prof.conselho || "Registro", p.prof.registro);

  p.secoes.filter(s => s.texto).forEach(s => { titulo(s.titulo); texto(s.texto); });

  titulo("Evolução");
  if (!p.evolucoes.length) texto("Nenhum registro.");
  p.evolucoes.forEach(e => {
    pular(LINHA * 2); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text(dataLonga(e.data), M, y); y += LINHA;
    texto(e.texto); y += 1;
  });

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(130);
    doc.text(p.paciente.nome || "", M, H - 12); doc.text(`Página ${i} de ${paginas}`, W - M, H - 12, { align: "right" });
  }
  doc.setTextColor(0);
  return doc.output("blob");
}
