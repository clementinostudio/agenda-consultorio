// Nota do mercado: ler a NFC-e (pelo QR code ou pela foto), combinar com a lista de compras
// e guardar os preços para comparar depois. Sem dependências do resto do app (dá para testar).

const sem = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const numBR = s => { const t = String(s || "").replace(/[^\d,.-]/g, ""); if (!t) return 0; return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0; };
const dataBR = s => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

// A chave de acesso (44 números) diz tudo da nota: estado (2 primeiros), mês, CNPJ da loja, modelo (65 = NFC-e)
// e termina num dígito verificador. Conferir esse dígito separa uma leitura boa de uma leitura estragada do QR.
export const chaveValida = k => {
  if (!/^\d{44}$/.test(k)) return false;
  let p = 2, t = 0;
  for (let i = 42; i >= 0; i--) { t += Number(k[i]) * p; p = p === 9 ? 2 : p + 1; }
  const r = t % 11;
  return (r < 2 ? 0 : 11 - r) === Number(k[43]);
};
// A chave dentro do texto do QR (?p=CHAVE|2|1|..., ?chNFe=CHAVE...) ou digitada (com espaços)
export function chaveDe(texto) {
  const s = String(texto || "");
  const m = s.match(/[?&](?:p|chNFe|chave)=(\d{44})/i) || s.replace(/[\s.-]/g, "").match(/^(\d{44})$/);
  return m ? m[1] : "";
}

// Endereço do QR code de cada estado (código da UF → página de consulta), para montar o link a partir da chave digitada
const UF = { 11: ["RO", "http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp"], 12: ["AC", "http://www.sefaznet.ac.gov.br/nfce/qrcode"], 13: ["AM", "http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp"], 14: ["RR", "https://www.sefaz.rr.gov.br/nfce/servlet/qrcode"], 15: ["PA", "https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam"], 16: ["AP", "https://www.sefaz.ap.gov.br/nfce/nfcep.php"], 17: ["TO", "http://www.sefaz.to.gov.br/nfce/qrcode"], 21: ["MA", "http://www.nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp"], 22: ["PI", "http://www.sefaz.pi.gov.br/nfce/qrcode"], 23: ["CE", "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html"], 24: ["RN", "https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx"], 25: ["PB", "http://www.sefaz.pb.gov.br/nfce"], 26: ["PE", "http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe"], 27: ["AL", "http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp"], 28: ["SE", "http://www.nfce.se.gov.br/portal/consultarNFCe.jsp"], 29: ["BA", "http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx"], 31: ["MG", "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml"], 32: ["ES", "http://app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx"], 33: ["RJ", "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode"], 35: ["SP", "https://www.nfce.fazenda.sp.gov.br/qrcode"], 41: ["PR", "http://www.fazenda.pr.gov.br/nfce/qrcode"], 42: ["SC", "https://sat.sef.sc.gov.br/nfce/consulta"], 43: ["RS", "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx"], 50: ["MS", "http://www.dfe.ms.gov.br/nfce/qrcode"], 51: ["MT", "http://www.sefaz.mt.gov.br/nfce/consultanfce"], 52: ["GO", "https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe"], 53: ["DF", "http://www.fazenda.df.gov.br/nfce/qrcode"] };
export const ufDaChave = k => (UF[String(k).slice(0, 2)] || [""])[0];
// CNPJ da loja que emitiu a nota (posições 7 a 20 da chave): serve mesmo quando a Sefaz não deixa ler os itens
export const cnpjDaChave = k => (/^\d{44}$/.test(String(k || "")) ? String(k).slice(6, 20) : "");
// Link de consulta montado com a chave (formato do QR code versão 3: só a chave, sem o código da loja)
export const linkPelaChave = k => { const u = UF[k.slice(0, 2)]; return u && k.slice(34, 35) === "1" ? `${u[1]}?p=${k}|3|1` : ""; };

