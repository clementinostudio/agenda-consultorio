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

export async function lerExtrato(file) {
  const texto = await lerTextoArquivo(file);
  const ofx = /<OFX>|OFXHEADER/i.test(texto);
  const itens = ofx ? lerOFX(texto) : lerCSV(texto);
  return itens.map(x => ({ ...x, tipo: x.valor < 0 ? "saida" : "entrada", valor: Math.round(Math.abs(x.valor) * 100) / 100, bruto: `${x.hist || ""} ${x.desc}`.trim(), desc: limparDescricao(x.desc) || limparDescricao(x.hist) }));
}
