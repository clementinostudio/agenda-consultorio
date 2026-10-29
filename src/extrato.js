/* =========================================================
   Extrato do banco: lê o arquivo que o app do banco exporta (OFX ou CSV)
   e devolve a lista de lançamentos { data, valor, tipo, desc, fid }.
   Funciona com Nubank (conta e cartão), Inter, Itaú, Bradesco, BB, Caixa, C6, Santander...
   Tudo é lido no próprio aparelho: o arquivo não vai para lugar nenhum.
   ========================================================= */
const semAcento = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pad = n => String(n).padStart(2, "0");

// Bancos brasileiros às vezes exportam em Windows-1252 (acentos viram "Ã§")
export async function lerTextoArquivo(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder("windows-1252").decode(buf); }
}

// "1.234,56", "-1234.56", "R$ -12,50", "(12,50)" -> número
export function lerValor(s) {
  let t = String(s || "").replace(/R\$|\s| /g, "");
  let neg = /^-|-$|^\(.*\)$/.test(t) || /^−/.test(t);
  t = t.replace(/[()−+-]/g, "");
  if (!t) return NaN;
  const v = t.lastIndexOf(","), p = t.lastIndexOf(".");
  if (v > p) t = t.replace(/\./g, "").replace(",", ".");
  else if (p > v && v >= 0) t = t.replace(/,/g, "");
  else if (p >= 0 && v < 0 && /\.\d{3}$/.test(t) && (t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  const n = Number(t);
  return neg ? -n : n;
}

// "25/10/2026", "2026-10-25", "25/10/26", "20261025120000[-3:BRT]" -> "2026-10-25"
export function lerData(s) {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/) || t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  return null;
}

function lerOFX(texto) {
  const pega = (bloco, tag) => { const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i")); return m ? m[1].trim() : ""; };
  const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto);
  return texto.split(/<STMTTRN>/i).slice(1).map(b => {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const valor = lerValor(pega(bloco, "TRNAMT"));
    const memo = pega(bloco, "MEMO"), nome = pega(bloco, "NAME");
    const desc = memo && nome && !semAcento(memo).includes(semAcento(nome)) ? `${nome} - ${memo}` : memo || nome;
    return { data: lerData(pega(bloco, "DTPOSTED")), valor, desc, fid: pega(bloco, "FITID"), cartao };
  }).filter(x => x.data && Number.isFinite(x.valor) && x.valor !== 0);
}

// CSV com vírgula, ponto e vírgula ou tab, com aspas
function partirCSV(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];
  const cab = linhas.slice(0, 5).join("\n");
  const sep = [";", "\t", ","].map(s => [s, cab.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  return linhas.map(l => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim());
  });
}

function lerCSV(texto) {
  const linhas = partirCSV(texto);
  // a linha do cabeçalho é a primeira que tem algo parecido com "data" e "valor"
  const ehCab = l => l.some(c => /^(data|date|dt)\b/.test(semAcento(c))) && l.some(c => /(valor|amount|value|quantia|credito|debito|entrada|saida)/.test(semAcento(c)));
  const iCab = linhas.findIndex(ehCab);
  if (iCab < 0) return [];
  const cab = linhas[iCab].map(semAcento);
  const col = re => cab.findIndex(c => re.test(c));
  const cData = col(/^(data|date|dt)/);
  const cValor = col(/^(valor|amount|value|quantia|montante)/);
  const cCred = col(/(credito|entrada)/), cDeb = col(/(debito|saida)/);
  // a descrição de verdade ("Açougue São José") vem antes do histórico ("Pix enviado"), que fica de apoio
  const cDesc = [/^descri/, /^title$/, /^estabelecimento/, /^(memo|detalhe)/, /^historico/, /lancamento/, /descri|historico/].map(col).find(i => i >= 0 && i !== cData && i !== cValor);
  const cHist = col(/^historico/);
  const cId = col(/^(identificador|id|fitid|codigo)$/);
  // fatura de cartão (ex.: Nubank "date,title,amount"): valor positivo é compra
  const cartao = cab.includes("title") && cab.includes("amount");
  return linhas.slice(iCab + 1).map(l => {
    let valor = cValor >= 0 ? lerValor(l[cValor]) : (lerValor(l[cCred]) || 0) - Math.abs(lerValor(l[cDeb]) || 0);
    if (cartao) valor = -valor;
    const desc = (cDesc >= 0 ? l[cDesc] : "") || (cHist >= 0 ? l[cHist] : "");
    const hist = cHist >= 0 && cHist !== cDesc ? l[cHist] || "" : "";
    return { data: lerData(l[cData]), valor, desc, hist, fid: cId >= 0 ? l[cId] : "", cartao };
  }).filter(x => x.data && Number.isFinite(x.valor) && x.valor !== 0);
}

