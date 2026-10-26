/* =========================================================
   Avatares prontos: bolinhas fofas com olhinhos, no estilo da Bolinha do app.
   Viram a foto de perfil (SVG leve, nítido em qualquer tamanho, sem precisar de foto).
   ========================================================= */
function bolinha({ fundo1, fundo2, corpo1, corpo2, bochecha, olho = "#2A2238" }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
<defs>
<radialGradient id="f" cx="30%" cy="20%" r="95%"><stop offset="0" stop-color="${fundo1}"/><stop offset="1" stop-color="${fundo2}"/></radialGradient>
<radialGradient id="c" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="${corpo1}"/><stop offset="1" stop-color="${corpo2}"/></radialGradient>
</defs>
<rect width="256" height="256" fill="url(#f)"/>
<ellipse cx="128" cy="232" rx="70" ry="12" fill="#000" opacity=".08"/>
<circle cx="128" cy="142" r="84" fill="url(#c)"/>
<ellipse cx="98" cy="96" rx="26" ry="14" fill="#fff" opacity=".35" transform="rotate(-28 98 96)"/>
<rect x="95" y="112" width="18" height="38" rx="9" fill="${olho}"/>
<rect x="143" y="112" width="18" height="38" rx="9" fill="${olho}"/>
<circle cx="106" cy="122" r="4.5" fill="#fff"/>
<circle cx="154" cy="122" r="4.5" fill="#fff"/>
<ellipse cx="78" cy="160" rx="15" ry="9" fill="${bochecha}" opacity=".75"/>
<ellipse cx="178" cy="160" rx="15" ry="9" fill="${bochecha}" opacity=".75"/>
<path d="M116 166 Q128 178 140 166" fill="none" stroke="${olho}" stroke-width="6" stroke-linecap="round"/>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg.replace(/\n/g, ""));
}

export const AVATARES = [
  { id: "rosa", nome: "Rosa", url: bolinha({ fundo1: "#FFD3E2", fundo2: "#FF8FB5", corpo1: "#FFF3F7", corpo2: "#FFC2D6", bochecha: "#FF6F9E" }) },
  { id: "azul", nome: "Azul", url: bolinha({ fundo1: "#CFE3FF", fundo2: "#6F9DFF", corpo1: "#F2F7FF", corpo2: "#B9D2FF", bochecha: "#FF8FB0" }) },
  { id: "amarelo", nome: "Amarelo", url: bolinha({ fundo1: "#FFF0B8", fundo2: "#FFC93C", corpo1: "#FFFBEA", corpo2: "#FFE58A", bochecha: "#FF9C7A" }) },
];
export const ehAvatarPronto = foto => typeof foto === "string" && foto.startsWith("data:image/svg+xml");
