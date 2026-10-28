// Preenche os dados de quem oferece o Avina (legal/dados.js) e segue o tema escolhido no app
(function () {
  try {
    var t = JSON.parse(localStorage.getItem("agenda-tema") || "null");
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
  document.addEventListener("DOMContentLoaded", function () {
    var d = window.AVINA_DONO || {};
    document.querySelectorAll("[data-campo]").forEach(function (el) {
      var v = d[el.getAttribute("data-campo")];
      if (v) {
        el.textContent = v;
        if (el.getAttribute("data-campo") === "email") { el.innerHTML = ""; var a = document.createElement("a"); a.href = "mailto:" + v; a.textContent = v; el.appendChild(a); }
        if (el.getAttribute("data-campo") === "whatsapp") { el.innerHTML = ""; var w = document.createElement("a"); w.href = "https://wa.me/" + v.replace(/\D/g, ""); w.target = "_blank"; w.rel = "noopener"; w.textContent = v + " (WhatsApp)"; el.appendChild(w); }
      } else el.classList.add("falta");
    });
  });
})();