// Tira o "juridiquês" do banco: "Compra no débito - PADARIA X" -> "Padaria X"
const PREFIXOS = /^(compra (no|com) (debito|credito|cartao)( via nupay)?|compra cartao( deb| cred)?|pagamento (de boleto )?efetuado|pagamento de boleto|transferencia (enviada|recebida)( pelo pix)?|pix (enviado|recebido|transf\w*)|transf(erencia)? pix|deb(ito)? aut(omatico)?|debito automatico|pagto|pag\*|compra|pix)\s*[-:–]?\s*/i;
export function limparDescricao(s) {
  let t = String(s || "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) { const sa = semAcento(t), m = sa.match(PREFIXOS); if (m && m[0].length < t.length) t = t.slice(m[0].length); }
  t = t.split(/\s+-\s+/)[0]; // "FULANO - •••.123.456-•• - BANCO" -> "FULANO"
  t = t.replace(/\b\d{2}\/\d{2}\b.*$/, "").replace(/[•*]{2,}.*$/, "").trim();
  if (t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
  return t.slice(0, 60);
}

// Movimentação entre as próprias contas: vem desmarcada (não é gasto de verdade)
export const ehInterno = s => /(pagamento (de )?fatura|pagamento recebido|fatura (do )?cartao|aplicacao|resgate|\brdb\b|\bcdb\b|investimento|poupanca|mesma titularidade|entre contas|saldo (anterior|do dia)|estorno de pagamento)/.test(semAcento(s));

/* ---------- fatura do cartão em PDF ----------
   As linhas do PDF (src/pdf.js) → compras. Cada compra é "data  descrição  valor":
     "17/10 UBER *TRIP 23,90" (Itaú, Bradesco, BB, Santander, C6), "17 OUT •••• 1234 Uber *Trip R$ 23,90" (Nubank).
   Numa página de duas colunas, a mesma linha tem duas compras: depois de cada valor pode começar outra data.
   Compra em dólar ("US$ 10,00  52,30"): vale o último valor, o em reais. */
const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const DATA_F = String.raw`(\d{2})[/.](\d{2})(?:[/.](\d{2,4}))?|(\d{2})\s?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b`;
const VALOR_F = String.raw`(-\s?)?(?:r\$\s?)?(-\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})(\s?-)?`;
const COMPRA = new RegExp(String.raw`(?:^|\s)(?:${DATA_F})\s+(.+?)\s+${VALOR_F}(?=\s+(?:${DATA_F})\s|\s*$)`, "gi");
// linhas do resumo da fatura, que têm data e valor mas não são compra
const RESUMO = /\b(total|subtotal|vencimento|venc\b|pagamento minimo|valor minimo|minimo|limite|saldo|fatura anterior|valor da fatura|fechamento|melhor dia|cet\b|taxa de juros|juros do rotativo|credito rotativo|encargos|proxima fatura|proximas faturas|demais faturas|lancamentos futuros)\b/;

export function lerFatura(linhas, hoje = new Date().toISOString().slice(0, 10)) {
  const ano = Number(hoje.slice(0, 4)), lim = new Date(Date.parse(hoje) + 7 * 864e5).toISOString().slice(0, 10);
  const achados = [];
  (linhas || []).forEach(l0 => {
    const l = String(l0 || "").replace(/[•*]{2,}\s*\d{4}/g, " ").replace(/−/g, "-").replace(/\s+/g, " ").trim();
    if (!l) return;
    COMPRA.lastIndex = 0;
    for (let m; (m = COMPRA.exec(l));) {
      const dia = Number(m[1] || m[4]), mes = m[2] ? Number(m[2]) : MESES[semAcento(m[5]).slice(0, 3)];
      if (!(dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)) continue;
      let y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ano;
      let data = `${y}-${pad(mes)}-${pad(dia)}`;
      if (!m[3] && data > lim) data = `${y - 1}-${pad(mes)}-${pad(dia)}`; // fatura de dezembro lida em janeiro
      const desc = m[6].replace(/\s*(us\$|u\$|usd|eur|€)\s*[\d.,]+\s*$/i, "").trim();
      const v = lerValor(m[9]);
      if (!(v > 0) || !desc || RESUMO.test(semAcento(desc))) continue;
      const credito = !!(m[7] || m[8] || m[10]) || /\b(estorno|credito|pagamento|reembolso|cashback|devolucao)\b/.test(semAcento(desc));
      achados.push({ data, desc, valor: credito ? v : -v });
    }
  });
  if (achados.length < 2) return [];
  // parcela 3/10 de uma compra antiga: entra na data da fatura (a compra de verdade foi lá atrás)
  const ultima = achados.filter(x => x.valor < 0).reduce((a, x) => (x.data > a ? x.data : a), "");
  const vezes = {};
  return achados.map(x => {
    const p = x.desc.match(/(?:parc(?:ela)?\.?\s*)?\b(\d{1,2})\s?\/\s?(\d{1,2})\b/i);
    const k0 = p ? Number(p[1]) : 0, n = p ? Number(p[2]) : 0, parcela = p && k0 >= 1 && k0 <= n && n > 1;
    const data = parcela && k0 > 1 && ultima ? ultima : x.data;
    // "MAGAZINE LUIZA PARC 03/10" → "MAGAZINE LUIZA (3 de 10)"
    const desc = parcela ? `${limparDescricao(x.desc.replace(p[0], "").replace(/\s{2,}/g, " ").trim())} (${k0} de ${n})` : x.desc;
    const k = `${data}|${x.valor}|${semAcento(desc)}`; vezes[k] = (vezes[k] || 0) + 1;
    return { data, valor: x.valor, desc, fid: `pdf:${k}|${vezes[k]}`, cartao: true };
  });
}

// O mesmo formato do extrato (tipo, valor positivo, descrição limpa)
const arrumar = itens => itens.map(x => ({ ...x, tipo: x.valor < 0 ? "saida" : "entrada", valor: Math.round(Math.abs(x.valor) * 100) / 100, bruto: `${x.hist || ""} ${x.desc}`.trim(), desc: limparDescricao(x.desc) || limparDescricao(x.hist) || x.desc }));
export const faturaParaImportar = (linhas, hoje) => arrumar(lerFatura(linhas, hoje));

export async function lerExtrato(file) {
  const texto = await lerTextoArquivo(file);
  const ofx = /<OFX>|OFXHEADER/i.test(texto);
  const itens = ofx ? lerOFX(texto) : lerCSV(texto);
  return itens.map(x => ({ ...x, tipo: x.valor < 0 ? "saida" : "entrada", valor: Math.round(Math.abs(x.valor) * 100) / 100, bruto: `${x.hist || ""} ${x.desc}`.trim(), desc: limparDescricao(x.desc) || limparDescricao(x.hist) }));
}
