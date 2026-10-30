/*
  Conectar o banco (Open Finance pela Pluggy)
  -------------------------------------------
  A pessoa autoriza no próprio banco (pelo Open Finance) e a Pluggy entrega os lançamentos.
  A chave da Pluggy fica só aqui no servidor (segredos PLUGGY_ID e PLUGGY_SECRET, ligar-banco.sh):
  o app nunca vê. Cada conexão (o "item" da Pluggy) nasce marcada com o id da conta do Avina,
  e este servidor confere isso antes de ler qualquer coisa.

  - /banco/estado       { ligado, teste, bancos: [{ id, nome, status, atualizado }] }
  - /banco/token        token de uso único para abrir a janela da Pluggy no app: { itemId? } para reconectar
  - /banco/guardar      { itemId } depois que a pessoa conectou
  - /banco/resumo       saldos de agora: { contas: [conta ou cartão com fatura e limite], investimentos }
  - /banco/lancamentos  { dias } os lançamentos dos últimos dias (até 365), de todos os bancos conectados
  - /banco/desligar     { itemId } apaga a conexão na Pluggy

  Quem pode usar: BANCO_ABERTO = "admin" (só quem é admin, para testar) ou "todos".
  Aqui só fica guardado quais conexões são de quem (KV banco:<uid>). Os lançamentos passam direto para o app.
*/
import { quem } from "./asaas.js";

const API = "https://api.pluggy.ai";
const ITEM = /^[0-9a-f-]{36}$/i;

