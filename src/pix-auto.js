// Pix que se marca sozinho: os Pix recebidos que chegam pelo Open Finance (servidor-avisos/src/banco.js, rota
// /banco/lancamentos) são comparados com as cobranças em aberto. Só marca como pago sozinho quando o nome de quem
// pagou E o valor batem com um paciente só; quando só um dos dois bate, o app pergunta. Sem dependências: testável.

const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// pedaços que os bancos colocam na descrição do Pix e que não são o nome de quem pagou
const RUIDO = /\b(pix|recebid[oa]s?|recebimento|transf(erencia)?|ted|doc|credito|cred|de|da|do|dos|das|enviad[oa]|em conta|conta|corrente|pagamento|pagto|receb|qr ?code|chave|cpf|cnpj|banco|bco|ltda|me|sa|s\/a|instituicao|pagamentos?|nu ?pagamentos|nubank|inter|itau|unibanco|bradesco|santander|caixa|economica|federal|brasil|c6|picpay|mercado ?pago|sicoob|sicredi|original|next|neon|pagbank|pagseguro)\b/g;

// "PIX RECEBIDO - MARIA S SOUZA 123.456.789-00" -> "maria s souza"
export function pagadorDoExtrato(desc, bruto) {
  const t = semAcento(`${bruto || ""} ${desc || ""}`)
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\*+[\d.*-]*\*+|\d+/g, " ")
    .replace(/[^a-z ]/g, " ").replace(RUIDO, " ").replace(/\s+/g, " ").trim();
  // a descrição costuma repetir o nome (bruto + desc): fica a primeira vez de cada palavra
  const vistas = new Set();
  return t.split(" ").filter(w => w.length >= 2 && !vistas.has(w) && vistas.add(w)).slice(0, 6).join(" ");
}

// Entrada que parece Pix (ou transferência) recebido
export const ehPixRecebido = t => t && t.tipo === "entrada" && !t.cartao && /pix|transf|ted\b|doc\b/i.test(`${t.bruto || ""} ${t.desc || ""}`);

// itens: os lançamentos do banco; casar(pre) = cobrancasDoPix(db, pre) do App (grupos com nota: 2 = valor, 3 = nome)
// Devolve { automaticos: [{ tid, pid, ids, pre }], duvidas: [{ tid, pre }] }
export function separarPix(itens, casar, { vistos = new Set(), desde = "" } = {}) {
  const automaticos = [], duvidas = [], usadas = new Set();
  for (const t of itens || []) {
    if (!ehPixRecebido(t) || vistos.has(t.id) || (desde && t.data < desde)) continue;
    const pre = { valor: t.valor, data: t.data, pagador: pagadorDoExtrato(t.desc, t.bruto), tid: t.id };
    const grupos = casar(pre).filter(g => !g.ids.some(id => usadas.has(id)));
    const certos = grupos.filter(g => g.nota >= 5 && g.ids.length);
    if (certos.length === 1) { certos[0].ids.forEach(id => usadas.add(id)); automaticos.push({ tid: t.id, pid: certos[0].pid, ids: certos[0].ids, pre }); }
    else if (grupos.length) duvidas.push({ tid: t.id, pre });
  }
  return { automaticos, duvidas };
}
