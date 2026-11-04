// Ferramentas grátis do site (avina.com.br/ferramentas/): recibo, QR Code de Pix e valor da sessão.
// Tudo roda no navegador da pessoa: nada do que ela digita vai para servidor nenhum.
import "./ferramentas.css";
import { porExtenso, fmtCPF, cpfValido, pdfRecibo } from "./documentos-pdf.js";
import { pixCopiaECola } from "./loja-contas.js";
import { qrSvg } from "./qr.js";
import { valorDaSessao, lerNumero as numero } from "./ferramentas-contas.js";

const real = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const campos = f => Object.fromEntries(new FormData(f).entries());
const erroEm = (f, txt) => { const e = f.querySelector("[data-erro]"); e.textContent = txt; e.hidden = !txt; };

/* ---------- recibo ---------- */
const fRecibo = document.querySelector("[data-recibo]");
if (fRecibo) {
  fRecibo.elements.data.value = hoje();
  ["cpf", "cpfPaciente"].forEach(n => fRecibo.elements[n].addEventListener("input", e => { e.target.value = fmtCPF(e.target.value); }));
  fRecibo.addEventListener("submit", async e => {
    e.preventDefault();
    const d = campos(fRecibo), valor = numero(d.valor);
    if (!d.nome.trim()) return erroEm(fRecibo, "Falta o seu nome.");
    if (d.cpf && !cpfValido(d.cpf)) return erroEm(fRecibo, "O seu CPF parece ter um número trocado.");
    if (!d.paciente.trim()) return erroEm(fRecibo, "Falta o nome de quem pagou.");
    if (d.cpfPaciente && !cpfValido(d.cpfPaciente)) return erroEm(fRecibo, "O CPF de quem pagou parece ter um número trocado.");
    if (!(valor > 0)) return erroEm(fRecibo, "Falta o valor.");
    erroEm(fRecibo, "");
    const texto = `Recebi de ${d.paciente.trim()}${d.cpfPaciente ? `, CPF ${d.cpfPaciente},` : ""} a quantia de ${real(valor)} (${porExtenso(valor)}), referente a ${d.servico.trim() || "atendimento"}${d.periodo.trim() ? ` ${d.periodo.trim()}` : ""}.`;
    const [, conselho = "Registro", registro = d.registro.trim()] = d.registro.trim().match(/^([A-Za-zÀ-ú]+)\s+(.+)$/) || [];
    const blob = await pdfRecibo({
      valor, texto, data: d.data || hoje(), cidade: d.cidade.trim(), rodape: "Feito de graça em avina.com.br/ferramentas",
      prof: { nome: d.nome.trim(), profissao: d.profissao.trim(), conselho, registro, cpf: d.cpf },
    });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Recibo ${d.paciente.trim().split(" ")[0]}.pdf`;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    document.querySelector("[data-depois]").hidden = false;
  });
}

/* ---------- QR Code de Pix ---------- */
const fPix = document.querySelector("[data-pix]");
if (fPix) {
  const saida = document.querySelector("[data-pix-saida]"), caixaQr = saida.querySelector("[data-qr]"), codigo = saida.querySelector("[data-codigo]");
  fPix.addEventListener("submit", async e => {
    e.preventDefault();
    const d = campos(fPix), valor = numero(d.valor);
    if (!d.chave.trim()) return erroEm(fPix, "Falta a sua chave Pix.");
    if (!d.nome.trim()) return erroEm(fPix, "Falta o nome de quem recebe.");
    erroEm(fPix, "");
    const texto = pixCopiaECola({ chave: d.chave, nome: d.nome, cidade: d.cidade, valor });
    const svg = await qrSvg(texto).catch(() => null);
    if (!svg) return erroEm(fPix, "Não consegui desenhar o QR Code. Tente de novo.");
    caixaQr.innerHTML = svg; codigo.value = texto; saida.hidden = false;
    saida.querySelector("[data-resumo]").textContent = valor > 0 ? `${real(valor)} para ${d.nome.trim()}` : `Para ${d.nome.trim()}, quem paga digita o valor`;
    document.querySelector("[data-depois]").hidden = false;
    saida.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  saida.querySelector("[data-copiar]").addEventListener("click", async e => {
    try { await navigator.clipboard.writeText(codigo.value); e.target.textContent = "Copiado"; } catch (x) { codigo.select(); e.target.textContent = "Selecionei: copie agora"; }
    setTimeout(() => { e.target.textContent = "Copiar o Pix copia e cola"; }, 2200);
  });
}

/* ---------- valor da sessão ---------- */
const fValor = document.querySelector("[data-valor]");
if (fValor) {
  const saida = document.querySelector("[data-valor-saida]");
  const contar = () => {
    const d = campos(fValor);
    const r = valorDaSessao({ renda: numero(d.renda), custos: numero(d.custos), sessoesSemana: numero(d.sessoes), semanasFolga: numero(d.folga), faltas: numero(d.faltas), imposto: numero(d.imposto) });
    saida.hidden = !r;
    if (!r) return;
    saida.querySelector("[data-preco]").textContent = real(r.valor);
    saida.querySelector("[data-detalhe]").textContent = `São cerca de ${Math.round(r.sessoesMes)} sessões pagas por mês e ${real(r.bruto)} de faturamento, já contando as faltas, a folga, os custos e o imposto.`;
    document.querySelector("[data-depois]").hidden = false;
  };
  fValor.addEventListener("input", contar);
  fValor.addEventListener("submit", e => { e.preventDefault(); contar(); });
  contar();
}
