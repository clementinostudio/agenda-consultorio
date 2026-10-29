/*
  Painel do dono (app.avina.com.br/admin/)
  ----------------------------------------
  As contas, os acessos e os números do banco vêm direto do Supabase (funções admin_* do banco).
  Daqui sai só o que mora no KV deste servidor: as assinaturas, as cortesias, os aparelhos com aviso e o uso da IA.

  - /admin/assinaturas   resumo de todas as assinaturas (do que está guardado no KV, sem chamar o Asaas)
  - /admin/assinatura    uma conta, lida na hora no Asaas: { uid }

  Quem pede precisa ser admin E ter entrado com o código do app autenticador: quem confere é o próprio
  banco (função sou_admin), com o login de quem pediu.
*/
import { PLANOS, idPlano, estado } from "./asaas.js";

const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

async function ehAdmin(req, env) {
  if (env.MODO_TESTE === "1" && req.headers.get("X-Teste-Uid")) return req.headers.get("X-Teste-Admin") === "1";
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL) return false;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/sou_admin`, {
    method: "POST", headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}",
  });
  if (!r.ok) return false;
  const s = await r.json().catch(() => null);
  return !!(s && s.admin && s.verificado);
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

export async function rotaAdmin(req, env, url, json, extra) {
  if (!(await ehAdmin(req, env))) return json({ erro: "Só para o admin, com a verificação em 2 etapas." }, 403);

  if (url.pathname === "/admin/assinaturas") {
    const [kAssin, kPlano, kCort] = await Promise.all([chaves(env, "assin:"), chaves(env, "plano:"), chaves(env, "cort:")]);
    const contas = {};
    const de = uid => (contas[uid] = contas[uid] || {});
    await Promise.all([
      ...kAssin.map(async k => {
        const reg = (await env.AVISOS.get(k, "json")) || {};
        const pagos = (reg.historico || []).filter(h => !h.devolvido);
        Object.assign(de(k.slice(6)), {
          plano: reg.plano ? idPlano(reg.plano) : null, nomePlano: reg.plano ? (PLANOS[idPlano(reg.plano)] || {}).nome || reg.plano : null,
          forma: reg.forma || null, desde: reg.desde || null, ate: reg.ate || null, pausaAte: reg.pausaAte || null,
          assinando: !!reg.assinatura, mensal: reg.assinatura ? mensal(reg.plano) : 0, ambiente: reg.amb || null,
          pagamentos: pagos.length, totalPago: Math.round(pagos.reduce((s, h) => s + (Number(h.valor) || 0), 0) * 100) / 100,
          devolvidos: (reg.historico || []).filter(h => h.devolvido).length,
        });
      }),
      ...kPlano.map(async k => { de(k.slice(6)).nivel = await env.AVISOS.get(k); }),
      ...kCort.map(async k => { de(k.slice(5)).cortesiaAte = await env.AVISOS.get(k); }),
    ]);
    // uso da IA hoje: uma chave por pessoa e por grupo (voz e ia), com quantas vezes usou
    const hoje = hojeBR(), ia = {};
    for (const g of ["voz", "ia"]) {
      const ks = await chaves(env, `cota:${g}:${hoje}:`);
      const usos = await Promise.all(ks.map(k => env.AVISOS.get(k)));
      ia[g] = { pessoas: ks.length, usos: usos.reduce((s, v) => s + (Number(v) || 0), 0) };
    }
    return json({ contas, ia, aparelhosComAviso: await extra.aparelhos(), cobrancaInicio: env.COBRANCA_INICIO || null, asaasLigado: !!env.ASAAS_KEY });
  }

  if (url.pathname === "/admin/assinatura") {
    const b = await req.json().catch(() => ({}));
    const uid = String(b.uid || "").slice(0, 80);
    if (!/^[0-9a-f-]{36}$/i.test(uid)) return json({ erro: "Conta inválida" }, 400);
    if (!env.ASAAS_KEY) return json({ erro: "O Asaas não está ligado neste servidor." }, 400);
    try { return json(await estado(env, uid)); }
    catch (e) { return json({ erro: "O Asaas não respondeu: " + (e.message || e) }, 502); }
  }

  return json({ erro: "Não encontrado" }, 404);
}

// Cidade aproximada de quem pede (a Cloudflare descobre pelo IP). O app manda junto no registro de acesso.
export const onde = req => ({ cidade: (req.cf && req.cf.city) || null, regiao: (req.cf && req.cf.region) || null, pais: (req.cf && req.cf.country) || null });
