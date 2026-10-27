// Nota do mercado: ler a NFC-e (pelo QR code ou pela foto), combinar com a lista de compras
// e guardar os preços para comparar depois. Sem dependências do resto do app (dá para testar).

const sem = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const numBR = s => { const t = String(s || "").replace(/[^\d,.-]/g, ""); if (!t) return 0; return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0; };
const dataBR = s => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

// É um link de NFC-e? (o QR code da nota aponta para a página de consulta da Sefaz)
export const ehLinkNfce = t => { try { const u = new URL(String(t).trim()); return /\.gov\.br$/i.test(u.hostname) && /(fazenda|sefaz|nfce|nfe|sped|sef)/i.test(u.hostname); } catch (e) { return false; } };

// Lê a página de consulta da NFC-e (o layout do Portal da NFC-e, usado pela maioria dos estados)
export function lerPaginaNfce(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const itens = [];
  // cada produto: nome (.txtTit), quantidade (.Rqtd), unidade (.RUN), preço unitário (.RvlUnit) e total (.valor)
  doc.querySelectorAll("#tabResult tr, table.toggle tr, tr[id^='Item']").forEach(tr => {
    const nome = txt(tr.querySelector(".txtTit"));
    const valor = numBR(txt(tr.querySelector(".valor")));
    if (!nome || !(valor > 0) || /^vl\.? total/i.test(nome)) return;
    const qtd = numBR(txt(tr.querySelector(".Rqtd")).replace(/qtde\.?:?/i, "")) || 1;
    const un = txt(tr.querySelector(".RUN")).replace(/^un:?\s*/i, "").trim();
    const unit = numBR(txt(tr.querySelector(".RvlUnit")).replace(/vl\.?\s*unit\.?:?/i, "")) || (qtd ? valor / qtd : valor);
    if (!itens.some(x => x._tr === tr)) itens.push({ nome, qtd, un, unit: Math.round(unit * 100) / 100, valor, _tr: tr });
  });
  itens.forEach(x => delete x._tr);
  const corpo = txt(doc.body);
  // total: "Valor a pagar R$: 123,45" (ou o maior .totalNumb)
  let total = 0;
  doc.querySelectorAll("#totalNota #linhaTotal, #linhaTotal, .linhaShade").forEach(l => { if (/valor a pagar/i.test(txt(l))) total = numBR(txt(l.querySelector(".totalNumb")) || txt(l)); });
  if (!total) { const m = corpo.match(/valor a pagar r\$:?\s*([\d.,]+)/i); if (m) total = numBR(m[1]); }
  if (!total) total = Math.round(itens.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const loja = txt(doc.querySelector("#u20, .txtTopo")) || "";
  const cnpj = (corpo.match(/CNPJ:?\s*([\d./-]{14,18})/i) || [])[1] || "";
  const data = dataBR((corpo.match(/emiss[aã]o:?\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1]) || dataBR(corpo);
  return { loja, cnpj, data, total, itens };
}

// Nota lida pela IA (foto): arruma os números e tira o que não faz sentido
export function arrumarNotaIA(n) {
  const itens = (Array.isArray(n && n.itens) ? n.itens : []).map(x => {
    const qtd = Number(x.qtd) > 0 ? Number(x.qtd) : 1, valor = Number(x.valor) || numBR(x.valor);
    return { nome: String(x.nome || "").trim().slice(0, 80), qtd, un: "", unit: Math.round((valor / qtd) * 100) / 100, valor };
  }).filter(x => x.nome && x.valor > 0 && x.valor < 100000);
  const soma = Math.round(itens.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const total = Number(n && n.total) > 0 ? Number(n.total) : soma;
  return { loja: String((n && n.loja) || "").trim().slice(0, 60), cnpj: "", data: /^\d{4}-\d{2}-\d{2}$/.test(n && n.data) ? n.data : "", total, itens };
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
export async function reduzirFoto(file, max = 1400, q = 0.7) {
  const url = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(file); });
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}

// Nome da loja como as pessoas falam: "SUPERMERCADO CONDOR LTDA" → "Supermercado Condor"
export const nomeLoja = s => String(s || "")
  .replace(/\b(ltda|s\.?\/?a|eireli|epp|me|cia)\b\.?/gi, "").replace(/[-–,.]+\s*$/g, "").replace(/\s{2,}/g, " ").trim()
  .toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, w => w.toLowerCase());
