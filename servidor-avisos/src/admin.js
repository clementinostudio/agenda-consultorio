/*
  Painel do dono (app.avina.com.br/admin/)
  ----------------------------------------
  As contas, os acessos e os números do banco vêm direto do Supabase (funções admin_* do banco).
  Daqui sai o que mora neste servidor e na Cloudflare:

  - /admin/assinaturas    assinaturas, cortesias, códigos usados, link de agendamento, aparelhos e IA de cada conta
  - /admin/assinatura     uma conta, lida na hora no Asaas: { uid }
  - /admin/codigos        os códigos de acesso e quem usou cada um
  - /admin/codigo/criar   { codigo, dias, max, validoAte } ou { gerar: 10, dias, validoAte } (de uso único)
  - /admin/codigo/apagar  { codigo }   (quem já usou continua com os dias que ganhou)
  - /admin/cortesia       { uid, ate: "AAAA-MM-DD" } dá Pro até o dia; { uid, ate: null } tira a cortesia
  - /admin/aviso          { uid | todos: true, titulo, corpo }: notificação no celular (sai no próximo minuto)
  - /admin/excluir        { uid }: exclui a conta, cancela a assinatura no Asaas e limpa o que estava aqui
  - /admin/cloudflare     pedidos do servidor e do site, uso do KV, da IA e visitas (precisa do segredo CF_API_TOKEN)

  Quem pede precisa ser admin E ter entrado com o código do app autenticador: quem confere é o próprio
  banco (função sou_admin), com o login de quem pediu. Cada ação fica anotada no registro do painel (admin_log).
*/
import { PLANOS, idPlano, estado, asaas } from "./asaas.js";

const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Chama uma função do banco com o login de quem pediu (o banco confere de novo se é admin)
async function banco(env, token, fn, args = {}) {
  if (token === "teste") return null;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.message) || `O banco respondeu ${r.status}`);
  return j;
}
const anotar = (env, token, acao, alvo, detalhe) => banco(env, token, "admin_anotar", { p_acao: acao, p_alvo: alvo || null, p_detalhe: detalhe || null }).catch(() => {});

// Devolve o login de quem pediu, se for admin com a verificação em 2 etapas
async function loginDoAdmin(req, env) {
  if (env.MODO_TESTE === "1" && req.headers.get("X-Teste-Uid")) return req.headers.get("X-Teste-Admin") === "1" ? "teste" : null;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL) return null;
  const s = await banco(env, token, "sou_admin").catch(() => null);
  return s && s.admin && s.verificado ? token : null;
}

