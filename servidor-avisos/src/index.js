/*
  Servidor de avisos da Agenda (Cloudflare Worker, plano gratuito)
  ----------------------------------------------------------------
  O iPhone congela o app quando ele sai da tela, então quem manda as notificações
  na hora certa é este servidor, pelo padrão Web Push (o mesmo dos sites).

  - O app manda a lista dos próximos avisos (horário + texto) para /agendar.
  - A cada minuto o servidor confere a lista e envia os avisos daquele minuto.
  - O texto vai criptografado de ponta a ponta até o seu aparelho (RFC 8291).
  - /transcrever: recebe a fala gravada no app (WAV curtinho) e devolve o texto, usando o
    Whisper do Workers AI (cota grátis diária da Cloudflare). Nada é guardado.
  - /entender: quando o app não entende uma frase sozinho, a IA de texto transforma em gasto ou atendimento.
  - /perguntar: "quanto gastei de Uber em outubro?" — o app manda um resumo dos números e a pergunta.
  - /ler-imagem: foto de comprovante ou nota vira valor, loja e data.
  Tudo dentro da cota grátis do Workers AI. No plano gratuito, quando a cota do dia acaba,
  a IA só para de responder até o dia seguinte (nunca gera cobrança). Nada fica guardado.
*/
import { rotaAsaas, usarCotaIA, quem } from "./asaas.js";
import { rotaLink } from "./link.js";
import { rotaAdmin, onde } from "./admin.js";
import { rotaBanco, rotaWebhookPluggy } from "./banco.js";

const CHAVE = "dados"; // tudo fica numa chave só do KV (um app pessoal, poucos aparelhos)
const enc = new TextEncoder();

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const junta = (...partes) => { const t = partes.reduce((a, p) => a + p.length, 0), out = new Uint8Array(t); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out; };

// Assinatura VAPID (identifica este servidor para a Apple, o Google e a Mozilla)
async function vapid(env, endpoint) {
  const cab = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUB || "mailto:avisos@agenda.app" })));
  const chave = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, enc.encode(`${cab}.${corpo}`));
  return `vapid t=${cab}.${corpo}.${b64u(ass)}, k=${env.VAPID_PUBLIC}`;
}

async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}

