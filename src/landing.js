// Página de apresentação (landing page). Mesmas fontes do app; tudo em JavaScript simples, sem bibliotecas.
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "./landing.css";

// Endereço do app (fica num subdomínio só dele)
const APP = import.meta.env.VITE_APP_URL || "https://app.avina.com.br/";

const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;

// 1. Blocos aparecem suavemente ao entrar na tela
const blocos = document.querySelectorAll(".revela");
if ("IntersectionObserver" in window && !calmo) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px", threshold: .1 });
  blocos.forEach((b, i) => { b.style.transitionDelay = `${(i % 3) * 60}ms`; io.observe(b); });
} else blocos.forEach(b => b.classList.add("visivel"));

// 2. Barra de cima ganha sombra ao rolar; no celular, o botão de duas linhas abre o menu
const topo = document.querySelector(".topo");
const rolar = () => topo.classList.toggle("rolou", scrollY > 8);
addEventListener("scroll", rolar, { passive: true }); rolar();
const menuBotao = topo.querySelector(".menu-botao");
const abrirMenu = sim => {
  topo.classList.toggle("aberto", sim);
  menuBotao.setAttribute("aria-expanded", sim ? "true" : "false");
  menuBotao.setAttribute("aria-label", sim ? "Fechar o menu" : "Abrir o menu");
};
menuBotao.addEventListener("click", () => abrirMenu(!topo.classList.contains("aberto")));
topo.querySelectorAll(".menu a").forEach(a => a.addEventListener("click", () => abrirMenu(false)));
addEventListener("keydown", e => { if (e.key === "Escape") abrirMenu(false); });

// 3. iPhone inclina seguindo o mouse (só no computador)
if (matchMedia("(hover: hover) and (pointer: fine)").matches && !calmo) {
  const fones = [...document.querySelectorAll(".iphone.tilt")];
  let raf = 0;
  addEventListener("mousemove", e => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const x = (e.clientX / innerWidth - .5) * 2, y = (e.clientY / innerHeight - .5) * 2;
      fones.forEach(f => { f.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`); f.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`); });
    });
  });
}

// 4. Cadastro: abre o app já na tela de criar conta, com o e-mail preenchido (o app é outro endereço, então vai no link)
document.querySelectorAll("[data-cadastro]").forEach(f => f.addEventListener("submit", e => {
  e.preventDefault();
  const email = (f.querySelector("input").value || "").trim();
  location.href = `${APP}${email ? `?email=${encodeURIComponent(email)}` : ""}#criar`;
}));

// 5. Demonstração da fala: escreve a frase, mostra o que o app entendeu e passa para a próxima
const conversa = document.querySelector("[data-conversa]");
if (conversa) {
  // cada página tem os seus exemplos: data-conversa="pessoal" (Para você) ou "consultorio" (Para profissionais).
  // A logo da empresa vem do ícone do próprio site, como no app
  const EXEMPLOS = {
    pessoal: [
      { f: "gastei 30 reais no uber", t: "Uber", s: "Transporte · Hoje", v: "R$ 30,00", logo: "uber.com" },
      { f: "paguei 120 de luz ontem", t: "Luz", s: "Casa · Ontem", v: "R$ 120,00", ic: "⌂", cor: "#2F4AD9" },
      { f: "comprei 54,90 no ifood", t: "iFood", s: "Comida fora · Hoje", v: "R$ 54,90", logo: "ifood.com.br" },
      { f: "recebi 200 de pix do Rafa", t: "Pix do Rafa", s: "Entrada · Hoje", v: "+R$ 200,00", ic: "R", cor: "#10A56F" },
    ],
    consultorio: [
      { f: "Gustavo veio e pagou", t: "Gustavo Andrade", s: "Sessão marcada · pago", v: "✓", ic: "GA", cor: "#4A62FF" },
      { f: "a Ana faltou", t: "Ana Souza", s: "Falta marcada · hoje", v: "✕", ic: "AS", cor: "#E0577A" },
      { f: "remarca a Júlia pra quinta às 15h", t: "Júlia Prado", s: "Remarcada · qui às 15:00", v: "↻", ic: "JP", cor: "#8B6CFF" },
      { f: "gastei 30 reais no uber", t: "Uber", s: "Transporte · Hoje", v: "R$ 30,00", logo: "uber.com" },
    ],
  };
  const ex = EXEMPLOS[conversa.dataset.conversa] || EXEMPLOS.pessoal;
  const dito = conversa.querySelector("[data-dito]"), res = conversa.querySelector("[data-resultado]"), est = conversa.querySelector("[data-estado]");
  const $ = s => conversa.querySelector(s);
  let i = 0, rodando = false;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const ciclo = async () => {
    if (rodando) return; rodando = true;
    while (true) {
      const e = ex[i % ex.length];
      res.hidden = true; dito.textContent = ""; est.textContent = "ouvindo…";
      for (const ch of e.f) { dito.textContent += ch; await espera(calmo ? 0 : 45 + Math.random() * 40); }
      est.textContent = "entendendo…"; await espera(500);
      $("[data-res-t]").textContent = e.t; $("[data-res-s]").textContent = e.s; $("[data-res-v]").textContent = e.v;
      const ic = $("[data-res-ic]");
      if (e.logo) { ic.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${e.logo}&sz=128" alt="" width="28" height="28" referrerpolicy="no-referrer">`; ic.style.background = "#fff"; }
      else { ic.textContent = e.ic; ic.style.background = e.cor; }
      res.hidden = false; est.textContent = "salvo ✓";
      await espera(2600); i++;
    }
  };
  if ("IntersectionObserver" in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { ciclo(); o.disconnect(); } }).observe(conversa); else ciclo();
}

// 6. Abas de recursos trocam o texto e a tela do iPhone
const abas = [...document.querySelectorAll("[data-aba]")];
abas.forEach(b => b.addEventListener("click", () => {
  const n = b.dataset.aba;
  abas.forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  document.querySelectorAll("[data-painel]").forEach(p => p.classList.toggle("ativo", p.dataset.painel === n));
  document.querySelectorAll("[data-tela]").forEach(t => t.classList.toggle("ativo", t.dataset.tela === n));
}));

// 7. Acordeão com tela sincronizada (avança sozinho até a pessoa tocar)
const ac = document.querySelector("[data-acordeao]");
if (ac) {
  const itens = [...ac.querySelectorAll(".ac-item")];
  let atual = 0, timer = 0, auto = !calmo;
  const abrir = n => {
    atual = n;
    itens.forEach((it, k) => { it.classList.toggle("aberto", k === n); it.querySelector("button").setAttribute("aria-expanded", k === n ? "true" : "false"); });
    document.querySelectorAll("[data-ac-tela]").forEach(t => t.classList.toggle("ativo", Number(t.dataset.acTela) === n));
    clearTimeout(timer); if (auto) timer = setTimeout(() => abrir((atual + 1) % itens.length), 7000);
  };
  itens.forEach((it, k) => it.querySelector("button").addEventListener("click", () => { auto = false; ac.classList.remove("auto"); abrir(k); }));
  if (auto && "IntersectionObserver" in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { ac.classList.add("auto"); abrir(0); o.disconnect(); } }).observe(ac);
}
