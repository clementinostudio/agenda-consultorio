/* =========================================================
   Boleto: entende o código de barras (44 dígitos) ou a linha digitável
   (47 dígitos nos boletos de banco, 48 nas contas de luz, água, telefone, impostos).
   Valor, vencimento e quem emitiu saem do próprio código, sem internet.
   Os dígitos verificadores são conferidos: código lido errado pela câmera não passa.
   ========================================================= */
const so = s => String(s || "").replace(/\D/g, "");

// Módulo 10 (campos da linha digitável e contas de consumo com referência 6 ou 7)
function mod10(n) {
  let s = 0, p = 2;
  for (let i = n.length - 1; i >= 0; i--) { const r = Number(n[i]) * p; s += r > 9 ? Math.floor(r / 10) + (r % 10) : r; p = p === 2 ? 1 : 2; }
  return (10 - (s % 10)) % 10;
}
// Módulo 11 com pesos de 2 a 9 (da direita para a esquerda)
function soma11(n) { let s = 0, p = 2; for (let i = n.length - 1; i >= 0; i--) { s += Number(n[i]) * p; p = p === 9 ? 2 : p + 1; } return s % 11; }
const dvBanco = n => { const d = 11 - soma11(n); return d === 0 || d === 10 || d === 11 ? 1 : d; };
const dvArrec11 = n => { const r = soma11(n); return r === 0 || r === 1 ? 0 : 11 - r; };
const dvArrec = (ref, n) => (ref === "6" || ref === "7" ? mod10(n) : dvArrec11(n));

const BANCOS = {
  "001": "Banco do Brasil", "033": "Santander", "104": "Caixa", "237": "Bradesco", "341": "Itaú", "260": "Nubank", "077": "Inter",
  "336": "C6 Bank", "756": "Sicoob", "748": "Sicredi", "422": "Safra", "041": "Banrisul", "070": "BRB", "004": "Banco do Nordeste",
  "021": "Banestes", "212": "Banco Original", "623": "Banco Pan", "208": "BTG Pactual", "290": "PagBank", "323": "Mercado Pago",
  "380": "PicPay", "655": "Banco Votorantim", "745": "Citibank", "746": "Modal", "389": "Mercantil", "136": "Unicred", "085": "Ailos",
  "097": "Credisis", "707": "Daycoval", "633": "Rendimento", "403": "Cora", "332": "Acesso", "197": "Stone", "274": "Money Plus",
};
const SEGMENTOS = {
  "1": ["Prefeitura (IPTU, ISS)", "outros"], "2": ["Água e esgoto", "casa"], "3": ["Luz ou gás", "casa"], "4": ["Telefone, internet ou TV", "casa"],
  "5": ["Órgão do governo", "outros"], "6": ["Carnê ou empresa", "outros"], "7": ["Multa de trânsito", "transporte"], "9": ["Conta de banco", "outros"],
};

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somaDias = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
// O "fator de vencimento" conta dias desde 07/10/1997 e recomeçou em 1000 no dia 22/02/2025.
// Fica com a data mais perto de hoje entre as duas contagens.
function vencimentoDoFator(fator) {
  if (!fator) return null;
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const a = somaDias(new Date(1997, 9, 7, 12), fator), b = somaDias(new Date(2025, 1, 22, 12), fator - 1000);
  return iso(Math.abs(a - hoje) <= Math.abs(b - hoje) ? a : b);
}
// Contas de consumo não têm vencimento padronizado; muitas empresas põem AAAAMMDD no campo livre
function vencimentoProvavel(livre) {
  const hoje = new Date(), min = somaDias(hoje, -60), max = somaDias(hoje, 400);
  for (let i = 0; i + 8 <= livre.length; i++) {
    const y = Number(livre.slice(i, i + 4)), m = Number(livre.slice(i + 4, i + 6)), d = Number(livre.slice(i + 6, i + 8));
    if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) continue;
    const dt = new Date(y, m - 1, d, 12);
    if (dt.getMonth() === m - 1 && dt >= min && dt <= max) return iso(dt);
  }
  return null;
}

