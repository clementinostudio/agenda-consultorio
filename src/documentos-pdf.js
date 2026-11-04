// Documentos em PDF: recibo e prontuário. Não depende do resto do app: o gerador de recibo grátis do site
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

/* ---------- recibo ---------- */
export async function pdfRecibo(r) {
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
  if (r.rodape) { doc.setFontSize(8.5); doc.setTextColor(130); doc.text(r.rodape, W / 2, 200, { align: "center" }); doc.setTextColor(0); }
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
