/*
  Link de agendamento do Avina
  ----------------------------
  O paciente abre app.avina.com.br/agendar/?<endereço> (sem login), escolhe um horário livre e pede.
  O profissional recebe o pedido no app e aceita ou recusa: nada entra na agenda sozinho.

  - /link/publicar  (login) o app manda os horários livres; devolve o endereço do link
  - /link/ver       (aberto) o que o paciente vê: nome, profissão e horários livres
  - /link/pedir     (aberto) o paciente pede um horário
  - /link/pedidos   (login) o app busca os pedidos que chegaram ({ recebi: [ids] } apaga os que já guardou)
  - /link/apagar    (login) tira o link do ar e apaga os pedidos (ao excluir a conta)

  No KV fica só o necessário:
  link:<endereço>  -> { uid, nome, profissao, duracao, termo, ativo, quem, antecedencia, dias: [{ d, h: [minutos] }], pids, push }
  linkde:<usuário> -> endereço
  pedidos:<usuário> -> [{ id, pid, nome, fone, data, hora, criado }]  (sai daqui assim que o app guarda)
  O nome e o WhatsApp de quem pede só ficam aqui até o app buscar.
*/
import { quem } from "./asaas.js";

const MAX_PEDIDOS = 30;   // pedidos esperando o app buscar
const MAX_POR_DIA = 6;    // pedidos por dia de um mesmo endereço de internet
const PEDIDOS_DURAM = 30 * 86400; // pedido que o app nunca buscou some sozinho em 30 dias
const limpar = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const soDigitos = s => String(s || "").replace(/\D/g, "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// endereço do link a partir do nome: "Ana Souza" -> "ana-souza"
const enderecoDe = nome => String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "agenda";

// horário de Brasília: o app manda os minutos do dia no horário local
const instante = (iso, min) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) + min * 60e3 + 3 * 3600e3; };
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// os horários que valem agora: respeita a antecedência e tira os que já foram pedidos
function livresAgora(link, pedidos) {
  const limite = Date.now() + (Number(link.antecedencia) || 0) * 36e5;
  const pedidosJa = new Set((pedidos || []).map(p => `${p.data} ${p.hora}`));
  return (link.dias || [])
    .map(x => ({ d: x.d, h: x.h.filter(m => instante(x.d, m) >= limite && !pedidosJa.has(`${x.d} ${hhmm(m)}`)) }))
    .filter(x => x.h.length);
}