// Todas as chaves de um prefixo (o KV devolve de 1000 em 1000)
async function chaves(env, prefix) {
  const todas = []; let cursor;
  do {
    const r = await env.AVISOS.list({ prefix, cursor });
    todas.push(...r.keys.map(k => k.name));
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return todas;
}

// Quanto o plano rende por mês (o anual dividido por 12)
const mensal = plano => { const p = PLANOS[idPlano(plano)]; return p ? Math.round((p.ciclo === "YEARLY" ? p.valor / 12 : p.valor) * 100) / 100 : 0; };
const limpoCodigo = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
// letras e números sem os que confundem (0/O, 1/I/L), como no criar-codigo.sh
function codigoNovo() {
  const al = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", b = crypto.getRandomValues(new Uint8Array(6));
  return "AVN" + Array.from(b, x => al[x % al.length]).join("");
}

export async function rotaAdmin(req, env, url, json, extra) {
  const token = await loginDoAdmin(req, env);
  if (!token) return json({ erro: "Só para o admin, com a verificação em 2 etapas." }, 403);
  const b = await req.json().catch(() => ({}));
  const rota = url.pathname.slice("/admin/".length);
  const uid = String(b.uid || "").slice(0, 40);
  const precisaUid = () => UUID.test(uid) ? null : json({ erro: "Conta inválida" }, 400);

  if (rota === "assinaturas") {
    const hoje = hojeBR();
    const [kAssin, kPlano, kCort, kUsou, kLink, kPed, kVoz, kIa, dados] = await Promise.all([
      chaves(env, "assin:"), chaves(env, "plano:"), chaves(env, "cort:"), chaves(env, "usou:"), chaves(env, "linkde:"), chaves(env, "pedidos:"),
      chaves(env, `cota:voz:${hoje}:`), chaves(env, `cota:ia:${hoje}:`), extra.ler(),
    ]);
    const contas = {}, ia = { voz: { pessoas: kVoz.length, usos: 0 }, ia: { pessoas: kIa.length, usos: 0 } };
    const de = id => (contas[id] = contas[id] || {});
    await Promise.all([
      ...kAssin.map(async k => {
        const reg = (await env.AVISOS.get(k, "json")) || {};
        const pagos = (reg.historico || []).filter(h => !h.devolvido);
        Object.assign(de(k.slice(6)), {
          plano: reg.plano ? idPlano(reg.plano) : null, nomePlano: reg.plano ? (PLANOS[idPlano(reg.plano)] || {}).nome || reg.plano : null,
          forma: reg.forma || null, desde: reg.desde || null, ate: reg.ate || null, pausaAte: reg.pausaAte || null, motivo: reg.motivo || null,
          assinando: !!reg.assinatura, mensal: reg.assinatura ? mensal(reg.plano) : 0, ambiente: reg.amb || null,
          pagamentos: pagos.length, totalPago: Math.round(pagos.reduce((s, h) => s + (Number(h.valor) || 0), 0) * 100) / 100,
          devolvidos: (reg.historico || []).filter(h => h.devolvido).length,
        });
      }),
      ...kPlano.map(async k => { de(k.slice(6)).nivel = await env.AVISOS.get(k); }),
      ...kCort.map(async k => { de(k.slice(5)).cortesiaAte = await env.AVISOS.get(k); }),
      // usou:<CÓDIGO>:<conta> = dia em que usou
      ...kUsou.map(async k => { const [, cod, id] = k.split(":"); const c = de(id); (c.codigos = c.codigos || []).push({ codigo: cod, dia: await env.AVISOS.get(k) }); }),
      ...kLink.map(async k => { de(k.slice(7)).link = await env.AVISOS.get(k); }),
      ...kPed.map(async k => { de(k.slice(8)).pedidosAbertos = ((await env.AVISOS.get(k, "json")) || []).length; }),
      // cota:<voz|ia>:<dia>:<conta> = quantas vezes usou hoje
      ...kVoz.map(async k => { const n = Number(await env.AVISOS.get(k)) || 0; ia.voz.usos += n; de(k.split(":")[3]).vozHoje = n; }),
      ...kIa.map(async k => { const n = Number(await env.AVISOS.get(k)) || 0; ia.ia.usos += n; de(k.split(":")[3]).iaHoje = n; }),
    ]);
    let semConta = 0;
    for (const d of Object.values(dados)) { if (d.uid && UUID.test(d.uid)) de(d.uid).aparelhos = (de(d.uid).aparelhos || 0) + 1; else semConta++; }
    return json({
      contas, ia,
      aparelhosComAviso: Object.keys(dados).length, aparelhosSemConta: semConta,
      cobrancaInicio: env.COBRANCA_INICIO || null, asaasLigado: !!env.ASAAS_KEY, cloudflareLigado: !!env.CF_API_TOKEN,
    });
  }

  if (rota === "assinatura") {
    const ruim = precisaUid(); if (ruim) return ruim;
    if (!env.ASAAS_KEY) return json({ erro: "O Asaas não está ligado neste servidor." }, 400);
    try { return json(await estado(env, uid)); }
    catch (e) { return json({ erro: "O Asaas não respondeu: " + (e.message || e) }, 502); }
  }

  if (rota === "codigos") {
    const [kCod, kUsou] = await Promise.all([chaves(env, "codigo:"), chaves(env, "usou:")]);
    const usos = {};
    await Promise.all(kUsou.map(async k => { const [, cod, id] = k.split(":"); (usos[cod] = usos[cod] || []).push({ uid: id, dia: await env.AVISOS.get(k) }); }));
    const codigos = await Promise.all(kCod.map(async k => ({ codigo: k.slice(7), ...((await env.AVISOS.get(k, "json")) || {}), usos: usos[k.slice(7)] || [] })));
    // códigos apagados que alguém usou continuam aparecendo (para saber de onde veio a cortesia)
    for (const cod of Object.keys(usos)) if (!codigos.some(c => c.codigo === cod)) codigos.push({ codigo: cod, apagado: true, usados: usos[cod].length, usos: usos[cod] });
    return json({ codigos });
  }

  if (rota === "codigo/criar") {
    const dias = Math.round(Number(b.dias)), validoAte = b.validoAte ? String(b.validoAte) : "";
    if (!(dias >= 1 && dias <= 365)) return json({ erro: "Dias precisa ser de 1 a 365." }, 400);
    if (validoAte && !DATA.test(validoAte)) return json({ erro: "Data inválida." }, 400);
    const base = { dias, ...(validoAte ? { validoAte } : {}) };
    if (b.gerar) {
      const n = Math.round(Number(b.gerar));
      if (!(n >= 1 && n <= 50)) return json({ erro: "Gere de 1 a 50 códigos por vez." }, 400);
      const lista = Array.from({ length: n }, codigoNovo);
      await Promise.all(lista.map(c => env.AVISOS.put(`codigo:${c}`, JSON.stringify({ ...base, max: 1, usados: 0 }))));
      await anotar(env, token, "gerar códigos", null, { quantidade: n, dias, validoAte: validoAte || null });
      return json({ ok: true, codigos: lista });
    }
    const cod = limpoCodigo(b.codigo), max = Math.round(Number(b.max));
    if (cod.length < 4) return json({ erro: "O código precisa ter pelo menos 4 letras ou números." }, 400);
    if (!(max >= 1 && max <= 100000)) return json({ erro: "Quantas pessoas podem usar: um número a partir de 1." }, 400);
    const antes = (await env.AVISOS.get(`codigo:${cod}`, "json")) || {}; // criar de novo mantém a contagem de quem já usou
    await env.AVISOS.put(`codigo:${cod}`, JSON.stringify({ ...base, max, usados: antes.usados || 0 }));
    await anotar(env, token, antes.dias ? "mudar código" : "criar código", null, { codigo: cod, dias, max, validoAte: validoAte || null });
    return json({ ok: true, codigos: [cod] });
  }

  if (rota === "codigo/apagar") {
    const cod = limpoCodigo(b.codigo);
    if (!cod) return json({ erro: "Qual código?" }, 400);
    await env.AVISOS.delete(`codigo:${cod}`);
    await anotar(env, token, "apagar código", null, { codigo: cod });
    return json({ ok: true });
  }

  if (rota === "cortesia") {
    const ruim = precisaUid(); if (ruim) return ruim;
    const ate = b.ate ? String(b.ate) : null;
    if (ate && !DATA.test(ate)) return json({ erro: "Data inválida." }, 400);
    if (ate) {
      await env.AVISOS.put(`cort:${uid}`, ate);
      if (ate >= hojeBR()) await env.AVISOS.put(`plano:${uid}`, "pro"); // a IA já libera na hora (o app confirma ao abrir)
    } else {
      await env.AVISOS.delete(`cort:${uid}`);
      await env.AVISOS.delete(`plano:${uid}`); // o app recalcula ao abrir (assinatura e cortesia de conta antiga continuam valendo)
    }
    await anotar(env, token, ate ? "dar cortesia" : "tirar cortesia", uid, ate ? { ate } : null);
    return json({ ok: true });
  }

  if (rota === "aviso") {
    const titulo = String(b.titulo || "").trim().slice(0, 90), corpo = String(b.corpo || "").trim().slice(0, 180);
    if (!titulo) return json({ erro: "Escreva o título do aviso." }, 400);
    if (!b.todos) { const ruim = precisaUid(); if (ruim) return ruim; }
    const dados = await extra.ler();
    let n = 0;
    for (const d of Object.values(dados)) {
      if (!b.todos && d.uid !== uid) continue;
      d.extra = [...(d.extra || []).slice(-4), { t: Date.now(), titulo, corpo, tag: "avina-admin" }]; n++;
    }
    if (!n) return json({ erro: b.todos ? "Nenhum aparelho com avisos ligados." : "Essa conta não tem nenhum aparelho com avisos ligados." }, 404);
    await extra.gravar(dados);
    await anotar(env, token, b.todos ? "aviso para todos" : "aviso", b.todos ? null : uid, { titulo, corpo, aparelhos: n });
    return json({ ok: true, aparelhos: n });
  }

  if (rota === "excluir") {
    const ruim = precisaUid(); if (ruim) return ruim;
    // 1) o banco confere (não exclui a si mesmo nem outro admin) e exclui a conta
    try { await banco(env, token, "admin_excluir_conta", { p_user: uid }); }
    catch (e) { return json({ erro: e.message }, 400); }
    // 2) assinatura no Asaas (para de cobrar)
    const avisos = [], reg = (await env.AVISOS.get(`assin:${uid}`, "json")) || {};
    if (reg.assinatura && env.ASAAS_KEY) {
      try { await asaas(env, "DELETE", `/subscriptions/${reg.assinatura}`); }
      catch (e) { if (e.status !== 404) avisos.push(`Cancele à mão no Asaas a assinatura ${reg.assinatura} (o Asaas respondeu: ${e.message}).`); }
    }
    // 3) o que estava neste servidor
    const end = await env.AVISOS.get(`linkde:${uid}`);
    const usou = (await chaves(env, "usou:")).filter(k => k.endsWith(`:${uid}`));
    await Promise.all([`assin:${uid}`, `plano:${uid}`, `cort:${uid}`, `linkde:${uid}`, `pedidos:${uid}`, end && `link:${end}`, reg.assinatura && `sub:${reg.assinatura}`, ...usou]
      .filter(Boolean).map(k => env.AVISOS.delete(k)));
    const dados = await extra.ler();
    const seus = Object.keys(dados).filter(id => dados[id].uid === uid);
    if (seus.length) { seus.forEach(id => delete dados[id]); await extra.gravar(dados); }
    return json({ ok: true, avisos });
  }

  if (rota === "cloudflare") {
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return json({ configurado: false });
    const chave = new Request("https://cache.local/admin-cloudflare-v1");
    if (!b.atualizar) { const salvo = await caches.default.match(chave); if (salvo) return json(await salvo.json()); }
    const r = await cloudflare(env);
    await caches.default.put(chave, new Response(JSON.stringify(r), { headers: { "Cache-Control": "max-age=300", "Content-Type": "application/json" } }));
    return json(r);
  }

  return json({ erro: "Não encontrado" }, 404);
}

/* ---------- Cloudflare: números dos últimos 7 dias (API de analytics, cota grátis) ---------- */
async function cloudflare(env) {
  const gql = async (query, variables) => {
    const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST", headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
    if (!r.ok || !j.data) throw new Error(`A Cloudflare respondeu ${r.status}`);
    return j.data.viewer;
  };
  // os limites grátis da Cloudflare contam por dia em UTC
  const dias = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10));
  const depois = d => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
  const de = dias[0], ate = dias[6], conta = env.CF_ACCOUNT_ID;
  const out = { configurado: true, dias, gerado: new Date().toISOString(), erros: {} };
  const tenta = async (nome, f) => { try { out[nome] = await f(); } catch (e) { out.erros[nome] = e.message || String(e); } };

  await Promise.all([
    // pedidos de cada Worker (este servidor e o site), dia a dia
    tenta("workers", async () => {
      const blocos = dias.map((d, i) => `d${i}: workersInvocationsAdaptive(limit: 50, filter: { datetime_geq: "${d}T00:00:00Z", datetime_lt: "${depois(d)}T00:00:00Z" }) { sum { requests errors subrequests } dimensions { scriptName } }`).join("\n");
      const v = await gql(`query($a: string!) { viewer { accounts(filter: { accountTag: $a }) { ${blocos} } } }`, { a: conta });
      const ac = v.accounts[0] || {};
      return dias.map((d, i) => ({ dia: d, scripts: Object.fromEntries((ac[`d${i}`] || []).map(x => [x.dimensions.scriptName, x.sum])) }));
    }),
    // leituras e gravações no KV (o grátis tem 100 mil leituras e mil gravações por dia)
    tenta("kv", async () => {
      const v = await gql(`query($a: string!, $ns: string, $de: Date, $ate: Date) { viewer { accounts(filter: { accountTag: $a }) {
        ops: kvOperationsAdaptiveGroups(filter: { namespaceId: $ns, date_geq: $de, date_leq: $ate }, limit: 1000, orderBy: [date_ASC]) { sum { requests } dimensions { date actionType } }
        tam: kvStorageAdaptiveGroups(filter: { namespaceId: $ns, date_geq: $de, date_leq: $ate }, limit: 10, orderBy: [date_DESC]) { max { keyCount byteCount } dimensions { date } }
      } } }`, { a: conta, ns: env.KV_ID, de, ate });
      const ac = v.accounts[0] || {}, porDia = Object.fromEntries(dias.map(d => [d, { dia: d, read: 0, write: 0, delete: 0, list: 0 }]));
      for (const x of ac.ops || []) if (porDia[x.dimensions.date]) porDia[x.dimensions.date][x.dimensions.actionType] = (porDia[x.dimensions.date][x.dimensions.actionType] || 0) + x.sum.requests;
      const t = (ac.tam || [])[0];
      return { dias: Object.values(porDia), chaves: t ? t.max.keyCount : null, bytes: t ? t.max.byteCount : null };
    }),
    // IA (neurônios: o grátis tem 10 mil por dia)
    tenta("ia", async () => {
      const v = await gql(`query($a: string!, $de: Date, $ate: Date) { viewer { accounts(filter: { accountTag: $a }) {
        aiInferenceAdaptiveGroups(filter: { date_geq: $de, date_leq: $ate }, limit: 1000, orderBy: [date_ASC]) { sum { totalNeurons } count dimensions { date } }
      } } }`, { a: conta, de, ate });
      const porDia = Object.fromEntries(dias.map(d => [d, { dia: d, neuronios: 0, pedidos: 0 }]));
      for (const x of (v.accounts[0] || {}).aiInferenceAdaptiveGroups || []) if (porDia[x.dimensions.date]) { porDia[x.dimensions.date].neuronios += x.sum.totalNeurons || 0; porDia[x.dimensions.date].pedidos += x.count || 0; }
      return Object.values(porDia);
    }),
    // visitas do domínio (avina.com.br e o que passar pela Cloudflare)
    tenta("zona", async () => {
      const nome = env.CF_ZONA || "avina.com.br";
      const z = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(nome)}`, { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } }).then(r => r.json());
      const id = z && z.result && z.result[0] && z.result[0].id;
      if (!id) throw new Error("O token não enxerga a zona " + nome + " (falta a permissão Zone → Zone → Read?)");
      const v = await gql(`query($z: string!, $de: Date, $ate: Date) { viewer { zones(filter: { zoneTag: $z }) {
        httpRequests1dGroups(limit: 7, filter: { date_geq: $de, date_leq: $ate }, orderBy: [date_ASC]) { sum { requests cachedRequests bytes pageViews threats } uniq { uniques } dimensions { date } }
      } } }`, { z: id, de, ate });
      return { nome, dias: ((v.zones[0] || {}).httpRequests1dGroups || []).map(x => ({ dia: x.dimensions.date, ...x.sum, visitantes: x.uniq.uniques })) };
    }),
  ]);
  return out;
}

// Cidade aproximada e operadora de quem pede (a Cloudflare descobre pelo IP). O app manda junto no registro de acesso.
export const onde = req => {
  const cf = req.cf || {};
  return { cidade: cf.city || null, regiao: cf.region || null, pais: cf.country || null, rede: cf.asOrganization || null };
};
