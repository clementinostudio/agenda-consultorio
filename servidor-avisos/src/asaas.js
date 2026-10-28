/*
  Assinatura do Avina pelo Asaas
  ------------------------------
  A chave do Asaas fica só aqui (segredo ASAAS_KEY). O app nunca vê a chave.
  Quem está pedindo é conferido pelo login do Supabase (o mesmo do app).

  - /assinatura/ver       como está a assinatura (lida na hora no Asaas: não depende do webhook)
  - /assinatura/assinar   cria o cliente e a assinatura; devolve o Pix (QR) ou o link da página de pagamento (cartão)
  - /assinatura/pix       o Pix da cobrança que falta pagar
  - /assinatura/cancelar  cancela; nos 7 dias depois do primeiro pagamento, devolve o dinheiro (garantia)
  - /assinatura/pausar    empurra a próxima cobrança alguns meses
  - /assinatura/voltar    volta da pausa, ou desfaz o cancelamento antes de acabar o período pago
  - /assinatura/trocar    troca de plano a partir da próxima cobrança
  - /asaas/webhook        avisos do Asaas (pagamento recebido, estorno...): só confere o token e guarda

  O cartão é digitado na página do próprio Asaas (link da fatura): o número nunca passa pelo app nem por aqui.
  No KV fica só o mínimo: assin:<id do usuário> -> { cliente, assinatura, plano, forma, desde, ate, pausaAte, historico }
  e sub:<id da assinatura> -> id do usuário (para o webhook achar de quem é).
*/

const PLANOS = {
  mensal: { nome: "Mensal", valor: 29.9, ciclo: "MONTHLY", meses: 1 },
  anual: { nome: "Anual", valor: 299, ciclo: "YEARLY", meses: 12 },
};
const GARANTIA_DIAS = 7;
const PAGOS = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const ABERTOS = ["PENDING", "OVERDUE"];

// Datas no horário de Brasília (o Asaas trabalha com dia, sem hora)
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const addMeses = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1 + n, d)); return x.toISOString().slice(0, 10); };
const addDias = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const soNumeros = s => String(s || "").replace(/\D/g, "");

function cpfValido(c) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