export async function rotaLink(req, env, url, json, ctx, avisar) {
  const rota = url.pathname.slice("/link/".length);
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  // ---------- aberto: o que o paciente vê ----------
  if (rota === "ver") {
    const end = enderecoDe(url.searchParams.get("c"));
    const link = await env.AVISOS.get(`link:${end}`, "json");
    if (!link) return json({ erro: "Não achamos esta agenda. Confira o link com quem mandou." }, 404);
    const pid = limpar(url.searchParams.get("p"), 40);
    const pedidos = (await env.AVISOS.get(`pedidos:${link.uid}`, "json")) || [];
    const conhecido = !!pid && (link.pids || []).includes(pid);
    return json({
      nome: link.nome, profissao: link.profissao, duracao: link.duracao, termo: link.termo,
      // "só remarcar": quem não é paciente vê a agenda fechada
      aberto: !!link.ativo && (link.quem !== "pacientes" || conhecido),
      remarcar: conhecido,
      dias: link.ativo ? livresAgora(link, pedidos) : [],
    });
  }

  if (rota === "pedir") {
    if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
    const end = enderecoDe(b.c);
    const link = await env.AVISOS.get(`link:${end}`, "json");
    if (!link || !link.ativo) return json({ erro: "Esta agenda não está recebendo pedidos agora." }, 404);
    const pid = limpar(b.p, 40), conhecido = !!pid && (link.pids || []).includes(pid);
    if (link.quem === "pacientes" && !conhecido) return json({ erro: "Esta agenda só aceita remarcações." }, 403);
    const nome = limpar(b.nome, 60), fone = soDigitos(b.fone).slice(0, 13);
    if (!conhecido && (nome.length < 2 || fone.length < 10)) return json({ erro: "Coloque seu nome e o WhatsApp com DDD." }, 400);
    const data = String(b.data || ""), hora = String(b.hora || "");
    if (!ISO.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return json({ erro: "Escolha um horário." }, 400);

    // um mesmo endereço de internet não manda pedidos sem fim
    const ip = req.headers.get("CF-Connecting-IP") || "local";
    const kLim = `pedlim:${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)}:${ip}`;
    const n = Number(await env.AVISOS.get(kLim)) || 0;
    if (n >= MAX_POR_DIA) return json({ erro: "Muitos pedidos hoje. Fale direto pelo WhatsApp." }, 429);

    const pedidos = (await env.AVISOS.get(`pedidos:${link.uid}`, "json")) || [];
    const [hh, mm] = hora.split(":").map(Number), min = hh * 60 + mm;
    const livre = livresAgora(link, pedidos).some(x => x.d === data && x.h.includes(min));
    if (!livre) return json({ erro: "Esse horário acabou de sair. Escolha outro.", ocupado: true }, 409);
    if (pedidos.length >= MAX_PEDIDOS) return json({ erro: "A agenda está com muitos pedidos esperando. Fale direto pelo WhatsApp." }, 429);

    const pedido = { id: crypto.randomUUID().slice(0, 12), pid: conhecido ? pid : null, nome: conhecido ? "" : nome, fone: conhecido ? "" : fone, data, hora, criado: Date.now() };
    await env.AVISOS.put(`pedidos:${link.uid}`, JSON.stringify([...pedidos, pedido]), { expirationTtl: PEDIDOS_DURAM });
    await env.AVISOS.put(kLim, String(n + 1), { expirationTtl: 2 * 86400 });
    // avisa no celular do profissional (quando os avisos estão ligados lá)
    if (link.push) {
      const [y, m, d] = data.split("-");
      ctx.waitUntil(avisar(link.push, { titulo: "Pedido de horário", corpo: `${conhecido ? "Um paciente quer remarcar" : `${nome.split(" ")[0]} pediu um horário`}: ${d}/${m} às ${hora}. Abra o Avina para responder.`, tag: "pedido-horario" }).catch(() => {}));
    }
    return json({ ok: true });
  }

  // ---------- com login: o dono do link ----------
  const eu = await quem(req, env);
  if (!eu) return json({ erro: "Entre de novo na sua conta para continuar" }, 401);

  if (rota === "publicar") {
    let end = await env.AVISOS.get(`linkde:${eu.id}`);
    if (!end) {
      // primeiro link: o endereço vem do nome; se já for de outra pessoa, ganha um número no fim
      const base = enderecoDe(b.nome);
      for (let i = 1; i <= 30 && !end; i++) {
        const tenta = i === 1 ? base : `${base}-${i}`;
        const dono = await env.AVISOS.get(`link:${tenta}`, "json");
        if (!dono || dono.uid === eu.id) end = tenta;
      }
      if (!end) end = `${base}-${crypto.randomUUID().slice(0, 6)}`;
      await env.AVISOS.put(`linkde:${eu.id}`, end);
    }
    const dias = (Array.isArray(b.dias) ? b.dias : []).slice(0, 35)
      .filter(x => x && ISO.test(x.d) && Array.isArray(x.h))
      .map(x => ({ d: x.d, h: x.h.map(Number).filter(m => Number.isInteger(m) && m >= 0 && m < 1440).slice(0, 48) }));
    const link = {
      uid: eu.id, nome: limpar(b.nome, 60) || "Agenda", profissao: limpar(b.profissao, 40), duracao: Math.min(240, Math.max(10, Number(b.duracao) || 50)),
      termo: limpar(b.termo, 20) || "Paciente", ativo: !!b.ativo, quem: b.quem === "pacientes" ? "pacientes" : "todos",
      antecedencia: Math.min(168, Math.max(0, Number(b.antecedencia) || 0)), dias,
      pids: (Array.isArray(b.pids) ? b.pids : []).map(x => limpar(x, 40)).filter(Boolean).slice(0, 500),
      push: limpar(b.push, 64) || null, em: Date.now(),
    };
    await env.AVISOS.put(`link:${end}`, JSON.stringify(link));
    return json({ ok: true, endereco: end });
  }

  if (rota === "pedidos") {
    const k = `pedidos:${eu.id}`;
    let pedidos = (await env.AVISOS.get(k, "json")) || [];
    const recebi = new Set(Array.isArray(b.recebi) ? b.recebi : []);
    if (recebi.size && pedidos.some(p => recebi.has(p.id))) {
      pedidos = pedidos.filter(p => !recebi.has(p.id));
      await (pedidos.length ? env.AVISOS.put(k, JSON.stringify(pedidos), { expirationTtl: PEDIDOS_DURAM }) : env.AVISOS.delete(k));
    }
    return json({ pedidos });
  }

  if (rota === "apagar") {
    const end = await env.AVISOS.get(`linkde:${eu.id}`);
    if (end) await env.AVISOS.delete(`link:${end}`);
    await Promise.all([env.AVISOS.delete(`linkde:${eu.id}`), env.AVISOS.delete(`pedidos:${eu.id}`)]);
    return json({ ok: true });
  }

  return json({ erro: "Caminho desconhecido" }, 404);
}
