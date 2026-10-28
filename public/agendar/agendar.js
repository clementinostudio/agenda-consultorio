// Página do link de agendamento: app.avina.com.br/agendar/?<endereço>  (para remarcar: ...&p=<id do paciente>)
// Mostra os horários livres do profissional e manda o pedido para o servidor (servidor-avisos/src/link.js).
(function () {
  var SERVIDOR = "https://agenda-avisos.alvena.workers.dev";
  var busca = location.search.slice(1);
  var endereco = decodeURIComponent((busca.split("&")[0] || "").split("=")[0] || "");
  var q = new URLSearchParams(busca), pid = q.get("p") || "";
  // no computador, dá para testar com um servidor local: ?ana&srv=http://127.0.0.1:8787
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && q.get("srv")) SERVIDOR = q.get("srv");

  var DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  var DIA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var PERIODOS = [["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]];
  var app = document.getElementById("app");
  var info = null, dia = null, hora = null, passo = "escolher", aviso = "", enviando = false;
  var guardado = lerGuardado();

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function dataDe(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diaCurto(iso) { var d = dataDe(iso); return DIA_LONGO[d.getDay()] + ", " + d.getDate() + " " + MES[d.getMonth()]; }
  function periodoDe(m) { return m < 720 ? "manha" : m < 1080 ? "tarde" : "noite"; }
  function primeiro(n) { return String(n || "").trim().split(/\s+/)[0]; }
  function iniciais(n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
  function lerGuardado() { try { return JSON.parse(localStorage.getItem("avina-agendar") || "{}") || {}; } catch (e) { return {}; } }
  function guardar(v) { try { localStorage.setItem("avina-agendar", JSON.stringify(v)); } catch (e) {} }
  function foneBonito(s) { var d = String(s || "").replace(/\D/g, "").slice(0, 11); return d.length > 6 ? "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4) : d.length > 2 ? "(" + d.slice(0, 2) + ") " + d.slice(2) : d; }

  function carregar() {
    if (!endereco) return fim("Link incompleto", "Confira o link com quem mandou.");
    fetch(SERVIDOR + "/link/ver?c=" + encodeURIComponent(endereco) + (pid ? "&p=" + encodeURIComponent(pid) : ""))
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) return fim("Agenda não encontrada", x.j.erro || "Confira o link com quem mandou.");
        info = x.j;
        document.title = "Marcar horário com " + primeiro(info.nome) + " · Avina";
        if (!dia || !info.dias.some(function (d) { return d.d === dia; })) { dia = info.dias[0] ? info.dias[0].d : null; hora = null; }
        desenhar();
      })
      .catch(function () { fim("Sem conexão", "Não deu para abrir a agenda agora. Confira a internet e tente de novo.", true); });
  }

  function fim(titulo, texto, tentar) {
    app.innerHTML = '<div class="fim"><h1>' + esc(titulo) + "</h1><p>" + esc(texto) + "</p>" + (tentar ? '<button class="btn claro" id="tentar" style="margin-top:12px">Tentar de novo</button>' : "") + "</div>";
    if (tentar) document.getElementById("tentar").onclick = function () { app.innerHTML = '<div class="carregando"><span class="gira"></span> Abrindo a agenda…</div>'; carregar(); };
  }

  function cabeca() {
    var sub = [info.profissao, "sessão de " + (info.duracao || 50) + " min"].filter(Boolean).join(" · ");
    return '<div class="quem"><span class="av">' + esc(iniciais(info.nome)) + "</span><div><b>" + esc(info.nome) + "</b><small>" + esc(sub) + "</small></div></div>";
  }

  function desenhar() {
    var prof = esc(primeiro(info.nome)), h = cabeca();
    if (passo === "ok") {
      app.innerHTML = h + '<div class="fim"><i>✓</i><h1>Pedido enviado!</h1><p>' + prof + " confirma pelo WhatsApp. O horário fica marcado depois disso.</p><p class=\"dica\">Precisa mudar? É só abrir este link de novo.</p></div>";
      return;
    }
    if (!info.aberto) { app.innerHTML = h + '<div class="fim"><h1>Agenda fechada no momento</h1><p>Para marcar, fale com ' + prof + " pelo WhatsApp.</p></div>"; return; }
    if (!info.dias.length) { app.innerHTML = h + '<div class="fim"><h1>Sem horários livres</h1><p>Os próximos horários estão ocupados. Fale com ' + prof + " pelo WhatsApp.</p></div>"; return; }
    var quando = hora != null ? diaCurto(dia) + " às " + hhmm(hora) : "";

    if (passo === "dados") {
      app.innerHTML = h +
        '<button class="escolhido" id="trocar"><span><b>' + esc(quando) + "</b><small>Trocar horário</small></span></button>" +
        "<h1>Quase lá</h1>" +
        '<div class="campos">' +
        '<div class="campo"><label for="nome">Seu nome</label><input id="nome" autocomplete="name" placeholder="Nome e sobrenome" maxlength="60" value="' + esc(guardado.nome || "") + '"></div>' +
        '<div class="campo"><label for="fone">Seu WhatsApp</label><input id="fone" inputmode="tel" autocomplete="tel" placeholder="(41) 99999-9999" value="' + esc(foneBonito(guardado.fone || "")) + '"></div>' +
        "</div>" +
        '<p class="dica">' + prof + " vê o seu nome e o WhatsApp para confirmar o horário.</p>" +
        (aviso ? '<p class="erro" role="alert">' + esc(aviso) + "</p>" : "") +
        '<div class="pe"><button class="btn" id="pedir">Pedir este horário</button></div>';
      var nome = document.getElementById("nome"), fone = document.getElementById("fone"), botao = document.getElementById("pedir");
      var conferir = function () { botao.disabled = enviando || nome.value.trim().length < 2 || fone.value.replace(/\D/g, "").length < 10; };
      fone.oninput = function () { fone.value = foneBonito(fone.value); conferir(); };
      nome.oninput = conferir; conferir();
      document.getElementById("trocar").onclick = function () { passo = "escolher"; aviso = ""; desenhar(); };
      botao.onclick = function () { pedir(nome.value.trim(), fone.value.replace(/\D/g, "")); };
      return;
    }

    var atual = info.dias.filter(function (d) { return d.d === dia; })[0];
    var html = h;
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
    app.innerHTML = html;
    app.querySelectorAll("[data-dia]").forEach(function (b) { b.onclick = function () { dia = b.getAttribute("data-dia"); hora = null; aviso = ""; desenhar(); }; });
    app.querySelectorAll("[data-hora]").forEach(function (b) { b.onclick = function () { hora = +b.getAttribute("data-hora"); aviso = ""; desenhar(); }; });
    document.getElementById("seguir").onclick = function () { if (info.remarcar) pedir("", ""); else { passo = "dados"; desenhar(); } };
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
