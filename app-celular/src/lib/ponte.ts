// A ponte entre o Avina (o mesmo app do site, ../src) e o celular.
// O site roda numa WebView. Antes de qualquer código dele, o app injeta o script abaixo, que:
// - cria window.AvinaApp.chamar(acao, dados) → Promise (o site usa por src/app-nativo.js);
// - troca o que a WebView não faz direito pelo recurso do celular: localização (sem o segundo pedido de permissão
//   da WebView), Compartilhar (com arquivos) e os arquivos baixados (PDF do recibo, planilha): viram o Compartilhar
//   do celular, de onde dá para salvar em Arquivos ou mandar no WhatsApp;
// - avisa o app da cor do topo e do fundo, para a barra do celular combinar com a tela.
// O app responde com window.__avinaResposta(id, erro, valor). A lista de ações fica em src/app/index.tsx.
// PONTE muda só quando o jeito de conversar muda; o app não abre cópias do site com uma ponte que ele não conhece.
export const PONTE = 1;

export type Pedido = { id: number; acao: string; dados: any };

export function scriptDaPonte(plataforma: string, versao: string) {
  return `(function () {
  if (window.AvinaApp) return;
  var RN = window.ReactNativeWebView, n = 0, fila = {};
  function chamar(acao, dados) {
    return new Promise(function (ok, falha) {
      var id = ++n; fila[id] = [ok, falha];
      RN.postMessage(JSON.stringify({ id: id, acao: acao, dados: dados === undefined ? null : dados }));
    });
  }
  window.__avinaResposta = function (id, erro, valor) {
    var f = fila[id]; if (!f) return; delete fila[id];
    if (erro) f[1](new Error(erro)); else f[0](valor);
  };
  window.AvinaApp = { plataforma: ${JSON.stringify(plataforma)}, versao: ${JSON.stringify(versao)}, ponte: ${PONTE}, chamar: chamar };

  // Localização: quem pergunta é o celular (um pedido só, "enquanto usa o app")
  var geo = navigator.geolocation;
  if (geo) {
    var pos = function (ok, falha, op) {
      chamar("local", { maximumAge: (op && op.maximumAge) || 0, alta: !!(op && op.enableHighAccuracy) }).then(function (p) {
        ok({ coords: { latitude: p.lat, longitude: p.lon, accuracy: p.precisao || 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: p.t || Date.now() });
      }, function (e) {
        if (falha) falha({ code: e.message === "negado" ? 1 : 2, message: e.message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      });
    };
    try { geo.getCurrentPosition = pos; geo.watchPosition = function (ok, falha, op) { pos(ok, falha, op); return 1; }; geo.clearWatch = function () {}; } catch (e) {}
  }

  // Compartilhar (texto, link e arquivos) pelo Compartilhar do celular
  function base64(blob) {
    return new Promise(function (ok, falha) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1] || ""); }; r.onerror = falha; r.readAsDataURL(blob); });
  }
  function abortou() { var e = new Error("cancelou"); e.name = "AbortError"; return e; }
  navigator.canShare = function (d) { return !!d; };
  navigator.share = function (d) {
    d = d || {};
    return Promise.all((d.files || []).map(function (f) { return base64(f).then(function (b) { return { nome: f.name || "arquivo", tipo: f.type || "", base64: b }; }); }))
      .then(function (arquivos) { return chamar("compartilhar", { titulo: d.title || "", texto: d.text || "", url: d.url || "", arquivos: arquivos }); })
      .then(function (r) { if (r === "cancelou") throw abortou(); });
  };

  // Arquivo "baixado" pelo site (a.download + click): vai para o Compartilhar do celular
  var clicar = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || "";
    if (this.hasAttribute("download") && /^(blob|data):/.test(href)) {
      var nome = this.getAttribute("download") || "arquivo";
      fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
        return base64(b).then(function (s) { return chamar("compartilhar", { arquivos: [{ nome: nome, tipo: b.type || "", base64: s }] }); });
      }).catch(function () {});
      return;
    }
    return clicar.apply(this, arguments);
  };

  // A cor do topo (meta theme-color, que o site já ajusta) e a do fundo (muda com o tema claro/escuro):
  // a barra do celular acompanha
  var ultima = "", espera = 0;
  function cores() {
    clearTimeout(espera);
    espera = setTimeout(function () {
      try {
        var m = document.querySelector('meta[name="theme-color"]'), topo = m && m.getAttribute("content");
        var fundo = getComputedStyle(document.body).backgroundColor;
        if (!fundo || fundo === "rgba(0, 0, 0, 0)") fundo = getComputedStyle(document.documentElement).backgroundColor;
        if (topo + "|" + fundo === ultima) return;
        ultima = topo + "|" + fundo;
        chamar("cores", { topo: topo, fundo: fundo }).catch(function () {});
      } catch (e) {}
    }, 120);
  }
  document.addEventListener("DOMContentLoaded", function () {
    cores();
    new MutationObserver(cores).observe(document.head, { subtree: true, attributes: true, attributeFilter: ["content"] });
    new MutationObserver(cores).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  });
})(); true;`;
}

// Responde a um pedido do site (o que volta vira o resultado da Promise de AvinaApp.chamar)
export function resposta(id: number, erro: string | null, valor?: unknown) {
  return `window.__avinaResposta && window.__avinaResposta(${id}, ${JSON.stringify(erro)}, ${JSON.stringify(valor ?? null)}); true;`;
}