// Criptografia do conteúdo (aes128gcm, RFC 8291 + RFC 8188)
async function criptografar(sub, texto) {
  const uaPub = deB64u(sub.keys.p256dh), auth = deB64u(sub.keys.auth);
  const efemera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", efemera.publicKey));
  const uaChave = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave }, efemera.privateKey, 256));
  const ikm = await hkdf(auth, segredo, junta(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, junta(enc.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // tamanho do registro: 4096
  return junta(salt, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

async function enviar(env, sub, aviso) {
  const corpo = await criptografar(sub, JSON.stringify(aviso));
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapid(env, sub.endpoint), TTL: "900", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" },
    body: corpo,
  });
  return r.status;
}

const ler = async env => (await env.AVISOS.get(CHAVE, "json")) || {};
const gravar = (env, dados) => env.AVISOS.put(CHAVE, JSON.stringify(dados));
const valido = sub => sub && typeof sub.endpoint === "string" && sub.endpoint.startsWith("https://") && sub.keys && sub.keys.p256dh && sub.keys.auth;
const limpar = (s, n) => String(s || "").slice(0, n);

// Frases que o Whisper inventa quando só ouve ruído (vícios de legendas do YouTube)
const INVENTADO = /^\s*(se inscrev[ae]|inscreva-se|ative o sininho|obrigad[oa] por assistir|legendas? (pela|por|da)|amara\.org|tchau,? tchau|até a próxima|e aí,? pessoal|(muito )?obrigad[oa])[\s\S]{0,40}$/i;

/* ---------- IA de texto e de imagem (Workers AI) ---------- */
const IA_TEXTO = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const IA_VISAO = "@cf/meta/llama-4-scout-17b-16e-instruct";
// tira o JSON de dentro da resposta (às vezes vem com texto ou ```json em volta)
function lerJson(r) {
  const v = r && (r.response !== undefined ? r.response : r);
  if (v && typeof v === "object") return v;
  const s = String(v || ""), i = s.indexOf("{"), f = s.lastIndexOf("}");
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(s.slice(i, f + 1)); } catch (e) { return null; }
}
const textoDe = r => String((r && (typeof r.response === "string" ? r.response : r.response && JSON.stringify(r.response))) || "").trim();

const PROMPT_ENTENDER = `Você transforma frases faladas em português do Brasil em anotações de um app de finanças e agenda de um profissional de saúde mental.
Responda SÓ com JSON, neste formato:
{"tipo":"gastos"|"consultorio"|"pergunta"|"nada",
 "itens":[{"tipo":"saida"|"entrada","valor":número em reais,"categoria":uma das categorias,"descricao":"nome curto da loja ou do que foi","dias_atras":0}],
 "consultorio":{"paciente":"nome como foi dito","acao":"veio"|"falta"|"pagou"|"remarcar","pagou":true|false,"data":"AAAA-MM-DD" ou "","hora":"HH:MM" ou ""}}
Regras:
- "gastos": dinheiro que saiu (gastei, paguei, comprei, torrei, foi, deu) ou entrou (recebi, ganhei, caiu, entrou). Pode ter vários itens.
- Valores: "30 conto" = 30; "dez e cinquenta" = 10.5; "mil e duzentos" = 1200; "um real" = 1. Sem valor: use 0.
- dias_atras: hoje 0, ontem 1, anteontem 2; dia da semana passado = dias até ele.
- "consultorio": a frase fala de um paciente da lista (veio, faltou, pagou, remarcar). Datas relativas a HOJE.
- "pergunta": a pessoa está perguntando algo (quanto gastei, quem deve, quando...).
- "nada": não dá para entender.
Não invente valores nem nomes.`;

const PROMPT_PERGUNTAR = `Você é a Bolinha, a assistente do Avina, um app de agenda e finanças de um profissional de saúde mental.
É uma conversa FALADA: a resposta vai ser lida em voz alta. Responda em português do Brasil, como quem conversa,
em 1 a 3 frases curtas e naturais, sem listas, sem markdown, sem emojis. Valores no formato R$ 1.234,56 e datas como 21/10.
Use SÓ os DADOS abaixo e o que já foi dito na conversa (a pessoa pode fazer perguntas de continuação, como "e em setembro?").
Some e compare com cuidado. Se a resposta não estiver nos dados, diga isso em uma frase e sugira onde olhar no app.
Não dê conselhos financeiros ou clínicos longos.`;

const PROMPT_IMAGEM = `Esta é uma foto de comprovante, nota fiscal, recibo, cupom ou print de pagamento (Pix, cartão, boleto).
Responda SÓ com JSON: {"valor":número total pago em reais,"descricao":"nome curto da loja ou de quem recebeu","data":"AAAA-MM-DD" ou "","tipo":"saida"|"entrada","categoria":uma das categorias,"pagador":"nome de quem PAGOU (só em entrada)" ou "","cnpj":"CNPJ da loja ou de quem recebeu, se aparecer" ou ""}
"entrada" só se a foto mostrar dinheiro RECEBIDO (Pix recebido, transferência recebida). Use o valor TOTAL. Se não der para ler, use valor 0.`;

const PROMPT_NOTA = `Esta é uma foto de nota fiscal ou cupom de supermercado, padaria, farmácia ou loja.
Responda SÓ com JSON: {"loja":"nome do estabelecimento","cnpj":"CNPJ do estabelecimento (14 números)" ou "","data":"AAAA-MM-DD" ou "","total":número total pago,"itens":[{"nome":"descrição do produto como está na nota","qtd":número,"valor":número total do item em reais}]}
Liste TODOS os itens que der para ler, na ordem da nota. Não invente itens nem valores. Use ponto como separador decimal. Se não for uma nota, responda {"itens":[]}.`;

async function rodarTexto(env, sistema, usuario, max = 400) {
  return env.AI.run(IA_TEXTO, { messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }], max_tokens: max, temperature: 0.1 });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origem = req.headers.get("Origin") || "";
    const origens = String(env.ORIGEM || "").split(",").map(o => o.trim()).filter(Boolean); // pode ser mais de um endereço, separados por vírgula
    const permitida = !origens.length || origens.includes("*") || origens.includes(origem) || origem.startsWith("http://localhost") || origem.startsWith("http://127.0.0.1") || /^http:\/\/192\.168\./.test(origem);
    const cors = { "Access-Control-Allow-Origin": permitida ? (origem || "*") : origens[0], "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization, x-teste-uid", Vary: "Origin" };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/" || url.pathname === "/chave") return json({ ok: true, chave: env.VAPID_PUBLIC });

    // Índices do Banco Central (CDI, Selic, IPCA) para o app, quando o navegador não consegue consultar direto.
    // Guarda a resposta por 6 horas para não chamar o Banco Central à toa.
    if (url.pathname === "/indices") {
      const cacheKey = new Request("https://cache.local/indices-v1");
      const salvo = await caches.default.match(cacheKey);
      if (salvo) return json(await salvo.json());
      const serie = async n => {
        const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${n}/dados/ultimos/1?formato=json`, { headers: { Accept: "application/json" } });
        const j = await r.json(); return Number(String(j[0].valor).replace(",", "."));
      };
      try {
        const [cdi, selic, ipca] = await Promise.all([serie(4389), serie(432), serie(13522)]);
        const corpo = { cdi, selic, ipca, quando: Date.now() };
        ctx.waitUntil(caches.default.put(cacheKey, new Response(JSON.stringify(corpo), { headers: { "Cache-Control": "max-age=21600", "Content-Type": "application/json" } })));
        return json(corpo);
      } catch (e) {
        return json({ erro: "Banco Central fora do ar" }, 502);
      }
    }

    // Preço do combustível: acha a planilha semanal mais recente da ANP e repassa ao app (quem lê é o aparelho:
    // o plano grátis só tem 10 ms de processamento por pedido, e baixar/repassar quase não gasta nada)
    if (url.pathname === "/anp") {
      const UA = { "User-Agent": "Mozilla/5.0 (Avina; precos de combustivel)" };
      try {
        const pag = await fetch("https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas", { headers: UA });
        const html = await pag.text();
        // a mais recente é a de data final maior (os nomes misturam "_" e "-")
        const links = [...new Set(html.match(/https?:\/\/[^"'\s]+resumo_semanal_lpc_[^"'\s]+\.xlsx/gi) || [])];
        const fim = s => (s.match(/(\d{4})[-_](\d{2})[-_](\d{2})\.xlsx$/i) || []).slice(1).join("");
        links.sort((a, b) => fim(b).localeCompare(fim(a)));
        if (!links.length) return json({ erro: "Planilha da ANP não encontrada" }, 502);
        const arq = await fetch(links[0], { headers: UA });
        if (!arq.ok) return json({ erro: "ANP fora do ar" }, 502);
        return new Response(arq.body, { headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "public, max-age=21600", "X-ANP-Arquivo": links[0].split("/").pop(), "Access-Control-Expose-Headers": "X-ANP-Arquivo" } });
      } catch (e) { return json({ erro: "ANP fora do ar" }, 502); }
    }

    // Link de agendamento (a página do paciente usa GET para ver os horários): veja src/link.js
    if (url.pathname.startsWith("/link/")) return rotaLink(req, env, url, json, ctx, async (id, aviso) => { const d = (await ler(env))[id]; if (d && valido(d.sub)) await enviar(env, d.sub, aviso); });
    // Cidade aproximada de quem abriu o app (vai junto no registro de acesso): veja src/admin.js
    if (url.pathname === "/onde") return new Response(JSON.stringify(onde(req)), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    // Avisos da Pluggy (Open Finance): https://agenda-avisos.alvena.workers.dev/pluggy/webhook
    if (url.pathname === "/pluggy/webhook") return rotaWebhookPluggy(req, json);
    if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
    // Assinatura pelo Asaas (cobrança do app): veja src/asaas.js
    if (url.pathname.startsWith("/assinatura/") || url.pathname === "/asaas/webhook") return rotaAsaas(req, env, url, json, permitida);
    // Conectar o banco pelo Open Finance (Pluggy): veja src/banco.js
    if (url.pathname.startsWith("/banco/")) return rotaBanco(req, env, url, json, permitida);

    // Painel do dono (app.avina.com.br/admin/): veja src/admin.js
    if (url.pathname.startsWith("/admin/")) return rotaAdmin(req, env, url, json, { ler: () => ler(env), gravar: dados => gravar(env, dados) });

    // "Fulano está no mercado": avisa no celular os outros da casa. Quem pede tem que estar logado e ser da casa
    // (a lista de membros vem do Supabase com o login da própria pessoa, então a regra da nuvem é que confere).
    // No máximo um aviso a cada 30 minutos por casa, para não virar incômodo.
    if (url.pathname === "/casa/mercado") {
      if (!permitida) return json({ erro: "Origem não permitida" }, 403);
      const eu = await quem(req, env); if (!eu) return json({ erro: "Entre na sua conta" }, 401);
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/casa_membros?select=casa_id,user_id,nome`, { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` } });
      const membros = r.ok ? await r.json().catch(() => []) : [];
      const meu = membros.find(m => m.user_id === eu.id); if (!meu) return json({ erro: "Você não está numa casa" }, 403);
      const trava = `mercado:${meu.casa_id}`;
      if (await env.AVISOS.get(trava)) return json({ ok: true, enviados: 0, recente: true });
      const outros = new Set(membros.filter(m => m.casa_id === meu.casa_id && m.user_id !== eu.id).map(m => m.user_id));
      const nome = limpar(String(meu.nome || "").split(" ")[0], 30) || "Alguém da casa";
      const aviso = { titulo: `${nome} está no mercado`, corpo: "Falta alguma coisa? Coloque agora na lista de compras da casa.", tag: "casa-mercado" };
      const dados = await ler(env); let enviados = 0;
      for (const d of Object.values(dados)) if (d.uid && outros.has(d.uid) && valido(d.sub) && enviados < 20) { await enviar(env, d.sub, aviso).catch(() => 0); enviados++; }
      await env.AVISOS.put(trava, "1", { expirationTtl: 1800 });
      return json({ ok: true, enviados });
    }

    let b; try { b = await req.json(); } catch (e) { return json({ erro: "JSON inválido" }, 400); }

    // Nota fiscal do mercado (NFC-e): o QR code aponta para a página da Sefaz com os itens e os preços.
    // O servidor só busca a página (o navegador não pode, por CORS) e devolve como veio; quem lê é o aparelho.
    // Só aceita endereços do governo (.gov.br) com a chave da nota (44 números), para não virar uma porta aberta.
    // Cada estado faz de um jeito: redireciona guardando cookie de sessão, abre a nota dentro de um iframe,
    // ou tem certificado que falha em https. Por isso segue tudo isso aqui (até 6 passos), sempre dentro do .gov.br.
    if (url.pathname === "/nfce") {
      if (!permitida) return json({ erro: "Origem não permitida" }, 403);
      let alvo; try { alvo = new URL(limpar(b.url, 1500)); } catch (e) { return json({ erro: "Endereço inválido" }, 400); }
      const doGoverno = u => /^https?:$/.test(u.protocol) && /\.gov\.br$/i.test(u.hostname);
      if (!doGoverno(alvo) || !/\d{44}/.test(decodeURIComponent(alvo.search))) return json({ erro: "Esse QR code não é de uma nota da Sefaz" }, 400);
      const cab = { "User-Agent": "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5" };
      const biscoitos = {}, prazo = Date.now() + 20000; // 20 s no total: Sefaz lenta vira "tire uma foto"
      const pedir = async u => {
        const h = { ...cab }; const bc = Object.entries(biscoitos).map(([k, v]) => `${k}=${v}`).join("; "); if (bc) h.Cookie = bc;
        const sinal = () => AbortSignal.timeout(Math.max(500, prazo - Date.now()));
        let r;
        try { r = await fetch(u.toString(), { redirect: "manual", headers: h, signal: sinal() }); }
        catch (e) { // certificado ou conexão falhou (não demora): tenta pelo outro protocolo
          if (Date.now() >= prazo - 1000) throw e;
          const outro = new URL(u.toString()); outro.protocol = u.protocol === "https:" ? "http:" : "https:";
          r = await fetch(outro.toString(), { redirect: "manual", headers: h, signal: sinal() }); u = outro;
        }
        const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get("set-cookie") || "").split(/,(?=\s*[\w.-]+=)/);
        sc.forEach(c => { const m = String(c).match(/^\s*([^=;\s]+)=([^;]*)/); if (m) biscoitos[m[1]] = m[2]; });
        return { r, u };
      };
      try {
        let atual = alvo, buf = null, tipo = "text/html";
        for (let passo = 0; passo < 6; passo++) {
          const { r, u } = await pedir(atual); atual = u;
          const loc = r.headers.get("location");
          if (r.status >= 300 && r.status < 400 && loc) { const prox = new URL(loc, atual); if (!doGoverno(prox)) break; atual = prox; continue; }
          if (!r.ok) return json({ erro: "A Sefaz não respondeu" }, 502);
          tipo = r.headers.get("content-type") || "text/html";
          buf = await r.arrayBuffer();
          // só para procurar links (são ASCII): quem decodifica de verdade é o aparelho, que conhece todas as codificações
          const html = new TextDecoder("utf-8").decode(buf).replace(/<!--[\s\S]*?-->/g, "");
          if (/txtTit|C[óo]digo:|Vl\.?\s*Unit|Valor total/i.test(html)) break; // a nota já está aqui
          // a nota está dentro de um iframe/frame, num "meta refresh" ou num location.href do JavaScript?
          const dentro = [...html.matchAll(/<i?frame[^>]+src=["']?([^"'\s>]+)/gi)].map(m => m[1]).find(s => /\d{44}|qrcode|nfce|danfe|consulta/i.test(s))
            || (html.match(/http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i) || [])[1]
            || (html.length < 4000 ? (html.match(/(?:window\.|document\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i) || [])[1] : "");
          if (!dentro) break;
          let prox; try { prox = new URL(dentro.replace(/&amp;/g, "&"), atual); } catch (e) { break; }
          if (!doGoverno(prox) || prox.toString() === atual.toString()) break;
          atual = prox;
        }
        if (!buf) return json({ erro: "A Sefaz não respondeu" }, 502);
        return new Response(buf, { headers: { ...cors, "Content-Type": tipo, "X-Nfce-Url": atual.toString(), "Access-Control-Expose-Headers": "X-Nfce-Url", "Cache-Control": "private, max-age=600" } });
      } catch (e) { return json({ erro: "A Sefaz não respondeu" }, 502); }
    }

    // Transcreve a fala do app (Whisper na própria Cloudflare). O áudio não fica guardado em lugar nenhum.
    if (url.pathname === "/transcrever") {
      if (!permitida) return json({ erro: "Origem não permitida" }, 403);
      if (!env.AI) return json({ erro: "sem-ia" }, 501);
      const cota = await usarCotaIA(req, env, url.pathname);
      if (!cota.ok) return json({ erro: "limite", ...cota }, 429);
      const audio = typeof b.audio === "string" ? b.audio : "";
      if (audio.length < 2000 || audio.length > 2500000) return json({ erro: "Áudio vazio ou grande demais" }, 400);
      // vad_filter: o próprio Whisper descarta o que não é voz (sem ele, ruído vira "Se inscreva no canal.")
      const entrada = { audio, task: "transcribe", language: "pt", condition_on_previous_text: false, vad_filter: true };
      const prompt = limpar(b.prompt, 700); if (prompt) entrada.initial_prompt = prompt;
      try {
        const r = await env.AI.run("@cf/openai/whisper-large-v3-turbo", entrada);
        let texto = String((r && r.text) || "").trim();
        if (INVENTADO.test(texto)) texto = "";
        return json({ ok: true, texto });
      } catch (e) {
        return json({ erro: "Falha ao transcrever: " + String((e && e.message) || e).slice(0, 140) }, 502);
      }
    }

    // IA: entender frase, responder pergunta e ler foto
    if (url.pathname === "/entender" || url.pathname === "/perguntar" || url.pathname === "/ler-imagem" || url.pathname === "/ler-nota") {
      if (!permitida) return json({ erro: "Origem não permitida" }, 403);
      if (!env.AI) return json({ erro: "sem-ia" }, 501);
      const cota = await usarCotaIA(req, env, url.pathname);
      if (!cota.ok) return json({ erro: "limite", ...cota }, 429);
      const hoje = limpar(b.hoje, 40), cats = (Array.isArray(b.categorias) ? b.categorias : []).slice(0, 30).map(c => limpar(c, 20)).join(", ");
      try {
        if (url.pathname === "/entender") {
          const texto = limpar(b.texto, 600).trim();
          if (!texto) return json({ erro: "Frase vazia" }, 400);
          const pac = (Array.isArray(b.pacientes) ? b.pacientes : []).slice(0, 80).map(p => limpar(p, 30)).join(", ");
          const r = await rodarTexto(env, PROMPT_ENTENDER, `HOJE: ${hoje}\nCATEGORIAS: ${cats}\nPACIENTES: ${pac || "(nenhum)"}\nFRASE: ${texto}`, 350);
          const dados = lerJson(r);
          return dados ? json({ ok: true, dados }) : json({ erro: "A IA não respondeu no formato certo" }, 502);
        }
        if (url.pathname === "/perguntar") {
          const pergunta = limpar(b.pergunta, 400).trim(), contexto = limpar(b.contexto, 40000);
          if (!pergunta) return json({ erro: "Pergunta vazia" }, 400);
          // conversa: as últimas falas entram como histórico, para entender "e em setembro?"
          const hist = (Array.isArray(b.historico) ? b.historico : []).slice(-8)
            .map(m => ({ role: m && m.quem === "ela" ? "assistant" : "user", content: limpar(m && m.texto, 500) })).filter(m => m.content);
          const r = await env.AI.run(IA_TEXTO, { messages: [{ role: "system", content: `${PROMPT_PERGUNTAR}\n\nHOJE: ${hoje}\n\nDADOS:\n${contexto}` }, ...hist, { role: "user", content: pergunta }], max_tokens: 300, temperature: 0.2 });
          const resposta = textoDe(r);
          return resposta ? json({ ok: true, resposta }) : json({ erro: "A IA não respondeu" }, 502);
        }
        // /ler-nota: a nota inteira, item por item (resposta maior)
        if (url.pathname === "/ler-nota") {
          const foto = typeof b.imagem === "string" ? b.imagem : "";
          if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 1600000) return json({ erro: "Imagem inválida ou grande demais" }, 400);
          const rn = await env.AI.run(IA_VISAO, { messages: [{ role: "user", content: [{ type: "text", text: `${PROMPT_NOTA}
HOJE: ${hoje}` }, { type: "image_url", image_url: { url: foto } }] }], max_tokens: 1800, temperature: 0.1 });
          const nota = lerJson(rn);
          return nota && Array.isArray(nota.itens) ? json({ ok: true, nota }) : json({ erro: "A IA não conseguiu ler a nota" }, 502);
        }
        // /ler-imagem
        const imagem = typeof b.imagem === "string" ? b.imagem : "";
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(imagem) || imagem.length > 1600000) return json({ erro: "Imagem inválida ou grande demais" }, 400);
        const r = await env.AI.run(IA_VISAO, {
          messages: [{ role: "user", content: [{ type: "text", text: `${PROMPT_IMAGEM}\nHOJE: ${hoje}\nCATEGORIAS: ${cats}` }, { type: "image_url", image_url: { url: imagem } }] }],
          max_tokens: 250, temperature: 0.1,
        });
        const dados = lerJson(r);
        return dados ? json({ ok: true, dados }) : json({ erro: "Não consegui ler a foto" }, 502);
      } catch (e) {
        const msg = String((e && e.message) || e);
        // cota grátis do dia acabou (ou a IA está ocupada): o app avisa e segue sem IA
        if (/limit|quota|neurons|capacity|429|3036|3040/i.test(msg)) return json({ erro: "cota", detalhe: msg.slice(0, 140) }, 429);
        return json({ erro: "Falha na IA: " + msg.slice(0, 140) }, 502);
      }
    }

    const id = limpar(b.id, 64);
    if (!id) return json({ erro: "Falta o id" }, 400);

    // Guarda a lista dos próximos avisos deste aparelho
    if (url.pathname === "/agendar") {
      if (!valido(b.sub)) return json({ erro: "Inscrição inválida" }, 400);
      const agora = Date.now();
      const avisos = (Array.isArray(b.avisos) ? b.avisos : [])
        .filter(a => Number.isFinite(a.t) && a.t > agora - 60000 && a.t < agora + 9 * 864e5)
        .slice(0, 300).map(a => ({ t: a.t, titulo: limpar(a.titulo, 90), corpo: limpar(a.corpo, 180), tag: limpar(a.tag, 40) }));
      const dados = await ler(env), antes = dados[id] || {};
      // uid: de quem é o aparelho (para o painel mandar aviso a uma conta); extra: avisos do painel ainda não enviados
      const uid = /^[0-9a-f-]{36}$/i.test(String(b.uid || "")) ? String(b.uid) : antes.uid;
      dados[id] = { sub: b.sub, avisos, atualizado: agora, ...(uid ? { uid } : {}), ...(antes.extra ? { extra: antes.extra } : {}) };
      await gravar(env, dados);
      return json({ ok: true, avisos: avisos.length });
    }

    // Manda um aviso de teste (na hora ou daqui a alguns segundos)
    if (url.pathname === "/teste") {
      if (!valido(b.sub)) return json({ erro: "Inscrição inválida" }, 400);
      const atraso = Math.min(Math.max(Number(b.atraso) || 0, 0), 25000);
      const aviso = { titulo: limpar(b.titulo, 90) || "Teste de aviso", corpo: limpar(b.corpo, 180) || "Chegou! Os avisos com o app fechado estão funcionando.", tag: "teste" };
      if (!atraso) return json({ ok: true, status: await enviar(env, b.sub, aviso) });
      ctx.waitUntil(new Promise(r => setTimeout(r, atraso)).then(() => enviar(env, b.sub, aviso)));
      return json({ ok: true, agendado: atraso });
    }

    // Para de mandar avisos para este aparelho
    if (url.pathname === "/cancelar") {
      const dados = await ler(env);
      delete dados[id];
      await gravar(env, dados);
      return json({ ok: true });
    }
    return json({ erro: "Caminho desconhecido" }, 404);
  },

  // Roda a cada minuto: envia os avisos marcados para este minuto
  async scheduled(evento, env, ctx) {
    const minuto = Math.floor(evento.scheduledTime / 60000);
    const dados = await ler(env);
    let mudou = false;
    for (const [id, d] of Object.entries(dados)) {
      for (const a of d.avisos || []) {
        if (Math.floor(a.t / 60000) !== minuto) continue;
        const status = await enviar(env, d.sub, { titulo: a.titulo, corpo: a.corpo, tag: a.tag });
        if (status === 404 || status === 410) { delete dados[id]; mudou = true; break; } // aparelho desinstalou o app
      }
    }
    // avisos mandados pelo painel do dono (src/admin.js): no máximo 30 por minuto (limite de pedidos do plano grátis)
    let enviados = 0;
    for (const [id, d] of Object.entries(dados)) {
      if (!d.extra || !d.extra.length || enviados >= 30) continue;
      const a = d.extra.shift(); enviados++; mudou = true;
      const status = await enviar(env, d.sub, { titulo: a.titulo, corpo: a.corpo, tag: a.tag }).catch(() => 0);
      if (status === 404 || status === 410) delete dados[id];
      else if (!d.extra.length) delete d.extra;
    }
    if (mudou) await gravar(env, dados);
  },
};