// Código de barras (44) -> linha digitável, para copiar e pagar no app do banco
function linhaDoCodigo(c) {
  if (c[0] === "8") return [0, 11, 22, 33].map(i => { const b = c.slice(i, i + 11); return `${b}-${dvArrec(c[2], b)}`; }).join(" ");
  const c1 = c.slice(0, 4) + c.slice(19, 24), c2 = c.slice(24, 34), c3 = c.slice(34, 44);
  const f = (s, dv) => `${s.slice(0, 5)}.${s.slice(5)}${dv}`;
  return `${f(c1, mod10(c1))} ${f(c2, mod10(c2))} ${f(c3, mod10(c3))} ${c[4]} ${c.slice(5, 19)}`;
}

// Confere e explica um código de barras de 44 dígitos
function deCodigo(c) {
  if (c.length !== 44) return null;
  if (c[0] === "8") {
    const ref = c[2];
    if (!"6789".includes(ref) || Number(c[3]) !== dvArrec(ref, c.slice(0, 3) + c.slice(4))) return null;
    const [emissor, cat] = SEGMENTOS[c[1]] || ["Conta de consumo", "outros"];
    const valor = ref === "6" || ref === "8" ? Number(c.slice(4, 15)) / 100 : 0;
    const livre = c.slice(c[1] === "6" ? 23 : 19);
    return { tipo: "consumo", codigo: c, linha: linhaDoCodigo(c), valor, vencimento: vencimentoProvavel(livre), vencimentoIncerto: true, emissor, cat };
  }
  if (Number(c[4]) !== dvBanco(c.slice(0, 4) + c.slice(5))) return null;
  const banco = c.slice(0, 3);
  return { tipo: "banco", codigo: c, linha: linhaDoCodigo(c), valor: Number(c.slice(9, 19)) / 100, vencimento: vencimentoDoFator(Number(c.slice(5, 9))), vencimentoIncerto: false, emissor: BANCOS[banco] ? `Boleto ${BANCOS[banco]}` : "Boleto bancário", cat: "outros" };
}

// Aceita o que vier: código de barras lido pela câmera, linha digitável copiada (com pontos e espaços) ou colada de um e-mail
export function lerBoleto(texto) {
  const n = so(texto);
  if (n.length === 44) return deCodigo(n);
  if (n.length === 47) { // linha digitável de banco: confere os 3 campos e remonta o código de barras
    if (mod10(n.slice(0, 9)) !== Number(n[9]) || mod10(n.slice(10, 20)) !== Number(n[20]) || mod10(n.slice(21, 31)) !== Number(n[31])) return null;
    return deCodigo(n.slice(0, 4) + n[32] + n.slice(33, 47) + n.slice(4, 9) + n.slice(10, 20) + n.slice(21, 31));
  }
  if (n.length === 48 && n[0] === "8") { // conta de consumo: 4 blocos de 11 dígitos + 1 verificador cada
    const blocos = [0, 12, 24, 36].map(i => n.slice(i, i + 11));
    if (blocos.some((b, k) => dvArrec(n[2], b) !== Number(n[k * 12 + 11]))) return null;
    return deCodigo(blocos.join(""));
  }
  return null;
}

// O código do boleto no meio de um texto comprido (PDF do boleto, e-mail): devolve os números que lerBoleto aceita.
// Procura trechos de números (com pontos e espaços no meio) e confere os dígitos de cada pedaço.
// Só a linha digitável (47 ou 48, com 3 ou 4 dígitos verificadores), que pode estar grudada em outros números.
// O código de barras (44) fica de fora: tem 1 verificador só, e a chave de uma NF-e (também 44) passaria 1 vez em 11.
export function acharBoleto(texto) {
  const trechos = (String(texto || "").match(/\d[\d .\-]{40,90}\d/g) || []).map(so);
  for (const tam of [47, 48]) for (const n of trechos) {
    for (let i = 0; i + tam <= n.length; i++) { const p = n.slice(i, i + tam); if (lerBoleto(p)) return p; }
  }
  return "";
}

// Para os testes e para a tela: só os dígitos
export const digitosBoleto = so;
