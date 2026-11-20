/*
  Link de agendamento do Avina
  ----------------------------
  O paciente abre app.avina.com.br/agendar/?<endereço> (sem login), escolhe um horário livre e pede.
  O profissional recebe o pedido no app e aceita ou recusa: nada entra na agenda sozinho.
  A mesma página também serve para o paciente confirmar a sessão (...&p=<id>&s=<AAAA-MM-DD>) e é o
  "link na bio" do profissional (foto, registro, abordagem, como atende, cidade e um texto curto).

  - /link/publicar   (login) o app manda os horários livres, as sessões marcadas dos próximos ~60 dias,
                     o perfil, o WhatsApp e o código do calendário; devolve o endereço do link
  - /link/ver        (aberto) o que o paciente vê: perfil, horários livres e, com &p=&s=, a sessão daquele dia
  - /link/pedir      (aberto) o paciente pede um horário
  - /link/confirmar  (aberto) o paciente responde "sim" (vai) ou "remarcar" para uma sessão marcada
  - /link/pedidos    (login) o app busca os pedidos e as respostas que chegaram ({ recebi: [ids] } apaga os que já guardou)
  - /link/agenda.ics (aberto, com ?c=<endereço>&k=<código>) as sessões marcadas num calendário que o
                     Google Agenda / Apple Calendário assinam (só com o código secreto que o app gerou)
  - /link/apagar     (login) tira o link do ar e apaga os pedidos e as respostas (ao excluir a conta)
  Confirmar a sessão e o calendário funcionam mesmo com o link de agendamento desligado.

  No KV fica só o necessário:
  link:<endereço>  -> { uid, nome, profissao, duracao, termo, ativo, quem, antecedencia, dias: [{ d, h: [minutos] }], pids, push,
                        sessoes: [{ p, d, h, o?, t? }], perfil: { foto?, registro?, abordagem?, modalidade?, bio?, cidade? } | null,
                        cal: código do calendário | null, zap: WhatsApp do profissional | null }
                      (sessoes: p = id do paciente, d = dia, h = "HH:MM", o = sala online, t = título no calendário;
                       nunca o nome do paciente)
  linkde:<usuário> -> endereço
  pedidos:<usuário> -> [{ id, pid, nome, fone, data, hora, criado }]  (sai daqui assim que o app guarda)
  respostas:<usuário> -> [{ id, pid, d, h, r, em }]  r = "sim" | "remarcar" (sai daqui assim que o app guarda)
  respondidas:<usuário> -> { "<pid> <dia>": r }  o que o paciente já respondeu, para a página mostrar de novo
                      depois que o app buscou (só o id e o dia; os dias que passaram saem sozinhos)
  pedlim / conflim:<dia>:<ip> -> contadores do dia contra abuso
  O nome e o WhatsApp de quem pede só ficam aqui até o app buscar.
*/
import { quem } from "./asaas.js";

const MAX_PEDIDOS = 30;   // pedidos esperando o app buscar
const MAX_POR_DIA = 6;    // pedidos por dia de um mesmo endereço de internet
const PEDIDOS_DURAM = 30 * 86400; // pedido que o app nunca buscou some sozinho em 30 dias
const MAX_RESPOSTAS = 200;    // confirmações esperando o app buscar
const MAX_CONFIRMA_DIA = 30;  // respostas por dia de um mesmo endereço de internet
const limpar = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
// texto com parágrafos (a bio): tira caracteres de controle e < >, mas mantém as quebras de linha
const limparTexto = (s, n) => String(s || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, " ")
  .split("\n").map(l => l.replace(/\s+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, n).trim();
const soDigitos = s => String(s || "").replace(/\D/g, "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const diaHoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const novoId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

// endereço do link a partir do nome: "Ana Souza" -> "ana-souza"
const enderecoDe = nome => String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "agenda";

// horário de Brasília: o app manda os minutos do dia no horário local
const instante = (iso, min) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) + min * 60e3 + 3 * 3600e3; };
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const minutos = h => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };

// os horários que valem agora: respeita a antecedência e tira os que já foram pedidos
function livresAgora(link, pedidos) {
  const limite = Date.now() + (Number(link.antecedencia) || 0) * 36e5;
  const pedidosJa = new Set((pedidos || []).map(p => `${p.data} ${p.hora}`));
  return (link.dias || [])
    .map(x => ({ d: x.d, h: x.h.filter(m => instante(x.d, m) >= limite && !pedidosJa.has(`${x.d} ${hhmm(m)}`)) }))
    .filter(x => x.h.length);
}

