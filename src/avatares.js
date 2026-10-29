/* =========================================================
   Avatares prontos: a própria Bolinha do app, minimalista. Cor chapada e só os olhinhos.
   Viram a foto de perfil (SVG leve, nítido em qualquer tamanho, sem precisar de foto).
   As medidas são as da Bolinha (src/App.jsx), ampliadas para a bola ocupar o quadro todo.
   ========================================================= */
const svgUrl = svg => "data:image/svg+xml;utf8," + encodeURIComponent(svg);
function bolinha(cor, olhos = "pilula") {
  const rosto = olhos === "feliz"
    ? `<path d="M67 132 Q88 102 109 132 M147 132 Q168 102 189 132" fill="none" stroke="#fff" stroke-width="19" stroke-linecap="round"/>`
    : `<rect x="72" y="80" width="32" height="69" rx="16" fill="#fff"/><rect x="152" y="80" width="32" height="69" rx="16" fill="#fff"/>`;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="${cor}"/>${rosto}</svg>`);
}

// As cores são as da Bolinha: verde no lado pessoal, azul no consultório
export const AVATARES = [
  { id: "verde", nome: "Verde", url: bolinha("#1FB879") },
  { id: "azul", nome: "Azul", url: bolinha("#2B46FF") },
  { id: "feliz", nome: "Sorrindo", url: bolinha("#1FB879", "feliz") },
];
export const ehAvatarPronto = foto => typeof foto === "string" && foto.startsWith("data:image/svg+xml");

// Quem escolheu uma bolinha de um desenho antigo ganha a nova parecida, sozinho.
// Devolve a nova (ou null se a foto já está em dia, ou é uma foto de verdade).
const ANTIGAS = [["#CFE3FF", "azul"], ["#FFD3E2", "verde"], ["#FFF0B8", "feliz"]]; // pela cor de fundo do desenho antigo
export function avatarAtualizado(foto) {
  if (!ehAvatarPronto(foto) || AVATARES.some(a => a.url === foto)) return null;
  let txt = foto; try { txt = decodeURIComponent(foto); } catch (e) {}
  const par = ANTIGAS.find(([cor]) => txt.toUpperCase().includes(cor));
  return (AVATARES.find(a => a.id === (par ? par[1] : "verde")) || AVATARES[0]).url;
}
