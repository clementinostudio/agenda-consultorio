// De onde veio quem criou a conta: a página de apresentação manda ?origem=fonte:pagina no link do app, e ela vai junto
// no cadastro. Sem cookie de terceiro nem serviço de fora: é só um texto curto, que o painel do dono conta.
export const K_ORIGEM = "avina-origem";
export const limparOrigem = s => String(s || "").toLowerCase().replace(/[^a-z0-9:_.-]/g, "").slice(0, 60);

const FONTES = [[/(^|\.)google\./, "google"], [/(^|\.)bing\./, "bing"], [/(^|\.)instagram\./, "instagram"], [/(^|\.)facebook\.|(^|\.)fb\./, "facebook"],
  [/whatsapp|(^|\.)wa\.me$/, "whatsapp"], [/tiktok/, "tiktok"], [/linkedin|lnkd\.in/, "linkedin"], [/youtube|youtu\.be/, "youtube"], [/(^|\.)t\.co$|twitter|(^|\.)x\.com$/, "x"],
  [/chatgpt|openai/, "chatgpt"], [/perplexity/, "perplexity"], [/claude\.ai/, "claude"], [/gemini/, "gemini"]];

// utm_source (ou ?origem=) ganha; depois, o site de onde a pessoa veio; sem nada, "direto".
// Vindo de outra página do próprio Avina, devolve "" (vale a fonte que já estava guardada na visita).
export function fonteDaVisita(busca, referrer, meuHost) {
  const q = new URLSearchParams(busca || "");
  const marcada = limparOrigem(q.get("utm_source") || q.get("origem"));
  if (marcada) return marcada;
  let host = "";
  try { host = new URL(referrer).hostname.toLowerCase(); } catch (e) { return "direto"; }
  if (host === meuHost || host === "avina.com.br" || host.endsWith(".avina.com.br")) return "";
  const achada = FONTES.find(([re]) => re.test(host));
  return achada ? achada[1] : limparOrigem(host.replace(/^www\./, ""));
}