// paciente conhecido: está na lista de pacientes ou tem sessão marcada
const conhece = (link, pid) => !!pid && ((link.pids || []).includes(pid) || (link.sessoes || []).some(x => x.p === pid));
// a sessão daquele paciente naquele dia (se tiver duas, a primeira)
const sessaoDe = (link, pid, d) => (link.sessoes || []).filter(x => x.p === pid && x.d === d).sort((a, b) => a.h.localeCompare(b.h))[0] || null;

// sessões marcadas dos próximos ~60 dias (para confirmar e para o calendário): só o id do paciente, nunca o nome
function sessoesDe(v) {
  return (Array.isArray(v) ? v : []).slice(0, 1000)
    .filter(x => x && typeof x.d === "string" && ISO.test(x.d) && typeof x.h === "string" && HORA.test(x.h) && limpar(x.p, 40))
    .slice(0, 400)
    .map(x => {
      const s = { p: limpar(x.p, 40), d: x.d, h: x.h };
      const o = String(x.o || "").trim(), t = limpar(x.t, 40);
      if (o.length <= 300 && /^https:\/\/[^\s<>"'\\]+$/.test(o)) s.o = o;
      if (t) s.t = t;
      return s;
    })
    .sort((a, b) => (a.d + a.h).localeCompare(b.d + b.h));
}

// perfil do "link na bio": foto pequena (data URL), registro, abordagem, como atende, cidade e um texto curto
function perfilDe(v) {
  if (!v || typeof v !== "object") return null;
  const p = {};
  const foto = typeof v.foto === "string" ? v.foto : "";
  if (foto.length <= 160000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(foto)) p.foto = foto;
  const registro = limpar(v.registro, 40), abordagem = limpar(v.abordagem, 60), cidade = limpar(v.cidade, 60), bio = limparTexto(v.bio, 400);
  if (registro) p.registro = registro;
  if (abordagem) p.abordagem = abordagem;
  if (["presencial", "online", "ambos"].includes(v.modalidade)) p.modalidade = v.modalidade;
  if (bio) p.bio = bio;
  if (cidade) p.cidade = cidade;
  return Object.keys(p).length ? p : null;
}

// ---------- calendário (RFC 5545) ----------
const escIcs = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
const utc = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const octetos = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
// linhas com mais de 75 octetos continuam na de baixo, começando com um espaço (sem quebrar um acento no meio)
function dobrar(linha) {
  let out = "", n = 0;
  for (const ch of linha) {
    const t = octetos(ch);
    if (n + t > 75) { out += "\r\n "; n = 1; }
    out += ch; n += t;
  }
  return out;
}
function calendario(link) {
  const dur = (Number(link.duracao) || 50) * 60e3, carimbo = utc(link.em || Date.now()), uids = new Set();
  const l = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Avina//Agenda//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Avina · Consultório", "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const s of link.sessoes || []) {
    // o Brasil não tem horário de verão: 18:30 aqui é 21:30 em UTC
    const ini = instante(s.d, minutos(s.h));
    let uid = `${s.p}-${s.d}@avina.com.br`;
    if (uids.has(uid)) uid = `${s.p}-${s.d}-${s.h.replace(":", "")}@avina.com.br`;
    uids.add(uid);
    l.push("BEGIN:VEVENT", `UID:${escIcs(uid)}`, `DTSTAMP:${carimbo}`, `DTSTART:${utc(ini)}`, `DTEND:${utc(ini + dur)}`, `SUMMARY:${escIcs(s.t || "Sessão")}`);
    if (s.o) l.push(`LOCATION:${escIcs(s.o)}`, `URL:${s.o}`, `DESCRIPTION:${escIcs(`Entrar na sessão: ${s.o}`)}`);
    l.push("END:VEVENT");
  }
  l.push("END:VCALENDAR");
  return l.map(dobrar).join("\r\n") + "\r\n";
}

export async function rotaLink(req, env, url, json, ctx, avisar) {
  const rota = url.pathname.slice("/link/".length);
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  // ---------- aberto: o que o paciente vê ----------
  if (rota === "ver") {
    const end = enderecoDe(url.searchParams.get("c"));
    const link = await env.AVISOS.get(`link:${end}`, "json");
    if (!link) return json({ erro: "Não achamos esta agenda. Confira o link com quem mandou." }, 404);
    const pid = limpar(url.searchParams.get("p"), 40), dia = url.searchParams.get("s") || "";
    const pedidos = (await env.AVISOS.get(`pedidos:${link.uid}`, "json")) || [];
    const conhecido = conhece(link, pid);
    // ...&s=<dia>: a sessão marcada daquele dia, para o paciente confirmar (vale mesmo com o link desligado)
    let sessao = null;
    const ses = conhecido && ISO.test(dia) ? sessaoDe(link, pid, dia) : null;
    if (ses) {
      const respondidas = (await env.AVISOS.get(`respondidas:${link.uid}`, "json")) || {};
      sessao = { d: ses.d, h: ses.h, online: ses.o || null, resposta: respondidas[`${pid} ${dia}`] || null };
    }
    return json({
      nome: link.nome, profissao: link.profissao, duracao: link.duracao, termo: link.termo,
      perfil: link.perfil || null, zap: link.zap || null,
      // "só remarcar": quem não é paciente vê a agenda fechada
      aberto: !!link.ativo && (link.quem !== "pacientes" || conhecido),
      remarcar: conhecido,
      dias: link.ativo ? livresAgora(link, pedidos) : [],
      sessao,
    });
  }

  if (rota === "pedir") {
    if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
    const end = enderecoDe(b.c);
    const link = await env.AVISOS.get(`link:${end}`, "json");
    if (!link || !link.ativo) return json({ erro: "Esta agenda não está recebendo pedidos agora." }, 404);
    const pid = limpar(b.p, 40), conhecido = conhece(link, pid);
    if (link.quem === "pacientes" && !conhecido) return json({ erro: "Esta agenda só aceita remarcações." }, 403);
    const nome = limpar(b.nome, 60), fone = soDigitos(b.fone).slice(0, 13);
    if (!conhecido && (nome.length < 2 || fone.length < 10)) return json({ erro: "Coloque seu nome e o WhatsApp com DDD." }, 400);
    const data = String(b.data || ""), hora = String(b.hora || "");
    if (!ISO.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return json({ erro: "Escolha um horário." }, 400);

    // um mesmo endereço de internet não manda pedidos sem fim
    const ip = req.headers.get("CF-Connecting-IP") || "local";
    const kLim = `pedlim:${diaHoje()}:${ip}`;
    const n = Number(await env.AVISOS.get(kLim)) || 0;
    if (n >= MAX_POR_DIA) return json({ erro: "Muitos pedidos hoje. Fale direto pelo WhatsApp." }, 429);

    const pedidos = (await env.AVISOS.get(`pedidos:${link.uid}`, "json")) || [];
    const min = minutos(hora);
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

  // o paciente confirma a sessão ("sim") ou pede para remarcar; funciona mesmo com o link de agendamento desligado
  if (rota === "confirmar") {
    if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
    const link = await env.AVISOS.get(`link:${enderecoDe(b.c)}`, "json");
    if (!link) return json({ erro: "Não achamos esta agenda. Confira o link com quem mandou." }, 404);
    const pid = limpar(b.p, 40), dia = String(b.s || ""), r = b.r;
    if (!pid || !ISO.test(dia) || (r !== "sim" && r !== "remarcar")) return json({ erro: "O link está incompleto. Confira com quem mandou." }, 400);

    // um mesmo endereço de internet não manda respostas sem fim (conta também as que não acham a sessão)
    const ip = req.headers.get("CF-Connecting-IP") || "local";
    const kLim = `conflim:${diaHoje()}:${ip}`;
    const n = Number(await env.AVISOS.get(kLim)) || 0;
    if (n >= MAX_CONFIRMA_DIA) return json({ erro: "Muitas respostas hoje. Fale direto pelo WhatsApp." }, 429);
    await env.AVISOS.put(kLim, String(n + 1), { expirationTtl: 2 * 86400 });

    const ses = sessaoDe(link, pid, dia);
    if (!ses) return json({ erro: "Não achamos esta sessão. Ela pode ter mudado de dia: fale com quem mandou o link." }, 404);

    // a resposta nova do mesmo paciente para o mesmo dia troca a anterior
    const kR = `respostas:${link.uid}`;
    const respostas = ((await env.AVISOS.get(kR, "json")) || []).filter(x => !(x.pid === pid && x.d === dia));
    respostas.push({ id: novoId(), pid, d: dia, h: ses.h, r, em: Date.now() });
    await env.AVISOS.put(kR, JSON.stringify(respostas.slice(-MAX_RESPOSTAS)), { expirationTtl: PEDIDOS_DURAM });
    // o que já foi respondido fica para a página mostrar de novo (mesmo depois de o app buscar); só as sessões que ainda existem
    const kD = `respondidas:${link.uid}`;
    const vale = new Set((link.sessoes || []).map(x => `${x.p} ${x.d}`));
    const respondidas = Object.fromEntries(Object.entries((await env.AVISOS.get(kD, "json")) || {}).filter(([c]) => vale.has(c)));
    respondidas[`${pid} ${dia}`] = r;
    await env.AVISOS.put(kD, JSON.stringify(respondidas), { expirationTtl: 70 * 86400 });

    // avisa no celular do profissional, sem o nome do paciente
    if (link.push) {
      const [, m, d] = dia.split("-");
      ctx.waitUntil(avisar(link.push, { titulo: r === "sim" ? "Sessão confirmada" : "Pedido para remarcar", corpo: `Sessão de ${d}/${m} às ${ses.h}. Abra o Avina para ver.`, tag: "confirmacao" }).catch(() => {}));
    }
    return json({ ok: true });
  }

  // calendário das sessões para assinar no Google Agenda / Apple Calendário (só com o código secreto)
  if (rota === "agenda.ics") {
    const link = await env.AVISOS.get(`link:${enderecoDe(url.searchParams.get("c"))}`, "json");
    const k = url.searchParams.get("k") || "";
    if (!link || !link.cal || k !== link.cal) return new Response("Calendário não encontrado", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    return new Response(calendario(link), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=900", "Content-Disposition": 'inline; filename="avina.ics"' } });
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
    const cal = String(b.cal || ""), zap = soDigitos(b.zap);
    const link = {
      uid: eu.id, nome: limpar(b.nome, 60) || "Agenda", profissao: limpar(b.profissao, 40), duracao: Math.min(240, Math.max(10, Number(b.duracao) || 50)),
      termo: limpar(b.termo, 20) || "Paciente", ativo: !!b.ativo, quem: b.quem === "pacientes" ? "pacientes" : "todos",
      antecedencia: Math.min(168, Math.max(0, Number(b.antecedencia) || 0)), dias,
      pids: (Array.isArray(b.pids) ? b.pids : []).map(x => limpar(x, 40)).filter(Boolean).slice(0, 500),
      push: limpar(b.push, 64) || null, em: Date.now(),
      sessoes: sessoesDe(b.sessoes), perfil: perfilDe(b.perfil),
      cal: /^[a-z0-9]{16,40}$/.test(cal) ? cal : null,
      zap: zap.length >= 10 && zap.length <= 13 ? zap : null,
    };
    await env.AVISOS.put(`link:${end}`, JSON.stringify(link));
    return json({ ok: true, endereco: end });
  }

  if (rota === "pedidos") {
    const kP = `pedidos:${eu.id}`, kR = `respostas:${eu.id}`;
    let [pedidos, respostas] = await Promise.all([env.AVISOS.get(kP, "json"), env.AVISOS.get(kR, "json")]);
    pedidos = pedidos || []; respostas = respostas || [];
    const recebi = new Set(Array.isArray(b.recebi) ? b.recebi : []);
    if (recebi.size && pedidos.some(p => recebi.has(p.id))) {
      pedidos = pedidos.filter(p => !recebi.has(p.id));
      await (pedidos.length ? env.AVISOS.put(kP, JSON.stringify(pedidos), { expirationTtl: PEDIDOS_DURAM }) : env.AVISOS.delete(kP));
    }
    if (recebi.size && respostas.some(x => recebi.has(x.id))) {
      respostas = respostas.filter(x => !recebi.has(x.id));
      await (respostas.length ? env.AVISOS.put(kR, JSON.stringify(respostas), { expirationTtl: PEDIDOS_DURAM }) : env.AVISOS.delete(kR));
    }
    return json({ pedidos, respostas });
  }

  if (rota === "apagar") {
    const end = await env.AVISOS.get(`linkde:${eu.id}`);
    if (end) await env.AVISOS.delete(`link:${end}`);
    await Promise.all([`linkde:${eu.id}`, `pedidos:${eu.id}`, `respostas:${eu.id}`, `respondidas:${eu.id}`].map(k => env.AVISOS.delete(k)));
    return json({ ok: true });
  }

  return json({ erro: "Caminho desconhecido" }, 404);
}