// A chave da API vale 2 horas: fica na memória do servidor enquanto ele estiver de pé
let chave = null, chaveAte = 0;
async function apiKey(env) {
  if (chave && Date.now() < chaveAte) return chave;
  const r = await fetch(`${API}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: env.PLUGGY_ID, clientSecret: env.PLUGGY_SECRET }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.apiKey) throw new Error("A Pluggy não aceitou a chave. Rode o ligar-banco.sh de novo.");
  chave = j.apiKey; chaveAte = Date.now() + 100 * 60e3;
  return chave;
}
async function pluggy(env, metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: { "X-API-KEY": await apiKey(env), "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || `A Pluggy respondeu ${r.status}`); e.status = r.status; throw e; }
  return j;
}

// Só admin enquanto BANCO_ABERTO não for "todos" (o banco confere com o login da própria pessoa)
async function podeUsar(req, env) {
  if (String(env.BANCO_ABERTO || "admin") === "todos") return true;
  if (env.MODO_TESTE === "1" && req.headers.get("X-Teste-Uid")) return true;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/sou_admin`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
  const s = r && r.ok ? await r.json().catch(() => null) : null;
  return !!(s && s.admin);
}

const lerLista = async (env, uid) => { try { return JSON.parse((await env.AVISOS.get(`banco:${uid}`)) || "[]"); } catch (e) { return []; } };
const gravarLista = (env, uid, lista) => lista.length ? env.AVISOS.put(`banco:${uid}`, JSON.stringify(lista)) : env.AVISOS.delete(`banco:${uid}`);

// O item da Pluggy, só se for desta conta
async function itemDe(env, uid, itemId) {
  if (!ITEM.test(String(itemId || ""))) return null;
  const it = await pluggy(env, "GET", `/items/${itemId}`).catch(e => { if (e.status === 404) return null; throw e; });
  return it && it.clientUserId === uid ? it : null;
}
const resumo = it => ({ id: it.id, nome: (it.connector && it.connector.name) || "Banco", status: it.status, atualizado: it.lastUpdatedAt || null, erro: (it.error && it.error.message) || null });

// "2026-10-25T03:00:00.000Z" -> "2026-10-25" (no horário de Brasília)
const dia = d => new Date(new Date(d).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

// Todos os lançamentos de uma conta desde o dia, seguindo as páginas (no máximo 8 páginas de 500)
async function lancamentosDa(env, contaId, desde) {
  const todos = []; let depois = null;
  for (let p = 0; p < 8; p++) {
    const q = new URLSearchParams({ accountId: contaId, dateFrom: desde }); if (depois) q.set("after", depois);
    const r = await pluggy(env, "GET", `/v2/transactions?${q}`);
    todos.push(...(r.results || []));
    depois = r.next ? new URL(r.next, API).searchParams.get("after") : null;
    if (!depois) break;
  }
  return todos;
}

export async function rotaBanco(req, env, url, json, permitida) {
  if (!permitida) return json({ erro: "Origem não permitida" }, 403);
  if (!env.PLUGGY_ID || !env.PLUGGY_SECRET) return json({ ligado: false, bancos: [] });
  const eu = await quem(req, env); if (!eu) return json({ erro: "Entre na sua conta" }, 401);
  if (!(await podeUsar(req, env))) return json({ ligado: false, bancos: [] });
  const b = await req.json().catch(() => ({}));
  const rota = url.pathname.slice("/banco/".length);

  try {
    if (rota === "estado") {
      const lista = await lerLista(env, eu.id);
      // null = apagada na Pluggy (sai da lista); undefined = a Pluggy não respondeu agora (fica)
      const itens = await Promise.all(lista.map(x => itemDe(env, eu.id, x.id).catch(() => undefined)));
      if (itens.some(x => x === null)) await gravarLista(env, eu.id, lista.filter((x, i) => itens[i] !== null));
      // teste = ainda só para admin: a janela mostra também o banco de mentira da Pluggy (Pluggy Bank)
      return json({ ligado: true, teste: String(env.BANCO_ABERTO || "admin") !== "todos", bancos: itens.filter(Boolean).map(resumo) });
    }

    if (rota === "token") {
      const corpo = { options: { clientUserId: eu.id, avoidDuplicates: true } };
      if (b.itemId) { if (!(await itemDe(env, eu.id, b.itemId))) return json({ erro: "Conexão não encontrada" }, 404); corpo.itemId = b.itemId; }
      const r = await pluggy(env, "POST", "/connect_token", corpo);
      return json({ token: r.accessToken });
    }

    if (rota === "guardar") {
      const it = await itemDe(env, eu.id, b.itemId);
      if (!it) return json({ erro: "Conexão não encontrada" }, 404);
      const lista = (await lerLista(env, eu.id)).filter(x => x.id !== it.id);
      if (lista.length >= 10) return json({ erro: "Já são 10 bancos conectados. Desligue um antes." }, 400);
      lista.push({ id: it.id, em: new Date().toISOString().slice(0, 10) });
      await gravarLista(env, eu.id, lista);
      return json({ ok: true, banco: resumo(it) });
    }

    if (rota === "desligar") {
      const lista = await lerLista(env, eu.id);
      if (!lista.some(x => x.id === b.itemId)) return json({ erro: "Conexão não encontrada" }, 404);
      if (await itemDe(env, eu.id, b.itemId)) await pluggy(env, "DELETE", `/items/${b.itemId}`).catch(e => { if (e.status !== 404) throw e; });
      await gravarLista(env, eu.id, lista.filter(x => x.id !== b.itemId));
      return json({ ok: true });
    }

    // Saldos de agora: contas, cartões (fatura aberta, vencimento, limite livre) e investimentos
    if (rota === "resumo") {
      const lista = (await lerLista(env, eu.id)).slice(0, 8);
      const contas = [], investimentos = [], bancos = [];
      await Promise.all(lista.map(async x => {
        const it = await itemDe(env, eu.id, x.id).catch(() => null);
        if (!it) return;
        const nome = resumo(it).nome; bancos.push(resumo(it));
        const [cs, inv] = await Promise.all([
          pluggy(env, "GET", `/accounts?itemId=${it.id}`).then(r => r.results || []).catch(() => []),
          pluggy(env, "GET", `/investments?itemId=${it.id}`).then(r => r.results || []).catch(() => []),
        ]);
        for (const c of cs) {
          const cd = c.creditData || {}, bd = c.bankData || {}, cartao = c.type === "CREDIT";
          contas.push({
            id: c.id, itemId: it.id, banco: nome, nome: c.marketingName || c.name || (cartao ? "Cartão" : "Conta"), final: String(c.number || "").slice(-4),
            tipo: cartao ? "cartao" : "conta", saldo: Math.round((Number(c.balance) || 0) * 100) / 100,
            ...(cartao ? { limite: cd.creditLimit ?? null, livre: cd.availableCreditLimit ?? null, vence: cd.balanceDueDate ? dia(cd.balanceDueDate) : null, fecha: cd.balanceCloseDate ? dia(cd.balanceCloseDate) : null, minimo: cd.minimumPayment ?? null }
              : { especial: bd.overdraftContractedLimit ?? null, especialUsado: bd.overdraftUsedLimit ?? null, aplicadoAuto: bd.automaticallyInvestedBalance ?? null }),
          });
        }
        for (const i of inv) {
          if (i.status === "TOTAL_WITHDRAWAL" || !(Number(i.balance) > 0)) continue;
          const aplicado = Number(i.amountOriginal ?? i.amount) || null;
          investimentos.push({
            id: i.id, itemId: it.id, banco: (i.institution && i.institution.name) || nome, nome: i.name || "Investimento", tipo: i.type, subtipo: i.subtype || null,
            saldo: Math.round(Number(i.balance) * 100) / 100, aplicado: aplicado && Math.round(aplicado * 100) / 100,
            rendeu: i.amountProfit != null ? Math.round(Number(i.amountProfit) * 100) / 100 : null, vence: i.dueDate ? dia(i.dueDate) : null,
          });
        }
      }));
      return json({ ligado: true, bancos, contas, investimentos, em: new Date().toISOString() });
    }

    if (rota === "lancamentos") {
      const dias = Math.min(365, Math.max(1, Number(b.dias) || 90));
      const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
      const lista = await lerLista(env, eu.id);
      const itens = [], avisos = [];
      for (const x of lista) {
        const it = await itemDe(env, eu.id, x.id).catch(() => null);
        if (!it) continue;
        const nome = resumo(it).nome;
        if (it.status === "UPDATING") avisos.push(`${nome} ainda está mandando os dados. Tente de novo em um minuto.`);
        else if (it.status === "LOGIN_ERROR" || it.status === "OUTDATED") avisos.push(`${nome} pediu para autorizar de novo.`);
        const contas = (await pluggy(env, "GET", `/accounts?itemId=${it.id}`)).results || [];
        for (const c of contas) {
          const cartao = c.type === "CREDIT";
          for (const t of await lancamentosDa(env, c.id, desde)) {
            if (t.status === "PENDING") continue;
            const valor = Math.abs(Number(t.amountInAccountCurrency ?? t.amount) || 0);
            if (!valor) continue;
            const cc = t.creditCardMetadata, parc = cc && cc.totalInstallments > 1 ? ` (${cc.installmentNumber} de ${cc.totalInstallments})` : "";
            itens.push({
              id: t.id, data: dia(t.date), valor: Math.round(valor * 100) / 100, tipo: t.type === "CREDIT" ? "entrada" : "saida",
              desc: `${(t.merchant && (t.merchant.businessName || t.merchant.name)) || t.description || ""}${parc}`.trim(),
              bruto: `${t.descriptionRaw || ""} ${t.description || ""}`.trim(), cnpj: (t.merchant && t.merchant.cnpj) || "",
              banco: nome, conta: c.name || "", cartao,
            });
          }
        }
      }
      return json({ itens, avisos });
    }
  } catch (e) {
    return json({ erro: e.message || "A Pluggy não respondeu" }, 502);
  }
  return json({ erro: "Rota desconhecida" }, 404);
}

// Avisos da Pluggy (webhook cadastrado no painel dela): conexão criada, atualizada, com erro, lançamentos novos.
// Por enquanto só responde "recebi" (a Pluggy exige resposta em até 5 segundos); o app busca os lançamentos quando a pessoa pede.
export function rotaWebhookPluggy(req, json) {
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
  return json({ received: true });
}