async function asaas(env, metodo, caminho, corpo) {
  const r = await fetch(`${env.ASAAS_URL || "https://api-sandbox.asaas.com/v3"}${caminho}`, {
    method: metodo,
    headers: { access_token: env.ASAAS_KEY, "Content-Type": "application/json", "User-Agent": "Avina" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((j.errors && j.errors[0] && j.errors[0].description) || `O Asaas respondeu ${r.status}`);
    e.status = r.status; throw e;
  }
  return j;
}

// Quem está pedindo: confere o login no Supabase. MODO_TESTE (só no computador, .dev.vars) aceita um id direto.
async function quem(req, env) {
  if (env.MODO_TESTE === "1" && req.headers.get("X-Teste-Uid")) return { id: req.headers.get("X-Teste-Uid").slice(0, 80), email: "teste@avina.app" };
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? { id: u.id, email: u.email || "" } : null;
}

const lerReg = async (env, uid) => (await env.AVISOS.get(`assin:${uid}`, "json")) || {};
const gravarReg = (env, uid, reg) => env.AVISOS.put(`assin:${uid}`, JSON.stringify(reg));

const formaDe = t => t === "PIX" ? "pix" : t === "CREDIT_CARD" ? "cartao" : "pix";
const itemHistorico = (p, plano) => ({ id: p.id, data: p.paymentDate || p.clientPaymentDate || p.confirmedDate || p.dueDate, valor: p.value, plano, forma: formaDe(p.billingType), devolvido: p.status === "REFUNDED" || undefined });

// Como está a assinatura agora, no formato que o app usa
async function estado(env, uid) {
  const reg = await lerReg(env, uid), hoje = hojeBR();
  const base = { real: true, plano: reg.plano || null, forma: reg.forma || null, desde: reg.desde || null, historico: reg.historico || [] };
  if (!reg.assinatura) {
    if (reg.ate && hoje < reg.ate) return { ...base, status: "cancelada", ate: reg.ate, proxima: reg.ate };
    return { ...base, status: reg.ate ? "acabou" : "sem", ate: reg.ate || null };
  }
  const [sub, lista] = await Promise.all([
    asaas(env, "GET", `/subscriptions/${reg.assinatura}`),
    asaas(env, "GET", `/subscriptions/${reg.assinatura}/payments?limit=50`),
  ]);
  const pags = (lista.data || []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const pagos = pags.filter(p => PAGOS.includes(p.status) || p.status === "REFUNDED");
  const aberto = pags.find(p => ABERTOS.includes(p.status));
  // pagamentos desta assinatura + os de assinaturas anteriores (guardados quando ela foi cancelada)
  const atuais = pagos.map(p => itemHistorico(p, reg.plano)).reverse();
  const historico = [...atuais, ...(reg.historico || []).filter(h => !atuais.some(x => x.id === h.id))];
  const recebidos = pagos.filter(p => p.status !== "REFUNDED");
  // garantia de 7 dias: o primeiro pagamento desta assinatura, feito há até 7 dias e não devolvido
  const prim = atuais.length === 1 && !atuais[0].devolvido && diasEntre(atuais[0].data, hoje) <= GARANTIA_DIAS ? atuais[0] : null;
  const r = {
    ...base, historico, garantia: prim ? { id: prim.id, valor: prim.valor, ate: addDias(prim.data, GARANTIA_DIAS) } : null,
    forma: formaDe(sub.billingType),
    proxima: aberto ? aberto.dueDate : sub.nextDueDate,
    pendente: aberto ? { id: aberto.id, valor: aberto.value, vencimento: aberto.dueDate, link: aberto.invoiceUrl, atrasada: aberto.status === "OVERDUE", forma: formaDe(aberto.billingType) } : null,
  };
  // primeira cobrança ainda não paga: falta pagar para começar
  if (!recebidos.length && aberto) return { ...r, status: "aguardando" };
  if (reg.pausaAte && hoje < reg.pausaAte) return { ...r, status: "pausada", ate: reg.pausaAte };
  return { ...r, status: "ativa" };
}

async function pixDe(env, pagamentoId) {
  const q = await asaas(env, "GET", `/payments/${pagamentoId}/pixQrCode`);
  return { imagem: q.encodedImage, copiaecola: q.payload, expira: q.expirationDate };
}

export async function rotaAsaas(req, env, url, json, permitida) {
  // Webhook: o Asaas manda o token que combinamos; sem ele, ignora
  if (url.pathname === "/asaas/webhook") {
    if (!env.ASAAS_WEBHOOK_TOKEN || req.headers.get("asaas-access-token") !== env.ASAAS_WEBHOOK_TOKEN) return json({ erro: "Token inválido" }, 401);
    const ev = await req.json().catch(() => null);
    if (!ev || !ev.id) return json({ ok: true });
    if (await env.AVISOS.get(`ev:${ev.id}`)) return json({ ok: true, repetido: true }); // o mesmo aviso pode chegar mais de uma vez
    await env.AVISOS.put(`ev:${ev.id}`, "1", { expirationTtl: 15 * 86400 });
    const subId = (ev.payment && ev.payment.subscription) || (ev.subscription && ev.subscription.id);
    const uid = subId && await env.AVISOS.get(`sub:${subId}`);
    if (uid) { const reg = await lerReg(env, uid); reg.ultimoEvento = { tipo: ev.event, em: ev.dateCreated || hojeBR() }; await gravarReg(env, uid, reg); }
    return json({ ok: true });
  }

  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
  if (!permitida) return json({ erro: "Origem não permitida" }, 403);
  if (!env.ASAAS_KEY) return json({ configurado: false });
  const eu = await quem(req, env);
  if (!eu) return json({ erro: "Entre na sua conta para assinar" }, 401);
  // Enquanto testa (sandbox), só os e-mails em ASAAS_TESTADORES veem a assinatura de verdade; o resto segue na demonstração
  const testadores = String(env.ASAAS_TESTADORES || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (testadores.length && !testadores.includes(String(eu.email).toLowerCase())) return json({ configurado: false });
  let b = {}; try { b = await req.json(); } catch (e) {}
  const reg = await lerReg(env, eu.id), hoje = hojeBR();

  try {
    if (url.pathname === "/assinatura/ver") return json({ ok: true, configurado: true, sandbox: !env.ASAAS_URL || /sandbox/.test(env.ASAAS_URL), estado: await estado(env, eu.id) });

    if (url.pathname === "/assinatura/assinar") {
      const P = PLANOS[b.plano], forma = b.forma === "cartao" ? "cartao" : "pix", cpf = soNumeros(b.cpf), nome = String(b.nome || "").trim().slice(0, 100);
      if (!P) return json({ erro: "Plano inválido" }, 400);
      if (!cpfValido(cpf)) return json({ erro: "Confira o CPF: ele não parece certo" }, 400);
      if (nome.length < 3) return json({ erro: "Escreva seu nome completo" }, 400);
      if (reg.assinatura) return json({ erro: "Você já tem uma assinatura" }, 409);
      if (!reg.cliente) {
        const c = await asaas(env, "POST", "/customers", { name: nome, cpfCnpj: cpf, email: eu.email || undefined, externalReference: eu.id });
        reg.cliente = c.id;
      } else await asaas(env, "PUT", `/customers/${reg.cliente}`, { name: nome, cpfCnpj: cpf });
      const sub = await asaas(env, "POST", "/subscriptions", {
        customer: reg.cliente, billingType: forma === "cartao" ? "CREDIT_CARD" : "PIX", value: P.valor, cycle: P.ciclo,
        nextDueDate: hoje, description: `Avina · plano ${P.nome.toLowerCase()}`, externalReference: eu.id,
      });
      Object.assign(reg, { assinatura: sub.id, plano: b.plano, forma, desde: reg.desde || hoje, ate: null, pausaAte: null });
      await gravarReg(env, eu.id, reg);
      await env.AVISOS.put(`sub:${sub.id}`, eu.id);
      const st = await estado(env, eu.id);
      const pix = forma === "pix" && st.pendente ? await pixDe(env, st.pendente.id).catch(() => null) : null;
      return json({ ok: true, estado: st, pix });
    }

    if (!reg.assinatura && url.pathname !== "/assinatura/voltar") return json({ erro: "Você não tem assinatura ativa" }, 409);

    if (url.pathname === "/assinatura/pix") {
      const st = await estado(env, eu.id);
      if (!st.pendente) return json({ erro: "Não há nada para pagar agora" }, 409);
      return json({ ok: true, estado: st, pix: await pixDe(env, st.pendente.id) });
    }

    if (url.pathname === "/assinatura/cancelar") {
      const st = await estado(env, eu.id);
      // garantia: devolve o primeiro pagamento e acaba hoje
      const garantia = st.garantia;
      let devolvido = 0;
      if (garantia) { await asaas(env, "POST", `/payments/${garantia.id}/refund`, { description: "Garantia de 7 dias" }); devolvido = garantia.valor; }
      await asaas(env, "DELETE", `/subscriptions/${reg.assinatura}`);
      const historico = garantia ? st.historico.map(h => h.id === garantia.id ? { ...h, devolvido: true } : h) : st.historico;
      // nunca pagou esta assinatura: volta a "sem plano"; pagou: usa até o fim do período pago
      const pagouEsta = st.status !== "aguardando";
      const ate = garantia ? hoje : pagouEsta ? st.proxima : null;
      Object.assign(reg, { assinatura: null, ate, pausaAte: null, historico, motivo: String(b.motivo || "").slice(0, 60) || null });
      await gravarReg(env, eu.id, reg);
      return json({ ok: true, devolvido, estado: await estado(env, eu.id) });
    }

    if (url.pathname === "/assinatura/pausar") {
      const meses = Math.min(3, Math.max(1, Number(b.meses) || 1));
      const st = await estado(env, eu.id);
      if (st.status !== "ativa") return json({ erro: "Só dá para pausar uma assinatura em dia" }, 409);
      // cobrança já gerada para o próximo vencimento sai; a próxima passa a vencer depois da pausa
      if (st.pendente) await asaas(env, "DELETE", `/payments/${st.pendente.id}`);
      await asaas(env, "PUT", `/subscriptions/${reg.assinatura}`, { nextDueDate: addMeses(st.proxima, meses) });
      reg.pausaAte = addMeses(hoje, meses);
      await gravarReg(env, eu.id, reg);
      return json({ ok: true, estado: await estado(env, eu.id) });
    }

    if (url.pathname === "/assinatura/voltar") {
      if (reg.assinatura) { reg.pausaAte = null; await gravarReg(env, eu.id, reg); return json({ ok: true, estado: await estado(env, eu.id) }); }
      // desfazer o cancelamento: assinatura nova que só cobra quando o período pago acabar
      if (!reg.ate || hoje >= reg.ate || !reg.cliente || !PLANOS[reg.plano]) return json({ erro: "Assine de novo pelos planos" }, 409);
      const P = PLANOS[reg.plano];
      const sub = await asaas(env, "POST", "/subscriptions", { customer: reg.cliente, billingType: reg.forma === "cartao" ? "CREDIT_CARD" : "PIX", value: P.valor, cycle: P.ciclo, nextDueDate: reg.ate, description: `Avina · plano ${P.nome.toLowerCase()}`, externalReference: eu.id });
      Object.assign(reg, { assinatura: sub.id, ate: null, motivo: null });
      await gravarReg(env, eu.id, reg);
      await env.AVISOS.put(`sub:${sub.id}`, eu.id);
      return json({ ok: true, estado: await estado(env, eu.id) });
    }

    if (url.pathname === "/assinatura/trocar") {
      const P = PLANOS[b.plano];
      if (!P || b.plano === reg.plano) return json({ erro: "Plano inválido" }, 400);
      // vale a partir da próxima cobrança: a que já está aberta continua como está
      await asaas(env, "PUT", `/subscriptions/${reg.assinatura}`, { value: P.valor, cycle: P.ciclo, updatePendingPayments: false });
      reg.plano = b.plano;
      await gravarReg(env, eu.id, reg);
      return json({ ok: true, estado: await estado(env, eu.id) });
    }

    if (url.pathname === "/assinatura/forma") {
      const forma = b.forma === "cartao" ? "cartao" : "pix";
      await asaas(env, "PUT", `/subscriptions/${reg.assinatura}`, { billingType: forma === "cartao" ? "CREDIT_CARD" : "PIX", updatePendingPayments: true });
      reg.forma = forma;
      await gravarReg(env, eu.id, reg);
      return json({ ok: true, estado: await estado(env, eu.id) });
    }

    return json({ erro: "Caminho desconhecido" }, 404);
  } catch (e) {
    return json({ erro: String((e && e.message) || e).slice(0, 200) }, e && e.status >= 400 && e.status < 500 ? 400 : 502);
  }
}
