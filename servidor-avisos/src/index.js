/*
  Servidor de avisos da Agenda (Cloudflare Worker, plano gratuito)
  ----------------------------------------------------------------
  O iPhone congela o app quando ele sai da tela, então quem manda as notificações
  na hora certa é este servidor, pelo padrão Web Push (o mesmo dos sites).

  - O app manda a lista dos próximos avisos (horário + texto) para /agendar.
  - A cada minuto o servidor confere a lista e envia os avisos daquele minuto.
  - O texto vai criptografado de ponta a ponta até o seu aparelho (RFC 8291).
*/

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

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origem = req.headers.get("Origin") || "";
    const permitida = !env.ORIGEM || env.ORIGEM === "*" || origem === env.ORIGEM || origem.startsWith("http://localhost") || origem.startsWith("http://127.0.0.1") || /^http:\/\/192\.168\./.test(origem);
    const cors = { "Access-Control-Allow-Origin": permitida ? (origem || "*") : env.ORIGEM, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/" || url.pathname === "/chave") return json({ ok: true, chave: env.VAPID_PUBLIC });

    if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ erro: "JSON inválido" }, 400); }

    const id = limpar(b.id, 64);
    if (!id) return json({ erro: "Falta o id" }, 400);

    // Guarda a lista dos próximos avisos deste aparelho
    if (url.pathname === "/agendar") {
      if (!valido(b.sub)) return json({ erro: "Inscrição inválida" }, 400);
      const agora = Date.now();
      const avisos = (Array.isArray(b.avisos) ? b.avisos : [])
        .filter(a => Number.isFinite(a.t) && a.t > agora - 60000 && a.t < agora + 9 * 864e5)
        .slice(0, 300).map(a => ({ t: a.t, titulo: limpar(a.titulo, 90), corpo: limpar(a.corpo, 180), tag: limpar(a.tag, 40) }));
      const dados = await ler(env);
      dados[id] = { sub: b.sub, avisos, atualizado: agora };
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
    if (mudou) await gravar(env, dados);
  },
};