// O que veio do QR code ou do campo de texto: { url, chave } quando é uma nota; { erro } quando não dá
//   erro "nao-nota": é outro QR (Pix, site, cardápio…); "chave": parece nota, mas a chave veio estragada
export function lerTextoNota(t) {
  let s = String(t || "").trim();
  const so = s.replace(/[\s.-]/g, "");
  if (/^\d{44}$/.test(so)) {
    if (!chaveValida(so)) return { erro: "chave" };
    const url = linkPelaChave(so);
    return url ? { url, chave: so } : { erro: "chave" };
  }
  // alguns QR codes vêm sem o "http://"
  if (/^(www\.|[a-z0-9-]+\.)[^\s/]*\.gov\.br\//i.test(s)) s = "http://" + s;
  let u; try { u = new URL(s); } catch (e) { return { erro: "nao-nota" }; }
  if (!/^https?:$/.test(u.protocol) || !/\.gov\.br$/i.test(u.hostname)) return { erro: "nao-nota" };
  const chave = chaveDe(s);
  if (chave) return chaveValida(chave) ? { url: u.toString(), chave } : { erro: "chave" };
  // um link da Sefaz sem a chave inteira: QR cortado ou lido pela metade
  return /(fazenda|sefaz|sefin|sefa|nfce|nfe|sped|dfe|sef|receita|set)\./i.test(u.hostname) ? { erro: "chave" } : { erro: "nao-nota" };
}
// É um link de NFC-e bom para buscar? (o QR code da nota aponta para a página de consulta da Sefaz)
export const ehLinkNfce = t => !!lerTextoNota(t).url;

// Lê a página de consulta da NFC-e. Três jeitos, do mais preciso ao mais genérico:
//  1. o layout do Portal da NFC-e (a maioria dos estados: PR, RS e os da SVRS, SP, AM…)
//  2. linhas com "(Código: …)" e os valores escritos por extenso (Minas Gerais e parecidos)
//  3. uma tabela com cabeçalho "Descrição … Qtde … Valor" (DANFE em tabela)
export function lerPaginaNfce(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const r2 = v => Math.round(v * 100) / 100;
  let itens = [];
  // 1. cada produto: nome (.txtTit), quantidade (.Rqtd), unidade (.RUN), preço unitário (.RvlUnit) e total (.valor)
  doc.querySelectorAll("#tabResult tr, table.toggle tr, tr[id^='Item']").forEach(tr => {
    const nome = txt(tr.querySelector(".txtTit"));
    const valor = numBR(txt(tr.querySelector(".valor")));
    if (!nome || !(valor > 0) || /^vl\.? total/i.test(nome)) return;
    const qtd = numBR(txt(tr.querySelector(".Rqtd")).replace(/qtde\.?:?/i, "")) || 1;
    const un = txt(tr.querySelector(".RUN")).replace(/^un:?\s*/i, "").trim();
    const unit = numBR(txt(tr.querySelector(".RvlUnit")).replace(/vl\.?\s*unit\.?:?/i, "")) || (qtd ? valor / qtd : valor);
    if (!itens.some(x => x._tr === tr)) itens.push({ nome, qtd, un, unit: r2(unit), valor, _tr: tr });
  });
  // 2. linhas de produto escritas por extenso: "ARROZ 5KG (Código: 123) Qtde total de ítens: 1.0000 UN: UN Valor total R$: R$ 25,90"
  if (!itens.length) {
    const linhas = [...doc.querySelectorAll("tr")].filter(tr => !tr.querySelector("tr"));
    linhas.forEach(tr => {
      const t = txt(tr), m = t.match(/^(.{2,120}?)\s*\(\s*C[óo]d(?:igo)?\.?:?\s*[^)]*\)\s*(.*)$/i);
      if (!m) return;
      const resto = m[2];
      const valor = numBR((resto.match(/(?:vl\.?|valor)\s*total[^\d]*([\d.]*\d,\d{2}|\d+\.\d{2})/i) || [])[1]);
      if (!(valor > 0)) return;
      const qtd = numBR((resto.match(/qtde?\.?[^:\d]*:?\s*([\d.,]+)/i) || [])[1]) || 1;
      // as células vêm grudadas ("1.0000UN: UNValor total"): a unidade é a sigla em maiúsculas logo depois de "UN:"
      const un = ((resto.match(/UN\.?:\s*([A-Z]{1,4})(?![a-z])/) || [])[1] || "").trim();
      const unit = numBR((resto.match(/(?:vl\.?|valor)\s*unit[^\d]*([\d.]*\d,\d{2,4}|\d+\.\d{2,4})/i) || [])[1]) || valor / qtd;
      itens.push({ nome: m[1].trim(), qtd, un, unit: r2(unit), valor });
    });
  }
  // 3. tabela com cabeçalho: acha as colunas de descrição, quantidade, unidade, valor unitário e total
  if (!itens.length) {
    doc.querySelectorAll("table").forEach(tab => {
      if (itens.length || tab.querySelector("table")) return;
      const rows = [...tab.querySelectorAll("tr")];
      const hi = rows.findIndex(r => { const t = sem(txt(r)); return /descri/.test(t) && /(total|valor|vl)/.test(t); });
      if (hi < 0) return;
      const cab = [...rows[hi].children].map(c => sem(txt(c)));
      const col = re => cab.findIndex(c => re.test(c));
      const cD = col(/descri/), cQ = col(/^(qtde?|quant)/), cU = col(/^(un|unid)/), cVU = col(/unit/), cT = cab.reduce((a, c, i) => (/total/.test(c) ? i : a), -1);
      if (cD < 0 || cT < 0) return;
      rows.slice(hi + 1).forEach(r => {
        const cel = [...r.children].map(txt);
        const nome = cel[cD], valor = numBR(cel[cT]);
        if (!nome || !(valor > 0) || /^(total|valor|vl)/i.test(nome)) return;
        const qtd = cQ >= 0 ? numBR(cel[cQ]) || 1 : 1;
        itens.push({ nome, qtd, un: cU >= 0 ? cel[cU] || "" : "", unit: r2(cVU >= 0 ? numBR(cel[cVU]) || valor / qtd : valor / qtd), valor });
      });
    });
  }
  itens.forEach(x => delete x._tr);
  const corpo = txt(doc.body);
  // total: "Valor a pagar R$: 123,45" (ou o maior .totalNumb)
  let total = 0;
  doc.querySelectorAll("#totalNota #linhaTotal, #linhaTotal, .linhaShade").forEach(l => { if (/valor a pagar/i.test(txt(l))) total = numBR(txt(l.querySelector(".totalNumb")) || txt(l)); });
  if (!total) { const m = corpo.match(/valor a pagar r\$:?\s*([\d.,]+)/i); if (m) total = numBR(m[1]); }
  if (!total) total = Math.round(itens.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const loja = txt(doc.querySelector("#u20, .txtTopo")) || ((corpo.match(/([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .&'/-]{3,60}?)\s+CNPJ/) || [])[1] || "").trim();
  const cnpj = (corpo.match(/CNPJ:?\s*([\d./-]{14,18})/i) || [])[1] || "";
  const data = dataBR((corpo.match(/emiss[aã]o:?\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1]) || dataBR(corpo);
  // quando a Sefaz recusa ("Não foi possível executar a operação: Url do QRCode mal formatado"), guarda o motivo
  let recusa = "", bloqueio = "";
  if (!itens.length) {
    recusa = ((corpo.match(/n[aã]o foi poss[ií]vel[^:]*:\s*([^.<]{4,120})/i) || corpo.match(/\b\d{3}\s+-\s+([^.<]{8,140})/) || [])[1] || "").replace(/[\s>-]+$/, "").trim();
    // nota que ainda não chegou na Sefaz (logo depois da compra, ou emitida sem internet)
    if (/n[aã]o (consta|encontrad|localizad)|ainda n[aã]o (transmitid|autorizad|processad)/i.test(corpo)) bloqueio = "ainda-nao";
    // a página pede "não sou robô" (captcha): nenhum app consegue ler sozinho
    else if (/captcha|n[aã]o sou um rob[oô]|valida[cç][aã]o de seguran[cç]a|digite o c[oó]digo|c[oó]digo da imagem/i.test(corpo + " " + html.slice(0, 20000))) bloqueio = "captcha";
    // a página se monta com JavaScript no navegador (o servidor só recebe a "casca")
    else if (!recusa && (corpo.length < 600 || /carregando|habilite o javascript|javascript habilitado/i.test(corpo))) bloqueio = "js";
  }
  return { loja, cnpj, data, total, itens, recusa, bloqueio };
}

// Nota lida pela IA (foto): arruma os números e tira o que não faz sentido
export function arrumarNotaIA(n) {
  const itens = (Array.isArray(n && n.itens) ? n.itens : []).map(x => {
    const qtd = Number(x.qtd) > 0 ? Number(x.qtd) : 1, valor = Number(x.valor) || numBR(x.valor);
    return { nome: String(x.nome || "").trim().slice(0, 80), qtd, un: "", unit: Math.round((valor / qtd) * 100) / 100, valor };
  }).filter(x => x.nome && x.valor > 0 && x.valor < 100000);
  const soma = Math.round(itens.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const total = Number(n && n.total) > 0 ? Number(n.total) : soma;
  return { loja: String((n && n.loja) || "").trim().slice(0, 60), cnpj: String((n && n.cnpj) || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 14), data: /^\d{4}-\d{2}-\d{2}$/.test(n && n.data) ? n.data : "", total, itens };
}

// Palavras de um produto (sem acento, sem marca de tamanho), para combinar "leite" com "LEITE UHT INTEGRAL 1L"
const PARAR = new Set(["de", "da", "do", "das", "dos", "com", "sem", "e", "un", "kg", "g", "ml", "l", "lt", "pct", "cx", "und", "tp"]);
export const palavras = s => sem(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 2 && !PARAR.has(w) && !/^\d+([.,]\d+)?(g|kg|ml|l|lt|un)?$/.test(w));
const raiz = w => (w.length > 4 ? w.replace(/(oes|aes|ais|eis|res|ns|s)$/, "") : w);
// O item da lista aparece na nota? (todas as palavras da lista começam alguma palavra da nota)
export function combina(itemLista, nomeNota) {
  const a = palavras(itemLista).map(raiz), b = palavras(nomeNota);
  // a nota costuma abreviar ("PAPEL HIG"): vale a palavra da nota ser o começo da palavra da lista, com 3 letras ou mais
  return a.length > 0 && a.every(w => b.some(x => x.startsWith(w) || raiz(x) === w || (x.length >= 3 && w.startsWith(x))));
}
// Chave para o histórico de preços: as 3 primeiras palavras do produto ("leite uht integral")
export const chaveProduto = nome => palavras(nome).slice(0, 3).join(" ");

// Histórico de preços a partir das notas guardadas nos gastos da casa
export function historico(lanc) {
  const h = {};
  lanc.filter(l => l.nota && Array.isArray(l.nota.itens)).forEach(l => l.nota.itens.forEach(x => {
    const k = chaveProduto(x.nome); if (!k) return;
    (h[k] = h[k] || []).push({ nome: x.nome, unit: x.unit, data: l.data, loja: nomeLoja(l.nota.loja) || l.desc || "" });
  }));
  Object.values(h).forEach(v => v.sort((a, b) => a.data.localeCompare(b.data)));
  return h;
}
// Último preço conhecido de um item da lista ("leite" → o leite mais recente das notas)
export function ultimoPreco(hist, itemLista) {
  let melhor = null;
  for (const v of Object.values(hist)) {
    const u = v[v.length - 1];
    if (combina(itemLista, u.nome) && (!melhor || u.data > melhor.data)) melhor = u;
  }
  return melhor;
}

// Corredor do mercado, para a lista sair na ordem em que se anda
export const SECOES = [
  ["hortifruti", "Hortifruti", /\b(banana|maca|laranja|limao|tomate|alface|cebola|alho|batata|cenoura|abobrinha|pepino|fruta|verdura|legume|mamao|uva|morango|abacate|manga|melancia|couve|brocolis|pimentao|cheiro verde|salsa|cebolinha|ovo|ovos)\b/],
  ["padaria", "Padaria", /\b(pao|paes|bisnaguinha|bolo|torrada|croissant|rosca)\b/],
  ["frios", "Frios e laticínios", /\b(leite|queijo|presunto|iogurte|manteiga|margarina|requeijao|mussarela|muçarela|creme de leite|nata|peito de peru|salame|mortadela)\b/],
  ["carnes", "Carnes", /\b(carne|frango|peixe|linguica|bife|patinho|alcatra|costela|picanha|file|coxa|sobrecoxa|peito|salsicha|hamburguer|tilapia|carne moida)\b/],
  ["mercearia", "Mercearia", /\b(arroz|feijao|macarrao|oleo|azeite|acucar|sal|cafe|farinha|molho|extrato|milho|ervilha|atum|sardinha|biscoito|bolacha|cereal|aveia|achocolatado|tempero|vinagre|maionese|ketchup|mostarda|granola|chocolate|leite condensado|fuba|tapioca)\b/],
  ["bebidas", "Bebidas", /\b(agua|refrigerante|suco|cerveja|vinho|cha|energetico|refri|coca)\b/],
  ["limpeza", "Limpeza", /\b(detergente|sabao|amaciante|desinfetante|agua sanitaria|esponja|saco de lixo|lixo|alvejante|multiuso|limpador|papel toalha|vassoura|pano)\b/],
  ["higiene", "Higiene", /\b(papel higienico|sabonete|shampoo|xampu|condicionador|pasta de dente|creme dental|escova|desodorante|absorvente|fralda|algodao|cotonete|fio dental)\b/],
  ["pet", "Pet", /\b(racao|areia|petisco)\b/],
];
export const secaoDe = texto => { const t = sem(texto); const s = SECOES.find(([, , re]) => re.test(t)); return s ? s[0] : "outros"; };
export const nomeSecao = id => (SECOES.find(s => s[0] === id) || [, "Outros"])[1];

// "2 leite", "leite x2", "3x pão" → { texto, qtd }
export function lerItem(t) {
  const s = String(t || "").trim();
  let m = s.match(/^(\d+)\s*x?\s+(.+)$/i); if (m) return { texto: m[2].trim(), qtd: Number(m[1]) };
  m = s.match(/^(.+?)\s*x\s*(\d+)$/i); if (m) return { texto: m[1].trim(), qtd: Number(m[2]) };
  return { texto: s, qtd: 1 };
}

// Foto da nota menor (para guardar junto e mandar para a IA)
// (cupom comprido ganha mais altura, senão as letras ficam pequenas demais para a IA)
export async function reduzirFoto(file, max = 1400, q = 0.7) {
  const url = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(file); });
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  const lado = Math.max(img.naturalWidth, img.naturalHeight), comprido = lado / Math.min(img.naturalWidth, img.naturalHeight) > 2;
  const k = Math.min(1, (comprido ? Math.round(max * 1.5) : max) / lado);
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}

// Nome da loja como as pessoas falam: "SUPERMERCADO CONDOR LTDA" → "Supermercado Condor"
export const nomeLoja = s => String(s || "")
  .replace(/\b(ltda|s\.?\/?a|eireli|epp|me|cia)\b\.?/gi, "").replace(/[-–,.]+\s*$/g, "").replace(/\s{2,}/g, " ").trim()
  .toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, w => w.toLowerCase());
