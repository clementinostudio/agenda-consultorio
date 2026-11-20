// Página do link de agendamento: app.avina.com.br/agendar/?<endereço>  (para remarcar: ...&p=<id do paciente>)
// Confirmar uma sessão marcada: ...&p=<id do paciente>&s=<AAAA-MM-DD> (o lembrete que o app manda pelo WhatsApp)
// Mostra o perfil e os horários livres do profissional e conversa com o servidor (servidor-avisos/src/link.js).
// Sem etapa de build: JavaScript simples, para funcionar também em iPhones antigos.
(function () {
  var SERVIDOR = "https://agenda-avisos.alvena.workers.dev";
  var busca = location.search.slice(1);
  var endereco = decodeURIComponent((busca.split("&")[0] || "").split("=")[0] || "");
  var q = new URLSearchParams(busca), pid = q.get("p") || "", diaSessao = q.get("s") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaSessao)) diaSessao = "";
  // no computador, dá para testar com um servidor local: ?ana&srv=http://127.0.0.1:8787
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && q.get("srv")) SERVIDOR = q.get("srv");

  var DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  var DIA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var DIA_INTEIRO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  var MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var PERIODOS = [["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]];
  var MODALIDADE = { presencial: "Presencial", online: "Online", ambos: "Online e presencial" };
  var app = document.getElementById("app");
  var info = null, dia = null, hora = null, passo = "escolher", aviso = "", enviando = false;
  // modo "confirmar": a página da sessão marcada (…&p=&s=); "agendar": escolher um horário
  var modo = "agendar", primeiraVez = true, resposta = null, mudando = false, veioDaSessao = false;
  var bioAberta = false, vistaAtual = "";
  var guardado = lerGuardado();

  // ícones simples (traço na cor do texto)
  var ICONE = {
    video: '<path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/>',
    casa: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    certo: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    remarcar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M10 15h5m-2-2 2 2-2 2"/>',
    conversa: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
    voltar: '<path d="M14.5 6 8.5 12l6 6"/>'
  };
  function icone(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONE[n] + "</svg>"; }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function minDe(h) { var p = String(h).split(":"); return (+p[0]) * 60 + (+p[1]); }
  function dataDe(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diaCurto(iso) { var d = dataDe(iso); return DIA_LONGO[d.getDay()] + ", " + d.getDate() + " " + MES[d.getMonth()]; }
  function diaInteiro(iso) { var d = dataDe(iso), s = DIA_INTEIRO[d.getDay()]; return s.charAt(0).toUpperCase() + s.slice(1) + ", " + d.getDate() + " de " + MES_LONGO[d.getMonth()]; }
  function periodoDe(m) { return m < 720 ? "manha" : m < 1080 ? "tarde" : "noite"; }
  function primeiro(n) { return String(n || "").trim().split(/\s+/)[0]; }
  function iniciais(n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
  function lerGuardado() { try { return JSON.parse(localStorage.getItem("avina-agendar") || "{}") || {}; } catch (e) { return {}; } }
  function guardar(v) { try { localStorage.setItem("avina-agendar", JSON.stringify(v)); } catch (e) {} }
  function foneBonito(s) { var d = String(s || "").replace(/\D/g, "").slice(0, 11); return d.length > 6 ? "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4) : d.length > 2 ? "(" + d.slice(0, 2) + ") " + d.slice(2) : d; }
  // WhatsApp do profissional (com o 55 do Brasil quando vem só com o DDD)
  function linkZap(texto) {
    var z = String((info && info.zap) || "").replace(/\D/g, "");
    if (z.length < 10) return "";
    if (z.length <= 11) z = "55" + z;
    return "https://wa.me/" + z + (texto ? "?text=" + encodeURIComponent(texto) : "");
  }
  function salaOnline() { var o = info.sessao && info.sessao.online; return o && /^https:\/\//.test(o) ? o : ""; }

  function carregar() {
    if (!endereco) return fim("Link incompleto", "Confira o link com quem mandou.");
    fetch(SERVIDOR + "/link/ver?c=" + encodeURIComponent(endereco) + (pid ? "&p=" + encodeURIComponent(pid) : "") + (pid && diaSessao ? "&s=" + diaSessao : ""))
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) return fim("Agenda não encontrada", x.j.erro || "Confira o link com quem mandou.");
        info = x.j;
        info.dias = info.dias || [];
        // abriu pelo lembrete da sessão: mostra a sessão (se ela não existe mais, cai na página normal)
        if (primeiraVez) { primeiraVez = false; if (diaSessao && pid && info.sessao) { modo = "confirmar"; resposta = info.sessao.resposta || null; } }
        document.title = (modo === "confirmar" ? "Sua sessão com " : "Marcar horário com ") + primeiro(info.nome) + " · Avina";
        if (!dia || !info.dias.some(function (d) { return d.d === dia; })) { dia = info.dias[0] ? info.dias[0].d : null; hora = null; }
        desenhar();
      })
      .catch(function () { fim("Sem conexão", "Não deu para abrir a agenda agora. Confira a internet e tente de novo.", true); });
  }

  // troca o conteúdo; a entrada suave só acontece quando muda de tela (não a cada toque)
  function pintar(html, vista) {
    app.innerHTML = html;
    document.body.className = app.querySelector(".pe") ? "com-pe" : "";
    if (vista !== vistaAtual) {
      if (vistaAtual) window.scrollTo(0, 0);
      app.className = ""; void app.offsetWidth; app.className = "entra";
      vistaAtual = vista;
    } else app.className = "";
    var mais = document.getElementById("mais");
    if (mais) mais.onclick = function () { bioAberta = true; var b = document.getElementById("bio"); b.className = "bio"; mais.parentNode.removeChild(mais); };
  }

  function fim(titulo, texto, tentar) {
    pintar('<div class="fim"><i class="neutro">' + icone("relogio") + "</i><h1>" + esc(titulo) + "</h1><p>" + esc(texto) + "</p>" + (tentar ? '<button class="btn claro" id="tentar">Tentar de novo</button>' : "") + "</div>", "fim-" + titulo);
    if (tentar) document.getElementById("tentar").onclick = function () { pintar('<div class="carregando"><span class="gira"></span> Abrindo a agenda…</div>', "carregando"); carregar(); };
  }

  // ---------- o perfil do profissional ----------
  function avatar() {
    var p = info.perfil || {}, foto = typeof p.foto === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p.foto) ? p.foto : "";
    return '<span class="av">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : esc(iniciais(info.nome))) + "</span>";
  }
  function chip(ic, texto) { return '<span class="chip">' + icone(ic) + esc(texto) + "</span>"; }
  function perfil(compacto) {
    var p = info.perfil || {};
    var sub = [info.profissao, p.registro].filter(Boolean).join(" · ");
    var h = '<header class="perfil' + (compacto ? " compacto" : "") + '"><div class="perfil-topo">' + avatar() + '<div class="perfil-txt">' +
      '<p class="nome">' + esc(info.nome) + "</p>" + (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") +
      (!compacto && p.abordagem ? '<p class="abord">' + esc(p.abordagem) + "</p>" : "") + "</div></div>";
    if (compacto) return h + "</header>";
    var chips = [];
    if (MODALIDADE[p.modalidade]) chips.push(chip(p.modalidade === "presencial" ? "casa" : "video", MODALIDADE[p.modalidade]));
    if (p.cidade) chips.push(chip("pin", p.cidade));
    chips.push(chip("relogio", "Sessão de " + (info.duracao || 50) + " min"));
    h += '<div class="chips">' + chips.join("") + "</div>";
    if (p.bio) {
      var longa = !bioAberta && (p.bio.length > 170 || p.bio.split("\n").length > 3);
      h += '<p class="bio' + (longa ? " fechada" : "") + '" id="bio">' + esc(p.bio) + "</p>" + (longa ? '<button class="mais" id="mais">Ler mais</button>' : "");
    }
    return h + "</header>";
  }

  // o cartão da sessão marcada: dia, horário, duração e com quem
  function cartaoSessao() {
    var s = info.sessao, d = dataDe(s.d), dur = info.duracao || 50, ini = minDe(s.h);
    return '<div class="sessao"><div class="folha" aria-hidden="true"><small>' + MES[d.getMonth()] + "</small><b>" + d.getDate() + "</b></div>" +
      '<div class="sessao-txt"><b>' + esc(diaInteiro(s.d)) + "</b><span>" + esc(s.h) + " às " + hhmm(ini + dur) + " · " + dur + " min</span>" +
      "<span>com " + esc(info.nome) + "</span>" + (salaOnline() ? '<span class="online">' + icone("video") + "Online</span>" : "") + "</div></div>";
  }

  function desenhar() {
    if (modo === "confirmar") return desenharSessao();
    var nome = primeiro(info.nome), prof = esc(nome), h = perfil(false) + '<hr class="divisor">';
    if (passo === "ok") {
      pintar(perfil(true) + '<div class="fim"><i>' + icone("certo") + "</i><h1>Pedido enviado!</h1><p>" + prof + " confirma pelo WhatsApp. O horário fica marcado depois disso.</p></div><p class=\"dica centro\">Precisa mudar? É só abrir este link de novo.</p>", "ok");
      return;
    }
    var zap = linkZap(info.remarcar ? "Olá, " + nome + "! Preciso remarcar a minha sessão." : "Olá, " + nome + "! Queria marcar um horário."),
      botaoZap = zap ? '<a class="btn claro" href="' + esc(zap) + '" target="_blank" rel="noopener">' + icone("conversa") + "Chamar no WhatsApp</a>" : "";
    var voltar = veioDaSessao ? '<button class="voltar" id="voltar">' + icone("voltar") + "Sua sessão</button>" : "";
    if (!info.aberto || !info.dias.length) {
      pintar((veioDaSessao ? voltar + perfil(true) : h) + '<div class="fim"><h1>' + (!info.aberto ? "Agenda fechada no momento" : "Sem horários livres") + "</h1><p>" +
        (!info.aberto ? "Para marcar, fale com " + prof + " pelo WhatsApp." : "Os próximos horários estão ocupados. Fale com " + prof + " pelo WhatsApp.") + "</p>" + botaoZap + "</div>", "fechada");
      ligarVoltar();
      return;
    }
    var quando = hora != null ? diaCurto(dia) + " às " + hhmm(hora) : "";

    if (passo === "dados") {
      pintar(perfil(true) +
        '<button class="escolhido" id="trocar"><span><b>' + esc(quando) + "</b><small>Trocar horário</small></span></button>" +
        "<h1>Quase lá</h1>" +
        '<div class="campos">' +
        '<div class="campo"><label for="nome">Seu nome</label><input id="nome" autocomplete="name" placeholder="Nome e sobrenome" maxlength="60" value="' + esc(guardado.nome || "") + '"></div>' +
        '<div class="campo"><label for="fone">Seu WhatsApp</label><input id="fone" inputmode="tel" autocomplete="tel" placeholder="(41) 99999-9999" value="' + esc(foneBonito(guardado.fone || "")) + '"></div>' +
        "</div>" +
        '<p class="dica">' + prof + " vê o seu nome e o WhatsApp para confirmar o horário.</p>" +
        (aviso ? '<p class="erro" role="alert">' + esc(aviso) + "</p>" : "") +
        '<div class="pe"><button class="btn" id="pedir">' + (enviando ? "Enviando…" : "Pedir este horário") + "</button></div>", "dados");
      var campoNome = document.getElementById("nome"), fone = document.getElementById("fone"), botao = document.getElementById("pedir");
      var conferir = function () { botao.disabled = enviando || campoNome.value.trim().length < 2 || fone.value.replace(/\D/g, "").length < 10; };
      fone.oninput = function () { fone.value = foneBonito(fone.value); conferir(); };
      campoNome.oninput = conferir; conferir();
      document.getElementById("trocar").onclick = function () { passo = "escolher"; aviso = ""; desenhar(); };
      botao.onclick = function () { pedir(campoNome.value.trim(), fone.value.replace(/\D/g, "")); };
      return;
    }

    var atual = info.dias.filter(function (d) { return d.d === dia; })[0];
    // quem veio da sessão vê o perfil pequeno e o aviso de que o profissional já sabe
    var html = veioDaSessao ? voltar + perfil(true) + '<p class="nota">' + icone("certo") + "<span>" + prof + " recebeu o aviso. Se quiser, já escolha um novo horário.</span></p>" : h;
    html += "<h1>" + (info.remarcar ? "Para quando quer mudar?" : "Escolha um horário") + "</h1>";
    html += '<div class="dias" role="radiogroup" aria-label="Dia">' + info.dias.map(function (d) {
      var dt = dataDe(d.d);
      return '<button class="dia" role="radio" data-dia="' + d.d + '" aria-checked="' + (d.d === dia) + '"><small>' + DIA[dt.getDay()] + "</small><b>" + dt.getDate() + "</b><small>" + MES[dt.getMonth()] + "</small></button>";
    }).join("") + "</div>";
    if (atual) PERIODOS.forEach(function (p) {
      var hs = atual.h.filter(function (m) { return periodoDe(m) === p[0]; });
      if (hs.length) html += '<div class="per"><h2>' + p[1] + '</h2><div class="horas">' + hs.map(function (m) { return '<button class="hora" data-hora="' + m + '" aria-pressed="' + (hora === m) + '">' + hhmm(m) + "</button>"; }).join("") + "</div></div>";
    });
    if (aviso) html += '<p class="erro" role="alert">' + esc(aviso) + "</p>";
    html += '<div class="pe"><button class="btn" id="seguir"' + (hora == null || enviando ? " disabled" : "") + ">" + (hora == null ? "Escolha um horário" : enviando ? "Enviando…" : info.remarcar ? "Pedir " + esc(quando) : "Continuar · " + esc(quando)) + "</button></div>";
    pintar(html, "escolher");
    app.querySelectorAll("[data-dia]").forEach(function (b) { b.onclick = function () { dia = b.getAttribute("data-dia"); hora = null; aviso = ""; desenhar(); }; });
    app.querySelectorAll("[data-hora]").forEach(function (b) { b.onclick = function () { hora = +b.getAttribute("data-hora"); aviso = ""; desenhar(); }; });
    document.getElementById("seguir").onclick = function () { if (info.remarcar) pedir("", ""); else { passo = "dados"; desenhar(); } };
    ligarVoltar();
  }
  function ligarVoltar() {
    var v = document.getElementById("voltar");
    if (v) v.onclick = function () { modo = "confirmar"; aviso = ""; desenhar(); };
  }

  // ---------- a sessão marcada: confirmar ou pedir para remarcar ----------
  function desenharSessao() {
    var s = info.sessao, nome = primeiro(info.nome), prof = esc(nome), r = mudando ? null : resposta, html = perfil(true);
    if (!r) {
      html += "<h1>Sua sessão</h1>" + cartaoSessao() +
        '<p class="dica">Responda aqui para ' + prof + " saber se você vem.</p>" +
        (aviso ? '<p class="erro" role="alert">' + esc(aviso) + "</p>" : "") +
        '<div class="botoes"><button class="btn" id="sim"' + (enviando ? " disabled" : "") + ">" + (enviando === "sim" ? "Enviando…" : "Confirmo presença") + "</button>" +
        '<button class="btn claro" id="remarcar"' + (enviando ? " disabled" : "") + ">" + (enviando === "remarcar" ? "Enviando…" : "Preciso remarcar") + "</button></div>" +
        (mudando ? '<button class="btn-texto" id="cancelar">Deixar como estava</button>' : "");
      pintar(html, "sessao-pergunta");
      document.getElementById("sim").onclick = function () { responder("sim"); };
      document.getElementById("remarcar").onclick = function () { responder("remarcar"); };
      var c = document.getElementById("cancelar");
      if (c) c.onclick = function () { mudando = false; aviso = ""; desenhar(); };
      return;
    }
    if (r === "sim") {
      var sala = salaOnline();
      html += '<div class="fim"><i>' + icone("certo") + "</i><h1>Presença confirmada</h1><p>" + prof + " já sabe que você vem. Até " + esc(DIA_LONGO[dataDe(s.d).getDay()]) + ", às&nbsp;" + esc(s.h) + ".</p></div>" + cartaoSessao() +
        (sala ? '<div class="botoes"><a class="btn" href="' + esc(sala) + '" target="_blank" rel="noopener">' + icone("video") + 'Entrar na sessão</a><p class="dica centro">Guarde este link: na hora da sessão, é só abrir de novo e tocar em “Entrar na sessão”.</p></div>' : "");
    } else {
      var zap = linkZap("Olá, " + nome + "! Preciso remarcar a sessão de " + DIA_INTEIRO[dataDe(s.d).getDay()] + ", " + s.d.slice(8, 10) + "/" + s.d.slice(5, 7) + ", às " + s.h + ".");
      if (info.aberto) {
        html += '<div class="fim"><i class="amb">' + icone("remarcar") + "</i><h1>Vamos remarcar</h1><p>" + prof + " recebeu o aviso. Escolha um novo horário quando quiser.</p>" +
          '<button class="btn" id="escolher">Escolher novo horário</button></div>';
      } else if (zap) {
        html += '<div class="fim"><i class="amb">' + icone("remarcar") + "</i><h1>Avise " + prof + " pelo WhatsApp</h1><p>" + prof + " já recebeu o aviso no Avina. Pelo WhatsApp vocês combinam o novo horário.</p>" +
          '<a class="btn" href="' + esc(zap) + '" target="_blank" rel="noopener">' + icone("conversa") + "Abrir o WhatsApp</a></div>";
      } else {
        html += '<div class="fim"><i class="amb">' + icone("remarcar") + "</i><h1>Pedido para remarcar enviado</h1><p>" + prof + " recebeu o aviso e vai falar com você para combinar um novo horário.</p></div>";
      }
      html += '<p class="rotulo">A sessão que você quer mudar</p>' + cartaoSessao();
    }
    html += '<button class="btn-texto" id="mudar">Mudar minha resposta</button>';
    pintar(html, "sessao-" + r);
    document.getElementById("mudar").onclick = function () { mudando = true; aviso = ""; desenhar(); };
    var e = document.getElementById("escolher");
    if (e) e.onclick = irParaEscolha;
  }

  function irParaEscolha() { modo = "agendar"; veioDaSessao = true; passo = "escolher"; hora = null; aviso = ""; desenhar(); }

  function responder(r) {
    if (enviando) return;
    enviando = r; aviso = ""; desenhar();
    fetch(SERVIDOR + "/link/confirmar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c: endereco, p: pid, s: info.sessao.d, r: r }) })
      .then(function (x) { return x.json().then(function (j) { return { ok: x.ok, j: j }; }); })
      .then(function (x) {
        enviando = false;
        if (!x.ok) { aviso = x.j.erro || "Não deu para enviar. Tente de novo."; desenhar(); return; }
        resposta = r; mudando = false; info.sessao.resposta = r;
        // pediu para remarcar e a agenda está aberta: já mostra os horários livres
        if (r === "remarcar" && info.aberto) irParaEscolha(); else desenhar();
      })
      .catch(function () { enviando = false; aviso = "Sem conexão agora. Confira a internet e tente de novo."; desenhar(); });
  }

  function pedir(nome, fone) {
    if (enviando) return;
    if (nome) { guardado = { nome: nome, fone: fone }; guardar(guardado); }
    enviando = true; aviso = ""; desenhar();
    fetch(SERVIDOR + "/link/pedir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c: endereco, p: pid, nome: nome, fone: fone, data: dia, hora: hhmm(hora) }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        enviando = false;
        if (x.ok) { passo = "ok"; desenhar(); return; }
        aviso = x.j.erro || "Não deu para enviar. Tente de novo.";
        // o horário acabou de sair: volta para a escolha com os horários de agora
        if (x.j.ocupado) { passo = "escolher"; hora = null; carregar(); } else desenhar();
      })
      .catch(function () { enviando = false; aviso = "Sem conexão agora. Confira a internet e tente de novo."; desenhar(); });
  }

  carregar();
})();
