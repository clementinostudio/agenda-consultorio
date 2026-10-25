// Página de apresentação (landing page). Usa as mesmas fontes do app.
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "./landing.css";

// Cada bloco aparece suavemente quando entra na tela
const blocos = document.querySelectorAll(".revela");
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
  blocos.forEach((b, i) => { b.style.transitionDelay = `${(i % 3) * 70}ms`; io.observe(b); });
} else blocos.forEach(b => b.classList.add("visivel"));

// A Bolinha pisca e olha em volta
const bola = document.querySelector(".bolinha");
if (bola) {
  const piscar = () => { bola.classList.add("pisca"); setTimeout(() => bola.classList.remove("pisca"), 130); setTimeout(piscar, 2200 + Math.random() * 3200); };
  const olhar = () => { const d = ["e", "d", "c", "c"][Math.floor(Math.random() * 4)]; bola.dataset.olha = d; setTimeout(olhar, 2000 + Math.random() * 2500); };
  setTimeout(piscar, 1500); setTimeout(olhar, 2500);
}

// Barra de cima ganha fundo de vidro ao rolar
const topo = document.querySelector(".topo");
const rolar = () => topo.classList.toggle("rolou", scrollY > 12);
addEventListener("scroll", rolar, { passive: true }); rolar();
